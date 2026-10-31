// Single-number visuals: the status donut, the progress ring, the gauge, the standing meter and the waffle (contract: DESIGN_V3.md 5.1, signatures kept,
// options only added). Geometry and wording are pure exported functions with no DOM at import time, so tests/viz-rings.test.mjs runs them in node;
// the five chart functions only turn that into elements. Colour comes from tokens, motion from css/motion.css (sweep, pop, fade, rise, ping).
//
// Layout notes worth knowing before reading on:
//  - arcs are stroked paths with round caps. A round cap adds half the stroke width at each end, so a donut segment's path is shorter than the
//    stretch of ring it occupies, and a very small share is lifted to a round dot (see donutLayout).
//  - numbers that must count up (countTo) are HTML laid over the SVG; their size is a share of the chart's own width (container units), so a chart that
//    the page shrinks keeps its proportions.
import { h, svg, tip, tipHead, tipRow, num, fmtVal, viz, countTo, bindTip, C, TONE, TONE_INK, TONE_SOFT, STATUS_COLOR, STATUS_WORD, arcPath, polar, clamp, TAU, niceTicks } from "./core.js";
import { countLabel, compareLine, deltaUnit, unitSuffix, pts, outOf, ltr } from "../ui.js";

const isNum = (v) => typeof v === "number" && isFinite(v);
// text props: a string (or a finite number) or nothing; anything else is ignored rather than printed as "[object Object]"
const str = (v) => (typeof v === "string" ? v.trim() : isNum(v) ? String(v) : "");
// a figure for the centre: a finite number or a non-empty string
const shownOf = (v) => (isNum(v) || (typeof v === "string" && v.trim()) ? v : undefined);
const FULL = TAU - 0.002;                                   // a whole ring as one arc (a hair under a turn, so the two ends stay distinct points)
const HALF = Math.PI / 2;

