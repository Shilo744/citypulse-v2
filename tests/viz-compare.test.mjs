// The geometry behind the compare charts (web/js/viz/compare.js): no DOM, so it runs in node. Run only this file: node --test tests/viz-compare.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cmp from "../web/js/viz/compare.js";
import gallery from "../web/js/viz/gallery-compare.js";

const { estWidth, fitText, splitNum, signed, fixRanges, roundTopPath, binStep, binIndex, binCounts, kdeCurve, placeLabels, placeChips, divergingLayout, dumbbellLayout, lollipopLayout, distributionLayout, DB, DIST } = cmp;
const HERE = path.dirname(fileURLToPath(import.meta.url));

// a small seeded generator so a failing fuzz case can be replayed
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const finiteDeep = (o, at = "") => { if (typeof o === "number") assert.ok(Number.isFinite(o), `${at} is ${o}`); else if (o && typeof o === "object" && typeof o !== "function") for (const [k, v] of Object.entries(o)) if (typeof v !== "function") finiteDeep(v, at + "." + k); };

test("the module exports the four charts and imports without a document", () => {
  for (const k of ["divergingBars", "dumbbell", "lollipopRank", "distribution"]) assert.equal(typeof cmp[k], "function", k);
  assert.equal(typeof gallery, "function", "the gallery default export");
  assert.equal(typeof document, "undefined", "this test runs without a DOM, and the import above still worked");
});

// ───────────────────────── text helpers ─────────────────────────
test("splitNum isolates the number with its sign from the unit word", () => {
  assert.deepEqual(splitNum("+8.2 נק׳"), ["+8.2", " נק׳"]);
  assert.deepEqual(splitNum("−3 ימים"), ["−3", " ימים"]);
  assert.deepEqual(splitNum("12.5%"), ["12.5%", ""]);
  assert.deepEqual(splitNum("+ 8"), ["+8", ""]);
  assert.deepEqual(splitNum("1,050 תושבים"), ["1,050", " תושבים"]);
  assert.deepEqual(splitNum("אין נתון"), [null, "אין נתון"]);
  assert.deepEqual(splitNum(null), [null, ""]);
  assert.equal(signed(8.24), "+8.2");
  assert.equal(signed(-3, 0), "−3");
  assert.equal(signed(0), "0");
});

test("fixRanges puts every number pair joined by a dash in an LTR isolate, and touches nothing else", () => {
  assert.equal(fixRanges("אזורים ברמה נמוכה (1–3)"), "אזורים ברמה נמוכה (⁦1–3⁩)");
  assert.equal(fixRanges("2020-2024"), "⁦2020-2024⁩");
  assert.equal(fixRanges("10–20%"), "⁦10–20%⁩");
  assert.equal(fixRanges("רמה (7 – 10) וגם (4–6)"), "רמה (⁦7 – 10⁩) וגם (⁦4–6⁩)");
  assert.equal(fixRanges("בני ברק (3)"), "בני ברק (3)");
  assert.equal(fixRanges("כפר חב\"ד"), "כפר חב\"ד");
  assert.equal(fixRanges(null), "");
});

test("fitText keeps what fits, otherwise cuts at the end and adds an ellipsis that still fits", () => {
  const m = (t) => estWidth(t, 13, true);
  const s = "אזורים ברמה חברתית-כלכלית נמוכה (1–3)";
  assert.deepEqual(fitText("קצר", 200, m), { text: "קצר", cut: false });
  const r = fitText(s, 120, m);
  assert.ok(r.cut && r.text.endsWith("…") && m(r.text) <= 120, JSON.stringify(r));
  assert.ok(s.startsWith(r.text.slice(0, -1).trimEnd()), "the kept part is a prefix of the text");
  assert.deepEqual(fitText(s, 0, m), { text: "", cut: true });
  assert.equal(fitText("", 50, m).cut, false);
  const tiny = fitText(s, 4, m);
  assert.ok(tiny.text === "" || tiny.text === "…" || m(tiny.text) <= 4 + 1e-9, "never wider than the room, even when the room is tiny");
});

test("estWidth: digits and Hebrew have a width, direction marks have none, bold is wider", () => {
  assert.ok(estWidth("66.1%", 12) > 20 && estWidth("66.1%", 12) < 50);
  assert.equal(estWidth("⁧⁩‎", 12), 0);
  assert.ok(estWidth("ארצי", 12, true) > estWidth("ארצי", 12, false));
  assert.equal(estWidth("", 12), 0);
});

