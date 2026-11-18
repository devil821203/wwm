import { describe, expect, it } from 'vitest';
import {
  PlayerArchiveSchema,
  parsePlayerArchive,
  type PlayerArchive,
} from './player-schemas.js';
import {
  releaseFixture,
  equipmentFixture,
  recorded,
  testTime,
  testVersion,
} from './test/fixtures.js';

function archive(): PlayerArchive {
  return {
    format: 'WWM_PLAYER_ARCHIVE',
    schemaVersion: '1.0.0',
    exportedAt: testTime,
    characters: [
      {
        id: 'synthetic-character',
        name: '測試角色',
        pathId: 'synthetic-path',
        gameVersionId: testVersion,
        level: 3,
        realm: '',
        createdAt: testTime,
        updatedAt: testTime,
      },
    ],
    builds: [
      {
        id: 'synthetic-build',
        characterId: 'synthetic-character',
        name: '測試配置',
        panelMode: 'EQUIPMENT_INCLUDED',
        stats: [{ statId: 'synthetic-attack', value: recorded(0) }],
        equipmentIds: ['synthetic-instance'],
        martialArts: [{ id: 'synthetic-sword', level: null }],
        innerWays: [],
        mysticSkillIds: [],
        talentIds: [],
        notes: '',
        createdAt: testTime,
        updatedAt: testTime,
      },
    ],
    equipment: [equipmentFixture()],
    overrides: [],
    dataReleases: [releaseFixture()],
  };
}
describe('player backup schema', () => {
  it('round trips provenance, zero, panel mode, inventory and version references', () => {
    const data = archive();
    expect(parsePlayerArchive(JSON.stringify(data))).toEqual(data);
    expect(data.builds[0].stats[0].value.value).toBe(0);
  });
  it('supports a draft with unknown version/level without synthesizing game data', () => {
    const data = archive();
    data.dataReleases = [];
    data.equipment = [];
    data.builds = [];
    data.characters[0].gameVersionId = null;
    data.characters[0].level = null;
    expect(PlayerArchiveSchema.parse(data).characters[0].level).toBeNull();
    data.characters[0].level = 1;
    expect(PlayerArchiveSchema.safeParse(data).success).toBe(false);
  });
  const invalid: [string, (data: PlayerArchive) => void][] = [
    [
      'missing character',
      (data) => {
        data.characters = [];
      },
    ],
    [
      'duplicate character',
      (data) => {
        data.characters.push(structuredClone(data.characters[0]));
      },
    ],
    [
      'missing data version',
      (data) => {
        data.dataReleases = [];
      },
    ],
    [
      'missing path',
      (data) => {
        data.characters[0].pathId = 'missing';
      },
    ],
    [
      'non-legal sparse level',
      (data) => {
        data.characters[0].level = 2;
      },
    ],
    [
      'missing equipment',
      (data) => {
        data.equipment = [];
      },
    ],
    [
      'cross-version equipment',
      (data) => {
        data.equipment[0].gameVersionId = 'other-version';
        data.equipment[0].affixes = [];
      },
    ],
    [
      'cross-version panel',
      (data) => {
        data.builds[0].stats[0].value = recorded(0, 'other-version');
      },
    ],
    [
      'missing stat',
      (data) => {
        data.builds[0].stats[0].statId = 'missing';
      },
    ],
    [
      'wrong-path martial art',
      (data) => {
        data.builds[0].martialArts[0].id = 'missing';
      },
    ],
    [
      'duplicate equipment reference',
      (data) => {
        data.builds[0].equipmentIds.push('synthetic-instance');
      },
    ],
    [
      'duplicate panel stat',
      (data) => {
        data.builds[0].stats.push(structuredClone(data.builds[0].stats[0]));
      },
    ],
  ];
  it.each(invalid)('rejects %s', (_name, mutate) => {
    const data = archive();
    mutate(data);
    expect(PlayerArchiveSchema.safeParse(data).success).toBe(false);
  });
  it('rejects unsupported schema and obsolete owned/virtual split', () => {
    expect(() =>
      parsePlayerArchive({ ...archive(), schemaVersion: '99' }),
    ).toThrow();
    expect(() =>
      parsePlayerArchive({
        ...archive(),
        ownedEquipment: [],
        virtualEquipment: [],
      }),
    ).toThrow();
  });
});
