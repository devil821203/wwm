import { z } from 'zod';
import { IdSchema } from './schemas.js';
import { PlayerArchiveSchema } from './player-schemas.js';

const Timestamp = z.iso.datetime({ offset: true });
const Text = z.string().trim().min(1);
const Modules = ['equipment', 'character', 'innerWays', 'other'] as const;

/** Candidate evidence only; this contract does not approve or publish a source. */
export const ExternalSourceSnapshotSchema = z.strictObject({
  id: IdSchema,
  sourceId: IdSchema,
  location: Text,
  revision: Text.nullable(),
  acquiredAt: Timestamp,
  publishedAt: Timestamp.nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  license: z.enum(['AUTHORIZED', 'MANUAL_ONLY', 'UNVERIFIED', 'DENIED']),
  language: Text.nullable(),
  region: Text.nullable(),
  claimedGameVersion: Text.nullable(),
  assumedGameVersion: Text.nullable(),
});

const ModuleManifestSchema = z.strictObject({
  sourceSnapshotIds: z.array(IdSchema),
  status: z.enum(['REVIEWED', 'CANDIDATE', 'UNKNOWN']),
  notes: z.array(Text),
});

/** A manifest describes references, not approval, data ingestion or publication. */
export const ModularDataManifestSchema = z
  .strictObject({
    id: IdSchema,
    gameVersion: Text,
    createdAt: Timestamp,
    sources: z.array(ExternalSourceSnapshotSchema),
    modules: z.strictObject({
      equipment: ModuleManifestSchema,
      character: ModuleManifestSchema,
      innerWays: ModuleManifestSchema,
      other: ModuleManifestSchema,
    }),
  })
  .superRefine((manifest, ctx) => {
    const ids = manifest.sources.map((source) => source.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'Duplicate source snapshot',
      });
    for (const module of Modules) {
      const refs = manifest.modules[module].sourceSnapshotIds;
      if (new Set(refs).size !== refs.length)
        ctx.addIssue({
          code: 'custom',
          path: ['modules', module, 'sourceSnapshotIds'],
          message: 'Duplicate source reference',
        });
      refs.forEach((id, index) => {
        if (!ids.includes(id))
          ctx.addIssue({
            code: 'custom',
            path: ['modules', module, 'sourceSnapshotIds', index],
            message: 'Missing source snapshot',
          });
      });
      if (manifest.modules[module].status === 'REVIEWED' && refs.length === 0)
        ctx.addIssue({
          code: 'custom',
          path: ['modules', module],
          message: 'Reviewed module requires evidence',
        });
    }
  });

/** Immutable by storage convention; the full archive preserves existing evidence and precision. */
export const PlayerLoadoutSnapshotSchema = z
  .strictObject({
    id: IdSchema,
    capturedAt: Timestamp,
    origin: z.enum(['IMPORT', 'MANUAL', 'SCREENSHOT']),
    claimedGameVersion: Text.nullable(),
    characterId: IdSchema,
    buildId: IdSchema,
    archive: PlayerArchiveSchema,
  })
  .superRefine((snapshot, ctx) => {
    if (
      !snapshot.archive.characters.some(
        (item) => item.id === snapshot.characterId,
      )
    )
      ctx.addIssue({
        code: 'custom',
        path: ['characterId'],
        message: 'Character absent from archive',
      });
    if (
      !snapshot.archive.builds.some(
        (item) =>
          item.id === snapshot.buildId &&
          item.characterId === snapshot.characterId,
      )
    )
      ctx.addIssue({
        code: 'custom',
        path: ['buildId'],
        message: 'Build absent or belongs to another character',
      });
  });

export const VersionedCalculationReferenceSchema = z.strictObject({
  id: IdSchema,
  playerSnapshotId: IdSchema,
  dataManifestId: IdSchema,
  formulaVersion: Text,
  calculatedAt: Timestamp,
  containsEstimates: z.boolean(),
  blockingUnknowns: z.array(Text),
});

export type ExternalSourceSnapshot = z.infer<
  typeof ExternalSourceSnapshotSchema
>;
export type ModularDataManifest = z.infer<typeof ModularDataManifestSchema>;
export type PlayerLoadoutSnapshot = z.infer<typeof PlayerLoadoutSnapshotSchema>;
export type VersionedCalculationReference = z.infer<
  typeof VersionedCalculationReferenceSchema
>;
