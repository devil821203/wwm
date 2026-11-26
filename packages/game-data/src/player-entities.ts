import { RotationPlanSchema } from './rotation-schemas.js';
import { z } from 'zod';
import { IdSchema, ResolvedValueSchema } from './schemas.js';
const Name = z.string().trim().min(1).max(100);
const Timestamp = z.iso.datetime({ offset: true });
export const CharacterSchema = z
  .strictObject({
    id: IdSchema,
    name: Name,
    pathId: IdSchema,
    gameVersionId: IdSchema.nullable(),
    level: z.number().int().positive().safe().nullable(),
    realm: z.string().trim().max(100),
    createdAt: Timestamp,
    updatedAt: Timestamp,
  })
  .refine(
    (character) => character.gameVersionId !== null || character.level === null,
    'Draft level must be unknown',
  );
export const BuildSchema = z.strictObject({
  id: IdSchema,
  characterId: IdSchema,
  name: Name,
  rotation: RotationPlanSchema.optional(),
  panelMode: z.enum(['UNKNOWN', 'BASE_ONLY', 'EQUIPMENT_INCLUDED']),
  stats: z.array(
    z.strictObject({ statId: IdSchema, value: ResolvedValueSchema }),
  ),
  recordedPanel: z
    .array(
      z.strictObject({
        id: IdSchema,
        label: z.string().trim().min(1).max(100),
        value: z.number().finite(),
        unit: z.string().max(20),
      }),
    )
    .max(100)
    .optional(),
  recordedInnerWays: z
    .array(z.string().trim().min(1).max(100))
    .max(20)
    .optional(),
  equipmentIds: z.array(IdSchema),
  martialArts: z.array(
    z.strictObject({
      id: IdSchema,
      level: z.number().int().positive().safe().nullable(),
    }),
  ),
  innerWays: z.array(
    z.strictObject({
      id: IdSchema,
      level: z.number().int().positive().safe().nullable(),
    }),
  ),
  mysticSkillIds: z.array(IdSchema),
  talentIds: z.array(IdSchema),
  notes: z.string().max(5000),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
