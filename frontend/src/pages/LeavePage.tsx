import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import { Card, Empty, PageHead, Pill, Skeleton } from "../components/ui";
import { useToast } from "../components/Toast";
import { IconCalendar } from "../components/Icons";
import { cap } from "../lib/format";

interface Req { _id: string; leaveType: string; startDate: string; endDate: string; reason: string; status: string; halfDay?: boolean; userId?: { _id: string; name: string } | string }

export default function LeavePage() {
  const { user } = useAuth();
  const toast = useToast();
  const reviewer = user?.role === "CEO" || user?.role === "HR" || user?.role === "MANAGER";
  const [mine, setMine] = useState<Req[] | null>(null);
  const [all, setAll] = useState<Req[] | null>(null);
  const [balances, setBalances] = useState<{ leaveType: string; quota: number; used: number; remaining: number }[] | null>(null);
  const [f, setF] = useState({ leaveType: "CASUAL", startDate: "", endDate: "", reason: "", halfDay: false });
  const load = useCallback(async () => {
    const [m, b, a] = await Promise.all([
      apiRequest<{ requests: Req[] }>("/leave/mine"),
      apiRequest<{ balances: { leaveType: string; quota: number; used: number; remaining: number }[] }>("/leave/balances"),
      reviewer ? apiRequest<{ requests: Req[] }>("/leave") : Promise.resolve(null),
    ]);
    setMine(m.requests); setBalances(b.balances); if (a) setAll(a.requests);
  }, [reviewer]);
  useEffect(() => { load().catch((e: Error) => toast(e.message, "bad")); }, [load, toast]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await apiRequest("/leave", { method: "POST", body: JSON.stringify(f) }); setF({ ...f, reason: "" }); await load(); toast("Request sent"); }
    catch (x) { toast((x as Error).message, "bad"); }
  }
  const review = (id: string, a: "approve" | "reject") =>
    apiRequest(`/leave/${id}/${a}`, { method: "POST" }).then(load).then(() => toast(a === "approve" ? "Approved" : "Rejected")).catch((e: Error) => toast(e.message, "bad"));

  return (
    <>
      <PageHead title="Leave" sub="Request time off and track approvals" />
      <Card>
        <h3>Leave balance</h3>
        {!balances ? <Skeleton rows={1} /> : <div className="stats">{balances.map((b) => <div className="stat" key={b.leaveType}><small>{cap(b.leaveType)}</small><b className="num">{b.remaining}</b><small>{b.used} used of {b.quota} days</small></div>)}</div>}
      </Card>
      <Card>
        <h3>New request</h3>
        <form className="grid-form" onSubmit={submit}>
          <label>Type<select value={f.leaveType} onChange={(e) => setF({ ...f, leaveType: e.target.value })}>{["CASUAL", "SICK", "EARNED", "UNPAID"].map((x) => <option key={x} value={x}>{cap(x)}</option>)}</select></label>
          <label>From<input type="date" required value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: f.halfDay || (f.endDate && f.endDate < e.target.value) ? e.target.value : f.endDate })} /></label>
          <label>To<input type="date" required disabled={f.halfDay} min={f.startDate || undefined} value={f.halfDay ? f.startDate : f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
          <label className="check"><input type="checkbox" checked={f.halfDay} onChange={(e) => setF({ ...f, halfDay: e.target.checked, endDate: e.target.checked ? f.startDate : f.endDate })} />Half day</label>
          <label className="span">Reason<input required maxLength={500} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Short note for your approver" /></label>
          <button className="btn primary">Send request</button>
        </form>
      </Card>
      <Card>
        <h3>My requests</h3>
        {!mine ? <Skeleton /> : mine.length === 0 ? <Empty icon={<IconCalendar />} text="No requests yet" /> : (
          <div className="table-wrap"><table><tbody>{mine.map((r) => <tr key={r._id}><td><b>{cap(r.leaveType)}</b></td><td>{r.startDate} → {r.endDate}{r.halfDay && <small> · half day</small>}</td><td className="mute">{r.reason}</td><td className="right"><Pill s={r.status} /></td></tr>)}</tbody></table></div>
        )}
      </Card>
      {reviewer && (
        <Card>
          <h3>Team requests</h3>
          {!all ? <Skeleton /> : all.length === 0 ? <Empty icon={<IconCalendar />} text="Nothing to review" /> : (
            <div className="table-wrap"><table><tbody>{all.map((r) => (
              <tr key={r._id}>
                <td><b>{typeof r.userId === "object" && r.userId ? r.userId.name : "Former employee"}</b></td><td>{cap(r.leaveType)}</td><td>{r.startDate} → {r.endDate}{r.halfDay && <small> · half day</small>}</td>
                <td><Pill s={r.status} /></td>
                <td className="right">{["PENDING", "PENDING_MANAGER", "PENDING_HR"].includes(r.status) && !(typeof r.userId === "object" && r.userId?._id === user?.id) && <><button className="btn sm" onClick={() => void review(r._id, "approve")}>Approve</button> <button className="btn sm ghost" onClick={() => void review(r._id, "reject")}>Reject</button></>}</td>
              </tr>))}</tbody></table></div>
          )}
        </Card>
      )}
    </>
  );
}
