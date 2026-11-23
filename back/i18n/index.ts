import type { Request } from "express";
import i18next from "i18next";
import { LanguageDetector, handle } from "i18next-http-middleware";
import en from "./locales/en.json" with { type: "json" };
import sq from "./locales/sq.json" with { type: "json" };
import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES } from "./languages.js";

export { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES, isLanguage, type Language } from "./languages.js";

/*
 * Every message the API sends a person is a key into locales/*.json. Keys are
 * typed from en.json, so a typo is a compile error rather than a toast that
 * reads "auth.invalidCredentals".
 *
 * Plural forms ("stillHeld_one" / "stillHeld_other") are addressed by their
 * base key with a `count` param; i18next picks the suffix.
 */
type StripPlural<K extends string> = K extends `${infer Base}_one`
  ? Base
  : K extends `${infer Base}_other`
    ? Base
    : K;

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? StripPlural<K>
    : T[K] extends object
      ? `${K}.${Paths<T[K]>}`
      : never;
}[keyof T & string];

export type MessageKey = Paths<typeof en>;

/** Values for the {{placeholders}} in a message. */
export type MessageParams = Record<string, string | number | null | undefined>;

function flattenKeys(tree: object, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([name, value]) => {
    const path = prefix ? `${prefix}.${name}` : name;
    return value !== null && typeof value === "object"
      ? flattenKeys(value, path)
      : [path.replace(/_(one|other)$/, "")];
  });
}

const KNOWN_KEYS: ReadonlySet<string> = new Set(flattenKeys(en));

/** True when `value` names a message — used to tell a schema's key from zod's own text. */
export function isMessageKey(value: string): value is MessageKey {
  return KNOWN_KEYS.has(value);
}

i18next.use(LanguageDetector).init({
  resources: {
    en: { translation: en },
    sq: { translation: sq },
  },
  supportedLngs: [...SUPPORTED_LANGUAGES],
  // "en-US" from a browser resolves to "en".
  nonExplicitSupportedLngs: true,
  load: "languageOnly",
  fallbackLng: FALLBACK_LANGUAGE,
  preload: [...SUPPORTED_LANGUAGES],
  // Resources are inline, so there is nothing to await; the first request
  // must never race the init.
  initAsync: false,
  // Messages go out as JSON, not HTML.
  interpolation: { escapeValue: false },
  detection: {
    // The client sets Accept-Language on every call; ?lang= is for curl.
    order: ["querystring", "header"],
    lookupQuerystring: "lang",
    caches: false,
  },
});

export const i18n = i18next;

/** Express middleware: attaches `req.t` and `req.language`. Register before any route. */
export const i18nMiddleware = handle(i18next);

/**
 * Translate a message for this request. Prefer this over `req.t` in
 * controllers: the key is type-checked, and it still works for an error
 * raised before the middleware ran.
 */
export function t(req: Request, key: MessageKey, params?: MessageParams): string {
  const translate = req.t ?? i18next.getFixedT(FALLBACK_LANGUAGE);
  return String(translate(key, params ?? {}));
}