// ── text without a DOM: an estimate of the width of a string in em (Heebo), enough to size a number and to place a label ──
const emOf = (ch) => (/[0-9]/.test(ch) ? 0.58 : /[.,:;·']/.test(ch) ? 0.3 : ch === "%" ? 0.86 : ch === " " ? 0.27 : /[\u0590-\u05FF]/.test(ch) ? 0.55 : /[-−–]/.test(ch) ? 0.4 : 0.62);
export const textEm = (s) => { let w = 0; for (const ch of String(s == null ? "" : s)) w += emOf(ch); return w; };

// figures: whole numbers have no decimals, a small figure that is not a percentage keeps two, everything else one
export const figDec = (unit, v) => (!isNum(v) || Number.isInteger(v) ? 0 : Math.abs(v) < 10 && unit !== "%" ? 2 : 1);
export const figText = (unit, v) => (isNum(v) ? num(v, figDec(unit, v)) : "—");
export function fmtFig(unit, v) {
  if (!isNum(v)) return "—";
  if (unit === "ils") return fmtVal("ils", v, 0);
  return figText(unit, v) + (unit === "%" ? "%" : "");
}
// a tone name from a status or a tone, folded to the four the tokens know
const T4 = (t) => ({ strength: "good", concern: "attn", good: "good", attn: "attn", watch: "watch", none: "none" }[t] || null);
const toneColor = (t) => (T4(t) ? TONE[T4(t)] : C.city);
// when the page gives no tone: judged against the target, else against the nation, and only when there is a direction to judge by
export function deriveTone({ value, nat, target, direction, tone } = {}) {
  if (T4(tone)) return T4(tone);
  if (!isNum(value) || (direction !== "higher" && direction !== "lower")) return null;
  const better = (a, b) => (direction === "lower" ? a <= b : a >= b);
  if (isNum(target)) return better(value, target) ? "good" : "watch";
  if (isNum(nat)) return better(value, nat) ? "good" : "watch";
  return null;
}

/* ════════════════════════════ the status donut ════════════════════════════ */

export const DONUT_KEYS = ["concern", "watch", "good", "strength", "background"];
export const BG_PARTS = ["stale", "uncertain", "na"];
export const DONUT_BG_WORD = "ללא שיפוט";

// counts by status folded into the five arcs (background = stale + uncertain + na); anything that is not a positive number counts as zero
export function donutCounts(counts) {
  const c = counts || {}, n = (k) => { const v = Number(c[k]); return isFinite(v) && v > 0 ? Math.round(v) : 0; };
  const parts = { stale: n("stale"), uncertain: n("uncertain"), na: n("na") };
  const out = { concern: n("concern"), watch: n("watch"), good: n("good"), strength: n("strength"), background: parts.stale + parts.uncertain + parts.na };
  const judged = out.concern + out.watch + out.good + out.strength;
  return { ...out, judged, total: judged + out.background, parts };
}

// shares of the visible ring (length avail) for the given weights, none shorter than min; the others give up the difference in proportion
function allot(weights, avail, min) {
  const n = weights.length, fixed = new Array(n).fill(false);
  let vis = weights.slice();
  for (let pass = 0; pass <= n; pass++) {
    const sumFree = weights.reduce((s, w, i) => s + (fixed[i] ? 0 : w), 0), rest = avail - fixed.filter(Boolean).length * min;
    vis = weights.map((w, i) => (fixed[i] ? min : (w / sumFree) * rest));
    const low = vis.map((v, i) => (!fixed[i] && v < min - 1e-9 ? i : -1)).filter((i) => i >= 0);
    if (!low.length) break;
    low.forEach((i) => { fixed[i] = true; });
  }
  return vis;
}

// The ring cut into arcs, clockwise from 12 o'clock: concern, watch, good, strength, background. Each arc is a stroked path with round caps, so it looks
// `thickness` longer than its path; `gap` is the clear space between two neighbours, measured between the caps. A share too small to be a round dot is lifted to one.
// Returns { ...counts, keys, segs: [{ key, count, frac, a0, a1, len, start, vis }] } where a0/a1 are the path's angles, len its length in px,
// start the position (0..1 of the ring) where the segment begins to show and vis the length it shows.
export function donutLayout(counts, { r = 90, thickness = 26, gap = 4 } = {}) {
  const c = donutCounts(counts), keys = DONUT_KEYS.filter((k) => c[k] > 0), out = { ...c, keys, segs: [] };
  if (!c.total) return out;
  const circ = TAU * r;
  if (keys.length === 1) { out.segs.push({ key: keys[0], count: c[keys[0]], frac: 1, a0: 0, a1: FULL, len: r * FULL, start: 0, vis: circ }); return out; }
  const n = keys.length, avail = Math.max(1, circ - n * gap), vis = allot(keys.map((k) => c[k]), avail, Math.min(thickness, avail / n));
  let pos = gap / 2;
  keys.forEach((k, i) => {
    const mid = pos + vis[i] / 2, half = Math.max(0.25, (vis[i] - thickness) / 2);
    out.segs.push({ key: k, count: c[k], frac: c[k] / c.total, a0: (mid - half) / r, a1: (mid + half) / r, len: 2 * half, start: pos / circ, vis: vis[i] });
    pos += vis[i] + gap;
  });
  return out;
}

// the centre of the donut: the number to act on, and the words under it
export function donutCenter(lay, { centerValue, centerLabel } = {}) {
  if (!lay.total) return { value: null, label: centerLabel != null ? centerLabel : "אין מדדים שנשפטו", empty: true };
  const value = centerValue != null ? centerValue : lay.concern > 0 ? lay.concern : lay.judged;
  const label = centerLabel != null ? centerLabel : centerValue != null ? "" : lay.concern > 0 ? countLabel("concern", lay.concern) : "מדדים שנשפטו";
  return { value, label, empty: false };
}

export const countText = (n) => (n === 1 ? "מדד אחד" : `${num(n, 0)} מדדים`);
export function shareText(n, total) {
  if (!total) return "0%";
  const p = (n / total) * 100;
  return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}
export const segmentWord = (key, n) => (key === "background" ? DONUT_BG_WORD : countLabel(key, n));
export const segmentTitle = (key, n, total) => `${segmentWord(key, n)}: ${countText(n)} (${shareText(n, total)})`;
export function donutAria(lay) {
  if (!lay.total) return "אין מדדים שנשפטו";
  return `פילוח ${countText(lay.total)} לפי מצב: ${DONUT_KEYS.filter((k) => lay[k] > 0).map((k) => `${num(lay[k], 0)} ${segmentWord(k, lay[k])}`).join(", ")}`;
}
// how big the centre number can be: a share of the ring's width, smaller when the text is long so that it stays inside the hole
export const centerFont = (text, size, thickness) => Math.round(clamp(Math.min(size * 0.26, (size - 2 * thickness - 12) * 0.86 / (textEm(text) || 1)), 14, size * 0.26));

export function statusDonut({ counts, size = 220, thickness, centerValue, centerLabel, legend = true, onPick, ariaLabel } = {}) {
  const S = clamp(Math.round(+size || 220), 64, 800), t = isNum(thickness) && thickness > 0 ? clamp(thickness, 2, S * 0.3) : Math.round(S * 0.118), cx = S / 2, r = (S - t) / 2 - 2;
  const lay = donutLayout(counts, { r, thickness: t, gap: clamp(Math.round(S * 0.018), 3, 5) }), ctr = donutCenter(lay, { centerValue: shownOf(centerValue), centerLabel: typeof centerLabel === "string" ? centerLabel : undefined });
  const pickable = typeof onPick === "function";
  const root = h("div.v-ring.v-ring-donut"), fg = h("div.v-ring-fig", { style: { width: S + "px" } });
  const sv = svg("svg", { viewBox: `0 0 ${S} ${S}`, width: S, height: S, class: "v-ring-svg", style: `--sw:${t}px` });
  const colorOf = (k) => (k === "background" ? "var(--rbg)" : STATUS_COLOR[k]);

  const segG = new Map(), rows = new Map();
  const setHot = (k) => {
    root.classList.toggle("dim", !!k);
    segG.forEach((g, key) => g.classList.toggle("hot", key === k));
    rows.forEach((row, key) => row.classList.toggle("hot", key === k));
  };
  const tipFor = (s) => {
    const nodes = [tipHead(segmentTitle(s.key, s.count, lay.total))];
    if (s.key === "background") BG_PARTS.forEach((k) => { if (lay.parts[k] > 0) nodes.push(tipRow(STATUS_COLOR[k], STATUS_WORD[k], ltr(num(lay.parts[k], 0)))); });
    return nodes;
  };
  const activate = (el, key) => {
    if (!pickable) return;
    el.addEventListener("click", () => onPick(key));
    el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onPick(key); } });
  };

  if (!lay.total) sv.append(svg("circle", { cx, cy: cx, r, class: "v-ring-trk", fill: "none" }));
  lay.segs.forEach((s) => {
    const d = arcPath(cx, cx, r, s.a0, s.a1), title = segmentTitle(s.key, s.count, lay.total);
    const halo = svg("path", { d, class: "v-ring-halo", fill: "none", "stroke-linecap": "round" });
    const p = svg("path", {
      d, class: "v-ring-seg v-ring-arc sweep" + (pickable ? " is-btn" : ""), fill: "none", "stroke-linecap": "round", "data-k": s.key, tabindex: 0,
      role: pickable ? "button" : "img", "aria-label": title, style: `--len:${s.len.toFixed(2)};--i:${(s.start * 5).toFixed(2)};--c:${colorOf(s.key)}`
    });
    const g = svg("g", { class: "v-ring-seg-g", "data-k": s.key }, halo, p);
    segG.set(s.key, g);
    p.addEventListener("pointerenter", () => setHot(s.key));
    p.addEventListener("pointerleave", () => setHot(null));
    p.addEventListener("focus", () => { setHot(s.key); if (p.matches(":focus-visible")) halo.classList.add("on"); });
    p.addEventListener("blur", () => { setHot(null); halo.classList.remove("on"); });
    bindTip(p, () => tipFor(s));
    activate(p, s.key);
    sv.append(g);
  });

  // the centre: the number to act on (counts up), a caption under it
  const cText = ctr.value == null ? "" : typeof ctr.value === "number" ? num(ctr.value, Number.isInteger(ctr.value) ? 0 : 1) : String(ctr.value);
  const fs = centerFont(cText, S, t), k = (fs / S).toFixed(4), capK = clamp(S * (ctr.empty ? 0.07 : 0.062), 10.5, 16) / S;
  const numNode = ctr.value == null ? null : typeof ctr.value === "number" ? countTo(ctr.value, { dec: Number.isInteger(ctr.value) ? 0 : 1 }) : String(ctr.value);
  if (numNode && numNode.classList) numNode.classList.add("ltr");
  const centre = h("div.v-ring-center" + (ctr.empty ? ".is-empty" : ""),
    numNode ? h("span.v-ring-num", { style: `--k:${k};font-size:${fs}px;font-size:calc(${k} * 100cqw)` }, numNode) : null,
    ctr.label ? h("span.v-ring-cap", { style: `font-size:${(capK * S).toFixed(1)}px;font-size:max(10.5px, ${(capK * 100).toFixed(2)}cqw)` }, ctr.label) : null);
  fg.append(sv, centre);
  root.append(fg);

  if (legend && lay.total) {
    const ul = h("ul.v-ring-legend", { role: "list" });
    ["concern", "watch", "good", "strength", ...(lay.background ? ["background"] : [])].forEach((key) => {
      const n = lay[key], live = pickable && n > 0, word = key === "background" ? DONUT_BG_WORD : STATUS_WORD[key];
      const row = h((live ? "button" : "div") + ".v-ring-row" + (n ? "" : ".is-zero"), { "data-k": key, type: live ? "button" : null },
        h("i.v-ring-sw", { style: `--c:${colorOf(key)}` }), h("span.v-ring-w", word), h("b.v-ring-n.ltr", num(n, 0)));
      if (n) {
        rows.set(key, row);
        row.addEventListener("pointerenter", () => setHot(key));
        row.addEventListener("pointerleave", () => setHot(null));
        row.addEventListener("focus", () => setHot(key));
        row.addEventListener("blur", () => setHot(null));
      }
      if (live) row.addEventListener("click", () => onPick(key));
      ul.append(h("li", row));
    });
    root.append(ul);
  }
  return viz(root, { label: str(ariaLabel) || donutAria(lay), role: "group" });
}

