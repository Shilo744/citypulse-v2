// One figure on one axis: the town, similar localities and the national mean, each marker named and valued right next to it (no key to decode).
// Better is always to the right (the axis flips when a lower number is better). The line joins the town to the national mean and wears the verdict's colour.
// Tokens only; the marks use the shared vocabulary (fade, draw, pop, rise) and the chart redraws itself when its column changes width.
import { h, svg, viz, fit, clamp, C, fmtVal } from "../../viz/core.js";
import { textWidth } from "../../viz/time.js";
import { compareLine } from "../../ui.js";
import { isNum } from "./util.js";

const px = (n) => Math.round(n * 10) / 10;

// the axis: the values with air around them, flipped when lower is better; a percentage never leaves 0..100
export function bellScale(values, { unit = "", direction = null, width = 280, margin = 22 } = {}) {
  const v = values.filter(isNum);
  if (!v.length) return null;
  const lo0 = Math.min(...v), hi0 = Math.max(...v), span = hi0 - lo0, pad = span > 0 ? span * 0.3 : Math.max(Math.abs(hi0) * 0.06, 1);
  let lo = lo0 - pad, hi = hi0 + pad;
  if (unit === "%") { lo = Math.max(0, lo); hi = Math.min(100, hi); if (hi - lo < 2) { lo = Math.max(0, lo0 - 1); hi = Math.min(100, hi0 + 1); } }
  const inner = Math.max(1, width - 2 * margin), flip = direction === "lower";
  return { lo, hi, flip, x: (val) => px(margin + ((flip ? hi - val : val - lo) / (hi - lo || 1)) * inner) };
}

// label boxes that must not overlap: left to right, a box that would touch the one before it in its row drops to the next row
export function stackLabels(items, width, gap = 8) {
  const ends = [], out = [];
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    const cx = clamp(it.x, it.w / 2, Math.max(it.w / 2, width - it.w / 2));
    let row = 0;
    while (ends[row] != null && cx - it.w / 2 < ends[row] + gap) row++;
    ends[row] = cx + it.w / 2;
    out.push({ ...it, cx, row });
  }
  return out;
}

const clip = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

function draw(a, cityName, refs, W) {
  const L = a.last, tone = compareLine(a).tone, AY = 46, ROW = 32;
  const all = [{ key: "city", name: clip(cityName, 16), v: L.v, color: C.city, r: 8.5 }, ...refs];
  const sc = bellScale(all.map((p) => p.v), { unit: a.unit, direction: a.direction, width: W });
  const dec = a.unit === "index" ? 2 : 1;
  const pts = all.map((p) => { const val = fmtVal(a.unit, p.v, dec); return { ...p, x: sc.x(p.v), val, w: Math.ceil(Math.max(textWidth(p.name, 11.5, 600), textWidth(val, 13.5, 800))) + 10 }; });
  const city = pts[0], others = pts.slice(1);
  const below = stackLabels(others, W), rows = below.reduce((m, p) => Math.max(m, p.row + 1), 1), H = AY + 40 + (rows - 1) * ROW;
  const s = svg("svg", { class: "lr-bell-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true", focusable: "false" });
  s.append(svg("line", { class: "fade lr-bell-base", style: "--i:0", x1: 8, x2: W - 8, y1: AY, y2: AY }));
  const anchor = others.find((p) => p.key === "nat") || others[0];
  const x1 = Math.min(city.x, anchor.x), x2 = Math.max(city.x, anchor.x);
  s.append(svg("line", { class: "draw lr-bell-link t-" + tone, style: `--len:${px(x2 - x1)};--i:1`, x1, x2, y1: AY, y2: AY }));
  [...others].reverse().concat(city).forEach((p, i) => s.append(svg("circle", { class: "pop lr-bell-dot lr-bell-" + p.key, style: `--i:${i + 1}`, cx: p.x, cy: AY, r: p.r || 5.5, fill: p.color })));
  const cw = city.w, ccx = clamp(city.x, cw / 2, Math.max(cw / 2, W - cw / 2));
  s.append(svg("text", { class: "rise lr-bell-name", style: "--i:3", x: px(ccx), y: AY - 28, "text-anchor": "middle" }, city.name),
    svg("text", { class: "rise lr-bell-val is-city", style: "--i:3", x: px(ccx), y: AY - 14, "text-anchor": "middle" }, city.val));
  below.forEach((p, i) => {
    const y = AY + 23 + p.row * ROW;
    s.append(svg("text", { class: "rise lr-bell-name", style: `--i:${4 + i}`, x: px(p.cx), y, "text-anchor": "middle" }, p.name),
      svg("text", { class: "rise lr-bell-val", style: `--i:${4 + i}`, x: px(p.cx), y: y + 15, "text-anchor": "middle" }, p.val));
  });
  return s;
}

// a() is a model indicator; returns null when there is nothing to put the town next to, or when the group is too small to compare
export function bell(a, cityName) {
  const L = a.last;
  if (!L || !isNum(L.v) || L.reliable === false) return null;
  const refs = [];
  if (isNum(L.peer)) refs.push({ key: "peer", name: "יישובים דומים", v: L.peer, color: C.peer, r: 6 });
  if (isNum(L.nat)) refs.push({ key: "nat", name: "ממוצע ארצי", v: L.nat, color: C.nat, r: 6 });
  if (!refs.length) return null;
  const host = h("div.lr-bell");
  host.style.minHeight = "92px";
  const label = `${cityName}: ${fmtVal(a.unit, L.v)}` + refs.map((r) => `, ${r.name}: ${fmtVal(a.unit, r.v)}`).join("") + (a.direction ? ". ימינה טוב יותר" : "");
  viz(host, { label });
  fit(host, (W) => host.replaceChildren(draw(a, cityName, refs, W)), { min: 120 });
  return host;
}