test("roundTopPath: rounded top corners, a square base, and the radius never exceeds the bar", () => {
  const p = roundTopPath(10, 20, 30, 40, 5);
  assert.match(p, /^M10 60V25A5 5 0 0 1 15 20H35A5 5 0 0 1 40 25V60Z$/);
  assert.match(roundTopPath(0, 0, 4, 40, 5), /A2 2 /, "a 4px wide column gets at most a 2px radius");
  assert.match(roundTopPath(0, 0, 30, 3, 5), /A3 3 /, "a 3px tall column gets at most a 3px radius");
  assert.doesNotMatch(roundTopPath(0, 0, 30, 0, 5), /A/, "nothing to round on a flat bar");
});

// ───────────────────────── diverging bars ─────────────────────────
test("divergingLayout: side and share of the half lane, max defaults to the largest gap", () => {
  const L = divergingLayout([{ gap: 8 }, { gap: -4 }, { gap: 0 }, { gap: null }, { gap: 2 }, { gap: NaN }, null, { gap: Infinity }]);
  assert.equal(L.max, 8);
  assert.deepEqual(L.rows.map((r) => r.side), [1, -1, 0, null, 1, null, null]);
  assert.deepEqual(L.rows.map((r) => r.frac), [1, 0.5, 0, 0, 0.25, 0, 0]);
  assert.deepEqual([L.better, L.worse, L.even, L.none], [2, 1, 1, 3]);
});

test("divergingLayout: an explicit max clamps long bars, and degenerate inputs never divide by zero", () => {
  assert.deepEqual(divergingLayout([{ gap: 8 }, { gap: -2 }], 4).rows.map((r) => r.frac), [1, 0.5]);
  assert.equal(divergingLayout([{ gap: 0 }, { gap: 0 }]).max, 1, "all zero");
  assert.deepEqual(divergingLayout([{ gap: 0 }, { gap: 0 }]).rows.map((r) => r.frac), [0, 0]);
  assert.equal(divergingLayout([]).rows.length, 0);
  assert.equal(divergingLayout(undefined).max, 1);
  assert.deepEqual(divergingLayout([{ gap: 5 }], -3).rows[0].frac, 1, "a bad max is ignored");
  const allNeg = divergingLayout([{ gap: -1 }, { gap: -3 }]);
  assert.deepEqual([allNeg.better, allNeg.worse], [0, 2]);
  assert.deepEqual(allNeg.rows.map((r) => r.frac), [1 / 3, 1]);
  const one = divergingLayout([{ gap: 7 }]);
  assert.deepEqual(one.rows.map((r) => r.frac), [1], "a single bar fills the half lane");
});

test("divergingLayout copes with a long list", () => {
  const items = Array.from({ length: 5000 }, (_, i) => ({ gap: Math.sin(i) * 10 }));
  const L = divergingLayout(items);
  assert.equal(L.rows.length, 5000);
  assert.ok(L.rows.every((r) => r.frac >= 0 && r.frac <= 1));
  assert.ok(Math.abs(L.max - Math.max(...items.map((x) => Math.abs(x.gap)))) < 1e-12);
});

// ───────────────────────── label placement ─────────────────────────
const overlaps = (a, b, gap = 0) => Math.abs(a.lx - b.lx) < (a.w + b.w) / 2 + gap - 0.01;
test("placeLabels leaves well separated labels where they are", () => {
  const out = placeLabels([{ x: 50, w: 30, v: 1, key: "a" }, { x: 200, w: 30, v: 2, key: "b" }], { lo: 0, hi: 300 });
  assert.deepEqual(out.map((o) => [o.lx, o.hidden]), [[50, false], [200, false]]);
});
test("placeLabels pushes two close labels apart, keeping their order", () => {
  const out = placeLabels([{ x: 100, w: 40, v: 1, key: "a" }, { x: 104, w: 40, v: 2, key: "b" }], { lo: 0, hi: 300, gap: 4 });
  assert.ok(out[0].lx < out[1].lx && !overlaps(out[0], out[1], 4) && out.every((o) => !o.hidden));
});
test("placeLabels keeps only the two extremes when three or more stay crowded", () => {
  const items = [{ x: 100, w: 40, v: 70.2, key: "city" }, { x: 101, w: 40, v: 70.5, key: "nat" }, { x: 103, w: 40, v: 70.9, key: "peer" }, { x: 99, w: 40, v: 70.1, key: "sector" }];
  const out = placeLabels(items, { lo: 0, hi: 300, gap: 4, maxShift: 30 });
  assert.deepEqual(out.map((o) => o.hidden), [true, true, false, false].map((_, i) => ![2, 3].includes(i)), "the highest (peer) and the lowest (sector) stay");
  const shown = out.filter((o) => !o.hidden);
  assert.equal(shown.length, 2);
  assert.ok(!overlaps(shown[0], shown[1], 4));
});
test("placeLabels never lets a visible label overlap another or leave [lo, hi] (fuzz)", () => {
  const r = rng(7);
  for (let t = 0; t < 400; t++) {
    const n = 1 + Math.floor(r() * 6), hi = 200 + r() * 400;
    const items = Array.from({ length: n }, (_, k) => ({ x: r() * hi, w: 24 + r() * 30, v: r() * 100, key: "k" + k }));
    const out = placeLabels(items, { lo: 2, hi, gap: 4, maxShift: 32 });
    const shown = out.filter((o) => !o.hidden);
    assert.ok(shown.length >= 1 && out.length === n);
    for (const o of shown) assert.ok(o.lx - o.w / 2 >= 2 - 0.01 && o.lx + o.w / 2 <= hi + 0.01, `inside the bounds (case ${t})`);
    const total = shown.reduce((s, o) => s + o.w + 4, 0);
    if (total < hi - 4) for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) assert.ok(!overlaps(shown[i], shown[j], 4), `no overlap (case ${t}): ${JSON.stringify(shown)}`);
  }
});

