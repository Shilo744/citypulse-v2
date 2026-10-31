// The pure geometry behind the time charts (web/js/viz/time.js): scales, ticks, gaps, label placement, event chips, sparks, trajectory.
// No DOM, so it runs in node. Run only this file: node --test tests/viz-time.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  textWidth, numberIn, cleanPts, typicalStep, splitRuns, xTickValues, slotTicks, yDomain, pathD, areaD, bandD, columnPath, polyLen,
  segHitsRect, polyHitsRect, placeBox, placeLabel, rectsOverlap, sparkSummary, deltaOf, peerBand, indicatorLine, indicatorColumns, kpiTrajectory, smallItem,
  normLine, lineLayout, columnLayout, sparkLayout, trajectoryLayout, EVENTS_IL
} from "../web/js/viz/time.js";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const years = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const pts = (xs, f) => xs.map((x, i) => ({ x, y: f(i, x) }));
// real series (Beer Sheva, indicator bmi_g1_over) and a real gap (Bu'eine-type locality, bmi_g7_over without 2020 to 2022)
const BMI = { city: [26.5, 26.8, 26.5, 26.4, 26.4, 25.5, 25, 24.5, 26.3, 26.6, 26.4, 25, 24.1], nat: [20.5, 20.7, 20.3, 19.8, 19.1, 18.4, 18.5, 19.1, 20.3, 20.6, 19.5, 18, 17.5], peer: [23.3, 23.5, 23, 22.2, 21.8, 21, 21, 21.5, 22.6, 22.8, 21.3, 20, 19.3] };
const Y13 = years(2013, 2025);
const bmiCfg = (extra = {}) => ({ series: [{ key: "city", label: "באר שבע", points: pts(Y13, (i) => BMI.city[i]) }, { key: "nat", label: "ממוצע ארצי", points: pts(Y13, (i) => BMI.nat[i]) }, { key: "peer", label: "דומים", endLabel: false, points: pts(Y13, (i) => BMI.peer[i]) }], unit: "%", ...extra });

// a seeded generator so the property tests are repeatable
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const labelRect = (l) => { const w = textWidth(l.text, 12.5, l.bold ? 700 : 600); return { x: l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2, y: l.y - 11, w, ht: 14 }; };

test("textWidth: grows with the text, the size and the weight; empty is zero", () => {
  assert.equal(textWidth(""), 0);
  assert.ok(textWidth("2024") > textWidth("24"));
  assert.ok(textWidth("2024", 14) > textWidth("2024", 11));
  assert.ok(textWidth("24.1%", 12.5, 700) > textWidth("24.1%", 12.5, 500));
  assert.ok(textWidth("יעד") > 10 && textWidth(null) === 0);
});

test("numberIn reads the number out of the display strings of a KPI", () => {
  assert.equal(numberIn("⁦66.1%⁩"), 66.1);
  assert.equal(numberIn("⁦46⁩ ימים"), 46);
  assert.equal(numberIn("⁦24⁩ ל-100,000"), 24, "the hyphen after a Hebrew letter is a prefix, not a minus");
  assert.equal(numberIn("מ-46 ימים"), 46);
  assert.equal(numberIn("⁦37.5⁩ ימים"), 37.5);
  assert.equal(numberIn("⁦1,234⁩"), 1234);
  assert.equal(numberIn("−3.2"), -3.2);
  assert.equal(numberIn("-3.2"), -3.2);
  assert.equal(numberIn("אין"), null);
  assert.equal(numberIn(null), null);
});

test("cleanPts drops bad points, keeps one per x (the last) and sorts", () => {
  const c = cleanPts([{ x: 2022, y: 3 }, { x: 2020, y: 1 }, { x: 2021, y: null }, { x: NaN, y: 2 }, null, { x: 2020, y: 5, hollow: 1 }, { x: 2023, y: "7" }]);
  assert.deepEqual(c.map((p) => [p.x, p.y]), [[2020, 5], [2022, 3]]);
  assert.equal(c[0].hollow, true);
  assert.deepEqual(cleanPts(null), []);
});

test("a missing year breaks the line: runs are cut where the distance is more than one and a half steps", () => {
  const xs = [...years(2013, 2019), ...years(2023, 2025)], step = typicalStep(xs);
  assert.equal(step, 1);
  const runs = splitRuns(xs.map((x) => ({ x, y: 1 })), step);
  assert.deepEqual(runs.map((r) => r.length), [7, 3]);
  assert.equal(splitRuns(pts(years(2015, 2024), () => 1), 1).length, 1, "no gap, one run");
  assert.equal(splitRuns(pts([2016, 2018, 2020, 2022], () => 1), typicalStep([2016, 2018, 2020, 2022])).length, 1, "a survey every second year is not a gap");
  assert.equal(typicalStep([2020]), 1);
  assert.deepEqual(splitRuns([], 1), []);
});

test("xTickValues: the last year is always labelled, labels never touch, and long ranges are thinned", () => {
  for (const [ppu, n] of [[60, 13], [30, 13], [20, 13], [17, 13], [12, 40], [8, 60], [3, 120]]) {
    const x1 = 2025, x0 = x1 - (n - 1), labelW = textWidth("2024", 11.5), t = xTickValues(x0, x1, 1, ppu, labelW, 8);
    assert.equal(t[t.length - 1], x1, `last year at ${ppu}px per year`);
    assert.ok(t.every((x) => x >= x0 && x <= x1));
    for (let i = 1; i < t.length; i++) assert.ok((t[i] - t[i - 1]) * ppu >= labelW + 8 - 1e-6, `labels at ${ppu}px per year are ${(t[i] - t[i - 1]) * ppu}px apart`);
  }
  assert.deepEqual(xTickValues(2024, 2024, 1, 0, 26), [2024], "one year, one label");
  assert.ok(xTickValues(2013, 2025, 1, 40, 26).length === 13, "everything fits: every year");
});

