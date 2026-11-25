import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { customError } from "../middlewares/errorHandler.js";
import {
  assertCanManage,
  assertNotSelf,
  assertSuperAdminRemains,
  canViewCost,
  grantableRoleCodes,
  ACTIVE_SUPER_ADMIN,
} from "../services/userAdminService.js";
import { ROLE_CODES } from "../constants/user.constants.js";
import { personQuerySchema } from "../validators/people.schema.js";
import { paginate } from "../utils/pagination.js";
import { actorId } from "../utils/actor.js";
import { startOfToday } from "../utils/dates.js";
import { isUniqueViolation } from "../utils/prismaErrors.js";
import { t } from "../i18n/index.js";
import type {
  CreatePersonInput,
  UpdatePersonInput,
} from "../validators/people.schema.js";

const SALT_ROUNDS = 10;

const personInclude = {
  user: {
    include: { roles: { include: { role: true } } },
  },
  position: true,
  costRates: {
    orderBy: { validFrom: "desc" },
    take: 1,
  },
} as const;

type PersonRow = {
  id: number;
  firstName: string;
  lastName: string;
  position: { id: number; name: string; isActive: boolean } | null;
  phone: string | null;
  isFieldStaff: boolean;
  isActive: boolean;
  user: {
    id: number;
    username: string;
    email: string;
    status: string;
    lastLoginAt: Date | null;
    roles: { role: { code: string; name: string } }[];
  } | null;
  costRates: { hourlyCost: unknown; validFrom: Date }[];
};

export interface PersonDto {
  employeeId: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  initials: string;
  username: string | null;
  email: string | null;
  /** The name is what the table prints; the id is what the edit drawer preselects. */
  position: string | null;
  positionId: number | null;
  phone: string | null;
  isFieldStaff: boolean;
  isActive: boolean;
  roleCode: string | null;
  roleName: string | null;
  status: string | null;
  lastLoginAt: Date | null;
  /** Present only when the caller holds project.view_cost. */
  hourlyCost?: string;
}

function toPerson(row: PersonRow, withCost: boolean): PersonDto {
  const role = row.user?.roles[0]?.role ?? null;
  const rate = row.costRates[0];

  const person: PersonDto = {
    employeeId: row.id,
    userId: row.user?.id ?? null,
    firstName: row.firstName,
    lastName: row.lastName,
    initials: `${row.firstName[0] ?? ""}${row.lastName[0] ?? ""}`.toUpperCase(),
    username: row.user?.username ?? null,
    email: row.user?.email ?? null,
    position: row.position?.name ?? null,
    positionId: row.position?.id ?? null,
    phone: row.phone,
    isFieldStaff: row.isFieldStaff,
    isActive: row.isActive,
    roleCode: role?.code ?? null,
    roleName: role?.name ?? null,
    status: row.user?.status ?? null,
    lastLoginAt: row.user?.lastLoginAt ?? null,
  };

  // Omitted rather than nulled: hiding the column in the template would still
  // ship every salary to a technician's browser.
  if (withCost && rate) {
    person.hourlyCost = Number(rate.hourlyCost).toFixed(2);
  }

  return person;
}

function parseEmployeeId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new customError("people.invalidId", StatusCodes.BAD_REQUEST);
  }
  return id;
}

/**
 * The staff roster. Employee-centric on purpose: the design lists everyone who
 * works on projects "with or without an app login", which a User query cannot
 * produce.
 */
export async function getPeople(req: Request, res: Response) {
  const me = actorId(req);

  // Parsed here rather than by validateBody: in Express 5 req.query is a
  // getter, so middleware cannot write the parsed value back.
  const parsed = personQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new customError("people.invalidFilters", StatusCodes.BAD_REQUEST);
  }
  const { q, group, page, pageSize } = parsed.data;

  const where = {
    ...(group ? { user: { roles: { some: { role: { code: group } } } } } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { position: { name: { contains: q, mode: "insensitive" as const } } },
            { user: { username: { contains: q, mode: "insensitive" as const } } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  // Counted first so the page can be clamped before the rows are fetched.
  const total = await prisma.employee.count({ where });
  const { skip, take, meta } = paginate({ page, pageSize }, total);

  const rows = await prisma.employee.findMany({
    where,
    include: personInclude,
    // id last: without a total order, two people with the same first name
    // could swap between pages from one request to the next.
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }, { id: "asc" }],
    skip,
    take,
  });

  const withCost = await canViewCost(me);

  res.status(StatusCodes.OK).json({
    people: rows.map((row) => toPerson(row as PersonRow, withCost)),
    canViewCost: withCost,
    grantableRoleCodes: await grantableRoleCodes(me),
    meta,
  });
}

