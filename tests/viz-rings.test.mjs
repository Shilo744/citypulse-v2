// The geometry and the wording behind the rings family (web/js/viz/rings.js): no DOM, so it all runs in node.
// Run only this file: node --test tests/viz-rings.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as R from "../web/js/viz/rings.js";
import { TAU } from "../web/js/viz/math.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const sum = (xs) => xs.reduce((s, x) => s + x, 0);

test("the module has no side effects on import and exports the five charts", () => {
  for (const f of ["statusDonut", "progressRing", "gauge", "standingMeter", "waffle"]) assert.equal(typeof R[f], "function", f);
});

/* ── donut ── */
test("donutCounts folds stale, uncertain and na into one background arc and ignores junk", () => {
  const c = R.donutCounts({ concern: 10, watch: 16, good: 1, strength: 1, stale: 2, uncertain: 1, na: 4, extra: 9 });
  assert.equal(c.background, 7); assert.equal(c.judged, 28); assert.equal(c.total, 35);
  assert.deepEqual(c.parts, { stale: 2, uncertain: 1, na: 4 });
  const junk = R.donutCounts({ concern: -3, watch: NaN, good: "x", strength: null, na: Infinity });
  assert.equal(junk.total, 0);
  assert.equal(R.donutCounts(undefined).total, 0); assert.equal(R.donutCounts(null).judged, 0);
});

test("donutLayout: arcs run clockwise from 12 o'clock in the order concern, watch, good, strength, background", () => {
  const lay = R.donutLayout({ concern: 10, watch: 16, good: 4, strength: 3, na: 7 }, { r: 96.8, thickness: 26, gap: 4 });
  assert.deepEqual(lay.segs.map((s) => s.key), ["concern", "watch", "good", "strength", "background"]);
  for (let i = 0; i < lay.segs.length; i++) {
    const s = lay.segs[i];
    assert.ok(s.a1 > s.a0, "an arc has a positive length");
    assert.ok(s.a0 >= 0 && s.a1 <= TAU, "inside one turn");
    if (i) assert.ok(s.a0 > lay.segs[i - 1].a1, "the next arc starts after the last one ends");
  }
  near(R.donutLayout({ concern: 1, watch: 1 }, { r: 90, thickness: 20, gap: 4 }).segs[0].start, 2 / (TAU * 90), 1e-9);
});

test("donutLayout: the visible stretches and the gaps add up to the whole ring, and a gap separates neighbours", () => {
  const r = 96.8, t = 26, gap = 4, lay = R.donutLayout({ concern: 10, watch: 16, good: 1, strength: 1 }, { r, thickness: t, gap });
  near(sum(lay.segs.map((s) => s.vis)) + lay.segs.length * gap, TAU * r, 1e-6);
  for (let i = 1; i < lay.segs.length; i++) {
    // between two round caps the clear space is the distance between the path ends minus one thickness
    const clear = (lay.segs[i].a0 - lay.segs[i - 1].a1) * r - t;
    assert.ok(clear > gap - 0.6 && clear < gap + 0.6, `gap ${clear}`);
  }
});

test("donutLayout: shares are proportional when they are big, and a tiny share becomes a round dot", () => {
  const even = R.donutLayout({ concern: 5, watch: 5 }, { r: 90, thickness: 20, gap: 4 });
  near(even.segs[0].vis, even.segs[1].vis, 1e-9);
  const lay = R.donutLayout({ concern: 1, watch: 5000, good: 1 }, { r: 96.8, thickness: 26, gap: 4 });
  const dots = lay.segs.filter((s) => s.count === 1);
  assert.equal(dots.length, 2);
  for (const d of dots) { assert.ok(d.vis >= 26 - 1e-6, "a dot is at least as wide as the ring is thick"); assert.ok(d.len <= 0.6, "its path is a point; the round caps make the dot"); }
  const big = lay.segs.find((s) => s.count === 5000);
  assert.ok(big.vis > 0.9 * TAU * 96.8 - 80, "the big share keeps nearly everything");
});

