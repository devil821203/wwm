import type { Build } from '@wwm/game-data';
import rotation from '../../../../data/staging/external-comparison-2026-11-27/splendor-rotation.json';
import { mapRecordedConfiguration } from './recorded-mapping';

const required = {
  minPhysicalAttack: '最小外功攻擊',
  maxPhysicalAttack: '最大外功攻擊',
  minBellstrikeAttack: '最小鳴金攻擊',
  maxBellstrikeAttack: '最大鳴金攻擊',
  minFormlessAttack: '最小無相攻擊',
  maxFormlessAttack: '最大無相攻擊',
  formlessPenetration: '無相穿透',
  effectivePrecision: '精準率（實算）',
  effectiveCritical: '會心率（實算）',
  effectiveAffinity: '會意率（實算）',
  directCritical: '直接會心率',
  directAffinity: '直接會意率',
  physicalPenetration: '外功穿透',
  elementalPenetration: '屬攻穿透',
  allMartialArtsBoost: '全部武學增效',
  swordBoost: '劍武學增效',
  spearBoost: '槍武學增效',
  singleMysticBoost: '單體奇術增傷',
  groupMysticBoost: '群體奇術增傷',
  specificSkillBoost: '指定技能增效',
  bossDamageBoost: '對首領單位增傷',
  criticalDamageBonus: '會心傷害加成',
  affinityDamageBonus: '會意傷害加成',
  physicalDamageBonus: '外功傷害加成',
  elementalDamageBonus: '屬攻傷害加成',
} as const;
type Key = keyof typeof required;
type Skill = {
  outerRatio: number;
  fixed: number;
  eleRatio: number;
  exCrit: number;
  exIntent: number;
  exCritDmg: number;
  exIntentDmg: number;
  exPen: number;
  exATK: number;
  isCharge: number;
  type: string;
  weaponType: string;
  element: string;
  special: string;
  force: string;
  modifiers: Record<string, unknown>;
};
type Action = {
  name: string;
  count: number;
  generalBonus: number;
  isDingyin: boolean;
  yishui: number;
};
const skills = rotation.skills as Record<string, Skill>;
const supportedHearts = new Set(['易水歌', '無名心法', '千山法', '凝神章']);

