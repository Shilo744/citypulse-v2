"use strict";
// Official guidelines in the catalogue, the model, the API, the guard and the findings (research/guidelines.json is the source of truth).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const cfg = require("../src/lib/config");
const { Store } = require("../src/model/store");
const { buildCityModel } = require("../src/model/city");
const { analyzeIndicator, RULES } = require("../src/model/analyze");
const { indicators, byId, GUIDELINES } = require("../src/catalog/indicators");
const sources = require("../src/catalog/sources");
const research = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "research", "guidelines.json"), "utf8"));

const storeFile = path.join(cfg.STORE, "store.json");
const haveStore = fs.existsSync(storeFile);
const store = haveStore ? Store.load(storeFile) : null;
const plain = (t) => String(t).replace(/[⁦⁩]/g, "");
const DIRECTION = { atLeast: "higher", atMost: "lower" };

// ── the catalogue and the research file agree ───────────────────────────────────────

test("catalogue: every guideline and benchmark is complete, consistent with its indicator, and names a real source", () => {
  let n = 0;
  for (const ind of indicators) for (const slot of ["guideline", "benchmark"]) {
    const g = ind[slot]; if (!g) continue;
    n++;
    const where = `${ind.id}.${slot}`;
    assert.ok(["official_target", "international_benchmark"].includes(g.kind), where + " kind");
    assert.equal(slot === "guideline", g.kind === "official_target", where + ": an official target is the guideline, a reference figure is the benchmark");
    assert.ok(DIRECTION[g.direction], where + " direction");
    if (ind.direction && g.unit === ind.unit) assert.equal(DIRECTION[g.direction], ind.direction, where + ": the good way of the guideline is the good way of the indicator");
    assert.ok(Number.isFinite(g.value) && g.value > 0, where + " value");
    assert.ok(["national", "international"].includes(g.scope), where + " scope");
    assert.ok(typeof g.year === "string" && /^\d{4}(\/\d{2})?$/.test(g.year), where + " year is a string like 2024 or 2021/22");
    const src = sources[g.source];
    assert.ok(src, where + ": unknown source " + g.source);
    assert.equal(src.role === "guideline" || g.source === "moh_tipat_halav", true, where + ": the document of a guideline is a guideline source (or the open data it is read from)");
    assert.match(src.url, /^https:\/\//, where + " url");
    assert.ok(src.license && src.publisher && src.name, where + ": the source carries a publisher, a name and a licence or terms line");
    assert.ok(g.caveat && g.caveat.length > 40, where + " caveat");
    assert.ok(g.where, where + " says where in the source");
    const comparable = g.unit === ind.unit;
    if (!comparable) { assert.equal(g.unit, "pct_reduction", where + ": the only other unit is a national percentage cut"); assert.ok(g.valueText, where + " needs a text"); assert.notEqual(g.judges, true, where + " cannot judge"); }
    if (slot === "benchmark") assert.ok(g.judges == null || g.judges === false, where + ": a benchmark never judges");
    if (g.judges) { assert.ok(comparable && ind.direction && g.kind === "official_target", where + ": only an official target of the same unit and a judged indicator may judge"); }
  }
  assert.equal(n, 18, "13 program targets + 2 other official targets + 3 benchmarks");
});

test("catalogue and research file: every verified reference is in the catalogue as written, nothing rejected or unknown is", () => {
  const used = new Set();
  for (const r of research.references) {
    const ind = byId[r.indicator];
    assert.ok(ind, r.id + ": unknown indicator");
    const g = ind[r.role];
    assert.ok(g, `${r.id}: missing from the catalogue as ${r.role}`);
    used.add(`${r.indicator}.${r.role}`);
    assert.equal(r.verified, true, r.id + " must be verified");
    assert.equal(g.kind, r.kind, r.id + " kind"); assert.equal(g.value, r.value, r.id + " value"); assert.equal(g.direction, r.direction, r.id + " direction");
    assert.equal(g.year, r.year, r.id + " year"); assert.equal(g.scope, r.scope, r.id + " scope"); assert.equal(g.unit, r.unit, r.id + " unit");
    assert.equal(sources[g.source].url, r.url, r.id + ": the catalogue links the page the verifier opened");
    if (r.page != null) assert.ok(String(g.where).includes(String(r.page)), `${r.id}: the page ${r.page} is named`);
    if (r.role === "guideline") assert.equal(!!g.judges, r.judges, r.id + " judges");
  }
  // nothing in the catalogue that the research did not verify
  for (const ind of indicators) for (const slot of ["guideline", "benchmark"]) if (ind[slot]) assert.ok(used.has(`${ind.id}.${slot}`), `${ind.id}.${slot} is not in research/guidelines.json`);
  // what failed the check is never used: no catalogue entry has the same value, kind and scope for that indicator (the same page may hold a good and a rejected figure: UN goal 3 has 25 and 12)
  for (const r of research.rejected) {
    assert.equal(r.verified, false);
    for (const slot of ["guideline", "benchmark"]) {
      const g = byId[r.indicator][slot];
      if (g) assert.ok(!(g.value === r.value && g.kind === r.kind && g.scope === r.scope), `${r.id} was rejected but ${r.indicator}.${slot} uses it`);
    }
  }
  // the indicators with honestly no reference have none
  for (const n of research.none) { assert.ok(byId[n.indicator], n.indicator); if (!used.has(n.indicator + ".guideline") && !used.has(n.indicator + ".benchmark")) { assert.equal(byId[n.indicator].guideline, undefined); assert.equal(byId[n.indicator].benchmark, undefined); } }
  assert.equal(Object.keys(GUIDELINES).length, research.references.length, "one catalogue entry per verified reference");
});

test("catalogue: the program targets in the catalogue are the figures the open data carries for their own year", { skip: !haveStore }, () => {
  for (const ind of indicators) {
    if (!(ind.guideline && ind.collect && ind.collect.targetField)) continue;
    assert.equal(store.target(ind.id, Number(ind.guideline.year)), ind.guideline.value, `${ind.id}: the catalogue says ${ind.guideline.value} for ${ind.guideline.year}`);
  }
});

// ── the model of a town ─────────────────────────────────────────────────────────────

test("model 1031: the Ministry of Health targets carry value, gap, meets and a source; the data wins over the catalogue year", { skip: !haveStore }, () => {
  const m = buildCityModel(store, "1031");
  const a = m.indicators.find((x) => x.id === "th_mmrv"), g = a.guide;
  assert.equal(g.kind, "official_target"); assert.equal(g.value, a.last.target); assert.equal(g.value, 80); assert.equal(g.year, String(a.last.year));
  assert.equal(g.unit, "%"); assert.equal(g.direction, "atLeast"); assert.equal(g.scope, "national"); assert.equal(g.judges, true); assert.equal(g.comparable, true);
  assert.equal(g.gap, Math.round((a.last.v - 80) * 10) / 10); assert.ok(g.gap < 0 && g.meets === false);
  assert.equal(g.relGap, Math.round((g.gap / 80) * 1000) / 1000);
  assert.deepEqual(Object.keys(g.source).sort(), ["id", "publisher", "short", "title", "url", "where"]);
  assert.equal(g.source.publisher, "משרד הבריאות"); assert.match(g.source.title, /עמוד 359/); assert.match(g.source.url, /gov\.il/);
  assert.equal(plain(g.text), "לפחות 80%");
  assert.equal(a.last.gapTarget, g.gap, "the older fields agree with the guide");
  // the older year-by-year program targets: the target of the figure's own year
  const pert = m.indicators.find((x) => x.id === "th_pertussis");
  assert.equal(pert.guide.value, store.target("th_pertussis", pert.last.year));
  assert.ok(m.guideSources.some((s) => s.id === "moh_quality_report") && m.guideSources.every((s) => s.role === "guideline" || s.id === "moh_tipat_halav"));
});

test("model: an indicator without a verified reference has guide null; a reference that is not a bar never carries a verdict into the status", { skip: !haveStore }, () => {
  const m = buildCityModel(store, "2710");
  for (const a of m.indicators) {
    const ind = byId[a.id];
    if (!ind.guideline) assert.equal(a.guide, null, a.id);
    if (!ind.benchmark) assert.equal(a.benchmark, null, a.id);
    assert.ok(!a.benchmark || a.benchmark.judges === false, a.id + ": a benchmark never judges");
  }
  const im = m.indicators.find((x) => x.id === "infant_mortality");
  assert.equal(im.guide.judges, false); assert.equal(im.guide.comparable, true); assert.equal(im.guide.scope, "international");
  assert.match(im.guide.caveat, /עד גיל 5/);
  const road = buildCityModel(store, "1031").indicators.find((x) => x.id === "road_severe_100k").guide;
  assert.equal(road.comparable, false); assert.equal(road.gap, null); assert.equal(road.relGap, null); assert.equal(road.meets, null); assert.equal(road.judges, false);
  assert.equal(road.text, "הפחתה של 25% בפגיעה חמורה בחמש שנים, לעומת ממוצע 2020-2024");
  const bmi = buildCityModel(store, "1031").indicators.find((x) => x.id === "bmi_g1_over");
  assert.equal(bmi.benchmark.value, 29); assert.equal(bmi.benchmark.gap, Math.round((29 - bmi.last.v) * 10) / 10, "positive = better than the reference (lower is better here)");
  const pov = buildCityModel(store, "1031").indicators.find((x) => x.id === "pov_children");
  assert.equal(pov.benchmark.gap, null, "an indicator that only describes is never compared"); assert.equal(pov.benchmark.meets, null);
  assert.equal(pov.status, "na");
});

test("model, all localities: a figure on too few cases is never compared; a verdict follows the rule that is written down", { skip: !haveStore }, () => {
  let judging = 0, held = 0;
  for (const key of Object.keys(store.localities)) {
    if (store.coverage(key) < 4) continue;
    const m = buildCityModel(store, key); if (!m) continue;
    for (const a of m.indicators) {
      for (const g of [a.guide, a.benchmark]) {
        if (!g) continue;
        if (!a.last.reliable || !a.direction) assert.deepEqual([g.gap, g.relGap, g.meets], [null, null, null], `${key}/${a.id}: a figure that is not compared`);
        if (g.gap != null) assert.equal(g.meets, g.direction === "atLeast" ? a.last.v >= g.value : a.last.v <= g.value, `${key}/${a.id}: meets`);
      }
      if (!a.guide || !a.guide.judges || !a.last.reliable || a.stale) continue;
      judging++;
      const worsening = a.history.trendClass === "worsening";
      if (a.guide.meets && !worsening) { held++; assert.ok(["good", "strength"].includes(a.status), `${key}/${a.id}: meets its official target and does not deteriorate, so it is at least תקין, got ${a.status}`); }
      if (a.status === "strength") assert.notEqual(a.guide.meets, false, `${key}/${a.id}: strength needs the official target met`);
      if (a.guide.meets === false && a.status === "good") assert.ok(a.guide.gap >= -RULES.nearTarget, `${key}/${a.id}: good only within ${RULES.nearTarget} points of the target`);
      if (a.guide.gap < -RULES.farBelowTarget) assert.equal(a.status, "concern", `${key}/${a.id}: far under the target`);
    }
  }
  assert.ok(judging > 1000 && held > 200, `judging ${judging}, held ${held}`);
});

test("model: a non-judging reference never changes a status, a rank or a priority", { skip: !haveStore }, () => {
  const { findPeers } = require("../src/model/city");
  let checked = 0;
  for (const key of ["1031", "2710", "9000", "99"]) {
    const peers = findPeers(store, key);
    for (const ind of indicators.filter((i) => (i.guideline && !i.guideline.judges) || i.benchmark)) {
      const withRef = analyzeIndicator(store, ind, key, peers); if (!withRef) continue;
      const bare = analyzeIndicator(store, { ...ind, guideline: undefined, benchmark: undefined }, key, peers);
      assert.deepEqual([withRef.status, withRef.statusWhy, withRef.priority, withRef.last.rank, withRef.last.level], [bare.status, bare.statusWhy, bare.priority, bare.last.rank, bare.last.level], `${key}/${ind.id}`);
      checked++;
    }
  }
  assert.ok(checked >= 8, "checked " + checked);
});

// ── the rules for units that are not percentages (a stub store: no data file needed) ───────────

function stub(ind, others, mine /* {2022,2023,2024} */) {
  const loc = { me: {} }, vals = { me: mine };
  others.forEach((v, i) => { vals["o" + i] = { 2022: v, 2023: v, 2024: v }; });
  const cell = (key, y) => (vals[key] && vals[key][y] != null ? { v: vals[key][y], n: null, d: null } : null);
  return {
    cityYears: (id, key) => (vals[key] ? [2022, 2023, 2024] : []), cell: (id, key, y) => cell(key, y), nat: () => null, target: () => null, latestYearOf: () => 2024,
    distribution: (id, y) => Object.keys(vals).map((k) => ({ key: k, v: vals[k][y], d: null }))
  };
}
const REF = { kind: "official_target", value: 10, unit: "per100k", direction: "atMost", year: "2030", scope: "national", source: "moh_quality_report", where: "עמוד 1", judges: true, caveat: "הסתייגות לבדיקה בלבד, ארוכה מספיק." };
const IND = { id: "x_rate", domain: "safety", label: "שיעור", short: "שיעור", unit: "per100k", direction: "lower", importance: 3, kind: "level", minBase: 0, source: "cbs_road_accidents", guideline: REF };
const run = (ind, others, mine) => { const a = analyzeIndicator(stub(ind, others, mine), ind, "me", []); return a; };
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const flat = (v) => ({ 2022: v, 2023: v, 2024: v });

test("units: a rate is read as a share of the target, not in points", () => {
  const worseOthers = range(15, 44);                                              // everyone else is worse than 10: this locality is always first among them
  const far = run(IND, worseOthers, flat(14));                                    // 40 percent over the target: far
  assert.equal(far.guide.relGap, -0.4); assert.equal(far.guide.gap, -4); assert.equal(far.guide.meets, false); assert.equal(far.guide.judges, true);
  assert.equal(far.last.level >= 90, true);
  assert.equal(far.status, "concern", "far from its official target, however good the rank"); assert.deepEqual(far.statusWhy, ["target"]);
  const mid = run(IND, worseOthers, flat(11.5));                                  // 15 percent over: neither far nor near
  assert.equal(mid.status, "watch", "better than almost everyone, but not near the official target: at best למעקב"); assert.deepEqual(mid.statusWhy, ["target"]);
  const near = run(IND, worseOthers, flat(10.9));                                 // 9 percent over: near, but not met, so not a strength
  assert.equal(near.status, "good"); assert.equal(near.guide.meets, false);
  const met = run(IND, worseOthers, flat(9.5));
  assert.equal(met.status, "strength", "met the official target and in the top quarter"); assert.equal(met.guide.meets, true); assert.equal(met.guide.gap, 0.5);
  assert.ok(RULES.targetFarRel === 0.25 && RULES.targetNearRel === 0.1);
});

test("units: an official target met lifts a low rank to תקין, but not when the figure deteriorates; a reference that does not judge lifts nothing", () => {
  const better = range(1, 9).concat(range(1, 9), range(1, 9)).map((v) => v + 0.01);       // everyone else is better than this locality
  const held = run(IND, better, flat(9.5));
  assert.equal(held.guide.meets, true); assert.ok(held.last.level < 25, "bottom quarter by rank"); assert.equal(held.status, "good", "תקין although most localities do better"); assert.deepEqual(held.statusWhy, []);
  const worse = run(IND, better, { 2022: 6, 2023: 8, 2024: 9.5 });
  assert.equal(worse.history.trendClass, "worsening"); assert.equal(worse.status, "concern", "meeting the target does not hold a deteriorating figure");
  const loose = run({ ...IND, guideline: { ...REF, judges: false } }, better, flat(9.5));
  assert.equal(loose.status, "concern", "the same figure with a reference that does not judge keeps the rank rule"); assert.equal(loose.guide.judges, false);
  assert.equal(loose.guide.meets, true, "the fact is still reported");
  const noRef = run({ ...IND, guideline: undefined }, better, flat(9.5));
  assert.equal(noRef.guide, null); assert.equal(noRef.status, "concern");
});

test("units: a higher-is-better rate with an atLeast target, and the fields the screens already read", () => {
  const ind = { ...IND, id: "y_rate", unit: "per10k", direction: "higher", guideline: { ...REF, unit: "per10k", direction: "atLeast", value: 10 } };
  const a = run(ind, range(1, 9).map((v) => v - 0.5), flat(7));                    // 30 percent short
  assert.equal(a.guide.gap, -3); assert.equal(a.guide.relGap, -0.3); assert.equal(a.status, "concern"); assert.equal(a.last.gapTarget, -3); assert.equal(a.last.meetsTarget, false); assert.equal(a.last.target, 10, "a target that does not come year by year fills the older fields too");
  const lowerOne = run(IND, range(15, 44), flat(14));
  assert.equal(lowerOne.last.gapTarget, -4, "negative = short of the target, whichever way is good");
});

// ── findings, recommendations, the guard and the API ────────────────────────────────

test("findings: the target sentences name the author of the target, and say so when a target is met in the lower half", { skip: !haveStore }, () => {
  const m = buildCityModel(store, "1031");
  const f = m.findings.find((x) => x.id === "th_mmrv:below_target");
  assert.ok(f, "1031 is far under the MMR target");
  assert.match(plain(f.text), /מתחת ליעד משרד הבריאות \(80%\)/); assert.match(plain(f.text), /גם הממוצע הארצי \(65\.8%\) מתחת ליעד/);
  assert.equal(f.facts.gap, m.indicators.find((x) => x.id === "th_mmrv").guide.gap);
  let lower = 0;
  for (const key of ["472", "9000", "2710"]) {
    const mm = buildCityModel(store, key);
    for (const a of mm.indicators) {
      if (!a.guide || !a.guide.judges || !a.guide.meets || a.last.level == null || a.last.level >= 50 || a.stale) continue;
      const mf = mm.findings.find((x) => x.id === a.id + ":meets_target");
      assert.ok(mf, `${key}/${a.id}`);
      assert.match(plain(mf.text), /אף שהמקום בין היישובים נמוך יותר \(מקום \d+ מתוך \d+\)/); lower++;
    }
  }
  assert.ok(lower >= 3, "lower " + lower);
});

test("recommendations: the target a plan measures by is named after its author", { skip: !haveStore }, () => {
  const api = require("../src/api");
  const recs = api.getModel("1031").recommendations;
  const benches = recs.flatMap((r) => r.kpis.map((k) => k.bench));
  assert.ok(benches.some((b) => /^יעד משרד הבריאות \(/.test(plain(b))), "a KPI against the Ministry of Health target: " + benches.join(" | "));
});

test("guard: {{guide:ID}} gives the value of a target that judges and nothing else", { skip: !haveStore }, () => {
  const { expand } = require("../src/agent/guard");
  const m = require("../src/api").getModel("1031");
  assert.equal(plain(expand("היעד הוא {{guide:th_mmrv}}", m)), "היעד הוא 80%");
  assert.equal(plain(expand("ל-{{guide:th_mmrv}}", m)), "ל-80%", "a Hebrew prefix keeps its hyphen");
  assert.equal(expand("{{guide:road_severe_100k}}", m), null, "a national percentage cut is not a figure for a sentence about a rate");
  assert.equal(expand("{{guide:bmi_g1_over}}", m), null, "a reference figure of other countries is not a target");
  assert.equal(expand("{{guide:wait_gyn_days}}", m), null, "no official target, no figure");
  assert.equal(expand("{{guide:no_such_id}}", m), null);
});

test("API: /api/meta carries the guideline and the benchmark of each indicator with the source; a town model and the ask cards carry the guide", { skip: !haveStore }, () => {
  const api = require("../src/api");
  const meta = api.publicCatalog();
  const by = Object.fromEntries(meta.indicators.map((i) => [i.id, i]));
  assert.equal(meta.indicators.length, indicators.length);
  assert.equal(by.th_mmrv.guideline.value, 80); assert.equal(by.th_mmrv.guideline.yearly, true); assert.equal(by.th_mmrv.guideline.judges, true);
  assert.equal(by.th_mmrv.guideline.source.url, sources.moh_quality_report.url); assert.equal(by.th_mmrv.guideline.source.publisher, "משרד הבריאות");
  assert.equal(by.bmi_g7_over.benchmark.value, 22); assert.equal(by.bmi_g7_over.benchmark.judges, false); assert.equal(by.bmi_g7_over.guideline, null);
  assert.equal(by.wait_gyn_days.guideline, null); assert.equal(by.wait_gyn_days.benchmark, null);
  assert.equal(by.road_severe_100k.guideline.comparable, false);
  assert.ok(meta.indicators.every((i) => !("collect" in i)), "the collector settings stay inside");
  for (const i of meta.indicators) for (const g of [i.guideline, i.benchmark]) if (g) { assert.ok(g.source.url && g.source.publisher && g.source.title, i.id); assert.equal(g.gap, null, "no figure in the catalogue, so no gap"); assert.ok(meta.sources[g.source.id], i.id + ": the source is in meta.sources"); }
  assert.equal(meta.sources.moh_quality_report.role, "guideline");
  const model = JSON.parse(JSON.stringify(api.getModel("1031")));
  assert.equal(model.indicators.find((a) => a.id === "th_penta").guide.source.id, "moh_quality_report");
  const { resolve } = require("../src/agent/spec");
  const page = resolve({ title: "t", blocks: [{ type: "kpis", inds: ["th_penta"] }] }, store, api.getModel("1031"));
  assert.equal(page.blocks[0].items[0].guide.value, 90);
});
