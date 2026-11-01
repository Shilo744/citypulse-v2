// The town page (one level, the full one; the short level "במבט אחד" and its switch were retired on 2026-11-01): what the page chooses from (simple/model.js, words.js, no DOM), its honesty on the small and uncovered towns, its words,
// and that no address and no old choice brings the short level back. The page itself runs against the tiny fake document of tests/helpers/fake-dom.mjs; city/home.js and city/sections.js are the page.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { haveStore, model as cityModel } from "./helpers/city-models.mjs";
import { installDom, fakeFetch } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIMPLE = path.join(ROOT, "web", "js", "product", "simple");
const load = (f) => import(pathToFileURL(path.join(ROOT, "web", "js", "product", f)).href);
const M = await load("simple/model.js"), W = await load("simple/words.js"), storage = await load("storage.js"), config = await load("config.js");
const skip = !haveStore && "the built store is not there";
const TOWNS = ["1031", "9000", "3000", "5000", "4000", "1161", "2600", "2710", "6100", "2800", "7", "16", "472", "935", "99"];
const MODELS = {};
if (haveStore) for (const k of TOWNS) MODELS[k] = cityModel(k);
const have = (k) => !!MODELS[k];

const HE = "\\u0590-\\u05FF";
const FORBIDDEN_WHOLE = ["אנחנו", "לנו"], FORBIDDEN_PARTS = ["פרמטר", "מדאיג", "אחוזון", "מובהק", "המודל", "בסיס קטן", "{{", "z-score", "מקום "];
const forbidden = (t) => [...FORBIDDEN_WHOLE.filter((w) => new RegExp(`(^|[^${HE}])${w}($|[^${HE}])`).test(t)), ...FORBIDDEN_PARTS.filter((w) => t.includes(w))];
const sentences = (t) => String(t).split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const words = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

// every sentence the page builds itself from the model (catalogue labels and the recommendation headline are data, not prose: checked on their own)
function prose(m) {
  const v = M.verdictOf(m), name = m.city.name, out = [W.plainOf(W.verdictSegs(v, name))];
  if (v.kind === "full") {
    out.push(W.legendPlain(v.counts));
    const a = M.attentionOf(m), g = M.goodOf(m);
    out.push(W.T.noAttention, W.T.noGood, W.T.noNat, ...Object.values(W.T.way), ...Object.values(W.T.wayGood));
    if (a.total > a.rows.length) out.push(W.restLine(a.total - a.rows.length));
    const f = M.firstStep(m);
    if (f && f.row) out.push(W.plainOf(W.whyLine(f.row.label, f.row.town, f.row.nat, name, f.row.dir)));
  } else out.push(W.T.asIs, W.T.smallRow);
  out.push(...W.missingLines(M.missingOf(m, null)));
  return out;
}

