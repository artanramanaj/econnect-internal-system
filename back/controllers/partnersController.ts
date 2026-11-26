import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { customError } from "../middlewares/errorHandler.js";
import { reservePartnerNumber } from "../services/documentSequence.js";
import { partnerQuerySchema, type CreatePartnerInput } from "../validators/partners.schema.js";
import { paginate } from "../utils/pagination.js";
import { t } from "../i18n/index.js";

/*
 * Partners, as far as the quote editor needs them: the client dropdown, a
 * quick-create, and a partner's sites. The full Clients screen is a later step.
 */

const partnerSelect = {
  id: true,
  partnerNumber: true,
  legalName: true,
  tradeName: true,
  fiscalNumber: true,
  city: true,
  email: true,
  phone: true,
  paymentTerms: true,
  isCustomer: true,
  isSupplier: true,
} as const satisfies Prisma.PartnerSelect;

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new customError("partners.invalidId", StatusCodes.BAD_REQUEST);
  }
  return id;
}

/** Active customers, for the client dropdown. */
export async function getPartners(req: Request, res: Response) {
  // Parsed here rather than by middleware: in Express 5 req.query is a
  // getter, so middleware cannot write the parsed value back.
  const parsed = partnerQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new customError("partners.invalidFilters", StatusCodes.BAD_REQUEST);
  }
  const { q, page, pageSize } = parsed.data;

  const where: Prisma.PartnerWhereInput = {
    isActive: true,
    isCustomer: true,
    ...(q
      ? {
          OR: [
            { legalName: { contains: q, mode: "insensitive" as const } },
            { tradeName: { contains: q, mode: "insensitive" as const } },
            { partnerNumber: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
            { fiscalNumber: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const total = await prisma.partner.count({ where });
  const { skip, take, meta } = paginate({ page, pageSize }, total);

  const partners = await prisma.partner.findMany({
    where,
    select: partnerSelect,
    orderBy: [{ legalName: "asc" }, { id: "asc" }],
    skip,
    take,
  });

  res.status(StatusCodes.OK).json({ partners, meta });
}

/**
 * Quick-create from the quote editor. The partner number comes from the same
 * gap-free sequence table as quote numbers, reserved in this transaction.
 */
export async function createPartner(req: Request, res: Response) {
  const input = req.body as CreatePartnerInput;

  const partner = await prisma.$transaction(async (tx) => {
    const partnerNumber = await reservePartnerNumber(tx);
    return tx.partner.create({
      data: {
        partnerNumber,
        legalName: input.legalName,
        tradeName: input.tradeName || null,
        businessNumber: input.businessNumber || null,
        fiscalNumber: input.fiscalNumber || null,
        vatNumber: input.vatNumber || null,
        billingAddress: input.billingAddress || null,
        city: input.city || null,
        email: input.email || null,
        phone: input.phone || null,
        paymentTerms: input.paymentTerms || null,
        isCustomer: true,
      },
      select: partnerSelect,
    });
  });

  res.status(StatusCodes.CREATED).json({
    message: t(req, "partners.added", { name: partner.legalName }),
    partner,
  });
}

/** A partner's active sites, for the editor's site dropdown. */
export async function getPartnerSites(req: Request, res: Response) {
  const id = parseId(req.params.id as string);

  const partner = await prisma.partner.findUnique({ where: { id }, select: { id: true } });
  if (!partner) {
    throw new customError("partners.notFound", StatusCodes.NOT_FOUND);
  }

  const sites = await prisma.site.findMany({
    where: { partnerId: id, isActive: true },
    select: { id: true, name: true, address: true, city: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  res.status(StatusCodes.OK).json({ sites });
}
