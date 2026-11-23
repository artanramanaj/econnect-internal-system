/**
 * Languages the UI ships in. Must stay in step with `back/i18n/languages.ts`
 * and the `User.locale` column (default "sq").
 */
export const SUPPORTED_LANGUAGES = ['sq', 'en'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

/** What a first-time visitor sees, and what the database defaults a new account to. */
export const DEFAULT_LANGUAGE: Language = 'sq';

/** Used for any key missing from the active language's file. */
export const FALLBACK_LANGUAGE: Language = 'en';

/** BCP 47 tags for Intl date and number formatting. */
export const INTL_LOCALES: Record<Language, string> = {
  sq: 'sq-AL',
  en: 'en-GB',
};

export function isLanguage(value: unknown): value is Language {
  return (SUPPORTED_LANGUAGES as readonly unknown[]).includes(value);
}
