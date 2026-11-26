import { Decimal } from "decimal.js";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { ApprovalStatus, QuoteStatus } from "../generated/prisma/enums.js";
import { customError } from "../middlewares/errorHandler.js";
import { MAX_TOTAL } from "../constants/quote.constants.js";
import type {
  CreateQuoteInput,
  QuoteLineInput,
  UpdateQuoteInput,
} from "../validators/quotes.schema.js";
import { reserveQuoteNumber } from "./documentSequence.js";
import { hasPermission } from "./permissionService.js";
import { getMinMarkupPct } from "./settingsService.js";
import {
  needsApproval,
  priceLine,
  totalise,
  type PricedLine,
  type QuoteTotals,
} from "./quotePricing.js";
import {
  approvalOnSave,
  canTransition,
  isEditable,
  statusAfterSave,
  type SaveApproval,
} from "./quoteStatus.js";

/*
 * Every write to a quote. Controllers validate and translate; the rules live
 * here:
 *  - a quote and its revision 1.0 are created together, with the number
 *    reserved in that same transaction (gap-free);
 *  - a save never touches an existing revision's figures — it retires the
 *    current one and creates the next;
 *  - the server recalculates every derived number, whatever the client sent;
 *  - every save re-runs the approval check, so an approval never outlives the
 *    figures it was given for. Below the threshold, an approver's own save is
 *    approved by them on the spot; anyone else's waits for an approver.
 */

type Tx = Prisma.TransactionClient;

interface Priced {
  lines: PricedLine[];
  totals: QuoteTotals;
}

function price(lines: QuoteLineInput[]): Priced {
  const priced = lines.map((line) =>
    priceLine({
      quantity: line.quantity,
      unitCost: line.unitCost,
      basis: line.basis,
      markupPct: line.markupPct,
      unitPrice: line.unitPrice,
      vatRate: line.vatRate,
    }),
  );
  const totals = totalise(priced);

  // Decimal(14, 2) columns: refuse here rather than fail in the database with
  // an error the client cannot be shown.
  const tooLarge =
    totals.grandTotal.greaterThanOrEqualTo(MAX_TOTAL) ||
    totals.totalCost.greaterThanOrEqualTo(MAX_TOTAL);
  if (tooLarge) {
    throw new customError("quotes.amountTooLarge", StatusCodes.BAD_REQUEST);
  }

  return { lines: priced, totals };
}

/**
 * The partner must exist and be active; the site, if any, must be one of that
 * partner's. Foreign keys would catch a wrong id too, but as an untranslated
 * 500 — and they cannot tell that a site belongs to someone else.
 */
async function assertPartnerAndSite(
  tx: Tx,
  partnerId: number,
  siteId: number | null,
  options: { checkPartner: boolean },
): Promise<void> {
  if (options.checkPartner) {
    const partner = await tx.partner.findFirst({
      where: { id: partnerId, isActive: true },
      select: { id: true },
    });
    if (!partner) {
      throw new customError("quotes.unknownPartner", StatusCodes.BAD_REQUEST);
    }
  }

  if (siteId !== null) {
    const site = await tx.site.findFirst({
      where: { id: siteId, partnerId, isActive: true },
      select: { id: true },
    });
    if (!site) {
      throw new customError("quotes.unknownSite", StatusCodes.BAD_REQUEST);
    }
  }
}

/**
 * What the lines point at must exist: units, catalogue items, and VAT. The
 * VAT rate is a snapshot sent by the client, so it is checked against every
 * rate that code has ever had — a line carried over from an older revision may
 * rightly hold a rate that is no longer in force, but never an invented one.
 */
async function assertLineReferences(tx: Tx, lines: QuoteLineInput[]): Promise<void> {
  const unitCodes = [...new Set(lines.map((line) => line.unitCode))];
  if (unitCodes.length) {
    const found = await tx.unit.findMany({
      where: { code: { in: unitCodes } },
      select: { code: true },
    });
    const known = new Set(found.map((unit) => unit.code));
    const missing = unitCodes.find((code) => !known.has(code));
    if (missing !== undefined) {
      throw new customError("quotes.unknownUnit", StatusCodes.BAD_REQUEST, {
        params: { code: missing },
      });
    }
  }

  const itemIds = [...new Set(lines.map((line) => line.itemId).filter((id) => id != null))];
  if (itemIds.length) {
    const found = await tx.item.count({ where: { id: { in: itemIds } } });
    if (found !== itemIds.length) {
      throw new customError("quotes.unknownItem", StatusCodes.BAD_REQUEST);
    }
  }

  const vatCodes = [...new Set(lines.map((line) => line.vatCode))];
  if (vatCodes.length) {
    const rates = await tx.vatRate.findMany({
      where: { code: { in: vatCodes } },
      select: { code: true, rate: true },
    });
    for (const line of lines) {
      const ok = rates.some((rate) => rate.code === line.vatCode && rate.rate.equals(line.vatRate));
      if (!ok) {
        throw new customError("quotes.unknownVatRate", StatusCodes.BAD_REQUEST, {
          params: { code: line.vatCode, rate: line.vatRate },
        });
      }
    }
  }
}

