import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { gsap } from "gsap";
import { useAuth } from "../context/AuthContext";
import { apiRequest, downloadFile } from "../services/api";
import { Avatar, Card, Empty, PageHead, Skeleton } from "../components/ui";
import { useToast } from "../components/Toast";
import { ColumnChart, RankChart, type Bar } from "../components/Charts";
import { IconChevronLeft, IconChevronRight, IconChart, IconDownload, IconX } from "../components/Icons";
import { countUp } from "../hooks/useMotion";
import { reduced } from "../lib/gsap";
import { cap, dayLabel, fmtMinutes, monthLabel, shiftMonth } from "../lib/format";

interface EmpRow { id: string; employeeId: string; name: string; role: string; department: string; workingDays: number; calendarDays: number; present: number; incomplete: number; leave: number; absent: number; minutes: number; avgMinutes: number; missedPunchOuts: number; rate: number; calendarRate: number; hours: number }
interface MonthData {
  month: string; today: string;
  totals: { headcount: number; present: number; incomplete: number; leave: number; absent: number; hours: number; rate: number; calendarRate: number; missedPunchOuts: number; workingDays: number; calendarDays: number };
  daily: { date: string; present: number; checkedIn: number; onLeave: number; working: boolean }[];
  employees: EmpRow[];
}
interface DayRow { date: string; status: "present" | "incomplete" | "leave" | "holiday" | "weekend" | "absent" | "upcoming" | "na"; checkIn: string | null; checkOut: string | null; minutes: number; missedPunchOut: boolean; leaveType: string | null }
interface Detail { employee: { id: string; employeeId: string; name: string; role: string; department: string }; summary: Omit<EmpRow, "id" | "employeeId" | "name" | "role" | "department">; days: DayRow[] }

type SortKey = "name" | "present" | "incomplete" | "leave" | "absent" | "hours" | "avgMinutes" | "rate";
const thisMonth = () => new Date().toLocaleDateString("en-CA").slice(0, 7);
const STATUS_TEXT: Record<DayRow["status"], string> = { present: "Present", incomplete: "Incomplete punch", leave: "On leave", holiday: "Holiday", weekend: "Weekend", absent: "Absent", upcoming: "Upcoming", na: "—" };

function Kpi({ label, value, decimals = 0, suffix = "", tone }: { label: string; value: number; decimals?: number; suffix?: string; tone?: "warn" }) {
  const num = useRef<HTMLSpanElement>(null);
  useEffect(() => countUp(num.current, value, decimals), [value, decimals]);
  return <div className={`kpi${tone ? ` ${tone}` : ""}`}><span className="kpi-num"><span ref={num}>0</span>{suffix && <em>{suffix}</em>}</span><small>{label}</small></div>;
}

