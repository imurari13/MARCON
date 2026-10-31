import { Router } from "express";
import { z } from "zod";
import Attendance from "../../models/Attendance.js";
import AttendanceRegularization from "../../models/AttendanceRegularization.js";
import Holiday from "../../models/Holiday.js";
import LeaveRequest from "../../models/LeaveRequest.js";
import Notification from "../../models/Notification.js";
import User from "../../models/User.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { audit } from "../../utils/audit.js";
import { buildMonth, firstOpenPunch, type AttRec, type LeaveSpan } from "../../utils/attendance-calc.js";
import { dateISOOf, isMonthKey, isObjectId, isRealDate, isSaturday, isSaturdayCheckInTime, isSaturdayCheckOutTime, isSunday, monthBounds, timeOf, todayISO } from "../../utils/date.js";

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);
const LATE_GRACE_MINUTES = 10;
const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};
const lateMinutesFor = (checkIn: Date, workStartTime: string) => Math.max(0, minutesOf(timeOf(checkIn)) - minutesOf(workStartTime) - LATE_GRACE_MINUTES);

/**
 * The oldest earlier day on which this person checked in but never checked out, and for which
 * they have not yet asked for a correction (a pending or approved request that supplies the
 * missing check-out). Until that request exists they cannot check in again.
 */
async function unresolvedPunch(userId: string): Promise<string | null> {
  const today = todayISO();
  const open = await Attendance.find({ userId, date: { $lt: today }, checkOut: null }).select("date checkOut").lean();
  if (!open.length) return null;
  const covered = new Set(
    (await AttendanceRegularization.find({ userId, status: { $in: ["PENDING", "APPROVED"] }, requestedCheckOut: { $ne: null }, date: { $in: open.map((o) => o.date) } }).select("date").lean()).map((r) => r.date),
  );
  return firstOpenPunch(open.filter((o) => !covered.has(o.date)), today);
}

attendanceRouter.get("/today", async (_req, res, next) => {
  try {
    const userId = res.locals.user.id as string;
    const today = todayISO();
    const now = new Date();
    const saturday = isSaturday(today);
    const sunday = isSunday(today);
    const [record, blockedBy] = await Promise.all([Attendance.findOne({ userId, date: today }).lean(), unresolvedPunch(userId)]);
    res.json({
      record,
      blockedBy,
      dayPolicy: {
        isSunday: sunday,
        isSaturday: saturday,
        canCheckIn: !sunday && (!saturday || isSaturdayCheckInTime(now)),
        canCheckOut: !sunday && (!saturday || isSaturdayCheckOutTime(now)),
      },
    });
  } catch (e) { next(e); }
});

attendanceRouter.post("/check-in", async (_req, res, next) => {
  try {
    const userId = res.locals.user.id as string;
    const today = todayISO();
    if (isSunday(today)) { res.status(409).json({ error: "Attendance check-in is unavailable on Sundays" }); return; }
    if (isSaturday(today) && !isSaturdayCheckInTime(new Date())) {
      res.status(409).json({ error: "Saturday check-in is available from 10:00 AM to 5:00 PM" });
      return;
    }
    const [holiday, blockedBy, user] = await Promise.all([Holiday.findOne({ date: today }).select("name").lean(), unresolvedPunch(userId), User.findById(userId).select("workStartTime").lean()]);
    if (holiday) { res.status(409).json({ error: `Today is a holiday: ${holiday.name}` }); return; }
    if (blockedBy) { res.status(409).json({ error: `You didn't check out on ${blockedBy}. Request a correction for that day first, then you can check in.`, blockedBy }); return; }
    const checkedInAt = new Date();
    const rec = await Attendance.findOneAndUpdate(
      { userId, date: today },
      { $setOnInsert: { checkIn: checkedInAt, lateMinutes: lateMinutesFor(checkedInAt, user?.workStartTime ?? "09:30") } },
      { upsert: true, returnDocument: "after" },
    );
    res.status(201).json({ record: rec });
  } catch (e) { next(e); }
});

const checkOutSchema = z.object({ reason: z.string().trim().min(3).max(500).optional() });