test("donutLayout: one colour is a whole ring without gaps; no counts draws nothing; huge counts are fine", () => {
  const one = R.donutLayout({ watch: 7 }, { r: 80, thickness: 20, gap: 4 });
  assert.equal(one.segs.length, 1); assert.equal(one.segs[0].a0, 0); assert.ok(one.segs[0].a1 > TAU - 0.01);
  assert.equal(R.donutLayout({ concern: 0, watch: 0 }).segs.length, 0);
  const huge = R.donutLayout({ concern: 1e9, watch: 3, good: 2e9, na: 7 }, { r: 90, thickness: 26, gap: 4 });
  assert.equal(huge.segs.length, 4);
  assert.ok(huge.segs.every((s) => isFinite(s.a0) && isFinite(s.a1) && s.len > 0));
  const tiny = R.donutLayout({ concern: 3, watch: 3, good: 3, strength: 3, na: 3 }, { r: 20, thickness: 16, gap: 4 });
  assert.ok(tiny.segs.every((s) => isFinite(s.a0) && s.a1 >= s.a0), "a ring too small for its shares still lays out");
});

test("donutCenter: the number to act on, then the judged total, then the empty words", () => {
  assert.deepEqual(R.donutCenter(R.donutLayout({ concern: 10, watch: 3 })), { value: 10, label: "דורשים טיפול", empty: false });
  assert.equal(R.donutCenter(R.donutLayout({ concern: 1 })).label, "דורש טיפול");
  const calm = R.donutCenter(R.donutLayout({ watch: 3, good: 2, na: 9 }));
  assert.equal(calm.value, 5); assert.equal(calm.label, "מדדים שנשפטו");
  const empty = R.donutCenter(R.donutLayout({}));
  assert.equal(empty.empty, true); assert.equal(empty.value, null); assert.equal(empty.label, "אין מדדים שנשפטו");
  assert.equal(R.donutCenter(R.donutLayout({ concern: 4 }), { centerValue: "7/9", centerLabel: "תחומים" }).value, "7/9");
});

test("donut wording: the tooltip line is the one the contract shows", () => {
  assert.equal(R.segmentTitle("concern", 10, 41), "דורשים טיפול: 10 מדדים (24%)");
  assert.equal(R.segmentTitle("concern", 1, 28), "דורש טיפול: מדד אחד (4%)");
  assert.equal(R.segmentTitle("strength", 3, 28), "חוזקות: 3 מדדים (11%)");
  assert.equal(R.segmentTitle("background", 13, 41), "ללא שיפוט: 13 מדדים (32%)");
  assert.equal(R.shareText(1, 5000), "<1%"); assert.equal(R.shareText(0, 10), "0%"); assert.equal(R.shareText(3, 0), "0%");
  assert.equal(R.donutAria(R.donutLayout({ concern: 10, watch: 16, good: 1, strength: 1 })), "פילוח 28 מדדים לפי מצב: 10 דורשים טיפול, 16 למעקב, 1 תקין, 1 חוזק");
  assert.equal(R.donutAria(R.donutLayout({})), "אין מדדים שנשפטו");
});

test("centerFont: 26% of the size, smaller when the number is long, never tiny", () => {
  assert.equal(R.centerFont("10", 220, 26), Math.round(220 * 0.26));
  assert.ok(R.centerFont("100,000", 220, 26) < R.centerFont("10", 220, 26));
  assert.ok(R.centerFont("123,456,789,012", 120, 14) >= 14);
  assert.ok(R.textEm("1,234") < R.textEm("1,234,567"));
});

/* ── progress ring ── */
test("ringFraction clamps and survives nothing", () => {
  assert.equal(R.ringFraction(79, 100), 0.79); assert.equal(R.ringFraction(1250, 100), 1); assert.equal(R.ringFraction(-5, 100), 0);
  assert.equal(R.ringFraction(3, 6), 0.5); assert.equal(R.ringFraction(null), 0); assert.equal(R.ringFraction(NaN), 0); assert.equal(R.ringFraction(50, 0), 0.5);
});

/* ── gauge ── */
test("gaugeScale: what the page gives, 0..100 for a percentage, else a round number above everything", () => {
  assert.deepEqual(R.gaugeScale({ value: 66, unit: "%", nat: 60, target: 80 }), { min: 0, max: 100 });
  assert.deepEqual(R.gaugeScale({ value: 12, max: 50 }), { min: 0, max: 50 });
  const days = R.gaugeScale({ value: 46, unit: "days", nat: 29 });
  assert.equal(days.min, 0); assert.ok(days.max >= 46 * 1.15 && days.max <= 100, `${days.max}`);
  assert.ok(R.gaugeScale({ value: 250, unit: "%" }).max >= 250, "a percentage above 100 gets a bigger scale");
  const flat = R.gaugeScale({ value: 5, min: 5, max: 5 });
  assert.ok(flat.max > flat.min, "an empty range is repaired");
  assert.ok(R.gaugeScale({}).max > 0);
});

