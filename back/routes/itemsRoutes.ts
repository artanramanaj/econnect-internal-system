import { Router } from "express";
import {
  getItems,
  getItemOptions,
  searchItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  uploadItemBrochure,
  getItemBrochure,
  deleteItemBrochure,
} from "../controllers/itemsController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { uploadBrochure } from "../middlewares/uploadBrochure.js";
import { validateBody } from "../middlewares/validate.js";
import { createItemSchema, updateItemSchema } from "../validators/items.schema.js";

const router = Router();

// Products, services & clients: project managers may look (catalog.view),
// sales and admins may also change things (catalog.manage).
const canView = requirePermission(["catalog.view", "catalog.manage"]);
const canManage = requirePermission("catalog.manage");
// The quote editor's line picker: whoever writes quotes may search the catalogue.
const canSearch = requirePermission(["quote.manage", "catalog.view", "catalog.manage"]);

router.use(authenticate);

router.get("/", canView, getItems);
// Declared before "/:id", which would otherwise take "options" for an id.
router.get("/options", canView, getItemOptions);
router.get("/search", canSearch, searchItems);
router.get("/:id", canView, getItem);
router.post("/", canManage, validateBody(createItemSchema), createItem);
router.patch("/:id", canManage, validateBody(updateItemSchema), updateItem);
router.delete("/:id", canManage, deleteItem);

// The item's one PDF (brochure/datasheet). The upload is multipart, parsed by
// the multer wrapper — no validateBody here (req.body is empty until multer).
router.get("/:id/brochure", canView, getItemBrochure);
router.post("/:id/brochure", canManage, uploadBrochure, uploadItemBrochure);
router.delete("/:id/brochure", canManage, deleteItemBrochure);

export default router;