/* ════════════════════════════ the progress ring ════════════════════════════ */

export const ringFraction = (value, max = 100) => (isNum(value) ? clamp(value / (isNum(max) && max > 0 ? max : 100), 0, 1) : 0);

// a small ring with the figure in its centre; the priority score on a recommendation card or a list row
export function progressRing({ value, max = 100, size = 72, thickness, tone = "good", label, display, i = 0 } = {}) {
  label = str(label);
  const S = clamp(Math.round(+size || 72), 24, 400), t = isNum(thickness) && thickness > 0 ? clamp(thickness, 2, S * 0.4) : Math.max(3, Math.round(S * 0.111));
  const r = (S - t) / 2, c = S / 2, frac = ringFraction(value, max), shown = shownOf(display) !== undefined ? display : isNum(value) ? value : null;
  const sv = svg("svg", { viewBox: `0 0 ${S} ${S}`, width: S, height: S, "aria-hidden": "true", style: `--sw:${t}px` }, svg("circle", { cx: c, cy: c, r, class: "v-ring-trk", fill: "none" }));
  if (frac > 0) {
    const a1 = frac >= 1 ? FULL : frac * TAU;
    sv.append(svg("path", { d: arcPath(c, c, r, 0, a1), class: "v-ring-pval v-ring-arc sweep", fill: "none", "stroke-linecap": "round", style: `--len:${(r * a1).toFixed(2)};--i:${clamp(+i || 0, 0, 12)}` }));
  }
  const text = shown == null ? "—" : typeof shown === "number" ? num(shown, Number.isInteger(shown) ? 0 : 1) : String(shown);
  const fs = clamp(Math.min(S * 0.34, (S - 2 * t - 4) * 0.9 / (textEm(text) || 1)), 9, S * 0.34), k = (fs / S).toFixed(4);
  const numNode = typeof shown === "number" ? countTo(shown, { dec: Number.isInteger(shown) ? 0 : 1 }) : text;
  if (numNode && numNode.classList) numNode.classList.add("ltr");
  const centre = h("span.v-ring-center", h("span.v-ring-num", { style: `font-size:${fs.toFixed(1)}px;font-size:calc(${k} * 100cqw)` }, numNode));
  const root = h("div.v-ring.v-ring-prog", { style: `--tone:${toneColor(tone)}` }, h("span.v-ring-fig", { style: { width: S + "px" } }, sv, centre), label ? h("span.v-ring-plabel", label) : null);
  return viz(root, { label: `${label ? label + ": " : ""}${text} מתוך ${num(isNum(max) && max > 0 ? max : 100, 0)}` });
}

