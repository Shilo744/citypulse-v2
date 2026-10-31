// What the city home says, worked out from the city model. No DOM and no import that touches one, so node can import it (the tests, the share pages).
// Nothing here is invented: every figure is a field of the model (GET /api/city/:key). The rules are C-01 to C-27 of SPEC 7.2.
import { lacking } from "../kit/plural.js";
import { shortName } from "./copy.js";

export const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const JUDGED = ["concern", "watch", "good", "strength"];            // the four statuses that are a verdict: the denominator of every "how many need treatment"
export const sgn = (a) => (a.direction === "lower" ? -1 : 1);
export const isStale = (a) => !!(a && (a.stale || a.status === "stale"));
// a figure on a group too small to compare: shown as it is, never ranked, trended or judged
// the cases behind a figure on a group too small to judge, when the model has them: { n, d } for a share ("1 מתוך 1"), { n } for a count of cases, null for a figure that is not a share of cases
export function caseCount(a) {
  const L = a && a.last;
  if (!L || !isNum(L.n) || L.n < 0 || ["index", "years", "days", "ils", "count"].includes(a.unit)) return null;
  return a.unit === "%" && isNum(L.d) && L.d > 0 ? { n: L.n, d: L.d } : { n: Math.round(L.n) };
}
export const isSmall = (a) => !!(a && a.last && a.last.reliable === false && isNum(a.last.v));
const series = (a) => (a.series || []).filter((p) => isNum(p.v)).length;
export const years = (a) => series(a);

// the usual spread between localities for one figure: a change or a gap is measured in these, so days, percentages and rates share one scale
export const spreadOf = (a) => Math.max(isNum(a.last.p25) && isNum(a.last.p75) ? a.last.p75 - a.last.p25 : 0, a.unit === "%" ? 5 : Math.abs(a.last.v) * 0.1 || 1);

// ── the state of the town: how many figures in each status. "judged" is the denominator of every "how many need treatment" (C-11) ──
export function stateOf(model) {
  const all = {};
  for (const i of model.indicators) all[i.status] = (all[i.status] || 0) + 1;
  const judged = JUDGED.reduce((n, k) => n + (all[k] || 0), 0), cov = model.coverage || {};
  return {
    all, judged, n: model.indicators.length, have: cov.have || 0, total: Math.max(cov.total || 0, cov.have || 0),
    bg: all.na || 0, small: model.indicators.filter(isSmall).length, stale: model.indicators.filter(isStale).length, none: model.indicators.length - judged
  };
}
// a very small town (the rule of the home's basis line, C-09): some of its figures rest on groups too small to judge and fewer than half of the figures with data can be judged.
// Its background figures (they are not judged anyway) are shown as they are and never set against the nation, similar towns or a place among all towns.
export function isVerySmallTown(model) {
  const st = stateOf(model);
  return st.small > 0 && st.judged * 2 < st.have;
}
// a figure that gets the calm treatment: a background figure (no verdict of its own) on a group that is not itself marked small, in a very small town
export const isCalmFigure = (model, a) => !!(a && a.status === "na" && a.last && a.last.reliable !== false && isVerySmallTown(model));
// the one plain line that replaces every comparison (the overview, the indicator page and the domain page say the same words)
export const NO_COMPARISON = "הקבוצה קטנה, ולכן אין השוואה לממוצע הארצי";

// the three kinds of town the screens treat differently (SPEC 5.2.6)
export function townKind(model) {
  const st = stateOf(model);
  return st.have === 0 ? "uncovered" : st.judged === 0 ? "calm" : "full";
}

// ── question 1: the weakest ──
// the judged figures that stand lowest among all localities (level = the share of localities it beats; 0 = the weakest); ties: the one with more room to improve first
export function weakestFive(model, n = 5) {
  return model.indicators.filter((a) => JUDGED.includes(a.status) && !isStale(a) && a.last && a.last.reliable !== false && isNum(a.last.level) && isNum(a.last.v))
    .sort((x, y) => x.last.level - y.last.level || (y.priority || 0) - (x.priority || 0) || x.id.localeCompare(y.id)).slice(0, n);
}
export const domainJudged = (c) => JUDGED.reduce((n, k) => n + ((c && c[k]) || 0), 0);
export const shortDomain = (label) => String(label || "").split(/ ו|,/)[0].trim() || String(label || "");
// C-01: a domain is named in the sentence only when at least 2 of its figures are judged and at least 2 of them need treatment; the key is the share needing
// treatment, then the standing among all localities. A domain with one judged figure is never named (the lede may say so).
export function weakestDomain(model) {
  const list = model.domains.map((d) => ({ d, m: domainJudged(d.counts), k: (d.counts && d.counts.concern) || 0 })).filter((x) => x.m >= 2 && x.k >= 2)
    .sort((x, y) => y.k / y.m - x.k / x.m || (isNum(x.d.standing) ? x.d.standing : 1000) - (isNum(y.d.standing) ? y.d.standing : 1000) || y.k - x.k || x.d.id.localeCompare(y.d.id));
  const w = list[0];
  return w ? { d: w.d, id: w.d.id, label: w.d.label, short: shortDomain(w.d.label), k: w.k, m: w.m } : null;
}

