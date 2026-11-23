import { Router } from "express";
import { getRoles, getRequestableRoles, getMatrix } from "../controllers/roleController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/requirePermission.js";

const router = Router();

// Public: the register form needs these before anyone is signed in.
router.get("/requestable", getRequestableRoles);

router.get("/", authenticate, getRoles);

router.get(
  "/matrix",
  authenticate,
  requirePermission(["admin.users", "admin.users.non_admin"]),
  getMatrix
);

export default router;
