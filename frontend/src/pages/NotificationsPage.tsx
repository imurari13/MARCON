import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../services/api";
import { Card, Empty, PageHead, Skeleton } from "../components/ui";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";

type Notification = { _id: string; title: string; body: string; readAt: string | null; createdAt: string };
type Announcement = { _id: string; title: string; body: string; publishedAt: string; acknowledgedBy: string[] };

export default function NotificationsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Notification[] | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [announcement, setAnnouncement] = useState({ title: "", body: "", audience: "ALL" as "ALL" | "MANAGERS" });
  const [publishing, setPublishing] = useState(false);
  const canPublish = user?.role === "CEO" || user?.role === "HR";

  const load = useCallback(async () => {
    const [notifications, companyAnnouncements] = await Promise.all([
      apiRequest<{ notifications: Notification[] }>("/communications/notifications"),
      apiRequest<{ announcements: Announcement[] }>("/communications/announcements"),
    ]);
    setNotes(notifications.notifications);
    setAnnouncements(companyAnnouncements.announcements);
  }, []);

  useEffect(() => { void load().catch((error: Error) => toast(error.message, "bad")); }, [load, toast]);

  const read = async (id: string) => {
    try { await apiRequest(`/communications/notifications/${id}/read`, { method: "POST" }); await load(); }
    catch (error) { toast((error as Error).message, "bad"); }
  };

  const acknowledge = async (id: string) => {
    try { await apiRequest(`/communications/announcements/${id}/acknowledge`, { method: "POST" }); await load(); toast("Acknowledged"); }
    catch (error) { toast((error as Error).message, "bad"); }
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    setPublishing(true);
    try {
      await apiRequest("/communications/announcements", { method: "POST", body: JSON.stringify(announcement) });
      setAnnouncement({ title: "", body: "", audience: "ALL" });
      await load();
      toast("Announcement published");
    } catch (error) {
      toast((error as Error).message, "bad");
    } finally {
      setPublishing(false);
    }
  };

  return <>
    <PageHead title="Updates" sub="Company notices and your notifications" />
    {canPublish && <Card>
      <h3>Publish announcement</h3>
      <form className="grid-form" onSubmit={publish}>
        <label>Title<input required minLength={3} maxLength={160} value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} /></label>
        <label>Audience<select value={announcement.audience} onChange={(event) => setAnnouncement({ ...announcement, audience: event.target.value as "ALL" | "MANAGERS" })}><option value="ALL">Everyone</option><option value="MANAGERS">Managers only</option></select></label>
        <label className="span">Message<textarea required minLength={3} maxLength={5000} value={announcement.body} onChange={(event) => setAnnouncement({ ...announcement, body: event.target.value })} /></label>
        <button className="btn primary" disabled={publishing}>{publishing ? "Publishing…" : "Publish"}</button>
      </form>
    </Card>}
    <Card>
      <h3>Notifications</h3>
      {!notes ? <Skeleton /> : !notes.length ? <Empty icon={<span>—</span>} text="You’re all caught up" /> : <div className="notice-list">{notes.map((note) => <article key={note._id} className={`notice ${note.readAt ? "" : "unread"}`}><div><b>{note.title}</b><p>{note.body}</p><small>{new Date(note.createdAt).toLocaleString()}</small></div>{!note.readAt && <button className="btn sm" onClick={() => void read(note._id)}>Mark read</button>}</article>)}</div>}
    </Card>
    <Card>
      <h3>Announcements</h3>
      {!announcements ? <Skeleton /> : !announcements.length ? <Empty icon={<span>—</span>} text="No announcements" /> : <div className="notice-list">{announcements.map((item) => <article key={item._id} className="notice"><div><b>{item.title}</b><p>{item.body}</p><small>{new Date(item.publishedAt).toLocaleDateString()}</small></div><button className="btn sm" onClick={() => void acknowledge(item._id)}>Acknowledge</button></article>)}</div>}
    </Card>
  </>;
}