/** Decimals go to Prisma as fixed strings, never as numbers. */
function lineRows(lines: QuoteLineInput[], priced: PricedLine[]) {
  return lines.map((line, index) => {
    const p = priced[index]!;
    return {
      sortOrder: index + 1,
      section: line.section || null,
      kind: line.kind,
      itemId: line.itemId ?? null,
      sku: line.sku || null,
      description: line.description,
      unitCode: line.unitCode,
      quantity: p.quantity.toFixed(4),
      unitCost: p.unitCost.toFixed(4),
      markupPct: p.markupPct === null ? null : p.markupPct.toFixed(4),
      unitPrice: p.unitPrice.toFixed(4),
      lineCost: p.lineCost.toFixed(2),
      lineTotal: p.lineTotal.toFixed(2),
      vatCode: line.vatCode,
      vatRate: p.vatRate.toFixed(2),
    };
  });
}

function totalColumns(totals: QuoteTotals) {
  return {
    subtotal: totals.subtotal.toFixed(2),
    totalCost: totals.totalCost.toFixed(2),
    overallMarkupPct:
      totals.overallMarkupPct === null ? null : clampMarkup(totals.overallMarkupPct).toFixed(4),
    vatTotal: totals.vatTotal.toFixed(2),
    grandTotal: totals.grandTotal.toFixed(2),
  };
}

/**
 * Decimal(9, 4) holds up to 99999.9999. A near-zero cost can push the overall
 * markup past that; the exact figure stops mattering long before, so it is
 * capped rather than allowed to fail the save.
 */
function clampMarkup(value: Decimal): Decimal {
  const limit = new Decimal("99999.9999");
  return Decimal.min(Decimal.max(value, limit.negated()), limit);
}

function headerColumns(input: CreateQuoteInput | UpdateQuoteInput) {
  return {
    siteId: input.siteId ?? null,
    title: input.title,
    label: input.label || null,
    // A DATE column: midnight UTC stores exactly the calendar day.
    validUntil: input.validUntil ? new Date(`${input.validUntil}T00:00:00Z`) : null,
    paymentTerms: input.paymentTerms || null,
    notes: input.notes || null,
  };
}

/** What a save decided, for the controller's message. */
export interface SaveOutcome {
  id: number;
  status: QuoteStatus;
  /** Overall markup below the threshold — held for approval or not. */
  lowMarkup: boolean;
}

interface SaveDecision {
  lowMarkup: boolean;
  approval: SaveApproval;
  status: QuoteStatus;
}

/** The approval check for one save, by the person saving it. */
async function decideOnSave(totals: QuoteTotals, userId: number): Promise<SaveDecision> {
  const [threshold, mayApprove] = await Promise.all([
    getMinMarkupPct(),
    hasPermission(userId, "quote.approve"),
  ]);
  const lowMarkup = needsApproval(totals.overallMarkupPct, threshold);
  const approval = approvalOnSave(lowMarkup, mayApprove);
  return { lowMarkup, approval, status: statusAfterSave(approval) };
}

/**
 * The new revision's approval columns. An approver's own low-markup save is
 * recorded as approved by them at save time, so the record shows who accepted
 * the thin margin even after the threshold changes.
 */
function approvalColumns(approval: SaveApproval, userId: number) {
  return approval === "APPROVED"
    ? { approvalStatus: approval, approvedById: userId, approvedAt: new Date() }
    : { approvalStatus: approval };
}

export async function createQuote(input: CreateQuoteInput, userId: number): Promise<SaveOutcome> {
  const { lines: priced, totals } = price(input.lines);
  const { lowMarkup, approval, status } = await decideOnSave(totals, userId);

  return prisma.$transaction(async (tx) => {
    await assertPartnerAndSite(tx, input.partnerId, input.siteId ?? null, { checkPartner: true });
    await assertLineReferences(tx, input.lines);

    // Reserved last, inside this transaction: anything that throws from here
    // on rolls the number back with everything else.
    const quoteNumber = await reserveQuoteNumber(tx);

    const quote = await tx.quote.create({
      data: {
        quoteNumber,
        partnerId: input.partnerId,
        ...headerColumns(input),
        status,
        createdById: userId,
        revisions: {
          create: {
            revisionMajor: 1,
            revisionMinor: 0,
            ...totalColumns(totals),
            ...approvalColumns(approval, userId),
            createdById: userId,
            lines: { create: lineRows(input.lines, priced) },
          },
        },
      },
      select: { id: true },
    });

    return { id: quote.id, status, lowMarkup };
  });
}