/** Slide-in panel with one person's month: a bar per day plus the day-by-day list. */
function EmployeeDrawer({ month, id, onClose }: { month: string; id: string; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const panel = useRef<HTMLElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    setD(null);
    apiRequest<Detail>(`/reports/employee/${id}?month=${month}`).then((r) => { if (live) setD(r); }).catch((e: Error) => { toast(e.message, "bad"); onClose(); });
    return () => { live = false; };
  }, [id, month, toast, onClose]);

  useLayoutEffect(() => {
    closeBtn.current?.focus();
    if (reduced()) return;
    gsap.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: 0.35 });
    gsap.fromTo(panel.current, { xPercent: 105 }, { xPercent: 0, duration: 0.7, ease: "expo.out" });
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function close() {
    if (reduced()) { onClose(); return; }
    gsap.to(scrim.current, { opacity: 0, duration: 0.25 });
    gsap.to(panel.current, { xPercent: 105, duration: 0.4, ease: "power3.in", onComplete: onClose });
  }

  const bars: Bar[] = (d?.days ?? []).map((x) => {
    const worked = x.minutes / 60;
    const base = { key: String(Number(x.date.slice(8))), label: dayLabel(x.date) };
    if (x.status === "present") return { ...base, value: Math.round(worked * 10) / 10, tone: "accent" as const, hint: `${fmtMinutes(x.minutes)}${x.checkIn ? ` · ${x.checkIn}–${x.checkOut ?? "…"}` : ""}` };
    if (x.status === "incomplete") return { ...base, value: 1, tone: "warn" as const, hint: x.missedPunchOut ? "Missed punch-out — not counted as present" : "Shift in progress — not counted as present" };
    if (x.status === "leave") return { ...base, value: 0, hint: `${cap(x.leaveType ?? "leave")} leave`, faded: true };
    return { ...base, value: 0, hint: STATUS_TEXT[x.status], faded: true };
  });

  return (
    <>
      <div className="scrim drawer-scrim" ref={scrim} onClick={close} />
      <aside className="drawer" ref={panel} role="dialog" aria-label={d ? `${d.employee.name}, ${monthLabel(month)}` : "Employee month"}>
        <header>
          {d ? <><Avatar name={d.employee.name} /><div><b>{d.employee.name}</b><small>{d.employee.employeeId} · {d.employee.department}</small></div></> : <div><b>Loading…</b></div>}
          <button ref={closeBtn} className="icon-btn" onClick={close} aria-label="Close"><IconX /></button>
        </header>
        {!d ? <Skeleton rows={5} /> : (
          <>
            <div className="drawer-kpis">
              <Kpi label="Days present" value={d.summary.present} />
              <Kpi label="Incomplete punches" value={d.summary.incomplete} />
              <Kpi label="Hours worked" value={d.summary.minutes / 60} decimals={1} />
              <Kpi label="On leave" value={d.summary.leave} decimals={d.summary.leave % 1 ? 1 : 0} />
              <Kpi label="Absent" value={d.summary.absent} decimals={d.summary.absent % 1 ? 1 : 0} />
            </div>
            <h3>Hours per day · {monthLabel(month)}</h3>
            <ColumnChart bars={bars} label={`${d.employee.name} hours per day`} height={150} />
            {d.summary.missedPunchOuts > 0 && <p className="drawer-note">Amber bars are days with a check-in but no check-out ({d.summary.missedPunchOuts}).</p>}
            <h3>Day by day</h3>
            <ul className="daylist">
              {d.days.filter((x) => x.status !== "na" && x.status !== "upcoming").reverse().map((x) => (
                <li key={x.date} className={x.status}>
                  <span>{dayLabel(x.date)}</span>
                  <em className={`dot ${x.status}`}>{x.status === "leave" && x.leaveType ? `${cap(x.leaveType)} leave` : STATUS_TEXT[x.status]}</em>
                  <small>{x.status === "present" ? `${x.checkIn ?? "—"} – ${x.checkOut ?? "—"}` : x.status === "incomplete" ? (x.missedPunchOut ? `${x.checkIn} · no check-out` : `${x.checkIn} · shift in progress`) : ""}</small>
                  <b>{x.status === "present" ? fmtMinutes(x.minutes) : ""}</b>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>
    </>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<MonthData | null>(null);
  const [metric, setMetric] = useState<"hours" | "present">("hours");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "hours", dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const seq = useRef(0);
  const admin = user?.role === "CEO" || user?.role === "HR";

  useEffect(() => {
    if (!admin) return;
    const load = (showLoading: boolean) => {
      const mine = ++seq.current;
      if (showLoading) setData(null);
      apiRequest<MonthData>(`/reports/month?month=${month}`).then((r) => { if (mine === seq.current) setData(r); }).catch((e: Error) => { if (mine === seq.current) toast(e.message, "bad"); });
    };
    load(true);
    // Live check-ins affect the current month only; refresh without interrupting the report view.
    if (month !== thisMonth()) return;
    const refresh = window.setInterval(() => load(false), 30_000);
    return () => window.clearInterval(refresh);
  }, [month, admin, toast]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (data?.employees ?? []).filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.employeeId.toLowerCase().includes(needle) || e.department.toLowerCase().includes(needle));
    return [...list].sort((a, b) => (sort.key === "name" ? a.name.localeCompare(b.name) : (a[sort.key] as number) - (b[sort.key] as number)) * sort.dir);
  }, [data, q, sort]);

  const ranking: Bar[] = useMemo(() => [...(data?.employees ?? [])].sort((a, b) => (metric === "hours" ? b.hours - a.hours : b.present - a.present)).slice(0, 12)
    .map((e) => ({ key: e.id, label: e.name, value: metric === "hours" ? e.hours : e.present, hint: metric === "hours" ? `${e.hours.toFixed(1)} h` : `${e.present} / ${e.calendarDays} calendar days`, tone: e.missedPunchOuts ? "warn" as const : "accent" as const })), [data, metric]);

  const daily: Bar[] = (data?.daily ?? []).map((d) => ({ key: String(Number(d.date.slice(8))), label: dayLabel(d.date), value: d.checkedIn, faded: !d.working || d.date > (data?.today ?? ""), hint: d.working ? `${d.checkedIn} checked in · ${d.present} completed${d.onLeave ? ` · ${d.onLeave} on leave` : ""}` : "Day off", tone: "accent" }));

  const closeDrawer = useCallback(() => setOpenId(null), []);
  const th = (key: SortKey, text: string, cls = "") => <th className={`sortable ${cls}${sort.key === key ? " on" : ""}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "name" ? 1 : -1 }))} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>{text}<i>{sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}</i></th>;

  async function exportXlsx() {
    setExporting(true);
    try { await downloadFile(`/reports/export?month=${month}`, `marcon-attendance-${month}.xlsx`); toast("Excel report downloaded"); }
    catch (e) { toast((e as Error).message, "bad"); }
    finally { setExporting(false); }
  }

  if (user && !admin) return <Navigate to="/dashboard" replace />;
  const atNow = month >= thisMonth();

  return (
    <>
      <PageHead title="Reports" sub="Attendance, hours and leave for everyone" action={
        <div className="report-actions">
          <div className="monthnav">
            <button className="icon-btn" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month"><IconChevronLeft /></button>
            <b>{monthLabel(month)}</b>
            <button className="icon-btn" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={atNow} aria-label="Next month"><IconChevronRight /></button>
          </div>
          <button className="btn primary" onClick={() => void exportXlsx()} disabled={exporting || !data}><IconDownload />{exporting ? "Preparing…" : "Export Excel"}</button>
        </div>
      } />

      {!data ? <Card><Skeleton rows={4} /></Card> : (
        <>
          <div className="kpis" data-r>
            <Kpi label="Attendance rate" value={data.totals.rate} suffix="%" />
            <Kpi label="Hours worked" value={data.totals.hours} decimals={1} />
            <Kpi label="Days present" value={data.totals.present} suffix={`/${data.totals.calendarDays}`} />
            <Kpi label="Incomplete punches" value={data.totals.incomplete} tone={data.totals.incomplete ? "warn" : undefined} />
            <Kpi label="Leave days" value={data.totals.leave} decimals={data.totals.leave % 1 ? 1 : 0} />
            <Kpi label="Missed punch-outs" value={data.totals.missedPunchOuts} tone={data.totals.missedPunchOuts ? "warn" : undefined} />
          </div>

          <Card>
            <h3>People checked in each day</h3>
            <ColumnChart bars={daily} max={Math.max(1, data.totals.headcount)} label="People checked in each day" />
          </Card>

          <Card>
            <div className="card-row">
              <h3>{metric === "hours" ? "Hours worked" : "Days present"} · top {Math.min(12, data.employees.length)}</h3>
              <div className="seg" role="tablist">
                <button role="tab" aria-selected={metric === "hours"} className={metric === "hours" ? "on" : ""} onClick={() => setMetric("hours")}>Hours</button>
                <button role="tab" aria-selected={metric === "present"} className={metric === "present" ? "on" : ""} onClick={() => setMetric("present")}>Days</button>
              </div>
            </div>
            <RankChart rows={ranking} label={metric === "hours" ? "Hours worked by person" : "Days present by person"} onPick={(b) => setOpenId(b.key)} />
          </Card>

          <Card>
            <div className="card-row">
              <h3>Everyone · {monthLabel(month)}</h3>
              <input className="search" type="search" placeholder="Search name, ID or department" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
            </div>
            {rows.length === 0 ? <Empty icon={<IconChart />} text={data.employees.length ? "No one matches that search" : "No active people yet"} /> : (
              <div className="table-wrap"><table className="report-table">
                <thead><tr>{th("name", "Person")}{th("present", "Present", "num-col")}{th("incomplete", "Incomplete", "num-col")}{th("leave", "Leave", "num-col")}{th("absent", "Absent", "num-col")}{th("hours", "Hours", "num-col")}{th("avgMinutes", "Avg / day", "num-col")}{th("rate", "Attendance")}</tr></thead>
                <tbody>{rows.map((e) => (
                  <tr key={e.id} className="clickable" tabIndex={0} onClick={() => setOpenId(e.id)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setOpenId(e.id); } }}>
                    <td><div className="who"><Avatar name={e.name} /><div><b>{e.name}</b><small>{e.employeeId} · {e.department}</small></div></div></td>
                    <td className="num-col">{e.present}<small> / {e.calendarDays} days</small></td>
                    <td className="num-col">{e.incomplete || "—"}</td>
                    <td className="num-col">{e.leave}</td>
                    <td className="num-col">{e.absent}</td>
                    <td className="num-col"><b>{e.hours.toFixed(1)}</b>{e.missedPunchOuts > 0 && <span className="flag" title={`${e.missedPunchOuts} missed punch-out${e.missedPunchOuts > 1 ? "s" : ""}`}>!</span>}</td>
                    <td className="num-col">{e.avgMinutes ? fmtMinutes(e.avgMinutes) : "—"}</td>
                    <td><span className="meter"><i style={{ width: `${e.rate}%` }} /></span><small>{e.rate}%</small></td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </Card>
        </>
      )}
      {openId && <EmployeeDrawer key={`${openId}-${month}`} month={month} id={openId} onClose={closeDrawer} />}
    </>
  );
}
