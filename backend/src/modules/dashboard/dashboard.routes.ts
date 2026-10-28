import { Router } from "express";
import User from "../../models/User.js";
import Attendance from "../../models/Attendance.js";
import LeaveRequest from "../../models/LeaveRequest.js";
import Holiday from "../../models/Holiday.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { addDays, isCompanyWeeklyHoliday, todayISO } from "../../utils/date.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

type Tone = "ok" | "warn" | "bad" | "accent" | "info" | "mute";
interface Slice { label: string; value: number; tone: Tone }

const pad = (n: number) => String(n).padStart(2, "0");
const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** MM-DD a birthday falls on in a given year (29 Feb is celebrated on 28 Feb in non-leap years). */
const birthdayKey = (dob: string, year: number): string => {
  const md = dob.slice(5);
  return md === "02-29" && !isLeapYear(year) ? "02-28" : md;
};
const tally = <T extends string>(items: T[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const i of items) out[i] = (out[i] ?? 0) + 1;
  return out;
};
const PENDING_STATES = ["PENDING", "PENDING_MANAGER", "PENDING_HR"] as const;
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

dashboardRouter.get("/", async (_req, res, next) => {
  try {
    const u = res.locals.user as { id: string; role: string };
    const date = todayISO();
    const year = Number(date.slice(0, 4));
    const monthStart = `${date.slice(0, 7)}-01`;

    const [pendingLeave, checkedInToday, myLeaves, monthAttendance, monthLeaves, monthHolidays, todayHoliday, birthdayUsers] = await Promise.all([
      LeaveRequest.countDocuments({ userId: u.id, status: { $in: [...PENDING_STATES] } }),
      Attendance.exists({ userId: u.id, date }),
      LeaveRequest.find({ userId: u.id }).select("status leaveType").limit(500).lean(),
      Attendance.find({ userId: u.id, date: { $gte: monthStart, $lte: date } }).select("date").lean(),
      LeaveRequest.find({ userId: u.id, status: "APPROVED", startDate: { $lte: date }, endDate: { $gte: monthStart } }).select("startDate endDate halfDay").lean(),
      Holiday.find({ date: { $gte: monthStart, $lte: date } }).select("date").lean(),
      Holiday.exists({ date }),
      User.find({ isActive: true, dateOfBirth: { $ne: null } }).select("name dateOfBirth").lean(),
    ]);

    // ---- birthdays (today + the next 30 days) ----
    const todayKey = birthdayKey(`0000-${date.slice(5)}`, year);
    const todays = birthdayUsers
      .filter((p) => p.dateOfBirth && birthdayKey(p.dateOfBirth, year) === todayKey)
      .map((p) => ({ name: p.name, isMe: String(p._id) === u.id }));
    const upcoming: { name: string; date: string; daysAway: number; isMe: boolean }[] = [];
    for (let i = 1; i <= 30; i++) {
      const d = addDays(date, i);
      const key = d.slice(5);
      for (const p of birthdayUsers) {
        if (p.dateOfBirth && birthdayKey(p.dateOfBirth, Number(d.slice(0, 4))) === key) upcoming.push({ name: p.name, date: d, daysAway: i, isMe: String(p._id) === u.id });
      }
    }

    // ---- my month: present / on leave / holiday / absent (weekdays only) ----
    const present = new Set(monthAttendance.map((r) => r.date));
    const holidays = new Set(monthHolidays.map((h) => h.date));
    const mine = { present: 0, onLeave: 0, holiday: 0, absent: 0 };
    for (let d = monthStart; d <= date; d = addDays(d, 1)) {
      if (present.has(d)) { mine.present++; continue; }
      if (isCompanyWeeklyHoliday(d)) { mine.holiday++; continue; }
      if (holidays.has(d)) { mine.holiday++; continue; }
      const leave = monthLeaves.find((l) => l.startDate <= d && l.endDate >= d);
      if (leave) { mine.onLeave += leave.halfDay ? 0.5 : 1; continue; }
      if (d < date) mine.absent++; // today is not "absent" until the day is over
    }
    const byStatus = tally(myLeaves.map((l) => l.status));
    const charts: { id: string; title: string; slices: Slice[] }[] = [
      { id: "my-month", title: `My month so far · ${mine.present} / ${Math.max(1, Math.floor((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${monthStart}T00:00:00Z`).getTime()) / 86_400_000) + 1)} calendar days present`, slices: [
        { label: "Present", value: mine.present, tone: "ok" }, { label: "On leave", value: mine.onLeave, tone: "info" },
        { label: "Holiday", value: mine.holiday, tone: "warn" }, { label: "Absent", value: mine.absent, tone: "bad" } ] },
      { id: "my-leave", title: "My leave requests", slices: [
        { label: "Approved", value: byStatus.APPROVED ?? 0, tone: "ok" }, { label: "Pending", value: PENDING_STATES.reduce((n, k) => n + (byStatus[k] ?? 0), 0), tone: "warn" },
        { label: "Rejected", value: byStatus.REJECTED ?? 0, tone: "bad" } ] },
    ];
    const base = { mine: { pendingLeave, checkedInToday: !!checkedInToday }, birthdays: { today: todays, upcoming }, date };

    if (u.role !== "CEO" && u.role !== "HR") { res.json({ ...base, org: null, charts }); return; }

    const [headcount, presentIds, pendingApprovals, leaveAgg, roleAgg, leavesNow, leavesSoon] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Attendance.find({ date }).select("userId").lean<{ userId: unknown }[]>(),
      LeaveRequest.countDocuments({ status: { $in: ["PENDING", "PENDING_HR"] } }),
      LeaveRequest.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      User.aggregate<{ _id: string; n: number }>([{ $match: { isActive: true } }, { $group: { _id: "$role", n: { $sum: 1 } } }]),
      LeaveRequest.find({ status: "APPROVED", startDate: { $lte: date }, endDate: { $gte: date } }).populate("userId", "name employeeId department isActive").sort({ endDate: 1 }).limit(200),
      LeaveRequest.find({ status: "APPROVED", startDate: { $gt: date, $lte: addDays(date, 7) } }).populate("userId", "name employeeId department isActive").sort({ startDate: 1 }).limit(50),
    ]);
    const presentSet = new Set(presentIds.map((r) => String(r.userId)));
    const presentToday = presentSet.size;
    const dayOff = isCompanyWeeklyHoliday(date) || !!todayHoliday;
    type Who = { name: string; employeeId: string; department?: string | null; isActive: boolean };
    const person = (r: { userId: unknown }) => (r.userId && typeof r.userId === "object" && "name" in r.userId ? r.userId as Who : null);
    const shape = (r: (typeof leavesNow)[number]) => {
      const p = person(r);
      return p && p.isActive ? { name: p.name, employeeId: p.employeeId, department: p.department ?? null, leaveType: r.leaveType, halfDay: r.halfDay, startDate: r.startDate, endDate: r.endDate, days: r.durationDays } : null;
    };
    const onLeaveToday = dayOff ? [] : leavesNow.map(shape).filter((x): x is NonNullable<ReturnType<typeof shape>> => x !== null);
    const upcomingLeave = leavesSoon.map(shape).filter((x): x is NonNullable<ReturnType<typeof shape>> => x !== null);
    const onLeave = dayOff ? 0 : leavesNow.reduce((total, r) => { const p = person(r); return total + (p && p.isActive && !presentSet.has(String((r.userId as unknown as { _id: unknown })._id)) ? (r.halfDay ? 0.5 : 1) : 0); }, 0);
    const rest = Math.max(0, headcount - presentToday - onLeave);
    const leaveCount = Object.fromEntries(leaveAgg.map((r) => [r._id, r.n])) as Record<string, number>;
    const roleTone: Record<string, Tone> = { CEO: "accent", HR: "warn", MANAGER: "info", EMPLOYEE: "ok" };
    const orgCharts: typeof charts = [
      { id: "org-today", title: "Attendance today", slices: dayOff
        ? [{ label: "Present", value: presentToday, tone: "ok" }, { label: "Day off", value: rest, tone: "mute" }]
        : [{ label: "Present", value: presentToday, tone: "ok" }, { label: "On leave", value: onLeave, tone: "info" }, { label: "Not in yet", value: rest, tone: "bad" }] },
      { id: "org-leave", title: "Leave requests", slices: ["APPROVED", "PENDING", "REJECTED"].map((k) => ({ label: cap(k), value: k === "PENDING" ? PENDING_STATES.reduce((n, s) => n + (leaveCount[s] ?? 0), 0) : (leaveCount[k] ?? 0), tone: (k === "APPROVED" ? "ok" : k === "PENDING" ? "warn" : "bad") as Tone })) },
      { id: "org-roles", title: "People by role", slices: roleAgg.map((r) => ({ label: cap(r._id), value: r.n, tone: roleTone[r._id] ?? "mute" })) },
    ];
    res.json({ ...base, org: { headcount, presentToday, pendingApprovals, onLeaveToday, upcomingLeave }, charts: orgCharts });
  } catch (e) { next(e); }
});

/** Everything the calendar needs for one month: holidays, birthdays, my leave and my attendance. */
dashboardRouter.get("/calendar", async (req, res, next) => {
  try {
    const month = typeof req.query.month === "string" ? req.query.month : todayISO().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { res.status(400).json({ error: "Invalid month" }); return; }
    const u = res.locals.user as { id: string };
    const [y, m] = month.split("-").map(Number) as [number, number];
    const start = `${month}-01`;
    const end = `${month}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;

    const [holidays, people, leaves, attendance] = await Promise.all([
      Holiday.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 }).select("name date description").lean(),
      User.find({ isActive: true, dateOfBirth: { $ne: null } }).select("name dateOfBirth").lean(),
      LeaveRequest.find({ userId: u.id, status: { $in: ["PENDING", "APPROVED"] }, startDate: { $lte: end }, endDate: { $gte: start } }).select("startDate endDate status leaveType").lean(),
      Attendance.find({ userId: u.id, date: { $gte: start, $lte: end } }).select("date").lean(),
    ]);
    const birthdays = people.flatMap((p) => {
      if (!p.dateOfBirth) return [];
      const key = birthdayKey(p.dateOfBirth, y);
      return key.startsWith(`${pad(m)}-`) ? [{ name: p.name, date: `${y}-${key}`, isMe: String(p._id) === u.id }] : [];
    });
    res.json({
      today: todayISO(),
      holidays: holidays.map((h) => ({ name: h.name, date: h.date, description: h.description ?? "" })),
      birthdays,
      leaves: leaves.map((l) => ({ startDate: l.startDate, endDate: l.endDate, status: l.status, leaveType: l.leaveType })),
      attendance: attendance.map((a) => a.date),
    });
  } catch (e) { next(e); }
});
