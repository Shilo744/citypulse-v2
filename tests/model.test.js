"use strict";
// Consistency of the model, the action library and the evidence base. Runs against the built store (data/store/store.json).
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const fs = require("fs");
const cfg = require("../src/lib/config");
const { Store } = require("../src/model/store");
const { buildCityModel } = require("../src/model/city");
const { recommend, REC_RULES } = require("../src/model/recommend");
const interventions = require("../src/catalog/interventions");
const evidence = require("../src/catalog/evidence.json");
const { indicators, byId } = require("../src/catalog/indicators");
const domains = require("../src/catalog/domains");

const storeFile = path.join(cfg.STORE, "store.json");
const haveStore = fs.existsSync(storeFile);
const store = haveStore ? Store.load(storeFile) : null;
const RANK = { limited: 1, moderate: 2, strong: 3 };

test("action library: every evidence id and rule id resolves, and no entry claims more than its evidence", () => {
  const ids = new Set();
  for (const e of interventions) {
    assert.ok(!ids.has(e.id), "duplicate intervention id " + e.id); ids.add(e.id);
    for (const id of e.evidence || []) assert.ok(evidence.interventions[id], `${e.id}: unknown evidence ${id}`);
    for (const id of e.rules || []) assert.ok(evidence.rules[id], `${e.id}: unknown rule ${id}`);
    for (const ind of (e.applies.indicators || [])) assert.ok(byId[ind], `${e.id}: unknown indicator ${ind}`);
    for (const d of (e.applies.domains || [])) assert.ok(domains.find((x) => x.id === d), `${e.id}: unknown domain ${d}`);
    assert.ok(["quick", "mid", "long"].includes(e.horizon), e.id + " horizon");
    assert.ok(["low", "medium", "high"].includes(e.effort), e.id + " effort");
    assert.ok(e.actions.length >= 3, e.id + " needs concrete actions");
    // an entry may claim at most the strength of the strongest page it cites
    const best = Math.max(0, ...(e.evidence || []).map((id) => RANK[evidence.interventions[id].strength] || 0));
    if (e.evidenceStrength) assert.ok(RANK[e.evidenceStrength] <= best, `${e.id} claims ${e.evidenceStrength} but cites only ${best}`);
    // an entry with no cited page must say so rather than carry a strength label
    if (!(e.evidence || []).length) assert.strictEqual(e.evidenceStrength, null, e.id + " has a strength label but no evidence");
  }
});

