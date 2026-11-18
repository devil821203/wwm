import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerDatabase, PlayerRepository } from './database';

let db: PlayerDatabase;
let repository: PlayerRepository;
const input = {
  name: '測試俠客',
  pathId: 'bellstrike_splendor',
  gameVersionId: null,
  level: null,
  realm: '手動備註',
};
beforeEach(() => {
  db = new PlayerDatabase('wwm-test-' + crypto.randomUUID());
  repository = new PlayerRepository(db);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

describe('IndexedDB character and Build lifecycle', () => {
  it('creates character plus default Build, updates and deletes atomically', async () => {
    const id = await repository.createCharacter(input);
    let state = await repository.snapshot();
    expect(state.characters[0]).toMatchObject({ ...input, id });
    expect(state.builds).toHaveLength(1);
    const original = state.characters[0];
    await repository.updateCharacter({
      ...original,
      name: '更名俠客',
      realm: '新備註',
    });
    state = await repository.snapshot();
    expect(state.characters[0].name).toBe('更名俠客');
    expect(state.characters[0].updatedAt).not.toBe(original.updatedAt);
    await repository.deleteCharacter(id);
    state = await repository.snapshot();
    expect(state.characters).toEqual([]);
    expect(state.builds).toEqual([]);
  });
  it('copies, edits and deletes a Build independently', async () => {
    const id = await repository.createCharacter(input);
    const buildId = await repository.createBuild(id, '第二配置');
    let state = await repository.snapshot();
    const original = state.builds.find((build) => build.id === buildId)!;
    await repository.updateBuild({
      ...original,
      name: '測試配裝',
      panelMode: 'EQUIPMENT_INCLUDED',
      notes: '不要重複加總裝備',
    });
    const copyId = await repository.copyBuild(buildId);
    state = await repository.snapshot();
    expect(state.builds.find((build) => build.id === copyId)).toMatchObject({
      name: '測試配裝 副本',
      panelMode: 'EQUIPMENT_INCLUDED',
      notes: '不要重複加總裝備',
    });
    await repository.deleteBuild(buildId);
    expect(
      (await repository.snapshot()).builds.some((build) => build.id === copyId),
    ).toBe(true);
  });
  it('restores the same database after closing and reopening', async () => {
    await repository.createCharacter(input);
    const name = db.name;
    db.close();
    db = new PlayerDatabase(name);
    repository = new PlayerRepository(db);
    expect((await repository.snapshot()).characters[0].name).toBe(input.name);
  });
  it('rolls back both tables if Build write fails', async () => {
    vi.spyOn(db.builds, 'bulkPut').mockRejectedValueOnce(
      new Error('Simulated write failure'),
    );
    await expect(repository.createCharacter(input)).rejects.toThrow(
      'Simulated write failure',
    );
    expect((await repository.snapshot()).characters).toEqual([]);
  });
  it('does not store invalid names, orphan builds or draft levels', async () => {
    await expect(
      repository.createCharacter({ ...input, name: '  ' }),
    ).rejects.toThrow();
    await expect(
      repository.createCharacter({ ...input, level: 1 }),
    ).rejects.toThrow();
    await expect(
      repository.createBuild('missing', '無主配置'),
    ).rejects.toThrow();
    expect((await repository.snapshot()).builds).toEqual([]);
  });
  it('rejects stale edits and preserves immutable character context', async () => {
    await repository.createCharacter(input);
    const first = (await repository.snapshot()).characters[0];
    await repository.updateCharacter({ ...first, name: '新名字' });
    await expect(
      repository.updateCharacter({ ...first, name: '過期內容' }),
    ).rejects.toThrow('其他頁面');
    const latest = (await repository.snapshot()).characters[0];
    await expect(
      repository.updateCharacter({ ...latest, pathId: 'bellstrike_umbra' }),
    ).rejects.toThrow('不能直接變更');
    expect((await repository.snapshot()).characters[0].name).toBe('新名字');
  });
});

describe('JSON backup and atomic merge', () => {
  it('round trips into another IndexedDB without losing configuration', async () => {
    await repository.createCharacter(input);
    const first = (await repository.snapshot()).builds[0];
    await repository.updateBuild({
      ...first,
      notes: '保存備註',
      panelMode: 'BASE_ONLY',
    });
    const json = await repository.exportJson();
    const other = new PlayerDatabase('wwm-other-' + crypto.randomUUID());
    try {
      const target = new PlayerRepository(other);
      await target.importJson(json);
      expect((await target.snapshot()).characters[0].name).toBe(input.name);
      expect((await target.snapshot()).builds[0]).toMatchObject({
        notes: '保存備註',
        panelMode: 'BASE_ONLY',
      });
      await target.importJson(json);
      expect((await target.snapshot()).characters).toHaveLength(1);
    } finally {
      await other.delete();
    }
  });
  it('rejects ID conflicts as a whole without partially adding data', async () => {
    await repository.createCharacter(input);
    const state = await repository.snapshot();
    const imported = structuredClone(state);
    imported.characters.unshift({
      ...state.characters[0],
      id: 'new-character',
    });
    imported.characters[1].name = '同ID不同內容';
    await expect(repository.importJson(imported)).rejects.toThrow('ID 衝突');
    expect((await repository.snapshot()).characters).toEqual(state.characters);
  });
  it('rejects malformed or unsupported backup and preserves stored data', async () => {
    await repository.createCharacter(input);
    await expect(repository.importJson('{')).rejects.toThrow();
    await expect(repository.importJson({ format: 'wrong' })).rejects.toThrow();
    expect((await repository.snapshot()).characters).toHaveLength(1);
  });
});
