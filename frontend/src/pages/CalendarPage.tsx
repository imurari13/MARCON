import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { reduced } from "../lib/gsap";
import { apiRequest } from "../services/api";
import { Card, PageHead } from "../components/ui";
import { useToast } from "../components/Toast";
import { IconCake, IconChevronLeft, IconChevronRight } from "../components/Icons";

interface CalData {
  today: string;
  holidays: { name: string; date: string; description: string }[];
  birthdays: { name: string; date: string; isMe: boolean }[];
  leaves: { startDate: string; endDate: string; status: string; leaveType: string }[];
  attendance: string[];
}
const pad = (n: number) => String(n).padStart(2, "0");
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const nice = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export default function CalendarPage() {
  const toast = useToast();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [data, setData] = useState<CalData | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const month = `${ym.y}-${pad(ym.m)}`;

  useEffect(() => {
    let live = true;
    apiRequest<CalData>(`/dashboard/calendar?month=${month}`).then((d) => { if (live) { setData(d); setSel((s) => s ?? (d.today.startsWith(month) ? d.today : null)); } }).catch((e: Error) => toast(e.message, "bad"));
    return () => { live = false; };
  }, [month, toast]);

  useLayoutEffect(() => {
    const el = grid.current;
    if (!el || reduced()) return;
    const t = gsap.fromTo(el.querySelectorAll(".cal-day"), { opacity: 0, y: 10, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "power3.out", stagger: { each: 0.008, from: "start" }, clearProps: "all" });
    return () => { t.kill(); };
  }, [month]);

  const cells = useMemo(() => {
    const days = new Date(Date.UTC(ym.y, ym.m, 0)).getUTCDate();
    const lead = (new Date(Date.UTC(ym.y, ym.m - 1, 1)).getUTCDay() + 6) % 7; // Monday-first
    return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`)];
  }, [ym, month]);

  const info = (iso: string) => ({
    holidays: data?.holidays.filter((h) => h.date === iso) ?? [],
    birthdays: data?.birthdays.filter((b) => b.date === iso) ?? [],
    leave: data?.leaves.find((l) => l.startDate <= iso && l.endDate >= iso),
    present: data?.attendance.includes(iso) ?? false,
  });
  const go = (d: number) => { setData(null); setSel(null); setYm(({ y, m }) => { const t = y * 12 + (m - 1) + d; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; }); };
  const title = new Date(Date.UTC(ym.y, ym.m - 1, 1)).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const picked = sel && sel.startsWith(month) ? info(sel) : null;

  return (
    <>
      <PageHead title="Calendar" sub="Company holidays, birthdays, your leave and attendance" action={<button className="btn" onClick={() => { setData(null); setSel(null); setYm({ y: now.getFullYear(), m: now.getMonth() + 1 }); }}>Today</button>} />
      <Card className="cal">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => go(-1)} aria-label="Previous month"><IconChevronLeft /></button>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={() => go(1)} aria-label="Next month"><IconChevronRight /></button>
        </div>
        <div className="cal-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="cal-grid" ref={grid}>
          {cells.map((iso, i) => {
            if (!iso) return <span key={`b${i}`} className="cal-blank" />;
            const x = info(iso), wk = i % 7 > 4;
            const cls = ["cal-day", wk ? "wk" : "", iso === data?.today ? "today" : "", iso === sel ? "sel" : "", x.holidays.length ? "hol" : ""].join(" ");
            return (
              <button key={iso} className={cls} onClick={() => setSel(iso)} aria-label={`${nice(iso)}${x.holidays.length ? `, ${x.holidays[0]!.name}` : ""}${x.birthdays.length ? ", birthday" : ""}`}>
                <b>{Number(iso.slice(8))}</b>
                <span className="cal-marks">
                  {x.birthdays.length > 0 && <span className="mk bd"><IconCake /></span>}
                  {x.leave && <i className={`mk lv ${x.leave.status.toLowerCase()}`} />}
                  {x.present && <i className="mk pr" />}
                </span>
                {x.holidays[0] && <small className="cal-hol">{x.holidays[0].name}</small>}
              </button>
            );
          })}
        </div>
        <div className="cal-legend">
          <span><i className="mk hol" />Holiday</span><span><i className="mk bd-dot" />Birthday</span>
          <span><i className="mk lv approved" />Leave approved</span><span><i className="mk lv pending" />Leave pending</span><span><i className="mk pr" />Present</span>
        </div>
      </Card>
      <Card className="cal-detail">
        <h3>{sel ? nice(sel) : "Select a day"}</h3>
        {!picked ? <p className="mute">{data ? "Pick a day to see what's on." : "Loading…"}</p> : (() => {
          const rows = [
            ...picked.holidays.map((h) => <li key={`h${h.name}`}><i className="mk hol" /><b>{h.name}</b>{h.description && <small>{h.description}</small>}</li>),
            ...picked.birthdays.map((b) => <li key={`b${b.name}`}><i className="mk bd-dot" /><b>{b.isMe ? `${b.name} (you)` : b.name}</b><small>Birthday</small></li>),
            ...(picked.leave ? [<li key="l"><i className={`mk lv ${picked.leave.status.toLowerCase()}`} /><b>{picked.leave.leaveType.charAt(0) + picked.leave.leaveType.slice(1).toLowerCase()} leave</b><small>{picked.leave.status.toLowerCase()}</small></li>] : []),
            ...(picked.present ? [<li key="p"><i className="mk pr" /><b>You were checked in</b></li>] : []),
          ];
          return rows.length ? <ul className="cal-list">{rows}</ul> : <p className="mute">Nothing scheduled.</p>;
        })()}
      </Card>
    </>
  );
}
