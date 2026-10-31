// Lab direction "questions": everything the five answers say, worked out from the city model. No DOM, so node can import it.
// Nothing here is invented: every figure is a field of the model (GET /api/city/:key) and every comparison uses the same rule as the real overview.
import { STATUS } from "../../ui.js";

export const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const JUDGED = ["concern", "watch", "good", "strength"];            // the four statuses that are a verdict: the denominator of "how many need treatment"
export const nm = (a) => a.short || a.label;
export const sgn = (a) => (a.direction === "lower" ? -1 : 1);

// the five questions, in the order a mayor asks them; the id is what the URL keeps (?q=weak)
export const QUESTIONS = [
  { id: "weak", text: "איפה אנחנו הכי חלשים?" },
  { id: "changed", text: "מה השתפר ומה הידרדר?" },
  { id: "peers", text: "איך אנחנו מול יישובים דומים?" },
  { id: "first", text: "מה כדאי לעשות קודם?" },
  { id: "missing", text: "מה חסר לנו בנתונים?" }
];
export const questionOf = (id) => QUESTIONS.find((q) => q.id === id) || null;

// ?q=weak|changed|peers|first|missing, read from location.hash ("#/c/1031/lab/questions?q=peers"); null when absent or unknown
export function readQuestion(hash) {
  const qs = String(hash || "").split("?")[1] || "";
  const id = new URLSearchParams(qs).get("q");
  return questionOf(id) ? id : null;
}

// the usual spread between localities for one figure (the same rule as the overview): a change or a gap is measured in these, so days, percentages and rates share one scale
export const spreadOf = (a) => Math.max(isNum(a.last.p25) && isNum(a.last.p75) ? a.last.p75 - a.last.p25 : 0, a.unit === "%" ? 5 : Math.abs(a.last.v) * 0.1 || 1);

// ── the state of the town: how many figures in each status. "judged" is the denominator of every "how many need treatment". ──
export function stateOf(model) {
  const all = {};
  for (const i of model.indicators) all[i.status] = (all[i.status] || 0) + 1;
  const judged = JUDGED.reduce((n, k) => n + (all[k] || 0), 0);
  return { all, judged, none: model.indicators.length - judged, n: model.indicators.length };
}

// figures on a group that is too small to compare: shown as they are, never ranked, trended or judged
export const isSmall = (a) => !!(a && a.last && a.last.reliable === false && isNum(a.last.v));
export const smallFigures = (model) => model.indicators.filter(isSmall).sort((x, y) => (y.importance || 0) - (x.importance || 0) || x.id.localeCompare(y.id));

// ── question 1: the weakest ──
// the judged figures that stand lowest among all localities (level = the share of localities it beats; 0 = the weakest); ties: the one with more room to improve first
export function weakestFive(model, n = 5) {
  return model.indicators.filter((a) => JUDGED.includes(a.status) && a.last && a.last.reliable !== false && isNum(a.last.level) && isNum(a.last.v))
    .sort((x, y) => x.last.level - y.last.level || (y.priority || 0) - (x.priority || 0) || x.id.localeCompare(y.id)).slice(0, n);
}
export const domainJudged = (c) => JUDGED.reduce((n, k) => n + ((c && c[k]) || 0), 0);
// the weakest domain is the one the model itself names in its headline: the lowest standing (the average place of its judged figures among all localities)
export function weakestDomain(model) {
  const list = model.domains.filter((d) => isNum(d.standing) && domainJudged(d.counts) > 0)
    .sort((a, b) => a.standing - b.standing || ((b.counts.concern || 0) - (a.counts.concern || 0)));
  const d = list[0];
  if (!d) return null;
  const worst = JUDGED.find((s) => (d.counts[s] || 0) > 0);
  return { d, standing: d.standing, judged: domainJudged(d.counts), worst, n: d.counts[worst] || 0 };
}
export const shortDomain = (label) => String(label || "").split(/ ו|,/)[0].trim() || String(label || "");

// ── question 2: what changed ──
export function trendCounts(model) {
  const c = { improving: 0, worsening: 0, stable: 0, unknown: 0, rising: 0, falling: 0 };
  for (const a of model.indicators) { const t = a.history && a.history.trendClass; if (t in c) c[t]++; else c.unknown++; }
  return c;
}
// how big the change since the first year is, in usual spreads between localities; positive = better (for a figure that has a direction)
export function changeSize(a) {
  const d = a.history && a.history.delta;
  return isNum(d) && a.last ? (d * sgn(a)) / spreadOf(a) : 0;
}
export function changeLists(model) {
  const by = (cls) => model.indicators.filter((a) => a.history && a.history.trendClass === cls && a.last).sort((x, y) => Math.abs(changeSize(y)) - Math.abs(changeSize(x)) || x.id.localeCompare(y.id));
  return { improved: by("improving"), worsened: by("worsening") };
}
// the biggest changes since the first year that mean something: a direction, a group big enough, a recent figure, a first year and a real change
export function movers(model, n = 8) {
  return model.indicators.filter((a) => !a.stale && a.direction && a.last && a.last.reliable !== false && a.history && a.history.first && isNum(a.history.delta) && a.history.delta !== 0)
    .map((a) => ({ a, gap: changeSize(a) })).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap) || x.a.id.localeCompare(y.a.id)).slice(0, n);
}

