import { z } from 'zod';
import { IdSchema } from './schemas.js';
const Time = z.number().int().nonnegative().safe();
export const RotationActionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CAST'),
    skillId: IdSchema,
    variantId: IdSchema.nullable(),
  }),
  z.strictObject({ kind: z.literal('SWITCH'), martialArtId: IdSchema }),
]);
export const RotationPlanSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string().trim().min(1).max(100),
    gameVersionId: IdSchema,
    durationMs: Time.positive().max(3600000),
    initialMartialArtId: IdSchema,
    onlyExplicit: z.boolean(),
    mode: z.enum(['FIXED', 'PRIORITY']),
    actions: z
      .array(z.strictObject({ atMs: Time, action: RotationActionSchema }))
      .max(1000),
    decisionIntervalMs: Time.positive().nullable(),
    priorityRules: z
      .array(
        z.strictObject({
          action: RotationActionSchema,
          requiredBuffIds: z.array(IdSchema),
          forbiddenBuffIds: z.array(IdSchema),
          resourceId: IdSchema.nullable(),
          minimum: z.number().finite().nonnegative().nullable(),
        }),
      )
      .max(100),
  })
  .superRefine((plan, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: 'custom', message });
    if (
      plan.mode === 'FIXED' &&
      (plan.priorityRules.length > 0 ||
        plan.decisionIntervalMs !== null ||
        plan.actions.some((a) => a.atMs >= plan.durationMs))
    )
      issue('Invalid fixed rotation window');
    if (
      plan.mode === 'PRIORITY' &&
      (plan.actions.length > 0 ||
        !plan.decisionIntervalMs ||
        !plan.priorityRules.length)
    )
      issue('Invalid priority rotation');
    plan.priorityRules.forEach((rule) => {
      if ((rule.resourceId === null) !== (rule.minimum === null))
        issue('Priority resource/minimum pair required');
    });
  });

export type RotationPlan = z.infer<typeof RotationPlanSchema>;
export type RotationAction = z.infer<typeof RotationActionSchema>;
