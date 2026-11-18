import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { optimize } from '@wwm/optimizer';
import { PlayerDatabase, PlayerRepository } from '../player/database';
import {
  optimizerArchive,
  optimizerFixture,
} from '../../../../packages/optimizer/src/test/fixtures';
describe('S13 result apply transaction', () => {
  it('saves a candidate as a new Build, preserves original and rejects stale or constraint-breaking changes', async () => {
    const db = new PlayerDatabase('s13-' + crypto.randomUUID()),
      repo = new PlayerRepository(db);
    try {
      const archive = optimizerArchive();
      await repo.importJson(archive);
      const request = optimizerFixture();
      request.combat.build = archive.builds[0];
      const best = optimize(request).top[0];
      const id = await repo.saveOptimizedBuild(request, best.equipmentIds);
      const state = await repo.snapshot();
      expect(state.builds.find((b) => b.id === archive.builds[0].id)).toEqual(
        archive.builds[0],
      );
      expect(state.builds.find((b) => b.id === id)!.equipmentIds).toEqual(
        best.equipmentIds,
      );
      expect(state.equipment).toHaveLength(4);
      await expect(
        repo.saveOptimizedBuild(
          { ...request, maximumCost: 0 },
          best.equipmentIds,
        ),
      ).rejects.toThrow('約束');
      const current = state.builds.find((b) => b.id === archive.builds[0].id)!;
      await repo.updateBuild({ ...current, notes: 'changed since search' });
      await expect(
        repo.saveOptimizedBuild(request, best.equipmentIds),
      ).rejects.toThrow('更新');
      expect((await repo.snapshot()).builds).toHaveLength(2);
      const backup = JSON.parse(await repo.exportJson());
      expect(
        backup.builds.find((b: { id: string }) => b.id === id).equipmentIds,
      ).toEqual(best.equipmentIds);
    } finally {
      await db.delete();
    }
  });
});
