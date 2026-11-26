import { Router } from "express";
import {
  getQuote,
  getQuoteOptions,
  getQuoteRevisions,
  getQuotes,
  postApprove,
  postQuote,
  postReject,
  putQuote,
} from "../controllers/quotesController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { requirePermission } from "../middlewares/requirePermission.js";
import { validateBody } from "../middlewares/validate.js";
import {
  createQuoteSchema,
  rejectQuoteSchema,
  updateQuoteSchema,
} from "../validators/quotes.schema.js";

const router = Router();

// Anyone with a part in the quote's life may read it.
const canRead = requirePermission(["quote.manage", "quote.accept", "quote.approve"]);
// Writing needs both: a line's price is defined on its cost, so a quote
// cannot be built by someone who may not see cost.
const canManage = requirePermission("quote.manage");
const canSeeCost = requirePermission("quote.view_cost");
const canApprove = requirePermission("quote.approve");

router.use(authenticate);

router.get("/", canRead, getQuotes);
// Declared before "/:id", which would otherwise take "options" for an id.
router.get("/options", canRead, getQuoteOptions);
router.get("/:id", canRead, getQuote);
router.get("/:id/revisions", canRead, getQuoteRevisions);

router.post("/", canManage, canSeeCost, validateBody(createQuoteSchema), postQuote);
// A save, which creates the next revision.
router.put("/:id", canManage, canSeeCost, validateBody(updateQuoteSchema), putQuote);

// No body on approve, so no validateBody (req.body is undefined in Express 5).
router.post("/:id/approve", canApprove, postApprove);
router.post("/:id/reject", canApprove, validateBody(rejectQuoteSchema), postReject);

export default router;
