import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
// requireAuth is exported for use in protected routers
// import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Public routes (auth + health — no auth required)
router.use(healthRouter);
router.use(authRouter);

// Protected routes go below — all must use requireAuth middleware.
// Example: router.use("/data", requireAuth, dataRouter);

export default router;
