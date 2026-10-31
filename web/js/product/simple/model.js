// What the one-glance page shows, chosen from the city model. No DOM. The choices reuse city/data.js (the same weakest-first order as the home's first answer,
// the same first recommendation as its fourth); nothing is invented, every number is a field of the model.
import { num, unitSuffix } from "../../ui.js";
import * as D from "../city/data.js";
import { shortName, HORIZON } from "../city/copy.js";
import { leadOwner, plainLabel, whenOf } from "./words.js";
import * as G from "../kit/guide.js";

export const MAX_ROWS = 3;
const { isNum } = D;

// ── the verdict: how many figures are in each of the three states (a strength counts as sound) ──
export function verdictOf(model) {
  const st = D.stateOf(model), c = st.all.concern || 0, w = st.all.watch || 0, g = (st.all.good || 0) + (st.all.strength || 0);
  return { kind: D.townKind(model), st, counts: { concern: c, watch: w, good: g }, judged: c + w + g };
}

// ── a number with its unit word: { n: "61.2%", w: "" } or { n: "46", w: "ימים" }. The number alone is isolated on screen, the word stays in the Hebrew flow ──
export function valueParts(unit, v) {
  const d = unit === "index" ? 2 : 1, n = num(v, d);
  if (unit === "%") return { n: n + "%", w: "" };
  if (unit === "ils") return { n: "₪" + num(v, 0), w: "" };
  if (unit === "days") return { n, w: Number(n) === 1 ? "יום" : "ימים" };
  if (unit === "years") return { n, w: Number(n) === 1 ? "שנה" : "שנים" };
  return { n, w: unitSuffix(unit) };
}
export const valuePlain = (p) => (p.w ? `${p.n} ${p.w}` : p.n);

// the two bars of a row share one scale starting at zero: percentages on 0 to 100, every other unit on its larger value
export function barWidths(unit, v, nat) {
  const vals = [v, nat].filter(isNum).map((x) => Math.max(0, x)), top = unit === "%" ? 100 : Math.max(0, ...vals);
  const w = (x) => (isNum(x) && top > 0 ? Math.min(100, Math.round((Math.max(0, x) / top) * 1000) / 10) : 0);
  return { town: w(v), nat: isNum(nat) ? w(nat) : null };
}

// what the bars show: the town against the country at the precision of the printed numbers (30.9 against 30.8 is not "the same", 30.8 against 30.8 is)
const decimals = (unit) => (unit === "index" ? 2 : unit === "ils" ? 0 : 1);
export const shownValue = (unit, v) => { const f = 10 ** decimals(unit); return Math.round(v * f) / f; };
export function standing(a) {
  const L = a.last;
  if (!isNum(L.v) || !isNum(L.nat)) return "none";
  const d = (shownValue(a.unit, L.v) - shownValue(a.unit, L.nat)) * D.sgn(a);
  return d > 0 ? "better" : d < 0 ? "worse" : "same";
}

// one row: what is measured (the catalogue's full label), the town's value, the country's value, which way is good.
// tgt: the official target of the figure when it judges (kit/guide.js rowTarget): the line under the bars and the tick on the town's bar, else null
// cause: for a figure that needs treatment or follow-up, why, in words, from the model's own statusWhy (city/data.js causeOf), else null
export function rowOf(a) {
  const L = a.last, nat = isNum(L.nat) ? L.nat : null, w = barWidths(a.unit, L.v, nat);
  return { id: a.id, domain: a.domain, status: a.status, cause: D.causeOf(a), tgt: G.rowTarget(a), label: plainLabel(a.label || shortName(a)), short: shortName(a), unit: a.unit, dir: a.direction === "higher" || a.direction === "lower" ? a.direction : null,
    year: L.year == null ? null : L.year, town: valueParts(a.unit, L.v), nat: nat == null ? null : valueParts(a.unit, nat), widths: w };
}

// ── what needs attention: the weakest judged figures, concern and watch only, in the order of the home's first answer ──
// Every row says why (cause). A row whose bars show the town level with the country or ahead of it, and that misses no official target, goes after the rows with a visible gap or a target.
export function attentionOf(model, max = MAX_ROWS) {
  const list = D.weakestFive(model, 1000).filter((a) => a.status === "concern" || a.status === "watch");
  const rows = list.map((a) => { const st = standing(a), ahead = st === "better" || st === "same"; return { a, late: ahead && !(isNum(a.last.target) && a.last.meetsTarget === false) }; });
  const ordered = [...rows.filter((x) => !x.late), ...rows.filter((x) => x.late)];
  return { rows: ordered.slice(0, max).map((x) => rowOf(x.a)), total: list.length };
}

