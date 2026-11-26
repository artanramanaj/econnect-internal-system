/**
 * Quoting constants: document numbering and the settings key for the approval
 * threshold.
 */

/** document_sequences.doc_type values and their prefixes. */
export const QUOTE_SEQUENCE = { docType: "QUOTE", prefix: "EC" } as const;
/** Partner numbers never restart, hence year 0. */
export const PARTNER_SEQUENCE = { docType: "PARTNER", prefix: "P", year: 0 } as const;

/**
 * app_settings key: a quote whose overall markup is below this percentage
 * needs an admin's approval before it can be sent.
 */
export const SETTING_MIN_MARKUP_PCT = "quote.min_markup_pct";

/**
 * What the seed writes for that setting, and what is used on a database that
 * was never seeded. The stored value always wins.
 */
export const DEFAULT_MIN_MARKUP_PCT = "10";

/** A quote longer than this is refused; the editor is not built for more. */
export const MAX_QUOTE_LINES = 300;

/** Decimal(14, 2): the largest total a column can hold is below this. */
export const MAX_TOTAL = "1000000000000";
