"use strict";
// The evidence framework (research/evidence-framework.json -> src/catalog/evidence.json, shown in the method page's table)
// must not keep a target that the verified research (research/guidelines.json) rejected or that a newer source replaced.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const evidence = require("../src/catalog/evidence.json");
const { indicators } = require("../src/catalog/indicators");
const root = path.join(__dirname, "..");
const research = JSON.parse(fs.readFileSync(path.join(root, "research", "guidelines.json"), "utf8"));
const framework = JSON.parse(fs.readFileSync(path.join(root, "research", "evidence-framework.json"), "utf8"));

const params = Object.values(evidence.parameters);
const linked = (p) => indicators.filter((i) => i.evidence === p.id);
const host = (u) => { try { return new URL(u).hostname; } catch (e) { return ""; } };

test("evidence file is built from the research file (nothing was edited by hand in the generated file)", () => {
  for (const p of framework.parameters) {
    const q = evidence.parameters[p.id];
    assert.ok(q, p.id);
    assert.equal(q.target && q.target.kind, p.target.kind, p.id + " kind");
    assert.equal(q.target && q.target.value, p.target.value, p.id + " value");
  }
});

test("an official target is a target of an Israeli authority, on a page of its own, with a source", () => {
  for (const p of params) {
    const t = p.target; if (!t || t.kind !== "official") continue;
    assert.ok(t.value != null && t.source_url, p.id + " official target needs a value and a url");
    assert.match(host(t.source_url), /(^|\.)(gov\.il)$/, p.id + ": an official target must come from an Israeli government site, not " + t.source_url);
    assert.doesNotMatch(t.source_url, /mevaker/, p.id + ": the State Comptroller reports a plan, it does not set the target");
  }
});

test("an official target equals the verified one of the same indicator (value, and the 2024 value by year)", () => {
  let n = 0;
  for (const p of params) {
    if (!p.target || p.target.kind !== "official") continue;
    for (const ind of linked(p)) {
      const g = ind.guideline; if (!g) continue;
      const ref = research.references.find((r) => r.indicator === ind.id && r.kind === "official_target");
      assert.ok(ref, ind.id + " has a catalogue guideline but no verified reference");
      if (ref.unit === "pct_reduction") assert.equal(Math.abs(p.target.value), ref.value, ind.id + " relative cut");
      else assert.equal(p.target.value, ref.value, ind.id + " target");
      if (p.target.by_year && /^\d{4}$/.test(ref.year) && p.target.by_year[ref.year] != null) assert.equal(p.target.by_year[ref.year], ref.value, ind.id + " by year " + ref.year);
      n++;
    }
  }
  assert.ok(n >= 14, "checked " + n);
});

test("no rejected reference is carried as a target of the framework", () => {
  for (const r of research.rejected) {
    for (const p of params) {
      if (!linked(p).some((i) => i.id === r.indicator)) continue;
      const t = p.target || {};
      assert.ok(!(t.kind !== "none" && t.source_url === r.url), `${p.id}: ${r.indicator} reference ${r.url} was rejected (${r.verifierNote || "see research/guidelines.json"})`);
    }
  }
});

test("the superseded 2021 road-safety goal ('50 to 30', minus 50) is not a target any more, in the table or in the text", () => {
  for (const id of ["road_deaths_per_100k", "road_severe_injuries_per_100k"]) {
    const t = evidence.parameters[id].target;
    assert.notEqual(t.value, -50, id);
    assert.doesNotMatch(String(t.source_url || ""), /mevaker/, id);
  }
  const sev = evidence.parameters.road_severe_injuries_per_100k;
  const ref = research.references.find((r) => r.indicator === "road_severe_100k" && r.kind === "official_target");
  assert.equal(sev.target.value, -ref.value);
  assert.equal(sev.target.source_url, ref.url);
  assert.equal(evidence.parameters.road_deaths_per_100k.target.kind, "none", "the verified 2030 figure is a national count of deaths, not a rate");
  const text = [sev.why, ...Object.values(evidence.interventions).map((i) => i.description)].join(" ");
  assert.doesNotMatch(text, /היעד הלאומי ״50 עד 30״/, "the old goal is not called the national goal");
  for (const iv of Object.values(evidence.interventions).filter((i) => /50 עד 30/.test(i.description || ""))) assert.match(iv.description, /2026-2030/, iv.id + " must say the plan was followed by a newer one");
});

