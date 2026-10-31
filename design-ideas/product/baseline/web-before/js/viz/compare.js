// CityPulse V2 / chart family "compare" (CSS prefix .v-cmp-): diverging bars, dumbbell, lollipop rank, distribution.
// The contract is DESIGN_V3.md section 5.2. All geometry lives in exported pure functions (no DOM at import time, tested in
// tests/viz-compare.test.mjs); the four chart functions at the bottom only turn that geometry into elements.
//   divergingBars  HTML rows: label | bar from a centre axis | value.  right = better, left = worse
//   dumbbell       SVG rows on a shared (or per-row) axis, 2 to 5 points per row
//   lollipopRank   HTML list of neighbours: stem, dot, value, a dashed national line
//   distribution   SVG histogram of all localities with the city's pin, the national and target lines
import { h, svg, tip, tipHead, tipRow, num, fmtVal, icon, viz, fit, legendRow, uid, C, TONE, niceTicks, padExtent, clamp, spread, quantile } from "./core.js";
import { ltr, iso, deltaUnit } from "../ui.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
const sv = (o) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(";");       // custom properties only travel through the style attribute
const cap12 = (i) => Math.min(i, 12);                                            // an entrance is never staggered more than 12 marks deep
const f2 = (v) => Math.round(v * 100) / 100;
const hasHe = (s) => /[֐-׿]/.test(s);
const KEY_WORD = { city: "העיר", nat: "ארצי", peer: "יישובים דומים", sector: "מגזר", ses: "רמה חברתית-כלכלית", target: "יעד" };

// ───────────────────────────── pure helpers ─────────────────────────────

// a rough width of a text in px (Heebo-like), used by tests and as the fallback when the page cannot measure; the page measures for real
export function estWidth(text, px = 12, bold = false) {
  let w = 0;
  for (const ch of String(text ?? "")) {
    const c = ch.codePointAt(0);
    if ((c >= 0x2066 && c <= 0x2069) || c === 0x200e || c === 0x200f || c === 0x2060) continue;       // direction marks take no room
    if (ch === " " || ch === " ") w += 0.27;
    else if (c >= 0x30 && c <= 0x39) w += 0.6;
    else if (".,:;'׳״|!".includes(ch)) w += 0.3;
    else if ("-–−־+".includes(ch)) w += 0.52;
    else if (ch === "%") w += 0.88;
    else if (c >= 0x5d0 && c <= 0x5ea) w += "ויןרלזצךף".includes(ch) ? 0.4 : 0.6;
    else if (c < 0x80) w += c >= 65 && c <= 90 ? 0.68 : 0.56;
    else w += 0.62;
  }
  return w * px * (bold ? 1.07 : 1);
}

// cut a text to fit maxW (the longest prefix plus an ellipsis); measure(text) gives a width
export function fitText(text, maxW, measure = (t) => estWidth(t, 13, true)) {
  const s = String(text ?? "");
  if (!(maxW > 0)) return { text: "", cut: s.length > 0 };
  if (measure(s) <= maxW) return { text: s, cut: false };
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (measure(s.slice(0, mid).trimEnd() + "…") <= maxW) lo = mid; else hi = mid - 1; }
  return { text: s.slice(0, lo).trimEnd() + "…", cut: true };
}

// "+8.2 נק׳" -> ["+8.2", " נק׳"]: the number (with its sign) is the part that must be isolated from the Hebrew around it
export function splitNum(text) {
  const m = /^\s*([+\-−–]?\s?[₪$€]?\d[\d,]*(?:\.\d+)?%?)([\s\S]*)$/.exec(String(text ?? ""));
  return m ? [m[1].replace(/\s+/g, ""), m[2]] : [null, String(text ?? "")];
}
export const signed = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), d);
// the difference between two figures of one parameter, as a short text ("+5.3 נק׳", "−3 ימים")
export const diffText = (unit, v, d = 1) => signed(v, d) + deltaUnit(unit);
export const rtlText = (s) => (hasHe(String(s)) ? "⁧" + s + "⁩" : String(s ?? ""));      // an RTL isolate: Hebrew punctuation lands right inside an LTR svg
// numbers joined by a dash ("1–3", "2020-2024") swap places inside right-to-left text; an LTR isolate around each pair keeps them in order
export const fixRanges = (s) => String(s ?? "").replace(/\d[\d.,]*\s?[–-]\s?\d[\d.,]*%?/g, "⁦$&⁩");

// a column with rounded top corners (the base stays square)
export function roundTopPath(x, y, w, hgt, r = 5) {
  const rr = Math.max(0, Math.min(r, w / 2, hgt)), b = y + hgt, n = (v) => f2(v);
  if (rr < 0.5) return `M${n(x)} ${n(b)}V${n(y)}H${n(x + w)}V${n(b)}Z`;
  return `M${n(x)} ${n(b)}V${n(y + rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x + rr)} ${n(y)}H${n(x + w - rr)}A${n(rr)} ${n(rr)} 0 0 1 ${n(x + w)} ${n(y + rr)}V${n(b)}Z`;
}

// the nice bin width (1, 2, 2.5, 5 times a power of ten) that gives a bin count nearest to the target; minStep keeps integer data from aliasing
export function binStep(range, target = 20, minStep = 0) {
  if (!(range > 0)) return minStep || 1;
  const raw = range / Math.max(1, target), mag = 10 ** Math.floor(Math.log10(raw));
  let best = null;
  for (const m of [mag / 10, mag, mag * 10]) for (const k of [1, 2, 2.5, 5]) {
    const s = Math.round(k * m * 1e9) / 1e9;
    if (s < minStep - 1e-12) continue;
    const score = Math.abs(Math.log(range / s / target));
    if (!best || score < best.score) best = { s, score };
  }
  return best ? best.s : Math.max(minStep, raw);
}
export const binIndex = (v, e0, step, nb) => clamp(Math.floor((v - e0) / step + 1e-9), 0, nb - 1);
export function binCounts(vals, e0, e1, nb) {
  const step = (e1 - e0) / nb, counts = new Array(nb).fill(0);
  for (const v of vals) { if (v < e0 - 1e-9 || v > e1 + 1e-9) continue; counts[binIndex(v, e0, step, nb)]++; }
  return counts;
}

// a smooth density curve over the histogram, in "expected count per bin" so it shares the bars' scale (Gaussian kernel, Silverman bandwidth)
export function kdeCurve(vals, e0, e1, step, points = 80) {
  const n = vals.length;
  if (n < 2 || !(e1 > e0)) return [];
  const src = n > 4000 ? vals.filter((_, i) => i % Math.ceil(n / 4000) === 0) : vals, m = src.length;
  const mean = src.reduce((s, v) => s + v, 0) / m, sd = Math.sqrt(src.reduce((s, v) => s + (v - mean) ** 2, 0) / (m - 1));
  const iqr = quantile(src, 0.75) - quantile(src, 0.25);
  let bw = 0.9 * Math.min(sd > 0 ? sd : Infinity, iqr > 0 ? iqr / 1.34 : Infinity) * m ** -0.2;
  if (!(bw > 0) || !isFinite(bw)) bw = step;
  bw = clamp(bw, step * 0.7, step * 3);
  const norm = (1 / (bw * Math.sqrt(2 * Math.PI))) * step * (n / m), out = [];
  for (let k = 0; k <= points; k++) {
    const v = e0 + ((e1 - e0) * k) / points;
    let s = 0;
    for (const x of src) { const z = (v - x) / bw; if (z > -5 && z < 5) s += Math.exp(-0.5 * z * z); }
    out.push({ v, c: s * norm });
  }
  return out;
}

