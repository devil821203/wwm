import { describe, expect, it } from 'vitest';
import { mapRecordedConfiguration } from './recorded-mapping';
const make = (label: string, value: number, unit = '%') => ({
  id: label,
  label,
  value,
  unit,
});
describe('玩家面板與心法候選映射', () => {
  it('preserves actual and total rates separately, including zero', () => {
    const mapped = mapRecordedConfiguration({
      panelMode: 'EQUIPMENT_INCLUDED',
      recordedPanel: [
        make('會心率（總數值）', 47.8),
        make('會心率（實算）', 25.8),
        make('直接會心率', 0),
      ],
      recordedInnerWays: ['無名心法'],
    });
    expect(mapped.values.totalCritical.value).toBe(47.8);
    expect(mapped.values.effectiveCritical.value).toBe(25.8);
    expect(mapped.values.directCritical.value).toBe(0);
    expect(mapped.hearts[0]).toMatchObject({
      sourceName: '无名心法',
      status: 'ESTIMATED',
    });
  });
  it('rejects duplicates, wrong units and avoids inventing unknown values', () => {
    const mapped = mapRecordedConfiguration({
      panelMode: 'UNKNOWN',
      recordedPanel: [
        make('最小外功攻擊', 100, '%'),
        make('會意率（實算）', 4),
        make('會意率（實算）', 8),
        make('未知項目', 0, ''),
      ],
      recordedInnerWays: ['未知心法'],
    });
    expect(mapped.values).not.toHaveProperty('minPhysicalAttack');
    expect(mapped.values).not.toHaveProperty('effectiveAffinity');
    expect(mapped.issues).toHaveLength(2);
    expect(mapped.unmapped).toContain('未知項目');
    expect(mapped.hearts[0].status).toBe('UNKNOWN');
  });
});
