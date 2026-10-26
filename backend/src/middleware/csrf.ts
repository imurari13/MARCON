import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";

/** Synchronizer-token protection for all state-changing API requests. */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const unauthenticatedAuthRoute = [
    "/api/auth/csrf",
    "/api/auth/login",
    "/api/auth/mfa/verify-login",
  ].includes(req.path);

  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || unauthenticatedAuthRoute) { next(); return; }
  const token = req.get("x-csrf-token");
  const expected = req.session.csrfToken;
  if (!token || !expected || token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    res.status(403).json({ error: "Invalid CSRF token. Refresh and try again." }); return;
  }
  next();
}