// ── the two ledes: under the verdict (words.js targetLede) and under "what goes well" (words.js T.goodLede) ──
// How many of the town's judged figures that have an official target meet it, in the town and in the country as a whole. Only a figure the product can set against its target
// (kit/guide.js rowTarget: it judges, the group is big enough, the target is known) is counted; a stale figure is not. A figure with no national average is left out of the country's count.
export function officialOf(model) {
  const rows = model.indicators.filter((a) => a && a.last && !D.isStale(a)).map((a) => ({ a, t: G.rowTarget(a) })).filter((x) => x.t);
  const withNat = rows.filter((x) => isNum(x.a.last.nat));
  return { n: rows.length, town: rows.filter((x) => x.t.state === "meets").length, natN: withNat.length, nat: withNat.filter((x) => !x.t.natMiss).length };
}
// a figure that no official target judges: the verdict on it rests on the country's average and the trend alone
export const hasNoOfficial = (a) => G.kindOf(a) !== "target";
// ── what goes well: strengths first, then the figures that beat the most localities ──
// Only a figure the bars show ahead of the country, or one that stands on the target and says so in a line. Level with the country at the printed precision is not ahead.
export function goodOf(model, max = MAX_ROWS) {
  // a row that is not visibly ahead of the country stands on its target: the line under its bars (the official target and "עומד ביעד") is what explains it, so a figure
  // whose target the product cannot show (no judging guide) is not listed on that ground (checked over all 1,228 towns: none such stood in the list)
  const onTarget = (a) => a.last.meetsTarget === true && isNum(a.last.target) && !!G.rowTarget(a);
  const list = model.indicators.filter((a) => (a.status === "good" || a.status === "strength") && !D.isStale(a) && a.last && a.last.reliable !== false && isNum(a.last.v))
    .filter((a) => standing(a) === "better" || onTarget(a)).map((a) => ({ a, late: standing(a) !== "better" }))
    .sort((x, y) => x.late - y.late || isNum(y.a.last.nat) - isNum(x.a.last.nat) || (y.a.status === "strength") - (x.a.status === "strength") || (isNum(y.a.last.level) ? y.a.last.level : -1) - (isNum(x.a.last.level) ? x.a.last.level : -1) || (y.a.importance || 0) - (x.a.importance || 0) || x.a.id.localeCompare(y.a.id));
  return { rows: list.slice(0, max).map((x) => rowOf(x.a)), total: list.length };
}
// ── a town whose groups are all too small: at most three numbers, as they are, never ranked ──
export function smallOf(model) {
  return model.indicators.filter(D.isSmall).sort((x, y) => (y.importance || 0) - (x.importance || 0) || x.id.localeCompare(y.id)).slice(0, MAX_ROWS)
    .map((a) => ({ id: a.id, label: plainLabel(a.label || shortName(a)), year: a.last.year == null ? null : a.last.year, town: valueParts(a.unit, a.last.v), cases: D.caseCount(a) }));
}

// ── what to do: the first recommendations (the first one is the short level's one step): headline, one figure behind it, who, how fast ──
export function firstSteps(model, n = 3) {
  if (!D.stateOf(model).judged) return [];
  return (model.recommendations || []).slice(0, n).map((r) => {
    const a = (r.indicators || []).map((id) => model.indicators.find((x) => x.id === id)).find((x) => x && x.last && isNum(x.last.v) && x.last.reliable !== false);
    // the whole title, not the home's clamped headline (a sentence cut with "…" is hard to act on); one colon per sentence
    const hd = D.stepHeadline(r), headline = hd.clamped ? hd.full : hd.text.replace(/^([^:]+): (.+)$/, "$1 ($2)");
    return { headline, row: a ? rowOf(a) : null, who: leadOwner(r.owner), when: whenOf(HORIZON[r.horizon] || r.horizon || "") };
  });
}
export const firstStep = (model) => firstSteps(model, 1)[0] || null;

// the name of a missing figure in a sentence: the label when it is short, else the short name when that is plain words (no Latin code, no digits, no colon)
const exampleName = (c) => { const l = plainLabel(c.label || c.short), sh = String(c.short || ""); return l.length <= 36 || !sh || /[A-Za-z0-9:]/.test(sh) ? l : sh; };

// ── what is missing: the count, and up to three examples that a person could judge (meta = GET /api/meta, optional) ──
export function missingOf(model, meta) {
  const st = D.stateOf(model), missing = Math.max(0, st.total - st.have), ids = new Set((model.coverage && model.coverage.missing) || []);
  let examples = [];
  if (meta && Array.isArray(meta.indicators) && missing) {
    const cat = meta.indicators.filter((c) => ids.has(c.id)), judgeable = cat.filter((c) => c.direction);
    const names = (judgeable.length ? judgeable : cat).sort((x, y) => (y.importance || 0) - (x.importance || 0) || String(x.id).localeCompare(String(y.id))).map(exampleName).filter(Boolean);
    // up to three, and never a line longer than about a hundred characters
    for (const nm of names) { if (examples.length >= 3 || (examples.length && examples.join("").length + nm.length > 70)) break; examples.push(nm); }
  }
  return { missing, small: st.small, stale: st.stale, examples };
}

export { shortName };
