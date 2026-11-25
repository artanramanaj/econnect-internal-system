import { Router } from "express";
import { brandsHandlers, categoriesHandlers } from "../controllers/catalogRefsController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { validateBody } from "../middlewares/validate.js";
import { catalogRefSchema } from "../validators/catalogRefs.schema.js";

/*
 * /api/categories and /api/brands: the managed dropdown values of the items
 * catalogue. Same permissions as the items themselves.
 */

type RefHandlers = typeof categoriesHandlers;

function refRouter(handlers: RefHandlers): Router {
  const router = Router();

  const canView = requirePermission(["catalog.view", "catalog.manage"]);
  const canManage = requirePermission("catalog.manage");

  router.use(authenticate);

  router.get("/", canView, handlers.list);
  router.post("/", canManage, validateBody(catalogRefSchema), handlers.create);
  router.patch("/:id", canManage, validateBody(catalogRefSchema), handlers.update);
  router.delete("/:id", canManage, handlers.remove);

  return router;
}

export const categoriesRoutes = refRouter(categoriesHandlers);
export const brandsRoutes = refRouter(brandsHandlers);
