import { describe, it, expect } from 'vitest';
import { simulate } from '@wwm/combat-engine';
import { GameDataReleaseSchema } from '@wwm/game-data';
import { optimize } from './index.js';
import { optimizerFixture } from './test/fixtures.js';
import { recorded, utility } from './test/combat-fixture.js';
describe('S13 synthetic optimizer', () => {
  it('matches independent exhaustive combinations for a small inventory with stable replay and no mutation', () => {
    const f = optimizerFixture(),
      before = JSON.stringify(f);
    const brute: number[] = [];
    for (const h of ['head-0', 'head-1'])
      for (const w of ['weapon-0', 'weapon-1'])
        brute.push(
          simulate({
            combat: {
              ...f.combat,
              build: { ...f.combat.build, equipmentIds: [h, w] },
            },
            mode: 'EXPECTED',
            seed: 0,
            samples: 1,
          }).meanDps!,
        );
    brute.sort((a, b) => b - a);
    const r = optimize(f);
    expect(r.top.map((row) => row.meanDps)).toEqual(brute.slice(0, 3));
    expect(r.top[0].meanDps).toBe(930);
    expect(r.baselineDps).toBe(530);
    expect(r.optimalityProven).toBe(true);
    expect(r.visited).toBe(4);
    expect(r.coverage).toBe(1);
    expect(JSON.stringify(f)).toBe(before);
    expect(optimize(JSON.parse(before))).toEqual(r);
  });
  it('enforces slot locks, exclusions, zero cost, total budget and minimum stats', () => {
    const f = optimizerFixture();
    f.maximumCost = 5;
    f.minimumStats = { attack: 360 };
    const r = optimize(f);
    expect(r.top).toHaveLength(2);
    expect(r.top.every((row) => row.cost === 5 && row.meanDps === 730)).toBe(
      true,
    );
    f.locked = { head: 'head-0' };
    expect(optimize(f).top[0].equipmentIds).toEqual(['head-0', 'weapon-1']);
    f.excludedIds = ['weapon-1'];
    expect(optimize(f).top).toEqual([]);
    f.minimumStats = {};
    f.maximumCost = 0;
    expect(optimize(f).top[0].cost).toBe(0);
    delete f.costs['head-0'];
    expect(optimize(f).top).toEqual([]);
  });
  it('rejects unknown, over-level or invalid candidates instead of ranking them as zero', () => {
    const f = optimizerFixture();
    f.combat.equipment[1].affixes[0].current = {
      status: 'UNKNOWN',
      gameVersionId: f.combat.character.gameVersionId,
      value: null,
      reason: 'Synthetic missing',
    };
    const r = optimize(f);
    expect(r.rejected.some((e) => e.id === 'head-1')).toBe(true);
    expect(r.top.every((row) => !row.equipmentIds.includes('head-1'))).toBe(
      true,
    );
    expect(r.optimalityProven).toBe(false);
    f.combat.release!.equipment[0].requiredLevel = 7;
    expect(optimize(f).top).toEqual([]);
  });
  it('blocks inclusive panels, unknown references and duplicate inventory identity', () => {
    const f = optimizerFixture();
    f.combat.build.panelMode = 'EQUIPMENT_INCLUDED';
    expect(optimize(f).issues.join()).toContain('基礎面板');
    f.combat.build.panelMode = 'BASE_ONLY';
    f.minimumStats = { missing: 0 };
    expect(optimize(f).status).toBe('BLOCKED');
    f.minimumStats = {};
    f.combat.equipment.push(f.combat.equipment[0]);
    expect(optimize(f).status).toBe('BLOCKED');
  });
  it('uses complete set thresholds and sources in DPS and enforces set counts', () => {
    const f = optimizerFixture();
    f.combat.release!.equipmentSets = [
      {
        id: 'synthetic-set',
        gameVersionId: f.combat.release!.version.id,
        name: '合成套裝',
        verified: true,
        sourceIds: ['synthetic-source'],
        bonuses: [
          { pieces: 2, stats: [{ statId: 'attack', value: recorded(50) }] },
        ],
      },
    ];
    f.combat.release!.equipment.forEach((d) => {
      d.setId = 'synthetic-set';
    });
    f.requiredSets = { 'synthetic-set': 2 };
    expect(GameDataReleaseSchema.safeParse(f.combat.release).success).toBe(
      true,
    );
    const r = optimize(f);
    expect(r.top[0].meanDps).toBe(1030);
    for (const item of f.combat.equipment) delete item.definitionId;
    expect(optimize(f).top[0].meanDps).toBe(1030);
    expect(
      Object.keys(r.top[0].simulation.expected.dependencies).some((id) =>
        id.includes('set:synthetic-set:2:attack'),
      ),
    ).toBe(true);
    f.requiredSets['synthetic-set'] = 3;
    expect(optimize(f).top).toEqual([]);
    f.requiredSets = {};
    f.combat.release!.equipmentSets[0].verified = false;
    expect(optimize(f).top).toEqual([]);
  });
  it('propagates estimated formula provenance and explicit-only rejection', () => {
    const f = optimizerFixture();
    f.combat.release!.formulas[0].evidence!.status = 'ESTIMATED';
    const r = optimize(f);
    expect(r.top[0].simulation.provenance.label).toBe('包含預估資料');
    f.combat.onlyExplicit = true;
    expect(optimize(f).top).toEqual([]);
  });
  it('improves a tied proxy through local full-cycle search and never claims Beam optimality', () => {
    const f = optimizerFixture();
    const action = utility(
      f.combat as ReturnType<
        typeof import('./test/combat-fixture.js').combatFixture
      >,
      'proxy-zero',
      [],
    );
    f.combat.plan.actions.unshift({ atMs: 0, action });
    f.method = 'BEAM';
    f.beamWidth = 1;
    f.topK = 1;
    const r = optimize(f);
    expect(r.top[0].meanDps).toBe(930);
    expect(r.visited).toBeGreaterThan(1);
    expect(r.optimalityProven).toBe(false);
    expect(r.method).toBe('BEAM_LOCAL');
  });
  it('honors bounds and cancellation without exposing a partial ranking', () => {
    const f = optimizerFixture();
    f.maxEvaluations = 1;
    const limited = optimize(f);
    expect(limited.optimalityProven).toBe(false);
    expect(limited.status).toBe('PARTIAL');
    expect(limited.evaluated).toBe(1);
    const r = optimize(optimizerFixture(), { isCancelled: () => true });
    expect(r.status).toBe('CANCELLED');
    expect(r.top).toEqual([]);
    const updates: string[] = [];
    optimize(optimizerFixture(), { progress: (p) => updates.push(p.phase) });
    expect(updates[0]).toBe('FILTER');
    expect(updates.at(-1)).toBe('DONE');
  });
  it('keeps exact zero DPS and avoids percent division by zero', () => {
    const f = optimizerFixture();
    f.combat.release!.skills[0].hits[0].coefficient = recorded(0);
    f.combat.release!.skills[0].hits[0].flatDamage = recorded(0);
    const r = optimize(f);
    expect(r.top[0].meanDps).toBe(0);
    expect(r.top[0].gainPercent).toBeNull();
  });
});