attendanceRouter.post("/check-out", async (req, res, next) => {
  try {
    const parsed = checkOutSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Enter an early check-out reason of at least 3 characters" }); return; }
    const checkedOutAt = new Date();
    const today = dateISOOf(checkedOutAt);
    if (isSunday(today)) { res.status(409).json({ error: "Attendance check-out is unavailable on Sundays" }); return; }
    const saturday = isSaturday(today);
    if (saturday && !isSaturdayCheckOutTime(checkedOutAt)) {
      res.status(409).json({ error: "Saturday check-out is available from 5:00 PM onward" });
      return;
    }
    const [user, openRecord] = await Promise.all([
      User.findById(res.locals.user.id).select("workStartTime workEndTime").lean(),
      Attendance.findOne({ userId: res.locals.user.id, date: today, checkOut: null }).select("_id checkIn").lean(),
    ]);
    if (!openRecord) { res.status(409).json({ error: "No open check-in for today" }); return; }
    const shiftMinutes = Math.max(1, minutesOf(user?.workEndTime ?? "18:30") - minutesOf(user?.workStartTime ?? "09:30"));
    const early = !saturday && checkedOutAt.getTime() - openRecord.checkIn.getTime() < shiftMinutes * 60_000;
    if (early && !parsed.data.reason) { res.status(400).json({ error: "A clarification is required until you complete your assigned shift hours" }); return; }
    const rec = await Attendance.findOneAndUpdate(
      { _id: openRecord._id, checkOut: null },
      { $set: { checkOut: checkedOutAt, earlyCheckoutReason: early ? parsed.data.reason : null } },
      { returnDocument: "after" },
    );
    if (!rec) { res.status(409).json({ error: "Your attendance record changed. Please refresh and try again." }); return; }
    if (early) void audit(req, "ATTENDANCE_EARLY_CHECKOUT", "Attendance", rec.id, { reason: parsed.data.reason });
    res.json({ record: rec });
  } catch (e) { next(e); }
});

attendanceRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ records: await Attendance.find({ userId: res.locals.user.id }).sort({ date: -1 }).limit(31).lean() });
  } catch (e) { next(e); }
});

/** A personal month view, including live hours for an open punch. */
attendanceRouter.get("/summary", async (req, res, next) => {
  try {
    const month = typeof req.query.month === "string" ? req.query.month : todayISO().slice(0, 7);
    if (!isMonthKey(month)) { res.status(400).json({ error: "Invalid month" }); return; }
    const userId = res.locals.user.id as string;
    const { start, end } = monthBounds(month);
    const [records, leaves, holidays, employee] = await Promise.all([
      Attendance.find({ userId, date: { $gte: start, $lte: end } }).select("date checkIn checkOut").lean<AttRec[]>(),
      LeaveRequest.find({ userId, status: "APPROVED", startDate: { $lte: end }, endDate: { $gte: start } }).select("leaveType startDate endDate halfDay").lean<LeaveSpan[]>(),
      Holiday.find({ date: { $gte: start, $lte: end } }).select("date").lean<{ date: string }[]>(),
      User.findById(userId).select("createdAt").lean<{ createdAt?: Date }>(),
    ]);
    res.json({ month, ...buildMonth({ month, today: todayISO(), now: new Date(), records, leaves, holidays: new Set(holidays.map((h) => h.date)), joined: employee?.createdAt ? dateISOOf(employee.createdAt) : null }) });
  } catch (e) { next(e); }
});

/** Managers are limited to direct reports; HR and CEO retain organisation-wide visibility. */
attendanceRouter.get("/team", requireRole("CEO", "HR", "MANAGER"), async (_req, res, next) => {
  try {
    const actor = res.locals.user as { id: string; role: string };
    const userIds = actor.role === "MANAGER" ? await User.find({ managerId: actor.id, isActive: true }).distinct("_id") : await User.find({ isActive: true }).distinct("_id");
    const records = await Attendance.find({ userId: { $in: userIds } }).populate("userId", "name employeeId department").sort({ date: -1 }).limit(200).lean();
    res.json({ records });
  } catch (e) { next(e); }
});

// ---- corrections (regularization) ----
const correctionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate),
  requestedCheckIn: z.string().datetime().nullable().optional(),
  requestedCheckOut: z.string().datetime().nullable().optional(),
  reason: z.string().trim().min(3).max(500),
});