test("slotTicks: the last column is always labelled and labels have room", () => {
  for (const [n, slot] of [[5, 70], [8, 33], [13, 22], [30, 10]]) {
    const t = slotTicks(n, slot, textWidth("2024", 11.5), 8);
    assert.equal(t[t.length - 1], n - 1);
    for (let i = 1; i < t.length; i++) assert.ok((t[i] - t[i - 1]) * slot >= textWidth("2024", 11.5) + 8 - 1e-6);
  }
});

test("yDomain: 3 to 5 round ticks, percentages stay in 0-100, non-negative data stays non-negative, a flat series gets a span", () => {
  const r = rng(7);
  for (let k = 0; k < 200; k++) {
    const base = r() * 120, span = r() * r() * 80, raw = [base, base + span, base + span * r()];
    for (const unit of ["%", "per1000", "days"]) {
      const vals = unit === "%" ? raw.map((v) => Math.min(100, v)) : raw;      // a percentage is never above 100
      const d = yDomain(vals, { unit, n: k % 2 ? 2 : 3 }), top = Math.max(...vals);
      assert.ok(d.ticks.length >= 3 && d.ticks.length <= 6, `${d.ticks.length} ticks for ${vals}`);
      assert.ok(d.lo <= Math.min(...vals) + 1e-9 && d.hi >= top - 1e-9, "the ticks cover the data");
      assert.ok(d.lo >= 0, "no negative axis for non-negative data");
      if (unit === "%") assert.ok(d.hi <= 100 + 1e-9, "a percentage axis ends at 100 at most");
    }
  }
  const flat = yDomain([50, 50, 50], { unit: "%" });
  assert.ok(flat.hi > flat.lo && flat.ticks.length >= 3);
  assert.deepEqual(yDomain([], {}).ticks.length > 1, true);
  assert.ok(yDomain([-5, 12], { n: 3 }).lo <= -5, "negative values are covered");
  assert.equal(yDomain([3, 9], { zero: true }).lo, 0, "columns start at zero");
  const over = yDomain([90, 130], { unit: "%" });
  assert.ok(over.hi >= 130, "a figure shown in % that is above 100 (growth) is not cut off");
});

test("paths: lines, areas, bands and rounded columns are well formed", () => {
  const p = [{ px: 0, py: 10 }, { px: 10, py: 20 }, { px: 20, py: 5 }];
  assert.equal(pathD(p), "M0 10L10 20L20 5");
  assert.match(areaD(p, 40), /^M0 10L10 20L20 5L20 40L0 40Z$/);
  assert.equal(areaD([p[0]], 40), "", "one point has no area");
  assert.match(bandD(p, p.map((q) => ({ px: q.px, py: q.py + 8 }))), /Z$/);
  assert.equal(bandD(p, p.slice(1)), "");
  assert.ok(Math.abs(polyLen(p) - (Math.hypot(10, 10) + Math.hypot(10, 15))) < 1e-9);
  assert.match(columnPath(0, 20, 10, 100, 6), /^M0 100V16A6 6 0 0 1 6 10H14A6 6 0 0 1 20 16V100Z$/);
  assert.match(columnPath(0, 20, 190, 100, 6), /A6 6 0 0 0/, "a negative column rounds its bottom end");
  assert.match(columnPath(0, 4, 95, 100, 6), /A2 2 0 0 1/, "the radius never exceeds half the width");
});

test("segment and rectangle collisions", () => {
  const r = { x: 10, y: 10, w: 20, ht: 10 };
  assert.ok(segHitsRect(0, 15, 40, 15, r), "crosses");
  assert.ok(segHitsRect(15, 12, 18, 14, r), "inside");
  assert.ok(!segHitsRect(0, 0, 40, 5, r), "passes above");
  assert.ok(!segHitsRect(0, 30, 40, 0, { x: 30, y: 25, w: 5, ht: 3 }), "a diagonal that misses");
  assert.ok(polyHitsRect([{ px: 0, py: 0 }, { px: 50, py: 50 }], { x: 20, y: 20, w: 4, ht: 4 }));
  assert.ok(polyHitsRect([{ px: 12, py: 12 }], r) && !polyHitsRect([{ px: 2, py: 2 }], r));
  assert.ok(rectsOverlap({ x: 0, y: 0, w: 10, ht: 10 }, { x: 5, y: 5, w: 10, ht: 10 }));
  assert.ok(!rectsOverlap({ x: 0, y: 0, w: 10, ht: 10 }, { x: 20, y: 0, w: 10, ht: 10 }));
});

test("placeBox takes the first free candidate, keeps inside the bounds, and returns null when nothing is free", () => {
  const bounds = { x: 0, y: 0, w: 100, ht: 100 }, line = { poly: [{ px: 0, py: 50 }, { px: 100, py: 50 }] };
  const a = { x: 10, y: 45, w: 20, ht: 10 }, b = { x: 10, y: 10, w: 20, ht: 10 }, out = { x: -5, y: 10, w: 20, ht: 10 };
  assert.equal(placeBox([a, b], [line], bounds), b, "the first one is on the line");
  assert.equal(placeBox([out, b], [], bounds), b, "the first one is outside");
  assert.equal(placeBox([a], [line], bounds), null);
  assert.equal(placeBox([b, a], [{ rect: { x: 12, y: 8, w: 4, ht: 4 } }], bounds), null === 1 ? 0 : placeBox([b, a], [{ rect: { x: 12, y: 8, w: 4, ht: 4 } }], bounds), "a label never lands on another label");
  assert.notEqual(placeBox([b, { x: 60, y: 10, w: 20, ht: 10 }], [{ rect: { x: 12, y: 8, w: 4, ht: 4 } }], bounds), b);
});

