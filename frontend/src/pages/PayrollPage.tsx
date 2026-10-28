import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest, downloadFile } from "../services/api";
import { Card, Empty, PageHead, Pill, Skeleton } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

type Run = { _id: string; month: string; status: "DRAFT" | "FINALIZED"; items: unknown[] };
type Payslip = { month: string; status: "FINALIZED"; gross: number; deductions: number; net: number; absentDays: number; lateMarks: number };
const asAmount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const asCount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export default function PayrollPage() {
  const { user } = useAuth();
  const toast = useToast();
  const admin = user?.role === "CEO" || user?.role === "HR";
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [payslip, setPayslip] = useState<Payslip | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (admin) {
      const data = await apiRequest<{ runs?: Run[] }>("/payroll/runs");
      setRuns(Array.isArray(data.runs) ? data.runs.map(run => ({ ...run, items: Array.isArray(run.items) ? run.items : [] })) : []);
    }
    const data = await apiRequest<{ payslip: Payslip | null }>(`/payroll/payslip/${month}`);
    const raw = data.payslip;
    setPayslip(raw ? { ...raw, gross: asAmount(raw.gross), deductions: asAmount(raw.deductions), net: asAmount(raw.net), absentDays: asCount(raw.absentDays), lateMarks: asCount(raw.lateMarks) } : null);
  }, [admin, month]);
  useEffect(() => { void load().catch((error: Error) => toast(error.message, "bad")); }, [load, toast]);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await apiRequest("/payroll/runs", { method: "POST", body: JSON.stringify({ month }) });
      await load();
      toast("Payroll draft created");
    } catch (error) { toast((error as Error).message, "bad"); }
  }

  async function finalize(id: string) {
    try { await apiRequest(`/payroll/runs/${id}/finalize`, { method: "POST" }); await load(); toast("Payroll finalized"); }
    catch (error) { toast((error as Error).message, "bad"); }
  }

  async function downloadPayslip() {
    setDownloading(true);
    try {
      await downloadFile(`/payroll/payslip/${month}/pdf`, `payslip-${month}.pdf`);
      toast("Payslip PDF downloaded");
    } catch (error) { toast((error as Error).message, "bad"); }
    finally { setDownloading(false); }
  }

  return <>
    <PageHead title="Payroll" sub="Monthly payroll runs and payslips" />
    <Card><h3>My payslip</h3><label>Month<input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
      {payslip ? <>
        <div className="stats">
          <div className="stat"><small>Gross</small><b className="num">{payslip.gross.toFixed(2)}</b></div>
          <div className="stat"><small>Deductions</small><b className="num">{payslip.deductions.toFixed(2)}</b></div>
          <div className="stat"><small>Net pay</small><b className="num">{payslip.net.toFixed(2)}</b></div>
        </div>
        <div className="payroll-note"><span>Attendance adjustments</span><b>{payslip.absentDays} absent day{payslip.absentDays === 1 ? "" : "s"} · {payslip.lateMarks} late mark{payslip.lateMarks === 1 ? "" : "s"}</b></div>
        <button className="btn primary" onClick={() => void downloadPayslip()} disabled={downloading}>{downloading ? "Preparing PDF…" : "Download PDF payslip"}</button>
      </> : <p className="mute">No finalized payslip is available for this month yet.</p>}
    </Card>
    {admin && <>
      <Card><h3>New payroll run</h3><form className="grid-form" onSubmit={create}>
        <label>Month<input required type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
        <button className="btn primary">Create draft</button>
      </form></Card>
      <Card><h3>Payroll runs</h3>{!runs ? <Skeleton /> : !runs.length ? <Empty icon={<span>—</span>} text="No payroll runs" /> :
        <div className="table-wrap"><table><thead><tr><th>Month</th><th>Employees</th><th>Status</th><th /></tr></thead><tbody>
          {runs.map(run => <tr key={run._id}><td>{run.month}</td><td>{run.items.length}</td><td><Pill s={run.status} /></td>
            <td className="right">{run.status === "DRAFT" && <button className="btn sm" onClick={() => void finalize(run._id)}>Finalize</button>}</td>
          </tr>)}
        </tbody></table></div>}
      </Card>
    </>}
  </>;
}
