import { Router } from "express";
import { z } from "zod";
import LeaveRequest from "../../models/LeaveRequest.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { isObjectId, isRealDate } from "../../utils/date.js";
import User from "../../models/User.js";
import LeavePolicy from "../../models/LeavePolicy.js";
import { audit } from "../../utils/audit.js";
import Notification from "../../models/Notification.js";

export const leaveRouter = Router();
leaveRouter.use(requireAuth);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date").refine(isRealDate, "Enter a valid date");
const createSchema = z.object({
  leaveType: z.enum(["CASUAL", "SICK", "EARNED", "UNPAID"]),
  startDate: date,
  endDate: date,
  reason: z.string().trim().min(1).max(500),
  halfDay: z.boolean().optional().default(false),
}).refine((v) => v.endDate >= v.startDate, { message: "End date is before start date" });

leaveRouter.get("/mine", async (_req, res, next) => {
  try {
    res.json({ requests: await LeaveRequest.find({ userId: res.locals.user.id }).sort({ createdAt: -1 }).limit(50).lean() });
  } catch (e) { next(e); }
});

leaveRouter.post("/", async (req, res, next) => {
  try {
    const p = createSchema.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: p.error.issues[0]?.message ?? "Invalid request" }); return; }
    if (p.data.halfDay && p.data.startDate !== p.data.endDate) { res.status(400).json({ error: "Half-day leave must be for one day" }); return; }
    const days = p.data.halfDay ? 0.5 : Math.floor((Date.parse(`${p.data.endDate}T00:00:00Z`) - Date.parse(`${p.data.startDate}T00:00:00Z`)) / 86400000) + 1;
    const user = await User.findById(res.locals.user.id).select("managerId");
    const doc = await LeaveRequest.create({ ...p.data, userId: res.locals.user.id, durationDays: days, status: user?.managerId ? "PENDING_MANAGER" : "PENDING_HR" });
    void audit(req, "LEAVE_REQUESTED", "LeaveRequest", doc.id, { leaveType: doc.leaveType, durationDays: days });
    res.status(201).json({ request: doc });
  } catch (e) { next(e); }
});

leaveRouter.get("/", requireRole("CEO", "HR", "MANAGER"), async (_req, res, next) => {
  try {
    const user = res.locals.user as { id: string; role: string };
    const requests = user.role === "MANAGER"
      ? await LeaveRequest.find({ status: "PENDING_MANAGER", userId: { $in: await User.find({ managerId: user.id }).distinct("_id") } }).populate("userId", "name employeeId").sort({ createdAt: -1 }).limit(100)
      : await LeaveRequest.find().populate("userId", "name employeeId").sort({ createdAt: -1 }).limit(100);
    res.json({ requests });
  } catch (e) { next(e); }
});

for (const [action, status] of [["approve", "APPROVED"], ["reject", "REJECTED"]] as const) {
  leaveRouter.post(`/:id/${action}`, requireRole("CEO", "HR", "MANAGER"), async (req, res, next) => {
    try {
      const requestId = req.params.id;
      if (!requestId || !isObjectId(requestId)) { res.status(400).json({ error: "Invalid request id" }); return; }
      const actor = res.locals.user as { id: string; role: string };
      const request = await LeaveRequest.findById(requestId);
      if (!request || request.userId.toString() === actor.id) { res.status(409).json({ error: "Request is not pending or cannot be reviewed by you" }); return; }
      const requester = await User.findById(request.userId).select("managerId");
      const managerStep = actor.role === "MANAGER" && requester?.managerId?.toString() === actor.id && request.status === "PENDING_MANAGER";
      const hrStep = ["CEO", "HR"].includes(actor.role) && ["PENDING_HR", "PENDING"].includes(request.status);
      if (!managerStep && !hrStep) { res.status(403).json({ error: "You are not the approver for this request" }); return; }
      if (managerStep && status === "APPROVED") { request.status = "PENDING_HR"; request.managerApprovedBy = actor.id as never; await request.save(); await Notification.create({userId:request.userId,title:"Leave request forwarded",body:"Your manager approved the request; it is awaiting HR review.",type:"LEAVE",link:"/leave"}); void audit(req, "LEAVE_MANAGER_APPROVED", "LeaveRequest", request.id); res.json({ request }); return; }
      request.status = status; request.reviewedBy = actor.id as never; request.reviewedAt = new Date(); await request.save(); await Notification.create({userId:request.userId,title:`Leave request ${status.toLowerCase()}`,body:`Your ${request.leaveType.toLowerCase()} leave request for ${request.startDate} to ${request.endDate} was ${status.toLowerCase()}.`,type:"LEAVE",link:"/leave"}); void audit(req, status === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED", "LeaveRequest", request.id); const doc = request;
      if (!doc) { res.status(409).json({ error: "Request is not pending or cannot be reviewed by you" }); return; }
      res.json({ request: doc });
    } catch (e) { next(e); }
  });
}

leaveRouter.get("/balances", async (_req, res, next) => { try { const year = new Date().getFullYear(); const [policies, previousPolicies, requests, previousRequests] = await Promise.all([LeavePolicy.find({ year }), LeavePolicy.find({ year: year - 1 }), LeaveRequest.find({ userId: res.locals.user.id, status: "APPROVED", startDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } }).select("leaveType durationDays"), LeaveRequest.find({ userId: res.locals.user.id, status: "APPROVED", startDate: { $gte: `${year - 1}-01-01`, $lte: `${year - 1}-12-31` } }).select("leaveType durationDays")]); const sum = (items: { leaveType: string; durationDays: number }[]) => items.reduce<Record<string, number>>((a, r) => ({ ...a, [r.leaveType]: (a[r.leaveType] ?? 0) + r.durationDays }), {}); const used = sum(requests); const previousUsed = sum(previousRequests); const previousByType = Object.fromEntries(previousPolicies.map((p) => [p.leaveType, p])); res.json({ balances: policies.map((p) => { const previous = previousByType[p.leaveType]; const carriedForward = previous ? Math.min(p.carryForwardLimit, Math.max(0, previous.annualQuota - (previousUsed[p.leaveType] ?? 0))) : 0; const quota = p.annualQuota + carriedForward; return { leaveType: p.leaveType, quota, annualQuota: p.annualQuota, carriedForward, used: used[p.leaveType] ?? 0, remaining: Math.max(0, quota - (used[p.leaveType] ?? 0)) }; }) }); } catch (e) { next(e); } });
leaveRouter.get("/policies", requireRole("CEO", "HR"), async (_req, res, next) => { try { res.json({ policies: await LeavePolicy.find().sort({ year: -1, leaveType: 1 }) }); } catch (e) { next(e); } });
leaveRouter.put("/policies/:year/:leaveType", requireRole("CEO", "HR"), async (req, res, next) => { try { const year = Number(req.params.year); const leaveType = req.params.leaveType; const p = z.object({ annualQuota: z.number().min(0).max(366), carryForwardLimit: z.number().min(0).max(366).default(0) }).safeParse(req.body); if (!Number.isInteger(year) || year < 2000 || year > 2100 || !leaveType || !["CASUAL", "SICK", "EARNED", "UNPAID"].includes(leaveType) || !p.success) { res.status(400).json({ error: "Invalid leave policy" }); return; } const policy = await LeavePolicy.findOneAndUpdate({ year, leaveType } as any, { $set: p.data }, { upsert: true, returnDocument: "after" }); if (!policy) { res.status(500).json({ error: "Unable to save leave policy" }); return; } void audit(req, "LEAVE_POLICY_UPDATED", "LeavePolicy", policy.id); res.json({ policy }); } catch (e) { next(e); } });
