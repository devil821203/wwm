import { describe, it, expect } from 'vitest';
import { aggregateStats } from './aggregate.js';
import { damageFixture, recorded } from './test/fixtures.js';
import { GameDataReleaseSchema } from '@wwm/game-data';
describe('S13 versioned static set bonuses', () => {
  it('adds each reached threshold once and preserves sources without double counting an inclusive panel', () => {
    const f = damageFixture();
    const before = aggregateStats(f).stats.attack.value!;
    f.release.equipmentSets = [
      {
        id: 'synthetic-set',
        gameVersionId: f.release.version.id,
        name: '合成套裝',
        verified: true,
        sourceIds: ['synthetic-source'],
        bonuses: [
          { pieces: 1, stats: [{ statId: 'attack', value: recorded(10) }] },
          { pieces: 2, stats: [{ statId: 'attack', value: recorded(100) }] },
        ],
      },
    ];
    f.release.equipment[0].setId = 'synthetic-set';
    const result = aggregateStats(f);
    expect(result.stats.attack.value).toBe(before + 10);
    expect(
      result.stats.attack.dependencies['set:synthetic-set:1:attack'].value,
    ).toBe(10);
    f.build.panelMode = 'EQUIPMENT_INCLUDED';
    expect(aggregateStats(f).stats.attack.value).toBe(
      f.build.stats.find((s) => s.statId === 'attack')!.value.value,
    );
  });
  it('rejects unknown set effects and invalid references or duplicate thresholds', () => {
    const f = damageFixture();
    f.release.equipment[0].setId = 'missing';
    expect(GameDataReleaseSchema.safeParse(f.release).success).toBe(false);
    f.release.equipmentSets = [
      {
        id: 'missing',
        gameVersionId: f.release.version.id,
        name: 'Unknown',
        verified: false,
        sourceIds: ['synthetic-source'],
        bonuses: [],
      },
    ];
    expect(aggregateStats(f).stats.attack.value).toBeNull();
    const bonus = {
      pieces: 1,
      stats: [{ statId: 'attack', value: recorded(10) }],
    };
    f.release.equipmentSets[0].bonuses = [bonus, bonus];
    expect(GameDataReleaseSchema.safeParse(f.release).success).toBe(false);
  });
});
