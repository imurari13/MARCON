import { Router } from "express";
import type { Types } from "mongoose";
import User from "../../models/User.js";
import Attendance from "../../models/Attendance.js";
import LeaveRequest from "../../models/LeaveRequest.js";
import Holiday from "../../models/Holiday.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { audit } from "../../utils/audit.js";
import { buildMonth, type AttRec, type DayRow, type LeaveSpan, type MonthSummary } from "../../utils/attendance-calc.js";
import { dateISOOf, isMonthKey, isObjectId, monthBounds, todayISO } from "../../utils/date.js";
import { buildXlsx } from "../../utils/xlsx.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requireRole("CEO", "HR"));

interface Person { _id: Types.ObjectId; employeeId: string; name: string; role: string; department?: string | null; createdAt?: Date }
interface Row { id: string; employeeId: string; name: string; role: string; department: string; days: DayRow[]; summary: MonthSummary }

const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

function monthParam(raw: unknown): string | null {
  const month = typeof raw === "string" && raw ? raw : todayISO().slice(0, 7);
  return isMonthKey(month) ? month : null;
}

/** Everything a month report needs, computed once per request. */
async function loadMonth(month: string) {
  const { start, end } = monthBounds(month);
  const today = todayISO(), now = new Date();
  const [people, records, leaves, holidays] = await Promise.all([
    User.find({ isActive: true }).sort({ employeeId: 1 }).select("employeeId name role department createdAt").lean<Person[]>(),
    Attendance.find({ date: { $gte: start, $lte: end } }).select("userId date checkIn checkOut").lean<(AttRec & { userId: Types.ObjectId })[]>(),
    LeaveRequest.find({ status: "APPROVED", startDate: { $lte: end }, endDate: { $gte: start } }).select("userId leaveType startDate endDate halfDay durationDays").lean<(LeaveSpan & { userId: Types.ObjectId; durationDays: number })[]>(),
    Holiday.find({ date: { $gte: start, $lte: end } }).select("date").lean<{ date: string }[]>(),
  ]);
  const holidaySet = new Set(holidays.map((h) => h.date));
  const group = <T extends { userId: Types.ObjectId }>(items: T[]) => {
    const m = new Map<string, T[]>();
    for (const i of items) { const k = i.userId.toString(); (m.get(k) ?? m.set(k, []).get(k)!).push(i); }
    return m;
  };
  const recBy = group(records), leaveBy = group(leaves);
  const rows: Row[] = people.map((p) => {
    const id = p._id.toString();
    const built = buildMonth({ month, today, now, records: recBy.get(id) ?? [], leaves: leaveBy.get(id) ?? [], holidays: holidaySet, joined: p.createdAt ? dateISOOf(p.createdAt) : null });
    return { id, employeeId: p.employeeId, name: p.name, role: p.role, department: p.department ?? "—", ...built };
  });
  return { month, today, start, end, rows, leaves, people };
}

/** Org-wide month: one line per person plus a per-day head-count for the column chart. */
reportsRouter.get("/month", async (req, res, next) => {
  try {
    const month = monthParam(req.query.month);
    if (!month) { res.status(400).json({ error: "Invalid month" }); return; }
    const { rows, today } = await loadMonth(month);
    const totals = rows.reduce((t, r) => ({ present: t.present + r.summary.present, leave: t.leave + r.summary.leave, absent: t.absent + r.summary.absent, minutes: t.minutes + r.summary.minutes, incomplete: t.incomplete + r.summary.incomplete, missedPunchOuts: t.missedPunchOuts + r.summary.missedPunchOuts, workingDays: t.workingDays + r.summary.workingDays, calendarDays: t.calendarDays + r.summary.calendarDays }), { present: 0, leave: 0, absent: 0, minutes: 0, incomplete: 0, missedPunchOuts: 0, workingDays: 0, calendarDays: 0 });
    const daily = (rows[0]?.days ?? []).map((d, i) => ({
      date: d.date,
      present: rows.filter((r) => r.days[i]?.status === "present").length,
      checkedIn: rows.filter((r) => r.days[i]?.status === "present" || r.days[i]?.status === "incomplete").length,
      onLeave: rows.filter((r) => r.days[i]?.status === "leave").length,
      working: d.status !== "weekend" && d.status !== "holiday" && d.status !== "na",
    }));
    res.json({
      month, today,
      totals: { headcount: rows.length, ...totals, hours: hours(totals.minutes), rate: totals.workingDays ? Math.min(100, Math.round((totals.present / totals.workingDays) * 100)) : 0, calendarRate: totals.calendarDays ? Math.min(100, Math.round((totals.present / totals.calendarDays) * 100)) : 0 },
      daily,
      employees: rows.map((r) => ({ id: r.id, employeeId: r.employeeId, name: r.name, role: r.role, department: r.department, ...r.summary, hours: hours(r.summary.minutes) })),
    });
  } catch (e) { next(e); }
});

