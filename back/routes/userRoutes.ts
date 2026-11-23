import { Router } from "express";
import {
  getUsers,
  getPendingUsers,
  updateUserStatus,
  assignRole,
} from "../controllers/userController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { validateBody } from "../middlewares/validate.js";
import { updateUserStatusSchema, assignRoleSchema } from "../validators/user.schema.js";

const router = Router();

// Every user route requires a signed-in account with user administration rights.
router.use(authenticate, requirePermission(["admin.users", "admin.users.non_admin"]));

router.get("/", getUsers);
router.get("/pending", getPendingUsers);
router.patch("/:id/status", validateBody(updateUserStatusSchema), updateUserStatus);
router.patch("/:id/role", validateBody(assignRoleSchema), assignRole);

export default router;
