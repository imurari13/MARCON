import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(error: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const e = (error ?? {}) as { type?: string; code?: number; message?: string };

  if (e.type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON in request body" });
    return;
  }
  if (e.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large" });
    return;
  }
  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: "Invalid identifier" });
    return;
  }
  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ error: Object.values(error.errors)[0]?.message ?? "Invalid request" });
    return;
  }
  if (e.code === 11000) {
    res.status(409).json({ error: "That record already exists" });
    return;
  }
  if (e.message === "Origin is not allowed by CORS") {
    res.status(403).json({ error: "Origin is not allowed" });
    return;
  }

  console.error("Unhandled API error:", error instanceof Error ? error.stack ?? error.message : "Unknown error");
  res.status(500).json({ error: "Internal server error" });
}
