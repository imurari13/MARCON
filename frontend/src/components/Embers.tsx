import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface Particle { x: number; y: number; vx: number; vy: number; r: number; a: number; phase: number; hue: number }

/** Marcamor ember field: rising red/orange sparks that bend away from the cursor and link up when close. */
export default function Embers({ fixed = false, intensity = 1 }: { fixed?: boolean; intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, ox = 0, oy = 0;
    const mouse = { x: -9999, y: -9999, sx: -9999, sy: -9999 };
    let ps: Particle[] = [];

    const spawn = (initial: boolean): Particle => ({
      x: Math.random() * w, y: initial ? Math.random() * h : h + 12,
      vx: (Math.random() - 0.5) * 0.3, vy: -(0.25 + Math.random() * 0.85),
      r: 0.6 + Math.random() * 2.2, a: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2, hue: 4 + Math.random() * 26,
    });

    const resize = () => {
      const b = canvas.getBoundingClientRect();
      w = b.width; h = b.height; ox = b.left; oy = b.top;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(fixed ? 34 : 60, Math.max(22, ((w * h) / 13000) * intensity)));
      ps = Array.from({ length: n }, () => spawn(true));
    };

    const draw = (animate: boolean) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      mouse.sx += (mouse.x - mouse.sx) * 0.12; mouse.sy += (mouse.y - mouse.sy) * 0.12;
      for (const p of ps) {
        if (animate) {
          p.phase += 0.02;
          p.x += p.vx + Math.sin(p.phase) * 0.18; p.y += p.vy;
          const dx = p.x - mouse.sx, dy = p.y - mouse.sy, d2 = dx * dx + dy * dy;
          if (d2 < 22500) { const d = Math.sqrt(d2) || 1, f = (150 - d) / 150; p.x += (dx / d) * f * 2.6; p.y += (dy / d) * f * 2.6; }
          if (p.y < -12 || p.x < -20 || p.x > w + 20) Object.assign(p, spawn(false));
        }
        const flick = 0.65 + Math.sin(p.phase * 2.3) * 0.35;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
        g.addColorStop(0, `hsla(${p.hue},100%,62%,${p.a * flick})`);
        g.addColorStop(0.35, `hsla(${p.hue - 2},95%,48%,${p.a * flick * 0.28})`);
        g.addColorStop(1, "hsla(4,90%,40%,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineWidth = 0.6;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y, d2 = dx * dx + dy * dy;
          if (d2 < 7000) {
            const near = Math.hypot(ps[i].x - mouse.sx, ps[i].y - mouse.sy) < 220 ? 1 : 0.28;
            ctx.strokeStyle = `rgba(240,70,45,${(1 - d2 / 7000) * 0.35 * near})`;
            ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke();
          }
        }
      }
    };

    const onMove = (e: PointerEvent) => { mouse.x = e.clientX - ox; mouse.y = e.clientY - oy; };
    const onResize = () => { resize(); if (reduce) draw(false); };
    resize();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("resize", onResize);
    const tick = () => draw(true);
    if (reduce) draw(false); else gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); window.removeEventListener("pointermove", onMove); window.removeEventListener("resize", onResize); };
  }, [intensity, fixed]);

  return <canvas ref={ref} className={`embers${fixed ? " fixed" : ""}`} aria-hidden="true" />;
}
