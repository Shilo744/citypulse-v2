// The briefing (SPEC 5.3): the document of web/js/product/brief/doc.js on the fixtures 1031, 16, 7, 935, 99, 472, 2710, and the rules of its files.
// doc.js has no DOM (node imports it); brief.js draws it, so what the page says is tested here as text and what the page does is checked in the browser by the smoke tools.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { haveStore, all } from "./helpers/city-models.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRIEF = path.join(ROOT, "web", "js", "product", "brief");
const load = (f) => import(pathToFileURL(path.join(ROOT, "web", "js", "product", f)).href);
const B = await load("brief/doc.js"), C = await load("city/copy.js"), D = await load("city/data.js"), G = await load("city/groups.js");
const M = haveStore ? all() : {};
const skip = !haveStore && "the built store is not there";
let META = null;
try { META = G.regroupMeta(createRequire(import.meta.url)("../src/api").publicCatalog()); } catch (e) { META = null; }          // the catalogue as the product reads it (net.meta): in the categories, like the model
const docs = () => Object.fromEntries(Object.entries(M).map(([k, m]) => [k, B.briefDoc(m, { meta: META })]));
const sec = (d, id) => d.sections.find((s) => s.id === id);
const plain = (s) => String(s).replace(/[⁦-⁩]/g, "");

test("every town gets the seven sections in the order of SPEC 5.3, a title and a foot", { skip }, () => {
  for (const [k, d] of Object.entries(docs())) {
    assert.deepEqual(d.sections.map((s) => s.id), B.SECTIONS, k);
    assert.equal(d.title, `דוח בריאות היישוב: ${M[k].city.name}`);
    assert.equal(d.foot.statement, "התמונה כאן מכוונת לשאלות ולתעדוף, לא לציון או לדירוג של היישוב.");
    assert.ok(d.basis.text.length > 10, k);
    assert.ok(sec(d, "lead").said.plain.length > 10, k);
    for (const id of ["changes", "peers", "first", "missing"]) assert.ok(sec(d, id).said.plain.length > 5, `${k} ${id}`);
    // a town that cannot be set against similar towns gets no definition of that comparison (small-towns test)
    assert.deepEqual(sec(d, "howto").lines.map((l) => l.q), C.QIDS.filter((q) => !(q === "peers" && D.hasNoPeers(M[k]))), k);
  }
});