export async function createPerson(req: Request, res: Response) {
  const me = actorId(req);
  const input = req.body as CreatePersonInput;

  await assertCanManage(me, { newRoleCode: input.login?.roleCode ?? null });

  const role = input.login
    ? await prisma.role.findUnique({ where: { code: input.login.roleCode } })
    : null;

  if (input.login && !role) {
    throw new customError("users.groupNotFound", StatusCodes.BAD_REQUEST);
  }

  const hashedPassword = input.login
    ? await bcrypt.hash(input.login.password, SALT_ROUNDS)
    : null;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          positionId: input.positionId ?? null,
          phone: input.phone || null,
          isFieldStaff: input.isFieldStaff ?? false,
        },
      });

      if (input.login && role && hashedPassword) {
        await tx.user.create({
          data: {
            username: input.login.username,
            email: input.login.email,
            password: hashedPassword,
            // Created by an administrator, so it is usable immediately —
            // unlike a self-registration, which waits in PENDING.
            status: "ACTIVE",
            employeeId: employee.id,
            roles: { create: { roleId: role.id } },
          },
        });
      }

      if (input.hourlyCost !== undefined) {
        await tx.employeeCostRate.create({
          data: {
            employeeId: employee.id,
            validFrom: startOfToday(),
            hourlyCost: input.hourlyCost,
          },
        });
      }

      return tx.employee.findUniqueOrThrow({
        where: { id: employee.id },
        include: personInclude,
      });
    });

    const withCost = await canViewCost(me);
    res
      .status(StatusCodes.CREATED)
      .json({
        // A person may be added without a login; only mention the account when there is one.
        message: input.login
          ? t(req, "people.accountCreated", {
              firstName: created.firstName,
              lastName: created.lastName,
              username: input.login.username,
            })
          : t(req, "people.added", { firstName: created.firstName, lastName: created.lastName }),
        person: toPerson(created as PersonRow, withCost),
      });
  } catch (err) {
    if (isUniqueViolation(err, "username")) {
      throw new customError("auth.usernameTaken", StatusCodes.CONFLICT);
    }
    if (isUniqueViolation(err, "email")) {
      throw new customError("auth.emailTaken", StatusCodes.CONFLICT);
    }
    throw err;
  }
}

export async function updatePerson(req: Request, res: Response) {
  const me = actorId(req);
  const employeeId = parseEmployeeId(req);
  const input = req.body as UpdatePersonInput;

  const existing = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!existing) {
    throw new customError("people.notFound", StatusCodes.NOT_FOUND);
  }

  await assertCanManage(me, { targetEmployeeId: employeeId });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: {
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.positionId !== undefined ? { positionId: input.positionId } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.isFieldStaff !== undefined ? { isFieldStaff: input.isFieldStaff } : {}),
      },
    });

    if (input.hourlyCost !== undefined) {
      // Append rather than overwrite, so a project costed last month keeps the
      // rate it was actually costed at. A same-day correction upserts.
      const validFrom = startOfToday();
      await tx.employeeCostRate.upsert({
        where: { employeeId_validFrom: { employeeId, validFrom } },
        create: { employeeId, validFrom, hourlyCost: input.hourlyCost },
        update: { hourlyCost: input.hourlyCost },
      });
    }

    return tx.employee.findUniqueOrThrow({
      where: { id: employeeId },
      include: personInclude,
    });
  });

  const withCost = await canViewCost(me);
  res
    .status(StatusCodes.OK)
    .json({
      message: t(req, "people.updated", { firstName: updated.firstName, lastName: updated.lastName }),
      person: toPerson(updated as PersonRow, withCost),
    });
}

/**
 * Soft delete. The row stays so past quotes, projects and daily reports keep
 * attributing to a real person; the account is suspended and every refresh
 * token revoked, so the person is signed out on their next request rather
 * than at the end of their seven days.
 */
export async function deactivatePerson(req: Request, res: Response) {
  const me = actorId(req);
  const employeeId = parseEmployeeId(req);

  const existing = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: { include: { roles: { include: { role: true } } } } },
  });

  if (!existing) {
    throw new customError("people.notFound", StatusCodes.NOT_FOUND);
  }

  await assertCanManage(me, { targetEmployeeId: employeeId });
  assertNotSelf(me, existing.user?.id, "people.cannotDeactivateSelf");

  const wasSuperAdmin =
    existing.user?.roles.some((r) => r.role.code === ROLE_CODES.SUPER_ADMIN) ?? false;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.employee.update({ where: { id: employeeId }, data: { isActive: false } });

    if (existing.user) {
      await tx.user.update({
        where: { id: existing.user.id },
        data: { status: "SUSPENDED" },
      });
      await tx.refreshToken.updateMany({
        where: { userId: existing.user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    if (wasSuperAdmin) {
      // Counted after the write, so it sees this change and rolls it back.
      assertSuperAdminRemains(await tx.user.count({ where: ACTIVE_SUPER_ADMIN }));
    }

    return tx.employee.findUniqueOrThrow({
      where: { id: employeeId },
      include: personInclude,
    });
  });

  const withCost = await canViewCost(me);
  res
    .status(StatusCodes.OK)
    .json({
      message: t(req, "people.deactivated", {
        firstName: updated.firstName,
        lastName: updated.lastName,
      }),
      person: toPerson(updated as PersonRow, withCost),
    });
}
