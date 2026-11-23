import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { customError } from "./errorHandler.js";
import { getEffectivePermissions } from "../services/permissionService.js";
import type { PermissionScope } from "../generated/prisma/enums.js";

/**
 * Route guard factory.
 *
 *   requirePermission("admin.settings")
 *   requirePermission(["admin.users", "admin.users.non_admin"])  // any-of
 *
 * Pass scope "ALL" when an OWN-scoped grant must not satisfy the route.
 */
export function requirePermission(code: string | string[], scope?: PermissionScope) {
  const required = Array.isArray(code) ? code : [code];

  return async (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
      throw new customError("common.notSignedIn", StatusCodes.UNAUTHORIZED);
    }

    const granted = await getEffectivePermissions(userId);
    const allowed = required.some((needed) => {
      const found = granted.find((p) => p.code === needed);
      if (!found) return false;
      // A required scope of ALL is not satisfied by an OWN-scoped grant.
      return scope === "ALL" ? found.scope === "ALL" : true;
    });

    if (!allowed) {
      throw new customError("common.noPermission", StatusCodes.FORBIDDEN);
    }

    next();
  };
}
