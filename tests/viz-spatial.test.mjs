// The pure part of the spatial charts (web/js/viz/spatial.js): standing and colour, the data model, the frame, label placement, hit testing.
// No DOM here, so it runs in node:  node --test tests/viz-spatial.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  R_MIN, R_MAX, R_NONE, levelFn, levelColor, seqColor, scaleGradient, dotRadius, valueText, standingText, prepare, mapLayout, placeDots, assignWave,
  textWidth, placeBox, placeChip, overlapIndex, makeIndex, nearestDot, stepCursor, legendSizes, pickAnchors, shortName, describe, notable
} from "../web/js/viz/spatial.js";
import { levelOf, ISRAEL } from "../web/js/viz/math.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
// a seeded generator so that the "random" fixtures are the same on every run
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const P = (k, v, x, y, extra = {}) => ({ k: String(k), name: "יישוב " + k, v, x, y, ...extra });

// the repository's own list of localities (about 1,460 with a position), when it is there
const LOC = path.join(HERE, "..", "data", "localities.json");
const real = fs.existsSync(LOC)
  ? JSON.parse(fs.readFileSync(LOC, "utf8")).filter((l) => l.lat != null && l.lon != null && l.population != null).map((l) => ({ k: String(l.code), n: l.name_he, x: l.lon, y: l.lat, p: l.population }))
  : null;

test("levelFn gives the same standing as levelOf, ranks from 1 = best, and treats ties alike", () => {
  const r = rng(7), vals = Array.from({ length: 200 }, () => Math.round(r() * 60));          // many ties on purpose
  for (const dir of ["higher", "lower"]) {
    const F = levelFn(vals, dir);
    for (const v of [0, 1, 17, 30, 59, 60, 61, -5]) assert.equal(F.level(v), levelOf(vals, v, dir), `level of ${v} (${dir})`);
    const best = dir === "lower" ? Math.min(...vals) : Math.max(...vals), worst = dir === "lower" ? Math.max(...vals) : Math.min(...vals);
    assert.equal(F.rank(best), 1, "the best value is number 1");
    assert.equal(F.rank(worst) , vals.filter((x) => (dir === "lower" ? x < worst : x > worst)).length + 1);
  }
  const F = levelFn([1, 2, 2, 3], null);
  assert.equal(F.quant(2), 0.5, "tied values share the middle of their ranks");
  assert.equal(levelFn([], "higher").level(5), null);
  assert.equal(levelFn([NaN, null, undefined, 4], "higher").n, 1, "only real numbers count");
});

test("dotRadius stays between 2.2 and 9 px, grows with size like a square root and has a fixed fallback", () => {
  assert.equal(R_MIN, 2.2); assert.equal(R_MAX, 9);
  assert.equal(dotRadius(0, 1000), R_MIN);
  assert.equal(dotRadius(1000, 1000), R_MAX);
  assert.equal(dotRadius(5000, 1000), R_MAX, "a size above the reference is capped");
  assert.ok(dotRadius(250, 1000) > R_MIN && dotRadius(250, 1000) < dotRadius(500, 1000));
  assert.ok(Math.abs(dotRadius(250, 1000) - (R_MIN + (R_MAX - R_MIN) * 0.5)) < 1e-9, "a quarter of the size is half of the way");
  for (const bad of [null, undefined, NaN, -3, "x"]) assert.equal(dotRadius(bad, 1000), R_NONE);
});