attendanceRouter.post("/regularizations", async (req, res, next) => {
  try {
    const p = correctionSchema.safeParse(req.body);
    if (!p.success) { res.status(400).json({ error: "Enter valid correction details" }); return; }
    const userId = res.locals.user.id as string;
    const { date } = p.data;
    const checkIn = p.data.requestedCheckIn ? new Date(p.data.requestedCheckIn) : null;
    const checkOut = p.data.requestedCheckOut ? new Date(p.data.requestedCheckOut) : null;

    if (!checkIn && !checkOut) { res.status(400).json({ error: "Provide a corrected check-in or check-out time" }); return; }
    if (date > todayISO()) { res.status(400).json({ error: "You can only correct today or an earlier day" }); return; }
    for (const t of [checkIn, checkOut]) if (t && dateISOOf(t) !== date) { res.status(400).json({ error: "Corrected times must fall on the date you are correcting" }); return; }
    if (checkIn && checkOut && checkOut <= checkIn) { res.status(400).json({ error: "Check-out must be after check-in" }); return; }

    const existing = await Attendance.findOne({ userId, date }).select("checkIn checkOut");
    if (!existing && (!checkIn || !checkOut)) { res.status(400).json({ error: "You have no attendance on that day, so the correction needs both check-in and check-out times" }); return; }
    const inFinal = checkIn ?? existing?.checkIn;
    if (checkOut && inFinal && checkOut <= inFinal) { res.status(400).json({ error: "Check-out must be after check-in" }); return; }
    if (await AttendanceRegularization.exists({ userId, date, status: "PENDING" })) { res.status(409).json({ error: "You already have a pending correction for that day" }); return; }

    const request = await AttendanceRegularization.create({ userId, date, requestedCheckIn: checkIn, requestedCheckOut: checkOut, reason: p.data.reason });
    const reviewers = (await User.find({ isActive: true, role: { $in: ["CEO", "HR"] }, _id: { $ne: userId } }).select("_id").lean()).map((r) => r._id);
    if (reviewers.length) await Notification.insertMany(reviewers.map((r) => ({ userId: r, title: "Attendance correction to review", body: `${res.locals.user.fullName} asked to correct ${date}.`, type: "ATTENDANCE", link: "/corrections" })));
    void audit(req, "ATTENDANCE_CORRECTION_REQUESTED", "AttendanceRegularization", request.id, { date });
    res.status(201).json({ request });
  } catch (e) { next(e); }
});

attendanceRouter.get("/regularizations/mine", async (_req, res, next) => {
  try { res.json({ requests: await AttendanceRegularization.find({ userId: res.locals.user.id }).sort({ createdAt: -1 }).limit(20) }); } catch (e) { next(e); }
});

attendanceRouter.get("/regularizations", requireRole("CEO", "HR"), async (_req, res, next) => {
  try { res.json({ requests: await AttendanceRegularization.find({ status: "PENDING" }).populate("userId", "name employeeId").sort({ createdAt: 1 }) }); } catch (e) { next(e); }
});

for (const [action, status] of [["approve", "APPROVED"], ["reject", "REJECTED"]] as const) {
  attendanceRouter.post(`/regularizations/:id/${action}`, requireRole("CEO", "HR"), async (req, res, next) => {
    try {
      const requestId = req.params.id;
      if (!requestId || !isObjectId(requestId)) { res.status(400).json({ error: "Invalid correction request" }); return; }
      const actor = res.locals.user as { id: string };
      const request = await AttendanceRegularization.findOneAndUpdate({ _id: requestId, status: "PENDING", userId: { $ne: actor.id } }, { $set: { status, reviewedBy: actor.id, reviewedAt: new Date() } }, { returnDocument: "after" });
      if (!request) { res.status(409).json({ error: "Request is no longer pending, or you cannot review your own" }); return; }

      if (status === "APPROVED") {
        const changes: Record<string, Date | number> = {};
        if (request.requestedCheckIn) changes.checkIn = request.requestedCheckIn;
        if (request.requestedCheckOut) changes.checkOut = request.requestedCheckOut;
        const existing = await Attendance.findOne({ userId: request.userId, date: request.date }).select("_id checkIn").lean();
        const checkIn = request.requestedCheckIn ?? existing?.checkIn;
        const employee = await User.findById(request.userId).select("workStartTime").lean();
        if (checkIn) changes.lateMinutes = lateMinutesFor(checkIn, employee?.workStartTime ?? "09:30");
        if (existing) await Attendance.updateOne({ _id: existing._id }, { $set: changes });
        else {
          const correctedCheckIn = request.requestedCheckIn ?? request.requestedCheckOut ?? new Date();
          await Attendance.create({ userId: request.userId, date: request.date, checkIn: correctedCheckIn, lateMinutes: lateMinutesFor(correctedCheckIn, employee?.workStartTime ?? "09:30"), ...(request.requestedCheckOut ? { checkOut: request.requestedCheckOut } : {}) });
        }
      }
      await Notification.create({ userId: request.userId, title: `Attendance correction ${status.toLowerCase()}`, body: `Your correction for ${request.date} was ${status.toLowerCase()}.`, type: "ATTENDANCE", link: "/attendance" });
      void audit(req, status === "APPROVED" ? "ATTENDANCE_CORRECTION_APPROVED" : "ATTENDANCE_CORRECTION_REJECTED", "AttendanceRegularization", request.id, { date: request.date });
      res.json({ request });
    } catch (e) { next(e); }
  });
}
