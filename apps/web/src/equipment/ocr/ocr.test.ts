import { describe, expect, it } from 'vitest';
import {
  runOcr,
  TextOcrAdapter,
  fullCrop,
  validateTransform,
  type OcrInput,
  type OcrAdapter,
} from './contracts';
import { parseOcrResult } from './parser';
import { addOcrCandidate } from './merge';
import { emptyEquipment, applyManualRows, rowsFrom } from '../editor-model';
import { EquipmentInstanceSchema, type GameDataRelease } from '@wwm/game-data';
const image = {
  id: 'fixture-image',
  equipmentId: 'fixture-equipment',
  name: 'fixture.png',
  dataUrl: 'data:image/png;base64,AAAA',
  width: 100,
  height: 100,
  savedAt: '2026-11-17T00:00:00+08:00',
};
const input = (): OcrInput => ({
  image,
  language: 'eng',
  crop: { ...fullCrop },
  rotation: 0,
  scale: 1,
  signal: new AbortController().signal,
  onProgress: () => {},
});
const parsed = async (text: string) =>
  parseOcrResult(await runOcr(new TextOcrAdapter(text), input()), input());
describe('replaceable OCR adapters', () => {
  it('supports a text fixture without pretending to recognize an image', async () => {
    const result = await runOcr(
      new TextOcrAdapter('AFFIXES\nAttack 0'),
      input(),
    );
    expect(result.adapterId).toBe('text-import-v1');
    expect(result.lines.every((line) => line.confidence === null)).toBe(true);
  });
  it('supports another adapter and surfaces its failure', async () => {
    const adapter: OcrAdapter = {
      id: 'fixture-adapter',
      recognize: async () => {
        throw new Error('fixture failure');
      },
    };
    await expect(runOcr(adapter, input())).rejects.toThrow('fixture failure');
  });
  it('respects cancellation before and after adapter work', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runOcr(new TextOcrAdapter('x'), {
        ...input(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    const during = new AbortController();
    const adapter: OcrAdapter = {
      id: 'fixture',
      recognize: async () => {
        during.abort();
        return { adapterId: 'fixture', text: '', lines: [] };
      },
    };
    await expect(
      runOcr(adapter, { ...input(), signal: during.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
  it.each([
    [{ x: 90, y: 0, width: 20, height: 100 }, 0, 1],
    [fullCrop, 45, 1],
    [fullCrop, 0, 3],
    [{ ...fullCrop, width: 0 }, 0, 1],
  ] as const)(
    'rejects an invalid preprocessing transform',
    (crop, rotation, scale) => {
      expect(() => validateTransform(crop, rotation, scale)).toThrow();
    },
  );
});
describe('candidate parsing and confidence', () => {
  it('normalizes fullwidth signs/numbers and preserves raw percentage rather than dividing by100', async () => {
    const result = await parsed('基礎屬性\n攻擊：０\n詞條\n會心率：１２．５％');
    expect(
      result.candidates.map((item) => [item.label, item.text, item.kind]),
    ).toEqual([
      ['攻擊', '0', 'base'],
      ['會心率', '12.5', 'affix'],
    ]);
    expect(result.candidates[1].trace.unit).toBe('%');
    expect(result.candidates[1].trace.rawText).toBe('會心率：１２．５％');
  });
  it('accepts valid thousands groups and negative decimals without rounding', async () => {
    const result = await parsed('AFFIXES\nAttack 1,234.56789\nReduction -2.5');
    expect(result.candidates.map((item) => item.text)).toEqual([
      '1234.56789',
      '-2.5',
    ]);
  });
  it('does not fabricate values for ambiguous ranges, missing numbers or bad separators', async () => {
    const result = await parsed('Attack 10-20\nCrit ?\nAttack 1,23\nName Only');
    expect(result.candidates).toEqual([]);
    expect(result.unparsed).toHaveLength(4);
  });
  it('keeps unknown types unclassified instead of guessing from numeric shape', async () => {
    const result = await parsed('Unknown Stat 12');
    expect(result.candidates[0].kind).toBe('unknown');
    expect(result.candidates[0].warnings).toContain('欄位種類未知，請人工選擇');
  });
  it('keeps metadata explicit and refuses unknown quality/invalid tuning precision', async () => {
    const result = await parsed(
      'Name: Test Fixture\nQuality: Purple\nSlot: weapon\nTuning: 2.5\nChengyin: yes',
    );
    expect(result.fields.map((item) => item.value)).toEqual([
      'Test Fixture',
      'purple',
      'weapon',
      null,
      true,
    ]);
  });
  it('preserves low confidence and bounding boxes without treating them as verified values', () => {
    const result = parseOcrResult(
      {
        adapterId: 'fixture',
        text: 'Attack 3',
        lines: [
          {
            text: 'Attack 3',
            confidence: 0.2,
            box: { x0: 1, y0: 2, x1: 99, y1: 30 },
          },
        ],
      },
      input(),
    );
    expect(result.candidates[0].warnings).toContain('低辨識信心，請對照原圖');
    expect(result.candidates[0].trace.box).toEqual({
      x0: 1,
      y0: 2,
      x1: 99,
      y1: 30,
    });
  });
  it('matches version dictionaries and leaves ambiguity to the user', () => {
    const version = 'synthetic';
    const dictionary = {
      stats: [
        {
          id: 'attack',
          gameVersionId: version,
          name: 'Attack',
          unit: 'points',
          description: 'Synthetic',
        },
      ],
      affixes: [
        {
          id: 'attack-affix',
          gameVersionId: version,
          statId: 'attack',
          name: 'Attack',
        },
      ],
      equipment: [],
    } as unknown as GameDataRelease;
    const result = parseOcrResult(
      {
        adapterId: 'fixture',
        text: 'Attack 3',
        lines: [{ text: 'Attack 3', confidence: 0.9 }],
      },
      input(),
      dictionary,
    );
    expect(result.candidates[0].matches).toHaveLength(2);
    expect(result.candidates[0].kind).toBe('unknown');
  });
});
describe('manual correction protection and persistence', () => {
  it('adds an unconfirmed row and preserves original OCR evidence after correction and confirmation', async () => {
    const candidate = (await parsed('AFFIXES\nTest Attack 12.5')).candidates[0];
    const added = addOcrCandidate([], candidate, 'affix');
    expect(added.rows[0].confirmed).toBe(false);
    const initial = emptyEquipment();
    const unchecked = applyManualRows({ ...initial }, [], added.rows, initial);
    expect(unchecked.affixes[0].current.status).toBe('UNKNOWN');
    const corrected = added.rows.map((row) => ({
      ...row,
      text: '13.5',
      confirmed: true,
    }));
    const saved = EquipmentInstanceSchema.parse(
      applyManualRows({ ...initial }, [], corrected, initial),
    );
    expect(saved.affixes[0].current).toMatchObject({
      status: 'MANUAL_CONFIRMED',
      value: 13.5,
    });
    expect(saved.affixes[0].observation?.ocr).toMatchObject({
      rawText: 'Test Attack 12.5',
      recognizedValue: 12.5,
      confidence: null,
    });
    expect(rowsFrom(saved, 'affix')[0].ocr?.recognizedValue).toBe(12.5);
  });
  it('does not overwrite an existing or manually corrected row during re-recognition', async () => {
    const candidate = (await parsed('AFFIXES\nAttack 12.5')).candidates[0];
    const first = addOcrCandidate([], candidate, 'affix').rows.map((row) => ({
      ...row,
      text: '99',
      confirmed: true,
    }));
    const second = addOcrCandidate(first, candidate, 'affix');
    expect(second.added).toBe(false);
    expect(second.rows[0].text).toBe('99');
    expect(second.rows[0].confirmed).toBe(true);
  });
});
