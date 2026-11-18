import { z } from 'zod';
import {
  BuildSchema,
  CharacterSchema,
  EquipmentInstanceSchema,
  GameDataReleaseSchema,
  RotationPlanSchema,
  resolveEquipment,
  type EquipmentInstance,
} from '@wwm/game-data';
import { aggregateStats, calculateDamage } from '@wwm/stat-engine';
import {
  simulate,
  type CombatRequest,
  type SimulationResult,
} from '@wwm/combat-engine';
export const OptimizerOptionsSchema = z.strictObject({
  slots: z.array(z.string().min(1)).min(1).max(16),
  locked: z.record(z.string(), z.string()),
  excludedIds: z.array(z.string()),
  minimumStats: z.record(z.string(), z.number().finite()),
  requiredSets: z.record(z.string(), z.number().int().positive()),
  maximumCost: z.number().finite().nonnegative().nullable(),
  costs: z.record(z.string(), z.number().finite().nonnegative()),
  method: z.enum(['AUTO', 'BEAM']),
  beamWidth: z.number().int().min(1).max(100),
  topK: z.number().int().min(1).max(20),
  maxEvaluations: z.number().int().min(1).max(5000),
  maxNodes: z.number().int().min(1).max(50000),
});
export type OptimizerOptions = z.infer<typeof OptimizerOptionsSchema>;
export type OptimizationRequest = OptimizerOptions & { combat: CombatRequest };
export type OptimizationProgress = {
  phase: string;
  nodes: number;
  visited: number;
  evaluated: number;
  total: string;
};
export type RankedCandidate = {
  equipmentIds: string[];
  meanDps: number;
  deltaDps: number | null;
  gainPercent: number | null;
  cost: number | null;
  simulation: SimulationResult;
};
export type OptimizationResult = {
  status: 'COMPLETE' | 'PARTIAL' | 'BLOCKED' | 'CANCELLED';
  method: 'EXACT' | 'BEAM_LOCAL';
  algorithmVersion: string;
  optimalityProven: boolean;
  scope: string;
  totalCombinations: string;
  visited: number;
  evaluated: number;
  nodes: number;
  coverage: number;
  baselineDps: number | null;
  top: RankedCandidate[];
  rejected: { id: string; reason: string }[];
  issues: string[];
  purpose: string | null;
};
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const keyOf = (ids: string[]) => JSON.stringify(ids);
export function optimize(
  input: OptimizationRequest,
  hooks: {
    progress?: (p: OptimizationProgress) => void;
    isCancelled?: () => boolean;
  } = {},
): OptimizationResult {
  const result: OptimizationResult = {
    status: 'BLOCKED',
    method: 'EXACT',
    algorithmVersion: 'optimizer-v1/first-cast-proxy/beam-local-2',
    optimalityProven: false,
    scope:
      '僅本次輸入的已驗證合法候選與約束，不代表所有遊戲裝備或連續詞條的全域最優。',
    totalCombinations: '0',
    visited: 0,
    evaluated: 0,
    nodes: 0,
    coverage: 0,
    baselineDps: null,
    top: [],
    rejected: [],
    issues: [],
    purpose: input.combat?.release?.purpose ?? null,
  };
  const { combat, ...settings } = input;
  const parsed = OptimizerOptionsSchema.safeParse(settings);
  const validRelease = GameDataReleaseSchema.safeParse(combat?.release);
  if (
    !parsed.success ||
    !validRelease.success ||
    !BuildSchema.safeParse(combat?.build).success ||
    !CharacterSchema.safeParse(combat?.character).success ||
    !RotationPlanSchema.safeParse(combat?.plan).success ||
    !Array.isArray(combat?.equipment) ||
    combat.equipment.length > 500 ||
    combat.equipment.some((e) => !EquipmentInstanceSchema.safeParse(e).success)
  ) {
    result.issues.push('最佳化輸入契約無效或超出500件庫存上限');
    return result;
  }
  const o = parsed.data,
    release = validRelease.data;
  const onlyExplicit = combat.onlyExplicit || combat.plan.onlyExplicit;
  if (combat.build.panelMode !== 'BASE_ONLY') {
    result.issues.push(
      '換裝最佳化需要基礎面板；請先確認BASE_ONLY，不由已含裝備面板反推',
    );
    return result;
  }
  if (
    combat.character.level === null ||
    combat.character.gameVersionId !== release.version.id ||
    combat.plan.gameVersionId !== release.version.id ||
    !release.version.availableLevels.includes(combat.character.level) ||
    combat.build.characterId !== combat.character.id
  ) {
    result.issues.push('角色、配置、循環與版本等級不符');
    return result;
  }
  if (
    new Set(o.slots).size !== o.slots.length ||
    new Set(combat.equipment.map((e) => e.id)).size !==
      combat.equipment.length ||
    Object.keys(o.locked).some((s) => !o.slots.includes(s)) ||
    Object.keys(o.minimumStats).some(
      (id) => !release.stats.some((s) => s.id === id),
    ) ||
    Object.keys(o.requiredSets).some(
      (id) => !release.equipmentSets?.some((s) => s.id === id && s.verified),
    )
  ) {
    result.issues.push('重複部位/裝備，或約束引用未知屬性/套裝/鎖定部位');
    return result;
  }
  const progress = (phase: string) =>
    hooks.progress?.({
      phase,
      nodes: result.nodes,
      visited: result.visited,
      evaluated: result.evaluated,
      total: result.totalCombinations,
    });
  let cancelled = false,
    limited = false,
    unknown = false;
  const stop = () => {
    cancelled ||= hooks.isCancelled?.() === true;
    return cancelled;
  };
  const reject = (id: string, reason: string, isUnknown = false) => {
    unknown ||= isUnknown;
    if (result.rejected.length < 100) result.rejected.push({ id, reason });
  };
  const setByItem = new Map<string, string>();
  const slots = [...o.slots].sort(compareText),
    pools = new Map<string, EquipmentInstance[]>();
  slots.forEach((s) => pools.set(s, []));
  progress('FILTER');
  for (const item of [...combat.equipment].sort((a, b) =>
    compareText(a.id, b.id),
  )) {
    if (stop()) break;
    if (
      o.excludedIds.includes(item.id) ||
      item.gameVersionId !== release.version.id ||
      !item.slotId ||
      !pools.has(item.slotId)
    ) {
      reject(item.id, '不在本次版本/部位/允許清單');
      continue;
    }
    if (o.locked[item.slotId] && o.locked[item.slotId] !== item.id) {
      reject(item.id, '此部位已鎖定其他裝備');
      continue;
    }
    const defs = release.equipment.filter(
      (d) =>
        (item.definitionId === undefined || item.definitionId === d.id) &&
        d.slotId === item.slotId &&
        d.tierId === item.tierId &&
        d.quality === item.quality,
    );
    const def = defs.length === 1 ? defs[0] : undefined;
    if (!def || def.requiredLevel === null) {
      reject(item.id, '裝備身份或最低等級未知', true);
      continue;
    }
    if (def.requiredLevel > combat.character.level!) {
      reject(item.id, '角色未達最低等級');
      continue;
    }
    const resolved = resolveEquipment(item, release, {
      estimatedAt: combat.evaluatedAt,
      onlyExplicit: onlyExplicit || item.onlyExplicit === true,
    });
    if (resolved.equipment.validation.status !== 'VALID') {
      reject(
        item.id,
        resolved.equipment.validation.reasons.join('；'),
        resolved.equipment.validation.status === 'UNVERIFIED',
      );
      continue;
    }
    if (
      def.setId &&
      !release.equipmentSets?.find((s) => s.id === def.setId)?.verified
    ) {
      reject(item.id, '套裝完整效果未知', true);
      continue;
    }
    if (o.maximumCost !== null && o.costs[item.id] === undefined) {
      reject(item.id, '預算啟用但自訂成本未知', true);
      continue;
    }
    if (o.maximumCost !== null && o.costs[item.id] > o.maximumCost) {
      reject(item.id, '單件成本超過預算');
      continue;
    }
    if (def.setId) setByItem.set(item.id, def.setId);
    pools.get(item.slotId)!.push(resolved.equipment);
  }
  const finish = () => {
    result.coverage =
      result.totalCombinations === '0'
        ? 0
        : Number(
            (BigInt(result.visited) * 1000000n) /
              BigInt(result.totalCombinations),
          ) / 1000000;
    if (cancelled) {
      result.status = 'CANCELLED';
      result.top = [];
      result.optimalityProven = false;
    }
    progress(cancelled ? 'CANCELLED' : 'DONE');
    return result;
  };
  if (cancelled) return finish();
  if (slots.some((s) => !pools.get(s)!.length)) {
    result.issues.push('至少一個選定部位沒有合法候選，或鎖定裝備不可用');
    return finish();
  }
  const total = slots.reduce((n, s) => n * BigInt(pools.get(s)!.length), 1n);
  result.totalCombinations = total.toString();
  result.method =
    o.method === 'AUTO' && combat.equipment.length <= 10 && total <= 5000n
      ? 'EXACT'
      : 'BEAM_LOCAL';
  const makeCombat = (ids: string[]): CombatRequest => ({
    ...combat,
    release,
    onlyExplicit,
    build: { ...combat.build, equipmentIds: ids },
  });
  const baseline = simulate({
    combat: { ...combat, onlyExplicit },
    mode: 'EXPECTED',
    seed: 0,
    samples: 1,
  });
  result.baselineDps = baseline.meanDps;
  const cache = new Map<string, number | null>();
  const rank = (a: RankedCandidate, b: RankedCandidate) =>
    b.meanDps - a.meanDps ||
    compareText(keyOf(a.equipmentIds), keyOf(b.equipmentIds));
  function evaluate(ids: string[]) {
    const key = keyOf(ids);
    if (cache.has(key) || stop()) return;
    if (result.evaluated >= o.maxEvaluations || result.nodes >= o.maxNodes) {
      limited = true;
      return;
    }
    result.visited++;
    result.nodes++;
    cache.set(key, null);
    const costs = ids.map((id) => o.costs[id]);
    const cost = costs.every((n) => n !== undefined)
      ? costs.reduce((a, b) => a + b, 0)
      : null;
    if (cost !== null && !Number.isFinite(cost)) {
      reject(key, '成本總和溢位', true);
      return;
    }
    if (o.maximumCost !== null && (cost === null || cost > o.maximumCost))
      return;
    for (const [setId, minimum] of Object.entries(o.requiredSets)) {
      if (ids.filter((id) => setByItem.get(id) === setId).length < minimum)
        return;
    }
    const request = makeCombat(ids);
    if (Object.keys(o.minimumStats).length) {
      const aggregated = aggregateStats(request);
      for (const [statId, minimum] of Object.entries(o.minimumStats)) {
        const value = aggregated.stats[statId]?.value;
        if (value === null || value === undefined) {
          reject(key, '最低屬性約束缺少必要值：' + statId, true);
          return;
        }
        if (value < minimum) return;
      }
    }
    result.evaluated++;
    const simulation = simulate({
      combat: request,
      mode: 'EXPECTED',
      seed: 0,
      samples: 1,
    });
    if (simulation.meanDps === null) {
      reject(key, simulation.issues.join('；') || '循環DPS未知', true);
      return;
    }
    const dps = simulation.meanDps;
    cache.set(key, dps);
    const delta = result.baselineDps === null ? null : dps - result.baselineDps;
    const gain =
      delta === null || result.baselineDps === 0
        ? null
        : (delta / result.baselineDps!) * 100;
    result.top.push({
      equipmentIds: [...ids],
      meanDps: dps,
      deltaDps: delta,
      gainPercent: gain !== null && Number.isFinite(gain) ? gain : null,
      cost,
      simulation,
    });
    result.top.sort(rank);
    result.top = result.top.slice(0, o.topK);
    if (result.visited % 10 === 0) progress('SIMULATE');
  }
  if (result.method === 'EXACT') {
    const walk = (index: number, ids: string[]) => {
      if (stop() || limited) return;
      if (index === slots.length) {
        evaluate(ids);
        return;
      }
      for (const item of pools.get(slots[index])!) {
        walk(index + 1, [...ids, item.id]);
        if (limited || cancelled) break;
      }
    };
    walk(0, []);
  } else {
    const firstCast =
      combat.plan.mode === 'FIXED'
        ? combat.plan.actions
            .map((a) => a.action)
            .find((a) => a.kind === 'CAST')
        : combat.plan.priorityRules
            .map((r) => r.action)
            .find((a) => a.kind === 'CAST');
    const proxy = (ids: string[]) => {
      if (!firstCast || firstCast.kind !== 'CAST') return 0;
      const filled = slots.map((s, i) => ids[i] ?? pools.get(s)![0].id);
      return calculateDamage({
        ...makeCombat(filled),
        skillId: firstCast.skillId,
        ...(firstCast.variantId ? { variantId: firstCast.variantId } : {}),
      }).expectedDamage;
    };
    let beam: { ids: string[]; score: number | null }[] = [
      { ids: [], score: null },
    ];
    for (const slot of slots) {
      const next: typeof beam = [];
      for (const parent of beam)
        for (const item of pools.get(slot)!) {
          if (stop() || result.nodes >= o.maxNodes) {
            limited = true;
            break;
          }
          result.nodes++;
          const ids = [...parent.ids, item.id];
          next.push({ ids, score: proxy(ids) });
        }
      next.sort((a, b) =>
        a.score === null && b.score !== null
          ? 1
          : b.score === null && a.score !== null
            ? -1
            : (b.score ?? 0) - (a.score ?? 0) ||
              compareText(keyOf(a.ids), keyOf(b.ids)),
      );
      beam = next.slice(0, o.beamWidth);
      progress('BEAM');
      if (cancelled || limited) break;
    }
    for (const entry of beam)
      if (entry.ids.length === slots.length) evaluate(entry.ids);
    for (let round = 0; round < 2 && !cancelled && !limited; round++) {
      const seeds = result.top.map((r) => r.equipmentIds);
      for (const seed of seeds)
        for (let i = 0; i < slots.length; i++)
          for (const item of pools.get(slots[i])!) {
            const ids = [...seed];
            ids[i] = item.id;
            evaluate(ids);
            if (cancelled || limited) break;
          }
      progress('LOCAL');
    }
  }
  if (limited) result.issues.push('達到搜尋或完整重算上限，未證明最優');
  if (!result.top.length) result.issues.push('沒有可計算且滿足全部約束的候選');
  result.optimalityProven =
    result.method === 'EXACT' &&
    !limited &&
    !unknown &&
    BigInt(result.visited) === total;
  result.status = !result.top.length
    ? 'BLOCKED'
    : limited || unknown || result.method === 'BEAM_LOCAL'
      ? 'PARTIAL'
      : 'COMPLETE';
  return finish();
}