/* ════════════════════════════════ the gauge ════════════════════════════════ */

// the scale: what the page gave, else 0..100 for a percentage, else a round number above everything that has to fit
export function gaugeScale({ value, min = 0, max, unit, nat, target } = {}) {
  const lo = isNum(min) ? min : 0, known = [value, nat, target].filter(isNum);
  let hi = isNum(max) ? max : null;
  if (hi == null) {
    if (unit === "%" && known.every((v) => v <= 100)) hi = 100;
    else { const top = Math.max(lo, ...known), t = niceTicks(lo, top > lo ? top * 1.15 : lo + 1, 4); hi = t[t.length - 1]; }
  }
  if (!(hi > lo)) hi = lo + 1;
  return { min: lo, max: hi };
}
// the dial is the top half of a circle: angles run from -90deg (9 o'clock, the minimum) over 12 o'clock to +90deg (3 o'clock, the maximum)
export const gaugeFraction = (v, min, max) => (isNum(v) ? clamp((v - min) / (max - min || 1), 0, 1) : 0);
export const gaugeAngle = (v, min, max) => -HALF + Math.PI * gaugeFraction(v, min, max);
export const gaugeOutside = (v, min, max) => (!isNum(v) ? 0 : v < min ? -1 : v > max ? 1 : 0);
// `size` is the diameter of the dial; the drawing is wider (a gutter each side) so that a label next to either end of the arc stays inside it
export function gaugeGeometry(size = 240, top = 48) {
  const D = clamp(Math.round(+size || 240), 120, 600), tk = clamp(Math.round(D * 0.085), 10, 30), rOut = D / 2, gutter = Math.max(42, Math.round(D * 0.14)), T = clamp(Math.round(top), 8, 120);
  const W = D + 2 * gutter, cy = T + rOut;
  return { D, tk, rOut, R: rOut - tk / 2, rIn: rOut - tk, gutter, T, W, H: cy + tk / 2 + 26, cx: W / 2, cy };
}
// the biggest number that fits under the arch: its corners must stay inside the inner circle (lift = how far the baseline sits above the dial's centre line)
export function gaugeValueFont(em, rIn, maxFont, lift = 24) {
  let f = maxFont;
  for (; f > 14; f -= 1) if (Math.hypot((em * f) / 2, lift + f * 0.72) <= rIn - 8) break;
  return f;
}

