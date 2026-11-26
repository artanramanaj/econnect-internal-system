import { z } from "zod";
import { QuoteLineKind, QuoteStatus } from "../generated/prisma/enums.js";
import { MAX_QUOTE_LINES } from "../constants/quote.constants.js";
import { paginationQuerySchema } from "./pagination.schema.js";

/*
 * Messages are i18n keys (see i18n/locales/*.json); validateBody translates
 * them per request. Bodies are strict: an unknown key is refused rather than
 * silently dropped, so a typo in a field name cannot pass for a saved value.
 */

/**
 * A decimal that arrives as text ("12.5000") and stays text: amounts are never
 * turned into JS numbers on the way to Decimal. A plain JSON number is
 * accepted too and stringified, for clients that send 12 rather than "12".
 */
function decimalText(pattern: RegExp, message: string) {
  return z
    .union([z.string(), z.number()], { message })
    .transform((value) => String(value).trim())
    .pipe(z.string().regex(pattern, message));
}

/** Decimal(14, 4), above zero. */
const quantity = decimalText(/^\d{1,10}(\.\d{1,4})?$/, "validation.quantityInvalid").refine(
  (value) => Number(value) > 0,
  "validation.quantityInvalid",
);

/** Decimal(12, 4), zero or more. */
const unitCost = decimalText(/^\d{1,8}(\.\d{1,4})?$/, "validation.unitCostInvalid");
const unitPrice = decimalText(/^\d{1,8}(\.\d{1,4})?$/, "validation.unitPriceInvalid");

/** Decimal(9, 4). Negative is allowed: a line may be sold below cost. */
const markupPct = decimalText(/^-?\d{1,5}(\.\d{1,4})?$/, "validation.markupInvalid");

/** Decimal(5, 2) percent. */
const vatRate = decimalText(/^\d{1,3}(\.\d{1,2})?$/, "validation.vatRateInvalid");

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/** A calendar day, "2026-11-25". */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "validation.dateInvalid")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "validation.dateInvalid");

/**
 * One line as the editor holds it. The snapshot fields (sku, description,
 * unit, cost, VAT code and rate) are sent, not looked up: a line carried over
 * from an earlier revision must keep what it copied back then. The server
 * recalculates every derived figure itself from quantity, cost and whichever
 * of markup/price `basis` names.
 */
const quoteLine = z
  .strictObject({
    section: optionalText(60),
    kind: z.enum(QuoteLineKind),
    itemId: z.number().int().positive().nullable().optional(),
    sku: optionalText(60),
    description: z.string().trim().min(1, "validation.lineDescriptionRequired").max(255),
    unitCode: z.string().trim().min(1, "validation.unitRequired").max(10),
    quantity,
    unitCost,
    basis: z.enum(["MARKUP", "PRICE"]),
    markupPct: markupPct.nullable().optional(),
    unitPrice: unitPrice.nullable().optional(),
    vatCode: z.string().trim().min(1, "validation.vatCodeRequired").max(20),
    vatRate,
  })
  .superRefine((line, ctx) => {
    // With no cost there is nothing to mark up, so the price must be given.
    const costIsZero = Number(line.unitCost) === 0;
    if ((line.basis === "PRICE" || costIsZero) && line.unitPrice == null) {
      ctx.addIssue({ code: "custom", path: ["unitPrice"], message: "validation.priceRequired" });
    }
    if (line.basis === "MARKUP" && !costIsZero && line.markupPct == null) {
      ctx.addIssue({ code: "custom", path: ["markupPct"], message: "validation.markupRequired" });
    }
  });
export type QuoteLineInput = z.infer<typeof quoteLine>;

const header = {
  siteId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(2, "validation.quoteTitleRequired").max(160),
  label: optionalText(80),
  validUntil: isoDate.nullable().optional(),
  paymentTerms: optionalText(160),
  notes: optionalText(4000),
  lines: z.array(quoteLine).max(MAX_QUOTE_LINES),
};

/** POST /api/quotes: the quote, its revision 1.0 and its lines, in one go. */
export const createQuoteSchema = z.strictObject({
  partnerId: z.number({ message: "validation.partnerRequired" }).int().positive(),
  ...header,
});
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

/**
 * PUT /api/quotes/:id: a save, which creates the next revision. No partnerId —
 * a quote's partner is fixed. `version` is the quote version the editor loaded;
 * a save on top of someone else's newer save is refused.
 */
export const updateQuoteSchema = z.strictObject({
  version: z.number().int().positive(),
  ...header,
});
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

export const rejectQuoteSchema = z.strictObject({
  note: z.string().trim().min(2, "validation.rejectionNoteRequired").max(1000),
});
export type RejectQuoteInput = z.infer<typeof rejectQuoteSchema>;

export const QUOTE_SORT_FIELDS = ["createdAt", "quoteNumber", "title", "status"] as const;

/** Search box, filters, sorting and pager of the Quotes list. */
export const quoteQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  // Coerced: query-string values arrive as strings.
  partnerId: z.coerce.number().int().positive().optional(),
  createdById: z.coerce.number().int().positive().optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  status: z.enum(QuoteStatus).optional(),
  sortBy: z.enum(QUOTE_SORT_FIELDS).default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type QuoteQueryInput = z.infer<typeof quoteQuerySchema>;