// the position of a figure among the localities, in the rank form (C-04, C-05, C-19): never "better than 0%". The last place says so.
export function rankText(L) {
  if (!L || L.rank == null || !L.of) return "";
  return `מקום ${L.rank} מתוך ${L.of} יישובים`;
}
export const lastPlace = (L) => !!(L && L.rank != null && L.of && L.rank === L.of);

const STATUS_WORD = { concern: "דורש טיפול", watch: "למעקב", good: "תקין", strength: "חוזק" };
const STATUS_TONE = { concern: "attn", watch: "attn", good: "good", strength: "good", uncertain: "none", stale: "none", na: "none" };
const STATUS_ICON = { concern: "alert", watch: "eye", good: "check", strength: "star", uncertain: "info", stale: "clock", na: "info" };
export const statusWord = (s) => STATUS_WORD[s] || "";
export const statusTone = (s) => STATUS_TONE[s] || "none";
export const statusIcon = (s) => STATUS_ICON[s] || "info";
const joinHe = (parts) => (parts.length < 2 ? parts[0] || "" : parts.slice(0, -1).join(", ") + " ו" + parts[parts.length - 1]);

// the row of an evidence block, in words: the status word, then why, with the rank form. spell: { used } makes "נקודות אחוז" appear in full once per page, "נק׳" after it.
export function rowReason(a, spell = { used: false }) {
  const L = a.last, parts = [];
  if (rankText(L)) parts.push(rankText(L) + (lastPlace(L) ? (L.of >= 100 ? ", האחרון בארץ" : ", האחרון מביניהם") : ""));
  if (a.status === "concern" || a.status === "watch") {
    if ((a.statusWhy || []).includes("target") && isNum(L.gapTarget)) {
      parts.push(lacking(L.gapTarget, a.unit, { short: spell.used }) + " ליעד הרשמי");
      if (a.unit === "%") spell.used = true;
    }
    if ((a.statusWhy || []).includes("worsening")) parts.push("המגמה בהידרדרות");
  }
  return { word: statusWord(a.status), tone: statusTone(a.status), icon: statusIcon(a.status), rest: joinHe(parts) + (parts.length ? "." : "") };
}

// ── why a figure needs treatment or follow-up, in words ──
// The causes the model itself names (statusWhy, src/model/analyze.js): the place among the localities, the distance from the official target, the trend, in the model's own order.
// One function for every row that says "דורש טיפול" or "למעקב" (the town page on both levels, the category page). A sentence is a list of segments: a string, or { n } for a number
// (the screen sets it apart, so that its digits keep their order inside the Hebrew). Null for any other status.
const isolate = (text) => String(text).split(/(\d[\d,]*(?:\.\d+)?)/).map((x, k) => (k % 2 ? { n: x } : x)).filter((x) => x !== "");
const CAUSE = {
  rank: () => ["רוב היישובים במצב טוב יותר"],
  target: (L, unit, official) => (isNum(L.gapTarget) && L.gapTarget < 0 ? [...isolate(lacking(L.gapTarget, unit)), official ? " ליעד הרשמי" : " ליעד"] : [official ? "הערך מתחת ליעד הרשמי" : "הערך מתחת ליעד"]),
  worsening: () => ["המגמה בהידרדרות"]
};
// official: the target is named by its kind ("ליעד הרשמי"), for a label with no target line beside it (a row has "יעד רשמי: לפחות 80%" just under it)
export function causeOf(a, { official = false } = {}) {
  if (!a || (a.status !== "concern" && a.status !== "watch") || !a.last) return null;
  const L = a.last, list = [];
  for (const why of a.statusWhy || []) {
    if (why === "rank") list.push(CAUSE.rank());          // the model says the place among the localities is low (its level is a rounded number: 50 can be 49.6)
    else if (why === "target") list.push(CAUSE.target(L, a.unit, official));
    else if (why === "worsening") list.push(CAUSE.worsening());
  }
  if (!list.length) return null;
  const out = ["כי "];
  list.forEach((c, k) => { if (k) out.push(k === list.length - 1 ? " ו" : ", "); out.push(...c); });
  return [...out, "."];
}

