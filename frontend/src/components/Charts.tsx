import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { reduced } from "../lib/gsap";
import { Card } from "./ui";

export type Tone = "ok" | "warn" | "bad" | "accent" | "info" | "mute";
export interface Slice { label: string; value: number; tone?: Tone }

const TONES: Record<Tone, string> = { ok: "#4ade80", warn: "#fbbf24", bad: "#ff6b6b", accent: "#f0392b", info: "#60a5fa", mute: "#8b7f7d" };
const FALLBACK = ["#f0392b", "#ff9a5c", "#fbbf24", "#4ade80", "#60a5fa", "#a78bfa"];
const TAU = Math.PI * 2, R = 90, C = 100;

const pt = (a: number) => [C + R * Math.sin(a), C - R * Math.cos(a)] as const;
function wedge(a0: number, a1: number): string {
  if (a1 - a0 >= TAU - 1e-4) return `M${C - R} ${C}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`;
  const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
  return `M${C} ${C}L${x0} ${y0}A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}Z`;
}

/** Animated SVG pie chart: it sweeps open clockwise, slices lift on hover, legend shows value + share. */
export function PieChart({ slices, label }: { slices: Slice[]; label: string }) {
  const data = slices.map((s, i) => ({ ...s, color: s.tone ? TONES[s.tone] : FALLBACK[i % FALLBACK.length]! })).filter((s) => s.value > 0);
  const total = data.reduce((n, s) => n + s.value, 0);
  const key = data.map((s) => `${s.label}:${s.value}`).join("|");
  const [p, setP] = useState(reduced() ? 1 : 0);
  const [hot, setHot] = useState<number | null>(null);

  useEffect(() => {
    if (reduced()) { setP(1); return; }
    const o = { v: 0 };
    setP(0);
    const t = gsap.to(o, { v: 1, duration: 1.5, ease: "power3.out", onUpdate: () => setP(o.v) });
    return () => { t.kill(); };
  }, [key]);

  let acc = 0;
  const wedges = data.map((s, i) => {
    const a0 = (acc / total) * TAU; acc += s.value; const a1 = (acc / total) * TAU;
    const end = Math.min(a1, p * TAU);
    const mid = (a0 + a1) / 2, lift = hot === i ? 7 : 0;
    return end > a0 + 1e-4 ? (
      <path key={s.label} d={wedge(a0, end)} fill={s.color} stroke="#0d0c0d" strokeWidth={data.length > 1 ? 1.5 : 0}
        style={{ transform: `translate(${Math.sin(mid) * lift}px, ${-Math.cos(mid) * lift}px)`, transition: "transform .25s", cursor: "pointer", filter: hot === i ? `drop-shadow(0 0 8px ${s.color})` : undefined }}
        onPointerEnter={() => setHot(i)} onPointerLeave={() => setHot(null)} />
    ) : null;
  });
  const summary = total ? `${label}: ${data.map((s) => `${s.label} ${s.value}`).join(", ")}` : `${label}: no data yet`;

  return (
    <div className="pie">
      <svg viewBox="0 0 200 200" role="img" aria-label={summary}>
        {total === 0 ? <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="2" strokeDasharray="4 6" /> : wedges}
      </svg>
      {total === 0 ? <p className="mute pie-empty">No data yet</p> : (
        <ul className="pie-legend">
          {data.map((s, i) => (
            <li key={s.label} className={hot === i ? "on" : ""} onPointerEnter={() => setHot(i)} onPointerLeave={() => setHot(null)}>
              <i style={{ background: s.color }} /><span>{s.label}</span><b>{s.value}</b><small>{Math.round((s.value / total) * 100)}%</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const PieCard = ({ title, slices }: { title: string; slices: Slice[] }) => (
  <Card className="pie-card"><h3>{title}</h3><PieChart slices={slices} label={title} /></Card>
);

export interface Bar { key: string; label: string; value: number; tone?: Tone; hint?: string; faded?: boolean }
const toneColor = (t?: Tone) => (t ? TONES[t] : TONES.accent);

/** Replays a short entrance on a chart's bars whenever its data (`sig`) changes. Skipped for reduced motion. */
function useGrow(root: React.RefObject<HTMLElement | null>, selector: string, from: gsap.TweenVars, sig: string) {
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || reduced()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(selector, from, { scaleX: 1, scaleY: 1, opacity: 1, duration: 0.9, ease: "expo.out", stagger: { amount: 0.55, from: "start" }, clearProps: "transform,opacity" });
    }, el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
}

/** Vertical columns, one per item (e.g. one per day). Bars grow from the baseline; the tallest glows; hover shows a tip. */
export function ColumnChart({ bars, max, label, height = 190, onPick }: { bars: Bar[]; max?: number; label: string; height?: number; onPick?: (b: Bar) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const top = max ?? Math.max(1, ...bars.map((b) => b.value));
  const peak = bars.reduce((best, b, i) => (b.value > (bars[best]?.value ?? 0) ? i : best), 0);
  useGrow(root, ".col-bar", { scaleY: 0, transformOrigin: "50% 100%" }, bars.map((b) => `${b.key}:${b.value}`).join("|"));
  const every = bars.length > 20 ? 2 : 1;
  return (
    <div className="colchart" ref={root} role="img" aria-label={`${label}: ${bars.map((b) => `${b.label} ${b.hint ?? b.value}`).join(", ")}`} style={{ height }}>
      {bars.map((b, i) => (
        <div key={b.key} className={`col${b.faded ? " faded" : ""}${onPick && !b.faded ? " pick" : ""}`} onClick={onPick && !b.faded ? () => onPick(b) : undefined}>
          <span className="tip">{b.label} · {b.hint ?? b.value}</span>
          <div className="col-track"><i className={`col-bar${i === peak && b.value > 0 ? " peak" : ""}`} style={{ height: `${Math.max(b.value > 0 ? 4 : 2, (b.value / top) * 100)}%`, background: b.value > 0 ? `linear-gradient(180deg, ${toneColor(b.tone)}, color-mix(in srgb, ${toneColor(b.tone)} 35%, transparent))` : "rgba(255,255,255,.08)" }} /></div>
          <small>{i % every === 0 ? b.key : ""}</small>
        </div>
      ))}
    </div>
  );
}

/** Horizontal ranking: one labelled row per item with a bar that sweeps in from the left. */
export function RankChart({ rows, max, label, onPick }: { rows: Bar[]; max?: number; label: string; onPick?: (b: Bar) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  useGrow(root, ".rank-fill", { scaleX: 0, transformOrigin: "0% 50%" }, rows.map((r) => `${r.key}:${r.value}`).join("|"));
  if (!rows.length) return <p className="mute pie-empty">No data yet</p>;
  return (
    <div className="rankchart" ref={root} role="img" aria-label={`${label}: ${rows.map((r) => `${r.label} ${r.hint ?? r.value}`).join(", ")}`}>
      {rows.map((r) => (
        <button type="button" key={r.key} className="rank-row" onClick={() => onPick?.(r)} disabled={!onPick}>
          <span className="rank-name">{r.label}</span>
          <span className="rank-track"><i className="rank-fill" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100)}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${toneColor(r.tone)} 45%, transparent), ${toneColor(r.tone)})` }} /></span>
          <b>{r.hint ?? r.value}</b>
        </button>
      ))}
    </div>
  );
}
