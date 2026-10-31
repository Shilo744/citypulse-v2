// Spatial charts of CityPulse V2 (DESIGN_V3.md 5.5): the dot map of Israel and the small locator for hero sections.
//
//   dotMap({ points, cityKey, unit, direction, nat, peers = [], height = 540, ariaLabel,
//            city?, geo?, minBase?, label?, onPick? })        -> element
//   locator({ geo, cityKey, width = 120, ariaLabel })           -> element
//
// The country has no outline here: its shape emerges from the localities themselves (longitude x, latitude y) in a fixed frame (geoFrame), so the
// map looks the same on every page. Everything above the "DOM" divider is pure (no document at import time) and is tested in tests/viz-spatial.test.mjs.
//
// Additions to the contract (optional, nothing existing changes):
//   geo      the /api/geo list [{ k, n, x, y, p }]. It gives the dots their size (residents), draws the localities without a figure as faint
//            context dots (so a figure that covers 49 localities still shows the whole country) and finds the city when it is not in points.
//            Left out, the chart fetches it itself once (api.js caches it); geo: null turns that off.
//   city     { k, name, v, x, y } when the city is not in points (v may be null: the city is then drawn hollow, "no data").
//   minBase  the indicator's minimum base: a point with d < minBase (or reliable === false) is drawn hollow and takes no colour judgement.
//   label    the short name of the figure, used in the tooltip and the aria-label.
//   onPick   (point) => void, called on click / Enter on a dot (the dot's original point object).
//
// Keyboard: the city's mark (or the map when there is no city) is the one tab stop; arrow keys walk to the nearest dot in that direction and show its
// tooltip, Home returns to the city, Enter calls onPick, Escape clears. What the cursor lands on is also announced through an aria-live region.
import { h, svg, num, fmtVal, tip, tipHead, viz, srTable, sqrtRadius, geoFrame, clamp } from "./core.js";
import { unitSuffix } from "../ui.js";
import { getGeo } from "../api.js";

export const R_MIN = 2.2, R_MAX = 9, R_NONE = 3.4;     // dot radius range in px (R_NONE: nothing to size by)
const PAD = 14;                                         // room around the country for the largest dots
const MAX_NAMES = 5;                                    // orientation names on the map
const MAX_DOTS = 2400;                                  // a hard stop on the node count (the country has about 1,230 localities)
const STACK_GAP = 12, LEGEND_MIN = 160;                 // column gap and the narrowest legend before it moves under the map

const isNum = (v) => typeof v === "number" && isFinite(v);
const toNum = (v) => { if (v == null || v === "") return null; const n = Number(v); return isFinite(n) ? n : null; };

// ───────────────────────────── values, standing, colour ─────────────────────────────

// level (share of the values this value beats, same rule as levelOf in math.js), rank (1 = best) and quant (mid-rank 0..1 by value) from one sort
export function levelFn(values, direction) {
  const s = values.filter(isNum).sort((a, b) => a - b), n = s.length;
  const lower = (v) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < v) lo = m + 1; else hi = m; } return lo; };      // how many are < v
  const upper = (v) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] <= v) lo = m + 1; else hi = m; } return lo; };     // how many are <= v
  return {
    n,
    level: (v) => (n ? ((direction === "lower" ? n - upper(v) : lower(v)) / n) * 100 : null),
    rank: (v) => (direction === "lower" ? lower(v) : n - upper(v)) + 1,
    quant: (v) => (n ? (lower(v) + upper(v)) / 2 / n : null)
  };
}

