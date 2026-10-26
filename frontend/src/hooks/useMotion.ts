import { useEffect, useLayoutEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { reduced, whenReady } from "../lib/gsap";


/** Cinematic stagger-in for every `[data-r]` block, plus a per-letter rise on the page title. Waits for any overlay to clear. */
export function useReveal(ref: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced()) return;
    let ctx: gsap.Context | undefined;
    let unhover = () => {};
    gsap.set(root.querySelectorAll("[data-r]"), { opacity: 0 });
    const off = whenReady(() => {
      ctx = gsap.context(() => {
        if (root.querySelector(".h1-in")) {
          const split = SplitText.create(".h1-in", { type: "chars" });
          gsap.fromTo(split.chars, { yPercent: 120, rotate: 9, color: "#ff3b2a" }, { yPercent: 0, rotate: 0, color: "#ffffff", duration: 0.6, ease: "expo.out", stagger: 0.02 });
          const hs = split.chars.map((c) => {
            const over = () => gsap.to(c, { yPercent: -12, color: "#ff5a3c", duration: 0.2, overwrite: "auto" });
            const out = () => gsap.to(c, { yPercent: 0, color: "#ffffff", duration: 0.8, ease: "elastic.out(1,0.4)", overwrite: "auto" });
            c.addEventListener("pointerenter", over); c.addEventListener("pointerleave", out);
            return () => { c.removeEventListener("pointerenter", over); c.removeEventListener("pointerleave", out); };
          });
          unhover = () => hs.forEach((f) => f());
        }
        gsap.fromTo("[data-r]", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.035, clearProps: "transform,opacity" });
      }, root);
    });
    return () => { off(); unhover(); ctx?.revert(); gsap.set(root.querySelectorAll("[data-r]"), { clearProps: "opacity" }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function countUp(el: HTMLElement | null, to: number, decimals = 0) {
  if (!el) return;
  const show = (v: number) => { el.textContent = decimals ? v.toFixed(decimals) : String(Math.round(v)); };
  if (reduced()) { show(to); return; }
  const o = { v: 0 };
  const t = gsap.to(o, { v: to, duration: 1.6, ease: "expo.out", onUpdate: () => show(o.v) });
  return () => { t.kill(); show(to); };
}

/**
 * One delegated pointer listener for the whole app shell:
 *  - `.spot` surfaces get a red spotlight under the pointer (--mx / --my),
 *  - `[data-tilt]` surfaces tilt in 3D,
 *  - `.btn.primary` / `.icon-btn` pull toward the cursor (magnetic).
 */
export function useInteractions() {
  useEffect(() => {
    if (reduced()) return;
    let tilted: HTMLElement | null = null;
    let pulled: HTMLElement | null = null;
    const relaxTilt = (el: HTMLElement) => gsap.to(el, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "elastic.out(1,0.6)", overwrite: "auto" });
    const relaxPull = (el: HTMLElement) => gsap.to(el, { x: 0, y: 0, scale: 1, duration: 0.7, ease: "elastic.out(1,0.4)", overwrite: "auto" });

    const move = (e: PointerEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      const spot = t?.closest<HTMLElement>(".spot") ?? null;
      if (spot) {
        const b = spot.getBoundingClientRect();
        spot.style.setProperty("--mx", `${e.clientX - b.left}px`);
        spot.style.setProperty("--my", `${e.clientY - b.top}px`);
      }
      const tilt = t?.closest<HTMLElement>("[data-tilt]") ?? null;
      if (tilted && tilted !== tilt) relaxTilt(tilted);
      tilted = tilt;
      if (tilt) {
        const b = tilt.getBoundingClientRect();
        const px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5;
        gsap.to(tilt, { rotateY: px * 9, rotateX: -py * 9, transformPerspective: 900, duration: 0.5, ease: "power3.out", overwrite: "auto" });
      }
      const pull = t?.closest<HTMLElement>(".btn.primary, .icon-btn") ?? null;
      if (pulled && pulled !== pull) relaxPull(pulled);
      pulled = pull;
      if (pull) {
        const b = pull.getBoundingClientRect();
        gsap.to(pull, { x: (e.clientX - b.left - b.width / 2) * 0.2, y: (e.clientY - b.top - b.height / 2) * 0.28, scale: 1.04, duration: 0.35, ease: "power3.out", overwrite: "auto" });
      }
    };
    const leave = () => { if (tilted) relaxTilt(tilted); if (pulled) relaxPull(pulled); tilted = pulled = null; };
    window.addEventListener("pointermove", move);
    document.documentElement.addEventListener("pointerleave", leave);
    return () => { window.removeEventListener("pointermove", move); document.documentElement.removeEventListener("pointerleave", leave); };
  }, []);
}