/** One person's month, day by day: the drill-down behind each bar. */
reportsRouter.get("/employee/:id", async (req, res, next) => {
  try {
    const month = monthParam(req.query.month), id = req.params.id;
    if (!month) { res.status(400).json({ error: "Invalid month" }); return; }
    if (!id || !isObjectId(id)) { res.status(400).json({ error: "Invalid employee" }); return; }
    const { rows } = await loadMonth(month);
    const row = rows.find((r) => r.id === id);
    if (!row) { res.status(404).json({ error: "Employee not found" }); return; }
    res.json({ month, employee: { id: row.id, employeeId: row.employeeId, name: row.name, role: row.role, department: row.department }, summary: { ...row.summary, hours: hours(row.summary.minutes) }, days: row.days });
  } catch (e) { next(e); }
});

/** Excel workbook for the month: Summary, Daily log and Leave sheets. */
reportsRouter.get("/export", async (req, res, next) => {
  try {
    const month = monthParam(req.query.month);
    if (!month) { res.status(400).json({ error: "Invalid month" }); return; }
    const { rows, leaves, people } = await loadMonth(month);
    const nameOf = new Map(people.map((p) => [p._id.toString(), p]));
    const label: Record<string, string> = { present: "Present", incomplete: "Incomplete", leave: "On leave", holiday: "Holiday", weekend: "Weekend", absent: "Absent", upcoming: "Upcoming", na: "—" };

    const book = buildXlsx([
      {
        name: "Summary",
        columns: [{ header: "Employee ID", width: 14 }, { header: "Name", width: 26 }, { header: "Department", width: 18 }, { header: "Role", width: 11 }, { header: "Working days", width: 14 }, { header: "Present", width: 10 }, { header: "Incomplete", width: 12 }, { header: "On leave", width: 10 }, { header: "Absent", width: 10 }, { header: "Hours worked", width: 14 }, { header: "Avg hours / day", width: 15 }, { header: "Missed punch-outs", width: 18 }, { header: "Attendance %", width: 14 }],
        rows: rows.map((r) => [r.employeeId, r.name, r.department, r.role, r.summary.workingDays, r.summary.present, r.summary.incomplete, r.summary.leave, r.summary.absent, hours(r.summary.minutes), hours(r.summary.avgMinutes), r.summary.missedPunchOuts, r.summary.rate]),
      },
      {
        name: "Daily log",
        columns: [{ header: "Date", width: 12 }, { header: "Employee ID", width: 14 }, { header: "Name", width: 26 }, { header: "Status", width: 12 }, { header: "Check-in", width: 10 }, { header: "Check-out", width: 10 }, { header: "Hours", width: 9 }, { header: "Note", width: 24 }],
        rows: rows.flatMap((r) => r.days.filter((d) => d.status !== "na").map((d) => [d.date, r.employeeId, r.name, label[d.status] ?? d.status, d.checkIn, d.checkOut, d.status === "present" ? hours(d.minutes) : null, d.missedPunchOut ? "Missed punch-out" : d.leaveType ? `${d.leaveType.charAt(0)}${d.leaveType.slice(1).toLowerCase()} leave` : null])),
      },
      {
        name: "Leave",
        columns: [{ header: "Employee ID", width: 14 }, { header: "Name", width: 26 }, { header: "Type", width: 12 }, { header: "From", width: 12 }, { header: "To", width: 12 }, { header: "Days", width: 8 }, { header: "Half day", width: 10 }],
        rows: leaves.map((l) => { const p = nameOf.get(l.userId.toString()); return [p?.employeeId ?? "—", p?.name ?? "Former employee", l.leaveType.charAt(0) + l.leaveType.slice(1).toLowerCase(), l.startDate, l.endDate, l.durationDays, l.halfDay ? "Yes" : "No"]; }),
      },
    ]);
    void audit(req, "ATTENDANCE_REPORT_EXPORTED", "Report", undefined, { month });
    res.set({ "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="marcon-attendance-${month}.xlsx"`, "Cache-Control": "no-store" });
    res.send(book);
  } catch (e) { next(e); }
});
