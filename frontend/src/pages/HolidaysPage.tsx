import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Card, Empty, PageHead, Skeleton } from "../components/ui";
import { useToast } from "../components/Toast";
import { IconCalendarDays } from "../components/Icons";

interface Holiday { _id: string; name: string; date: string; description?: string }
const prettyDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export default function HolidaysPage() {
  const { user } = useAuth();
  const toast = useToast();
  const admin = user?.role === "CEO" || user?.role === "HR";
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [form, setForm] = useState({ name: "", date: "", description: "" });
  const load = useCallback(async () => setHolidays((await apiRequest<{ holidays: Holiday[] }>("/holidays")).holidays), []);
  useEffect(() => { load().catch((error: Error) => toast(error.message, "bad")); }, [load, toast]);
  async function add(event: FormEvent) {
    event.preventDefault();
    try { await apiRequest("/holidays", { method: "POST", body: JSON.stringify(form) }); setForm({ name: "", date: "", description: "" }); await load(); toast("Holiday added for everyone"); }
    catch (error) { toast((error as Error).message, "bad"); }
  }
  async function remove(id: string) {
    try { await apiRequest(`/holidays/${id}`, { method: "DELETE" }); await load(); toast("Holiday removed"); }
    catch (error) { toast((error as Error).message, "bad"); }
  }
  return <>
    <PageHead title="Holidays" sub={admin ? "Add company holidays for every employee" : "Company holiday calendar"} />
    {admin && <Card><h3>Add holiday</h3><form className="grid-form" onSubmit={add}>
      <label>Holiday name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Diwali" /></label>
      <label>Date<input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
      <label>Details <input value={form.description} maxLength={300} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional note" /></label>
      <button className="btn primary">Add to calendar</button>
    </form></Card>}
    <Card><h3>Upcoming & company holidays</h3>
      {!holidays ? <Skeleton /> : holidays.length === 0 ? <Empty icon={<IconCalendarDays />} text="No holidays have been added yet" /> : <div className="holiday-list">{holidays.map((holiday) => <article className="holiday" key={holiday._id}><div className="holiday-date"><b>{new Date(`${holiday.date}T00:00:00`).getDate()}</b><small>{new Date(`${holiday.date}T00:00:00`).toLocaleDateString(undefined, { month: "short" })}</small></div><div><b>{holiday.name}</b><small>{prettyDate(holiday.date)}{holiday.description ? ` · ${holiday.description}` : ""}</small></div>{admin && <button className="btn sm ghost" onClick={() => void remove(holiday._id)}>Remove</button>}</article>)}</div>}
    </Card>
  </>;
}
