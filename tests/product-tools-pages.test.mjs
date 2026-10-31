// The four tool pages of the product (web/js/product/pages/{ask,actions,coverage,method}.js): each adapter takes the old module's node and gives back a band and the same body.
// The old pages are stood in for by small trees with the same class names (the adapters only read those); the adapters run against tests/helpers/fake-dom.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installDom } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = path.join(ROOT, "web", "js", "product");
const load = (f) => import(pathToFileURL(path.join(PROD, f)).href);
const { h } = await import(pathToFileURL(path.join(ROOT, "web", "js", "ui.js")).href);
const ask = await load("pages/ask.js"), actions = await load("pages/actions.js"), coverage = await load("pages/coverage.js"), method = await load("pages/method.js");
const dom = async (fn) => { const d = installDom(); try { await fn(d); } finally { d.restore(); } };
const MODEL = { city: { key: "1031", name: "שדרות" } };
const ctx = (model = MODEL) => ({ key: model && model.city.key, model, announce(t) { this.said = t; }, go() {} });
const pressed = (b) => b.getAttribute("aria-pressed");

// ── ask ──
function oldAsk() {
  const input = h("input#as-q", { type: "text" }), form = h("form.as-field", { role: "search" }, input, h("button.as-send", { type: "submit" }, "שאלו"));
  const sent = []; form.requestSubmit = () => sent.push(input.value);
  const input2 = h("input#as-q2", { type: "text" }), again = h("form.as-field.is-compact", input2);
  const root = h("div.as", h("section.hero.as-hero", h("h1", "מה תרצו"), form), h("p.sr", { role: "status" }), h("div.as-thread", h("h2.as-title", "מה מצב {{city}}?"), h("p", "הפרמטרים של {{city}}")), again);
  return { root, input, form, sent, again, input2 };
}

test("ask: the answer title and every text pass the token filler, the answers pass the vocabulary guard", async () => dom(async () => {
  const o = oldAsk(), v = ask.adapt(o.root, ctx());
  assert.ok(v.band && v.node === o.root);
  const title = o.root.find((e) => e.classes.has("as-title"));
  assert.equal(title.textContent, "מה מצב שדרות?");
  assert.ok(!o.root.textContent.includes("{{"));
  assert.match(o.root.find((e) => e.tagName === "P" && e.textContent.startsWith("המדדים")).textContent, /^המדדים של שדרות$/);
}));

test("ask: the band has the one h1, the back link, the shared field, the AI line and the privacy line; the old opening is hidden and not a second h1", async () => dom(async () => {
  const o = oldAsk(), { band } = ask.adapt(o.root, ctx());
  const h1s = [...band.findAll((e) => e.tagName === "H1"), ...o.root.findAll((e) => e.tagName === "H1" && e.getAttribute("role") !== "heading")];
  assert.equal(h1s.length, 1);
  assert.equal(h1s[0].textContent, "מה תרצו לדעת על שדרות?");
  const back = band.find((e) => e.classes.has("n-band-back"));
  assert.ok(back && back.getAttribute("href") === "#/c/1031" && /חזרה לשאלות/.test(back.textContent));
  assert.ok(band.find((e) => e.classes.has("n-entry-ask")), "the field of entry/askfield.js");
  assert.ok(band.textContent.includes("התשובה מנוסחת בבינה מלאכותית ומבוססת על מספרי המערכת בלבד."));
  assert.ok(o.root.find((e) => e.classes.has("as-hero")).hidden);
}));

test("ask: a sample question and the new field send through the old form, one request path", async () => dom(async () => {
  const o = oldAsk(), { band } = ask.adapt(o.root, ctx());
  const rows = o.root.findAll((e) => e.tagName === "BUTTON" && e.parentNode && e.parentNode.tagName === "LI");
  assert.equal(rows.length, 6, "six sample questions");
  await rows[0].click();
  assert.deepEqual(o.sent, ["איפה המצב הכי חלש בשדרות?"]);
  const input = band.find((e) => e.id === "n-pg-ask-q");
  input.value = "מה השתנה?"; await band.find((e) => e.classes.has("n-entry-ask")).fire("submit");
  assert.deepEqual(o.sent.slice(1), ["מה השתנה?"]);
  for (const r of rows) assert.ok(!/אנחנו|לנו|העיר הכי/.test(r.textContent), "third person, no 'we'");
}));

