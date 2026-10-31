// The rows of the one-glance page never contradict their heading: what the two bars show (the town against the country, at the precision of the printed numbers)
// has to agree with "what needs attention" and "what goes well". The choices are in web/js/product/simple/model.js; the lines that explain a row are in words.js.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { haveStore, model as cityModel } from "./helpers/city-models.mjs";
import { installDom, fakeFetch } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => import(pathToFileURL(path.join(ROOT, "web", "js", "product", f)).href);
const M = await load("simple/model.js"), W = await load("simple/words.js"), D = await load("city/data.js"), S = await load("city/sentence.js"), storage = await load("storage.js");
const require = createRequire(import.meta.url);
const skip = !haveStore && "the built store is not there";

// the stored models of 40 or more towns: the fixtures, then a spread of sizes and regions taken evenly from the store's own list
const FIXTURES = ["1031", "9000", "3000", "5000", "4000", "1161", "2600", "2710", "6100", "2800", "7", "16", "472", "935", "99"];
const PROBE = ["1031", "9000", "3000", "99", "472", "16", "7", "935"];          // the towns of the browser probes
const MODELS = {}, SAMPLE = {};
if (haveStore) {
  const cfg = require("../src/lib/config"), { Store } = require("../src/model/store"), { buildCityModel } = require("../src/model/city");
  const store = Store.load(path.join(cfg.STORE, "store.json")), all = store.search("", 5000).map((x) => x.key), rest = all.filter((k) => !FIXTURES.includes(k));
  const keys = [...FIXTURES, ...Array.from({ length: 45 }, (_, i) => rest[Math.floor(((i + 0.5) * rest.length) / 45)])];
  for (const k of keys) { const m = buildCityModel(store, k); if (m) MODELS[k] = JSON.parse(JSON.stringify(m)); }
  // the sample of the "every row says why" property: the probe towns and 100 more taken evenly from the whole list (what GET /api/city/:key serves)
  for (const k of [...PROBE, ...Array.from({ length: 100 }, (_, i) => all[Math.floor(((i + 0.5) * all.length) / 100)])]) { if (SAMPLE[k]) continue; const m = MODELS[k] || buildCityModel(store, k); if (m) SAMPLE[k] = MODELS[k] || JSON.parse(JSON.stringify(m)); }
}

// a hand-made figure: a good one, 20% against 25%, lower is better, 60 of 100 localities beaten
const ind = (id, o = {}) => ({
  id, label: "מדד " + id, short: "מדד " + id, unit: "%", direction: "lower", importance: 3, status: "good", statusWhy: [], stale: false, ...o,
  last: { year: 2025, v: 20, nat: 25, target: null, level: 60, reliable: true, meetsTarget: null, ...(o.last || {}) }
});
const town = (...indicators) => ({ city: { key: "1", name: "עיר" }, indicators });
const ids = (r) => r.rows.map((x) => x.id);
const cause = (r) => (r.cause ? W.plainOf(r.cause) : null);

// ── what the bars show ──
test("standing: the printed precision decides, in the direction that is good", () => {
  const s = (v, nat, direction = "lower", unit = "%") => M.standing(ind("x", { unit, direction, last: { v, nat } }));
  assert.equal(s(30.9, 30.8), "worse", "30.9 against 30.8, lower is better");
  assert.equal(s(30.7, 30.8), "better");
  assert.equal(s(30.84, 30.8), "same", "the same once printed");
  assert.equal(s(30.8, 30.8), "same");
  assert.equal(s(30.9, 30.8, "higher"), "better");
  assert.equal(s(30.7, 30.8, "higher"), "worse");
  assert.equal(s(46.04, 46, "lower", "days"), "same");
  assert.equal(s(0.514, 0.5, "lower", "index"), "worse", "an index prints two decimals");
  assert.equal(s(20, null), "none");
  assert.equal(M.shownValue("%", 30.85), Number(M.valueParts("%", 30.85).n.replace("%", "")), "the same rounding as the printed number");
});