// the status and its cause as one plain sentence, for a label that is not made of nodes (the title of a status dot, its text for a screen reader):
// "דורש טיפול כי חסרות 28.1 נקודות אחוז ליעד הרשמי והמגמה בהידרדרות." Null where causeOf is.
export function causeText(a) {
  const c = causeOf(a, { official: true });
  return c ? statusWord(a.status) + " " + c.map((s) => (typeof s === "string" ? s : s.n)).join("") : null;
}

// the line under the bars of a row with an official target: "יעד רשמי: לפחות 80% · רחוק מהיעד." (t = kit/guide.js rowTarget). The word of where the figure stands is the only bold part.
// Nothing is said about the country, except when the figure meets its target and the national average still does not: then once, in an aside that the one printed sheet leaves out.
export function tgtSegs(t) {
  return ["יעד רשמי: ", t.text, " · ", { b: t.word }, ".", ...(t.state === "meets" && t.natMiss ? [{ aside: " הממוצע בארץ עדיין מתחת ליעד." }] : [])];
}
export const tgtPlain = (t) => tgtSegs(t).map((x) => (typeof x === "string" ? x : x.b || x.aside)).join("").replace(/[‎‏‪-‮⁦-⁩⁠]/g, "");

// ── question 2: what changed ──
export function trendCounts(model) {
  const c = { improving: 0, worsening: 0, stable: 0, unknown: 0, rising: 0, falling: 0, maxYears: 0 };
  for (const a of model.indicators) {
    if (isStale(a)) continue;
    c.maxYears = Math.max(c.maxYears, series(a));
    const t = a.history && a.history.trendClass;
    if (t in c) c[t]++; else c.unknown++;
  }
  return c;
}
// how big the change since the first year is, in usual spreads between localities; positive = better (for a figure that has a direction)
export function changeSize(a) {
  const d = a.history && a.history.delta;
  return isNum(d) && a.last ? (d * sgn(a)) / spreadOf(a) : 0;
}
// C-03: the chart shows exactly the figures the sentence counts (trendClass improving or worsening), never one with fewer than 3 years; the biggest first
export function movers(model, n = 8) {
  return model.indicators.filter((a) => !isStale(a) && a.last && isNum(a.last.v) && a.last.reliable !== false && series(a) >= 3 && a.history && a.history.first && isNum(a.history.delta) && a.history.delta !== 0
    && (a.history.trendClass === "improving" || a.history.trendClass === "worsening"))
    .map((a) => ({ a, gap: changeSize(a) })).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap) || x.a.id.localeCompare(y.a.id)).slice(0, n);
}

// ── question 3: next to similar localities ──
// better / worse / alike, for every figure that has a direction, a big enough group and a value for similar localities. A gap under 2% of the value is alike (C-07);
// a worse figure whose gap is at least one usual spread is "large".
export function peerVerdicts(model) {
  const rows = [];
  for (const a of model.indicators) {
    const L = a.last;
    if (!a.direction || isStale(a) || !L || L.reliable === false || !isNum(L.v) || !isNum(L.peer)) continue;
    const g = L.v - L.peer, tol = Math.abs(L.peer) * 0.02 || 0.05, better = g * sgn(a) > 0, z = (g * sgn(a)) / spreadOf(a);
    rows.push({ a, gap: g, z, verdict: Math.abs(g) < tol ? "alike" : better ? "better" : "worse" });
  }
  const n = (v) => rows.filter((r) => r.verdict === v).length;
  return { rows, better: n("better"), worse: n("worse"), alike: n("alike"), total: rows.length, bigWorse: rows.filter((r) => r.verdict === "worse" && r.z <= -1).length, bigBetter: rows.filter((r) => r.verdict === "better" && r.z >= 1).length };
}
// the figure where the town differs most from similar localities (in usual spreads), and that has a place among all localities to draw
export function mostTelling(model) {
  const pv = peerVerdicts(model).rows.filter((r) => r.a.last.rank != null && r.a.last.of && isNum(r.a.last.level));
  pv.sort((x, y) => Math.abs(y.z) - Math.abs(x.z) || (y.a.importance || 0) - (x.a.importance || 0) || x.a.id.localeCompare(y.a.id));
  return pv[0] || null;
}

