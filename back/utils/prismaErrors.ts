/**
 * Detect which column or constraint a P2002 unique violation hit.
 *
 * Prisma 7 with a driver adapter does NOT populate `meta.target`; it reports the
 * constraint under `meta.driverAdapterError.cause`. Both shapes are checked so
 * this keeps working if the adapter is swapped out.
 *
 * Matching is by substring against the constraint name and the driver's
 * message, so pass something only that constraint contains: a column name
 * where it is unambiguous ("username"), otherwise the full constraint name
 * ("items_sku_key").
 */
export function isUniqueViolation(err: unknown, field: string): boolean {
  if (typeof err !== "object" || err === null) return false;

  const e = err as {
    code?: string;
    meta?: {
      target?: unknown;
      driverAdapterError?: {
        cause?: {
          constraint?: { index?: string; fields?: string[] };
          originalMessage?: string;
        };
      };
    };
  };

  if (e.code !== "P2002") return false;

  const cause = e.meta?.driverAdapterError?.cause;
  const candidates: string[] = [
    ...(Array.isArray(e.meta?.target) ? e.meta.target.map(String) : [String(e.meta?.target ?? "")]),
    cause?.constraint?.index ?? "",
    ...(cause?.constraint?.fields ?? []),
    cause?.originalMessage ?? "",
  ];

  return candidates.some((c) => c.includes(field));
}
