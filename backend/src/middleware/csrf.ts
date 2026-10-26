import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";

/** Synchronizer-token protection for all state-changing API requests. */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path === "/api/auth/csrf") { next(); return; }
  const token = req.get("x-csrf-token");
  const expected = req.session.csrfToken;
  if (!token || !expected || token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    res.status(403).json({ error: "Invalid CSRF token. Refresh and try again." }); return;
  }
  next();
}
