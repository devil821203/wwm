import type {
  GameDataRelease,
  ResolvedValue,
  PlayerArchive,
} from '@wwm/game-data';
import type { DamageRequest } from '../damage.js';
export const syntheticVersion = 'synthetic-damage-v1';
export const syntheticTime = '2026-11-17T00:00:00+08:00';
export const recorded = (value: number): ResolvedValue => ({
  gameVersionId: syntheticVersion,
  status: 'RECORDED',
  value,
  sourceIds: ['synthetic-source'],
});
export const unknown = (): ResolvedValue => ({
  gameVersionId: syntheticVersion,
  status: 'UNKNOWN',
  value: null,
  reason: '合成fixture缺值',
});
export const estimated = (value: number): ResolvedValue => ({
  gameVersionId: syntheticVersion,
  status: 'ESTIMATED',
  value,
  sourceIds: ['synthetic-source'],
  formulaId: 'synthetic-formula',
  modelVersion: 'synthetic-estimate-1',
  estimatedAt: syntheticTime,
  inputs: { anchor: value },
});
// All numbers are invented fixtures for software verification, NEVER game data.
export function damageFixture(): DamageRequest & { release: GameDataRelease } {
  const gameVersionId = syntheticVersion;
  const release: GameDataRelease = {
    schemaVersion: '1.0.0',
    purpose: 'SYNTHETIC_TEST',
    version: {
      id: gameVersionId,
      region: 'GLOBAL',
      label: '合成傷害fixture，非遊戲資料',
      availableLevels: [3, 7],
      levelCap: 7,
    },
    sources: [
      {
        id: 'synthetic-source',
        gameVersionId,
        region: 'GLOBAL',
        title: 'Synthetic only',
        url: 'https://example.invalid/synthetic-damage',
        retrievedAt: syntheticTime,
        rawHash: '0'.repeat(64),
        licenseStatus: 'MANUAL_ONLY',
        confidence: 'UNKNOWN',
      },
    ],
    paths: [
      {
        id: 'bellstrike_splendor',
        gameVersionId,
        zhTW: '鳴金·虹（合成測試）',
        en: 'Synthetic path',
        martialArts: ['Synthetic sword', 'Synthetic spear'],
        martialArtIds: ['synthetic-sword', 'synthetic-spear'],
        formulaIds: ['synthetic-formula'],
        role: 'DPS',
        mechanicsHint: [],
        translationVerified: false,
        formulaStatus: 'VERIFIED',
      },
    ],
    martialArts: [
      {
        id: 'synthetic-sword',
        gameVersionId,
        name: 'Synthetic sword',
        translationVerified: false,
        skillIds: ['synthetic-skill'],
      },
      {
        id: 'synthetic-spear',
        gameVersionId,
        name: 'Synthetic spear',
        translationVerified: false,
        skillIds: [],
      },
    ],
    stats: [
      {
        id: 'attack',
        gameVersionId,
        name: '合成攻擊',
        unit: 'points',
        description: 'Not a game stat',
      },
      {
        id: 'unused',
        gameVersionId,
        name: '未使用屬性',
        unit: 'points',
        description: 'Not used by this fixture formula',
      },
    ],
    formulas: [
      {
        id: 'synthetic-formula',
        gameVersionId,
        implementationId: 'weighted-hit-v1',
        formulaVersion: 'synthetic-1',
        statBindings: { attack: 'attack' },
        evidence: {
          status: 'VERIFIED',
          sourceIds: ['synthetic-source'],
          modelVersion: 'synthetic-proof-1',
          reviewedAt: syntheticTime,
        },
        parameters: {
          'normal-probability': recorded(0.6),
          'critical-probability': recorded(0.25),
          'insight-probability': recorded(0.1),
          'miss-probability': recorded(0.05),
          'normal-multiplier': recorded(1),
          'critical-multiplier': recorded(1.5),
          'insight-multiplier': recorded(2),
          'damage-multiplier': recorded(1.2),
          'enemy-multiplier': recorded(0.5),
        },
      },
    ],
    skills: [
      {
        id: 'synthetic-skill',
        gameVersionId,
        name: '合成單技能（非遊戲係數）',
        martialArtId: 'synthetic-sword',
        formulaId: 'synthetic-formula',
        cooldownMs: null,
        castTimeMs: null,
        applicability: { characterLevels: [3, 7], martialArtLevels: [1] },
        hits: [
          {
            id: 'hit-a',
            offsetMs: 0,
            coefficient: recorded(2),
            flatDamage: recorded(10),
          },
        ],
      },
    ],
    equipment: [
      {
        id: 'synthetic-equipment',
        gameVersionId,
        name: '合成紫裝',
        slotId: 'weapon',
        tierId: 'tier-a',
        quality: 'purple',
        requiredLevel: 3,
        baseStats: [{ statId: 'attack', value: recorded(80) }],
        allowedAffixIds: ['attack-affix', 'unused-affix'],
        legality: {
          ruleVersion: 'synthetic-rules-1',
          verified: true,
          sourceIds: ['synthetic-source'],
          minAffixes: 1,
          maxAffixes: 2,
          tuningStages: [0],
          exclusionGroups: [],
        },
      },
    ],
    affixes: [
      { id: 'attack-affix', gameVersionId, name: '合成詞條', statId: 'attack' },
      {
        id: 'unused-affix',
        gameVersionId,
        name: '未使用詞條',
        statId: 'unused',
      },
    ],
    affixCaps: [
      {
        id: 'attack-cap',
        gameVersionId,
        tierId: 'tier-a',
        quality: 'purple',
        affixId: 'attack-affix',
        tuningStage: 0,
        minimum: recorded(0),
        maximum: recorded(100),
        chengYinValue: recorded(94),
        unit: 'points',
        step: 1,
        roundingRule: 'ROUND',
        precisionVerified: true,
        chengYinModel: {
          formulaId: 'synthetic-formula',
          modelVersion: 'synthetic-ratio-1',
          registeredAt: syntheticTime,
          ratio: 0.94,
          sourceIds: ['synthetic-source'],
          precision: 0,
          precisionVerified: true,
        },
      },
    ],
  };
  return {
    release,
    character: {
      id: 'synthetic-character',
      name: '合成角色',
      gameVersionId,
      pathId: 'bellstrike_splendor',
      level: 3,
      realm: '',
      createdAt: syntheticTime,
      updatedAt: syntheticTime,
    },
    build: {
      id: 'synthetic-build',
      characterId: 'synthetic-character',
      name: '合成配置',
      panelMode: 'BASE_ONLY',
      stats: [{ statId: 'attack', value: recorded(100) }],
      equipmentIds: ['synthetic-instance'],
      martialArts: [{ id: 'synthetic-sword', level: 1 }],
      innerWays: [],
      mysticSkillIds: [],
      talentIds: [],
      notes: 'Synthetic only',
      createdAt: syntheticTime,
      updatedAt: syntheticTime,
    },
    equipment: [
      {
        id: 'synthetic-instance',
        name: '合成裝備',
        gameVersionId,
        definitionId: 'synthetic-equipment',
        slotId: 'weapon',
        tierId: 'tier-a',
        quality: 'purple',
        isChengYin: true,
        tuningStage: 0,
        creationMethod: 'MANUAL',
        evidenceIds: [],
        baseStats: [],
        affixes: [
          {
            affixId: 'attack-affix',
            valueMode: 'CHENG_YIN',
            current: unknown(),
            effective: unknown(),
            maximum: unknown(),
          },
        ],
        validation: { status: 'UNVERIFIED', reasons: ['Synthetic fixture'] },
      },
    ],
    skillId: 'synthetic-skill',
    onlyExplicit: false,
    evaluatedAt: syntheticTime,
  };
}
export function damageArchive(): PlayerArchive {
  const f = damageFixture();
  return {
    format: 'WWM_PLAYER_ARCHIVE',
    schemaVersion: '1.0.0',
    exportedAt: syntheticTime,
    characters: [f.character],
    builds: [f.build],
    equipment: f.equipment,
    overrides: [],
    dataReleases: [f.release],
  };
}

