import { Router } from "express";
import {
  getSelectablePositions,
  getPositions,
  createPosition,
  updatePosition,
  deletePosition,
} from "../controllers/positionsController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { validateBody } from "../middlewares/validate.js";
import {
  createPositionSchema,
  updatePositionSchema,
} from "../validators/positions.schema.js";

const router = Router();

// Public, and declared before the guard below: the register form needs the
// list before anyone is signed in.
router.get("/selectable", getSelectablePositions);

// Managing job titles rides along with managing people, so no new permission
// code: anyone who can open the Users screen can maintain this list.
router.use(authenticate, requirePermission(["admin.users", "admin.users.non_admin"]));

router.get("/", getPositions);
router.post("/", validateBody(createPositionSchema), createPosition);
router.patch("/:id", validateBody(updatePositionSchema), updatePosition);
router.delete("/:id", deletePosition);

export default router;
