// The pure geometry behind the matrix charts (web/js/viz/matrix.js): sorting, colour scales, layout, label placement. No DOM, so it runs in node.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  domainCounts, sortIndicators, sortDomains, domainTone, stripParts, stripWords, heatRow, heatLayout, gapText, cellText,
  trendDomain, quadLayout, quadScales, bubbleNodes, quadrantOf, trendWord, textWidth, clipText, placeLabels, worstStatus
} from "../web/js/viz/matrix.js";

const ind = (status, extra = {}) => ({ id: "i" + Math.random().toString(36).slice(2, 7), label: "מדד", status, ...extra });
const hitRects = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// ── domain strip ──
test("domainCounts counts every status and treats an unknown one as background", () => {
  const c = domainCounts([ind("concern"), ind("concern"), ind("watch"), ind("strength"), ind("weird"), null]);
  assert.deepEqual(c, { concern: 2, watch: 1, good: 0, strength: 1, stale: 0, uncertain: 0, na: 1 });
  assert.equal(Object.values(domainCounts([])).reduce((s, n) => s + n, 0), 0, "an empty list counts nothing");
  assert.equal(Object.values(domainCounts()).reduce((s, n) => s + n, 0), 0, "and so does no list at all");
  for (const bad of [null, undefined]) { assert.deepEqual(sortIndicators(bad), []); assert.deepEqual(sortDomains(bad), []); assert.equal(domainCounts(bad).concern, 0); assert.equal(trendDomain(bad), 0.25); }
});

test("sortIndicators runs worst to best, keeps the given order inside a status, and never changes its input", () => {
  const list = [ind("strength", { id: "s" }), ind("good", { id: "g" }), ind("concern", { id: "c1" }), ind("na", { id: "n" }), ind("watch", { id: "w" }), ind("concern", { id: "c2" })];
  const copy = list.map((x) => x.id);
  assert.deepEqual(sortIndicators(list).map((x) => x.id), ["c1", "c2", "w", "n", "g", "s"]);
  assert.deepEqual(list.map((x) => x.id), copy);
  const p = sortIndicators([ind("concern", { id: "a", priority: 1 }), ind("concern", { id: "b", priority: 9 }), ind("concern", { id: "c" })]);
  assert.deepEqual(p.map((x) => x.id), ["b", "a", "c"], "inside one status the higher priority comes first");
  assert.deepEqual(sortIndicators([]), []);
});

test("sortDomains puts the worst domain first: more concerns, then more watches, then fewer good ones", () => {
  const dom = (id, ...st) => ({ id, label: id, indicators: st.map((s) => ind(s)) });
  const out = sortDomains([dom("calm", "good", "strength"), dom("w2", "watch", "watch"), dom("c1", "concern", "good"), dom("c2", "concern", "concern"), dom("w1good", "watch", "good", "good"), dom("empty")]);
  assert.deepEqual(out.map((d) => d.id), ["c2", "c1", "w2", "w1good", "empty", "calm"]);
  assert.equal(out[0].counts.concern, 2);
  assert.deepEqual(out[0].indicators.map((i) => i.status), ["concern", "concern"]);
  assert.deepEqual(sortDomains([dom("a", "good"), dom("b", "good")]).map((d) => d.id), ["a", "b"], "a tie keeps the given order");
  assert.deepEqual(sortDomains([]), []);
  assert.equal(sortDomains([{ id: "x" }])[0].indicators.length, 0, "a domain without an indicators list is an empty domain");
});

test("stripWords: the two worst statuses with the right Hebrew number form", () => {
  assert.equal(stripWords({ concern: 3, watch: 1, good: 0, strength: 0, na: 0 }), "3 דורשים טיפול · 1 למעקב");
  assert.equal(stripWords({ concern: 1, watch: 0, good: 2, strength: 1, na: 0 }), "1 דורש טיפול · 2 תקינים");
  assert.equal(stripWords({ concern: 0, watch: 0, good: 1, strength: 1, na: 0 }), "1 תקין · 1 חוזק");
  assert.equal(stripWords({ concern: 0, watch: 0, good: 0, strength: 3, na: 0 }), "3 חוזקות");
  assert.equal(stripWords({ concern: 0, watch: 0, good: 0, strength: 0, na: 6 }), "מדדי רקע");
  assert.equal(stripWords({ concern: 0, watch: 0, good: 0, strength: 0, na: 0, stale: 1, uncertain: 1 }), "ללא שיפוט");
  assert.equal(stripWords({ concern: 0, watch: 0, good: 0, strength: 0 }), "אין מדדים");
  assert.equal(stripParts({ concern: 1, watch: 1, good: 1, strength: 1 }).length, 2, "never more than two parts");
});

