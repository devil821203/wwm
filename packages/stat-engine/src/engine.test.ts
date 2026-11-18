import { describe, expect, it } from 'vitest';
import { aggregateStats } from './aggregate.js';
import { calculateDamage } from './damage.js';
import {
  damageFixture,
  recorded,
  unknown,
  estimated,
} from './test/fixtures.js';
describe('S08 source-aware aggregation — synthetic only', () => {
  it('adds explicit base panel, purple base and existing affix without rounding', () => {
    const f = damageFixture();
    f.build.stats[0].value = recorded(100.123456789);
    const a = aggregateStats(f);
    expect(a.stats.attack.value).toBe(100.123456789 + 80 + 94);
    expect(a.stats.attack.contributions).toHaveLength(3);
    expect(a.stats.attack.provenance.canCalculate).toBe(true);
    expect(a.stats.unused.value).toBeNull();
  });
  it('does not double count an equipment-inclusive panel, even if unused inventory is missing', () => {
    const f = damageFixture();
    f.build.panelMode = 'EQUIPMENT_INCLUDED';
    f.build.stats[0].value = recorded(274);
    f.equipment = [];
    expect(aggregateStats(f).stats.attack.value).toBe(274);
    expect(calculateDamage(f).expectedDamage).toBeCloseTo(393.39);
  });
  it('does not assume a missing base panel is zero', () => {
    const f = damageFixture();
    f.build.stats = [];
    expect(calculateDamage(f).expectedDamage).toBeNull();
  });
  it('requires panel mode before combining', () => {
    const f = damageFixture();
    f.build.panelMode = 'UNKNOWN';
    expect(aggregateStats(f).stats.attack.value).toBeNull();
  });
  it('preserves confirmed zero without equipment', () => {
    const f = damageFixture();
    f.build.equipmentIds = [];
    f.build.stats[0].value = recorded(0);
    expect(aggregateStats(f).stats.attack.value).toBe(0);
  });
  it('propagates an applicable chengyin estimate to the dependent damage only', () => {
    const f = damageFixture();
    f.release.affixCaps[0].chengYinValue = unknown();
    const r = calculateDamage(f);
    expect(r.expectedDamage).toBeCloseTo(393.39);
    expect(r.provenance.label).toBe('包含預估資料');
    expect(r.provenance.estimatedDependencies).toContain(
      'gear:synthetic-instance:affix:attack-affix',
    );
    expect(
      r.dependencies['gear:synthetic-instance:affix:attack-affix'],
    ).toMatchObject({
      status: 'ESTIMATED',
      inputs: { maximum: 100, ratio: 0.94 },
    });
    f.onlyExplicit = true;
    expect(calculateDamage(f).expectedDamage).toBeNull();
  });
  it('keeps an unknown unused affix from contaminating the selected formula', () => {
    const f = damageFixture();
    f.equipment[0].affixes.push({
      affixId: 'unused-affix',
      valueMode: 'MANUAL',
      current: unknown(),
      effective: unknown(),
      maximum: unknown(),
    });
    const r = calculateDamage(f);
    expect(r.aggregation.stats.unused.value).toBeNull();
    expect(r.expectedDamage).toBeCloseTo(393.39);
    expect(
      Object.keys(r.dependencies).some((id) => id.includes('unused')),
    ).toBe(false);
  });
  it('does not label a result estimated for an unused estimated parameter', () => {
    const f = damageFixture();
    f.release.formulas[0].parameters.unused = estimated(999);
    expect(calculateDamage(f).provenance.containsEstimates).toBe(false);
  });
  it.each(['SCREENSHOT', 'MANUAL', 'GENERATED'] as const)(
    'creationMethod %s has identical arithmetic',
    (method) => {
      const f = damageFixture();
      f.equipment[0].creationMethod = method;
      expect(calculateDamage(f).expectedDamage).toBeCloseTo(393.39);
    },
  );
  it('rejects missing equipment references', () => {
    const f = damageFixture();
    f.equipment = [];
    expect(calculateDamage(f).issues.join()).toContain('裝備缺失');
    expect(calculateDamage(f).expectedDamage).toBeNull();
  });
  it('rejects duplicate equipment IDs and slots', () => {
    const f = damageFixture();
    f.build.equipmentIds.push(f.build.equipmentIds[0]);
    expect(calculateDamage(f).expectedDamage).toBeNull();
    const g = damageFixture();
    g.equipment.push({ ...structuredClone(g.equipment[0]), id: 'another' });
    g.build.equipmentIds.push('another');
    expect(calculateDamage(g).issues.join()).toContain('部位未知或重複');
  });
  it('rejects a version mismatch and invalid level', () => {
    const f = damageFixture();
    f.character.gameVersionId = 'different';
    expect(calculateDamage(f).expectedDamage).toBeNull();
    const g = damageFixture();
    g.character.level = 4;
    expect(calculateDamage(g).expectedDamage).toBeNull();
  });
  it('rejects equipment with a known illegal value or level gate', () => {
    const f = damageFixture();
    f.equipment[0].affixes[0].valueMode = 'MANUAL';
    f.equipment[0].affixes[0].current = recorded(101);
    expect(calculateDamage(f).issues.join()).toContain('裝備不合法');
    const g = damageFixture();
    g.release.equipment[0].requiredLevel = 7;
    expect(calculateDamage(g).expectedDamage).toBeNull();
  });
  it('refuses unknown equipment identity and unmapped effects', () => {
    const f = damageFixture();
    f.equipment[0].definitionId = 'missing';
    expect(calculateDamage(f).expectedDamage).toBeNull();
    const g = damageFixture();
    g.build.innerWays = [{ id: 'not-modeled', level: 1 }];
    expect(calculateDamage(g).expectedDamage).toBeNull();
  });
});
describe('S08 deterministic weighted hit expectations — synthetic only', () => {
  it('honors an explicit-only restriction saved on the equipment instance', () => {
    const f = damageFixture();
    f.equipment[0].onlyExplicit = true;
    f.release.affixCaps[0].chengYinValue = unknown();
    expect(calculateDamage(f).expectedDamage).toBeNull();
  });
  it('returns stable serializable results without mutating input or inventing DPS', () => {
    const f = damageFixture();
    const input = JSON.stringify(f);
    const a = calculateDamage(f);
    const b = calculateDamage(f);
    expect(a).toEqual(b);
    expect(calculateDamage(JSON.parse(input))).toEqual(a);
    expect(JSON.stringify(f)).toBe(input);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(a.expectedDamage).toBeCloseTo(393.39);
    expect(a.meanDps).toBeNull();
    expect(a.formula).toMatchObject({
      version: 'synthetic-1',
      implementationId: 'weighted-hit-v1',
    });
  });
  it('sums multiple hit coefficients independently', () => {
    const f = damageFixture();
    f.release.skills[0].hits.push({
      id: 'hit-b',
      offsetMs: 100,
      coefficient: recorded(1),
      flatDamage: recorded(0),
    });
    expect(calculateDamage(f).expectedDamage).toBeCloseTo(586.56);
  });
  it('accepts real zero probabilities and enemy multiplier zero', () => {
    const f = damageFixture();
    const p = f.release.formulas[0].parameters;
    p['normal-probability'] = recorded(1);
    p['critical-probability'] = recorded(0);
    p['insight-probability'] = recorded(0);
    p['miss-probability'] = recorded(0);
    p['enemy-multiplier'] = recorded(0);
    expect(calculateDamage(f).expectedDamage).toBe(0);
  });
  it('requires unknown coefficient and flat damage even when other multipliers are zero', () => {
    const f = damageFixture();
    f.release.skills[0].hits[0].coefficient = unknown();
    f.release.formulas[0].parameters['enemy-multiplier'] = recorded(0);
    expect(calculateDamage(f).expectedDamage).toBeNull();
    f.release.skills[0].hits[0].coefficient = recorded(2);
    f.release.skills[0].hits[0].flatDamage = unknown();
    expect(calculateDamage(f).expectedDamage).toBeNull();
  });
  it('rejects unsupported implementation IDs rather than executing source strings', () => {
    const f = damageFixture();
    f.release.formulas[0].implementationId = 'arbitrary-code';
    expect(calculateDamage(f).expectedDamage).toBeNull();
    expect(calculateDamage(f).issues.join()).toContain('公式實作未支援');
  });
  it('requires explicit path-to-formula mapping', () => {
    const f = damageFixture();
    f.release.paths[0].formulaStatus = 'UNKNOWN';
    f.release.paths[0].formulaIds = [];
    expect(calculateDamage(f).expectedDamage).toBeNull();
  });
  it('does not borrow another path coefficient', () => {
    const f = damageFixture();
    f.release.paths.push({
      ...structuredClone(f.release.paths[0]),
      id: 'other',
      martialArtIds: [],
      formulaIds: [],
      formulaStatus: 'UNKNOWN',
    });
    f.character.pathId = 'other';
    expect(calculateDamage(f).expectedDamage).toBeNull();
    expect(calculateDamage(f).issues.join()).toContain('不借用其他流派');
  });
  it('requires formula evidence and level-specific applicability', () => {
    const f = damageFixture();
    delete f.release.formulas[0].evidence;
    expect(calculateDamage(f).expectedDamage).toBeNull();
    const g = damageFixture();
    delete g.release.skills[0].applicability;
    expect(calculateDamage(g).expectedDamage).toBeNull();
    const h = damageFixture();
    h.build.martialArts[0].level = 2;
    expect(calculateDamage(h).expectedDamage).toBeNull();
  });
  it('propagates formula model uncertainty even when every numeric parameter is recorded', () => {
    const f = damageFixture();
    f.release.formulas[0].evidence!.status = 'ESTIMATED';
    expect(calculateDamage(f).status).toBe('ESTIMATED');
    expect(calculateDamage(f).provenance.estimatedDependencies).toContain(
      'formula:synthetic-formula:synthetic-proof-1',
    );
    f.onlyExplicit = true;
    expect(calculateDamage(f).expectedDamage).toBeNull();
  });
  it('propagates estimated coefficients and filters them explicitly', () => {
    const f = damageFixture();
    f.release.skills[0].hits[0].coefficient = estimated(2);
    expect(calculateDamage(f).provenance.label).toBe('包含預估資料');
    f.onlyExplicit = true;
    expect(calculateDamage(f).expectedDamage).toBeNull();
  });
  it('does not infer missing probabilities or normalize an invalid distribution', () => {
    const f = damageFixture();
    delete f.release.formulas[0].parameters['normal-probability'];
    expect(calculateDamage(f).expectedDamage).toBeNull();
    const g = damageFixture();
    g.release.formulas[0].parameters['critical-probability'] = recorded(0.8);
    expect(calculateDamage(g).expectedDamage).toBeNull();
  });
  it('rejects negative and out-of-range inputs', () => {
    const f = damageFixture();
    f.release.formulas[0].parameters['normal-probability'] = recorded(-0.1);
    expect(calculateDamage(f).expectedDamage).toBeNull();
    const g = damageFixture();
    g.release.formulas[0].parameters['enemy-multiplier'] = recorded(-1);
    expect(calculateDamage(g).expectedDamage).toBeNull();
  });
  it('supports explicit probability stat binding and rejects unit mismatch or ambiguous input', () => {
    const f = damageFixture();
    f.release.stats.push({
      id: 'crit-chance',
      gameVersionId: f.release.version.id,
      name: 'Synthetic ratio',
      unit: 'ratio',
      description: 'Synthetic',
    });
    f.build.stats.push({ statId: 'crit-chance', value: recorded(0.25) });
    f.release.formulas[0].statBindings!['critical-probability'] = 'crit-chance';
    delete f.release.formulas[0].parameters['critical-probability'];
    expect(calculateDamage(f).expectedDamage).toBeCloseTo(393.39);
    f.release.stats[2].unit = 'percent';
    expect(calculateDamage(f).expectedDamage).toBeNull();
    f.release.stats[2].unit = 'ratio';
    f.release.formulas[0].parameters['critical-probability'] = recorded(0.25);
    expect(calculateDamage(f).expectedDamage).toBeNull();
  });
  it('returns null on overflow instead of serializing Infinity', () => {
    const f = damageFixture();
    f.build.panelMode = 'EQUIPMENT_INCLUDED';
    f.build.stats[0].value = recorded(Number.MAX_VALUE);
    expect(calculateDamage(f).expectedDamage).toBeNull();
  });
  it('returns a missing-data report for absent release and skill', () => {
    const f = damageFixture();
    f.skillId = 'missing';
    expect(calculateDamage(f).expectedDamage).toBeNull();
    expect(
      calculateDamage({ ...f, release: undefined }).expectedDamage,
    ).toBeNull();
  });
});