// ── the level of the page: there is one, the full one (the short level and its switch were retired on 2026-11-01 at the owner's request) ──
test("one level: the choice of a level is gone (no pref module, no storage key, no privacy row) and the router renders the one page for both routes", () => {
  assert.ok(!fs.existsSync(path.join(SIMPLE, "pref.js")), "simple/pref.js is deleted");
  assert.equal(config.KEYS.view, undefined, "no storage key for a level");
  const priv = fs.readFileSync(path.join(ROOT, "web", "js", "product", "pages", "privacy.js"), "utf8");
  for (const name of Object.keys(config.KEYS)) assert.ok(new RegExp(`^\\s*${name}:\\s*\\{`, "m").test(priv), `privacy.js describes ${name}`);
  assert.ok(!/^\s*view:\s*\{/m.test(priv), "privacy.js does not describe a view choice any more");
  const routes = fs.readFileSync(path.join(ROOT, "web", "js", "product", "routes.js"), "utf8");
  assert.match(routes, /home: \{ load: \(ctx\) => townPage\(ctx\) \}/); assert.match(routes, /simple: \{ load: \(ctx\) => townPage\(ctx\) \}/);
  assert.ok(!/homeRedirect|level: "simple"/.test(routes), "no route sends a stored choice to another address or asks for a short level");
});

test("nav: simple is a sub-route of a town and survives a town switch", async () => {
  const nav = await load("nav.js");
  assert.equal(nav.classify(nav.parse("#/c/1031/simple").parts).id, "simple");
  assert.equal(nav.build({ key: "1031", sub: "simple" }), "#/c/1031/simple");
  assert.equal(await nav.switchTown("#/c/1031/simple", "9000"), "#/c/9000/simple");
});

// ── the choices of the page ──
test("sections: at most 3 rows under attention and 3 under what goes well, none judged on a small group, none stale", { skip }, () => {
  for (const k of TOWNS.filter(have)) {
    const m = MODELS[k], a = M.attentionOf(m), g = M.goodOf(m), byId = new Map(m.indicators.map((x) => [x.id, x]));
    assert.ok(a.rows.length <= 3 && g.rows.length <= 3, k);
    for (const r of [...a.rows, ...g.rows]) {
      const ind = byId.get(r.id);
      assert.ok(ind.last.reliable !== false && !ind.stale && ind.status !== "stale", `${k} ${r.id} is judged on enough cases`);
      assert.ok(["concern", "watch", "good", "strength"].includes(ind.status), `${k} ${r.id} ${ind.status}`);
    }
    for (const r of a.rows) assert.ok(["concern", "watch"].includes(byId.get(r.id).status), `${k} attention row ${r.id} needs attention`);
    for (const r of g.rows) assert.ok(["good", "strength"].includes(byId.get(r.id).status), `${k} good row ${r.id}`);
    assert.equal(new Set([...a.rows, ...g.rows].map((r) => r.id)).size, a.rows.length + g.rows.length, `${k}: a figure is in one list only`);
  }
});

test("attention rows are the home's weakest, in the same order; the good rows are the best first", { skip }, () => {
  const m = MODELS["1031"], D = null;
  void D;
  const a = M.attentionOf(m).rows.map((r) => r.id);
  assert.deepEqual(a, m.indicators.filter((x) => ["concern", "watch"].includes(x.status) && x.last && x.last.reliable !== false && !x.stale && typeof x.last.level === "number")
    .sort((x, y) => x.last.level - y.last.level || (y.priority || 0) - (x.priority || 0) || x.id.localeCompare(y.id)).slice(0, 3).map((x) => x.id));
  const g = M.goodOf(m).rows.map((r) => m.indicators.find((x) => x.id === r.id));
  assert.ok(g.length > 0);
  for (let i = 1; i < g.length; i++) assert.ok((g[i - 1].status === "strength") >= (g[i].status === "strength"), "strengths first");
});

test("a row says what is measured, both values with their unit, and which way is good; no rank, percentile or peer", { skip }, () => {
  const m = MODELS["1031"];
  for (const r of [...M.attentionOf(m).rows, ...M.goodOf(m).rows]) {
    assert.ok(r.label.length > 3, "the catalogue's full label");
    assert.ok(r.dir === "higher" || r.dir === "lower", r.id + " has a direction");
    assert.ok(r.town.n && (r.nat === null || r.nat.n));
    assert.ok(r.widths.town >= 0 && r.widths.town <= 100 && (r.widths.nat === null || (r.widths.nat >= 0 && r.widths.nat <= 100)));
    assert.deepEqual(Object.keys(r).filter((k) => /rank|level|peer|percent|z$/i.test(k)), [], "no rank-like field");
  }
  const w = M.barWidths("%", 50, 80); assert.deepEqual(w, { town: 50, nat: 80 });
  const d = M.barWidths("days", 46, 29); assert.equal(d.town, 100); assert.equal(d.nat, 63);
  assert.deepEqual(M.valueParts("%", 61.24), { n: "61.2%", w: "" }); assert.deepEqual(M.valueParts("days", 46), { n: "46", w: "ימים" }); assert.equal(M.valueParts("per100k", 5.7).w, "לכל 100,000");
});

test("the verdict: Sderot is full and says how many of the judged figures need treatment", { skip }, () => {
  const v = M.verdictOf(MODELS["1031"]);
  assert.equal(v.kind, "full");
  assert.equal(v.judged, v.counts.concern + v.counts.watch + v.counts.good);
  assert.equal(W.plainOf(W.verdictSegs(v, "שדרות")), `${v.counts.concern} מתוך ${v.judged} מדדי בריאות דורשים טיפול.`);
  const make = (c, w, g) => ({ kind: "full", counts: { concern: c, watch: w, good: g }, judged: c + w + g });
  assert.equal(W.plainOf(W.verdictSegs(make(0, 2, 3), "x")), "אף אחד מ-5 מדדי הבריאות אינו דורש טיפול.");
  assert.equal(W.plainOf(W.verdictSegs(make(1, 0, 4), "x")), "מדד בריאות אחד מתוך 5 דורש טיפול.");
  assert.equal(W.plainOf(W.verdictSegs(make(0, 0, 1), "x")), "מדד הבריאות היחיד שנבדק אינו דורש טיפול.");
  assert.equal(W.plainOf(W.verdictSegs(make(3, 0, 0), "x")), "כל 3 מדדי הבריאות דורשים טיפול.");
  assert.deepEqual(W.legendOf({ concern: 14, watch: 7, good: 5 }).map((x) => `${x.n} ${x.label}`), ["14 דורשים טיפול", "7 למעקב", "5 תקינים"]);
  assert.deepEqual(W.legendOf({ concern: 1, watch: 0, good: 1 }).map((x) => `${x.n} ${x.label}`), ["1 דורש טיפול", "1 תקין"]);
  assert.equal(W.restLine(1), "עוד מדד אחד דורש טיפול או מעקב."); assert.equal(W.restLine(18), "עוד 18 מדדים דורשים טיפול או מעקב.");
  assert.equal(W.leadOwner("ראש העיר או מנהל/ת מחלקת הבריאות, מול מנהלי הקופות"), "ראש העיר או מנהל/ת מחלקת הבריאות");
  assert.equal(W.leadOwner("מחלקת הבריאות העירונית בשיתוף לשכת הבריאות"), "מחלקת הבריאות העירונית");
});

test("honesty: a tiny town is never judged and shows the calm line and at most three numbers as they are; an uncovered town has no template", { skip }, () => {
  for (const k of ["16", "7"].filter(have)) {
    const m = MODELS[k], v = M.verdictOf(m);
    assert.equal(v.kind, "calm", k);
    assert.equal(W.plainOf(W.verdictSegs(v, m.city.name)), "יש מעט נתונים, ולכן קשה לשפוט.");
    assert.equal(M.attentionOf(m).rows.length, 0, k + " nothing to attend to"); assert.equal(M.goodOf(m).rows.length, 0, k + " nothing that goes well");
    assert.equal(M.firstStep(m), null, k + " no first step");
    const s = M.smallOf(m); assert.ok(s.length <= 3, k);
    for (const r of s) assert.ok(!("widths" in r) && !("dir" in r), "numbers as they are, no bars");
  }
  if (have("935")) {
    const m = MODELS["935"], v = M.verdictOf(m);
    assert.equal(v.kind, "uncovered");
    assert.match(W.plainOf(W.verdictSegs(v, m.city.name)), /אין נתונים רשמיים על/);
    assert.equal(M.attentionOf(m).rows.length + M.goodOf(m).rows.length, 0); assert.equal(M.firstStep(m), null);
  }
  if (have("472")) {
    const m = MODELS["472"], ids = [...M.attentionOf(m).rows, ...M.goodOf(m).rows].map((r) => r.id);
    for (const x of m.indicators.filter((i) => i.last && i.last.reliable === false || i.stale)) assert.ok(!ids.includes(x.id), "472: " + x.id + " is small or stale and stays out of both lists");
  }
});

test("missing: the count comes from the coverage, at most three examples, taken from the figures that are missing", { skip }, () => {
  const m = MODELS["1031"], meta = { indicators: m.coverage.missing.map((id, i) => ({ id, short: "מדד " + i, label: "מדד ארוך " + i, direction: "higher", importance: 3 - (i % 3) })).concat([{ id: "x_not_missing", short: "לא חסר", direction: "higher", importance: 9 }]) };
  const r = M.missingOf(m, meta);
  assert.equal(r.missing, m.coverage.total - m.coverage.have); assert.ok(r.examples.length <= 3 && r.examples.length > 0); assert.ok(!r.examples.includes("לא חסר"));
  assert.deepEqual(M.missingOf(m, null).examples, []);
  assert.deepEqual(W.missingLines({ missing: 6, small: 0, examples: ["א", "ב", "ג"] }), ["אין נתונים על 6 מדדים.", "למשל: א, ב וג."]);
  assert.deepEqual(W.missingLines({ missing: 1, small: 1, examples: [] }), ["אין נתונים על מדד אחד.", "במדד אחד יש מעט מקרים, ולכן הוא לא נשפט."]);
  assert.deepEqual(W.missingLines({ missing: 0, small: 0, stale: 2, examples: [] }), ["ב-2 מדדים הנתון ישן, ולכן הם לא נשפטו."]);
  assert.equal(W.plainLabel("פעוטות שחוסנו נגד חצבת, חזרת ואדמת (MMR/MMRV) עד גיל 13 חודשים"), "פעוטות שחוסנו נגד חצבת, חזרת ואדמת עד גיל 13 חודשים");
  assert.equal(W.plainLabel("ילדים שנבדקו (גיל 2–3)"), "ילדים שנבדקו (גיל 2–3)");
  assert.equal(W.plainLabel("שיעור חולי סוכרת מתוקנן לגיל"), "שיעור חולי סוכרת בהתאמה לגיל התושבים");
  assert.equal(W.whenOf("מהיר (עד 6 חודשים)"), "עד 6 חודשים"); assert.equal(W.whenOf("אסטרטגי (מעל שנה וחצי)"), "מעל שנה וחצי");
  assert.deepEqual(W.missingLines({ missing: 0, small: 0, examples: [] }), []);
});

// ── the words ──
test("words: every sentence of every town has at most 14 words and no forbidden word, no rank or percentile", { skip }, () => {
  const bad = [];
  for (const k of TOWNS.filter(have)) for (const t of prose(MODELS[k])) {
    for (const s of sentences(t)) { if (words(s) > 14) bad.push(`${k}: ${words(s)} words: ${s}`); const f = forbidden(s); if (f.length) bad.push(`${k}: ${f.join(",")} in ${s}`); }
  }
  assert.deepEqual(bad, []);
});

test("words: the recommendation headline, the label of a row and the owner stay short enough to read", { skip }, () => {
  const bad = [];
  for (const k of TOWNS.filter(have)) {
    const m = MODELS[k], f = M.firstStep(m);
    if (f) { if (words(f.headline) > 20) bad.push(`${k} headline: ${f.headline}`); if (words(f.who) > 14) bad.push(`${k} who: ${f.who}`); }
    for (const r of [...M.attentionOf(m).rows, ...M.goodOf(m).rows]) if (words(r.label) > 14) bad.push(`${k} label: ${r.label}`);
  }
  assert.deepEqual(bad, []);
});

test("source files: no forbidden word in a string, no hex colour, no location.hash write, no ltr() around Hebrew words, no rank vocabulary; the style of the page", () => {
  const files = [...fs.readdirSync(SIMPLE).filter((x) => x.endsWith(".js")).map((f) => path.join(SIMPLE, f)), path.join(ROOT, "web", "js", "product", "city", "sections.js"), path.join(ROOT, "web", "js", "product", "city", "home.js")];
  for (const file of files) {
    const f = path.basename(file), src = fs.readFileSync(file, "utf8"), code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
    for (const s of [...code.matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((x) => x[1] || x[2] || "").filter((x) => /[֐-׿]/.test(x))) assert.deepEqual(forbidden(s), [], `${f}: ${s.slice(0, 40)}`);
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(code.replace(/href[:=]\s*["'`]#/g, "").replace(/"#\/[^"]*"|`#\/[^`]*`/g, "")), f + " hex");
    assert.ok(!/location\.hash\s*=[^=]/.test(code), f + " location.hash");
    assert.ok(!/ltr\(\s*["'`][^"'`]*[֐-׿]/.test(code), f + " ltr() around Hebrew");
    assert.ok(!/replaceQuery\(/.test(code), f + " does not move the query of the address for a section");
  }
  const css = fs.readFileSync(path.join(ROOT, "web", "css", "product", "home.css"), "utf8");
  assert.ok(!/border-(inline|left|right)-(start|end)?\s*:\s*[3-9]px|@keyframes/.test(css), "no side stripe, no keyframes");
  assert.ok(/--n-home-fs: 1\.125rem/.test(css) && /line-height: 1\.7/.test(css) && /max-width: 680px/.test(css), "18 px body on the short level, line height 1.7, 680 px column");
  assert.ok(/@media print/.test(css) && /\.n-home-sw\b/.test(css));
  assert.ok(!/n-home-(tab|rail|counter|skip|panel)\b/.test(css), "the tab rail is gone from the style");
});

// ── the page itself, on the fake document ──
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
// params: the query of the address; backend: the fake storage
async function render(key, { params = "", backend = memory() } = {}) {
  const d = installDom({ storage: backend }), realFetch = globalThis.fetch, said = [], titles = [];
  storage.use(backend);
  const base = fakeFetch({ "/api/meta": { domains: [], sources: {}, indicators: (MODELS[key].coverage.missing || []).map((id) => ({ id, short: "מדד חסר " + id.length, direction: "higher", importance: 2 })) }, "/api/health": { ok: true } });
  globalThis.fetch = async (url) => (/\/indicator\//.test(String(url)) ? { ok: false, status: 404, json: async () => ({}) } : base(url));          // the strip chart of the similar-towns section asks for a figure: answered at once, so that nothing is left to draw after the test
  const restore = () => { d.restore(); storage.use(undefined); globalThis.fetch = realFetch; };
  try {
    const home = await load("city/home.js");
    const v = await home.cityHome({ key, model: MODELS[key], params: new URLSearchParams(params), go() {}, announce: (t) => said.push(t), setTitle: (t) => titles.push(t), signal: undefined });
    await tick(90);          // the answers that read the catalogue finish their drawing while the fake document is still there
    const body = v.node.find((e) => e.classes.has("n-home-body"));
    return { d, v, node: v.node, band: v.band, body, backend, said, titles, text: v.node.textContent, restore,
      sections: () => body.findAll((e) => e.tagName === "SECTION" && /^n-sec-/.test(e.id)).map((e) => e.id), h2: () => body.findAll((e) => e.tagName === "H2").map((e) => e.textContent),
      sw: () => v.band.find((e) => e.classes.has("n-home-sw")) };
  } catch (e) { restore(); throw e; }
}
const headingTexts = (node, tag) => node.findAll((e) => e.tagName === tag).map((e) => e.textContent);
const sec = (r, id) => r.body.find((e) => e.id === id);
const items = (node) => node.findAll((e) => e.classes.has("n-home-item"));

test("one level: ?v=simple, ?q=simple and an old stored choice change nothing; the page has no switch and writes nothing for a level", { skip }, async () => {
  const base = await render("1031"), want = { sections: base.sections(), h2: base.h2() };
  try { assert.equal(base.v.active, "home"); assert.equal(base.v.title, "בריאות בשדרות"); assert.deepEqual(headingTexts(base.band, "H1"), ["שדרות"]); assert.equal(headingTexts(base.node, "H1").length, 0, "the h1 is in the band, once"); } finally { base.restore(); }
  assert.deepEqual(want.sections, ["n-sec-state", "n-sec-good", "n-sec-weak", "n-sec-changed", "n-sec-peers", "n-sec-first", "n-sec-missing"]);
  const old = memory(); old.m.set("cp2-view-2", "simple");
  for (const opts of [{ params: "v=simple" }, { params: "v=full" }, { params: "q=simple" }, { backend: old }]) {
    const r = await render("1031", opts);
    try {
      const what = opts.params || "an old stored choice";
      assert.equal(r.node.getAttribute("data-level"), "full", what);
      assert.deepEqual(r.sections(), want.sections, what); assert.deepEqual(r.h2(), want.h2, what);
      assert.equal(r.sw(), null, what + ": no level switch"); assert.equal(r.band.findAll((e) => e.tagName === "NAV").length, 0, what + ": no nav in the head");
      assert.ok(!/במבט אחד/.test(r.text + r.band.textContent), what + ": the page does not offer a short level");
      assert.equal(r.backend.m.get("cp2-view-2"), opts.backend ? "simple" : undefined, what + ": the page neither reads nor writes a level");
      assert.ok(!r.band.find((e) => e.classes.has("n-band-ask")).hidden, what + ": the question field is always there");
    } finally { r.restore(); }
  }
});

test("full level: the same story in the same order, the by-category rows, attention under the four categories, changed, peers, what to do, the index, the head lines", { skip }, async () => {
  const r = await render("1031"), m = MODELS["1031"], v = M.verdictOf(m);
  try {
    assert.equal(r.v.title, "בריאות בשדרות"); assert.equal(r.node.getAttribute("data-level"), "full");
    assert.deepEqual(r.sections(), ["n-sec-state", "n-sec-good", "n-sec-weak", "n-sec-changed", "n-sec-peers", "n-sec-first", "n-sec-missing"], "the order of the story");
    assert.deepEqual(r.h2().slice(0, 7), [r.h2()[0], "מה הולך טוב", "מה דורש תשומת לב", "מה השתנה", "איך מול יישובים דומים", "מה כדאי לעשות", "על מה אין מידע"]);
    // the categories: the four of the menu, never the background, the sum of their counts is the verdict
    const cats = r.node.findAll((e) => e.classes.has("n-home-cat")), catLinks = cats.map((c) => c.find((e) => e.tagName === "A").attrs.href);
    assert.deepEqual(catLinks.sort(), ["#/c/1031/d/child", "#/c/1031/d/mental", "#/c/1031/d/outcomes", "#/c/1031/d/safety"]);
    assert.ok(!catLinks.some((l) => /context/.test(l)));
    const byId = Object.fromEntries(m.domains.map((d) => [d.id, d]));
    let sumK = 0;
    for (const c of cats) {
      const d = byId[c.find((e) => e.tagName === "A").attrs.href.split("/d/")[1]], cn = d.counts, judged = cn.concern + cn.watch + cn.good + cn.strength; sumK += cn.concern;
      assert.equal(c.find((e) => e.classes.has("n-home-cat-say")).textContent, W.plainOf(W.catSegs(cn.concern, judged)), d.id);
    }
    assert.equal(sumK, v.counts.concern, "the categories add up to the verdict");
    // attention: every figure that needs treatment or follow-up, once, under its category, the categories as links, nothing from the background
    const weak = sec(r, "n-sec-weak"), all = M.attentionOf(m, Infinity), rows = items(weak);
    assert.equal(rows.length, all.total, "every one, grouped"); assert.ok(all.total > 3);
    assert.equal(new Set(rows.map((x) => x.find((e) => e.tagName === "A").attrs.href)).size, rows.length, "a figure once");
    const groups = weak.findAll((e) => e.classes.has("n-home-grp"));
    assert.ok(groups.length >= 2 && groups.length <= 4); for (const g of groups) assert.match(g.find((e) => e.tagName === "A").attrs.href, /^#\/c\/1031\/d\/(child|outcomes|mental|safety)$/);
    assert.match(weak.textContent, new RegExp(`${all.total} מדדים דורשים טיפול או מעקב\\. ${v.counts.concern} דורשים טיפול ו-${v.counts.watch} למעקב`));
    assert.ok(items(sec(r, "n-sec-good")).length <= 6);
    assert.equal(sec(r, "n-sec-first").findAll((e) => e.classes.has("n-home-step")).length, 3, "the first three recommendations");
    assert.ok(sec(r, "n-sec-first").findAll((e) => e.tagName === "A").some((a) => a.attrs.href === "#/c/1031/actions" && /לכל ההמלצות/.test(a.textContent)), "the link to the plan page");
    // the index: text links to the sections that exist; no capsules
    const idx = r.node.find((e) => e.classes.has("n-home-index")), idxLinks = idx.findAll((e) => e.tagName === "A");
    assert.equal(idx.tagName, "NAV"); assert.ok(idx.getAttribute("aria-label")); assert.deepEqual(idxLinks.map((a) => a.textContent), ["מה הולך טוב", "מה דורש תשומת לב", "מה השתנה", "איך מול יישובים דומים", "מה כדאי לעשות", "על מה אין מידע"]);
    assert.deepEqual(idxLinks.map((a) => a.attrs.href), ["#/c/1031", "#/c/1031?q=weak", "#/c/1031?q=changed", "#/c/1031?q=peers", "#/c/1031?q=first", "#/c/1031?q=missing"]);
    // the head: basis, background, the question field with its suggestions, welcome lines, the actions
    const bandText = r.band.textContent.replace(/[ ⁠⁦⁩]/g, (c) => (c === " " ? " " : ""));
    assert.match(bandText, /יש נתונים על 35 מתוך 41 מדדים/); assert.match(bandText, /רקע על היישוב: גידול האוכלוסייה ב-5 שנים עד 2024: 30.5%/); assert.match(bandText, /תחולת העוני ב-2024: 3.6%/);
    assert.equal(r.band.findAll((e) => e.tagName === "BUTTON" && e.classes.has("n-kit-term") && /3.6%/.test(e.textContent)).length, 1, "the poverty figure stands with its year and opens what a reader must know about it"); assert.ok(r.node.find((e) => e.classes.has("n-home-welcome")) || r.body.find((e) => e.classes.has("n-home-welcome")));
    assert.ok(r.band.find((e) => e.classes.has("n-home-ask-in")) && !r.band.find((e) => e.classes.has("n-band-ask")).hidden);
    assert.ok(r.band.findAll((e) => e.tagName === "A").some((a) => a.attrs.href === "#/c/1031/d/context"), "the background line links to the background page");
    assert.ok(r.band.findAll((e) => e.tagName === "A").some((a) => a.attrs.href === "#/c/1031/brief" && /הדפסת דוח/.test(a.textContent)), "the print-the-report link");
    assert.ok(r.band.findAll((e) => e.tagName === "A").some((a) => /export\.csv/.test(a.attrs.href)), "the town's file");
    const bad = forbidden(r.text).filter((w) => w !== "מקום ");          // the full level may say the place among all towns, in the rank form
    assert.ok(bad.length === 0, bad.join());
  } finally { r.restore(); }
});

test("kinds of town: a tiny town gets the calm line and the numbers as they are, an uncovered town the no-data spot; neither has a template of empty parts or a level switch", { skip }, async () => {
  for (const k of ["16", "935"].filter(have)) {
    const r = await render(k);
    try {
      assert.deepEqual(headingTexts(r.band, "H1"), [MODELS[k].city.name]);
      const h2 = r.h2();
      assert.ok(!h2.includes("מה דורש תשומת לב") && !h2.includes("מה הולך טוב") && !h2.includes("מה כדאי לעשות"), k + " has no judged parts");
      if (k === "16") { assert.equal(h2[0], "יש מעט נתונים, ולכן קשה לשפוט."); assert.equal(r.node.findAll((e) => e.classes.has("n-home-seg")).length, 0, "no bar"); assert.ok(sec(r, "n-sec-small")); assert.ok(!r.sections().includes("n-sec-peers") && !r.sections().includes("n-sec-changed") && !r.sections().includes("n-sec-first")); }
      else { assert.match(h2[0], /אין נתונים רשמיים על/); assert.ok(r.node.find((e) => e.classes.has("n-band-spot")), "the calm spot"); assert.deepEqual(r.sections(), ["n-sec-state"]); assert.ok(r.band.find((e) => e.classes.has("n-home-ask-in")).attrs.disabled !== undefined, "the question field is off"); }
      assert.equal(r.sw(), null, k + ": no level switch");
      assert.equal(r.node.findAll((e) => e.classes.has("n-home-index")).length, 0, "too few sections for an index");
    } finally { r.restore(); }
  }
});

test("a very small town: no rank, no comparison with the nation or similar towns; the page says why a small group is not judged", { skip }, async () => {
  const strip = (t) => t.replace(/[⁦-⁩‎‏]/g, "");
  for (const k of ["16", "7"].filter(have)) {
    const r = await render(k);
    try {
      assert.ok(!/מקום d|טוב מ-|חלש יותר מ|יישובים דומים/.test(strip(r.body.textContent)), k + ": nothing is ranked or compared");
      assert.match(strip(sec(r, "n-sec-small").textContent), /קבוצה קטנה/, k + ": the page says why");
      assert.ok(!r.band.find((e) => e.classes.has("n-home-lines")).hidden);
    } finally { r.restore(); }
  }
});

test("page: it renders with storage blocked", { skip }, async () => {
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  for (const params of ["v=simple", "v=full", ""]) { const r = await render("1031", { backend: blocked, params }); try { assert.deepEqual(headingTexts(r.band, "H1"), ["שדרות"]); } finally { r.restore(); } }
});

test("the footer's how-to-read event shows the welcome lines again, on the page that is already open", { skip }, async () => {
  const seen = memory(); seen.m.set("cp2-welcome-n", "1");
  const r = await render("1031", { backend: seen });
  try {
    const welcome = r.body.find((e) => e.classes.has("n-home-welcome"));
    assert.ok(welcome.hidden, "dismissed for good on an earlier visit");
    await globalThis.window.fire("n-howto");
    assert.ok(!welcome.hidden, "the welcome lines are shown again");
    await tick(90);          // what the sections still read finishes while the fake document is there
  } finally { r.restore(); }
});

test("?q=weak|changed|peers|first|missing focuses the heading of that section after the render; a section that is not there leaves the page where it is", { skip }, async () => {
  for (const [q, id] of [["weak", "n-sec-weak"], ["changed", "n-sec-changed"], ["peers", "n-sec-peers"], ["first", "n-sec-first"], ["missing", "n-sec-missing"]]) {
    const r = await render("1031", { params: "q=" + q });
    try { await tick(40); assert.equal(r.d.doc.activeElement && r.d.doc.activeElement.id, id + "-h", q); } finally { r.restore(); }
  }
  for (const [key, q] of [["16", "peers"], ["16", "first"], ["1031", "nonsense"]]) {
    if (!have(key)) continue;
    const r = await render(key, { params: "q=" + q });
    try { await tick(40); assert.equal(r.d.doc.activeElement, null, key + " ?q=" + q + ": nothing moved"); } finally { r.restore(); }
  }
});

test("counts agree: the verdict, the legend, the categories and the attention lead are the same figures, for every kind of town", { skip }, async () => {
  for (const k of TOWNS.filter(have)) {
    const m = MODELS[k], v = M.verdictOf(m), r = await render(k);
    try {
      if (v.kind !== "full") continue;
      assert.equal(r.h2()[0], W.plainOf(W.verdictSegs(v, m.city.name)), k);
      const legend = r.node.find((e) => e.classes.has("n-home-legend"));
      assert.equal(legend.getAttribute("aria-label"), W.legendPlain(v.counts), k);
      const segs = r.node.findAll((e) => e.classes.has("n-home-seg")).filter((e) => !e.parentNode.classes.has("is-small"));
      assert.equal(segs.length, W.legendOf(v.counts).length, k);
      const att = M.attentionOf(m, Infinity);
      assert.equal(items(sec(r, "n-sec-weak")).length, att.rows.length, k);
      const concern = att.rows.filter((x) => m.indicators.find((a) => a.id === x.id).status === "concern").length;
      assert.ok(concern <= v.counts.concern && att.total <= v.counts.concern + v.counts.watch, k);
      assert.equal(r.node.findAll((e) => e.classes.has("n-home-cat")).length, m.domains.filter((d) => !d.background && d.indicators.length).length, k + ": one row per category of the menu");
    } finally { r.restore(); }
  }
});

// ── the plain-language pass (sv2) ──
test("plain words: no sentence of the page is cut with an ellipsis, no Latin code or machine phrase is left in what a resident reads", { skip }, () => {
  const bad = [];
  for (const k of TOWNS.filter(have)) {
    const m = MODELS[k], f = M.firstStep(m);
    if (f && /…/.test(f.headline)) bad.push(k + " headline: " + f.headline);
    if (f && /^(מהיר|בינוני|אסטרטגי)/.test(f.when)) bad.push(k + " when: " + f.when);
    for (const r of [...M.attentionOf(m).rows, ...M.goodOf(m).rows, ...M.smallOf(m)]) if (/[A-Za-z]/.test(r.label) || /מתוקנן/.test(r.label)) bad.push(k + " label: " + r.label);
    for (const line of [...W.missingLines(M.missingOf(m, null)), ...prose(m)]) if (/[A-Za-z]{3,}/.test(line) || /שפטנו|לנו/.test(line)) bad.push(k + " line: " + line);
  }
  assert.deepEqual(bad, []);
});

test("good rows: a figure with a national value to compare with comes before one without", { skip }, () => {
  for (const k of TOWNS.filter(have)) {
    const rows = M.goodOf(MODELS[k]).rows, first = rows.findIndex((r) => !r.nat);
    if (first >= 0) assert.ok(rows.slice(first).every((r) => !r.nat), k + ": rows with a national value come first");
  }
});

test("first step: the why line names the figure, both values and which way is good", { skip }, () => {
  const f = M.firstStep(MODELS["1031"]), line = W.plainOf(W.whyLine(f.row.label, f.row.town, f.row.nat, "שדרות", f.row.dir));
  assert.match(line, /^למה: [^.]+\. בשדרות .+, בארץ .+\. (גבוה|נמוך) יותר זה טוב\.$/);
  assert.ok(!/[A-Za-z]/.test(line));
});

test("small towns: every figure of a small group is on the page, the rest behind a counted \"more\", never hidden", { skip }, async () => {
  for (const k of ["16", "7"].filter(have)) {
    const r = await render(k);
    try {
      const small = MODELS[k].indicators.filter((a) => a.last && a.last.reliable === false && typeof a.last.v === "number" && Number.isFinite(a.last.v));
      const rows = sec(r, "n-sec-small").findAll((e) => e.tagName === "LI" && e.parentNode && e.parentNode.classes.has("n-home-sm"));
      assert.equal(rows.length, small.length, k + ": every small figure has its row");
      if (small.length > 6) assert.match(sec(r, "n-sec-small").textContent, new RegExp("עוד " + (small.length - 6)), k + ": the rest is counted");
    } finally { r.restore(); }
  }
});