// the part of a rectangle that is nearest the dial's centre must stay clear of the arc
export function boxClear(x0, y0, w, hh, cx, cy, minDist) {
  const dx = Math.max(x0 - cx, 0, cx - (x0 + w)), dy = Math.max(y0 - cy, 0, cy - (y0 + hh));
  return Math.hypot(dx, dy) >= minDist;
}
const boxesTouch = (a, b, pad) => a.x0 < b.x0 + b.w + pad && b.x0 < a.x0 + a.w + pad && a.y0 < b.y0 + b.h + pad && b.y0 < a.y0 + a.h + pad;
// Labels for the marks outside the arc (the national mean, the target). Each starts above the end of its tick and is moved the least distance (sideways or up)
// that keeps it inside the drawing, clear of the arc and of the other labels. items = [{ key, a (angle), w (width) }].
// Returns, in the same order, { key, a, box: { x0, y0, w, h }, tick: [x1, y1, x2, y2], lead: [x1, y1, x2, y2] | null }.
export function placeCallouts(items, geo, { boxH = 26, lead = 10, gap = 3, clearance = 4, margin = 2, pad = 3 } = {}) {
  const { cx, cy, rOut, W } = geo, tipR = rOut + 3 + lead, out = new Array(items.length), placed = [];
  const order = items.map((it, i) => ({ it, i })).sort((p, q) => Math.abs(q.it.a) - Math.abs(p.it.a));        // the mark nearest an end has the least room: it goes first
  for (const { it, i } of order) {
    const w = it.w, [ax, ay] = polar(cx, cy, tipR + gap, it.a), ideal = clamp(ax - w / 2, margin, Math.max(margin, W - margin - w));
    let best = null;
    for (let lift = 0; lift <= 170; lift++) {
      const y0 = ay - lift - boxH;
      if (y0 < 1 || (best && lift * 1.25 >= best.cost)) break;
      for (let sx = 0; sx <= W; sx++) {
        if (best && Math.hypot(sx, lift * 1.25) >= best.cost) break;
        for (const dir of sx ? [-1, 1] : [1]) {
          const x0 = ideal + dir * sx, box = { x0, y0, w, h: boxH };
          if (x0 < margin || x0 + w > W - margin || !boxClear(x0, y0, w, boxH, cx, cy, rOut + clearance) || placed.some((q) => boxesTouch(box, q, pad))) continue;
          const cost = Math.hypot(sx, lift * 1.25);
          if (!best || cost < best.cost) best = { ...box, cost };
        }
      }
    }
    const box = best ? { x0: best.x0, y0: best.y0, w, h: boxH } : { x0: ideal, y0: Math.max(1, ay - boxH), w, h: boxH };
    placed.push(box);
    const [x1, y1] = polar(cx, cy, rOut + 3, it.a), [x2, y2] = polar(cx, cy, tipR, it.a), lx = clamp(x2, box.x0 + 3, box.x0 + w - 3), ly = box.y0 + boxH + 1;
    out[i] = { key: it.key, a: it.a, box, tick: [x1, y1, x2, y2], lead: Math.hypot(lx - x2, ly - y2) > 2.5 ? [x2, y2, lx, ly] : null };
  }
  return out;
}
export const calloutWidth = (word, valueText) => Math.ceil(Math.max(textEm(word) * 11, textEm(valueText) * 12 * 1.06) + 6);

// how far a figure is from its target, in words (null when either is missing)
export function targetPhrase({ unit, direction, value, target }) {
  if (!isNum(value) || !isNum(target)) return null;
  const gap = value - target;
  if (Math.abs(gap) < 1e-9) return "בדיוק ביעד";
  const amt = unit === "%" ? pts(gap) : num(Math.abs(gap), figDec(unit, gap)) + deltaUnit(unit);
  if (direction === "higher" || direction === "lower") return (direction === "lower" ? gap < 0 : gap > 0) ? "עומד ביעד" : direction === "lower" ? `חורג מהיעד ב-${amt}` : `חסרות ${amt} ליעד`;
  return gap > 0 ? `מעל היעד ב-${amt}` : `מתחת ליעד ב-${amt}`;
}
export function gaugeAria({ label, unit, value, nat, target, min, max, direction }) {
  const parts = [`${label ? label + ": " : ""}${fmtFig(unit, value)}`];
  if (isNum(nat)) parts.push(`הממוצע הארצי ${fmtFig(unit, nat)}`);
  if (isNum(target)) parts.push(`היעד ${fmtFig(unit, target)}`);
  parts.push(`בסקאלה מ-${fmtFig(unit, min)} עד ${fmtFig(unit, max)}`);
  if (direction === "lower") parts.push("ערך נמוך יותר טוב יותר");
  return isNum(value) ? parts.join(", ") : `${label ? label + ": " : ""}אין נתון`;
}

