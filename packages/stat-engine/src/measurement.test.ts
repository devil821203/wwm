import { describe, expect, it } from 'vitest';
import { MeasurementSchema, GameDataReleaseSchema } from '@wwm/game-data';
import { calculateDamage } from './damage.js';
import { bellstrikeCoverage, compareMeasurement } from './measurement.js';
import {
  variantFixture,
  measurementFixture,
  unknown,
  recorded,
} from './test/fixtures.js';
describe('S09 variants and observation comparisons — synthetic only', () => {
  it('requires explicit variant selection and never borrows parent coefficients', () => {
    const f = variantFixture();
    expect(
      calculateDamage({ ...f, variantId: undefined }).expectedDamage,
    ).toBeNull();
    expect(
      calculateDamage({ ...f, variantId: 'missing' }).expectedDamage,
    ).toBeNull();
    expect(calculateDamage(f).expectedDamage).toBeCloseTo(393.39);
    expect(
      calculateDamage({ ...f, variantId: 'charged' }).expectedDamage,
    ).toBeCloseTo(586.56);
  });
  it('keeps variants, charge/state/event metadata distinct and does not execute events', () => {
    const f = variantFixture();
    const r = calculateDamage({ ...f, variantId: 'charged' });
    expect(r.context.variantId).toBe('charged');
    expect(r.variant).toMatchObject({
      chargeMs: 1000,
      requiredStateIds: ['synthetic-buff'],
    });
    expect(r.assumptions.join()).toContain('事件尚未執行');
    expect(r.meanDps).toBeNull();
  });
  it('blocks unknown selected coefficients but not unknown unselected coefficients', () => {
    const f = variantFixture();
    f.release.skills[0].variants![1].hits[0].coefficient = unknown();
    expect(calculateDamage(f).expectedDamage).not.toBeNull();
    expect(
      calculateDamage({ ...f, variantId: 'charged' }).expectedDamage,
    ).toBeNull();
  });
  it('uses variant-specific level scope', () => {
    const f = variantFixture();
    f.release.skills[0].variants![1].applicability.martialArtLevels = [2];
    expect(
      calculateDamage({ ...f, variantId: 'charged' }).expectedDamage,
    ).toBeNull();
    expect(calculateDamage(f).expectedDamage).not.toBeNull();
  });
  it('reports timing/amount unknown without inventing skill IDs or coefficients', () => {
    expect(bellstrikeCoverage().missing.join()).toContain('實際技能與係數未知');
    const f = variantFixture();
    f.release.skills[0].variants![0].events[0].offsetMs = null;
    f.release.skills[0].variants![0].events[0].amount = unknown();
    f.release.skills[0].variants![0].swordEnergy = unknown();
    expect(
      bellstrikeCoverage(f.release).skills[0].variants[0].missing.join(),
    ).toContain('事件時間');
    expect(
      bellstrikeCoverage(f.release).skills[0].variants[0].missing,
    ).toContain('劍氣數值');
    expect(bellstrikeCoverage(f.release).defaultMartialArts).toEqual([
      '無名劍法',
      '無名槍法',
    ]);
  });
  it('rejects duplicate variant/hit IDs, cross-version values and missing event targets', () => {
    const f = variantFixture();
    f.release.skills[0].variants!.push(
      structuredClone(f.release.skills[0].variants![0]),
    );
    expect(GameDataReleaseSchema.safeParse(f.release).success).toBe(false);
    const g = variantFixture();
    g.release.skills[0].variants![0].hits.push(
      structuredClone(g.release.skills[0].variants![0].hits[0]),
    );
    expect(GameDataReleaseSchema.safeParse(g.release).success).toBe(false);
    const h = variantFixture();
    h.release.skills[0].variants![0].events[0].targetMartialArtId = null;
    expect(GameDataReleaseSchema.safeParse(h.release).success).toBe(false);
  });
  it('validates observations and computes metrics without a pass threshold', () => {
    const m = measurementFixture();
    expect(MeasurementSchema.safeParse(m).success).toBe(true);
    const report = compareMeasurement(m);
    expect(report.status).toBe('OBSERVATION_COMPARISON');
    expect(report.expectedDamage).toBeCloseTo(393.39);
    expect(report.observedMean).toBeCloseTo(1180 / 3);
    expect(report.mae).toBeCloseTo((3.39 + 2.61 + 0.61) / 3);
    expect(report.label).toContain('未校準');
    expect(report.meanDps).toBeNull();
  });
  it('preserves zero samples and excludes only zero denominators from MAPE', () => {
    const m = measurementFixture();
    m.samples = [0, 0];
    const r = compareMeasurement(m);
    expect(r.observedMean).toBe(0);
    expect(r.zeroExcluded).toBe(2);
    expect(r.mapePercent).toBeNull();
    expect(r.mae).toBeCloseTo(393.39);
    m.samples = [0, 2];
    m.snapshot.release.formulas[0].parameters['enemy-multiplier'] = recorded(0);
    expect(compareMeasurement(m).mae).toBe(1);
    expect(compareMeasurement(m).mapePercent).toBe(100);
  });
  it('refuses partial/filtered observations and unconfirmed comparison conditions', () => {
    const m = measurementFixture();
    m.sampling = 'FILTERED_OR_PARTIAL';
    expect(compareMeasurement(m).mae).toBeNull();
    m.sampling = 'UNFILTERED_CAST_TOTAL';
    m.comparisonContextConfirmed = false;
    expect(compareMeasurement(m).status).toBe('NOT_COMPARABLE');
  });
  it('stores 60-second observations without manufacturing a rotation prediction', () => {
    const m = measurementFixture();
    m.kind = 'ROTATION_60S';
    m.skillId = null;
    m.variantId = null;
    m.durationMs = 60000;
    m.sampling = 'ROTATION_TOTAL';
    const r = compareMeasurement(m);
    expect(r.expectedDamage).toBeNull();
    expect(r.mae).toBeNull();
    expect(r.meanDps).toBeNull();
    expect(
      MeasurementSchema.safeParse({ ...m, durationMs: 59000 }).success,
    ).toBe(false);
  });
  it('keeps missing real coefficients unknown and never mutates the snapshot', () => {
    const m = measurementFixture();
    m.snapshot.release.skills[0].variants![0].hits[0].coefficient = unknown();
    const original = JSON.stringify(m);
    const r = compareMeasurement(m);
    expect(r.expectedDamage).toBeNull();
    expect(r.mae).toBeNull();
    expect(JSON.stringify(m)).toBe(original);
    expect(compareMeasurement(JSON.parse(original))).toEqual(r);
  });
  it('rejects synthetic observations mislabeled as game measurements', () => {
    const m = measurementFixture();
    m.purpose = 'GAME_MEASUREMENT';
    expect(MeasurementSchema.safeParse(m).success).toBe(false);
  });
  it('rejects broken snapshot references and absent evidence, while accepting old player archives elsewhere', () => {
    const m = measurementFixture();
    m.snapshot.build.characterId = 'wrong';
    expect(MeasurementSchema.safeParse(m).success).toBe(false);
    const n = measurementFixture();
    n.evidence = [];
    expect(MeasurementSchema.safeParse(n).success).toBe(false);
  });
});
