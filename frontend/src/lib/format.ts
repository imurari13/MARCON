/** "7h 30m" from minutes. */
export const fmtMinutes = (m: number): string => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;

/** "October 2026" from "2026-10". */
export const monthLabel = (month: string): string => new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/** Shifts a "YYYY-MM" key by whole months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const cap = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase();

/** "Mon, 5 Oct" from "2026-10-05". */
export const dayLabel = (iso: string): string => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
