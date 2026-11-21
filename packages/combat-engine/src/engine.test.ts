import { describe, it, expect } from 'vitest';
import { EventQueue } from './queue.js';
import { runRotation } from './engine.js';
import { combatFixture, recorded, utility } from './test/fixtures.js';
const unknown = () => ({
  gameVersionId: 'synthetic-damage-v1',
  status: 'UNKNOWN' as const,
  value: null,
  reason: 'Synthetic unknown',
});
const cast = {
  kind: 'CAST' as const,
  skillId: 'synthetic-skill',
  variantId: null,
};
describe('S10 stable event queue', () => {
  it('orders timestamps then FIFO sequence, including zero', () => {
    const q = new EventQueue<{ atMs: number; sequence: number }>();
    for (const e of [
      { atMs: 5, sequence: 0 },
      { atMs: 0, sequence: 3 },
      { atMs: 0, sequence: 1 },
    ])
      q.push(e);
    expect([q.pop(), q.pop(), q.pop()]).toEqual([
      { atMs: 0, sequence: 1 },
      { atMs: 0, sequence: 3 },
      { atMs: 5, sequence: 0 },
    ]);
    expect(q.pop()).toBeUndefined();
    expect(() => q.push({ atMs: 0.5, sequence: 0 })).toThrow();
  });
});
describe('S10 fixed/priority combat — all data synthetic', () => {
  it('runs fixed casts with stable serializable state and no DPS', () => {
    const f = combatFixture(),
      before = JSON.stringify(f),
      r = runRotation(f);
    expect(r.status).toBe('VALID');
    expect(r.totalExpectedDamage).toBe(1674);
    expect(r.meanDps).toBeNull();
    expect(r.finalState.resources.energy).toBe(4);
    expect(
      r.trace.filter((e) => e.kind === 'DAMAGE').map((e) => e.atMs),
    ).toEqual([50, 1050, 2050]);
    expect(runRotation(JSON.parse(before))).toEqual(r);
    expect(JSON.stringify(f)).toBe(before);
    expect(r.trace.map((e) => e.sequence)).toEqual(r.trace.map((_, i) => i));
  });
  it('rejects a cooldown violation without charging its resources', () => {
    const f = combatFixture();
    f.plan.actions[1].atMs = 500;
    const r = runRotation(f);
    expect(r.status).toBe('INVALID');
    expect(r.totalExpectedDamage).toBeNull();
    expect(r.finalState.resources.energy).toBe(8);
    expect(r.issues.join()).toContain('冷卻');
  });
  it('uses explicit shared cooldown groups across different skills', () => {
    const f = combatFixture();
    const alt = structuredClone(f.release.skills[0]);
    alt.id = 'alternate';
    alt.name = 'Synthetic alternate';
    f.release.skills.push(alt);
    f.release.martialArts[0].skillIds.push(alt.id);
    f.plan.actions = [
      { atMs: 0, action: cast },
      { atMs: 200, action: { ...cast, skillId: 'alternate' } },
    ];
    expect(runRotation(f).issues.join()).toContain('冷卻');
    alt.combat!.cooldownGroupId = 'alternate';
    expect(runRotation(f).status).toBe('VALID');
  });
  it('respects cast lockout and cooldown starting at cast end', () => {
    const f = combatFixture();
    f.release.skills[0].combat!.cooldownStart = 'CAST_END';
    f.plan.actions = [
      { atMs: 0, action: cast },
      { atMs: 1000, action: cast },
    ];
    expect(runRotation(f).status).toBe('INVALID');
    f.plan.actions[1].atMs = 1100;
    expect(runRotation(f).status).toBe('VALID');
    f.release.skills[0].combat!.cooldownMs = 0;
    f.plan.actions[1].atMs = 50;
    expect(runRotation(f).issues.join()).toContain('尚未完成');
  });
  it('checks every resource before applying any cost', () => {
    const f = combatFixture();
    f.release.combat!.resources.push({
      id: 'stamina',
      initial: recorded(1),
      maximum: recorded(1),
    });
    f.release.skills[0].combat!.resourceChanges.push({
      resourceId: 'stamina',
      delta: recorded(-2),
    });
    const r = runRotation(f);
    expect(r.totalExpectedDamage).toBeNull();
    expect(r.finalState.resources.energy).toBe(10);
  });
  it('caps resource gains at the maximum', () => {
    const f = combatFixture();
    f.release.skills[0].combat!.resourceChanges[0].delta = recorded(100);
    expect(runRotation(f).finalState.resources.energy).toBe(10);
  });
  it('excludes hits at the end of the time window', () => {
    const f = combatFixture();
    f.plan.durationMs = 2050;
    f.plan.actions = f.plan.actions.slice(0, 3);
    expect(
      runRotation(f)
        .trace.filter((e) => e.kind === 'DAMAGE')
        .map((e) => e.atMs),
    ).toEqual([50, 1050]);
  });
  it('rejects a rotation from a different game version', () => {
    const f = combatFixture();
    f.plan.gameVersionId = 'another-version';
    expect(runRotation(f).status).not.toBe('VALID');
  });
  it('blocks unknown required damage inputs', () => {
    const f = combatFixture();
    f.release.skills[0].hits[0].coefficient = unknown();
    expect(runRotation(f).totalExpectedDamage).toBeNull();
    expect(runRotation(f).status).not.toBe('VALID');
  });
  it('applies a buff and expires it at the declared time', () => {
    const f = combatFixture();
    const action = utility(f, 'buff', [
      { id: 'apply', offsetMs: 0, kind: 'APPLY_BUFF', targetId: 'boost' },
    ]);
    f.plan.actions = [
      { atMs: 0, action },
      { atMs: 1000, action: cast },
    ];
    const r = runRotation(f);
    expect(r.status).toBe('VALID');
    expect(r.trace.some((e) => e.kind.includes('BUFF'))).toBe(true);
    expect(r.trace.filter((e) => e.kind === 'DAMAGE').at(-1)?.damage).toBe(558);
  });
  it('schedules DOT ticks and excludes the expiration instant', () => {
    const f = combatFixture();
    const action = utility(f, 'dot', [
      { id: 'apply', offsetMs: 0, kind: 'APPLY_DOT', targetId: 'burn' },
    ]);
    f.plan.actions = [{ atMs: 0, action }];
    const r = runRotation(f);
    expect(r.status).toBe('VALID');
    expect(
      r.trace
        .filter((e) => e.kind === 'DAMAGE' && e.detail === 'dot:burn')
        .map((e) => e.atMs),
    ).toEqual([100, 200, 300]);
  });
  it('runs a priority plan with resource thresholds', () => {
    const f = combatFixture();
    f.plan.mode = 'PRIORITY';
    f.plan.actions = [];
    f.plan.decisionIntervalMs = 100;
    f.plan.priorityRules = [
      {
        action: cast,
        requiredBuffIds: [],
        forbiddenBuffIds: [],
        resourceId: 'energy',
        minimum: 6,
      },
    ];
    const r = runRotation(f);
    expect(r.status).toBe('VALID');
    expect(
      r.trace.filter((e) => e.kind === 'DAMAGE').map((e) => e.atMs),
    ).toEqual([50, 1050, 2050]);
    expect(r.finalState.resources.energy).toBe(4);
  });
  it('rejects repeated buffs when the rule forbids reapplication', () => {
    const f = combatFixture();
    f.release.combat!.buffs[0].reapply = 'REJECT';
    const action = utility(f, 'buff-reject', [
      { id: 'apply', offsetMs: 0, kind: 'APPLY_BUFF', targetId: 'boost' },
    ]);
    f.plan.actions = [
      { atMs: 0, action },
      { atMs: 100, action },
    ];
    expect(runRotation(f).status).toBe('INVALID');
    expect(runRotation(f).issues.join()).toContain('Buff不允許重套用');
  });
  it('replaces DOT scheduling without executing the old tick', () => {
    const f = combatFixture();
    const action = utility(f, 'dot-replace', [
      { id: 'apply', offsetMs: 0, kind: 'APPLY_DOT', targetId: 'burn' },
    ]);
    f.plan.actions = [
      { atMs: 0, action },
      { atMs: 50, action },
    ];
    const r = runRotation(f);
    expect(r.status).toBe('VALID');
    expect(
      r.trace
        .filter((e) => e.kind === 'DAMAGE' && e.detail === 'dot:burn')
        .map((e) => e.atMs),
    ).toEqual([150, 250, 350]);
  });
  it('rejects repeated DOT when the rule forbids reapplication', () => {
    const f = combatFixture();
    f.release.combat!.dots[0].reapply = 'REJECT';
    const action = utility(f, 'dot-reject', [
      { id: 'apply', offsetMs: 0, kind: 'APPLY_DOT', targetId: 'burn' },
    ]);
    f.plan.actions = [
      { atMs: 0, action },
      { atMs: 50, action },
    ];
    expect(runRotation(f).status).toBe('INVALID');
    expect(runRotation(f).issues.join()).toContain('DOT不允許重套用');
  });
  it('holds snapshot buff values while dynamic DOT uses current buffs', () => {
    const f = combatFixture();
    f.release.combat!.buffs[0].durationMs = 150;
    const action = utility(f, 'buff-dot-snapshot', [
      { id: 'buff', offsetMs: 0, kind: 'APPLY_BUFF', targetId: 'boost' },
      { id: 'dot', offsetMs: 0, kind: 'APPLY_DOT', targetId: 'burn' },
    ]);
    f.plan.actions = [{ atMs: 0, action }];
    f.release.combat!.dots[0].scaling = 'SNAPSHOT';
    const damage = () =>
      runRotation(f)
        .trace.filter((e) => e.kind === 'DAMAGE' && e.detail === 'dot:burn')
        .map((e) => e.damage);
    expect(damage()).toEqual([1116, 1116, 1116]);
    f.release.combat!.dots[0].scaling = 'DYNAMIC';
    expect(damage()).toEqual([1116, 558, 558]);
  });
  it('priority requires and forbids buff states', () => {
    const f = combatFixture();
    f.plan.mode = 'PRIORITY';
    f.plan.actions = [];
    f.plan.decisionIntervalMs = 100;
    f.plan.priorityRules = [
      {
        action: cast,
        requiredBuffIds: ['boost'],
        forbiddenBuffIds: [],
        resourceId: null,
        minimum: null,
      },
    ];
    expect(
      runRotation(f).trace.filter((e) => e.kind === 'DAMAGE'),
    ).toHaveLength(0);
    f.plan.priorityRules[0].requiredBuffIds = [];
    f.plan.priorityRules[0].forbiddenBuffIds = ['boost'];
    expect(
      runRotation(f).trace.filter((e) => e.kind === 'DAMAGE'),
    ).toHaveLength(3);
  });
  it('cancels nonpersistent hits after switching weapons', () => {
    const f = combatFixture();
    f.release.skills[0].hits[0].offsetMs = 150;
    f.release.skills[0].combat!.hitsPersistAfterSwitch = false;
    f.plan.actions = [
      { atMs: 0, action: cast },
      {
        atMs: 100,
        action: { kind: 'SWITCH', martialArtId: 'synthetic-spear' },
      },
    ];
    const r = runRotation(f);
    expect(r.status).toBe('VALID');
    expect(r.trace.filter((e) => e.kind === 'DAMAGE')).toHaveLength(0);
    expect(r.finalState.martialArtId).toBe('synthetic-spear');
  });
  it('expires a buff before a hit at the exact expiration timestamp', () => {
    const f = combatFixture();
    const action = utility(f, 'expiration-boundary', [
      { id: 'apply', offsetMs: 0, kind: 'APPLY_BUFF', targetId: 'boost' },
    ]);
    f.plan.actions = [
      { atMs: 0, action },
      { atMs: 450, action: cast },
    ];
    const r = runRotation(f);
    expect(r.status).toBe('VALID');
    expect(
      r.trace.find((e) => e.kind === 'DAMAGE' && e.atMs === 500)?.damage,
    ).toBe(558);
    expect(
      r.trace.some((e) => e.kind === 'BUFF_EXPIRE' && e.atMs === 500),
    ).toBe(true);
  });
  it('propagates estimated combat rules and blocks them in explicit-only mode', () => {
    const f = combatFixture();
    f.release.combat!.evidence.status = 'ESTIMATED';
    const r = runRotation(f);
    expect(r.status).toBe('VALID');
    expect(r.provenance.containsEstimates).toBe(true);
    f.plan.onlyExplicit = true;
    const explicit = runRotation(f);
    expect(explicit.totalExpectedDamage).toBeNull();
    expect(explicit.issues.join()).toContain('僅使用明確資料');
  });
  it('rejects a resource value from another game version', () => {
    const f = combatFixture();
    f.release.combat!.resources[0].initial.gameVersionId = 'other-version';
    const r = runRotation(f);
    expect(r.totalExpectedDamage).toBeNull();
    expect(r.status).not.toBe('VALID');
  });
  it('stops priority simulation at the event limit without returning partial damage', () => {
    const f = combatFixture();
    f.plan.durationMs = 11000;
    f.plan.mode = 'PRIORITY';
    f.plan.actions = [];
    f.plan.decisionIntervalMs = 1;
    f.plan.priorityRules = [
      {
        action: cast,
        requiredBuffIds: ['boost'],
        forbiddenBuffIds: [],
        resourceId: null,
        minimum: null,
      },
    ];
    const r = runRotation(f);
    expect(r.totalExpectedDamage).toBeNull();
    expect(r.issues.join()).toContain('10000');
  });
  it('requires a charged variant to fit its declared cast duration', () => {
    const f = combatFixture();
    const skill = f.release.skills[0];
    skill.variants = [
      {
        id: 'charged',
        name: 'Synthetic charged',
        applicability: structuredClone(skill.applicability!),
        chargeMs: 300,
        requiredStateIds: [],
        swordEnergy: recorded(0),
        hits: structuredClone(skill.hits),
        events: [],
        combat: { ...skill.combat!, castDurationMs: 100 },
      },
    ];
    f.plan.actions = [{ atMs: 0, action: { ...cast, variantId: 'charged' } }];
    expect(runRotation(f).issues.join()).toContain('蓄力時間');
    skill.variants[0].combat!.castDurationMs = 300;
    expect(runRotation(f).status).toBe('VALID');
  });
  it('requires a charged variant state and accepts it while active', () => {
    const f = combatFixture();
    const skill = f.release.skills[0];
    skill.variants = [
      {
        id: 'charged',
        name: 'Synthetic charged',
        applicability: structuredClone(skill.applicability!),
        chargeMs: 100,
        requiredStateIds: ['boost'],
        swordEnergy: recorded(0),
        hits: structuredClone(skill.hits),
        events: [],
        combat: structuredClone(skill.combat!),
      },
    ];
    const charged = { ...cast, variantId: 'charged' };
    f.plan.actions = [{ atMs: 0, action: charged }];
    expect(runRotation(f).issues.join()).toContain('缺少必要狀態');
    const apply = utility(f, 'apply-required', [
      { id: 'apply', offsetMs: 0, kind: 'APPLY_BUFF', targetId: 'boost' },
    ]);
    f.release.skills.find((item) => item.id === 'apply-required')!.variants =
      undefined;
    f.plan.actions = [
      { atMs: 0, action: apply },
      { atMs: 100, action: charged },
    ];
    expect(runRotation(f).status).toBe('VALID');
  });
  it('enforces sword energy threshold before applying a cast cost', () => {
    const f = combatFixture();
    const skill = f.release.skills[0];
    skill.variants = [
      {
        id: 'charged',
        name: 'Synthetic charged',
        applicability: structuredClone(skill.applicability!),
        chargeMs: 100,
        requiredStateIds: [],
        swordEnergy: recorded(11),
        hits: structuredClone(skill.hits),
        events: [],
        combat: { ...skill.combat!, swordEnergyMode: 'REQUIRE_MINIMUM' },
      },
    ];
    f.plan.actions = [{ atMs: 0, action: { ...cast, variantId: 'charged' } }];
    const rejected = runRotation(f);
    expect(rejected.issues.join()).toContain('劍氣不足');
    expect(rejected.finalState.resources.energy).toBe(10);
    skill.variants[0].swordEnergy = recorded(10);
    expect(runRotation(f).status).toBe('VALID');
    expect(runRotation(f).finalState.resources.energy).toBe(8);
  });
  it('executes variant energy, state and weapon events in timestamp order', () => {
    const f = combatFixture();
    const skill = f.release.skills[0];
    const event = {
      targetMartialArtId: null,
      stateId: null,
      amount: recorded(0),
    };
    skill.variants = [
      {
        id: 'events',
        name: 'Synthetic events',
        applicability: structuredClone(skill.applicability!),
        chargeMs: 0,
        requiredStateIds: [],
        swordEnergy: recorded(0),
        hits: structuredClone(skill.hits),
        combat: structuredClone(skill.combat!),
        events: [
          {
            ...event,
            id: 'gain',
            kind: 'SWORD_ENERGY',
            offsetMs: 10,
            amount: recorded(1),
          },
          {
            ...event,
            id: 'apply',
            kind: 'STATE_APPLY',
            offsetMs: 20,
            stateId: 'boost',
          },
          {
            ...event,
            id: 'remove',
            kind: 'STATE_REMOVE',
            offsetMs: 70,
            stateId: 'boost',
          },
          {
            ...event,
            id: 'switch',
            kind: 'WEAPON_SWITCH',
            offsetMs: 100,
            targetMartialArtId: 'synthetic-spear',
          },
        ],
      },
    ];
    f.plan.actions = [{ atMs: 0, action: { ...cast, variantId: 'events' } }];
    const r = runRotation(f);
    expect(r.status).toBe('VALID');
    expect(
      r.trace
        .filter((e) =>
          [
            'RESOURCE',
            'BUFF_APPLY',
            'DAMAGE',
            'BUFF_REMOVE',
            'WEAPON_SWITCH',
          ].includes(e.kind),
        )
        .map((e) => [e.atMs, e.kind]),
    ).toEqual([
      [0, 'RESOURCE'],
      [10, 'RESOURCE'],
      [20, 'BUFF_APPLY'],
      [50, 'DAMAGE'],
      [70, 'BUFF_REMOVE'],
      [100, 'WEAPON_SWITCH'],
    ]);
    expect(r.trace.find((e) => e.kind === 'DAMAGE')?.damage).toBe(1116);
    expect(r.finalState.resources.energy).toBe(9);
    expect(r.finalState.martialArtId).toBe('synthetic-spear');
  });
  it('blocks a variant with unknown event timing without partial damage', () => {
    const f = combatFixture();
    const skill = f.release.skills[0];
    skill.variants = [
      {
        id: 'untimed',
        name: 'Synthetic untimed',
        applicability: structuredClone(skill.applicability!),
        chargeMs: 0,
        requiredStateIds: [],
        swordEnergy: recorded(0),
        hits: structuredClone(skill.hits),
        combat: structuredClone(skill.combat!),
        events: [
          {
            id: 'gain',
            kind: 'SWORD_ENERGY',
            offsetMs: null,
            targetMartialArtId: null,
            stateId: null,
            amount: recorded(1),
          },
        ],
      },
    ];
    f.plan.actions = [{ atMs: 0, action: { ...cast, variantId: 'untimed' } }];
    const r = runRotation(f);
    expect(r.status).not.toBe('VALID');
    expect(r.totalExpectedDamage).toBeNull();
    expect(r.issues.join()).toContain('時間未知');
  });
});
