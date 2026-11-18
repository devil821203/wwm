import type { ResolvedValue, AffixCapRule } from './schemas.js';
import { EquipmentInstanceSchema, GameDataReleaseSchema } from './schemas.js';
import { summarizeProvenance } from './value-resolution.js';
const missing = (version: string | null, reason: string): ResolvedValue => ({
  gameVersionId: version,
  status: 'UNKNOWN',
  value: null,
  reason,
});
const explicit = (
  v: ResolvedValue,
): v is Extract<ResolvedValue, { status: 'RECORDED' | 'MANUAL_CONFIRMED' }> =>
  v.status === 'RECORDED' || v.status === 'MANUAL_CONFIRMED';
const usable = (
  v: ResolvedValue,
  version: string | null,
  onlyExplicit: boolean,
) =>
  v.gameVersionId === version &&
  v.status !== 'UNKNOWN' &&
  (!onlyExplicit || explicit(v));
const nearInteger = (n: number) => Math.abs(n - Math.round(n)) <= 1e-8;
function quantize(value: number, rule: AffixCapRule) {
  if (
    rule.step === null ||
    rule.roundingRule === null ||
    rule.roundingRule === 'NONE'
  )
    return value;
  const origin = rule.minimum?.status === 'RECORDED' ? rule.minimum.value : 0;
  const quotient = (value - origin) / rule.step;
  const snapped = nearInteger(quotient) ? Math.round(quotient) : quotient;
  const units =
    rule.roundingRule === 'ROUND'
      ? Math.round(snapped)
      : rule.roundingRule === 'FLOOR'
        ? Math.floor(snapped)
        : Math.trunc(snapped);
  // Remove binary arithmetic residue only when verified precision is available.
  const result = origin + units * rule.step;
  return rule.chengYinModel?.precisionVerified &&
    rule.chengYinModel.precision !== null
    ? Number(result.toFixed(rule.chengYinModel.precision))
    : result;
}
export function resolveEquipment(
  input: import('./schemas.js').EquipmentInstance,
  rawRelease?: import('./schemas.js').GameDataRelease,
  options: { onlyExplicit?: boolean; estimatedAt: string } = {
    estimatedAt: new Date().toISOString(),
  },
) {
  const item = structuredClone(EquipmentInstanceSchema.parse(input));
  const version = item.gameVersionId;
  const onlyExplicit = options.onlyExplicit ?? item.onlyExplicit ?? false;
  item.onlyExplicit = onlyExplicit;
  const release = rawRelease
    ? GameDataReleaseSchema.parse(rawRelease)
    : undefined;
  const warnings: string[] = [];
  const invalid = [];
  const unknown = [];
  const matches =
    release?.version.id === version
      ? release.equipment.filter(
          (def) =>
            (item.definitionId === undefined || item.definitionId === def.id) &&
            def.slotId === item.slotId &&
            def.tierId === item.tierId &&
            def.quality === item.quality,
        )
      : [];
  const definition = matches.length === 1 ? matches[0] : undefined;
  if (!definition) unknown.push('缺少唯一匹配的版本／部位／階級／品質裝備定義');
  const rules = definition?.legality;
  if (item.tuningStage === null) unknown.push('調律階段未知');
  if (!rules?.verified)
    unknown.push('缺少已驗證的完整詞條池、數量、互斥與階段規則');
  const choose = (v: ResolvedValue, reason: string) =>
    usable(v, version, onlyExplicit)
      ? structuredClone(v)
      : missing(version, reason);
  const baseIds = new Set([
    ...item.baseStats.map((s) => s.statId),
    ...(definition?.baseStats.map((s) => s.statId) ?? []),
  ]);
  item.effectiveBaseStats = [...baseIds].map((statId) => {
    const current = item.baseStats.find((s) => s.statId === statId)?.value;
    const database = definition?.baseStats.find(
      (s) => s.statId === statId,
    )?.value;
    if (
      current?.status === 'MANUAL_CONFIRMED' &&
      usable(current, version, onlyExplicit)
    ) {
      if (
        database &&
        database.status !== 'UNKNOWN' &&
        current.value !== database.value
      )
        warnings.push(
          '基礎屬性 ' + statId + '：人工值與資料庫不同，保留實例覆寫',
        );
      return { statId, value: structuredClone(current) };
    }
    // Never carry recorded values from an old quality/tier as a fallback.
    return {
      statId,
      value: database
        ? choose(database, '基礎屬性不符合明確資料模式')
        : missing(version, '缺少同品質基礎屬性資料'),
    };
  });
  if (
    definition &&
    item.baseStats.some(
      (s) => !definition.baseStats.some((base) => base.statId === s.statId),
    )
  )
    unknown.push('存在裝備定義未涵蓋的基礎屬性');
  if (!item.effectiveBaseStats.length) unknown.push('缺少基礎屬性資料');
  if (rules?.verified) {
    if (!rules.tuningStages.includes(item.tuningStage))
      invalid.push('調律階段不在合法規則內');
    if (
      item.affixes.length < rules.minAffixes ||
      item.affixes.length > rules.maxAffixes
    )
      invalid.push('詞條數量不合法');
    for (const group of rules.exclusionGroups) {
      if (item.affixes.filter((a) => group.includes(a.affixId)).length > 1)
        invalid.push('互斥詞條：' + group.join('、'));
    }
  }
  const caps = new Map();
  item.affixes = item.affixes.map((affix) => {
    const found =
      release?.version.id === version
        ? release.affixCaps.filter(
            (cap) =>
              cap.gameVersionId === version &&
              cap.tierId === item.tierId &&
              cap.quality === item.quality &&
              cap.affixId === affix.affixId &&
              cap.tuningStage === item.tuningStage,
          )
        : [];
    const cap = found.length === 1 ? found[0] : undefined;
    if (cap) caps.set(affix.affixId, cap);
    const stat = release?.stats.find(
      (s) =>
        s.id === release.affixes.find((a) => a.id === affix.affixId)?.statId,
    );
    const unitMatches = !!cap && cap.unit === stat?.unit;
    const maximum =
      cap && unitMatches
        ? choose(cap.maximum, '上限未知或禁止預估')
        : missing(
            version,
            found.length > 1
              ? '同條件上限規則衝突'
              : '缺少同條件上限或單位不符',
          );
    let effective: ResolvedValue;
    if (affix.valueMode === 'MAX') {
      effective =
        item.isChengYin && !affix.maxOnChengYinConfirmed
          ? missing(version, '承音與MAX衝突，請明確選擇使用當階滿值')
          : structuredClone(maximum);
    } else if (
      affix.current.status === 'MANUAL_CONFIRMED' &&
      usable(affix.current, version, onlyExplicit)
    ) {
      effective = structuredClone(affix.current);
      if (
        affix.valueMode === 'CHENG_YIN' &&
        cap?.chengYinValue.status === 'RECORDED' &&
        effective.value !== cap.chengYinValue.value
      )
        warnings.push(
          affix.affixId + '：人工值與承音資料庫值不同，保留實例覆寫',
        );
    } else if (affix.valueMode === 'MANUAL') {
      effective = choose(affix.current, '目前值未確認或禁止預估');
    } else if (cap && unitMatches && cap.chengYinValue.status === 'RECORDED') {
      effective = structuredClone(cap.chengYinValue);
    } else if (
      cap &&
      unitMatches &&
      !onlyExplicit &&
      cap.chengYinValue.status === 'ESTIMATED'
    ) {
      effective = structuredClone(cap.chengYinValue);
    } else if (
      cap?.chengYinModel &&
      unitMatches &&
      !onlyExplicit &&
      maximum.status !== 'UNKNOWN'
    ) {
      const model = cap.chengYinModel;
      const raw = maximum.value * model.ratio;
      const value =
        cap.precisionVerified && model.precisionVerified
          ? quantize(raw, cap)
          : raw;
      const inputSources = 'sourceIds' in maximum ? maximum.sourceIds : [];
      effective = Number.isFinite(value)
        ? {
            status: 'ESTIMATED',
            gameVersionId: version as string,
            value,
            formulaId: model.formulaId,
            modelVersion: model.modelVersion,
            estimatedAt: options.estimatedAt,
            sourceIds: [...new Set([...inputSources, ...model.sourceIds])],
            inputs: {
              maximum: maximum.value,
              ratio: model.ratio,
              ...(cap.step !== null ? { step: cap.step } : {}),
            },
            note:
              '模型登記日期：' +
              model.registeredAt +
              '；單位：' +
              cap.unit +
              '；正規化：' +
              (cap.roundingRule ?? '未驗證') +
              '；精度：' +
              (model.precision ?? '未知') +
              '；精度已驗證：' +
              model.precisionVerified,
          }
        : missing(version, '推估結果非有限數值');
    } else
      effective = missing(
        version,
        onlyExplicit
          ? '僅使用明確資料，缺少明確承音值'
          : '缺少承音實值或適用版本模型',
      );
    if (definition && !definition.allowedAffixIds.includes(affix.affixId))
      invalid.push(affix.affixId + ' 不在可用詞條池');
    if (effective.status !== 'UNKNOWN') {
      if (maximum.status === 'UNKNOWN' || !explicit(maximum))
        unknown.push(affix.affixId + ' 缺少明確當階上限');
      else if (effective.value > maximum.value + 1e-8)
        invalid.push(affix.affixId + ' 超過當階上限');
      const minimum = cap?.minimum;
      if (!minimum || !explicit(minimum))
        unknown.push(affix.affixId + ' 缺少明確下限');
      else if (effective.value < minimum.value - 1e-8)
        invalid.push(affix.affixId + ' 低於合法下限');
      if (
        !unitMatches ||
        !cap?.precisionVerified ||
        cap.step === null ||
        cap.roundingRule === null
      )
        unknown.push(affix.affixId + ' 缺少已驗證單位／步進／精度');
      else if (
        !nearInteger((effective.value - (minimum?.value ?? 0)) / cap.step)
      )
        invalid.push(affix.affixId + ' 不符合步進');
      if (effective.status === 'ESTIMATED')
        unknown.push(affix.affixId + ' 使用預估值，不能宣稱精確合法');
    }
    return { ...affix, effective, maximum };
  });
  const dependencies: Record<string, ResolvedValue> = {};
  for (const stat of item.effectiveBaseStats)
    dependencies['base:' + stat.statId] = stat.value;
  for (const affix of item.affixes)
    dependencies['affix:' + affix.affixId] = affix.effective;
  const provenance = summarizeProvenance(
    dependencies,
    Object.keys(dependencies),
    version ?? '',
  );
  unknown.push(...provenance.blockingUnknowns.map((id) => id + ' 未知'));
  if (item.effectiveBaseStats.some((s) => s.value.status === 'ESTIMATED'))
    unknown.push('基礎屬性包含預估值');
  item.validation = {
    status: invalid.length
      ? 'INVALID'
      : unknown.length
        ? 'UNVERIFIED'
        : 'VALID',
    reasons: [...new Set([...invalid, ...unknown])],
    ...(rules ? { ruleVersion: rules.ruleVersion } : {}),
  };
  // A verified MAX requires the whole proposed combination to be VALID; current
  // MANUAL values may be incomplete, so validate a separate MAX proposal.
  const maxComplete = item.affixes.every((a) => {
    const cap = caps.get(a.affixId);
    return (
      a.maximum.status === 'RECORDED' &&
      cap?.minimum?.status === 'RECORDED' &&
      cap.precisionVerified &&
      cap.step !== null &&
      cap.roundingRule !== null &&
      nearInteger((a.maximum.value - cap.minimum.value) / cap.step) &&
      a.maximum.value >= cap.minimum.value
    );
  });
  const structuralProblems = invalid.filter(
    (reason) =>
      !reason.includes('當階上限') &&
      !reason.includes('合法下限') &&
      !reason.includes('步進'),
  );
  const canApplyLegalMaximum =
    item.tuningStage !== null &&
    !item.baseStats.some(
      (s) => !definition?.baseStats.some((base) => base.statId === s.statId),
    ) &&
    !!definition &&
    !!rules?.verified &&
    maxComplete &&
    structuralProblems.length === 0 &&
    item.effectiveBaseStats.length > 0 &&
    item.effectiveBaseStats.every((s) => explicit(s.value));
  return { equipment: item, warnings, provenance, canApplyLegalMaximum };
}

export type EquipmentResolution = {
  equipment: import('./schemas.js').EquipmentInstance;
  warnings: string[];
  provenance: ReturnType<typeof summarizeProvenance>;
  canApplyLegalMaximum: boolean;
};
