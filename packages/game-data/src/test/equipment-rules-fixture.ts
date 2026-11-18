import {
  releaseFixture,
  equipmentFixture,
  recorded,
  unknown,
  testTime,
} from './fixtures.js';
import type { ResolvedValue } from '../schemas.js';
// SYNTHETIC ONLY: arbitrary rule numbers are not game data.
export function rulesFixture() {
  const release = releaseFixture();
  const definition = release.equipment[0];
  definition.legality = {
    ruleVersion: 'synthetic-rules-1',
    verified: true,
    sourceIds: ['synthetic-source'],
    minAffixes: 1,
    maxAffixes: 2,
    tuningStages: [0, 1],
    exclusionGroups: [],
  };
  definition.baseStats[0].value = recorded(80);
  const cap = release.affixCaps[0];
  cap.tuningStage = 0;
  cap.maximum = recorded(100);
  cap.minimum = recorded(0);
  cap.chengYinValue = unknown();
  cap.step = 1;
  cap.roundingRule = 'ROUND';
  cap.precisionVerified = true;
  cap.chengYinModel = {
    formulaId: 'synthetic-formula',
    modelVersion: 'synthetic-model-1',
    registeredAt: testTime,
    ratio: 0.94,
    precision: 0,
    precisionVerified: true,
    sourceIds: ['synthetic-source'],
  };
  const item = equipmentFixture();
  item.slotId = definition.slotId;
  item.definitionId = definition.id;
  item.tuningStage = 0;
  item.affixes[0].current = unknown();
  item.affixes[0].valueMode = 'CHENG_YIN';
  return { release, item, cap, definition };
}
export const manual = (value: number): ResolvedValue => ({
  status: 'MANUAL_CONFIRMED',
  value,
  gameVersionId: 'synthetic-v1',
  confirmation: {
    origin: 'SCREENSHOT',
    confirmedAt: testTime,
    evidenceIds: ['synthetic-confirmation'],
  },
});
