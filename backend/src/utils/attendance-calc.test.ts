import test from "node:test";
import assert from "node:assert/strict";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017";
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-1234";
process.env.APP_TIMEZONE = "UTC";
const { buildMonth, firstOpenPunch } = await import("./attendance-calc.js");
const { isSaturday, isSaturdayCheckInTime, isSaturdayCheckOutTime, isSunday } = await import("./date.js");

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00Z`);
const base = { month: "2026-10", today: "2026-10-15", now: at("2026-10-15", "12:00"), holidays: new Set(["2026-10-02"]) };

test("Sunday is a no-attendance day and Saturday is a working day", () => {
  assert.equal(isSunday("2026-10-04"), true);
  assert.equal(isSaturday("2026-10-03"), true);
});

test("Saturday check-in is limited to 10 AM through 5 PM", () => {
  assert.equal(isSaturdayCheckInTime(at("2026-10-03", "09:59")), false);
  assert.equal(isSaturdayCheckInTime(at("2026-10-03", "10:00")), true);
  assert.equal(isSaturdayCheckInTime(at("2026-10-03", "17:00")), true);
  assert.equal(isSaturdayCheckInTime(at("2026-10-03", "17:01")), false);
});

test("Saturday check-out is allowed from 5 PM onward", () => {
  assert.equal(isSaturdayCheckOutTime(at("2026-10-03", "16:59")), false);
  assert.equal(isSaturdayCheckOutTime(at("2026-10-03", "17:00")), true);
  assert.equal(isSaturdayCheckOutTime(at("2026-10-03", "20:00")), true);
});

test("a Saturday check-out after 5 PM counts as a full attendance day", () => {
  const { days, summary } = buildMonth({
    ...base,
    today: "2026-10-04",
    records: [{ date: "2026-10-03", checkIn: at("2026-10-03", "10:00"), checkOut: at("2026-10-03", "18:30") }],
    leaves: [],
  });
  assert.equal(days.find((day) => day.date === "2026-10-03")?.status, "present");
  assert.equal(summary.present, 1);
});

test("counts present days, hours, leave and absences for a month so far", () => {
  const { days, summary } = buildMonth({
    ...base,
    records: [
      { date: "2026-10-01", checkIn: at("2026-10-01", "09:00"), checkOut: at("2026-10-01", "17:30") },  // 8.5h
      { date: "2026-10-05", checkIn: at("2026-10-05", "09:30"), checkOut: at("2026-10-05", "18:30") },  // 9h
      { date: "2026-10-06", checkIn: at("2026-10-06", "09:30") },                                       // never closed
      { date: "2026-10-15", checkIn: at("2026-10-15", "09:00") },                                       // still on the clock (3h)
    ],
    leaves: [{ startDate: "2026-10-07", endDate: "2026-10-08", halfDay: false, leaveType: "SICK" }],
  });
  // Sundays and the second Saturday are weekly holidays; 3 Oct remains a working Saturday.
  assert.equal(summary.workingDays, 11);
  assert.equal(summary.calendarDays, 15);
  assert.equal(summary.present, 2);
  assert.equal(summary.leave, 2);
  assert.equal(summary.absent, 5);                    // 3rd, 9th, 12th, 13th and 14th
  assert.equal(summary.minutes, 510 + 540 + 0 + 180);
  assert.equal(summary.missedPunchOuts, 1);
  assert.equal(summary.incomplete, 2);
  assert.equal(summary.avgMinutes, Math.round((510 + 540) / 2));
  assert.equal(days.find((d) => d.date === "2026-10-02")?.status, "holiday");
  assert.equal(days.find((d) => d.date === "2026-10-03")?.status, "absent");
  assert.equal(days.find((d) => d.date === "2026-10-10")?.status, "holiday");
  assert.equal(days.find((d) => d.date === "2026-10-06")?.missedPunchOut, true);
  assert.equal(days.find((d) => d.date === "2026-10-06")?.status, "incomplete");
  assert.equal(days.find((d) => d.date === "2026-10-15")?.status, "incomplete");
  assert.equal(days.find((d) => d.date === "2026-10-20")?.status, "upcoming");
});

test("a check-in-only correction does not count as a full present day", () => {
  const { summary, days } = buildMonth({
    ...base,
    records: [{ date: "2026-10-09", checkIn: at("2026-10-09", "09:30") }],
    leaves: [],
  });
  assert.equal(days.find((d) => d.date === "2026-10-09")?.status, "incomplete");
  assert.equal(summary.present, 0);
  assert.equal(summary.incomplete, 1);
  assert.equal(summary.missedPunchOuts, 1);
});

test("today without a check-in is not yet absent", () => {
  const { days, summary } = buildMonth({ ...base, records: [], leaves: [] });
  assert.equal(days.find((d) => d.date === "2026-10-15")?.status, "upcoming");
  assert.equal(summary.present, 0);
  assert.equal(summary.rate, 0);
});

test("a half-day leave without attendance is half leave, half absent", () => {
  const { summary } = buildMonth({ ...base, records: [], leaves: [{ startDate: "2026-10-09", endDate: "2026-10-09", halfDay: true, leaveType: "CASUAL" }] });
  assert.equal(summary.leave, 0.5);
  assert.ok(summary.absent >= 0.5);
});

test("days before a person joined are not counted against them", () => {
  const { days, summary } = buildMonth({ ...base, joined: "2026-10-12", records: [], leaves: [] });
  assert.equal(days.find((d) => d.date === "2026-10-05")?.status, "na");
  assert.equal(summary.workingDays, 4); // 12, 13, 14, 15
});

test("firstOpenPunch returns the oldest earlier day with no check-out", () => {
  const recs = [{ date: "2026-10-09", checkOut: null }, { date: "2026-10-06", checkOut: null }, { date: "2026-10-07", checkOut: new Date() }, { date: "2026-10-15", checkOut: null }];
  assert.equal(firstOpenPunch(recs, "2026-10-15"), "2026-10-06");
  assert.equal(firstOpenPunch([], "2026-10-15"), null);
});