test("domainTone follows the worst judged status", () => {
  assert.equal(domainTone({ concern: 1, watch: 5 }), "attn");
  assert.equal(domainTone({ concern: 0, watch: 1, good: 3 }), "watch");
  assert.equal(domainTone({ concern: 0, watch: 0, good: 0, strength: 1 }), "good");
  assert.equal(domainTone({ concern: 0, watch: 0, good: 0, strength: 0, na: 4 }), "none");
});

// ── heat matrix ──
const years = [2018, 2019, 2020, 2021, 2022];
const row = (direction, vals, refs) => ({ direction, cells: vals.map((v, k) => (v === undefined ? null : { year: years[k], v, ref: refs ? refs[k] : 50 })).filter(Boolean) });

test("heatRow: better and worse follow the direction, intensity is scaled to the row's own largest gap", () => {
  const up = heatRow(row("higher", [60, 40, 50, 55, 45]), years);
  assert.deepEqual(up.cells.map((c) => c.kind), ["better", "worse", "same", "better", "worse"]);
  assert.equal(up.maxGap, 10);
  assert.equal(up.cells[0].t, 1, "the largest gap uses the full colour");
  assert.ok(Math.abs(up.cells[3].t - Math.pow(0.5, 0.85)) < 1e-9 && up.cells[3].t < up.cells[0].t, "half the gap is less than the full colour");
  const down = heatRow(row("lower", [60, 40, 50, 55, 45]), years);
  assert.deepEqual(down.cells.map((c) => c.kind), ["worse", "better", "same", "worse", "better"], "when lower is better the same gaps swap sides");
  assert.equal(down.mode, "gap");
  // a row of tiny gaps still spends its colours well; a row of equal values spends none
  const tiny = heatRow(row("higher", [50.2, 49.7, 50, 50, 50], [50, 50, 50, 50, 50]), years);
  assert.equal(tiny.cells[0].kind, "same", "a gap under 2% of the reference is near the reference");
  assert.equal(heatRow(row("higher", [50, 50, 50, 50, 50]), years).cells.every((c) => c.kind === "same"), true);
  const small = heatRow({ direction: "higher", cells: [{ year: 2018, v: 1, ref: 0 }, { year: 2019, v: 0.4, ref: 0 }] }, years);
  assert.equal(small.cells[0].t, 1, "a reference of zero scales by the row's own gaps");
});

test("heatRow: missing years, small groups, missing references and figures without a direction", () => {
  const r = heatRow({ direction: "higher", cells: [{ year: 2018, v: 70, ref: 60 }, { year: 2019, v: 80, ref: null }, { year: 2020, v: 50, ref: 60, reliable: false }, { year: 2021, v: null, ref: 60 }] }, years);
  assert.deepEqual(r.cells.map((c) => c.kind), ["better", "noref", "hollow", "missing", "missing"]);
  assert.equal(r.cells[2].t, undefined, "a small group takes no colour judgement");
  const bg = heatRow({ direction: null, cells: [{ year: 2018, v: 10 }, { year: 2019, v: 20 }, { year: 2020, v: 30 }] }, years);
  assert.equal(bg.mode, "scale");
  assert.deepEqual(bg.cells.slice(0, 3).map((c) => c.t), [0, 0.5, 1], "a figure without a direction is a scale between the row's lowest and highest");
  assert.equal(heatRow({ direction: null, cells: [{ year: 2018, v: 5 }] }, years).cells[0].t, 0.5, "one value sits in the middle");
  assert.equal(heatRow({ direction: "higher", cells: [{ year: 2018, v: 5 }] }, years).mode, "scale", "no reference at all: describe, do not judge");
  assert.equal(heatRow({ cells: [] }, years).cells.every((c) => c.kind === "missing"), true);
  assert.equal(heatRow({}, []).cells.length, 0);
});

