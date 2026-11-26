import fs from "node:fs";
import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { create as contentDisposition } from "content-disposition";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { customError } from "../middlewares/errorHandler.js";
import { hasPermission } from "../services/permissionService.js";
import { SYNC_OWNED_FIELDS, type SyncOwnedField } from "../constants/catalog.constants.js";
import {
  BROCHURES_DIR,
  brochureFileName,
  brochurePath,
  discardBrochure,
} from "../utils/brochureStorage.js";
import {
  itemQuerySchema,
  type CreateItemInput,
  type UpdateItemInput,
} from "../validators/items.schema.js";
import { paginate } from "../utils/pagination.js";
import { actorId } from "../utils/actor.js";
import { vatInForceToday } from "../utils/vat.js";
import { isUniqueViolation } from "../utils/prismaErrors.js";
import { t, type MessageKey } from "../i18n/index.js";

/** The full constraint name: isUniqueViolation matches by substring. */
const SKU_CONSTRAINT = "items_sku_key";

/** How many cost changes the drawer shows, newest first. */
const HISTORY_LIMIT = 20;

const listSelect = {
  id: true,
  sku: true,
  description: true,
  type: true,
  source: true,
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  manufacturer: true,
  barcode: true,
  baseUnitCode: true,
  vatCode: true,
  costPrice: true,
  isArchived: true,
  sourceId: true,
  // The stored file name stays on the server; the client only needs to know
  // that a brochure exists and what it was called.
  brochureName: true,
  brochureSize: true,
  lastSyncedAt: true,
  updatedAt: true,
} as const satisfies Prisma.ItemSelect;

const detailSelect = {
  ...listSelect,
  units: { select: { unitCode: true, factor: true }, orderBy: { unitCode: "asc" } },
  costHistory: {
    select: {
      id: true,
      oldCost: true,
      newCost: true,
      source: true,
      changedBy: true,
      changedAt: true,
    },
    // id follows insertion, so this is newest first with no ties.
    orderBy: { id: "desc" },
    take: HISTORY_LIMIT,
  },
} as const satisfies Prisma.ItemSelect;

/** Exactly the fields the sync owns; `satisfies` keeps it in step with SYNC_OWNED_FIELDS. */
const syncedSelect = {
  sku: true,
  description: true,
  categoryId: true,
  brandId: true,
  manufacturer: true,
  barcode: true,
  baseUnitCode: true,
  vatCode: true,
  costPrice: true,
} as const satisfies Record<SyncOwnedField, true>;

type ItemRow = Prisma.ItemGetPayload<{ select: typeof listSelect }>;
type ItemDetailRow = Prisma.ItemGetPayload<{ select: typeof detailSelect }>;
type SyncedValues = Prisma.ItemGetPayload<{ select: typeof syncedSelect }>;

/** Who may see cost prices: "See cost price & margin". Decided here, never by the client. */
function canViewItemCost(userId: number): Promise<boolean> {
  return hasPermission(userId, "quote.view_cost");
}

/**
 * Money leaves as a fixed four-place string: res.json would print a Decimal
 * as "12.5". The cost is omitted rather than nulled for users who may not see
 * it — hiding the column in the template would still ship every cost to the
 * browser.
 */
function toItem(row: ItemRow, withCost: boolean) {
  const { costPrice, brochureName, brochureSize, ...item } = row;
  const base = {
    ...item,
    brochure: brochureName === null ? null : { name: brochureName, size: brochureSize },
  };
  return withCost ? { ...base, costPrice: costPrice.toFixed(4) } : base;
}

async function toItemDetail(row: ItemDetailRow, withCost: boolean) {
  const { units, costHistory, ...item } = row;
  const detail = {
    ...toItem(item, withCost),
    units: units.map((unit) => ({ unitCode: unit.unitCode, factor: unit.factor.toFixed(4) })),
  };
  if (!withCost) return detail;

  const names = await usernames(costHistory.map((entry) => entry.changedBy));
  return {
    ...detail,
    costHistory: costHistory.map((entry) => ({
      id: entry.id,
      oldCost: entry.oldCost === null ? null : entry.oldCost.toFixed(4),
      newCost: entry.newCost.toFixed(4),
      source: entry.source,
      changedAt: entry.changedAt,
      changedBy: entry.changedBy === null ? null : (names.get(entry.changedBy) ?? null),
    })),
  };
}