// ───────────────────────── dumbbell ─────────────────────────
const row = (label, pts, extra = {}) => ({ label, points: pts.map(([key, v, o]) => ({ key, label: key, v, ...(o || {}) })), ...extra });
test("dumbbellLayout, shared axis: one scale for every row, nice ticks that cover the values, higher values to the right", () => {
  const L = dumbbellLayout({ rows: [row("a", [["city", 64.9], ["nat", 84.3]]), row("b", [["city", 66.2], ["nat", 60.9]])], width: 800, unit: "%" });
  assert.ok(L.shared && L.ticks.length >= 3);
  assert.ok(L.dom[0] <= 60.9 && L.dom[1] >= 84.3 && L.dom[0] >= 0 && L.dom[1] <= 100);
  assert.ok(L.ticks.every((t, i) => i === 0 || t.x > L.ticks[i - 1].x), "ticks run left to right");
  const x = (r, k) => L.rows[r].pts.find((p) => p.key === k).x;
  assert.ok(x(0, "nat") > x(0, "city") && x(1, "city") > x(1, "nat"));
  assert.ok(x(0, "city") > 0 && x(0, "nat") < 800);
  assert.equal(L.height, 2 * DB.rowH + DB.axisH + 2);
  assert.equal(L.rows[1].y, DB.rowH);
  const tick70 = L.ticks.find((t) => t.v === 70), tick80 = L.ticks.find((t) => t.v === 80);
  assert.ok(tick70 && tick80 && tick70.text === "70%");
  assert.ok(Math.abs((tick80.x - tick70.x) - (L.ticks[1].x - L.ticks[0].x)) < 1e-6, "even tick spacing");
});
test("dumbbellLayout, flip: lower values go to the right (better is always on the right)", () => {
  const L = dumbbellLayout({ rows: [row("a", [["city", 30], ["nat", 20]])], width: 600, unit: "%", flip: true });
  const x = (k) => L.rows[0].pts.find((p) => p.key === k).x;
  assert.ok(x("nat") > x("city"), "the lower figure (20) is on the right");
  assert.ok(L.ticks.every((t, i) => i === 0 || t.x < L.ticks[i - 1].x), "ticks run right to left in value order");
});
test("dumbbellLayout, own axes: every row is spread across its own track, a row may carry its own unit and direction", () => {
  const L = dumbbellLayout({ rows: [row("days", [["city", 46], ["nat", 29]], { unit: "days", direction: "lower" }), row("years", [["city", 81.7], ["nat", 83.3]], { unit: "years" })], width: 700, shared: false });
  assert.equal(L.ticks.length, 0);
  assert.equal(L.height, 2 * DB.rowH + 2);
  const [a, b] = L.rows, xs = (r) => r.pts.map((p) => p.x);
  assert.ok(Math.min(...xs(a)) >= DB.padX && Math.max(...xs(a)) <= 700 - DB.padX);
  assert.ok(a.pts.find((p) => p.key === "nat").x > a.pts.find((p) => p.key === "city").x, "days: lower is better, so the 29 sits right of the 46");
  assert.ok(b.pts.find((p) => p.key === "nat").x > b.pts.find((p) => p.key === "city").x);
  assert.equal(a.unit, "days");
  assert.ok(a.conn.x1 - a.conn.x0 > 100, "a connector spans the two points");
});
test("dumbbellLayout: one point has no connector, no points is still a row, nulls are dropped", () => {
  const L = dumbbellLayout({ rows: [row("one", [["city", 50]]), row("none", []), row("nulls", [["city", null], ["nat", NaN], ["peer", 12]]), null], width: 500, unit: "%" });
  assert.equal(L.rows.length, 3);
  assert.equal(L.rows[0].conn, null);
  assert.equal(L.rows[1].pts.length, 0);
  assert.equal(L.rows[2].pts.length, 1);
  assert.match(L.rows[1].aria, /אין נתון/);
  finiteDeep(L);
  assert.equal(dumbbellLayout({ rows: [], width: 400 }).rows.length, 0);
  assert.equal(dumbbellLayout({ rows: undefined, width: 400 }).ticks.length, 0);
});
test("dumbbellLayout: near-identical values keep only the two extreme labels; a percentage axis stays inside 0..100", () => {
  const L = dumbbellLayout({ rows: [row("x", [["city", 70.2], ["nat", 70.5], ["peer", 70.9], ["sector", 70.1]])], width: 500, unit: "%" });
  const shown = L.rows[0].labels.filter((l) => !l.hidden).map((l) => l.key).sort();
  assert.deepEqual(shown, ["peer", "sector"]);
  const hi = dumbbellLayout({ rows: [row("x", [["city", 97], ["nat", 99.5]])], width: 500, unit: "%" });
  assert.ok(hi.dom[1] <= 100 && hi.ticks.every((t) => t.v <= 100 && t.v >= 0));
  const lo = dumbbellLayout({ rows: [row("x", [["city", 1], ["nat", 2]])], width: 500, unit: "per100k" });
  assert.ok(lo.dom[0] >= 0, "a rate cannot go below zero");
});
test("dumbbellLayout: a long label is cut, and the note is dropped first when it would cost the label", () => {
  const long = "שם ארוך מאוד של קבוצה שלא נכנס בשורה אחת ולכן נחתך באמצע המשפט, והשאר נמצא בחלון המידע";
  const wide = dumbbellLayout({ rows: [row("אזורים ברמה גבוהה (7–10)", [["city", 1]], { note: "974 בקבוצה" })], width: 700, unit: "%" });
  assert.ok(wide.rows[0].showNote && !wide.rows[0].cut);
  const narrow = dumbbellLayout({ rows: [row("אזורים ברמה חברתית-כלכלית נמוכה (1–3)", [["city", 1]], { note: "749 בקבוצה" })], width: 330, unit: "%" });
  assert.ok(!narrow.rows[0].showNote, "no room for both: the label wins");
  const cut = dumbbellLayout({ rows: [row(long, [["city", 1]], { note: "קבוצה קטנה" })], width: 330, unit: "%" });
  assert.ok(cut.rows[0].cut && cut.rows[0].labelText.endsWith("…") && cut.rows[0].label === long, "the full label stays for the tooltip");
});
test("dumbbellLayout stays finite and inside its box for random rows (fuzz)", () => {
  const r = rng(11), units = ["%", "days", "per100k", "index", ""];
  for (let t = 0; t < 300; t++) {
    const unit = units[Math.floor(r() * units.length)], width = 200 + Math.floor(r() * 900), keys = ["city", "nat", "peer", "sector", "ses", "target"];
    const rows = Array.from({ length: 1 + Math.floor(r() * 7) }, (_, i) => row("שורה " + i, Array.from({ length: Math.floor(r() * 6) }, (_, k) => [keys[k], (unit === "index" ? r() * 4 - 2 : r() * (unit === "%" ? 100 : 60)) * (r() < 0.1 ? 0 : 1)])));
    const L = dumbbellLayout({ rows, width, unit, shared: r() < 0.6, flip: r() < 0.3 });
    finiteDeep(L);
    for (const rw of L.rows) {
      for (const p of rw.pts) assert.ok(p.x >= DB.padX - 0.01 && p.x <= width - DB.padX + 0.01, `point inside (case ${t})`);
      const shown = rw.labels.filter((l) => !l.hidden);
      for (const l of shown) { const w = estWidth(l.text, 12.5, true) + 2; assert.ok(l.x - w / 2 >= 1.9 && l.x + w / 2 <= width - 1.9, `label inside (case ${t})`); }
      if (rw.pts.length) assert.ok(shown.length >= 1);
    }
  }
});

