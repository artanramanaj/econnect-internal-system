import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Decimal } from "decimal.js";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { QuoteStatus } from "../generated/prisma/enums.js";
import { customError } from "../middlewares/errorHandler.js";
import { hasPermission } from "../services/permissionService.js";
import {
  approveQuote,
  createQuote,
  rejectQuote,
  saveRevision,
  type SaveOutcome,
} from "../services/quoteService.js";
import { totalise } from "../services/quotePricing.js";
import { EDITABLE_STATUSES } from "../services/quoteStatus.js";
import { getMinMarkupPct } from "../services/settingsService.js";
import {
  quoteQuerySchema,
  type CreateQuoteInput,
  type RejectQuoteInput,
  type UpdateQuoteInput,
} from "../validators/quotes.schema.js";
import { paginate } from "../utils/pagination.js";
import { actorId } from "../utils/actor.js";
import { vatInForceToday } from "../utils/vat.js";
import { t } from "../i18n/index.js";

/*
 * Reads and DTOs for quotes. Writes go through services/quoteService.ts, which
 * owns the rules; this file validates, maps and translates.
 *
 * Money leaves as fixed strings ("1080.00"), never as numbers. Cost, markup
 * and the internal totals are omitted — not nulled — for users without
 * quote.view_cost, the same way the catalogue hides cost.
 */

const userSelect = {
  id: true,
  username: true,
  employee: { select: { firstName: true, lastName: true } },
} as const satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

/** The person's name when the account has an employee, else the username. */
function toPerson(user: UserRow) {
  const name = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.username;
  return { id: user.id, name };
}

const partnerSelect = {
  id: true,
  partnerNumber: true,
  legalName: true,
  tradeName: true,
  city: true,
} as const satisfies Prisma.PartnerSelect;

const lineSelect = {
  id: true,
  sortOrder: true,
  section: true,
  kind: true,
  itemId: true,
  sku: true,
  description: true,
  unitCode: true,
  quantity: true,
  unitCost: true,
  markupPct: true,
  unitPrice: true,
  lineCost: true,
  lineTotal: true,
  vatCode: true,
  vatRate: true,
} as const satisfies Prisma.QuoteLineSelect;

const revisionHeadSelect = {
  id: true,
  revisionMajor: true,
  revisionMinor: true,
  kind: true,
  isCurrent: true,
  isLocked: true,
  subtotal: true,
  totalCost: true,
  overallMarkupPct: true,
  vatTotal: true,
  grandTotal: true,
  approvalStatus: true,
  approvedAt: true,
  rejectionNote: true,
  createdAt: true,
  createdBy: { select: userSelect },
  approvedBy: { select: userSelect },
} as const satisfies Prisma.QuoteRevisionSelect;

const detailSelect = {
  id: true,
  quoteNumber: true,
  title: true,
  label: true,
  status: true,
  validUntil: true,
  paymentTerms: true,
  notes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  partner: { select: partnerSelect },
  site: { select: { id: true, name: true } },
  createdBy: { select: userSelect },
  _count: { select: { revisions: true } },
  revisions: {
    where: { isCurrent: true },
    select: { ...revisionHeadSelect, lines: { select: lineSelect, orderBy: { sortOrder: "asc" } } },
  },
} as const satisfies Prisma.QuoteSelect;

const listSelect = {
  id: true,
  quoteNumber: true,
  title: true,
  label: true,
  status: true,
  createdAt: true,
  partner: { select: partnerSelect },
  createdBy: { select: userSelect },
  _count: { select: { revisions: true } },
  revisions: {
    where: { isCurrent: true },
    select: {
      revisionMajor: true,
      revisionMinor: true,
      subtotal: true,
      grandTotal: true,
      overallMarkupPct: true,
      approvalStatus: true,
    },
  },
} as const satisfies Prisma.QuoteSelect;

