import { z } from "zod";
import { ROLE_CODES, type RoleCode } from "../constants/user.constants.js";

const allRoleCodes = Object.values(ROLE_CODES) as readonly string[];

export const updateUserStatusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

export const assignRoleSchema = z.object({
  roleCode: z
    .string()
    .refine((v): v is RoleCode => allRoleCodes.includes(v), "validation.roleInvalid"),
});

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
