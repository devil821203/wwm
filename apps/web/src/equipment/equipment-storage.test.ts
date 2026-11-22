import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerDatabase, PlayerRepository } from '../player/database';
import { emptyEquipment } from './editor-model';
import type { EquipmentImage } from '@wwm/game-data';
let db: PlayerDatabase;
let repo: PlayerRepository;
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
beforeEach(() => {
  db = new PlayerDatabase('wwm-gear-test-' + crypto.randomUUID());
  repo = new PlayerRepository(db);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});
describe('equipment persistence', () => {
  it('creates, updates with history, copies and deletes one unified item', async () => {
    const item = emptyEquipment();
    await repo.saveEquipment(item, []);
    let state = await repo.snapshot();
    const first = state.equipment[0];
    await repo.saveEquipment({ ...first, name: '修改名稱' }, [], first);
    state = await repo.snapshot();
    expect(state.equipmentHistory).toHaveLength(1);
    expect(JSON.parse(state.equipmentHistory![0].previousJson).name).toBe(
      item.name,
    );
    const copy = await repo.copyEquipment(item.id);
    expect(
      (await repo.snapshot()).equipment.find((entry) => entry.id === copy)
        ?.derivedFromId,
    ).toBe(item.id);
    await repo.deleteEquipment(item.id);
    expect((await repo.snapshot()).equipment).toHaveLength(1);
  });
  it('preserves v1 characters during v2 migration', async () => {
    const name = db.name;
    db.close();
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      characters: '&id, name, pathId, gameVersionId',
      builds: '&id, characterId',
      equipment: '&id, gameVersionId',
      overrides: '&id, instanceId',
      dataReleases: '&version.id',
    });
    const at = new Date().toISOString();
    await legacy.table('characters').add({
      id: 'legacy',
      name: '舊角色',
      pathId: 'bellstrike_splendor',
      gameVersionId: null,
      level: null,
      realm: '',
      createdAt: at,
      updatedAt: at,
    });
    legacy.close();
    db = new PlayerDatabase(name);
    repo = new PlayerRepository(db);
    const state = await repo.snapshot();
    expect(state.characters[0].name).toBe('舊角色');
    expect(state.equipmentImages).toEqual([]);
  });
  it('round trips saved images and history in player JSON', async () => {
    const item = emptyEquipment();
    const image: EquipmentImage = {
      id: 'test-image',
      equipmentId: item.id,
      name: 'test.png',
      dataUrl: png,
      width: 1,
      height: 1,
      savedAt: new Date().toISOString(),
    };
    await repo.saveEquipment(item, [image]);
    const saved = (await repo.snapshot()).equipment[0];
    await repo.saveEquipment({ ...saved, name: 'Updated' }, [image], saved);
    const backup = await repo.exportJson();
    await repo.deleteEquipment(item.id);
    await repo.importJson(backup);
    const state = await repo.snapshot();
    expect(state.equipmentImages![0].dataUrl).toBe(png);
    expect(state.equipmentHistory).toHaveLength(1);
    db.close();
    db = new PlayerDatabase(db.name);
    repo = new PlayerRepository(db);
    expect((await repo.snapshot()).equipment).toHaveLength(1);
  });
  it('rolls back image writes if equipment persistence fails', async () => {
    const item = emptyEquipment();
    const image: EquipmentImage = {
      id: 'test-image',
      equipmentId: item.id,
      name: 'test.png',
      dataUrl: png,
      width: 1,
      height: 1,
      savedAt: new Date().toISOString(),
    };
    vi.spyOn(db.equipment, 'bulkPut').mockRejectedValueOnce(
      new Error('Simulated quota failure'),
    );
    await expect(repo.saveEquipment(item, [image])).rejects.toThrow();
    expect((await repo.snapshot()).equipmentImages).toEqual([]);
  });
  it('rejects stale saves rather than overwriting newer equipment', async () => {
    const item = emptyEquipment();
    await repo.saveEquipment(item, []);
    const first = (await repo.snapshot()).equipment[0];
    await repo.saveEquipment({ ...first, name: 'New' }, [], first);
    await expect(
      repo.saveEquipment({ ...first, name: 'Stale' }, [], first),
    ).rejects.toThrow('其他頁面');
  });
  it('equips an item without requiring a game version', async () => {
    const characterId = await repo.createCharacter({
      name: 'test',
      pathId: 'bellstrike_splendor',
      gameVersionId: null,
      level: null,
      realm: '',
    });
    const item = emptyEquipment();
    await repo.saveEquipment({ ...item, slotId: 'weapon' }, []);
    const build = (await repo.snapshot()).builds.find(
      (entry) => entry.characterId === characterId,
    )!;
    await repo.assignEquipment(build.id, item.id);
    expect(
      (await repo.snapshot()).builds.find((entry) => entry.id === build.id)
        ?.equipmentIds,
    ).toContain(item.id);
  });
});