// value labels on one horizontal line: pushed apart with spread(); when they stay crowded only the two extremes keep a label (the rest live in the tooltip)
// items: [{ x, w, v, key }]; returns the same items plus lx (label centre), shift and hidden
export function placeLabels(items, { lo = 0, hi = Infinity, gap = 4, maxShift = 30 } = {}) {
  if (!items.length) return [];
  // spread() clamps to [lo, hi] after it has resolved the overlaps (and stops when nothing moved), so a label that the wall pushes back could end up on its
  // neighbour: the positions are clamped first, and spread runs again until it settles
  const run = (list) => {
    let cur = list.map((o) => ({ y: clamp(o.x, lo + o.w / 2, hi - o.w / 2), h: o.w }));
    for (let k = 0; k < 4; k++) cur = spread(cur, gap, lo, hi);
    return cur.map((m, j) => ({ ...list[j], lx: m.y, shift: Math.abs(m.y - list[j].x) }));
  };
  const all = run(items);
  if (items.length <= 2 || all.every((p) => p.shift <= maxShift)) return all.map((p) => ({ ...p, hidden: false }));
  let a = 0, b = 0;
  items.forEach((o, j) => { if (o.v < items[a].v) a = j; if (o.v > items[b].v) b = j; });
  const keep = a === b ? [a] : [a, b], kept = run(keep.map((j) => items[j]));
  return items.map((o, j) => { const at = keep.indexOf(j); return at < 0 ? { ...o, lx: o.x, shift: 0, hidden: true } : { ...kept[at], hidden: false }; });
}

// label chips along the top of the distribution: each chip keeps its anchor (the line it names) under its body, moves sideways to dodge the
// chips placed before it, and goes up a row when there is no room. chips: [{ id, anchor, w }] in priority order; returns the same order with cx and row
export function placeChips(chips, { width, gap = 6, rows = 3, inset = 6 } = {}) {
  const taken = Array.from({ length: rows }, () => []), out = [];
  for (const c of chips) {
    const half = c.w / 2, edge = (v) => Math.min(width - half, Math.max(half, v));
    const lo = Math.max(half, c.anchor - half + inset), hi = Math.min(width - half, c.anchor + half - inset);
    const range = lo <= hi ? [lo, hi] : [edge(c.anchor), edge(c.anchor)];
    let spot = null;
    for (let r = 0; r < rows && !spot; r++) {
      const cands = [clamp(c.anchor, range[0], range[1])];
      for (const [a, b] of taken[r]) cands.push(b + gap + half, a - gap - half);
      const ok = cands.filter((x) => x >= range[0] - 1e-6 && x <= range[1] + 1e-6 && taken[r].every(([a, b]) => x + half <= a - gap + 1e-6 || x - half >= b + gap - 1e-6))
        .sort((p, q) => Math.abs(p - c.anchor) - Math.abs(q - c.anchor));
      if (ok.length) spot = { cx: ok[0], row: r };
    }
    if (!spot) spot = { cx: clamp(c.anchor, range[0], range[1]), row: rows - 1, crowded: true };
    taken[spot.row].push([spot.cx - half, spot.cx + half]);
    out.push({ ...c, ...spot });
  }
  return out;
}

// ───────────────────────────── diverging bars: geometry ─────────────────────────────
// side: 1 = better (bar to the right), -1 = worse (to the left), 0 = no gap (a dot on the axis), null = no figure. frac = share of one half of the lane
export function divergingLayout(items, max) {
  const list = (items || []).filter(Boolean), gaps = list.map((it) => (finite(it.gap) ? it.gap : null));
  let m = finite(max) && max > 0 ? max : gaps.reduce((s, g) => (g == null ? s : Math.max(s, Math.abs(g))), 0);
  if (!(m > 0)) m = 1;
  const rows = list.map((it, i) => { const g = gaps[i]; return { i, gap: g, side: g == null ? null : g > 0 ? 1 : g < 0 ? -1 : 0, frac: g == null ? 0 : clamp(Math.abs(g) / m, 0, 1) }; });
  return { max: m, rows, better: rows.filter((r) => r.side === 1).length, worse: rows.filter((r) => r.side === -1).length, even: rows.filter((r) => r.side === 0).length, none: rows.filter((r) => r.side === null).length };
}

// ───────────────────────────── dumbbell: geometry ─────────────────────────────
export const DB = { rowH: 50, labelY: 14, valY: 30, dotY: 40, padX: 28, axisH: 26 };
const minSpanOf = (vals, unit) => { if (unit === "%") return 8; const m = vals.reduce((s, v) => s + Math.abs(v), 0) / (vals.length || 1); return m > 0 ? m * 0.12 : 1; };
const limitsOf = (unit, nonNeg) => [unit === "%" || nonNeg ? 0 : -Infinity, unit === "%" ? 100 : Infinity];
export const tickText = (unit, v) => (unit === "%" ? num(v, Math.abs(v % 1) > 1e-9 ? 1 : 0) + "%" : num(v, Math.abs(v % 1) > 1e-9 ? 1 : 0));

