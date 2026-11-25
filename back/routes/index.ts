import { Router } from "express";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import peopleRoutes from "./peopleRoutes.js";
import roleRoutes from "./roleRoutes.js";
import positionsRoutes from "./positionsRoutes.js";
import itemsRoutes from "./itemsRoutes.js";
import { brandsRoutes, categoriesRoutes } from "./catalogRefsRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
// /users is keyed by user id (accounts); /people by employee id (the roster,
// which includes staff who have no login at all).
router.use("/users", userRoutes);
router.use("/people", peopleRoutes);
router.use("/roles", roleRoutes);
router.use("/positions", positionsRoutes);
router.use("/items", itemsRoutes);
router.use("/categories", categoriesRoutes);
router.use("/brands", brandsRoutes);

export default router;