export function variantFixture() {
  const f = damageFixture();
  const skill = f.release.skills[0];
  skill.variants = [
    {
      id: 'normal',
      name: '合成普通變體',
      applicability: structuredClone(skill.applicability!),
      chargeMs: 0,
      requiredStateIds: [],
      swordEnergy: recorded(0),
      hits: structuredClone(skill.hits),
      events: [
        {
          id: 'switch',
          kind: 'WEAPON_SWITCH',
          offsetMs: 200,
          targetMartialArtId: 'synthetic-spear',
          stateId: null,
          amount: recorded(0),
        },
      ],
    },
    {
      id: 'charged',
      name: '合成蓄力變體',
      applicability: structuredClone(skill.applicability!),
      chargeMs: 1000,
      requiredStateIds: ['synthetic-buff'],
      swordEnergy: recorded(1),
      hits: [
        {
          id: 'charged-hit',
          offsetMs: 1000,
          coefficient: recorded(3),
          flatDamage: recorded(10),
        },
      ],
      events: [
        {
          id: 'state',
          kind: 'STATE_APPLY',
          offsetMs: 0,
          targetMartialArtId: null,
          stateId: 'synthetic-buff',
          amount: recorded(0),
        },
      ],
    },
  ];
  skill.hits[0].coefficient = unknown();
  return { ...f, variantId: 'normal' };
}
export function measurementFixture(): import('@wwm/game-data').Measurement {
  const f = variantFixture();
  return {
    id: 'synthetic-measurement',
    label: '合成單技能觀察（非遊戲實測）',
    purpose: 'SYNTHETIC_TEST',
    kind: 'SINGLE_SKILL',
    recordedAt: syntheticTime,
    snapshot: {
      character: f.character,
      build: f.build,
      equipment: f.equipment,
      release: f.release,
      onlyExplicit: false,
      evaluatedAt: syntheticTime,
    },
    skillId: f.skillId,
    variantId: f.variantId,
    enemy: {
      name: '合成敵人',
      level: 3,
      conditions: 'Synthetic enemy multiplier .5',
    },
    conditions: 'Synthetic fixed panel and full casts',
    sampling: 'UNFILTERED_CAST_TOTAL',
    durationMs: null,
    samples: [390, 396, 394],
    evidence: [
      {
        kind: 'TEXT',
        reference: 'Synthetic test observations, not game measurements',
      },
    ],
    comparisonContextConfirmed: true,
    confirmed: true,
    status: 'OBSERVATION_ONLY',
  };
}
