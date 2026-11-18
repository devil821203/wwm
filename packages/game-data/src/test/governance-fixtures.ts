import type {
  DataImport,
  EstimateModel,
  InstanceOverride,
  ReviewDecision,
  ReviewedDataset,
  SourceRegistry,
  ValueRecord,
  ValueScope,
} from '../governance-schemas.js';
import { recorded, testTime, testVersion } from './fixtures.js';

// Entirely synthetic fixtures; these do not assert any real source's permission.
export const approval: ReviewDecision = {
  reviewer: 'synthetic-reviewer',
  at: testTime,
  reason: 'Synthetic test only',
  decision: 'APPROVE',
};
export const scope: ValueScope = {
  gameVersionId: testVersion,
  entityId: 'synthetic-equipment',
  fieldId: 'synthetic-affix-current',
  tierId: 'synthetic-tier',
  quality: 'synthetic-purple',
  cultivation: 'cheng-yin',
  tuningStage: 1,
  unit: 'points',
  precision: 2,
};
export const registry: SourceRegistry = {
  schemaVersion: 1,
  sources: [
    {
      id: 'synthetic-registry',
      url: 'https://example.invalid/synthetic',
      purpose: 'Synthetic fixture only',
      access: 'manual_review',
      license_status: 'unverified',
    },
  ],
};
export function record(id = 'synthetic-record', value = 93): ValueRecord {
  return { id, scope: structuredClone(scope), value: recorded(value) };
}
export function model(): EstimateModel {
  return {
    id: 'synthetic-model',
    scope: structuredClone(scope),
    formulaId: 'synthetic-scale',
    modelVersion: 'synthetic-1',
    implementationId: 'scale',
    multiplier: 0.94,
    input: recorded(100),
    sourceIds: ['synthetic-source'],
  };
}
export function bundle(): DataImport {
  return {
    schemaVersion: '1.0.0',
    purpose: 'SYNTHETIC_TEST',
    region: 'GLOBAL',
    gameVersionId: testVersion,
    sources: [
      {
        id: 'synthetic-source',
        registrySourceId: 'synthetic-registry',
        gameVersionId: testVersion,
        region: 'GLOBAL',
        url: registry.sources[0].url,
        rawLocation: 'synthetic/document#row-1',
        snapshotHash: '0'.repeat(64),
        checkedAt: testTime,
        acquiredAt: testTime,
        publishedAt: null,
        language: 'synthetic',
        confidence: 'COMMUNITY',
        license: 'MANUAL_ONLY',
        licenseEvidence: 'Synthetic permission test only',
        review: structuredClone(approval),
      },
    ],
    records: [record()],
    models: [model()],
  };
}
export function reviewed(data = bundle()): ReviewedDataset {
  return { data, review: structuredClone(approval) };
}
export function override(): InstanceOverride {
  return {
    id: 'synthetic-override',
    instanceId: 'synthetic-instance',
    scope: structuredClone(scope),
    oldValue: recorded(93),
    newValue: {
      gameVersionId: testVersion,
      status: 'MANUAL_CONFIRMED',
      value: 92,
      confirmation: {
        origin: 'MANUAL',
        confirmedAt: testTime,
        evidenceIds: ['synthetic-evidence'],
      },
    },
    author: 'synthetic-user',
    reason: 'Synthetic screenshot correction',
    at: testTime,
  };
}
