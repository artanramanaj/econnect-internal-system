import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateLocale,
} from "../controllers/authController.js";
import { authenticate } from "../middlewares/authenticate.js";
import { validateBody } from "../middlewares/validate.js";
import { registerSchema, loginSchema, updateLocaleSchema } from "../validators/auth.schema.js";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, getMe);
router.patch("/me/locale", authenticate, validateBody(updateLocaleSchema), updateLocale);

export default router;