test("placeLabel always answers: free place, then a place that crosses only a faint line, then any place inside, then pushed inside", () => {
  const bounds = { x: 0, y: 0, w: 100, ht: 60 }, hard = { poly: [{ px: 0, py: 20 }, { px: 100, py: 20 }] }, soft = { poly: [{ px: 0, py: 40 }, { px: 100, py: 40 }], soft: true };
  const onHard = { x: 10, y: 15, w: 20, ht: 10 }, onSoft = { x: 10, y: 35, w: 20, ht: 10 }, free = { x: 10, y: 50, w: 20, ht: 8 };
  assert.equal(placeLabel([onHard, onSoft, free], [hard, soft], bounds), free, "the free one wins");
  assert.equal(placeLabel([onHard, onSoft], [hard, soft], bounds), onSoft, "a faint line may be crossed, a hard one may not");
  assert.equal(placeLabel([onHard], [hard], bounds), onHard, "nothing free: the first place inside");
  const out = placeLabel([{ x: -30, y: 80, w: 20, ht: 10 }], [], bounds);
  assert.ok(out.x >= 0 && out.y + out.ht <= 60, "outside everywhere: pushed inside");
  assert.equal(out.w, 20);
});

test("lineLayout: no data, one value, flat data and bad numbers do not break it", () => {
  assert.equal(lineLayout({ series: [] }, 400, 260).empty, true);
  assert.equal(lineLayout({ series: [{ key: "city", points: [{ x: 2020, y: null }, { x: NaN, y: 3 }] }] }, 400, 260).empty, true);
  assert.equal(lineLayout({}, 400, 260).empty, true);
  const flat = lineLayout({ series: [{ key: "city", label: "א", points: pts(years(2020, 2024), () => 50) }], unit: "%" }, 400, 260);
  assert.ok(flat.ticks.length >= 3 && flat.series[0].pts.every((p) => Number.isFinite(p.py)));
  const zero = lineLayout({ series: [{ key: "city", label: "א", points: pts(years(2020, 2024), () => 0) }], unit: "per1000" }, 400, 260);
  assert.ok(zero.ticks.every((t) => Number.isFinite(t.y)));
});

test("lineLayout: a series with one point is a single large dot with its value, centred when it is the only point", () => {
  const L = lineLayout({ series: [{ key: "city", label: "א", points: [{ x: 2026, y: 5.8 }] }], unit: "per10k" }, 360, 250);
  assert.equal(L.series[0].one, true);
  assert.equal(L.series[0].end.r, 6, "large");
  assert.equal(L.stops.length, 1);
  assert.equal(L.labels.length, 1);
  assert.equal(L.labels[0].text, "5.8");
  const mid = (L.plot.l + L.plot.r) / 2;
  assert.ok(Math.abs(L.series[0].pts[0].px - mid) < 12, "centred");
  const two = lineLayout({ series: [{ key: "city", label: "א", points: [{ x: 2025, y: 5.8 }] }, { key: "nat", label: "ב", points: pts(years(2021, 2025), (i) => 4 + i * 0.1) }], unit: "per10k" }, 360, 250);
  assert.equal(two.series[0].one, true);
  assert.equal(two.labels.length, 2, "the single point and the national line both carry a value");
});

test("lineLayout: end labels of the city and the nation are spread apart and stay inside the chart", () => {
  const cfg = { series: [{ key: "city", label: "א", points: pts(years(2018, 2024), (i) => 60 + i) }, { key: "nat", label: "ב", points: pts(years(2018, 2024), (i) => 60.2 + i) }], unit: "%", target: pts(years(2018, 2024), () => 66.1) };
  const L = lineLayout(cfg, 380, 260), ends = L.labels.map(labelRect).concat(L.chips);
  assert.equal(L.labels.length, 2);
  for (let i = 0; i < ends.length; i++) {
    assert.ok(ends[i].x >= 0 && ends[i].x + ends[i].w <= 380 + 0.5 && ends[i].y >= 0 && ends[i].y + ends[i].ht <= 260, "inside the chart");
    for (let j = i + 1; j < ends.length; j++) assert.ok(!rectsOverlap(ends[i], ends[j]), `end labels ${i} and ${j} do not touch`);
  }
  assert.ok(L.chips.length === 1 && L.chips[0].text === "יעד", "the target chip");
  assert.ok(L.chips[0].x >= L.plot.r, "the chip sits at the right end of the target line");
});

test("lineLayout: gaps cut the line, ticks stay thin, the hover stops are the union of the years", () => {
  const xs = [...years(2013, 2019), ...years(2023, 2025)];
  const L = lineLayout({ series: [{ key: "city", label: "א", points: pts(xs, (i) => 20 + i) }, { key: "nat", label: "ב", points: pts(years(2013, 2025), (i) => 18 + i / 3) }], unit: "%" }, 420, 260);
  assert.deepEqual(L.series[0].runs.map((r) => r.length), [7, 3]);
  assert.equal(L.series[1].runs.length, 1);
  assert.equal(L.stops.length, 13);
  assert.ok(L.stops.every((s, i) => i === 0 || s.px > L.stops[i - 1].px));
  for (let i = 1; i < L.xTicks.length; i++) assert.ok(L.xTicks[i].px - L.xTicks[i - 1].px >= textWidth("2024", 11.5) + 8 - 1e-6);
  assert.equal(L.xTicks[L.xTicks.length - 1].x, 2025);
});

