import type { Prisma } from "../generated/prisma/client.js";
import { startOfToday } from "./dates.js";

/** VAT rates in force today. The columns are DATEs, so compare against midnight UTC. */
export function vatInForceToday(): Prisma.VatRateWhereInput {
  const today = startOfToday();
  return {
    validFrom: { lte: today },
    OR: [{ validTo: null }, { validTo: { gte: today } }],
  };
}
