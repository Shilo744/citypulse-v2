// CityPulse V2 charts, the "matrix" family (DESIGN_V3.md 5.4): the domain strip, the heat matrix, the priority quadrant and the compare heat table.
// Every drawing function returns an element and marks its parts with the motion vocabulary of css/motion.css (rise, pop, fade). The geometry
// (sorting, colour scales, layout, label placement) lives in pure exported functions that never touch the document, so node can test them
// (tests/viz-matrix.test.mjs). Styles: css/viz/matrix.css (class prefix v-mx-).
import { h, svg, clear, tipHead, tipRow, num, fmtVal, icon, viz, fit, bindTip, uid, TONE, STATUS_COLOR, STATUS_WORD, clamp, statusRank, sqrtRadius, spread } from "./core.js";

// ── small helpers ───────────────────────────────────────────────────────────────────────────────────────────────────
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const LRI = "⁦", PDI = "⁩", NB = " ";
const isoNum = (t) => LRI + t + PDI;                 // a signed number keeps its sign on the correct side inside Hebrew text
const plural = (n, one, many) => (n === 1 ? one : `${n} ${many}`);
const setVars = (el, vars) => { for (const k in vars) el.style.setProperty(k, String(vars[k])); return el; };
const stagger = (k, total, cap = 12) => (total <= 1 ? 0 : Math.round((cap * clamp(k, 0, total - 1)) / (total - 1)));
const empty = (text) => h("div.v-mx-empty", text);
const norm = (s) => (Object.hasOwn(STATUS_COLOR, s) ? s : "na");
const hit = (a, b, m = 1) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.y0 < b.y1 + m && b.y0 < a.y1 + m;

// one small key under a chart: items [{ cls, label, color }] (the swatch takes its shape from the class and its fill from --mx-c)
function keyRow(items, cls = "") {
  return h("div.v-mx-leg" + (cls ? "." + cls : ""), items.map((i) => {
    const sw = h("i.v-mx-sw" + (i.cls ? "." + i.cls : ""));
    if (i.color) sw.style.setProperty("--mx-c", i.color);
    return h("span", sw, i.label);
  }));
}

