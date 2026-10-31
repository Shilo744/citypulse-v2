"use strict";
// Plain statistics used by the analysis engine. No dependencies.

const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
function quantile(sorted, p) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
const median = (a) => quantile(a.slice().sort((x, y) => x - y), 0.5);
const round = (v, d = 1) => (v == null || !isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

// Theil-Sen slope: the median of all pairwise slopes. With 3-6 yearly points it is far less fooled by one odd year (e.g. 2021) than a least-squares line.
// points: [{x, y}] -> { slope, intercept, n, r2 } (r2 is the least-squares fit of the same line, only a rough "how straight")
function trend(points) {
  const p = points.filter((q) => isFinite(q.x) && isFinite(q.y));
  if (p.length < 3) return null;
  const slopes = [];
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j].x !== p[i].x) slopes.push((p[j].y - p[i].y) / (p[j].x - p[i].x));
  const slope = median(slopes);
  const intercept = median(p.map((q) => q.y - slope * q.x));
  const my = mean(p.map((q) => q.y));
  const ssTot = sum(p.map((q) => (q.y - my) ** 2));
  const ssRes = sum(p.map((q) => (q.y - (intercept + slope * q.x)) ** 2));
  return { slope, intercept, n: p.length, r2: ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 1 };
}

// rank of `value` among `values` (1 = highest), ties share the better place
const rankDesc = (value, values) => 1 + values.filter((v) => v > value + 1e-9).length;
// share of values strictly below `value`, 0..100
const percentile = (value, values) => (values.length ? (100 * values.filter((v) => v < value - 1e-9).length) / values.length : null);

module.exports = { sum, mean, median, quantile, round, trend, rankDesc, percentile };
