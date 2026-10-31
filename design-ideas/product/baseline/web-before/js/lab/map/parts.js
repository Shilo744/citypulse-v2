// Pieces made for the city overview (pages/overview.js). They follow the chart contract (DESIGN_V3.md): tokens only, motion only through the vocabulary
// of css/motion.css, an aria-label, one tab stop with a tooltip. Candidates to be promoted to the shared library later.
//
//   heroMap({ geo, cityKey, city: { name, x, y }, height })      the country as a field of dots (every locality), the town ringed and named. Decorative.
//   tickRing({ value, total, ticks = 60 })                       a ring of ticks, the first `value` of `total` lit in the concern colour (dark mode hero)
//   miniDumbbell(a, cityName, { w, h })                          one indicator: the town, similar localities and the national mean on one axis (better = right)
//   domainBand({ domains })                                      one tinted segment per domain, each a link, worst first
import { h, svg, num, fmtVal, icon, tip, tipHead, tipRow, viz, bindTip, clamp, geoFrame, uid, C } from "../../viz/core.js";
import { sortDomains, stripWords, stripParts } from "../../viz/matrix.js";
import { textWidth } from "../../viz/spatial.js";

const isNum = (v) => typeof v === "number" && isFinite(v);
const px = (n) => Math.round(n * 10) / 10;

// ───────────────────────────── pure geometry (tested) ─────────────────────────────

// dots grouped by distance ring from the town (0..rings) and by size class, so that the whole country is a few dozen <path>s, not 1,200 nodes
export const DOT_WIDTH = [2.8, 4.2, 5.8, 8];
export function dotClass(r) { return r < 2 ? 0 : r < 3 ? 1 : r < 4 ? 2 : 3; }
export function dotRadius(p, pmax) { return 1.6 + 3.6 * Math.sqrt(Math.max(0, p || 0) / (pmax > 0 ? pmax : 1)); }
export function ringOf(dist, far, rings = 12) { return far > 0 ? clamp(Math.round((dist / far) * rings), 0, rings) : 0; }

// how many of `ticks` are lit for value out of total (at least one when value > 0, never all when value < total)
export function litTicks(value, total, ticks = 60) {
  if (!isNum(value) || !isNum(total) || total <= 0 || value <= 0) return 0;
  const n = Math.round((Math.min(value, total) / total) * ticks);
  return value >= total ? ticks : clamp(n, 1, ticks - 1);
}

// the axis of one dumbbell row: the domain of the values with some air, flipped when lower is better so that better is always to the right
export function dumbbellScale(values, { unit = "", direction = null, width = 250, margin = 12 } = {}) {
  const v = values.filter(isNum);
  if (!v.length) return null;
  const lo0 = Math.min(...v), hi0 = Math.max(...v), span = hi0 - lo0;
  const pad = span > 0 ? span * 0.24 : Math.max(Math.abs(hi0) * 0.06, 1);
  let lo = lo0 - pad, hi = hi0 + pad;
  if (unit === "%") { lo = Math.max(0, lo); hi = Math.min(100, hi); if (hi - lo < 2) { lo = Math.max(0, lo0 - 1); hi = Math.min(100, hi0 + 1); } }
  const inner = Math.max(1, width - 2 * margin), flip = direction === "lower";
  return { lo, hi, flip, x: (val) => px(margin + (flip ? (hi - val) : (val - lo)) / (hi - lo || 1) * inner) };
}

// the value labels under a dumbbell: left to right, a label that would sit closer than `gap` px to one already kept is dropped (the tooltip has all values)
export function keepLabels(items, gap = 40) {
  const kept = [];
  for (const it of [...items].sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9))) if (kept.every((k) => Math.abs(k.x - it.x) >= gap)) kept.push(it);
  return kept;
}

// ───────────────────────────── the hero map ─────────────────────────────