it('replaces the same slot and detaches references on equipment deletion', async () => {
  const state = await repo.snapshot();
  state.dataReleases.push({
    schemaVersion: '1.0.0',
    purpose: 'SYNTHETIC_TEST',
    version: {
      id: 'synthetic-gear',
      region: 'GLOBAL',
      label: 'Synthetic only',
      availableLevels: [],
      levelCap: null,
    },
    paths: [
      {
        id: 'synthetic-path',
        gameVersionId: 'synthetic-gear',
        zhTW: '測試',
        en: 'Synthetic',
        martialArts: ['A', 'B'],
        role: 'DPS',
        mechanicsHint: [],
        translationVerified: false,
        formulaStatus: 'UNKNOWN',
        martialArtIds: [],
        formulaIds: [],
      },
    ],
    martialArts: [],
    stats: [],
    sources: [],
    formulas: [],
    skills: [],
    equipment: [],
    affixes: [],
    affixCaps: [],
  });
  await repo.importJson(state);
  const characterId = await repo.createCharacter({
    name: 'Synthetic',
    pathId: 'synthetic-path',
    gameVersionId: 'synthetic-gear',
    level: null,
    realm: '',
  });
  const item = {
    ...emptyEquipment(),
    gameVersionId: 'synthetic-gear',
    slotId: 'weapon',
  };
  await repo.saveEquipment(item, []);
  const second = await repo.copyEquipment(item.id);
  const build = (await repo.snapshot()).builds.find(
    (entry) => entry.characterId === characterId,
  )!;
  await repo.assignEquipment(build.id, item.id);
  await repo.assignEquipment(build.id, second);
  expect(
    (await repo.snapshot()).builds.find((entry) => entry.id === build.id)!
      .equipmentIds,
  ).toEqual([second]);
  await repo.deleteEquipment(second);
  const after = await repo.snapshot();
  expect(
    after.builds.find((entry) => entry.id === build.id)!.equipmentIds,
  ).toEqual([]);
  expect(after.equipment.some((entry) => entry.id === item.id)).toBe(true);
});

it('recalculates S07 values at save and preserves original input through backup/history', async () => {
  const { rulesFixture, manual } =
    await import('../../../../packages/game-data/src/test/equipment-rules-fixture');
  const f = rulesFixture();
  await db.dataReleases.add(f.release);
  f.item.affixes[0].current = manual(85);
  f.item.affixes[0].valueMode = 'MAX';
  f.item.affixes[0].maxOnChengYinConfirmed = true;
  await repo.saveEquipment(f.item, []);
  let saved = (await repo.snapshot()).equipment[0];
  expect(saved.affixes[0].effective.value).toBe(100);
  expect(saved.affixes[0].current.value).toBe(85);
  expect(saved.validation.status).toBe('VALID');
  await repo.saveEquipment(
    {
      ...saved,
      affixes: saved.affixes.map((a) => ({ ...a, valueMode: 'MANUAL' })),
    },
    [],
    saved,
  );
  saved = (await repo.snapshot()).equipment[0];
  expect(saved.affixes[0].effective.value).toBe(85);
  const backup = await repo.exportJson();
  await repo.deleteEquipment(saved.id);
  await repo.importJson(backup);
  expect((await repo.snapshot()).equipment[0].affixes[0].current.value).toBe(
    85,
  );
  expect((await repo.snapshot()).equipmentHistory).toHaveLength(1);
});