/**
 * Saves an edit as the next revision (1.0 → 1.1 → 1.2). The current revision
 * is retired — flagged, never rewritten — and its lines stay exactly as they
 * were.
 */
export async function saveRevision(
  id: number,
  input: UpdateQuoteInput,
  userId: number,
): Promise<SaveOutcome> {
  const { lines: priced, totals } = price(input.lines);
  const { lowMarkup, approval, status } = await decideOnSave(totals, userId);

  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id },
      select: {
        status: true,
        version: true,
        partnerId: true,
        revisions: {
          where: { isCurrent: true },
          select: { id: true, revisionMajor: true, revisionMinor: true },
        },
      },
    });
    if (!quote) {
      throw new customError("quotes.notFound", StatusCodes.NOT_FOUND);
    }
    if (!isEditable(quote.status) || !canTransition(quote.status, status)) {
      throw new customError("quotes.notEditable", StatusCodes.CONFLICT);
    }
    if (quote.version !== input.version) {
      throw new customError("quotes.stale", StatusCodes.CONFLICT);
    }
    const current = quote.revisions[0];
    if (!current) {
      throw new Error(`quote ${id} has no current revision`);
    }

    await assertPartnerAndSite(tx, quote.partnerId, input.siteId ?? null, { checkPartner: false });
    await assertLineReferences(tx, input.lines);

    // The version is part of the WHERE, so of two saves racing from the same
    // loaded version exactly one matches; the other is told it is stale.
    const bumped = await tx.quote.updateMany({
      where: { id, version: input.version },
      data: { ...headerColumns(input), status, version: { increment: 1 } },
    });
    if (bumped.count !== 1) {
      throw new customError("quotes.stale", StatusCodes.CONFLICT);
    }

    await tx.quoteRevision.update({
      where: { id: current.id },
      data: { isCurrent: false, isLocked: true },
    });

    await tx.quoteRevision.create({
      data: {
        quoteId: id,
        revisionMajor: current.revisionMajor,
        revisionMinor: current.revisionMinor + 1,
        ...totalColumns(totals),
        // A fresh revision starts with a fresh approval state: whatever was
        // approved or rejected before applied to other figures.
        ...approvalColumns(approval, userId),
        createdById: userId,
        lines: { create: lineRows(input.lines, priced) },
      },
    });

    return { id, status, lowMarkup };
  });
}

/**
 * An approver's decision on a quote that is waiting for approval — one saved
 * by someone without quote.approve, since an approver's own save is never
 * held. The guard against deciding on one's own revision stays for a saver
 * who has gained quote.approve since: they clear it by saving again.
 */
async function decide(
  id: number,
  userId: number,
  decision: Extract<ApprovalStatus, "APPROVED" | "REJECTED">,
  note: string | null,
): Promise<SaveOutcome> {
  const status: QuoteStatus = decision === "APPROVED" ? "READY_TO_SEND" : "DRAFT";

  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id },
      select: {
        status: true,
        revisions: { where: { isCurrent: true }, select: { id: true, createdById: true } },
      },
    });
    if (!quote) {
      throw new customError("quotes.notFound", StatusCodes.NOT_FOUND);
    }
    const current = quote.revisions[0];
    if (quote.status !== "PENDING_APPROVAL" || !current || !canTransition(quote.status, status)) {
      throw new customError("quotes.notPendingApproval", StatusCodes.CONFLICT);
    }
    if (current.createdById === userId) {
      throw new customError("quotes.cannotApproveOwn", StatusCodes.FORBIDDEN);
    }

    // Status in the WHERE: two admins deciding at once cannot both win.
    const moved = await tx.quote.updateMany({
      where: { id, status: "PENDING_APPROVAL" },
      data: { status, version: { increment: 1 } },
    });
    if (moved.count !== 1) {
      throw new customError("quotes.notPendingApproval", StatusCodes.CONFLICT);
    }

    await tx.quoteRevision.update({
      where: { id: current.id },
      data: {
        approvalStatus: decision,
        approvedById: userId,
        approvedAt: new Date(),
        rejectionNote: note,
      },
    });

    return { id, status, lowMarkup: true };
  });
}

export function approveQuote(id: number, userId: number): Promise<SaveOutcome> {
  return decide(id, userId, "APPROVED", null);
}

export function rejectQuote(id: number, userId: number, note: string): Promise<SaveOutcome> {
  return decide(id, userId, "REJECTED", note);
}
