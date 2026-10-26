import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { Observer } from "gsap/Observer";

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="pagehead" data-r>
      <div><h1><span className="h1-in">{title}</span></h1>{sub && <p>{sub}</p>}</div>
      {action}
    </div>
  );
}
export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section className={`card spot ${className}`} data-r {...(className.includes("stat") ? { "data-tilt": "" } : {})}>{children}</section>
);
export const Pill = ({ s }: { s: string }) => <span className={`pill ${s.toLowerCase()}`}>{(s.charAt(0) + s.slice(1).toLowerCase()).replace(/_/g, " ")}</span>;
export const Avatar = ({ name }: { name: string }) => <span className="avatar">{name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>;
export const Empty = ({ icon, text }: { icon: ReactNode; text: string }) => <div className="empty">{icon}<p>{text}</p></div>;
export const Skeleton = ({ rows = 3 }: { rows?: number }) => <div>{Array.from({ length: rows }).map((_, i) => <div key={i} className="skel" />)}</div>;

/** Outlined brand ticker. Scrolling the wheel whips it faster, flips its direction and skews it; hovering slows it. */
export function Marquee({ items }: { items: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = track.current, host = el?.parentElement;
    if (!el || !host || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.to(el, { xPercent: -50, duration: 38, ease: "none", repeat: -1 });
    const skew = gsap.quickTo(host, "skewX", { duration: 0.5, ease: "power3.out" });
    let dir = 1, hover = false;
    const rest = () => dir * (hover ? 0.15 : 1);
    const obs = Observer.create({
      target: window, type: "wheel,touch", tolerance: 2,
      onChange: (s) => { dir = s.deltaY > 0 ? 1 : -1; skew(gsap.utils.clamp(-14, 14, -s.deltaY * 0.12)); gsap.to(tween, { timeScale: dir * (1.5 + Math.min(Math.abs(s.deltaY) / 12, 9)), duration: 0.25, overwrite: true }); },
      onStop: () => { skew(0); gsap.to(tween, { timeScale: rest(), duration: 1.4, ease: "power2.out", overwrite: true }); },
    });
    const slow = () => { hover = true; gsap.to(tween, { timeScale: rest(), duration: 0.6, overwrite: true }); };
    const fast = () => { hover = false; gsap.to(tween, { timeScale: rest(), duration: 0.6, overwrite: true }); };
    host.addEventListener("pointerenter", slow); host.addEventListener("pointerleave", fast);
    return () => { obs.kill(); host.removeEventListener("pointerenter", slow); host.removeEventListener("pointerleave", fast); tween.kill(); gsap.set(host, { clearProps: "skewX" }); };
  }, []);
  const half = Array.from({ length: 3 }).flatMap(() => items);
  const row = (key: string) => <div className="mq-half" key={key}>{half.map((t, i) => <span key={i}>{t}<i>✦</i></span>)}</div>;
  return <div className="marquee" data-r aria-hidden="true"><div className="mq-track" ref={track}>{row("a")}{row("b")}</div></div>;
}
