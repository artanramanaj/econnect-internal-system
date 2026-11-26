import { Router } from "express";
import {
  createPartner,
  getPartners,
  getPartnerSites,
} from "../controllers/partnersController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { validateBody } from "../middlewares/validate.js";
import { createPartnerSchema } from "../validators/partners.schema.js";

const router = Router();

// Clients fall under the catalogue permissions ("products, services &
// clients"); whoever writes quotes must also be able to pick and add one.
const canRead = requirePermission(["quote.manage", "catalog.view", "catalog.manage"]);
const canCreate = requirePermission(["quote.manage", "catalog.manage"]);

router.use(authenticate);

router.get("/", canRead, getPartners);
router.post("/", canCreate, validateBody(createPartnerSchema), createPartner);
router.get("/:id/sites", canRead, getPartnerSites);

export default router;