export function gauge({ value, min = 0, max, unit, nat, target, direction, tone, size = 240, label } = {}) {
  label = str(label); unit = typeof unit === "string" ? unit : undefined;
  const v = isNum(value) ? value : null, nv = isNum(nat) ? nat : null, tv = isNum(target) ? target : null;
  const sc = gaugeScale({ value: v, min, max, unit, nat: nv, target: tv }), g = gaugeGeometry(size, nv != null || tv != null ? 48 : 16), tn = deriveTone({ value: v, nat: nv, target: tv, direction, tone }), col = toneColor(tn);
  const ang = (x) => gaugeAngle(x, sc.min, sc.max), sv = svg("svg", { viewBox: `0 0 ${g.W} ${g.H}`, width: g.W, height: g.H, "aria-hidden": "true", style: `--sw:${g.tk}px` });
  sv.append(svg("path", { d: arcPath(g.cx, g.cy, g.R, -HALF, HALF), class: "v-ring-gtrack", fill: "none", "stroke-linecap": "round" }));
  if (v != null) {
    const av = ang(v), len = g.R * (av + HALF), [kx, ky] = polar(g.cx, g.cy, g.R, av);
    if (len > 0.5) sv.append(svg("path", { d: arcPath(g.cx, g.cy, g.R, -HALF, av), class: "v-ring-gval v-ring-arc sweep", fill: "none", "stroke-linecap": "round", style: `--len:${len.toFixed(2)}` }));
    sv.append(svg("circle", { cx: kx.toFixed(2), cy: ky.toFixed(2), r: g.tk / 2 + 1, class: "v-ring-knob pop", style: "--i:8" }));
  }
  // the national mean and the target: a tick just outside the arc and a small label beyond it
  const marks = [];
  if (nv != null) marks.push({ key: "nat", word: "ארצי", value: nv });
  if (tv != null) marks.push({ key: "target", word: "יעד", value: tv });
  const items = marks.map((m) => ({ ...m, a: ang(m.value), text: fmtFig(unit, m.value) }));
  items.forEach((m) => { m.w = calloutWidth(m.word, m.text); });
  placeCallouts(items, g).forEach((p, idx) => {
    const m = items[idx], b = p.box, mx = b.x0 + b.w / 2, grp = svg("g", { class: "v-ring-mark fade", style: `--i:${idx + 2}` });
    if (p.lead) grp.append(svg("line", { x1: p.lead[0].toFixed(1), y1: p.lead[1].toFixed(1), x2: p.lead[2].toFixed(1), y2: p.lead[3].toFixed(1), class: "v-ring-lead" }));
    grp.append(svg("line", { x1: p.tick[0].toFixed(1), y1: p.tick[1].toFixed(1), x2: p.tick[2].toFixed(1), y2: p.tick[3].toFixed(1), class: `v-ring-tick k-${m.key}`, "stroke-linecap": "round" }),
      svg("text", { x: mx.toFixed(1), y: (b.y0 + 10).toFixed(1), "text-anchor": "middle", class: "v-ring-tl" }, m.word),
      svg("text", { x: mx.toFixed(1), y: (b.y0 + 23).toFixed(1), "text-anchor": "middle", class: "v-ring-tv" }, m.text));
    sv.append(grp);
  });
  const ends = svg("g", { class: "fade", style: "--i:1" }, svg("text", { x: g.cx - g.R, y: g.cy + g.tk / 2 + 15, "text-anchor": "middle" }, fmtFig(unit, sc.min)), svg("text", { x: g.cx + g.R, y: g.cy + g.tk / 2 + 15, "text-anchor": "middle" }, fmtFig(unit, sc.max)));
  sv.append(ends);

  // the value under the arch: big, counts up; the unit as a small word under it (a percentage keeps its sign beside the number)
  const numTxt = figText(unit, v), em = textEm(numTxt) + (unit === "%" ? 0.45 : 0), f = gaugeValueFont(em, g.rIn, Math.round(g.D * 0.23)), k = (f / g.W).toFixed(4);
  const word = unit === "%" ? "" : unitSuffix(unit), uk = (11.5 / g.W).toFixed(4), numNode = v == null ? "—" : countTo(v, { dec: figDec(unit, v) });
  if (numNode.classList) numNode.classList.add("ltr");
  const centre = h("div.v-ring-gc", { style: `bottom:${(((g.H - g.cy + 4) / g.H) * 100).toFixed(2)}%` },
    h("div.v-ring-gnum", { style: `font-size:${f}px;font-size:calc(${k} * 100cqw)` }, numNode, v != null && unit === "%" ? h("span.v-ring-gpct", "%") : null),
    word ? h("div.v-ring-gunit", { style: `font-size:11.5px;font-size:max(10.5px, calc(${uk} * 100cqw))` }, word) : null);
  const root = h("div.v-ring.v-ring-gauge", { tabindex: 0, style: `--tone:${col}` }, h("div.v-ring-fig", { style: { width: g.W + "px" } }, sv, centre), label ? h("div.v-ring-glabel", label) : null);

  bindTip(root, () => {
    const rows = [tipHead(label || "המדד")];
    if (v == null) return [...rows, h("div.v-ring-tipnote", "אין נתון")];
    rows.push(tipRow(C.city, "היישוב", ltr(fmtFig(unit, v))));
    if (nv != null) rows.push(tipRow(C.nat, "ממוצע ארצי", ltr(fmtFig(unit, nv))));
    if (tv != null) rows.push(tipRow(C.target, "יעד", ltr(fmtFig(unit, tv)), true));
    const cmp = nv != null ? compareLine({ unit, direction, gapNat: v - nv, nat: nv }) : null, tgt = targetPhrase({ unit, direction, value: v, target: tv });
    [cmp && cmp.text, tgt, gaugeOutside(v, sc.min, sc.max) ? "הערך מחוץ לסקאלה של הגרף" : null, direction === "lower" ? "ערך נמוך יותר טוב יותר" : null].filter(Boolean).forEach((txt) => rows.push(h("div.v-ring-tipnote", txt)));
    return rows;
  });
  return viz(root, { label: gaugeAria({ label, unit, value: v, nat: nv, target: tv, min: sc.min, max: sc.max, direction }) });
}

