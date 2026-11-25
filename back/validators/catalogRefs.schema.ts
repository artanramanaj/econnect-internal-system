import { z } from "zod";

/*
 * Messages are i18n keys (see i18n/locales/*.json); validateBody translates
 * them per request.
 */

/** Matches categories.name and brands.name: VarChar(80), unique. */
const name = z.string().trim().min(2, "validation.refNameMin").max(80, "validation.refNameMax");

/**
 * One schema for create and rename: a category or brand is nothing but its
 * name, so both operations carry the same body.
 */
export const catalogRefSchema = z.object({ name });

export type CatalogRefInput = z.infer<typeof catalogRefSchema>;