test("lineLayout: events get chips above the plot, two rows at most, none outside the data, none in compact mode", () => {
  const L = lineLayout(bmiCfg({ events: EVENTS_IL }), 360, 280);
  assert.equal(L.events.length, 2);
  assert.ok(L.events[0].band && !L.events[1].band, "2020-2021 is a band, 2023 a hairline");
  const chips = L.events.map((e) => e.chip).filter(Boolean);
  assert.equal(chips.length, 2);
  assert.notEqual(chips[0].lane, chips[1].lane, "they would touch on a phone, so they take two rows");
  for (const c of chips) assert.ok(c.y + c.ht <= L.plot.t, "chips stay above the plot, so they never meet the data");
  assert.ok(chips.every((c) => c.x >= 0 && c.x + c.w <= 360));
  const wide = lineLayout(bmiCfg({ events: EVENTS_IL }), 1000, 280);
  assert.equal(new Set(wide.events.map((e) => e.chip.lane)).size, 1, "on a wide chart one row is enough");
  assert.ok(wide.plot.t < L.plot.t, "less room above the plot when one row is enough");
  const out = lineLayout(bmiCfg({ events: [{ x: 2001, label: "ישן" }, { x: 2040, label: "רחוק" }, { x: 2012, x2: 2014, label: "חופף" }] }), 600, 280);
  assert.deepEqual(out.events.map((e) => e.label), ["חופף"], "an event that overlaps the years is kept, the others are dropped");
  assert.ok(out.events[0].pxA >= out.left, "its band is clipped to the plot");
  const compact = lineLayout(bmiCfg({ events: EVENTS_IL, compact: true }), 360, 168);
  assert.ok(compact.events.every((e) => e.chip === null), "no chips in a compact chart");
  assert.equal(lineLayout(bmiCfg({ events: [{ x: 2020, label: "" }, { label: "בלי שנה" }] }), 600, 280).events.length, 0);
});

test("lineLayout: a target, a projection and a band", () => {
  const th = { series: [{ key: "city", label: "א", points: pts(years(2020, 2024), (i) => [69.3, 66, 64.1, 64.9, 66.1][i]) }, { key: "nat", label: "ב", points: pts(years(2020, 2024), (i) => [71.6, 67, 63.7, 64, 65.8][i]) }], unit: "%", target: [{ x: 2020, y: 75 }, { x: 2021, y: 75 }, { x: 2022, y: 80 }, { x: 2023, y: 80 }, { x: 2024, y: 80 }], projection: [{ x: 2024, y: 66.1 }, { x: 2026, y: 62.9 }] };
  const L = lineLayout(th, 370, 292);
  assert.equal(L.x1, 2026, "the chart reaches the projected year");
  assert.equal(L.xTicks[L.xTicks.length - 1].x, 2026);
  const t = L.target.pts, last = t[t.length - 1];
  assert.ok(Math.abs(last.px - L.X(2026)) < 1e-6, "the target carries on to the end of the projection");
  assert.equal(L.chips.length, 1);
  assert.ok(L.chips[0].x >= L.plot.r, "its chip is at the right edge");
  assert.ok(L.projLabel && L.projLabel.text === "המשך המגמה" && L.projLabel.x <= L.plot.r + 4 + 0.5);
  assert.ok(L.projection.pts[1].py > L.projection.pts[0].py, "the trend falls: lower on the screen is a lower value ... higher py");
  const inline = L.labels.map(labelRect);
  for (const r of inline) assert.ok(r.x >= 0 && r.x + r.w <= 370 && r.y >= 0, "the values at the end of the data find a place inside the chart");
  for (const l of L.labels) assert.ok(l.halo, "values that sit next to their point carry a halo");
  const B = lineLayout(bmiCfg({ band: peerBand([{ series: pts(Y13, (i) => 21 + i * 0.1).map((p) => ({ year: p.x, v: p.y })) }, { series: pts(Y13, (i) => 22 + i * 0.1).map((p) => ({ year: p.x, v: p.y })) }, { series: pts(Y13, (i) => 23 + i * 0.1).map((p) => ({ year: p.x, v: p.y })) }], "range") }), 600, 280);
  assert.equal(B.band.runs.length, 1);
  assert.equal(B.band.runs[0].top.length, 13);
  assert.ok(B.band.runs[0].top.every((p, i) => p.py < B.band.runs[0].bottom[i].py), "the top of the band is higher on the screen than its bottom");
});

test("lineLayout: huge inputs stay light and legible", () => {
  const xs = years(1900, 2399);
  const L = lineLayout({ series: [{ key: "city", label: "א", points: pts(xs, (i) => 50 + 20 * Math.sin(i / 9)) }, { key: "nat", label: "ב", points: pts(xs, (i) => 48 + 10 * Math.cos(i / 7)) }], unit: "%" }, 700, 280);
  assert.equal(L.series[0].dots.length, 0, "no markers on a series this dense (the end marker is drawn on its own)");
  assert.ok(L.series[0].end && L.series[0].end.ping);
  assert.ok(L.xTicks.length <= 700 / 30, `${L.xTicks.length} x labels`);
  assert.ok(L.xTicks.every((t) => t.px >= 0 && t.px <= 700));
  const big = lineLayout({ series: [{ key: "city", label: "א", points: pts(years(2015, 2024), (i) => 1.2e9 + i * 3e7) }], unit: "count" }, 400, 260);
  assert.ok(big.left <= 84 && big.ticks.every((t) => /M$/.test(t.label)), "a billion fits the left margin as 1,200M");
});

