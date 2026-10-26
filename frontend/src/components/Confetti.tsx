import { useEffect, useRef } from "react";
import { reduced } from "../lib/gsap";

interface P { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string; life: number }
const COLORS = ["#f0392b", "#ff7a45", "#ffd166", "#ffffff", "#4ade80", "#60a5fa", "#f472b6"];

/** Full-screen confetti shower drawn on a canvas. Renders nothing when the user prefers reduced motion. */
export default function Confetti({ onDone, duration = 5200 }: { onDone?: () => void; duration?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const cb = useRef(onDone);
  cb.current = onDone;

  useEffect(() => {
    const canvas = cv.current, ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || reduced()) { cb.current?.(); return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => { canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    window.addEventListener("resize", size);
    const W = () => window.innerWidth, H = () => window.innerHeight;
    const parts: P[] = [];
    const spawn = (x: number, y: number, angle: number, spread: number, power: number) => {
      const a = angle + (Math.random() - 0.5) * spread, v = power * (0.55 + Math.random() * 0.6);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: COLORS[(Math.random() * COLORS.length) | 0]!, life: 1 });
    };
    const cannon = () => { for (let i = 0; i < 70; i++) { spawn(0, H(), -Math.PI / 3, 0.9, 20); spawn(W(), H(), (-2 * Math.PI) / 3, 0.9, 20); } };
    cannon();
    const t1 = window.setTimeout(cannon, 700);
    let rain = true;
    const t2 = window.setTimeout(() => { rain = false; }, duration - 1800);
    const start = performance.now();
    let raf = 0, last = start;
    const frame = (now: number) => {
      const dt = Math.min(2, (now - last) / 16.7); last = now;
      if (rain) for (let i = 0; i < 3; i++) spawn(Math.random() * W(), -10, Math.PI / 2, 0.5, 3);
      ctx.clearRect(0, 0, W(), H());
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        p.vy += 0.38 * dt; p.vx *= 0.992; p.vy *= 0.992;
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        if (p.y > H() + 20) { parts.splice(i, 1); continue; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.cos(p.r * 1.3));
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      if (now - start < duration || parts.length) raf = requestAnimationFrame(frame); else cb.current?.();
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(t1); window.clearTimeout(t2); window.removeEventListener("resize", size); };
  }, [duration]);

  return <canvas ref={cv} className="confetti" aria-hidden="true" />;
}