test("gaugeAngle: minimum at 9 o'clock, maximum at 3 o'clock, outside values stop at the ends", () => {
  near(R.gaugeAngle(0, 0, 100), -Math.PI / 2); near(R.gaugeAngle(100, 0, 100), Math.PI / 2); near(R.gaugeAngle(50, 0, 100), 0);
  near(R.gaugeAngle(130, 0, 100), Math.PI / 2); near(R.gaugeAngle(-9, 0, 100), -Math.PI / 2);
  near(R.gaugeAngle(null, 0, 100), -Math.PI / 2);
  assert.equal(R.gaugeOutside(130, 0, 100), 1); assert.equal(R.gaugeOutside(-1, 0, 100), -1); assert.equal(R.gaugeOutside(50, 0, 100), 0); assert.equal(R.gaugeOutside(null, 0, 100), 0);
});

test("gaugeGeometry: the drawing is wider than the dial, with room for a label beside either end", () => {
  const g = R.gaugeGeometry(240);
  assert.equal(g.rOut, 120); assert.equal(g.W, 240 + 2 * g.gutter); assert.ok(g.gutter >= 42);
  near(g.R, g.rOut - g.tk / 2); near(g.rIn, g.rOut - g.tk); assert.ok(g.H > g.cy + g.tk / 2, "the bottom labels fit under the arc ends");
  assert.ok(R.gaugeGeometry(10).D >= 120 && R.gaugeGeometry(1e6).D <= 600, "the size is kept in a sane range");
});

test("gaugeValueFont: the value never pokes through the arc", () => {
  const g = R.gaugeGeometry(240);
  for (const text of ["66.1", "5.96", "-0.11", "1,250", "217,990", "100"]) {
    const em = R.textEm(text) + 0.45, f = R.gaugeValueFont(em, g.rIn, 55);
    assert.ok(f <= 55);
    if (f > 14) assert.ok(Math.hypot((em * f) / 2, 24 + f * 0.72) <= g.rIn - 8 + 1e-9, `${text} at ${f}`);
  }
  assert.equal(R.gaugeValueFont(R.textEm("66.1"), g.rIn, 40), 40, "a short value keeps the biggest size asked for");
});

const overlap = (a, b) => a.x0 < b.x0 + b.w && b.x0 < a.x0 + a.w && a.y0 < b.y0 + b.h && b.y0 < a.y0 + a.h;
test("placeCallouts: one label, at every angle, stays inside the drawing, above the base line and clear of the arc", () => {
  for (const size of [160, 240, 360]) {
    const g = R.gaugeGeometry(size);
    for (const w of [28, 40, 52]) for (let deg = -90; deg <= 90; deg += 3) {
      const [p] = R.placeCallouts([{ key: "nat", a: (deg * Math.PI) / 180, w }], g), b = p.box;
      assert.ok(b.x0 >= 0 && b.x0 + b.w <= g.W, `${size}/${w}/${deg}: sideways ${b.x0}..${b.x0 + b.w} of ${g.W}`);
      assert.ok(b.y0 >= 0 && b.y0 + b.h <= g.cy + 1, `${size}/${w}/${deg}: vertical ${b.y0}`);
      assert.ok(R.boxClear(b.x0, b.y0, b.w, b.h, g.cx, g.cy, g.rOut + 3.9), `${size}/${w}/${deg}: touches the arc`);
    }
  }
});

test("placeCallouts: two labels never overlap, wherever the two marks are", () => {
  const g = R.gaugeGeometry(240), d2r = (d) => (d * Math.PI) / 180;
  for (let a = -90; a <= 90; a += 6) for (let b = -90; b <= 90; b += 6) {
    const [p, q] = R.placeCallouts([{ key: "nat", a: d2r(a), w: 38 }, { key: "target", a: d2r(b), w: 44 }], g);
    assert.ok(!overlap(p.box, q.box), `${a}/${b} overlap`);
    for (const x of [p, q]) {
      assert.ok(x.box.x0 >= 0 && x.box.x0 + x.box.w <= g.W && x.box.y0 >= 0, `${a}/${b} leaves the drawing`);
      assert.ok(R.boxClear(x.box.x0, x.box.y0, x.box.w, x.box.h, g.cx, g.cy, g.rOut + 3.9), `${a}/${b} touches the arc`);
    }
  }
});

