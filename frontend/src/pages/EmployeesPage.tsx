import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { gsap } from "gsap";
import { apiRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Avatar, Card, PageHead, Skeleton } from "../components/ui";
import { useToast } from "../components/Toast";
import { IconPlus } from "../components/Icons";

interface Emp { _id: string; employeeId: string; name: string; email: string; role: string; department?: string | null; managerId?: string | null; workStartTime: string; workEndTime: string; dateOfBirth?: string | null; isActive: boolean }
const blank = { employeeId: "", name: "", email: "", password: "", role: "EMPLOYEE", department: "", managerId: "", workStartTime: "09:30", workEndTime: "18:30", dateOfBirth: "" };

export default function EmployeesPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isCeo = user?.role === "CEO";
  const [rows, setRows] = useState<Emp[] | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(blank);
  const [schedules, setSchedules] = useState<Record<string, { workStartTime: string; workEndTime: string }>>({});
  const [reporting, setReporting] = useState<Record<string, { department: string; managerId: string }>>({});
  const panel = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => setRows((await apiRequest<{ employees: Emp[] }>("/employees")).employees), []);
  useEffect(() => { load().catch((e: Error) => toast(e.message, "bad")); }, [load, toast]);

  function toggleForm() {
    const next = !open; setOpen(next);
    const el = panel.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.style.height = next ? "auto" : "0px"; return; }
    gsap.to(el, { height: next ? "auto" : 0, opacity: next ? 1 : 0, duration: 0.4, ease: "power3.inOut" });
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    try { await apiRequest("/employees", { method: "POST", body: JSON.stringify({ ...f, managerId: f.managerId || null, department: f.department || undefined, dateOfBirth: f.dateOfBirth || undefined }) }); setF(blank); await load(); toast("Person added"); toggleForm(); }
    catch (x) { toast((x as Error).message, "bad"); }
  }
  const toggle = (id: string) => apiRequest(`/employees/${id}/toggle-active`, { method: "POST" }).then(load).catch((e: Error) => toast(e.message, "bad"));
  const scheduleFor = (employee: Emp) => schedules[employee._id] ?? { workStartTime: employee.workStartTime ?? "09:30", workEndTime: employee.workEndTime ?? "18:30" };
  const canEdit = (employee: Emp) => isCeo || (employee.role !== "CEO" && employee.role !== "HR");
  const saveBirthday = async (employee: Emp, value: string) => {
    try { await apiRequest(`/employees/${employee._id}/birthday`, { method: "PATCH", body: JSON.stringify({ dateOfBirth: value || null }) }); await load(); toast(`${employee.name}'s birthday saved`); }
    catch (error) { toast((error as Error).message, "bad"); await load(); }
  };
  const saveSchedule = async (employee: Emp) => {
    try { await apiRequest(`/employees/${employee._id}/schedule`, { method: "PATCH", body: JSON.stringify(scheduleFor(employee)) }); setSchedules((current) => { const next = { ...current }; delete next[employee._id]; return next; }); await load(); toast(`${employee.name}'s shift saved`); }
    catch (error) { toast((error as Error).message, "bad"); }
  };
  const reportingFor = (employee: Emp) => reporting[employee._id] ?? { department: employee.department ?? "", managerId: employee.managerId ?? "" };
  const saveReporting = async (employee: Emp) => { try { await apiRequest(`/employees/${employee._id}/reporting-line`, { method: "PATCH", body: JSON.stringify({ ...reportingFor(employee), department: reportingFor(employee).department || null, managerId: reportingFor(employee).managerId || null }) }); setReporting(current => { const next = { ...current }; delete next[employee._id]; return next; }); await load(); toast(`${employee.name}'s reporting line saved`); } catch (error) { toast((error as Error).message, "bad"); } };

  return (
    <>
      <PageHead title="People" sub={rows ? `${rows.length} in your organisation` : ""} action={<button className="btn primary" onClick={toggleForm}><IconPlus />{open ? "Close" : "Add person"}</button>} />
      <div ref={panel} className="collapse" style={{ height: 0, opacity: 0 }} data-r inert={!open}>
        <Card>
          <form className="grid-form" onSubmit={add}>
            <label>Employee ID<input required value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} /></label>
            <label>Full name<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label>Email<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
            <label>Temporary password<input type="password" required minLength={12} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="12+ characters" /></label>
            <label>Shift starts<input type="time" required value={f.workStartTime} onChange={(e) => setF({ ...f, workStartTime: e.target.value })} /></label>
            <label>Shift ends<input type="time" required value={f.workEndTime} onChange={(e) => setF({ ...f, workEndTime: e.target.value })} /></label>
            <label>Date of birth<input type="date" max={new Date().toLocaleDateString("en-CA")} value={f.dateOfBirth} onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })} /></label>
            <label>Role<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{(isCeo ? ["EMPLOYEE", "MANAGER", "HR"] : ["EMPLOYEE", "MANAGER"]).map((x) => <option key={x}>{x}</option>)}</select></label>
            <label>Department<input value={f.department} onChange={e => setF({ ...f, department: e.target.value })} /></label>
            <label>Reports to<select value={f.managerId} onChange={e => setF({ ...f, managerId: e.target.value })}><option value="">No manager</option>{rows?.filter(x => x.role === "MANAGER" || x.role === "HR" || x.role === "CEO").map(x => <option key={x._id} value={x._id}>{x.name}</option>)}</select></label>
            <button className="btn primary">Create account</button>
          </form>
        </Card>
      </div>
      <Card>
        {!rows ? <Skeleton rows={4} /> : (
          <div className="table-wrap"><table><tbody>{rows.map((r) => (
            <tr key={r._id} className={r.isActive ? "" : "off"}>
              <td className="who"><Avatar name={r.name} /><div><b>{r.name}</b><small>{r.email}</small></div></td>
              <td className="mute">{r.employeeId}</td>
              <td><span className="pill role">{r.role.toLowerCase()}</span><div className="schedule-edit"><input aria-label={`${r.name} shift starts`} type="time" value={scheduleFor(r).workStartTime} disabled={!canEdit(r)} onChange={(e) => setSchedules({ ...schedules, [r._id]: { ...scheduleFor(r), workStartTime: e.target.value } })} /><span>to</span><input aria-label={`${r.name} shift ends`} type="time" value={scheduleFor(r).workEndTime} disabled={!canEdit(r)} onChange={(e) => setSchedules({ ...schedules, [r._id]: { ...scheduleFor(r), workEndTime: e.target.value } })} />{canEdit(r) && <button className="btn sm ghost" onClick={() => void saveSchedule(r)}>Save</button>}</div>
                <div className="schedule-edit"><span>Birthday</span><input aria-label={`${r.name} date of birth`} type="date" max={new Date().toLocaleDateString("en-CA")} disabled={!canEdit(r)} defaultValue={r.dateOfBirth ?? ""} key={`${r._id}-${r.dateOfBirth ?? ""}`} onBlur={(e) => { if (e.target.value !== (r.dateOfBirth ?? "")) void saveBirthday(r, e.target.value); }} /></div></td>
              <td><div className="schedule-edit"><input aria-label={`${r.name} department`} placeholder="Department" value={reportingFor(r).department} disabled={!canEdit(r)} onChange={e => setReporting({ ...reporting, [r._id]: { ...reportingFor(r), department: e.target.value } })} /><select aria-label={`${r.name} manager`} disabled={!canEdit(r)} value={reportingFor(r).managerId} onChange={e => setReporting({ ...reporting, [r._id]: { ...reportingFor(r), managerId: e.target.value } })}><option value="">No manager</option>{rows.filter(x => x._id !== r._id && ["MANAGER", "HR", "CEO"].includes(x.role)).map(x => <option key={x._id} value={x._id}>{x.name}</option>)}</select>{canEdit(r) && <button className="btn sm ghost" onClick={() => void saveReporting(r)}>Save</button>}</div></td>
              <td className="right">{r.role !== "CEO" && (isCeo || r.role !== "HR") && <button className="btn sm ghost" onClick={() => void toggle(r._id)}>{r.isActive ? "Deactivate" : "Activate"}</button>}</td>
            </tr>))}</tbody></table></div>
        )}
      </Card>
    </>
  );
}
