// viz/time.js: the charts over the years (DESIGN_V3.md 5.3).
//   lineChart(host, cfg)   columnChart(host, cfg)   sparkArea(points, nat, opts)   trajectory(opts)   smallMultiples(opts)
//
// Everything that is geometry (scales, ticks, label placement, gaps, paths) is a pure exported function, so tests can run it in node;
// the DOM is only touched inside the chart functions themselves. Colours are tokens (css/app.css), motion is the shared vocabulary
// (css/motion.css): draw, fade, pop, grow-y, rise, ping. The entrance state lives on the outer element (viz() in core.js), so a redraw
// after a resize never replays it. Time runs left to right inside every SVG, "better" is the page's business, not the chart's.
import { h, svg, tip, tipHead, tipRow, num, fmtVal, icon, viz, fit, countTo, bindTip, srTable, legendRow, uid, C, STATUS_WORD, toneOfStatus, niceTicks, linear, padExtent, spread, clamp, quantile } from "./core.js";
import { ltr, unitSuffix } from "../ui.js";

export { legendRow as lineLegend };

// the two events every Israeli series of yearly figures should carry (pass as cfg.events)
export const EVENTS_IL = [{ x: 2020, x2: 2021, label: "קורונה" }, { x: 2023, label: "המלחמה" }];

/* ═════════════════════════════ small pure helpers ═════════════════════════════ */

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const r1 = (v) => Math.round(v * 10) / 10;
const cap = (i, n = 12) => Math.min(Math.max(0, i | 0), n);
const sty = (o) => Object.entries(o).filter(([, v]) => v != null && v !== false).map(([k, v]) => k + ":" + v).join(";");
const anim = (i, len) => sty({ "--i": cap(i), "--len": len != null ? Math.ceil(len) + 2 : null });
const fmtX = (x) => (Number.isInteger(x) ? String(x) : num(x, 1));
const axisText = (unit, v) => (Math.abs(v) >= 1e6 ? num(v / 1e6, 1) + "M" : fmtVal(unit, v, 1));

// the width of a text in px. An estimate (the font is Heebo, digits are tabular), used to reserve room, never to draw.
export function textWidth(text, size = 11.5, weight = 500) {
  let w = 0;
  for (const ch of String(text == null ? "" : text)) {
    const c = ch.codePointAt(0);
    w += c >= 0x5d0 && c <= 0x5ea ? 0.56 : c >= 48 && c <= 57 ? 0.6 : ch === "." || ch === "," ? 0.3 : ch === "%" ? 0.86 : ch === " " ? 0.3 : ch === ":" || ch === "·" ? 0.32 : c >= 65 && c <= 90 ? 0.68 : ch === "−" || ch === "-" || ch === "+" ? 0.55 : 0.54;
  }
  return w * size * (weight >= 700 ? 1.07 : weight >= 600 ? 1.03 : 1);
}

// the first number in a display string such as "⁦66.1%⁩", "⁦46⁩ ימים", "⁦24⁩ ל-100,000" (direction marks are ignored; a hyphen glued to a Hebrew letter is a prefix, not a minus)
export function numberIn(text) {
  if (text == null) return null;
  const s = String(text).replace(/[⁦-⁩‎‏؜]/g, "");
  const m = /(^|[^֐-׿\w.])([-−]?)(\d[\d,]*(?:\.\d+)?)/.exec(s);
  if (!m) return null;
  const v = parseFloat(m[3].replace(/,/g, ""));
  return Number.isFinite(v) ? (m[2] ? -v : v) : null;
}

// clean {x, y, hollow} points: finite numbers only, one per x (the last wins), sorted by x
export function cleanPts(pts) {
  const m = new Map();
  for (const p of pts || []) if (p && isNum(p.x) && isNum(p.y)) m.set(p.x, { x: p.x, y: p.y, hollow: !!p.hollow });
  return [...m.values()].sort((a, b) => a.x - b.x);
}

// the usual distance between neighbouring x values (the lower median), 1 for a single value
export function typicalStep(xs) {
  const d = [];
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[i - 1]) d.push(xs[i] - xs[i - 1]);
  d.sort((a, b) => a - b);
  return d.length ? d[Math.floor((d.length - 1) / 2)] : 1;
}

// points (sorted by x) cut into runs wherever a year is missing, so that a gap breaks the line
export function splitRuns(points, step) {
  const runs = [];
  let cur = [];
  for (const p of points) {
    if (cur.length && step > 0 && p.x - cur[cur.length - 1].x > step * 1.5 + 1e-9) { runs.push(cur); cur = []; }
    cur.push(p);
  }
  if (cur.length) runs.push(cur);
  return runs;
}

// which x values get a label on a time axis: the last one always, then every m-th step going back, so that labels never touch
export function xTickValues(x0, x1, step, pxPerUnit, labelW, gap = 10) {
  if (!(x1 > x0)) return [x1];
  step = step > 0 ? step : 1;
  const need = (labelW + gap) / Math.max(pxPerUnit, 1e-6);
  const m = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500].find((k) => k * step >= need - 1e-9) || 1000;
  const out = [];
  for (let k = 0; k < 600; k++) { const x = Math.round((x1 - k * m * step) * 1e6) / 1e6; if (x < x0 - 1e-9) break; out.push(x); }
  return out.reverse();
}
// the same for n equal slots (columns): the indices that get a label
export function slotTicks(n, slot, labelW, gap = 8) {
  const need = (labelW + gap) / Math.max(slot, 1e-6), m = [1, 2, 3, 4, 5, 10, 20, 50].find((k) => k >= need - 1e-9) || 100, out = [];
  for (let i = n - 1; i >= 0; i -= m) out.push(i);
  return out.reverse();
}

// a y domain with round ticks (3 to 5 of them), padded, never below zero for non-negative data, never past 0-100 for percentages
export function yDomain(values, { unit, n = 3, zero = false, padShare = 0.14 } = {}) {
  const v = values.filter(isNum);
  if (!v.length) return { lo: 0, hi: 1, ticks: [0, 0.5, 1] };
  let lo = Math.min(...v), hi = Math.max(...v);
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const lo0 = lo, hi0 = hi;                       // the data itself, before a flat series is given some height
  if (hi - lo < 1e-9) { const m = Math.abs(hi) || 1; lo -= m * 0.2; hi += m * 0.2; }
  const pad = (hi - lo) * padShare;
  let a = lo - pad, b = hi + pad;
  if (unit === "%") { if (lo0 >= 0) a = Math.max(0, a); if (hi0 <= 100) b = Math.min(100, b); }
  if (lo0 >= 0 && a < 0) a = 0;
  if (zero && lo0 >= 0) a = 0;
  let ticks = niceTicks(a, b, n);
  for (const alt of [n + 1, n - 1, n + 2, n - 2]) { if (ticks.length >= 3 && ticks.length <= 5) break; if (alt >= 1) { const t = niceTicks(a, b, alt); if (Math.abs(t.length - 4) < Math.abs(ticks.length - 4)) ticks = t; } }
  return { lo: ticks[0], hi: ticks[ticks.length - 1], ticks };
}

/* ── paths ── */
export const polyLen = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].px - pts[i - 1].px, pts[i].py - pts[i - 1].py); return s; };
export const pathD = (pts) => pts.map((p, i) => (i ? "L" : "M") + r1(p.px) + " " + r1(p.py)).join("");
export const areaD = (pts, yb) => (pts.length < 2 ? "" : pathD(pts) + "L" + r1(pts[pts.length - 1].px) + " " + r1(yb) + "L" + r1(pts[0].px) + " " + r1(yb) + "Z");
export function bandD(top, bottom) {
  if (top.length < 2 || bottom.length !== top.length) return "";
  return pathD(top) + bottom.slice().reverse().map((p) => "L" + r1(p.px) + " " + r1(p.py)).join("") + "Z";
}
// a column with rounded corners on its free end only (up for a positive value, down for a negative one)
export function columnPath(x, w, yEnd, yBase, r = 6) {
  const ht = Math.abs(yBase - yEnd);
  if (ht < 0.01) return `M${r1(x)} ${r1(yBase)}h${r1(w)}`;
  const rr = Math.min(r, w / 2, ht), up = yEnd <= yBase, s = up ? -1 : 1;
  return `M${r1(x)} ${r1(yBase)}V${r1(yEnd - s * rr)}A${rr} ${rr} 0 0 ${up ? 1 : 0} ${r1(x + rr)} ${r1(yEnd)}H${r1(x + w - rr)}A${rr} ${rr} 0 0 ${up ? 1 : 0} ${r1(x + w)} ${r1(yEnd - s * rr)}V${r1(yBase)}Z`;
}

/* ── collisions: labels must never sit on a line or on another label ── */
export const rectsOverlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.ht + pad && b.y < a.y + a.ht + pad;
export function segHitsRect(x1, y1, x2, y2, r) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1, p = [-dx, dx, -dy, dy], q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.ht - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; } else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}
export function polyHitsRect(pts, r) {
  if (pts.length === 1) return pts[0].px >= r.x && pts[0].px <= r.x + r.w && pts[0].py >= r.y && pts[0].py <= r.y + r.ht;
  for (let i = 1; i < pts.length; i++) if (segHitsRect(pts[i - 1].px, pts[i - 1].py, pts[i].px, pts[i].py, r)) return true;
  return false;
}
// the y of a polyline at a given x (linear between its points), null outside it
export function polyYAt(pts, px) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (px >= Math.min(a.px, b.px) - 1e-9 && px <= Math.max(a.px, b.px) + 1e-9) return b.px === a.px ? Math.min(a.py, b.py) : a.py + ((b.py - a.py) * (px - a.px)) / (b.px - a.px);
  }
  return null;
}
// the first candidate box {x, y, w, ht} that is inside the bounds and touches no obstacle ({ rect } or { poly: [{px, py}] }); null when none is free
export function placeBox(cands, obstacles, bounds) {
  for (const c of cands) {
    if (c.x < bounds.x || c.y < bounds.y || c.x + c.w > bounds.x + bounds.w || c.y + c.ht > bounds.y + bounds.ht) continue;
    const grown = { x: c.x - 1, y: c.y - 1, w: c.w + 2, ht: c.ht + 2 };
    if (obstacles.some((o) => (o.rect ? rectsOverlap(c, o.rect, 1) : polyHitsRect(o.poly, grown)))) continue;
    return c;
  }
  return null;
}
// like placeBox, but it always answers: the first free place; else the first that touches only soft obstacles (a faint reference line, { soft: true });
// else the first one inside the bounds; else the first candidate pushed inside
export function placeLabel(cands, obstacles, bounds) {
  const hard = obstacles.filter((o) => !o.soft);
  const inside = (c) => c.x >= bounds.x && c.y >= bounds.y && c.x + c.w <= bounds.x + bounds.w && c.y + c.ht <= bounds.y + bounds.ht;
  const got = placeBox(cands, obstacles, bounds) || (hard.length < obstacles.length ? placeBox(cands, hard, bounds) : null) || cands.find(inside);
  if (got) return got;
  const c = cands[0];
  return { ...c, x: clamp(c.x, bounds.x, Math.max(bounds.x, bounds.x + bounds.w - c.w)), y: clamp(c.y, bounds.y, Math.max(bounds.y, bounds.y + bounds.ht - c.ht)) };
}

