import { describe, expect, it } from 'vitest';
import {
  ModularDataManifestSchema,
  PlayerLoadoutSnapshotSchema,
  VersionedCalculationReferenceSchema,
} from './version-contracts.js';

const at = '2026-11-27T00:00:00Z';
const moduleRecord = {
  sourceSnapshotIds: ['snapshot-1'],
  status: 'CANDIDATE',
  notes: [],
};
const manifest = {
  id: 'package-1',
  gameVersion: '1.0.334.64785',
  createdAt: at,
  sources: [
    {
      id: 'snapshot-1',
      sourceId: 'community',
      location: 'manual',
      revision: 'commit-1',
      acquiredAt: at,
      publishedAt: null,
      sha256: 'a'.repeat(64),
      license: 'UNVERIFIED',
      language: null,
      region: null,
      claimedGameVersion: null,
      assumedGameVersion: '1.0.334.64785',
    },
  ],
  modules: {
    equipment: moduleRecord,
    character: moduleRecord,
    innerWays: moduleRecord,
    other: moduleRecord,
  },
};
const archive = {
  format: 'WWM_PLAYER_ARCHIVE',
  schemaVersion: '1.0.0',
  exportedAt: at,
  characters: [
    {
      id: 'character-1',
      name: '角色',
      pathId: 'splendor',
      gameVersionId: null,
      level: null,
      realm: '',
      createdAt: at,
      updatedAt: at,
    },
  ],
  builds: [
    {
      id: 'build-1',
      characterId: 'character-1',
      name: '配置',
      panelMode: 'UNKNOWN',
      stats: [],
      equipmentIds: [],
      martialArts: [],
      innerWays: [],
      mysticSkillIds: [],
      talentIds: [],
      notes: '',
      createdAt: at,
      updatedAt: at,
    },
  ],
  equipment: [],
  overrides: [],
  dataReleases: [],
};

describe('source and player version contracts', () => {
  it('keeps unknown source version separate from the assumed game version', () => {
    const result = ModularDataManifestSchema.parse(manifest);
    expect(result.sources[0].claimedGameVersion).toBeNull();
    expect(result.sources[0].assumedGameVersion).toBe('1.0.334.64785');
  });
  it('requires four modules and rejects missing source references', () => {
    expect(
      ModularDataManifestSchema.safeParse({
        ...manifest,
        modules: {
          ...manifest.modules,
          other: { ...moduleRecord, sourceSnapshotIds: ['missing'] },
        },
      }).success,
    ).toBe(false);
    const partial = {
      equipment: moduleRecord,
      character: moduleRecord,
      innerWays: moduleRecord,
    };
    expect(
      ModularDataManifestSchema.safeParse({ ...manifest, modules: partial })
        .success,
    ).toBe(false);
  });
  it('rejects a reviewed module with no evidence', () => {
    expect(
      ModularDataManifestSchema.safeParse({
        ...manifest,
        modules: {
          ...manifest.modules,
          equipment: { sourceSnapshotIds: [], status: 'REVIEWED', notes: [] },
        },
      }).success,
    ).toBe(false);
  });
  it('binds a player revision to a build belonging to that character', () => {
    const snapshot = {
      id: 'player-1',
      capturedAt: at,
      origin: 'IMPORT',
      claimedGameVersion: null,
      characterId: 'character-1',
      buildId: 'build-1',
      archive,
    };
    expect(PlayerLoadoutSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(
      PlayerLoadoutSnapshotSchema.safeParse({ ...snapshot, buildId: 'missing' })
        .success,
    ).toBe(false);
  });
  it('records independent snapshot and data package references', () => {
    expect(
      VersionedCalculationReferenceSchema.parse({
        id: 'calc-1',
        playerSnapshotId: 'player-1',
        dataManifestId: 'package-1',
        formulaVersion: 'draft',
        calculatedAt: at,
        containsEstimates: true,
        blockingUnknowns: ['formula'],
      }).blockingUnknowns,
    ).toEqual(['formula']);
  });
});
