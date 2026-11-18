import type {
  EquipmentInstance,
  GameDataRelease,
  ResolvedValue,
} from '../schemas.js';

// All IDs, levels, numbers and sources in this file are synthetic test data.
export const testVersion = 'synthetic-v1';
export const testTime = '2026-11-17T00:00:00+08:00';
export const recorded = (
  value: number,
  gameVersionId = testVersion,
): ResolvedValue => ({
  status: 'RECORDED',
  value,
  gameVersionId,
  sourceIds: ['synthetic-source'],
});
export const unknown = (gameVersionId = testVersion): ResolvedValue => ({
  status: 'UNKNOWN',
  value: null,
  gameVersionId,
  reason: 'Synthetic fixture: not measured',
});
export function releaseFixture(gameVersionId = testVersion): GameDataRelease {
  return {
    schemaVersion: '1.0.0',
    purpose: 'SYNTHETIC_TEST',
    version: {
      id: gameVersionId,
      region: 'GLOBAL',
      label: 'Synthetic fixture only',
      availableLevels: [1, 3, 7],
      levelCap: 7,
    },
    sources: [
      {
        id: 'synthetic-source',
        gameVersionId,
        region: 'GLOBAL',
        title: 'Not game data',
        url: 'https://example.invalid/synthetic',
        retrievedAt: testTime,
        rawHash: '0'.repeat(64),
        licenseStatus: 'MANUAL_ONLY',
        confidence: 'UNKNOWN',
      },
    ],
    paths: [
      {
        id: 'synthetic-path',
        gameVersionId,
        zhTW: '合成測試流派',
        en: 'Synthetic path',
        martialArts: ['Synthetic sword', 'Synthetic spear'],
        martialArtIds: ['synthetic-sword', 'synthetic-spear'],
        formulaIds: [],
        role: 'DPS',
        mechanicsHint: [],
        translationVerified: false,
        formulaStatus: 'UNKNOWN',
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
        id: 'synthetic-attack',
        gameVersionId,
        name: 'Synthetic attack',
        unit: 'points',
        description: 'Not a real game stat',
      },
    ],
    formulas: [
      {
        id: 'synthetic-formula',
        gameVersionId,
        implementationId: 'synthetic-only',
        formulaVersion: 'test-1',
        parameters: { zero: recorded(0, gameVersionId) },
      },
    ],
    skills: [
      {
        id: 'synthetic-skill',
        gameVersionId,
        name: 'Synthetic skill',
        martialArtId: 'synthetic-sword',
        formulaId: null,
        cooldownMs: null,
        castTimeMs: 0,
        hits: [
          {
            id: 'synthetic-hit',
            offsetMs: 0,
            coefficient: unknown(gameVersionId),
            flatDamage: recorded(0, gameVersionId),
          },
        ],
      },
    ],
    equipment: [
      {
        id: 'synthetic-equipment',
        gameVersionId,
        name: 'Synthetic item',
        slotId: 'synthetic-slot',
        tierId: 'synthetic-tier',
        quality: 'synthetic-purple',
        requiredLevel: 3,
        baseStats: [
          { statId: 'synthetic-attack', value: recorded(0, gameVersionId) },
        ],
        allowedAffixIds: ['synthetic-affix'],
      },
    ],
    affixes: [
      {
        id: 'synthetic-affix',
        gameVersionId,
        statId: 'synthetic-attack',
        name: 'Synthetic affix',
      },
    ],
    affixCaps: [
      {
        id: 'synthetic-cap',
        gameVersionId,
        tierId: 'synthetic-tier',
        quality: 'synthetic-purple',
        affixId: 'synthetic-affix',
        tuningStage: null,
        maximum: unknown(gameVersionId),
        chengYinValue: unknown(gameVersionId),
        unit: 'points',
        step: null,
        roundingRule: null,
      },
    ],
  };
}
export function equipmentFixture(): EquipmentInstance {
  return {
    id: 'synthetic-instance',
    gameVersionId: testVersion,
    tierId: 'synthetic-tier',
    quality: 'synthetic-purple',
    isChengYin: true,
    tuningStage: null,
    creationMethod: 'MANUAL',
    evidenceIds: [],
    baseStats: [],
    affixes: [
      {
        affixId: 'synthetic-affix',
        valueMode: 'MANUAL',
        current: recorded(0),
        effective: recorded(0),
        maximum: unknown(),
      },
    ],
    validation: { status: 'UNVERIFIED', reasons: ['Synthetic draft only'] },
  };
}