test("colour scales are built from tokens: weak end, quiet middle, strong end, and the sequential one", () => {
  assert.equal(levelColor(0), "color-mix(in srgb, var(--attn-bar) 100%, var(--m-mid))");
  assert.equal(levelColor(100), "color-mix(in srgb, var(--good-bar) 100%, var(--m-mid))");
  assert.equal(levelColor(50), "var(--m-mid)");
  assert.equal(levelColor(null), "var(--m-mid)");
  const pct = (c) => Number(/ (\d+)%/.exec(c)[1]);
  assert.ok(pct(levelColor(10)) > pct(levelColor(30)) && pct(levelColor(30)) > pct(levelColor(45)), "the weak side fades towards the middle");
  assert.ok(pct(levelColor(60)) < pct(levelColor(80)) && pct(levelColor(80)) < pct(levelColor(100)));
  assert.ok(pct(levelColor(25)) > 50, "eased: a quarter of the way already shows more than half of the weak colour");
  assert.match(seqColor(0), /var\(--c-city\) 10%, var\(--m-lo\)/);
  assert.match(seqColor(1), /var\(--c-city\) 100%, var\(--m-lo\)/);
  assert.equal(seqColor(undefined), "var(--m-mid)");
  const bar = scaleGradient(false), seq = scaleGradient(true);
  assert.match(bar, /^linear-gradient\(to right, /);
  assert.equal(bar.split("%,").length >= 11, true, "eleven stops");
  assert.ok(bar.includes(levelColor(0) + " 0%") && bar.includes(levelColor(100) + " 100%"), "the bar ends are the dots' own colours");
  assert.ok(seq.includes(seqColor(0.5) + " 50%"));
  for (const c of [levelColor(12), seqColor(0.3), bar, seq]) assert.ok(!/#[0-9a-f]{3,8}\b/i.test(c), "no hex literal");
});

test("valueText and standingText: units and plain Hebrew sentences", () => {
  assert.equal(valueText("%", 66.14), "66.1%");
  assert.equal(valueText("days", 46), "46 ימים");
  assert.equal(valueText("count", 217990), "217,990");
  assert.equal(valueText("per1000", 3.25), "3.3 לכל 1,000");
  assert.equal(valueText("%", null), "—");
  const d = (o) => ({ hasValue: true, reliable: true, level: 35, ...o });
  assert.equal(standingText(d({}), "higher"), "טוב מ-35% מהיישובים");
  assert.equal(standingText(d({ level: 0 }), "lower"), "מהחלשים ביותר מבין היישובים");
  assert.equal(standingText(d({ level: 100 }), "higher"), "מהחזקים ביותר מבין היישובים");
  assert.equal(standingText(d({ level: 97 }), null), "גבוה מ-97% מהיישובים", "a background figure is high or low, never good or bad");
  assert.equal(standingText(d({ level: 0 }), null), "מהנמוכים ביותר מבין היישובים");
  assert.equal(standingText(d({ hasValue: false }), "higher"), "אין נתון");
  assert.equal(standingText(d({ reliable: false }), "higher"), "קבוצה קטנה, ללא דירוג");
  assert.equal(standingText(d({ level: null }), "higher"), "");
});

test("prepare survives empty, null and garbage input", () => {
  for (const arg of [undefined, {}, { points: null }, { points: [] }, { points: [null, undefined, 3, "x", {}, { k: 1 }, { k: 2, x: "a", y: 5 }] }, { points: [P(1, 5, NaN, 31)] }]) {
    const m = prepare(arg);
    assert.equal(m.dots.length, 0); assert.equal(m.total, 0); assert.equal(m.self, null); assert.equal(m.enough, false);
  }
  assert.equal(prepare({ points: [P(1, 5, 35, 31)], direction: "sideways" }).dir, null, "an unknown direction is a background figure");
});

test("prepare with one point: it is drawn, but nothing can be said about its standing", () => {
  const m = prepare({ points: [P(1, 50, 35, 32)], cityKey: 1, direction: "higher" });
  assert.equal(m.total, 1); assert.equal(m.judged, 1); assert.equal(m.enough, false);
  assert.equal(m.self.k, "1"); assert.equal(m.dots[0].level, null); assert.equal(m.dots[0].fill, "var(--m-mid)");
  assert.equal(m.vtop, 50);
});

test("prepare: duplicates, positions from geo, aliases and the order of drawing", () => {
  const geo = [{ k: "1", n: "אחד", x: 35, y: 32, p: 100 }, { k: "2", n: "שניים", x: 35.2, y: 31.5, p: 90000 }, { k: "3", n: "שלושה", x: 34.9, y: 31.9, p: 4000 }, { k: "4", n: "ארבעה", x: 35.5, y: 32.9, p: 7 }];
  const m = prepare({ points: [P(1, 10, 35, 32), P(1, 99, 35, 32), { k: 2, name: "ב", v: 20, lon: 35.2, lat: 31.5 }, { k: 3, name: "ג", v: 30 }, P(4, 40, null, null)], geo });
  assert.equal(m.total, 4, "a repeated key is drawn once");
  assert.equal(m.dots.find((d) => d.k === "1").v, 10, "the first one wins");
  assert.equal(m.dots.find((d) => d.k === "3").lon, 34.9, "a point without a position takes it from geo");
  assert.equal(m.dots.find((d) => d.k === "2").lon, 35.2, "lon/lat are accepted as x/y");
  assert.deepEqual(m.dots.map((d) => d.k), ["2", "3", "1", "4"], "big first, so that small dots end up on top");
  assert.equal(m.sizeKind, "pop"); assert.equal(m.vmax, 90000);
});

test("prepare: size comes from residents, then from the group behind the figure, else nothing", () => {
  const two = [P(1, 5, 35, 32, { d: 200 }), P(2, 6, 35.1, 32, { d: 800 })];
  const g = prepare({ points: two });
  assert.equal(g.sizeKind, "group"); assert.equal(g.vmax, 800);
  const geo = [{ k: "1", x: 35, y: 32, p: 5000 }, { k: "2", x: 35.1, y: 32, p: 20000 }, { k: "9", x: 35.2, y: 32.1, p: 1000000 }];
  const p = prepare({ points: two, geo });
  assert.equal(p.sizeKind, "pop"); assert.equal(p.vmax, 1000000, "the reference is the largest place of the country, not of the points");
  assert.equal(prepare({ points: [P(1, 5, 35, 32, { p: 10 })] }).sizeKind, "pop", "a point may carry its own residents");
  const none = prepare({ points: [P(1, 5, 35, 32), P(2, 6, 35.1, 32)] });
  assert.equal(none.sizeKind, null); assert.ok(none.dots.every((d) => d.size == null));
});

test("prepare: the city when it is missing from the points", () => {
  const pts = [P(1, 10, 35, 32), P(2, 20, 35.1, 32), P(3, 30, 35.2, 32)];
  const a = prepare({ points: pts, cityKey: "9", city: { k: "9", name: "העיר", v: 25, x: 34.8, y: 31.2 } });
  assert.equal(a.self.name, "העיר"); assert.equal(a.self.added, true); assert.equal(a.total, 4); assert.equal(a.self.level, 50, "its value is ranked against the others");
  const b = prepare({ points: pts, cityKey: 9, geo: [{ k: "9", n: "רק בגאו", x: 34.8, y: 31.2, p: 500 }] });
  assert.equal(b.self.name, "רק בגאו"); assert.equal(b.self.hasValue, false); assert.equal(b.self.hollow, true, "no figure: hollow, not judged");
  const c = prepare({ points: pts, cityKey: 9 });
  assert.equal(c.self, null, "nowhere to put it: no city mark, no crash");
  const d = prepare({ points: pts, cityKey: "2" });
  assert.equal(d.self.k, "2"); assert.equal(d.self.added, undefined);
});

test("prepare: standing among the localities, both directions", () => {
  const pts = [10, 20, 30, 40, 50].map((v, i) => P(i + 1, v, 35 + i / 10, 32));
  const hi = prepare({ points: pts, direction: "higher", cityKey: 5 }), lo = prepare({ points: pts, direction: "lower", cityKey: 5 });
  const by = (m, k) => m.dots.find((d) => d.k === String(k));
  assert.equal(by(hi, 5).level, 80); assert.equal(by(hi, 5).rank, 1); assert.equal(by(hi, 1).level, 0); assert.equal(by(hi, 1).rank, 5);
  assert.equal(by(lo, 5).level, 0); assert.equal(by(lo, 5).rank, 5); assert.equal(by(lo, 1).level, 80); assert.equal(by(lo, 1).rank, 1);
  assert.equal(by(hi, 5).fill, levelColor(80)); assert.notEqual(by(hi, 5).fill, by(lo, 5).fill, "the same value is strong in one direction and weak in the other");
  const bg = prepare({ points: pts, direction: null });
  assert.equal(by(bg, 5).rank, null, "no rank for a background figure"); assert.equal(by(bg, 5).fill, seqColor(by(bg, 5).quant));
  assert.ok(by(bg, 5).quant > by(bg, 1).quant);
});

test("prepare: when every locality has the same figure nobody is judged", () => {
  const m = prepare({ points: [1, 2, 3, 4].map((i) => P(i, 50, 35 + i / 10, 32)), direction: "higher", cityKey: 2 });
  assert.equal(m.enough, false); assert.ok(m.dots.every((d) => d.level === null && d.fill === "var(--m-mid)"), "all neutral, none weakest");
  assert.equal(describe(m, { unit: "%" }).includes("טוב מ-"), false);
});

test("prepare: small groups and missing values are hollow and take no part in the standing", () => {
  const pts = [P(1, 10, 35, 32, { d: 500 }), P(2, 20, 35.1, 32, { d: 500 }), P(3, 30, 35.2, 32, { d: 500 }), P(4, 99, 35.3, 32, { d: 20 }), P(5, 98, 35.4, 32, { reliable: false }), P(6, null, 35.5, 32)];
  const m = prepare({ points: pts, direction: "higher", minBase: 100 });
  const by = (k) => m.dots.find((d) => d.k === String(k));
  assert.equal(m.judged, 3);
  for (const k of [4, 5, 6]) { assert.equal(by(k).hollow, true); assert.equal(by(k).level, null); assert.equal(by(k).fill, null); }
  assert.equal(by(3).level, (2 / 3) * 100, "the 99 and 98 do not push the others down");
  assert.equal(m.hasSmall, true); assert.equal(m.hasMissing, true);
  assert.equal(by(4).reliable, false); assert.equal(by(4).hasValue, true);
  assert.equal(prepare({ points: pts, direction: "higher" }).judged, 4, "without minBase only reliable:false and a missing value are left out");
});

test("prepare: peers are flagged, the city is never a peer by accident, and a big input keeps what matters", () => {
  const r = rng(3), pts = Array.from({ length: 5000 }, (_, i) => P(i + 1, r() * 100, 34.3 + r() * 1.5, 29.6 + r() * 3.6, { p: Math.round(r() * 5000) + 1 }));
  const m = prepare({ points: pts, cityKey: 4999, peers: [1, "2", 4998, 99999] });
  assert.ok(m.dots.length <= 2400 + 3, "capped near 2,400 nodes");
  assert.equal(m.total, 5000);
  assert.ok(m.self && m.self.k === "4999");
  assert.deepEqual(m.dots.filter((d) => d.peer).map((d) => d.k).sort(), ["1", "2", "4998"], "peers that are not on the map are ignored, the others survive the cap");
  assert.ok(m.hasPeers);
});

test("prepare lists the localities that have no figure as context, and the largest places as names", () => {
  const geo = [{ k: "1", n: "א", x: 35, y: 32, p: 10 }, { k: "2", n: "ב", x: 35.1, y: 32.1, p: 5000 }, { k: "3", n: "ג", x: 35.2, y: 32.2, p: 900 }, { k: "4", n: "ד", x: null, y: 31, p: 999 }];
  const m = prepare({ points: [P(1, 1, 35, 32)], geo });
  assert.equal(m.ctx.length, 2, "two localities without a figure and with a position");
  assert.deepEqual(m.places.map((p) => p.k), ["2", "3", "1"], "largest first; a place without a position is not a place");
  const noGeo = prepare({ points: [P(1, 1, 35, 32, { p: 10 }), P(2, 2, 35.1, 32, { p: 500 })] });
  assert.deepEqual(noGeo.places.map((p) => p.k), ["2", "1"], "without geo the points themselves are the pool");
});

test("mapLayout: a tall, narrow frame with the country in the middle and room at both sides for the label", () => {
  const L = mapLayout(540);
  assert.equal(L.H, 540);
  assert.ok(L.mapH / L.mapW > 2.4 && L.mapH / L.mapW < 3, "Israel is about 2.7 times taller than wide");
  assert.ok(L.W > L.mapW + 2 * 40 && L.W < 340, "gutters on both sides, narrow enough for a phone");
  assert.ok(Math.abs(L.X(ISRAEL.x0) - L.gutter) < 1 && Math.abs(L.X(ISRAEL.x1) - (L.W - L.gutter)) < 1, "the country is centred between the gutters");
  assert.ok(L.Y(33.2) < L.Y(31.2) && L.Y(31.2) < L.Y(29.6), "north is up");
  assert.ok(L.X(35.5) > L.X(34.5), "east is right");
  assert.ok(mapLayout(300).W < L.W && mapLayout(900).W > L.W, "the width follows the height");
  assert.deepEqual([mapLayout("x").H, mapLayout(null).H, mapLayout(5).H, mapLayout(99999).H], [540, 540, 160, 1400]);
  assert.equal(mapLayout(540).W, mapLayout(540).W, "the same frame every time");
});

test("placeDots keeps every dot on the canvas and enlarges only the city, once", () => {
  const m = prepare({ points: [P(1, 5, 20, 10), P(2, 6, 60, 50, { p: 9 }), P(3, 7, 35, 32, { p: 5 })], cityKey: 3, direction: "higher" });
  const L = mapLayout(540);
  placeDots(m, L);
  for (const d of m.dots) assert.ok(d.cx >= 1 && d.cx <= L.W - 1 && d.cy >= 1 && d.cy <= L.H - 1, "a point far outside the country is pulled to the edge");
  const r1 = m.self.r;
  placeDots(m, L);
  assert.equal(m.self.r, r1, "calling it again does not grow the city again");
  assert.ok(r1 >= 7 && r1 <= 11);
  assert.ok(m.dots.filter((d) => !d.self).every((d) => d.r <= R_MAX));
});

test("assignWave: the entrance index grows with the distance from the city", () => {
  const m = { dots: [{ cx: 100, cy: 100 }, { cx: 130, cy: 100 }, { cx: 100, cy: 200 }, { cx: 300, cy: 100 }] };
  const far = assignWave(m, 100, 100, 7);
  assert.equal(m.dots[0].i, 0, "the city's own spot is first");
  assert.ok(m.dots[1].i < m.dots[2].i && m.dots[2].i < m.dots[3].i);
  assert.equal(m.dots[3].i, 7, "the farthest dot gets the whole range");
  assert.equal(far, 200);
  const flat = { dots: [{ cx: 5, cy: 5 }] };
  assignWave(flat, 5, 5); assert.equal(flat.dots[0].i, 0, "one dot at the origin does not divide by zero");
});

test("textWidth: Hebrew, digits and weight", () => {
  assert.ok(textWidth("באר שבע", 12, 600) > textWidth("אר", 12, 600));
  assert.ok(textWidth("66.1%", 15, 800) > textWidth("66.1%", 15, 400));
  assert.ok(textWidth("abc", 24) > textWidth("abc", 12));
  assert.equal(textWidth("", 12), 0);
});

const dotsAt = (list) => list.map(([cx, cy, r = 3]) => ({ cx, cy, r }));
const inside = (b, W, H) => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

test("placeBox: beside the dot on an empty canvas, on the free side when one side is full, never over an avoided box", () => {
  const W = 300, H = 540, base = { cx: 150, cy: 270, r: 8, w: 100, h: 44, W, H };
  const free = placeBox({ ...base, dots: [] });
  assert.equal(free.hits, 0); assert.ok(inside(free, W, H));
  assert.ok(Math.abs(free.y + free.h / 2 - 270) < 1, "level with the dot");
  assert.equal(free.x, 150 + 8 + 11, "the east side wins a tie, right next to the dot");
  const east = dotsAt(Array.from({ length: 40 }, (_, i) => [175 + (i % 10) * 11, 230 + Math.floor(i / 10) * 20]));       // a block of dots east of the city
  const west = placeBox({ ...base, dots: east });
  assert.equal(west.side, -1); assert.equal(west.hits, 0); assert.equal(west.ax, west.x + west.w, "the leader meets the near edge");
  const wall = placeBox({ ...base, dots: east, avoid: [{ x: 0, y: 200, w: 140, h: 140 }] });
  assert.ok(!intersects(wall, { x: 0, y: 200, w: 140, h: 140 }), "avoided boxes are respected");
  assert.ok(inside(wall, W, H));
});

test("placeBox: slides to a free height, stays inside the canvas near an edge, and gives up when it cannot fit", () => {
  const W = 300, H = 540;
  const slab = dotsAt(Array.from({ length: 30 }, (_, i) => [60 + (i % 15) * 12, 260 + Math.floor(i / 15) * 12]));      // dots on both sides, level with the city
  const both = [...slab, ...dotsAt(Array.from({ length: 30 }, (_, i) => [180 + (i % 15) * 8, 260 + Math.floor(i / 15) * 12]))];
  const b = placeBox({ cx: 150, cy: 270, r: 8, w: 100, h: 44, W, H, dots: both });
  assert.equal(b.hits, 0); assert.ok(Math.abs(b.y + b.h / 2 - 270) > 20, "moved up or down out of the crowd");
  const edge = placeBox({ cx: 20, cy: 10, r: 8, w: 100, h: 44, W, H, dots: [] });
  assert.ok(inside(edge, W, H), "a city in a corner still gets a chip on the canvas"); assert.equal(edge.side, 1);
  assert.equal(placeBox({ cx: 20, cy: 10, r: 8, w: 400, h: 44, W: 300, H: 540, dots: [] }), null, "wider than the canvas: no place");
  const forced = placeChip({ cx: 20, cy: 10, r: 8, w: 400, h: 44, W: 300, H: 540, dots: [] });
  assert.ok(Number.isFinite(forced.x) && Number.isFinite(forced.y) && Number.isFinite(forced.ax), "the chip always lands somewhere");
  const near = placeBox({ cx: 150, cy: 270, r: 8, w: 40, h: 13, W, H, dots: [], maxShift: 0, maxDy: 0, gap: 3 });
  assert.equal(near.x, 161); assert.equal(near.y, 270 - 6.5, "a place name may not slide away from its dot");
});

test("overlapIndex agrees with testing every dot", () => {
  const r = rng(11), dots = Array.from({ length: 400 }, () => ({ cx: r() * 300, cy: r() * 540, r: 2 + r() * 9 }));
  const covered = overlapIndex(dots);
  for (let t = 0; t < 200; t++) {
    const x = r() * 250, y = r() * 480, w = 20 + r() * 100, h = 10 + r() * 50, clear = r() * 4;
    let cost = 0, hits = 0;
    for (const d of dots) { const nx = Math.min(x + w, Math.max(x, d.cx)), ny = Math.min(y + h, Math.max(y, d.cy)); if (Math.hypot(d.cx - nx, d.cy - ny) < d.r + clear) { cost += 5 + d.r * 1.6; hits++; } }
    assert.ok(Math.abs(covered(x, y, w, h, clear) - cost) < 1e-3, `rectangle ${t}`);
    assert.equal(covered.hits, hits);
  }
  assert.equal(overlapIndex([])(0, 0, 10, 10), 0);
});

test("nearestDot: the dot under the pointer, the smaller one when they overlap, the nearest within reach, nothing beyond it", () => {
  const dots = dotsAt([[100, 100, 9], [103, 101, 3], [160, 100, 3], [220, 220, 3]]);
  const idx = makeIndex(dots);
  assert.equal(nearestDot(idx, 103, 101, 9), dots[1], "inside both: the small one is drawn on top");
  assert.equal(nearestDot(idx, 95, 100, 9), dots[0]);
  assert.equal(nearestDot(idx, 168, 100, 9), dots[2], "a few pixels outside a small dot still finds it");
  assert.equal(nearestDot(idx, 180, 100, 9), null, "too far from every dot");
  assert.equal(nearestDot(idx, 180, 100, 20), dots[2], "a finger reaches further");
  assert.equal(nearestDot(makeIndex([]), 5, 5), null);
  assert.equal(nearestDot(idx, 130, 100, 40), dots[0], "the big dot's edge is 21 px away, the small one's 27: the nearer edge wins");
  assert.equal(nearestDot(idx, 143, 100, 40), dots[2], "and the small one once the pointer is past the middle");
});

test("stepCursor walks to the nearest dot in the key's direction", () => {
  const home = { cx: 100, cy: 100, r: 3 }, E = { cx: 130, cy: 102, r: 3 }, W2 = { cx: 60, cy: 100, r: 3 }, N = { cx: 99, cy: 70, r: 3 }, S = { cx: 101, cy: 140, r: 3 }, far = { cx: 100, cy: 300, r: 3 }, off = { cx: 140, cy: 200, r: 3 };
  const all = [home, E, W2, N, S, far, off];
  assert.equal(stepCursor(all, home, "right"), E); assert.equal(stepCursor(all, home, "left"), W2);
  assert.equal(stepCursor(all, home, "up"), N); assert.equal(stepCursor(all, home, "down"), S);
  assert.equal(stepCursor([home, N], home, "down"), null, "nothing that way");
  assert.equal(stepCursor([home, { cx: 200, cy: 130, r: 3 }], home, "right").cx, 200, "30 degrees off the line is still 'to the right'");
  assert.equal(stepCursor([home, { cx: 110, cy: 200, r: 3 }], home, "right"), null, "a dot almost straight below is not 'to the right'");
});

test("legendSizes: three references, ascending, never above the reference size", () => {
  const a = legendSizes(1050151);
  assert.deepEqual(a.map((s) => s.value), [10000, 100000, 1000000]);
  assert.ok(a[0].r < a[1].r && a[1].r < a[2].r && a[2].r <= R_MAX);
  assert.deepEqual(legendSizes(19660).map((s) => s.value), [100, 1000, 10000]);
  assert.equal(legendSizes(40).length, 3, "tiny scales still get a key");
  assert.ok(legendSizes(40).every((s) => s.value <= 40));
  assert.deepEqual(legendSizes(0), []); assert.deepEqual(legendSizes(null), []);
});

test("pickAnchors: well-known places spread over the country, none near the city or the edge", () => {
  const L = mapLayout(540), cities = [["ירושלים", 35.22, 31.78, 1050000], ["תל אביב-יפו", 34.79, 32.08, 495000], ["חיפה", 35.0, 32.8, 297000], ["ראשון", 34.8, 31.96, 260000], ["פתח תקווה", 34.89, 32.09, 250000], ["באר שבע", 34.78, 31.25, 224000], ["אילת", 34.94, 29.55, 56000], ["קריית שמונה", 35.57, 33.21, 24000]];
  const places = cities.map(([name, lon, lat, size], i) => ({ k: String(i), name, lon, lat, size }));
  const a = pickAnchors(places, L, 1050000, { max: 5 });
  assert.equal(a.length, 5);
  assert.equal(a[0].name, "ירושלים", "starts from the largest");
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) assert.ok(Math.hypot(a[i].cx - a[j].cx, a[i].cy - a[j].cy) >= 44, "no two names crowd each other");
  assert.ok(a.some((x) => x.name === "אילת"), "the south of the country is named too");
  assert.ok(!a.some((x) => x.name === "פתח תקווה" || x.name === "ראשון"), "places next to a bigger one are not repeated");
  const skip = pickAnchors(places, L, 1050000, { max: 5, skip: "0" });
  assert.ok(!skip.some((x) => x.k === "0"), "the city itself is never an anchor");
  const bs = L.X(34.78), by = L.Y(31.25), near = pickAnchors(places, L, 1050000, { max: 8, away: { cx: bs, cy: by } });
  assert.ok(near.every((x) => Math.hypot(x.cx - bs, x.cy - by) >= 50), "nothing within 50 px of the city");
  assert.equal(shortName("תל אביב-יפו"), "תל אביב"); assert.equal(shortName("עין כרם"), "עין כרם"); assert.equal(shortName("א-ב"), "א-ב");
  assert.deepEqual(pickAnchors([], L, 1), []);
});

test("describe and notable: what a screen reader gets", () => {
  const pts = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].map((v, i) => P(i + 1, v, 35 + i / 20, 32, { p: 1000 * (i + 1) }));
  const m = prepare({ points: pts, cityKey: 4, direction: "higher", peers: [7, 8], unit: "%" });
  const text = describe(m, { unit: "%", nat: 66.1, label: "חיסון" });
  assert.match(text, /^מפת היישובים לפי חיסון\./);
  assert.match(text, /יישוב 4: 40%, טוב מ-25% מהיישובים/);
  assert.match(text, /הממוצע הארצי 66\.1%/); assert.match(text, /12 יישובים\.$/);
  assert.equal(describe({ total: 0 }), "מפת היישובים: אין נתונים להצגה.");
  const list = notable(m);
  assert.equal(list[0], m.self, "the city comes first");
  assert.ok(list.some((d) => d.k === "7") && list.some((d) => d.k === "8"), "peers are listed");
  assert.ok(list.some((d) => d.v === 120) && list.some((d) => d.v === 10), "the strongest and the weakest are listed");
  assert.equal(new Set(list).size, list.length, "nobody twice");
});

