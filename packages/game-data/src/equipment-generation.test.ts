import { describe, it, expect } from 'vitest';
import { generateIdealGear } from './equipment-generation.js';
import { EquipmentInstanceSchema } from './schemas.js';
import { generationFixture } from './test/generation-fixture.js';
import { recorded, unknown } from './test/fixtures.js';
describe('S12 synthetic equipment generation', () => {
  it('produces same-model legal MAX with quality-specific base, source audit and immutable inputs', () => {
    const f = generationFixture(),
      before = JSON.stringify(f),
      r = generateIdealGear(f);
    expect(r.status).toBe('READY');
    const item = r.candidates[0];
    expect(EquipmentInstanceSchema.safeParse(item).success).toBe(true);
    expect(item.creationMethod).toBe('GENERATED');
    expect(item.effectiveBaseStats![0].value.value).toBe(80);
    expect(item.affixes[0].effective.value).toBe(100);
    expect(item.affixes[0].current.value).toBeNull();
    expect(item.generation?.requestJson).toContain('synthetic-v1');
    expect(JSON.stringify(f)).toBe(before);
    expect(generateIdealGear(JSON.parse(before))).toEqual(r);
  });
  it('enumerates only legal combinations and never asserts a DPS optimum', () => {
    const f = generationFixture();
    f.mode = 'PERFECT_LEGAL';
    f.release.equipment[0].legality!.exclusionGroups = [
      ['synthetic-affix', 'second-affix'],
    ];
    const r = generateIdealGear(f);
    expect(r.candidates.map((e) => e.affixes.map((a) => a.affixId))).toEqual([
      ['synthetic-affix'],
      ['second-affix'],
    ]);
    expect(r.combinationsComplete).toBe(true);
    expect(r.optimalityProven).toBe(false);
    f.release.affixCaps[1].maximum = unknown();
    expect(generateIdealGear(f).candidates).toEqual([]);
  });
  it('rejects unsupported version level, required level, stage and unverified complete pool', () => {
    const f = generationFixture();
    for (const patch of [
      { level: 2 },
      { level: 1 },
      { tuningStage: 10 },
      { definitionId: 'missing' },
      { seed: -1 },
    ])
      expect(generateIdealGear({ ...f, ...patch }).status).toBe('BLOCKED');
    f.release.equipment[0].legality!.verified = false;
    expect(generateIdealGear(f).status).toBe('BLOCKED');
  });
  it('rejects duplicate, out-of-pool, mutually exclusive and excessive affixes', () => {
    const f = generationFixture();
    for (const ids of [['synthetic-affix', 'synthetic-affix'], ['missing'], []])
      expect(
        generateIdealGear({
          ...f,
          affixes: ids.map((id) => ({ id, value: null })),
        }).candidates,
      ).toEqual([]);
    f.release.equipment[0].legality!.exclusionGroups = [
      ['synthetic-affix', 'second-affix'],
    ];
    f.affixes.push({ id: 'second-affix', value: null });
    expect(generateIdealGear(f).status).toBe('BLOCKED');
  });
  it('validates explicit target zero, bounds and fractional steps', () => {
    const f = generationFixture();
    f.valueMode = 'MANUAL';
    f.affixes[0].value = 0;
    expect(generateIdealGear(f).candidates[0].affixes[0].effective.value).toBe(
      0,
    );
    for (const value of [-1, 101, 0.5])
      expect(
        generateIdealGear({ ...f, affixes: [{ id: 'synthetic-affix', value }] })
          .status,
      ).toBe('BLOCKED');
    f.release.affixCaps[0].step = 0.25;
    f.affixes[0].value = 0.5;
    expect(generateIdealGear(f).status).toBe('READY');
  });
  it('prefers recorded chengyin and labels estimates or explicit-only missing values', () => {
    const f = generationFixture();
    f.valueMode = 'CHENG_YIN';
    const estimated = generateIdealGear(f);
    expect(estimated.status).toBe('PARTIAL');
    expect(estimated.candidates[0].affixes[0].effective.status).toBe(
      'ESTIMATED',
    );
    expect(estimated.candidates[0].affixes[0].effective.value).toBe(94);
    f.onlyExplicit = true;
    expect(
      generateIdealGear(f).candidates[0].affixes[0].effective.value,
    ).toBeNull();
    f.release.affixCaps[0].chengYinValue = recorded(93);
    expect(generateIdealGear(f).candidates[0].affixes[0].effective.value).toBe(
      93,
    );
  });
  it('reproduces seed zero, changes with seed and refuses unknown random grids', () => {
    const f = generationFixture();
    f.mode = 'RANDOM_LEGAL';
    f.valueMode = 'MANUAL';
    const r = generateIdealGear(f);
    expect(r.status).toBe('READY');
    expect(generateIdealGear(structuredClone(f))).toEqual(r);
    const results = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        JSON.stringify(
          generateIdealGear({ ...f, seed }).candidates[0].affixes.map(
            (a) => a.effective.value,
          ),
        ),
      ),
    );
    expect(results.size).toBeGreaterThan(1);
    f.release.affixCaps[0].step = null;
    expect(generateIdealGear(f).candidates).toEqual([]);
  });
  it('preserves original identity/evidence and all unallowed affixes while creating a derived copy', () => {
    const f = generationFixture();
    f.affixes.push({ id: 'second-affix', value: null });
    const original = generateIdealGear(f).candidates[0];
    const before = JSON.stringify(original);
    const r = generateIdealGear({
      ...f,
      mode: 'MODIFY_OWNED',
      idPrefix: 'derived',
      source: original,
      valueMode: 'MANUAL',
      affixes: [{ id: 'synthetic-affix', value: 20 }],
      mutableAffixIds: ['synthetic-affix'],
    });
    expect(r.status).toBe('READY');
    expect(r.candidates[0].derivedFromId).toBe(original.id);
    expect(r.candidates[0].affixes[1]).toEqual(original.affixes[1]);
    expect(r.candidates[0].baseStats).toEqual(original.baseStats);
    expect(JSON.stringify(original)).toBe(before);
    expect(
      generateIdealGear({
        ...f,
        mode: 'MODIFY_OWNED',
        source: original,
        mutableAffixIds: [],
      }).status,
    ).toBe('BLOCKED');
  });
  it('returns unknown drafts instead of filling missing numbers', () => {
    const f = generationFixture();
    f.release.affixCaps = [];
    const r = generateIdealGear(f);
    expect(r.status).toBe('PARTIAL');
    expect(r.candidates[0].affixes[0].effective.value).toBeNull();
    expect(r.candidates[0].validation.status).toBe('UNVERIFIED');
  });
});