test("heatLayout: cells 18 to 36px (up to 56px for few years), numbers only from 40px, a phone stacks the label above", () => {
  for (const w of [260, 360, 480, 700, 900, 1300]) for (const n of [1, 3, 6, 7, 9, 13, 18]) {
    const L = heatLayout({ width: w, n });
    assert.ok(L.cell >= 18 && L.cell <= (n <= 6 ? 56 : 36), `cell ${L.cell} for ${n} years at ${w}px`);
    assert.equal(L.showNum, L.cell >= 40);
    assert.ok(L.cellsW <= w + 1, `the cells (${L.cellsW}) fit in ${w}px`);
    assert.ok(L.shown >= 1 && L.shown + L.skip === n);
    if (!L.stacked) assert.ok(L.labelW + 16 + L.cellsW <= w + 1, `label, gap and cells fit in ${w}px`);
    assert.ok([1, 2, 3].includes(L.step));
  }
  assert.equal(heatLayout({ width: 1100, n: 13 }).cell, 36, "a wide space does not stretch the cells");
  assert.equal(heatLayout({ width: 1100, n: 3 }).showNum, true, "three years: wide cells with their numbers");
  assert.equal(heatLayout({ width: 1100, n: 13 }).showNum, false);
  assert.equal(heatLayout({ width: 358, n: 14 }).stacked, true, "a phone puts the label above the cells");
  assert.equal(heatLayout({ width: 358, n: 14 }).skip, 0, "and still shows every year");
  assert.ok(heatLayout({ width: 200, n: 30 }).skip > 0, "when even 18px cells cannot fit, the oldest years are dropped");
  assert.equal(heatLayout({ width: 900, n: 10 }).step, 1);
  assert.equal(heatLayout({ width: 360, n: 14 }).step, 2, "tight columns label every second year");
});

test("gapText and cellText format signed gaps and short cell numbers", () => {
  assert.equal(gapText("%", 3.14), "⁦+3.1⁩ נק׳");
  assert.equal(gapText("%", -2), "⁦−2⁩ נק׳");
  assert.equal(gapText("days", 0.01), "⁦0⁩ ימים", "a gap that rounds to nothing carries no sign");
  assert.equal(gapText("count", 5), "⁦+5⁩");
  assert.equal(gapText("%", null), "—");
  assert.equal(cellText("%", 66.14), "66.1");
  assert.equal(cellText("per1000", 127.3), "127");
  assert.equal(cellText("count", 217990), "218K");
  assert.equal(cellText("count", 1250), "1.3K");
  assert.equal(cellText("count", 2500000), "2.5M");
  assert.equal(cellText("%", 0), "0");
  assert.equal(cellText("%", null), "");
});

// ── priority quadrant ──
const pt = (x, y, r, extra = {}) => ({ id: "p" + x + "_" + y, label: "מדד " + x, x, y, r, tone: "attn", ...extra });

test("trendDomain zooms to the largest trend, stays between 0.25 and 1, and obeys yMax", () => {
  assert.equal(trendDomain([]), 0.25);
  assert.equal(trendDomain([pt(10, 0.02, 5)]), 0.25);
  assert.equal(trendDomain([pt(10, 0.3, 5), pt(20, -0.2, 5)]), 0.45);
  assert.equal(trendDomain([pt(10, 5, 5)]), 1, "never over 1");
  assert.equal(trendDomain([pt(10, 0.3, 5)], 0.6), 0.6);
  assert.equal(trendDomain([pt(10, null, 5), { x: 1 }]), 0.25, "a missing trend counts as none");
});

test("quadLayout: a phone gets a frame at least 320px tall, smaller bubbles and three labels", () => {
  const wide = quadLayout({ width: 1100, height: 420 }), phone = quadLayout({ width: 358, height: 420 });
  assert.equal(wide.H, 420); assert.equal(wide.labelCount, 6); assert.equal(wide.compact, false);
  assert.ok(phone.H >= 320 && phone.compact && phone.labelCount === 3);
  assert.ok(phone.rMax < wide.rMax && phone.rMax >= 11);
  assert.ok(quadLayout({ width: 358, height: 100 }).H >= 320, "even a small requested height gets 320 on a phone");
  assert.ok(quadLayout({ width: 1100, height: 100 }).H >= 320);
  for (const L of [wide, phone]) assert.ok(L.frame.x1 > L.frame.x0 && L.frame.y1 > L.frame.y0);
});

