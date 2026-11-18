import base from './synthetic-base.json' with { type: 'json' };
import {
  GameDataReleaseSchema,
  BuildSchema,
  CharacterSchema,
  EquipmentInstanceSchema,
  type ResolvedValue,
  type RotationPlan,
  type CombatSkill,
  type PlayerArchive,
} from '@wwm/game-data';
import type { CombatRequest } from '@wwm/combat-engine';
// All numbers and rules in this fixture are synthetic, NEVER game data.
export const recorded = (
  value: number,
): Extract<ResolvedValue, { status: 'RECORDED' }> => ({
  status: 'RECORDED',
  value,
  gameVersionId: 'synthetic-damage-v1',
  sourceIds: ['synthetic-source'],
});
export function combatFixture(): CombatRequest & {
  release: ReturnType<typeof GameDataReleaseSchema.parse>;
} {
  const release = GameDataReleaseSchema.parse(structuredClone(base.release));
  const profile: CombatSkill = {
    castDurationMs: 100,
    cooldownMs: 1000,
    cooldownStart: 'CAST_START',
    cooldownGroupId: 'synthetic-skill',
    scaling: 'DYNAMIC',
    hitsPersistAfterSwitch: true,
    swordEnergyMode: 'NOT_USED',
    resourceChanges: [{ resourceId: 'energy', delta: recorded(-2) }],
    effects: [],
  };
  release.skills[0].combat = profile;
  release.skills[0].hits[0].offsetMs = 50;
  const p = release.formulas[0].parameters;
  p['normal-probability'] = recorded(1);
  p['critical-probability'] = recorded(0);
  p['insight-probability'] = recorded(0);
  p['miss-probability'] = recorded(0);
  p['normal-multiplier'] = recorded(1);
  p['damage-multiplier'] = recorded(1);
  p['enemy-multiplier'] = recorded(1);
  release.combat = {
    ruleVersion: 'synthetic-combat-1',
    evidence: {
      status: 'VERIFIED',
      sourceIds: ['synthetic-source'],
      modelVersion: 'synthetic-model-1',
      reviewedAt: base.evaluatedAt,
    },
    switchDurationMs: 100,
    swordEnergyResourceId: 'energy',
    resources: [{ id: 'energy', initial: recorded(10), maximum: recorded(10) }],
    buffs: [
      {
        id: 'boost',
        name: '合成增益',
        durationMs: 500,
        multiplier: recorded(2),
        reapply: 'REFRESH',
      },
    ],
    dots: [
      {
        id: 'burn',
        name: '合成DOT',
        durationMs: 350,
        intervalMs: 100,
        firstTickMs: 100,
        skillId: 'synthetic-skill',
        variantId: null,
        scaling: 'DYNAMIC',
        reapply: 'REPLACE',
      },
    ],
  };
  const plan: RotationPlan = {
    id: 'synthetic-plan',
    name: '合成循環（非遊戲規則）',
    gameVersionId: release.version.id,
    durationMs: 3000,
    initialMartialArtId: 'synthetic-sword',
    onlyExplicit: false,
    mode: 'FIXED',
    decisionIntervalMs: null,
    priorityRules: [],
    actions: [0, 1000, 2000].map((atMs) => ({
      atMs,
      action: { kind: 'CAST', skillId: 'synthetic-skill', variantId: null },
    })),
  };
  const build = BuildSchema.parse(structuredClone(base.build));
  build.martialArts.push({ id: 'synthetic-spear', level: 1 });
  return {
    release,
    build,
    character: CharacterSchema.parse(base.character),
    equipment: base.equipment.map((e) => EquipmentInstanceSchema.parse(e)),
    onlyExplicit: false,
    evaluatedAt: base.evaluatedAt,
    plan,
  };
}
export function utility(
  f: ReturnType<typeof combatFixture>,
  id: string,
  effects: CombatSkill['effects'],
) {
  const skill = structuredClone(f.release.skills[0]);
  skill.id = id;
  skill.name = '合成輔助 ' + id;
  skill.hits = [
    {
      id: 'utility-hit',
      offsetMs: 0,
      coefficient: recorded(0),
      flatDamage: recorded(0),
    },
  ];
  skill.combat = {
    ...skill.combat!,
    castDurationMs: 0,
    cooldownMs: 0,
    cooldownGroupId: id,
    resourceChanges: [],
    effects,
  };
  f.release.skills.push(skill);
  f.release.martialArts[0].skillIds.push(id);
  return { kind: 'CAST' as const, skillId: id, variantId: null };
}
export function combatArchive(): PlayerArchive {
  const f = combatFixture();
  f.build.rotation = f.plan;
  return {
    format: 'WWM_PLAYER_ARCHIVE',
    schemaVersion: '1.0.0',
    exportedAt: f.evaluatedAt,
    characters: [f.character],
    builds: [f.build],
    equipment: f.equipment,
    overrides: [],
    dataReleases: [f.release],
  };
}
