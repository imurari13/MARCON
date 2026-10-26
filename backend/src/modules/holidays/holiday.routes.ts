import { Router } from "express";
import { z } from "zod";
import Holiday from "../../models/Holiday.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { isObjectId, isRealDate } from "../../utils/date.js";

export const holidayRouter = Router();
holidayRouter.use(requireAuth);

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate, "Enter a valid date");
const holidaySchema = z.object({
  name: z.string().trim().min(1).max(100),
  date,
  description: z.string().trim().max(300).optional(),
});

holidayRouter.get("/", async (_req, res, next) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 }).limit(100);
    res.json({ holidays });
  } catch (error) { next(error); }
});

holidayRouter.post("/", requireRole("CEO", "HR"), async (req, res, next) => {
  try {
    const parsed = holidaySchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid holiday" }); return; }
    if (await Holiday.exists({ date: parsed.data.date })) { res.status(409).json({ error: "A holiday already exists for this date" }); return; }
    const holiday = await Holiday.create({ ...parsed.data, createdBy: res.locals.user.id });
    res.status(201).json({ holiday });
  } catch (error) { next(error); }
});

holidayRouter.delete("/:id", requireRole("CEO", "HR"), async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id || !isObjectId(id)) { res.status(400).json({ error: "Invalid holiday id" }); return; }
    if (!await Holiday.findByIdAndDelete(id)) { res.status(404).json({ error: "Holiday not found" }); return; }
    res.status(204).end();
  } catch (error) { next(error); }
});
