// Pure helpers for the charts: ticks, scales, arcs, the map projection, label spreading, distributions.
// No DOM in this file, so node tests can import it (tests/viz.test.mjs).

export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// round tick values that cover [lo, hi]
export function niceTicks(lo, hi, n = 4) {
  if (!(hi > lo)) hi = lo + 1;
  const step0 = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(step0)), norm = step0 / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step, t = [];
  for (let v = a; v <= b + step / 2; v += step) t.push(Math.round(v * 1e6) / 1e6);
  return t;
}

// a linear scale from a domain to a range
export function linear(d0, d1, r0, r1) {
  const k = (r1 - r0) / (d1 - d0 || 1);
  return (v) => r0 + (v - d0) * k;
}

// the range of some values, widened by a share of their span; keeps a minimum span and optional hard limits
export function padExtent(vals, share = 0.12, { min = -Infinity, max = Infinity, minSpan = 0 } = {}) {
  const xs = vals.filter((v) => v != null && isFinite(v));
  if (!xs.length) return [0, 1];
  let lo = Math.min(...xs), hi = Math.max(...xs);
  if (hi - lo < minSpan) { const mid = (lo + hi) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
  const pad = (hi - lo) * share;
  return [Math.max(min, lo - pad), Math.min(max, hi + pad)];
}

// angles run clockwise from 12 o'clock, in radians
export const polar = (cx, cy, r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
// an SVG arc path from angle a0 to a1 (a full circle needs a1 - a0 a hair under TAU)
export function arcPath(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0), [x1, y1] = polar(cx, cy, r, a1);
  const sweep = a1 - a0, large = Math.abs(sweep) > Math.PI ? 1 : 0, dir = sweep >= 0 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} ${dir} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
// a donut slice (outer radius r1, inner radius r0) between two angles, as a closed path
export function slicePath(cx, cy, r0, r1, a0, a1) {
  const [ox0, oy0] = polar(cx, cy, r1, a0), [ox1, oy1] = polar(cx, cy, r1, a1), [ix1, iy1] = polar(cx, cy, r0, a1), [ix0, iy0] = polar(cx, cy, r0, a0);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M${ox0.toFixed(2)} ${oy0.toFixed(2)}A${r1} ${r1} 0 ${large} 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)}L${ix1.toFixed(2)} ${iy1.toFixed(2)}A${r0} ${r0} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}Z`;
}

// Israel's frame: longitude 34.2..35.9, latitude 29.45..33.35. East-west distances are squeezed by cos(latitude) so that the country keeps its shape.
export const ISRAEL = { x0: 34.2, x1: 35.9, y0: 29.45, y1: 33.35 };
export function geoFrame(w, h, pad = 10, box = ISRAEL) {
  const k = Math.cos((((box.y0 + box.y1) / 2) * Math.PI) / 180), dx = (box.x1 - box.x0) * k, dy = box.y1 - box.y0;
  const s = Math.min((w - 2 * pad) / dx, (h - 2 * pad) / dy), ox = (w - dx * s) / 2, oy = (h - dy * s) / 2;
  return { X: (lon) => ox + (lon - box.x0) * k * s, Y: (lat) => oy + (box.y1 - lat) * s, scale: s, width: dx * s, height: dy * s, aspect: dy / dx };
}

// one-dimensional label spreading: items [{ y, h }] are moved apart so that boxes of height h (plus gap) do not touch, staying inside [lo, hi]
export function spread(items, gap = 2, lo = -Infinity, hi = Infinity) {
  const a = items.map((o, i) => ({ ...o, i, py: o.y })).sort((p, q) => p.y - q.y);
  for (let pass = 0; pass < 14; pass++) {
    let moved = false;
    for (let i = 1; i < a.length; i++) {
      const need = (a[i - 1].h + a[i].h) / 2 + gap, d = a[i].y - a[i - 1].y;
      if (d < need - 0.01) { const m = (need - d) / 2; a[i - 1].y -= m; a[i].y += m; moved = true; }
    }
    a.forEach((o) => { o.y = clamp(o.y, lo + o.h / 2, hi - o.h / 2); });
    if (!moved) break;
  }
  return a.sort((p, q) => p.i - q.i);
}

export function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// the share (0-100) of the values that this value beats; direction "lower" means a lower value is the better one
export function levelOf(values, v, direction) {
  if (!values.length) return null;
  let worse = 0;
  for (const x of values) if (direction === "lower" ? x > v : x < v) worse++;
  return (worse / values.length) * 100;
}

// equal-width bins over [lo, hi]: { counts, width }
export function histBins(values, lo, hi, nb) {
  const width = (hi - lo) / nb || 1, counts = Array.from({ length: nb }, () => 0);
  for (const v of values) { if (v < lo || v > hi) continue; counts[Math.min(nb - 1, Math.floor((v - lo) / width))]++; }
  return { counts, width };
}

// bubble radius from an area-proportional rule
export const sqrtRadius = (v, vmax, rmin, rmax) => rmin + (rmax - rmin) * Math.sqrt(Math.max(0, v) / (vmax || 1));

// the order in which statuses are listed and drawn: the worst first
export const STATUS_ORDER = ["concern", "watch", "stale", "uncertain", "na", "good", "strength"];
export const statusRank = (s) => { const i = STATUS_ORDER.indexOf(s); return i < 0 ? STATUS_ORDER.length : i; };
