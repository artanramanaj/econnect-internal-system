import type { Prisma } from "../generated/prisma/client.js";
import { PARTNER_SEQUENCE, QUOTE_SEQUENCE } from "../constants/quote.constants.js";

/**
 * Gap-free document numbers.
 *
 * The sequence row is locked with SELECT ... FOR UPDATE inside the caller's
 * transaction, so two documents can never take the same number, and a
 * transaction that rolls back hands its number back. A Postgres sequence
 * would be simpler but skips numbers on rollback, and gap-free numbering is a
 * legal requirement for quotes.
 *
 * Always pass the transaction client of the transaction that creates the
 * document — reserving outside it would defeat both guarantees.
 */
async function reserve(
  tx: Prisma.TransactionClient,
  docType: string,
  year: number,
  prefix: string,
): Promise<{ prefix: string; number: number }> {
  // The first document of a year creates its row. A concurrent first document
  // waits on the unique index here, then finds the row below.
  await tx.$executeRaw`
    INSERT INTO document_sequences (doc_type, year, prefix, next_number)
    VALUES (${docType}, ${year}, ${prefix}, 1)
    ON CONFLICT (doc_type, year) DO NOTHING`;

  const rows = await tx.$queryRaw<{ id: number; prefix: string; next_number: number }[]>`
    SELECT id, prefix, next_number
    FROM document_sequences
    WHERE doc_type = ${docType} AND year = ${year}
    FOR UPDATE`;
  const row = rows[0];
  if (!row) {
    throw new Error(`document sequence ${docType}/${year} is missing`);
  }

  await tx.$executeRaw`
    UPDATE document_sequences SET next_number = next_number + 1 WHERE id = ${row.id}`;

  // The stored prefix wins, so changing it in the table changes the numbers.
  return { prefix: row.prefix, number: row.next_number };
}

const pad = (n: number) => String(n).padStart(4, "0");

/** EC-2026-0001. The sequence restarts every calendar year. */
export async function reserveQuoteNumber(
  tx: Prisma.TransactionClient,
  year: number = new Date().getFullYear(),
): Promise<string> {
  const { prefix, number } = await reserve(tx, QUOTE_SEQUENCE.docType, year, QUOTE_SEQUENCE.prefix);
  return `${prefix}-${year}-${pad(number)}`;
}

/** P-0001. Never restarts. */
export async function reservePartnerNumber(tx: Prisma.TransactionClient): Promise<string> {
  const { prefix, number } = await reserve(
    tx,
    PARTNER_SEQUENCE.docType,
    PARTNER_SEQUENCE.year,
    PARTNER_SEQUENCE.prefix,
  );
  return `${prefix}-${pad(number)}`;
}