// ───────────────────────── lollipop rank ─────────────────────────
test("lollipopLayout: a share of the lane per figure, higher figure longer, the national figure on the same scale", () => {
  const L = lollipopLayout({ items: [{ v: 67.2 }, { v: 66.1 }, { v: 65.4 }, { v: null }, { v: NaN }], nat: 65.8, unit: "%" });
  const f = L.rows.map((r) => r.f);
  assert.ok(f[0] > f[1] && f[1] > f[2] && f[2] > 0 && f[0] <= 1);
  assert.equal(f[3], null); assert.equal(f[4], null);
  assert.ok(L.natF > f[2] && L.natF < f[1]);
  assert.ok(L.lo > 0, "neighbours close together: the scale opens just below the lowest so they can be told apart");
  assert.ok(L.hi <= 100);
});
test("lollipopLayout: figures spread wide start at zero (stems are honest), and degenerate inputs are safe", () => {
  const wide = lollipopLayout({ items: [{ v: 10 }, { v: 55 }, { v: 90 }], nat: 40, unit: "%" });
  assert.equal(wide.lo, 0);
  assert.ok(Math.abs(wide.rows[1].f - 55 / wide.hi) < 1e-9);
  const same = lollipopLayout({ items: [{ v: 12 }, { v: 12 }, { v: 12 }], nat: 12, unit: "days" });
  assert.ok(same.rows.every((r) => r.f === same.rows[0].f) && same.natF === same.rows[0].f && same.hi > same.lo);
  finiteDeep(same);
  const none = lollipopLayout({ items: [], nat: undefined });
  assert.equal(none.natF, null);
  assert.equal(lollipopLayout({ items: [{ v: 50 }] }).natF, null);
  const zero = lollipopLayout({ items: [{ v: 0 }, { v: 0 }], unit: "per100k" });
  finiteDeep(zero);
  const neg = lollipopLayout({ items: [{ v: -2 }, { v: 1 }], unit: "index" });
  assert.ok(neg.rows[0].f < neg.rows[1].f);
});