test("ask: an empty send in the field under the answer says what to write and sets aria-invalid", async () => dom(async () => {
  const o = oldAsk(); ask.adapt(o.root, ctx());
  let stopped = false;
  await o.root.on.submit[0]({ target: o.again, preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
  assert.ok(stopped); assert.equal(o.input2.getAttribute("aria-invalid"), "true");
  assert.equal(o.again.nextElementSibling.textContent, "כתבו שאלה, למשל: איך החיסונים בשדרות?");
  o.input2.value = "שאלה";
  stopped = false; await o.root.on.submit[0]({ target: o.again, preventDefault() {}, stopImmediatePropagation() { stopped = true; } });
  assert.ok(!stopped, "a field with text goes on to the old handler");
}));

// ── actions ──
test("actions: the old tinted header becomes the pale band; the score explanation is a details element", async () => dom(async () => {
  const head = h("section.band.ac-head.rv", h("div.ac-head-top", h("h1.ac-h1", "מה כדאי לעשות בשדרות")), h("div.keyfigs.ac-kf", h("div.keyfig", "5"), h("div.keyfig", "3"), h("div.keyfig", "1")),
    h("p.ac-how", h("b", "איך נקבע הציון: "), "העדיפות נגזרת מחומרת הממצאים. ", h("a", { href: "#/c/1031/method" }, "שיטה ומקורות")));
  const root = h("div.ac", head, h("section.sec.ac-roadmap"));
  const v = actions.adapt(root, ctx());
  assert.equal(v.band, head);
  assert.ok(head.classes.has("n-band") && !head.classes.has("band") && !head.classes.has("rv"));
  assert.ok(!root.find((e) => e === head), "the header left the body");
  const det = head.find((e) => e.tagName === "DETAILS");
  assert.ok(det && det.find((e) => e.tagName === "SUMMARY").textContent === "איך נקבע הציון");
  assert.ok(!det.textContent.includes("איך נקבע הציון: "), "the label moved to the summary");
  assert.ok(det.find((e) => e.tagName === "A"), "the link to the method survives");
  assert.equal(head.findAll((e) => e.classes.has("keyfig")).length, 3, "the three horizon numerals stay in the band");
}));

test("actions: each horizon numeral reads name, number, range; the range is one piece; the band has the way back to the town", async () => dom(async () => {
  const item = (name, range, n) => h("div.keyfig.ac-kf-item", h("span.kf-label", h("b", name), " · ", range), h("b.kf-num", String(n), h("small", "המלצות")), h("span.kf-delta", "הציון הגבוה ביותר: 80"));
  const head = h("section.band.ac-head.rv", h("div.ac-head-top", h("div", h("div.ac-eyebrow", "תוכנית פעולה"), h("h1.ac-h1", "מה כדאי לעשות בשדרות"))),
    h("div.keyfigs.ac-kf", item("מהיר", "עד 6 חודשים", 5), item("בינוני", "6–18 חודשים", 3), item("אסטרטגי", "מעל שנה וחצי", 1)));
  const root = h("div.ac", head), v = actions.adapt(root, ctx());
  const items = v.band.findAll((e) => e.classes.has("ac-kf-item"));
  assert.deepEqual(items.map((e) => e.find((x) => x.classes.has("kf-label")).textContent), ["מהיר", "בינוני", "אסטרטגי"], "the label is the name alone");
  assert.deepEqual(items.map((e) => e.find((x) => x.classes.has("n-pg-actions-range")).textContent.replace(/ /g, " ")), ["עד 6 חודשים", "6–18 חודשים", "מעל שנה וחצי"]);
  const kids = items[1].children.map((e) => [...e.classes][0]);
  assert.ok(kids.indexOf("kf-num") < kids.indexOf("n-pg-actions-range"), "the number comes before its range");
  const back = v.band.find((e) => e.classes.has("n-pg-actions-back"));
  assert.equal(back.getAttribute("href"), "#/c/1031");
}));

test("actions: a page without the old header is left as it is", async () => dom(async () => {
  const root = h("div.ac"); assert.equal(actions.adapt(root, ctx()), root);
}));

// ── coverage ──
function oldCoverage() {
  const fig = (n, l) => h("div.keyfig", h("b.kf-num", String(n)), h("span.kf-label", l));
  const row = (kind, name, state, value) => h("li.cv-row.k-" + kind, h("div.cv-name", h("a", { href: "#/c/1031/i/" + (kind === "missing" ? "y" : "x") }, name), h("small", "הערה")), h("div.cv-res", h("span.cv-state", state), value ? h("b", value) : null), h("div.cv-src", h("a", { href: "https://example.org" }, "משרד הבריאות")));
  const imm = h("section.cv-sec", h("h2.cv-domain", "חיסונים", h("small", " · 1 מתוך 2")), h("ul.cv-list", row("found", "חצבת", "נמצא", "95% · 2024"), row("missing", "שעלת", "לא נמצא")));
  const env = h("section.cv-sec", h("h2.cv-domain", "סביבה"), h("ul.cv-list", row("small", "רעש", "נמצא, קבוצה קטנה", "3% · 2023")));
  return h("div.cv", h("header.cv-head", h("div.sec-eyebrow", "בדיקת כיסוי"), h("h1.sec-title", "מה המערכת מצאה על שדרות"), h("p.sec-lead", "בדקנו 41 מדדים")),
    h("div.keyfigs.cv-figs", fig(1, "נמצא נתון"), fig(1, "נמצא, קבוצה קטנה"), fig(1, "לא נמצא"), fig(10, "מקורות שנתנו נתון")), imm, env);
}

test("coverage: the band has the h1, the CSV button and the four numerals; the first three filter the list and a second press shows all", async () => dom(async () => {
  const root = oldCoverage(), v = coverage.adapt(root, ctx());
  assert.equal(v.band.findAll((e) => e.tagName === "H1").length, 1);
  const file = v.band.find((e) => e.classes.has("n-kit-act") && /הורדת רשימת הכיסוי/.test(e.textContent));
  assert.ok(file, "the file button says what the file holds: the coverage list");
  assert.ok(!/CSV/.test(file.textContent) && /\(קובץ CSV\)$/.test(file.getAttribute("aria-label")), "the file type is said once, in the name the screen reader hears");
  const figs = v.band.findAll((e) => e.classes.has("keyfig"));
  assert.equal(figs.length, 4);
  const btns = v.band.findAll((e) => e.tagName === "BUTTON" && e.classes.has("n-pg-coverage-fig"));
  assert.equal(btns.length, 3);
  const off = () => root.findAll((e) => e.classes.has("cv-row") && e.classes.has("n-pg-coverage-off")).map((e) => e.textContent.slice(0, 4));
  await btns[2].click();                                   // "לא נמצא"
  assert.equal(pressed(btns[2]), "true"); assert.equal(off().length, 2);
  assert.equal(root.findAll((e) => e.classes.has("cv-sec") && e.classes.has("n-pg-coverage-off")).length, 1, "the domain with nothing left is out");
  assert.match(v.band.find((e) => e.classes.has("n-pg-coverage-status")).textContent, /מוצג מדד אחד מתוך 3/);
  await btns[2].click();
  assert.equal(off().length, 0); assert.equal(pressed(btns[2]), "false");
  await btns[0].click(); await v.band.find((e) => e.classes.has("n-pg-coverage-reset")).click();
  assert.equal(off().length, 0, "the reset link shows every row");
}));

test("coverage: the file is built from the rows on the page, in Hebrew columns; the value, the unit and the year are separate numbers when the model has them", async () => dom(async () => {
  const model = { indicators: [{ id: "x", unit: "%", last: { v: 95, year: 2024 } }] };
  const rows = coverage.coverageRows(oldCoverage(), model);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { domain: "חיסונים", indicator: "חצבת", state: "נמצא", value: 95, unit: "%", year: 2024, note: "הערה", source: "משרד הבריאות", link: "https://example.org" });
  assert.equal(rows[1].value, ""); assert.equal(rows[2].domain, "סביבה");
  assert.equal(coverage.coverageRows(oldCoverage())[0].value, "", "without a model there is no invented number");
  assert.deepEqual(coverage.COLUMNS.map((c) => c.title), ["תחום", "מדד", "מצב", "ערך", "יחידה", "שנה", "הערה", "מקור", "קישור למקור"]);
}));

test("coverage: a numeral that counts nothing is plain text, not a button", async () => dom(async () => {
  const root = oldCoverage();
  root.findAll((e) => e.classes.has("k-small")).forEach((e) => e.remove());
  const v = coverage.adapt(root, ctx());
  const btns = v.band.findAll((e) => e.tagName === "BUTTON" && e.classes.has("n-pg-coverage-fig"));
  assert.equal(btns.length, 2, "found and missing stay buttons");
  assert.equal(v.band.findAll((e) => e.classes.has("keyfig")).length, 4, "the four numerals are all there");
}));

// ── method ──
function oldMethod() {
  const sec = (id, t) => h("section.sec.mt-sec", { id }, h("h2", t));
  return h("div.mt", h("section.hero.mt-hero", h("h1", "איך נבנה כל מספר")), h("div.mt-layout", h("div.mt-content", sec("mt-sources", "מקורות"), sec("mt-measures", "מה נמדד")), h("nav.mt-toc", h("button.mt-toc-b", "מקורות"))));
}

test("method: a section with the glossary, privacy, licence and open data lines is added, with a contents list that knows it", async () => dom(async () => {
  const root = oldMethod(); method.adapt(root, ctx());
  const more = root.find((e) => e.id === "mt-more");
  assert.ok(more);
  const hrefs = more.findAll((e) => e.tagName === "A").map((a) => a.getAttribute("href"));
  assert.ok(hrefs.includes("#/glossary") && hrefs.includes("#/privacy"));
  assert.ok(hrefs.some((x) => x.startsWith("#/glossary#")), "single terms link to their anchor");
  assert.ok(hrefs.includes("/api/city/1031/export.csv"));
  assert.match(more.textContent, /\/api\/city\/1031/);
  assert.match(more.textContent, /רישיון/);
  const tocs = root.findAll((e) => e.classes.has("mt-toc"));
  assert.equal(tocs.length, 1, "the old list is replaced");
  assert.equal(tocs[0].findAll((e) => e.classes.has("mt-toc-b")).length, 3);
  assert.match(tocs[0].textContent, /מילון ופרטיות/);
}));

test("method: a target that is not official is a reference from abroad (the old table calls every one of them international, and the US objectives are not)", async () => dom(async () => {
  const root = oldMethod();
  root.find((e) => e.id === "mt-measures").append(h("p", h("span", "5.0 לכל 1,000"), " ", h("span.muted", "(ייחוס בינלאומי)")), h("p", h("span", "לפחות 80%"), " ", h("span.muted", "(יעד רשמי)")));
  method.adapt(root, ctx());
  const t = root.find((e) => e.id === "mt-measures").textContent;
  assert.match(t, /\(נקודת ייחוס\)/, "the product's word for a foreign figure (it was \"ייחוס מחו״ל\" before the words were fixed)");
  assert.doesNotMatch(t, /ייחוס בינלאומי|ייחוס מחו״ל/);
  assert.match(t, /\(יעד רשמי\)/, "an official target keeps its label");
}));

test("method: the glossary and privacy links of the section stay inside the town on a town route and are the top-level pages without one", async () => dom(async () => {
  const links = (hash) => { location.hash = hash; const root = oldMethod(); method.adapt(root, ctx(hash.startsWith("#/c/") ? MODEL : null)); return root.find((e) => e.id === "mt-more").findAll((e) => e.tagName === "A").map((a) => a.getAttribute("href")); };
  const inTown = links("#/c/1031/method");
  assert.ok(inTown.includes("#/c/1031/glossary") && inTown.includes("#/c/1031/privacy"), "the lists of terms and the privacy page of the town");
  assert.ok(inTown.some((x) => x.startsWith("#/c/1031/glossary#")), "a single term keeps the town");
  assert.deepEqual(inTown.filter((x) => /^#\/(glossary|privacy|accessibility)/.test(x)), [], "no link leaves the town");
  const free = links("#/method");
  assert.ok(free.includes("#/glossary") && free.includes("#/privacy") && free.some((x) => x.startsWith("#/glossary#")));
}));

test("method: on the town-less route the same section is there and the open data line has a sample town", async () => dom(async () => {
  const root = oldMethod(); method.adapt(root, ctx(null));
  assert.match(root.find((e) => e.id === "mt-more").textContent, /\/api\/city\/1031/);
}));

test("method: the road of a number leaves the band; a town's page has the way back, the general page has not", async () => dom(async () => {
  const mk = () => { const hero = h("section.hero.mt-hero", h("div.mt-hero-main", h("h1", "איך נבנה כל מספר")), h("ol.mt-flow", h("li", "1"))); return h("div.mt", hero, h("div.mt-layout", h("div.mt-content", h("section.mt-sec", { id: "mt-sources" }, "a"), h("section.mt-sec", { id: "mt-measures" }, "b")), h("nav.mt-toc"))); };
  const root = mk(); method.adapt(root, ctx());
  const hero = root.find((e) => e.classes.has("mt-hero")), road = root.find((e) => e.classes.has("n-pg-method-road"));
  assert.ok(road && road.find((e) => e.classes.has("mt-flow")), "the ol is in the road block");
  assert.ok(!hero.find((e) => e.classes.has("mt-flow")), "and not in the band");
  assert.equal(hero.find((e) => e.classes.has("n-pg-method-back")).getAttribute("href"), "#/c/1031");
  const general = mk(); method.adapt(general, ctx(null));
  assert.equal(general.find((e) => e.classes.has("n-pg-method-back")), null);
}));

// ── css ──
test("the css of the four pages: one prefix each, every rule scoped, no hex, no keyframes, no coloured side stripe", () => {
  for (const name of ["ask", "actions", "coverage", "method"]) {
    const css = fs.readFileSync(path.join(ROOT, "web", "css", "product", "pages", name + ".css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css) && !/@keyframes/.test(css), name);
    const prefixes = new Set([...css.matchAll(/\.(n-pg-[a-z]+)-[\w-]+/g)].map((m) => m[1]));
    assert.deepEqual([...prefixes], ["n-pg-" + name], name + " owns one prefix");
    assert.ok(!/\.n-(band|shell|kit|state)-/.test(css), name + " does not restyle another file's classes");
    for (const m of css.matchAll(/(?:^|\})\s*([^{}@]+)\{/g)) for (const sel of m[1].split(",")) assert.ok(/^\s*html\[data-ui="n"\]/.test(sel), `${name}: unscoped selector ${sel.trim().slice(0, 50)}`);
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/border-inline-(start|end)\s*:\s*[3-9]px/.test(m[2]) && !/transparent/.test(m[2])) assert.fail(`${name}: side stripe in ${m[1].trim()}`);
  }
});

test("the page modules add no fetch and import no page-private module", () => {
  for (const name of ["ask", "actions", "coverage", "method"]) {
    const src = fs.readFileSync(path.join(PROD, "pages", name + ".js"), "utf8").replace(/\/\/.*$/gm, "");
    assert.ok(!/\bfetch\s*\(|net\.|\bapi\.js|getCity|getMeta/.test(src), name + " fetches nothing");
    assert.ok(!/from\s+"\.\.\/\.\.\/pages\//.test(src), name + " imports no old page module");
    assert.ok(!/location\.hash\s*=/.test(src));
    for (const w of ["פרמטר", "מדאיג", "אחוזון", "מובהק", "המודל", "אנחנו", "בסיס קטן", "{{"]) assert.ok(!src.includes(w), `${name}: ${w}`);
  }
});

test("method: the sentences that come from the server's catalogue are said in plain Hebrew (no forbidden word, no field name)", async () => dom(async () => {
  const BS = String.fromCharCode(92), esc = (s) => [...s].map((c) => (c === " " ? " " : BS + "u" + c.charCodeAt(0).toString(16).padStart(4, "0"))).join("");
  const forbidden = JSON.parse('"' + esc("מובהק") + '"');          // the word SPEC 7.1 forbids, built here so that this file reads like the others
  const root = oldMethod();
  root.find((e) => e.id === "mt-sources").append(h("p", `הפרשים קטנים בדירוג בדרך כלל אינם ${forbidden}ים. יישוב התחנה (station_city) ולא מקום המגורים; שדה target לשנת 2024; בשדה Socio Economic Group יש ערך; ולהציג רווח סמך או תרשים משפך (funnel plot) במקום דירוג.`));
  method.adapt(root, ctx());
  const text = root.textContent;
  assert.ok(!text.includes(forbidden), "the forbidden word is gone");
  assert.match(text, /אינם משקפים הבדל אמיתי/);
  assert.ok(!/station_city|funnel plot|Socio Economic Group|שדה target/.test(text), "no field name or English term is left in the sentence");
  assert.match(text, /יישוב התחנה ולא מקום המגורים/);
}));

test("states: an error state carries its own heading as the tab title (offline is not 'not found')", async () => dom(async () => {
  const { errorState } = await load("kit/states.js");
  const off = errorState({ kind: "offline" }, { retry() {} });
  assert.equal(off.getAttribute("data-state"), "error-offline");
  assert.ok(off.getAttribute("data-title") && !/לא נמצא/.test(off.getAttribute("data-title")));
  assert.match(off.textContent, new RegExp(off.getAttribute("data-title")));
  assert.ok(off.findAll((e) => e.tagName === "BUTTON").length >= 1, "the retry button is there");
}));

// ── method: the section that was the 16 rules of the framework, written for the people who build the model ──
test("method: section 07 is a short reader-facing paragraph about the evidence, made of facts counted from the framework file (the 16 builder rules are gone from the page)", async () => dom(async () => {
  const { createRequire } = await import("node:module");
  const evidence = createRequire(import.meta.url)("../src/catalog/evidence.json");
  // what GET /api/meta sends of the framework file (src/api.js): one entry per parameter with the count of its interventions, and the rules as they are
  const meta = { framework: Object.values(evidence.parameters).map((p) => ({ id: p.id, interventions: (p.interventions || []).length })), interpretation: Object.values(evidence.rules), indicators: [] };
  const root = oldMethod();
  root.find((e) => e.id === "mt-measures").append(h("section.mt-sec", { id: "mt-reading" }, h("h2", "איך לקרוא את המספרים"), h("p", "יעד 0 במאגר פירושו חסר. אין להציג ״יעד 0%״. (למשל שדרות, אילת – יש לבדוק). לא למחוק בשקט אלא לדווח על שיעור החסר.")));
  method.adapt(root, { ...ctx(MODEL), meta });
  const sec = root.find((e) => e.id === "mt-reading"), text = sec.textContent;
  const flat = (s) => s.replace(/[\u2060\u2066-\u2069]/g, "").replace(/ /g, " ");          // the page keeps a number and its unit together (a non-breaking space) and a hyphen before a digit in one piece
  assert.ok(sec && sec.classes.has("mt-sec"), "the section keeps its place and its id");
  for (const bad of ["לא למחוק בשקט", "רגרסיה לממוצע", "County Health Rankings", "יעד 0", "אילת", "יש לבדוק"]) assert.ok(!text.includes(bad), "builder sentence left on the page: " + bad);
  const p = flat(sec.find((e) => e.tagName === "P").textContent);
  const sentences = p.split(/(?<=\.)\s+/).filter(Boolean);
  assert.ok(sentences.length >= 2 && sentences.length <= 4, "two to four sentences: " + sentences.length);
  // every number on the page is counted from the file
  const withWork = Object.values(evidence.parameters).filter((x) => (x.interventions || []).length > 0).length, rules = Object.keys(evidence.rules).length;
  assert.ok(p.includes(`המסגרת מונה ${Object.keys(evidence.parameters).length} מדדים, ול-${withWork} מהם`), p);
  assert.ok(p.includes(`${rules} כללי קריאה נאספו`), p);
  assert.ok(!/[A-Za-z]/.test(p), "plain Hebrew");
  assert.ok(!/שדרות|אילת|בני ברק|נצרת|ירושלים/.test(p), "no town in the paragraph");
  // the two claims about the strength labels are what the file and the model's own test keep: every cited page has a link and one of the three labels
  const interventions = Object.values(evidence.interventions);
  assert.ok(interventions.length && interventions.every((i) => /^https?:/.test(i.url) && ["strong", "moderate", "limited"].includes(i.strength)));
  assert.ok(sec.findAll((e) => e.tagName === "A").some((a) => a.getAttribute("href") === "#/c/1031/actions"), "the way to the town's recommendations");
  const bare = oldMethod(); bare.find((e) => e.id === "mt-measures").append(h("section.mt-sec", { id: "mt-reading" }, h("p", "x")));
  method.adapt(bare, ctx(null));
  assert.ok(!/[0-9]/.test(bare.find((e) => e.id === "mt-reading").textContent.replace(/^0\d/, "")), "without the catalogue no number is typed");
}));

test("method: a figure of one is not '1 מתוך 1 נמדדים', and the statistician's names leave the sentences of the rules", async () => dom(async () => {
  const root = oldMethod();
  const sec = root.find((e) => e.id === "mt-measures");
  sec.append(h("span.mt-fw-n", "1 מתוך 1 נמדדים"), h("span.mt-fw-n", "0 מתוך 1 נמדדים"), h("span.mt-fw-n", "3 מתוך 4 נמדדים"), h("p", "פער ברור מספיק כדי שלא יהיה מקרי (\u2066z ≥ 3\u2069)."));
  method.adapt(root, ctx());
  const t = sec.findAll((e) => e.classes.has("mt-fw-n")).map((e) => e.textContent.replace(/\u00A0/g, " "));
  assert.deepEqual(t, ["מדד אחד · נמדד", "מדד אחד · טרם נמדד", "3 מתוך 4 נמדדים"]);
  assert.ok(!/z ≥|מקרי \(/.test(sec.textContent), "the test's name is gone");
  assert.match(sec.textContent, /כדי שלא יהיה מקרי\./);
}));

test("method: the sentence about a foreign figure says 'נקודת ייחוס', and the official-target section calls an orientation target 'יעד להתמצאות'", async () => dom(async () => {
  const root = oldMethod();
  root.find((e) => e.id === "mt-measures").append(h("p", "המסגרת נאספה מ-WHO. יעד בין-לאומי אינו יעד ישראלי: הוא נקודת ייחוס בלבד."));
  method.adapt(root, ctx());
  const t = root.find((e) => e.id === "mt-measures").textContent;
  assert.match(t, /נקודת ייחוס מחו״ל אינה יעד: היא משמשת להתמצאות בלבד\./);
  assert.ok(!/יעד בין-לאומי/.test(t));
  const src = fs.readFileSync(path.join(PROD, "pages", "method.js"), "utf8");
  assert.ok(src.includes('"יעד להתמצאות, "'), "orientation targets are named so in the list of the official-target section");
}));

test("method: the rows of the framework (opened) say no field name of a data file and no Latin abbreviation in brackets", async () => dom(async () => {
  const root = oldMethod(), sec = root.find((e) => e.id === "mt-measures");
  sec.append(h("p", "שכר ממוצע כפי שמופיע בטבלת היישובים של מפקד 2022 (ראו data_hint להגדרה המדויקת בעמודה)."), h("p", "מדד ממוקד לגילי 0-19 (שדה INJ0_19 במאגר) המאפשר לבחון בטיחות."),
    h("p", "מספר התחנות השונות (station) הרשומות ביישוב."), h("p", "שאלון לאיתור דיכאון לאחר לידה (EPDS/EDS) עד שלושה חודשים. מוות בעריסה (SIDS) הוא הסיבה הרביעית."), h("p", "להאשים עיר ענייה בביצועים שנובעים ממצבה."));
  method.adapt(root, ctx());
  const t = sec.textContent;
  assert.ok(!/data_hint|INJ0_19|\(station\)|EPDS|SIDS|עיר ענייה/.test(t), t);
  assert.match(t, /של מפקד 2022\./); assert.match(t, /מוות בעריסה הוא הסיבה הרביעית/); assert.match(t, /להאשים יישוב עני בביצועים שנובעים ממצבו/);
}));

test("actions: the rules of the evidence framework (to-do lines for the builders) are not shown under the recommendations either", () => {
  const css = fs.readFileSync(path.join(ROOT, "web", "css", "product", "pages", "actions.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /html\[data-ui="n"\] \.ac-notes \{ display: none; \}/);
});
