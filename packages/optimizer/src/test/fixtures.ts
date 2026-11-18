import { combatFixture, recorded } from './combat-fixture.js';
import type { OptimizationRequest } from '../index.js';
export function optimizerFixture(): OptimizationRequest {
  const combat = combatFixture();
  combat.build.panelMode = 'BASE_ONLY';
  combat.equipment = [];
  const base = combat.release.equipment[0];
  base.slotId = 'head';
  base.id = 'head-definition';
  combat.release.equipment.push({
    ...structuredClone(base),
    id: 'weapon-definition',
    slotId: 'weapon',
  });
  for (const slot of ['head', 'weapon'])
    for (let level = 0; level < 2; level++) {
      combat.equipment.push({
        id: slot + '-' + level,
        name: '合成 ' + slot + ' ' + level,
        gameVersionId: combat.release.version.id,
        definitionId: slot + '-definition',
        slotId: slot,
        tierId: base.tierId,
        quality: base.quality,
        tuningStage: 0,
        isChengYin: false,
        creationMethod: level ? 'GENERATED' : 'MANUAL',
        evidenceIds: [],
        baseStats: [],
        affixes: [
          {
            affixId: 'attack-affix',
            valueMode: 'MANUAL',
            current: recorded(level * 100),
            effective: recorded(level * 100),
            maximum: recorded(100),
          },
        ],
        validation: { status: 'UNVERIFIED', reasons: [] },
      });
    }
  combat.build.equipmentIds = ['head-0', 'weapon-0'];
  return {
    combat,
    slots: ['head', 'weapon'],
    locked: {},
    excludedIds: [],
    minimumStats: {},
    requiredSets: {},
    maximumCost: null,
    costs: { 'head-0': 0, 'head-1': 5, 'weapon-0': 0, 'weapon-1': 5 },
    method: 'AUTO',
    beamWidth: 20,
    topK: 3,
    maxEvaluations: 1000,
    maxNodes: 50000,
  };
}
export function optimizerArchive() {
  const f = optimizerFixture();
  f.combat.build.rotation = f.combat.plan;
  return {
    format: 'WWM_PLAYER_ARCHIVE' as const,
    schemaVersion: '1.0.0' as const,
    exportedAt: f.combat.evaluatedAt,
    characters: [f.combat.character],
    builds: [f.combat.build],
    equipment: f.combat.equipment,
    dataReleases: [f.combat.release!],
    overrides: [],
  };
}