// ── question 4: what to do first ──
// C-02: "no recommendation" says why with the JUDGED count. judged === 0 is never "no finding passes the bar" (that reads as a clean bill of health).
export function emptyPlanCause(model) {
  const st = stateOf(model), name = model.city.name;
  if (!st.have) return { kind: "none", text: `אין נתונים רשמיים על ${name}, ולכן אין על מה לבסס המלצה.` };
  if (!st.judged) return { kind: "unjudged", text: `אין המלצה, כי אין ב${name} אף מדד שאפשר לשפוט: הקבוצות קטנות מדי או שהמדדים מתארים בלבד.` };
  return { kind: "bar", text: "אין כרגע ממצא שעובר את סף ההמלצה: אין מדד חלש, מגמה בהידרדרות או פער בתוך היישוב." };
}
export const topPriorities = (model, n = 3) => (model.priorities || []).map((id) => model.indicators.find((x) => x.id === id)).filter(Boolean).slice(0, n);
// a recommendation whose job is to check the record before acting (C-06): shown above step 1, not as item 2
export const isCheck = (r) => /data_check|station_procedure_audit/.test((r && (r.intervention || r.id)) || "");
// a long headline is cut before an "ו" word in its second half when there is one (a clause ends there), else at the last whole word
const clamp = (t, n) => {
  if (t.length <= n) return t;
  const head = t.slice(0, n - 1), cut = [...head.matchAll(/ (?=ו)/g)].map((m) => m.index).filter((i) => i >= n * 0.5).pop();
  return (cut != null ? head.slice(0, cut) : head.replace(/[\s,:;-]+\S*$/, "")).replace(/[\s,:;-]+$/, "") + "…";
};
// C-23: the headline is the recommendation's short field when it has one, else its title clamped to 70 characters
export function stepHeadline(r) {
  const full = String(r.title || "").replace(/[.\s]+$/, ""), t = r.short ? String(r.short).replace(/[.\s]+$/, "") : clamp(full, 70);
  return { text: t, clamped: t !== full, full };
}

// ── question 5: what is missing ──
export const kindOf = (a) => (!a || !a.last || !isNum(a.last.v) ? "missing" : a.last.reliable === false ? "small" : isStale(a) ? "stale" : "found");
// the whole catalogue, each figure as found / stale / small group / missing for this town (meta = GET /api/meta)
export function coverageOf(model, meta) {
  const byId = new Map(model.indicators.map((a) => [a.id, a]));
  const cat = meta.indicators.map((c) => ({ c, a: byId.get(c.id) || null, kind: kindOf(byId.get(c.id)) }));
  const count = (k) => cat.filter((x) => x.kind === k).length;
  return { cat, found: count("found") + count("stale"), small: count("small"), missing: count("missing"), total: cat.length };
}
// what is missing, in groups: one group per source, so each group has one reason
export function missingGroups(cat, cityName, sources) {
  const by = new Map();
  for (const x of cat.filter((y) => y.kind === "missing")) {
    const k = x.c.source;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(x.c);
  }
  return [...by].map(([source, list]) => {
    const cov = list.map((c) => c.covered).filter(isNum), lo = cov.length ? Math.min(...cov) : null, hi = cov.length ? Math.max(...cov) : null;
    const range = lo == null ? "" : lo === hi ? String(lo) : `${lo} עד ${hi}`;
    const many = hi != null && lo >= 400;
    const why = lo == null ? `אין במקור נתון על ${cityName}` : many ? `במקור יש נתון על ${range} יישובים, אבל לא על ${cityName}` : `המקור מפרסם נתון על ${range} יישובים בלבד, ולא על ${cityName}`;
    return { source, items: list, why, src: (sources || {})[source] || null };
  }).sort((x, y) => y.items.length - x.items.length || x.source.localeCompare(y.source));
}

