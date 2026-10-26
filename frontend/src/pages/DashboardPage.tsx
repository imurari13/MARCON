import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import { Marquee, Skeleton } from "../components/ui";
import GhostTitle from "../components/GhostTitle";
import StatCard from "../components/StatCard";
import AnalogClock from "../components/AnalogClock";
import LeaveRoster, { type OutPerson } from "../components/LeaveRoster";
import Confetti from "../components/Confetti";
import { PieCard, type Slice } from "../components/Charts";
import { whenReady } from "../lib/gsap";
import { IconCake, IconCalendar, IconChart, IconClock, IconInbox, IconUserCheck, IconUsers } from "../components/Icons";

interface Birthday { name: string; isMe: boolean }
interface Upcoming extends Birthday { date: string; daysAway: number }
interface Stats {
  date: string;
  mine: { pendingLeave: number; checkedInToday: boolean };
  org: { headcount: number; presentToday: number; pendingApprovals: number; onLeaveToday: OutPerson[]; upcomingLeave: OutPerson[] } | null;
  charts: { id: string; title: string; slices: Slice[] }[];
  birthdays: { today: Birthday[]; upcoming: Upcoming[] };
}

const list = (names: string[]) => names.length <= 2 ? names.join(" & ") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
const when = (u: Upcoming) => u.daysAway === 1 ? "Tomorrow" : new Date(`${u.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

export default function DashboardPage() {
  const { user } = useAuth();
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState("");
  const [shower, setShower] = useState(0); // bump to (re)start the confetti
  useEffect(() => { apiRequest<Stats>("/dashboard").then(setS).catch((e: Error) => setErr(e.message)); }, []);

  // Confetti plays once per session each birthday-day (and on demand from the banner button).
  const hasBirthday = (s?.birthdays.today.length ?? 0) > 0;
  useEffect(() => {
    if (!s || !hasBirthday) return;
    const key = `mm-bday-${s.date}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* private mode */ }
    return whenReady(() => setShower((n) => n + 1));
  }, [s, hasBirthday]);

  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const first = (n: string) => n.split(" ")[0] ?? n;
  const today = s?.birthdays.today ?? [];
  const mine = today.find((b) => b.isMe);
  const others = today.filter((b) => !b.isMe).map((b) => b.name);

  return (
    <>
      {shower > 0 && <Confetti key={shower} onDone={() => undefined} />}
      <section className="hero spot" data-r>
        <div className="grid-floor"><i /></div>
        <div className="hero-copy">
          <small className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</small>
          <GhostTitle lines={[`${greet},`, `${user?.fullName.split(" ")[0] ?? ""}.`]} hotLast />
        </div>
        <div className="hero-clock"><AnalogClock size={190} /></div>
      </section>
      {err && <p className="form-error">{err}</p>}
      {!s && !err && <Skeleton rows={2} />}
      {s && hasBirthday && (
        <section className="card spot birthday" data-r>
          <div className="balloons" aria-hidden="true">{["#f0392b", "#ffd166", "#ff7a45", "#60a5fa", "#4ade80", "#f472b6"].map((c, i) => <span key={i} style={{ background: c, animationDelay: `${i * 0.45}s`, left: `${6 + i * 17}%` }} />)}</div>
          <span className="bday-icon"><IconCake /></span>
          <div className="bday-copy">
            <small>BIRTHDAY</small>
            <p className="bday-title">{mine ? `Happy birthday, ${first(mine.name)}! 🎉` : `It's ${list(others.map(first))}'s birthday today 🎂`}</p>
            <p className="mute">{mine ? (others.length ? `The team is also celebrating ${list(others)} today.` : "The whole team is wishing you a wonderful day.") : `Send ${others.length > 1 ? "them" : "a"} your wishes!`}</p>
          </div>
          <button className="btn sm" onClick={() => setShower((n) => n + 1)}>Celebrate</button>
        </section>
      )}
      {s && (
        <div className="stats">
          {s.org ? (<>
            <StatCard label="Active people" value={s.org.headcount} icon={<IconUsers />} about="Everyone currently marked active across the organisation." to="/employees" cta="Open people" />
            <StatCard label="Present today" value={s.org.presentToday} icon={<IconUserCheck />} about="People who have checked in today, as recorded against their assigned shifts." to="/attendance" cta="Open attendance" />
            <StatCard label="On leave today" value={s.org.onLeaveToday.length} icon={<IconCalendar />} about="People with approved leave covering today. The list below shows who they are and when they are back." to="/reports" cta="Open reports" />
            <StatCard label="Awaiting approval" value={s.org.pendingApprovals} icon={<IconInbox />} about="Leave requests waiting for an HR or CEO decision." to="/leave" cta="Review requests" />
          </>) : (<>
            <StatCard label="Checked in today" value={s.mine.checkedInToday ? 1 : 0} icon={<IconUserCheck />} about="Shows 1 once you have checked in for today, otherwise 0." to="/attendance" cta="Open attendance" />
            <StatCard label="Pending leave" value={s.mine.pendingLeave} icon={<IconInbox />} about="Your leave requests that are still waiting for a decision." to="/leave" cta="Open leave" />
          </>)}
        </div>
      )}
      {s?.org && <LeaveRoster today={s.org.onLeaveToday} upcoming={s.org.upcomingLeave} />}
      {s && <div className="charts">{(s.org ? s.charts.filter((c) => c.id.startsWith("org-")) : s.charts).map((c) => <PieCard key={c.id} title={c.title} slices={c.slices} />)}</div>}
      {s && s.org && <div className="charts two">{s.charts.filter((c) => c.id.startsWith("my-")).map((c) => <PieCard key={c.id} title={c.title} slices={c.slices} />)}</div>}
      {s && s.birthdays.upcoming.length > 0 && (
        <section className="card spot" data-r>
          <h3>Upcoming birthdays</h3>
          <ul className="bday-list">{s.birthdays.upcoming.slice(0, 6).map((u) => <li key={`${u.name}-${u.date}`}><IconCake /><b>{u.isMe ? `${u.name} (you)` : u.name}</b><small>{when(u)}</small></li>)}</ul>
        </section>
      )}
      <section className="my-shift spot" data-r>
        <div className="shift-orb"><IconClock /></div>
        <div><small>MY WORKING HOURS</small><h3>{user?.workStartTime ?? "09:30"} – {user?.workEndTime ?? "18:30"}</h3><p>Your attendance is recorded against this assigned shift.</p></div>
        <Link to="/attendance" className="btn sm">Open attendance</Link>
      </section>
      <div className="quick">
        <Link to="/attendance" className="tile spot" data-r data-tilt=""><IconClock /><b>Attendance</b><small>Check in or out</small></Link>
        <Link to="/calendar" className="tile spot" data-r data-tilt=""><IconCalendar /><b>Calendar</b><small>Holidays, birthdays &amp; leave</small></Link>
        <Link to="/leave" className="tile spot" data-r data-tilt=""><IconCalendar /><b>Leave</b><small>Request time off</small></Link>
        {s?.org && <Link to="/reports" className="tile spot" data-r data-tilt=""><IconChart /><b>Reports</b><small>Hours, attendance &amp; Excel export</small></Link>}
      </div>
      <Marquee items={["Attendance", "Leave", "People", "Holidays", "Marcamor"]} />
    </>
  );
}