test("quadScales: strong to the right, improving up, the middle and zero lines in the middle, values clamped", () => {
  const L = quadLayout({ width: 800, height: 420 }), S = quadScales(L, 0.4);
  assert.ok(S.X(100) > S.X(50) && S.X(50) > S.X(0), "a higher standing is further right");
  assert.ok(S.Y(0.3) < S.Y(0) && S.Y(0) < S.Y(-0.3), "an improving trend is higher up (a smaller y)");
  assert.equal(S.X(50), S.midX); assert.equal(S.Y(0), S.zeroY);
  assert.ok(Math.abs(S.midX - (L.frame.x0 + L.frame.x1) / 2) < 1e-9 && Math.abs(S.zeroY - (L.frame.y0 + L.frame.y1) / 2) < 1e-9);
  assert.equal(S.X(250), S.X(100)); assert.equal(S.X(-9), S.X(0)); assert.equal(S.Y(9), S.Y(0.4)); assert.equal(S.Y(-9), S.Y(-0.4));
});

test("bubbleNodes: biggest first, area grows with priority, every bubble stays inside the frame", () => {
  const L = quadLayout({ width: 700, height: 420 }), S = quadScales(L, 0.5);
  const nodes = bubbleNodes([pt(0, -1, 5), pt(100, 1, 80), pt(50, 0, 20), pt(-30, 7, 100), pt(40, 0, 0), { id: "no-x", y: 0, r: 5 }, pt(60, 0, null)], L, S);
  assert.equal(nodes.length, 6, "a point without a standing is left out");
  assert.deepEqual(nodes.map((n) => n.r).slice(0, 3), [100, 80, 20]);
  for (let i = 1; i < nodes.length; i++) assert.ok((nodes[i - 1].r || 0) >= (nodes[i].r || 0));
  assert.ok(nodes[0].rad > nodes[2].rad && nodes[2].rad > nodes[nodes.length - 1].rad);
  assert.ok(Math.abs(nodes[0].rad - L.rMax) < 1e-9, "the biggest priority gets the biggest bubble");
  for (const n of nodes) {
    assert.ok(n.rad >= L.rMin - 1e-9 && n.rad <= L.rMax + 1e-9);
    assert.ok(n.cx - n.rad >= L.frame.x0 && n.cx + n.rad <= L.frame.x1 && n.cy - n.rad >= L.frame.y0 && n.cy + n.rad <= L.frame.y1, "inside the frame");
  }
  assert.equal(bubbleNodes([], L, S).length, 0);
  const one = bubbleNodes([pt(30, 0, 5)], L, S);
  assert.equal(one.length, 1); assert.ok(Math.abs(one[0].rad - L.rMax) < 1e-9, "a single bubble is the biggest one");
});

test("quadrantOf and trendWord", () => {
  assert.equal(quadrantOf(10, -0.2), "urgent"); assert.equal(quadrantOf(10, 0.2), "rising"); assert.equal(quadrantOf(80, 0.2), "strong"); assert.equal(quadrantOf(80, -0.2), "slipping");
  assert.equal(quadrantOf(50, 0.1), "strong"); assert.equal(quadrantOf(20, 0), "rising", "no change is not worsening");
  assert.equal(trendWord(0.2), "בשיפור"); assert.equal(trendWord(-0.2), "בהידרדרות"); assert.equal(trendWord(0), "יציב"); assert.equal(trendWord(null), "יציב");
});

test("textWidth and clipText", () => {
  assert.ok(textWidth("מחומש 4 מנות") > textWidth("שעלת") && textWidth("") === 0 && textWidth(null) === 0);
  assert.ok(textWidth("abc", 24) > textWidth("abc", 12));
  assert.equal(clipText("קצר", 200), "קצר");
  const clipped = clipText("חיסון חצבת-חזרת-אדמת עד גיל שנה ועוד קצת", 90);
  assert.ok(clipped.endsWith("…") && textWidth(clipped) <= 90, clipped);
  assert.equal(clipText("ארוך מאוד", 5), "", "nothing useful fits");
});

