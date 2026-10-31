"use strict";
/**
 * Recommendations: the findings of one locality in, a ranked action plan out.
 *
 *   1. every entry of catalog/interventions.js is matched against the city's findings (finding type + parameter or domain)
 *   2. an entry that matches becomes a recommendation: why (the city's own findings, with figures), how it got here (history of each
 *      parameter), what to do, a target to measure by (from -> to, with the number of people it means), who carries it, and the
 *      evidence behind it (links that the evidence scout opened)
 *   3. recommendations are ranked by the severity of the findings behind them, discounted by how weak the evidence is and how much effort it takes
 *
 * Nothing here is typed by a model: sentences are templates filled from the analysis, figures come from the store.
 */
const interventions = require("../catalog/interventions");
const evidence = require("../catalog/evidence.json");
const domains = require("../catalog/domains");
const { byId } = require("../catalog/indicators");
const { unitText, pts, num, I, deltaText } = require("../lib/format");
const { sign } = require("./analyze");
const { targetWho } = require("./guide");

// every constant of the ranking and of the targets, printed on the method page
const REC_RULES = {
  maxRecs: 9,
  otherWeight: 0.35, otherCap: 30,                                  // score = strongest finding + 35% of the others (at most 30 points)
  evidenceFactor: { strong: 1, moderate: 0.93, limited: 0.82, none: 0.85 }, effortFactor: { low: 1, medium: 0.96, high: 0.85 },
  strengthCap: 35,                                                  // "keep what works" never outranks a problem
  reviewCap: 40, maxReviews: 2,                                     // a general review of a domain never outranks a concrete action; at most two are shown
  kpiYears: 2, kpiHalf: 0.5, kpiStepMin: 3, kpiStepMax: 12, maxKpis: 3,   // target: close half the gap to the benchmark in two years, by 3 to 12 points
  kpiStepSmall: [1, 3],                                                    // ... or by 1 to 3 points where the evidence reports a small effect (school programmes against overweight)
  peerEdge: 3, peerEdgeRel: 0.15,                                                      // a similar locality is worth learning from if it is at least 3 points better
  outlierGap: 8, outlierLevel: 15                                   // "check the data first": 8 points below the nation and in the bottom 15% of localities
};
const R = REC_RULES;

const BENCH_LABEL = { target: "יעד משרד הבריאות", national: "הממוצע הארצי", peers: "יישובים דומים", top: "הרבעון העליון של היישובים" };

// ── small helpers ──────────────────────────────────────────────────────────────
function joinHe(items) {
  if (items.length <= 1) return items[0] || "";
  const last = items[items.length - 1];
  return items.slice(0, -1).join(", ") + " " + (/^[\u0590-\u05FF]/.test(last) ? "ו" : "ו-") + last;
}
function fill(text, vars) {
  return String(text).replace(/\{(\w+)\}/g, (m, k) => {
    if (vars[k] == null) { console.warn("recommend: unfilled placeholder " + m); return ""; }
    return vars[k];
  });
}
const uniq = (arr) => [...new Set(arr)];

// ── conditions beyond finding types ────────────────────────────────────────────
const GATES = {
  // "check the data first" only when the figure is extreme or the group size moved sharply
  outlier_or_shift: {
    each: (a) => a.baseShift != null || (a.direction && a.last.gapNat != null && a.last.level != null && a.last.gapNat * sign(a) <= -R.outlierGap && a.last.level < R.outlierLevel)
  },
  strengths: { min: 2 }
};

function matches(entry, f) {
  if (!entry.applies.triggers.includes(f.type)) return false;
  if (f.indicator) return !entry.applies.domains && (!entry.applies.indicators || entry.applies.indicators.includes(f.indicator));
  return !!(entry.applies.domains && entry.applies.domains.includes(f.domain));
}

// ── history: how the parameter moved and where the current course leads ───────
function story(a) {
  const H = a.history, L = a.last, u = (v) => unitText(a.unit, v);
  if (a.series.length < 2) return `קיים נתון לשנת ${I(L.year)} בלבד, ולכן אין עדיין תמונה של מגמה.`;
  const parts = [];
  const move = H.delta === 0 ? "ללא שינוי" : `${H.delta > 0 ? "עלייה" : "ירידה"} של ${deltaText(a.unit, H.delta)}`;
  parts.push(`${a.short}: מ-${u(H.first.v)} ב-${I(H.first.year)} ל-${u(L.v)} ב-${I(L.year)} (${move})`);
  const nats = a.series.filter((x) => x.nat != null);
  if (nats.length >= 2) parts.push(`בממוצע הארצי: מ-${u(nats[0].nat)} ל-${u(nats[nats.length - 1].nat)}`);
  let text = parts.join(". ") + ".";
  const s = sign(a), below = L.target != null && s > 0 && L.v < L.target;
  if (H.gapMove != null && Math.abs(H.gapMove) >= 3) text += H.gapMove > 0 ? ` היישוב מצמצם את הפער מהממוצע הארצי ב-${deltaText(a.unit, H.gapMove)}.` : ` הפער מהממוצע הארצי מתרחב ב-${deltaText(a.unit, H.gapMove)}.`;
  if (H.projection) {
    text += ` אם הקצב יימשך, ב-${I(H.projection.year)} הערך צפוי להיות ${u(H.projection.v)}`;
    text += H.yearsToTarget != null ? ` והיישוב יגיע ליעד בעוד כ-${num(H.yearsToTarget)} שנים.` : below && H.trendClass === "worsening" ? ", והיישוב יתרחק מהיעד." : ".";
  } else if (H.trendClass === "stable" && below) text += " המדד יציב ולכן לא צפוי להתקרב ליעד מעצמו.";
  return text;
}

