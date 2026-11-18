import { z } from 'zod';
import { IdSchema, ResolvedValueSchema } from './schemas.js';

const Text = z.string().trim().min(1);
const Timestamp = z.iso.datetime({ offset: true });
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const HttpUrl = z
  .url()
  .refine((url) => /^https?:\/\//.test(url), 'HTTP(S) source URL required');
export const SourceRegistrySchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    sources: z.array(
      z.strictObject({
        id: IdSchema,
        url: HttpUrl,
        purpose: Text,
        access: z.enum([
          'manual_review',
          'permission_required_for_bulk_import',
          'review_repository_license_and_files',
        ]),
        license_status: z.literal('unverified'),
      }),
    ),
  })
  .superRefine((registry, ctx) => {
    if (
      new Set(registry.sources.map((source) => source.id)).size !==
      registry.sources.length
    )
      ctx.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'Duplicate source ID',
      });
  });

export const ReviewDecisionSchema = z.strictObject({
  reviewer: Text,
  at: Timestamp,
  reason: Text,
  decision: z.enum(['APPROVE', 'REJECT']),
});
export const SourceEvidenceSchema = z.strictObject({
  id: IdSchema,
  registrySourceId: IdSchema,
  gameVersionId: IdSchema,
  region: z.literal('GLOBAL'),
  url: HttpUrl,
  rawLocation: Text,
  snapshotHash: Hash,
  checkedAt: Timestamp,
  acquiredAt: Timestamp,
  publishedAt: Timestamp.nullable(),
  language: Text,
  confidence: z.enum(['OFFICIAL', 'CROSSCHECKED', 'COMMUNITY', 'UNKNOWN']),
  license: z.enum(['AUTHORIZED', 'MANUAL_ONLY', 'UNVERIFIED', 'DENIED']),
  licenseEvidence: Text,
  review: ReviewDecisionSchema,
});
export const ValueScopeSchema = z.strictObject({
  gameVersionId: IdSchema,
  entityId: IdSchema,
  fieldId: IdSchema,
  tierId: IdSchema.nullable(),
  quality: IdSchema.nullable(),
  cultivation: IdSchema.nullable(),
  tuningStage: z.number().int().nonnegative().safe().nullable(),
  unit: Text,
  precision: z.number().int().nonnegative().max(15).nullable(),
});
export const ValueRecordSchema = z
  .strictObject({
    id: IdSchema,
    scope: ValueScopeSchema,
    value: ResolvedValueSchema,
  })
  .superRefine((record, ctx) => {
    if (record.scope.gameVersionId !== record.value.gameVersionId)
      ctx.addIssue({
        code: 'custom',
        path: ['value', 'gameVersionId'],
        message: 'Record version mismatch',
      });
    if (record.value.status === 'MANUAL_CONFIRMED')
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Player confirmation belongs to instance overrides',
      });
  });
export const EstimateModelSchema = z
  .strictObject({
    id: IdSchema,
    scope: ValueScopeSchema,
    formulaId: IdSchema,
    modelVersion: Text,
    implementationId: z.literal('scale'),
    multiplier: z.number().finite(),
    input: ResolvedValueSchema,
    sourceIds: z.array(IdSchema).min(1),
  })
  .superRefine((model, ctx) => {
    if (model.input.gameVersionId !== model.scope.gameVersionId)
      ctx.addIssue({
        code: 'custom',
        path: ['input'],
        message: 'Model input version mismatch',
      });
  });
export const InstanceOverrideSchema = z
  .strictObject({
    id: IdSchema,
    instanceId: IdSchema,
    scope: ValueScopeSchema,
    oldValue: ResolvedValueSchema,
    newValue: ResolvedValueSchema,
    author: Text,
    reason: Text,
    at: Timestamp,
  })
  .superRefine((override, ctx) => {
    if (override.newValue.status !== 'MANUAL_CONFIRMED')
      ctx.addIssue({
        code: 'custom',
        path: ['newValue'],
        message: 'Override requires manual confirmation',
      });
    if (
      [override.oldValue, override.newValue].some(
        (value) => value.gameVersionId !== override.scope.gameVersionId,
      )
    )
      ctx.addIssue({
        code: 'custom',
        path: ['scope'],
        message: 'Override version mismatch',
      });
  });
export const ConflictSelectionSchema = z.strictObject({
  scope: ValueScopeSchema,
  // The entire competing record set is bound to the decision, including values.
  candidates: z.array(ValueRecordSchema).min(1),
  selectedRecordId: IdSchema,
  review: ReviewDecisionSchema,
});
export const DataImportSchema = z
  .strictObject({
    schemaVersion: z.literal('1.0.0'),
    purpose: z.enum(['GAME_DATA', 'SYNTHETIC_TEST']),
    region: z.literal('GLOBAL'),
    gameVersionId: IdSchema,
    sources: z.array(SourceEvidenceSchema),
    records: z.array(ValueRecordSchema),
    models: z.array(EstimateModelSchema),
  })
  .superRefine((bundle, ctx) => {
    const sourceIds = new Set(bundle.sources.map((source) => source.id));
    for (const key of ['sources', 'records', 'models'] as const) {
      const seen = new Set<string>();
      bundle[key].forEach((item, i) => {
        if (seen.has(item.id))
          ctx.addIssue({
            code: 'custom',
            path: [key, i, 'id'],
            message: 'Duplicate ID',
          });
        seen.add(item.id);
        const version =
          'scope' in item ? item.scope.gameVersionId : item.gameVersionId;
        if (version !== bundle.gameVersionId)
          ctx.addIssue({
            code: 'custom',
            path: [key, i],
            message: 'Cross-version bundle',
          });
      });
    }
    const checkValueSources = (
      value: z.infer<typeof ResolvedValueSchema>,
      path: (string | number)[],
    ) => {
      if ('sourceIds' in value)
        value.sourceIds.forEach((id) => {
          if (!sourceIds.has(id))
            ctx.addIssue({
              code: 'custom',
              path,
              message: 'Unresolved source: ' + id,
            });
        });
    };
    bundle.records.forEach((record, i) =>
      checkValueSources(record.value, ['records', i, 'value']),
    );
    bundle.models.forEach((model, i) => {
      model.sourceIds.forEach((id) => {
        if (!sourceIds.has(id))
          ctx.addIssue({
            code: 'custom',
            path: ['models', i],
            message: 'Unresolved model source: ' + id,
          });
      });
      checkValueSources(model.input, ['models', i, 'input']);
    });
  });
export const ReviewedDatasetSchema = z
  .strictObject({
    data: DataImportSchema,
    review: ReviewDecisionSchema,
  })
  .refine(
    (dataset) => dataset.review.decision === 'APPROVE',
    'Dataset is not approved',
  );

export type SourceRegistry = z.infer<typeof SourceRegistrySchema>;
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;
export type ValueScope = z.infer<typeof ValueScopeSchema>;
export type ValueRecord = z.infer<typeof ValueRecordSchema>;
export type EstimateModel = z.infer<typeof EstimateModelSchema>;
export type InstanceOverride = z.infer<typeof InstanceOverrideSchema>;
export type ConflictSelection = z.infer<typeof ConflictSelectionSchema>;
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export type DataImport = z.infer<typeof DataImportSchema>;
export type ReviewedDataset = z.infer<typeof ReviewedDatasetSchema>;