// ── what goes well ──
test("good rows: the town must be visibly ahead of the country; level, behind or no country figure is out", () => {
  const m = town(
    ind("ahead", { last: { v: 20, nat: 25 } }),
    ind("level", { last: { v: 30.84, nat: 30.8 } }),
    ind("behind", { last: { v: 30.9, nat: 30.8 } }),
    ind("nonat", { last: { v: 20, nat: null } }),
    ind("ahead_up", { direction: "higher", last: { v: 51, nat: 50 } }));
  const g = M.goodOf(m);
  assert.deepEqual(ids(g).sort(), ["ahead", "ahead_up"]);
  assert.equal(g.total, 2);
  for (const r of g.rows) assert.equal(r.reason, undefined, "the bars say it, no extra line (a row has no reason line any more)");
});

test("good rows: a figure that stands on the target only (not ahead of the country) stays with the official-target line, never with a second line; a target the product cannot show does not put it on the list", () => {
  const G80 = (o) => ({ judges: true, meets: true, gap: 1, value: 95, unit: "%", direction: "atLeast", text: "לפחות 95%", ...o });
  const behind = ind("t_behind", { status: "strength", guide: G80(), last: { v: 96, nat: 97, target: 95, meetsTarget: true }, direction: "higher" });
  const nonat = ind("t_nonat", { direction: "higher", guide: G80(), last: { v: 96, nat: null, target: 95, meetsTarget: true } });
  const notMet = ind("t_not", { direction: "higher", guide: G80({ meets: false, gap: -2 }), last: { v: 93, nat: 97, target: 95, meetsTarget: false } });
  const noGuide = ind("t_noguide", { direction: "higher", last: { v: 96, nat: 97, target: 95, meetsTarget: true } });
  const g = M.goodOf(town(behind, nonat, notMet, noGuide));
  assert.deepEqual(ids(g), ["t_behind", "t_nonat"], "a figure below its target is not 'good' on the target, and a target with no judging guide is not shown, so it is not a ground either");
  assert.deepEqual(g.rows.map((r) => D.tgtPlain(r.tgt)), ["יעד רשמי: לפחות 95% · עומד ביעד.", "יעד רשמי: לפחות 95% · עומד ביעד."]);
  assert.ok(g.rows.every((r) => r.reason === undefined));
});

test("good rows: the rows that need no line come first, then the target rows; the list never passes three; none qualify gives an empty list", () => {
  const list = [ind("a", { last: { v: 10, nat: 25 } }), ind("b", { last: { v: 11, nat: 25 } }), ind("c", { last: { v: 12, nat: 25 } }), ind("d", { last: { v: 13, nat: 25 } }),
    ind("e", { status: "strength", guide: { judges: true, meets: true, gap: 1, value: 40, unit: "%", direction: "atMost", text: "עד 40%" }, last: { v: 31, nat: 30, target: 40, meetsTarget: true } })];
  const g = M.goodOf(town(...list));
  assert.equal(g.rows.length, 3); assert.equal(g.total, 5);
  assert.ok(g.rows.every((r) => r.reason === undefined), "the target row comes after the rows the bars explain");
  assert.equal(ids(M.goodOf(town(list[4]))).join(), "e");
  const none = M.goodOf(town(ind("x", { last: { v: 30.9, nat: 30.8 } }), ind("y", { last: { v: 5, nat: null } })));
  assert.deepEqual(none, { rows: [], total: 0 });
});

test("good rows: a small group and a stale figure are never in the list, whatever the bars show", () => {
  const g = M.goodOf(town(ind("small", { last: { v: 1, nat: 25, reliable: false } }), ind("stale", { stale: true, last: { v: 1, nat: 25 } }), ind("ok", { last: { v: 1, nat: 25 } })));
  assert.deepEqual(ids(g), ["ok"]);
});

