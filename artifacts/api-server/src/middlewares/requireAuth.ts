import { type Request, type Response, type NextFunction } from "express";

/**
 * Middleware that requires a valid authenticated session.
 * Use this on all API routes that should only be accessible to authenticated users.
 * Public routes (auth endpoints) should NOT use this middleware.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}
