import type { Request } from "express";
import AuditLog from "../models/AuditLog.js";

export function audit(req: Request, action: string, entityType: string, entityId?: string, metadata: Record<string, unknown> = {}) {
  const actorId = req.session.userId;
  return AuditLog.create({ ...(actorId ? { actorId } : {}), action, entityType, ...(entityId ? { entityId } : {}), metadata, ip: req.ip }).catch(() => undefined);
}
