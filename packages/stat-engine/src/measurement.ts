import {
  MeasurementSchema,
  type Measurement,
  type GameDataRelease,
} from '@wwm/game-data';
import { calculateDamage } from './damage.js';
const mean = (values: number[]) =>
  values.reduce(
    (average, value, index) => average + (value - average) / (index + 1),
    0,
  );
export function compareMeasurement(input: Measurement) {
  const measurement = MeasurementSchema.parse(input);
  const observedMean = mean(measurement.samples);
  const issues: string[] = [];
  if (measurement.kind !== 'SINGLE_SKILL')
    issues.push('60秒觀察僅保存總傷害，循環模型尚未實作');
  if (measurement.sampling !== 'UNFILTERED_CAST_TOTAL')
    issues.push('僅未篩選的完整單次施放總傷害可與期望值比較');
  if (!measurement.comparisonContextConfirmed)
    issues.push('尚未確認敵人與狀態符合快照公式假設');
  const prediction =
    measurement.kind === 'SINGLE_SKILL'
      ? calculateDamage({
          ...measurement.snapshot,
          skillId: measurement.skillId!,
          ...(measurement.variantId
            ? { variantId: measurement.variantId }
            : {}),
        })
      : null;
  if (prediction?.expectedDamage === null)
    issues.push(...prediction.provenance.blockingUnknowns);
  const expected = prediction?.expectedDamage ?? null;
  let mae: number | null = null,
    mape: number | null = null,
    bias: number | null = null;
  let zeroExcluded = 0;
  if (!issues.length && expected !== null) {
    mae = mean(measurement.samples.map((value) => Math.abs(expected - value)));
    bias = expected - observedMean;
    const percentages = measurement.samples.flatMap((value) => {
      if (value === 0) {
        zeroExcluded++;
        return [];
      }
      return [(Math.abs(expected - value) / value) * 100];
    });
    mape = percentages.length ? mean(percentages) : null;
    if (
      !Number.isFinite(mae) ||
      !Number.isFinite(bias) ||
      (mape !== null && !Number.isFinite(mape))
    ) {
      issues.push('誤差統計超出有限數值範圍');
      mae = null;
      mape = null;
      bias = null;
    }
  }
  return {
    status: issues.length ? 'NOT_COMPARABLE' : 'OBSERVATION_COMPARISON',
    label: '觀察比較，未校準',
    sampleCount: measurement.samples.length,
    observedMean,
    expectedDamage: expected,
    mae,
    mapePercent: mape,
    bias,
    zeroExcluded,
    issues: [...new Set(issues)],
    prediction,
    meanDps: null,
    note: '未設定通過門檻；樣本不自動變成技能係數，不回寫主資料。',
  };
}
export function bellstrikeCoverage(release?: GameDataRelease) {
  const path = release?.paths.find((p) => p.id === 'bellstrike_splendor');
  const missing: string[] = [];
  if (!release || !path)
    missing.push('尚無鳴金·虹版本資料；實際技能與係數未知');
  if (path && path.martialArtIds.length !== 2)
    missing.push('缺少兩門武學的版本定義');
  const skills =
    release?.skills
      .filter((s) => path?.martialArtIds.includes(s.martialArtId))
      .map((skill) => {
        if (skill.cooldownMs === null) missing.push(skill.name + ' 冷卻未知');
        if (skill.castTimeMs === null)
          missing.push(skill.name + ' 施放時間未知');
        if (skill.formulaId === null) missing.push(skill.name + ' 公式未知');
        const profiles = (
          skill.variants?.length
            ? skill.variants
            : [
                {
                  id: 'base',
                  name: '基本技能',
                  hits: skill.hits,
                  events: [],
                  chargeMs: null,
                },
              ]
        ).map((variant) => {
          const missingFields: string[] = [];
          if (
            'swordEnergy' in variant &&
            variant.swordEnergy.status === 'UNKNOWN'
          )
            missingFields.push('劍氣數值');
          if (!variant.hits.length) missingFields.push('命中清單');
          variant.hits.forEach((hit) => {
            if (hit.coefficient.status === 'UNKNOWN')
              missingFields.push(hit.id + ' 係數');
            if (hit.flatDamage.status === 'UNKNOWN')
              missingFields.push(hit.id + ' 固定傷害');
            if (hit.offsetMs === null) missingFields.push(hit.id + ' 命中時間');
          });
          variant.events.forEach((event) => {
            if (event.offsetMs === null)
              missingFields.push(event.id + ' 事件時間');
            if (event.amount.status === 'UNKNOWN')
              missingFields.push(event.id + ' 事件量');
          });
          if (variant.chargeMs === null)
            missingFields.push('蓄力時間／不適用狀態未明');
          return { id: variant.id, name: variant.name, missing: missingFields };
        });
        return { id: skill.id, name: skill.name, variants: profiles };
      }) ?? [];
  if (path && !skills.length) missing.push('沒有版本化技能清單');
  return {
    defaultMartialArts: ['無名劍法', '無名槍法'],
    missing,
    skills,
    note: '需求預設武學，實際ID/技能名/數值必須來自所選版本；未知不補值。',
  };
}