// the colour scales are CSS (color-mix of tokens), so light and dark both work; --m-mid and --m-lo are set in css/viz/spatial.css
const MID = "var(--m-mid)", GAMMA = 0.8;
// diverging by standing: level 0 = the weakest locality (attention tone), 50 = quiet neutral, 100 = the strongest (good tone).
// The mix is eased (gamma 0.8) so that a locality a little off the middle already shows its side instead of fading into a muddy beige.
export function levelColor(level) {
  if (!isNum(level)) return MID;
  const t = clamp(level, 0, 100) / 50 - 1, a = Math.round(Math.pow(Math.abs(t), GAMMA) * 100);
  return a === 0 ? MID : `color-mix(in srgb, ${t < 0 ? "var(--attn-bar)" : "var(--good-bar)"} ${a}%, ${MID})`;
}
// sequential by quantile (a background figure: no good or bad): the city blue from light to full (never fully light, or the smallest places vanish)
export function seqColor(q) {
  if (!isNum(q)) return MID;
  return `color-mix(in srgb, var(--c-city) ${Math.round(10 + clamp(q, 0, 1) * 90)}%, var(--m-lo))`;
}
// the legend bar is drawn with the very same function, so a dot and its place on the bar always match
export function scaleGradient(sequential, steps = 10) {
  const stops = [];
  for (let i = 0; i <= steps; i++) stops.push(`${sequential ? seqColor(i / steps) : levelColor((i / steps) * 100)} ${Math.round((i / steps) * 100)}%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function dotRadius(size, vmax) {
  if (!isNum(size) || size < 0) return R_NONE;
  return Math.min(R_MAX, sqrtRadius(size, vmax, R_MIN, R_MAX));
}

export function valueText(unit, v) {
  if (!isNum(v)) return "—";
  const w = ["days", "years", "per1000", "per10k", "per100k"].includes(unit) ? unitSuffix(unit) : "";
  return fmtVal(unit, v) + (w ? " " + w : "");
}

// one plain sentence about where a locality stands among the others
export function standingText(d, dir) {
  if (!d.hasValue) return "אין נתון";
  if (!d.reliable) return "קבוצה קטנה, ללא דירוג";
  if (d.level == null) return "";
  if (dir) {
    if (d.level < 1) return "מהחלשים ביותר מבין היישובים";
    if (d.level >= 99) return "מהחזקים ביותר מבין היישובים";
    return `טוב מ-${Math.round(d.level)}% מהיישובים`;
  }
  if (d.level < 1) return "מהנמוכים ביותר מבין היישובים";
  if (d.level >= 99) return "מהגבוהים ביותר מבין היישובים";
  return `גבוה מ-${Math.round(d.level)}% מהיישובים`;
}

// ───────────────────────────── the data model ─────────────────────────────

// Cleans the points and works out everything that does not depend on pixels: coordinates (falling back to geo), size, reliability, level / rank,
// colour, the city (falling back to opts.city, then to geo), peers and the context dots. Never throws on empty, null or odd input.
export function prepare({ points, cityKey, city, direction = null, peers = [], geo = null, minBase = 0 } = {}) {
  const dir = direction === "higher" || direction === "lower" ? direction : null;
  const geoBy = new Map();
  if (Array.isArray(geo)) for (const g of geo) if (g && g.k != null) geoBy.set(String(g.k), g);
  const peerSet = new Set((Array.isArray(peers) ? peers : []).map(String));
  const selfKey = cityKey != null ? String(cityKey) : city && city.k != null ? String(city.k) : null;
  const seen = new Set(), dots = [];

  const add = (q) => {
    if (!q || q.k == null) return null;
    const k = String(q.k);
    if (seen.has(k)) return null;
    const g = geoBy.get(k);
    let lon = toNum(q.x != null ? q.x : q.lon), lat = toNum(q.y != null ? q.y : q.lat);
    if ((lon == null || lat == null) && g) { lon = toNum(g.x); lat = toNum(g.y); }
    if (lon == null || lat == null) return null;
    const v = toNum(q.v), d = toNum(q.d), pop = toNum(q.p != null ? q.p : g ? g.p : null);
    const small = q.reliable === false || (minBase > 0 && d != null && d < minBase);
    seen.add(k);
    const dot = { k, name: String(q.name != null ? q.name : q.n != null ? q.n : g && g.n != null ? g.n : ""), v, d, pop: pop > 0 ? pop : null, lon, lat,
      hasValue: v != null, reliable: !small, peer: peerSet.has(k), self: k === selfKey, raw: q };
    dots.push(dot);
    return dot;
  };

  for (const q of Array.isArray(points) ? points : []) add(q);
  let self = dots.find((d) => d.self) || null;
  if (!self && selfKey != null) {
    const src = city && typeof city === "object" ? { ...city, k: city.k != null ? city.k : selfKey } : geoBy.has(selfKey) ? { k: selfKey } : null;
    if (src) { self = add(src); if (self) { self.self = true; self.added = true; } }
  }

  // size: residents (point.p, else geo), else the size of the group behind the figure, else nothing
  const popN = dots.filter((d) => d.pop != null).length, grpN = dots.filter((d) => d.d != null && d.d > 0).length;
  const sizeKind = popN > 0 && popN >= dots.length * 0.5 ? "pop" : grpN > 0 && grpN >= dots.length * 0.5 ? "group" : null;
  for (const d of dots) d.size = sizeKind === "pop" ? d.pop : sizeKind === "group" && d.d > 0 ? d.d : null;
  let vmax = 0;
  if (sizeKind === "pop" && geoBy.size) for (const g of geoBy.values()) vmax = Math.max(vmax, toNum(g.p) || 0);     // one reference for every map: a locality keeps its size
  for (const d of dots) vmax = Math.max(vmax, d.size || 0);

  // standing among the localities that have a reliable figure (a handful of points cannot be ranked)
  const judged = dots.filter((d) => d.hasValue && d.reliable);
  const jv = judged.map((d) => d.v), F = levelFn(jv, dir), enough = judged.length >= 3 && Math.min(...jv) !== Math.max(...jv);       // all the same: nobody is stronger than anybody
  for (const d of dots) {
    d.level = d.quant = d.rank = null;
    if (enough && d.hasValue && d.reliable) { d.level = F.level(d.v); d.quant = F.quant(d.v); d.rank = dir ? F.rank(d.v) : null; }
    d.hollow = !d.hasValue || !d.reliable;
    d.fill = d.hollow ? null : dir ? levelColor(d.level) : d.quant == null ? MID : seqColor(d.quant);
  }

  let list = dots;
  if (dots.length > MAX_DOTS) {
    const keep = new Set(dots.filter((d) => d.self || d.peer));
    for (const d of [...dots].sort((a, b) => (b.size || 0) - (a.size || 0))) { if (keep.size >= MAX_DOTS) break; keep.add(d); }
    list = dots.filter((d) => keep.has(d));
  }
  list.sort((a, b) => (b.size || 0) - (a.size || 0));       // big first, small on top

  const ctx = [];
  for (const g of geoBy.values()) { const x = toNum(g.x), y = toNum(g.y); if (x != null && y != null && !seen.has(String(g.k))) ctx.push({ x, y }); }
  // the places that can name the map for a reader who does not know its shape: the largest localities (from geo, or from the points when there is none)
  const places = [];
  if (geoBy.size) { for (const g of geoBy.values()) { const x = toNum(g.x), y = toNum(g.y), p = toNum(g.p); if (x != null && y != null && p > 0 && g.n) places.push({ k: String(g.k), name: String(g.n), lon: x, lat: y, size: p }); } }
  else for (const d of dots) if (d.pop > 0 && d.name) places.push({ k: d.k, name: d.name, lon: d.lon, lat: d.lat, size: d.pop });
  places.sort((a, b) => b.size - a.size);
  const vals = F.n ? judged.map((d) => d.v) : [];
  return { dir, dots: list, self, judged: judged.length, sizeKind, vmax, ctx, places: places.slice(0, 60), total: dots.length, enough,
    vmin: vals.length ? Math.min(...vals) : null, vtop: vals.length ? Math.max(...vals) : null,
    hasPeers: list.some((d) => d.peer && !d.self), hasSmall: list.some((d) => d.hasValue && !d.reliable), hasMissing: list.some((d) => !d.hasValue) };
}

// ───────────────────────────── geometry ─────────────────────────────

// The canvas: the country in a fixed frame, centred between two gutters where the city's label can hang.
export function mapLayout(height = 540) {
  const H = clamp(Math.round(toNum(height) || 540), 160, 1400), gutter = clamp(Math.round(H * 0.11), 44, 64);
  const f0 = geoFrame(4000, H, PAD), W = Math.round(f0.width + 2 * gutter), f = geoFrame(W, H, PAD);
  return { W, H, gutter, X: f.X, Y: f.Y, scale: f.scale, mapW: f.width, mapH: f.height };
}

// pixel positions and radii; dots are kept inside the canvas
export function placeDots(model, L) {
  for (const d of model.dots) {
    d.cx = clamp(L.X(d.lon), 1, L.W - 1); d.cy = clamp(L.Y(d.lat), 1, L.H - 1);
    d.r = dotRadius(d.size, model.vmax);
  }
  model.ctxPts = model.ctx.map((g) => [clamp(L.X(g.x), 1, L.W - 1), clamp(L.Y(g.y), 1, L.H - 1)]);
  if (model.self) model.self.r = clamp(model.self.r + 2.5, 7, 11);        // the city is the largest thing on the map
  return model;
}

// the entrance wave: --i grows with the distance from the origin (the city), so dots appear in rings radiating from it
export function assignWave(model, ox, oy, maxI = 7) {
  let far = 0;
  for (const d of model.dots) { d.dist = Math.hypot(d.cx - ox, d.cy - oy); far = Math.max(far, d.dist); }
  for (const d of model.dots) d.i = far ? Math.round((d.dist / far) * maxI * 20) / 20 : 0;
  return far;
}

// a rough text width (px) for sizing the label chip before it is in the page
export function textWidth(t, size = 12, weight = 500) {
  let w = 0;
  for (const ch of String(t)) {
    const c = ch.charCodeAt(0);
    w += c >= 0x590 && c <= 0x5ff ? 0.54 : c >= 48 && c <= 57 ? 0.58 : ch === " " ? 0.26 : ch === "." || ch === "," ? 0.3 : ch === "%" ? 0.82 : 0.6;
  }
  return w * size * (weight >= 700 ? 1.06 : 1);
}

const hitsRect = (a, b, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

// "how many dots does this rectangle cover, and at what price": a grid over the dots (each registered in the cells its circle can touch) so that a
// candidate position tests the few dots around it instead of all of them. Returns (x, y, w, h, clear) => cost; the number of dots is left in .hits.
export function overlapIndex(dots, cell = 16) {
  const n = dots.length, cx = new Float32Array(n), cy = new Float32Array(n), rr = new Float32Array(n), grid = new Map(), key = (i, j) => i * 4096 + j;
  for (let k = 0; k < n; k++) {
    const d = dots[k], reach = d.r + 5;
    cx[k] = d.cx; cy[k] = d.cy; rr[k] = d.r;
    for (let i = Math.floor((d.cx - reach) / cell); i <= Math.floor((d.cx + reach) / cell); i++) for (let j = Math.floor((d.cy - reach) / cell); j <= Math.floor((d.cy + reach) / cell); j++) {
      const kk = key(i, j), a = grid.get(kk);
      if (a) a.push(k); else grid.set(kk, [k]);
    }
  }
  const mark = new Int32Array(n);
  let stamp = 0;
  const cost = (x, y, w, h, clear = 3) => {
    stamp++; let c = 0, hits = 0;
    for (let i = Math.floor(x / cell); i <= Math.floor((x + w) / cell); i++) for (let j = Math.floor(y / cell); j <= Math.floor((y + h) / cell); j++) {
      const a = grid.get(key(i, j));
      if (!a) continue;
      for (const k of a) {
        if (mark[k] === stamp) continue;
        mark[k] = stamp;
        const nx = clamp(cx[k], x, x + w), ny = clamp(cy[k], y, y + h);
        if (Math.hypot(cx[k] - nx, cy[k] - ny) < rr[k] + clear) { c += 5 + rr[k] * 1.6; hits++; }
      }
    }
    cost.hits = hits;
    return c;
  };
  return cost;
}

// Where a box (the city's label chip, a place name) goes: beside its dot, on the side and at the height where it covers the fewest dots, always inside the
// canvas and never over a box in `avoid` ([{ x, y, w, h }]). dots = [{ cx, cy, r }] (the box's own dot included: the box starts r + gap away from it).
// maxShift / maxDy bound how far from the dot it may slide (the chip may go far and gets a leader line, a place name must stay next to its dot).
// Returns { x, y, w, h, side (1 = east of the dot, -1 = west), ax, ay (where a leader meets the box), cost, hits (dots it still covers) }.
export function placeBox({ cx, cy, r, w, h: hgt, dots = [], avoid = [], W, H, gap = 11, margin = 3, clear = 3, maxShift = 78, maxDy = 90 }) {
  const covered = overlapIndex(dots), steps = Math.floor(maxDy / 6);
  let best = null;
  for (const side of [1, -1]) {
    for (let shift = 0; shift <= maxShift; shift += 6) {
      const x = side === 1 ? cx + r + gap + shift : cx - r - gap - shift - w;
      if (x < margin || x + w > W - margin) continue;
      for (let k = 0; k <= steps; k++) {
        for (const sgn of k ? [1, -1] : [1]) {
          const dy = k * 6 * sgn, y = cy - hgt / 2 + dy;
          if (y < margin || y + hgt > H - margin) continue;
          const box = { x, y, w, h: hgt };
          if (avoid.some((a) => hitsRect(box, a, 2))) continue;
          const cost = Math.abs(dy) * 0.24 + shift * 0.14 + covered(x, y, w, hgt, clear);
          if (!best || cost < best.cost) best = { ...box, side, cost, hits: covered.hits };
        }
      }
    }
  }
  if (!best) return null;
  best.ax = best.side === 1 ? best.x : best.x + w;
  best.ay = clamp(cy, best.y + 8, best.y + hgt - 8);
  return best;
}
// the city's chip: like placeBox, but it always lands somewhere (clamped beside the dot when the canvas is too small for any free spot)
export function placeChip(o) {
  const best = placeBox(o);
  if (best) return best;
  const { cx, cy, r, w, h: hgt, W, H, gap = 11, margin = 3 } = o;
  const x = clamp(cx + r + gap, margin, Math.max(margin, W - w - margin)), y = clamp(cy - hgt / 2, margin, Math.max(margin, H - hgt - margin));
  return { x, y, w, h: hgt, side: 1, cost: Infinity, hits: 0, ax: x, ay: clamp(cy, y + 8, y + hgt - 8) };
}

// orientation names, so that the dots can be read as a country: start from the largest place, then keep adding the one that is far from the
// names already chosen (and from the city), weighing size in, so that the set spreads over the whole country (Jerusalem, Haifa, Eilat, Tel Aviv ...).
// places = [{ k, name, lon, lat, size }] largest first. Returns [{ k, name, short, cx, cy, r }].
export function pickAnchors(places, L, vmax, { max = 5, minGap = 44, skip = null, away = null, awayGap = 50, pool = 40 } = {}) {
  const top = places.slice(0, pool).filter((p) => p.k !== skip).map((p) => ({ p, cx: L.X(p.lon), cy: L.Y(p.lat) }))
    .filter((c) => c.cx >= 2 && c.cx <= L.W - 2 && c.cy >= 2 && c.cy <= L.H - 2 && !(away && Math.hypot(away.cx - c.cx, away.cy - c.cy) < awayGap));
  const out = [], big = top.length ? top[0].p.size : 1;
  while (out.length < max && top.length) {
    let best = null, bs = -1;
    for (const c of top) {
      const gap = Math.min(...out.map((q) => Math.hypot(q.cx - c.cx, q.cy - c.cy)), Infinity);
      if (gap < minGap) continue;
      const score = (out.length ? gap : 1) * Math.sqrt(c.p.size / big);
      if (score > bs) { bs = score; best = c; }
    }
    if (!best) break;
    out.push({ k: best.p.k, name: best.p.name, short: shortName(best.p.name), cx: best.cx, cy: best.cy, r: dotRadius(best.p.size, vmax) });
    top.splice(top.indexOf(best), 1);
  }
  return out;
}
// "תל אביב-יפו" -> "תל אביב"
export const shortName = (n) => { const first = String(n).split("-")[0].trim(); return first.length >= 3 ? first : String(n); };

// a grid over the dots so that the pointer finds the nearest one without testing them all
export function makeIndex(items, cell = 24) {
  const grid = new Map(), key = (i, j) => i * 4096 + j;
  for (const it of items) { const k = key(Math.floor(it.cx / cell), Math.floor(it.cy / cell)); (grid.get(k) || grid.set(k, []).get(k)).push(it); }
  return { cell, grid, key };
}
// the dot under (x, y), or the nearest one within `reach` px of its edge; of the dots that contain the point the smallest (the one drawn on top) wins
export function nearestDot(index, x, y, reach = 10) {
  const { cell, grid, key } = index, span = Math.ceil((reach + R_MAX + 3) / cell);
  const ci = Math.floor(x / cell), cj = Math.floor(y / cell);
  let inside = null, near = null, nd = Infinity;
  for (let i = ci - span; i <= ci + span; i++) for (let j = cj - span; j <= cj + span; j++) {
    const cellDots = grid.get(key(i, j));
    if (!cellDots) continue;
    for (const d of cellDots) {
      const dist = Math.hypot(d.cx - x, d.cy - y);
      if (dist <= d.r) { if (!inside || d.r < inside.r) inside = d; }
      else if (dist - d.r <= reach && dist - d.r < nd) { nd = dist - d.r; near = d; }
    }
  }
  return inside || near;
}
// the next dot when an arrow key is pressed: the nearest one inside a cone around that direction
export function stepCursor(items, from, dir) {
  const vx = dir === "left" ? -1 : dir === "right" ? 1 : 0, vy = dir === "up" ? -1 : dir === "down" ? 1 : 0;
  let best = null, bs = Infinity;
  for (const it of items) {
    if (it === from) continue;
    const dx = it.cx - from.cx, dy = it.cy - from.cy, along = dx * vx + dy * vy;
    if (along < 0.5) continue;
    const across = Math.abs(dx * vy - dy * vx);
    if (across > along * 1.7) continue;
    const score = along + across * 1.6;
    if (score < bs) { bs = score; best = it; }
  }
  return best;
}

// the three reference sizes of the size key: powers of ten below the largest value
export function legendSizes(vmax) {
  if (!(vmax > 0)) return [];
  const top = Math.floor(Math.log10(vmax)), values = top >= 3 ? [10 ** (top - 2), 10 ** (top - 1), 10 ** top] : [Math.round(vmax / 4), Math.round(vmax / 2), Math.round(vmax)].filter((v) => v > 0);
  return values.map((value) => ({ value, r: dotRadius(value, vmax) }));
}

// the wording of the chart for a screen reader: the city's figure first, then the context
export function describe(model, o = {}) {
  if (!model.total) return "מפת היישובים: אין נתונים להצגה.";
  const parts = ["מפת היישובים" + (o.label ? ` לפי ${o.label}` : "")], s = model.self;
  if (s) parts.push(s.hasValue ? `${s.name}: ${valueText(o.unit, s.v)}${standingText(s, model.dir) ? ", " + standingText(s, model.dir) : ""}` : `${s.name}: אין נתון`);
  if (isNum(o.nat)) parts.push(`הממוצע הארצי ${valueText(o.unit, o.nat)}`);
  parts.push(`${num(model.total, 0)} יישובים`);
  return parts.join(". ") + ".";
}
// the few localities a screen reader gets in a table: the city, peers, the five strongest and the five weakest
export function notable(model) {
  const j = model.dots.filter((d) => d.hasValue && d.reliable).sort((a, b) => (model.dir === "lower" ? a.v - b.v : b.v - a.v)), pick = new Set();
  if (model.self) pick.add(model.self);
  j.slice(0, 5).forEach((d) => pick.add(d));
  j.slice(-5).forEach((d) => pick.add(d));
  model.dots.filter((d) => d.peer).forEach((d) => pick.add(d));
  return [...pick];
}

// ───────────────────────────── DOM ─────────────────────────────

const shorten = (t, n = 15) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
const px = (v) => Math.round(v * 10) / 10;

// the answer in words: where the city stands (it leads the page on a phone and tops the legend column on a wide screen)
function sumEl(m, o) {
  const me = m.self;
  if (!me) return null;
  const line = standingText(me, m.dir) || (me.hasValue ? valueText(o.unit, me.v) : "אין נתון");
  return h("div.v-map-sum", h("span.nm", me.name), h("b", line), me.rank != null && m.judged ? h("small", `מקום ${num(me.rank, 0)} מתוך ${num(m.judged, 0)}`) : null);
}

function legendEl(m, o) {
  const seq = !m.dir, kids = [];
  if (!m.total) return h("div.v-map-legend");
  if (m.enough) {
    kids.push(h("div.v-map-scale",
      h("p.v-map-lt", seq ? "הצבע לפי גובה הערך מבין כולם" : "הצבע לפי מקום היישוב מבין כולם"),
      h("div.v-map-bar" + (seq ? ".seq" : ""), { "aria-hidden": "true", style: { background: scaleGradient(seq) } }),
      h("div.v-map-ends", h("span", seq ? "נמוך" : "חלש"), h("span", seq ? "גבוה" : "חזק"))));
  }
  if (m.sizeKind) {
    kids.push(h("div.v-map-size",
      h("p.v-map-lt", m.sizeKind === "pop" ? "גודל הנקודה = מספר התושבים" : "גודל הנקודה = גודל הקבוצה שנמדדה"),
      h("div.v-map-sizes", legendSizes(m.vmax).map((s) => h("span",
        svg("svg", { width: 2 * R_MAX + 2, height: 2 * s.r + 2, viewBox: `0 0 ${2 * R_MAX + 2} ${2 * s.r + 2}`, "aria-hidden": "true" }, svg("circle", { cx: R_MAX + 1, cy: s.r + 1, r: s.r })),
        h("small", num(s.value, 0)))))));
  }
  const keys = [];
  if (m.hasPeers) keys.push(h("li", h("i.k-peer"), "יישובים דומים"));
  if (m.hasSmall) keys.push(h("li", h("i.k-small"), "קבוצה קטנה, ללא דירוג"));
  if (m.hasMissing || m.ctx.length) keys.push(h("li", h("i.k-none"), "אין נתון"));
  if (keys.length) kids.push(h("ul.v-map-keys", keys));
  if (isNum(o.nat)) kids.push(h("p.v-map-nat", "ממוצע ארצי ", h("b", valueText(o.unit, o.nat))));
  return h("div.v-map-legend", kids);
}

function tipNodes(d, m, o) {
  const rows = [tipHead(d.name || "יישוב")];
  const sw = h("i.v-map-sw" + (d.hollow ? ".hollow" : ""), d.hollow ? null : { style: { background: d.fill } });
  rows.push(h("div.tr", h("span.k", sw, o.label || "ערך"), h("b", d.hasValue ? valueText(o.unit, d.v) : "אין נתון")));
  const st = d.hasValue ? standingText(d, m.dir) : "", rk = d.rank != null && m.judged ? `מקום ${num(d.rank, 0)} מתוך ${num(m.judged, 0)}` : "";
  if (st) rows.push(h("div.v-map-tts", st));
  if (rk) rows.push(h("div.v-map-tts", rk));
  if (m.sizeKind === "pop" && d.pop != null) rows.push(h("div.tr", h("span.k", "תושבים"), h("b", num(d.pop, 0))));
  else if (m.sizeKind === "group" && d.d != null) rows.push(h("div.tr", h("span.k", "גודל הקבוצה"), h("b", num(d.d, 0))));
  if (d.peer) rows.push(h("div.v-map-tts.peer", "יישוב דומה"));
  return rows;
}
const plainTip = (d, m, o) => [d.name, d.hasValue ? valueText(o.unit, d.v) : "אין נתון", d.hasValue ? standingText(d, m.dir) : "", d.rank != null ? `מקום ${num(d.rank, 0)} מתוך ${num(m.judged, 0)}` : ""].filter(Boolean).join(", ");

export function dotMap(opts = {}) {
  const o = { peers: [], height: 540, direction: null, ...opts };
  const root = h("div.v-map");
  let first = true, limit = LEGEND_MIN + STACK_GAP + 300, stopAway = null;

  const render = (geo) => {
    const L = mapLayout(o.height), m = prepare({ ...o, geo });
    placeDots(m, L);
    const self = m.self, dir = m.dir, ox = self ? self.cx : L.W / 2, oy = self ? self.cy : L.H / 2;
    assignWave(m, ox, oy);
    limit = L.W + STACK_GAP + LEGEND_MIN;

    const s = svg("svg", { class: "v-map-svg" + (o.onPick ? " pick" : ""), width: L.W, height: L.H, viewBox: `0 0 ${L.W} ${L.H}` });
    const useFade = m.dots.length > 700;                              // a thousand springs are too much; the big maps just fade in
    const dotClass = useFade ? "fade" : "pop";

    // the city's chip is placed first, then the place names take whatever free space is left
    const label = o.ariaLabel || describe(m, o), chH = 44, avoid = [];
    let chip = null, chipText = null;
    if (self) {
      const nameT = shorten(self.name || "היישוב"), valT = self.hasValue ? valueText(o.unit, self.v) : "אין נתון";
      const cw = Math.round(clamp(Math.max(textWidth(nameT, 12, 600), textWidth(valT, 15, 800)) + 22, 66, 132));
      chip = placeChip({ cx: self.cx, cy: self.cy, r: self.r + 3, w: cw, h: chH, dots: m.dots.filter((d) => !d.self), W: L.W, H: L.H });
      chipText = [nameT, valT];
      const ang = Math.atan2(chip.ay - self.cy, chip.ax - self.cx);
      chip.sx = self.cx + Math.cos(ang) * (self.r + 3); chip.sy = self.cy + Math.sin(ang) * (self.r + 3);
      avoid.push({ x: chip.x, y: chip.y, w: chip.w, h: chip.h }, { x: Math.min(chip.sx, chip.ax) - 3, y: Math.min(chip.sy, chip.ay) - 3, w: Math.abs(chip.ax - chip.sx) + 6, h: Math.abs(chip.ay - chip.sy) + 6 },
        { x: self.cx - self.r - 14, y: self.cy - self.r - 14, w: 2 * self.r + 28, h: 2 * self.r + 28 });
    }
    const names = [];
    for (const a of m.total ? pickAnchors(m.places, L, m.vmax, { max: 10, skip: self ? self.k : null, away: self }) : []) {      // more candidates than names: a name that finds no free spot makes room for the next
      if (names.length >= MAX_NAMES) break;
      const w = Math.ceil(textWidth(a.short, 11, 600)) + 2, b = placeBox({ cx: a.cx, cy: a.cy, r: a.r + 1.5, w, h: 13, dots: m.dots.filter((d) => d.k !== a.k), avoid, W: L.W, H: L.H, gap: 3, maxShift: 20, maxDy: 14, clear: 1.5 });
      if (b && b.hits === 0) { names.push({ a, b }); avoid.push({ x: b.x, y: b.y, w: b.w, h: b.h }); }
    }

    // the field: everything that dims while one dot is highlighted (the city, its chip and the highlighted dot stay bright)
    const field = svg("g", { class: "v-map-field" });
    // layer 1: localities without a figure, as one faint path (zero-length strokes with round caps are dots)
    if (m.ctxPts.length) field.append(svg("path", { class: "v-map-ctx fade", style: "--i:0", d: m.ctxPts.map(([x, y]) => `M${px(x)} ${px(y)}h.01`).join(""), "aria-hidden": "true" }));
    // layer 2: the dots, the largest first; peers and the city are drawn above them
    const gDots = svg("g", { class: "v-map-dots", "aria-hidden": "true" }), gPeers = svg("g", { class: "v-map-peers fade", style: "--i:8", "aria-hidden": "true" });
    for (const d of m.dots) {
      if (d.self) continue;
      const c = svg("circle", { class: "v-map-dot" + (d.hollow ? " hollow" : "") + (d.peer ? " peer" : "") + (d.peer ? "" : " " + dotClass), cx: px(d.cx), cy: px(d.cy), r: px(d.r),
        style: (d.hollow ? "" : `fill:${d.fill};`) + (d.peer ? "" : `--i:${d.i}`) });
      (d.peer ? gPeers : gDots).append(c);
    }
    field.append(gDots, gPeers);
    // layer 3: the names of the largest places, quiet, so that the dots read as a country
    if (names.length) field.append(svg("g", { class: "v-map-places fade", style: "--i:6", "aria-hidden": "true" },
      names.map(({ a, b }) => svg("text", { x: px(b.side === 1 ? b.x : b.x + b.w), y: px(b.y + 10), "text-anchor": b.side === 1 ? "start" : "end" }, a.short))));
    s.append(field);

    // layer 4: the city (halo, pulse, dot, leader and label chip). It is the keyboard's tab stop.
    let focusEl;
    if (self) {
      const tone = self.hollow ? "var(--surface)" : self.fill, r = self.r, c = chip, cw = c.w;
      // the city's chrome (halo, pulse, ring, leader, chip) is always the city blue; the dot inside keeps its standing colour
      focusEl = svg("g", { class: "v-map-me", tabindex: "0", role: "application", "aria-roledescription": "מפה", "aria-label": label },
        svg("circle", { class: "v-map-halo fade", style: "--i:0", cx: px(self.cx), cy: px(self.cy), r: px(r + 11) }),
        svg("line", { class: "v-map-lead fade", style: "--i:2", x1: px(c.sx), y1: px(c.sy), x2: px(c.ax), y2: px(c.ay) }),
        svg("g", { class: "v-map-chip rise", style: "--i:8" },
          svg("rect", { x: px(c.x), y: px(c.y), width: cw, height: chH, rx: 10 }),
          svg("text", { class: "n", x: px(c.x + cw / 2), y: px(c.y + 17), "text-anchor": "middle" }, chipText[0]),
          svg("text", { class: "v", x: px(c.x + cw / 2), y: px(c.y + 36), "text-anchor": "middle" }, chipText[1])),
        svg("g", { class: "fade", style: "--i:12" }, svg("circle", { class: "ping v-map-ping", cx: px(self.cx), cy: px(self.cy), r: px(r + 5) })),
        svg("circle", { class: "v-map-ring pop", style: "--i:0", cx: px(self.cx), cy: px(self.cy), r: px(r + 3.9) }),
        svg("circle", { class: "v-map-self pop" + (self.hollow ? " hollow" : ""), style: (self.hollow ? "" : `fill:${tone};`) + "--i:0", cx: px(self.cx), cy: px(self.cy), r: px(r) }),
        svg("circle", { class: "v-map-focus", cx: px(self.cx), cy: px(self.cy), r: px(r + 9) }));
      s.append(focusEl);
    } else {
      focusEl = svg("rect", { class: "v-map-frame", tabindex: "0", role: "application", "aria-roledescription": "מפה", "aria-label": label, x: 0, y: 0, width: L.W, height: L.H, rx: 12 });
      s.append(focusEl);
    }

    if (!m.total) s.append(svg("text", { class: "v-map-empty", x: px(L.W / 2), y: px(L.H / 2), "text-anchor": "middle" }, "אין נתונים להצגה על המפה"));

    // layer 5: the highlighted dot
    const hotRing = svg("circle", { class: "ring", r: 0 }), hotDot = svg("circle", { class: "dot", r: 0 });
    const hotG = svg("g", { class: "v-map-hot", "aria-hidden": "true" }, hotRing, hotDot);
    s.append(hotG);

    // interaction: one pair of listeners on the svg and a grid index instead of a listener (and a hit area) per dot
    const live = h("div.sr", { "aria-live": "polite", "aria-atomic": "true" }), index = makeIndex(m.dots);
    let hot = null;
    const setHot = (d) => {
      if (hot === d) return;
      hot = d;
      s.classList.toggle("dim", !!d);                              // css/viz/spatial.css fades .v-map-field
      hotG.classList.toggle("on", !!d);
      if (!d) return;
      const col = d.hollow ? "var(--ink-3)" : d.fill;
      hotRing.setAttribute("cx", px(d.cx)); hotRing.setAttribute("cy", px(d.cy)); hotRing.setAttribute("r", px(d.r + 3.5));
      hotDot.setAttribute("cx", px(d.cx)); hotDot.setAttribute("cy", px(d.cy)); hotDot.setAttribute("r", px(d.r + 0.6));
      hotDot.classList.toggle("hollow", d.hollow);
      hotDot.style.fill = d.hollow ? "" : col;
    };
    const local = (ev) => { const r = s.getBoundingClientRect(), k = r.width ? L.W / r.width : 1; return { x: (ev.clientX - r.left) * k, y: (ev.clientY - r.top) * k, k }; };
    const probe = (ev) => {
      const p = local(ev), d = nearestDot(index, p.x, p.y, (ev.pointerType === "touch" ? 20 : 9) * p.k);
      if (d !== hot) { setHot(d); if (d) tip.show(tipNodes(d, m, o), ev); else tip.hide(); } else if (d) tip.move(ev);
      return d;
    };
    s.addEventListener("pointermove", (ev) => { if (ev.pointerType !== "touch") probe(ev); });
    s.addEventListener("pointerdown", (ev) => { if (ev.pointerType === "touch") probe(ev); });
    s.addEventListener("pointerleave", (ev) => { if (ev.pointerType !== "touch") { setHot(null); tip.hide(); } });
    s.addEventListener("pointercancel", () => { setHot(null); tip.hide(); });
    s.addEventListener("click", (ev) => { if (!o.onPick) return; const d = probe(ev); if (d) o.onPick(d.raw); });
    // a tap outside the map closes its tooltip (touch has no pointerleave); the listener of the previous render goes away with it
    if (stopAway) stopAway();
    const away = (ev) => { if (!root.isConnected) return stopAway(); if (!s.contains(ev.target)) { setHot(null); tip.hide(); } };
    document.addEventListener("pointerdown", away, { passive: true });
    stopAway = () => { document.removeEventListener("pointerdown", away); stopAway = null; };

    // keyboard: a cursor that walks from dot to dot
    let cursor = null;
    const goto = (d) => {
      cursor = d; setHot(d);
      const r = s.getBoundingClientRect(), k = r.width ? r.width / L.W : 1;
      tip.show(tipNodes(d, m, o), { clientX: r.left + d.cx * k, clientY: r.top + d.cy * k });
      live.textContent = plainTip(d, m, o);
    };
    const home = () => self || m.dots.reduce((b, d) => (!b || Math.hypot(d.cx - L.W / 2, d.cy - L.H / 2) < Math.hypot(b.cx - L.W / 2, b.cy - L.H / 2) ? d : b), null);
    const KEYS = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    focusEl.addEventListener("focus", () => { const d = home(); if (d && !cursor) goto(d); });
    focusEl.addEventListener("blur", () => { cursor = null; setHot(null); tip.hide(); });
    focusEl.addEventListener("keydown", (ev) => {
      const dir2 = KEYS[ev.key];
      if (dir2) { ev.preventDefault(); const from = cursor || home(), next = from && stepCursor(m.dots, from, dir2); if (next) goto(next); }
      else if (ev.key === "Home") { ev.preventDefault(); const d = home(); if (d) goto(d); }
      else if (ev.key === "Escape") { cursor = null; setHot(null); tip.hide(); }
      else if ((ev.key === "Enter" || ev.key === " ") && o.onPick && cursor) { ev.preventDefault(); o.onPick(cursor.raw); }
    });

    const rows = notable(m).map((d) => [d.name, d.hasValue ? valueText(o.unit, d.v) : "אין נתון", d.rank != null ? `${num(d.rank, 0)} מתוך ${num(m.judged, 0)}` : ""]);
    const legend = legendEl(m, o), hasLegend = legend.childNodes.length > 0;
    root.replaceChildren(...[sumEl(m, o), h("div.v-map-stage", s), hasLegend ? legend : null, live, srTable("יישובים בולטים במפה", ["יישוב", "ערך", "מקום"], rows)].filter(Boolean));
    root.classList.toggle("solo", !hasLegend);
    if (first) { first = false; viz(root, { label, role: "group" }); } else root.setAttribute("aria-label", label);
    root.dataset.drawn = String(m.dots.length);
  };

  if (Array.isArray(o.geo)) render(o.geo);
  else if (o.geo === undefined) getGeo().then((g) => render(Array.isArray(g) ? g : null), () => render(null));
  else render(null);

  // the legend sits beside the map when the container is wide enough, under it when not
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { const w = root.clientWidth; if (w > 0) root.classList.toggle("narrow", w < limit); }).observe(root);
  return root;
}

// ───────────────────────────── the locator ─────────────────────────────

// A tiny map for hero sections: every locality is a 2px dot (drawn as one path), the city a teal dot with a pulse. Decorative.
export function locator({ geo, cityKey, width = 120, ariaLabel } = {}) {
  const W = clamp(Math.round(toNum(width) || 120), 40, 800), root = h("div.v-map-loc");
  let first = true;
  const build = (list) => {
    const pts = (Array.isArray(list) ? list : []).filter((g) => g && toNum(g.x) != null && toNum(g.y) != null);
    const pad = Math.max(5, Math.round(W * 0.07)), f0 = geoFrame(W, 99999, pad), H = Math.round(f0.height + 2 * pad), f = geoFrame(W, H, pad);
    const dot = clamp(W / 60, 1.6, 3.2), me = cityKey != null ? pts.find((g) => String(g.k) === String(cityKey)) : null;
    const d = pts.map((g) => `M${px(f.X(g.x))} ${px(f.Y(g.y))}h.01`).join("");
    const s = svg("svg", { class: "v-map-loc-svg", width: W, height: H, viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });
    if (d) s.append(svg("path", { class: "v-map-loc-dots fade", style: "--i:0", d, "stroke-width": px(dot) }));
    if (me) {
      const cx = px(f.X(me.x)), cy = px(f.Y(me.y)), r = clamp(W / 28, 3.2, 6);
      s.append(svg("g", { class: "fade", style: "--i:6" }, svg("circle", { class: "ping v-map-loc-ping", cx, cy, r: px(r + 2) })), svg("circle", { class: "v-map-loc-city pop", style: "--i:4", cx, cy, r: px(r) }));
    }
    root.replaceChildren(s);
    const label = ariaLabel || (me && me.n ? `מיקום ${me.n} על המפה` : "מיקום היישוב על המפה");
    if (first) { first = false; viz(root, { label }); } else root.setAttribute("aria-label", label);
  };
  if (Array.isArray(geo)) build(geo);
  else if (geo === undefined) getGeo().then((g) => build(g), () => build([]));
  else build([]);
  return root;
}