/* ═══════════════════════════ the standing meter ═══════════════════════════ */

// where a locality stands among all localities: level = the share (0..100) of localities it beats; rank and of give the same in words
export function meterModel({ level, rank, of } = {}) {
  const r = isNum(rank) && rank > 0 ? Math.round(rank) : null, n = isNum(of) && of > 0 ? Math.round(of) : null, ranked = r != null && n != null;
  const lv = isNum(level) ? clamp(level, 0, 100) : ranked ? clamp(((n - r) / n) * 100, 0, 100) : null;
  return { level: lv, rank: ranked ? r : null, of: ranked ? n : null, beats: lv == null ? null : Math.round(lv) };
}
export const meterText = (m) => (m.rank != null ? `מקום ${m.rank} מתוך ${m.of}` : m.beats != null ? `טוב מ-${m.beats}% מהיישובים` : "אין דירוג");
export const meterTone = (level) => (level == null ? null : level >= 66 ? "good" : level <= 34 ? "attn" : "none");

export function standingMeter({ level, rank, of, tone, label } = {}) {
  label = str(label);
  const m = meterModel({ level, rank, of }), tn = T4(tone) || meterTone(m.level), col = toneColor(tn);
  const rail = h("div.v-ring-rail"), bar = h("div.v-ring-bar" + (m.level == null ? ".is-empty" : ""));
  rail.append(bar);
  if (m.level != null) {
    const text = m.rank != null ? ["מקום ", ...outOf(m.rank, m.of)] : ["טוב מ-", ltr(m.beats + "%"), " מהיישובים"];
    rail.append(h("div.v-ring-bubble", h("span.v-ring-btext", text), h("i.v-ring-caret")), h("div.v-ring-pin", h("i.v-ring-ping.ping"), h("i.v-ring-dot")));
  } else rail.append(h("div.v-ring-bubble.is-muted", h("span.v-ring-btext", "אין דירוג")));
  const root = h("div.v-ring.v-ring-meter", {
    tabindex: 0, style: `--tone:${col};--soft:${T4(tn) ? TONE_SOFT[T4(tn)] : "var(--surface-2)"};--ink-t:${T4(tn) ? TONE_INK[T4(tn)] : "var(--ri)"};--p:${m.level == null ? 0 : m.level.toFixed(2)}%`
  }, label ? h("div.v-ring-mlabel", label) : null, h("div.v-ring-stage", rail, h("div.v-ring-ends", h("span", "החלשים בארץ"), h("span", "החזקים בארץ"))));
  bindTip(root, () => {
    const rows = [tipHead(label || "המקום בין היישובים")];
    if (m.rank != null) rows.push(tipRow(col, "מקום", ltr(`${m.rank} / ${m.of}`)));
    rows.push(h("div.v-ring-tipnote", m.beats != null ? `טוב יותר מ-${m.beats}% מהיישובים בארץ` : "אין דירוג"));
    return rows;
  });
  return viz(root, { label: `${label ? label + ": " : ""}${meterText(m)}${m.rank != null && m.beats != null ? `, טוב מ-${m.beats}% מהיישובים` : ""}` });
}

