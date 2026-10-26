import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../services/api";
import { Card, Empty, PageHead, Pill, Skeleton } from "../components/ui";
import { useToast } from "../components/Toast";

type Item = { _id: string; kind: string; title: string; description?: string; status: string; dueDate?: string; amount?: number };
type Job = { _id: string; title: string; department?: string; status: string };
const kinds = ["ONBOARDING", "OFFBOARDING", "GOAL", "EXPENSE", "ASSET", "TICKET"];
const nice = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());

export default function WorkHubPage() {
  const toast = useToast();
  const [kind, setKind] = useState("TICKET");
  const [items, setItems] = useState<Item[] | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", amount: "" });
  const [job, setJob] = useState({ title: "", department: "", description: "" });

  const load = useCallback(async () => {
    setItems((await apiRequest<{ items: Item[] }>(`/work/items?kind=${kind}`)).items);
    setJobs((await apiRequest<{ jobs: Job[] }>("/work/jobs")).jobs);
  }, [kind]);
  useEffect(() => { void load().catch((error: Error) => toast(error.message, "bad")); }, [load, toast]);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/work/items", { method: "POST", body: JSON.stringify({
        kind, title: form.title, description: form.description || undefined,
        dueDate: form.dueDate || undefined, amount: form.amount ? Number(form.amount) : undefined,
      }) });
      setForm({ title: "", description: "", dueDate: "", amount: "" });
      await load();
      toast(`${nice(kind)} created`);
    } catch (error) { toast((error as Error).message, "bad"); }
  }

  async function createJob(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/work/jobs", { method: "POST", body: JSON.stringify(job) });
      setJob({ title: "", department: "", description: "" });
      await load();
      toast("Job opening created");
    } catch (error) { toast((error as Error).message, "bad"); }
  }

  async function update(id: string, status: string) {
    try { await apiRequest(`/work/items/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (error) { toast((error as Error).message, "bad"); }
  }

  return <>
    <PageHead title="Work Hub" sub="People operations, requests and growth workflows" />
    <Card><h3>Workflow</h3><div className="work-tabs">{kinds.map(value =>
      <button key={value} className={`btn sm ${kind === value ? "primary" : "ghost"}`} onClick={() => setKind(value)}>{nice(value)}</button>
    )}</div></Card>
    <Card><h3>New {nice(kind)}</h3><form className="grid-form" onSubmit={create}>
      <label>Title<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
      <label>Due date<input type="date" value={form.dueDate} onChange={event => setForm({ ...form, dueDate: event.target.value })} /></label>
      {kind === "EXPENSE" && <label>Amount<input type="number" min="0" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} /></label>}
      <label className="span">Description<input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      <button className="btn primary">Create</button>
    </form></Card>
    <Card><h3>{nice(kind)} queue</h3>{!items ? <Skeleton /> : !items.length ? <Empty text={`No ${nice(kind).toLowerCase()} items`} icon={<span>—</span>} /> :
      <div className="table-wrap"><table><thead><tr><th>Title</th><th>Status</th><th>Due</th><th>Amount</th><th /></tr></thead><tbody>
        {items.map(item => <tr key={item._id}><td><b>{item.title}</b>{item.description && <small className="shift">{item.description}</small>}</td>
          <td><Pill s={item.status} /></td><td>{item.dueDate ?? "—"}</td><td>{item.amount == null ? "—" : item.amount.toFixed(2)}</td>
          <td className="right">{!["CLOSED", "RESOLVED", "DONE"].includes(item.status) &&
            <button className="btn sm" onClick={() => void update(item._id, kind === "TICKET" ? "RESOLVED" : "DONE")}>Complete</button>}</td>
        </tr>)}
      </tbody></table></div>}</Card>
    <Card><h3>Recruitment</h3><form className="grid-form" onSubmit={createJob}>
      <label>Job title<input required value={job.title} onChange={event => setJob({ ...job, title: event.target.value })} /></label>
      <label>Department<input value={job.department} onChange={event => setJob({ ...job, department: event.target.value })} /></label>
      <label className="span">Description<input value={job.description} onChange={event => setJob({ ...job, description: event.target.value })} /></label>
      <button className="btn primary">Open role</button>
    </form>{!jobs ? <Skeleton rows={1} /> : <div className="table-wrap"><table><tbody>{jobs.map(item =>
      <tr key={item._id}><td><b>{item.title}</b></td><td>{item.department ?? "—"}</td><td><Pill s={item.status} /></td></tr>
    )}</tbody></table></div>}</Card>
  </>;
}