// rows: [{ label, href?, note?, direction?, points: [{ key, label, v, hollow? }] }]
// shared: one axis for every row (with ticks); otherwise each row gets its own, padded around its points. flip: lower values to the right ("lower is better")
export function dumbbellLayout({ rows, width, unit = "", shared = true, flip = false, fmt, textW = estWidth, rowH = DB.rowH }) {
  const f = fmt || ((v) => fmtVal(unit, v));
  const W = Math.max(120, width), x0 = DB.padX, x1 = Math.max(x0 + 40, W - DB.padX);
  const clean = (rows || []).filter(Boolean).map((r) => ({ ...r, pts: (r.points || []).filter((p) => p && finite(p.v)) }));
  const all = clean.flatMap((r) => r.pts.map((p) => p.v));
  const nonNeg = unit !== "index" && all.every((v) => v >= 0), [lmin, lmax] = limitsOf(unit, nonNeg);
  const mk = (dom, fl) => { const span = dom[1] - dom[0] || 1; return (v) => (fl ? x1 - ((v - dom[0]) / span) * (x1 - x0) : x0 + ((v - dom[0]) / span) * (x1 - x0)); };
  let sharedDom = null, tickVals = [];
  if (shared && all.length) {
    const [a, b] = padExtent(all, 0.14, { min: lmin, max: lmax, minSpan: minSpanOf(all, unit) });
    let t = niceTicks(a, b, 4).filter((v) => v >= lmin - 1e-9 && v <= lmax + 1e-9);
    if (t.length < 2) t = [a, b];
    sharedDom = [t[0], t[t.length - 1]]; tickVals = t;
  }
  const out = clean.map((r, i) => {
    const vals = r.pts.map((p) => p.v);
    // a row may carry its own unit (rows from different parameters, each on its own axis)
    const u = !shared && r.unit != null ? r.unit : unit, fr = u === unit ? f : (v) => fmtVal(u, v), [rmin, rmax] = u === unit ? [lmin, lmax] : limitsOf(u, vals.every((v) => v >= 0));
    const dom = shared ? sharedDom || [0, 1] : vals.length ? padExtent(vals, 0.6, { min: rmin, max: rmax, minSpan: minSpanOf(vals, u) }) : [0, 1];
    const X = mk(dom, shared ? flip : r.direction ? r.direction === "lower" : flip);
    const pts = r.pts.map((p) => ({ key: p.key || "other", label: p.label || "", v: p.v, hollow: !!p.hollow, x: X(p.v) }));
    const xs = pts.map((p) => p.x), conn = pts.length > 1 ? { x0: Math.min(...xs), x1: Math.max(...xs) } : null;
    const placed = placeLabels(pts.map((p, k) => ({ k, x: p.x, w: textW(fr(p.v), 12.5, true) + 2, v: p.v, key: p.key })), { lo: 2, hi: W - 2, gap: 4, maxShift: 32 });
    const labels = placed.map((p) => ({ k: p.k, key: p.key, x: p.lx, text: fr(p.v), hidden: p.hidden }));
    // the note shares the label's line; when the label would be cut to make room for it, the note goes to the tooltip instead
    const note = r.note ? String(r.note) : "", noteW = note ? textW(note, 11.5, false) + 16 : 0, lab = String(r.label ?? ""), meas = (t) => textW(t, 13, true);
    const withNote = note ? fitText(lab, W - 16 - noteW, meas) : null, showNote = !!note && !withNote.cut;
    const name = showNote ? withNote : fitText(lab, W - 16, meas);
    const aria = `${r.label ?? ""}: ` + (pts.length ? pts.map((p) => `${p.label || KEY_WORD[p.key] || ""} ${fr(p.v)}${p.hollow ? " (קבוצה קטנה)" : ""}`.trim()).join(", ") : "אין נתון");
    return { i, y: i * rowH, label: lab, labelText: name.text, cut: name.cut, note, showNote, href: r.href || null, pts, conn, labels, aria, unit: u, flip: shared ? flip : r.direction ? r.direction === "lower" : flip };
  });
  const showAxis = shared && tickVals.length > 1 && all.length > 0;
  const X = sharedDom ? mk(sharedDom, flip) : null;
  const ticks = showAxis ? tickVals.map((v) => ({ v, x: X(v), text: tickText(unit, v) })) : [];
  return { width: W, height: out.length * rowH + (showAxis ? DB.axisH : 0) + 2, rowH, x0, x1, rows: out, ticks, shared, dom: sharedDom, axisY: out.length * rowH };
}

// ───────────────────────────── lollipop rank: geometry ─────────────────────────────
// the stems share one scale; it starts at zero when the figures are spread wide, otherwise it opens just below the lowest so that neighbours can be told apart
export function lollipopLayout({ items, nat, unit = "" }) {
  const list = (items || []).filter(Boolean), vals = list.map((it) => it.v).filter(finite);
  const base = vals.concat(finite(nat) ? [nat] : []);
  if (!base.length) return { rows: list.map((it) => ({ it, f: null })), natF: null, lo: 0, hi: 1 };
  const mn = Math.min(...base), mx = Math.max(...base), span = mx - mn;
  const nonNeg = mn >= 0 && unit !== "index";
  let lo, hi;
  if (nonNeg && (mx === 0 || mn / mx < 0.35)) { lo = 0; hi = mx * 1.04 || 1; }
  else {
    const s = span > 0 ? span : Math.max(Math.abs(mx) * 0.05, unit === "%" ? 2 : 0.5);
    lo = mn - s * 0.6 - (span > 0 ? 0 : s * 0.4); hi = mx + s * 0.12 + (span > 0 ? 0 : s * 0.4);
    if (nonNeg) lo = Math.max(0, lo);
    if (unit === "%") hi = Math.min(100, hi);
  }
  if (!(hi > lo)) hi = lo + 1;
  const F = (v) => (finite(v) ? clamp((v - lo) / (hi - lo), 0, 1) : null);
  return { rows: list.map((it) => ({ it, f: F(it.v) })), natF: F(nat), lo, hi };
}

// ───────────────────────────── distribution: geometry ─────────────────────────────
export const DIST = { chipH: 20, chipPad: 9, rowGap: 3, axisH: 24, mx: 14, pinZone: 42 };
export const fmtRange = (unit, a, b) => `${tickText(unit === "%" ? "" : unit, a)}–${tickText(unit, b)}`;

