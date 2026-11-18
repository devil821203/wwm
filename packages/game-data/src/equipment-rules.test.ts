import { describe, expect, it } from 'vitest';
import { resolveEquipment } from './equipment-rules.js';
import { EquipmentInstanceSchema, GameDataReleaseSchema } from './schemas.js';
import { rulesFixture, manual } from './test/equipment-rules-fixture.js';
import { recorded, unknown, testTime } from './test/fixtures.js';
const run = (f = rulesFixture(), onlyExplicit = false) =>
  resolveEquipment(f.item, f.release, { estimatedAt: testTime, onlyExplicit });
describe('S07 versioned equipment rules — synthetic data only', () => {
  it('validates new contracts and preserves old releases', () => {
    const f = rulesFixture();
    expect(GameDataReleaseSchema.safeParse(f.release).success).toBe(true);
    delete f.definition.legality;
    delete f.cap.chengYinModel;
    expect(GameDataReleaseSchema.safeParse(f.release).success).toBe(true);
    expect(run(f).equipment.validation.status).toBe('UNVERIFIED');
  });
  it('uses recorded chengyin zero before a model', () => {
    const f = rulesFixture();
    f.cap.chengYinValue = recorded(0);
    const r = run(f);
    expect(r.equipment.affixes[0].effective).toEqual(recorded(0));
    expect(r.equipment.validation.status).toBe('VALID');
  });
  it('estimates 94 from a registered model and preserves evidence', () => {
    const r = run();
    expect(r.equipment.affixes[0].effective).toMatchObject({
      status: 'ESTIMATED',
      value: 94,
      modelVersion: 'synthetic-model-1',
      estimatedAt: testTime,
      inputs: { maximum: 100, ratio: 0.94, step: 1 },
    });
    expect(r.provenance.label).toBe('包含預估資料');
    expect(r.equipment.validation.status).toBe('UNVERIFIED');
  });
  it('does not invent a default ratio without a model', () => {
    const f = rulesFixture();
    delete f.cap.chengYinModel;
    expect(run(f).equipment.affixes[0].effective.status).toBe('UNKNOWN');
  });
  it('blocks every estimate in explicit-only mode', () => {
    const r = run(rulesFixture(), true);
    expect(r.equipment.affixes[0].effective.status).toBe('UNKNOWN');
    expect(r.provenance.canCalculate).toBe(false);
  });
  it('does not turn stored estimates into recorded data', () => {
    const f = rulesFixture();
    f.cap.chengYinValue = run(f).equipment.affixes[0].effective;
    delete f.cap.chengYinModel;
    expect(run(f).equipment.affixes[0].effective.status).toBe('ESTIMATED');
    expect(run(f, true).equipment.affixes[0].effective.status).toBe('UNKNOWN');
  });
  it('preserves manual instance overrides without changing the database', () => {
    const f = rulesFixture();
    f.cap.chengYinValue = recorded(94);
    f.item.affixes[0].current = manual(90);
    const snapshot = JSON.stringify(f);
    const r = run(f);
    expect(r.equipment.affixes[0].effective).toEqual(manual(90));
    expect(r.warnings.join()).toContain('人工值');
    expect(JSON.stringify(f)).toBe(snapshot);
  });
  it('keeps purple base 80 separate from high-quality 100 and affix ratio', () => {
    const f = rulesFixture();
    f.release.equipment.push({
      ...structuredClone(f.definition),
      id: 'synthetic-gold',
      quality: 'gold',
      baseStats: [{ statId: 'synthetic-attack', value: recorded(100) }],
    });
    const r = run(f);
    expect(r.equipment.effectiveBaseStats?.[0].value.value).toBe(80);
    expect(r.equipment.affixes[0].effective.value).toBe(94);
    expect(r.equipment.baseStats).toEqual([]);
  });
  it('allows a confirmed base override with a difference warning', () => {
    const f = rulesFixture();
    f.item.baseStats = [{ statId: 'synthetic-attack', value: manual(81) }];
    const r = run(f);
    expect(r.equipment.effectiveBaseStats?.[0].value.value).toBe(81);
    expect(r.warnings.join()).toContain('基礎屬性');
  });
  it('does not borrow a different quality base value', () => {
    const f = rulesFixture();
    f.item.quality = 'missing-quality';
    f.item.baseStats = [{ statId: 'synthetic-attack', value: recorded(100) }];
    expect(run(f).equipment.effectiveBaseStats?.[0].value.status).toBe(
      'UNKNOWN',
    );
  });
  it.each(['tierId', 'quality', 'tuningStage'] as const)(
    'invalidates old caps when %s changes',
    (field) => {
      const f = rulesFixture();
      if (field === 'tuningStage') f.item[field] = 1;
      else f.item[field] = 'missing';
      f.item.affixes[0].maximum = recorded(999);
      f.item.affixes[0].effective = recorded(999);
      expect(run(f).equipment.affixes[0].maximum.status).toBe('UNKNOWN');
      expect(run(f).equipment.affixes[0].effective.status).toBe('UNKNOWN');
    },
  );
  it('does not match null stage as a wildcard', () => {
    const f = rulesFixture();
    f.cap.tuningStage = null;
    expect(run(f).equipment.affixes[0].maximum.status).toBe('UNKNOWN');
  });
  it('does not match a different release version', () => {
    const f = rulesFixture();
    f.item.gameVersionId = 'another';
    f.item.affixes[0].current = unknown('another');
    f.item.affixes[0].effective = unknown('another');
    f.item.affixes[0].maximum = unknown('another');
    expect(run(f).equipment.affixes[0].effective.status).toBe('UNKNOWN');
  });
  it('rejects ambiguous same-condition caps without silently selecting one', () => {
    const f = rulesFixture();
    f.release.affixCaps.push({ ...structuredClone(f.cap), id: 'other-cap' });
    expect(run(f).equipment.affixes[0].maximum).toMatchObject({
      status: 'UNKNOWN',
      reason: '同條件上限規則衝突',
    });
  });
  it('requires explicit choice for MAX on chengyin', () => {
    const f = rulesFixture();
    f.item.affixes[0].valueMode = 'MAX';
    expect(run(f).equipment.affixes[0].effective.status).toBe('UNKNOWN');
    f.item.affixes[0].maxOnChengYinConfirmed = true;
    expect(run(f).equipment.affixes[0].effective.value).toBe(100);
    expect(run(f).equipment.validation.status).toBe('VALID');
  });
  it('MAX bypasses current override but never changes original value', () => {
    const f = rulesFixture();
    f.item.affixes[0].current = manual(85);
    f.item.affixes[0].valueMode = 'MAX';
    f.item.affixes[0].maxOnChengYinConfirmed = true;
    const r = run(f).equipment;
    expect(r.affixes[0].current.value).toBe(85);
    expect(r.affixes[0].effective.value).toBe(100);
    r.affixes[0].valueMode = 'MANUAL';
    expect(
      resolveEquipment(r, f.release).equipment.affixes[0].effective.value,
    ).toBe(85);
  });
  it('does not add or remove existing affixes', () => {
    const f = rulesFixture();
    f.release.affixes.push({ ...f.release.affixes[0], id: 'affix-b' });
    f.definition.allowedAffixIds.push('affix-b');
    f.release.affixCaps.push({
      ...structuredClone(f.cap),
      id: 'cap-b',
      affixId: 'affix-b',
      maximum: recorded(200),
    });
    f.item.affixes.push({
      ...structuredClone(f.item.affixes[0]),
      affixId: 'affix-b',
    });
    expect(
      run(f).equipment.affixes.map((a) => [a.affixId, a.effective.value]),
    ).toEqual([
      ['synthetic-affix', 94],
      ['affix-b', 188],
    ]);
  });
  it.each(['SCREENSHOT', 'MANUAL', 'GENERATED'] as const)(
    'creation method %s does not change numeric results',
    (creationMethod) => {
      const f = rulesFixture();
      f.item.creationMethod = creationMethod;
      expect(run(f).equipment.affixes[0].effective.value).toBe(94);
    },
  );
  it.each(['ROUND', 'FLOOR', 'TRUNCATE'] as const)(
    'normalizes verified fractional steps using %s',
    (roundingRule) => {
      const f = rulesFixture();
      f.cap.maximum = recorded(10.5);
      f.cap.step = 0.1;
      f.cap.roundingRule = roundingRule;
      f.cap.chengYinModel!.precision = 1;
      expect(run(f).equipment.affixes[0].effective.value).toBe(
        roundingRule === 'ROUND' ? 9.9 : 9.8,
      );
    },
  );
  it('does not falsely round unverified precision', () => {
    const f = rulesFixture();
    f.cap.maximum = recorded(10.5);
    f.cap.precisionVerified = false;
    expect(run(f).equipment.affixes[0].effective.value).toBe(10.5 * 0.94);
    expect(run(f).equipment.validation.status).toBe('UNVERIFIED');
  });
  it('blocks unit mismatch and incomplete legality', () => {
    const f = rulesFixture();
    f.cap.unit = 'wrong';
    expect(run(f).equipment.affixes[0].effective.status).toBe('UNKNOWN');
    expect(run(f).canApplyLegalMaximum).toBe(false);
  });
  it('checks range, step, pool, counts and mutual exclusion', () => {
    const f = rulesFixture();
    f.item.affixes[0].current = manual(101);
    expect(run(f).equipment.validation.reasons.join()).toContain(
      '超過當階上限',
    );
    f.item.affixes[0].current = manual(-1);
    expect(run(f).equipment.validation.reasons.join()).toContain(
      '低於合法下限',
    );
    f.item.affixes[0].current = manual(1.5);
    expect(run(f).equipment.validation.reasons.join()).toContain('步進');
    f.item.affixes[0].current = manual(10);
    f.definition.allowedAffixIds = [];
    expect(run(f).equipment.validation.status).toBe('INVALID');
    const g = rulesFixture();
    g.definition.legality!.minAffixes = 2;
    expect(run(g).equipment.validation.reasons.join()).toContain('數量');
    g.release.affixes.push({ ...g.release.affixes[0], id: 'affix-b' });
    g.definition.allowedAffixIds.push('affix-b');
    g.definition.legality!.exclusionGroups = [['synthetic-affix', 'affix-b']];
    g.item.affixes.push({
      ...structuredClone(g.item.affixes[0]),
      affixId: 'affix-b',
    });
    expect(run(g).equipment.validation.reasons.join()).toContain('互斥');
  });
  it('requeries stage-specific values', () => {
    const f = rulesFixture();
    f.release.affixCaps.push({
      ...structuredClone(f.cap),
      id: 'stage-one',
      tuningStage: 1,
      maximum: recorded(200),
    });
    f.item.tuningStage = 1;
    expect(run(f).equipment.affixes[0].effective.value).toBe(188);
  });
  it('requires fully verified explicit rules for one-click legal max', () => {
    const f = rulesFixture();
    expect(run(f).canApplyLegalMaximum).toBe(true);
    delete f.cap.minimum;
    expect(run(f).canApplyLegalMaximum).toBe(false);
    f.cap.minimum = recorded(0);
    delete f.definition.legality;
    expect(run(f).canApplyLegalMaximum).toBe(false);
  });
  it('retains raw current and effective provenance through JSON', () => {
    const f = rulesFixture();
    const r = run(f).equipment;
    expect(
      EquipmentInstanceSchema.parse(JSON.parse(JSON.stringify(r))),
    ).toEqual(r);
    expect(r.affixes[0].current.status).toBe('UNKNOWN');
  });
  it('keeps estimated maximum and purple base labeled, and filters them when explicit-only', () => {
    const f = rulesFixture();
    const estimate = run(f).equipment.affixes[0].effective;
    f.cap.maximum = estimate;
    f.definition.baseStats[0].value = estimate;
    f.item.affixes[0].valueMode = 'MAX';
    f.item.affixes[0].maxOnChengYinConfirmed = true;
    const r = run(f);
    expect(r.equipment.affixes[0].effective.status).toBe('ESTIMATED');
    expect(r.equipment.effectiveBaseStats?.[0].value.status).toBe('ESTIMATED');
    expect(r.canApplyLegalMaximum).toBe(false);
    expect(run(f, true).equipment.affixes[0].effective.status).toBe('UNKNOWN');
    expect(run(f, true).equipment.effectiveBaseStats?.[0].value.status).toBe(
      'UNKNOWN',
    );
  });
  it('does not enable legal MAX with unsupported base attributes or an unknown stage', () => {
    const f = rulesFixture();
    f.release.stats.push({ ...f.release.stats[0], id: 'extra-base' });
    f.item.baseStats.push({ statId: 'extra-base', value: manual(5) });
    expect(run(f).canApplyLegalMaximum).toBe(false);
    f.item.baseStats = [];
    f.item.tuningStage = null;
    f.cap.tuningStage = null;
    f.definition.legality!.tuningStages = [null];
    expect(run(f).canApplyLegalMaximum).toBe(false);
    expect(run(f).equipment.validation.status).toBe('UNVERIFIED');
  });
  it('normalizes step offsets from a recorded minimum', () => {
    const f = rulesFixture();
    f.cap.minimum = recorded(1);
    f.cap.maximum = recorded(99);
    f.cap.step = 2;
    expect(run(f).equipment.affixes[0].effective.value).toBe(93);
  });
  it('rejects unresolved model/source/affix references', () => {
    const f = rulesFixture();
    f.cap.chengYinModel!.formulaId = 'missing';
    expect(GameDataReleaseSchema.safeParse(f.release).success).toBe(false);
    f.cap.chengYinModel!.formulaId = 'synthetic-formula';
    f.definition.legality!.sourceIds = ['missing'];
    expect(GameDataReleaseSchema.safeParse(f.release).success).toBe(false);
  });
});