test("a whole country: every locality of the repository's list as a city, on the real frame", { skip: real ? false : "data/localities.json is not here" }, () => {
  const L = mapLayout(540);
  const r = rng(5), sample = real.filter(() => r() < 0.15);
  assert.ok(sample.length > 100);
  let free = 0, off = 0;
  const pts = real.map((g) => ({ k: g.k, name: g.n, v: g.p % 100, x: g.x, y: g.y }));
  for (const g of sample) {
    const m = prepare({ points: pts, cityKey: g.k, direction: "higher", geo: real });
    placeDots(m, L);
    for (const d of m.dots) assert.ok(d.cx >= 1 && d.cx <= L.W - 1 && d.cy >= 1 && d.cy <= L.H - 1);
    const self = m.self, w = 96, others = m.dots.filter((d) => !d.self);
    const c = placeChip({ cx: self.cx, cy: self.cy, r: self.r + 3, w, h: 44, dots: others, W: L.W, H: L.H });
    if (!inside(c, L.W, L.H)) off++;
    if (c.hits === 0) free++;
  }
  assert.equal(off, 0, "no chip ever leaves the canvas");
  assert.ok(free / sample.length > 0.9, `most chips cover no dot at all (${free}/${sample.length})`);
  const m = prepare({ points: pts, cityKey: real[0].k, geo: real });
  assert.ok(m.places[0].size >= m.places[5].size && m.places.length === 60);
});

test("every file of this family keeps to the colour rule: tokens, no hex", () => {
  for (const f of ["../web/js/viz/spatial.js", "../web/css/viz/spatial.css", "../web/js/viz/gallery-spatial.js"]) {
    const src = fs.readFileSync(path.join(HERE, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(src.replace(/url\([^)]*\)/g, "")), f + " has a hex colour");
  }
});