// ── what needs attention ──
test("attention rows: every row says why, in the words of the model's own causes (the place among the localities, the distance from the target, the trend), whatever the bars show", () => {
  const worse = ind("worse", { status: "concern", statusWhy: ["rank"], last: { v: 30, nat: 25, level: 10 } });
  const target = ind("target", { status: "concern", statusWhy: ["rank", "target"], direction: "higher", last: { v: 80, nat: 70, target: 95, level: 12, meetsTarget: false, gapTarget: -15 } });
  const targetNat = ind("target_nat", { status: "watch", statusWhy: ["target", "worsening"], direction: "higher", last: { v: 80, nat: 80, target: 95, level: 40, meetsTarget: false, gapTarget: -15 } });
  const nonat = ind("nonat", { status: "watch", statusWhy: ["rank"], last: { v: 30, nat: null, level: 30 } });
  const a = M.attentionOf(town(worse, target, targetNat)), by = Object.fromEntries(a.rows.map((r) => [r.id, r]));
  assert.equal(a.rows.length, 3);
  assert.equal(cause(by.worse), "כי רוב היישובים במצב טוב יותר.", "behind the country: the bars show the gap and the line still says why it needs treatment");
  assert.equal(cause(by.target), "כי רוב היישובים במצב טוב יותר וחסרות 15 נקודות אחוז ליעד.");
  assert.equal(cause(by.target_nat), "כי חסרות 15 נקודות אחוז ליעד והמגמה בהידרדרות.", "level with the country at the printed precision: the line says why all the same");
  for (const r of a.rows) assert.equal(r.reason, undefined, "the cause is in the status line, not in a second line");
  const four = M.attentionOf(town(worse, target, targetNat, nonat));
  assert.equal(four.rows.length, 3, "three at most"); assert.equal(four.total, 4, "the rest is counted");
  assert.equal(cause(M.attentionOf(town(nonat)).rows[0]), "כי רוב היישובים במצב טוב יותר.", "no country figure: the cause is still the model's own");
});

test("causes: only what the model names, in its own order; a trend alone is the trend; a target with no distance is still below the target; a good figure has none", () => {
  const c = (o) => { const x = D.causeOf(ind("x", o)); return x ? W.plainOf(x) : null; };
  assert.equal(c({ status: "concern", statusWhy: ["worsening"], last: { level: 39 } }), "כי המגמה בהידרדרות.", "the trend alone: no place among the localities is claimed");
  assert.equal(c({ status: "watch", statusWhy: ["rank", "target", "worsening"], last: { level: 30, gapTarget: -3.2 } }), "כי רוב היישובים במצב טוב יותר, חסרות 3.2 נקודות אחוז ליעד והמגמה בהידרדרות.");
  assert.equal(c({ status: "concern", statusWhy: ["target"], unit: "days", direction: "lower", last: { gapTarget: -4 } }), "כי חסרים 4 ימים ליעד.");
  assert.equal(c({ status: "concern", statusWhy: ["target"], last: { gapTarget: null } }), "כי הערך מתחת ליעד.");
  assert.equal(c({ status: "watch", statusWhy: ["rank"], last: { level: 50 } }), "כי רוב היישובים במצב טוב יותר.", "the model's own cause is said (its level is a rounded number: 50 can be 49.6)");
  assert.equal(c({ status: "watch", statusWhy: [] }), null, "no cause named, none invented");
  assert.equal(c({ status: "good", statusWhy: ["rank"] }), null); assert.equal(c({ status: "stale", statusWhy: [] }), null);
  assert.equal(W.plainOf(D.causeOf(ind("x", { status: "concern", statusWhy: ["rank"], last: { level: 10 } }))).includes("מקום"), false, "no rank wording: the place is a number of the full level");
  assert.deepEqual(D.causeOf(ind("x", { status: "concern", statusWhy: ["target"], last: { gapTarget: -15 } })).filter((s) => typeof s !== "string"), [{ n: "15" }], "the number is a segment of its own");
});