test("lineLayout: invariants over random series (nothing leaves the chart, labels never touch, no NaN)", () => {
  const r = rng(2024);
  for (let k = 0; k < 120; k++) {
    const W = [300, 360, 420, 600, 1000][k % 5], H = 168 + (k % 3) * 60, n = 1 + Math.floor(r() * 14), y0 = 2020 - n;
    const xs = years(y0, 2019 + 1).filter(() => r() > 0.12 || n < 3), unit = ["%", "per1000", "days", "index"][k % 4], base = r() * 100, wob = r() * 30;
    const mk = (off) => pts(xs, () => Math.max(0, base + off + (r() - 0.5) * wob));
    const withNat = r() > 0.2, withTarget = r() > 0.6, withProj = r() > 0.7 && xs.length > 2, withBand = r() > 0.7;
    const cfg = { series: [{ key: "city", label: "א", points: mk(0).map((p) => (r() > 0.9 ? { ...p, hollow: true } : p)) }, ...(withNat ? [{ key: "nat", label: "ב", points: mk(r() * 8 - 4) }] : []), ...(r() > 0.5 ? [{ key: "peer", label: "ג", endLabel: false, points: mk(2) }] : [])], unit, compact: k % 7 === 0, events: k % 3 ? EVENTS_IL : [] };
    if (withTarget) cfg.target = pts(xs, () => Math.min(100, base + 10));
    if (withProj) { const last = cfg.series[0].points[cfg.series[0].points.length - 1]; cfg.projection = [{ x: last.x, y: last.y }, { x: last.x + 2, y: last.y - 3 }]; }
    if (withBand) cfg.band = { lo: mk(-6), hi: mk(6) };
    const L = lineLayout(cfg, W, H);
    if (L.empty) continue;
    const boxes = [...L.labels.map(labelRect), ...L.chips, ...L.events.filter((e) => e.chip).map((e) => e.chip)];
    if (L.projLabel) boxes.push({ x: L.projLabel.x - textWidth(L.projLabel.text, 11, 600), y: L.projLabel.y - 11, w: textWidth(L.projLabel.text, 11, 600), ht: 14 });
    for (let i = 0; i < boxes.length; i++) {
      assert.ok(boxes[i].x >= -0.5 && boxes[i].x + boxes[i].w <= W + 0.5, `case ${k}: box ${i} inside the width (${boxes[i].x}..${boxes[i].x + boxes[i].w} of ${W})`);
      assert.ok(boxes[i].y >= -0.5 && boxes[i].y + boxes[i].ht <= H + 0.5, `case ${k}: box ${i} inside the height`);
    }
    const right = L.labels.filter((l) => !l.halo).map(labelRect).concat(L.chips.filter((c) => c.x >= L.plot.r));
    for (let i = 0; i < right.length; i++) for (let j = i + 1; j < right.length; j++) assert.ok(!rectsOverlap(right[i], right[j]), `case ${k}: right-edge labels ${i} and ${j} touch`);
    const evc = L.events.filter((e) => e.chip).map((e) => e.chip);
    for (let i = 0; i < evc.length; i++) for (let j = i + 1; j < evc.length; j++) assert.ok(!rectsOverlap(evc[i], evc[j]), `case ${k}: event chips touch`);
    for (const s of L.series) for (const p of s.pts) assert.ok(Number.isFinite(p.px) && Number.isFinite(p.py) && p.px >= L.plot.l - 1 && p.px <= L.plot.r + 1 && p.py >= L.plot.t - 1 && p.py <= L.plot.b + 1, `case ${k}: every point is inside the plot`);
    assert.ok(L.ticks.length >= 2 && L.ticks.every((t) => Number.isFinite(t.y)), `case ${k}: ticks`);
    assert.ok(L.plot.r > L.plot.l + 60 && L.plot.b > L.plot.t + 40, `case ${k}: the plot keeps a usable size (${L.plot.r - L.plot.l} x ${L.plot.b - L.plot.t})`);
  }
});

test("columnLayout: columns on a zero baseline, labels only when there is room, ticks for the nation, a target line", () => {
  const cfg = { points: pts(years(2020, 2024), (i) => [69.3, 66, 64.1, 64.9, 66.1][i]), nat: pts(years(2020, 2024), (i) => [71.6, 67, 63.7, 64, 65.8][i]), target: pts(years(2020, 2024), (i) => [75, 75, 80, 80, 80][i]), unit: "%" };
  const L = columnLayout(cfg, 400, 264);
  assert.equal(L.cols.length, 5);
  assert.ok(L.cols.every((c) => c.yEnd < c.yBase && c.bw <= 44 && c.bw >= 5), "positive columns rise from the baseline");
  assert.ok(Math.abs(L.y0 - L.plot.b) < 1e-6, "the baseline is the bottom of the plot");
  assert.equal(L.ticks[0].v, 0);
  assert.ok(L.showAll && L.cols.every((c) => c.label), "five columns: every value is written");
  assert.ok(L.cols.every((c) => c.nat && c.nat.x2 - c.nat.x1 > c.bw), "a national tick wider than its column");
  assert.ok(L.target && L.target.chip.x >= L.plot.r, "target chip at the right end");
  assert.ok(L.target.pts[0].px === L.plot.l && L.target.pts[L.target.pts.length - 1].px === L.plot.r, "the target line spans the plot");
  for (const c of L.cols) assert.ok(c.label.y >= 12 && c.label.y < c.yEnd, "a value label sits above its column");
  const many = columnLayout({ points: pts(Y13, (i) => BMI.city[i]), nat: pts(Y13, (i) => BMI.nat[i]), unit: "%" }, 360, 264);
  assert.equal(many.showAll, false);
  assert.deepEqual(many.cols.filter((c) => c.label).map((c) => c.x), [2025], "13 columns: only the last value is written");
  assert.ok(many.xTicks.length < 13 && many.xTicks[many.xTicks.length - 1].i === 12);
  const neg = columnLayout({ points: [{ x: 2020, y: -4 }, { x: 2021, y: 6 }, { x: 2022, y: 0 }] }, 300, 264);
  assert.ok(neg.cols[0].neg && neg.cols[0].yEnd > neg.cols[0].yBase, "a negative column hangs below the baseline");
  assert.ok(neg.cols[2].yBase - neg.cols[2].yEnd >= 2 - 1e-9, "a zero is a visible stub");
  assert.ok(neg.ticks[0].v <= -4 && neg.y0 < neg.plot.b, "the axis reaches below zero");
  assert.equal(columnLayout({ points: [] }, 300, 264).empty, true);
  const hollow = columnLayout({ points: [{ x: 2020, y: 5, hollow: true }, { x: 2021, y: 6 }] }, 300, 264);
  assert.equal(hollow.cols[0].hollow, true);
  const oneT = columnLayout({ points: pts(years(2020, 2022), () => 5), target: [{ x: 2030, y: 9 }] }, 300, 264);
  assert.ok(oneT.target && Math.abs(oneT.target.v - 9) < 1e-9, "a target for a year outside the columns still draws as a flat line");
});