test("no raw token, no forbidden word, no broken value, no 0% or 1% rank wording", { skip }, () => {
  for (const [k, d] of Object.entries(docs())) {
    const t = plain(B.docText(d));
    assert.ok(!/undefined|NaN|\[object|null|\{\{|\}\}|Infinity/.test(t), `${k}: ${t.match(/undefined|NaN|\[object|null|\{\{|Infinity/)}`);
    for (const w of C.FORBIDDEN) assert.ok(!t.includes(w), `${k}: forbidden "${w}"`);
    assert.ok(!/(טוב|טובים|טובה)\s*מ-?\s*[01]%/.test(t), `${k}: percent rank wording`);
    assert.ok(!/(^|\s)(1|0) (מדדים|יישובים|ימים|שנים|צעדים)\b/.test(t), `${k}: a plural after one or zero`);
  }
});

test("1031: the table has the five weakest, each with a value, a year, a place \"מקום N מתוך M\", a direction word and a status word", { skip }, () => {
  const w = sec(docs()["1031"], "weakest");
  assert.equal(w.heading, "חמשת המדדים הכי חלשים");
  assert.equal(w.rows.length, 5);
  const places = w.rows.map((r) => plain(r.place));
  for (const r of w.rows) {
    assert.match(plain(r.place), /^מקום \d+ מתוך \d+/, r.name);
    assert.ok(Object.values(B.DIRECTION).includes(r.dir), r.name);
    assert.ok(r.value && r.value !== "—" && /^\d{4}$/.test(r.year), r.name);
    assert.ok(["דורש טיפול", "למעקב", "תקין", "חוזק"].includes(r.status.word), r.name);
  }
  // from the lowest place up: the order is the rank among the localities
  const levels = places.map((p) => Number(p.match(/\d+/)[0]));
  assert.equal(new Set(levels).size, 5);
});

test("the heading agrees with the number of rows (one, two, three, four, five)", () => {
  const heads = [1, 2, 3, 4, 5].map(B.HEAD.weakest);
  assert.deepEqual(heads, ["המדד הכי חלש", "שני המדדים הכי חלשים", "שלושת המדדים הכי חלשים", "ארבעת המדדים הכי חלשים", "חמשת המדדים הכי חלשים"]);
});

test("one judged figure gives the singular heading and one row", { skip }, () => {
  const m = JSON.parse(JSON.stringify(M["1031"]));
  let kept = false;
  for (const a of m.indicators) { if (C && ["concern", "watch", "good", "strength"].includes(a.status)) { if (kept) a.status = "na"; else kept = true; } }
  const w = sec(B.briefDoc(m), "weakest");
  assert.equal(w.rows.length, 1);
  assert.equal(w.heading, "המדד הכי חלש");
});

test("tiny towns (16, 7): the same document, the numbers as they are, never ranked, no empty frame", { skip }, () => {
  const D = docs();
  for (const k of ["16", "7"]) {
    const w = sec(D[k], "weakest");
    assert.equal(D[k].kind, "calm", k);
    assert.equal(w.heading, "המספרים שיש", k);
    assert.ok(w.rows.length > 0 && w.rows.every((r) => r.small && r.place === "ללא דירוג" && !r.nat), k);
    assert.ok(!/מקום \d/.test(plain(B.docText(D[k]))), `${k}: a place for a figure on a small group`);
    assert.ok(/אין מספיק נתונים אמינים/.test(sec(D[k], "lead").said.plain), k);
    assert.equal(sec(D[k], "first").facts.length, 0, k);
    assert.ok(sec(D[k], "first").said.ledePlain.includes("אין"), k);
  }
});

test("935 (nothing published): one calm document, the reason said once, no table, no list", { skip }, () => {
  const d = docs()["935"], t = plain(B.docText(d));
  assert.equal(d.kind, "uncovered");
  assert.equal(sec(d, "weakest").table, false);
  assert.equal(sec(d, "weakest").rows.length, 0);
  assert.ok(sec(d, "weakest").empty);
  assert.ok(/המקורות הרשמיים אינם מפרסמים נתונים על/.test(sec(d, "lead").said.ledePlain));
  assert.equal(t.split("המקורות הרשמיים אינם מפרסמים נתונים על").length - 1, 1, "the reason appears once");
  assert.ok(/לא נמצא נתון על אף אחד מ-41 המדדים/.test(t));
  assert.equal(sec(d, "missing").groups.length, 0);
  assert.ok(!/עדיין/.test(t));
});

test("99 and 472: covered and weak, or stale and small: the table is real and the stale or small figures are not ranked", { skip }, () => {
  const D = docs();
  for (const k of ["99", "472"]) {
    const w = sec(D[k], "weakest");
    assert.ok(w.rows.length > 0, k);
    for (const r of w.rows) assert.ok(r.small || /^מקום \d+ מתוך \d+/.test(plain(r.place)), `${k} ${r.name}`);
  }
  const stale = M["472"].indicators.filter((a) => a.stale || a.status === "stale").map((a) => a.id);
  for (const r of sec(D["472"], "weakest").rows) assert.ok(!stale.includes(r.id), "a stale figure in the table");
});

test("what is missing: with the catalogue the groups name the figures and the reason, without it the sentence stays", { skip: (!haveStore || !META) && "no store or no catalogue" }, () => {
  const d = docs();
  assert.ok(sec(d["1031"], "missing").groups.length > 0);
  for (const g of sec(d["1031"], "missing").groups) assert.ok(g.names.length && /\.$/.test(g.why) && !/undefined/.test(g.why));
  const bare = B.briefDoc(M["1031"]);
  assert.equal(sec(bare, "missing").groups.length, 0);
  assert.ok(sec(bare, "missing").note.length > 10);
  assert.ok(sec(bare, "missing").said.plain.includes("חסרים"));
});

test("the sentence and the figures of the briefing are the ones of the home (same functions)", { skip }, async () => {
  const S = await load("city/sentence.js"), D = await load("city/data.js");
  const d = B.briefDoc(M["1031"]);
  assert.equal(sec(d, "lead").said.plain, S.answer(M["1031"], "weak").plain);
  assert.equal(sec(d, "peers").said.plain, S.answer(M["1031"], "peers").plain);
  assert.deepEqual(sec(d, "weakest").rows.map((r) => r.id), D.weakestFive(M["1031"]).map((a) => a.id));
  assert.deepEqual(sec(d, "changes").rows.map((r) => r.id), D.movers(M["1031"], 5).map((x) => x.a.id));
});

test("doc.js has no DOM; brief.js prints with window.print(), downloads the whole town, and never writes location.hash", () => {
  const doc = fs.readFileSync(path.join(BRIEF, "doc.js"), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/\b(document|window|location|localStorage)\b/.test(doc), "doc.js mentions a browser global");
  for (const i of [...doc.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1])) assert.ok(/^\.\.\/(city\/(copy|data|sentence)|kit\/(plural|provenance))\.js$|^\.\.\/\.\.\/ui\.js$/.test(i), "doc.js imports " + i);
  const src = fs.readFileSync(path.join(BRIEF, "brief.js"), "utf8");
  assert.ok(src.includes("window.print()") && src.includes("exportHref(key)") && src.includes("הדפסה / PDF") && src.includes("העתקת קישור") && src.includes("הורדת כל נתוני היישוב") && src.includes("חזרה לדף היישוב"));
  assert.ok(!/location\.hash\s*=/.test(src) && !/\bfetch\(/.test(src));
  assert.ok(/export (async )?function briefView/.test(src));
});

test("brief.css: prefix n-brief-, print sheet with A4 margins of 14 mm, avoid breaks, page numbers, no colour literal", () => {
  const css = fs.readFileSync(path.join(ROOT, "web", "css", "product", "brief.css"), "utf8");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")), "a hex colour");
  assert.ok(!/@keyframes/.test(css));
  for (const m of css.matchAll(/\.(n-[a-z0-9]+)-/g)) assert.equal(m[1], "n-brief", "another prefix: " + m[0]);
  assert.match(css, /@page brief \{[^}]*size: A4;[^}]*margin: 14mm/);
  assert.match(css, /counter\(page\)/);
  assert.match(css, /break-inside: avoid/);
  assert.match(css, /print-color-adjust: exact/);
});
