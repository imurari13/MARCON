import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import { Card, Empty, PageHead, Pill, Skeleton } from "../components/ui";
import { useToast } from "../components/Toast";
import { IconBriefcase } from "../components/Icons";

interface Request { _id: string; startDate: string; endDate: string; reason: string; status: string; userId?: { _id: string; name: string } | string }

export default function WorkFromHomePage() {
  const { user } = useAuth();
  const toast = useToast();
  const reviewer = user?.role === "CEO" || user?.role === "HR" || user?.role === "MANAGER";
  const canReview = (status: string) => user?.role === "MANAGER" ? status === "PENDING_MANAGER" : ["PENDING", "PENDING_HR"].includes(status);
  const [mine, setMine] = useState<Request[] | null>(null);
  const [all, setAll] = useState<Request[] | null>(null);
  const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
  const load = useCallback(async () => {
    const [myRequests, reviewRequests] = await Promise.all([apiRequest<{ requests: Request[] }>("/work-from-home/mine"), reviewer ? apiRequest<{ requests: Request[] }>("/work-from-home") : Promise.resolve(null)]);
    setMine(myRequests.requests); if (reviewRequests) setAll(reviewRequests.requests);
  }, [reviewer]);
  useEffect(() => { void load().catch((error: Error) => toast(error.message, "bad")); }, [load, toast]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try { await apiRequest("/work-from-home", { method: "POST", body: JSON.stringify(form) }); setForm({ startDate: "", endDate: "", reason: "" }); await load(); toast("WFH request sent"); } catch (error) { toast((error as Error).message, "bad"); }
  }
  async function review(id: string, action: "approve" | "reject") {
    try { await apiRequest(`/work-from-home/${id}/${action}`, { method: "POST" }); await load(); toast(`Request ${action}d`); } catch (error) { toast((error as Error).message, "bad"); }
  }
  return <><PageHead title="Work from home" sub="Request remote work; approved days do not use your leave balance." />
    <Card><h3>New WFH request</h3><form className="grid-form" onSubmit={submit}>
      <label>From<input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: form.endDate && form.endDate < e.target.value ? e.target.value : form.endDate })} /></label>
      <label>To<input required type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
      <label className="span">Reason<input required minLength={3} maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why do you need to work remotely?" /></label>
      <button className="btn primary">Send request</button>
    </form></Card>
    <Card><h3>My WFH requests</h3>{!mine ? <Skeleton /> : !mine.length ? <Empty icon={<IconBriefcase />} text="No WFH requests yet" /> : <div className="table-wrap"><table><tbody>{mine.map((request) => <tr key={request._id}><td>{request.startDate} → {request.endDate}</td><td className="mute">{request.reason}</td><td className="right"><Pill s={request.status} /></td></tr>)}</tbody></table></div>}</Card>
    {reviewer && <Card><h3>Team WFH requests</h3>{!all ? <Skeleton /> : !all.length ? <Empty icon={<IconBriefcase />} text="Nothing to review" /> : <div className="table-wrap"><table><tbody>{all.map((request) => <tr key={request._id}><td><b>{typeof request.userId === "object" && request.userId ? request.userId.name : "Former employee"}</b></td><td>{request.startDate} → {request.endDate}</td><td className="mute">{request.reason}</td><td><Pill s={request.status} /></td><td className="right">{canReview(request.status) && !(typeof request.userId === "object" && request.userId?._id === user?.id) && <><button className="btn sm" onClick={() => void review(request._id, "approve")}>Approve</button> <button className="btn sm ghost" onClick={() => void review(request._id, "reject")}>Reject</button></>}</td></tr>)}</tbody></table></div>}</Card>}
  </>;
}
