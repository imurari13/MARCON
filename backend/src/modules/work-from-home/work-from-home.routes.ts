import { Router } from "express";
import { z } from "zod";
import WorkFromHomeRequest from "../../models/WorkFromHomeRequest.js";
import User from "../../models/User.js";
import Notification from "../../models/Notification.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { audit } from "../../utils/audit.js";
import { isObjectId, isRealDate } from "../../utils/date.js";

export const workFromHomeRouter = Router();
workFromHomeRouter.use(requireAuth);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate);
const createSchema = z.object({ startDate: date, endDate: date, reason: z.string().trim().min(3).max(500) }).refine((v) => v.endDate >= v.startDate, { message: "End date is before start date" });

workFromHomeRouter.get("/mine", async (_req, res, next) => {
  try { res.json({ requests: await WorkFromHomeRequest.find({ userId: res.locals.user.id }).sort({ createdAt: -1 }).limit(50).lean() }); } catch (error) { next(error); }
});

workFromHomeRouter.post("/", async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Enter valid request details" }); return; }
    const user = await User.findById(res.locals.user.id).select("managerId");
    const request = await WorkFromHomeRequest.create({ ...parsed.data, userId: res.locals.user.id, status: user?.managerId ? "PENDING_MANAGER" : "PENDING_HR" });
    void audit(req, "WFH_REQUESTED", "WorkFromHomeRequest", request.id, { startDate: request.startDate, endDate: request.endDate });
    res.status(201).json({ request });
  } catch (error) { next(error); }
});

workFromHomeRouter.get("/", requireRole("CEO", "HR", "MANAGER"), async (_req, res, next) => {
  try {
    const actor = res.locals.user as { id: string; role: string };
    const requests = actor.role === "MANAGER"
      ? await WorkFromHomeRequest.find({ status: "PENDING_MANAGER", userId: { $in: await User.find({ managerId: actor.id }).distinct("_id") } }).populate("userId", "name employeeId").sort({ createdAt: -1 }).limit(100)
      : await WorkFromHomeRequest.find().populate("userId", "name employeeId").sort({ createdAt: -1 }).limit(100);
    res.json({ requests });
  } catch (error) { next(error); }
});

for (const [action, status] of [["approve", "APPROVED"], ["reject", "REJECTED"]] as const) {
  workFromHomeRouter.post(`/:id/${action}`, requireRole("CEO", "HR", "MANAGER"), async (req, res, next) => {
    try {
      const requestId = req.params.id;
      if (!requestId || !isObjectId(requestId)) { res.status(400).json({ error: "Invalid request id" }); return; }
      const actor = res.locals.user as { id: string; role: string };
      const request = await WorkFromHomeRequest.findById(requestId);
      if (!request || request.userId.toString() === actor.id) { res.status(409).json({ error: "Request is not pending or cannot be reviewed by you" }); return; }
      const requester = await User.findById(request.userId).select("managerId");
      const managerStep = actor.role === "MANAGER" && requester?.managerId?.toString() === actor.id && request.status === "PENDING_MANAGER";
      const hrStep = ["CEO", "HR"].includes(actor.role) && ["PENDING_HR", "PENDING"].includes(request.status);
      if (!managerStep && !hrStep) { res.status(403).json({ error: "You are not the approver for this request" }); return; }
      if (managerStep && status === "APPROVED") {
        request.status = "PENDING_HR"; request.managerApprovedBy = actor.id as never; await request.save();
        await Notification.create({ userId: request.userId, title: "WFH request forwarded", body: "Your manager approved the request; it is awaiting HR review.", type: "WFH", link: "/work-from-home" });
        void audit(req, "WFH_MANAGER_APPROVED", "WorkFromHomeRequest", request.id); res.json({ request }); return;
      }
      request.status = status; request.reviewedBy = actor.id as never; request.reviewedAt = new Date(); await request.save();
      await Notification.create({ userId: request.userId, title: `WFH request ${status.toLowerCase()}`, body: `Your work-from-home request for ${request.startDate} to ${request.endDate} was ${status.toLowerCase()}.`, type: "WFH", link: "/work-from-home" });
      void audit(req, status === "APPROVED" ? "WFH_APPROVED" : "WFH_REJECTED", "WorkFromHomeRequest", request.id);
      res.json({ request });
    } catch (error) { next(error); }
  });
}