test("evidence base: every cited page has a URL and a strength label", () => {
  for (const e of Object.values(evidence.interventions)) {
    assert.match(e.url, /^https?:\/\//, e.id);
    assert.ok(RANK[e.strength], e.id + " strength " + e.strength);
  }
  for (const r of Object.values(evidence.rules)) assert.ok(r.text && r.text.length > 20, r.id);
});

test("catalog: every tipat-halav indicator points at an evidence record; every indicator is fully described", () => {
  for (const ind of indicators) {
    if (ind.source === "moh_tipat_halav") assert.ok(ind.evidence && evidence.parameters[ind.evidence], ind.id + " has no evidence record");
    if (ind.evidence) assert.ok(evidence.parameters[ind.evidence], ind.id + " points at an unknown evidence record");
    assert.ok(ind.definition.length > 20 && ind.why.length > 20 && ind.caution.length > 20, ind.id + " texts");
    assert.ok(require("../src/catalog/sources")[ind.source], ind.id + " has an unknown source");
  }
});

test("store: report targets fill the years where the dataset field is missing", { skip: !haveStore }, () => {
  const t = store.data.indicators.th_mmrv;
  assert.strictEqual(t.target["2024"], 80);
  assert.strictEqual(t.targetSrc["2024"], "report");
  assert.strictEqual(t.target["2023"], 80);              // from the dataset itself
  assert.strictEqual(t.targetSrc["2023"], undefined);
});

test("model: findings, summaries and figures are clean for every locality, including level parameters", { skip: !haveStore }, () => {
  const { summarize } = require("../src/model/summary");
  const bad = /undefined|NaN|\[object|\{\w+\}|Infinity/;
  let checked = 0;
  for (const key of Object.keys(store.localities)) {
    if (store.coverage(key) < 4) continue;
    const m = buildCityModel(store, key); if (!m) continue;
    checked++;
    for (const a of m.indicators) {
      assert.ok(Number.isFinite(a.last.v), `${m.city.name} ${a.id}: value`);
      assert.ok(a.series.length >= 1 && a.series.every((x) => Number.isFinite(x.v)), `${m.city.name} ${a.id}: series`);
      if (a.last.rank != null) assert.ok(a.last.rank >= 1 && a.last.rank <= a.last.of, `${m.city.name} ${a.id}: rank ${a.last.rank}/${a.last.of}`);
      if (!a.direction) assert.strictEqual(a.status, "na", `${a.id}: descriptive parameters carry no status`);
    }
    for (const f of m.findings) assert.ok(!bad.test(f.text), `${m.city.name} ${f.id}: ${f.text}`);
    const s = summarize(m);
    if (s) for (const t of [s.headline, ...s.lines.map((l) => l.text)]) assert.ok(!bad.test(t), `${m.city.name} summary: ${t}`);
  }
  assert.ok(checked >= 150, "expected at least 150 localities, got " + checked);
});

test("recommendations: every locality with data gets clean, complete recommendations", { skip: !haveStore }, () => {
  const bad = /undefined|NaN|\[object|\{\w+\}|null/;
  let cities = 0, judgedCities = 0, withRecs = 0;
  for (const key of Object.keys(store.localities)) {
    if (store.coverage(key) < 4) continue;
    const m = buildCityModel(store, key); if (!m) continue;
    cities++;
    const recs = recommend(m, store);
    assert.ok(recs.length <= REC_RULES.maxRecs);
    const c = m.counts;
    if (c.strength + c.good + c.watch + c.concern >= 3) { judgedCities++; if (recs.length) withRecs++; }
    const seen = new Set();
    for (const r of recs) {
      assert.ok(!seen.has(r.id), "duplicate " + r.id); seen.add(r.id);
      const text = [r.title, r.summary, r.owner, r.caveat, r.evidenceNote, ...r.actions, ...r.why.map((w) => w.text), ...r.history.map((h) => h.text),
        ...r.kpis.flatMap((k) => [k.label, k.from, k.to, k.bench]), ...r.learnFrom.map((l) => l.value)].filter(Boolean).join(" | ");
      assert.ok(!bad.test(text), `${m.city.name} ${r.id}: bad text -> ${(text.match(bad) || [])[0]}`);
      assert.ok(r.score >= 0 && r.score <= 100, "score " + r.score);
      assert.ok(r.indicators.length >= 1 || r.id.startsWith("rec:domain_review"), r.id + " has no parameters");
      for (const k of r.kpis) {
        assert.ok(k.byYear > k.year, "kpi years");
        const a = m.indicators.find((x) => x.id === k.indicator), sgn = a.direction === "lower" ? -1 : 1, n = (v) => parseFloat(String(v).replace(/[^\d.\-]/g, ""));
        assert.ok((n(k.to) - n(k.from)) * sgn > 0, `${m.city.name} ${r.id} ${k.label}: ${k.from} -> ${k.to}`);
        assert.ok(n(k.to) - n(k.from) <= REC_RULES.kpiStepMax + 0.11, `${m.city.name} ${r.id}: step too large`);
        if (a.unit === "%") assert.ok(n(k.to) <= 100 && n(k.from) >= 0, `${m.city.name} ${r.id}: percent out of range ${k.from} -> ${k.to}`);
      }
      assert.ok(r.owner && r.actions.length && r.why.length, `${m.city.name} ${r.id}: owner, actions and reasons are required`);
      for (const e of r.evidence) assert.match(e.url, /^https?:\/\//);
    }
    for (let i = 1; i < recs.length; i++) assert.ok(recs[i - 1].score >= recs[i].score, "not sorted");
  }
  assert.ok(cities >= 150, "expected at least 150 localities with data, got " + cities);
  assert.ok(judgedCities >= 100, "expected at least 100 localities with three judged parameters, got " + judgedCities);
  assert.ok(withRecs / judgedCities > 0.9, "nearly every locality with three judged parameters should get at least one recommendation");
});

test("recommendations: numbers in kpis move in the good direction and never pass the benchmark", { skip: !haveStore }, () => {
  for (const key of ["1031", "3000", "5000", "6100"]) {
    const m = buildCityModel(store, key); if (!m) continue;
    for (const r of recommend(m, store)) for (const k of r.kpis) {
      const num = (s) => parseFloat(String(s).replace(/[^\d.\-]/g, ""));
      const a = m.indicators.find((x) => x.id === k.indicator);
      const s = a.direction === "lower" ? -1 : 1;
      assert.ok((num(k.to) - num(k.from)) * s > 0, `${m.city.name} ${r.id} ${k.label}: ${k.from} -> ${k.to}`);
      assert.ok(num(k.to) - num(k.from) <= REC_RULES.kpiStepMax + 0.11, `${m.city.name} ${r.id}: step too large`);
    }
  }
});

test("every concern or watch carries the reasons that decided it, and nothing else does", { skip: !haveStore }, () => {
  const api = require("../src/api");
  let judged = 0;
  for (const key of ["9000", "8600", "5000", "4000", "3000", "1031", "1161"]) {
    const m = api.getModel(key); if (!m) continue;
    for (const a of m.indicators) {
      const why = a.statusWhy || [];
      if (a.status === "concern" || a.status === "watch") { judged++; assert.ok(why.length > 0, `${key}/${a.id}: ${a.status} without a reason`); assert.ok(why.every((w) => ["rank", "target", "worsening"].includes(w)), `${key}/${a.id}: unknown reason`); }
      else assert.deepEqual(why, [], `${key}/${a.id}: ${a.status} should carry no reasons`);
      if (why.includes("target")) { assert.ok(a.last.gapTarget != null && a.last.gapTarget < 0, `${key}/${a.id}: a target reason needs a shortfall`); assert.ok(a.guide && a.guide.judges && a.guide.gap < 0, `${key}/${a.id}: only an official target that judges can be the reason`); }
    }
  }
  assert.ok(judged > 10);
});

test("the neighbour list on an indicator page gives the city the same place as the headline rank (ties share a place)", { skip: !haveStore }, () => {
  const api = require("../src/api");
  let checked = 0;
  for (const key of ["9000", "8600", "5000"]) {
    const m = api.getModel(key); if (!m) continue;
    for (const a of m.indicators.filter((x) => x.last.rank != null && x.direction).slice(0, 12)) {
      const d = api.indicatorDetail(key, a.id), self = d && d.neighbours.find((n) => n.self);
      if (self) { assert.equal(self.rank, a.last.rank, `${key}/${a.id}`); checked++; }
    }
  }
  assert.ok(checked > 10);
});

test("a figure on too few cases drives no conclusion: no priority, no trend, no finding but the note, no recommendation", { skip: !haveStore }, () => {
  let small = 0;
  for (const key of Object.keys(store.localities)) {
    if (store.coverage(key) < 4) continue;
    const m = buildCityModel(store, key); if (!m) continue;
    const recs = recommend(m, store);
    for (const a of m.indicators.filter((x) => !x.last.reliable)) {
      small++;
      assert.equal(a.priority, 0, `${key}/${a.id}: priority`);
      assert.equal(a.history.trendClass, "unknown", `${key}/${a.id}: trend`);
      assert.equal(a.history.delta, null, `${key}/${a.id}: delta`);
      assert.ok(!m.priorities.includes(a.id), `${key}/${a.id}: listed as a priority`);
      for (const f of m.findings.filter((x) => x.indicator === a.id)) assert.equal(f.type, "small_numbers", `${key}/${f.id}`);
      for (const r of recs) {
        assert.ok(!r.indicators.includes(a.id), `${key}: ${r.id} rests on the small-group figure ${a.id}`);
        assert.ok(r.why.every((w) => w.indicator !== a.id), `${key}: ${r.id} cites the small-group figure ${a.id}`);
      }
    }
  }
  assert.ok(small > 100, "expected many small-group figures, got " + small);
});
