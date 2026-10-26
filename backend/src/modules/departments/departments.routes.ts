import { Router } from "express";
import { z } from "zod";
import Department from "../../models/Department.js";
import User from "../../models/User.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { isObjectId } from "../../utils/date.js";
import { audit } from "../../utils/audit.js";

export const departmentsRouter = Router();
departmentsRouter.use(requireAuth);
const schema = z.object({ name: z.string().trim().min(2).max(60), code: z.string().trim().min(2).max(12), managerId: z.string().nullable().optional() });

departmentsRouter.get("/", async (_req, res, next) => { try { res.json({ departments: await Department.find().populate("managerId", "name employeeId").sort({ name: 1 }) }); } catch (e) { next(e); } });
departmentsRouter.post("/", requireRole("CEO", "HR"), async (req, res, next) => {
  try { const p = schema.safeParse(req.body); if (!p.success || (p.data.managerId && !isObjectId(p.data.managerId))) { res.status(400).json({ error: "Enter valid department details" }); return; }
    if (p.data.managerId && !await User.exists({ _id: p.data.managerId, isActive: true })) { res.status(400).json({ error: "Manager not found" }); return; }
    const department = await Department.create({ ...p.data, code: p.data.code.toUpperCase() }); void audit(req, "DEPARTMENT_CREATED", "Department", department.id); res.status(201).json({ department });
  } catch (e) { next(e); }
});
departmentsRouter.patch("/:id", requireRole("CEO", "HR"), async (req, res, next) => {
  try { const departmentId = req.params.id; if (!departmentId || !isObjectId(departmentId)) { res.status(400).json({ error: "Invalid department" }); return; } const p = schema.partial().safeParse(req.body); if (!p.success) { res.status(400).json({ error: "Invalid department details" }); return; }
    const department = await Department.findByIdAndUpdate(departmentId, { $set: p.data }, { returnDocument: "after" }); if (!department) { res.status(404).json({ error: "Department not found" }); return; } void audit(req, "DEPARTMENT_UPDATED", "Department", department.id); res.json({ department });
  } catch (e) { next(e); }
});
