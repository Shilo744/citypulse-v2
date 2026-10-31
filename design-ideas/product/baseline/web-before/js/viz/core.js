// Shared plumbing for every chart module: the DOM helpers, the colour tokens, the "animate when it scrolls into view" trigger,
// responsive redraw, count-up numbers, tooltips and the accessible twin of a chart. Chart modules import everything from here.
//
// The animation contract (see css/motion.css for the classes):
//   1. a chart's outer element is passed through viz(el, { label }) once. That adds class "viz" and, when the chart first scrolls into view, class "in".
//   2. marks inside carry animation classes: draw / sweep (stroke draws itself, needs --len), fade, pop (dot appears), grow-x / grow-y (bar grows), rise.
//      --i (a number) staggers marks. Charts never write their own keyframes.
//   3. the "in" state lives on the outer element, never on something a redraw replaces, so a resize does not replay the entrance.
//   With reduced motion, in print and without JS the marks simply sit in their final place (the hidden start states only exist under html.js-motion).
import { h, svg, clear, debounce, tip, tipHead, tipRow, num, fmtVal, icon, STATUS } from "../ui.js";
export { h, svg, clear, debounce, tip, tipHead, tipRow, num, fmtVal, icon, STATUS };
export * from "./math.js";

// colours (CSS variables, so light and dark both work). The city is the one coloured line; everything else recedes.
export const C = { city: "var(--c-city)", nat: "var(--c-nat)", peer: "var(--c-peer)", target: "var(--c-target)", band: "var(--c-band)", bin: "var(--c-bin)", ink: "var(--ink)", muted: "var(--ink-3)", grid: "var(--line)", surface: "var(--surface)" };
// tone = the verdict colour: good (teal), attn / watch (orange), none (grey)
export const TONE = { good: "var(--good-bar)", strength: "var(--good-bar)", watch: "var(--attn-bar)", attn: "var(--attn-bar)", concern: "var(--attn-bar)", none: "var(--none-bar)" };
export const TONE_INK = { good: "var(--good-ink)", watch: "var(--attn-ink)", attn: "var(--attn-ink)", none: "var(--none-ink)" };
export const TONE_SOFT = { good: "var(--good-soft)", watch: "var(--attn-soft)", attn: "var(--attn-soft)", none: "var(--none-soft)" };
export const toneOfStatus = (s) => ({ strength: "good", good: "good", watch: "watch", concern: "attn", stale: "none", uncertain: "none", na: "none" }[s] || "none");
// one fill per status, used wherever statuses are counted or listed (concern solid orange ... strength solid teal, background grey)
export const STATUS_COLOR = {
  concern: "var(--attn-bar)", watch: "var(--watch-bar)", good: "color-mix(in srgb, var(--good-bar) 50%, var(--surface))",
  strength: "var(--good-bar)", stale: "var(--none-bar)", uncertain: "var(--line-2)", na: "var(--line-2)"
};
export const STATUS_WORD = { concern: "דורש טיפול", watch: "למעקב", good: "תקין", strength: "חוזק", stale: "נתון ישן", uncertain: "קבוצה קטנה", na: "מדד רקע" };

const hasWin = typeof window !== "undefined" && typeof document !== "undefined";
export const motionOn = () => hasWin && document.documentElement.classList.contains("js-motion");
let seq = 0;
export const uid = (p = "v") => `${p}${++seq}`;

// run fn once, when el first scrolls into view (at once when motion is off or there is no IntersectionObserver)
let io = null;
const waiting = new Map();
export function whenVisible(el, fn) {
  if (!hasWin || !motionOn() || !("IntersectionObserver" in window)) { fn(); return; }
  if (!io) io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; io.unobserve(e.target); const f = waiting.get(e.target); waiting.delete(e.target); if (f) f(); }), { threshold: 0.01, rootMargin: "0px 0px -6% 0px" });
  waiting.set(el, fn); io.observe(el);
}

// mark an element as an animated chart (see the contract at the top). label = what a screen reader hears for the whole chart.
export function viz(el, { label, role = "img" } = {}) {
  el.classList.add("viz");
  if (label) { el.setAttribute("role", role); el.setAttribute("aria-label", label); }
  if (!el.dataset.seen) whenVisible(el, () => { el.dataset.seen = "1"; el.classList.add("in"); });
  return el;
}

// call draw(width) now and again whenever the host's width changes (hosts inside a closed <details> draw when they open)
export function fit(host, draw, { min = 140 } = {}) {
  let w = 0;
  const run = () => { const nw = Math.floor(host.clientWidth || 0); if (nw >= min && Math.abs(nw - w) > 1) { w = nw; draw(nw); } };
  if (hasWin) requestAnimationFrame(run);
  if (hasWin && window.ResizeObserver) new ResizeObserver(debounce(run, 60)).observe(host);
  return { redraw: () => { w = 0; run(); } };
}

// a number that counts up to its value when it scrolls into view. The final text is always there for screen readers, print and reduced motion;
// returns a span. fmt turns the running value into text.
export function countTo(to, { dec = 0, dur = 900, fmt } = {}) {
  const f = fmt || ((v) => num(v, dec)), out = h("span.cnt", f(to));
  if (!hasWin || !motionOn() || !to) return out;
  const live = h("span", { "aria-hidden": "true" }, f(0)), wrap = h("span.cnt", h("span.sr", f(to)), live);
  whenVisible(wrap, () => {
    const t0 = performance.now();
    (function tick(now) { const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3); live.textContent = f(p < 1 ? to * e : to); if (p < 1) requestAnimationFrame(tick); })(t0);
  });
  return wrap;
}

// the SVG element of a chart
export const svgRoot = (w, ht, label) => svg("svg", { width: w, height: ht, viewBox: `0 0 ${w} ${ht}`, ...(label ? { role: "img", "aria-label": label } : { "aria-hidden": "true" }) });

// a tooltip that follows the pointer over el and also opens on keyboard focus; build(ev) returns the tooltip's nodes
export function bindTip(el, build) {
  el.addEventListener("pointermove", (ev) => tip.show(build(ev), ev));
  el.addEventListener("pointerleave", () => tip.hide());
  el.addEventListener("focus", () => { const r = el.getBoundingClientRect(), ev = { clientX: r.left + r.width / 2, clientY: r.top }; tip.show(build(ev), ev); });
  el.addEventListener("blur", () => tip.hide());
  return el;
}

// the same data as a table, for screen readers (class sr = visually hidden)
export function srTable(caption, headers, rows) {
  return h("table.sr", h("caption", caption), h("thead", h("tr", headers.map((x) => h("th", x)))), h("tbody", rows.map((r) => h("tr", r.map((c) => h("td", c == null ? "—" : String(c)))))));
}

// the key under a chart: items [{ label, color, dash, sq }]
export function legendRow(items) {
  return h("div.legend", items.map((i) => h("span", h("i" + (i.sq ? ".sq" : ""), { style: i.dash ? { background: "transparent", borderTop: `2px dashed ${i.color}`, height: "0", borderRadius: "0" } : { background: i.color } }), i.label)));
}