export function distributionLayout(o) {
  const { values, city, nat, target, p25, p75, unit = "", direction = null, items, width, height = 190, textW = estWidth, fmt, selfLabel = "העיר" } = o;
  const f = fmt || ((v) => fmtVal(unit, v));
  const vals = (values || []).filter(finite).sort((a, b) => a - b), n = vals.length;
  const mark = { city: finite(city) ? city : null, nat: finite(nat) ? nat : null, target: finite(target) ? target : null };
  if (!n && mark.city == null) return { empty: true, n: 0 };
  const W = Math.max(160, width), plotW = W - 2 * DIST.mx;
  // 1. the value range: the data, widened for a marker that sits near it; a marker far outside stays at the edge with an arrow
  let lo = n ? vals[0] : mark.city - 1, hi = n ? vals[n - 1] : mark.city + 1;
  if (!(hi > lo)) { const pad = Math.max(Math.abs(lo) * 0.1, unit === "%" ? 5 : 1); lo -= pad; hi += pad; }
  const span0 = hi - lo;
  for (const k of ["city", "nat", "target"]) {
    const m = mark[k];
    if (m == null) continue;
    if (m < lo && lo - m <= span0 * 0.4) lo = m - span0 * 0.02;
    else if (m > hi && m - hi <= span0 * 0.4) hi = m + span0 * 0.02;
  }
  const nonNeg = unit !== "index" && vals.every((v) => v >= 0);
  if (unit === "%") { lo = Math.max(0, lo); hi = Math.min(100, hi); } else if (nonNeg) lo = Math.max(0, lo);
  if (!(hi > lo)) hi = lo + 1;
  // 2. nice bins
  const want = Math.min(clamp(Math.round(plotW / 24), 8, 40), Math.max(6, Math.round(2 * Math.sqrt(Math.max(n, 1))) + 2));
  const step = binStep(hi - lo, want, n && vals.every(Number.isInteger) ? 1 : 0);
  let e0 = Math.floor(lo / step + 1e-9) * step, e1 = Math.ceil(hi / step - 1e-9) * step;
  if (unit === "%") { e0 = Math.max(0, e0); e1 = Math.min(100, e1); }
  if (!(e1 > e0)) e1 = e0 + step;
  const nb = Math.max(1, Math.round((e1 - e0) / step));
  e1 = e0 + nb * step;
  const counts = binCounts(vals, e0, e1, nb), flip = direction === "lower";
  const X = (v) => DIST.mx + (flip ? 1 - (v - e0) / (e1 - e0) : (v - e0) / (e1 - e0)) * plotW;
  // a marker outside the final range sits at the edge it lies beyond, with an arrow ("off": -1 below the range, 1 above it)
  const off = {};
  for (const k of ["city", "nat", "target"]) if (mark[k] != null) { if (mark[k] < e0 - 1e-9) off[k] = -1; else if (mark[k] > e1 + 1e-9) off[k] = 1; }
  const markX = (k) => (mark[k] == null ? null : off[k] ? (off[k] < 0 ? X(e0) : X(e1)) : X(mark[k]));
  const screenSide = (k) => (off[k] ? (X(e0) < X(e1) ? off[k] : -off[k]) : 0);       // which way the real value lies on screen (-1 left, 1 right)
  const arrowed = (k, text) => ((screenSide(k) < 0 ? "‹ " : "") + text + (screenSide(k) > 0 ? " ›" : ""));
  // 3. the chips along the top: the national and target lines, stacked in rows when they crowd each other
  const chipsIn = [];
  if (mark.nat != null) chipsIn.push({ id: "nat", text: arrowed("nat", `ארצי ${f(mark.nat)}`), anchor: markX("nat") });
  if (mark.target != null) chipsIn.push({ id: "target", text: arrowed("target", `יעד ${f(mark.target)}`), anchor: markX("target") });
  const refChips = placeChips(chipsIn.map((c) => ({ ...c, w: textW(c.text, 12, true) + 2 * DIST.chipPad })), { width: W, gap: 6, rows: 3 });
  const bandRows = refChips.length ? Math.max(...refChips.map((c) => c.row)) + 1 : 0, bandH = bandRows * (DIST.chipH + DIST.rowGap);
  refChips.forEach((c) => { c.y = (bandRows - 1 - c.row) * (DIST.chipH + DIST.rowGap) + 1; });
  // 4. vertical room: chips, a zone above the bars for the city's pin, the bars, the axis. The pin and its chip sit just above the city's bar,
  //    so the zone is kept as small as the bars around the chip allow (the full zone always fits)
  const hasPin = mark.city != null, cityBin = hasPin && !off.city ? binIndex(mark.city, e0, step, nb) : -1;
  const pinText = hasPin ? arrowed("city", f(mark.city)) : "", pinW = hasPin ? textW(pinText, 12, true) + 2 * DIST.chipPad : 0;
  const curve = kdeCurve(vals, e0, e1, step, clamp(Math.round(plotW / 5), 40, 160));
  const ymax = Math.max(1, ...counts, ...curve.map((p) => p.c));
  const build = (zone) => {
    const barsTop = bandH + zone, baseline = Math.max(Math.max(120, height) - DIST.axisH, barsTop + 52);
    const Y = (c) => baseline - (c / ymax) * (baseline - barsTop);
    const bars = counts.map((c, i) => {
      const v0 = e0 + i * step, v1 = v0 + step, xa = X(v0), xb = X(v1), left = Math.min(xa, xb), w = Math.abs(xb - xa);
      const bw = Math.max(2, w - 2), hgt = c ? Math.max(3, baseline - Y(c)) : 0;
      return { i, v0, v1, count: c, left, w, bx: left + (w - bw) / 2, bw, y: baseline - hgt, h: hgt, isCity: i === cityBin, mid: (v0 + v1) / 2 };
    });
    let pin = null, fits = true;
    if (hasPin) {
      // the pin sits just above the city's bar; its chip sits just above the pin, or higher when a taller bar is in the way (a stem then joins them)
      const cx = markX("city"), onBar = cityBin >= 0, by = onBar ? bars[cityBin].y : barsTop, cy = by - 10;
      const cw = placeChips([{ id: "city", anchor: cx, w: pinW }], { width: W, rows: 1 })[0], x0c = cw.cx - pinW / 2 - 2, x1c = cw.cx + pinW / 2 + 2;
      const under = Math.min(by, ...bars.filter((b) => b.count && b.left + b.w >= x0c && b.left <= x1c).map((b) => b.y));
      const bottom = Math.min(cy - 9, under - 5), chip = { text: pinText, w: pinW, cx: cw.cx, y: bottom - DIST.chipH };
      pin = { x: cx, y: cy, by, stem: onBar, stemTop: bottom < cy - 9 ? bottom : cy, chip, off: screenSide("city"), v: mark.city };
      fits = chip.y >= bandH + 2;
    }
    return { barsTop, baseline, Y, bars, pin, fits };
  };
  let lay = null;
  for (const zone of hasPin ? [16, 26, 36, DIST.pinZone] : [10]) { lay = build(zone); if (lay.fits) break; }
  const { barsTop, baseline, Y, bars, pin } = lay, H = baseline + DIST.axisH;
  // the localities (name, value) that fall in each bin, nearest the middle first
  const named = (items || []).filter((it) => it && finite(it.v));
  const members = bars.map(() => []);
  named.forEach((it) => { if (it.v >= e0 - 1e-9 && it.v <= e1 + 1e-9) members[binIndex(it.v, e0, step, nb)].push(it); });
  bars.forEach((b, i) => { b.names = members[i].slice().sort((p, q) => Math.abs(p.v - b.mid) - Math.abs(q.v - b.mid)).slice(0, 3); b.more = Math.max(0, members[i].length - b.names.length); });
  // 5. the p25 to p75 band (computed from the values when they are not given)
  const q1 = finite(p25) ? p25 : n >= 4 ? quantile(vals, 0.25) : null, q3 = finite(p75) ? p75 : n >= 4 ? quantile(vals, 0.75) : null;
  const band = q1 != null && q3 != null && q3 > q1 ? { x: Math.min(X(clamp(q1, e0, e1)), X(clamp(q3, e0, e1))), w: Math.abs(X(clamp(q3, e0, e1)) - X(clamp(q1, e0, e1))), q1, q3 } : null;
  // 7. the axis
  let ticks = niceTicks(e0, e1, 5).filter((v) => v >= e0 - 1e-9 && v <= e1 + 1e-9).map((v) => ({ v, x: X(v), text: tickText(unit, v) }));
  ticks.forEach((t) => { t.w = textW(t.text, 11.5, false); });
  ticks.sort((a, b) => a.x - b.x);
  const kept = []; let right = -Infinity;
  for (const t of ticks) { if (t.x - t.w / 2 >= right + 8) { kept.push(t); right = t.x + t.w / 2; } }
  kept.forEach((t) => { t.anchor = t.x - t.w / 2 < 0 ? "start" : t.x + t.w / 2 > W ? "end" : "middle"; t.ax = t.anchor === "start" ? Math.max(0, t.x - t.w / 2) + 0 : t.anchor === "end" ? W : t.x; });
  return {
    n, W, H, unit, flip, e0, e1, step, nb, baseline, barsTop, ymax, X, markX, off, mark, bars, cityBin,
    curve: curve.map((p) => ({ x: X(p.v), y: Y(p.c) })), band, pin, refChips, bandH, ticks: kept,
    lines: ["nat", "target"].filter((k) => mark[k] != null).map((k) => ({ id: k, x: markX(k), v: mark[k], off: off[k] || 0, y1: (refChips.find((c) => c.id === k) || { y: 0 }).y + DIST.chipH })),
    selfLabel
  };
}