/** Fixed-count community reference, independent of the event simulator. */
export function calculateSplendorReference(
  build: Pick<Build, 'panelMode' | 'recordedPanel' | 'recordedInnerWays'>,
) {
  const mapped = mapRecordedConfiguration(build);
  const issues = [...mapped.issues];
  if (build.panelMode !== 'EQUIPMENT_INCLUDED')
    issues.push('參考模型需要已含裝備的完整人物面板');
  for (const [key, label] of Object.entries(required))
    if (!mapped.values[key]) issues.push('缺少面板：' + label);
  for (const heart of build.recordedInnerWays ?? [])
    if (!supportedHearts.has(heart))
      issues.push('參考模型尚不支援心法：' + heart);
  if (!build.recordedInnerWays?.length) issues.push('請記錄目前心法');
  if (issues.length)
    return { dps: null, totalDamage: null, issues, status: 'UNKNOWN' as const };
  const n = (key: Key) => mapped.values[key].value;
  const numeric = Object.keys(required) as Key[];
  if (numeric.some((key) => !Number.isFinite(n(key))))
    return {
      dps: null,
      totalDamage: null,
      issues: ['面板數值無效'],
      status: 'UNKNOWN' as const,
    };
  if (
    ['effectivePrecision', 'effectiveCritical', 'effectiveAffinity'].some(
      (key) => n(key as Key) < 0 || n(key as Key) > 100,
    )
  )
    return {
      dps: null,
      totalDamage: null,
      issues: ['實算機率須介於 0% 和 100%'],
      status: 'UNKNOWN' as const,
    };
  const hearts = build.recordedInnerWays ?? [];
  let total = 0;
  for (const raw of rotation.rotation) {
    const action = raw as Action,
      skill = skills[action.name];
    if (!skill || skill.element !== '鸣金' || skill.special || skill.force)
      return {
        dps: null,
        totalDamage: null,
        issues: ['參考技能包含未支援機制：' + action.name],
        status: 'UNKNOWN' as const,
      };
    const precision = Math.min(n('effectivePrecision') / 100, 1);
    const crit =
      Math.min(n('effectiveCritical') / 100 + (skill.exCrit || 0), 0.8) +
      n('directCritical') / 100;
    const affinity =
      Math.min(n('effectiveAffinity') / 100 + (skill.exIntent || 0), 0.4) +
      n('directAffinity') / 100 +
      (skill.modifiers?.['长风'] ? 0.03 : 0);
    const glance = (1 - precision) * (1 - affinity),
      critical = (crit + affinity <= 1 ? crit : 1 - affinity) * precision,
      normal = Math.max(0, 1 - glance - critical - affinity);
    if (
      [glance, critical, normal, affinity].some((v) => v < 0 || v > 1) ||
      Math.abs(glance + critical + normal + affinity - 1) > 1e-9
    )
      return {
        dps: null,
        totalDamage: null,
        issues: ['參考模型機率超出範圍'],
        status: 'UNKNOWN' as const,
      };
    const cm = 1 + n('criticalDamageBonus') / 100 + (skill.exCritDmg || 0);
    const am =
      1 +
      n('affinityDamageBonus') / 100 +
      (skill.exIntentDmg || 0) +
      (hearts.includes('凝神章') ? 0.1 : 0);
    const min = Math.max(
      0,
      n('minPhysicalAttack') * (1 + (skill.exATK || 0)) - 498 + 140,
    );
    const max = Math.max(
      min,
      n('maxPhysicalAttack') * (1 + (skill.exATK || 0)) - 498 + 280,
    );
    const avg = (min + max) / 2;
    const pen =
      (n('physicalPenetration') +
        (skill.exPen || 0) +
        (hearts.includes('易水歌') ? action.yishui : 0)) /
      200;
    const physicalFactor = (1 + pen) * (1 + n('physicalDamageBonus') / 100);
    const outcome = (lo: number, mid: number, hi: number) =>
      lo * glance + mid * normal + mid * critical * cm + hi * affinity * am;
    const outer = outcome(min, avg, max) * skill.outerRatio * physicalFactor;
    const fixed =
      skill.fixed *
      (skill.type === '武器' ? 1.0725 : 1) *
      physicalFactor *
      (glance + normal + critical * cm + affinity * am);
    const extra = skill.type === '武器' ? 150.7 * 1.0725 : 0;
    const eleMin = n('minBellstrikeAttack') + n('minFormlessAttack') + extra;
    const eleMax = Math.max(
      eleMin,
      n('maxBellstrikeAttack') + n('maxFormlessAttack') + extra,
    );
    const elemental =
      outcome(eleMin, (eleMin + eleMax) / 2, eleMax) *
      skill.eleRatio *
      (1 + (n('elementalPenetration') + n('formlessPenetration')) / 200) *
      (1 + n('elementalDamageBonus') / 100);
    let arts =
      (skill.type === '武器' || skill.type === '心法') &&
      skill.weaponType !== 'N/A'
        ? n('allMartialArtsBoost')
        : 0;
    if (skill.weaponType === '剑') arts += n('swordBoost');
    if (skill.weaponType === '枪') arts += n('spearBoost');
    if (skill.weaponType === '单体奇术') arts += n('singleMysticBoost');
    if (skill.weaponType === '群体奇术') arts += n('groupMysticBoost');
    const bonus =
      1 + action.generalBonus + n('bossDamageBoost') / 100 + arts / 100;
    total +=
      (outer + fixed + elemental) *
      bonus *
      (action.isDingyin ? 1 + n('specificSkillBoost') / 100 : 1) *
      action.count;
  }
  return {
    dps: total / rotation.durationSeconds,
    totalDamage: total,
    issues: [],
    status: 'ESTIMATED' as const,
  };
}