test("school obesity: no US obesity-only target next to the Israeli overweight-plus-obesity indicators", () => {
  const t = evidence.parameters.school_obesity.target;
  assert.equal(t.kind, "none");
  assert.equal(t.value, null);
  assert.match(evidence.parameters.school_obesity.definition, /עודף משקל/);
});

test("a reference figure of another body or country is orientation only: kind international, never an Israeli government page", () => {
  for (const p of params) {
    const t = p.target; if (!t || t.kind !== "international") continue;
    assert.ok(t.value != null && t.source_url, p.id);
    assert.doesNotMatch(host(t.source_url), /gov\.il$/, p.id);
    assert.match(t.note || "", /נקודת ייחוס|ערך הנחיה|זה ערך הנחיה/, p.id + " must say it is a reference only");
  }
  assert.ok(evidence.rules.international_benchmark_not_target.text.length > 40);
});

test("the research file records every change of this check in its own change notes", () => {
  const notes = (framework.meta.change_notes || []).join("\n");
  for (const id of ["road_severe_injuries_per_100k", "road_deaths_per_100k", "school_obesity", "infant_mortality_rate", "exclusive_breastfeeding_4m"]) assert.ok(notes.includes(id), id + " missing from meta.change_notes");
});

// ── the 16 reading rules, written for a reader (the page of a recommendation and the model's notes carry them) ──
const RULE_IDS = ["small_numbers", "ecological_fallacy", "sector_differences", "haredi_not_separable", "timeliness_vs_final_coverage", "denominator_and_location", "definition_changes", "target_zero_means_missing", "ranking_pitfalls", "regression_to_the_mean", "war_2023_2024", "international_benchmark_not_target", "provider_responsibility", "unknown_socioeconomic_group", "multiple_comparisons", "age_structure"];
const NEVER_SOURCED = ["small_numbers", "unknown_socioeconomic_group", "multiple_comparisons", "age_structure"];
// the numbers that stood in the builders' text of each rule (the reader text may keep these and add no other)
const OLD_NUMBERS = {
  sector_differences: ["2024"], timeliness_vs_final_coverage: ["12", "13", "19", "90", "66"], definition_changes: ["2021", "2024", "75", "80"], target_zero_means_missing: ["0", "2024"],
  war_2023_2024: ["2023", "2024", "1", "2"], international_benchmark_not_target: ["2030", "45", "75"]
};

test("the 16 reading rules are plain sentences for a reader: no town, no order to the builders, no field name, no English but the names of sources", () => {
  assert.deepEqual(Object.keys(evidence.rules).sort(), [...RULE_IDS].sort(), "the same 16 rules (the method page counts them)");
  const SOURCE_NAMES = /County Health Rankings|Healthy People 2030/g;
  for (const r of Object.values(evidence.rules)) {
    const t = r.text;
    assert.ok(t.length > 60 && t.length < 520, `${r.id}: length ${t.length}`);
    const sentences = t.split(/(?<=\.)\s+/).filter(Boolean);
    assert.ok(sentences.length >= 1 && sentences.length <= 2, `${r.id}: one or two sentences, found ${sentences.length}`);
    assert.doesNotMatch(t, /שדרות|אילת|נצרת|בני ברק|תל אביב|ירושלים|מכבי/, r.id + ": no town or fund by name");
    assert.doesNotMatch(t, /לא למחוק|יש לבדוק|אין להציג|לסמן דגל|לבדוק את|לקבוע סף|לאחד שלוש|להציג רווח|להציג למנהל|\(n\)|n נמוך|כלל מתודולוגי|ללא מקור|שדה target|station_city|Socio Economic|funnel/, r.id + ": no instruction to the builders, no field name");
    assert.doesNotMatch(t, /רגרסיה|אקולוגי|מכנה|רווח סמך|מובהק|אחוזון|מודל|פרמטר/, r.id + ": no statistician's word");
    assert.doesNotMatch(t.replace(SOURCE_NAMES, ""), /[A-Za-z]/, r.id + ": Latin letters only in the name of a source");
    assert.doesNotMatch(t, /אנחנו|שלנו|עיריי|העיר|בעיר/, r.id + ": third person, a place is a יישוב");
    assert.doesNotMatch(t, /יעד בין־לאומי|יעד בינלאומי|יעד בין-לאומי|התכנית/, r.id + ": the words of the catalogue");
    const allowed = OLD_NUMBERS[r.id] || [];
    for (const n of t.match(/\d+/g) || []) assert.ok(allowed.includes(n), `${r.id}: the number ${n} was not in the original rule`);
  }
});