// ───────────────────────────── DOM helpers ─────────────────────────────
const hasDom = () => typeof document !== "undefined";
const emptyBox = (text) => h("div.v-cmp-empty", { role: "status" }, icon("info", 16), text);

// the tooltip on a mark: pointer (mouse), keyboard focus, and a tap on a touch screen that stays until the next tap elsewhere
let tapHook = false;
function markTip(el, build) {
  const at = (ev) => ({ clientX: ev.clientX, clientY: ev.clientY });
  el.addEventListener("pointermove", (ev) => { if (ev.pointerType !== "touch") tip.show(build(ev), ev); });
  el.addEventListener("pointerleave", (ev) => { if (ev.pointerType !== "touch") tip.hide(); });
  el.addEventListener("pointerdown", (ev) => { if (ev.pointerType === "touch") tip.show(build(ev), at(ev)); });
  el.addEventListener("focus", () => { const r = el.getBoundingClientRect(); tip.show(build({}), { clientX: r.left + r.width / 2, clientY: r.top }); });
  el.addEventListener("blur", () => tip.hide());
  el.addEventListener("keydown", (ev) => { if (ev.key === "Escape") tip.hide(); });
  el.setAttribute("data-cmp-tip", "");
  if (!tapHook && hasDom()) { tapHook = true; document.addEventListener("pointerdown", (ev) => { if (!(ev.target && ev.target.closest && ev.target.closest("[data-cmp-tip]"))) tip.hide(); }, true); }
  return el;
}
// the row under the pointer or the keyboard is the "hot" one: the rest of the chart dims
function hotRow(el, root) {
  const on = () => { root.classList.add("is-hot"); el.classList.add("on"); }, off = () => { root.classList.remove("is-hot"); el.classList.remove("on"); };
  el.addEventListener("pointerenter", on); el.addEventListener("pointerleave", off); el.addEventListener("focus", on); el.addEventListener("blur", off);
}
// real text widths: a hidden text element inside the (attached) svg, measured with the page's own font
function measurer(root) {
  const probe = svg("text", { x: -9999, y: -9999, class: "v-cmp-probe", "aria-hidden": "true" }), cache = new Map();
  root.append(probe);
  const fn = (txt, px = 12, bold = false) => {
    const k = `${px}|${bold ? 1 : 0}|${txt}`;
    if (cache.has(k)) return cache.get(k);
    probe.style.fontSize = px + "px"; probe.style.fontWeight = bold ? "700" : "500"; probe.textContent = txt;
    let w = 0;
    try { w = probe.getComputedTextLength(); } catch (e) { w = 0; }
    if (!(w > 0)) w = estWidth(txt, px, bold);
    cache.set(k, w);
    return w;
  };
  fn.done = () => probe.remove();
  return fn;
}
const valueNode = (text) => { const [n, rest] = splitNum(text); return n ? [ltr(n), rest] : [rest]; };
// "← חלש יותר   טוב יותר →" under a chart whose axis has a known direction (read right to left: the better end is on the right, so the DOM starts with it)
const dirHint = () => h("span.v-cmp-dir", { "aria-hidden": "true" }, h("span.is-better", icon("right", 12), "טוב יותר"), h("span.is-worse", "חלש יותר", icon("left", 12)));

// ───────────────────────────── 1. diverging bars ─────────────────────────────
function divergingSummary(list, L) {
  if (!list.length) return "אין פערים להצגה";
  const rows = list.map((it, i) => ({ it, r: L.rows[i] })).filter((x) => x.r.side != null);
  const best = rows.filter((x) => x.r.side > 0).reduce((m, x) => (!m || x.r.gap > m.r.gap ? x : m), null);
  const worst = rows.filter((x) => x.r.side < 0).reduce((m, x) => (!m || x.r.gap < m.r.gap ? x : m), null);
  const say = (x) => `${x.it.label} (${x.it.text ?? signed(x.r.gap)})`;
  return `${list.length} שורות: ${L.better} טובות יותר, ${L.worse} חלשות יותר` + (L.even ? `, ${L.even} ללא פער` : "") + "." + (best ? ` הפער הגדול לטובה: ${say(best)}.` : "") + (worst ? ` הפער הגדול לרעה: ${say(worst)}.` : "");
}

function divRow(it, r, i) {
  const tone = it.tone || (r.side > 0 ? "good" : r.side < 0 ? "attn" : "none");
  const text = it.text != null ? String(it.text) : r.gap == null ? "—" : signed(r.gap);
  const verdict = r.side > 0 ? "טוב יותר" : r.side < 0 ? "חלש יותר" : r.side === 0 ? "ללא פער" : "אין נתון";
  const bar = r.side == null ? null : h("span.v-cmp-grow.grow-x", { style: sv({ "--f": f2(r.frac), "--i": cap12(i), "--origin": r.side < 0 ? "100% 50%" : r.side > 0 ? "0 50%" : "50% 50%" }) }, h("i.v-cmp-bar"));
  const lane = h("span.v-cmp-lane", { "aria-hidden": "true" }, h("i.v-cmp-ax"), bar);
  const attrs = { class: "v-cmp-row", "data-tone": tone, "data-side": r.side == null ? "na" : r.side };
  const label = fixRanges(it.label), sub = it.sub ? fixRanges(it.sub) : null;
  const kids = [h("span.v-cmp-lab", h("b", label), sub ? h("small", sub) : null), h("span.sr", verdict), lane, h("span.v-cmp-val", valueNode(text))];
  const el = it.href ? h("a", { ...attrs, href: it.href }, kids) : h("div", { ...attrs, tabindex: "0" }, kids);
  return markTip(el, () => [tipHead(label), sub ? h("div.v-cmp-tipnote", sub) : null, tipRow(TONE[tone] || TONE.none, verdict, h("span", valueNode(text)))].filter(Boolean));
}

export function divergingBars({ items = [], max, ariaLabel, zeroLabel = "", betterLabel = "טוב יותר", worseLabel = "חלש יותר" } = {}) {
  const list = (items || []).filter(Boolean), L = divergingLayout(list, max);
  const root = h("div.v-cmp.v-cmp-div");
  viz(root, { label: ariaLabel || divergingSummary(list, L), role: "group" });
  if (!list.length) { root.append(emptyBox("אין פערים להצגה")); return root; }
  root.append(
    h("div.v-cmp-div-head.fade", { "aria-hidden": "true" },
      h("span.v-cmp-hd.is-better", icon("right", 12), betterLabel), h("span.v-cmp-hd.is-zero", zeroLabel), h("span.v-cmp-hd.is-worse", worseLabel, icon("left", 12))),
    h("ul.v-cmp-rows", list.map((it, i) => h("li", divRow(it, L.rows[i], i)))));
  return root;
}

// ───────────────────────────── 2. dumbbell ─────────────────────────────
const KEY_ORDER = ["city", "nat", "peer", "sector", "ses", "target"];
const keyColor = (k) => ({ city: C.city, nat: C.nat, peer: C.peer, target: C.target, sector: "var(--v-cmp-sector)", ses: "var(--v-cmp-ses)" }[k] || "var(--none-bar)");