type RevisionHeadRow = Prisma.QuoteRevisionGetPayload<{ select: typeof revisionHeadSelect }>;
type LineRow = Prisma.QuoteLineGetPayload<{ select: typeof lineSelect }>;
type DetailRow = Prisma.QuoteGetPayload<{ select: typeof detailSelect }>;
type ListRow = Prisma.QuoteGetPayload<{ select: typeof listSelect }>;

/** Who may see cost, markup and the internal totals. Decided here, never by the client. */
function canViewCost(userId: number): Promise<boolean> {
  return hasPermission(userId, "quote.view_cost");
}

/** "1.2" */
function versionLabel(revision: { revisionMajor: number; revisionMinor: number }): string {
  return `${revision.revisionMajor}.${revision.revisionMinor}`;
}

/** A DATE column as the calendar day it holds. */
function toDay(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

function toLine(row: LineRow, withCost: boolean) {
  const { unitCost, markupPct, lineCost, quantity, unitPrice, lineTotal, vatRate, ...line } = row;
  const base = {
    ...line,
    quantity: quantity.toFixed(4),
    unitPrice: unitPrice.toFixed(4),
    lineTotal: lineTotal.toFixed(2),
    vatRate: vatRate.toFixed(2),
  };
  return withCost
    ? {
        ...base,
        unitCost: unitCost.toFixed(4),
        markupPct: markupPct === null ? null : markupPct.toFixed(4),
        lineCost: lineCost.toFixed(2),
      }
    : base;
}

function toRevisionHead(row: RevisionHeadRow, withCost: boolean) {
  const base = {
    id: row.id,
    version: versionLabel(row),
    kind: row.kind,
    isCurrent: row.isCurrent,
    isLocked: row.isLocked,
    subtotal: row.subtotal.toFixed(2),
    vatTotal: row.vatTotal.toFixed(2),
    grandTotal: row.grandTotal.toFixed(2),
    approvalStatus: row.approvalStatus,
    approvedBy: row.approvedBy ? toPerson(row.approvedBy) : null,
    approvedAt: row.approvedAt,
    rejectionNote: row.rejectionNote,
    createdBy: toPerson(row.createdBy),
    createdAt: row.createdAt,
  };
  return withCost
    ? {
        ...base,
        totalCost: row.totalCost.toFixed(2),
        overallMarkupPct: row.overallMarkupPct === null ? null : row.overallMarkupPct.toFixed(4),
      }
    : base;
}

function toDetail(row: DetailRow, withCost: boolean) {
  const { revisions, _count, validUntil, partner, createdBy, ...quote } = row;
  const current = revisions[0];
  if (!current) {
    throw new Error(`quote ${row.id} has no current revision`);
  }
  const { lines, ...head } = current;

  // The VAT bands are not stored; they follow from the stored lines.
  const { vatBreakdown } = totalise(
    lines.map((line) => ({
      lineTotal: new Decimal(line.lineTotal.toString()),
      lineCost: new Decimal(line.lineCost.toString()),
      vatRate: new Decimal(line.vatRate.toString()),
    })),
  );

  return {
    ...quote,
    validUntil: toDay(validUntil),
    partner,
    createdBy: toPerson(createdBy),
    revisionCount: _count.revisions,
    revision: {
      ...toRevisionHead(head, withCost),
      vatBreakdown: vatBreakdown.map((band) => ({
        rate: band.rate.toFixed(2),
        base: band.base.toFixed(2),
        vat: band.vat.toFixed(2),
      })),
      lines: lines.map((line) => toLine(line, withCost)),
    },
  };
}

function toListRow(row: ListRow, withCost: boolean) {
  const current = row.revisions[0];
  const base = {
    id: row.id,
    quoteNumber: row.quoteNumber,
    title: row.title,
    label: row.label,
    status: row.status,
    createdAt: row.createdAt,
    partner: row.partner,
    createdBy: toPerson(row.createdBy),
    version: current ? versionLabel(current) : null,
    revisionCount: row._count.revisions,
    subtotal: current ? current.subtotal.toFixed(2) : null,
    grandTotal: current ? current.grandTotal.toFixed(2) : null,
    approvalStatus: current?.approvalStatus ?? null,
  };
  return withCost
    ? {
        ...base,
        overallMarkupPct:
          current?.overallMarkupPct == null ? null : current.overallMarkupPct.toFixed(4),
      }
    : base;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new customError("quotes.invalidId", StatusCodes.BAD_REQUEST);
  }
  return id;
}

