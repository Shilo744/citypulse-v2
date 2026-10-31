"use strict";
/**
 * The meta-analysis of one locality, indicator by indicator: where it stands (now), where it came from (history),
 * how it compares (nation, peers, all localities, the official target) and what that means (status, priority).
 * Pure functions over the Store: no network, no model. Every figure in the output comes from the data.
 */
const S = require("../lib/stats");
const { guidesFor } = require("./guide");

const SES_LABEL = { low: "אזורים ברמה חברתית-כלכלית נמוכה (1–3)", mid: "אזורים ברמה בינונית (4–6)", high: "אזורים ברמה גבוהה (7–10)" };
const MIN_SPLIT_BASE = 100;        // a sector / band needs at least this many people to be compared
const MIN_SPLIT_SHARE = 0.08;      // ... and at least this share of the locality
const EQUITY_GAP = 15;             // percentage points between the best and worst group that deserve a finding
const EQUITY_Z = 3;                // ... and the gap must be this many standard errors wide

// every threshold of the decision rules in one place: the method page prints these same numbers
const RULES = {
  minBase: 100, concernLevel: 25, concernWorseningLevel: 40, farBelowTarget: 10, strengthLevel: 75, goodLevel: 50, nearTarget: 5,
  targetFarRel: 0.25, targetNearRel: 0.10,        // the same two distances from an official target for units that are not percentages: a share of the target
  trendSlope: 0.5, trendMove: 2, trendRelSlope: 0.03, trendRelMove: 0.12, projectionMinYears: 4, splitMin: MIN_SPLIT_BASE, splitShare: MIN_SPLIT_SHARE, equityGap: EQUITY_GAP, equityZ: EQUITY_Z
};

const sign = (ind) => (ind.direction === "higher" ? 1 : ind.direction === "lower" ? -1 : 0);

// a trend counts only if the slope and the whole move are both larger than yearly noise
// (percentages: absolute points; other units: a share of the typical value, since 0.5 of a per-1,000 rate is not 0.5 of a percentage point)
function trendClass(ind, tr, delta, ref = 0) {
  if (!tr) return "unknown";
  const isPct = ind.unit === "%";
  const th = isPct ? RULES.trendSlope : Math.abs(ref) * RULES.trendRelSlope, minMove = isPct ? RULES.trendMove : Math.abs(ref) * RULES.trendRelMove;
  if (Math.abs(tr.slope) < th || Math.abs(delta) < minMove) return "stable";
  const s = sign(ind), up = tr.slope > 0;
  if (s === 0) return up ? "rising" : "falling";
  return (up ? 1 : -1) * s > 0 ? "improving" : "worsening";
}

function splitsOf(cell, natCell, field, labelOf) {
  const g = cell && cell[field]; if (!g) return null;
  const floor = Math.max(MIN_SPLIT_BASE, MIN_SPLIT_SHARE * cell.d);
  const rows = Object.entries(g).filter(([k, x]) => k !== "unk" && x.d >= floor).map(([k, x]) => {
    const nv = natCell && natCell[field] && natCell[field][k] ? natCell[field][k].v : null;
    return { id: k, label: labelOf(k), v: x.v, n: x.n, d: x.d, natV: nv, gapVsNat: nv == null ? null : S.round(x.v - nv, 1) };
  });
  if (rows.length < 2) return null;
  const hi = rows.reduce((a, b) => (b.v > a.v ? b : a)), lo = rows.reduce((a, b) => (b.v < a.v ? b : a));
  // two-proportion z test between the best and the worst group: a gap counts only if it is not just small-number noise
  const p1 = hi.n / hi.d, p2 = lo.n / lo.d, pp = (hi.n + lo.n) / (hi.d + lo.d);
  const se = Math.sqrt(pp * (1 - pp) * (1 / hi.d + 1 / lo.d));
  return { rows, hi: hi.id, lo: lo.id, gap: S.round(hi.v - lo.v, 1), z: se > 0 ? S.round(Math.abs(p1 - p2) / se, 1) : 0 };
}

// a figure is reliable when the group behind it reaches the parameter's minimum (a level figure without a base always is)
const isReliable = (ind, d) => (ind.kind === "level" ? d == null || d >= (ind.minBase || 0) : d >= (ind.minBase || 0));

