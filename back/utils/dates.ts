/**
 * Midnight UTC today. DATE columns (validFrom, validTo) have no clock, so this
 * is the value to store in them or compare them against.
 */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
