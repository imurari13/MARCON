import { useEffect, useRef, useState } from "react";
import { reduced } from "../lib/gsap";

const fmt = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** A live analogue clock (hour, minute and a smoothly sweeping second hand) in the user's local time. */
export default function AnalogClock({ size = 200 }: { size?: number }) {
  const hh = useRef<SVGGElement>(null), mm = useRef<SVGGElement>(null), ss = useRef<SVGGElement>(null);
  const [label, setLabel] = useState(() => fmt(new Date()));

  useEffect(() => {
    const smooth = !reduced();
    let raf = 0, lastMin = -1;
    const draw = () => {
      const d = new Date();
      const s = d.getSeconds() + (smooth ? d.getMilliseconds() / 1000 : 0);
      const m = d.getMinutes() + s / 60;
      const h = (d.getHours() % 12) + m / 60;
      hh.current?.setAttribute("transform", `rotate(${h * 30} 100 100)`);
      mm.current?.setAttribute("transform", `rotate(${m * 6} 100 100)`);
      ss.current?.setAttribute("transform", `rotate(${s * 6} 100 100)`);
      if (d.getMinutes() !== lastMin) { lastMin = d.getMinutes(); setLabel(fmt(d)); }
      if (smooth) raf = requestAnimationFrame(draw);
    };
    draw();
    const timer = smooth ? 0 : window.setInterval(draw, 1000);
    return () => { cancelAnimationFrame(raf); window.clearInterval(timer); };
  }, []);

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const major = i % 5 === 0;
    return <line key={i} x1="100" y1={major ? 12 : 14} x2="100" y2={major ? 22 : 18} transform={`rotate(${i * 6} 100 100)`} stroke={major ? "#fff" : "rgba(255,255,255,.35)"} strokeWidth={major ? 2.4 : 1} strokeLinecap="round" />;
  });
  const nums = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1, a = (n * 30 * Math.PI) / 180;
    return <text key={n} x={100 + 68 * Math.sin(a)} y={100 - 68 * Math.cos(a)} textAnchor="middle" dominantBaseline="central" className="ck-num">{n}</text>;
  });

  return (
    <div className="analog" style={{ width: size, height: size }} role="img" aria-label={`Current time ${label}`}>
      <svg viewBox="0 0 200 200">
        <defs>
          <radialGradient id="ck-face" cx="50%" cy="40%" r="65%"><stop offset="0" stopColor="#2a1513" /><stop offset="1" stopColor="#0a0808" /></radialGradient>
          <linearGradient id="ck-sec" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff9a5c" /><stop offset="1" stopColor="#f0392b" /></linearGradient>
        </defs>
        <circle cx="100" cy="100" r="97" fill="url(#ck-face)" stroke="rgba(240,57,43,.7)" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,.06)" />
        {ticks}{nums}
        <g ref={hh}><line x1="100" y1="108" x2="100" y2="56" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" /></g>
        <g ref={mm}><line x1="100" y1="110" x2="100" y2="32" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" /></g>
        <g ref={ss} className="ck-sec"><line x1="100" y1="118" x2="100" y2="22" stroke="url(#ck-sec)" strokeWidth="1.8" strokeLinecap="round" /><circle cx="100" cy="100" r="4.5" fill="#f0392b" /></g>
        <circle cx="100" cy="100" r="2" fill="#0a0808" />
      </svg>
    </div>
  );
}
