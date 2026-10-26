import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { reduced, whenReady } from "../lib/gsap";

/** Big headline whose outlined "ghost" copies trail behind it, each lagging the cursor a little more. */
export default function GhostTitle({ lines, hotLast = false, className = "" }: { lines: string[]; hotLast?: boolean; className?: string }) {
  const root = useRef<HTMLHeadingElement>(null);
  const echoes = 4;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || reduced()) return;
    let ctx: gsap.Context | undefined;
    let stop = () => {};
    const off = whenReady(() => {
      ctx = gsap.context(() => {
        const split = SplitText.create(".g-main .g-line", { type: "lines,chars", mask: "lines" });
        gsap.from(split.chars, { yPercent: 118, rotate: 7, duration: 1.3, ease: "expo.out", stagger: 0.035 });
        gsap.from(".g-echo", { opacity: 0, duration: 1.6, delay: 0.7, stagger: 0.18 });
        const qs = gsap.utils.toArray<HTMLElement>(".g-echo").map((e, i) => ({
          x: gsap.quickTo(e, "x", { duration: 0.4 + i * 0.3, ease: "power3.out" }),
          y: gsap.quickTo(e, "y", { duration: 0.4 + i * 0.3, ease: "power3.out" }),
        }));
        const move = (e: PointerEvent) => {
          const nx = e.clientX / window.innerWidth - 0.5, ny = e.clientY / window.innerHeight - 0.5;
          qs.forEach((q, i) => { q.x(nx * (i + 1) * -34); q.y(ny * (i + 1) * -20); });
        };
        window.addEventListener("pointermove", move);
        stop = () => window.removeEventListener("pointermove", move);
      }, el);
    });
    return () => { off(); stop(); ctx?.revert(); };
  }, []);

  const body = lines.map((l, i) => <span className={`g-line${hotLast && i === lines.length - 1 ? " hot" : ""}`} key={i}>{l}</span>);
  return (
    <h1 className={`ghost ${className}`} ref={root}>
      <span className="g-main">{body}</span>
      {Array.from({ length: echoes }).map((_, i) => <span className="g-echo" key={i} aria-hidden="true" style={{ opacity: 0.6 - i * 0.12 }}>{body}</span>)}
    </h1>
  );
}
