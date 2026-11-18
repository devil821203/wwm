import { describe, expect, it } from 'vitest';
import {
  OcrTraceSchema,
  EquipmentInstanceSchema,
  type OcrTrace,
} from './schemas.js';
import { equipmentFixture } from './test/fixtures.js';
const trace: OcrTrace = {
  adapterId: 'fixture',
  runId: 'run',
  imageId: 'image',
  rawText: 'Attack 12.5%',
  confidence: 0.2,
  recognizedLabel: 'Attack',
  recognizedValue: 12.5,
  unit: '%',
  box: { x0: 0, y0: 0, x1: 100, y1: 40 },
  crop: { x: 0, y: 0, width: 100, height: 100 },
  rotation: 0,
  scale: 1,
};
describe('OCR evidence schema', () => {
  it('keeps raw text, unit, confidence and processed-image geometry', () => {
    expect(OcrTraceSchema.parse(trace)).toEqual(trace);
  });
  it('rejects confidence outside the probability interval', () => {
    expect(
      OcrTraceSchema.safeParse({ ...trace, confidence: 101 }).success,
    ).toBe(false);
  });
  it('round trips OCR evidence without promoting unconfirmed values', () => {
    const item = equipmentFixture();
    item.affixes[0].observation = {
      rawText: 'Attack 12.5%',
      value: 12.5,
      origin: 'SCREENSHOT',
      manuallyConfirmed: false,
      ocr: trace,
    };
    expect(
      EquipmentInstanceSchema.parse(JSON.parse(JSON.stringify(item))).affixes[0]
        .observation?.ocr,
    ).toEqual(trace);
  });
});