test("sparkLayout: crisp at 60x24, 92x30 and 160x48, with the end dot inside the box", () => {
  const pts1 = BMI.city.map((v, i) => ({ v, year: 2013 + i })), nat = BMI.nat.slice();
  let prev = 0;
  for (const [w, ht] of [[60, 24], [92, 30], [160, 48]]) {
    const S = sparkLayout(pts1, nat, { w, h: ht });
    assert.equal(S.pts.length, 13);
    assert.ok(S.dotR >= prev && S.dotR >= 3 && S.dotR <= 4, "the end dot is 6 to 8px");
    prev = S.dotR;
    const e = S.end, reach = S.dotR + S.ring;
    assert.ok(e.px + reach <= w + 1e-6 && e.px - reach >= -1e-6 && e.py - reach >= -1e-6 && e.py + reach <= ht + 1e-6, `${w}x${ht}: the end dot and its ring stay inside`);
    for (const p of S.pts) assert.ok(p.py >= S.dotR && p.py <= ht - S.dotR, "the line stays inside");
    for (const r of S.natRuns) for (const p of r) assert.ok(p.py >= 0 && p.py <= ht, "the national line shares the scale and stays inside");
  }
  const flat = sparkLayout([{ v: 5 }, { v: 5 }, { v: 5 }], null, { w: 92, h: 30 });
  assert.ok(flat.pts.every((p) => Math.abs(p.py - flat.pts[0].py) < 1e-9) && flat.pts[0].py > 5 && flat.pts[0].py < 25, "a flat series is a line in the middle");
  const one = sparkLayout([{ v: 7 }], null, {});
  assert.equal(one.single, true);
  assert.ok(one.end && Number.isFinite(one.end.px));
  assert.equal(sparkLayout([], null, {}).empty, true);
  assert.equal(sparkLayout([{ v: null }, { v: undefined }], null, {}).empty, true);
  const hole = sparkLayout([{ v: 1 }, { v: 2 }, { v: null }, { v: 4 }, { v: 5 }], null, {});
  assert.deepEqual(hole.runs.map((r) => r.length), [2, 2], "a missing value breaks the line");
  const yrs = sparkLayout([{ v: 1, year: 2013 }, { v: 2, year: 2014 }, { v: 3, year: 2019 }, { v: 4, year: 2020 }], null, {});
  assert.deepEqual(yrs.runs.map((r) => r.length), [2, 2], "a missing year breaks the line");
  assert.ok(yrs.pts[2].px - yrs.pts[1].px > 3 * (yrs.pts[1].px - yrs.pts[0].px), "years set the spacing");
  assert.equal(sparkLayout(pts1, null, { endDot: false }).end !== null, true);
});

test("sparkSummary says the direction and the numbers", () => {
  assert.match(sparkSummary([{ v: 62.4, year: 2015 }, { v: 70, year: 2020 }, { v: 71, year: 2024 }], { unit: "%" }), /עלייה: מ-62\.4% ל-71%.*2015 עד 2024/);
  assert.match(sparkSummary([{ v: 9 }, { v: 4 }], { label: "תמותה" }), /^תמותה: מגמה, ירידה: מ-9 ל-4$/);
  assert.match(sparkSummary([{ v: 5 }, { v: 5.01 }, { v: 5 }]), /ללא שינוי/);
  assert.match(sparkSummary([{ v: 5 }]), /נתון יחיד/);
  assert.match(sparkSummary([]), /אין נתונים/);
});

test("trajectoryLayout: the target and today stay inside, their labels do not touch, the x labels are the first, the last and the target year", () => {
  const history = pts(years(2019, 2025), (i) => [27, 26, 31, 36, 38, 42, 46][i]);
  for (const width of [150, 200, 260, 320, 520]) {
    const L = trajectoryLayout({ history, from: { x: 2025, y: 46 }, to: { x: 2027, y: 37.5 }, nat: 29, unit: "days", width, height: 120 });
    assert.equal(L.W, width);
    for (const p of [L.S, L.E]) assert.ok(p.px >= L.m.l - 1e-6 && p.px <= L.W - L.m.r + 1e-6 && p.py >= L.m.t - 1e-6 && p.py <= L.base, `${width}: the points are inside the plot`);
    assert.ok(L.E.px > L.S.px, "the target is to the right of today");
    const t = L.targetLabel, tw = Math.max(textWidth(t.caption, 10.5, 600), textWidth(t.value, 12.5, 700));
    assert.ok(t.x + tw <= L.W + 1, `${width}: the target label fits to the right of the flag (${t.x + tw})`);
    const d = L.todayLabel, today = { x: d.x, y: d.y, w: d.w, ht: d.ht }, flag = { x: L.E.px - 2, y: L.E.py - 21, w: 14 + tw, ht: 24 };
    assert.ok(d.x >= 0 && d.x + d.w <= L.W && d.y >= 0 && d.y + d.ht <= L.base, `${width}: the label of today is inside`);
    assert.ok(!rectsOverlap(today, flag), `${width}: today's label does not touch the flag`);
    assert.ok(!polyHitsRect(L.hist, { x: d.x, y: d.y, w: d.w, ht: d.ht }), `${width}: nor the history line`);
    assert.ok(L.xLabels.length >= 2 && L.xLabels.length <= 3);
    for (let i = 1; i < L.xLabels.length; i++) assert.ok(L.xLabels[i].px - L.xLabels[i - 1].px >= textWidth("2024", 11) + 6 - 1e-6, "x labels do not touch");
    assert.equal(L.xLabels[L.xLabels.length - 1].key, "target");
    if (L.natLabel) assert.ok(!rectsOverlap(L.natLabel, today) && !polyHitsRect(L.hist, L.natLabel), "the national label sits free");
  }
});