// ── which questions this town can answer (the rail dims the others and says why, SPEC 7.3) ──
export function availability(model) {
  const st = stateOf(model), tc = trendCounts(model), pv = peerVerdicts(model), kind = townKind(model);
  if (kind === "uncovered") return { weak: null, changed: null, peers: null, first: null, missing: null };
  return {
    weak: null,
    changed: st.judged && tc.improving + tc.worsening + tc.stable > 0 ? null : "changed",
    peers: st.judged && pv.total ? null : "peers",
    first: st.judged ? null : "first",
    missing: null
  };
}

// a town that cannot be set against similar towns: very small, without any data, or the home dims that question. Its pages do not invite to the comparison and do not define it
export const hasNoPeers = (model) => !!model && Array.isArray(model.indicators) && (townKind(model) === "uncovered" || isVerySmallTown(model) || availability(model).peers != null);

export { shortName };

// ── this answer's table, for "הורדת נתונים (CSV)" (SPEC 6.3): { rows, columns } for csvButton ──
const UNIT = { "%": "אחוז", per1000: "לכל 1,000", per10k: "לכל 10,000", per100k: "לכל 100,000", days: "ימים", years: "שנים", ils: "שקלים", index: "ציון", count: "מספר" };
const BASE = [{ key: "name", title: "מדד" }, { key: "domain", title: "תחום" }, { key: "value", title: "ערך" }, { key: "unit", title: "יחידה" }, { key: "year", title: "שנה" }, { key: "nat", title: "ארצי" }, { key: "peer", title: "יישובים דומים" }, { key: "rank", title: "מקום" }, { key: "of", title: "מתוך" }, { key: "status", title: "מצב" }];
const STATE_WORD = { concern: "דורש טיפול", watch: "למעקב", good: "תקין", strength: "חוזק", uncertain: "קבוצה קטנה", stale: "נתון ישן", na: "מתאר בלבד" };
const cell = (v) => (isNum(v) ? v : "");
function indRow(model, a) {
  const L = a.last || {}, dom = model.domains.find((d) => d.id === a.domain);
  return { name: shortName(a), domain: dom ? dom.label : "", value: cell(L.v), unit: UNIT[a.unit] || "", year: L.year == null ? "" : L.year, nat: cell(L.nat), peer: cell(L.peer), rank: cell(L.rank), of: cell(L.of), status: STATE_WORD[a.status] || "" };
}
export function answerTable(model, qid, meta) {
  const st = stateOf(model);
  if (qid === "changed") {
    const columns = [...BASE.slice(0, 5), { key: "first", title: "שנה ראשונה" }, { key: "firstv", title: "ערך בשנה ראשונה" }, { key: "dir", title: "כיוון" }];
    return { columns, rows: movers(model, 8).map(({ a }) => ({ ...indRow(model, a), first: a.history.first.year, firstv: a.history.first.v, dir: a.history.trendClass === "improving" ? "השתפר" : "הידרדר" })) };
  }
  if (qid === "peers") return { columns: [...BASE, { key: "verdict", title: "לעומת יישובים דומים" }], rows: peerVerdicts(model).rows.map((r) => ({ ...indRow(model, r.a), verdict: { better: "טוב יותר", worse: "חלש יותר", alike: "דומה" }[r.verdict] })) };
  if (qid === "first") {
    const r = (model.recommendations || [])[0];
    return { columns: [{ key: "n", title: "צעד" }, { key: "text", title: "מה לעשות" }], rows: r ? (r.actions || []).map((t, i) => ({ n: i + 1, text: t })) : [] };
  }
  if (qid === "missing") {
    const byId = new Map(model.indicators.map((a) => [a.id, a]));
    const list = meta && meta.indicators ? meta.indicators : model.indicators.map((a) => ({ id: a.id, short: a.short, label: a.label }));
    const missingIds = new Set((model.coverage && model.coverage.missing) || []);
    return { columns: [{ key: "name", title: "מדד" }, { key: "state", title: "מצב" }, { key: "year", title: "שנה" }], rows: list.map((c) => {
      const a = byId.get(c.id), k = a ? kindOf(a) : missingIds.has(c.id) || meta ? "missing" : "found";
      return { name: (a && shortName(a)) || c.short || c.label, state: { found: "נמצא נתון", stale: "נמצא נתון, ישן", small: "קבוצה קטנה מדי", missing: "לא נמצא" }[k], year: a && a.last && a.last.year != null ? a.last.year : "" };
    }) };
  }
  const list = st.judged ? weakestFive(model) : model.indicators.filter(isSmall);
  return { columns: BASE, rows: list.map((a) => indRow(model, a)) };
}
