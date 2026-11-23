import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import { customError } from "../middlewares/errorHandler.js";
import { toPublicUser } from "../services/authService.js";
import {
  assertCanManage,
  assertNotSelf,
  assertSuperAdminRemains,
  ACTIVE_SUPER_ADMIN,
} from "../services/userAdminService.js";
import { ROLE_CODES } from "../constants/user.constants.js";
import { t, type MessageKey } from "../i18n/index.js";
import type { UpdateUserStatusInput, AssignRoleInput } from "../validators/user.schema.js";

/** The toast the client shows after a status change, one message per status. */
const STATUS_MESSAGE: Record<UpdateUserStatusInput["status"], MessageKey> = {
  ACTIVE: "users.status.ACTIVE",
  SUSPENDED: "users.status.SUSPENDED",
  PENDING: "users.status.PENDING",
};

const userWithRelations = {
  include: {
    employee: { include: { position: true } },
    roles: { include: { role: true } },
  },
} as const;

function actorId(req: Request): number {
  const id = req.user?.userId;
  if (!id) throw new customError("common.notSignedIn", StatusCodes.UNAUTHORIZED);
  return id;
}

function parseUserId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    throw new customError("users.invalidId", StatusCodes.BAD_REQUEST);
  }
  return id;
}

export async function getUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    ...userWithRelations,
    orderBy: { createdAt: "desc" },
  });

  res.status(StatusCodes.OK).json({ users: users.map(toPublicUser) });
}

/** Users awaiting activation — drives the "Access requests" panel. */
export async function getPendingUsers(_req: Request, res: Response) {
  const users = await prisma.user.findMany({
    where: { status: "PENDING" },
    ...userWithRelations,
    orderBy: { createdAt: "asc" },
  });

  res.status(StatusCodes.OK).json({ users: users.map(toPublicUser) });
}

export async function updateUserStatus(req: Request, res: Response) {
  const me = actorId(req);
  const id = parseUserId(req);
  const { status } = req.body as UpdateUserStatusInput;

  const existing = await prisma.user.findUnique({ where: { id }, ...userWithRelations });
  if (!existing) {
    throw new customError("users.notFound", StatusCodes.NOT_FOUND);
  }

  await assertCanManage(me, { targetUserId: id });
  assertNotSelf(me, id, "users.cannotChangeOwnStatus");

  const isSuperAdmin = existing.roles.some((r) => r.role.code === ROLE_CODES.SUPER_ADMIN);

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status } });

    // Keep the roster row in step: deactivating an account takes the person
    // out of the active staff list, reactivating puts them back.
    if (existing.employeeId) {
      await tx.employee.update({
        where: { id: existing.employeeId },
        data: { isActive: status === "ACTIVE" },
      });
    }

    if (status !== "ACTIVE") {
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (isSuperAdmin) {
        // Counted after the write, so it sees this change and rolls it back.
        assertSuperAdminRemains(await tx.user.count({ where: ACTIVE_SUPER_ADMIN }));
      }
    }

    return tx.user.findUniqueOrThrow({ where: { id }, ...userWithRelations });
  });

  res.status(StatusCodes.OK).json({
    message: t(req, STATUS_MESSAGE[status], { username: user.username }),
    user: toPublicUser(user),
  });
}

/** Replaces the user's roles with the single supplied role. */
export async function assignRole(req: Request, res: Response) {
  const me = actorId(req);
  const id = parseUserId(req);
  const { roleCode } = req.body as AssignRoleInput;

  const existing = await prisma.user.findUnique({ where: { id }, ...userWithRelations });
  if (!existing) {
    throw new customError("users.notFound", StatusCodes.NOT_FOUND);
  }

  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) {
    throw new customError("users.groupNotFound", StatusCodes.BAD_REQUEST);
  }

  await assertCanManage(me, { targetUserId: id, newRoleCode: roleCode });
  // Without this you could demote yourself out of the screen you are standing on.
  assertNotSelf(me, id, "users.cannotChangeOwnGroup");

  const wasSuperAdmin = existing.roles.some((r) => r.role.code === ROLE_CODES.SUPER_ADMIN);

  const user = await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId: id } });
    await tx.userRole.create({ data: { userId: id, roleId: role.id, assignedBy: me } });

    if (wasSuperAdmin && roleCode !== ROLE_CODES.SUPER_ADMIN) {
      assertSuperAdminRemains(await tx.user.count({ where: ACTIVE_SUPER_ADMIN }));
    }

    return tx.user.findUniqueOrThrow({ where: { id }, ...userWithRelations });
  });

  res.status(StatusCodes.OK).json({
    message: t(req, "users.movedToGroup", { username: user.username, role: role.name }),
    user: toPublicUser(user),
  });
}
