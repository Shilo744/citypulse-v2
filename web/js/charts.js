// SVG / HTML charts. Rules from the data-viz method: 2px lines, markers >= 8px with a 2px surface ring, hairline solid grid,
// bars <= 24px with a rounded data end, a legend for two or more series, selective direct labels, hover tooltip, a table twin.
import { h, svg, clear, debounce, num, fmtVal, tip, tipHead, tipRow, icon } from "./ui.js";

const CITY = "var(--c-city)", PEER = "var(--c-peer)", NAT = "var(--c-nat)", TARGET = "var(--c-target)";

export function niceTicks(lo, hi, n = 4) {
  if (!(hi > lo)) { hi = lo + 1; }
  const step0 = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(step0)), norm = step0 / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const a = Math.floor(lo / step + 1e-9) * step, b = Math.ceil(hi / step - 1e-9) * step, t = [];
  for (let v = a; v <= b + step / 2; v += step) t.push(Math.round(v * 1e6) / 1e6);
  return t;
}

// ── the time charts live in viz/time.js (DESIGN_V3 5.3); these names stay so that pages not rebuilt yet keep working ──
export { lineChart, lineLegend } from "./viz/time.js";
export { sparkArea as sparkline } from "./viz/time.js";

// ── where the city stands among all localities: a histogram with the city's bin in the accent colour ──
export function histogram(host, d) {
  const draw = () => {
    clear(host);
    const W = Math.max(260, Math.floor(host.clientWidth || 600)), H = 170, m = { t: 22, r: 12, b: 24, l: 12 };
    const vals = d.values; if (!vals.length) return;
    let lo = Math.min(...vals, d.city), hi = Math.max(...vals, d.city);
    if (d.unit === "%") { lo = Math.floor(lo / 5) * 5; hi = Math.ceil(hi / 5) * 5; } else { const pad = (hi - lo) * 0.04 || 1; lo -= pad; hi += pad; }
    if (hi === lo) hi = lo + 1;
    const nb = Math.min(24, Math.max(8, Math.round((W - 40) / 22))), bw = (hi - lo) / nb;
    const bins = Array.from({ length: nb }, () => 0);
    vals.forEach((v) => { bins[Math.min(nb - 1, Math.floor((v - lo) / bw))]++; });
    const cmax = Math.max(...bins);
    const X = (v) => m.l + ((v - lo) / (hi - lo)) * (W - m.l - m.r), Y = (c) => H - m.b - (c / cmax) * (H - m.t - m.b);
    const s = svg("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": d.ariaLabel || "התפלגות היישובים" });
    if (d.p25 != null && d.p75 != null) s.append(svg("rect", { x: X(d.p25), y: m.t - 6, width: Math.max(2, X(d.p75) - X(d.p25)), height: H - m.t - m.b + 6, style: { fill: "var(--c-band)" } }));
    const myBin = Math.min(nb - 1, Math.floor((d.city - lo) / bw));
    bins.forEach((c, i) => {
      if (!c) return;
      const x = X(lo + i * bw) + 1, w = Math.max(2, X(lo + (i + 1) * bw) - X(lo + i * bw) - 2);
      const r = svg("rect", { x, y: Y(c), width: w, height: H - m.b - Y(c), rx: 3, style: { fill: i === myBin ? CITY : "var(--c-bin)", cursor: "default" } });
      r.addEventListener("pointermove", (ev) => tip.show([tipHead(`${num(lo + i * bw, 1)}–${num(lo + (i + 1) * bw, 1)}${d.unit === "%" ? "%" : ""}`), tipRow(i === myBin ? CITY : "var(--c-bin)", "יישובים", String(c))], ev));
      r.addEventListener("pointerleave", () => tip.hide());
      s.append(r);
    });
    s.append(svg("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, style: { stroke: "var(--line-2)" } }));
    for (const t of niceTicks(lo, hi, 5)) if (t >= lo && t <= hi) s.append(svg("text", { x: X(t), y: H - 7, "text-anchor": "middle" }, num(t, t % 1 ? 1 : 0)));
    const line = (v, color, dash, w2 = 2) => v != null && v >= lo && v <= hi ? svg("line", { x1: X(v), x2: X(v), y1: m.t - 8, y2: H - m.b, style: { stroke: color, strokeWidth: w2, strokeDasharray: dash || "none" } }) : null;
    s.append(line(d.nat, NAT, null, 2.5), line(d.target, TARGET, "5 4", 1.6));
    s.append(svg("circle", { cx: X(d.city), cy: m.t - 8, r: 5, style: { fill: CITY, stroke: "var(--surface)", strokeWidth: 2 } }),
      svg("text", { x: X(d.city), y: m.t - 14, "text-anchor": X(d.city) > W - 40 ? "end" : X(d.city) < 40 ? "start" : "middle", class: "val" }, num(d.city, 1) + (d.unit === "%" ? "%" : "")));
    host.append(s);
  };
  host.classList.add("chartbox");
  draw();
  if (window.ResizeObserver) { let w = host.clientWidth; new ResizeObserver(debounce(() => { if (Math.abs(host.clientWidth - w) > 2) { w = host.clientWidth; draw(); } })).observe(host); }
}

// ── horizontal bars (rank neighbours, groups inside the city) — HTML so text wraps and reads naturally ──
export function rankBars(items, { unit = "%", max, showRank = true } = {}) {
  const top = max || (unit === "%" ? 100 : Math.max(...items.map((i) => i.v)) * 1.1);
  return h("div.hb" + (showRank ? "" : ".noRank"), items.map((it) => {
    const row = h("div.r" + (it.self ? ".self" : ""), { tabindex: 0 },
      showRank ? h("span.rk", it.rank != null ? String(it.rank) : "") : null,
      h("span.nm", { title: it.name }, it.name),
      h("span.tr", h("i", { style: { width: Math.max(1.5, (it.v / top) * 100) + "%" } }), it.mark != null ? h("b", { style: { insetInlineStart: (it.mark / top) * 100 + "%" }, title: "ממוצע ארצי באותה קבוצה" }) : null),
      h("span.vl", fmtVal(unit, it.v)));
    row.addEventListener("pointermove", (ev) => tip.show([tipHead(it.name), tipRow(it.self ? CITY : "var(--c-bin)", unit === "%" ? "שיעור" : "ערך", fmtVal(unit, it.v)), it.d != null ? tipRow(null, "גודל הקבוצה", num(it.d, 0)) : null, it.mark != null ? tipRow(NAT, "ממוצע ארצי באותה קבוצה", fmtVal(unit, it.mark)) : null].filter(Boolean), ev));
    row.addEventListener("pointerleave", () => tip.hide());
    return row;
  }));
}

// ── status distribution: one stacked bar, 2px gaps, legend with counts ──
export function statusStack(counts, order = [["concern", "דורש טיפול", "var(--attn-bar)"], ["watch", "למעקב", "color-mix(in srgb, var(--attn-bar) 45%, var(--surface))"], ["good", "תקין", "color-mix(in srgb, var(--good-bar) 55%, var(--surface))"], ["strength", "חוזק", "var(--good-bar)"], ["stale", "נתון ישן", "var(--none-bar)"]]) {
  const tot = order.reduce((s, [k]) => s + (counts[k] || 0), 0) || 1;
  const bar = h("div.stack", { role: "img", "aria-label": order.map(([k, l]) => `${l}: ${counts[k] || 0}`).join(", ") },
    order.filter(([k]) => counts[k]).map(([k, l, c]) => h("i", { style: { flex: counts[k] + " 1 0", background: c }, title: `${l}: ${counts[k]}` })));
  const leg = h("div.legend", order.filter(([k]) => counts[k]).map(([k, l, c]) => h("span", h("i.sq", { style: { background: c } }), `${l} ${counts[k]}`)));
  return h("div", bar, leg);
}
// the bar alone, for places too small for a legend (domain tiles)
export const statusBar = (counts) => statusStack(counts).firstChild;

// ── dot row: several localities on one shared axis for one parameter (compare view) ──
export function dotRow(row, { better } = {}) {
  const cells = row.cells.map((c, i) => ({ c, i })).filter((x) => x.c);
  if (!cells.length) return h("span.muted", "אין נתון");
  const vals = cells.map((x) => x.c.v).concat(row.nat ? [row.nat.v] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max((hi - lo) * 0.12, row.unit === "%" ? 2 : (hi || 1) * 0.05); lo -= pad; hi += pad;
  if (row.unit === "%") { lo = Math.max(0, lo); hi = Math.min(100, hi); }
  const host = h("div.chartbox", { style: { height: "38px" } });
  const draw = () => {
    clear(host);
    const W = Math.max(220, host.clientWidth || 400), H = 38, X = (v) => 8 + ((v - lo) / (hi - lo || 1)) * (W - 16);
    const s = svg("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": row.label });
    s.append(svg("line", { x1: 8, x2: W - 8, y1: 21, y2: 21, style: { stroke: "var(--line-2)", strokeWidth: 1 } }));
    if (row.nat) s.append(svg("line", { x1: X(row.nat.v), x2: X(row.nat.v), y1: 8, y2: 34, style: { stroke: NAT, strokeWidth: 2.5 } }));
    [...cells].sort((a, b) => (a.i === 0) - (b.i === 0)).forEach(({ c, i }) => {
      const self = i === 0, name = row.names[i];
      const small = c.reliable === false, col = self ? CITY : PEER;            // a group too small to count is drawn hollow
      const dot = svg("circle", { cx: X(c.v), cy: 21, r: self ? 7 : 5, style: small ? { fill: "var(--surface)", stroke: col, strokeWidth: 2 } : { fill: col, stroke: "var(--surface)", strokeWidth: 2, opacity: self ? 1 : .9 } });
      const hit = svg("circle", { cx: X(c.v), cy: 21, r: 13, fill: "transparent" });
      hit.addEventListener("pointermove", (ev) => tip.show([tipHead(name), tipRow(self ? CITY : PEER, c.year + "", fmtVal(row.unit, c.v)), c.d != null ? tipRow(null, "גודל הקבוצה", num(c.d, 0)) : null, small ? tipRow(null, "הערה", "קבוצה קטנה, לא מדורג") : null].filter(Boolean), ev));
      hit.addEventListener("pointerleave", () => tip.hide());
      s.append(dot, hit);
    });
    s.append(svg("text", { x: 8, y: 9 }, fmtVal(row.unit, lo, 0)), svg("text", { x: W - 8, y: 9, "text-anchor": "end" }, fmtVal(row.unit, hi, 0)));
    if (better) s.append(svg("text", { x: better === "right" ? W - 8 : 8, y: H - 1, "text-anchor": better === "right" ? "end" : "start", style: { fill: "var(--good-ink)", fontWeight: 700 } }, "טוב יותר"));
    host.append(s);
  };
  requestAnimationFrame(draw);
  if (window.ResizeObserver) new ResizeObserver(debounce(draw)).observe(host);
  return host;
}

// ── "table view" twin for a line chart ──
export function seriesTable(rows, columns) {
  return h("div.tscroll", h("table.tbl", h("thead", h("tr", columns.map((c, i) => h("th" + (i ? ".n" : ""), c)))), h("tbody", rows.map((r) => h("tr", r.map((c, i) => h("td" + (i ? ".n" : ""), c == null ? "—" : String(c))))))));
}

export function viewToggle(onChange) {
  const a = h("button", { type: "button", "aria-pressed": "true" }, "גרף"), b = h("button", { type: "button", "aria-pressed": "false" }, "טבלה");
  const set = (v) => { a.setAttribute("aria-pressed", v === "chart"); b.setAttribute("aria-pressed", v === "table"); onChange(v); };
  a.onclick = () => set("chart"); b.onclick = () => set("table");
  return h("div.viewtoggle", { role: "group", "aria-label": "תצוגה" }, a, b);
}