function dbRow(r, L, defs, root, unit, idx) {
  const top = r.y, cy = top + DB.dotY, kids = [];
  if (idx > 0) kids.push(svg("path", { class: "v-cmp-db-sep", d: `M0 ${top + 0.5}H${L.width}` }));
  kids.push(svg("rect", { class: "v-cmp-db-bg", x: 0, y: top + 1, width: L.width, height: L.rowH - 2, rx: 10 }));
  kids.push(svg("text", { class: "v-cmp-db-name fade", style: sv({ "--i": cap12(idx) }), x: L.width - 8, y: top + DB.labelY, "text-anchor": "end" }, rtlText(fixRanges(r.labelText))));
  if (r.note && r.showNote) kids.push(svg("text", { class: "v-cmp-db-note fade", style: sv({ "--i": cap12(idx) }), x: 8, y: top + DB.labelY, "text-anchor": "start" }, rtlText(fixRanges(r.note))));
  kids.push(svg("rect", { class: "v-cmp-db-track", x: L.x0, y: cy - 2, width: L.x1 - L.x0, height: 4, rx: 2 }));
  if (!r.pts.length) kids.push(svg("text", { class: "v-cmp-db-none", x: (L.x0 + L.x1) / 2, y: cy + 4, "text-anchor": "middle" }, "אין נתון"));
  if (r.conn && r.conn.x1 - r.conn.x0 > 0.5) {
    const gid = uid("cmpg"), sorted = r.pts.slice().sort((a, b) => a.x - b.x), span = r.conn.x1 - r.conn.x0;
    defs.append(svg("linearGradient", { id: gid, x1: 0, y1: 0, x2: 1, y2: 0 }, ...sorted.map((p) => svg("stop", { offset: f2(Math.min(1, Math.max(0, (p.x - r.conn.x0) / span))), style: `stop-color:${keyColor(p.key)}` }))));
    const cityPt = r.pts.find((p) => p.key === "city"), fromLeft = !cityPt || cityPt.x >= (r.conn.x0 + r.conn.x1) / 2;
    kids.push(svg("rect", { class: "v-cmp-db-conn grow-x", x: r.conn.x0, y: cy - 3, width: r.conn.x1 - r.conn.x0, height: 6, rx: 3, fill: `url(#${gid})`, style: sv({ "--origin": fromLeft ? "0 50%" : "100% 50%", "--i": cap12(idx) }) }));
  }
  // the city is drawn last, so it is never hidden under another dot
  const order = r.pts.map((p, k) => ({ p, k })).sort((a, b) => (a.p.key === "city") - (b.p.key === "city"));
  order.forEach(({ p, k }) => {
    const col = keyColor(p.key), ring = p.hollow || p.key === "target";
    kids.push(svg("g", { class: "v-cmp-db-pt", "data-key": p.key },
      svg("circle", { class: "v-cmp-db-halo", cx: p.x, cy, r: 12, style: `fill:${col}` }),
      svg("g", { class: "pop", style: sv({ "--i": cap12(idx * 2 + k) }) },
        svg("circle", { class: "v-cmp-db-knock", cx: p.x, cy, r: 7.5 }),
        ring ? svg("circle", { class: "v-cmp-db-ring", cx: p.x, cy, r: 5, style: `stroke:${col}` }) : svg("circle", { class: "v-cmp-db-dot", cx: p.x, cy, r: 6, style: `fill:${col}` }))));
  });
  r.labels.forEach((l) => {
    if (l.hidden) return;
    kids.push(svg("text", { class: "v-cmp-db-val rise" + (l.key === "city" ? " is-city" : ""), style: sv({ "--i": cap12(idx) }), x: l.x, y: top + DB.valY, "text-anchor": "middle" }, l.text));
  });
  const attrs = { class: "v-cmp-db-row", "aria-label": r.aria };
  const el = r.href ? svg("a", { ...attrs, href: r.href }, ...kids) : svg("g", { ...attrs, role: "img", tabindex: "0" }, ...kids);
  hotRow(el, root);
  const small = r.pts.some((p) => p.hollow), two = r.pts.find((p) => p.key === "city"), ref = r.pts.find((p) => p.key === "nat");
  markTip(el, () => [
    tipHead(fixRanges(r.label)),
    ...r.pts.slice().sort((p, q) => KEY_ORDER.indexOf(p.key) - KEY_ORDER.indexOf(q.key)).map((p) => tipRow(keyColor(p.key), p.label || KEY_WORD[p.key] || "", ltr(fmtVal(r.unit, p.v)))),
    two && ref ? tipRow(null, "הפרש", h("span", valueNode(diffText(r.unit, two.v - ref.v)))) : null,
    small ? tipRow(null, "הערה", "קבוצה קטנה, לא נכללת בדירוג") : null,
    r.note ? h("div.v-cmp-tipnote", r.note) : null
  ].filter(Boolean));
  return el;
}

function dumbbellSummary(rows, unit) {
  if (!rows.length) return "אין נתונים להשוואה";
  const part = (r) => `${r.label}: ` + (r.points || []).filter((p) => p && finite(p.v)).map((p) => `${p.label || KEY_WORD[p.key] || ""} ${fmtVal(unit, p.v)}`.trim()).join(", ");
  const shown = rows.slice(0, 6).map(part).join("; ");
  return `השוואה בין ערכים, ${rows.length} שורות. ${shown}${rows.length > 6 ? `; ועוד ${rows.length - 6} שורות` : ""}.`;
}

export function dumbbell({ rows = [], unit = "", shared = true, direction = null, ariaLabel } = {}) {
  const data = (rows || []).filter(Boolean), flip = direction === "lower";
  const root = h("div.v-cmp.v-cmp-db");
  viz(root, { label: ariaLabel || dumbbellSummary(data, unit), role: "group" });
  if (!data.length) { root.append(emptyBox("אין נתונים להשוואה")); return root; }
  const plot = h("div.v-cmp-db-plot", { style: `min-height:${data.length * DB.rowH + (shared ? DB.axisH : 0)}px` });
  // one legend row under the chart: the kinds of point that appear in it
  const seen = new Map();
  data.forEach((r) => (r.points || []).forEach((p) => { if (p && finite(p.v) && !seen.has(p.key)) seen.set(p.key, p.label || KEY_WORD[p.key] || ""); }));
  const anyHollow = data.some((r) => (r.points || []).some((p) => p && finite(p.v) && p.hollow));
  const keys = KEY_ORDER.filter((k) => seen.has(k)).concat([...seen.keys()].filter((k) => !KEY_ORDER.includes(k)));
  const lg = legendRow([...keys.map((k) => ({ label: seen.get(k), color: keyColor(k) })), ...(anyHollow ? [{ label: "קבוצה קטנה", color: C.ink }] : [])]);
  lg.classList.add("v-cmp-legend");
  // the target (and the "small group" note) are rings, as they are on the chart
  [...lg.querySelectorAll("i")].forEach((el, k) => {
    if (!(k < keys.length ? keys[k] === "target" : true)) return;
    const col = el.style.background;
    el.classList.add("is-ring"); el.style.background = "transparent"; el.style.boxShadow = `inset 0 0 0 2px ${col}`;
  });
  if (direction === "lower" || direction === "higher") lg.append(dirHint());
  root.append(plot, lg);
  fit(plot, (w) => {
    const s = svg("svg", { class: "v-cmp-svg", width: w, height: 40, viewBox: `0 0 ${w} 40` });
    plot.replaceChildren(s);
    const m = measurer(s), L = dumbbellLayout({ rows: data, width: w, unit, shared, flip, textW: m });
    m.done();
    plot.style.minHeight = "";
    s.setAttribute("height", L.height); s.setAttribute("viewBox", `0 0 ${w} ${L.height}`);
    const defs = svg("defs"), g = svg("g");
    s.append(defs);
    if (L.ticks.length) {
      const ax = svg("g", { class: "v-cmp-db-axis fade" });
      L.ticks.forEach((t) => {
        ax.append(svg("path", { class: "v-cmp-db-grid", d: `M${f2(t.x)} 2V${L.axisY}` }), svg("text", { class: "v-cmp-db-tick", x: f2(t.x), y: L.axisY + 17, "text-anchor": "middle" }, t.text));
      });
      s.append(ax);
    }
    L.rows.forEach((r, i) => g.append(dbRow(r, L, defs, root, unit, i)));
    s.append(g);
  }, { min: 160 });
  return root;
}