test("the target line: the word of where the figure stands, no second sentence about the country for a missed target, one aside for a met one", () => {
  const t = (state, natMiss) => ({ text: "לפחות 80%", state, word: { meets: "עומד ביעד", near: "קרוב ליעד", below: "מתחת ליעד", far: "רחוק מהיעד" }[state], natMiss });
  for (const s of ["near", "below", "far"]) for (const nm of [true, false]) assert.ok(!/ארץ|ממוצע|גם/.test(D.tgtPlain(t(s, nm))), s + ": nothing about the country for a missed target");
  assert.equal(D.tgtPlain(t("far", true)), "יעד רשמי: לפחות 80% · רחוק מהיעד.");
  assert.equal(D.tgtPlain(t("near", true)), "יעד רשמי: לפחות 80% · קרוב ליעד.");
  assert.equal(D.tgtPlain(t("below", true)), "יעד רשמי: לפחות 80% · מתחת ליעד.");
  assert.equal(D.tgtPlain(t("meets", false)), "יעד רשמי: לפחות 80% · עומד ביעד.");
  assert.equal(D.tgtPlain(t("meets", true)), "יעד רשמי: לפחות 80% · עומד ביעד. הממוצע בארץ עדיין מתחת ליעד.");
  assert.equal(D.tgtSegs(t("meets", true)).filter((s) => s && s.aside).length, 1, "the aside is its own segment (the printed sheet leaves it out)");
});

test("attention rows: with no visible gap or target the row goes after the rows that have one; a row says its cause in either case", () => {
  const rank = ind("rank", { status: "concern", statusWhy: ["rank"], last: { v: 20, nat: 25, level: 2 } });
  const trend = ind("trend", { status: "watch", statusWhy: ["worsening"], last: { v: 20, nat: 25, level: 55 } });
  const gap = ind("gap", { status: "concern", statusWhy: ["rank"], last: { v: 30, nat: 25, level: 20 } });
  const tgt = ind("tgt", { status: "concern", statusWhy: ["target"], direction: "higher", last: { v: 90, nat: 80, target: 95, level: 30, meetsTarget: false, gapTarget: -5 } });
  const a = M.attentionOf(town(rank, trend, gap, tgt));
  assert.deepEqual(ids(a), ["gap", "tgt", "rank"], "the order of the home among the rows that are not late; the late rows follow");
  assert.equal(cause(a.rows[2]), "כי רוב היישובים במצב טוב יותר.");
  assert.equal(cause(M.attentionOf(town(trend)).rows[0]), "כי המגמה בהידרדרות.");
});

test("attention rows: a small group and a stale figure stay out of the list", () => {
  const a = M.attentionOf(town(ind("small", { status: "concern", statusWhy: ["rank"], last: { v: 30, nat: 25, level: 1, reliable: false } }), ind("stale", { status: "stale", stale: true, last: { v: 30, nat: 25, level: 1 } })));
  assert.deepEqual(a, { rows: [], total: 0 });
});

// ── the words of the lines ──
test("reason lines and ledes: short, plain, third person, the number isolated as a segment", () => {
  const lines = [D.causeOf(ind("a", { status: "concern", statusWhy: ["rank", "target", "worsening"], unit: "days", direction: "lower", last: { level: 5, gapTarget: -12 } })),
    D.causeOf(ind("b", { status: "watch", statusWhy: ["worsening"] })), W.targetLede({ n: 13, town: 0, natN: 13, nat: 2 }), [W.T.goodLede]];
  for (const l of lines) {
    const t = W.plainOf(l);
    assert.ok(t.split(/\s+/).length <= (l === lines[2] ? 24 : 16), t); assert.ok(/\.$/.test(t), t); assert.ok(!/אנחנו|לנו|מקום |אחוזון|פרמטר|מובהק/.test(t), t);
  }
  assert.equal(typeof W.reasonSegs, "undefined", "the old no-guide line 'עומד ביעד: 95%' is gone: no town of the country reaches it (a scan of all 1,228 towns found 0 of 1,803 rows on it)");
});