test("placeLabels: labels never overlap each other, a caption or the frame edge; short labels are kept", () => {
  const frame = { x0: 60, y0: 30, x1: 1000, y1: 380 };
  const avoid = [{ x0: 70, x1: 190, y0: 355, y1: 372 }];
  const mk = (id, cx, cy, text, rad = 14) => ({ id, cx, cy, rad, w: textWidth(text, 12) + 2 });
  const items = [mk(0, 90, 360, "המתנה למומחה", 26), mk(1, 424, 208, "MMR/MMRV", 24), mk(2, 157, 234, "תאונות קשות"), mk(3, 157, 261, "המתנה לרופא נשים"), mk(4, 463, 222, "שעלת"), mk(5, 483, 217, "מחומש 4 מנות")];
  const out = placeLabels(items, frame, { h: 16, avoid });
  assert.equal(out.length, 6, "the short label survives too");
  const rects = out.map((p) => ({ x0: p.anchor === "start" ? p.x : p.x - p.w, x1: p.anchor === "start" ? p.x + p.w : p.x, y0: p.y - 8, y1: p.y + 8 }));
  rects.forEach((r, i) => {
    assert.ok(r.x0 >= frame.x0 && r.x1 <= frame.x1 && r.y0 >= frame.y0 && r.y1 <= frame.y1, "inside the frame");
    avoid.forEach((a) => assert.ok(!hitRects(r, a), "clear of the caption"));
    rects.slice(i + 1).forEach((q) => assert.ok(!hitRects(r, q), "clear of the other labels"));
  });
  assert.ok(out.some((p) => p.moved) && out.every((p) => typeof p.bx === "number"), "a moved label knows where its leader line starts");
  // six bubbles at one spot: the labels are stacked apart, or left out, never drawn on top of each other
  const pile = Array.from({ length: 6 }, (_, k) => mk(k, 300, 200, "אותו מקום " + k));
  const out2 = placeLabels(pile, frame, { h: 16 });
  assert.ok(out2.length >= 4);
  const r2 = out2.map((p) => ({ x0: p.anchor === "start" ? p.x : p.x - p.w, x1: p.anchor === "start" ? p.x + p.w : p.x, y0: p.y - 8, y1: p.y + 8 }));
  r2.forEach((r, i) => r2.slice(i + 1).forEach((q) => assert.ok(!hitRects(r, q))));
  // no room anywhere: the label is left out (it will show on hover)
  assert.equal(placeLabels([mk(0, 500, 200, "טקסט ארוך מאוד שלא ייכנס", 14)], { x0: 480, y0: 30, x1: 520, y1: 380 }, { h: 16 }).length, 0);
  assert.deepEqual(placeLabels([], frame), []);
  // near the right edge the label goes to the left of the bubble
  const edge = placeLabels([mk(0, 990, 100, "בקצה הימני")], frame, { h: 16 });
  assert.equal(edge[0].side, "l"); assert.equal(edge[0].anchor, "end");
});

// ── compare heat ──
test("worstStatus is the worst status that has a count above zero", () => {
  assert.equal(worstStatus({ concern: 2, watch: 1, good: 5, strength: 1 }), "concern");
  assert.equal(worstStatus({ concern: 0, watch: 1, good: 5, strength: 1 }), "watch");
  assert.equal(worstStatus({ concern: 0, watch: 0, good: 5, strength: 1 }), "good");
  assert.equal(worstStatus({ concern: 0, watch: 0, good: 0, strength: 2 }), "strength");
  assert.equal(worstStatus({ concern: 0, watch: 0, good: 0, strength: 0, uncertain: 3 }), "none");
  assert.equal(worstStatus(null), "none"); assert.equal(worstStatus(undefined), "none"); assert.equal(worstStatus({}), "none");
});

// ── the family obeys the design contract (the same rules as tests/design.test.mjs, applied to this family's own files) ──
test("this family's files use colour tokens only and draw no side stripes", () => {
  const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
  const files = ["js/viz/matrix.js", "js/viz/gallery-matrix.js", "css/viz/matrix.css"].map((f) => path.join(WEB, f));
  const SIDE = /(border-(inline-start|inline-end|left|right)|border(InlineStart|InlineEnd|Left|Right))(-width)?["']?\s*[:=]\s*["'`]?\s*([3-9]|\d\d+)px/;
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    src.split("\n").forEach((line, i) => {
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(line.replace(/url\([^)]*\)/g, "").replace(/&#\d+;/g, "")), `hex colour at ${path.basename(f)}:${i + 1}`);
      assert.ok(!SIDE.test(line), `side stripe at ${path.basename(f)}:${i + 1}`);
    });
  }
  const css = fs.readFileSync(files[2], "utf8");
  assert.ok(!/@keyframes/.test(css), "no private keyframes: the motion vocabulary only");
  const bare = [];
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}@]+)\{[^{}]*\}/g)) for (const sel of m[1].split(",")) if (sel.trim() && !sel.includes("v-mx-")) bare.push(sel.trim());
  assert.deepEqual(bare, [], "every selector is in the .v-mx- namespace");
});
