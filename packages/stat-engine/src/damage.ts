import {
  GameDataReleaseSchema,
  unsupportedPathHandlers,
  type ResolvedValue,
} from '@wwm/game-data';
import {
  aggregateStats,
  traceValues,
  type Aggregation,
  type EngineRequest,
  type DerivedValue,
} from './aggregate.js';
export const damageImplementation = {
  id: 'weighted-hit-v1',
  equation:
    '(attack × coefficient + flatDamage) × damage-multiplier × enemy-multiplier × (normal-probability × normal-multiplier + critical-probability × critical-multiplier + insight-probability × insight-multiplier)',
  assumptions: [
    '四種命中結果互斥且機率總和為1；機率使用0–1比例，失誤不造成傷害。',
    '敵人與增傷倍率由同版公式明確提供；不在此推測防禦、抗性或面板轉換率。',
    '這是單技能固定條件期望值，沒有循環、冷卻、Buff時間軸或DPS。',
  ],
} as const;
export type DamageRequest = EngineRequest & {
  skillId: string;
  variantId?: string;
};
export type DamageResult = DerivedValue & {
  expectedDamage: number | null;
  meanDps: null;
  dpsReason: string;
  aggregation: Aggregation;
  issues: string[];
  warnings: string[];
  hits: {
    id: string;
    expectedDamage: number | null;
    baseDamage: number | null;
  }[];
  outcomes: { probability: number; multiplier: number }[] | null;
  variant: {
    id: string;
    name: string;
    chargeMs: number | null;
    requiredStateIds: string[];
    swordEnergy: ResolvedValue;
    events: unknown[];
  } | null;
  formula: {
    id: string;
    implementationId: string;
    version: string;
    evidence: unknown;
    equation: string;
  } | null;
  context: {
    gameVersionId: string | null;
    characterId: string;
    buildId: string;
    pathId: string;
    level: number | null;
    skillId: string;
    variantId: string | null;
    onlyExplicit: boolean;
    evaluatedAt: string;
  };
  assumptions: string[];
};
const missing = (version: string | null, reason: string): ResolvedValue => ({
  gameVersionId: version,
  status: 'UNKNOWN',
  value: null,
  reason,
});
export function calculateDamage(request: DamageRequest): DamageResult {
  const aggregation = aggregateStats(request);
  const issues = [...aggregation.issues];
  const dependencies: Record<string, ResolvedValue> = {};
  const extraEstimates: string[] = [];
  const context = {
    gameVersionId: request.character.gameVersionId,
    characterId: request.character.id,
    buildId: request.build.id,
    pathId: request.character.pathId,
    level: request.character.level,
    skillId: request.skillId,
    variantId: request.variantId ?? null,
    onlyExplicit: request.onlyExplicit,
    evaluatedAt: request.evaluatedAt,
  };
  const releaseValid =
    request.release && GameDataReleaseSchema.safeParse(request.release).success;
  const release = releaseValid ? request.release : undefined;
  const version = release?.version.id ?? '';
  const skill = release?.skills.find((s) => s.id === request.skillId);
  const variant = request.variantId
    ? skill?.variants?.find((v) => v.id === request.variantId)
    : undefined;
  const skillHits =
    variant?.hits ?? (skill?.variants?.length ? [] : (skill?.hits ?? []));
  const applicability = variant?.applicability ?? skill?.applicability;
  if ((skill?.variants?.length && !variant) || (request.variantId && !variant))
    issues.push('請明確選擇此版本的技能變體，不套用其他變體係數');
  const path = release?.paths.find((p) => p.id === request.character.pathId);
  if (unsupportedPathHandlers(path?.requiredHandlerIds).length)
    issues.push(
      '未支援此流派必要機制：' +
        unsupportedPathHandlers(path?.requiredHandlerIds).join('、'),
    );
  const formula = skill?.formulaId
    ? release?.formulas.find((f) => f.id === skill.formulaId)
    : undefined;
  if (!skill) issues.push('缺少此版本技能');
  if (skill && !path?.martialArtIds.includes(skill.martialArtId))
    issues.push('技能不屬於此流派，不借用其他流派係數');
  const arts = skill
    ? request.build.martialArts.filter((a) => a.id === skill.martialArtId)
    : [];
  if (
    skill &&
    (arts.length !== 1 ||
      arts[0].level === null ||
      !applicability ||
      !applicability?.martialArtLevels.includes(arts[0].level) ||
      request.character.level === null ||
      !applicability.characterLevels.includes(request.character.level))
  )
    issues.push('缺少適用此角色／武學等級的技能數值範圍');
  if (!formula || !path?.formulaIds.includes(formula.id))
    issues.push('缺少此流派明確綁定的公式');
  if (formula?.implementationId !== damageImplementation.id)
    issues.push('公式實作未支援，不能使用替代公式');
  if (!formula?.evidence || formula.evidence.status === 'UNKNOWN')
    issues.push('公式尚缺驗證或已登記推估模型');
  if (formula?.evidence?.status === 'ESTIMATED')
    extraEstimates.push(
      'formula:' + formula.id + ':' + formula.evidence.modelVersion,
    );
  const read = (key: string, unit: string, statOnly = false): number | null => {
    const binding = formula?.statBindings?.[key];
    const parameter = formula?.parameters[key];
    if (binding && parameter) {
      issues.push('公式輸入同時綁定屬性及參數：' + key);
      return null;
    }
    if (binding) {
      const stat = aggregation.stats[binding];
      if (!stat || stat.unit !== unit) {
        issues.push('公式綁定缺少屬性或單位不符：' + key);
        dependencies['binding:' + key] = missing(version, '預期單位 ' + unit);
        return null;
      }
      Object.assign(dependencies, stat.dependencies);
      if (!stat.provenance.canCalculate)
        issues.push(
          ...stat.provenance.blockingUnknowns.map(
            (id) => '屬性 ' + binding + '：' + id,
          ),
        );
      return stat.value;
    }
    if (statOnly || !parameter) {
      dependencies['formula:' + key] = missing(version, '缺少公式輸入');
      return null;
    }
    dependencies['formula:' + key] = parameter;
    return parameter.value;
  };
  const attack = read('attack', 'points', true);
  const probabilityKeys = [
    'normal-probability',
    'critical-probability',
    'insight-probability',
    'miss-probability',
  ];
  const multiplierKeys = [
    'normal-multiplier',
    'critical-multiplier',
    'insight-multiplier',
    'damage-multiplier',
    'enemy-multiplier',
  ];
  const probability = Object.fromEntries(
    probabilityKeys.map((key) => [key, read(key, 'ratio')]),
  );
  const multipliers = Object.fromEntries(
    multiplierKeys.map((key) => [key, read(key, 'ratio')]),
  );
  if (attack !== null && attack < 0) issues.push('攻擊值不可為負數');
  if (Object.values(probability).some((p) => p !== null && (p < 0 || p > 1)))
    issues.push('命中機率必須介於0與1');
  if (
    Object.values(probability).every((p) => p !== null) &&
    Math.abs(
      Object.values(probability).reduce<number>((a, b) => a + b!, 0) - 1,
    ) > 1e-9
  )
    issues.push('互斥命中機率總和必須為1');
  if (Object.values(multipliers).some((m) => m !== null && m < 0))
    issues.push('傷害倍率不可為負數');
  if (!skillHits.length) issues.push('缺少技能命中段數與係數');
  for (const hit of skillHits) {
    dependencies['hit:' + hit.id + ':coefficient'] = hit.coefficient;
    dependencies['hit:' + hit.id + ':flat'] = hit.flatDamage;
    if (
      (hit.coefficient.value !== null && hit.coefficient.value < 0) ||
      (hit.flatDamage.value !== null && hit.flatDamage.value < 0)
    )
      issues.push('技能係數／固定傷害不可為負數：' + hit.id);
  }
  let traced = traceValues(
    dependencies,
    version,
    request.onlyExplicit,
    issues,
    extraEstimates,
  );
  const weighted = traced.provenance.canCalculate
    ? probability['normal-probability']! * multipliers['normal-multiplier']! +
      probability['critical-probability']! *
        multipliers['critical-multiplier']! +
      probability['insight-probability']! * multipliers['insight-multiplier']!
    : null;
  let hits = skillHits.map((hit) => {
    const base = traced.provenance.canCalculate
      ? attack! * hit.coefficient.value! + hit.flatDamage.value!
      : null;
    const damage =
      base === null
        ? null
        : base *
          multipliers['damage-multiplier']! *
          multipliers['enemy-multiplier']! *
          weighted!;
    return { id: hit.id, expectedDamage: damage, baseDamage: base };
  });
  let expectedDamage = traced.provenance.canCalculate
    ? hits.reduce((a, h) => a + h.expectedDamage!, 0)
    : null;
  if (
    expectedDamage !== null &&
    (!Number.isFinite(expectedDamage) ||
      hits.some(
        (h) =>
          !Number.isFinite(h.baseDamage) || !Number.isFinite(h.expectedDamage),
      ))
  ) {
    issues.push('傷害運算超出有限數值範圍');
    traced = traceValues(
      dependencies,
      version,
      request.onlyExplicit,
      issues,
      extraEstimates,
    );
    expectedDamage = null;
    hits = hits.map((h) => ({ ...h, expectedDamage: null, baseDamage: null }));
  }
  return {
    ...traced,
    value: expectedDamage,
    expectedDamage,
    meanDps: null,
    status:
      expectedDamage === null
        ? 'UNKNOWN'
        : traced.provenance.containsEstimates
          ? 'ESTIMATED'
          : 'EXPLICIT',
    dpsReason: '尚未建立戰鬥循環與時間模型，不將單技能傷害當成DPS',
    aggregation,
    issues: [...new Set(issues)],
    warnings: aggregation.warnings,
    hits,
    outcomes:
      expectedDamage === null
        ? null
        : [
            ...['normal', 'critical', 'insight'].map((kind) => ({
              probability: probability[kind + '-probability']!,
              multiplier:
                multipliers[kind + '-multiplier']! *
                multipliers['damage-multiplier']! *
                multipliers['enemy-multiplier']!,
            })),
            { probability: probability['miss-probability']!, multiplier: 0 },
          ],
    variant: variant ? structuredClone(variant) : null,
    formula: formula
      ? {
          id: formula.id,
          implementationId: formula.implementationId,
          version: formula.formulaVersion,
          evidence: formula.evidence ?? null,
          equation:
            formula.implementationId === damageImplementation.id
              ? damageImplementation.equation
              : '未支援，不執行公式',
        }
      : null,
    context,
    assumptions: [
      ...damageImplementation.assumptions,
      ...(variant
        ? ['僅預覽所選變體的固定係數；蓄力、劍氣、切換與狀態事件尚未執行。']
        : []),
    ],
  };
}