test("trajectoryLayout: a target at the top, a falling target, a single history point, no target, nothing", () => {
  const up = trajectoryLayout({ history: pts(years(2020, 2024), (i) => 60 + i), from: { x: 2024, y: 64 }, to: { x: 2026, y: 95 }, unit: "%" });
  assert.ok(up.E.py < up.S.py && up.E.py - 20 >= 0, "a rising target puts the flag high, inside the chart");
  assert.ok(up.todayLabel.y >= 0 && up.todayLabel.y + up.todayLabel.ht <= up.base);
  const down = trajectoryLayout({ history: pts(years(2020, 2024), (i) => 30 - i), from: { x: 2024, y: 26 }, to: { x: 2026, y: 18 }, unit: "per1000" });
  assert.ok(down.E.py > down.S.py);
  const one = trajectoryLayout({ history: [{ x: 2024, y: 12 }], from: { x: 2024, y: 12 }, to: { x: 2026, y: 9 }, unit: "%" });
  assert.ok(Number.isFinite(one.S.px) && one.hist.length === 1 && one.path.length === 2);
  const noTarget = trajectoryLayout({ history: pts(years(2020, 2024), (i) => 5 + i) });
  assert.equal(noTarget.E, null);
  assert.equal(noTarget.flag, null);
  assert.ok(noTarget.S && noTarget.xLabels.length >= 1);
  assert.equal(trajectoryLayout({}).empty, true);
  const same = trajectoryLayout({ history: [{ x: 2024, y: 12 }], from: { x: 2024, y: 12 }, to: { x: 2024, y: 9 }, unit: "%" });
  assert.ok(Number.isFinite(same.E.px) && Number.isFinite(same.E.py), "a target in the same year does not divide by zero");
  const pct = trajectoryLayout({ history: pts(years(2020, 2024), () => 98), from: { x: 2024, y: 98 }, to: { x: 2026, y: 100 }, unit: "%" });
  assert.ok(Number.isFinite(pct.E.py) && pct.E.py >= pct.m.t - 1e-6, "a percentage near 100 stays inside");
});

test("deltaOf: signed, toned only when the direction is known and the figure is reliable", () => {
  const up = deltaOf(60, 64.2, { unit: "%", direction: "higher" });
  assert.equal(up.sign, "+"); assert.equal(up.mag, "4.2"); assert.equal(up.dir, 1); assert.equal(up.tone, "good"); assert.match(up.suffix, /נק/);
  assert.equal(deltaOf(60, 64.2, { unit: "%", direction: "lower" }).tone, "attn", "a rise where lower is better is a worsening");
  assert.equal(deltaOf(60, 64.2, { unit: "%", direction: null }).tone, "none", "no judgement for a background figure");
  assert.equal(deltaOf(60, 64.2, { unit: "%", direction: "higher", reliable: false }).tone, "none", "none for a small group");
  const down = deltaOf(20, 12, { unit: "days", direction: "lower" });
  assert.equal(down.sign, "−"); assert.equal(down.dir, -1); assert.equal(down.tone, "good"); assert.equal(down.mag, "8"); assert.match(down.suffix, /ימים/);
  const flat = deltaOf(5, 5.01, { unit: "per1000", direction: "higher" });
  assert.equal(flat.flat, true); assert.equal(flat.dir, 0); assert.equal(flat.sign, ""); assert.equal(flat.tone, "none");
  assert.equal(deltaOf(null, 3, {}), null);
  assert.equal(deltaOf(3, undefined, {}), null);
});

test("peerBand: per year, from the localities that have a figure that year", () => {
  const peers = [{ series: [{ year: 2020, v: 10 }, { year: 2021, v: 12 }] }, { series: [{ year: 2020, v: 14 }, { year: 2021, v: 13 }] }, { series: [{ year: 2020, v: 12 }, { year: 2021, v: 11 }, { year: 2022, v: 9 }] }, { series: [{ year: 2020, v: 20 }, { year: 2021, v: null }] }];
  const range = peerBand(peers, "range");
  assert.deepEqual(range.lo.map((p) => [p.x, p.y]), [[2020, 10], [2021, 11]], "2022 has one locality only: no band");
  assert.deepEqual(range.hi.map((p) => [p.x, p.y]), [[2020, 20], [2021, 13]]);
  const iqr = peerBand(peers, "iqr");
  assert.ok(iqr.lo[0].y >= 10 && iqr.hi[0].y <= 20 && iqr.lo[0].y < iqr.hi[0].y);
  assert.ok(iqr.hi[0].y < range.hi[0].y, "the middle half is narrower than the whole range");
  assert.ok(range.label && iqr.label && range.short && iqr.short && range.label !== iqr.label);
  assert.deepEqual(peerBand([], "range").lo, []);
  assert.deepEqual(peerBand(null).hi, []);
});

// the real shapes: city model indicator, recommendation KPI (display strings with direction marks)
const IND = { id: "th_mmrv", label: "חיסון חצבת", unit: "%", direction: "higher", status: "concern", short: "MMR", last: { v: 66.1, year: 2024, reliable: true }, history: { projection: { year: 2026, v: 62.9 } },
  series: [{ year: 2020, v: 69.3, nat: 71.6, target: 75, peer: 73.4 }, { year: 2021, v: 66, nat: 67, target: 75, peer: 68.4 }, { year: 2022, v: 64.1, nat: 63.7, target: 80, peer: 64 }, { year: 2023, v: 64.9, nat: 64, target: 80, peer: 63.5 }, { year: 2024, v: 66.1, nat: 65.8, target: 80, peer: 62.5 }] };