// ── question 3: next to similar localities ──
// better / worse / alike, for every figure that has a direction, a big enough group and a value for similar localities (the same tolerance as compareLine: 2% of the value)
export function peerVerdicts(model) {
  const rows = [];
  for (const a of model.indicators) {
    const L = a.last;
    if (!a.direction || a.stale || !L || L.reliable === false || !isNum(L.v) || !isNum(L.peer)) continue;
    const g = L.v - L.peer, tol = Math.abs(L.peer) * 0.02 || 0.05, better = g * sgn(a) > 0;
    rows.push({ a, gap: g, z: (g * sgn(a)) / spreadOf(a), verdict: Math.abs(g) < tol ? "alike" : better ? "better" : "worse" });
  }
  const n = (v) => rows.filter((r) => r.verdict === v).length;
  return { rows, better: n("better"), worse: n("worse"), alike: n("alike"), total: rows.length };
}
// the figure where the town differs most from similar localities (in usual spreads), and that has a place among all localities to draw
export function mostTelling(model) {
  const pv = peerVerdicts(model).rows.filter((r) => r.a.last.rank != null && r.a.last.of && isNum(r.a.last.level));
  pv.sort((x, y) => Math.abs(y.z) - Math.abs(x.z) || (y.a.importance || 0) - (x.a.importance || 0) || x.a.id.localeCompare(y.a.id));
  return pv[0] || null;
}

// ── question 4: what to do first ──
export function emptyPlanCause(model) {
  const name = model.city.name, cov = model.coverage || {}, have = cov.have || 0;
  const small = Math.min(have, model.indicators.filter((a) => a.status === "uncertain").length);
  if (!have) return { kind: "none", text: `אין ל${name} נתונים רשמיים במדדים שהמערכת עוקבת אחריהם, ולכן אין על מה לבסס המלצה.` };
  if (small * 2 >= have) return { kind: "small", small, have, text: `אין המלצה כי ${small} מתוך ${have} המדדים של ${name} נמדדים על קבוצות קטנות מדי להשוואה. הם מוצגים, אבל אינם נכללים בדירוג ובמסקנות.` };
  return { kind: "bar", text: `המדדים של ${name} לא העלו ממצא שעובר את סף ההמלצה: מדד חלש, מגמה בהידרדרות או פער בתוך העיר.` };
}
export const topPriorities = (model, n = 3) => (model.priorities || []).map((id) => model.indicators.find((x) => x.id === id)).filter(Boolean).slice(0, n);

// ── question 5: what is missing ──
export const kindOf = (a) => (!a || !a.last || !isNum(a.last.v) ? "missing" : a.last.reliable === false ? "small" : a.stale ? "stale" : "found");
// the whole catalogue, each figure as found / stale / small group / missing for this town (meta = GET /api/meta, like pages/coverage.js)
export function coverageOf(model, meta) {
  const byId = new Map(model.indicators.map((a) => [a.id, a]));
  const cat = meta.indicators.map((c) => ({ c, a: byId.get(c.id) || null, kind: kindOf(byId.get(c.id)) }));
  const count = (k) => cat.filter((x) => x.kind === k).length;
  return { cat, found: count("found") + count("stale"), small: count("small"), missing: count("missing"), total: cat.length };
}
// what is missing, in groups: one group per source and per reason, so that each group has one reason (the same words as pages/coverage.js)
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
    const why = lo == null ? `אין במקור נתון על ${cityName}` : many ? `במקור יש נתון על ${range} יישובים, אבל לא על ${cityName}` : `המקור כולל נתון על ${range} יישובים בלבד`;
    return { source, items: list, why, src: (sources || {})[source] || null };
  }).sort((x, y) => y.items.length - x.items.length || x.source.localeCompare(y.source));
}

// a status as a word with its tone (for the coloured word that starts a reason)
export const statusWord = (s) => (STATUS[s] || STATUS.na).label;
export const statusTone = (s) => (STATUS[s] || STATUS.na).tone;
