import { Router } from "express";
import {
  getPeople,
  createPerson,
  updatePerson,
  deactivatePerson,
} from "../controllers/peopleController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { validateBody } from "../middlewares/validate.js";
import { createPersonSchema, updatePersonSchema } from "../validators/people.schema.js";

const router = Router();

/**
 * Coarse gate: may you open this screen at all. Whether you may write to a
 * *particular* person is decided per row by assertCanManage, which the route
 * guard cannot know.
 */
router.use(authenticate, requirePermission(["admin.users", "admin.users.non_admin"]));

router.get("/", getPeople);
router.post("/", validateBody(createPersonSchema), createPerson);
router.patch("/:id", validateBody(updatePersonSchema), updatePerson);
router.delete("/:id", deactivatePerson);

export default router;
