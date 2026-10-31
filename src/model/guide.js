"use strict";
/**
 * Official guidelines and reference figures, as the city model carries them (research/guidelines.json, catalog/indicators.js).
 *
 *   guide      the official target of an indicator: { kind, value, unit, direction, year, scope, text, source, caveat, judges, comparable, gap, relGap, meets }
 *   benchmark  an international reference figure, shown as context and never used for a status (same shape, judges is always false)
 *
 *   gap     the distance of the latest figure from the value, in the indicator's unit, signed so that positive = better than the guideline
 *   relGap  the same distance as a share of the guideline value (0.1 = ten percent better, -0.25 = a quarter worse)
 *   meets   the figure reaches the guideline
 *   judges  the status may compare the figure with it: an official target that measures the same thing in the same unit
 *   comparable  the guideline is in the indicator's own unit (a national percentage cut in harm is not)
 * gap, relGap and meets are null for a figure on too few cases, and for an indicator that only describes (no good or bad direction):
 * such a figure is never compared.
 *
 * The program targets of the Ministry of Health come from the open data year by year (the data wins): the value of the figure's own year.
 * A year without a target has no guide, because a target that did not exist for that year is not invented.
 */
const S = require("../lib/stats");
const sources = require("../catalog/sources");
const { unitText } = require("../lib/format");

const DIR = { atLeast: { sign: 1, word: "לפחות" }, atMost: { sign: -1, word: "עד" } };

// the source of a reference as the screens show it
function sourceOf(ref) {
  const s = sources[ref.source];
  if (!s) throw new Error("guideline with an unknown source: " + ref.source);
  return { id: ref.source, publisher: s.publisher, short: s.short || s.publisher, title: ref.where ? `${s.name}, ${ref.where}` : s.name, url: s.url, where: ref.where || null };
}

// "יעד משרד הבריאות", "יעד האו״ם": how a sentence names the author of a target
const targetWho = (guide) => `יעד ${guide.source.short}`;

function describe(ref, ind, value, year, v, reliable) {
  const comparable = ref.unit === ind.unit;
  const sgn = DIR[ref.direction].sign;
  const raw = comparable && ind.direction && reliable && v != null ? (v - value) * sgn : null;
  const isTarget = ref.kind === "official_target";
  return {
    kind: ref.kind, value, unit: ref.unit, direction: ref.direction, year: String(year), scope: ref.scope,
    text: comparable ? (isTarget ? `${DIR[ref.direction].word} ${unitText(ref.unit, value)}` : unitText(ref.unit, value)) : ref.valueText || null,
    source: sourceOf(ref), caveat: ref.caveat || null,
    judges: isTarget && ref.judges !== false && comparable && !!ind.direction,
    comparable,
    gap: raw == null ? null : S.round(raw, 1),
    relGap: raw == null || !value ? null : S.round(raw / Math.abs(value), 3),
    meets: raw == null ? null : raw >= 0
  };
}

// last = the latest figure of the indicator ({ v, year, target }); reliable = its group is large enough to be compared
function guidesFor(ind, last, reliable) {
  let guide = null, benchmark = null;
  const g = ind.guideline;
  if (g) {
    const yearly = !!(ind.collect && ind.collect.targetField);
    if (!yearly) guide = describe(g, ind, g.value, g.year, last.v, reliable);
    else if (last.target != null) guide = describe(g, ind, last.target, last.year, last.v, reliable);
  }
  if (ind.benchmark) benchmark = { ...describe(ind.benchmark, ind, ind.benchmark.value, ind.benchmark.year, last.v, reliable), judges: false };
  return { guide, benchmark };
}

// the guideline of an indicator as the catalogue (/api/meta) shows it: no figure yet, so no gap; yearly = the value is read year by year from the open data
function staticGuide(ind, ref) {
  if (!ref) return null;
  const g = describe(ref, ind, ref.value, ref.year, null, false);
  return ref.kind === "official_target" ? { ...g, yearly: !!(ind.collect && ind.collect.targetField) } : { ...g, judges: false };
}

module.exports = { guidesFor, describe, staticGuide, sourceOf, targetWho };
