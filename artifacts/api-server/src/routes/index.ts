import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

// Public allowlist — these paths do NOT require authentication.
// All paths are relative to /api.
const PUBLIC_PATHS = new Set([
  "/health",
  "/auth/me",
  "/auth/user",
  "/auth/setup-status",
  "/auth/claim-admin",
  "/login",
  "/callback",
  "/logout",
  "/mobile-auth/token-exchange",
  "/mobile-auth/logout",
]);

function isPublicPath(path: string): boolean {
  // Strip query string
  const pathname = path.split("?")[0];
  return PUBLIC_PATHS.has(pathname);
}

// Global auth guard: deny unauthenticated requests to all non-public paths.
router.use((req: Request, res: Response, next: NextFunction) => {
  if (isPublicPath(req.path)) {
    next();
    return;
  }
  requireAuth(req, res, next);
});

// Route handlers (must match allowlist above for public routes)
router.use(healthRouter);
router.use(authRouter);

export default router;
