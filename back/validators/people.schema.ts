import { z } from "zod";
import { ROLE_CODES, type RoleCode } from "../constants/user.constants.js";
import { password } from "./auth.schema.js";
import { paginationQuerySchema } from "./pagination.schema.js";

/*
 * Messages are i18n keys (see i18n/locales/*.json); validateBody translates
 * them per request. A rule without a message falls back to a generic key.
 */

const allRoleCodes = Object.values(ROLE_CODES) as readonly string[];

const roleCode = z
  .string()
  .refine((v): v is RoleCode => allRoleCodes.includes(v), "validation.roleInvalid");

/** FK into positions. Coerced because the form posts the select's value as a string. */
const positionId = z.coerce
  .number({ message: "validation.positionRequired" })
  .int("validation.positionRequired")
  .positive("validation.positionRequired");

/**
 * Cost per hour in euros. Coerced because the form posts it as a string, and
 * bounded to the column's Decimal(10, 2).
 */
const hourlyCost = z.coerce
  .number({ message: "validation.hourlyCostInvalid" })
  .min(0, "validation.hourlyCostNegative")
  .max(99_999_999.99, "validation.hourlyCostTooLarge");

/**
 * An account to go with the employee. Optional: the roster also holds people
 * who never sign in, and a group is only meaningful for someone who can.
 */
const login = z.object({
  username: z
    .string()
    .trim()
    .min(3, "validation.usernameMin")
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "validation.usernameChars"),
  email: z.email("validation.emailInvalid").max(120),
  password,
  roleCode,
});

export const createPersonSchema = z.object({
  firstName: z.string().trim().min(2, "validation.firstNameRequired").max(50),
  lastName: z.string().trim().min(2, "validation.lastNameRequired").max(50),
  positionId: positionId.optional(),
  phone: z.string().trim().max(30).optional(),
  isFieldStaff: z.boolean().optional(),
  hourlyCost: hourlyCost.optional(),
  login: login.optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = z
  .object({
    firstName: z.string().trim().min(2, "validation.firstNameRequired").max(50).optional(),
    lastName: z.string().trim().min(2, "validation.lastNameRequired").max(50).optional(),
    // Nullable so the drawer's "—" option can clear it.
    positionId: positionId.nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    isFieldStaff: z.boolean().optional(),
    hourlyCost: hourlyCost.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "validation.nothingToUpdate");

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

/** Search box, group filter and pager on the People card. */
export const personQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  group: roleCode.optional(),
});

export type PersonQueryInput = z.infer<typeof personQuerySchema>;