/* ── words for screen readers and tooltips ── */
export function sparkSummary(points, { unit, label } = {}) {
  const v = (points || []).filter((p) => p && isNum(p.v)), pre = label ? label + ": " : "";
  if (v.length < 2) return pre + (v.length ? "נתון יחיד, " + fmtVal(unit, v[0].v) : "אין נתונים למגמה");
  const a = v[0], b = v[v.length - 1], d = b.v - a.v, span = Math.max(...v.map((p) => p.v)) - Math.min(...v.map((p) => p.v));
  const flat = Math.abs(d) < Math.max(1e-9, span * 0.04);
  const yrs = isNum(a.year) && isNum(b.year) ? ` (${a.year} עד ${b.year})` : "";
  return `${pre}מגמה, ${flat ? "ללא שינוי" : d > 0 ? "עלייה" : "ירידה"}: מ-${fmtVal(unit, a.v)} ל-${fmtVal(unit, b.v)}${yrs}`;
}

// a signed change for a chip: { dir: 1 | 0 | -1, sign, mag, suffix, tone }. tone is judged only when the direction (higher / lower is better) is known and the figure is reliable
export function deltaOf(first, last, { unit, direction = null, reliable = true } = {}) {
  if (!isNum(first) || !isNum(last)) return null;
  const d = last - first, mag = Math.abs(d), dec = mag >= 10 ? 0 : 1, flat = Math.round(mag * 10 ** dec) === 0;
  const suffix = { "%": " נק׳", days: " ימים", years: " שנים" }[unit] || "";
  const dir = flat ? 0 : d > 0 ? 1 : -1;
  const good = !direction || reliable === false || flat ? null : direction === "higher" ? d > 0 : d < 0;
  return { d, dir, sign: flat ? "" : d > 0 ? "+" : "−", mag: num(mag, dec), suffix: flat ? "" : suffix, flat, tone: good == null ? "none" : good ? "good" : "attn" };
}

/* ── turning model data into chart input (the page builders copy these calls) ── */

// the band of similar localities per year, from GET /api/city/:key/indicator/:id -> peers. mode "range" = lowest to highest, "iqr" = the middle half
export function peerBand(peers, mode = "range", label) {
  const by = new Map();
  for (const p of peers || []) for (const s of p.series || []) if (isNum(s.year) && isNum(s.v)) { if (!by.has(s.year)) by.set(s.year, []); by.get(s.year).push(s.v); }
  const lo = [], hi = [];
  for (const y of [...by.keys()].sort((a, b) => a - b)) {
    const vs = by.get(y).sort((a, b) => a - b);
    if (vs.length < 3) continue;
    lo.push({ x: y, y: mode === "iqr" ? quantile(vs, 0.25) : vs[0] });
    hi.push({ x: y, y: mode === "iqr" ? quantile(vs, 0.75) : vs[vs.length - 1] });
  }
  return { lo, hi, label: label || (mode === "iqr" ? "יישובים דומים (50% האמצעיים)" : "טווח יישובים דומים"), short: mode === "iqr" ? "50% האמצעיים מבין הדומים" : "טווח הדומים" };
}

// lineChart input from a model indicator (city model, GET /api/city/:key -> indicators[i])
export function indicatorLine(a, cityName, { nat = true, peer = true, target = true, projection = true, band = null, events = null, compact = false, height } = {}) {
  const S = (a && a.series) || [], small = !!(a && a.last && a.last.reliable === false);
  const series = [{ key: "city", label: cityName || "היישוב", color: C.city, points: S.filter((s) => isNum(s.v)).map((s) => ({ x: s.year, y: s.v, hollow: small })) }];
  if (nat && S.some((s) => isNum(s.nat))) series.push({ key: "nat", label: "ממוצע ארצי", color: C.nat, points: S.filter((s) => isNum(s.nat)).map((s) => ({ x: s.year, y: s.nat })) });
  if (peer && S.some((s) => isNum(s.peer))) series.push({ key: "peer", label: "יישובים דומים (הערך האמצעי)", color: C.peer, endLabel: false, points: S.filter((s) => isNum(s.peer)).map((s) => ({ x: s.year, y: s.peer })) });
  const tg = target ? S.filter((s) => isNum(s.target)).map((s) => ({ x: s.year, y: s.target })) : [];
  const pj = projection && !small && a.history && a.history.projection && a.last ? [{ x: a.last.year, y: a.last.v }, { x: a.history.projection.year, y: a.history.projection.v }] : null;
  return { series, target: tg, projection: pj, band, events, unit: a.unit, compact, height, ariaLabel: `היסטוריית ${a.label}` };
}
// columnChart input from a model indicator
export function indicatorColumns(a, { nat = true, target = true, height } = {}) {
  const S = (a && a.series) || [], small = !!(a && a.last && a.last.reliable === false);
  return {
    points: S.filter((s) => isNum(s.v)).map((s) => ({ x: s.year, y: s.v, hollow: small })),
    nat: nat ? S.filter((s) => isNum(s.nat)).map((s) => ({ x: s.year, y: s.nat })) : [],
    target: target ? S.filter((s) => isNum(s.target)).map((s) => ({ x: s.year, y: s.target })) : [],
    unit: a.unit, height, ariaLabel: `${a.label}, לפי שנה`
  };
}
// trajectory input from a recommendation KPI (model.recommendations[i].kpis[j]) and the model indicator it names
export function kpiTrajectory(kpi, ind, { nat = true, width, height } = {}) {
  if (!kpi || !ind) return null;
  const S = (ind.series || []).filter((s) => isNum(s.year) && isNum(s.v)), last = S[S.length - 1];
  const toV = numberIn(kpi.to), fromV = numberIn(kpi.from);
  if (toV == null || !isNum(kpi.byYear)) return null;
  const year = isNum(kpi.year) ? kpi.year : last && last.year, startV = fromV != null ? fromV : last && last.v;
  if (!isNum(year) || !isNum(startV)) return null;
  return { history: S.map((s) => ({ x: s.year, y: s.v })), from: { x: year, y: startV }, to: { x: kpi.byYear, y: toV }, nat: nat && last && isNum(last.nat) ? last.nat : null, unit: ind.unit, width, height, label: kpi.label || ind.label };
}
// smallMultiples item from a model indicator
export function smallItem(a, href) {
  const S = (a.series || []).map((s) => ({ year: s.year, v: s.v, nat: s.nat }));
  return { id: a.id, label: a.short || a.label, unit: a.unit, series: S, status: a.status, href, direction: a.direction || null, reliable: !(a.last && a.last.reliable === false), last: a.last ? { v: a.last.v, year: a.last.year } : null };
}

// a legend row that matches what a line chart cfg draws
export function legendOf(cfg) {
  const o = normLine(cfg), items = o.series.map((s) => ({ label: s.label, color: s.color, dash: !!s.dash }));
  if (o.band) items.push({ label: o.band.label, color: "color-mix(in srgb, var(--c-peer) 22%, var(--surface))", sq: true });
  if (o.target.length) items.push({ label: "יעד", color: C.target, dash: true });
  if (o.projection) items.push({ label: "המשך המגמה", color: C.city, dash: true });
  return legendRow(items);
}

/* ═════════════════════════════ the line chart: layout (pure) ═════════════════════════════ */

export function normLine(cfg = {}) {
  const series = (cfg.series || []).map((s, i) => {
    const key = s.key || "s" + i;
    return { key, label: s.label || "", color: s.color || (key === "nat" ? C.nat : key === "peer" ? C.peer : C.city), width: s.width, dots: s.dots, endLabel: s.endLabel, dash: s.dash || (key === "peer" ? "6 4" : null), points: cleanPts(s.points) };
  }).filter((s) => s.points.length);
  const target = cleanPts(cfg.target), pr = cleanPts(cfg.projection);
  let band = null;
  if (cfg.band && cfg.band.lo && cfg.band.hi) {
    const hi = new Map(cleanPts(cfg.band.hi).map((p) => [p.x, p.y]));
    const pairs = cleanPts(cfg.band.lo).filter((p) => hi.has(p.x)).map((p) => ({ x: p.x, lo: Math.min(p.y, hi.get(p.x)), hi: Math.max(p.y, hi.get(p.x)) }));
    if (pairs.length) band = { pairs, label: cfg.band.label || "טווח יישובים דומים", short: cfg.band.short || null };
  }
  const events = (cfg.events || []).filter((e) => e && isNum(e.x) && e.label).map((e) => ({ x: e.x, x2: isNum(e.x2) && e.x2 > e.x ? e.x2 : null, label: String(e.label) })).sort((a, b) => a.x - b.x);
  return { series, target, projection: pr.length === 2 ? pr : null, band, events, unit: cfg.unit };
}

export const lineHeight = (cfg, W) => cfg.height || (cfg.compact ? 168 : W < 480 ? 252 : 292);

