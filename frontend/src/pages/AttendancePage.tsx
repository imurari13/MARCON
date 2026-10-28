import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { gsap } from "gsap";
import { reduced } from "../lib/gsap";
import { apiRequest } from "../services/api";
import { Card, Empty, PageHead, Pill, Skeleton } from "../components/ui";
import { useToast } from "../components/Toast";
import { IconClock } from "../components/Icons";
import AnalogClock from "../components/AnalogClock";
import ActionBurst, { type BurstKind } from "../components/ActionBurst";
import { useAuth } from "../context/AuthContext";

interface Rec { _id: string; date: string; checkIn: string; checkOut: string | null; lateMinutes?: number; earlyCheckoutReason?: string | null }
interface Fix { _id: string; date: string; reason: string; status: string; requestedCheckIn?: string | null; requestedCheckOut?: string | null }
const blankFix = { date: "", requestedCheckIn: "", requestedCheckOut: "", reason: "" };
/** "YYYY-MM-DDTHH:mm" for a datetime-local input. */
const localInput = (date: string, hhmm: string) => `${date}T${hhmm}`;
const tm = (v: string | null) => (v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const todayKey = () => new Date().toLocaleDateString("en-CA");
const dur = (r: Rec) => {
  if (!r.checkOut && r.date !== todayKey()) return "—";
  const m = Math.max(0, Math.round(((r.checkOut ? new Date(r.checkOut).getTime() : Date.now()) - new Date(r.checkIn).getTime()) / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
};

const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };

/** Circular shift-progress gauge, drawn with DrawSVG. */
function ShiftRing({ start, end, checkIn, now }: { start: string; end: string; checkIn: string | null; now: Date }) {
  const arc = useRef<SVGCircleElement>(null);
  const cur = now.getHours() * 60 + now.getMinutes();
  const checkedInAt = checkIn ? new Date(checkIn) : null;
  const actualStart = checkedInAt ? checkedInAt.getHours() * 60 + checkedInAt.getMinutes() : mins(start);
  const p = checkedInAt ? Math.max(0, Math.min(1, (cur - actualStart) / Math.max(1, mins(end) - mins(start)))) : 0;
  const tick = Math.round(p * 200);
  useLayoutEffect(() => { if (arc.current) gsap.set(arc.current, { drawSVG: "0% 0%" }); }, []);
  useEffect(() => {
    if (!arc.current) return;
    const to = { drawSVG: `0% ${(tick / 200) * 100}%` };
    if (reduced()) gsap.set(arc.current, to); else gsap.to(arc.current, { ...to, duration: 1.8, ease: "expo.out" });
  }, [tick]);
  return (
    <div className="shift-ring" aria-label={checkedInAt ? `${Math.round(p * 100)}% of work time elapsed since check-in` : "Work progress starts when you check in"}>
      <svg viewBox="0 0 200 200">
        <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e8392b" /><stop offset="1" stopColor="#ff9a5c" /></linearGradient></defs>
        <circle cx="100" cy="100" r="86" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="8" />
        <circle ref={arc} cx="100" cy="100" r="86" fill="none" stroke="url(#rg)" strokeWidth="8" strokeLinecap="round" transform="rotate(-90 100 100)" />
      </svg>
      <div><b>{Math.round(p * 100)}%</b><small>{checkedInAt ? "since check-in" : "check in to start"}</small></div>
    </div>
  );
}

export default function AttendancePage() {
  const toast = useToast();
  const { user } = useAuth();
  const [today, setToday] = useState<Rec | null>(null);
  const [rows, setRows] = useState<Rec[] | null>(null);
  const [now, setNow] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState<{ kind: BurstKind; caption: string } | null>(null);
  const [correction, setCorrection] = useState(blankFix);
  const [blockedBy, setBlockedBy] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Fix[] | null>(null);
  const [checkoutReason, setCheckoutReason] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([apiRequest<{ record: Rec | null; blockedBy: string | null }>("/attendance/today"), apiRequest<{ records: Rec[] }>("/attendance"), apiRequest<{ requests: Fix[] }>("/attendance/regularizations/mine")]);
    setToday(a.record); setBlockedBy(a.blockedBy); setRows(b.records); setFixes(c.requests);
  }, []);
  useEffect(() => { load().catch((e: Error) => toast(e.message, "bad")); }, [load, toast]);
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);

  async function act(path: string, kind: BurstKind, body?: unknown) {
    setBusy(true);
    try {
      const { record } = await apiRequest<{ record: Rec }>(path, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      await load();
      setShowCheckout(false); setCheckoutReason("");
      setBurst({ kind, caption: kind === "in" ? `Checked in at ${tm(record.checkIn)}` : `You worked ${dur(record)} today` });
    }
    catch (e) { toast((e as Error).message, "bad"); }
    finally { setBusy(false); }
  }
  async function checkOut(event: FormEvent) {
    event.preventDefault();
    await act("/attendance/check-out", "out", { reason: checkoutReason || undefined });
  }
  const state = !today ? "out" : today.checkOut ? "done" : "in";
  const assignedMinutes = Math.max(1, mins(user?.workEndTime ?? "18:30") - mins(user?.workStartTime ?? "09:30"));
  const completedAt = today ? new Date(new Date(today.checkIn).getTime() + assignedMinutes * 60_000) : null;
  const needsCheckoutReason = !!completedAt && now < completedAt;
  const completedAtLabel = completedAt?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "the end of your shift";
  async function submitCorrection(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/attendance/regularizations", { method: "POST", body: JSON.stringify({ date: correction.date, requestedCheckIn: correction.requestedCheckIn ? new Date(correction.requestedCheckIn).toISOString() : null, requestedCheckOut: correction.requestedCheckOut ? new Date(correction.requestedCheckOut).toISOString() : null, reason: correction.reason }) });
      setCorrection(blankFix); await load(); toast("Attendance correction sent for review");
    } catch (error) { toast((error as Error).message, "bad"); }
  }
  /** Jump to the form with the missed day and the end of the shift already filled in. */
  function fixMissed(date: string) {
    setCorrection({ date, requestedCheckIn: "", requestedCheckOut: localInput(date, user?.workEndTime ?? "18:30"), reason: "Forgot to check out" });
    form.current?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
  }
  return (
    <>
      <PageHead title="Attendance" sub={`Your shift: ${user?.workStartTime ?? "09:30"} – ${user?.workEndTime ?? "18:30"}`} />
      {blockedBy && (
        <Card className="alert-card">
          <div><b>You didn't check out on {blockedBy}.</b><p>Send a correction for that day, then you can check in again.</p></div>
          <button className="btn primary" onClick={() => fixMissed(blockedBy)}>Request correction</button>
        </Card>
      )}
      <Card className="clock-card">
        <div className="clock-wrap">
          <AnalogClock size={200} />
          <small>{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</small>
          <small>{state === "out" ? "You haven't checked in yet" : state === "in" ? `In since ${tm(today!.checkIn)} · ${dur(today!)}` : `Worked ${dur(today!)} today`}</small>
        </div>
        <ShiftRing start={user?.workStartTime ?? "09:30"} end={user?.workEndTime ?? "18:30"} checkIn={today?.checkIn ?? null} now={now} />
        {state !== "out" && (today?.lateMinutes ?? 0) > 0 && <span className="pill pending">Late by {today!.lateMinutes} min</span>}
        {state === "out" && <button className="btn primary" disabled={busy || !!blockedBy} title={blockedBy ? "Request a correction for your missed check-out first" : undefined} onClick={() => void act("/attendance/check-in", "in")}>Check in</button>}
        {state === "in" && !showCheckout && <button className="btn" disabled={busy} onClick={() => setShowCheckout(true)}>Check out</button>}
        {state === "in" && showCheckout && <form className="grid-form" onSubmit={checkOut}><label className="span">{needsCheckoutReason ? "Early check-out clarification" : "Check-out note (optional)"}<small>{needsCheckoutReason ? `You need to complete your assigned hours by ${completedAtLabel}, or provide a clarification.` : "Your assigned shift hours are complete."}</small><input autoFocus required={needsCheckoutReason} value={checkoutReason} onChange={(e) => setCheckoutReason(e.target.value)} minLength={checkoutReason ? 3 : undefined} maxLength={500} placeholder={needsCheckoutReason ? "Explain why you need to leave before completing your shift" : "Add an optional note"} /></label><button className="btn primary" disabled={busy}>Confirm check out</button><button type="button" className="btn ghost" disabled={busy} onClick={() => setShowCheckout(false)}>Cancel</button></form>}
        {state === "done" && <span className="pill approved">Done for today</span>}
      </Card>
      <Card>
        <h3>Attendance correction</h3>
        <form className="grid-form" ref={form} onSubmit={submitCorrection}>
          <label>Date<input required type="date" max={todayKey()} value={correction.date} onChange={e => setCorrection({ ...correction, date: e.target.value })} /></label>
          <label>Corrected check-in<input type="datetime-local" value={correction.requestedCheckIn} onChange={e => setCorrection({ ...correction, requestedCheckIn: e.target.value })} /></label>
          <label>Corrected check-out<input type="datetime-local" value={correction.requestedCheckOut} onChange={e => setCorrection({ ...correction, requestedCheckOut: e.target.value })} /></label>
          <label className="span">Reason<input required minLength={3} value={correction.reason} onChange={e => setCorrection({ ...correction, reason: e.target.value })} placeholder="Explain the missed or incorrect punch" /></label>
          <button className="btn primary">Request correction</button>
        </form>
      </Card>
      {fixes && fixes.length > 0 && (
        <Card>
          <h3>My correction requests</h3>
          <div className="table-wrap"><table><tbody>{fixes.map((r) => <tr key={r._id}><td><b>{r.date}</b></td><td className="mute">{r.requestedCheckIn && `In ${tm(r.requestedCheckIn)} `}{r.requestedCheckOut && `Out ${tm(r.requestedCheckOut)}`}</td><td className="mute">{r.reason}</td><td className="right"><Pill s={r.status} /></td></tr>)}</tbody></table></div>
        </Card>
      )}
      <Card>
        <h3>Recent days</h3>
        {!rows ? <Skeleton /> : rows.length === 0 ? <Empty icon={<IconClock />} text="No attendance yet" /> : (
          <div className="table-wrap"><table><thead><tr><th>Date</th><th>In</th><th>Out</th><th>Total</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r._id}><td>{r.date}</td><td>{tm(r.checkIn)}{(r.lateMinutes ?? 0) > 0 && <small className="late-note"> · late {r.lateMinutes}m</small>}</td><td>{tm(r.checkOut)}{!r.checkOut && r.date !== todayKey() && <span className="flag" title="No check-out recorded">!</span>}{r.earlyCheckoutReason && <small className="mute"> · {r.earlyCheckoutReason}</small>}</td><td>{dur(r)}</td></tr>)}</tbody></table></div>
        )}
      </Card>
      {burst && <ActionBurst kind={burst.kind} caption={burst.caption} onDone={() => setBurst(null)} />}
    </>
  );
}
