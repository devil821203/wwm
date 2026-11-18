import { describe, expect, it } from 'vitest';
import {
  applyManualRows,
  emptyEquipment,
  newRow,
  rowsFrom,
  rowValue,
} from './editor-model';
import {
  EquipmentInstanceSchema,
  type EquipmentInstance,
} from '@wwm/game-data';
describe('manual equipment review', () => {
  it('stores confirmed zero without needing an image or category', () => {
    const item = emptyEquipment();
    const row = { ...newRow(), label: '測試攻擊', text: '0', confirmed: true };
    const result = applyManualRows({ ...item }, [row], [], item);
    expect(
      EquipmentInstanceSchema.parse(result).baseStats[0].value,
    ).toMatchObject({
      status: 'MANUAL_CONFIRMED',
      value: 0,
      gameVersionId: null,
    });
    expect(result.slotId).toBeUndefined();
  });
  it('keeps unconfirmed screenshot numbers unknown and preserves raw observation', () => {
    const item = { ...emptyEquipment(), creationMethod: 'SCREENSHOT' as const };
    const result = applyManualRows(
      { ...item },
      [],
      [{ ...newRow(), label: '測試詞條', text: '12.345', confirmed: false }],
      item,
    );
    expect(result.affixes[0].current).toMatchObject({
      status: 'UNKNOWN',
      value: null,
    });
    expect(result.affixes[0].observation).toMatchObject({
      rawName: '測試詞條',
      value: 12.345,
      manuallyConfirmed: false,
    });
    expect(rowsFrom(result, 'affix')[0].text).toBe('12.345');
  });
  it('does not treat a blank as zero', () => {
    expect(
      rowValue(
        { ...newRow(), label: 'test', text: '', confirmed: true },
        null,
        'MANUAL',
      ).status,
    ).toBe('UNKNOWN');
  });
  it('rejects nonfinite input and unnamed rows', () => {
    const item = emptyEquipment();
    expect(() =>
      applyManualRows(
        { ...item },
        [{ ...newRow(), label: 'test', text: 'Infinity' }],
        [],
        item,
      ),
    ).toThrow();
    expect(() => applyManualRows({ ...item }, [newRow()], [], item)).toThrow();
  });
  it('preserves unchanged database provenance instead of relabeling as manual', () => {
    const item: EquipmentInstance = {
      ...emptyEquipment(),
      gameVersionId: 'synthetic',
      baseStats: [
        {
          statId: 'attack',
          value: {
            status: 'RECORDED',
            gameVersionId: 'synthetic',
            value: 1.23456789,
            sourceIds: ['source'],
          },
        },
      ],
    };
    const result = applyManualRows(
      { ...item },
      rowsFrom(item, 'base'),
      [],
      item,
    );
    expect(result.baseStats).toEqual(item.baseStats);
  });
  it('requires confirmation again after version or tier change', () => {
    const original = emptyEquipment();
    const saved = applyManualRows(
      { ...original },
      [{ ...newRow(), label: 'test', text: '9', confirmed: true }],
      [],
      original,
    );
    const result = applyManualRows(
      { ...saved, tierId: 'new-tier' },
      rowsFrom(saved, 'base'),
      [],
      saved,
    );
    expect(result.baseStats[0].value.status).toBe('UNKNOWN');
  });
});

it('accepts an explicitly reconfirmed manual value under the newly selected context', () => {
  const original = emptyEquipment();
  const saved = applyManualRows(
    { ...original },
    [{ ...newRow(), label: 'test', text: '9', confirmed: true }],
    [],
    original,
  );
  const rechecked = rowsFrom(saved, 'base').map((row) => ({
    ...row,
    original: undefined,
    confirmed: true,
  }));
  const result = applyManualRows(
    { ...saved, gameVersionId: 'new-version' },
    rechecked,
    [],
    saved,
  );
  expect(result.baseStats[0].value).toMatchObject({
    status: 'MANUAL_CONFIRMED',
    value: 9,
    gameVersionId: 'new-version',
  });
});