test("the lede under the verdict: how many of the figures with an official target meet it in the town and in the country; the one, two and many forms; a country with no figure is left out", () => {
  const say = (o) => W.plainOf(W.targetLede(o));
  assert.equal(say({ n: 13, town: 0, natN: 13, nat: 2 }), "ל-13 מדדי היישוב יש יעד רשמי של משרד הבריאות. ביישוב אף אחד מהם אינו עומד בו, ובארץ כולה 2 מהם עומדים בו.");
  assert.equal(say({ n: 13, town: 1, natN: 13, nat: 1 }), "ל-13 מדדי היישוב יש יעד רשמי של משרד הבריאות. ביישוב אחד מהם עומד בו, ובארץ כולה אחד מהם עומד בו.");
  assert.equal(say({ n: 4, town: 4, natN: 4, nat: 4 }), "ל-4 מדדי היישוב יש יעד רשמי של משרד הבריאות. ביישוב כולם עומדים בו, ובארץ כולה כולם עומדים בו.");
  assert.equal(say({ n: 2, town: 2, natN: 2, nat: 0 }), "ל-2 מדדי היישוב יש יעד רשמי של משרד הבריאות. ביישוב שניהם עומדים בו, ובארץ כולה אף אחד מהם אינו עומד בו.");
  assert.equal(say({ n: 1, town: 0, natN: 1, nat: 1 }), "למדד אחד של היישוב יש יעד רשמי של משרד הבריאות. ביישוב הוא אינו עומד בו, ובארץ כולה הוא עומד בו.");
  assert.equal(say({ n: 3, town: 1, natN: 0, nat: 0 }), "ל-3 מדדי היישוב יש יעד רשמי של משרד הבריאות. ביישוב אחד מהם עומד בו.", "no national average at all: the country is not claimed");
  assert.equal(say({ n: 5, town: 2, natN: 3, nat: 1 }), "ל-5 מדדי היישוב יש יעד רשמי של משרד הבריאות. ביישוב 2 מהם עומדים בו, ובארץ כולה אחד מהם עומד בו (מבין 3 שיש להם ממוצע ארצי).", "the country is counted over the figures that have a national average, and the sentence says so");
});

// ── the property: over the stored models of 40 or more towns, no row contradicts its heading ──
test("property: in every stored town both lists have at most three rows and no row contradicts its heading", { skip }, () => {
  const towns = Object.keys(MODELS);
  assert.ok(towns.length >= 40, "at least 40 towns: " + towns.length);
  let rows = 0, lines = 0;
  for (const k of towns) {
    const m = MODELS[k], byId = new Map(m.indicators.map((x) => [x.id, x])), a = M.attentionOf(m), g = M.goodOf(m);
    assert.ok(a.rows.length <= 3 && g.rows.length <= 3, k + " at most three rows");
    for (const r of g.rows) {
      const x = byId.get(r.id); rows++;
      assert.ok(["good", "strength"].includes(x.status) && x.last.reliable !== false && !x.stale && x.status !== "stale", `${k} ${r.id} is judged and fresh`);
      if (M.standing(x) === "better") assert.equal(r.reason, undefined, `${k} ${r.id}: the bars say it`);
      else {
        lines++; assert.ok(x.last.meetsTarget === true && typeof x.last.target === "number", `${k} ${r.id}: not ahead of the country, so it stands on the target`);
        // the line that explains it is the one under the bars: the official target and "עומד ביעד"; a figure whose target the product cannot show is not listed on that ground
        assert.ok(r.tgt, `${k} ${r.id}: it has the official-target line`); assert.equal(r.tgt.state, "meets", `${k} ${r.id}`); assert.equal(r.reason, undefined, `${k} ${r.id}: said once`);
      }
      if (r.tgt) assert.equal(r.tgt.state === "far", false, `${k} ${r.id}: a figure far from its official target is never under what goes well`);
    }
    for (const r of a.rows) {
      const x = byId.get(r.id); rows++;
      assert.ok(["concern", "watch"].includes(x.status) && x.last.reliable !== false && !x.stale, `${k} ${r.id} needs attention and is judged`);
      // every row that needs treatment or follow-up says why, whatever the bars show; a row that says "עומד ביעד" says what else is wrong in the same words
      lines++; assert.ok(r.cause && r.cause.length, `${k} ${r.id}: the row says why it needs attention`); assert.equal(r.reason, undefined, `${k} ${r.id}: the cause is in the status line`);
    }
    assert.equal(new Set([...a.rows, ...g.rows].map((r) => r.id)).size, a.rows.length + g.rows.length, k + ": a figure is in one list only");
    for (const r of [...a.rows, ...g.rows]) assert.deepEqual(Object.keys(r).filter((f) => /rank|level|peer|percent|z$/i.test(f)), [], "no rank-like field");
  }
  assert.ok(rows >= 40, "the property looked at real rows: " + rows);
  void lines;
});

