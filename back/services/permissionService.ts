import { prisma } from "../lib/prisma.js";
import type { PermissionScope } from "../generated/prisma/enums.js";

export interface EffectivePermission {
  code: string;
  scope: PermissionScope;
}

/**
 * Resolve a user's effective permissions by walking
 * UserRole -> RolePermission -> Permission.
 *
 * When two roles grant the same permission at different scopes, ALL wins.
 */
export async function getEffectivePermissions(userId: number): Promise<EffectivePermission[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: { users: { some: { userId } } } },
    select: { scope: true, permission: { select: { code: true } } },
  });

  const merged = new Map<string, PermissionScope>();
  for (const row of rows) {
    if (merged.get(row.permission.code) === "ALL") continue;
    merged.set(row.permission.code, row.scope);
  }

  return [...merged].map(([code, scope]) => ({ code, scope }));
}

export async function hasPermission(
  userId: number,
  code: string,
  scope?: PermissionScope
): Promise<boolean> {
  const permissions = await getEffectivePermissions(userId);
  const found = permissions.find((p) => p.code === code);
  if (!found) return false;
  // A required scope of OWN is satisfied by ALL, but not the other way round.
  if (scope === "ALL") return found.scope === "ALL";
  return true;
}
