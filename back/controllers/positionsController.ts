import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import { customError } from "../middlewares/errorHandler.js";
import type {
  CreatePositionInput,
  UpdatePositionInput,
} from "../validators/positions.schema.js";
import { paginationQuerySchema } from "../validators/pagination.schema.js";
import { paginate } from "../utils/pagination.js";
import { t } from "../i18n/index.js";

const listSelect = {
  id: true,
  name: true,
  isActive: true,
  _count: { select: { employees: true } },
} as const;

type PositionRow = {
  id: number;
  name: string;
  isActive: boolean;
  _count: { employees: number };
};

function toPosition(row: PositionRow) {
  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    // The UI needs this to explain a refused delete before you click it.
    employeeCount: row._count.employees,
  };
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new customError("positions.unknown", StatusCodes.BAD_REQUEST);
  }
  return id;
}

/**
 * The unique index is case-sensitive, so without this "Sales" and "sales"
 * would both get in and the dropdown would show near-duplicates.
 */
async function assertNameFree(name: string, exceptId?: number): Promise<void> {
  const clash = await prisma.position.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { name: true },
  });

  if (clash) {
    throw new customError("positions.nameTaken", StatusCodes.CONFLICT, {
      params: { name: clash.name },
    });
  }
}

/**
 * Active positions only. Public, because the register form is public — same
 * reason getRequestableRoles is.
 */
export async function getSelectablePositions(_req: Request, res: Response) {
  const positions = await prisma.position.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  res.status(StatusCodes.OK).json({ positions });
}

/**
 * The management list: retired ones included, each with its headcount. Paged;
 * the dropdowns use getSelectablePositions, which is not.
 */
export async function getPositions(req: Request, res: Response) {
  // Parsed here rather than by middleware: in Express 5 req.query is a
  // getter, so middleware cannot write the parsed value back.
  const parsed = paginationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new customError("positions.invalidPage", StatusCodes.BAD_REQUEST);
  }

  // One snapshot for both counts, so the "N of M in use" header never reads
  // something like 6 of 5.
  const [total, activeCount] = await prisma.$transaction([
    prisma.position.count(),
    prisma.position.count({ where: { isActive: true } }),
  ]);
  const { skip, take, meta } = paginate(parsed.data, total);

  // name is unique, so this ordering is already total.
  const rows = await prisma.position.findMany({
    select: listSelect,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    skip,
    take,
  });

  res.status(StatusCodes.OK).json({ positions: rows.map(toPosition), activeCount, meta });
}

export async function createPosition(req: Request, res: Response) {
  const { name } = req.body as CreatePositionInput;
  await assertNameFree(name);

  const row = await prisma.position.create({ data: { name }, select: listSelect });

  res.status(StatusCodes.CREATED).json({
    message: t(req, "positions.added", { name: row.name }),
    position: toPosition(row),
  });
}

export async function updatePosition(req: Request, res: Response) {
  const id = parseId(req.params.id as string);
  const input = req.body as UpdatePositionInput;

  const existing = await prisma.position.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw new customError("positions.unknown", StatusCodes.NOT_FOUND);
  }

  if (input.name !== undefined) {
    await assertNameFree(input.name, id);
  }

  const row = await prisma.position.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: listSelect,
  });

  res.status(StatusCodes.OK).json({
    message: t(req, "positions.updated", { name: row.name }),
    position: toPosition(row),
  });
}

export async function deletePosition(req: Request, res: Response) {
  const id = parseId(req.params.id as string);

  const row = await prisma.position.findUnique({ where: { id }, select: listSelect });
  if (!row) {
    throw new customError("positions.unknown", StatusCodes.NOT_FOUND);
  }

  // The FK is ON DELETE RESTRICT, so the database would refuse this anyway.
  // Checking here turns a constraint violation into a message that says what
  // to do about it. `count` picks the singular/plural form.
  if (row._count.employees > 0) {
    throw new customError("positions.stillHeld", StatusCodes.CONFLICT, {
      params: { count: row._count.employees, name: row.name },
    });
  }

  await prisma.position.delete({ where: { id } });

  res.status(StatusCodes.OK).json({ message: t(req, "positions.deleted", { name: row.name }), id });
}
