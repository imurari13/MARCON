import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { countUp } from "../hooks/useMotion";
import { reduced } from "../lib/gsap";

/** A stat that opens into a full detail card — the card itself morphs there with GSAP Flip. */
export default function StatCard({ label, value, icon, about, to, cta }: { label: string; value: number; icon: ReactNode; about: string; to: string; cta: string }) {
  const [open, setOpen] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const saved = useRef<Flip.FlipState | null>(null);
  const mounted = useRef(false);

  useEffect(() => countUp(num.current, value), [value]);

  function toggle() {
    if (!card.current || !slot.current) return;
    if (!open) slot.current.style.minHeight = `${card.current.offsetHeight}px`;
    saved.current = Flip.getState(card.current);
    setOpen((o) => !o);
  }

  useLayoutEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const el = card.current;
    if (!el || !saved.current) return;
    const state = saved.current; saved.current = null;
    if (!open && slot.current) gsap.delayedCall(0.9, () => { if (slot.current) slot.current.style.minHeight = ""; });
    if (reduced()) { gsap.set(scrim.current, { opacity: open ? 1 : 0 }); return; }
    Flip.from(state, { duration: 0.85, ease: "expo.inOut", zIndex: 90, onComplete: () => { gsap.set(el, { clearProps: "transform" }); } });
    gsap.fromTo(num.current, { fontSize: open ? 56 : 108 }, { fontSize: open ? 108 : 56, duration: 0.85, ease: "expo.inOut", clearProps: open ? "" : "fontSize" });
    if (open) {
      gsap.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: 0.6 });
      gsap.fromTo(".stat-more > *", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.08, delay: 0.45 });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") toggle(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="stat-slot" ref={slot} data-r>
      {open && <div className="scrim" ref={scrim} onClick={toggle} />}
      <section ref={card} className={`card spot stat${open ? " expanded" : ""}`} {...(open ? {} : { "data-tilt": "" })} onClick={open ? undefined : toggle} role={open ? "dialog" : "button"} tabIndex={open ? -1 : 0} onKeyDown={(e) => { if (!open && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(); } }} aria-label={open ? label : `${label}: ${value}. Open details`}>
        <span className="stat-icon">{icon}</span>
        <span ref={num} className="num">0</span>
        <small>{label}</small>
        {open && (
          <div className="stat-more">
            <p>{about}</p>
            <div className="stat-actions"><Link to={to} className="btn primary">{cta}</Link><button className="btn" onClick={toggle}>Close</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