export function heroMap({ geo, cityKey, city, height = 760, ariaLabel } = {}) {
  const root = h("div.lm-hmap");
  const pts = (Array.isArray(geo) ? geo : []).filter((g) => g && isNum(Number(g.x)) && isNum(Number(g.y))).map((g) => ({ ...g, x: Number(g.x), y: Number(g.y), p: Number(g.p) || 0 }));
  const H = height, pad = 20, f0 = geoFrame(4000, H, pad), mapW = Math.round(f0.width), gutter = 150, W = mapW + 2 * gutter, f = geoFrame(W, H, pad);
  const me = (cityKey != null && pts.find((g) => String(g.k) === String(cityKey))) || (city && isNum(Number(city.x)) && isNum(Number(city.y)) ? { x: Number(city.x), y: Number(city.y), n: city.name } : null);
  const name = (city && city.name) || (me && me.n) || "";
  const cx = me ? f.X(me.x) : W / 2, cy = me ? f.Y(me.y) : H / 2;
  const pmax = pts.reduce((m, g) => Math.max(m, g.p), 0), buckets = new Map();
  let far = 0;
  const dots = pts.map((g) => { const x = f.X(g.x), y = f.Y(g.y), d = Math.hypot(x - cx, y - cy); far = Math.max(far, d); return { x, y, d, r: dotRadius(g.p, pmax) }; });
  for (const d of dots) {
    const ring = ringOf(d.d, far), cls = dotClass(d.r), k = ring * 10 + cls;
    if (!buckets.has(k)) buckets.set(k, { ring, cls, d: "" });
    buckets.get(k).d += `M${px(d.x)} ${px(d.y)}h.01`;
  }
  const gid = uid("ovg"), s = svg("svg", { class: "lm-hmap-svg", viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true", focusable: "false" });
  s.append(svg("defs", null, svg("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 0, y2: H },
    svg("stop", { offset: "0", style: "stop-color: var(--c-city)" }), svg("stop", { offset: "1", style: "stop-color: var(--teal)" }))));
  const field = svg("g", { class: "lm-hmap-dots" });
  [...buckets.values()].sort((a, b) => a.cls - b.cls || a.ring - b.ring).forEach((b) => field.append(svg("path", { class: `fade lm-hd c${b.cls}`, style: `--i:${b.ring}`, d: b.d, stroke: `url(#${gid})`, "stroke-width": DOT_WIDTH[b.cls], "stroke-linecap": "round", fill: "none" })));
  s.append(field);
  if (me) {
    const tw = textWidth(name, 28, 800), left = cx - 52 - tw > 6, up = cy > 70, dx = left ? -1 : 1, dy = up ? -1 : 1;
    const x1 = px(cx + dx * 11), y1 = px(cy + dy * 11), x2 = px(cx + dx * 40), y2 = px(cy + dy * 40), x3 = px(x2 + dx * 8);
    s.append(svg("g", { class: "lm-hmap-town" },
      svg("circle", { class: "fade lm-hm-halo", style: "--i:0", cx: px(cx), cy: px(cy), r: 30 }),
      svg("circle", { class: "pop lm-hm-ring", style: "--i:0", cx: px(cx), cy: px(cy), r: 15, fill: "none" }),
      svg("circle", { class: "ping lm-hm-ping", cx: px(cx), cy: px(cy), r: 9, fill: "none" }),
      svg("circle", { class: "pop lm-hm-dot", style: "--i:0", cx: px(cx), cy: px(cy), r: 5.4 }),
      svg("path", { class: "draw lm-hm-lead", style: "--len:60;--i:6", d: `M${x1} ${y1}L${x2} ${y2}H${x3}`, fill: "none" }),
      name ? svg("text", { class: "rise lm-hm-name", style: "--i:7", x: px(x3 + dx * 6), y: px(y2 + 7), "text-anchor": left ? "end" : "start" }, name) : null));
  }
  root.append(s);
  root.style.setProperty("--ar", String(px(W / H)));
  root.dataset.cx = String(px(cx / W)); root.dataset.cy = String(px(cy / H));
  viz(root, { label: ariaLabel || (name ? `מפת הארץ: כל יישוב הוא נקודה, ${name} מסומנת` : "מפת הארץ: כל יישוב הוא נקודה") });
  return root;
}

// ───────────────────────────── the tick ring ─────────────────────────────

export function tickRing({ value, total, ticks = 60 } = {}) {
  const n = litTicks(value, total, ticks), R0 = 80, R1 = 96, lines = svg("g"), s = svg("svg", { class: "lm-tr", viewBox: "0 0 200 200", "aria-hidden": "true", focusable: "false" }, lines);
  for (let k = 0; k < ticks; k++) {
    const a = -Math.PI / 2 + (k / ticks) * 2 * Math.PI, c = Math.cos(a), sn = Math.sin(a), lit = k < n;
    lines.append(svg("line", { class: (lit ? "pop lm-tr-on" : "fade lm-tr-off"), style: `--i:${lit ? Math.min(11, Math.floor((k / Math.max(1, n)) * 12)) : 0}`, x1: px(100 + c * R0), y1: px(100 + sn * R0), x2: px(100 + c * R1), y2: px(100 + sn * R1) }));
  }
  s.append(svg("circle", { class: "lm-tr-in", cx: 100, cy: 100, r: 70, fill: "none" }));
  return viz(s);
}

// ───────────────────────────── one indicator on one axis ─────────────────────────────

export function miniDumbbell(a, cityName, { w = 250, h: ht = 50 } = {}) {
  const L = a.last;
  if (!L || !isNum(L.v) || L.reliable === false) return null;
  const rows = [{ key: "nat", label: "ממוצע ארצי", v: L.nat, color: C.nat, r: 5, rank: 1 }, { key: "peer", label: "יישובים דומים", v: L.peer, color: C.peer, r: 5, rank: 2 }, { key: "city", label: cityName, v: L.v, color: C.city, r: 8, rank: 0 }].filter((x) => isNum(x.v));
  if (rows.length < 2) return null;
  const sc = dumbbellScale(rows.map((x) => x.v), { unit: a.unit, direction: a.direction, width: w });
  if (!sc) return null;
  const y = 20, xs = rows.map((x) => sc.x(x.v)), s = svg("svg", { class: "lm-dbs", viewBox: `0 0 ${w} ${ht}`, width: w, height: ht, tabindex: "0" });
  s.append(svg("line", { class: "lm-dbs-base", x1: 6, y1: y, x2: w - 6, y2: y }));
  s.append(svg("line", { class: "fade lm-dbs-link", style: "--i:0", x1: Math.min(...xs), y1: y, x2: Math.max(...xs), y2: y }));
  [...rows].sort((p, q) => q.rank - p.rank).forEach((x, i) => {
    const cx = sc.x(x.v);
    s.append(svg("circle", { class: "pop lm-dbs-dot", style: `--i:${i + 1}`, cx, cy: y, r: x.r, fill: x.color }));
  });
  keepLabels(rows.filter((x) => x.key !== "city").map((x) => ({ ...x, x: sc.x(x.v) })), 44).forEach((x) => s.append(svg("text", { class: "rise lm-dbs-t", style: "--i:3", x: clamp(x.x, 16, w - 16), y: y + 25, "text-anchor": "middle" }, fmtVal(a.unit, x.v))));
  const label = `${cityName}: ${fmtVal(a.unit, L.v)}` + rows.filter((x) => x.key !== "city").map((x) => `, ${x.label}: ${fmtVal(a.unit, x.v)}`).join("") + (a.direction ? ". ימינה טוב יותר" : "");
  viz(s, { label });
  bindTip(s, () => [tipHead(a.short || a.label), ...[...rows].sort((p, q) => sc.x(q.v) - sc.x(p.v)).map((x) => tipRow(x.color, x.label, fmtVal(a.unit, x.v)))]);
  return s;
}

// ───────────────────────────── the domain band ─────────────────────────────

const TONE = { concern: "t-attn", watch: "t-watch", good: "t-good", strength: "t-strong", none: "t-none" };
export function domainTone(c) { return c.concern ? "concern" : c.watch ? "watch" : c.strength ? (c.good ? "good" : "strength") : c.good ? "good" : "none"; }

// the strength of a segment's tint: how much of the domain is in its worst state (a pure function, tested)
export function tintOf(tone, c) {
  const judged = (c.concern || 0) + (c.watch || 0) + (c.good || 0) + (c.strength || 0), share = (n) => (judged ? n / judged : 0);
  const p = tone === "concern" ? 18 + 30 * share(c.concern) : tone === "watch" ? 10 + 12 * share(c.watch) : tone === "good" ? 12 + 10 * share((c.good || 0) + (c.strength || 0)) : tone === "strength" ? 24 + 14 * share(c.strength) : 14;
  return Math.round(p);
}
const NB = "\u00A0";
// domains = [{ id, label, icon, href, indicators: [{ status }] }] ; returns a <nav> of links; the width of a segment follows its number of indicators
export function domainBand({ domains = [], ariaLabel = "מצב כל תחום" } = {}) {
  const list = sortDomains(domains).filter((d) => d.indicators.length);
  const nav = h("nav.lm-band", { "aria-label": ariaLabel });
  list.forEach((d, i) => {
    const t = domainTone(d.counts), words = stripWords(d.counts), worst = stripParts(d.counts)[0], short = (worst.n == null ? "" : worst.n + NB) + worst.word;
    nav.append(h("a.lm-seg.rv." + TONE[t], { href: d.href, style: { "--w": Math.max(2, Math.min(6, d.indicators.length)), "--d": Math.min(i, 6), "--p": tintOf(t, d.counts) }, "aria-label": `${d.label}: ${words}` },
      icon(d.icon || "bars"), h("b", d.label), h("small", short)));
  });
  return nav;
}