// ── targets: from -> to, and how many people that means ───────────────────────
function benchmark(a) {
  const L = a.last, s = sign(a);
  if (!s) return null;
  if (L.target != null && L.meetsTarget === false) return { v: L.target, kind: "target", label: a.guide && a.guide.judges ? targetWho(a.guide) : BENCH_LABEL.target };       // the target is named after its author
  const better = [{ v: L.nat, kind: "national" }, { v: L.peer, kind: "peers" }].filter((c) => c.v != null && (c.v - L.v) * s > 0.5);
  if (better.length) return better.reduce((x, y) => ((y.v - x.v) * s > 0 ? y : x));
  if (L.p75 != null && s > 0 && L.p75 - L.v > 0.5) return { v: L.p75, kind: "top" };
  return null;
}

// how far a two-year target moves: half the gap, but at least 3 and at most 12 points (the size of effects the evidence reports), never past the benchmark
const stepOf = (gap, [lo, hi] = [R.kpiStepMin, R.kpiStepMax]) => (gap <= lo ? gap : Math.max(lo, Math.min(hi, gap * R.kpiHalf)));
const GROUP = { "יהודי": "המגזר היהודי", "ערבי": "המגזר הערבי" };
const groupName = (label) => GROUP[label] || label;

function kpiClose(a, step) {
  const ind = byId[a.id], L = a.last, s = sign(a), b = benchmark(a);
  if (!b || !L.reliable) return null;
  const gap = (b.v - L.v) * s;
  const to = Math.round((L.v + s * (a.unit === "%" ? stepOf(gap, step) : gap * R.kpiHalf)) * 100) / 100;
  const people = a.unit === "%" && L.d ? Math.round((Math.abs(to - L.v) / 100) * L.d) : null;
  return {
    indicator: a.id, label: a.short || a.label, from: unitText(a.unit, L.v), to: unitText(a.unit, to), year: L.year, byYear: L.year + R.kpiYears,
    people, noun: ind.noun, bench: `${b.label || BENCH_LABEL[b.kind]} (${unitText(a.unit, b.v)})`
  };
}

function kpiHalve(a, f) {
  const { lo, hi, gap, year } = f.facts, ind = byId[a.id];
  const to = Math.round((lo.v + stepOf(gap)) * 10) / 10;
  return {
    indicator: a.id, label: `${a.short || a.label} — ${groupName(lo.label)}`, from: unitText(a.unit, lo.v), to: unitText(a.unit, to), year, byYear: year + R.kpiYears,
    people: a.unit === "%" && lo.d ? Math.round(((to - lo.v) / 100) * lo.d) : null, noun: ind.noun, bench: `לצמצם את הפער מ${groupName(hi.label)} (${unitText(a.unit, hi.v)})`
  };
}

// a similar locality that does clearly better: someone to call
function bestPeer(a, model, store) {
  const ind = byId[a.id], s = sign(a), year = a.last.year;
  let best = null;
  for (const p of model.peers) {
    const c = store.cell(a.id, p.key, year);
    if (!c || c.d < (ind.minBase || 0)) continue;
    if (!best || (c.v - best.v) * s > 0) best = { key: p.key, name: p.name, v: c.v, d: c.d };
  }
  const edge = a.unit === "%" ? R.peerEdge : Math.abs(a.last.v) * R.peerEdgeRel;       // 3 points for a percentage, 15% of the value for a rate
  return best && s && (best.v - a.last.v) * s >= edge ? { indicator: a.id, label: a.short || a.label, key: best.key, name: best.name, value: unitText(a.unit, best.v), year } : null;
}

