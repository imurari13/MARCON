import { env } from "../config/env.js";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: env.APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date (YYYY-MM-DD) in the company time zone, not UTC. */
export const todayISO = (): string => formatter.format(new Date());

/** True only for real calendar dates, e.g. rejects 2026-02-31. */
export function isRealDate(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const isObjectId = (value: string): boolean => /^[a-f\d]{24}$/i.test(value);

const timeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: env.APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const timeWithSecondsFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: env.APP_TIMEZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/** The company-time-zone calendar date (YYYY-MM-DD) an instant falls on. */
export const dateISOOf = (d: Date): string => formatter.format(d);

/** HH:MM of an instant in the company time zone. */
export const timeOf = (d: Date): string => timeFormatter.format(d);

export const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const weekdayOf = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay();

export const isSunday = (iso: string): boolean => weekdayOf(iso) === 0;
export const isSaturday = (iso: string): boolean => weekdayOf(iso) === 6;

/** Whether the Saturday check-out deadline has passed in the company time zone. */
export const hasSaturdayCheckoutDeadlinePassed = (instant: Date): boolean =>
  isSaturday(dateISOOf(instant)) && timeWithSecondsFormatter.format(instant) >= "17:00:00";

export const isWeekend = (iso: string): boolean => {
  const w = weekdayOf(iso);
  return w === 0 || w === 6;
};

/** Company weekly holidays: every Sunday and the second Saturday of each month. */
export const isCompanyWeeklyHoliday = (iso: string): boolean => {
  const date = new Date(`${iso}T00:00:00Z`);
  const weekday = weekdayOf(iso);
  return weekday === 0 || (weekday === 6 && date.getUTCDate() >= 8 && date.getUTCDate() <= 14);
};

export const isMonthKey = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** First and last calendar day of a YYYY-MM month. */
export function monthBounds(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return { start: `${month}-01`, end: `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}` };
}
