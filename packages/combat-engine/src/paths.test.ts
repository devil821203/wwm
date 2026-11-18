import { describe, expect, it } from 'vitest';
import { pathCatalog } from '@wwm/game-data';
import { runRotation } from './engine.js';
import { combatFixture, recorded } from './test/fixtures.js';

describe('S14 path-specific synthetic combat fixtures', () => {
  it('runs independent formulas and rejects a formula borrowed from another path', () => {
    for (const [index, path] of pathCatalog.paths.entries()) {
      const f = combatFixture();
      const formulaId = 'synthetic-combat-formula-' + index;
      f.character.pathId = path.id;
      f.release.paths[0].id = path.id;
      f.release.paths[0].formulaIds = [formulaId];
      f.release.formulas.push({
        ...structuredClone(f.release.formulas[0]),
        id: formulaId,
      });
      f.release.skills[0].formulaId = formulaId;
      f.release.skills[0].hits[0].coefficient = recorded(index + 1);
      f.release.paths[0].requiredHandlerIds = [
        'weighted-hit-v1',
        'combat-events-v1',
      ];
      expect(runRotation(f).status).toBe('VALID');
      f.release.paths[0].requiredHandlerIds = ['synthetic-unsupported-handler'];
      expect(runRotation(f).totalExpectedDamage).toBeNull();
      f.plan.actions = [];
      expect(runRotation(f).totalExpectedDamage).toBeNull();
      f.plan.actions = [0, 1000, 2000].map((atMs) => ({
        atMs,
        action: {
          kind: 'CAST' as const,
          skillId: 'synthetic-skill',
          variantId: null,
        },
      }));
      f.release.paths[0].requiredHandlerIds = ['combat-events-v1'];
      f.release.paths[0].formulaIds = ['synthetic-formula'];
      expect(runRotation(f).totalExpectedDamage).toBeNull();
    }
  });
});