/**
 * changedBy is a plain user id with no foreign key (like UserRole.assignedBy),
 * so the names come from one extra query rather than a join.
 */
async function usernames(ids: (number | null)[]): Promise<Map<number, string>> {
  const wanted = [...new Set(ids.filter((id): id is number => id !== null))];
  if (wanted.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: wanted } },
    select: { id: true, username: true },
  });
  return new Map(users.map((user) => [user.id, user.username]));
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new customError("items.invalidId", StatusCodes.BAD_REQUEST);
  }
  return id;
}

/**
 * The unique index is case-sensitive, so without this "CAM-01" and "cam-01"
 * could both exist and a quote could pick the wrong one. Concurrent creates
 * are still caught by the constraint itself (see the P2002 handling).
 */
async function assertSkuFree(
  db: Prisma.TransactionClient,
  sku: string,
  exceptId?: number,
): Promise<void> {
  const clash = await db.item.findFirst({
    where: {
      sku: { equals: sku, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { sku: true },
  });

  if (clash) {
    throw new customError("items.skuTaken", StatusCodes.CONFLICT, { params: { sku: clash.sku } });
  }
}

/**
 * Units have foreign keys, but checking first names the culprit instead of
 * failing with a constraint error. The VAT code has no foreign key (see
 * VatRate), so this is its only guard. Pass `vatCode` only when it changes:
 * an item keeps a rate that has since expired until someone picks a new one.
 */
async function assertReferences(
  db: Prisma.TransactionClient,
  refs: {
    baseUnitCode: string;
    unitCodes: string[];
    vatCode?: string;
    categoryId?: number | null;
    brandId?: number | null;
  },
): Promise<void> {
  if (refs.unitCodes.includes(refs.baseUnitCode)) {
    throw new customError("items.baseUnitRepeated", StatusCodes.BAD_REQUEST);
  }

  const wanted = [refs.baseUnitCode, ...refs.unitCodes];
  const found = await db.unit.findMany({
    where: { code: { in: wanted } },
    select: { code: true },
  });
  const known = new Set(found.map((unit) => unit.code));
  const missing = wanted.find((code) => !known.has(code));
  if (missing !== undefined) {
    throw new customError("items.unknownUnit", StatusCodes.BAD_REQUEST, {
      params: { code: missing },
    });
  }

  if (refs.vatCode !== undefined) {
    const rate = await db.vatRate.findFirst({
      where: { code: refs.vatCode, ...vatInForceToday() },
      select: { id: true },
    });
    if (!rate) {
      throw new customError("items.unknownVatCode", StatusCodes.BAD_REQUEST, {
        params: { code: refs.vatCode },
      });
    }
  }

  // null clears the dropdown and needs no lookup; the FK would catch a stale
  // id too, but checking first answers 400 instead of an untranslated 500.
  if (refs.categoryId != null) {
    const category = await db.category.findUnique({
      where: { id: refs.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new customError("items.unknownCategory", StatusCodes.BAD_REQUEST);
    }
  }
  if (refs.brandId != null) {
    const brand = await db.brand.findUnique({ where: { id: refs.brandId }, select: { id: true } });
    if (!brand) {
      throw new customError("items.unknownBrand", StatusCodes.BAD_REQUEST);
    }
  }
}

/**
 * True when the input would change a field the ProData sync owns. A value sent
 * back unchanged passes, so a form may submit everything it shows.
 */
function changesSyncedField(current: SyncedValues, input: UpdateItemInput): boolean {
  return SYNC_OWNED_FIELDS.some((field) => {
    const next = input[field];
    if (next === undefined) return false;
    if (field === "costPrice") return !current.costPrice.equals(next as number);
    // "" and null both mean "empty" for the optional text columns.
    return (next || null) !== current[field];
  });
}

/**
 * The search clause shared by the catalogue list and the quote editor's line
 * picker: `q` matches code, description or category name. The matching
 * category ids are resolved first (the table holds a few dozen rows) and the
 * OR gets a plain `categoryId IN (...)` branch: a relation filter would become
 * an EXISTS subquery Postgres cannot BitmapOr with the trigram indexes on sku
 * and description, degrading the whole search to a seq scan.
 */
async function textSearch(q: string): Promise<Prisma.ItemWhereInput> {
  const matchingCategoryIds = (
    await prisma.category.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true },
    })
  ).map((row) => row.id);

  return {
    OR: [
      { sku: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      ...(matchingCategoryIds.length ? [{ categoryId: { in: matchingCategoryIds } }] : []),
    ],
  };
}

/** How many matches the quote editor's line picker shows. */
const SEARCH_LIMIT = 20;

/**
 * GET /api/items/search?q= — active catalogue items for a quote line, each
 * with what the line will copy: code, description, unit, VAT code and the
 * rate in force today, and (for users who may see it) the cost.
 */
export async function searchItems(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (q.length < 2) {
    res.status(StatusCodes.OK).json({ items: [] });
    return;
  }

  const [rows, rates, withCost] = await Promise.all([
    prisma.item.findMany({
      where: { isArchived: false, ...(await textSearch(q)) },
      select: {
        id: true,
        sku: true,
        description: true,
        type: true,
        baseUnitCode: true,
        vatCode: true,
        costPrice: true,
        category: { select: { name: true } },
        brochureName: true,
      },
      orderBy: [{ description: "asc" }, { id: "asc" }],
      take: SEARCH_LIMIT,
    }),
    prisma.vatRate.findMany({ where: vatInForceToday(), select: { code: true, rate: true } }),
    canViewItemCost(actorId(req)),
  ]);

  const rateOf = new Map(rates.map((rate) => [rate.code, rate.rate.toFixed(2)]));

  res.status(StatusCodes.OK).json({
    items: rows.map(({ costPrice, category, brochureName, ...item }) => ({
      ...item,
      category: category?.name ?? null,
      hasBrochure: brochureName !== null,
      // null when the item's code has no rate in force: the editor then makes
      // the user pick one rather than guessing.
      vatRate: rateOf.get(item.vatCode) ?? null,
      ...(withCost ? { costPrice: costPrice.toFixed(4) } : {}),
    })),
  });
}

/** The catalogue list; see textSearch for how `q` is matched. */
export async function getItems(req: Request, res: Response) {
  // Parsed here rather than by middleware: in Express 5 req.query is a
  // getter, so middleware cannot write the parsed value back.
  const parsed = itemQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new customError("items.invalidFilters", StatusCodes.BAD_REQUEST);
  }
  const { q, type, source, categoryId, brandId, status, page, pageSize } = parsed.data;

  const where: Prisma.ItemWhereInput = {
    ...(status === "active" ? { isArchived: false } : {}),
    ...(status === "archived" ? { isArchived: true } : {}),
    ...(type ? { type } : {}),
    ...(source ? { source } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(brandId ? { brandId } : {}),
    ...(q ? await textSearch(q) : {}),
  };

  // Counted first so the page can be clamped before the rows are fetched.
  const total = await prisma.item.count({ where });
  const { skip, take, meta } = paginate({ page, pageSize }, total);

  const rows = await prisma.item.findMany({
    where,
    select: listSelect,
    // id last: descriptions repeat, and without a total order two rows could
    // swap between pages from one request to the next.
    orderBy: [{ isArchived: "asc" }, { description: "asc" }, { id: "asc" }],
    skip,
    take,
  });

  const withCost = await canViewItemCost(actorId(req));

  res.status(StatusCodes.OK).json({
    items: rows.map((row) => toItem(row, withCost)),
    canViewCost: withCost,
    meta,
  });
}

/**
 * Everything the item forms and the filters offer: units, the VAT rates in
 * force today, the managed category/brand lists, the distinct manufacturers
 * already in use, and which fields are locked on ProData items. Names are sent
 * as stored; the client renders units and VAT codes from its own translations.
 */
export async function getItemOptions(_req: Request, res: Response) {
  const [units, vatRates, categories, brands, manufacturers] = await Promise.all([
    prisma.unit.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.vatRate.findMany({
      where: vatInForceToday(),
      select: { code: true, name: true, rate: true },
      orderBy: [{ rate: "desc" }, { code: "asc" }],
    }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    // groupBy runs a real GROUP BY; findMany's `distinct` would fetch every
    // row and dedupe in memory. Manufacturer stays free text.
    prisma.item.groupBy({
      by: ["manufacturer"],
      where: { manufacturer: { not: null } },
      orderBy: { manufacturer: "asc" },
    }),
  ]);

  const present = (value: string | null): value is string => value !== null;

  res.status(StatusCodes.OK).json({
    units,
    vatRates: vatRates.map((rate) => ({
      code: rate.code,
      name: rate.name,
      rate: rate.rate.toFixed(2),
    })),
    categories,
    brands,
    manufacturers: manufacturers.map((row) => row.manufacturer).filter(present),
    syncOwnedFields: SYNC_OWNED_FIELDS,
  });
}

/** One item with its alternative units and, for users who may see cost, its cost history. */
export async function getItem(req: Request, res: Response) {
  const id = parseId(req.params.id as string);

  const row = await prisma.item.findUnique({ where: { id }, select: detailSelect });
  if (!row) {
    throw new customError("items.notFound", StatusCodes.NOT_FOUND);
  }

  const withCost = await canViewItemCost(actorId(req));

  res.status(StatusCodes.OK).json({ item: await toItemDetail(row, withCost), canViewCost: withCost });
}

export async function createItem(req: Request, res: Response) {
  const input = req.body as CreateItemInput;
  const me = actorId(req);

  const withCost = await canViewItemCost(me);
  if (input.costPrice !== undefined && !withCost) {
    throw new customError("items.costHidden", StatusCodes.FORBIDDEN);
  }

  const units = input.units ?? [];
  await assertReferences(prisma, {
    baseUnitCode: input.baseUnitCode,
    unitCodes: units.map((unit) => unit.unitCode),
    vatCode: input.vatCode,
    categoryId: input.categoryId,
    brandId: input.brandId,
  });
  await assertSkuFree(prisma, input.sku);

  let row: ItemDetailRow;
  try {
    row = await prisma.item.create({
      data: {
        sku: input.sku,
        // Only the ProData sync creates PRODATA rows; anything made here is the app's own.
        source: "LOCAL",
        type: input.type,
        description: input.description,
        categoryId: input.categoryId ?? null,
        brandId: input.brandId ?? null,
        manufacturer: input.manufacturer || null,
        barcode: input.barcode || null,
        baseUnitCode: input.baseUnitCode,
        vatCode: input.vatCode,
        units: {
          create: units.map((unit) => ({ unitCode: unit.unitCode, factor: unit.factor })),
        },
        // A cost given at creation opens the history (old cost null); no cost
        // given leaves the column at its default of 0 and the history empty.
        ...(input.costPrice !== undefined
          ? {
              costPrice: input.costPrice,
              costHistory: {
                create: { oldCost: null, newCost: input.costPrice, source: "LOCAL", changedBy: me },
              },
            }
          : {}),
      },
      select: detailSelect,
    });
  } catch (err) {
    // The pre-check cannot see a create racing this one; the constraint can.
    if (isUniqueViolation(err, SKU_CONSTRAINT)) {
      throw new customError("items.skuTaken", StatusCodes.CONFLICT, { params: { sku: input.sku } });
    }
    throw err;
  }

  res.status(StatusCodes.CREATED).json({
    message: t(req, "items.added", { sku: row.sku }),
    item: await toItemDetail(row, withCost),
  });
}

export async function updateItem(req: Request, res: Response) {
  const id = parseId(req.params.id as string);
  const input = req.body as UpdateItemInput;
  const me = actorId(req);

  const withCost = await canViewItemCost(me);
  if (input.costPrice !== undefined && !withCost) {
    throw new customError("items.costHidden", StatusCodes.FORBIDDEN);
  }

  let result: { row: ItemDetailRow; wasArchived: boolean };
  try {
    // One transaction, so the cost history records the cost this update
    // actually replaced, and the reference checks see the row being written.
    result = await prisma.$transaction(async (tx) => {
      const current = await tx.item.findUnique({
        where: { id },
        select: {
          ...syncedSelect,
          source: true,
          isArchived: true,
          units: { select: { unitCode: true } },
        },
      });
      if (!current) {
        throw new customError("items.notFound", StatusCodes.NOT_FOUND);
      }

      // The nightly sync would overwrite these anyway; refusing says where to
      // make the change instead of losing it at 22:00.
      if (current.source === "PRODATA" && changesSyncedField(current, input)) {
        throw new customError("items.syncManaged", StatusCodes.CONFLICT);
      }

      const vatChanged = input.vatCode !== undefined && input.vatCode !== current.vatCode;
      const categoryChanged =
        input.categoryId !== undefined && input.categoryId !== current.categoryId;
      const brandChanged = input.brandId !== undefined && input.brandId !== current.brandId;
      if (
        input.baseUnitCode !== undefined ||
        input.units !== undefined ||
        vatChanged ||
        categoryChanged ||
        brandChanged
      ) {
        await assertReferences(tx, {
          baseUnitCode: input.baseUnitCode ?? current.baseUnitCode,
          unitCodes: (input.units ?? current.units).map((unit) => unit.unitCode),
          ...(vatChanged ? { vatCode: input.vatCode } : {}),
          ...(categoryChanged ? { categoryId: input.categoryId } : {}),
          ...(brandChanged ? { brandId: input.brandId } : {}),
        });
      }

      if (input.sku !== undefined && input.sku !== current.sku) {
        await assertSkuFree(tx, input.sku, id);
      }

      const newCost =
        input.costPrice !== undefined && !current.costPrice.equals(input.costPrice)
          ? input.costPrice
          : undefined;

      const row = await tx.item.update({
        where: { id },
        data: {
          ...(input.sku !== undefined ? { sku: input.sku } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
          ...(input.manufacturer !== undefined
            ? { manufacturer: input.manufacturer || null }
            : {}),
          ...(input.barcode !== undefined ? { barcode: input.barcode || null } : {}),
          ...(input.baseUnitCode !== undefined ? { baseUnitCode: input.baseUnitCode } : {}),
          ...(input.vatCode !== undefined ? { vatCode: input.vatCode } : {}),
          ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
          ...(newCost !== undefined
            ? {
                costPrice: newCost,
                costHistory: {
                  create: {
                    oldCost: current.costPrice,
                    newCost,
                    source: "LOCAL",
                    changedBy: me,
                  },
                },
              }
            : {}),
          ...(input.units !== undefined
            ? {
                // Diffed rather than deleted and recreated, so a unit that is
                // kept keeps its id. The rows deleted and the rows upserted
                // never overlap, so the order Prisma runs them in is irrelevant.
                units: {
                  deleteMany: { unitCode: { notIn: input.units.map((unit) => unit.unitCode) } },
                  upsert: input.units.map((unit) => ({
                    where: { itemId_unitCode: { itemId: id, unitCode: unit.unitCode } },
                    create: { unitCode: unit.unitCode, factor: unit.factor },
                    update: { factor: unit.factor },
                  })),
                },
              }
            : {}),
        },
        select: detailSelect,
      });

      return { row, wasArchived: current.isArchived };
    });
  } catch (err) {
    if (isUniqueViolation(err, SKU_CONSTRAINT)) {
      throw new customError("items.skuTaken", StatusCodes.CONFLICT, {
        params: { sku: input.sku ?? "" },
      });
    }
    throw err;
  }

  const { row, wasArchived } = result;
  const message: MessageKey =
    input.isArchived === undefined || input.isArchived === wasArchived
      ? "items.updated"
      : input.isArchived
        ? "items.archived"
        : "items.restored";

  res.status(StatusCodes.OK).json({
    message: t(req, message, { sku: row.sku }),
    item: await toItemDetail(row, withCost),
  });
}

export async function deleteItem(req: Request, res: Response) {
  const id = parseId(req.params.id as string);

  const row = await prisma.item.findUnique({
    where: { id },
    select: { id: true, sku: true, source: true, brochureFile: true },
  });
  if (!row) {
    throw new customError("items.notFound", StatusCodes.NOT_FOUND);
  }

  // The sync would bring it back at 22:00; archiving is how a ProData item is
  // hidden. Once quote lines reference items, this is also where a "still
  // used" check belongs, like positions.stillHeld.
  if (row.source === "PRODATA") {
    throw new customError("items.syncManagedDelete", StatusCodes.CONFLICT);
  }

  // Alternative units and cost history cascade.
  await prisma.item.delete({ where: { id } });
  // Only after the delete went through: a refused delete must keep its file.
  discardBrochure(row.brochureFile);

  res.status(StatusCodes.OK).json({ message: t(req, "items.deleted", { sku: row.sku }), id });
}

/* ---------- brochure (one PDF per item) ---------- */

/**
 * Attach or replace the item's PDF. Not sync-owned: a datasheet can be put on
 * a ProData item too, since the sync never touches these columns. Write order
 * matters — new file to disk, then the row, then drop the old file — so a
 * crash can at worst orphan a file, never leave the row pointing at nothing.
 */
export async function uploadItemBrochure(req: Request, res: Response) {
  const id = parseId(req.params.id as string);
  const me = actorId(req);

  const file = req.file;
  if (!file) {
    throw new customError("items.brochureRequired", StatusCodes.BAD_REQUEST);
  }
  // The real check: extension and mimetype are client-asserted, the magic
  // bytes are not. Every PDF starts with "%PDF-".
  if (
    !file.originalname.toLowerCase().endsWith(".pdf") ||
    file.buffer.length < 5 ||
    !file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))
  ) {
    throw new customError("items.brochureInvalid", StatusCodes.BAD_REQUEST);
  }

  const current = await prisma.item.findUnique({
    where: { id },
    select: { id: true, brochureFile: true },
  });
  if (!current) {
    throw new customError("items.notFound", StatusCodes.NOT_FOUND);
  }

  const storedName = brochureFileName(id);
  // wx: fail rather than overwrite, should the generated name ever collide.
  await fs.promises.writeFile(brochurePath(storedName), file.buffer, { flag: "wx" });

  let row: ItemDetailRow;
  try {
    row = await prisma.item.update({
      where: { id },
      data: {
        brochureFile: storedName,
        // The column is VarChar(255); keep the end so ".pdf" survives.
        brochureName: file.originalname.slice(-255),
        brochureSize: file.size,
      },
      select: detailSelect,
    });
  } catch (err) {
    discardBrochure(storedName);
    throw err;
  }
  discardBrochure(current.brochureFile);

  const withCost = await canViewItemCost(me);
  res.status(StatusCodes.OK).json({
    message: t(req, "items.brochureUploaded", { sku: row.sku }),
    item: await toItemDetail(row, withCost),
  });
}

/**
 * Streams the PDF inline. sendFile brings Range/ETag/304 handling and, via
 * `root`, path containment for free; its errors arrive in the callback rather
 * than the promise chain, so ENOENT is mapped there.
 */
export async function getItemBrochure(req: Request, res: Response, next: NextFunction) {
  const id = parseId(req.params.id as string);

  const row = await prisma.item.findUnique({
    where: { id },
    select: { sku: true, brochureFile: true, brochureName: true },
  });
  if (!row) {
    throw new customError("items.notFound", StatusCodes.NOT_FOUND);
  }
  if (!row.brochureFile) {
    throw new customError("items.brochureMissing", StatusCodes.NOT_FOUND);
  }

  res.sendFile(
    row.brochureFile,
    {
      root: BROCHURES_DIR,
      headers: {
        "Content-Type": "application/pdf",
        // contentDisposition emits the RFC 5987 filename* form, which
        // encodeURIComponent alone would get wrong for names with quotes.
        "Content-Disposition": contentDisposition(row.brochureName ?? `${row.sku}.pdf`, {
          type: "inline",
        }),
      },
    },
    (err?: Error) => {
      if (!err) return;
      if (res.headersSent) {
        // Broke mid-stream; nothing clean can be sent any more.
        res.end();
        return;
      }
      next(
        (err as NodeJS.ErrnoException).code === "ENOENT"
          ? // The row says there is a file but the disk disagrees.
            new customError("items.brochureMissing", StatusCodes.NOT_FOUND)
          : err,
      );
    },
  );
}

export async function deleteItemBrochure(req: Request, res: Response) {
  const id = parseId(req.params.id as string);
  const me = actorId(req);

  const current = await prisma.item.findUnique({
    where: { id },
    select: { id: true, brochureFile: true },
  });
  if (!current) {
    throw new customError("items.notFound", StatusCodes.NOT_FOUND);
  }
  if (!current.brochureFile) {
    throw new customError("items.brochureMissing", StatusCodes.NOT_FOUND);
  }

  const row = await prisma.item.update({
    where: { id },
    data: { brochureFile: null, brochureName: null, brochureSize: null },
    select: detailSelect,
  });
  discardBrochure(current.brochureFile);

  const withCost = await canViewItemCost(me);
  res.status(StatusCodes.OK).json({
    message: t(req, "items.brochureRemoved", { sku: row.sku }),
    item: await toItemDetail(row, withCost),
  });
}