test("placeCallouts: an easy label sits right above its tick, and the result keeps the order of the input", () => {
  const g = R.gaugeGeometry(240), out = R.placeCallouts([{ key: "a", a: 0, w: 36 }, { key: "b", a: 0.6, w: 36 }], g);
  assert.deepEqual(out.map((o) => o.key), ["a", "b"]);
  near(out[0].box.x0 + out[0].box.w / 2, g.cx, 1.5);
  assert.ok(out[0].tick.every(isFinite) && out[0].tick[1] > out[0].tick[3], "the tick points outwards (up at 12 o'clock)");
});

test("gauge wording: the way to the target, and the sentence a screen reader gets", () => {
  assert.equal(R.targetPhrase({ unit: "%", direction: "higher", value: 66.1, target: 80 }), "חסרות 13.9 נק׳ ליעד");
  assert.equal(R.targetPhrase({ unit: "%", direction: "higher", value: 95, target: 90 }), "עומד ביעד");
  assert.match(R.targetPhrase({ unit: "days", direction: "lower", value: 46, target: 30 }), /^חורג מהיעד ב-16/);
  assert.equal(R.targetPhrase({ unit: "days", direction: "lower", value: 20, target: 30 }), "עומד ביעד");
  assert.equal(R.targetPhrase({ unit: "%", direction: "higher", value: 80, target: 80 }), "בדיוק ביעד");
  assert.equal(R.targetPhrase({ unit: "%", direction: "higher", value: 80, target: null }), null);
  const aria = R.gaugeAria({ label: "MMR/MMRV", unit: "%", value: 66.1, nat: 65.8, target: 80, min: 0, max: 100, direction: "higher" });
  assert.equal(aria, "MMR/MMRV: 66.1%, הממוצע הארצי 65.8%, היעד 80%, בסקאלה מ-0% עד 100%");
  assert.equal(R.gaugeAria({ label: "x", unit: "%", value: null, min: 0, max: 100 }), "x: אין נתון");
});

test("figures: whole numbers have no decimals, small plain numbers keep two, percentages one", () => {
  assert.equal(R.fmtFig("%", 66.14), "66.1%"); assert.equal(R.fmtFig("%", 80), "80%"); assert.equal(R.fmtFig("days", 46), "46");
  assert.equal(R.fmtFig("per1000", 5.96), "5.96"); assert.equal(R.fmtFig("years", 81.7), "81.7"); assert.equal(R.fmtFig("%", null), "—");
  assert.equal(R.figDec("index", -0.11), 2); assert.equal(R.figDec("%", 4.55), 1); assert.equal(R.figText("count", 217990), "217,990");
});

test("deriveTone: the page's tone wins; otherwise the target, then the nation, and only for a figure with a direction", () => {
  assert.equal(R.deriveTone({ tone: "attn", value: 1 }), "attn"); assert.equal(R.deriveTone({ tone: "concern" }), "attn"); assert.equal(R.deriveTone({ tone: "strength" }), "good");
  assert.equal(R.deriveTone({ value: 66, target: 80, direction: "higher" }), "watch"); assert.equal(R.deriveTone({ value: 85, target: 80, direction: "higher" }), "good");
  assert.equal(R.deriveTone({ value: 46, nat: 29, direction: "lower" }), "watch"); assert.equal(R.deriveTone({ value: 20, nat: 29, direction: "lower" }), "good");
  assert.equal(R.deriveTone({ value: 66, nat: 50, direction: null }), null, "a background figure is not judged");
  assert.equal(R.deriveTone({ value: null, direction: "higher", nat: 3 }), null);
});

/* ── standing meter ── */
test("meterModel and meterText: level wins, rank and of can stand in, everything is clamped", () => {
  assert.deepEqual(R.meterModel({ level: 8, rank: 143, of: 155 }), { level: 8, rank: 143, of: 155, beats: 8 });
  assert.equal(R.meterText(R.meterModel({ level: 8, rank: 143, of: 155 })), "מקום 143 מתוך 155");
  assert.equal(R.meterText(R.meterModel({ level: 7.7 })), "טוב מ-8% מהיישובים");
  const fromRank = R.meterModel({ rank: 143, of: 155 });
  near(fromRank.level, (12 / 155) * 100, 1e-9); assert.equal(fromRank.beats, 8);
  assert.equal(R.meterModel({ level: -4 }).level, 0); assert.equal(R.meterModel({ level: 140 }).level, 100);
  assert.equal(R.meterModel({}).level, null); assert.equal(R.meterText(R.meterModel({})), "אין דירוג");
  assert.equal(R.meterModel({ level: 50, rank: 0, of: 10 }).rank, null, "a rank of zero is not a rank");
  assert.equal(R.meterTone(8), "attn"); assert.equal(R.meterTone(50), "none"); assert.equal(R.meterTone(90), "good"); assert.equal(R.meterTone(null), null);
});

