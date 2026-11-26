import { Decimal } from "decimal.js";
import { prisma } from "../lib/prisma.js";
import {
  DEFAULT_MIN_MARKUP_PCT,
  SETTING_MIN_MARKUP_PCT,
} from "../constants/quote.constants.js";

/**
 * The overall markup (percent) below which a quote needs approval. Read from
 * app_settings on every call: it is one primary-key lookup, and a change made
 * by an admin applies to the very next save.
 */
export async function getMinMarkupPct(): Promise<Decimal> {
  const row = await prisma.appSetting.findUnique({
    where: { key: SETTING_MIN_MARKUP_PCT },
    select: { value: true },
  });

  try {
    return new Decimal(row?.value ?? DEFAULT_MIN_MARKUP_PCT);
  } catch {
    // A value someone mistyped into the table must not take quoting down.
    console.error(`[settings] ${SETTING_MIN_MARKUP_PCT} is not a number: "${row?.value}"`);
    return new Decimal(DEFAULT_MIN_MARKUP_PCT);
  }
}