// everything the line chart draws, in px: scales, ticks, runs, markers, labels, event chips, band shapes, hover stops
export function lineLayout(cfg = {}, W = 600, H = 280) {
  const o = normLine(cfg), unit = o.unit, compact = !!cfg.compact;
  const allX = [...new Set([...o.series.flatMap((s) => s.points.map((p) => p.x)), ...(o.band ? o.band.pairs.map((p) => p.x) : [])])].sort((a, b) => a - b);
  if (!allX.length) return { empty: true, W, H };
  const domX = [...new Set([...allX, ...o.target.map((p) => p.x), ...(o.projection ? o.projection.map((p) => p.x) : [])])].sort((a, b) => a - b);
  const x0 = domX[0], x1 = domX[domX.length - 1], step = typicalStep(domX);
  const vals = [...o.series.flatMap((s) => s.points.map((p) => p.y)), ...o.target.map((p) => p.y), ...(o.projection ? o.projection.map((p) => p.y) : []), ...(o.band ? o.band.pairs.flatMap((p) => [p.lo, p.hi]) : [])];
  const dom = yDomain(vals, { unit, n: compact ? 2 : 3 });
  const hasCity = o.series.some((s) => s.key === "city");

  // which series carry a value at their end
  const specs = [];
  for (const s of o.series) {
    const last = s.points[s.points.length - 1], one = s.points.length === 1;
    const wants = s.endLabel === true || (s.endLabel !== false && (one || s.key === "city" || s.key === "nat" || (!hasCity && o.series.length <= 6 && s.key !== "peer")));
    if (!wants) continue;
    const text = fmtVal(unit, last.y), bold = s.key === "city" || !hasCity;
    specs.push({ s, last, text, bold, w: textWidth(text, 12.5, bold ? 700 : 600), atEnd: Math.abs(last.x - x1) < 1e-9 });
  }
  const rightSpecs = specs.filter((l) => l.atEnd);
  const tgt = o.target.length ? o.target[o.target.length - 1] : null;
  // a target that stops before the end of a projected trend carries on to the edge, so the gap to the projected value can be read
  const tgtExtends = !!tgt && !!o.projection && tgt.x < x1 - 1e-9;
  const tgtAtEnd = !!tgt && (o.target.length === 1 || Math.abs(tgt.x - x1) < 1e-9 || tgtExtends);
  const chipW = Math.ceil(textWidth("יעד", 11, 700)) + 14, chipH = 20;

  // margins: the left holds the y labels, the right the end labels and the target chip
  const tickTexts = dom.ticks.map((t) => axisText(unit, t));
  const left = clamp(Math.ceil(Math.max(...tickTexts.map((t) => textWidth(t, 11.5)))) + 12, 30, 84);
  let right = 16;
  if (rightSpecs.length) right = Math.max(right, Math.ceil(Math.max(...rightSpecs.map((l) => l.w))) + 16);
  if (tgt && tgtAtEnd) right = Math.max(right, chipW + 14);
  right = Math.min(right, Math.round(W * 0.34));
  const padX = 8, xa = left + padX, xb = W - right - padX, plotL = left, plotR = W - right;
  const X = (x) => (x1 === x0 ? (xa + xb) / 2 : xa + ((x - x0) / (x1 - x0)) * (xb - xa));
  const pxPerUnit = x1 > x0 ? (xb - xa) / (x1 - x0) : 0;

  // events: a pale band from x to x2 or a hairline, with a name chip in the strip above the plot (two rows at most; a chip that does not fit is dropped, the tooltip still names the event)
  const evs = o.events.filter((e) => (e.x2 != null ? e.x2 : e.x) >= x0 - 1e-9 && e.x <= x1 + 1e-9).map((e) => {
    const a = clamp(e.x, x0, x1), b = clamp(e.x2 != null ? e.x2 : e.x, x0, x1);
    return { ...e, pxA: X(a), pxB: X(b), band: e.x2 != null && X(b) - X(a) > 0.5, chip: null };
  });
  const laneEnd = [];
  if (!compact) for (const e of evs) {
    const w = Math.ceil(textWidth(e.label, 11, 600)) + 16, cx = (e.pxA + e.pxB) / 2, x = clamp(cx - w / 2, 2, W - w - 2);
    let lane = 0;
    while (lane < 2 && laneEnd[lane] != null && x < laneEnd[lane] + 4) lane++;
    if (lane >= 2) continue;
    laneEnd[lane] = x + w;
    e.chip = { x, y: 4 + lane * 24, w, ht: chipH, lane };
  }
  const lanes = laneEnd.length, plotT = 12 + lanes * 24, plotB = H - 28;
  const Y = linear(dom.lo, dom.hi, plotB, plotT);
  const ticks = dom.ticks.map((t, i) => ({ v: t, y: Y(t), label: tickTexts[i] }));
  const xTicks = xTickValues(x0, x1, step, pxPerUnit, textWidth("2024", 11.5), 8).map((x) => ({ x, px: X(x), label: fmtX(x) }));

  // the series in px, cut into runs at gaps, with the markers that are shown
  const spacing = pxPerUnit * step;
  const order = (s) => (s.key === "city" ? 0 : s.key === "nat" ? 1 : s.key === "peer" ? 99 : 2);
  const aniOrder = o.series.map((s, i) => ({ s, i })).sort((p, q) => order(p.s) - order(q.s) || p.i - q.i).map((e) => e.s);
  const series = o.series.map((s) => {
    const pts = s.points.map((p) => ({ ...p, px: X(p.x), py: Y(p.y) })), runs = splitRuns(pts, step), isRef = s.key === "nat" || s.key === "peer";
    const one = pts.length === 1, isolated = new Set(runs.filter((r) => r.length === 1 && pts.length > 1).map((r) => r[0]));
    const showAll = s.dots === true || (s.dots !== false && !isRef && spacing >= 13 && pts.length <= 48);
    const r = one ? 6 : compact ? 3 : isRef ? 3 : 4;
    const last = pts[pts.length - 1];
    const wantsEnd = s.key === "city" || s.key === "nat" || specs.some((l) => l.s === s);
    // the last point of a series that has an end marker is drawn by that marker (the city's pulses), so the plain markers leave it out
    const dots = pts.filter((p) => (showAll || one || isolated.has(p) || p.hollow) && !(wantsEnd && p === last)).map((p) => ({ px: p.px, py: p.py, hollow: p.hollow, r }));
    return { ...s, pts, runs, dots, dashed: !!s.dash, byX: new Map(pts.map((p) => [p.x, p])), ai: aniOrder.indexOf(s), isRef, one, z: order(s), end: wantsEnd ? { px: last.px, py: last.py, r, ping: s.key === "city", hollow: last.hollow, one } : null };
  });

  // target, projection, band in px
  const tpts = o.target.map((p) => ({ ...p, px: X(p.x), py: Y(p.y) }));
  if (tgtExtends && tpts.length > 1) tpts.push({ x: x1, y: tgt.y, px: X(x1), py: Y(tgt.y) });
  const target = tgt ? { pts: tpts.length === 1 ? [{ px: xa, py: tpts[0].py }, { px: xb, py: tpts[0].py }] : tpts, y: Y(tgt.y), v: tgt.y } : null;
  const projection = o.projection ? { pts: o.projection.map((p) => ({ ...p, px: X(p.x), py: Y(p.y) })), label: "המשך המגמה" } : null;
  let bandRuns = [];
  if (o.band) bandRuns = splitRuns(o.band.pairs, step).filter((r) => r.length > 1).map((r) => ({ top: r.map((p) => ({ px: X(p.x), py: Y(p.hi) })), bottom: r.map((p) => ({ px: X(p.x), py: Y(p.lo) })) }));
  const band = o.band ? { runs: bandRuns, label: o.band.label, short: o.band.short, byX: new Map(o.band.pairs.map((p) => [p.x, p])) } : null;

  // labels. The values at the right edge are spread apart with the target chip; the others find a free place next to their last point.
  const labels = [], chips = [];
  const items = rightSpecs.map((l) => ({ id: l.s.key, y: Y(l.last.y), ht: 15, h: 15 }));
  if (tgt && tgtAtEnd) items.push({ id: "__target", y: Y(tgt.y), ht: chipH, h: chipH });
  const placed = spread(items, 3, plotT + 2, plotB - 2), rightRects = [];
  for (const it of placed) {
    if (it.id === "__target") { chips.push({ id: "target", x: plotR + 4, y: it.y - chipH / 2, w: chipW, ht: chipH, text: "יעד" }); rightRects.push({ x: plotR + 4, y: it.y - chipH / 2, w: chipW, ht: chipH }); continue; }
    const l = rightSpecs.find((q) => q.s.key === it.id), px = X(l.last.x) + 12;
    labels.push({ key: l.s.key, text: l.text, x: px, y: it.y + 4.3, anchor: "start", bold: l.bold });
    rightRects.push({ x: px, y: it.y - 8, w: l.w, ht: 15 });
  }
  const obstacles = [...series.map((s) => ({ poly: s.pts })), ...rightRects.map((r) => ({ rect: r })), ...evs.filter((e) => e.chip).map((e) => ({ rect: e.chip }))];
  if (target) obstacles.push({ poly: target.pts });
  if (projection) obstacles.push({ poly: projection.pts });
  const bounds = { x: 0, y: plotT - 2, w: W, ht: plotB - plotT + 6 };
  const inline = (px, py, w, prefer) => {
    const above = { x: px - w / 2, y: py - 24, w, ht: 14, anchor: "middle" }, below = { x: px - w / 2, y: py + 10, w, ht: 14, anchor: "middle" };
    const right = { x: px + 10, y: py - 7, w, ht: 14, anchor: "start" }, c = prefer === "below" ? [below, above, right] : [above, below, right];
    const got = placeLabel(c, obstacles, bounds);
    obstacles.push({ rect: got });
    return { ...got, tx: got.anchor === "middle" ? got.x + got.w / 2 : got.x, ty: got.y + 11.3 };
  };
  for (const l of specs.filter((q) => !q.atEnd).sort((a, b) => (a.s.key === "city" ? 0 : 1) - (b.s.key === "city" ? 0 : 1))) {
    const p = series.find((q) => q.key === l.s.key).pts.slice(-1)[0], rising = projection && projection.pts[1].py < projection.pts[0].py;
    const got = inline(p.px, p.py, l.w, l.s.key === "city" && rising ? "below" : "above");
    labels.push({ key: l.s.key, text: l.text, x: got.tx, y: got.ty, anchor: got.anchor, bold: l.bold, halo: true });
  }
  if (tgt && !tgtAtEnd) {
    const e = tpts[tpts.length - 1], got = inline(e.px, e.py, chipW, "above");
    chips.push({ id: "target", x: got.x, y: got.y - 2, w: chipW, ht: chipH, text: "יעד" });
  }
  let projLabel = null;
  if (projection) {
    const [a, b] = projection.pts, w = Math.ceil(textWidth(projection.label, 11, 600)), rising = b.py < a.py;
    const c1 = { x: b.px + 4 - w, y: b.py - 24, w, ht: 14 }, c2 = { x: b.px + 4 - w, y: b.py + 10, w, ht: 14 }, c = rising ? [c1, c2] : [c2, c1];
    const got = placeLabel(c, obstacles, bounds);
    projLabel = { text: projection.label, x: got.x + got.w, y: got.y + 11.3 };
  }
  const stops = allX.map((x) => ({ x, px: X(x) }));
  return { W, H, unit, o, left, right, plot: { l: plotL, r: plotR, t: plotT, b: plotB }, X, Y, ticks, xTicks, series, target, projection, projLabel, band, events: evs, labels, chips, stops, step, x0, x1, hasCity };
}

