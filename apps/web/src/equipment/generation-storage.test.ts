import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { generateIdealGear } from '@wwm/game-data';
import { PlayerDatabase, PlayerRepository } from '../player/database';
import { generationFixture } from '../../../../packages/game-data/src/test/generation-fixture';
describe('S12 unified generation storage', () => {
  it('stores generation audit in the same library and restores backup while revalidating', async () => {
    const db = new PlayerDatabase('s12-' + crypto.randomUUID()),
      repo = new PlayerRepository(db);
    const other = new PlayerDatabase('s12-restore-' + crypto.randomUUID()),
      restored = new PlayerRepository(other);
    try {
      const f = generationFixture();
      await db.dataReleases.put(f.release);
      const item = generateIdealGear(f).candidates[0];
      await repo.saveEquipment(item, []);
      const saved = (await repo.snapshot()).equipment[0];
      expect(saved.creationMethod).toBe('GENERATED');
      expect(saved.validation.status).toBe('VALID');
      await restored.importJson(await repo.exportJson());
      expect((await restored.snapshot()).equipment[0].generation).toEqual(
        saved.generation,
      );
      // Current data must win over a stale preview; no cached effective value is trusted.
      const changed = structuredClone(f.release);
      changed.affixCaps[0].maximum = {
        status: 'RECORDED',
        gameVersionId: changed.version.id,
        sourceIds: ['synthetic-source'],
        value: 90,
      };
      await db.dataReleases.put(changed);
      await repo.saveEquipment({ ...item, id: 'new-preview' }, []);
      expect(
        (await repo.snapshot()).equipment.find((e) => e.id === 'new-preview')!
          .affixes[0].effective.value,
      ).toBe(90);
    } finally {
      await db.delete();
      await other.delete();
    }
  });
});