// ── every row that says "דורש טיפול" or "למעקב" names its cause: the probe towns and 100 more, every figure, both levels of the town page and the words of the category page ──
test("property: no figure with the status concern or watch lacks a cause, in 108 towns", { skip }, () => {
  const towns = Object.keys(SAMPLE);
  assert.ok(towns.length >= 100, "the sample: " + towns.length);
  let figures = 0;
  for (const k of towns) for (const a of SAMPLE[k].indicators) {
    if (a.status !== "concern" && a.status !== "watch") { assert.equal(D.causeOf(a), null, `${k} ${a.id}: a figure that is not under treatment or follow-up has no cause`); continue; }
    figures++;
    const text = W.plainOf(D.causeOf(a) || []);
    assert.ok(/^כי .+\.$/.test(text), `${k} ${a.id} (${a.status}, ${(a.statusWhy || []).join("+")}): no cause in words`);
    for (const why of a.statusWhy) assert.ok({ rank: /רוב היישובים/, target: /ליעד/, worsening: /המגמה בהידרדרות/ }[why].test(text), `${k} ${a.id}: the cause "${why}" is said`);
  }
  assert.ok(figures >= 200, "the property looked at real figures: " + figures);
});

test("property: on both levels of the town page every row under what needs attention has its status line with a cause, and no good row has one", { skip }, async () => {
  const d = installDom();
  try {
    const X = await load("city/sections.js");
    let rows = 0;
    for (const [k, m] of Object.entries(SAMPLE)) for (const level of ["simple", "full"]) {
      const c = { key: k, level, kind: "full", name: m.city.name, toFull() {}, shareHref: () => "" };
      if (D.townKind(m) !== "full") continue;
      const weak = X.attentionSection(m, c), good = X.goodSection(m, c);
      for (const it of weak.findAll((e) => e.classes.has("n-home-item"))) {
        const st = it.find((e) => e.classes.has("n-home-rowst")); rows++;
        assert.ok(st, `${k} ${level}: a row under what needs attention has its status line`);
        assert.match(st.textContent, /^(דורש טיפול|למעקב) כי /, `${k} ${level}: the status word and its cause`);
        assert.equal(it.findAll((e) => e.classes.has("n-home-rowst")).length, 1);
      }
      for (const it of good.findAll((e) => e.classes.has("n-home-item"))) assert.equal(it.find((e) => e.classes.has("n-home-rowst")), null, `${k} ${level}: a good row has no status line`);
    }
    assert.ok(rows >= 300, "the property looked at real rows: " + rows);
  } finally { d.restore(); }
});

test("property: on the category page the row of a figure that needs attention says the same cause, in the words of the town page", { skip }, async () => {
  const d = installDom();
  try {
    const page = await load("pages/domain.js"), { h } = await import(pathToFileURL(path.join(ROOT, "web", "js", "ui.js")).href);
    let rows = 0;
    for (const [k, m] of Object.entries(SAMPLE)) {
      const need = m.indicators.filter((a) => (a.status === "concern" || a.status === "watch") && a.last && a.last.reliable !== false);
      if (!need.length) continue;
      const host = h("div.dm-figs", need.map((a) => h("a.row-item.dm-row", { href: `#/c/${k}/i/${a.id}` }, h("div.dm-rmain", h("h3.dm-name", a.id), h("p.dm-why", h("span.pill", D.statusWord(a.status)), " כי המצב חלש.")), h("div.dm-val"))));
      page.targetLines(host, m);
      for (const row of host.findAll((e) => e.classes.has("dm-row"))) {
        const a = need.find((x) => row.getAttribute("href").endsWith("/" + x.id)), why = row.find((e) => e.classes.has("dm-why")); rows++;
        assert.equal(why.textContent, `${D.statusWord(a.status)} ${W.plainOf(D.causeOf(a))}`, `${k} ${a.id}`);
      }
    }
    assert.ok(rows >= 200, "the property looked at real rows: " + rows);
  } finally { d.restore(); }
});