/* ═════════════════════════════ interaction shared by the line and the column chart ═════════════════════════════ */

let openChart = null, globalBound = false;
function claim(me) {
  if (openChart && openChart !== me) openChart.hide();
  openChart = me;
  if (!globalBound && typeof document !== "undefined") {
    globalBound = true;
    document.addEventListener("pointerdown", (e) => { if (openChart && !openChart.el.contains(e.target)) openChart.hide(); }, true);
    window.addEventListener("scroll", () => { if (openChart) openChart.hide(); }, { passive: true, capture: true });
  }
}
// pointer, touch and keyboard walking through the stops of a chart; content(i) gives { nodes, text }, onShow(i) / onHide() move the marks
function scrub({ root, svgEl, overlay, stops, W, anchorY, content, onShow, onHide, live }) {
  if (!stops.length) return;
  let cur = -1;
  const me = { el: root, hide };
  function hide() {
    if (cur < 0) return;
    cur = -1; onHide(); svgEl.classList.remove("is-hot");
    if (openChart === me) { openChart = null; tip.hide(); }
  }
  function show(i, cy, kb) {
    cur = i; claim(me);
    const r = svgEl.getBoundingClientRect(), k = W ? r.width / W || 1 : 1, c = content(i);
    onShow(i); svgEl.classList.add("is-hot");
    tip.show(c.nodes, { clientX: r.left + stops[i].px * k, clientY: cy != null ? cy : r.top + anchorY * k });
    if (kb && live) live.textContent = c.text;
  }
  const nearest = (px) => {
    let lo = 0, hi = stops.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (stops[mid].px <= px) lo = mid; else hi = mid; }
    return Math.abs(stops[lo].px - px) <= Math.abs(stops[hi].px - px) ? lo : hi;
  };
  const at = (ev) => { const r = svgEl.getBoundingClientRect(); return (ev.clientX - r.left) / (W ? r.width / W || 1 : 1); };
  overlay.addEventListener("pointermove", (ev) => show(nearest(at(ev)), ev.clientY));
  overlay.addEventListener("pointerdown", (ev) => show(nearest(at(ev)), ev.clientY));
  overlay.addEventListener("pointerleave", (ev) => { if (ev.pointerType !== "touch") hide(); });
  svgEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { hide(); return; }
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -1e9 : e.key === "End" ? 1e9 : 0;
    if (!d) return;
    e.preventDefault();
    show(cur < 0 ? stops.length - 1 : clamp(cur + d, 0, stops.length - 1), undefined, true);
  });
  svgEl.addEventListener("focus", () => { try { if (svgEl.matches(":focus-visible")) show(stops.length - 1, undefined, true); } catch (e) { /* no :focus-visible */ } });
  svgEl.addEventListener("blur", hide);
}

/* ═════════════════════════════ the line chart: DOM ═════════════════════════════ */

const charts = new WeakMap();
const emptyBox = (ht, text = "אין נתונים להצגה") => h("div.v-time-empty", { style: `min-height:${Math.min(ht, 120)}px` }, h("span", text));
// the screen-reader table inside a 1px clipping box: a hidden table keeps its own width and would stick out of a phone's screen
const srWrap = (table) => h("div.sr", table);
const el = (tag, cls, attrs) => svg(tag, { class: cls, ...attrs });
const txt = (x, y, str, cls, anchor = "start", extra) => svg("text", { x: r1(x), y: r1(y), "text-anchor": anchor, class: cls, ...extra }, str);

// a marker: 8px with a 2px ring of the surface colour, or hollow (a ring in the series colour) for a figure on a small group
function marker(px, py, r, color, hollow, cls, st = "") {
  return svg("circle", { cx: r1(px), cy: r1(py), r: hollow ? r : r + 1, class: cls || null, style: sty(hollow ? { fill: "var(--surface)", stroke: color, "stroke-width": 2 } : { fill: color, stroke: "var(--surface)", "stroke-width": 2 }) + (st ? ";" + st : "") });
}

function describeLine(o, unit, base) {
  const parts = o.series.slice(0, 6).filter((s) => s.label).map((s) => {
    const a = s.points[0], b = s.points[s.points.length - 1];
    return s.points.length === 1 ? `${s.label}: ${fmtVal(unit, b.y)} ב-${fmtX(b.x)}` : `${s.label}: ${fmtVal(unit, a.y)} ב-${fmtX(a.x)}, ${fmtVal(unit, b.y)} ב-${fmtX(b.x)}`;
  });
  if (o.target.length) parts.push(`יעד: ${fmtVal(unit, o.target[o.target.length - 1].y)}`);
  if (o.projection) parts.push(`המשך המגמה: ${fmtVal(unit, o.projection[1].y)} ב-${fmtX(o.projection[1].x)}`);
  if (o.band) { const b = o.band.pairs[o.band.pairs.length - 1]; parts.push(`${o.band.label}: ${fmtVal(unit, b.lo)} עד ${fmtVal(unit, b.hi)} ב-${fmtX(b.x)}`); }
  if (o.events.length) parts.push("אירועים: " + o.events.map((e) => e.label).join(", "));
  return [base || "גרף קו לאורך השנים", ...parts].join(". ");
}