// ───────────────────────────── 3. lollipop rank ─────────────────────────────
function lollipopSummary(list, unit, nat) {
  if (!list.length) return "אין יישובים להצגה";
  const f = (v) => fmtVal(unit, v), self = list.find((it) => it.self), first = list[0], last = list[list.length - 1];
  return `${list.length} יישובים בדירוג. ` + (self ? `${self.name}: ${self.rank != null ? "מקום " + self.rank + ", " : ""}${f(self.v)}. ` : "") + (finite(nat) ? `הממוצע הארצי ${f(nat)}. ` : "") + `ראשון ברשימה: ${first.name} ${f(first.v)}. אחרון: ${last.name} ${f(last.v)}.`;
}

function lolRow(it, r, i, o) {
  const { unit, nat, direction, selfLabel } = o, self = !!it.self, has = r.f != null;
  const vtext = has ? fmtVal(unit, it.v) : "—";
  const lane = h("span.v-cmp-ln", { "aria-hidden": "true" }, has ? [
    h("i.v-cmp-stem.grow-x", { style: sv({ "--f": f2(r.f), "--i": cap12(i) }) }),
    h("b.v-cmp-dot.pop" + (it.hollow ? ".is-hollow" : ""), { style: sv({ "--f": f2(r.f), "--i": cap12(i) }) })] : null);
  const kids = [
    h("span.v-cmp-rk", it.rank != null && !it.hollow ? String(it.rank) : ""),
    h("span.v-cmp-nm", h("span.t", fixRanges(it.name)), self ? h("em.v-cmp-badge", selfLabel) : null),
    lane, h("span.v-cmp-lv", has ? ltr(vtext) : "—")];
  const attrs = { class: "v-cmp-lrow" + (self ? " is-self" : "") + (it.hollow ? " is-hollow" : ""), ...(self ? { "aria-current": "true" } : {}) };
  const el = it.href ? h("a", { ...attrs, href: it.href }, kids) : h("div", { ...attrs, tabindex: "0" }, kids);
  const col = self ? C.city : "var(--v-cmp-dotc)";
  markTip(el, () => {
    const rows = [tipHead(it.name + (self ? ` (${selfLabel})` : ""))];
    if (it.rank != null && !it.hollow) rows.push(tipRow(null, "מקום", ltr(String(it.rank))));
    rows.push(tipRow(col, "ערך", ltr(vtext)));
    if (has && finite(nat)) {
      const d = it.v - nat, better = direction === "lower" ? d < 0 : d > 0;
      rows.push(tipRow(null, "מול הארצי", h("span", valueNode(diffText(unit, d)), direction && d !== 0 ? (better ? " · טוב יותר" : " · חלש יותר") : "")));
    }
    if (finite(it.d)) rows.push(tipRow(null, "גודל הקבוצה", ltr(num(it.d, 0))));
    if (it.hollow) rows.push(tipRow(null, "הערה", "קבוצה קטנה, לא מדורגת"));
    return rows;
  });
  return el;
}

export function lollipopRank({ items = [], unit = "", nat, direction = null, ariaLabel, selfLabel = "העיר" } = {}) {
  const list = (items || []).filter(Boolean), L = lollipopLayout({ items: list, nat, unit });
  const root = h("div.v-cmp.v-cmp-lol");
  viz(root, { label: ariaLabel || lollipopSummary(list, unit, nat), role: "group" });
  if (!list.length) { root.append(emptyBox("אין יישובים להצגה")); return root; }
  const hasNat = L.natF != null;
  if (hasNat) root.style.setProperty("--natf", f2(L.natF));
  const o = { unit, nat, direction, selfLabel };
  if (hasNat) root.append(h("div.v-cmp-lol-ov", { "aria-hidden": "true" }, h("span"), h("span"), h("span.v-cmp-ln", h("i.v-cmp-ref-line.fade"), h("span.v-cmp-ref-at", h("em.v-cmp-ref-tag.rise", "ארצי"))), h("span")));
  root.append(h("ul.v-cmp-lol-rows" + (hasNat ? ".has-ref" : ""), list.map((it, i) => h("li", lolRow(it, L.rows[i], i, o)))));
  return root;
}

// ───────────────────────────── 4. distribution ─────────────────────────────
function distributionSummary(L, unit) {
  if (L.empty) return "אין התפלגות להצגה";
  const f = (v) => fmtVal(unit, v), p = [`התפלגות של ${L.n} יישובים`];
  if (L.mark.city != null) p.push(`העיר ${f(L.mark.city)}`);
  if (L.mark.nat != null) p.push(`ממוצע ארצי ${f(L.mark.nat)}`);
  if (L.mark.target != null) p.push(`יעד ${f(L.mark.target)}`);
  if (L.band) p.push(`מחצית היישובים בין ${f(L.band.q1)} ל-${f(L.band.q3)}`);
  return p.join(". ") + ".";
}

function chipEl(c, cls, extra) {
  const g = svg("g", { class: "v-cmp-chip " + cls + " rise", style: sv({ "--i": 2 }), ...extra });
  g.append(svg("rect", { class: "v-cmp-chip-bg", x: f2(c.cx - c.w / 2), y: c.y, width: f2(c.w), height: DIST.chipH, rx: DIST.chipH / 2 }),
    svg("text", { class: "v-cmp-chip-t", x: f2(c.cx), y: c.y + DIST.chipH / 2 + 4.2, "text-anchor": "middle" }, rtlText(c.text)));
  return g;
}

