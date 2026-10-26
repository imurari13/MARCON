import { useEffect, useRef, type CSSProperties } from "react";
import { gsap } from "gsap";
import { reduced } from "../lib/gsap";

export type BurstKind = "in" | "out";
const DOTS = 16;

/** Full-screen celebration after checking in (green tick) or out (amber exit arrow). Auto-dismisses; click to skip. */
export default function ActionBurst({ kind, caption, onDone }: { kind: BurstKind; caption: string; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const color = kind === "in" ? "#4ade80" : "#ff9a5c";

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (reduced()) { const t = window.setTimeout(() => done.current(), 1800); return () => window.clearTimeout(t); }
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => done.current() });
      tl.fromTo(".bu-scrim", { opacity: 0 }, { opacity: 1, duration: 0.3 })
        .fromTo(".bu-card", { scale: 0.7, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: 0.55, ease: "back.out(1.8)" }, 0)
        .fromTo(".bu-ring", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, ease: "power2.inOut" }, 0.15)
        .fromTo(".bu-fill", { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.5, ease: "back.out(2.2)" }, 0.55)
        .fromTo(".bu-icon", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: "power2.out" }, 0.7)
        .fromTo(".bu-dot", { x: 0, y: 0, scale: 0, opacity: 1 }, { x: (i) => Math.sin((i / DOTS) * Math.PI * 2) * (i % 2 ? 92 : 68), y: (i) => -Math.cos((i / DOTS) * Math.PI * 2) * (i % 2 ? 92 : 68), scale: 1, duration: 0.5, ease: "expo.out", stagger: 0 }, 0.75)
        .to(".bu-dot", { opacity: 0, scale: 0.2, duration: 0.6, ease: "power2.in" }, 1.1)
        .fromTo(".bu-text > *", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "expo.out", stagger: 0.1 }, 0.85)
        .to(el, { opacity: 0, duration: 0.4, ease: "power2.in" }, 2.5);
      if (kind === "out") tl.fromTo(".bu-icon", { x: 0 }, { x: 5, duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: 1 }, 1.3);
    }, el);
    return () => ctx.revert();
  }, [kind]);

  return (
    <div className="burst" ref={root} role="status" aria-live="polite" onClick={() => done.current()}>
      <div className="bu-scrim" />
      <div className="bu-card" style={{ "--bu": color } as CSSProperties}>
        <svg viewBox="-60 -60 120 120" aria-hidden="true">
          <circle className="bu-fill" r="38" fill={color} fillOpacity=".16" />
          <circle className="bu-ring" r="38" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" transform="rotate(-90)" />
          {Array.from({ length: DOTS }, (_, i) => <circle key={i} className="bu-dot" r={i % 2 ? 2.6 : 3.6} fill={i % 3 === 0 ? "#fff" : color} />)}
          {kind === "in"
            ? <path className="bu-icon" d="M-15 1 L-4 12 L16 -11" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            : <path className="bu-icon" d="M-6 -16 H-16 V16 H-6 M-4 0 H18 M9 -9 L18 0 L9 9" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
        <div className="bu-text">
          <b>{kind === "in" ? "You're checked in" : "You're checked out"}</b>
          <small>{caption}</small>
        </div>
      </div>
    </div>
  );
}
