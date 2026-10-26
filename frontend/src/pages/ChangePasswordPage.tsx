import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";

export default function ChangePasswordPage() {
  const { refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await apiRequest("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to change password"); } finally { setBusy(false); }
  }
  return <main className="password-page"><section className="auth-card"><form onSubmit={submit}><small className="eyebrow">Secure access</small><h2>Choose a new password</h2><p className="sub">For security, replace your temporary password before continuing.</p><label>Current password<input type="password" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label><label>New password<input type="password" required minLength={12} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn primary wide" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button></form></section></main>;
}