function drawLine(host, st, W) {
  const cfg = st.cfg, H = lineHeight(cfg, W), L = lineLayout(cfg, W, H), unit = cfg.unit;
  host.style.minHeight = H + "px";
  if (L.empty) { host.replaceChildren(emptyBox(H)); return; }
  const { plot: P, o } = L, gid = st.gid;
  const root = svg("svg", { class: "v-time-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": describeLine(o, unit, cfg.ariaLabel), tabindex: "0" });

  // the city's area fades from the colour down to nothing (userSpaceOnUse: it fades the same way whatever the shape); lighter when a band lies under the line
  const city = L.series.find((s) => s.key === "city");
  const defs = svg("defs");
  if (city && city.pts.length > 1) {
    const top = Math.min(...city.pts.map((p) => p.py));
    defs.append(svg("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse", x1: 0, y1: r1(top), x2: 0, y2: r1(P.b) }, svg("stop", { offset: "0", style: `stop-color:var(--c-city);stop-opacity:${L.band ? ".15" : ".22"}` }), svg("stop", { offset: "1", style: "stop-color:var(--c-city);stop-opacity:0" })));
  }
  root.append(defs);

  // events sit behind everything
  const evG = el("g", "v-time-events fade", { style: anim(0) });
  for (const e of L.events) {
    const top = e.chip ? e.chip.y + e.chip.ht : P.t;
    if (e.band) evG.append(el("rect", "v-time-evband", { x: r1(e.pxA), y: r1(P.t), width: r1(e.pxB - e.pxA), height: r1(P.b - P.t) }));
    else evG.append(el("line", "v-time-evline", { x1: r1(e.pxA) + 0.5, x2: r1(e.pxA) + 0.5, y1: r1(top), y2: r1(P.b) }));
  }
  root.append(evG);

  // grid, y labels at the left edge, x labels along the bottom
  const grid = el("g", "v-time-grid");
  L.ticks.forEach((t, i) => {
    grid.append(el("line", i === 0 ? "base" : null, { x1: P.l, x2: P.r, y1: Math.round(t.y) + 0.5, y2: Math.round(t.y) + 0.5 }));
    grid.append(txt(P.l - 8, t.y + 4, t.label, "t-axis", "end"));
  });
  const xl = el("g", "v-time-xlabels");
  L.xTicks.forEach((t) => xl.append(txt(t.px, H - 8, t.label, "t-axis", "middle")));
  root.append(grid, xl);

  // the band of similar localities
  if (L.band && L.band.runs.length) {
    const g = el("g", "fade v-time-band", { style: anim(0) });
    L.band.runs.forEach((r) => g.append(el("path", "fill", { d: bandD(r.top, r.bottom) }), el("path", "edge", { d: pathD(r.top) }), el("path", "edge", { d: pathD(r.bottom) })));
    root.append(g);
  }
  // the target
  if (L.target) root.append(el("polyline", "fade v-time-target", { points: L.target.pts.map((p) => r1(p.px) + "," + r1(p.py)).join(" "), style: anim(1) }));

  // lines: the reference series first, the city on top
  const byZ = [...L.series].sort((a, b) => b.z - a.z);
  for (const s of byZ) {
    const g = el("g", "v-time-s", { "data-key": s.key });
    const w = s.width || (s.key === "city" ? 2.5 : 2);
    if (s.key === "city" && city.pts.length > 1) for (const r of s.runs) if (r.length > 1) g.append(el("path", "fade v-time-area", { d: areaD(r, P.b), style: `fill:url(#${gid});` + anim(0) }));
    for (const r of s.runs) {
      if (r.length < 2) continue;
      if (s.dashed) g.append(el("path", "fade v-time-line", { d: pathD(r), style: sty({ stroke: s.color, "stroke-width": w, "stroke-dasharray": s.dash }) + ";" + anim(s.ai) }));
      else g.append(el("path", "draw v-time-line", { d: pathD(r), style: sty({ stroke: s.color, "stroke-width": w }) + ";" + anim(s.ai, polyLen(r)) }));
    }
    root.append(g);
  }
  // the continuation of the trend: dashed, ending in a hollow dot
  if (L.projection) {
    const [a, b] = L.projection.pts;
    root.append(el("line", "fade v-time-proj", { x1: r1(a.px), y1: r1(a.py), x2: r1(b.px), y2: r1(b.py), style: anim(2) }));
    root.append(marker(b.px, b.py, 4, "var(--c-city)", true, "pop", anim(8)));
    root.append(txt(L.projLabel.x, L.projLabel.y, L.projLabel.text, "t-note halo rise", "end", { style: anim(8) }));
  }
  // markers
  const dots = el("g", "v-time-dots");
  L.series.forEach((s) => s.dots.forEach((d, i) => dots.append(marker(d.px, d.py, d.r, s.color, d.hollow, "pop", anim(i)))));
  root.append(dots);
  for (const s of L.series) {
    if (!s.end) continue;
    const e = s.end, g = el("g", "pop", { style: anim(12) });
    if (e.ping) g.append(el("circle", "ping", { cx: r1(e.px), cy: r1(e.py), r: 7.5, style: "fill:color-mix(in srgb, var(--c-city) 32%, transparent)" }));
    g.append(marker(e.px, e.py, e.r, s.color, e.hollow));
    root.append(g);
  }
  // value labels at the ends, and the "יעד" chip
  const lab = el("g", "v-time-ends");
  L.labels.forEach((l, i) => lab.append(txt(l.x, l.y, l.text, "rise t-end" + (l.bold ? " strong" : "") + (l.halo ? " halo" : ""), l.anchor, { style: anim(i + 6) })));
  L.chips.forEach((c) => {
    const g = el("g", "v-time-tchip rise", { style: anim(6) });
    g.append(el("rect", null, { x: r1(c.x), y: r1(c.y), width: c.w, height: c.ht, rx: c.ht / 2 }), txt(c.x + c.w / 2, c.y + c.ht / 2 + 3.8, c.text, "t-chip", "middle"));
    lab.append(g);
  });
  root.append(lab);
  // the names of the events
  const chipG = el("g", "v-time-evchips rise", { style: anim(2) });
  L.events.forEach((e) => { if (!e.chip) return; chipG.append(el("rect", null, { x: r1(e.chip.x), y: e.chip.y, width: e.chip.w, height: e.chip.ht, rx: e.chip.ht / 2 }), txt(e.chip.x + e.chip.w / 2, e.chip.y + e.chip.ht / 2 + 3.8, e.label, "t-evt", "middle")); });
  root.append(chipG);

  // hover: a crosshair, a dot on every series, one tooltip
  const hover = el("g", "v-time-hover", { "aria-hidden": "true" });
  const cross = el("line", "v-time-cross", { y1: P.t, y2: P.b });
  const hd = L.series.map(() => el("circle", "v-time-hdot", { r: 5 }));
  hover.append(cross, ...hd);
  const overlay = el("rect", "v-time-hit", { x: 0, y: Math.max(0, P.t - 8), width: W, height: P.b - P.t + 8 + 26 });
  root.append(hover, overlay);

  const live = h("div.sr", { role: "status", "aria-live": "polite" });
  const evAt = (x) => L.events.find((e) => x >= e.x - 1e-9 && x <= (e.x2 != null ? e.x2 : e.x) + 1e-9);
  const content = (i) => {
    const x = L.stops[i].x, ev = evAt(x), rows = [tipHead(fmtX(x) + (ev ? " · " + ev.label : ""))], plain = [fmtX(x) + (ev ? " · " + ev.label : "")];
    let small = false;
    for (const s of L.series) {
      const p = s.byX.get(x);
      if (!p) continue;
      const v = fmtVal(unit, p.y);
      rows.push(tipRow(s.color, s.label, ltr(v), s.dashed)); plain.push(`${s.label} ${v}`);
      if (p.hollow) small = true;
    }
    if (L.band) { const b = L.band.byX.get(x); if (b) { const v = `${fmtVal(unit, b.lo)}–${fmtVal(unit, b.hi)}`; rows.push(tipRow("var(--c-peer)", L.band.short || L.band.label, ltr(v))); plain.push(`${L.band.label} ${v}`); } }
    const tg = o.target.find((q) => q.x === x);
    if (tg) { rows.push(tipRow(C.target, "יעד", ltr(fmtVal(unit, tg.y)), true)); plain.push(`יעד ${fmtVal(unit, tg.y)}`); }
    if (o.projection && x === o.projection[1].x) rows.push(tipRow(C.city, "המשך המגמה", ltr(fmtVal(unit, o.projection[1].y)), true));
    if (cfg.extra) { const e = cfg.extra(x); if (e) rows.push(e); }
    if (small) rows.push(h("div.tr.note", h("span.k", "קבוצה קטנה: הנתון פחות יציב")));
    return { nodes: rows, text: plain.join(", ") };
  };
  scrub({
    root: host, svgEl: root, overlay, stops: L.stops, W, anchorY: P.t + 28, content, live,
    onShow: (i) => {
      const x = L.stops[i].x;
      cross.setAttribute("x1", r1(L.stops[i].px) + 0.5); cross.setAttribute("x2", r1(L.stops[i].px) + 0.5);
      L.series.forEach((s, k) => {
        const p = s.byX.get(x), d = hd[k];
        if (!p) { d.classList.remove("on"); return; }
        d.setAttribute("cx", r1(p.px)); d.setAttribute("cy", r1(p.py)); d.classList.add("on");
        d.style.fill = p.hollow ? "var(--surface)" : s.color; d.style.stroke = p.hollow ? s.color : "var(--surface)";
      });
    },
    onHide: () => hd.forEach((d) => d.classList.remove("on"))
  });

  const children = [root], tgBy = new Map(o.target.map((q) => [q.x, q.y]));
  if (L.stops.length <= 60) children.push(srWrap(srTable(cfg.ariaLabel || "נתוני הגרף", ["שנה", ...o.series.map((s) => s.label || s.key), ...(o.target.length ? ["יעד"] : [])],
    L.stops.map((s) => [fmtX(s.x), ...L.series.map((q) => { const p = q.byX.get(s.x); return p ? fmtVal(unit, p.y) : null; }), ...(o.target.length ? [tgBy.has(s.x) ? fmtVal(unit, tgBy.get(s.x)) : null] : [])]))));
  children.push(live);
  host.replaceChildren(...children);
}

// lineChart(host, cfg): draws into host and keeps itself fitted to the host's width. Calling it again on the same host updates the chart.
export function lineChart(host, cfg = {}) {
  const old = charts.get(host);
  if (old && old.kind === "line") { old.cfg = cfg; old.fit.redraw(); return host; }
  host.classList.add("v-time", "v-time-line");
  host.style.minHeight = lineHeight(cfg, host.clientWidth || 600) + "px";
  viz(host);
  const st = { kind: "line", cfg, gid: uid("tg") };
  st.fit = fit(host, (w) => drawLine(host, st, w), { min: 160 });
  charts.set(host, st);
  return host;
}

/* ═════════════════════════════ the column chart ═════════════════════════════ */

export const columnHeight = (cfg, W) => cfg.height || (W < 480 ? 232 : 264);

// columns on a zero baseline, the national figure as a tick on each, an optional target line, value labels when there is room
export function columnLayout(cfg = {}, W = 600, H = 264) {
  const pts = cleanPts(cfg.points), n = pts.length, unit = cfg.unit;
  if (!n) return { empty: true, W, H };
  const inCols = new Set(pts.map((p) => p.x));
  const nat = new Map(cleanPts(cfg.nat).filter((p) => inCols.has(p.x)).map((p) => [p.x, p.y]));
  const tAll = cleanPts(cfg.target), tIn = tAll.filter((p) => inCols.has(p.x)), tgt = tIn.length ? tIn : tAll.slice(-1);
  const dom = yDomain([0, ...pts.map((p) => p.y), ...nat.values(), ...tgt.map((p) => p.y)], { unit, n: cfg.compact ? 2 : 3, zero: true, padShare: 0.06 });
  const tickTexts = dom.ticks.map((t) => axisText(unit, t));
  const left = clamp(Math.ceil(Math.max(...tickTexts.map((t) => textWidth(t, 11.5)))) + 12, 30, 84);
  const chipW = Math.ceil(textWidth("יעד", 11, 700)) + 14, chipH = 20, right = tgt.length ? chipW + 14 : 12;
  const plotL = left, plotR = W - right, slot = (plotR - plotL) / n, bw = clamp(slot * 0.58, 5, 44);
  const plotT = 28, plotB = H - 28, Y = linear(dom.lo, dom.hi, plotB, plotT), y0 = Y(0);
  const maxLabelW = Math.max(...pts.map((p) => textWidth(fmtVal(unit, p.y), 12.5, 700)));
  const showAll = n <= 8 && slot >= maxLabelW + 6;
  const cxAt = (i) => plotL + slot * (i + 0.5), cxOf = new Map(pts.map((p, i) => [p.x, cxAt(i)]));
  let target = null;
  if (tgt.length) {
    const tp = tgt.map((p) => ({ px: cxOf.has(p.x) ? cxOf.get(p.x) : plotR, py: Y(p.y) }));
    target = { pts: [{ px: plotL, py: tp[0].py }, ...tp, { px: plotR, py: tp[tp.length - 1].py }], y: tp[tp.length - 1].py, v: tgt[tgt.length - 1].y, chip: { x: plotR + 4, y: tp[tp.length - 1].py - chipH / 2, w: chipW, ht: chipH, text: "יעד" } };
  }
  const cols = pts.map((p, i) => {
    const cx = cxAt(i), yv = Y(p.y), nv = nat.get(p.x), neg = p.y < 0, last = i === n - 1;
    const yEnd = Math.abs(yv - y0) < 2 ? (neg ? y0 + 2 : y0 - 2) : yv;
    const natO = nv != null ? { v: nv, y: Y(nv), x1: cx - bw / 2 - 4, x2: cx + bw / 2 + 4 } : null;
    const text = fmtVal(unit, p.y), lw = textWidth(text, 12.5, 700);
    let ly = neg ? Math.max(yEnd, natO ? natO.y : -1e9) + 16 : Math.min(yEnd, natO ? natO.y : 1e9) - 8;
    // a value label that the target line would run through goes just above the line
    if (!neg && target && polyHitsRect(target.pts, { x: cx - lw / 2, y: ly - 12, w: lw, ht: 15 })) ly = Math.min(ly, (polyYAt(target.pts, cx) ?? ly) - 8);
    return { i, x: p.x, v: p.y, hollow: p.hollow, cx, bx: cx - bw / 2, bw, yEnd, yBase: y0, neg, last, nat: natO, label: showAll || last ? { text, x: cx, y: clamp(ly, 12, H - 30), bold: last } : null };
  });
  const xTicks = slotTicks(n, slot, textWidth("2024", 11.5), 8).map((i) => ({ i, px: cols[i].cx, label: fmtX(cols[i].x) }));
  return { W, H, unit, left, right, plot: { l: plotL, r: plotR, t: plotT, b: plotB }, Y, y0, ticks: dom.ticks.map((t, i) => ({ v: t, y: Y(t), label: tickTexts[i] })), cols, target, xTicks, stops: cols.map((c) => ({ x: c.x, px: c.cx })), bw, slot, showAll, tgtBy: new Map(tAll.map((p) => [p.x, p.y])) };
}