// ── roving focus for charts with many marks: one tab stop, the arrow keys walk the grid, focusing a mark shows its tooltip ─────────────────────
// step: +1 when ArrowRight moves to the next column of the grid, -1 when it moves to the previous one (a right-to-left table).
function makeRoving(root, step = 1) {
  let pos = new Map(), grid = [], cur = null;
  const put = (el) => { if (cur && cur !== el) cur.tabIndex = -1; el.tabIndex = 0; cur = el; };
  const along = (arr, from, dir) => { for (let k = from + dir; k >= 0 && k < arr.length; k += dir) if (arr[k]) return arr[k]; return null; };
  const vertical = (p, dir) => { for (let k = p.r + dir; k >= 0 && k < grid.length; k += dir) if (grid[k][p.c]) return grid[k][p.c]; return null; };
  root.addEventListener("focusin", (e) => { if (pos.has(e.target)) put(e.target); });
  root.addEventListener("keydown", (e) => {
    const p = pos.get(e.target); if (!p) return;
    const row = grid[p.r];
    const next = { ArrowRight: () => along(row, p.c, step), ArrowLeft: () => along(row, p.c, -step), ArrowDown: () => vertical(p, 1), ArrowUp: () => vertical(p, -1),
      Home: () => row.find(Boolean) || null, End: () => [...row].reverse().find(Boolean) || null }[e.key];
    const to = next && next();
    if (next) e.preventDefault();
    if (to && to !== e.target) to.focus();
  });
  return {
    set(g) {
      grid = g; pos = new Map(); cur = null;
      g.forEach((row, r) => row.forEach((el, c) => { if (el) { pos.set(el, { r, c }); el.tabIndex = -1; } }));
      const first = g.flat().find(Boolean); if (first) put(first);
    }
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 1. DOMAIN STRIP: one row per domain (worst first), one cell per indicator (worst first), the words, a chevron
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export const STRIP_JUDGED = ["concern", "watch", "good", "strength"];
const WORDS = { concern: ["דורש טיפול", "דורשים טיפול"], watch: ["למעקב", "למעקב"], good: ["תקין", "תקינים"], strength: ["חוזק", "חוזקות"] };
const STRIP_KEY = [["concern", "דורש טיפול"], ["watch", "למעקב"], ["na", "לא נשפט"], ["good", "תקין"], ["strength", "חוזק"]];       // the order the cells run in
// an old figure, a small group and a background figure are all "not judged": one quiet grey (the tooltip says which)
const cellColor = (st) => STATUS_COLOR[st === "stale" || st === "uncertain" ? "na" : st];

// how many indicators of each status (an unknown status counts as background)
export function domainCounts(indicators = []) {
  const c = { concern: 0, watch: 0, good: 0, strength: 0, stale: 0, uncertain: 0, na: 0 };
  for (const i of indicators || []) if (i) c[norm(i.status)]++;
  return c;
}
// worst first (the order of STATUS_ORDER); inside one status the higher priority first, then the order given. Returns a new array.
export function sortIndicators(list = []) {
  const pr = (o) => (isNum(o.priority) ? o.priority : 0);
  return (list || []).map((o, i) => ({ o, i })).filter((x) => x.o)
    .sort((a, b) => statusRank(norm(a.o.status)) - statusRank(norm(b.o.status)) || pr(b.o) - pr(a.o) || a.i - b.i).map((x) => x.o);
}
// domains with their indicators sorted and their counts; the worst domain first: more concerns, then more watches, then fewer good ones
export function sortDomains(domains = []) {
  return (domains || []).filter(Boolean).map((d, i) => { const indicators = sortIndicators(d.indicators || []); return { ...d, indicators, counts: domainCounts(indicators), _i: i }; })
    .sort((a, b) => b.counts.concern - a.counts.concern || b.counts.watch - a.counts.watch
      || (a.counts.good + a.counts.strength) - (b.counts.good + b.counts.strength) || a._i - b._i);
}
// the tone of the domain's circle: its worst judged status
export const domainTone = (c) => (c.concern ? "attn" : c.watch ? "watch" : c.good || c.strength ? "good" : "none");
// the words line as parts: the two worst non-empty statuses ("3 דורשים טיפול", "1 למעקב"); a domain with nothing judged says so
export function stripParts(c) {
  const parts = STRIP_JUDGED.filter((s) => c[s] > 0).slice(0, 2).map((s) => ({ s, n: c[s], word: WORDS[s][c[s] === 1 ? 0 : 1] }));
  if (parts.length) return parts;
  const rest = (c.na || 0) + (c.stale || 0) + (c.uncertain || 0);
  return [{ s: "na", n: null, word: !rest ? "אין מדדים" : c.na === rest ? "מדדי רקע" : "ללא שיפוט" }];
}
export const stripWords = (c) => stripParts(c).map((p) => (p.n == null ? "" : p.n + NB) + p.word).join(" · ");

function stripLabel(list) {
  const tot = { concern: 0, watch: 0 };
  list.forEach((d) => { tot.concern += d.counts.concern; tot.watch += d.counts.watch; });
  return `מצב לפי תחום. ${plural(list.length, "תחום אחד", "תחומים")}. דורשים טיפול: ${tot.concern}, למעקב: ${tot.watch}. התחום הראשון: ${list[0].label || list[0].id} (${stripWords(list[0].counts)}).`;
}

// domains = [{ id, label, icon, href, blurb?, indicators: [{ id, label, status, href, value? }] }]. Extras: legend = false hides the key;
// flow = "ltr" (default) runs the cells worst -> best from left to right, like every axis here (better = right); "rtl" starts at the start edge instead.
export function domainStrip({ domains = [], ariaLabel, legend = true, flow = "ltr" } = {}) {
  const list = sortDomains(domains);
  const root = h("div.v-mx-strip" + (flow === "rtl" ? ".rtl" : ""));
  if (!list.length) { root.append(empty("אין תחומים להצגה.")); return viz(root, { label: ariaLabel || "אין תחומים להצגה", role: "group" }); }

  list.forEach((d, ri) => {
    const label = d.label || d.id || "", words = stripParts(d.counts), tone = domainTone(d.counts);
    const dom = h(d.href ? "a.v-mx-dom" : "div.v-mx-dom", d.href ? { href: d.href } : null,
      h("span.v-mx-ic.tone-" + tone, icon(d.icon || "bars", 20)),
      h("span.v-mx-tx", h("b", label), d.blurb ? h("small", d.blurb) : null));
    const cells = h("div.v-mx-cells");
    const inner = h("div.v-mx-rowin", { role: "group", "aria-label": `${label}: ${stripWords(d.counts)}` });

    d.indicators.forEach((ind, ci) => {
      const st = norm(ind.status), word = STATUS_WORD[st], has = ind.value != null && ind.value !== "";
      const name = ind.label || ind.id || "";
      const cell = h((ind.href ? "a" : "span") + ".v-mx-cell.s-" + st, { href: ind.href || null, tabindex: ind.href ? null : 0, "aria-label": `${name}: ${word}${has ? ", " + ind.value : ""}` }, h("i.pop"));
      const color = cellColor(st);
      cell.style.setProperty("--mx-c", color);
      cell.firstChild.style.setProperty("--i", Math.min(12, Math.min(ri, 6) + Math.min(ci, 6)));
      const on = () => { inner.classList.add("hot"); cell.classList.add("on"); }, off = () => { inner.classList.remove("hot"); cell.classList.remove("on"); };
      cell.addEventListener("pointerenter", on); cell.addEventListener("pointerleave", off); cell.addEventListener("focus", on); cell.addEventListener("blur", off);
      bindTip(cell, () => [tipHead(name), tipRow(color, "מצב", word), has ? tipRow(null, "ערך", String(ind.value)) : null].filter(Boolean));
      cells.append(cell);
    });
    if (!d.indicators.length) cells.append(h("span.v-mx-none", { "aria-hidden": "true" }));          // an empty dotted pill; the words line says "no indicators"

    const wordsEl = h("span.v-mx-words", words.map((p, k) => [k ? h("span.sep", " · ") : null, h("span.w-" + p.s, p.n == null ? null : h("b", String(p.n)), (p.n == null ? "" : NB) + p.word)]));
    inner.append(dom, cells, wordsEl, h("span.v-mx-chev", { "aria-hidden": "true" }, icon("left", 18)));
    root.append(setVars(h("div.v-mx-row.rise", inner), { "--i": stagger(ri, list.length, 8) }));
  });
  if (legend) root.append(setVars(keyRow(STRIP_KEY.map(([s, l]) => ({ cls: "s-" + s, label: l, color: STATUS_COLOR[s] })), "fade"), { "--i": 8 }));

  // arrow keys walk the cells (left and right inside a row, up and down between rows); every cell is also a normal tab stop
  root.addEventListener("keydown", (e) => {
    if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
    const cur = e.target.closest && e.target.closest(".v-mx-cell"); if (!cur) return;
    const rows = [...root.querySelectorAll(".v-mx-cells")].map((c) => [...c.querySelectorAll(".v-mx-cell")]);
    const ri = rows.findIndex((r) => r.includes(cur)); if (ri < 0) return;
    const cx = (el) => { const b = el.getBoundingClientRect(); return b.left + b.width / 2; };
    let next = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { const s = [...rows[ri]].sort((a, b) => cx(a) - cx(b)); next = s[s.indexOf(cur) + (e.key === "ArrowRight" ? 1 : -1)]; }
    else { const r2 = rows[ri + (e.key === "ArrowDown" ? 1 : -1)]; if (r2 && r2.length) next = r2.reduce((b, el) => (Math.abs(cx(el) - cx(cur)) < Math.abs(cx(b) - cx(cur)) ? el : b), r2[0]); }
    if (next) { e.preventDefault(); next.focus(); }
  });
  return viz(root, { label: ariaLabel || stripLabel(list), role: "group" });
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2. HEAT MATRIX: figures down, years across (oldest left, newest right), colour = how far from the reference of that year
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// the unit word after a difference between two values of one figure
const GAP_UNIT = { "%": NB + "נק׳", days: NB + "ימים", years: NB + "שנים", per1000: NB + "לכל 1,000", per10k: NB + "לכל 10,000", per100k: NB + "לכל 100,000" };
export function gapText(unit, gap, d = 1) {
  if (!isNum(gap)) return "—";
  const a = Math.abs(gap), r = Math.round(a * 10 ** d) / 10 ** d;
  return isoNum((r === 0 ? "" : gap > 0 ? "+" : "−") + num(a, d)) + (GAP_UNIT[unit] || "");
}
// the short number written inside a cell that is wide enough: no unit, at most about 4 characters
export function cellText(unit, v) {
  if (!isNum(v)) return "";
  const a = Math.abs(v);
  if (a >= 1e6) return num(v / 1e6, 1) + "M";
  if (a >= 1e4) return num(v / 1e3, 0) + "K";
  if (a >= 1e3) return num(v / 1e3, 1) + "K";
  return a >= 100 ? num(v, 0) : num(v, 1);
}

// The colour model of one row. cells -> one entry per year: kind is "missing" (no figure), "hollow" (group too small to judge), "noref" (no reference that year),
// "same" (near the reference), "better" / "worse" (intensity t = |gap| / the row's largest |gap|) or "scale" (a figure with no direction: t = place between the row's low and high).
export function heatRow(row, years) {
  const by = new Map();
  for (const c of row.cells || []) if (c && c.year != null) by.set(c.year, c);
  const dir = row.direction === "lower" || row.direction === "higher" ? row.direction : null;
  const cells = years.map((year) => {
    const c = by.get(year);
    if (!c || !isNum(c.v)) return { year, kind: "missing" };
    return { year, v: c.v, ref: isNum(c.ref) ? c.ref : null, kind: c.reliable === false ? "hollow" : null };
  });
  const live = cells.filter((c) => c.kind == null), withRef = live.filter((c) => c.ref != null);
  const mode = dir && withRef.length ? "gap" : "scale";
  let maxGap = 0, lo = 0, hi = 0;
  if (mode === "gap") {
    maxGap = Math.max(0, ...withRef.map((c) => Math.abs(c.v - c.ref)));
    for (const c of live) {
      if (c.ref == null) { c.kind = "noref"; continue; }
      const gap = c.v - c.ref, a = Math.abs(gap), t0 = maxGap > 0 ? a / maxGap : 0;
      c.gap = gap;
      if (a <= Math.abs(c.ref) * 0.02 || t0 < 0.06) { c.kind = "same"; c.t = 0; continue; }
      c.kind = (dir === "lower" ? gap < 0 : gap > 0) ? "better" : "worse";
      c.t = Math.pow(clamp(t0, 0, 1), 0.85);
    }
  } else if (live.length) {
    const vs = live.map((c) => c.v); lo = Math.min(...vs); hi = Math.max(...vs);
    for (const c of live) { c.kind = "scale"; c.t = hi > lo ? (c.v - lo) / (hi - lo) : 0.5; if (c.ref != null) c.gap = c.v - c.ref; }
  }
  for (const c of cells) if (c.kind === "hollow" && c.ref != null) c.gap = c.v - c.ref;
  return { mode, dir, cells, maxGap, lo, hi };
}
// the size of a cell, the label column and whether the label sits above the cells (a phone): 28-36px cells (up to 56px for 6 years or fewer), never under 18px;
// when even 18px cannot fit, the oldest years are dropped (skip)
export function heatLayout({ width, n, gap = 4, minCell = 18, maxCell = 36, bigN = 6, bigMax = 56, labelMin = 120, labelMax = 300 }) {
  n = Math.max(1, n | 0);
  const colGap = 16, cap = n <= bigN ? bigMax : maxCell, need = (k) => k * minCell + (k - 1) * gap;
  let labelW = clamp(Math.round(width * 0.32), labelMin, 250);
  const stacked = need(n) > width - labelW - colGap, avail = stacked ? width : width - labelW - colGap;
  let shown = n; while (shown > 1 && need(shown) > avail) shown--;
  const cell = clamp(Math.floor((avail - (shown - 1) * gap) / shown), minCell, cap), cellsW = shown * cell + (shown - 1) * gap;
  if (!stacked) labelW = clamp(width - colGap - cellsW, labelW, labelMax);
  const pitch = cell + gap;
  return { stacked, labelW, cell, gap, shown, skip: n - shown, showNum: cell >= 40, step: pitch >= 30 ? 1 : 2, cellsW };
}
const bare = (t) => t.replace(/(^|\s)ה/g, "$1");                       // "הממוצע הארצי" -> "ממוצע ארצי" (a name without its articles, for a label or a sentence)
const heatPct = (c, mode) => Math.round(mode === "scale" ? 12 + 76 * c.t : 18 + 70 * c.t);

function heatKey(refLabel, hasScale, hasGap) {
  const wrap = h("div.v-mx-hkey"), sw = (k, t, mode) => setVars(h("i.v-mx-sw.k-" + k), { "--mx-p": heatPct({ t }, mode) + "%" });
  if (hasGap) {
    const steps = [["worse", 1], ["worse", 0.66], ["worse", 0.33], ["same", 0], ["better", 0.33], ["better", 0.66], ["better", 1]];
    wrap.append(h("div.v-mx-kg", h("span.lt", "חלש מ" + refLabel), h("span.ramp", steps.map(([k, t]) => sw(k, t, "gap"))), h("span.rt", "טוב מ" + refLabel)));
  }
  if (hasScale) wrap.append(h("div.v-mx-kg", h("span.lt", "ערך נמוך"), h("span.ramp", [0, 0.25, 0.5, 0.75, 1].map((t) => sw("scale", t, "scale"))), h("span.rt", "ערך גבוה")));
  wrap.append(h("div.v-mx-kg.solo", h("i.v-mx-sw.k-missing"), h("span", "אין נתון")));
  return wrap;
}

// rows = [{ id, label, href, unit, direction, cells: [{ year, v, ref, reliable? }] }], years = [2017, ...] (default: every year found).
// Extra: refLabel (default "הממוצע הארצי") names the reference in the key and the tooltips.
export function heatMatrix({ rows = [], years, ariaLabel, refLabel = "הממוצע הארצי" } = {}) {
  const list = (rows || []).filter((r) => r && typeof r === "object");
  const allYears = [...new Set(Array.isArray(years) && years.length ? years : list.flatMap((r) => (r.cells || []).map((c) => c && c.year)))].filter((y) => y != null).sort((a, b) => a - b);
  const host = h("div.v-mx-heat");
  if (!list.length || !allYears.length) { host.append(empty("אין נתונים להצגה.")); return viz(host, { label: ariaLabel || "אין נתונים להצגה", role: "group" }); }
  const models = list.map((r) => heatRow(r, allYears));
  const tally = { better: 0, worse: 0 };
  models.forEach((m) => m.cells.forEach((c) => { if (c.kind === "better" || c.kind === "worse") tally[c.kind]++; }));
  const hasGap = models.some((m) => m.mode === "gap"), hasScale = models.some((m) => m.mode === "scale");
  const label = ariaLabel || `מפת חום: ${plural(list.length, "מדד אחד", "מדדים")}, ${allYears[0]} עד ${allYears[allYears.length - 1]}.` + (hasGap ? ` תצפיות טובות מ${refLabel}: ${tally.better}, חלשות ממנו: ${tally.worse}.` : "");
  const rov = makeRoving(host, 1);

  const draw = (W) => {
    clear(host); host.classList.remove("hot");
    const L = heatLayout({ width: W, n: allYears.length }), ys = allYears.slice(L.skip);
    setVars(host, { "--cell": L.cell + "px", "--n": ys.length, "--lab": L.labelW + "px", "--hg": L.gap + "px" });
    host.classList.toggle("is-stacked", L.stacked);
    const heads = ys.map((y, k) => h("span.v-mx-hy" + ((ys.length - 1 - k) % L.step === 0 ? "" : ".off"), String(y)));
    host.append(h("div.v-mx-hhead", h("span.v-mx-hlab"), h("div.v-mx-hcells", heads)));
    const grid = [], byRow = [], byCol = ys.map(() => []);
    const span = ys.length - 1 + 0.6 * (list.length - 1);

    list.forEach((row, ri) => {
      const m = models[ri], cs = m.cells.slice(L.skip), unit = row.unit;
      const lab = row.href ? h("a.v-mx-hlab", { href: row.href, title: row.label }, row.label) : h("span.v-mx-hlab", { title: row.label }, row.label);
      const cellsEl = h("div.v-mx-hcells"), gridRow = [], rowEls = [];
      cs.forEach((c, ci) => {
        const where = `${row.label}, ${c.year}`;
        const fill = h("i.v-mx-hf.fade", c.kind !== "missing" && L.showNum ? h("span.n", cellText(unit, c.v)) : null);
        fill.style.setProperty("--i", span > 0 ? Math.round((12 * (ci + 0.6 * ri)) / span) : 0);
        const el = h("div.v-mx-hc.k-" + c.kind, fill);
        if (c.t != null) el.style.setProperty("--mx-p", heatPct(c, m.mode) + "%");
        rowEls.push(el); byCol[ci].push(el);
        let verdict = null;
        if (c.kind === "better") verdict = ["טוב מ" + refLabel, TONE.good]; else if (c.kind === "worse") verdict = ["חלש מ" + refLabel, TONE.attn];
        else if (c.kind === "same") verdict = ["קרוב ל" + refLabel.replace(/^ה/, ""), "var(--none-bar)"]; else if (c.kind === "noref") verdict = ["אין " + bare(refLabel) + " להשוואה", "var(--none-bar)"];
        else if (c.kind === "hollow") verdict = ["קבוצה קטנה, ללא השוואה", "var(--none-bar)"];
        if (c.kind === "missing") {
          el.setAttribute("aria-hidden", "true");
          bindTip(el, () => [tipHead(where), h("div", "אין נתון")]);
          gridRow.push(null);
        } else {
          el.setAttribute("role", "img");
          el.setAttribute("aria-label", `${where}: ${fmtVal(unit, c.v)}` + (c.ref != null ? `, ${refLabel} ${fmtVal(unit, c.ref)}` : "") + (verdict ? `, ${verdict[0]}` : ""));
          const on = () => { host.classList.add("hot"); [...rowEls, ...byCol[ci]].forEach((x) => x.classList.add("ln")); el.classList.add("on"); heads[ci].classList.add("on"); };
          const off = () => { host.classList.remove("hot"); host.querySelectorAll(".ln, .on").forEach((x) => x.classList.remove("ln", "on")); };
          el.addEventListener("pointerenter", on); el.addEventListener("pointerleave", off); el.addEventListener("focus", on); el.addEventListener("blur", off);
          bindTip(el, () => [tipHead(where), tipRow(null, "ערך", fmtVal(unit, c.v)), c.ref != null ? tipRow(null, bare(refLabel), fmtVal(unit, c.ref)) : null,
            c.gap != null ? tipRow(null, "פער", gapText(unit, c.gap)) : null, verdict ? tipRow(verdict[1], "מצב", verdict[0]) : null].filter(Boolean));
          gridRow.push(el);
        }
        cellsEl.append(el);
      });
      grid.push(gridRow);
      host.append(h("div.v-mx-hrow", lab, cellsEl));
    });
    host.append(heatKey(refLabel, hasScale, hasGap));
    if (L.skip) host.append(h("p.v-mx-note", `מוצגות ${ys.length} השנים האחרונות`));
    rov.set(grid);
  };
  viz(host, { label, role: "group" });
  fit(host, draw, { min: 200 });
  return host;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 3. PRIORITY QUADRANT: bubbles, x = standing (strong = right), y = trend (improving = up), area = priority
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// a rough width of a text in px, good enough to place labels (Hebrew letters are about half an em wide)
export function textWidth(s, px = 12) {
  let w = 0;
  for (const ch of String(s ?? "")) {
    const c = ch.codePointAt(0);
    w += c >= 0x590 && c <= 0x5ff ? 0.52 : c === 32 ? 0.26 : c >= 48 && c <= 57 ? 0.58 : c >= 65 && c <= 90 ? 0.66 : c >= 97 && c <= 122 ? 0.54 : 0.4;
  }
  return w * px * 1.04;
}
// cut a text so it fits in maxW px, ending with an ellipsis; "" when not even a few letters fit
export function clipText(s, maxW, px = 12) {
  s = String(s ?? "");
  if (textWidth(s, px) <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (textWidth(s.slice(0, mid).trimEnd() + "…", px) <= maxW) lo = mid; else hi = mid - 1; }
  return lo > 1 ? s.slice(0, lo).trimEnd() + "…" : "";
}
// the half-height of the trend axis: trends are small numbers, so the axis zooms to the largest one (never under 0.25, never over 1); yMax fixes it
export function trendDomain(points = [], yMax) {
  if (isNum(yMax) && yMax > 0) return clamp(yMax, 0.05, 1);
  const mx = Math.max(0, ...(points || []).map((p) => (p && isNum(p.y) ? Math.abs(clamp(p.y, -1, 1)) : 0)));
  return clamp(Math.ceil(Math.max(mx * 1.35, 0.25) * 20) / 20, 0.25, 1);
}
// the frame, the margins and the bubble sizes for a width; a phone gets a taller frame, smaller bubbles and only 3 labels
export function quadLayout({ width, height = 420 }) {
  const compact = width < 520, H = compact ? Math.max(320, Math.min(height, Math.round(width * 1.05))) : Math.max(320, height);
  const m = compact ? { t: 26, r: 8, b: 50, l: 50 } : { t: 30, r: 12, b: 54, l: 62 };
  const frame = { x0: m.l, y0: m.t, x1: width - m.r, y1: H - m.b };
  const inner = Math.min(frame.x1 - frame.x0, frame.y1 - frame.y0);
  return { W: width, H, m, frame, compact, rMin: compact ? 4.5 : 5.5, rMax: compact ? clamp(inner * 0.065, 11, 20) : clamp(inner * 0.08, 12, 28), labelCount: compact ? 3 : 6 };
}
export function quadScales(L, m) {
  const { x0, y0, x1, y1 } = L.frame, pad = 16, zeroY = (y0 + y1) / 2, half = (y1 - y0) / 2 - pad;
  const X = (v) => x0 + pad + (clamp(v, 0, 100) / 100) * (x1 - x0 - 2 * pad), Y = (v) => zeroY - (clamp(v, -m, m) / m) * half;
  return { X, Y, midX: X(50), zeroY };
}
// the four corners of the frame: urgent = weak and worsening, strong = strong and improving
export const quadrantOf = (x, y) => (x < 50 ? (y < 0 ? "urgent" : "rising") : y > 0 ? "strong" : "slipping");
export const trendWord = (y) => (!isNum(y) || Math.abs(y) < 0.005 ? "יציב" : y > 0 ? "בשיפור" : "בהידרדרות");
// bubbles with their pixel position and radius, the biggest (highest priority) first; points without a standing are left out
export function bubbleNodes(points, L, S) {
  const pts = points.filter((p) => p && isNum(p.x));
  const vmax = Math.max(1e-9, ...pts.map((p) => (isNum(p.r) ? p.r : 0)));
  const { x0, y0, x1, y1 } = L.frame;
  return pts.map((p, i) => {
    const rad = sqrtRadius(isNum(p.r) ? Math.max(0, p.r) : 0, vmax, L.rMin, L.rMax);
    return { ...p, i, rad, cx: clamp(S.X(p.x), x0 + rad + 2, x1 - rad - 2), cy: clamp(S.Y(isNum(p.y) ? p.y : 0), y0 + rad + 2, y1 - rad - 2) };
  }).sort((a, b) => (isNum(b.r) ? b.r : 0) - (isNum(a.r) ? a.r : 0) || a.i - b.i);
}
// Name labels for some bubbles, in priority order. items = [{ id, cx, cy, rad, w }] (w = the text width). Each label sits beside its bubble on the side with room;
// labels on one side are spread apart with spread(); one that still touches another is moved to the other side or up and down (and then gets a leader line),
// and one that fits nowhere is left out (it shows on hover instead). Returns [{ id, k, side, x, y, w, anchor, moved, bx, by }] (y = the vertical middle).
export function placeLabels(items, frame, { h: lh = 15, gap = 2, pad = 6, minW = 36, scan = 5, avoid = [] } = {}) {
  const roomOf = (it, side) => (side === "r" ? frame.x1 - (it.cx + it.rad + pad) : it.cx - it.rad - pad - frame.x0);
  const pref = items.map((it) => { const r = roomOf(it, "r"), l = roomOf(it, "l"); return r >= it.w ? "r" : l >= it.w ? "l" : r >= l ? "r" : "l"; });
  const ys = new Map();
  for (const side of ["r", "l"]) {
    const idx = items.map((_, k) => k).filter((k) => pref[k] === side);
    const sp = spread(idx.map((k) => ({ y: items[k].cy, h: lh })), gap, frame.y0, frame.y1);
    idx.forEach((k, j) => ys.set(k, sp[j].y));
  }
  const rects = [...avoid], out = [];                                  // avoid = rectangles that no label may cover (the corner captions)
  items.forEach((it, k) => {
    const sides = pref[k] === "r" ? ["r", "l"] : ["l", "r"], tries = [[sides[0], ys.get(k)], [sides[0], it.cy], [sides[1], it.cy]];
    for (let s = 1; s <= scan; s++) for (const sd of sides) for (const sg of [-1, 1]) tries.push([sd, it.cy + sg * s * (lh + gap)]);
    for (const [side, y] of tries) {
      const w = Math.min(it.w, roomOf(it, side)); if (w < Math.min(it.w, minW)) continue;
      const x0 = side === "r" ? it.cx + it.rad + pad : it.cx - it.rad - pad - w, rc = { x0, x1: x0 + w, y0: y - lh / 2, y1: y + lh / 2 };
      if (rc.y0 < frame.y0 || rc.y1 > frame.y1 || rects.some((q) => hit(rc, q))) continue;
      rects.push(rc);
      out.push({ id: it.id, k, side, x: side === "r" ? rc.x0 : rc.x1, y, w, anchor: side === "r" ? "start" : "end", moved: Math.abs(y - it.cy) > 3, bx: side === "r" ? it.cx + it.rad : it.cx - it.rad, by: it.cy });
      return;
    }
  });
  return out;
}

// the key under the quadrant: only the tones that are present, and what the size means
const QUAD_KEY = [["attn", "דורש טיפול"], ["watch", "למעקב"], ["none", "לא נשפט"], ["good", "תקין או חוזק"]];
function quadKey(points) {
  const tone = (p) => (p.tone === "good" || p.tone === "attn" || p.tone === "watch" ? p.tone : "none"), seen = new Set(points.map(tone));
  return keyRow([...QUAD_KEY.filter(([t]) => seen.has(t)).map(([t, l]) => ({ cls: "b-" + t, label: l })), { cls: "b-size", label: "גודל הבועה = עדיפות" }], "quad");
}

function quadLabel(points) {
  const nodes = points.filter((p) => p && isNum(p.x)), top = [...nodes].sort((a, b) => (b.r || 0) - (a.r || 0)).slice(0, 3).map((p) => p.label || p.id).join(", ");
  const at = (p) => quadrantOf(p.x, isNum(p.y) ? p.y : 0), urgent = nodes.filter((p) => at(p) === "urgent").length, strong = nodes.filter((p) => at(p) === "strong").length;
  return `מפת עדיפויות: ${plural(nodes.length, "מדד אחד", "מדדים")}. באזור הדחוף, חלשים ומידרדרים: ${urgent}. באזור החוזק: ${strong}. בעדיפות הגבוהה ביותר: ${top}.`;
}

function quadSvg(host, points, W, height, yMax) {
  const L = quadLayout({ width: W, height }), m = trendDomain(points, yMax), S = quadScales(L, m), { x0, y0, x1, y1 } = L.frame;
  const nodes = bubbleNodes(points, L, S);
  const root = svg("svg", { width: W, height: L.H, viewBox: `0 0 ${W} ${L.H}`, "aria-hidden": "true" });
  const clipId = uid("mxq");
  const T = (cls, x, y, anchor, text) => svg("text", { class: cls, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, "text-anchor": anchor }, text);
  root.append(svg("defs", null, svg("clipPath", { id: clipId }, svg("rect", { x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 14 }))));
  root.append(svg("rect", { class: "frame", x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 14 }));
  root.append(svg("g", { "clip-path": `url(#${clipId})` },
    svg("rect", { class: "zone-bad", x: x0, y: S.zeroY, width: S.midX - x0, height: y1 - S.zeroY }),
    svg("rect", { class: "zone-good", x: S.midX, y: y0, width: x1 - S.midX, height: S.zeroY - y0 }),
    svg("line", { class: "mid", x1: S.midX, x2: S.midX, y1: y0, y2: y1 }), svg("line", { class: "zero", x1: x0, x2: x1, y1: S.zeroY, y2: S.zeroY })));
  // axes: three words each, and a title
  root.append(svg("g", { class: "axes" },
    T("tick", x0, y1 + 16, "start", "חלש"), T("tick", S.midX, y1 + 16, "middle", "באמצע"), T("tick", x1, y1 + 16, "end", "חזק"), T("ttl", S.midX, y1 + 36, "middle", "מצב מול יישובים אחרים"),
    T("tick", x0 - 8, y0 + 12, "end", "משתפר"), T("tick", x0 - 8, S.zeroY + 4, "end", "יציב"), T("tick", x0 - 8, y1 - 4, "end", "מידרדר"), T("ttl", x0 - 8, y0 - 12, "end", "מגמה")));

  const wLab = L.compact ? 11.5 : 12;
  const topN = nodes.filter((n) => n.label).slice(0, L.labelCount).map((n) => ({ id: n.i, cx: n.cx, cy: n.cy, rad: n.rad, w: textWidth(n.label, wLab) + 2, node: n }));
  // the four corner captions are obstacles for the labels
  const cap = (x, y, text, end) => { const w = textWidth(text, 12) + 4; return { x0: end ? x - w : x, x1: end ? x : x + w, y0: y - 13, y1: y + 4 }; };
  const avoid = [cap(x0 + 12, y1 - 12, "דחוף: חלש ומידרדר"), cap(x1 - 12, y0 + 20, "חוזק: חזק ומשתפר", true), cap(x0 + 12, y0 + 20, "חלש אך משתפר"), cap(x1 - 12, y1 - 12, "חזק אך מידרדר", true)];
  const placed = placeLabels(topN, L.frame, { h: L.compact ? 14 : 16, avoid }), labelled = new Set(placed.map((p) => p.id));

  const bubbles = svg("g", { class: "bubbles" }), ring = svg("circle", { class: "ring", r: 0, cx: 0, cy: 0 }), hovers = svg("g", { class: "hovers" });
  nodes.forEach((n, k) => {
    const tone = n.tone === "good" || n.tone === "attn" || n.tone === "watch" ? n.tone : "none", t = L.rMax > L.rMin ? (n.rad - L.rMin) / (L.rMax - L.rMin) : 0;
    const name = n.label || n.id || "", standing = `טוב מ-${Math.round(clamp(n.x, 0, 100))}% מהיישובים`, trend = trendWord(n.y);
    const a = svg("a", { class: "v-mx-bub tone-" + tone, href: n.href || null, tabindex: 0, role: n.href ? "link" : "img", "aria-label": `${name}: ${standing}, מגמה ${trend}, עדיפות ${num(n.r, 1)}` },
      svg("circle", { class: "halo", cx: n.cx, cy: n.cy, r: n.rad + 2 }), svg("circle", { class: "dot", cx: n.cx, cy: n.cy, r: n.rad }));
    a.querySelector(".dot").style.setProperty("--mx-o", (0.86 - 0.3 * t).toFixed(2));
    const g = svg("g", { class: "pop" }, a); g.style.setProperty("--i", Math.min(k, 12));
    // the name of a bubble that carries no label shows beside it on hover and focus
    let hl = null;
    if (!labelled.has(n.i)) {
      const roomR = x1 - (n.cx + n.rad + 6), roomL = n.cx - n.rad - 6 - x0, side = roomR >= roomL ? "r" : "l", room = Math.max(roomR, roomL);
      const text = clipText(name, room, wLab);
      if (text) { hl = T("lbl hl", side === "r" ? n.cx + n.rad + 6 : n.cx - n.rad - 6, n.cy + 4, side === "r" ? "start" : "end", text); hovers.append(hl); }
    }
    const on = () => { host.classList.add("hot"); a.classList.add("on"); ring.setAttribute("cx", n.cx); ring.setAttribute("cy", n.cy); ring.setAttribute("r", n.rad + 4); ring.classList.add("on"); if (hl) hl.classList.add("on"); };
    const off = () => { host.classList.remove("hot"); a.classList.remove("on"); ring.classList.remove("on"); if (hl) hl.classList.remove("on"); };
    a.addEventListener("pointerenter", on); a.addEventListener("pointerleave", off); a.addEventListener("focus", on); a.addEventListener("blur", off);
    bindTip(a, () => [tipHead(name), tipRow(TONE[tone] || TONE.none, "מצב", standing), tipRow(null, "מגמה", trend), tipRow(null, "עדיפות", num(n.r, 1)), n.note ? h("div.v-mx-tipnote", n.note) : null].filter(Boolean));
    bubbles.append(g);
  });
  // zone captions sit in the corners of the frame, under the bubbles; the two quiet ones name the other corners
  root.append(svg("g", { class: "caps" }, T("cap bad", x0 + 12, y1 - 12, "start", "דחוף: חלש ומידרדר"), T("cap good", x1 - 12, y0 + 20, "end", "חוזק: חזק ומשתפר"),
    T("cap soft", x0 + 12, y0 + 20, "start", "חלש אך משתפר"), T("cap soft", x1 - 12, y1 - 12, "end", "חזק אך מידרדר")));
  // "start here": a quiet pulse behind the bubble with the highest priority (it shows nothing when motion is off)
  if (nodes.length) {
    const top = nodes[0], tn = top.tone === "good" || top.tone === "attn" || top.tone === "watch" ? top.tone : "none";
    root.append(setVars(svg("circle", { class: "ping", cx: top.cx, cy: top.cy, r: Math.round(top.rad * 0.9) }), { "--mx-c": TONE[tn] }));
  }
  root.append(bubbles);
  const byId = new Map(topN.map((o) => [o.id, o.node]));
  const lab = svg("g", { class: "labels" });
  placed.forEach((p, k) => {
    const g = svg("g", { class: "fade" }); g.style.setProperty("--i", 6 + Math.min(k, 6));
    if (p.moved) g.append(svg("line", { class: "lead", x1: p.bx, y1: p.by, x2: p.x + (p.anchor === "start" ? -3 : 3), y2: p.y }));
    g.append(T("lbl", p.x, p.y + 4, p.anchor, clipText(byId.get(p.id).label, p.w, wLab)));
    lab.append(g);
  });
  root.append(lab, hovers, ring);
  return root;
}

// points = [{ id, label, x /* 0..100 standing */, y /* -1..1 trend */, r /* priority */, tone, href, note? }]. Extra: yMax fixes the half-height of the trend axis.
export const MAX_BUBBLES = 150;                                                  // beyond this many the chart would pass the node budget: the highest priorities are drawn
export function priorityQuadrant({ points = [], height = 420, ariaLabel, yMax } = {}) {
  const all = (points || []).filter((p) => p && isNum(p.x));
  const list = all.length > MAX_BUBBLES ? [...all].sort((a, b) => (isNum(b.r) ? b.r : 0) - (isNum(a.r) ? a.r : 0)).slice(0, MAX_BUBBLES) : all;
  const host = h("div.v-mx-quad");
  if (!list.length) { host.append(empty("אין מדדים להצגה.")); return viz(host, { label: ariaLabel || "אין מדדים להצגה", role: "group" }); }
  host.style.minHeight = Math.max(320, height) + "px";
  viz(host, { label: ariaLabel || quadLabel(list), role: "group" });
  const cut = all.length > list.length ? h("p.v-mx-note", `מוצגים ${list.length} המדדים בעדיפות הגבוהה ביותר מתוך ${all.length}`) : null;
  fit(host, (W) => { clear(host); host.classList.remove("hot"); host.style.minHeight = ""; host.append(...[quadSvg(host, list, W, height, yMax), quadKey(list), cut].filter(Boolean)); }, { min: 220 });
  return host;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 4. COMPARE HEAT: cities down, domains across, each cell the worst status present
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
export const WORST_ORDER = ["concern", "watch", "good", "strength"];
// the worst status with a count above 0; "none" when there is nothing
export const worstStatus = (c) => { if (c) for (const s of WORST_ORDER) if (c[s] > 0) return s; return "none"; };
const CMP_ROWS = [["concern", "דורשים טיפול"], ["watch", "למעקב"], ["good", "תקינים"], ["strength", "חוזקות"]];
const CMP_KEY = [["concern", "דורש טיפול (המספר = כמה)"], ["watch", "למעקב"], ["good", "תקין"], ["strength", "חוזק"], ["none", "אין מדד שנשפט"]];

// cities = [{ key, name }], domains = [{ id, label, short?, icon }], cells = { [cityKey]: { [domainId]: { concern, watch, good, strength } } }
export function compareHeat({ cities = [], domains = [], cells = {}, ariaLabel } = {}) {
  const cs = (cities || []).filter(Boolean), ds = (domains || []).filter(Boolean), data = cells || {};
  const root = setVars(h("div.v-mx-cmp"), { "--nc": ds.length });
  if (!cs.length || !ds.length) { root.append(empty("אין נתונים להשוואה.")); return viz(root, { label: ariaLabel || "אין נתונים להשוואה", role: "group" }); }
  const at = (city, d) => (data[city.key] || {})[d.id] || null;
  const totals = cs.map((c) => ({ c, n: ds.reduce((s, d) => s + ((at(c, d) || {}).concern | 0), 0) })).sort((a, b) => b.n - a.n);

  const head = h("tr", h("th.v-mx-corner", h("span.sr", "יישוב")), ds.map((d) => h("th.v-mx-colh", { scope: "col", title: d.label || d.id }, h("span.v-mx-col", h("span.v-mx-cic", icon(d.icon || "bars", 16)), h("span.v-mx-cl", d.short || d.label || d.id)))));
  const grid = [], colEls = ds.map(() => []), tbody = h("tbody");
  cs.forEach((city, ri) => {
    const rowEls = [], gridRow = [];
    const th = h("th.v-mx-rowh", { scope: "row" }, h("a", { href: `#/c/${encodeURIComponent(city.key)}` }, city.name || city.key));
    const tr = h("tr", th);
    ds.forEach((d, ci) => {
      const c = at(city, d), kind = worstStatus(c), n = c ? c.concern | 0 : 0, nm = `${city.name || city.key}, ${d.label || d.id}`;
      const box = h("div.v-mx-cc.fade.k-" + kind, { "aria-hidden": "true" }, n > 0 ? String(n) : null);
      box.style.setProperty("--i", Math.min(12, ri + ci));
      box.style.setProperty("--mx-c", STATUS_COLOR[kind === "none" ? "na" : kind]);
      const td = h("td.v-mx-cell2", { tabindex: -1, "aria-label": c ? `${nm}: ${CMP_ROWS.map(([s, w]) => `${w} ${c[s] | 0}`).join(", ")}` : `${nm}: אין נתונים` }, box);
      rowEls.push(td); colEls[ci].push(td); gridRow.push(td);
      const on = () => { root.classList.add("hot"); [...rowEls, ...colEls[ci]].forEach((x) => x.classList.add("ln")); th.classList.add("on"); head.children[ci + 1].classList.add("on"); };
      const off = () => { root.classList.remove("hot"); root.querySelectorAll(".ln, .on").forEach((x) => x.classList.remove("ln", "on")); };
      td.addEventListener("pointerenter", on); td.addEventListener("pointerleave", off); td.addEventListener("focus", on); td.addEventListener("blur", off);
      bindTip(td, () => [tipHead(nm), ...(c ? CMP_ROWS.map(([s, w]) => tipRow(STATUS_COLOR[s], w, String(c[s] | 0))) : [h("div", "אין נתונים")])]);
      tr.append(td);
    });
    grid.push(gridRow);
    tbody.append(tr);
  });
  const scroller = h("div.v-mx-scroll", h("table.v-mx-tbl", h("caption.sr", "השוואת יישובים לפי תחום: בכל תא המצב החמור ביותר שנמצא"), h("thead", head), tbody));
  scroller.addEventListener("scroll", () => scroller.classList.toggle("scrolled", Math.abs(scroller.scrollLeft) > 2), { passive: true });
  root.append(scroller, keyRow(CMP_KEY.map(([s, l]) => ({ cls: "k-" + s, label: l, color: STATUS_COLOR[s === "none" ? "na" : s] })), "fade"));
  makeRoving(root, -1).set(grid);
  const label = ariaLabel || `השוואה בין ${plural(cs.length, "יישוב אחד", "יישובים")} לפי ${plural(ds.length, "תחום אחד", "תחומים")}. הכי הרבה מדדים הדורשים טיפול: ${totals[0].c.name || totals[0].c.key} (${totals[0].n}).`;
  return viz(root, { label, role: "group" });
}
