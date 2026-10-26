import { useState, type FormEvent } from "react";
import { apiRequest } from "../services/api";
import { Card, PageHead } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

export default function SecurityPage() {
  const { user } = useAuth();
  const toast = useToast();
  const eligible = user?.role === "CEO" || user?.role === "HR";
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function setup() {
    setBusy(true);
    try {
      const result = await apiRequest<{ secret: string }>("/auth/mfa/setup", { method: "POST" });
      setSecret(result.secret);
      toast("Add this secret to your authenticator app");
    } catch (error) {
      toast((error as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiRequest("/auth/mfa/confirm", { method: "POST", body: JSON.stringify({ code }) });
      toast("Two-factor authentication enabled");
      setSecret("");
      setCode("");
    } catch (error) {
      toast((error as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Security" sub="Protect your account and sign-ins" />
      <Card>
        <h3>Authenticator app</h3>
        {!eligible ? (
          <p className="mute">Two-factor authentication is mandatory for CEO and HR accounts. Your role does not require enrollment.</p>
        ) : !secret ? (
          <>
            <p className="mute">Use an authenticator app to generate a six-digit verification code at sign-in.</p>
            <button className="btn primary" disabled={busy} onClick={() => void setup()}>Set up two-factor authentication</button>
          </>
        ) : (
          <form className="grid-form" onSubmit={confirm}>
            <label className="span">Authenticator secret<input readOnly value={secret} aria-label="Authenticator setup secret" /></label>
            <label>Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /></label>
            <button className="btn primary" disabled={busy}>Confirm and enable</button>
          </form>
        )}
      </Card>
    </>
  );
}