/* ── waffle ── */
test("waffleCells: 100 cells, row by row from the top right, solid cells = round(value)", () => {
  const w = R.waffleCells({ value: 24.1 });
  assert.equal(w.cells.length, 100); assert.equal(w.nCity, 24); assert.equal(w.n.solid, 24); assert.equal(w.n.empty, 76);
  assert.deepEqual([w.cells[0].row, w.cells[0].col], [0, 0], "the first cell is the top row's right-most one (col 0 = right)");
  assert.deepEqual([w.cells[10].row, w.cells[10].col], [1, 0]); assert.deepEqual([w.cells[99].row, w.cells[99].col], [9, 9]);
  assert.ok(w.cells.slice(0, 24).every((c) => c.kind === "solid") && w.cells.slice(24).every((c) => c.kind === "empty"));
  assert.equal(w.rel, null);
});

test("waffleCells: above the national share the extra cells are stronger, below it the missing ones are outlines", () => {
  const above = R.waffleCells({ value: 24.1, nat: 17.5 });
  assert.equal(above.rel, "above"); assert.equal(above.n.solid, 18); assert.equal(above.n.extra, 6); assert.equal(above.n.gap, 0);
  assert.equal(above.cells[17].kind, "solid"); assert.equal(above.cells[18].kind, "extra"); assert.equal(above.cells[23].kind, "extra"); assert.equal(above.cells[24].kind, "empty");
  const below = R.waffleCells({ value: 19.1, nat: 26.3 });
  assert.equal(below.rel, "below"); assert.equal(below.n.solid, 19); assert.equal(below.n.gap, 7); assert.equal(below.n.extra, 0);
  assert.equal(below.cells[18].kind, "solid"); assert.equal(below.cells[19].kind, "gap"); assert.equal(below.cells[25].kind, "gap"); assert.equal(below.cells[26].kind, "empty");
  const same = R.waffleCells({ value: 20.2, nat: 19.8 });
  assert.equal(same.rel, "same"); assert.equal(same.n.extra + same.n.gap, 0);
});

test("waffleCells: 0, 100, out of range and missing values", () => {
  assert.equal(R.waffleCells({ value: 0 }).n.solid, 0); assert.equal(R.waffleCells({ value: 100 }).n.solid, 100);
  assert.equal(R.waffleCells({ value: 140 }).nCity, 100); assert.equal(R.waffleCells({ value: -5 }).nCity, 0);
  const none = R.waffleCells({ value: null, nat: 12 });
  assert.equal(none.has, false); assert.equal(none.rel, null);
  const full = R.waffleCells({ value: 100, nat: 88 });
  assert.equal(full.n.extra, 12);
});

test("waffleLayout: ten cells and nine gaps fill the size exactly", () => {
  for (const size of [100, 150, 220, 400]) { const l = R.waffleLayout(size); near(10 * l.cell + 9 * l.gap, size, 1e-9); assert.ok(l.rx < l.cell / 2); }
});

test("waffleCaption: built from the props, with the national figure", () => {
  assert.deepEqual(R.waffleCaption({ value: 24.1, nat: 17.5, noun: "ילדי כיתה א׳" }), { main: "מתוך כל 100 ילדי כיתה א׳: 24", rel: "above", relWord: "מעל הממוצע הארצי", natText: "18" });
  const below = R.waffleCaption({ value: 19.1, nat: 26.3, noun: "תינוקות" });
  assert.equal(below.main, "מתוך כל 100 תינוקות: 19"); assert.equal(below.relWord, "מתחת לממוצע הארצי"); assert.equal(below.natText, "26");
  assert.equal(R.waffleCaption({ value: 4.6 }).main, "מתוך כל 100: 4.6");
  assert.equal(R.waffleCaption({ value: null, noun: "ילדים" }).main, "אין נתון");
  assert.equal(R.waffleCaption({ value: 37, noun: "תושבים" }).relWord, null);
});

/* ── the rules of the family ── */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
test("the family files hold no colour literals and no private keyframes: only tokens and the motion vocabulary", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  for (const f of ["web/js/viz/rings.js", "web/css/viz/rings.css", "web/js/viz/gallery-rings.js"]) {
    const src = fs.readFileSync(path.join(root, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(src), f + " has a hex colour");
    assert.ok(!/@keyframes/.test(src), f + " has a private keyframe");
  }
});
