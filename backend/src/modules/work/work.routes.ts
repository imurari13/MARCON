import { Router } from "express";
import { Types, type QueryFilter } from "mongoose";
import { z } from "zod";
import WorkItem, { type IWorkItem } from "../../models/WorkItem.js";
import { Job, Candidate } from "../../models/Recruitment.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { isObjectId } from "../../utils/date.js";
import { audit } from "../../utils/audit.js";

export const workRouter = Router();
workRouter.use(requireAuth);

const kinds = ["ONBOARDING", "OFFBOARDING", "GOAL", "EXPENSE", "ASSET", "TICKET"] as const;
const itemSchema = z.object({
  kind: z.enum(kinds), title: z.string().trim().min(2).max(200), description: z.string().max(4000).optional(),
  assigneeId: z.string().optional(), status: z.string().max(40).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), amount: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

workRouter.get("/items", async (req, res, next) => {
  try {
    const kind = typeof req.query.kind === "string" ? kinds.find(value => value === req.query.kind) : undefined;
    const actor = res.locals.user as { id: string; role: string };
    const query: QueryFilter<IWorkItem> = {};
    if (kind) query.kind = kind;
    if (actor.role !== "CEO" && actor.role !== "HR") {
      query.$or = [{ ownerId: new Types.ObjectId(actor.id) }, { assigneeId: new Types.ObjectId(actor.id) }];
    }
    res.json({ items: await WorkItem.find(query).populate("ownerId assigneeId", "name employeeId").sort({ createdAt: -1 }).limit(200) });
  } catch (error) { next(error); }
});

workRouter.post("/items", async (req, res, next) => {
  try {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success || (parsed.data.assigneeId && !isObjectId(parsed.data.assigneeId))) { res.status(400).json({ error: "Invalid item" }); return; }
    const actor = res.locals.user as { id: string; role: string };
    if (["ASSET", "ONBOARDING", "OFFBOARDING"].includes(parsed.data.kind) && !["CEO", "HR"].includes(actor.role)) { res.status(403).json({ error: "HR access required" }); return; }
    const record = await WorkItem.create({ ...parsed.data, ownerId: actor.id });
    void audit(req, "WORK_ITEM_CREATED", "WorkItem", record.id, { kind: record.kind });
    res.status(201).json({ item: record });
  } catch (error) { next(error); }
});

workRouter.patch("/items/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id || !isObjectId(id)) { res.status(400).json({ error: "Invalid item" }); return; }
    const parsed = itemSchema.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid item" }); return; }
    const actor = res.locals.user as { id: string; role: string };
    const record = await WorkItem.findById(id);
    if (!record) { res.status(404).json({ error: "Item not found" }); return; }
    if (!["CEO", "HR"].includes(actor.role) && record.ownerId.toString() !== actor.id && record.assigneeId?.toString() !== actor.id) { res.status(403).json({ error: "Not permitted" }); return; }
    Object.assign(record, parsed.data);
    await record.save();
    void audit(req, "WORK_ITEM_UPDATED", "WorkItem", record.id);
    res.json({ item: record });
  } catch (error) { next(error); }
});

const jobSchema = z.object({ title: z.string().trim().min(2).max(160), department: z.string().max(60).optional(), description: z.string().max(5000).optional() });
workRouter.get("/jobs", async (_req, res, next) => {
  try { res.json({ jobs: await Job.find().sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
workRouter.post("/jobs", requireRole("CEO", "HR"), async (req, res, next) => {
  try {
    const parsed = jobSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid job" }); return; }
    const record = await Job.create({ ...parsed.data, createdBy: res.locals.user.id });
    void audit(req, "JOB_CREATED", "Job", record.id);
    res.status(201).json({ job: record });
  } catch (error) { next(error); }
});
workRouter.get("/jobs/:id/candidates", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id || !isObjectId(id)) { res.status(400).json({ error: "Invalid job" }); return; }
    res.json({ candidates: await Candidate.find({ jobId: id }).sort({ createdAt: -1 }) });
  } catch (error) { next(error); }
});
workRouter.post("/jobs/:id/candidates", requireRole("CEO", "HR"), async (req, res, next) => {
  try {
    const id = req.params.id;
    const parsed = z.object({ name: z.string().trim().min(2), email: z.string().email(), stage: z.string().max(40).default("APPLIED"), notes: z.string().max(4000).optional() }).safeParse(req.body);
    if (!id || !isObjectId(id) || !parsed.success) { res.status(400).json({ error: "Invalid candidate" }); return; }
    const candidate = await Candidate.create({ ...parsed.data, jobId: id, ownerId: res.locals.user.id });
    void audit(req, "CANDIDATE_CREATED", "Candidate", candidate.id);
    res.status(201).json({ candidate });
  } catch (error) { next(error); }
});
