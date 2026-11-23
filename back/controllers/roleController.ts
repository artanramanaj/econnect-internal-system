import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../lib/prisma.js";
import { REQUESTABLE_ROLE_CODES, ROLES } from "../constants/user.constants.js";
import { MATRIX_ROWS } from "../constants/permissions.constants.js";
import type { PermissionScope } from "../generated/prisma/enums.js";

/**
 * Display order for group columns and selects.
 *
 * Role ids are insertion order, which is not the order the design shows
 * (Technician was seeded before Project manager was renamed, so by id it
 * sorts third). The catalogue's declaration order is the design's order.
 */
const ROLE_ORDER = new Map<string, number>(ROLES.map((r, i) => [r.code, i]));

function byCatalogueOrder<T extends { code: string }>(rows: T[]): T[] {
  return rows
    .filter((r) => ROLE_ORDER.has(r.code))
    .sort((a, b) => ROLE_ORDER.get(a.code)! - ROLE_ORDER.get(b.code)!);
}

/**
 * Roles a visitor may request on the register form.
 * Public, because the register page is public.
 */
export async function getRequestableRoles(_req: Request, res: Response) {
  const roles = await prisma.role.findMany({
    where: { code: { in: [...REQUESTABLE_ROLE_CODES] } },
    select: { id: true, code: true, name: true },
    orderBy: { id: "asc" },
  });

  res.status(StatusCodes.OK).json({ roles });
}

export async function getRoles(_req: Request, res: Response) {
  const roles = await prisma.role.findMany({
    select: { id: true, code: true, name: true, isSystem: true },
  });

  res.status(StatusCodes.OK).json({ roles: byCatalogueOrder(roles) });
}

export interface MatrixCell {
  kind: "yes" | "text" | "no";
  /** A client-side translation key, e.g. "matrix.cells.own". */
  text?: string;
}

/**
 * The "Groups & permissions" table.
 *
 * Composed from the live RolePermission rows rather than from the constants,
 * so the screen shows what the database actually grants. If the seed and the
 * design ever drift, this surfaces it instead of hiding it behind a hardcoded
 * copy of the matrix.
 */
export async function getMatrix(_req: Request, res: Response) {
  const roles = byCatalogueOrder(
    await prisma.role.findMany({ select: { id: true, code: true, name: true } })
  );

  const grants = await prisma.rolePermission.findMany({
    select: { scope: true, role: { select: { code: true } }, permission: { select: { code: true } } },
  });

  // "roleCode\u0000permissionCode" -> scope
  const byRole = new Map<string, PermissionScope>();
  for (const g of grants) {
    byRole.set(`${g.role.code}\u0000${g.permission.code}`, g.scope);
  }

  // label, area and text are translation keys the client renders through its
  // own i18n files — not text. Translating them here would leave the table in
  // the old language after a runtime switch, until the next fetch.
  const rows = MATRIX_ROWS.map((row) => ({
    label: row.label,
    area: row.area,
    cells: roles.map((role): MatrixCell => {
      const full = byRole.get(`${role.code}\u0000${row.full}`);
      if (full === "ALL") return { kind: "yes" };
      if (full === "OWN") return { kind: "text", text: "matrix.cells.own" };

      if (row.narrow && byRole.has(`${role.code}\u0000${row.narrow.code}`)) {
        return { kind: "text", text: row.narrow.text };
      }

      return { kind: "no" };
    }),
  }));

  res.status(StatusCodes.OK).json({ groups: roles, rows });
}
