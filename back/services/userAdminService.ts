import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import { customError } from "../middlewares/errorHandler.js";
import { getEffectivePermissions, hasPermission } from "./permissionService.js";
import { ROLE_CODES } from "../constants/user.constants.js";
import type { MessageKey } from "../i18n/index.js";

/**
 * Groups that only a super admin may manage or grant.
 *
 * This is what the design matrix means by "No admins" on the Admin column:
 * an Admin administers everyone below them, but cannot touch a peer or a
 * super admin, and cannot hand those groups out.
 */
export const PROTECTED_ROLE_CODES: readonly string[] = [
  ROLE_CODES.SUPER_ADMIN,
  ROLE_CODES.ADMIN,
];

export interface ManageTarget {
  /** The account being written to, when the person has one. */
  targetUserId?: number | null;
  /** The roster row being written to, for people without a login. */
  targetEmployeeId?: number | null;
  /** The group about to be granted, when this write changes one. */
  newRoleCode?: string | null;
}

const roleSelect = { roles: { select: { role: { select: { code: true } } } } } as const;

async function resolveTargetRoleCodes(target: ManageTarget): Promise<string[]> {
  const user = target.targetUserId
    ? await prisma.user.findUnique({ where: { id: target.targetUserId }, select: roleSelect })
    : target.targetEmployeeId
      ? await prisma.user.findUnique({
          where: { employeeId: target.targetEmployeeId },
          select: roleSelect,
        })
      : null;

  return user?.roles.map((r) => r.role.code) ?? [];
}

/**
 * Row-level authorisation for every write on this screen.
 *
 * `requirePermission` on the router answers "may you open this screen at all";
 * this answers "may you write to *this* person", which the route guard cannot
 * know. Both run — this never replaces the route guard.
 */
export async function assertCanManage(
  actorId: number,
  target: ManageTarget = {}
): Promise<void> {
  const granted = await getEffectivePermissions(actorId);
  const manageAnyone = granted.some((p) => p.code === "admin.users");
  const manageNonAdmins = granted.some((p) => p.code === "admin.users.non_admin");

  if (!manageAnyone && !manageNonAdmins) {
    throw new customError("people.cannotManage", StatusCodes.FORBIDDEN);
  }

  if (manageAnyone) return;

  const currentRoles = await resolveTargetRoleCodes(target);
  if (currentRoles.some((code) => PROTECTED_ROLE_CODES.includes(code))) {
    throw new customError("people.onlySuperAdminManages", StatusCodes.FORBIDDEN);
  }

  // Checked as well as the current role, otherwise an Admin could promote a
  // technician to Admin and inherit those rights sideways.
  if (target.newRoleCode && PROTECTED_ROLE_CODES.includes(target.newRoleCode)) {
    throw new customError("people.onlySuperAdminGrants", StatusCodes.FORBIDDEN);
  }
}

/** Groups this actor is allowed to hand out, for the form's select. */
export async function grantableRoleCodes(actorId: number): Promise<string[]> {
  const granted = await getEffectivePermissions(actorId);
  const all = Object.values(ROLE_CODES) as string[];

  if (granted.some((p) => p.code === "admin.users")) {
    // Even a super admin does not mint another super admin from this form.
    return all.filter((code) => code !== ROLE_CODES.SUPER_ADMIN);
  }

  return all.filter((code) => !PROTECTED_ROLE_CODES.includes(code));
}

/** `message` names the "You cannot … your own account." variant for this write. */
export function assertNotSelf(
  actorId: number,
  targetUserId: number | null | undefined,
  message: MessageKey
): void {
  if (targetUserId && targetUserId === actorId) {
    throw new customError(message, StatusCodes.BAD_REQUEST);
  }
}

/** Matches an account that can still administer the system. */
export const ACTIVE_SUPER_ADMIN = {
  status: "ACTIVE",
  roles: { some: { role: { code: ROLE_CODES.SUPER_ADMIN } } },
} as const;

/**
 * Call this *after* the write, inside the same transaction: the count then
 * sees the change, so throwing rolls it back and two concurrent demotions
 * cannot both pass.
 */
export function assertSuperAdminRemains(remaining: number): void {
  if (remaining < 1) {
    throw new customError("people.lastSuperAdmin", StatusCodes.CONFLICT);
  }
}

/** Who may see hourly cost. Decided server-side — see peopleController. */
export function canViewCost(actorId: number): Promise<boolean> {
  return hasPermission(actorId, "project.view_cost");
}