function drawColumns(host, st, W) {
  const cfg = st.cfg, H = columnHeight(cfg, W), L = columnLayout(cfg, W, H), unit = cfg.unit;
  host.style.minHeight = H + "px";
  if (L.empty) { host.replaceChildren(emptyBox(H)); return; }
  const P = L.plot, n = L.cols.length, first = L.cols[0], last = L.cols[n - 1];
  const natLast = [...L.cols].reverse().find((c) => c.nat);
  const aria = [cfg.ariaLabel || "עמודות לפי שנה",
    n <= 8 ? L.cols.map((c) => `${fmtX(c.x)}: ${fmtVal(unit, c.v)}`).join(", ") : `${fmtX(first.x)}: ${fmtVal(unit, first.v)}, ${fmtX(last.x)}: ${fmtVal(unit, last.v)}`,
    natLast ? `ממוצע ארצי ב-${fmtX(natLast.x)}: ${fmtVal(unit, natLast.nat.v)}` : null, L.target ? `יעד: ${fmtVal(unit, L.target.v)}` : null].filter(Boolean).join(". ");
  const root = svg("svg", { class: "v-time-svg v-time-cols", width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": aria, tabindex: "0" });

  const grid = el("g", "v-time-grid");
  L.ticks.forEach((t) => {
    grid.append(el("line", Math.abs(t.v) < 1e-9 ? "base" : null, { x1: P.l, x2: P.r, y1: Math.round(t.y) + 0.5, y2: Math.round(t.y) + 0.5 }));
    grid.append(txt(P.l - 8, t.y + 4, t.label, "t-axis", "end"));
  });
  const xl = el("g", "v-time-xlabels");
  L.xTicks.forEach((t) => xl.append(txt(t.px, H - 8, t.label, "t-axis", "middle")));
  root.append(grid, xl);
  if (L.target) root.append(el("polyline", "fade v-time-target", { points: L.target.pts.map((p) => r1(p.px) + "," + r1(p.py)).join(" "), style: anim(2) }));

  const colEls = L.cols.map((c) => {
    const g = el("g", "v-time-col");
    const fill = c.hollow ? { fill: "color-mix(in srgb, var(--c-city) 12%, var(--surface))", stroke: "var(--c-city)", "stroke-width": 1.5, "stroke-dasharray": "3 3" } : { fill: c.last ? "var(--c-city)" : "var(--t-old)" };
    g.append(el("path", "grow-y" + (c.hollow ? " hollow" : ""), { d: columnPath(c.bx, c.bw, c.yEnd, c.yBase, 6), style: sty({ ...fill, "transform-origin": c.neg ? "50% 0%" : null }) + ";" + anim(c.i) }));
    if (c.label) g.append(txt(c.label.x, c.label.y, c.label.text, "rise t-val" + (c.label.bold ? " strong" : "") + " halo", "middle", { style: anim(c.i + 8) }));
    root.append(g);
    return g;
  });
  // the national figure: a short tick across each column, with a casing in the surface colour so that it reads on the column too
  const natG = el("g", "fade v-time-natticks", { style: anim(4) });
  L.cols.forEach((c) => { if (c.nat) natG.append(el("line", "casing", { x1: r1(c.nat.x1), x2: r1(c.nat.x2), y1: r1(c.nat.y), y2: r1(c.nat.y) }), el("line", "tick", { x1: r1(c.nat.x1), x2: r1(c.nat.x2), y1: r1(c.nat.y), y2: r1(c.nat.y) })); });
  root.append(natG);
  if (L.target) {
    const c = L.target.chip, g = el("g", "v-time-tchip rise", { style: anim(6) });
    g.append(el("rect", null, { x: r1(c.x), y: r1(c.y), width: c.w, height: c.ht, rx: c.ht / 2 }), txt(c.x + c.w / 2, c.y + c.ht / 2 + 3.8, c.text, "t-chip", "middle"));
    root.append(g);
  }
  const overlay = el("rect", "v-time-hit", { x: 0, y: 0, width: W, height: H });
  root.append(overlay);

  const live = h("div.sr", { role: "status", "aria-live": "polite" });
  const content = (i) => {
    const c = L.cols[i], rows = [tipHead(fmtX(c.x)), tipRow(C.city, cfg.label || "הערך", ltr(fmtVal(unit, c.v)))], plain = [fmtX(c.x), fmtVal(unit, c.v)];
    if (c.nat) { rows.push(tipRow(C.nat, "ממוצע ארצי", ltr(fmtVal(unit, c.nat.v)))); plain.push(`ממוצע ארצי ${fmtVal(unit, c.nat.v)}`); }
    if (L.tgtBy.has(c.x)) { rows.push(tipRow(C.target, "יעד", ltr(fmtVal(unit, L.tgtBy.get(c.x))), true)); plain.push(`יעד ${fmtVal(unit, L.tgtBy.get(c.x))}`); }
    if (cfg.extra) { const e = cfg.extra(c.x); if (e) rows.push(e); }
    if (c.hollow) rows.push(h("div.tr.note", h("span.k", "קבוצה קטנה: הנתון פחות יציב")));
    return { nodes: rows, text: plain.join(", ") };
  };
  scrub({
    root: host, svgEl: root, overlay, stops: L.stops, W, anchorY: P.t + 10, content, live,
    onShow: (i) => colEls.forEach((g, k) => g.classList.toggle("hot", k === i)),
    onHide: () => colEls.forEach((g) => g.classList.remove("hot"))
  });

  const children = [root];
  if (n <= 60) children.push(srWrap(srTable(cfg.ariaLabel || "נתוני הגרף", ["שנה", cfg.label || "הערך", ...(natLast ? ["ממוצע ארצי"] : []), ...(L.target ? ["יעד"] : [])],
    L.cols.map((c) => [fmtX(c.x), fmtVal(unit, c.v), ...(natLast ? [c.nat ? fmtVal(unit, c.nat.v) : null] : []), ...(L.target ? [L.tgtBy.has(c.x) ? fmtVal(unit, L.tgtBy.get(c.x)) : null] : [])]))));
  children.push(live);
  host.replaceChildren(...children);
}

// columnChart(host, cfg): cfg = { points: [{ x, y, hollow? }], nat: [{ x, y }], target: [{ x, y }], unit, height, ariaLabel, label?, extra? }
export function columnChart(host, cfg = {}) {
  const old = charts.get(host);
  if (old && old.kind === "col") { old.cfg = cfg; old.fit.redraw(); return host; }
  host.classList.add("v-time", "v-time-column");
  host.style.minHeight = columnHeight(cfg, host.clientWidth || 600) + "px";
  viz(host);
  const st = { kind: "col", cfg };
  st.fit = fit(host, (w) => drawColumns(host, st, w), { min: 160 });
  charts.set(host, st);
  return host;
}

/* ═════════════════════════════ the spark area ═════════════════════════════ */

// the geometry of a spark: points = [{ v, year? }], nat = [v | null] (same order). Years, when all there, set the spacing and break the line at a missing year.
export function sparkLayout(points, nat, { w = 92, h: ht = 30, endDot = true } = {}) {
  const raw = (points || []).map((p, i) => ({ i, v: p && isNum(p.v) ? p.v : null, year: p && isNum(p.year) ? p.year : null }));
  const valid = raw.filter((p) => p.v != null), byYear = valid.length > 0 && valid.every((p) => p.year != null);
  const dotR = clamp(ht / 7.5, 3, 4), ring = ht < 28 ? 1.5 : 2, pad = dotR + ring + 1;
  const padL = 3, padR = endDot ? pad : 3, padT = pad, padB = pad;
  const nv = (nat || []).map((v, i) => ({ i, v: isNum(v) ? v : null, year: raw[i] ? raw[i].year : null })).filter((p) => p.v != null && raw[p.i]);
  const xOf = (p) => (byYear ? p.year : p.i);
  const xs = valid.map(xOf), x0 = Math.min(...xs), x1 = Math.max(...xs), step = typicalStep([...new Set(xs)].sort((a, b) => a - b));
  const ys = [...valid.map((p) => p.v), ...nv.map((p) => p.v)];
  let lo = ys.length ? Math.min(...ys) : 0, hi = ys.length ? Math.max(...ys) : 1;
  if (hi - lo < 1e-9) { const m = Math.abs(hi) || 1; lo -= m * 0.1; hi += m * 0.1; }
  const X = (x) => (x1 === x0 ? w - padR - (w - padL - padR) * 0.1 : padL + ((x - x0) / (x1 - x0)) * (w - padL - padR)), Y = linear(lo, hi, ht - padB, padT);
  const px = (p) => ({ ...p, x: xOf(p), px: X(xOf(p)), py: Y(p.v) });
  const pts = valid.map(px), runs = splitRuns(pts, step), natRuns = splitRuns(nv.map(px), step);
  const end = pts.length ? pts[pts.length - 1] : null;
  return { w, h: ht, dotR, ring, pts, runs, natRuns, end, base: ht - 1, endDot, empty: !pts.length, single: pts.length === 1, byYear, step };
}

// the bare SVG of a spark (no viz() wrapper): sparkArea and the small multiples both build on it
function sparkSvg(points, nat, opts = {}) {
  const { w = 92, h: ht = 30, endDot = true, area = true, unit, label, gid = uid("sg") } = opts;
  const S = sparkLayout(points, nat, { w, h: ht, endDot });
  const root = svg("svg", { class: "v-time-spark", width: w, height: ht, viewBox: `0 0 ${w} ${ht}`, role: "img", "aria-label": sparkSummary(points, { unit, label }) });
  if (S.empty) { root.append(el("line", "v-time-spark-empty", { x1: 3, x2: w - 3, y1: ht / 2, y2: ht / 2 })); return { el: root, S }; }
  const top = Math.min(...S.pts.map((p) => p.py));
  if (area && S.pts.length > 1) root.append(svg("defs", null, svg("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse", x1: 0, y1: r1(top), x2: 0, y2: r1(S.base) }, svg("stop", { offset: "0", style: "stop-color:var(--c-city);stop-opacity:.26" }), svg("stop", { offset: "1", style: "stop-color:var(--c-city);stop-opacity:0" }))));
  S.natRuns.forEach((r) => { if (r.length > 1) root.append(el("path", "fade v-time-spark-nat", { d: pathD(r), style: anim(0) })); });
  if (area && S.pts.length > 1) S.runs.forEach((r) => { if (r.length > 1) root.append(el("path", "fade v-time-spark-area", { d: areaD(r, S.base), style: `fill:url(#${gid});` + anim(0) })); });
  S.runs.forEach((r) => { if (r.length > 1) root.append(el("path", "draw v-time-spark-line", { d: pathD(r), style: anim(0, polyLen(r)) })); });
  if (S.single) S.runs.forEach((r) => { if (r.length === 1) root.append(el("line", "v-time-spark-empty", { x1: 3, x2: w - 3, y1: r1(r[0].py), y2: r1(r[0].py) })); });
  if (endDot && S.end) root.append(marker(S.end.px, S.end.py, S.dotR, "var(--c-city)", false, "pop", anim(3)));
  return { el: root, S };
}

// sparkArea(points, nat, { w = 92, h = 30, endDot = true, area = true, unit?, label? }): points = [{ v, year? }], nat = [v | null]. Returns the SVG element.
export function sparkArea(points, nat, opts = {}) {
  const { el: root } = sparkSvg(points, nat, opts);
  root.classList.add("viz");
  return viz(root);
}

/* ═════════════════════════════ the trajectory ═════════════════════════════ */

// where a KPI stands and where it must go: the history, a dashed straight path from today to the target, a flag at the target.
// The flag's label (value and year) sits to its right, in a margin made just wide enough; the label of today looks for a free place around its dot.
export function trajectoryLayout({ history, from, to, nat, unit, width = 260, height = 120 } = {}) {
  const hist = cleanPts(history).map((p) => ({ x: p.x, y: p.y }));
  const start = from && isNum(from.x) && isNum(from.y) ? { x: from.x, y: from.y } : hist.length ? hist[hist.length - 1] : null;
  const end = to && isNum(to.x) && isNum(to.y) ? { x: to.x, y: to.y } : null;
  const W = Math.max(120, Math.round(width)), H = Math.max(84, Math.round(height));
  if (!start && !end) return { empty: true, W, H };
  const natV = isNum(nat) ? nat : null;
  const xs = [...hist.map((p) => p.x), start && start.x, end && end.x].filter(isNum), x0 = Math.min(...xs), x1 = Math.max(...xs);
  const ys = [...hist.map((p) => p.y), start && start.y, end && end.y, natV].filter(isNum), spanY = Math.max(...ys) - Math.min(...ys);
  const [lo, hi] = padExtent(ys, 0.12, { min: unit === "%" ? 0 : -Infinity, max: unit === "%" ? 100 : Infinity, minSpan: Math.max(1, Math.abs(ys[0]) * 0.1, spanY) });
  const tVal = end ? fmtVal(unit, end.y) : "", tCap = end ? `יעד ${fmtX(end.x)}` : "";
  const tW = end ? Math.ceil(Math.max(textWidth(tCap, 10.5, 600), textWidth(tVal, 12.5, 700))) : 0;
  const m = { l: 10, r: end ? clamp(tW + 26, 46, Math.round(W * 0.44)) : 14, t: 42, b: 22 };
  const X = (x) => (x1 === x0 ? (m.l + W - m.r) / 2 : m.l + ((x - x0) / (x1 - x0)) * (W - m.l - m.r)), Y = linear(lo, hi, H - m.b - 4, m.t);
  const px = (p) => ({ ...p, px: X(p.x), py: Y(p.y) });
  const histPx = hist.map(px), S = start && px(start), E = end && px(end);
  const bounds = { x: 0, y: 0, w: W, ht: H - m.b };
  const natLine = natV != null ? [{ px: m.l, py: Y(natV) }, { px: W - m.r + 6, py: Y(natV) }] : null;
  const obstacles = [];
  if (histPx.length) obstacles.push({ poly: histPx });
  if (S && E) obstacles.push({ poly: [S, E] });
  if (natLine) obstacles.push({ poly: natLine, soft: true });         // a faint reference line: a label may cross it when there is no better place
  let flag = null, targetLabel = null, todayLabel = null, natLabel = null;
  if (E) {
    const pole = 20;
    flag = { pole: [E.px, E.py, E.px, E.py - pole], pennant: `M${r1(E.px)} ${r1(E.py - pole)}L${r1(E.px + 12)} ${r1(E.py - pole + 4.5)}L${r1(E.px)} ${r1(E.py - pole + 9)}Z` };
    targetLabel = { x: E.px + 17, capY: E.py - 15, valY: E.py - 1, caption: tCap, value: tVal };
    obstacles.push({ rect: { x: E.px - 2, y: E.py - pole - 1, w: tW + 20, ht: pole + 4 } });
  }
  // today: a caption over the value, above or below the dot, to the middle, the left or the right; the first place that touches nothing
  if (S) {
    const vt = fmtVal(unit, S.y), w = Math.ceil(Math.max(textWidth("היום", 10.5, 600), textWidth(vt, 12.5, 700))) + 2, bh = 28;
    const rising = E ? E.py < S.py : false;
    const at = (x, y, anchor) => ({ x: clamp(x, 1, W - w - 1), y, w, ht: bh, anchor });
    const up = (x, a) => at(x, S.py - 12 - bh, a), dn = (x, a) => at(x, S.py + 12, a);
    const mid = S.px - w / 2, left = S.px + 5 - w, right = S.px - 5;
    const cands = rising ? [dn(mid, "middle"), up(mid, "middle"), dn(left, "end"), up(left, "end"), dn(right, "start"), up(right, "start")] : [up(mid, "middle"), dn(mid, "middle"), up(left, "end"), dn(left, "end"), up(right, "start"), dn(right, "start")];
    const got = placeLabel(cands, obstacles, bounds);
    todayLabel = { ...got, caption: "היום", value: vt };
    obstacles.push({ rect: got });
  }
  if (natLine) {
    const t = `ארצי ${fmtVal(unit, natV)}`, w = Math.ceil(textWidth(t, 10.5, 500)), y = natLine[0].py;
    const cands = [{ x: m.l, y: y - 17, w, ht: 13, anchor: "start" }, { x: W - m.r - w, y: y - 17, w, ht: 13, anchor: "end" }, { x: m.l, y: y + 4, w, ht: 13, anchor: "start" }, { x: W - m.r - w, y: y + 4, w, ht: 13, anchor: "end" }];
    const got = placeBox(cands, obstacles, bounds);
    if (got) natLabel = { ...got, text: t };
  }
  // x labels: the first year, the year of today, the target year (a label that would touch a more important one is dropped)
  const raw = [];
  if (E) raw.push({ x: end.x, key: "target" });
  if (hist.length) raw.push({ x: hist[0].x, key: "first" });
  if (S) raw.push({ x: S.x, key: "today" });
  const xl = [], lw = textWidth("2024", 11);
  for (const r of raw) {
    const p = X(r.x);
    if (xl.some((q) => Math.abs(q.px - p) < lw + 6)) continue;
    xl.push({ ...r, px: p, label: fmtX(r.x) });
  }
  xl.sort((a, b) => a.px - b.px);
  return { W, H, m, X, Y, hist: histPx, S, E, path: S && E ? [S, E] : null, natLine, flag, todayLabel, targetLabel, natLabel, xLabels: xl, base: H - m.b, unit };
}

function drawTraj(host, st, W) {
  const cfg = st.cfg, L = trajectoryLayout({ ...cfg, width: W, height: cfg.height || 120 }), unit = cfg.unit;
  if (L.empty) { host.replaceChildren(emptyBox(L.H, "אין נתונים למסלול")); return; }
  host.style.minHeight = L.H + "px";
  const aria = [cfg.label || "מסלול אל היעד", L.S ? `היום ${fmtVal(unit, L.S.y)} ב-${fmtX(L.S.x)}` : null, L.E ? `יעד ${fmtVal(unit, L.E.y)} עד ${fmtX(L.E.x)}` : null, L.natLine ? `ממוצע ארצי ${fmtVal(unit, cfg.nat)}` : null].filter(Boolean).join(". ");
  const root = svg("svg", { class: "v-time-svg v-time-trajsvg", width: L.W, height: L.H, viewBox: `0 0 ${L.W} ${L.H}`, role: "group", "aria-label": aria });
  const gid = st.gid;
  if (L.hist.length > 1) {
    const top = Math.min(...L.hist.map((p) => p.py));
    root.append(svg("defs", null, svg("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse", x1: 0, y1: r1(top), x2: 0, y2: r1(L.base) }, svg("stop", { offset: "0", style: "stop-color:var(--c-city);stop-opacity:.22" }), svg("stop", { offset: "1", style: "stop-color:var(--c-city);stop-opacity:0" }))));
  }
  root.append(el("line", "v-time-trajbase", { x1: L.m.l, x2: L.W - L.m.r + 6, y1: L.base + 0.5, y2: L.base + 0.5 }));
  if (L.natLine) root.append(el("line", "fade v-time-trajnat", { x1: r1(L.natLine[0].px), x2: r1(L.natLine[1].px), y1: r1(L.natLine[0].py), y2: r1(L.natLine[1].py), style: anim(0) }));
  if (L.natLabel) root.append(txt(L.natLabel.anchor === "end" ? L.natLabel.x + L.natLabel.w : L.natLabel.x, L.natLabel.y + 10, L.natLabel.text, "t-note halo fade", L.natLabel.anchor, { style: anim(2) }));
  if (L.hist.length > 1) {
    root.append(el("path", "fade v-time-area", { d: areaD(L.hist, L.base), style: `fill:url(#${gid});` + anim(0) }));
    root.append(el("path", "draw v-time-line", { d: pathD(L.hist), style: sty({ stroke: "var(--c-city)", "stroke-width": 2.5 }) + ";" + anim(0, polyLen(L.hist)) }));
  }
  if (L.path) root.append(el("line", "fade v-time-path", { x1: r1(L.path[0].px), y1: r1(L.path[0].py), x2: r1(L.path[1].px), y2: r1(L.path[1].py), style: anim(3) }));
  const marks = [];
  if (L.S) {
    const g = el("g", "v-time-mark pop", { tabindex: "0", role: "img", "aria-label": `היום: ${fmtVal(unit, L.S.y)} ב-${fmtX(L.S.x)}`, style: anim(4) });
    g.append(el("circle", "v-time-mark-hit", { cx: r1(L.S.px), cy: r1(L.S.py), r: 14 }), marker(L.S.px, L.S.py, 4, "var(--c-city)", false));
    bindTip(g, () => [tipHead(`היום · ${fmtX(L.S.x)}`), tipRow(C.city, cfg.label || "הערך", ltr(fmtVal(unit, L.S.y)))]);
    marks.push(g);
  }
  if (L.E) {
    const g = el("g", "v-time-mark v-time-flag pop", { tabindex: "0", role: "img", "aria-label": `יעד: ${fmtVal(unit, L.E.y)} ב-${fmtX(L.E.x)}`, style: anim(6) });
    g.append(el("circle", "v-time-mark-hit", { cx: r1(L.E.px + 4), cy: r1(L.E.py - 8), r: 16 }), el("line", "pole", { x1: r1(L.flag.pole[0]), y1: r1(L.flag.pole[1]), x2: r1(L.flag.pole[2]), y2: r1(L.flag.pole[3]) }), el("path", "pennant", { d: L.flag.pennant }), marker(L.E.px, L.E.py, 3, "var(--c-target)", true));
    bindTip(g, () => [tipHead(`יעד · ${fmtX(L.E.x)}`), tipRow(C.target, "יעד", ltr(fmtVal(unit, L.E.y)), true), L.S ? tipRow(C.city, "היום", ltr(fmtVal(unit, L.S.y))) : null].filter(Boolean));
    marks.push(g);
  }
  root.append(...marks);
  const lab = el("g", "v-time-trajlabels");
  if (L.todayLabel) {
    const t = L.todayLabel, ax = t.anchor === "middle" ? t.x + t.w / 2 : t.anchor === "end" ? t.x + t.w : t.x;
    lab.append(txt(ax, t.y + 10, t.caption, "t-cap halo rise", t.anchor, { style: anim(6) }), txt(ax, t.y + 25, t.value, "t-val strong halo rise", t.anchor, { style: anim(6) }));
  }
  if (L.targetLabel) { const t = L.targetLabel; lab.append(txt(t.x, t.capY, t.caption, "t-cap halo rise", "start", { style: anim(8) }), txt(t.x, t.valY, t.value, "t-val strong halo rise", "start", { style: anim(8) })); }
  root.append(lab);
  const xl = el("g", "v-time-xlabels");
  L.xLabels.forEach((t) => xl.append(txt(t.px, L.H - 6, t.label, "t-axis" + (t.key === "target" ? " strong" : ""), "middle")));
  root.append(xl);
  // the history answers the pointer too
  if (L.hist.length) {
    const overlay = el("rect", "v-time-hit", { x: 0, y: 0, width: L.W, height: L.base });
    bindTip(overlay, (ev) => {
      const r = root.getBoundingClientRect(), p = (ev.clientX - r.left) / (r.width / L.W || 1);
      const near = L.hist.reduce((b, q) => (Math.abs(q.px - p) < Math.abs(b.px - p) ? q : b), L.hist[0]);
      return [tipHead(fmtX(near.x)), tipRow(C.city, cfg.label || "הערך", ltr(fmtVal(unit, near.y)))];
    });
    root.insertBefore(overlay, root.querySelector(".v-time-mark"));
  }
  host.replaceChildren(root);
}

