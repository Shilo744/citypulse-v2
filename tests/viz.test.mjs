// The pure geometry behind the charts (web/js/viz/math.js): no DOM, so it runs in node.
import test from "node:test";
import assert from "node:assert/strict";
import { niceTicks, linear, padExtent, polar, arcPath, slicePath, geoFrame, ISRAEL, spread, quantile, levelOf, histBins, sqrtRadius, statusRank, STATUS_ORDER, clamp } from "../web/js/viz/math.js";

test("niceTicks: round steps that cover the range", () => {
  const t = niceTicks(3, 47, 4);
  assert.ok(t[0] <= 3 && t[t.length - 1] >= 47);
  const step = t[1] - t[0];
  assert.ok([1, 2, 2.5, 5].includes(step / 10 ** Math.floor(Math.log10(step))) || step / 10 ** Math.floor(Math.log10(step)) === 1);
  assert.deepEqual(niceTicks(5, 5, 3).length > 1, true, "a flat range still gets ticks");
});

test("linear maps a domain onto a range, in either direction", () => {
  const y = linear(0, 100, 200, 0);
  assert.equal(y(0), 200); assert.equal(y(100), 0); assert.equal(y(50), 100);
  assert.equal(linear(5, 5, 0, 10)(5), 0, "a zero-width domain does not divide by zero");
});

test("padExtent widens, respects limits and a minimum span", () => {
  const [lo, hi] = padExtent([10, 20], 0.1, { min: 0, max: 100 });
  assert.ok(lo < 10 && hi > 20 && lo >= 0 && hi <= 100);
  const [a, b] = padExtent([50, 50], 0, { minSpan: 4 });
  assert.equal(b - a, 4);
  assert.deepEqual(padExtent([], 0.1), [0, 1]);
});

test("polar and arcPath: 12 o'clock is up, angles run clockwise", () => {
  const [x, y] = polar(100, 100, 50, 0);
  assert.ok(Math.abs(x - 100) < 1e-9 && Math.abs(y - 50) < 1e-9);
  const [x2, y2] = polar(100, 100, 50, Math.PI / 2);
  assert.ok(Math.abs(x2 - 150) < 1e-9 && Math.abs(y2 - 100) < 1e-9);
  assert.match(arcPath(100, 100, 50, 0, Math.PI / 2), /^M100\.00 50\.00A50 50 0 0 1 150\.00 100\.00$/);
  assert.match(arcPath(100, 100, 50, 0, Math.PI * 1.5), /A50 50 0 1 1/, "more than half a turn uses the large-arc flag");
  assert.match(slicePath(100, 100, 30, 50, 0, 1), /Z$/);
});

test("geoFrame keeps Israel's shape: tall, north above south, everything inside the box", () => {
  const f = geoFrame(200, 540, 10);
  assert.ok(f.aspect > 2.4 && f.aspect < 3, "Israel is about 2.7 times taller than wide once longitude is squeezed");
  assert.ok(f.Y(33.29) < f.Y(29.55), "north is up");
  assert.ok(f.X(35.8) > f.X(34.3), "east is right");
  for (const [lon, lat] of [[34.78, 31.25], [35.21, 31.78], [34.29, 29.55], [35.84, 33.29], [34.95, 32.8]]) {
    assert.ok(f.X(lon) >= 0 && f.X(lon) <= 200 && f.Y(lat) >= 0 && f.Y(lat) <= 540, `${lon},${lat} inside`);
  }
  assert.ok(ISRAEL.x1 > ISRAEL.x0 && ISRAEL.y1 > ISRAEL.y0);
});

test("spread moves crowded labels apart, keeps them inside, and returns them in the original order", () => {
  const out = spread([{ y: 50, h: 14 }, { y: 52, h: 14 }, { y: 54, h: 14 }, { y: 300, h: 14 }], 2, 0, 320);
  assert.equal(out.length, 4);
  for (let i = 1; i < 3; i++) assert.ok(Math.abs(out[i].y - out[i - 1].y) >= 15.9, "boxes do not touch");
  assert.equal(out[3].y, 300, "a lone label stays where it was");
  const edge = spread([{ y: 2, h: 14 }], 2, 0, 100);
  assert.ok(edge[0].y >= 7, "pushed inside the top edge");
});

test("quantile, levelOf and histBins", () => {
  assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(levelOf([1, 2, 3, 4], 3, "higher"), 50, "3 beats 1 and 2");
  assert.equal(levelOf([1, 2, 3, 4], 3, "lower"), 25, "when lower is better, 3 beats only 4");
  const { counts, width } = histBins([1, 2, 2, 3, 9, 10], 0, 10, 5);
  assert.equal(counts.reduce((s, c) => s + c, 0), 6);
  assert.equal(width, 2);
  assert.equal(counts[4], 2, "the top edge belongs to the last bin");
});

test("sqrtRadius, clamp and the status order", () => {
  assert.equal(sqrtRadius(0, 100, 3, 12), 3);
  assert.equal(sqrtRadius(100, 100, 3, 12), 12);
  assert.ok(Math.abs(sqrtRadius(25, 100, 0, 10) - 5) < 1e-9, "area-proportional: a quarter of the size is half the radius");
  assert.equal(clamp(5, 0, 3), 3);
  assert.ok(statusRank("concern") < statusRank("watch") && statusRank("watch") < statusRank("good") && statusRank("good") < statusRank("strength"));
  assert.equal(statusRank("nonsense"), STATUS_ORDER.length);
});
