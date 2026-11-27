import type { Build } from '@wwm/game-data';
import innerWays from '../../../../data/staging/external-comparison-2026-11-27/inner-ways.json';

type PanelEntry = NonNullable<Build['recordedPanel']>[number];
const bindings: Record<string, { key: string; unit: string }> = {
  最小外功攻擊: { key: 'minPhysicalAttack', unit: '' },
  最大外功攻擊: { key: 'maxPhysicalAttack', unit: '' },
  最小鳴金攻擊: { key: 'minBellstrikeAttack', unit: '' },
  最大鳴金攻擊: { key: 'maxBellstrikeAttack', unit: '' },
  '精準率（實算）': { key: 'effectivePrecision', unit: '%' },
  '會心率（實算）': { key: 'effectiveCritical', unit: '%' },
  '會意率（實算）': { key: 'effectiveAffinity', unit: '%' },
  '精準率（總數值）': { key: 'totalPrecision', unit: '%' },
  '會心率（總數值）': { key: 'totalCritical', unit: '%' },
  '會意率（總數值）': { key: 'totalAffinity', unit: '%' },
  直接會心率: { key: 'directCritical', unit: '%' },
  直接會意率: { key: 'directAffinity', unit: '%' },
  外功穿透: { key: 'physicalPenetration', unit: '' },
  屬攻穿透: { key: 'elementalPenetration', unit: '' },
  全部武學增效: { key: 'allMartialArtsBoost', unit: '%' },
  指定武學增效: { key: 'specificMartialArtsBoost', unit: '%' },
  指定技能增效: { key: 'specificSkillBoost', unit: '%' },
  對首領單位增傷: { key: 'bossDamageBoost', unit: '%' },
  會心傷害加成: { key: 'criticalDamageBonus', unit: '%' },
  會意傷害加成: { key: 'affinityDamageBonus', unit: '%' },
  外功傷害加成: { key: 'physicalDamageBonus', unit: '%' },
  屬攻傷害加成: { key: 'elementalDamageBonus', unit: '%' },
};
const names: Record<string, string> = {
  易水歌: '易水歌',
  無名心法: '无名心法',
  千山法: '千山法',
  凝神章: '凝神章',
};
type HeartName = keyof typeof innerWays.communityStaticValues;

/** An explicit mapping report: never mutate player data or assume unlisted values are zero. */
export function mapRecordedConfiguration(
  build: Pick<Build, 'panelMode' | 'recordedPanel' | 'recordedInnerWays'>,
) {
  const values: Record<
    string,
    { value: number; unit: string; evidenceId: string; label: string }
  > = {};
  const issues: string[] = [];
  const unmapped: string[] = [];
  for (const entry of build.recordedPanel ?? []) {
    const b = bindings[entry.label];
    if (!b) {
      unmapped.push(entry.label);
      continue;
    }
    if (entry.unit !== b.unit) {
      issues.push(`${entry.label}的單位不符`);
      continue;
    }
    if (values[b.key]) {
      issues.push(`${entry.label}有重複紀錄，請先確認`);
      delete values[b.key];
      continue;
    }
    values[b.key] = {
      value: entry.value,
      unit: entry.unit,
      evidenceId: entry.id,
      label: entry.label,
    };
  }
  const duplicateKeys = new Set<string>();
  for (const entry of build.recordedPanel ?? []) {
    const key = bindings[entry.label]?.key;
    if (
      key &&
      (build.recordedPanel ?? []).filter(
        (item: PanelEntry) => bindings[item.label]?.key === key,
      ).length > 1
    )
      duplicateKeys.add(key);
  }
  duplicateKeys.forEach((key) => delete values[key]);
  const hearts = (build.recordedInnerWays ?? []).map((name) => {
    const key = names[name] as HeartName | undefined;
    return {
      name,
      sourceName: key ?? null,
      status: key ? ('ESTIMATED' as const) : ('UNKNOWN' as const),
      candidateStats: key ? innerWays.communityStaticValues[key] : null,
      reason: key
        ? '社群參考值；突破與生效條件未確認，未加入面板'
        : '尚無對應心法資料',
    };
  });
  return { values, issues, unmapped, hearts, panelMode: build.panelMode };
}
