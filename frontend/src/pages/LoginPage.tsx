import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { gsap } from "gsap";
import { useAuth } from "../context/AuthContext";
import { reduced, whenReady } from "../lib/gsap";
import GhostTitle from "../components/GhostTitle";
import Embers from "../components/Embers";

export default function LoginPage() {
  const { login, verifyMfa } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organization, setOrganization] = useState("default");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [code, setCode] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useLayoutEffect(() => {
    if (reduced()) return;
    let ctx: gsap.Context | undefined;
    let unmove = () => {};
    const off = whenReady(() => {
      ctx = gsap.context(() => {
        gsap.timeline({ defaults: { ease: "expo.out" } })
          .fromTo(".hero-mark", { scale: 0.35, opacity: 0, rotate: -14 }, { scale: 1, opacity: 1, rotate: 0, duration: 1.8 }, 0)
          .fromTo(".art-fade", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, stagger: 0.12 }, 0.5)
          // Keep the form visible by default. A failed/interrupted intro must never hide login fields.
          .from(".auth-card", { x: 80, filter: "blur(14px)", duration: 1.4, clearProps: "filter" }, 0.2)
          .from("[data-f]", { opacity: 0, y: 20, duration: 0.9, stagger: 0.08, clearProps: "all" }, 0.7);

        gsap.to(".ring.r1", { rotate: 360, duration: 28, repeat: -1, ease: "none" });
        gsap.to(".ring.r2", { rotate: -360, duration: 40, repeat: -1, ease: "none" });
        gsap.to(".hero-mark img", { y: -12, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".hero-mark .halo", { scale: 1.25, opacity: 0.55, duration: 2.6, repeat: -1, yoyo: true, ease: "sine.inOut" });
        gsap.to(".auth-card", { "--a": 360, duration: 7, repeat: -1, ease: "none" });

        // Rotate each orbit SVG. MotionPath only accepts <path> data; these are
        // SVG ellipses, so rotating their containing SVG preserves the effect
        // without invalid MotionPath alignment calls.
        ([9, 13] as const).forEach((dur, k) => {
          const orbit = root.current?.querySelector<SVGSVGElement>(`.orbit.o${k + 1}`);
          if (!orbit) return;
          gsap.set(orbit, { transformOrigin: "50% 50%" });
          gsap.to(orbit, { rotate: k === 0 ? 360 : -360, duration: dur, repeat: -1, ease: "none" });
        });

        const mx = gsap.quickTo(".hero-mark", "x", { duration: 1.2, ease: "power3.out" });
        const my = gsap.quickTo(".hero-mark", "y", { duration: 1.2, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
          mx(nx * -50); my(ny * -40);
        };
        window.addEventListener("pointermove", move);
        unmove = () => window.removeEventListener("pointermove", move);
      }, root);
    });
    return () => { off(); unmove(); ctx?.revert(); };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try { setMfa(await login(email.trim(), password, organization.trim().toLowerCase() || "default")); }
    catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
      if (form.current && !reduced()) gsap.fromTo(form.current, { x: -14 }, { x: 0, duration: 0.8, ease: "elastic.out(1,0.2)" });
    } finally { setBusy(false); }
  }
  async function submitMfa(e: FormEvent) { e.preventDefault(); setError(""); setBusy(true); try { await verifyMfa(code); } catch (err) { setError(err instanceof Error ? err.message : "Unable to verify code"); } finally { setBusy(false); } }
  return (
    <div className="login" ref={root}>
      <section className="login-art">
        {!reduced() && <Embers intensity={1} />}
        <div className="grid-floor"><i /></div>
        <img className="art-logo art-fade" src="/marcamor-logo.png" alt="Marcamor" />
        <div className="hero-mark" aria-hidden="true">
          <span className="halo" /><span className="ring r1" /><span className="ring r2" />
          {[1, 2].map((k) => (
            <svg key={k} className={`orbit o${k}`} viewBox="0 0 400 400">
              <ellipse id={`orb${k}`} cx="200" cy="200" rx={k === 1 ? 196 : 150} ry={k === 1 ? 62 : 190} fill="none" stroke="rgba(255,122,69,.22)" strokeWidth="1" />
              {[0, 1, 2].map((i) => <circle key={i} className="spark" r={3.2 - i * 0.5} cx="0" cy="0" fill="#ff8a5c" />)}
            </svg>
          ))}
          <img src="/marcamor-mark.png" alt="" />
        </div>
        <GhostTitle className="art-title" lines={["People.", "Work.", "Ignited."]} hotLast />
        <p className="art-fade">Attendance, leave and your whole team — in one place that never goes dark.</p>
        <div className="art-meta art-fade"><span>Marcamor</span><i /><span>MarcOn</span></div>
      </section>
      <section className="login-form">
        <div className="auth-card">
          <form ref={form} onSubmit={mfa ? submitMfa : submit}>
            <small className="eyebrow" data-f>Secure access</small>
            <h2 data-f>{mfa ? "Verify your sign-in" : "Welcome back"}</h2>
            <p className="sub" data-f>{mfa ? "Enter your six-digit authenticator code." : "Sign in with the account your admin gave you."}</p>
            <label data-f>Email<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label>
            <label data-f>Organization<input autoComplete="organization" required value={organization} onChange={(e) => setOrganization(e.target.value.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase())} placeholder="default" /></label>
            <label data-f>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" /></label>
            {mfa && <label data-f>Authenticator code<input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" /></label>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn primary wide" data-f disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
        </div>
      </section>
    </div>
  );
}
