import { addDays, isWeekend, monthBounds, timeOf } from "./date.js";

export type DayStatus = "present" | "leave" | "holiday" | "weekend" | "absent" | "upcoming" | "na";

export interface AttRec { date: string; checkIn: Date; checkOut?: Date | null }
export interface LeaveSpan { startDate: string; endDate: string; halfDay: boolean; leaveType: string }

export interface DayRow {
  date: string;
  status: DayStatus;
  checkIn: string | null;   // HH:MM, company time zone
  checkOut: string | null;
  minutes: number;
  missedPunchOut: boolean;
  leaveType: string | null;
}

export interface MonthSummary {
  workingDays: number;      // weekdays that are not holidays, from the join date up to today
  present: number;
  leave: number;            // days (half-days count 0.5)
  absent: number;
  minutes: number;
  avgMinutes: number;       // per present day that has a complete punch pair
  missedPunchOuts: number;
  rate: number;             // present / workingDays, 0-100
}

export interface MonthInput {
  month: string;            // YYYY-MM
  today: string;            // YYYY-MM-DD
  now: Date;
  records: AttRec[];
  leaves: LeaveSpan[];
  holidays: ReadonlySet<string>;
  joined?: string | null;   // first day this person counts (their account creation date)
}

const minutesBetween = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));

/** One person's month, day by day, with totals. Pure: no database, no clock. */
export function buildMonth(input: MonthInput): { days: DayRow[]; summary: MonthSummary } {
  const { start, end } = monthBounds(input.month);
  const byDate = new Map(input.records.map((r) => [r.date, r]));
  const days: DayRow[] = [];
  const s: MonthSummary = { workingDays: 0, present: 0, leave: 0, absent: 0, minutes: 0, avgMinutes: 0, missedPunchOuts: 0, rate: 0 };
  let completeDays = 0, completeMinutes = 0;

  for (let d = start; d <= end; d = addDays(d, 1)) {
    const span = input.leaves.find((l) => l.startDate <= d && l.endDate >= d);
    const leaveFraction = span ? (span.halfDay ? 0.5 : 1) : 0;
    const row: DayRow = { date: d, status: "upcoming", checkIn: null, checkOut: null, minutes: 0, missedPunchOut: false, leaveType: span?.leaveType ?? null };
    const rec = byDate.get(d);

    if (input.joined && d < input.joined && !rec) { row.status = "na"; days.push(row); continue; }
    const counted = d <= input.today;
    const working = !isWeekend(d) && !input.holidays.has(d);
    if (counted && working) s.workingDays++;

    if (rec) {
      row.status = "present";
      row.checkIn = timeOf(rec.checkIn);
      s.present++;
      if (rec.checkOut) {
        row.checkOut = timeOf(rec.checkOut);
        row.minutes = minutesBetween(rec.checkIn, rec.checkOut);
        completeDays++; completeMinutes += row.minutes;
      } else if (d === input.today) {
        row.minutes = minutesBetween(rec.checkIn, input.now); // still on the clock
      } else {
        row.missedPunchOut = true; s.missedPunchOuts++;
      }
      s.minutes += row.minutes;
      if (leaveFraction === 0.5) s.leave += 0.5;
    } else if (isWeekend(d)) row.status = "weekend";
    else if (input.holidays.has(d)) row.status = "holiday";
    else if (leaveFraction > 0) {
      row.status = "leave";
      if (counted) { s.leave += leaveFraction; if (d < input.today) s.absent += 1 - leaveFraction; }
    } else if (d < input.today) { row.status = "absent"; s.absent++; }
    days.push(row);
  }

  s.avgMinutes = completeDays ? Math.round(completeMinutes / completeDays) : 0;
  s.rate = s.workingDays ? Math.min(100, Math.round((s.present / s.workingDays) * 100)) : 0;
  return { days, summary: s };
}

/** The oldest earlier day (before `today`) whose check-in was never closed, if any. */
export function firstOpenPunch(records: { date: string; checkOut?: Date | null }[], today: string): string | null {
  return records.filter((r) => r.date < today && !r.checkOut).map((r) => r.date).sort()[0] ?? null;
}
