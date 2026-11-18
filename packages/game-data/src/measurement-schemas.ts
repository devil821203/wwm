import { z } from 'zod';
import { BuildSchema, CharacterSchema } from './player-entities.js';
import {
  EquipmentInstanceSchema,
  GameDataReleaseSchema,
  IdSchema,
} from './schemas.js';
const Text = z.string().trim().min(1).max(10000);
const Timestamp = z.iso.datetime({ offset: true });
export const MeasurementSnapshotSchema = z
  .strictObject({
    character: CharacterSchema,
    build: BuildSchema,
    equipment: z.array(EquipmentInstanceSchema),
    release: GameDataReleaseSchema,
    onlyExplicit: z.boolean(),
    evaluatedAt: Timestamp,
  })
  .superRefine((snapshot, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    const { character, build, release, equipment } = snapshot;
    if (
      character.gameVersionId !== release.version.id ||
      build.characterId !== character.id
    )
      issue('Snapshot version/character mismatch');
    if (
      character.level === null ||
      !release.version.availableLevels.includes(character.level)
    )
      issue('Snapshot legal level required');
    const path = release.paths.find((p) => p.id === character.pathId);
    if (!path) issue('Snapshot path missing');
    if (
      build.stats.some(
        (s) =>
          s.value.gameVersionId !== release.version.id ||
          !release.stats.some((d) => d.id === s.statId),
      )
    )
      issue('Snapshot stat version/definition mismatch');
    for (const ids of [
      build.stats.map((s) => s.statId),
      build.equipmentIds,
      build.martialArts.map((a) => a.id),
      equipment.map((e) => e.id),
    ])
      if (new Set(ids).size !== ids.length)
        issue('Duplicate snapshot reference');
    if (build.martialArts.some((a) => !path?.martialArtIds.includes(a.id)))
      issue('Snapshot martial art/path mismatch');
    if (
      equipment.some((e) => e.gameVersionId !== release.version.id) ||
      build.equipmentIds.some((id) => !equipment.some((e) => e.id === id))
    )
      issue('Snapshot equipment version/reference mismatch');
  });
export const MeasurementSchema = z
  .strictObject({
    id: IdSchema,
    label: z.string().trim().min(1).max(100),
    purpose: z.enum(['GAME_MEASUREMENT', 'SYNTHETIC_TEST']),
    kind: z.enum(['SINGLE_SKILL', 'ROTATION_60S']),
    recordedAt: Timestamp,
    snapshot: MeasurementSnapshotSchema,
    skillId: IdSchema.nullable(),
    variantId: IdSchema.nullable(),
    enemy: z.strictObject({
      name: Text,
      level: z.number().int().positive().safe().nullable(),
      conditions: Text,
    }),
    conditions: Text,
    sampling: z.enum([
      'UNFILTERED_CAST_TOTAL',
      'FILTERED_OR_PARTIAL',
      'ROTATION_TOTAL',
    ]),
    durationMs: z.literal(60000).nullable(),
    samples: z.array(z.number().finite().nonnegative()).min(1).max(10000),
    evidence: z
      .array(
        z.strictObject({
          kind: z.enum(['TEXT', 'SCREENSHOT_REFERENCE']),
          reference: Text,
        }),
      )
      .min(1),
    comparisonContextConfirmed: z.boolean(),
    confirmed: z.literal(true),
    status: z.literal('OBSERVATION_ONLY'),
  })
  .superRefine((m, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    if (
      (m.purpose === 'SYNTHETIC_TEST') !==
      (m.snapshot.release.purpose === 'SYNTHETIC_TEST')
    )
      issue('Synthetic/real measurement purpose mismatch');
    if (m.kind === 'SINGLE_SKILL') {
      const skill = m.snapshot.release.skills.find((s) => s.id === m.skillId);
      const path = m.snapshot.release.paths.find(
        (p) => p.id === m.snapshot.character.pathId,
      );
      if (!skill || !path?.martialArtIds.includes(skill.martialArtId))
        issue('Measurement skill/path mismatch');
      if (
        m.variantId !== null &&
        !skill?.variants?.some((v) => v.id === m.variantId)
      )
        issue('Measurement variant missing');
      if (skill?.variants?.length && m.variantId === null)
        issue('Explicit measurement variant required');
      if (m.durationMs !== null || m.sampling === 'ROTATION_TOTAL')
        issue('Single-skill measurement cannot claim rotation duration');
    } else {
      if (
        m.durationMs !== 60000 ||
        m.sampling !== 'ROTATION_TOTAL' ||
        m.skillId !== null ||
        m.variantId !== null
      )
        issue(
          'Rotation observation requires 60000ms and no single-skill binding',
        );
    }
  });
export type Measurement = z.infer<typeof MeasurementSchema>;
export type MeasurementSnapshot = z.infer<typeof MeasurementSnapshotSchema>;
