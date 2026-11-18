import { describe, expect, it } from 'vitest';
import { pathCatalog } from '@wwm/game-data';
import { calculateDamage } from './damage.js';
import { damageFixture, recorded, unknown } from './test/fixtures.js';

describe('S14 independent synthetic path data', () => {
  it('uses only each path’s explicit versioned formula and blocks missing coefficients', () => {
    expect(pathCatalog.paths).toHaveLength(11);
    for (const [index, path] of pathCatalog.paths.entries()) {
      const f = damageFixture();
      // Distinct synthetic data for each fixture, not game coefficients.
      const formulaId = 'synthetic-path-formula-' + index;
      f.character.pathId = path.id;
      f.release.paths[0].id = path.id;
      f.release.paths[0].formulaIds = [formulaId];
      f.release.formulas.push({
        ...structuredClone(f.release.formulas[0]),
        id: formulaId,
      });
      f.release.skills[0].formulaId = formulaId;
      f.release.skills[0].hits[0].coefficient = recorded(index + 1);
      expect(calculateDamage(f).expectedDamage).not.toBeNull();
      f.release.skills[0].hits[0].coefficient = unknown();
      expect(calculateDamage(f).expectedDamage).toBeNull();
    }
  });
});
