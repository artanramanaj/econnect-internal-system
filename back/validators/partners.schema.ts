import { z } from "zod";
import { paginationQuerySchema } from "./pagination.schema.js";

/*
 * Messages are i18n keys (see i18n/locales/*.json); validateBody translates
 * them per request. Bodies are strict: unknown keys are refused.
 */

/** Optional free text; "" is accepted and stored as null. */
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/**
 * Quick-create from the quote editor: only the legal name is required, the
 * rest can be filled in later on the Clients screen. The number is assigned by
 * the server; a partner created here is a customer.
 */
export const createPartnerSchema = z.strictObject({
  legalName: z.string().trim().min(2, "validation.legalNameRequired").max(160),
  tradeName: optionalText(160),
  businessNumber: optionalText(30),
  fiscalNumber: optionalText(30),
  vatNumber: optionalText(30),
  billingAddress: optionalText(255),
  city: optionalText(80),
  // "" must pass: an untouched email field is not an invalid email.
  email: z
    .union([z.literal(""), z.email("validation.emailInvalid").max(120)])
    .nullable()
    .optional(),
  phone: optionalText(30),
  paymentTerms: optionalText(160),
});
export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;

/** The client dropdown: active customers, searched by name, number, city or fiscal number. */
export const partnerQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
});
export type PartnerQueryInput = z.infer<typeof partnerQuerySchema>;
