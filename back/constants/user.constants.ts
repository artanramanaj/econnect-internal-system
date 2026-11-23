/**
 * Role codes. These MUST match `Role.code` rows created by prisma/seed.ts.
 *
 * Note: statuses are NOT defined here any more — use the generated Prisma
 * `UserStatus` enum (PENDING | ACTIVE | SUSPENDED) instead.
 */
export const ROLE_CODES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  PROJECT_MANAGER: "project_manager",
  USER: "user",
  TEAM_LEADER: "team_leader",
  TECHNICIAN: "technician",
} as const;

/** Renamed from `UserRole` to avoid colliding with the Prisma `UserRole` join model. */
export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const ROLES: ReadonlyArray<{ code: RoleCode; name: string }> = [
  { code: ROLE_CODES.SUPER_ADMIN, name: "Super admin" },
  { code: ROLE_CODES.ADMIN, name: "Admin" },
  { code: ROLE_CODES.PROJECT_MANAGER, name: "Project manager" },
  { code: ROLE_CODES.USER, name: "User" },
  { code: ROLE_CODES.TEAM_LEADER, name: "Team leader" },
  { code: ROLE_CODES.TECHNICIAN, name: "Technician" },
];

/**
 * Roles a self-registering user is allowed to request.
 * Admin rights are never self-granted — they are assigned by a Super admin.
 */
export const REQUESTABLE_ROLE_CODES: readonly RoleCode[] = [
  ROLE_CODES.PROJECT_MANAGER,
  ROLE_CODES.USER,
  ROLE_CODES.TEAM_LEADER,
  ROLE_CODES.TECHNICIAN,
];