test("indicatorLine and indicatorColumns turn a model indicator into chart input", () => {
  const c = indicatorLine(IND, "באר שבע");
  assert.deepEqual(c.series.map((s) => s.key), ["city", "nat", "peer"]);
  assert.equal(c.series[2].endLabel, false);
  assert.equal(c.series[0].label, "באר שבע");
  assert.equal(c.target.length, 5);
  assert.deepEqual(c.projection, [{ x: 2024, y: 66.1 }, { x: 2026, y: 62.9 }]);
  assert.equal(c.unit, "%");
  assert.match(c.ariaLabel, /חיסון חצבת/);
  const L = lineLayout(c, 400, 292);
  assert.ok(!L.empty && L.x1 === 2026);
  const small = indicatorLine({ ...IND, last: { ...IND.last, reliable: false } }, "יישוב");
  assert.ok(small.series[0].points.every((p) => p.hollow === true), "a small group is drawn hollow");
  assert.equal(small.projection, null, "and takes no trend");
  assert.equal(indicatorLine(IND, "x", { nat: false, peer: false, target: false, projection: false }).series.length, 1);
  const col = indicatorColumns(IND);
  assert.equal(col.points.length, 5); assert.equal(col.nat.length, 5); assert.equal(col.target.length, 5);
  assert.ok(!columnLayout(col, 400, 264).empty);
  assert.equal(indicatorLine({ unit: "%", label: "x", series: [] }, "y").series[0].points.length, 0);
  assert.equal(lineLayout(indicatorLine({ unit: "%", label: "x", series: [] }, "y"), 400, 260).empty, true);
});

test("kpiTrajectory reads a recommendation KPI and the indicator it names", () => {
  const kpi = { indicator: "th_mmrv", label: "MMR/MMRV", from: "⁦66.1%⁩", to: "⁦73.1%⁩", year: 2024, byYear: 2026, people: 230, bench: "יעד משרד הבריאות (⁦80%⁩)" };
  const c = kpiTrajectory(kpi, IND);
  assert.deepEqual(c.from, { x: 2024, y: 66.1 });
  assert.deepEqual(c.to, { x: 2026, y: 73.1 });
  assert.equal(c.history.length, 5);
  assert.equal(c.nat, 65.8);
  assert.equal(c.unit, "%");
  assert.equal(c.label, "MMR/MMRV");
  assert.ok(!trajectoryLayout(c).empty);
  const days = kpiTrajectory({ indicator: "wait_specialist_days", label: "המתנה למומחה", from: "⁦46⁩ ימים", to: "⁦37.5⁩ ימים", year: 2025, byYear: 2027 }, { ...IND, id: "wait_specialist_days", unit: "days", series: [{ year: 2024, v: 40, nat: 28 }, { year: 2025, v: 46, nat: 29 }] });
  assert.equal(days.to.y, 37.5); assert.equal(days.from.y, 46); assert.equal(days.nat, 29);
  assert.equal(kpiTrajectory({ ...kpi, to: "ללא יעד" }, IND), null, "no number in the target: no trajectory");
  assert.equal(kpiTrajectory({ ...kpi, byYear: undefined }, IND), null);
  assert.equal(kpiTrajectory(null, IND), null);
  assert.equal(kpiTrajectory(kpi, null), null);
  assert.equal(kpiTrajectory({ ...kpi, year: undefined, from: undefined }, IND).from.y, 66.1, "without a start, today is the last figure of the series");
});

test("smallItem maps a model indicator", () => {
  const it = smallItem(IND, "#/c/9000/i/th_mmrv");
  assert.equal(it.id, "th_mmrv"); assert.equal(it.label, "MMR"); assert.equal(it.href, "#/c/9000/i/th_mmrv");
  assert.equal(it.direction, "higher"); assert.equal(it.reliable, true); assert.deepEqual(it.last, { v: 66.1, year: 2024 });
  assert.deepEqual(it.series[0], { year: 2020, v: 69.3, nat: 71.6 });
  assert.equal(smallItem({ ...IND, last: { ...IND.last, reliable: false } }).reliable, false);
  assert.equal(smallItem({ ...IND, direction: null, last: null }).last, null);
});

test("normLine ignores what it cannot draw", () => {
  const o = normLine({ series: [{ key: "city", points: [] }, { key: "nat", points: [{ x: 1, y: 2 }] }], projection: [{ x: 1, y: 1 }], band: { lo: [{ x: 1, y: 1 }], hi: [] }, events: [{ x: 5, x2: 3, label: "א" }, { x: 5, label: "" }] });
  assert.equal(o.series.length, 1);
  assert.equal(o.projection, null, "a projection needs two points");
  assert.equal(o.band, null);
  assert.equal(o.events.length, 1); assert.equal(o.events[0].x2, null, "an event that ends before it starts is a hairline");
});

test("the files keep to the design contract: no hex colours, no side stripes, no private keyframes", () => {
  const files = ["js/viz/time.js", "js/viz/gallery-time.js", "css/viz/time.css"];
  for (const f of files) {
    const raw = fs.readFileSync(path.join(WEB, f), "utf8"), src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    src.split("\n").forEach((line, i) => assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(line.replace(/url\([^)]*\)/g, "")), `${f}:${i + 1} has a hex colour`));
    assert.ok(!/border-(left|right|inline-start|inline-end)\s*:\s*[3-9]px/.test(src), `${f}: a thick border on one side`);
    assert.ok(!/@keyframes/.test(src), `${f}: the motion vocabulary is the only animation`);
  }
  const css = fs.readFileSync(path.join(WEB, "css/viz/time.css"), "utf8");
  assert.ok(!/::?(before|after)/.test(css), "no pseudo-element decorations");
  const classes = [...fs.readFileSync(path.join(WEB, "js/viz/time.js"), "utf8").matchAll(/["' ]v-time[\w-]*/g)].map((m) => m[0].trim().replace(/^["']/, ""));
  assert.ok(classes.length > 20 && classes.every((c) => /^v-time/.test(c)), "every class of the family starts with v-time");
});