function analyzeIndicator(store, ind, key, peerKeys = []) {
  const years = store.cityYears(ind.id, key);
  if (!years.length) return null;
  const s = sign(ind), minBase = ind.minBase || 0;

  const series = years.map((y) => {
    const c = store.cell(ind.id, key, y), nat = store.nat(ind.id, y), t = store.target(ind.id, y);
    const peerVals = peerKeys.map((k) => store.cell(ind.id, k, y)).filter((x) => x && (x.d == null || x.d >= minBase / 2)).map((x) => x.v);
    return {
      year: y, v: c.v, n: c.n, d: c.d,
      nat: nat ? nat.v : null,
      target: t,
      peer: peerVals.length >= 3 ? S.round(S.median(peerVals), 1) : null
    };
  });
  const first = series[0], last = series[series.length - 1], prev = series.length > 1 ? series[series.length - 2] : null;

  // standing among all localities in the latest year (only localities with a group large enough to count)
  const dist = store.distribution(ind.id, last.year, minBase);
  const vals = dist.map((x) => x.v);
  const reliable = isReliable(ind, last.d);   // a level figure with a population base is held to the same minimum
  let rank = null, of = null, level = null;
  if (reliable && vals.length >= 10) {
    of = vals.length;
    rank = s >= 0 ? S.rankDesc(last.v, vals) : 1 + vals.filter((v) => v < last.v - 1e-9).length;
    level = s >= 0 ? S.percentile(last.v, vals) : (100 * vals.filter((v) => v > last.v + 1e-9).length) / vals.length;
  }
  const sorted = vals.slice().sort((a, b) => a - b);
  const p25 = S.quantile(sorted, 0.25), p75 = S.quantile(sorted, 0.75);

  // history
  const pts = series.map((x) => ({ x: x.year, y: x.v }));
  // a figure on too few cases (the latest year is under the minimum base) is shown as it is, but it has no trend: a swing of two babies is not a movement
  const tr = reliable && pts.length >= 3 ? S.trend(pts) : null;
  const delta = reliable && series.length >= 2 ? S.round(last.v - first.v, 1) : null;
  const tClass = series.length >= 3 ? trendClass(ind, tr, delta, S.median(series.map((x) => x.v))) : "unknown";
  const natPts = series.filter((x) => x.nat != null).map((x) => ({ x: x.year, y: x.nat }));
  const natTr = natPts.length >= 3 ? S.trend(natPts) : null;
  const natDelta = natPts.length >= 2 ? S.round(natPts[natPts.length - 1].y - natPts[0].y, 1) : null;
  // did the gap from the national figure open or close? positive = the city moved in the good direction relative to the nation
  const withNat = series.filter((x) => x.nat != null);
  const gapMove = reliable && withNat.length >= 2 && s !== 0 ? S.round(((withNat[withNat.length - 1].v - withNat[withNat.length - 1].nat) - (withNat[0].v - withNat[0].nat)) * s, 1) : null;

  // did the size of the group change sharply, more than it did nationally? (evacuation, new neighbourhood, a reporting change)
  let baseShift = null;
  if (reliable && series.length >= 3 && ind.kind !== "level") {
    const prior = S.median(series.slice(0, -1).map((x) => x.d)), natPrior = S.median(series.slice(0, -1).map((x) => (store.nat(ind.id, x.year) || {}).d).filter((x) => x));
    const natNow = (store.nat(ind.id, last.year) || {}).d;
    const mine = prior ? (last.d - prior) / prior : 0, theirs = natPrior && natNow ? (natNow - natPrior) / natPrior : 0;
    if (Math.abs(mine - theirs) >= 0.25) baseShift = Math.round((mine - theirs) * 100);
  }

  // official guideline and international benchmark (guide.js): the target of the figure's own year when the data has one, else the catalogue's
  const { guide, benchmark } = guidesFor(ind, last, reliable);
  const judging = guide && guide.judges ? guide : null;                    // an official target of the same measure in the same unit: the only reference a status may use
  if (judging && last.target == null) last.target = judging.value;         // an official target that does not come year by year still fills the fields the screens read

  const gapNat = last.nat != null ? S.round(last.v - last.nat, 1) : null;
  const gapTarget = last.target != null ? S.round((last.v - last.target) * (s < 0 ? -1 : 1), 1) : null;       // negative = short of the target, whichever way is good
  const meetsTarget = last.target == null ? null : s >= 0 ? last.v >= last.target : last.v <= last.target;
  const gapPeer = last.peer != null ? S.round(last.v - last.peer, 1) : null;

  let projection = null, yearsToTarget = null;
  if (tr && tClass !== "stable" && ind.unit === "%" && series.length >= RULES.projectionMinYears) {
    const py = last.year + 2;
    projection = { year: py, v: S.round(Math.max(0, Math.min(100, tr.intercept + tr.slope * py)), 1) };
    if (last.target != null && s > 0 && last.v < last.target && tr.slope > 0.1) yearsToTarget = S.round((last.target - last.v) / tr.slope, 1);
  }

  const equity = reliable ? {
    sector: splitsOf(store.cell(ind.id, key, last.year), store.nat(ind.id, last.year), "s", (k) => k),
    ses: splitsOf(store.cell(ind.id, key, last.year), store.nat(ind.id, last.year), "q", (k) => SES_LABEL[k] || k)
  } : { sector: null, ses: null };

  // status: one rule, written down in docs/METHOD.md
  // statusWhy names the conditions that decided a "concern" or "watch" (rank, target, worsening), so the screen can say why
  // only an official target of the same measure (guide.judges) takes part; an international benchmark never does
  let status = "na", statusWhy = [];
  const stale = last.year <= (store.latestYearOf(ind.id) || last.year) - 2;     // the last figure is two or more years behind the newest figure of this parameter
  if (stale && s !== 0) status = "stale";
  else if (s !== 0) {
    if (!reliable || level == null) status = "uncertain";
    else {
      const worsening = tClass === "worsening";
      // the distance from the official target: points for a percentage, a share of the target for any other unit (a rate per 100,000 or a number of days is not read in points)
      const gapG = judging ? (ind.unit === "%" ? judging.gap : judging.relGap) : null, farLimit = ind.unit === "%" ? RULES.farBelowTarget : RULES.targetFarRel, nearLimit = ind.unit === "%" ? RULES.nearTarget : RULES.targetNearRel;
      const farBelowTarget = gapG != null && gapG < -farLimit, nearTarget = gapG == null || gapG >= -nearLimit;
      // a figure that reaches its official target and does not deteriorate is "תקין" at least: the rank among the localities alone cannot hold it lower
      const held = judging != null && judging.meets === true && !worsening;
      const lowRank = level < RULES.concernLevel, worseningLow = level < RULES.concernWorseningLevel && worsening;
      if ((lowRank && !held) || farBelowTarget || worseningLow) { status = "concern"; statusWhy = [lowRank && "rank", farBelowTarget && "target", worseningLow && "worsening"].filter(Boolean); }
      else if (level >= RULES.strengthLevel && !(judging && judging.meets === false) && !worsening) status = "strength";
      else if ((level >= RULES.goodLevel || held) && nearTarget && !worsening) status = "good";
      else { status = "watch"; statusWhy = [level < RULES.goodLevel && "rank", !nearTarget && "target", worsening && "worsening"].filter(Boolean); }
    }
  }

  // priority: how much room there is to a reachable benchmark, scaled by how much the parameter matters
  // (a figure on too few cases has none: the benchmark comes from larger localities and the figure itself is noise)
  let headroom = null, priority = 0;
  if (s !== 0 && reliable && p25 != null && p75 != null) {
    const bench = s > 0 ? Math.max(p75, last.target != null ? last.target : -Infinity) : Math.min(p25, last.target != null ? last.target : Infinity);
    headroom = Math.max(0, (bench - last.v) * s);
    const spread = Math.max(p75 - p25, ind.unit === "%" ? 5 : Math.abs(S.median(vals) || 1) * 0.1);
    const h = Math.min(3, headroom / spread);
    const equityFlag = [equity.sector, equity.ses].some((e) => e && e.gap >= EQUITY_GAP && e.z >= EQUITY_Z);
    priority = ind.importance * (h + (tClass === "worsening" ? 0.75 : 0) + (equityFlag ? 0.4 : 0)) * (stale ? 0.2 : 1);
  }

  return {
    id: ind.id, domain: ind.domain, label: ind.label, short: ind.short, unit: ind.unit, direction: ind.direction, importance: ind.importance,
    series, last: { ...last, rank, of, level: level == null ? null : S.round(level, 0), gapNat, gapTarget, gapPeer, meetsTarget, reliable, p25, p75 },
    prev: prev ? { year: prev.year, v: prev.v } : null,
    history: { first: { year: first.year, v: first.v }, delta, slope: tr ? S.round(tr.slope, 2) : null, trendClass: tClass, natSlope: natTr ? S.round(natTr.slope, 2) : null, natDelta, gapMove, projection, yearsToTarget },
    guide, benchmark, equity, status, statusWhy, stale, baseShift, headroom: headroom == null ? null : S.round(headroom, 1), priority: S.round(priority, 2)
  };
}

module.exports = { analyzeIndicator, isReliable, sign, trendClass, SES_LABEL, EQUITY_GAP, EQUITY_Z, RULES };