// ───────────────────────── bins and density ─────────────────────────
test("binStep picks 1, 2, 2.5 or 5 times a power of ten near the wanted count, never below minStep", () => {
  for (const [range, want] of [[64.4, 29], [64.4, 13], [36, 20], [0.9, 10], [1200, 24], [7, 8]]) {
    const s = binStep(range, want), mant = s / 10 ** Math.floor(Math.log10(s));
    assert.ok([1, 2, 2.5, 5].some((m) => Math.abs(m - mant) < 1e-6), `${s} is a nice step`);
    const nb = range / s;
    assert.ok(nb > want / 2 && nb < want * 2, `${nb} bins for ${want}`);
  }
  assert.equal(binStep(36, 50, 1), 1, "integer data: bins are never narrower than 1");
  assert.equal(binStep(0, 10), 1);
});
test("binCounts and binIndex: every value in a bin, the top edge belongs to the last bin, float edges do not slip", () => {
  assert.deepEqual(binCounts([0, 2.5, 5, 7.5, 10], 0, 10, 4), [1, 1, 1, 2]);
  assert.equal(binCounts([-1, 11], 0, 10, 4).reduce((s, c) => s + c, 0), 0);
  assert.equal(binIndex(0.3, 0, 0.1, 10), 3, "0.3 / 0.1 is 2.9999999999999996 in floating point");
  assert.equal(binIndex(10, 0, 2.5, 4), 3);
});
test("kdeCurve integrates to about the number of values, on the bars' scale", () => {
  const r = rng(3), vals = Array.from({ length: 300 }, () => 30 + (r() + r() + r()) * 14).sort((a, b) => a - b);
  const c = kdeCurve(vals, 0, 100, 2.5, 200), dx = 100 / 200, area = c.reduce((s, p) => s + p.c * (dx / 2.5), 0);
  assert.ok(Math.abs(area - 300) < 15, `area ${area}`);
  assert.deepEqual(kdeCurve([5], 0, 10, 1), []);
  assert.ok(kdeCurve([5, 5, 5, 5], 0, 10, 1).every((p) => Number.isFinite(p.c)), "equal values: the bandwidth falls back to the bin width");
  assert.ok(kdeCurve(Array.from({ length: 20000 }, (_, i) => i / 200), 0, 100, 2, 60).every((p) => Number.isFinite(p.c)), "a huge input is thinned, not slow");
});