test("the reading rules keep their sources, and the four that never had one still have none and still speak with care", () => {
  for (const r of framework.interpretation_rules) {
    const e = evidence.rules[r.id];
    assert.equal(e.url, r.source_url || null, r.id + " url");
    if (NEVER_SOURCED.includes(r.id)) {
      assert.equal(e.url, null, r.id + " has no source and none is invented");
      assert.match(e.text, /ייתכן|לעיתים|כדאי|עדיף|עלול|יכול/, r.id + " stays cautious");
    }
  }
  assert.match(evidence.rules.international_benchmark_not_target.text, /נקודת ייחוס בין-לאומית אינה יעד רשמי/, "a foreign figure is a נקודת ייחוס, and an official target is a יעד רשמי");
  assert.match(evidence.rules.provider_responsibility.text, /^היעדים הרשמיים של משרד הבריאות/);
  assert.match(evidence.rules.target_zero_means_missing.text, /התוכנית הלאומית למדדי איכות/);
});

test("the framework prose names HP2030, CPSTF and the BMI measure in words (the research files say what they are)", () => {
  const all = [];
  const collect = (o) => { if (typeof o === "string") all.push(o); else if (o && typeof o === "object") Object.values(o).forEach(collect); };
  collect(evidence);
  for (const s of all) {
    assert.doesNotMatch(s, /HP2030/, "HP2030 is written as Healthy People 2030: " + s.slice(0, 60));
    assert.doesNotMatch(s, /אחוזוני/, "no percentile word: " + s.slice(0, 60));
    const i = s.indexOf("CPSTF");
    if (i >= 0) assert.ok(/צוות השירותים המונעים/.test(s.slice(0, i + 8)), "CPSTF follows the Hebrew name of the body: " + s.slice(0, 80));
  }
  assert.match(evidence.parameters.school_obesity.definition, /מדד מסת הגוף \(BMI\)/);
  assert.match(evidence.parameters.mammography_screening.why, /צוות השירותים המונעים האמריקאי \(CPSTF\)/);
  assert.match(indicators.find((i) => /אחוז התלמידים בכיתה א׳/.test(i.definition || "")).definition, /מדד מסת הגוף \(BMI\)/);
});

test("src/catalog/evidence.json is exactly what the builder makes of the research file (regeneration changes nothing but the date)", () => {
  const os = require("os");
  const tmp = path.join(os.tmpdir(), "cp2-evidence-" + process.pid + ".json");
  const log = console.log; console.log = () => {};
  try { require("../src/collect/build_evidence").main(tmp); } finally { console.log = log; }
  try {
    const made = JSON.parse(fs.readFileSync(tmp, "utf8")), committed = JSON.parse(fs.readFileSync(path.join(root, "src", "catalog", "evidence.json"), "utf8"));
    delete made.generated; delete committed.generated;
    assert.deepEqual(made, committed, "evidence.json is stale or was edited by hand: run npm run evidence");
  } finally { try { fs.unlinkSync(tmp); } catch (e) { /* gone */ } }
});

test("the catalogue names the programme and the official target in the owner's words", () => {
  const sources = require("../src/catalog/sources");
  assert.equal(sources.moh_tipat_halav.name, "התוכנית הלאומית למדדי איכות: טיפות חלב");
  const judging = indicators.filter((i) => i.guideline && i.guideline.judges);
  assert.ok(judging.length >= 13, "the 13 program targets: " + judging.length);
  for (const i of judging) assert.match(i.guideline.caveat, /^יעד רשמי של משרד הבריאות לנותני שירות בתוכנית הלאומית למדדי איכות/, i.id);
  assert.ok(!research.references.some((r) => /התכנית הלאומית/.test(r.title || "")), "research/guidelines.json titles say התוכנית");
});
