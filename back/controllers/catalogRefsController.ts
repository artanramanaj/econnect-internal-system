import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import { customError } from "../middlewares/errorHandler.js";
import type { CatalogRefInput } from "../validators/catalogRefs.schema.js";
import { paginationQuerySchema } from "../validators/pagination.schema.js";
import { paginate } from "../utils/pagination.js";
import { t, type MessageKey } from "../i18n/index.js";

/*
 * Categories and brands are the same thing twice: a unique name that items
 * point at (positionsController is the model for everything here). One set of
 * handlers is built per entity from a store of typed closures, because the two
 * Prisma delegates have no common type to abstract over.
 */

const listSelect = {
  id: true,
  name: true,
  _count: { select: { items: true } },
} as const;

type RefRow = {
  id: number;
  name: string;
  _count: { items: number };
};

function toRef(row: RefRow) {
  return {
    id: row.id,
    name: row.name,
    // The UI needs this to explain a refused delete before you click it.
    itemCount: row._count.items,
  };
}

interface RefStore {
  findClash(name: string, exceptId?: number): Promise<{ name: string } | null>;
  count(): Promise<number>;
  list(skip: number, take: number): Promise<RefRow[]>;
  create(name: string): Promise<RefRow>;
  get(id: number): Promise<RefRow | null>;
  rename(id: number, name: string): Promise<RefRow>;
  remove(id: number): Promise<unknown>;
}

interface RefConfig {
  store: RefStore;
  /** The plural key the list response uses: { categories: [...] }. */
  listKey: "categories" | "brands";
  /** The singular key the write responses use: { category: {...} }. */
  itemKey: "category" | "brand";
  keys: {
    unknown: MessageKey;
    nameTaken: MessageKey;
    invalidPage: MessageKey;
    added: MessageKey;
    updated: MessageKey;
    deleted: MessageKey;
    stillUsed: MessageKey;
  };
}

function makeRefHandlers(cfg: RefConfig) {
  function parseId(raw: string): number {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
      throw new customError(cfg.keys.unknown, StatusCodes.BAD_REQUEST);
    }
    return id;
  }

  /**
   * The unique index is case-sensitive, so without this "Cables" and "cables"
   * would both get in and the dropdown would show near-duplicates.
   */
  async function assertNameFree(name: string, exceptId?: number): Promise<void> {
    const clash = await cfg.store.findClash(name, exceptId);
    if (clash) {
      throw new customError(cfg.keys.nameTaken, StatusCodes.CONFLICT, {
        params: { name: clash.name },
      });
    }
  }

  return {
    /** The management list, each row with its usage count. Paged like positions. */
    async list(req: Request, res: Response) {
      // Parsed here rather than by middleware: in Express 5 req.query is a
      // getter, so middleware cannot write the parsed value back.
      const parsed = paginationQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new customError(cfg.keys.invalidPage, StatusCodes.BAD_REQUEST);
      }

      const total = await cfg.store.count();
      const { skip, take, meta } = paginate(parsed.data, total);
      const rows = await cfg.store.list(skip, take);

      res.status(StatusCodes.OK).json({ [cfg.listKey]: rows.map(toRef), meta });
    },

    async create(req: Request, res: Response) {
      const { name } = req.body as CatalogRefInput;
      await assertNameFree(name);

      const row = await cfg.store.create(name);

      res.status(StatusCodes.CREATED).json({
        message: t(req, cfg.keys.added, { name: row.name }),
        [cfg.itemKey]: toRef(row),
      });
    },

    /** Rename. Items follow automatically, since they hold the id. */
    async update(req: Request, res: Response) {
      const id = parseId(req.params.id as string);
      const { name } = req.body as CatalogRefInput;

      const existing = await cfg.store.get(id);
      if (!existing) {
        throw new customError(cfg.keys.unknown, StatusCodes.NOT_FOUND);
      }
      await assertNameFree(name, id);

      const row = await cfg.store.rename(id, name);

      res.status(StatusCodes.OK).json({
        message: t(req, cfg.keys.updated, { name: row.name }),
        [cfg.itemKey]: toRef(row),
      });
    },

    async remove(req: Request, res: Response) {
      const id = parseId(req.params.id as string);

      const row = await cfg.store.get(id);
      if (!row) {
        throw new customError(cfg.keys.unknown, StatusCodes.NOT_FOUND);
      }

      // The FK is ON DELETE RESTRICT, so the database would refuse this anyway.
      // Checking here turns a constraint violation into a message that says
      // what to do about it. `count` picks the singular/plural form.
      if (row._count.items > 0) {
        throw new customError(cfg.keys.stillUsed, StatusCodes.CONFLICT, {
          params: { count: row._count.items, name: row.name },
        });
      }

      await cfg.store.remove(id);

      res.status(StatusCodes.OK).json({ message: t(req, cfg.keys.deleted, { name: row.name }), id });
    },
  };
}

const categoryStore: RefStore = {
  findClash: (name, exceptId) =>
    prisma.category.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { name: true },
    }),
  count: () => prisma.category.count(),
  list: (skip, take) =>
    prisma.category.findMany({ select: listSelect, orderBy: { name: "asc" }, skip, take }),
  create: (name) => prisma.category.create({ data: { name }, select: listSelect }),
  get: (id) => prisma.category.findUnique({ where: { id }, select: listSelect }),
  rename: (id, name) =>
    prisma.category.update({ where: { id }, data: { name }, select: listSelect }),
  remove: (id) => prisma.category.delete({ where: { id } }),
};

const brandStore: RefStore = {
  findClash: (name, exceptId) =>
    prisma.brand.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { name: true },
    }),
  count: () => prisma.brand.count(),
  list: (skip, take) =>
    prisma.brand.findMany({ select: listSelect, orderBy: { name: "asc" }, skip, take }),
  create: (name) => prisma.brand.create({ data: { name }, select: listSelect }),
  get: (id) => prisma.brand.findUnique({ where: { id }, select: listSelect }),
  rename: (id, name) => prisma.brand.update({ where: { id }, data: { name }, select: listSelect }),
  remove: (id) => prisma.brand.delete({ where: { id } }),
};

export const categoriesHandlers = makeRefHandlers({
  store: categoryStore,
  listKey: "categories",
  itemKey: "category",
  keys: {
    unknown: "categories.unknown",
    nameTaken: "categories.nameTaken",
    invalidPage: "categories.invalidPage",
    added: "categories.added",
    updated: "categories.updated",
    deleted: "categories.deleted",
    stillUsed: "categories.stillUsed",
  },
});

export const brandsHandlers = makeRefHandlers({
  store: brandStore,
  listKey: "brands",
  itemKey: "brand",
  keys: {
    unknown: "brands.unknown",
    nameTaken: "brands.nameTaken",
    invalidPage: "brands.invalidPage",
    added: "brands.added",
    updated: "brands.updated",
    deleted: "brands.deleted",
    stillUsed: "brands.stillUsed",
  },
});
