import { z } from "zod";
import { ItemSource, ItemType } from "../generated/prisma/enums.js";
import { paginationQuerySchema } from "./pagination.schema.js";

/* Messages are i18n keys (see i18n/locales/*.json); validateBody translates them per request. */

/** The largest value a Decimal(12, 4) column holds: 8 integer digits, 4 decimals. */
const DECIMAL_12_4_MAX = 99_999_999.9999;

/**
 * True when `value` has at most four decimal places. Round-tripping through
 * toFixed avoids the float noise of multiplying by 10 000 (0.1 * 10 000 is not
 * exactly 1 000). Postgres would round a fifth decimal silently instead.
 */
function atMostFourDecimals(value: number): boolean {
  return Number(value.toFixed(4)) === value;
}

/** Matches items.sku: VarChar(60), unique. */
const sku = z.string().trim().min(1, "validation.skuRequired").max(60);

/** Matches items.description: VarChar(255). */
const description = z.string().trim().min(2, "validation.descriptionRequired").max(255);

/** A units.code: VarChar(10). Existence is checked against the table by the controller. */
const unitCode = z.string().trim().min(1, "validation.unitRequired").max(10);

/** A vat_rates.code: VarChar(20). Checked against the rates in force by the controller. */
const vatCode = z.string().trim().min(1, "validation.vatCodeRequired").max(20);

/**
 * Optional free text. An empty string is accepted and stored as null, so
 * clearing an input in the form clears the column.
 */
const optionalText = (max: number) => z.string().trim().max(max);

/**
 * A categories/brands id from the dropdowns. The body arrives as JSON, so no
 * coercion; existence is checked against the table by the controller.
 */
const refId = z.number({ message: "validation.invalid" }).int().positive();

/**
 * Cost price in euros. Coerced because the form may post the input's string;
 * bounded to the column's Decimal(12, 4), since an overflow would surface as
 * an untranslated database error rather than a field message.
 */
const costPrice = z.coerce
  .number({ message: "validation.costPriceInvalid" })
  .min(0, "validation.costPriceNegative")
  .max(DECIMAL_12_4_MAX, "validation.costPriceTooLarge")
  .refine(atMostFourDecimals, "validation.costPriceDecimals");

/** How many base units one of this unit holds: 10 for a box of 10 pcs. */
const factor = z.coerce
  .number({ message: "validation.factorInvalid" })
  .gt(0, "validation.factorInvalid")
  .max(DECIMAL_12_4_MAX, "validation.factorInvalid")
  .refine(atMostFourDecimals, "validation.factorInvalid");

/**
 * The item's alternative units, always sent whole: the list replaces what is
 * stored. The base unit must not appear in it; the controller checks that,
 * because the base unit may come from the stored row rather than this body.
 */
const alternativeUnits = z
  .array(z.object({ unitCode, factor }))
  .max(10)
  .refine(
    (units) => new Set(units.map((unit) => unit.unitCode)).size === units.length,
    "validation.unitsDuplicate",
  );

const itemType = z.enum(ItemType);

/** A LOCAL item. `source` is never accepted: only the ProData sync creates PRODATA rows. */
export const createItemSchema = z.object({
  sku,
  description,
  type: itemType.default(ItemType.PRODUCT),
  categoryId: refId.optional(),
  brandId: refId.optional(),
  manufacturer: optionalText(80).optional(),
  barcode: optionalText(60).optional(),
  baseUnitCode: unitCode,
  vatCode,
  costPrice: costPrice.optional(),
  units: alternativeUnits.optional(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

/**
 * Any subset of the fields, plus archive/restore. The optional text fields
 * are nullable so the drawer can clear them. `source`, `sourceId` and
 * `lastSyncedAt` belong to the sync and are not accepted.
 */
export const updateItemSchema = z
  .object({
    sku: sku.optional(),
    description: description.optional(),
    type: itemType.optional(),
    // null clears the dropdown ("no category"); undefined leaves it alone.
    categoryId: refId.nullable().optional(),
    brandId: refId.nullable().optional(),
    manufacturer: optionalText(80).nullable().optional(),
    barcode: optionalText(60).nullable().optional(),
    baseUnitCode: unitCode.optional(),
    vatCode: vatCode.optional(),
    costPrice: costPrice.optional(),
    units: alternativeUnits.optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "validation.nothingToUpdate");
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const ITEM_STATUSES = ["active", "archived", "all"] as const;

/** Search box, filters and pager on the Products screen. */
export const itemQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  type: itemType.optional(),
  source: z.enum(ItemSource).optional(),
  // Coerced: query-string values arrive as strings.
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  status: z.enum(ITEM_STATUSES).default("active"),
});
export type ItemQueryInput = z.infer<typeof itemQuerySchema>;