/* ═════════════════════════════════ the waffle ═════════════════════════════════ */

export function waffleLayout(size = 220) {
  const gap = clamp(Math.round(size * 0.0136), 2, 5), cell = (size - 9 * gap) / 10;
  return { size, gap, cell, step: cell + gap, rx: Math.max(2, cell * 0.26) };
}
// 100 cells in reading order: row by row from the top right (col 0 is the right-most cell of a row). kind: solid (the city's share), extra (solid, beyond the
// national share), gap (outline only: the national share the city does not reach), empty.
export function waffleCells({ value, nat } = {}) {
  const has = isNum(value), nCity = has ? Math.round(clamp(value, 0, 100)) : 0, nNat = isNum(nat) ? Math.round(clamp(nat, 0, 100)) : null, cells = [];
  const n = { solid: 0, extra: 0, gap: 0, empty: 0 };
  for (let k = 0; k < 100; k++) {
    let kind = "empty";
    if (k < nCity) kind = nNat != null && k >= nNat ? "extra" : "solid";
    else if (nNat != null && k < nNat) kind = "gap";
    n[kind]++;
    cells.push({ k, row: Math.floor(k / 10), col: k % 10, kind });
  }
  return { cells, has, nCity, nNat, n, rel: nNat == null || !has ? null : nCity > nNat ? "above" : nCity < nNat ? "below" : "same" };
}
const wfNum = (v) => (isNum(v) ? (v < 10 && !Number.isInteger(v) ? num(v, 1) : num(Math.round(v), 0)) : "—");
export function waffleCaption({ value, nat, noun }) {
  noun = str(noun);
  const w = waffleCells({ value, nat }), main = w.has ? `מתוך כל 100${noun ? " " + noun : ""}: ${wfNum(value)}` : "אין נתון";
  const word = { above: "מעל הממוצע הארצי", below: "מתחת לממוצע הארצי", same: "כמו הממוצע הארצי" }[w.rel];
  return { main, rel: w.rel, relWord: word || null, natText: w.nNat != null ? wfNum(nat) : null };
}

export function waffle({ value, nat, direction, tone, noun, size = 220, label } = {}) {
  noun = str(noun); label = str(label);
  const S = clamp(Math.round(+size || 220), 80, 600), v = isNum(value) ? value : null, nv = isNum(nat) ? nat : null;
  const lay = waffleLayout(S), w = waffleCells({ value: v, nat: nv }), cap = waffleCaption({ value: v, nat: nv, noun }), tn = deriveTone({ value: v, nat: nv, direction, tone }), col = toneColor(tn);
  const sv = svg("svg", { viewBox: `0 0 ${S} ${S}`, width: S, height: S, "aria-hidden": "true" });
  for (const c of w.cells) {
    const anim = c.kind === "solid" || c.kind === "extra" ? " pop" : c.kind === "gap" ? " fade" : "";
    sv.append(svg("rect", { x: ((9 - c.col) * lay.step).toFixed(2), y: (c.row * lay.step).toFixed(2), width: lay.cell.toFixed(2), height: lay.cell.toFixed(2), rx: lay.rx.toFixed(2), class: `v-ring-cell k-${c.kind}${anim}`, style: `--i:${c.row};--j:${c.col}` }));
  }
  const key = (cls, text) => h("span.v-ring-wkey", h("i.v-ring-wsw." + cls), text);
  const natLine = cap.relWord ? h("p.v-ring-wnat", key(cap.rel === "above" ? "k-extra" : cap.rel === "below" ? "k-gap" : "k-solid", cap.relWord), h("span", " · בארץ: ", ltr(cap.natText))) : null;
  const strong = tn ? TONE_INK[tn] : "color-mix(in srgb, var(--c-city) 68%, var(--ink))";
  const root = h("div.v-ring.v-ring-waffle", { tabindex: 0, style: `--wf:${col};--wf2:${strong}` }, label ? h("div.v-ring-wlabel", label) : null, h("div.v-ring-fig", { style: { width: S + "px" } }, sv),
    h("div.v-ring-wcap", h("p.v-ring-wmain", cap.main), natLine));
  bindTip(root, () => {
    const rows = [tipHead(`מתוך כל 100${noun ? " " + noun : ""}`)];
    if (v == null) return [...rows, h("div.v-ring-tipnote", "אין נתון")];
    rows.push(tipRow(col, "היישוב", ltr(wfNum(v))));
    if (nv != null) rows.push(tipRow(C.nat, "בארץ", ltr(wfNum(nv))));
    if (cap.relWord) rows.push(h("div.v-ring-tipnote", cap.relWord));
    return rows;
  });
  return viz(root, { label: `${label ? label + ": " : ""}${cap.main}${cap.natText != null ? `, בארץ: ${cap.natText}` : ""}` });
}
