/**
 * Languages the API can answer in. Kept apart from the i18next setup so a
 * validator can import the list without pulling in the runtime.
 *
 * Must stay in step with `front/src/app/core/i18n/languages.ts` and the
 * `User.locale` column (VarChar(5), default "sq").
 */
export const SUPPORTED_LANGUAGES = ["sq", "en"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** Used for missing keys, and for requests that name no language at all. */
export const FALLBACK_LANGUAGE: Language = "en";

export function isLanguage(value: unknown): value is Language {
  return (SUPPORTED_LANGUAGES as readonly unknown[]).includes(value);
}
