import { Router } from "express";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import peopleRoutes from "./peopleRoutes.js";
import roleRoutes from "./roleRoutes.js";
import positionsRoutes from "./positionsRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
// /users is keyed by user id (accounts); /people by employee id (the roster,
// which includes staff who have no login at all).
router.use("/users", userRoutes);
router.use("/people", peopleRoutes);
router.use("/roles", roleRoutes);
router.use("/positions", positionsRoutes);

export default router;
