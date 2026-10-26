import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import User from "../../models/User.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { isObjectId, isRealDate, todayISO } from "../../utils/date.js";
import { audit } from "../../utils/audit.js";

export const employeesRouter = Router();
employeesRouter.use(requireAuth, requireRole("CEO", "HR"));

const dob = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth")
  .refine(isRealDate, "Enter a valid date of birth")
  .refine((v) => v <= todayISO() && v >= "1900-01-01", "Date of birth must be in the past");
const createSchema = z.object({
  employeeId: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  role: z.enum(["HR", "MANAGER", "EMPLOYEE"]),
  department: z.string().trim().max(60).optional(),
  managerId: z.string().nullable().optional(),
  designation: z.string().trim().max(60).optional(),
  dateOfBirth: dob.optional(),
  workStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid start time").default("09:30"),
  workEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid end time").default("18:30"),
});
const scheduleSchema = z.object({
  workStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid start time"),
  workEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid end time"),
}).refine(({ workStartTime, workEndTime }) => workEndTime > workStartTime, {
  message: "Shift end time must be after the start time",
  path: ["workEndTime"],
});

/** HR can manage employees and managers; CEO retains control of CEO/HR records. */
const canManageEmployee = (actorRole: string, employeeRole: string) =>
  actorRole === "CEO" || (employeeRole !== "CEO" && employeeRole !== "HR");

employeesRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ employees: await User.find().sort({ employeeId: 1 }).select("employeeId name email role department managerId designation workStartTime workEndTime dateOfBirth isActive") });
  } catch (e) { next(e); }
});

employeesRouter.post("/", async (req, res, next) => {
  try {
    const p = createSchema.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? "Invalid request" }); return; }
    const actor = res.locals.user as { role: string };
    if (p.data.role === "HR" && actor.role !== "CEO") { res.status(403).json({ error: "Only the CEO can create HR accounts" }); return; }
    if (await User.exists({ $or: [{ email: p.data.email.toLowerCase() }, { employeeId: p.data.employeeId }] })) {
      res.status(409).json({ error: "Email or employee ID already exists" }); return;
    }
    if (p.data.managerId && (!isObjectId(p.data.managerId) || !await User.exists({ _id: p.data.managerId, isActive: true }))) { res.status(400).json({ error: "Manager not found" }); return; }
    const u = await User.create({ ...p.data, password: await bcrypt.hash(p.data.password, 12), passwordChangeRequired: false });
    void audit(req, "EMPLOYEE_CREATED", "User", u.id, { employeeId: u.employeeId });
    res.status(201).json({ employee: { id: u.id, employeeId: u.employeeId, name: u.name, email: u.email, role: u.role } });
  } catch (e) { next(e); }
});

employeesRouter.patch("/:id/reporting-line", async (req, res, next) => {
  try { if (!isObjectId(req.params.id)) { res.status(400).json({ error: "Invalid employee id" }); return; }
    const p = z.object({ department: z.string().trim().max(60).nullable().optional(), managerId: z.string().nullable() }).safeParse(req.body);
    if (!p.success || (p.data.managerId && (!isObjectId(p.data.managerId) || p.data.managerId === req.params.id))) { res.status(400).json({ error: "Enter a valid reporting line" }); return; }
    if (p.data.managerId && !await User.exists({ _id: p.data.managerId, isActive: true })) { res.status(400).json({ error: "Manager not found" }); return; }
    const employee = await User.findByIdAndUpdate(req.params.id, { $set: p.data }, { returnDocument: "after" }); if (!employee) { res.status(404).json({ error: "Employee not found" }); return; }
    void audit(req, "REPORTING_LINE_UPDATED", "User", employee.id, { managerId: p.data.managerId }); res.json({ employee });
  } catch (e) { next(e); }
});

employeesRouter.post("/:id/reset-password", async (req, res, next) => {
  try { if (!isObjectId(req.params.id)) { res.status(400).json({ error: "Invalid employee id" }); return; } const p = z.object({ temporaryPassword: z.string().min(12).max(128) }).safeParse(req.body); if (!p.success) { res.status(400).json({ error: "Temporary password must be at least 12 characters" }); return; }
    const employee = await User.findById(req.params.id).select("+password"); if (!employee) { res.status(404).json({ error: "Employee not found" }); return; } if (!canManageEmployee((res.locals.user as { role: string }).role, employee.role)) { res.status(403).json({ error: "Not permitted" }); return; }
    employee.password = await bcrypt.hash(p.data.temporaryPassword, 12); employee.passwordChangeRequired = false; await employee.save(); void audit(req, "PASSWORD_RESET", "User", employee.id); res.status(204).end();
  } catch (e) { next(e); }
});

employeesRouter.post("/:id/toggle-active", async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) { res.status(400).json({ error: "Invalid employee id" }); return; }
    if (req.params.id === res.locals.user.id) { res.status(400).json({ error: "You cannot deactivate yourself" }); return; }
    const u = await User.findById(req.params.id);
    if (!u) { res.status(404).json({ error: "Not found" }); return; }
    const actorRole = (res.locals.user as { role: string }).role;
    if (u.role === "CEO") { res.status(403).json({ error: "The CEO account cannot be deactivated" }); return; }
    if (u.role === "HR" && actorRole !== "CEO") { res.status(403).json({ error: "Only the CEO can change HR accounts" }); return; }
    u.isActive = !u.isActive; await u.save();
    res.json({ isActive: u.isActive });
  } catch (e) { next(e); }
});

employeesRouter.patch("/:id/birthday", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id || !isObjectId(id)) { res.status(400).json({ error: "Invalid employee id" }); return; }
    const parsed = z.object({ dateOfBirth: dob.nullable() }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid date of birth" }); return; }
    const employee = await User.findById(id);
    if (!employee) { res.status(404).json({ error: "Employee not found" }); return; }
    if (!canManageEmployee((res.locals.user as { role: string }).role, employee.role)) { res.status(403).json({ error: "Only the CEO can change CEO or HR accounts" }); return; }
    employee.dateOfBirth = parsed.data.dateOfBirth;
    await employee.save();
    res.json({ dateOfBirth: employee.dateOfBirth ?? null });
  } catch (error) { next(error); }
});

employeesRouter.patch("/:id/schedule", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id || !isObjectId(id)) { res.status(400).json({ error: "Invalid employee id" }); return; }
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid schedule" }); return; }
    const employee = await User.findById(id);
    if (!employee) { res.status(404).json({ error: "Employee not found" }); return; }
    if (!canManageEmployee((res.locals.user as { role: string }).role, employee.role)) { res.status(403).json({ error: "Only the CEO can change CEO or HR accounts" }); return; }
    employee.workStartTime = parsed.data.workStartTime;
    employee.workEndTime = parsed.data.workEndTime;
    await employee.save();
    res.json({ workStartTime: employee.workStartTime, workEndTime: employee.workEndTime });
  } catch (error) { next(error); }
});
