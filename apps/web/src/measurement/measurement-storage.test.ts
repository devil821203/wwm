import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlayerDatabase, PlayerRepository } from '../player/database';
import { measurementFixture } from '../../../../packages/stat-engine/src/test/fixtures';
let db: PlayerDatabase;
let repo: PlayerRepository;
beforeEach(() => {
  db = new PlayerDatabase('measurement-test-' + crypto.randomUUID());
  repo = new PlayerRepository(db);
});
afterEach(async () => {
  await db.delete();
});
describe('S09 measurement persistence', () => {
  it('round trips a self-contained snapshot without requiring the original character and rejects overwrite', async () => {
    const m = measurementFixture();
    await repo.saveMeasurement(m);
    await expect(
      repo.saveMeasurement({ ...m, label: 'overwrite' }),
    ).rejects.toThrow('不可變');
    expect((await repo.snapshot()).measurements?.[0]).toEqual(m);
    const backup = await repo.exportJson();
    await repo.deleteMeasurement(m.id);
    await repo.importJson(backup);
    expect((await repo.snapshot()).measurements?.[0]).toEqual(m);
    db.close();
    db = new PlayerDatabase(db.name);
    repo = new PlayerRepository(db);
    expect((await repo.snapshot()).measurements).toHaveLength(1);
  });
  it('rejects conflicting backup atomically', async () => {
    const m = measurementFixture();
    await repo.saveMeasurement(m);
    const backup = JSON.parse(await repo.exportJson());
    backup.measurements[0].samples = [999];
    await expect(repo.importJson(backup)).rejects.toThrow('ID 衝突');
    expect((await repo.snapshot()).measurements?.[0].samples).toEqual(
      m.samples,
    );
  });
  it('upgrades v2 equipment/history stores to v3 without deleting old records', async () => {
    const name = db.name;
    db.close();
    const old = new Dexie(name);
    old.version(1).stores({
      characters: '&id',
      builds: '&id',
      equipment: '&id',
      overrides: '&id',
      dataReleases: '&version.id',
    });
    old.version(2).stores({ equipmentImages: '&id', equipmentHistory: '&id' });
    const m = measurementFixture();
    await old.table('dataReleases').add(m.snapshot.release);
    await old.table('characters').add(m.snapshot.character);
    await old.table('builds').add(m.snapshot.build);
    await old.table('equipment').bulkAdd(m.snapshot.equipment);
    old.close();
    db = new PlayerDatabase(name);
    repo = new PlayerRepository(db);
    const state = await repo.snapshot();
    expect(state.characters[0].id).toBe(m.snapshot.character.id);
    expect(state.equipment).toHaveLength(1);
    expect(state.measurements).toEqual([]);
  });
});