// ───────────────────────── chips ─────────────────────────
test("placeChips: every chip keeps its line under its body; collisions move sideways, then up a row", () => {
  const out = placeChips([{ id: "a", anchor: 300, w: 80 }, { id: "b", anchor: 305, w: 70 }, { id: "c", anchor: 308, w: 60 }], { width: 600, gap: 6, rows: 3 });
  assert.deepEqual(out.map((c) => c.id), ["a", "b", "c"], "input order is kept");
  assert.equal(out[0].row, 0);
  assert.ok(out[0].cx === 300, "the first chip sits right on its anchor");
  for (const c of out) { assert.ok(Math.abs(c.cx - c.anchor) <= c.w / 2 - 6 + 1e-6, "the anchor stays under the chip"); assert.ok(c.cx - c.w / 2 >= 0 && c.cx + c.w / 2 <= 600); }
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) if (out[i].row === out[j].row) assert.ok(Math.abs(out[i].cx - out[j].cx) >= (out[i].w + out[j].w) / 2 + 6 - 1e-6, "no overlap in a row");
});
test("placeChips: an anchor at the very edge is pulled inside the box; room is found without rows when possible (fuzz)", () => {
  const edge = placeChips([{ id: "a", anchor: 2, w: 70 }, { id: "b", anchor: 598, w: 70 }], { width: 600 });
  assert.equal(edge[0].cx, 35); assert.equal(edge[1].cx, 565);
  const r = rng(5);
  for (let t = 0; t < 300; t++) {
    const W = 260 + r() * 700, chips = Array.from({ length: 1 + Math.floor(r() * 3) }, (_, i) => ({ id: "c" + i, anchor: r() * W, w: 40 + r() * 50 }));
    const out = placeChips(chips, { width: W, gap: 6, rows: 3 });
    for (const c of out) assert.ok(c.cx - c.w / 2 >= -1e-6 && c.cx + c.w / 2 <= W + 1e-6, `inside (case ${t})`);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) if (out[i].row === out[j].row && !out[i].crowded && !out[j].crowded) assert.ok(Math.abs(out[i].cx - out[j].cx) >= (out[i].w + out[j].w) / 2 + 6 - 1e-6, `no overlap (case ${t})`);
  }
});

