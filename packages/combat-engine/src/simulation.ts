import { resolveEquipment } from '@wwm/game-data';
import { runRotation, type CombatRequest } from './engine.js';
export type SimulationRequest = {
  combat: CombatRequest;
  mode: 'EXPECTED' | 'MONTE_CARLO';
  seed: number;
  samples: number;
};
export const simulationVersion = 'combat-simulation-v1/mulberry32-v1';
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function simulate(
  request: SimulationRequest,
  progress?: (completed: number, total: number) => void,
) {
  if (
    !['EXPECTED', 'MONTE_CARLO'].includes(request.mode) ||
    !Number.isInteger(request.seed) ||
    request.seed < 0 ||
    request.seed > 4294967295 ||
    !Number.isInteger(request.samples) ||
    request.samples < 1 ||
    request.samples > 10000
  )
    throw new Error('模式、seed（0–4294967295）或樣本數（1–10000）無效');
  const expected = runRotation(request.combat);
  const duration = request.combat.plan.durationMs / 1000;
  const issues = [...expected.issues];
  // Numeric previews may accept unresolved legality; a DPS claim may not.
  if (expected.warnings.some((w) => w.includes('尚未通過完整合法性驗證')))
    issues.push('裝備合法性尚未完整驗證，無法輸出DPS');
  if (request.combat.release) {
    for (const id of request.combat.build.equipmentIds) {
      const item = request.combat.equipment.find((e) => e.id === id);
      if (
        !item ||
        resolveEquipment(item, request.combat.release, {
          onlyExplicit:
            request.combat.onlyExplicit ||
            request.combat.plan.onlyExplicit ||
            item.onlyExplicit === true,
          estimatedAt: request.combat.evaluatedAt,
        }).equipment.validation.status !== 'VALID'
      )
        issues.push('裝備合法性尚未完整驗證：' + id);
    }
  }
  if (
    expected.totalExpectedDamage !== null &&
    !Number.isFinite(expected.totalExpectedDamage / duration)
  )
    issues.push('DPS運算超出有限數值範圍');
  const valid =
    expected.status === 'VALID' &&
    expected.totalExpectedDamage !== null &&
    !issues.length;
  const samples: number[] = [];
  let mean = 0,
    m2 = 0;
  if (valid && request.mode === 'MONTE_CARLO') {
    const random = seededRandom(request.seed);
    for (let i = 0; i < request.samples; i++) {
      const result = runRotation(request.combat, random);
      if (result.totalExpectedDamage === null || result.status !== 'VALID') {
        issues.push(...result.issues);
        break;
      }
      const value = result.totalExpectedDamage / duration;
      if (!Number.isFinite(value)) {
        issues.push('DPS運算超出有限數值範圍');
        break;
      }
      samples.push(value);
      const delta = value - mean;
      mean += delta / (i + 1);
      m2 += delta * (value - mean);
      if (!Number.isFinite(mean) || !Number.isFinite(m2)) {
        issues.push('抽樣統計超出有限數值範圍');
        break;
      }
      if ((i + 1) % 10 === 0 || i + 1 === request.samples)
        progress?.(i + 1, request.samples);
    }
  } else progress?.(1, 1);
  const complete = valid && !issues.length;
  const standardDeviation =
    complete && samples.length > 1
      ? Math.sqrt(m2 / (samples.length - 1))
      : null;
  const margin =
    standardDeviation === null
      ? null
      : (1.96 * standardDeviation) / Math.sqrt(samples.length);
  let cumulative = 0;
  return {
    algorithmVersion: simulationVersion,
    mode: request.mode,
    seed: request.seed,
    sampleCount: complete ? samples.length : 0,
    meanDps: !complete
      ? null
      : request.mode === 'EXPECTED'
        ? expected.totalExpectedDamage! / duration
        : mean,
    expectedDps: complete ? expected.totalExpectedDamage! / duration : null,
    standardDeviation,
    confidenceInterval:
      complete && margin !== null
        ? [Math.max(0, mean - margin), mean + margin]
        : null,
    intervalMethod:
      '95%常態近似的抽樣平均區間；小樣本可能不準確，不代表遊戲模型或資料可信區間。',
    samples: complete ? samples : [],
    timeline: complete
      ? expected.trace
          .filter((e) => e.damage !== null)
          .map((e) => ({
            atMs: e.atMs,
            cumulativeDamage: (cumulative += e.damage!),
          }))
      : [],
    bySkill: complete ? expected.bySkill : {},
    provenance: {
      ...expected.provenance,
      canCalculate: complete,
      blockingUnknowns: [
        ...new Set([...expected.provenance.blockingUnknowns, ...issues]),
      ],
      label: complete ? expected.provenance.label : '無法計算',
    },
    issues: [...new Set(issues)],
    expected,
    purpose: request.combat.release?.purpose ?? null,
  };
}
export type SimulationResult = ReturnType<typeof simulate>;