function drawDistribution(plot, o, root) {
  const { w, unit, items, ariaWord } = o;
  const s = svg("svg", { class: "v-cmp-svg", width: w, height: 40, viewBox: `0 0 ${w} 40` });
  plot.replaceChildren(s);
  const m = measurer(s), L = distributionLayout({ ...o.args, width: w, textW: m });
  m.done();
  plot.style.minHeight = "";
  if (L.empty) { plot.replaceChildren(emptyBox("אין התפלגות להצגה")); return; }
  s.setAttribute("height", L.H); s.setAttribute("viewBox", `0 0 ${w} ${L.H}`);
  const f = (v) => fmtVal(unit, v);
  if (L.band) s.append(svg("rect", { class: "v-cmp-band fade", x: f2(L.band.x), y: L.barsTop - 6, width: f2(L.band.w), height: L.baseline - L.barsTop + 6, rx: 4 }));
  // axis
  const ax = svg("g", { class: "v-cmp-axis" });
  ax.append(svg("path", { class: "v-cmp-axis-line", d: `M${DIST.mx} ${L.baseline}H${w - DIST.mx}` }));
  L.ticks.forEach((t) => ax.append(svg("path", { class: "v-cmp-tick-mark", d: `M${f2(t.x)} ${L.baseline}v4` }), svg("text", { class: "v-cmp-tick-t", x: f2(t.ax), y: L.baseline + 17, "text-anchor": t.anchor }, t.text)));
  s.append(ax);
  // the bins: a focusable column each (one tab stop, the arrow keys walk along them)
  const bins = [], inner = svg("g");
  L.bars.slice().sort((a, b) => a.left - b.left).forEach((b, k, arr) => {
    const rng = iso(fmtRange(unit, b.v0, b.v1));
    const g = svg("g", { class: "v-cmp-bin" + (b.isCity ? " is-city" : ""), role: "img", tabindex: "-1", "aria-label": `${fmtRange(unit, b.v0, b.v1)}: ${b.count} ${ariaWord}` + (b.isCity ? ", כולל העיר" : "") },
      svg("rect", { class: "v-cmp-hit", x: f2(b.left), y: L.barsTop - 8, width: f2(b.w), height: L.baseline - L.barsTop + 8 }));
    if (b.count) g.append(svg("g", { class: "grow-y", style: sv({ "--i": Math.round((k / Math.max(1, arr.length - 1)) * 12) }) }, svg("path", { class: "v-cmp-col", d: roundTopPath(b.bx, b.y, b.bw, b.h, 5) })));
    markTip(g, () => [
      tipHead(rng),
      tipRow(b.isCity ? C.city : C.bin, "יישובים", ltr(String(b.count))),
      b.isCity && L.pin ? tipRow(C.city, o.selfLabel, ltr(f(L.pin.v))) : null,
      ...b.names.map((it) => tipRow(null, it.name, ltr(f(it.v)))),
      b.more ? h("div.v-cmp-tipnote", `ועוד ${b.more}`) : null
    ].filter(Boolean));
    hotRow(g, root);
    g.addEventListener("keydown", (ev) => {
      const j = ev.key === "ArrowLeft" ? k - 1 : ev.key === "ArrowRight" ? k + 1 : ev.key === "Home" ? 0 : ev.key === "End" ? arr.length - 1 : null;
      if (j == null) return;
      ev.preventDefault();
      const t = bins[clamp(j, 0, bins.length - 1)];
      bins.forEach((x) => x.setAttribute("tabindex", "-1")); t.setAttribute("tabindex", "0"); t.focus();
    });
    bins.push(g); inner.append(g);
  });
  const start = Math.max(0, bins.findIndex((_, k) => L.bars.slice().sort((a, b) => a.left - b.left)[k].isCity));
  bins[start].setAttribute("tabindex", "0");
  s.append(inner);
  // the density curve
  if (L.curve.length > 2) s.append(svg("path", { class: "v-cmp-curve draw", pathLength: 1000, style: "--len:1000;--i:2", d: "M" + L.curve.map((p) => `${f2(p.x)} ${f2(p.y)}`).join("L") }));
  // the national and target lines
  // the solid national line draws itself top to bottom; the dashed target line has its own dash pattern, so it fades in instead
  L.lines.forEach((ln) => s.append(svg("path", { class: "v-cmp-vline is-" + ln.id + (ln.id === "nat" ? " draw" : " fade"), pathLength: 1000, style: "--len:1000;--i:1", d: `M${f2(ln.x)} ${ln.y1}V${L.baseline}` })));
  // the city: a short stem, the pin, and the chip above it
  if (L.pin) {
    const p = L.pin;
    if (p.stem || p.stemTop < p.y) s.append(svg("path", { class: "v-cmp-pin-stem fade", d: `M${f2(p.x)} ${f2(p.stemTop)}V${f2(p.stem ? p.by : p.y)}` }));
    s.append(svg("g", { class: "v-cmp-pin pop", style: "--i:3" }, svg("circle", { class: "v-cmp-pin-knock", cx: f2(p.x), cy: f2(p.y), r: 8 }), svg("circle", { class: "v-cmp-pin-dot", cx: f2(p.x), cy: f2(p.y), r: 5.5 })));
  }
  const tips = { nat: (v) => [tipHead("ממוצע ארצי"), tipRow(C.nat, "ערך", ltr(f(v)))], target: (v) => [tipHead("יעד"), tipRow(C.target, "ערך", ltr(f(v)), true)] };
  L.refChips.forEach((c) => {
    const el = chipEl(c, "is-" + c.id, { tabindex: "0", role: "img", "aria-label": `${c.text}` });
    markTip(el, () => tips[c.id](L.mark[c.id]));
    s.append(el);
  });
  if (L.pin) {
    const c = chipEl({ ...L.pin.chip }, "is-city", { tabindex: "0", role: "img", "aria-label": `${o.selfLabel} ${f(L.pin.v)}` });
    markTip(c, () => [tipHead(o.selfLabel), tipRow(C.city, "ערך", ltr(f(L.pin.v)))]);
    s.append(c);
  }
}

export function distribution({ values = [], city, nat, target, p25, p75, unit = "", direction = null, items, height = 190, ariaLabel, selfLabel = "העיר" } = {}) {
  const args = { values, city, nat, target, p25, p75, unit, direction, items, height, selfLabel };
  const root = h("div.v-cmp.v-cmp-dist");
  // the layout at a nominal width gives the summary sentence and decides whether there is anything to draw
  const probe = distributionLayout({ ...args, width: 600 });
  viz(root, { label: ariaLabel || distributionSummary(probe, unit), role: "group" });
  if (probe.empty) { root.append(emptyBox("אין התפלגות להצגה")); return root; }
  const plot = h("div.v-cmp-dist-plot", { style: `min-height:${Math.max(120, height)}px` });
  const items2 = [{ label: selfLabel, color: C.city, sq: true }, { label: "יישובים אחרים", color: C.bin, sq: true }];
  if (probe.band) items2.push({ label: "מחצית היישובים באמצע", color: C.band, sq: true });
  const lg = legendRow(items2);
  lg.classList.add("v-cmp-legend", "v-cmp-foot");
  lg.append(h("span.v-cmp-note", probe.n === 1 ? "יישוב אחד" : `${num(probe.n, 0)} יישובים`));
  if (direction === "lower" || direction === "higher") lg.append(dirHint());
  root.append(plot, lg);
  fit(plot, (w) => drawDistribution(plot, { w, unit, items, selfLabel, ariaWord: "יישובים", args }, root), { min: 160 });
  return root;
}
