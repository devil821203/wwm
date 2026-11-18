import { describe, it, expect } from 'vitest';
import {
  simulate,
  seededRandom,
  type SimulationRequest,
} from './simulation.js';
import { runRotation } from './engine.js';
import { combatFixture, recorded, utility } from './test/fixtures.js';
function fixture(): SimulationRequest {
  const combat = combatFixture();
  // Isolate combat sampling from equipment legality with an explicitly supplied panel.
  combat.build.panelMode = 'EQUIPMENT_INCLUDED';
  combat.build.equipmentIds = [];
  combat.equipment = [];
  return { combat, mode: 'MONTE_CARLO', seed: 0, samples: 100 };
}
describe('S11 synthetic simulation', () => {
  it('replays seed zero including serialized input without mutation', () => {
    const f = fixture(),
      before = JSON.stringify(f),
      result = simulate(f);
    expect(result.meanDps).not.toBeNull();
    expect(simulate(JSON.parse(before))).toEqual(result);
    expect(JSON.stringify(f)).toBe(before);
    expect(result.timeline.at(-1)?.cumulativeDamage).toBe(
      result.expected.totalExpectedDamage,
    );
  });
  it('uses distinct seeds, exact outcomes and an analytic expectation', () => {
    const f = fixture();
    f.combat.release!.formulas[0].parameters['normal-probability'] =
      recorded(0.5);
    f.combat.release!.formulas[0].parameters['miss-probability'] =
      recorded(0.5);
    f.samples = 1000;
    const r = simulate(f);
    expect(r.meanDps).not.toBeNull();
    expect(Math.abs(r.meanDps! - r.expectedDps!)).toBeLessThan(
      r.expectedDps! * 0.08,
    );
    expect(r.samples).not.toEqual(simulate({ ...f, seed: 1 }).samples);
    expect(r.confidenceInterval).not.toBeNull();
    expect(r.sampleCount).toBe(1000);
  });
  it('keeps deterministic zero and a single sample without a fictitious interval', () => {
    const f = fixture();
    f.combat.release!.formulas[0].parameters['normal-probability'] =
      recorded(0);
    f.combat.release!.formulas[0].parameters['miss-probability'] = recorded(1);
    f.samples = 1;
    const r = simulate(f);
    expect(r.meanDps).toBe(0);
    expect(r.confidenceInterval).toBeNull();
    expect(simulate({ ...f, samples: 2 }).confidenceInterval).toEqual([0, 0]);
  });
  it('blocks unknown, invalid, unverified equipment and explicit-only estimates', () => {
    const f = fixture();
    f.combat.release!.skills[0].hits[0].coefficient = {
      status: 'UNKNOWN',
      gameVersionId: f.combat.plan.gameVersionId,
      value: null,
      reason: 'synthetic missing',
    };
    expect(simulate(f).meanDps).toBeNull();
    expect(simulate({ ...f, mode: 'EXPECTED' }).timeline).toEqual([]);
    const invalid = fixture();
    invalid.combat.plan.actions[1].atMs = 1;
    expect(simulate(invalid).meanDps).toBeNull();
    const est = fixture();
    est.combat.release!.combat!.evidence.status = 'ESTIMATED';
    expect(simulate(est).provenance.label).toBe('包含預估資料');
    est.combat.onlyExplicit = true;
    expect(simulate(est).meanDps).toBeNull();
  });
  it('shares buff/DOT scheduling and attribution across both modes', () => {
    const f = fixture();
    const action = utility(
      f.combat as ReturnType<typeof combatFixture>,
      'effect',
      [
        { id: 'a', offsetMs: 0, kind: 'APPLY_BUFF', targetId: 'boost' },
        { id: 'b', offsetMs: 0, kind: 'APPLY_DOT', targetId: 'burn' },
      ],
    );
    f.combat.plan.actions = [{ atMs: 0, action }];
    const r = simulate(f),
      e = simulate({ ...f, mode: 'EXPECTED' });
    expect(r.meanDps).toBe(e.meanDps);
    expect(r.bySkill['dot:burn']).toBeGreaterThan(0);
    expect(Object.values(r.bySkill).reduce((a, b) => a + b, 0)).toBe(
      r.expected.totalExpectedDamage,
    );
    expect(runRotation(f.combat, seededRandom(0)).finalState).toEqual(
      runRotation(f.combat).finalState,
    );
  });
  it('requires revalidated equipment legality even with an inclusive panel', () => {
    const combat = combatFixture();
    combat.build.panelMode = 'EQUIPMENT_INCLUDED';
    // Force an incomplete identity, never trust a stored validation status.
    delete combat.equipment[0].slotId;
    const r = simulate({ combat, mode: 'EXPECTED', seed: 0, samples: 1 });
    expect(r.meanDps).toBeNull();
    expect(r.issues.join()).toContain('裝備');
  });
  it('samples all mutually exclusive outcomes instead of scaling an expectation', () => {
    const f = fixture();
    const p = f.combat.release!.formulas[0].parameters;
    p['normal-probability'] = recorded(0.25);
    p['critical-probability'] = recorded(0.25);
    p['insight-probability'] = recorded(0.25);
    p['miss-probability'] = recorded(0.25);
    const expected = runRotation(f.combat);
    for (const [draw, multiplier] of [
      [0, 1],
      [0.25, 1.5],
      [0.5, 2],
      [0.75, 0],
    ]) {
      const r = runRotation(f.combat, () => draw);
      expect(r.totalExpectedDamage).toBe(630 * multiplier);
      expect(r.finalState).toEqual(expected.finalState);
    }
    expect(runRotation(f.combat, () => 1).totalExpectedDamage).toBeNull();
  });
  it('rejects nonfinite DPS or variance without serialized Infinity', () => {
    const f = fixture();
    f.combat.plan.durationMs = 1;
    f.combat.plan.actions = [f.combat.plan.actions[0]];
    f.combat.release!.skills[0].hits[0].offsetMs = 0;
    f.combat.release!.skills[0].hits[0].flatDamage = recorded(1e306);
    const r = simulate({ ...f, mode: 'EXPECTED' });
    expect(r.meanDps).toBeNull();
    expect(r.issues.join()).toContain('有限數值');
    const v = fixture();
    v.combat.release!.skills[0].hits[0].flatDamage = recorded(1e160);
    v.combat.release!.formulas[0].parameters['normal-probability'] =
      recorded(0.5);
    v.combat.release!.formulas[0].parameters['miss-probability'] =
      recorded(0.5);
    expect(simulate(v).meanDps).toBeNull();
    expect(simulate(v).issues.join()).toContain('統計');
  });
  it('validates limits and reports progress', () => {
    const f = fixture(),
      progress: number[] = [];
    simulate(f, (done) => progress.push(done));
    expect(progress.at(-1)).toBe(100);
    for (const seed of [-1, 0.1, 4294967296, NaN])
      expect(() => simulate({ ...f, seed })).toThrow();
    for (const samples of [0, 10001, 1.2])
      expect(() => simulate({ ...f, samples })).toThrow();
    const random = seededRandom(42);
    expect(
      Array.from({ length: 100 }, random).every((v) => v >= 0 && v < 1),
    ).toBe(true);
  });
});