// trajectory({ history: [{ x, y }], from: { x, y }, to: { x, y }, nat, unit, width = 260, height = 120, label }): returns an element that fits its container (never wider than width)
export function trajectory(cfg = {}) {
  const width = cfg.width || 260, height = cfg.height || 120;
  const host = h("div.v-time.v-time-traj", { style: `max-width:${width}px;min-height:${height}px` });
  viz(host);
  const st = { cfg, gid: uid("tj") };
  st.fit = fit(host, (w) => drawTraj(host, st, w), { min: 100 });
  return host;
}

/* ═════════════════════════════ small multiples ═════════════════════════════ */

function smCell(it, i) {
  const S = (it.series || []).filter((s) => s && isNum(s.v)), lastP = S[S.length - 1], firstP = S[0];
  const lastV = it.last && isNum(it.last.v) ? it.last.v : lastP && lastP.v, lastYear = it.last && it.last.year != null ? it.last.year : lastP && lastP.year;
  const unit = it.unit, reliable = it.reliable !== false;
  const d = S.length > 1 ? deltaOf(firstP.v, lastP.v, { unit, direction: it.direction, reliable }) : null;
  const tone = it.status ? toneOfStatus(it.status) : null, word = it.status ? STATUS_WORD[it.status] || "" : "";
  const dec = lastV == null ? 0 : Number.isInteger(lastV) || Math.abs(lastV) >= 100 ? 0 : 1;
  const head = h("div.v-time-sm-head", h("span.v-time-sm-label", it.label), tone ? h("span.v-time-sm-dot.is-" + tone + (reliable ? "" : ".hollow"), { title: word }, h("span.sr", word)) : null);
  const chip = d ? h("span.v-time-sm-delta.is-" + d.tone, { title: firstP.year != null ? `מאז ${firstP.year}` : null }, icon(d.dir > 0 ? "up" : d.dir < 0 ? "downarrow" : "minus", 12), d.flat ? "יציב" : [ltr(d.sign + d.mag), d.suffix]) : null;
  const sfx = unit !== "%" ? unitSuffix(unit) : "";
  const val = h("div.v-time-sm-val", lastV == null ? h("b.v-time-sm-num.none", "—") : h("b.v-time-sm-num", ltr(countTo(lastV, { dec, fmt: (v) => fmtVal(unit, v, dec) }))), sfx ? h("small", sfx) : null, chip);
  const sp = h("div.v-time-sm-spark");
  if (S.length) {
    const pts = (it.series || []).map((s) => ({ v: s.v, year: s.year })), nat = (it.series || []).map((s) => s.nat);
    const gid = uid("sg");
    fit(sp, (w) => {
      const { el: spark, S: lay } = sparkSvg(pts, nat, { w, h: 48, unit, label: it.label, gid });
      spark.setAttribute("aria-hidden", "true"); spark.removeAttribute("role"); spark.removeAttribute("aria-label");
      spark.classList.add("sm");
      sp.replaceChildren(spark);
      bindTip(spark, (ev) => {
        const r = spark.getBoundingClientRect(), p = (ev.clientX - r.left) / (r.width / w || 1);
        const near = lay.pts.reduce((b, q) => (Math.abs(q.px - p) < Math.abs(b.px - p) ? q : b), lay.pts[0]), src = (it.series || [])[near.i] || {};
        return [tipHead(String(src.year != null ? src.year : "")), tipRow(C.city, it.label, ltr(fmtVal(unit, near.v))), isNum(src.nat) ? tipRow(C.nat, "ממוצע ארצי", ltr(fmtVal(unit, src.nat))) : null].filter(Boolean);
      });
    }, { min: 80 });
  } else sp.append(h("span.v-time-sm-none", "אין נתונים להצגה"));
  const foot = S.length > 1 ? h("div.v-time-sm-foot", h("span", String(firstP.year != null ? firstP.year : "")), h("span", String(lastP.year != null ? lastP.year : ""))) : null;
  const say = [it.label, lastV != null ? `${fmtVal(unit, lastV)}${lastYear != null ? " ב-" + lastYear : ""}` : "אין נתון", d ? (d.flat ? "יציב" : `שינוי ${d.sign}${d.mag}${d.suffix.replace(" ", " ")}${firstP.year != null ? " מאז " + firstP.year : ""}`) : null, word || null].filter(Boolean).join(", ");
  const cell = h((it.href ? "a" : "div") + ".v-time-sm-cell", it.href ? { href: it.href, "aria-label": say } : { role: "group", "aria-label": say }, head, val, sp, foot);
  if (it.href) {
    // the keyboard sees the same figures as the pointer: on focus the cell shows its first and last values, the national figure and the status
    let shown = false;
    cell.addEventListener("focus", () => {
      try { if (!cell.matches(":focus-visible")) return; } catch (e) { return; }
      const rows = [tipHead(it.label)];
      if (S.length > 1) rows.push(tipRow(C.city, String(firstP.year), ltr(fmtVal(unit, firstP.v))));
      if (lastV != null) rows.push(tipRow(C.city, String(lastYear != null ? lastYear : "היום"), ltr(fmtVal(unit, lastV))));
      if (lastP && isNum(lastP.nat)) rows.push(tipRow(C.nat, "ממוצע ארצי", ltr(fmtVal(unit, lastP.nat))));
      if (word) rows.push(h("div.tr.note", h("span.k", word)));
      const r = cell.getBoundingClientRect();
      tip.show(rows, { clientX: r.left + r.width / 2, clientY: r.bottom - 16 }); shown = true;
    });
    cell.addEventListener("blur", () => { if (shown) { shown = false; tip.hide(); } });
  }
  return h("li.rise", { style: anim(i) }, cell);
}

// smallMultiples({ items, cols, ariaLabel }): items = [{ id, label, unit, series: [{ year, v, nat }], status, href, last: { v, year }, direction?, reliable? }]
export function smallMultiples({ items = [], cols, ariaLabel } = {}) {
  const ul = h("ul.v-time-sm", { "aria-label": ariaLabel || null });
  if (cols) { ul.classList.add("has-cols"); ul.style.setProperty("--sm-cols", String(cols)); }
  viz(ul);
  if (!items.length) ul.append(h("li.v-time-empty", h("span", "אין מדדים להצגה")));
  items.forEach((it, i) => ul.append(smCell(it, i)));
  return ul;
}
