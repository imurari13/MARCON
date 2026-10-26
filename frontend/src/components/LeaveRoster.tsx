import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { reduced } from "../lib/gsap";
import { countUp } from "../hooks/useMotion";
import { cap, dayLabel } from "../lib/format";
import { Avatar } from "./ui";

export interface OutPerson { name: string; employeeId: string; department: string | null; leaveType: string; halfDay: boolean; startDate: string; endDate: string; days: number }

const span = (p: OutPerson) => (p.halfDay ? "Half day" : p.startDate === p.endDate ? "Today" : `until ${dayLabel(p.endDate)}`);

/** Admin dashboard panel: who is out today, and who goes out in the next seven days. */
export default function LeaveRoster({ today, upcoming }: { today: OutPerson[]; upcoming: OutPerson[] }) {
  const root = useRef<HTMLElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const sig = [...today, ...upcoming].map((p) => `${p.employeeId}${p.startDate}`).join("|");

  useEffect(() => countUp(count.current, today.length), [today.length]);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || reduced()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".out-chip", { y: 26, scale: 0.86, opacity: 0, rotate: -2 }, { y: 0, scale: 1, opacity: 1, rotate: 0, duration: 0.8, ease: "back.out(1.7)", stagger: 0.07, clearProps: "transform,opacity" });
      gsap.fromTo(".out-ring", { scale: 0.6, opacity: 0.9 }, { scale: 1.9, opacity: 0, duration: 1.6, ease: "power2.out", stagger: 0.07, repeat: 1, repeatDelay: 0.6 });
    }, el);
    return () => ctx.revert();
  }, [sig]);

  return (
    <section className="card spot roster" ref={root} data-r>
      <header>
        <h3>Out of office today</h3>
        <span className="roster-count"><span ref={count}>0</span><small>{today.length === 1 ? "person" : "people"}</small></span>
      </header>
      {today.length === 0 ? (
        <p className="roster-empty">Nobody is on leave today.</p>
      ) : (
        <ul className="out-list">
          {today.map((p) => (
            <li key={`${p.employeeId}-${p.startDate}`} className="out-chip">
              <span className="out-avatar"><i className="out-ring" /><Avatar name={p.name} /></span>
              <div><b>{p.name}</b><small>{p.department ?? p.employeeId}</small></div>
              <span className={`out-tag ${p.leaveType.toLowerCase()}`}>{cap(p.leaveType)}</span>
              <small className="out-when">{span(p)}</small>
            </li>
          ))}
        </ul>
      )}
      {upcoming.length > 0 && (
        <>
          <h3 className="roster-sub">Starting in the next 7 days</h3>
          <ul className="soon-list">
            {upcoming.map((p) => (
              <li key={`${p.employeeId}-${p.startDate}`}><b>{p.name}</b><span className={`out-tag ${p.leaveType.toLowerCase()}`}>{cap(p.leaveType)}</span><small>{p.halfDay ? `${dayLabel(p.startDate)} · half day` : p.startDate === p.endDate ? dayLabel(p.startDate) : `${dayLabel(p.startDate)} → ${dayLabel(p.endDate)}`}</small></li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