// ───────────────────────── distribution ─────────────────────────
const real = (n = 187, seed = 2) => { const r = rng(seed); return Array.from({ length: n }, () => Math.round((35 + (r() + r() + r()) * 21) * 10) / 10); };
test("distributionLayout: nice equal bins that hold every value, the city's bin, the band and the lines on one scale", () => {
  const values = real(), L = distributionLayout({ values, city: 66.1, nat: 65.8, target: 80, p25: 61.85, p75: 86.85, unit: "%", direction: "higher", width: 900, height: 230 });
  assert.equal(L.bars.reduce((s, b) => s + b.count, 0), 187);
  assert.ok(L.e0 % L.step < 1e-9 || L.step - (L.e0 % L.step) < 1e-9, "edges are multiples of the step");
  assert.ok(L.e0 >= 0 && L.e1 <= 100);
  assert.equal(L.bars.length, L.nb);
  assert.ok(L.bars.every((b, i) => i === 0 || Math.abs(b.left - (L.bars[i - 1].left + L.bars[i - 1].w)) < 1e-6), "bins touch");
  assert.ok(L.cityBin >= 0 && L.bars[L.cityBin].v0 <= 66.1 && L.bars[L.cityBin].v1 > 66.1 && L.bars.filter((b) => b.isCity).length === 1);
  assert.ok(L.X(66.1) > L.band.x && L.X(66.1) < L.band.x + L.band.w, "the city is inside the middle half");
  assert.ok(L.X(80) > L.band.x && L.X(80) < L.band.x + L.band.w, "80 lies inside the band (61.85 to 86.85)");
  assert.ok(Math.abs(L.band.x - L.X(61.85)) < 1e-6 && Math.abs(L.band.w - (L.X(86.85) - L.X(61.85))) < 1e-6);
  assert.ok(L.lines.map((l) => l.id).join() === "nat,target" && Math.abs(L.lines[0].x - L.X(65.8)) < 1e-9);
  assert.ok(L.X(80) > L.X(65.8), "higher is to the right");
  assert.ok(L.curve.length > 20 && L.ticks.length >= 3);
  finiteDeep({ ...L, X: undefined, markX: undefined });
});
test("distributionLayout: the same input gives the same layout", () => {
  const a = distributionLayout({ values: real(), city: 50, nat: 52, unit: "%", width: 700 }), b = distributionLayout({ values: real(), city: 50, nat: 52, unit: "%", width: 700 });
  assert.equal(JSON.stringify({ ...a, X: 0, markX: 0 }), JSON.stringify({ ...b, X: 0, markX: 0 }));
});
test("distributionLayout, direction lower: the axis turns, so a lower value is to the right", () => {
  const values = real(114).map((v) => Math.round(v / 2)), L = distributionLayout({ values, city: 32, nat: 23, unit: "days", direction: "lower", width: 800 });
  assert.ok(L.flip && L.X(10) > L.X(30));
  assert.ok(L.markX("nat") > L.markX("city"), "the nation (23) is better than the city (32), so it is to the right");
  assert.ok(L.ticks.every((t, i) => i === 0 || t.v < L.ticks[i - 1].v), "tick values fall from left to right");
  assert.ok(L.bars.every((b) => b.bx >= 0 && b.bx + b.bw <= 800));
  const ints = distributionLayout({ values: [7, 8, 8, 9, 12, 20, 21, 30, 43], city: 20, unit: "days", width: 800 });
  assert.ok(ints.step >= 1, "whole days: a bin is at least a day wide");
});
test("distributionLayout: a city near the range stretches it, a city far outside sits at the edge with an arrow", () => {
  const values = real(), near = distributionLayout({ values, city: 28, unit: "%", width: 700 });
  assert.ok(Math.min(...values) > 40, "the data starts well above the city");
  assert.equal(near.off.city, undefined, "within reach: the range is stretched down to the city");
  assert.ok(near.e0 <= 28 && near.bars[near.cityBin].v0 <= 28 && near.bars[near.cityBin].v1 > 28 && near.bars[near.cityBin].count === 0, "its own bin is empty but highlighted");
  assert.ok(Math.abs(near.markX("city") - near.X(28)) < 1e-9);
  const far = distributionLayout({ values: values.filter((v) => v < 60), city: 99, nat: 40, unit: "%", direction: "higher", width: 700 });
  assert.equal(far.off.city, 1);
  assert.equal(far.cityBin, -1, "no bin is highlighted");
  assert.ok(far.pin.chip.text.includes("›") && far.pin.off === 1 && !far.pin.stem);
  assert.equal(far.markX("city"), far.X(far.e1), "the pin is at the right edge");
  const left = distributionLayout({ values: values.filter((v) => v > 50), city: 2, unit: "%", width: 700 });
  assert.ok(left.pin.chip.text.includes("‹") && left.markX("city") === left.X(left.e0));
  const flipped = distributionLayout({ values: values.filter((v) => v < 60), city: 99, unit: "%", direction: "lower", width: 700 });
  assert.ok(flipped.pin.chip.text.includes("‹"), "on a turned axis the high value lies to the left");
});
test("distributionLayout: one value, equal values, nothing at all", () => {
  const one = distributionLayout({ values: [42], city: 42, unit: "%", width: 500 });
  assert.ok(one.nb >= 1 && one.bars.reduce((s, b) => s + b.count, 0) === 1 && one.cityBin >= 0 && one.band === null && one.curve.length === 0);
  finiteDeep({ ...one, X: undefined, markX: undefined });
  const same = distributionLayout({ values: [50, 50, 50, 50, 50], city: 50, nat: 50, unit: "%", width: 500 });
  assert.equal(same.bars.reduce((s, b) => s + b.count, 0), 5);
  assert.equal(same.bars.filter((b) => b.count).length, 1, "all in one bin");
  finiteDeep({ ...same, X: undefined, markX: undefined });
  assert.equal(distributionLayout({ values: [], width: 400 }).empty, true);
  assert.equal(distributionLayout({ values: [NaN, null, undefined], width: 400 }).empty, true);
  const onlyCity = distributionLayout({ values: [], city: 12, unit: "days", width: 400 });
  assert.ok(!onlyCity.empty && onlyCity.pin);
  const zeros = distributionLayout({ values: [0, 0, 0, 0], city: 0, unit: "per100k", width: 400 });
  finiteDeep({ ...zeros, X: undefined, markX: undefined });
  assert.ok(zeros.e0 >= 0);
});
test("distributionLayout: the tooltip names the three localities nearest the middle of a bin and counts the rest", () => {
  const items = [{ name: "a", v: 61 }, { name: "b", v: 62.4 }, { name: "c", v: 63.9 }, { name: "d", v: 60.2 }, { name: "e", v: 62.6 }, { name: "x", v: 10 }, { name: "bad", v: null }];
  const L = distributionLayout({ values: [10, 60.2, 61, 62.4, 62.6, 63.9], city: 62.4, unit: "%", width: 900, items });
  const bin = L.bars[L.cityBin];
  assert.deepEqual([bin.v0, bin.v1, bin.mid, bin.count], [60, 70, 65, 5]);
  assert.deepEqual(bin.names.map((n) => n.name), ["c", "e", "b"], "63.9, 62.6 and 62.4 are the nearest to 65");
  assert.equal(bin.more, 2, "a (61) and d (60.2) are counted, not named");
  const total = L.bars.reduce((s, b) => s + b.names.length + b.more, 0);
  assert.equal(total, 6, "every named locality with a value is in some bin; the one without a value is not");
});
test("distributionLayout: chips never collide; the pin's chip clears the chip rows and the bars around it (fuzz)", () => {
  const r = rng(21), units = ["%", "days", "per100k"];
  for (let t = 0; t < 250; t++) {
    const unit = units[Math.floor(r() * units.length)], hi = unit === "%" ? 100 : 60, n = Math.floor(r() * 220), width = 260 + Math.floor(r() * 900);
    const values = Array.from({ length: n }, () => Math.round((r() * r() * hi) * 10) / 10);
    const mk = () => (r() < 0.8 ? r() * hi * (r() < 0.1 ? 1.5 : 1) : undefined);
    const o = { values, city: mk(), nat: mk(), target: mk(), unit, direction: [null, "higher", "lower"][Math.floor(r() * 3)], width, height: 140 + Math.floor(r() * 120) };
    const L = distributionLayout(o);
    if (L.empty) { assert.ok(n === 0 && o.city === undefined); continue; }
    finiteDeep({ ...L, X: undefined, markX: undefined }, `case ${t}`);
    assert.equal(L.bars.reduce((s, b) => s + b.count, 0), values.filter((v) => v >= L.e0 - 1e-9 && v <= L.e1 + 1e-9).length);
    assert.ok(L.H >= 120 && L.baseline - L.barsTop >= 52 - 1e-9);
    for (const b of L.bars) assert.ok(b.bx >= -1e-6 && b.bx + b.bw <= width + 1e-6 && b.y >= L.barsTop - 1e-6 && b.y + b.h <= L.baseline + 1e-6, `bar inside (case ${t})`);
    for (const c of L.refChips) assert.ok(c.cx - c.w / 2 >= -1e-6 && c.cx + c.w / 2 <= width + 1e-6 && c.y >= 0 && c.y + DIST.chipH <= L.bandH + 1e-6, `chip inside (case ${t})`);
    for (let i = 0; i < L.refChips.length; i++) for (let j = i + 1; j < L.refChips.length; j++) { const a = L.refChips[i], b = L.refChips[j]; if (a.row === b.row && !a.crowded && !b.crowded) assert.ok(Math.abs(a.cx - b.cx) >= (a.w + b.w) / 2 + 6 - 1e-6, `ref chips apart (case ${t})`); }
    if (L.pin) {
      const c = L.pin.chip;
      assert.ok(c.cx - c.w / 2 >= -1e-6 && c.cx + c.w / 2 <= width + 1e-6 && c.y >= L.bandH + 2 - 1e-6, `pin chip below the chip rows (case ${t})`);
      assert.ok(L.pin.y < L.baseline, "the pin is above the baseline");
      for (const b of L.bars) if (b.count && b.left + b.w >= c.cx - c.w / 2 - 2 && b.left <= c.cx + c.w / 2 + 2) assert.ok(b.y >= c.y + DIST.chipH + 3 - 1e-6, `no bar pokes into the pin chip (case ${t})`);
    }
    for (const tk of L.ticks) assert.ok(tk.x >= DIST.mx - 1e-6 && tk.x <= width - DIST.mx + 1e-6);
    for (let i = 1; i < L.ticks.length; i++) assert.ok(L.ticks[i].x - L.ticks[i].w / 2 > L.ticks[i - 1].x + L.ticks[i - 1].w / 2, `tick labels apart (case ${t})`);
  }
});

