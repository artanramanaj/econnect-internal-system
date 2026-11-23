import { z } from "zod";

/*
 * Messages are i18n keys (see i18n/locales/*.json); validateBody translates
 * them per request.
 */

/** Matches the positions.name column: VarChar(80), unique. */
const name = z
  .string()
  .trim()
  .min(2, "validation.positionNameMin")
  .max(80, "validation.positionNameMax");

export const createPositionSchema = z.object({ name });

export type CreatePositionInput = z.infer<typeof createPositionSchema>;

/**
 * Rename, retire, or both. `isActive: false` hides the position from the
 * dropdowns without touching the people who already hold it.
 */
export const updatePositionSchema = z
  .object({
    name: name.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "validation.nothingToUpdate");

export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
