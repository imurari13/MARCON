import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../services/api";
import { Card, Empty, PageHead, Pill, Skeleton } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

type Run = { _id: string; month: string; status: "DRAFT" | "FINALIZED"; items: unknown[] };
type Payslip = { gross: number; deductions: number; net: number };

export default function PayrollPage() {
  const { user } = useAuth();
  const toast = useToast();
  const admin = user?.role === "CEO" || user?.role === "HR";
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payslip, setPayslip] = useState<Payslip | null>(null);

  const load = useCallback(async () => {
    if (admin) setRuns((await apiRequest<{ runs: Run[] }>("/payroll/runs")).runs);
    try { setPayslip((await apiRequest<{ payslip: Payslip }>(`/payroll/payslip/${month}`)).payslip); }
    catch { setPayslip(null); }
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

  return <>
    <PageHead title="Payroll" sub="Monthly payroll runs and payslips" />
    <Card><h3>My payslip</h3><label>Month<input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
      {payslip ? <>
        <div className="stats">
          <div className="stat"><small>Gross</small><b className="num">{payslip.gross.toFixed(2)}</b></div>
          <div className="stat"><small>Deductions</small><b className="num">{payslip.deductions.toFixed(2)}</b></div>
          <div className="stat"><small>Net pay</small><b className="num">{payslip.net.toFixed(2)}</b></div>
        </div>
        <a className="btn" href={`/api/payroll/payslip/${month}/pdf`}>Download PDF payslip</a>
      </> : <p className="mute">No payslip available for this month.</p>}
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
