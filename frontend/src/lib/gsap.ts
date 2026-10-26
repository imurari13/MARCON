import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { Flip } from "gsap/Flip";
import { Observer } from "gsap/Observer";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

gsap.registerPlugin(SplitText, Flip, Observer, ScrambleTextPlugin, DrawSVGPlugin);

/**
 * True when heavy motion should be skipped: the OS asks for reduced motion, OR the screen is a phone/small tablet.
 * Phones get a static, instant UI (no canvas effects, no entrance choreography) so everything feels immediate.
 */
export const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 860px)").matches;

/** Nothing blocks page content any more (no intro / route-transition overlay), so the gate is always open. */
export const gate = { ready: true };
export function setReady(_v: boolean) { /* kept for compatibility */ }
export function whenReady(fn: () => void): () => void { fn(); return () => {}; }
export function markIntroSeen() { /* intro removed */ }
