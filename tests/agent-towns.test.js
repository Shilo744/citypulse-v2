"use strict";
/**
 * The ask-agent and other localities (src/agent/towns.js, spec.js, fallback.js, guard.js, ask.js).
 * A question asked on the page of one locality names others ("השוואה בין שדרות אשקלון ובאר שבע"): the localities are found by name in code, the page is their
 * comparison with this one, and the sentence that leads it is written by the server from the counts of the block, never by a model.
 *
 * No network and no real key anywhere in this file: the key is blanked at the top, a model is a stub of src/lib/llm.js (_setRequest), and https/http to anything
 * but this machine throws.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const https = require("https");

const cfg = require("../src/lib/config");
cfg.llm.key = "";                                           // the owner's key never reaches this file

const realHttp = http.request, realHttps = https.request;
https.request = () => { throw new Error("no network in this test"); };
http.request = (u, ...rest) => {
  const host = typeof u === "string" ? new URL(u).hostname : u && (u.hostname || u.host);
  if (host !== "127.0.0.1" && host !== "localhost") throw new Error("no network in this test: " + host);
  return realHttp.call(http, u, ...rest);
};
test.after(() => { https.request = realHttps; http.request = realHttp; cfg.llm.key = ""; });

const llm = require("../src/lib/llm");
const { byId } = require("../src/catalog/indicators");
const { I } = require("../src/lib/format");
const guard = require("../src/agent/guard");
const towns = require("../src/agent/towns");
const fallback = require("../src/agent/fallback");
const { resolve } = require("../src/agent/spec");
const ask = require("../src/agent/ask");
const { FIGURE_RULES } = require("../src/agent/rules");

const storeFile = path.join(cfg.STORE, "store.json");
const haveStore = fs.existsSync(storeFile);
const OWNER_Q = "אני רוצה שתעשה לי השוואה בין הערים שדרות אשקלון ובאר שבע לראות מי מנצח ובמה";
const OWNER_FALSE = "המערכת מציגה נתונים על שדרות בלבד, ואין בה כרגע השוואה ישירה מול אשקלון ובאר שבע. אפשר לראות איפה שדרות עומדת מול יישובים דומים, מול הממוצע הארצי ומול היעדים. לדוגמה, בחיסון MMR/MMRV שדרות נמוכה.";

// ── a small store and its models, for the cases that need a small group, a tie, a different year ───────────────────────────────────────────────────────────
const NAMES = {
  "1031": "שדרות", "7100": "אשקלון", "9000": "באר שבע", "5000": "תל אביב-יפו", "2800": "קריית שמונה", "6400": "הרצלייה", "70": "אשדוד", "3000": "ירושלים", "4000": "חיפה", "7400": "נתניה",
  "56": "כנרת (קבוצה)", "57": "כנרת (מושבה)", "8": "יעד", "14": "גזר", "98": "שבע", "21": "אבו עמרה (שבט)", "1061": "נוף הגליל", "1200": "מודיעין-מכבים-רעות", "3797": "מודיעין עילית",
  "55": "כפר קטן", "8900": "טמרה", "547": "טמרה (יזרעאל)", "6": "בית שאן"
};
function rows(...triples) { const o = {}; for (const [k, y, v, d] of triples) { (o[k] = o[k] || {})[y] = { v, d }; } return o; }
const DATA = {
  th_mmrv: { years: [2023, 2024], nat: { 2024: { v: 90 } }, loc: rows(["1031", 2024, 60, 400], ["7100", 2024, 80, 900], ["9000", 2023, 70, 1200], ["55", 2024, 99, 20], ["5000", 2024, 85, 5000]) },
  th_penta: { years: [2024], nat: { 2024: { v: 80 } }, loc: rows(["1031", 2024, 70, 500], ["7100", 2024, 70, 800], ["9000", 2024, 60, 900], ["5000", 2024, 75, 4000]) },
  life_expectancy: { years: [2024], nat: { 2024: { v: 82.5 } }, loc: rows(["1031", 2024, 82, null], ["7100", 2024, 83, null], ["9000", 2024, 83.5, null], ["5000", 2024, 84, null]) },
  wait_specialist_days: { years: [2025], nat: null, loc: rows(["1031", 2025, 40, null], ["7100", 2025, 30, null], ["9000", 2025, 50, null], ["5000", 2025, 35, null]) },
  th_pertussis: { years: [2024], nat: { 2024: { v: 90 } }, loc: rows(["1031", 2024, 95, 300], ["7100", 2024, 91, 40], ["5000", 2024, 92, 40]) },
  // a figure that the open locality (1031) does not have, so that it never becomes a row: it only gives the other places in NAMES a figure, as the store does
  pediatricians_10k: { years: [2025], nat: null, loc: rows(...Object.keys(NAMES).filter((k) => k !== "1031" && k !== "21").map((k) => [k, 2025, 3, null])) }
};
function makeStore(names = NAMES, data = DATA) {
  const localities = {}; for (const [k, n] of Object.entries(names)) localities[k] = { key: k, name_he: n };
  const have = new Set(); for (const ind of Object.values(data)) for (const k of Object.keys(ind.loc)) have.add(k);
  return {
    localities, builtAt: "stub",
    hasLocality: (k) => Object.hasOwn(localities, k), name: (k) => (localities[k] ? localities[k].name_he : k),
    search: () => [...have].map((key) => ({ key, name: localities[key].name_he, pop: 1 })),
    years: (id) => (data[id] || {}).years || [], nat: (id, y) => ((data[id] || {}).nat || {})[y] || null,
    cityYears: (id, k) => { const l = data[id] && data[id].loc[k]; return l ? Object.keys(l).map(Number).sort() : []; },
    cell: (id, k, y) => { const l = data[id] && data[id].loc[k]; return (l && l[y]) || null; }
  };
}
function makeModels(store, data = DATA) {
  const cache = new Map();
  return (key) => {
    if (!store.hasLocality(key)) return null;
    if (cache.has(key)) return cache.get(key);
    const indicators = Object.keys(data).filter((id) => data[id].loc[key]).map((id) => {
      const ind = byId[id], ys = store.cityYears(id, key), y = ys[ys.length - 1], c = store.cell(id, key, y);
      return { id, label: ind.label, short: ind.short, unit: ind.unit, direction: ind.direction, domain: ind.domain, stale: false, status: "watch", last: { v: c.v, year: y, d: c.d, reliable: true } };
    });
    const m = indicators.length ? { city: { key, name: store.name(key), population: 1000 }, counts: { concern: 1, watch: indicators.length, good: 1, strength: 0 }, indicators } : null;
    cache.set(key, m);
    return m;
  };
}
const stubStore = makeStore(), stubModel = makeModels(stubStore);
const stubCtx = (key) => ({ store: stubStore, model: stubModel(key), getModel: stubModel });
const keysOf = (f) => f.towns.map((t) => t.key);

// ── 1. finding the localities a question names ─────────────────────────────────────────────────────────────────────────────────────────────────────────
test("towns: the owner's sentence names אשקלון and באר שבע; שדרות, the open locality, is left out", () => {
  const f = towns.findTowns(stubStore, OWNER_Q, "1031");
  assert.deepEqual(keysOf(f), ["7100", "9000"]);
  assert.equal(f.cue, true, "it asks for a comparison in so many words");
  assert.deepEqual(f.ambiguous, []);
});

test("towns: Hebrew prefixes in front of a name (ב ל מ ו ש and their combinations); the article ה is not one", () => {
  const one = (q) => keysOf(towns.findTowns(stubStore, q, "1031"));
  assert.deepEqual(one("מה קורה באשקלון"), ["7100"]);
  assert.deepEqual(one("השוואה לאשקלון"), ["7100"]);
  assert.deepEqual(one("מרחוק מאשקלון"), ["7100"]);
  assert.deepEqual(one("מאשקלון ועד לבאר שבע"), ["7100", "9000"]);
  assert.deepEqual(one("ומאשדוד"), ["70"], "ו + מ + name");
  assert.deepEqual(one("מה שבאשדוד"), ["70"], "ש + ב + name");
  assert.deepEqual(one("ובבאר שבע"), ["9000"], "ו + ב + a name of two words");
  assert.deepEqual(one("השוואה לירושלים, לחיפה ולנתניה"), ["3000", "4000", "7400"]);
  assert.deepEqual(one("הגזר כתום"), [], "ה + גזר is the carrot, not the council of Gezer");
  assert.deepEqual(one("מגזר ערבי"), [], "מ + גזר is a sector");
});

test("towns: names of several words, hyphens, the spellings the store knows, colloquial names", () => {
  const one = (q) => keysOf(towns.findTowns(stubStore, q, "1031"));
  assert.deepEqual(one("בבאר שבע"), ["9000"]);
  assert.deepEqual(one("באר-שבע"), ["9000"], "a hyphen is a space");
  assert.deepEqual(one("תל אביב"), ["5000"], "the first part of תל אביב-יפו");
  assert.deepEqual(one("בתל-אביב יפו"), ["5000"]);
  assert.deepEqual(one("לתל אביב - יפו"), ["5000"]);
  assert.deepEqual(one("קרית שמונה"), ["2800"], "קרית = קריית");
  assert.deepEqual(one("הרצליה"), ["6400"], "the store spells it הרצלייה");
  assert.deepEqual(one("הרצלייה"), ["6400"]);
  assert.deepEqual(one("נצרת עילית"), ["1061"], "the colloquial name of נוף הגליל");
  assert.deepEqual(one("מודיעין"), ["1200"], "the colloquial name of the big one; מודיעין עילית is written whole");
  assert.deepEqual(one("מודיעין עילית"), ["3797"]);
  assert.deepEqual(one('בת"א'), ["5000"], "an abbreviation only with its quote mark");
  assert.deepEqual(one("תא"), [], "תא is a cell");
});

test("towns: the longest name wins and no word is used twice", () => {
  const st = makeStore({ ...NAMES, "9001": "באר" });
  assert.deepEqual(keysOf(towns.findTowns(st, "לבאר שבע", "1031")), ["9000"], "באר שבע, not באר and not שבע");
  assert.deepEqual(keysOf(towns.findTowns(st, "ל" + "שבע", "1031")), ["98"]);
  assert.deepEqual(keysOf(towns.findTowns(st, "בין תל אביב יפו ובאר שבע", "1031")), ["5000", "9000"]);
});

test("towns: a question with no town, and the open locality alone, name no other", () => {
  assert.deepEqual(keysOf(towns.findTowns(stubStore, "מה המצב של הילדים בחיסונים?", "1031")), []);
  const f = towns.findTowns(stubStore, "איפה שדרות הכי חלשה", "1031");
  assert.deepEqual(f.towns, []);
  assert.equal(towns.blockSpec(f, null), null, "nothing to compare");
});

test("towns: at most four other localities; the rest are named in the answer as left out", () => {
  const f = towns.findTowns(stubStore, "השוואה בין שדרות לאשקלון, באר שבע, תל אביב, ירושלים, חיפה ונתניה", "1031");
  assert.equal(f.towns.length, 4);
  assert.deepEqual(f.ignored.map((x) => x.key), ["4000", "7400"], "the first four named are compared, the last two are left out");
  const b = towns.buildBlock(towns.blockSpec(f, null), stubCtx("1031"));
  assert.equal(b.towns.length, 5, "the open locality and four more: what the compare page takes");
  assert.match(b.lead, /אפשר להשוות עד חמישה יישובים בבת אחת\. מחוץ להשוואה: חיפה ונתניה\./);
  assert.equal(b.ignored.length, 2);
});

test("towns: a name that fits several localities is not guessed; the whole official name is", () => {
  const f = towns.findTowns(stubStore, "מה בכנרת", "1031");
  assert.deepEqual(f.towns, []);
  assert.equal(f.ambiguous.length, 1);
  assert.equal(f.ambiguous[0].text, "כנרת");
  assert.deepEqual(f.ambiguous[0].options.map((o) => o.key).sort(), ["56", "57"]);
  assert.deepEqual(keysOf(towns.findTowns(stubStore, "בכנרת (קבוצה)", "1031")), ["56"]);
  assert.deepEqual(keysOf(towns.findTowns(stubStore, "טמרה", "1031")), ["8900"], "the one without a qualifier is the whole name");
  assert.deepEqual(keysOf(towns.findTowns(stubStore, "טמרה (יזרעאל)", "1031")), ["547"]);
  const s = towns.unresolvedSentence(f, "שדרות");
  assert.match(s, /השם ״כנרת״ מתאים לכמה יישובים \(כנרת \(קבוצה\), כנרת \(מושבה\)\), ולכן לא ברור עם מי להשוות את שדרות/);
});

test("towns: a word of everyday Hebrew that is also a name is taken for a locality only after a word like יישוב or קיבוץ", () => {
  assert.deepEqual(keysOf(towns.findTowns(stubStore, "איפה אנחנו ביחס ליעד?", "1031")), []);
  assert.deepEqual(keysOf(towns.findTowns(stubStore, "השוואה בין שדרות ליעד", "1031")), [], "a bare יעד is the target");
  assert.deepEqual(keysOf(towns.findTowns(stubStore, "השוואה בין שדרות ליישוב יעד", "1031")), ["8"]);
  assert.deepEqual(keysOf(towns.findTowns(stubStore, "ומה בקיבוץ גזר", "1031")), ["14"]);
});

test("towns: a place the store lists but holds no figure for is reported, not compared", () => {
  const f = towns.findTowns(stubStore, "השוואה לאבו עמרה (שבט)", "1031");
  assert.deepEqual(f.towns, []);
  assert.deepEqual(f.noData.map((x) => x.key), ["21"]);
  assert.match(towns.unresolvedSentence(f, "שדרות"), /אין במערכת נתונים על אבו עמרה \(שבט\)/);
});

test("towns: ONE other locality named with no word of comparison is still a comparison, in its own mode", () => {
  const f = towns.findTowns(stubStore, "איך המצב באשקלון?", "1031");
  assert.deepEqual(keysOf(f), ["7100"]);
  assert.equal(f.cue, false);
  assert.equal(towns.blockSpec(f, null).mode, "single");
  assert.equal(towns.blockSpec(towns.findTowns(stubStore, "השוואה לאשקלון", "1031"), null).mode, "named");
});

// ── 2. every locality of the real store ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("towns: 'השוואה בין שדרות ל' + the name of EVERY locality of the store resolves to it, or is reported (no data, a name shared by two places, an everyday word)", { skip: !haveStore }, () => {
  const { Store } = require("../src/model/store");
  const st = Store.load(storeFile);
  const have = new Set(st.search("", 1e6).map((r) => r.key));
  const loose = (k) => towns.loose(String(st.name(k)).replace(/\([^)]*\)/g, " "));
  const tally = { resolved: 0, noData: 0, ambiguous: 0, everyday: 0 }, problems = [];
  for (const k of Object.keys(st.localities)) {
    if (k === "1031") continue;
    const name = st.name(k);
    let f = towns.findTowns(st, "השוואה בין שדרות ל" + name, "1031");
    if (f.towns.length === 1 && f.towns[0].key === k) { tally.resolved++; continue; }
    if (!have.has(k) && f.noData.some((x) => x.key === k)) { tally.noData++; continue; }
    if (f.ambiguous.some((a) => a.options.some((o) => o.key === k))) {
      const shared = Object.keys(st.localities).filter((j) => j !== k && loose(j) === loose(k)).length;
      if (shared >= 1) { tally.ambiguous++; continue; }
    }
    f = towns.findTowns(st, "השוואה בין שדרות ליישוב " + name, "1031");                           // an everyday word: with the word that says it is a locality
    if ((f.towns.length === 1 && f.towns[0].key === k) || (!have.has(k) && f.noData.some((x) => x.key === k))) { tally.everyday++; continue; }
    problems.push(name + " [" + k + "]");
  }
  assert.deepEqual(problems, [], "every name resolves");
  assert.ok(tally.resolved > 1100, "most names resolve as they are: " + JSON.stringify(tally));
});

// ── 3. the block ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("block (fixtures): a small group is shown and never ranked, a tie is nobody's win, a figure with fewer than two reliable values is not compared, years stay per locality", () => {
  const b = towns.buildBlock(towns.blockSpec(towns.findTowns(stubStore, "השוואה בין שדרות לאשקלון, לבאר שבע ולכפר קטן", "1031"), null), stubCtx("1031"));
  assert.deepEqual(b.towns.map((t) => t.key), ["1031", "7100", "9000", "55"], "the open locality first");
  const row = (id) => b.rows.find((r) => r.ind.id === id);
  // th_mmrv: 99 belongs to a group of 20 (the minimum is 100): shown, not ranked
  const mm = row("th_mmrv"), small = mm.values.find((v) => v.key === "55");
  assert.deepEqual([small.v, small.reliable], [99, false]);
  assert.equal(mm.best, "7100", "80 beats 70 and 60; the 99 of a small group wins nothing");
  assert.equal(mm.worst, "1031");
  assert.equal(mm.sameYear, false, "9000 has 2023, the others 2024");
  assert.deepEqual(mm.years, [2023, 2024]);
  assert.equal(mm.values.find((v) => v.key === "9000").year, 2023, "the year stays per locality");
  assert.deepEqual(mm.national, { v: 90, year: 2024 });
  assert.ok(b.rows.every((r) => !/[A-Za-z]/.test(r.ind.label + r.ind.short)), "the names of the figures are plain Hebrew: no Latin code");
  assert.equal(mm.ind.short, "חצבת, חזרת ואדמת");
  // th_penta: 70 and 70 share the top: nobody leads; 60 is alone at the bottom
  assert.equal(row("th_penta").best, null);
  assert.equal(row("th_penta").worst, "9000");
  // lower is better
  assert.equal(row("wait_specialist_days").best, "7100");
  assert.equal(row("wait_specialist_days").worst, "9000");
  assert.equal(row("life_expectancy").best, "9000");
  assert.equal(row("life_expectancy").worst, "1031");
  // th_pertussis has two small groups of three: one reliable value only
  assert.equal(row("th_pertussis"), undefined, "fewer than two reliable values: not compared");
  assert.equal(b.compared, 4); assert.equal(b.notCompared, 1);
  assert.equal(b.yearsDiffer, true);
  assert.deepEqual(b.wins.map((w) => [w.key, w.n]), [["7100", 2], ["9000", 1], ["1031", 0], ["55", 0]]);
  assert.deepEqual(b.wins[0].inds.sort(), ["th_mmrv", "wait_specialist_days"]);
  assert.deepEqual(b.lastPlace.map((w) => [w.key, w.n]), [["1031", 2], ["7100", 0], ["9000", 2], ["55", 0]]);
  assert.equal(b.smallRows, 1); assert.deepEqual(b.smallTowns, ["55"]);
  assert.equal(b.href, "#/c/1031/compare?with=7100,9000,55");
  assert.deepEqual(b.towns.map((t) => t.href), ["#/c/1031", "#/c/7100", "#/c/9000", "#/c/55"]);
  assert.ok(b.rows.length <= 41);
  assert.ok(b.notes.some((n) => /השנה האחרונה שונה בין היישובים/.test(n)));
});

test("block (fixtures): nothing is averaged or invented: every value is the store's cell of that locality's last year", () => {
  const b = towns.buildBlock(towns.blockSpec(towns.findTowns(stubStore, "השוואה בין שדרות לאשקלון ולבאר שבע ולתל אביב", "1031"), null), stubCtx("1031"));
  for (const r of b.rows) for (const v of r.values) {
    const ys = stubStore.cityYears(r.ind.id, v.key), y = ys[ys.length - 1], c = stubStore.cell(r.ind.id, v.key, y);
    assert.deepEqual([v.v, v.year, v.d], [c.v, y, c.d == null ? null : c.d], r.ind.id + " " + v.key);
  }
});

// ── 4. the sentence ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const lead = (q, key = "1031", scope = null) => towns.buildBlock(towns.blockSpec(towns.findTowns(stubStore, q, key), scope), stubCtx(key));

test("sentence: three localities, a tie, a small group", () => {
  const b = lead("השוואה בין שדרות לאשקלון, לבאר שבע ולכפר קטן");
  assert.equal(b.lead, `בין שדרות, אשקלון, באר שבע וכפר קטן אפשר להשוות ${I(4)} מדדים. אשקלון בראש ב-${I(2)} מהם ובאר שבע במדד אחד. במדד אחד אין יישוב אחד בראש, כי כמה יישובים באותו ערך. במדד אחד הקבוצה בכפר קטן קטנה מדי, ולכן הנתון מוצג בלי דירוג. הרשימה והפירוט למטה, וההשוואה המלאה בעמוד ההשוואה.`);
  assert.equal(b.title, "השוואה בין שדרות, אשקלון, באר שבע וכפר קטן");
});

test("sentence: two other localities, and one; singular and plural", () => {
  const two = lead(OWNER_Q);
  assert.equal(two.lead, `בין שדרות, אשקלון ובאר שבע אפשר להשוות ${I(4)} מדדים. אשקלון בראש ב-${I(2)} מהם ובאר שבע במדד אחד. במדד אחד אין יישוב אחד בראש, כי כמה יישובים באותו ערך. הרשימה והפירוט למטה, וההשוואה המלאה בעמוד ההשוואה.`);
  const one = lead("מה עם אשקלון");
  assert.equal(one.mode, "single");
  assert.match(one.lead, /^השאלה היא על אשקלון, ולכן כאן ההשוואה בין שדרות לאשקלון\. אפשר להשוות /);
  assert.match(one.lead, / אשקלון בראש (?:ב-⁦\d+⁩|במדד אחד) מהם/);
  assert.equal(one.title, "השוואה בין שדרות לאשקלון");
  assert.deepEqual(one.towns.map((t) => t.href), ["#/c/1031", "#/c/7100"], "the page of the locality asked about is a link of its own");
  // one figure, one lead
  const st = makeStore(NAMES, { th_mmrv: { ...DATA.th_mmrv, loc: rows(["1031", 2024, 60, 400], ["7100", 2024, 80, 900]) } });
  const m = makeModels(st, { th_mmrv: { ...DATA.th_mmrv, loc: rows(["1031", 2024, 60, 400], ["7100", 2024, 80, 900]) } });
  const b = towns.buildBlock(towns.blockSpec(towns.findTowns(st, "השוואה לאשקלון", "1031"), null), { store: st, model: m("1031"), getModel: m });
  assert.match(b.lead, /^בין שדרות ואשקלון אפשר להשוות מדד אחד\. אשקלון בראש במדד אחד מהם\. /);
});

test("sentence: nobody leads when every figure is a tie; nothing to compare when no figure has two groups that count", () => {
  const same = { th_penta: { ...DATA.th_penta, loc: rows(["1031", 2024, 70, 500], ["7100", 2024, 70, 800]) }, life_expectancy: { ...DATA.life_expectancy, loc: rows(["1031", 2024, 82, null], ["7100", 2024, 82, null]) } };
  let st = makeStore(NAMES, same), m = makeModels(st, same);
  let b = towns.buildBlock(towns.blockSpec(towns.findTowns(st, "השוואה לאשקלון", "1031"), null), { store: st, model: m("1031"), getModel: m });
  assert.equal(b.compared, 2);
  assert.deepEqual(b.wins.map((w) => w.n), [0, 0]);
  assert.match(b.lead, /^בין שדרות ואשקלון אפשר להשוות שני מדדים\. בכל המדדים האלה יש תיקו בראש, ולכן אף יישוב אינו בראש באף אחד מהם\. /);
  const tiny = { th_mmrv: { ...DATA.th_mmrv, loc: rows(["1031", 2024, 60, 20], ["7100", 2024, 80, 30]) } };
  st = makeStore(NAMES, tiny); m = makeModels(st, tiny);
  b = towns.buildBlock(towns.blockSpec(towns.findTowns(st, "השוואה לאשקלון", "1031"), null), { store: st, model: m("1031"), getModel: m });
  assert.equal(b.compared, 0); assert.equal(b.rows.length, 0); assert.equal(b.notCompared, 1);
  assert.match(b.lead, /^בין שדרות ואשקלון אין כרגע מדד שאפשר לדרג: בכל מדד יש פחות משני יישובים עם קבוצה גדולה מספיק\./);
  assert.match(b.lead, /הקבוצות בשדרות ובאשקלון קטנות מדי|בכל מדד יש פחות משני/);
});

test("sentence: a topic in the question narrows the figures, and the sentence says so", () => {
  const f = towns.findTowns(stubStore, "מי מוביל בחיסונים בין שדרות לאשקלון ולבאר שבע", "1031");
  const model = stubModel("1031");
  const b = towns.buildBlock(towns.blockSpec(f, fallback.topicScope(model, "מי מוביל בחיסונים בין שדרות לאשקלון ולבאר שבע")), stubCtx("1031"));
  assert.deepEqual(b.scope.domains, ["immunization"]);
  assert.deepEqual(b.rows.map((r) => r.ind.id).sort(), ["th_mmrv", "th_penta"]);
  assert.match(b.lead, /אפשר להשוות שני מדדים בתחום חיסונים\./);
  // one named figure: its plain Hebrew name, never the Latin code of the catalogue
  const q1 = "מי מוביל בחצבת בין שדרות לאשקלון ולבאר שבע", one = towns.buildBlock(towns.blockSpec(towns.findTowns(stubStore, q1, "1031"), fallback.topicScope(model, q1)), stubCtx("1031"));
  assert.deepEqual(one.rows.map((r) => r.ind.id), ["th_mmrv"]);
  assert.match(one.lead, /^בין שדרות, אשקלון ובאר שבע אפשר להשוות מדד אחד בנושא חצבת, חזרת ואדמת\. אשקלון בראש במדד אחד מהם\./);
  assert.ok(!/MMR/.test(one.lead));
  // a topic with nothing to compare falls back to all the figures, and says nothing about a scope
  const none = towns.buildBlock(towns.blockSpec(f, { ids: [], domains: ["mental"] }), stubCtx("1031"));
  assert.equal(none.rows.length, 4);
});

test("sentence: plain neutral Hebrew - no 'we', no 'עיר', no claim about a cause, no Latin letter", () => {
  const bs = [lead(OWNER_Q), lead("מה עם אשקלון"), lead("השוואה בין שדרות לאשקלון, באר שבע, תל אביב, ירושלים, חיפה ונתניה"), lead("השוואה לכנרת ולאשקלון")];
  for (const b of bs) {
    const t = b.lead + " " + b.title + " " + b.notes.join(" ");
    assert.ok(!/אנחנו|אנו|נראה|מצאנו|בדקנו|הצלחנו/.test(t), "no we: " + t);
    assert.ok(!/(^|[\s"״ו])ה?עיר(?![א-ת])|עירי/.test(t), "no 'עיר': " + t);
    assert.ok(!/בגלל|מכיוון|עקב|גורם/.test(t), "no cause: " + t);
    assert.ok(!/[A-Za-z]/.test(t), "no Latin letter");
    assert.ok(guard.hasStrayLatin(t) === false);
  }
  assert.match(bs[3].lead, /השם ״כנרת״ מתאים לכמה יישובים/);
});

// ── 5. the spec: resolve() trusts the block's sentence, not a model's ─────────────────────────────────────────────────────────────────────────────────────
test("spec.resolve: a page with a towns block takes its sentence and its title from the block; the model's own are not used", () => {
  const spec = { title: "השוואה בין שדרות ליישובים דומים ולממוצע הארצי", answer: OWNER_FALSE, blocks: [{ type: "towns", keys: ["7100", "9000"], mode: "named" }, { type: "kpis", inds: ["th_mmrv"] }] };
  const page = resolve(spec, stubStore, stubModel("1031"), stubModel);
  assert.equal(page.blocks[0].type, "towns");
  assert.equal(page.answer, page.blocks[0].lead);
  assert.equal(page.title, "השוואה בין שדרות, אשקלון ובאר שבע");
  assert.equal(guard.falseClaim(page.answer), null);
  const noModels = resolve({ blocks: [{ type: "towns", keys: ["7100"] }] }, stubStore, stubModel("1031"));
  assert.equal(noModels.blocks.length, 0, "without a way to read another locality the block is dropped, not invented");
  assert.equal(resolve({ blocks: [{ type: "towns", keys: ["__proto__", "constructor", "nope"] }] }, stubStore, stubModel("1031"), stubModel).blocks.length, 0, "keys the store does not know");
});

test("spec.resolve: a title that says the data is of one locality only is not shown", () => {
  const page = resolve({ title: "נתונים על שדרות בלבד", blocks: [] }, stubStore, stubModel("1031"), stubModel);
  assert.equal(page.title, "תשובה");
});

// ── 6. the keyword planner needs no model ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("fallback.plan: with no model the owner's question gets the towns block, and the sentence is the server's", () => {
  const spec = fallback.plan(stubModel("1031"), OWNER_Q, { store: stubStore });
  assert.deepEqual(spec.blocks.map((b) => b.type), ["towns"]);
  assert.deepEqual(spec.blocks[0].keys, ["7100", "9000"]);
  assert.equal(spec.blocks[0].mode, "named");
  const page = resolve(spec, stubStore, stubModel("1031"), stubModel);
  assert.match(page.answer, /^בין שדרות, אשקלון ובאר שבע אפשר להשוות /);
  // the same planner is unchanged for a question that names nobody
  const plain = fallback.plan(stubModel("1031"), "איפה היישוב חלש", { store: stubStore });
  assert.notEqual(plain.blocks[0].type, "towns");
  assert.equal(fallback.plan(stubModel("1031"), "איפה היישוב חלש").blocks[0].type, plain.blocks[0].type, "called with two arguments, as before");
});

// ── 7. the ask-agent end to end, with a stubbed model and with none ───────────────────────────────────────────────────────────────────────────────────────
const ledger = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cp2-towns-")), "usage.json");
function stubModelReplies(replies) {
  const sent = [];
  llm._reset(); llm._setLedger(ledger); cfg.llm.key = "test-key"; cfg.llm.maxPerHour = 40; cfg.llm.reserveUsd = 0.3;
  llm._setRequest(async (url, opts) => {
    if (url.endsWith("/key")) return { status: 200, body: Buffer.from(JSON.stringify({ data: { limit: 1, usage: 0.1, limit_remaining: 0.9 } })) };
    const body = JSON.parse(opts.body); sent.push(body);
    const content = replies.length ? replies.shift() : "{}";
    return { status: 200, body: Buffer.from(JSON.stringify({ model: body.model, choices: [{ message: { content } }], usage: { prompt_tokens: 1000, completion_tokens: 200, cost: 0.004 } })) };
  });
  return sent;
}
const modelOff = () => { llm._setRequest(null); cfg.llm.key = ""; };
const FALSE_PLAN = JSON.stringify({ title: "השוואה בין שדרות ליישובים דומים ולממוצע הארצי", answer: OWNER_FALSE, blocks: [{ type: "compare", inds: ["th_mmrv"] }, { type: "kpis", inds: ["th_mmrv", "th_penta"] }, { type: "findings", limit: 2 }, { type: "recs", limit: 2 }], followups: ["מה כדאי לעשות קודם?"] });

test("ask (stubbed model): the false sentence of the owner's report never reaches the page; the server's sentence and the towns block do", { skip: !haveStore }, async () => {
  const api = require("../src/api");
  const sent = stubModelReplies([FALSE_PLAN]);
  try {
    const r = await ask.answer(api.getStore(), api.getModel, { city: "1031", question: OWNER_Q });
    assert.equal(sent.length, 1, "one planning call and no repair call");
    assert.equal(r.via, "model");
    assert.equal(r.page.blocks[0].type, "towns");
    assert.ok(!r.page.blocks.some((b) => b.type === "compare"), "the model's 'similar localities' block is not used for localities the question names");
    assert.ok(r.page.blocks.length <= 3);
    assert.match(r.page.answer, /^בין שדרות, אשקלון ובאר שבע אפשר להשוות /);
    assert.equal(r.page.answer, r.page.blocks[0].lead);
    assert.equal(guard.falseClaim(r.page.answer), null);
    assert.ok(!/בלבד|MMR/.test(r.page.answer + r.page.title));
    assert.equal(r.page.title, "השוואה בין שדרות, אשקלון ובאר שבע");
    assert.deepEqual(r.page.followups, ["מה כדאי לעשות קודם?"], "the model still chooses the follow-ups");
    // the planner is told who was found, and that the system holds them
    const sys = sent[0].messages[0].content;
    assert.match(sys, /אשקלון \(key 7100\)/); assert.match(sys, /באר שבע \(key 9000\)/);
    assert.match(sys, /The system HOLDS official data on every locality/);
    assert.match(sys, /REPLACES your "answer"/);
  } finally { modelOff(); }
});

test("ask (stubbed model): a false sentence about a question that names nobody is repaired once, or dropped", { skip: !haveStore }, async () => {
  const api = require("../src/api");
  const lie = JSON.stringify({ title: "חיסונים", answer: "המערכת מציגה נתונים על שדרות בלבד ולא ניתן להשוות ליישובים אחרים.", blocks: [{ type: "kpis", inds: ["th_mmrv"] }] });
  let sent = stubModelReplies([lie, JSON.stringify({ answer: "ב{{city}} שיעור החיסון נגד חצבת, חזרת ואדמת עומד על {{v:th_mmrv}}." })]);
  try {
    let r = await ask.answer(api.getStore(), api.getModel, { city: "1031", question: "מה מצב החיסונים?" });
    assert.equal(sent.length, 2, "the plan and one repair");
    assert.match(r.page.answer, /^בשדרות שיעור החיסון נגד חצבת, חזרת ואדמת עומד על /);
    assert.match(sent[1].messages[1].content, /false about the system/);
    sent = stubModelReplies([lie, JSON.stringify({ answer: "יש נתונים על שדרות בלבד." })]);
    r = await ask.answer(api.getStore(), api.getModel, { city: "1031", question: "מה מצב החיסונים?" });
    assert.ok(!r.page.answer || guard.falseClaim(r.page.answer) === null, "what could not be repaired is not shown");
  } finally { modelOff(); }
});

test("ask (no model): the keyword planner gives the owner's question the same towns block and sentence", { skip: !haveStore }, async () => {
  const api = require("../src/api");
  assert.equal(llm.available(), false, "no key");
  const r = await ask.answer(api.getStore(), api.getModel, { city: "1031", question: OWNER_Q });
  assert.equal(r.via, "keywords");
  assert.deepEqual(r.page.blocks.map((b) => b.type), ["towns"]);
  assert.match(r.page.answer, /^בין שדרות, אשקלון ובאר שבע אפשר להשוות /);
  const one = await ask.answer(api.getStore(), api.getModel, { city: "1031", question: "איך המצב באשקלון?" });
  assert.equal(one.page.blocks[0].mode, "single");
  assert.match(one.page.answer, /^השאלה היא על אשקלון/);
  const amb = await ask.answer(api.getStore(), api.getModel, { city: "1031", question: "השוואה לכנרת" });
  assert.match(amb.page.answer, /השם ״כנרת״ מתאים לכמה יישובים/);
  assert.ok(!amb.page.blocks.some((b) => b.type === "towns"));
});

test("ask (stubbed model that fails): the keyword planner answers, the page is still the comparison", { skip: !haveStore }, async () => {
  const api = require("../src/api");
  stubModelReplies(["this is not json"]);
  try {
    const r = await ask.answer(api.getStore(), api.getModel, { city: "1031", question: OWNER_Q });
    assert.equal(r.via, "keywords");
    assert.equal(r.page.blocks[0].type, "towns");
  } finally { modelOff(); }
});

// ── 8. the real store: the numbers are the store's, cell by cell ──────────────────────────────────────────────────────────────────────────────────────────
// the order of one figure as the compare page reads it (web/js/pages/compare.js standing()): the groups that count only; rank = 1 + the ones strictly better
const better = (dir, a, b) => (dir === "lower" ? a < b : a > b);
function standing(cells, i, dir) {
  const me = cells[i];
  if (!me || me.reliable === false || typeof me.v !== "number") return null;
  const rest = cells.filter((c, k) => k !== i && c && c.reliable !== false && typeof c.v === "number");
  return rest.length ? { rank: 1 + rest.filter((o) => better(dir, o.v, me.v)).length, of: rest.length + 1 } : null;
}
const reliableOf = (ind, d) => (ind.kind === "level" ? d == null || d >= (ind.minBase || 0) : d >= (ind.minBase || 0));

const SETS = [["1031", "7100", "9000"], ["1031", "5000", "3000", "4000", "7400"], ["9000", "7100"], ["16", "1031", "9000"], ["7", "472", "7100", "5000", "3000"]];
for (const set of SETS) {
  test(`block (real store) ${set.join(" ")}: every value is the store's cell, every place is the compare page's`, { skip: !haveStore }, () => {
    const api = require("../src/api");
    const st = api.getStore(), model = api.getModel(set[0]);
    if (!model) return;
    const b = towns.buildBlock({ type: "towns", keys: set.slice(1), mode: "named" }, { store: st, model, getModel: api.getModel });
    if (!b) return;
    const order = b.towns.map((t) => t.key);
    assert.equal(order[0], set[0]);
    const ids = model.indicators.filter((a) => !a.stale && a.direction).map((a) => a.id);
    const compare = api.compare(order, ids);                                                      // what the compare page itself reads
    let compared = 0;
    for (const id of ids) {
      const ind = byId[id], row = b.rows.find((r) => r.ind.id === id), apiRow = compare.rows.find((r) => r.id === id);
      const cells = order.map((k, i) => { const c = apiRow.cells[i]; return c ? { v: c.v, year: c.year, reliable: c.reliable } : null; });
      const live = cells.filter((c) => c && c.reliable !== false && typeof c.v === "number");
      if (live.length < 2) { assert.equal(row, undefined, id + " has fewer than two groups that count: not compared"); continue; }
      assert.ok(row, id + " is compared"); compared++;
      order.forEach((k, i) => {
        const ys = st.cityYears(id, k), y = ys[ys.length - 1], c = y ? st.cell(id, k, y) : null, v = row.values[i];
        assert.equal(v.key, k);
        if (!c) { assert.deepEqual([v.v, v.year, v.reliable], [null, null, null]); return; }
        assert.deepEqual([v.v, v.year, v.d], [c.v, y, c.d == null ? null : c.d], `${id} ${k}`);
        assert.equal(v.reliable, reliableOf(ind, c.d), `${id} ${k} reliable`);
        assert.deepEqual([cells[i].v, cells[i].year], [v.v, v.year], "the compare API says the same");
      });
      const ranks = cells.map((c, i) => standing(cells, i, ind.direction));
      const firsts = order.filter((k, i) => ranks[i] && ranks[i].rank === 1), lasts = order.filter((k, i) => ranks[i] && ranks[i].rank === ranks[i].of);
      const distinct = new Set(live.map((c) => c.v)).size > 1;                                  // all the same: nobody leads, nobody is last
      assert.equal(row.best, distinct && firsts.length === 1 ? firsts[0] : null, id + " best: a tie is nobody's");
      assert.equal(row.worst, distinct && lasts.length === 1 ? lasts[0] : null, id + " worst");
      cells.forEach((c, i) => { if (c && c.reliable === false) { assert.notEqual(row.best, order[i], "a small group never leads"); assert.notEqual(row.worst, order[i], "a small group is never last"); } });
    }
    assert.equal(b.compared, compared); assert.equal(b.rows.length, compared);
    assert.equal(b.wins.reduce((s, w) => s + w.n, 0), b.rows.filter((r) => r.best).length, "a win is a figure with a leader");
    assert.equal(b.lastPlace.reduce((s, w) => s + w.n, 0), b.rows.filter((r) => r.worst).length);
    assert.ok(b.rows.length <= 41);
    assert.equal(b.href, "#/c/" + set[0] + "/compare?with=" + order.slice(1).join(","));
    for (const t of b.towns) { const m = api.getModel(t.key); assert.deepEqual(t.counts, { concern: m.counts.concern, watch: m.counts.watch, good: m.counts.good, strength: m.counts.strength, judged: m.counts.concern + m.counts.watch + m.counts.good + m.counts.strength }); }
  });
}

// ── 9. the guard ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("guard: the sentence of the owner's report (data on one locality only, no direct comparison) is rejected, with a reason a model can act on", () => {
  const model = stubModel("1031");
  assert.ok(guard.falseClaim(OWNER_FALSE));
  assert.equal(guard.expand(OWNER_FALSE, model), null);
  assert.match(guard.explain(OWNER_FALSE, model), /false about the system/);
  for (const t of ["המערכת מציגה נתונים על שדרות בלבד.", "יש כאן מידע על יישוב אחד בלבד.", "אין כרגע השוואה ישירה מול אשקלון.", "לא ניתן להשוות ליישובים אחרים.", "אי אפשר להשוות בין היישוב לערים אחרות.",
    "אין במערכת נתונים על יישובים אחרים.", "המערכת מתמקדת ביישוב אחד.", "אין אפשרות להשוות מול ערים אחרות.", "הנתונים הם של עיר אחת בלבד."]) {
    assert.ok(guard.falseClaim(t), "rejected: " + t);
    assert.equal(guard.expand(t, model), null);
  }
});

test("guard: true statements that sound alike are not rejected", () => {
  const model = stubModel("1031");
  for (const t of ["המערכת עדיין לא מחזיקה נתונים על בתי מרקחת, ולכן מוצגים המדדים הקרובים ביותר.", "אין השוואה ארצית במדד הזה.", "ב{{city}} שיעור החיסון נמוך מהיעד.", "אפשר להשוות את {{city}} ליישובים דומים בגודל."]) {
    assert.equal(guard.falseClaim(t.replace(/\{\{city\}\}/g, "שדרות")), null, t);
  }
  assert.ok(guard.expand("ב{{city}} שיעור החיסון נמוך מהיעד.", model));
});

test("guard: a Latin code of the table becomes its plain Hebrew phrase; any other Latin word makes the sentence unusable", () => {
  const P = guard.plainCodes;
  assert.equal(P("חיסון MMR/MMRV עד גיל שנה"), "חיסון חצבת, חזרת ואדמת עד גיל שנה");
  assert.equal(P("MMR"), "חצבת, חזרת ואדמת"); assert.equal(P("MMRV"), "חצבת, חזרת ואדמת");
  assert.equal(P("פעוטות שחוסנו נגד חצבת, חזרת ואדמת (MMR/MMRV) עד גיל 13 חודשים"), "פעוטות שחוסנו נגד חצבת, חזרת ואדמת עד גיל 13 חודשים", "a bracket that repeats the name goes");
  assert.equal(P("4 מנות חיסון מחומש (DTaP-IPV-Hib) עד גיל 18 חודשים"), "4 מנות חיסון מחומש עד גיל 18 חודשים");
  assert.equal(P("החיסון (DTaP)"), "החיסון (מחומש)", "a bracket that says something new keeps its plain phrase");
  assert.equal(P("ב-MMR"), "בחצבת, חזרת ואדמת");
  assert.equal(P("MMR או MMRV"), "חצבת, חזרת ואדמת");
  assert.equal(P("DTaP-IPV-Hib"), "מחומש"); assert.equal(P("DTaP"), "מחומש");
  assert.equal(P("הסבב החמישי של COSI"), "הסבב החמישי של מחקר השמנת הילדים של ארגון הבריאות העולמי באירופה");
  assert.equal(P("לפי WHO"), "לפי ארגון הבריאות העולמי");
  assert.equal(P("MMRVX"), "MMRVX", "only a whole code is swapped");
  for (const [code, plain] of Object.entries(guard.CODES)) { assert.ok(!/[A-Za-z]/.test(plain), code + " -> " + plain); assert.equal(guard.hasStrayLatin(code), false, code); }
  const { indicators } = require("../src/catalog/indicators");
  for (const i of indicators) for (const k of ["label", "short"]) assert.ok(!/[A-Za-z]/.test(P(i[k])), "the catalogue's " + k + " of " + i.id + " is plain Hebrew after the table: " + P(i[k]));
  const model = stubModel("1031");
  assert.equal(guard.expand("ב{{city}} חיסון MMR/MMRV עומד על {{v:th_mmrv}}.", model).includes("MMR"), false);
  assert.match(guard.expand("ב{{city}} חיסון MMR/MMRV עומד על {{v:th_mmrv}}.", model), /^בשדרות חיסון חצבת, חזרת ואדמת עומד על /);
  assert.equal(guard.expand("החיסון נקרא Vaxneuvance בארץ", model), null, "a Latin word that is not in the table");
  assert.equal(guard.expand("the data is clear", model), null);
  assert.equal(guard.expand("הקוד XYZ אינו מוכר", model), null, "even three letters");
  assert.equal(guard.hasStrayLatin("Pfizer"), true);
  assert.equal(guard.hasStrayLatin("חצבת, חזרת ואדמת"), false);
  assert.match(guard.explain("הקוד XYZ אינו מוכר", model), /English words \(XYZ\)/);
});

// ── 10. the prompts ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("prompts: the planner is told the system holds every locality and never to write otherwise; the line that allowed Latin abbreviations is gone", () => {
  const S = ask.SYSTEM;
  assert.match(S, /The system HOLDS official data on every locality of the country/);
  assert.match(S, /The system holds data on ALL localities\. NEVER write that it has data on this locality only, that a comparison with another locality is impossible, or that data about another locality is missing/);
  assert.match(S, /no Latin letters or codes at all: write the plain Hebrew name \(חצבת, חזרת ואדמת/);
  assert.ok(!/abbreviations MMR, MMRV, DTaP are fine/.test(S), "the old line");
  assert.ok(!/are fine/.test(S));
  assert.ok(!/ONE Israeli locality/.test(S), "the planner is no longer told there is one locality");
  assert.ok(!/abbreviations MMR, MMRV, DTaP are fine/.test(FIGURE_RULES), "the same line in the shared rules of the briefing");
  assert.match(FIGURE_RULES, /no Latin codes at all/);
  const note = ask.townsNote(towns.findTowns(stubStore, OWNER_Q, "1031"));
  assert.match(note, /- אשקלון \(key 7100\)/); assert.match(note, /- באר שבע \(key 9000\)/);
  assert.equal(ask.townsNote(towns.findTowns(stubStore, "איך המצב", "1031")), "");
  assert.match(ask.townsNote(towns.findTowns(stubStore, "מה בכנרת", "1031")), /the name "כנרת" fits several localities/);
});

test("prompts: the model never sees a Latin code in the list of indicators", { skip: !haveStore }, () => {
  const api = require("../src/api");
  const cat = ask.catalogFor(api.getModel("1031"));
  assert.ok(!/MMR|DTaP|IPV|Hib/.test(cat), "the catalogue of the planner is in plain Hebrew");
  assert.match(cat, /th_mmrv \| immunization \| פעוטות שחוסנו נגד חצבת, חזרת ואדמת עד גיל 13 חודשים/);
});

// ── 11. the route ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test("POST /api/ask (no model): the owner's question on 1031 returns the towns block with the numbers of the data", { skip: !haveStore }, async () => {
  const { createServer } = require("../server.js");
  const api = require("../src/api");
  assert.equal(llm.available(), false);
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    const body = JSON.stringify({ city: "1031", question: OWNER_Q });
    const r = await new Promise((resolveP, reject) => {
      const req = http.request(origin + "/api/ask", { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (res) => {
        const chunks = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => resolveP({ status: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString("utf8")) }));
      });
      req.on("error", reject); req.end(body);
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.via, "keywords");
    const tb = r.json.page.blocks[0];
    assert.equal(tb.type, "towns");
    assert.deepEqual(tb.towns.map((t) => t.key), ["1031", "7100", "9000"]);
    const direct = towns.buildBlock({ type: "towns", keys: ["7100", "9000"] }, { store: api.getStore(), model: api.getModel("1031"), getModel: api.getModel });
    assert.deepEqual(tb.rows.map((x) => [x.ind.id, x.best, x.worst]), direct.rows.map((x) => [x.ind.id, x.best, x.worst]));
    assert.equal(r.json.page.answer, direct.lead);
  } finally { await new Promise((r) => server.close(r)); }
});
