import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { reduced } from "../lib/gsap";

/** Red light-ribbon that trails the pointer, plus a lagging ring that swells over interactive things. */
export default function Cursor() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = canvas.current, r = ring.current, d = dot.current, ctx = c?.getContext("2d");
    if (!c || !r || !d || !ctx || reduced() || window.matchMedia("(pointer: coarse)").matches) return;
    document.documentElement.classList.add("has-cursor");
    const m = { x: -200, y: -200, hx: -200, hy: -200 };
    const pts: { x: number; y: number }[] = [];
    const rx = gsap.quickTo(r, "x", { duration: 0.5, ease: "power3.out" }), ry = gsap.quickTo(r, "y", { duration: 0.5, ease: "power3.out" });
    const dx = gsap.quickTo(d, "x", { duration: 0.08 }), dy = gsap.quickTo(d, "y", { duration: 0.08 });
    let W = 0, H = 0;
    const size = () => { W = window.innerWidth; H = window.innerHeight; const k = Math.min(window.devicePixelRatio || 1, 2); c.width = W * k; c.height = H * k; ctx.setTransform(k, 0, 0, k, 0, 0); };
    size();
    const move = (e: PointerEvent) => {
      m.x = e.clientX; m.y = e.clientY; rx(m.x); ry(m.y); dx(m.x); dy(m.y);
      const t = e.target instanceof Element ? e.target : null;
      r.classList.toggle("hot", !!t?.closest("a,button,.tile,.stat,[data-hover]"));
      r.classList.toggle("txt", !!t?.closest("input,select,textarea"));
    };
    const tick = () => {
      m.hx += (m.x - m.hx) * 0.4; m.hy += (m.y - m.hy) * 0.4;
      pts.push({ x: m.hx, y: m.hy }); if (pts.length > 28) pts.shift();
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
      for (let i = 1; i < pts.length; i++) {
        const k = i / pts.length;
        ctx.strokeStyle = `rgba(255,${60 + k * 70},40,${k * 0.16})`; ctx.lineWidth = k * 20;
        ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
        ctx.strokeStyle = `rgba(255,${110 + k * 90},70,${k * 0.75})`; ctx.lineWidth = k * 4.5;
        ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
      }
    };
    window.addEventListener("pointermove", move); window.addEventListener("resize", size); gsap.ticker.add(tick);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("resize", size); gsap.ticker.remove(tick); document.documentElement.classList.remove("has-cursor"); };
  }, []);

  return <><canvas ref={canvas} className="trail" aria-hidden="true" /><div ref={ring} className="cur-ring" aria-hidden="true" /><div ref={dot} className="cur-dot" aria-hidden="true" /></>;
}
