import { Router } from "express";
import { z } from "zod";
import SalaryStructure from "../../models/SalaryStructure.js";
import PayrollRun from "../../models/PayrollRun.js";
import User from "../../models/User.js";
import Attendance from "../../models/Attendance.js";
import LeaveRequest from "../../models/LeaveRequest.js";
import Holiday from "../../models/Holiday.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { isObjectId } from "../../utils/date.js";
import { audit } from "../../utils/audit.js";
import { payslipPdf } from "../../utils/payslip-pdf.js";

export const payrollRouter = Router();
payrollRouter.use(requireAuth);
const salarySchema = z.object({
  userId: z.string(), basic: z.number().min(0), allowances: z.number().min(0).default(0),
  deductions: z.number().min(0).default(0), effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

payrollRouter.post("/structures", requireRole("CEO", "HR"), async (req, res, next) => {
  try {
    const parsed = salarySchema.safeParse(req.body);
    if (!parsed.success || !isObjectId(parsed.data.userId)) { res.status(400).json({ error: "Invalid salary structure" }); return; }
    const structure = await SalaryStructure.create(parsed.data);
    void audit(req, "SALARY_STRUCTURE_SET", "SalaryStructure", structure.id, { userId: parsed.data.userId });
    res.status(201).json({ structure });
  } catch (error) { next(error); }
});
payrollRouter.get("/structures/:userId", async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const actor = res.locals.user as { id: string; role: string };
    if (!userId || !isObjectId(userId) || (actor.id !== userId && !["CEO", "HR"].includes(actor.role))) { res.status(403).json({ error: "Not permitted" }); return; }
    res.json({ structures: await SalaryStructure.find({ userId }).sort({ effectiveFrom: -1 }) });
  } catch (error) { next(error); }
});
payrollRouter.post("/runs", requireRole("CEO", "HR"), async (req, res, next) => {
  try {
    const parsed = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid payroll month" }); return; }
    const month = parsed.data.month;
    if (await PayrollRun.exists({ month })) { res.status(409).json({ error: "A run already exists for this month" }); return; }
    const users = await User.find({ isActive: true }).select("_id workStartTime");
    const holidays = await Holiday.find({ date: { $regex: `^${month}` } }).select("date");
    const holidaySet = new Set(holidays.map(holiday => holiday.date));
    const [year, mon] = month.split("-").map(Number) as [number, number];
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const workdays = Array.from({ length: daysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`).filter(date => {
      const day = new Date(`${date}T00:00:00Z`).getUTCDay();
      return day !== 0 && day !== 6 && !holidaySet.has(date);
    });
    const items = await Promise.all(users.map(async user => {
      const salary = await SalaryStructure.findOne({ userId: user.id, effectiveFrom: { $lte: `${month}-31` } }).sort({ effectiveFrom: -1 });
      const gross = (salary?.basic ?? 0) + (salary?.allowances ?? 0);
      const [attendance, leaves] = await Promise.all([
        Attendance.find({ userId: user.id, date: { $regex: `^${month}` } }),
        LeaveRequest.find({ userId: user.id, status: "APPROVED", startDate: { $lte: `${month}-${String(daysInMonth).padStart(2, "0")}` }, endDate: { $gte: `${month}-01` } }),
      ]);
      const present = new Set(attendance.map(record => record.date));
      const onLeave = (date: string) => leaves.some(leave => leave.startDate <= date && leave.endDate >= date);
      const absentDays = workdays.filter(date => !present.has(date) && !onLeave(date)).length;
      const scheduledMinutes = (user.workStartTime ?? "09:30").split(":").reduce((total, value, index) => total + Number(value) * (index ? 1 : 60), 0);
      const lateMarks = attendance.filter(record => {
        const date = new Date(record.checkIn);
        return date.getHours() * 60 + date.getMinutes() > scheduledMinutes + 10;
      }).length;
      const dailyRate = workdays.length ? gross / workdays.length : 0;
      const deductions = (salary?.deductions ?? 0) + dailyRate * absentDays + (dailyRate / 8) * lateMarks;
      return {
        userId: user._id, gross, deductions: Math.round(deductions * 100) / 100,
        net: Math.max(0, Math.round((gross - deductions) * 100) / 100), absentDays, lateMarks,
      };
    }));
    const run = await PayrollRun.create({ month, processedBy: res.locals.user.id, items });
    void audit(req, "PAYROLL_RUN_CREATED", "PayrollRun", run.id, { month });
    res.status(201).json({ run });
  } catch (error) { next(error); }
});
payrollRouter.get("/runs", requireRole("CEO", "HR"), async (_req, res, next) => {
  try { res.json({ runs: await PayrollRun.find().sort({ month: -1 }) }); }
  catch (error) { next(error); }
});
payrollRouter.post("/runs/:id/finalize", requireRole("CEO", "HR"), async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id || !isObjectId(id)) { res.status(400).json({ error: "Invalid payroll run" }); return; }
    const run = await PayrollRun.findOneAndUpdate({ _id: id, status: "DRAFT" }, { $set: { status: "FINALIZED" } }, { returnDocument: "after" });
    if (!run) { res.status(409).json({ error: "Run is already finalized or missing" }); return; }
    void audit(req, "PAYROLL_FINALIZED", "PayrollRun", run.id);
    res.json({ run });
  } catch (error) { next(error); }
});
payrollRouter.get("/payslip/:month", async (req, res, next) => {
  try {
    const month = req.params.month;
    const run = await PayrollRun.findOne({ month, "items.userId": res.locals.user.id });
    const item = run?.items.find(record => record.userId.toString() === res.locals.user.id);
    if (!run || !item) { res.status(404).json({ error: "Payslip not found" }); return; }
    res.json({ payslip: { month, status: run.status, ...item } });
  } catch (error) { next(error); }
});
payrollRouter.get("/payslip/:month/pdf", async (req, res, next) => {
  try {
    const month = req.params.month;
    const user = res.locals.user as { id: string; fullName: string; employeeCode: string };
    const run = await PayrollRun.findOne({ month, "items.userId": user.id });
    const item = run?.items.find(record => record.userId.toString() === user.id);
    if (!run || !item) { res.status(404).json({ error: "Payslip not found" }); return; }
    void audit(req, "PAYSLIP_DOWNLOADED", "PayrollRun", run.id, { month });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="payslip-${month}.pdf"`);
    res.send(payslipPdf({ company: "MarcOn", employee: user.fullName, employeeId: user.employeeCode, month, gross: item.gross, deductions: item.deductions, net: item.net, status: run.status }));
  } catch (error) { next(error); }
});