// ── the page ──
test("page: on both levels the rows under what needs attention say their cause above the way; the good rows say no status; the lede under the verdict is computed from the data", { skip }, async () => {
  const backend = (() => { const mm = new Map(); return { getItem: (k) => (mm.has(k) ? mm.get(k) : null), setItem: (k, v) => mm.set(k, String(v)), removeItem: (k) => mm.delete(k) }; })();
  const d = installDom({ storage: backend }), realFetch = globalThis.fetch;
  storage.use(backend);
  const CAUTION = "ביישובים שפונו במלחמה (למשל שדרות) ירידת העוני ב-2023-2024 משקפת ככל הנראה תשלומי פינוי ופיצויים שנספרו כהכנסה, ולא ירידה בצורך.";
  globalThis.fetch = fakeFetch({ "/api/meta": { domains: [], sources: { btl_poverty: { name: "דוח ממדי העוני והאי-שוויון בהכנסות", publisher: "המוסד לביטוח לאומי" } },
    indicators: [{ id: "pov_persons", label: "תחולת העוני בקרב נפשות", source: "btl_poverty", definition: "אחוז הנפשות ביישוב שההכנסה נטו שלהן נמוכה מקו העוני.", caution: CAUTION }] }, "/api/health": { ok: true } });
  try {
    const key = "1031", home = await load("city/home.js");
    for (const [level, query] of [["simple", ""], ["full", "v=full"]]) {
      const v = await home.cityHome({ key, model: cityModel(key), params: new URLSearchParams(query), go() {}, announce() {}, setTitle() {}, signal: undefined }, level === "simple" ? { level: "simple" } : {});
      const weak = v.node.find((e) => e.id === "n-sec-weak"), items = weak.findAll((e) => e.classes.has("n-home-item"));
      assert.ok(items.length >= 3, level);
      for (const it of items) {
        const box = it.find((e) => e.classes.has("n-home-says")), kids = box.children.filter((c) => c.classes && ["n-home-rowst", "n-home-way"].some((x) => c.classes.has(x)));
        assert.ok(kids[0].classes.has("n-home-rowst") && kids[1].classes.has("n-home-way"), level + ": the status line with its cause comes before the way");
        assert.match(kids[0].textContent, /^(דורש טיפול|למעקב) כי /);
      }
      const lede = v.node.find((e) => e.classes.has("n-home-offi")), o = M.officialOf(MODELS[key]);
      assert.ok(o.n >= 8 && lede, level + ": the lede is there for a town with figures that have an official target");
      assert.equal(lede.textContent.replace(/ /g, " "), W.plainOf(W.targetLede(o)));          // the page puts a no-break space after a colon
      assert.equal(v.node.findAll((e) => e.classes.has("n-home-way")).length, v.node.findAll((e) => e.classes.has("n-home-item")).length, level + ": every row still says which way is good");
      if (level === "full") {          // the background line of the head: the poverty figure stands with its year, and a tap opens the catalogue's caution, the source and the way to the figure's page
        const bg = v.band.find((e) => e.classes.has("n-home-bg")), btn = bg.find((e) => e.tagName === "BUTTON" && /3\.6/.test(e.textContent));
        assert.match(bg.textContent.replace(/ /g, " "), /תחולת העוני ב-2024: 3\.6%/);
        await btn.click(); await new Promise((r) => setTimeout(r, 100));
        const dlg = d.body.find((e) => e.tagName === "DIALOG"), say = dlg.textContent.replace(/⁠/g, "").replace(/ /g, " ");          // the page puts a word joiner before a number and a no-break space after a colon
        assert.ok(say.includes("תחולת העוני בקרב נפשות") && say.includes("מה צריך לדעת: " + CAUTION) && say.includes("מקור: המוסד לביטוח לאומי, דוח ממדי העוני והאי-שוויון בהכנסות."), "the dialog says what a reader must know and who publishes the figure");
        assert.ok(dlg.findAll((e) => e.tagName === "A").some((a) => a.getAttribute("href") === "#/c/1031/i/pov_persons"), "and links to the figure's page");
      }
    }
  } finally { await new Promise((r) => setTimeout(r, 1500)); d.restore(); storage.use(undefined); globalThis.fetch = realFetch; }          // a short wait: the page finishes its own later work before the fake document goes away
});