async function loadDetail(id: number, withCost: boolean) {
  const row = await prisma.quote.findUnique({ where: { id }, select: detailSelect });
  if (!row) {
    throw new customError("quotes.notFound", StatusCodes.NOT_FOUND);
  }
  return toDetail(row, withCost);
}

/** The list. `q` matches the quote number, the title or the partner's name. */
export async function getQuotes(req: Request, res: Response) {
  // Parsed here rather than by middleware: in Express 5 req.query is a
  // getter, so middleware cannot write the parsed value back.
  const parsed = quoteQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new customError("quotes.invalidFilters", StatusCodes.BAD_REQUEST);
  }
  const { q, partnerId, createdById, dateFrom, dateTo, status, sortBy, sortDir, page, pageSize } =
    parsed.data;

  // Everything but the status: the status views show their counts under the
  // other filters, so "Drafts 3" stays true while a client is selected.
  const filters: Prisma.QuoteWhereInput = {
    ...(partnerId ? { partnerId } : {}),
    ...(createdById ? { createdById } : {}),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00Z`) } : {}),
            // Up to the end of the "to" day.
            ...(dateTo ? { lt: new Date(Date.parse(`${dateTo}T00:00:00Z`) + 86_400_000) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { quoteNumber: { contains: q, mode: "insensitive" as const } },
            { title: { contains: q, mode: "insensitive" as const } },
            { partner: { legalName: { contains: q, mode: "insensitive" as const } } },
            { partner: { tradeName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const where: Prisma.QuoteWhereInput = { ...filters, ...(status ? { status } : {}) };

  const [total, byStatus] = await Promise.all([
    prisma.quote.count({ where }),
    prisma.quote.groupBy({ by: ["status"], where: filters, _count: { _all: true } }),
  ]);
  const { skip, take, meta } = paginate({ page, pageSize }, total);

  const rows = await prisma.quote.findMany({
    where,
    select: listSelect,
    // id last: without a total order two rows could swap between pages.
    orderBy: [{ [sortBy]: sortDir }, { id: "desc" }],
    skip,
    take,
  });

  const statusCounts: Record<string, number> = { ALL: 0 };
  for (const code of Object.values(QuoteStatus)) statusCounts[code] = 0;
  for (const group of byStatus) {
    statusCounts[group.status] = group._count._all;
    statusCounts.ALL! += group._count._all;
  }

  const withCost = await canViewCost(actorId(req));

  res.status(StatusCodes.OK).json({
    quotes: rows.map((row) => toListRow(row, withCost)),
    statusCounts,
    canViewCost: withCost,
    meta,
  });
}

/**
 * Everything the list filters and the editor offer: the people who have
 * written quotes, the units, the VAT rates in force today, and the approval
 * threshold the editor warns against.
 */
export async function getQuoteOptions(req: Request, res: Response) {
  const me = actorId(req);
  const [authors, units, vatRates, threshold, withCost, canApprove] = await Promise.all([
    prisma.user.findMany({
      where: { quotes: { some: {} } },
      select: userSelect,
      orderBy: { username: "asc" },
    }),
    prisma.unit.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.vatRate.findMany({
      where: vatInForceToday(),
      select: { code: true, name: true, rate: true },
      orderBy: [{ rate: "desc" }, { code: "asc" }],
    }),
    getMinMarkupPct(),
    canViewCost(me),
    hasPermission(me, "quote.approve"),
  ]);

  res.status(StatusCodes.OK).json({
    authors: authors.map(toPerson),
    units,
    vatRates: vatRates.map((rate) => ({
      code: rate.code,
      name: rate.name,
      rate: rate.rate.toFixed(2),
    })),
    minMarkupPct: threshold.toFixed(2),
    editableStatuses: EDITABLE_STATUSES,
    canViewCost: withCost,
    canApprove,
  });
}

/** The quote with its current revision and that revision's lines. */
export async function getQuote(req: Request, res: Response) {
  const id = parseId(req.params.id as string);
  const withCost = await canViewCost(actorId(req));

  res.status(StatusCodes.OK).json({ quote: await loadDetail(id, withCost), canViewCost: withCost });
}

/** Every revision's header, newest first. Lines are served for the current one only. */
export async function getQuoteRevisions(req: Request, res: Response) {
  const id = parseId(req.params.id as string);

  const quote = await prisma.quote.findUnique({ where: { id }, select: { id: true } });
  if (!quote) {
    throw new customError("quotes.notFound", StatusCodes.NOT_FOUND);
  }

  const rows = await prisma.quoteRevision.findMany({
    where: { quoteId: id },
    select: revisionHeadSelect,
    orderBy: [{ revisionMajor: "desc" }, { revisionMinor: "desc" }],
  });
  const withCost = await canViewCost(actorId(req));

  res.status(StatusCodes.OK).json({ revisions: rows.map((row) => toRevisionHead(row, withCost)) });
}

/**
 * The message for a save, and the fresh quote. A save below the threshold
 * says so, with the threshold: held for approval when the saver may not
 * approve, a warning only when they may. `lowMarkup` lets the client show it
 * as a warning rather than a plain success.
 */
async function respondSaved(
  req: Request,
  res: Response,
  outcome: SaveOutcome,
  statusCode: number,
  created: boolean,
) {
  const quote = await loadDetail(outcome.id, true);
  const params = { number: quote.quoteNumber, version: quote.revision.version };
  const threshold = async () => (await getMinMarkupPct()).toDecimalPlaces(2).toString();

  let message: string;
  if (outcome.status === "PENDING_APPROVAL") {
    message = t(req, "quotes.savedPending", { ...params, threshold: await threshold() });
  } else if (outcome.lowMarkup) {
    // Loaded with cost above, so the markup is there; `in` narrows the DTO.
    const markup = "overallMarkupPct" in quote.revision ? quote.revision.overallMarkupPct : null;
    message = t(req, "quotes.savedLowMarkup", {
      ...params,
      markup: markup == null ? "0" : new Decimal(markup).toDecimalPlaces(2).toString(),
      threshold: await threshold(),
    });
  } else {
    message = t(req, created ? "quotes.created" : "quotes.saved", params);
  }

  res.status(statusCode).json({ message, quote, lowMarkup: outcome.lowMarkup });
}

export async function postQuote(req: Request, res: Response) {
  const outcome = await createQuote(req.body as CreateQuoteInput, actorId(req));
  await respondSaved(req, res, outcome, StatusCodes.CREATED, true);
}

export async function putQuote(req: Request, res: Response) {
  const id = parseId(req.params.id as string);
  const outcome = await saveRevision(id, req.body as UpdateQuoteInput, actorId(req));
  await respondSaved(req, res, outcome, StatusCodes.OK, false);
}

export async function postApprove(req: Request, res: Response) {
  const id = parseId(req.params.id as string);
  const me = actorId(req);
  const outcome = await approveQuote(id, me);
  const quote = await loadDetail(outcome.id, await canViewCost(me));

  res
    .status(StatusCodes.OK)
    .json({ message: t(req, "quotes.approved", { number: quote.quoteNumber }), quote });
}

export async function postReject(req: Request, res: Response) {
  const id = parseId(req.params.id as string);
  const me = actorId(req);
  const { note } = req.body as RejectQuoteInput;
  const outcome = await rejectQuote(id, me, note);
  const quote = await loadDetail(outcome.id, await canViewCost(me));

  res
    .status(StatusCodes.OK)
    .json({ message: t(req, "quotes.rejected", { number: quote.quoteNumber }), quote });
}