// ───────────────────────── the stylesheet follows the family rules ─────────────────────────
const css = fs.readFileSync(path.join(HERE, "..", "web", "css", "viz", "compare.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const js = fs.readFileSync(path.join(HERE, "..", "web", "js", "viz", "compare.js"), "utf8");
test("compare.css: every selector lives under .v-cmp, no keyframes, no hex colours, no thick side borders", () => {
  assert.doesNotMatch(css, /@keyframes|animation\s*:|animation-name/, "motion comes from the shared vocabulary");
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, "colour tokens only");
  assert.doesNotMatch(css, /border-(inline-start|inline-end|left|right)(-width)?\s*:\s*[3-9]px/, "no side stripes");
  const flat = css.replace(/@container[^{]*\{/g, "").replace(/\}\s*\}/g, "}");           // unwrap the container queries
  const sels = [...flat.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => s && !s.startsWith("@"));
  assert.ok(sels.length > 80);
  const bad = sels.flatMap((s) => s.split(",").map((x) => x.trim())).filter((x) => !x.includes(".v-cmp"));
  assert.deepEqual(bad, [], "a selector outside the family prefix");
});
test("compare.js: no hex colours, no private animation, nothing touches the document at import", () => {
  const src = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src.replace(/url\([^)]*\)/g, ""), /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(src, /\.animate\(|@keyframes|requestAnimationFrame/);
  const top = src.split("\n").filter((l) => /^(const|let|var)\s/.test(l)).join("\n");
  assert.doesNotMatch(top, /\bdocument\.|\bwindow\./, "module-level statements stay DOM free");
});
