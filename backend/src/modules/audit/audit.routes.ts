import { Router } from "express";
import AuditLog from "../../models/AuditLog.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole("CEO", "HR"));
auditRouter.get("/", async (req, res, next) => { try { const limit = Math.min(Number(req.query.limit) || 100, 500); res.json({ events: await AuditLog.find().populate("actorId", "name employeeId").sort({ createdAt: -1 }).limit(limit) }); } catch (e) { next(e); } });
