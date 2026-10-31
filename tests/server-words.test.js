"use strict";
// Server-made texts: one population per town on every screen, and no "city" / "municipality" for a place that is not one.
// Runs against the built store (data/store/store.json) with the in-process API functions.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const cfg = require("../src/lib/config");

const haveStore = fs.existsSync(path.join(cfg.STORE, "store.json"));
const skip = haveStore ? false : "no built store";
const { getStore, getModel } = require("../src/api");

test("one population per town: the search list shows the number of the page head", { skip }, () => {
  const st = getStore();
  const keys = [...new Set(st.search("", 100000).map((r) => r.key))];
  assert.ok(keys.length > 100, "the search index has the localities");
  const step = Math.floor(keys.length / 30);
  const sample = Array.from({ length: 30 }, (_, i) => keys[i * step]);
  let checked = 0;
  for (const key of ["1031", ...sample]) {
    const m = getModel(key);
    if (!m) continue;
    const row = st.search(st.name(key), 1000).find((r) => r.key === key);
    assert.ok(row, "found in the search: " + key);
    if (m.city.population != null) { assert.equal(row.pop, m.city.population, `${key} ${st.name(key)}: search ${row.pop} vs page head ${m.city.population}`); checked++; }
  }
  assert.ok(checked >= 25, "at least 25 of the 31 towns have a page-head population, got " + checked);
  // Sderot: the master file says 37,239, the CBS series 36,061 at the end of its last year; both screens show the series
  assert.equal(st.search("שדרות", 5).find((r) => r.key === "1031").pop, getModel("1031").city.population);
});

test("the list order and the type-ahead use the same number (no town without a master population loses its place)", { skip }, () => {
  const st = getStore();
  const top = st.search("", 12);
  assert.equal(top.length, 12);
  for (let i = 1; i < top.length; i++) assert.ok(top[i - 1].pop >= top[i].pop, "sorted by the shown population");
});

const BAD = /עיריי|העיר(?![א-ת])|בעיר(?![א-ת])/;
function textsOf(m) {
  const recs = m.recommendations || [];
  const out = [];
  for (const r of recs) out.push(r.title, r.summary, r.owner, r.caveat, r.evidenceNote, ...r.actions, ...r.why.map((w) => w.text), ...r.notes.map((n) => n.text), ...r.evidence.map((e) => e.description), ...r.history.map((h) => h.text));
  for (const f of m.findings) out.push(f.text);
  if (m.summary) out.push(JSON.stringify(m.summary));
  return out.filter(Boolean);
}

test("no recommendation, finding, summary or briefing prompt calls a local council or a regional-council locality a city or a municipality", { skip }, () => {
  const st = getStore();
  const { SYSTEM, catalog } = require("../src/agent/briefing");
  const { FIGURE_RULES } = require("../src/agent/rules");
  const byStatus = (mtype) => Object.keys(st.localities).filter((k) => st.localities[k].mtype === mtype && st.coverage(k) >= 8);
  const locals = byStatus("local_council"), regionals = byStatus("regional_council");
  assert.ok(locals.length >= 10 && regionals.length >= 10, "the store has both kinds of town");
  let recs = 0, seen = 0;
  for (const key of ["472", "99", ...locals.slice(0, 25), ...regionals.slice(0, 25)]) {
    const m = getModel(key);
    if (!m) continue;
    seen++;
    recs += (m.recommendations || []).length;
    const prompt = catalog(m);
    for (const t of [...textsOf(m), prompt]) assert.ok(!BAD.test(t), `${key} ${m.city.name}: «${(t.match(new RegExp(".{0,30}" + BAD.source + ".{0,20}")) || [t])[0]}»`);
  }
  assert.ok(seen >= 30 && recs >= 60, `enough texts were checked (${seen} towns, ${recs} recommendations)`);
  // the fixed prompts tell the writer the same
  assert.match(FIGURE_RULES, /היישוב/);
  assert.ok(SYSTEM.includes(FIGURE_RULES));
});

test("the library of actions and the evidence notes carry no 'city' for a place in general", () => {
  const interventions = require("../src/catalog/interventions");
  const evidence = require("../src/catalog/evidence.json");
  const own = JSON.stringify(interventions);
  assert.ok(!BAD.test(own), "interventions: " + (own.match(new RegExp(".{0,30}" + BAD.source + ".{0,20}")) || [])[0]);
  for (const id of ["denominator_and_location", "provider_responsibility", "age_structure"]) assert.ok(!BAD.test(evidence.rules[id].text), "rule " + id);
  for (const i of Object.values(evidence.interventions)) assert.ok(!BAD.test(i.description || ""), "evidence " + i.id);
});
