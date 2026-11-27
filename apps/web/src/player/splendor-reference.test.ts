import { describe, expect, it } from 'vitest';
import { calculateSplendorReference } from './splendor-reference';
import type { Build } from '@wwm/game-data';
const values: [string, number, string][] = [
  ['最小外功攻擊', 1184, ''],
  ['最大外功攻擊', 3685, ''],
  ['最小鳴金攻擊', 401, ''],
  ['最大鳴金攻擊', 997, ''],
  ['最小無相攻擊', 0, ''],
  ['最大無相攻擊', 0, ''],
  ['無相穿透', 0, ''],
  ['精準率（實算）', 93.8, '%'],
  ['會心率（實算）', 25.8, '%'],
  ['會意率（實算）', 39.5, '%'],
  ['直接會心率', 0, '%'],
  ['直接會意率', 2.3, '%'],
  ['外功穿透', 46.1, ''],
  ['屬攻穿透', 29.6, ''],
  ['全部武學增效', 6, '%'],
  ['劍武學增效', 7, '%'],
  ['槍武學增效', 0, '%'],
  ['單體奇術增傷', 0, '%'],
  ['群體奇術增傷', 0, '%'],
  ['指定技能增效', 22.6, '%'],
  ['對首領單位增傷', 6, '%'],
  ['會心傷害加成', 50, '%'],
  ['會意傷害加成', 40.2, '%'],
  ['外功傷害加成', 0, '%'],
  ['屬攻傷害加成', 11.8, '%'],
];
const build = (): Pick<
  Build,
  'panelMode' | 'recordedPanel' | 'recordedInnerWays'
> => ({
  panelMode: 'EQUIPMENT_INCLUDED',
  recordedPanel: values.map(([label, value, unit], i) => ({
    id: 'entry-' + i,
    label,
    value,
    unit,
  })),
  recordedInnerWays: ['易水歌', '無名心法', '千山法', '凝神章'],
});
describe('鳴金虹固定參考軸傷害', () => {
  it('matches the external reference for the same explicitly supplied panel', () => {
    const result = calculateSplendorReference(build());
    expect(result.status).toBe('ESTIMATED');
    expect(result.totalDamage).toBeCloseTo(3101002, 0);
    expect(result.dps).toBeCloseTo(3101002 / 55, 1);
  });
  it('responds to a changed panel and refuses missing values', () => {
    const a = build(),
      b = build();
    b.recordedPanel!.find((x) => x.label === '最大外功攻擊')!.value = 4000;
    expect(calculateSplendorReference(b).dps!).toBeGreaterThan(
      calculateSplendorReference(a).dps!,
    );
    expect(calculateSplendorReference(b).totalDamage).toBeCloseTo(3262453, 0);
    a.recordedInnerWays = ['無名心法', '千山法', '凝神章'];
    expect(calculateSplendorReference(a).totalDamage).toBeCloseTo(3026856, 0);
    b.recordedPanel = b.recordedPanel!.filter((x) => x.label !== '槍武學增效');
    expect(calculateSplendorReference(b)).toMatchObject({
      dps: null,
      status: 'UNKNOWN',
    });
  });
});
