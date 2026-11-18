import { z } from 'zod';
import { EquipmentInstanceSchema, IdSchema } from './schemas.js';
export const EquipmentImageSchema = z.strictObject({
  id: IdSchema,
  equipmentId: IdSchema,
  name: z.string().min(1).max(255),
  dataUrl: z
    .string()
    .max(7 * 1024 * 1024)
    .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
  width: z.number().int().positive().max(12000),
  height: z.number().int().positive().max(12000),
  savedAt: z.iso.datetime({ offset: true }),
});
export const EquipmentEditSchema = z
  .strictObject({
    id: IdSchema,
    equipmentId: IdSchema,
    at: z.iso.datetime({ offset: true }),
    previousJson: z.string().max(2 * 1024 * 1024),
  })
  .superRefine((entry, ctx) => {
    try {
      const previous = EquipmentInstanceSchema.parse(
        JSON.parse(entry.previousJson),
      );
      if (previous.id !== entry.equipmentId) throw new Error('Wrong equipment');
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['previousJson'],
        message: 'Invalid previous equipment snapshot',
      });
    }
  });
export type EquipmentImage = z.infer<typeof EquipmentImageSchema>;
export type EquipmentEdit = z.infer<typeof EquipmentEditSchema>;