// ── one recommendation ─────────────────────────────────────────────────────────
function score(entry, fs) {
  const per = new Map();
  for (const f of fs) { const k = f.indicator || f.id; per.set(k, Math.max(per.get(k) || 0, f.severity)); }
  const sev = [...per.values()].sort((x, y) => y - x);
  const base = sev[0] + R.otherWeight * Math.min(R.otherCap, sev.slice(1).reduce((x, y) => x + y, 0));
  let s = Math.min(100, base) * R.evidenceFactor[entry.evidenceStrength || "none"] * R.effortFactor[entry.effort];
  if (entry.gate === "strengths") s = Math.min(R.strengthCap, s);
  if (entry.generic) s = Math.min(R.reviewCap, s);
  return Math.round(s);
}

// the reasons shown with a recommendation: the strongest finding of each parameter first, then the strongest of what is left
function pickWhy(fs, n = 4) {
  const first = [], seen = new Set();
  for (const f of fs) { const k = f.indicator || f.id; if (!seen.has(k)) { seen.add(k); first.push(f); } }
  const rest = fs.filter((f) => !first.includes(f));
  return first.concat(rest).slice(0, n);
}

function build(entry, fs, ids, byInd, model, store, forDomain) {
  const analyses = ids.map((id) => byInd.get(id)).filter(Boolean);
  const lead = analyses[0];
  const domainId = forDomain || entry.domain || (lead ? lead.domain : fs[0].domain);
  const dom = domains.find((d) => d.id === domainId);
  const vars = { city: model.city.name, labels: joinHe(analyses.slice(0, 3).map((a) => a.short || a.label)), noun: lead ? byId[lead.id].noun : "", domainLabel: dom ? dom.label : "" };

  const kpis = [];
  if (entry.kpi === "close_gap") for (const a of analyses) { if (kpis.length >= R.maxKpis) break; const k = kpiClose(a, entry.kpiStep === "small" ? R.kpiStepSmall : undefined); if (k) kpis.push(k); }
  if (entry.kpi === "halve_gap") for (const a of analyses) {
    if (kpis.length >= R.maxKpis) break;
    const f = fs.find((x) => x.indicator === a.id && x.type.startsWith("equity_"));
    if (f) kpis.push(kpiHalve(a, f));
  }

  const learnFrom = entry.kpi === "close_gap" ? analyses.slice(0, R.maxKpis).map((a) => bestPeer(a, model, store)).filter(Boolean) : [];

  return {
    id: "rec:" + entry.id + (forDomain ? ":" + forDomain : ""), intervention: entry.id, title: fill(entry.title, vars), domain: domainId, horizon: entry.horizon, effort: entry.effort,
    evidenceStrength: entry.evidenceStrength || null, evidenceNote: entry.evidenceNote || null, score: score(entry, fs),
    summary: fill(entry.summary, vars), indicators: analyses.map((a) => a.id),
    why: pickWhy(fs).map((f) => ({ findingId: f.id, text: f.text, indicator: f.indicator, type: f.type, polarity: f.polarity })),
    history: entry.kpi || entry.gate === "strengths" ? analyses.slice(0, R.maxKpis).map((a) => ({ indicator: a.id, label: a.short || a.label, text: story(a) })) : [],
    actions: entry.actions.map((t) => fill(t, vars)), kpis, learnFrom,
    owner: entry.owner, caveat: entry.caveat || null,
    evidence: (entry.evidence || []).map((id) => evidence.interventions[id]).filter(Boolean).map((e) => ({ id: e.id, title: e.title, strength: e.strength, url: e.url, description: e.description })),
    notes: (entry.rules || []).map((id) => evidence.rules[id]).filter(Boolean).map((r) => ({ id: r.id, text: r.text, url: r.url }))
  };
}

function recommend(model, store) {
  const byInd = new Map(model.indicators.map((a) => [a.id, a]));
  const out = [];
  for (const entry of interventions) {
    let fs = model.findings.filter((f) => matches(entry, f));
    const gate = entry.gate && GATES[entry.gate];
    if (gate && gate.each) fs = fs.filter((f) => f.indicator && gate.each(byInd.get(f.indicator)));
    if (!fs.length) continue;
    const idsOf = (list) => uniq(list.flatMap((f) => (f.indicator ? [f.indicator] : (f.facts && f.facts.ids) || [])));
    if (entry.applies.domains) {                                       // a domain-level entry: one recommendation per domain, each naming its own domain
      const byDomain = new Map();
      for (const f of fs) byDomain.set(f.domain, [...(byDomain.get(f.domain) || []), f]);
      out.push(...[...byDomain].map(([d, list]) => build(entry, list, idsOf(list), byInd, model, store, d)).sort((x, y) => y.score - x.score).slice(0, R.maxReviews));
      continue;
    }
    const ids = idsOf(fs);
    if (gate && gate.min && ids.length < gate.min) continue;
    out.push(build(entry, fs, ids, byInd, model, store));
  }
  out.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id));
  return out.slice(0, R.maxRecs);
}

module.exports = { recommend, story, benchmark, joinHe, REC_RULES, GATES };
