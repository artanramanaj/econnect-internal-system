import { z } from "zod";
import { REQUESTABLE_ROLE_CODES, type RoleCode } from "../constants/user.constants.js";
import { SUPPORTED_LANGUAGES } from "../i18n/languages.js";

/*
 * Messages are i18n keys (see i18n/locales/*.json); validateBody translates
 * them per request. A rule without a message falls back to a generic key.
 */

/**
 * Single source of truth for the password policy — imported by people.schema
 * rather than copied, so the two can never drift.
 *
 * Length only, no composition rules: NIST SP 800-63B advises against them,
 * because they push people toward predictable substitutions without adding
 * real entropy. Mirrors the live rules widget in the Angular register form.
 */
export const password = z
  .string()
  .min(8, "validation.passwordMin")
  .max(100, "validation.passwordMax");

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "validation.usernameMin")
      .max(50)
      .regex(/^[a-zA-Z0-9._-]+$/, "validation.usernameChars"),
    email: z.email("validation.emailInvalid").max(120),
    password,
    confirmPassword: z.string(),
    firstName: z.string().trim().min(2, "validation.firstNameRequired").max(50),
    lastName: z.string().trim().min(2, "validation.lastNameRequired").max(50),
    positionId: z.coerce.number().int().positive("validation.positionRequired").optional(),
    phone: z.string().trim().max(30).optional(),
    requestedRoleCode: z
      .string()
      .refine(
        (v): v is RoleCode => (REQUESTABLE_ROLE_CODES as readonly string[]).includes(v),
        "validation.roleInvalid"
      ),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "validation.passwordsMismatch",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/** Login never enforces complexity — only that something was supplied. */
export const loginSchema = z.object({
  username: z.string().trim().min(1, "validation.usernameRequired").max(50),
  password: z.string().min(1, "validation.passwordRequired").max(100),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "validation.currentPasswordRequired"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "validation.passwordsMismatch",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateLocaleSchema = z.object({
  locale: z.enum(SUPPORTED_LANGUAGES, { message: "validation.localeInvalid" }),
});

export type UpdateLocaleInput = z.infer<typeof updateLocaleSchema>;