test("css: למעקב has one colour token in the ring and in the bars, the two ticks of a bar have two shapes, the short level keeps one sheet with the status lines", () => {
  const fs = require("node:fs"), css = (f) => fs.readFileSync(path.join(ROOT, "web", "css", "product", f), "utf8"), home = css("home.css"), domain = css("pages/domain.css");
  const ring = /STATUS_COLOR = \{[^}]*?watch: "var\((--[\w-]+)\)"/.exec(fs.readFileSync(path.join(ROOT, "web", "js", "viz", "core.js"), "utf8"));
  assert.ok(ring, "the ring's colour for a figure to follow");
  for (const [file, sel] of [[home, ".n-home-seg.is-watch"], [home, ".n-home-key.is-watch"], [domain, ".n-pg-domain-seg.is-watch"]]) assert.ok(file.includes(`${sel} { background: var(${ring[1]}); box-shadow: inset 0 0 0 1.5px var(--attn-bar); }`), `${sel} uses the ring's token ${ring[1]}, with the hairline that lifts the pale peach to 3:1 against the pale page (it was 1.5:1; pinned in product-chrome)`);
  // the target is a flag above the bar (a border shape, no fill), the country stays a stroke: not the same mark
  assert.match(domain, /\.dm-figs \.dm-tb-tick\.t \{[^}]*border-top: 9px solid var\(--c-target\)/); assert.match(domain, /\.dm-figs \.dm-tb-key i\.k-target \{[^}]*border-top: 8px solid var\(--c-target\)/);
  // print: the row with a status line is a three-row grid, the aside about the country and the ledes do not cost the sheet more than they must
  const print = home.slice(home.lastIndexOf("@media print"));
  assert.match(print, /\.n-home-item:has\(\.n-home-rowst\) \{[^}]*grid-template-areas: "w b" "s b" "s y" "s r"/); assert.match(print, /\.n-home-rowst \{[^}]*font-size: 8\.5pt/); assert.match(print, /\.n-home-tgt-aside \{ display: none; \}/);
  assert.match(domain, /@media print \{ html\[data-ui="n"\] \.n-pg-domain-tgt-aside \{ display: none; \} \}/);
});

test("the ledes are computed from the figures: the count of the official targets met in the town and in the country, and the sentence under what goes well only when a figure has no official target", { skip }, () => {
  const G = ["th_a", "th_b", "th_c"].map((id, i) => ind(id, { direction: "higher", guide: { judges: true, meets: i === 0, gap: i === 0 ? 2 : -12, value: 80, unit: "%", direction: "atLeast", text: "לפחות 80%" }, last: { v: i === 0 ? 82 : 68, nat: i === 2 ? 85 : 70, target: 80, meetsTarget: i === 0, gapTarget: i === 0 ? 2 : -12, level: 50 } }));
  assert.deepEqual(M.officialOf(town(...G)), { n: 3, town: 1, natN: 3, nat: 1 }, "one meets it in the town, one (the third) in the country");
  assert.deepEqual(M.officialOf(town(ind("x", { stale: true, status: "stale" }), ind("y"))), { n: 0, town: 0, natN: 0, nat: 0 }, "no figure with an official target: no lede");
  const noNat = ind("z", { direction: "higher", guide: { judges: true, meets: false, gap: -3, value: 80, unit: "%", direction: "atLeast", text: "לפחות 80%" }, last: { v: 77, nat: null, target: 80, meetsTarget: false, gapTarget: -3 } });
  assert.deepEqual(M.officialOf(town(...G, noNat)), { n: 4, town: 1, natN: 3, nat: 1 }, "a figure with no national average is left out of the country's count only");
  const withTarget = ind("t", { direction: "higher", guide: { judges: true, meets: true, gap: 1, value: 80, unit: "%", direction: "atLeast", text: "לפחות 80%" } }), none = ind("n");
  assert.equal(M.hasNoOfficial(withTarget), false); assert.equal(M.hasNoOfficial(none), true);
});
