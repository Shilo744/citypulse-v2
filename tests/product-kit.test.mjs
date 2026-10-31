// The content kit of mode N (web/js/product/kit): CSV, plural forms, the glossary, the "from" marker, share links, the mistake report, provenance, the actions row.
// The pure parts run as they are; the DOM parts run against a tiny fake document (enough for h(), dialogs and buttons).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const KIT = path.join(ROOT, "web", "js", "product", "kit");
const load = (f) => import(pathToFileURL(path.join(KIT, f)).href);
const require = createRequire(import.meta.url);
const { RULES } = require("../src/model/analyze.js");
const { STATUS } = await import(pathToFileURL(path.join(ROOT, "web", "js", "ui.js")).href);
const csv = await load("csv.js"), plural = await load("plural.js"), glossary = await load("glossary.js"), from = await load("from.js"), share = await load("share.js");
const feedback = await load("feedback.js"), provenance = await load("provenance.js"), actions = await load("actions.js"), term = await load("term.js"), base = await load("base.js");

// ── a tiny fake document: elements, text, listeners, <dialog>, focus ─────────────────────────────────────
class FNode { constructor() { this.parentNode = null; this.childNodes = []; } }
class FText extends FNode { constructor(t) { super(); this.nodeType = 3; this.data = t; } get textContent() { return this.data; } }
class FEl extends FNode {
  constructor(tag) {
    super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = {}; this.on = {}; this.id = ""; this.value = ""; this.hidden = false; this.open = false; this.style = { setProperty() {} };
    const cls = new Set(); this.classes = cls; this.classList = { add: (...c) => c.forEach((x) => cls.add(x)), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) };
  }
  get className() { return [...this.classes].join(" "); }
  set className(v) { this.classes.clear(); String(v).split(" ").filter(Boolean).forEach((c) => this.classes.add(c)); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "id") this.id = String(v); if (k === "value") this.value = String(v); if (k === "hidden") this.hidden = true; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; if (k === "hidden") this.hidden = false; }
  append(...kids) { for (const k of kids) { const n = typeof k === "string" ? new FText(k) : k; if (n.parentNode) n.remove(); n.parentNode = this; this.childNodes.push(n); } }
  replaceChildren(...kids) { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; this.append(...kids); }
  remove() { if (this.parentNode) { this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this); this.parentNode = null; } }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === document.documentElement; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this.replaceChildren(...(v ? [String(v)] : [])); }
  addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }
  removeEventListener() {}
  async fire(t, ev = {}) { const e = { target: this, preventDefault() {}, ...ev }; for (const f of this.on[t] || []) await f(e); }
  click() { return this.fire("click"); }
  focus() { document.activeElement = this; }
  select() {}
  showModal() { this.open = true; this.modal = true; }
  close() { if (!this.open) return; this.open = false; this.fire("close"); }
  find(pred) { for (const c of this.childNodes) { if (c.nodeType === 1) { if (pred(c)) return c; const r = c.find(pred); if (r) return r; } } return null; }
  findAll(pred, out = []) { for (const c of this.childNodes) if (c.nodeType === 1) { if (pred(c)) out.push(c); c.findAll(pred, out); } return out; }
}
const byClass = (c) => (e) => e.classes.has(c);
function installDom({ coarse = false, share: shareFn, clipboard, execCommand, sessionThrows = false } = {}) {
  const body = new FEl("body"), html = new FEl("html"); html.append(body);
  const store = new Map(), saved = {}, win = new FEl("window");
  const doc = {
    documentElement: html, body, activeElement: null, title: "T",
    createElement: (t) => new FEl(t), createElementNS: (ns, t) => new FEl(t), createTextNode: (t) => new FText(t),
    getElementById: (id) => body.find((e) => e.id === id), execCommand
  };
  const set = (k, v) => { saved[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };
  set("Node", FNode); set("document", doc); set("window", win);
  set("location", { origin: "https://cp.example", pathname: "/n.html", hash: "#/c/1031", href: "https://cp.example/n.html#/c/1031" });
  set("navigator", { clipboard, share: shareFn });
  set("matchMedia", () => ({ matches: coarse }));
  set("sessionStorage", sessionThrows ? { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } }
    : { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) });
  const pending = new Set(), realSet = globalThis.setTimeout;                       // timers of the code under test (the 2.4 s label, the live region) die with the fake document
  set("setTimeout", (fn, ms) => { const t = realSet(() => { pending.delete(t); fn(); }, ms); pending.add(t); return t; });
  return { doc, body, win, restore() { pending.forEach(clearTimeout); for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } } };
}
const dom = async (opts, fn) => { const d = installDom(opts); try { await fn(d); } finally { d.restore(); } };
const realSetTimeout = globalThis.setTimeout;
const tick = () => new Promise((r) => realSetTimeout(r, 60));

// ── csv ──────────────────────────────────────────────────────────────────────────────────────────────────
test("csv: BOM, CRLF, header, Hebrew, quoting of commas, quotes and newlines", () => {
  const out = csv.rowsToCsv([{ a: "שדרות", b: 5.5 }, { a: 'say "hi", ok', b: null }, { a: "two\nlines", b: 0 }], [{ key: "a", title: "יישוב" }, { key: "b", title: "ערך" }]);
  assert.equal(out.charCodeAt(0), 0xFEFF);
  assert.equal(out, "\uFEFF" + "יישוב,ערך\r\n" + "שדרות,5.5\r\n" + '"say ""hi"", ok",\r\n' + '"two\nlines",0\r\n');
});

test("csv: a text cell that starts with = + - @ (or a tab) is prefixed with an apostrophe; numbers stay numbers", () => {
  for (const bad of ["=SUM(A1)", "+1+1", "-2+3", "@cmd", "\tx", "=HYPERLINK(\"http://x\",\"y\")"]) assert.ok(csv.csvCell(bad).replace(/^"/, "").startsWith("'"), bad);
  assert.equal(csv.csvCell("=1+1"), "'=1+1");
  assert.equal(csv.csvCell(-5.2), "-5.2");
  assert.equal(csv.csvCell("מדד"), "מדד");
  assert.equal(csv.csvCell("a=b"), "a=b");
  assert.equal(csv.csvCell("=a,b"), '"\'=a,b"');
  assert.equal(csv.csvCell(NaN), ""); assert.equal(csv.csvCell(undefined), ""); assert.equal(csv.csvCell(true), "כן"); assert.equal(csv.csvCell(["a", "b"]), "a; b");
  const out = csv.rowsToCsv([{ n: "=cmd" }], ["n"]);
  assert.ok(out.includes("\r\n'=cmd\r\n"));
});

test("csv: columns can compute a value, and the file name carries the town, the name and the date", () => {
  assert.equal(csv.rowsToCsv([{ x: 1 }, { x: 2 }], [{ title: "כפול", get: (r, i) => r.x * 2 + i }]).slice(1), "כפול\r\n2\r\n5\r\n");
  assert.equal(csv.csvName("1031", "all", new Date(2026, 9, 29)), "citypulse-1031-all-2026-10-29.csv");
  assert.equal(csv.csvName(null, "a b/c", new Date(2026, 0, 5)), "citypulse-a-b-c-2026-01-05.csv");
  assert.equal(csv.exportHref("1031"), "/api/city/1031/export.csv");
});

test("csvButton downloads a Blob that starts with the UTF-8 BOM; a failing getRows is announced, not thrown", async () => {
  await dom({}, async (d) => {
    const clicks = [], created = [];
    const orig = d.doc.createElement; d.doc.createElement = (t) => { const e = orig(t); if (t === "a") e.click = () => clicks.push({ href: e.attrs.href, download: e.download || e.attrs.download }); return e; };
    const url = globalThis.URL, realCreate = url.createObjectURL; url.createObjectURL = (b) => { created.push(b); return "blob:x"; }; url.revokeObjectURL = () => {};
    try {
      const btn = csv.csvButton(() => ({ rows: [{ v: "שדרות" }], columns: ["v"] }), "all", { key: "1031" });
      await btn.click(); await tick();
      assert.equal(clicks.length, 1);
      assert.match(clicks[0].download, /^citypulse-1031-all-\d{4}-\d{2}-\d{2}\.csv$/);
      const bytes = new Uint8Array(await created[0].arrayBuffer());
      assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
      assert.equal(btn.getAttribute("aria-busy"), null);
      const bad = csv.csvButton(() => { throw new Error("boom"); }, "x");
      await bad.click(); await tick();
      assert.equal(clicks.length, 1, "no file for a failed build");
      assert.equal(d.doc.getElementById("n-kit-live").textContent, "הקובץ לא הוכן. נסו שוב.");
      const link = csv.csvLink("/api/city/1031/export.csv");
      assert.equal(link.getAttribute("href"), "/api/city/1031/export.csv"); assert.equal(link.tagName, "A");
    } finally { url.createObjectURL = realCreate; }
  });
});

// ── plural ───────────────────────────────────────────────────────────────────────────────────────────────
test("plural: one, many and zero for the counted nouns (0, 1, 2, 11, 100)", () => {
  const { cnt, cntOf, cntWord, countBare, more } = plural;
  assert.deepEqual([0, 1, 2, 11, 100].map((n) => cntOf(n, "metric")), ["0 מדדים", "מדד אחד", "2 מדדים", "11 מדדים", "100 מדדים"]);
  assert.deepEqual([0, 1, 2, 11, 100].map((n) => cntOf(n, "day")), ["0 ימים", "יום אחד", "2 ימים", "11 ימים", "100 ימים"]);
  assert.deepEqual([0, 1, 2, 11, 100].map((n) => cntOf(n, "year")), ["0 שנים", "שנה אחת", "2 שנים", "11 שנים", "100 שנים"]);
  assert.deepEqual([1, 2, 12].map((n) => cntOf(n, "town")), ["יישוב אחד", "2 יישובים", "12 יישובים"]);
  assert.deepEqual([1, 2, 12].map((n) => cntOf(n, "point")), ["נקודת אחוז אחת", "2 נקודות אחוז", "12 נקודות אחוז"]);
  assert.equal(cntOf(0, "metric", "אין מדדים"), "אין מדדים");
  assert.equal(cnt(1234, "x אחד", "x"), "1,234 x");
  assert.equal(cnt(1.5, "x אחד", "x"), "1.5 x");
  assert.equal(more(1, "step"), "עוד צעד אחד"); assert.equal(more(2, "step"), "עוד 2 צעדים");
  assert.equal(cntWord(1, "חלש", "חלשים"), "חלש"); assert.equal(cntWord(26, "חלש", "חלשים"), "חלשים");
  assert.equal(countBare(1), "אחד"); assert.equal(countBare(1, "f"), "אחת"); assert.equal(countBare(3), "3");
  assert.throws(() => cntOf(2, "nope"));
});

test("plural: the sentences of the audit (B-1 to B-5) come out right", () => {
  const { cntOf, cntWord, countBare, lacking } = plural;
  const peers = (worse, of) => `${cntOf(worse, "metric")} מתוך ${of} ${cntWord(worse, "חלש", "חלשים")} יותר`;
  assert.equal(peers(1, 26), "מדד אחד מתוך 26 חלש יותר"); assert.equal(peers(3, 26), "3 מדדים מתוך 26 חלשים יותר");
  assert.equal(`${countBare(1)} ${cntWord(1, "טוב", "טובים")} יותר`, "אחד טוב יותר");
  assert.equal(lacking(12, "days") + " ליעד", "חסרים 12 ימים ליעד");
  assert.equal(lacking(1, "days"), "חסר יום אחד");
  assert.equal(lacking(13.9, "%", { short: true }), "חסרות 13.9 נק׳");
  assert.equal(lacking(5, "%"), "חסרות 5 נקודות אחוז"); assert.equal(lacking(1, "%"), "חסרה נקודת אחוז אחת"); assert.equal(lacking(-3, "years"), "חסרות 3 שנים");
  assert.equal(lacking(4, "per1000"), "חסרים 4 לכל 1,000"); assert.equal(lacking(1200, "ils"), "חסרים ₪1,200");
});

test("plural: the unit stands with its value (C-15)", () => {
  const { withUnit } = plural;
  assert.equal("מ-" + withUnit(17, "days") + " ב-2019", "מ-17 ימים ב-2019");
  assert.equal(withUnit(66.123, "%"), "66.1%"); assert.equal(withUnit(5.7, "per100k"), "5.7 לכל 100,000"); assert.equal(withUnit(1200, "ils"), "₪1,200");
  assert.equal(withUnit(1, "days"), "יום אחד"); assert.equal(withUnit(3, "years"), "3 שנים"); assert.equal(withUnit(null, "%"), "—"); assert.equal(withUnit(41, "index"), "41");
});

// ── from.js ──────────────────────────────────────────────────────────────────────────────────────────────
test("from: mark, read and clear, per town, with an hour of life", async () => {
  await dom({}, async () => {
    assert.equal(from.readFrom(), null);
    from.markFrom("2"); assert.equal(from.readFrom(), "2"); assert.equal(from.readFrom("1031"), "2");
    from.markFrom("3", "1031"); assert.equal(from.readFrom("1031"), "3"); assert.equal(from.readFrom("9000"), null, "another town's marker is ignored");
    from.markFrom("<script>"); assert.equal(from.readFrom("1031"), "3", "an invalid id is not stored");
    from.markFrom(null); assert.equal(from.readFrom(), null);
    from.markFrom("1"); const realNow = Date.now; Date.now = () => realNow() + 61 * 60 * 1000;
    try { assert.equal(from.readFrom(), null, "an old marker is gone"); } finally { Date.now = realNow; }
    from.clearFrom(); assert.equal(from.readFrom(), null);
  });
});

test("from and base.safeSession survive a storage that throws on every call", async () => {
  await dom({ sessionThrows: true }, async () => {
    assert.doesNotThrow(() => from.markFrom("4", "16"));
    assert.equal(from.readFrom("16"), "4", "kept in memory until the page closes");
    assert.doesNotThrow(() => from.clearFrom());
    assert.equal(from.readFrom(), null);
    base.safeSession.set("k", "v"); assert.equal(base.safeSession.get("k"), "v"); base.safeSession.del("k"); assert.equal(base.safeSession.get("k"), null);
  });
  const saved = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  delete globalThis.sessionStorage;                                // no sessionStorage at all (a ReferenceError inside the wrapper)
  try { assert.doesNotThrow(() => from.markFrom("5")); assert.equal(from.readFrom(), "5"); from.clearFrom(); } finally { if (saved) Object.defineProperty(globalThis, "sessionStorage", saved); }
});

// ── glossary ─────────────────────────────────────────────────────────────────────────────────────────────
test("glossary: complete rows, unique ids, plain words", () => {
  const ids = glossary.GLOSSARY.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["concern", "watch", "good", "rank", "peers", "cluster", "small", "background", "trend", "target", "pp", "stdz", "stale", "per100k"]) assert.ok(ids.includes(id), id);
  for (const t of glossary.GLOSSARY) { assert.ok(t.term && t.short && t.long, t.id); assert.ok(t.short.length <= 260, t.id + " short is one or two sentences"); }
  assert.equal(glossary.glossaryTerm("concern").term, "דורש טיפול"); assert.equal(glossary.glossaryTerm("nope"), null);
  assert.equal(glossary.glossaryHref("peers"), "#/glossary#peers"); assert.equal(glossary.glossaryHref(), "#/glossary");          // outside a town (and outside a window): the top-level page
  assert.equal(glossary.glossaryHref("peers", "1031"), "#/c/1031/glossary#peers"); assert.equal(glossary.glossaryHref(undefined, "1031"), "#/c/1031/glossary");          // with a town: the glossary of the town
});

test("glossary: every term used by the product exists", () => {
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith(".js")) files.push(p); } };
  walk(path.join(ROOT, "web", "js", "product"));
  const used = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/\b(?:termButton|openTerm|glossaryTerm|glossaryHref)\(\s*["'`]([\w-]+)["'`]/g)) used.add(m[1] + " @ " + path.relative(ROOT, f));
    for (const m of src.matchAll(/#\/glossary#([\w-]+)/g)) used.add(m[1] + " @ " + path.relative(ROOT, f));
  }
  const bad = [...used].filter((u) => !glossary.glossaryTerm(u.split(" ")[0]));
  assert.deepEqual(bad, []);
  assert.ok(used.size >= 0);
});

test("glossary: the rules it states are the rules of analyze.js and the words of ui.js STATUS", () => {
  const G = (id) => glossary.glossaryTerm(id), all = (id) => G(id).short + " " + G(id).long;
  const has = (id, s) => assert.ok(all(id).includes(s), `${id} should say ${s}`);
  has("concern", `${RULES.concernLevel}%`); has("concern", `${RULES.concernWorseningLevel}%`); has("concern", `מ-${RULES.farBelowTarget} `);
  has("watch", `${RULES.nearTarget} נקודות`); has("watch", "50%"); assert.equal(RULES.goodLevel, 50);
  has("good", `${RULES.goodLevel}%`); has("good", `${RULES.nearTarget} נקודות`);
  has("strength", `${RULES.strengthLevel}%`);
  has("trend", "חצי נקודת אחוז"); assert.equal(RULES.trendSlope, 0.5); has("trend", "שתי נקודות אחוז"); assert.equal(RULES.trendMove, 2);
  has("trend", `${Math.round(RULES.trendRelSlope * 100)}%`); has("trend", `${Math.round(RULES.trendRelMove * 100)}%`); has("trend", "שלוש שנים");
  has("stale", "בשנתיים"); has("stale", "חמישית");
  has("rank", "עשרה יישובים");
  const city = fs.readFileSync(path.join(ROOT, "src", "model", "city.js"), "utf8");
  assert.match(city, /findPeers\(store, key, n = 12\)/); has("peers", "12 ");
  assert.match(city, /store\.coverage\(k\) < 4/); has("peers", "ארבעה מדדים");
  const analyze = fs.readFileSync(path.join(ROOT, "src", "model", "analyze.js"), "utf8");
  assert.match(analyze, /peerVals\.length >= 3/); has("peers", "שלושה מהם");
  assert.match(analyze, /vals\.length >= 10/); has("small", "עשרה יישובים");
  assert.match(analyze, /\* \(stale \? 0\.2 : 1\)/);
  assert.match(analyze, /last\.year <= \(store\.latestYearOf\(ind\.id\) \|\| last\.year\) - 2/);
  for (const [status, id] of [["concern", "concern"], ["watch", "watch"], ["good", "good"], ["strength", "strength"], ["stale", "stale"]]) assert.equal(STATUS[status].label, G(id).term, status);
  assert.equal(STATUS.uncertain.label, "בסיס קטן", "the old label that the product replaces by 'קבוצה קטנה' (SPEC 7.1)");
});

// ── forbidden words, colours, scoping (the rules of SPEC 2.3 and 7.1 on the kit) ─────────────────────────
const kitFiles = () => fs.readdirSync(KIT).filter((f) => f.endsWith(".js")).map((f) => [f, fs.readFileSync(path.join(KIT, f), "utf8")]);
test("kit strings: none of the forbidden words, no raw token, no hex colour", () => {
  const FORBID = [/פרמטר/, /מדאיג/, /אחוזון/, /מובהק/, /המודל/, /(?<![א-ת])אנחנו(?![א-ת])/, /(?<![א-ת])לנו(?![א-ת])/, /בסיס קטן/, /\{\{/];
  const bad = [];
  for (const [f, src] of kitFiles()) {
    const code = src.replace(/\/\/.*$/gm, "");
    for (const re of FORBID) if (re.test(code.replace(/\/\*[\s\S]*?\*\//g, ""))) bad.push(f + " " + re);
    if (/#[0-9a-fA-F]{3,8}\b/.test(code.replace(/&#\d+;/g, ""))) bad.push(f + " hex");
    if (/@keyframes/.test(code)) bad.push(f + " keyframes");
  }
  assert.deepEqual(bad, []);
});

test("kit.css: every top-level rule starts with html[data-ui=\"n\"], one class prefix, no hex, no keyframes, no stripes", () => {
  const css = fs.readFileSync(path.join(ROOT, "web", "css", "product", "kit.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/@keyframes/.test(css)); assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css));
  // walk the blocks: selectors at depth 0 (or inside @media) must start with the scope
  const sels = []; let depth = 0, buf = "", media = [];
  for (const ch of css) {
    if (ch === "{") { const s = buf.trim(); if (s.startsWith("@media") || s.startsWith("@supports")) media.push(depth); else if (depth === 0 || media.includes(depth - 1)) sels.push(s); depth++; buf = ""; }
    else if (ch === "}") { depth--; buf = ""; if (media.length && media[media.length - 1] === depth) media.pop(); }
    else if (ch === ";" && depth > 0) buf = "";
    else buf += ch;
  }
  assert.ok(sels.length > 30);
  const topLevel = (s) => s.split(/,(?![^(]*\))/);                       // commas inside :is(...) do not separate selectors
  for (const s of sels) for (const part of topLevel(s)) assert.ok(part.trim().startsWith('html[data-ui="n"]'), part.trim());
  const classes = [...css.matchAll(/\.(n-[\w-]+)/g)].map((m) => m[1]);
  assert.deepEqual(classes.filter((c) => !c.startsWith("n-kit-")), []);
  assert.ok(!/border-(inline-start|inline-end|left|right)(-width)?\s*:\s*([3-9]|\d\d)px/.test(css), "no side stripe");
  assert.ok(!/border-radius:\s*(999|9999|50)/.test(css), "no capsules");
});

// ── share ────────────────────────────────────────────────────────────────────────────────────────────────
test("shareUrl: the hash link by default, the /s/ link when the server has share pages", () => {
  const loc = { origin: "https://cp.example", pathname: "/n.html" };
  share.setShareFeature(false);
  assert.equal(share.shareUrl("1031", "2", loc), "https://cp.example/n.html#/c/1031?q=2");
  assert.equal(share.shareUrl("1031", undefined, loc), "https://cp.example/n.html#/c/1031");
  assert.equal(share.shareUrl("a b", "3", loc), "https://cp.example/n.html#/c/a%20b?q=3");
  share.setShareFeature(true);
  try { assert.equal(share.shareUrl("1031", "2", loc), "https://cp.example/s/1031?q=2"); assert.equal(share.shareUrl("16", "", loc), "https://cp.example/s/16"); } finally { share.setShareFeature(false); }
  assert.equal(share.hasSharePages(), false);
});

test("probeShareFeature reads features.share from /api/health and never throws", async () => {
  assert.equal(await share.probeShareFeature(async () => ({ json: async () => ({ ok: true, features: { share: true } }) })).then(() => share.hasSharePages()), true);
  share.setShareFeature(false);
});

test("shareButton: copies and says so; falls back when the clipboard is blocked; uses the system sheet on touch", async () => {
  await dom({ clipboard: { writeText: async (t) => { globalThis.__copied = t; } } }, async (d) => {
    const btn = share.shareButton({ key: "1031", q: "2", title: "שדרות" });
    const heard = []; d.win.__cpAnnounce = undefined; globalThis.window.__cpAnnounce = (t) => heard.push(t);
    await btn.click(); await tick();
    assert.equal(globalThis.__copied, "https://cp.example/n.html#/c/1031?q=2");
    assert.deepEqual(heard, ["הקישור הועתק"]);
    assert.equal(btn.textContent, "הקישור הועתק");
  });
  await dom({ clipboard: { writeText: async () => { throw new Error("denied"); } }, execCommand: () => false }, async (d) => {
    const btn = share.shareButton({ key: "1031", q: "2", getUrl: () => "https://x/y" });
    await btn.click(); await tick();
    const dlg = d.body.find((e) => e.tagName === "DIALOG");
    assert.ok(dlg && dlg.open, "the link is offered in a field");
    assert.equal(dlg.find((e) => e.tagName === "INPUT").value, "https://x/y");
    assert.equal(btn.textContent, "שיתוף", "no false 'copied'");
    dlg.close();
  });
  const sent = [];
  await dom({ coarse: true, share: async (o) => { sent.push(o); }, clipboard: { writeText: async () => { throw new Error("must not copy"); } } }, async () => {
    await share.shareButton({ key: "1031", q: "1", title: "הכותרת" }).click(); await tick();
    assert.deepEqual(sent, [{ title: "הכותרת", url: "https://cp.example/n.html#/c/1031?q=1" }]);
  });
  await dom({ coarse: true, share: async () => { const e = new Error("cancel"); e.name = "AbortError"; throw e; }, clipboard: { writeText: async () => { throw new Error("must not copy"); } } }, async (d) => {
    const btn = share.shareButton({ key: "1031" }); await btn.click(); await tick();
    assert.equal(btn.textContent, "שיתוף", "a cancelled sheet is not an error");
    assert.equal(d.body.find((e) => e.tagName === "DIALOG"), null);
  });
});

// ── feedback ─────────────────────────────────────────────────────────────────────────────────────────────
test("feedback payload: the shape the server receives", () => {
  const loc = { hash: "#/c/1031/indicator/x", href: "https://cp.example/n.html#/c/1031/indicator/x" };
  const p = feedback.buildFeedback({ key: 1031, name: "שדרות", indicator: "mmr", dataDate: "2026-10-28" }, "  המספר לא נכון  ", " a@b.co ", loc);
  assert.deepEqual(p, { message: "המספר לא נכון", email: "a@b.co", key: "1031", name: "שדרות", indicator: "mmr", route: "#/c/1031/indicator/x", url: loc.href, dataDate: "2026-10-28" });
  assert.deepEqual(Object.keys(feedback.buildFeedback({}, "x", "", loc)), ["message", "email", "key", "name", "indicator", "route", "url", "dataDate"]);
  assert.equal(feedback.buildFeedback({}, "x".repeat(3000), "", loc).message.length, 2000);
  assert.equal(feedback.buildFeedback({ route: "r", url: "u" }, "x", "", loc).route, "r");
  assert.match(feedback.feedbackDetails(p), /^מה לא נכון: המספר לא נכון\nאימייל: a@b\.co\nיישוב: שדרות \(1031\)\nמדד: mmr\nקישור: https:/);
});

test("sendFeedback: ok on {ok:true}, a reason otherwise, never throws", async () => {
  const calls = [];
  const fx = (r) => async (u, o) => { calls.push([u, o]); if (r instanceof Error) throw r; return r; };
  const ok = await feedback.sendFeedback({ message: "m" }, { fetchFn: fx({ ok: true, status: 200, json: async () => ({ ok: true }) }) });
  assert.deepEqual(ok, { ok: true });
  assert.equal(calls[0][0], "/api/feedback"); assert.equal(calls[0][1].method, "POST"); assert.equal(calls[0][1].headers["Content-Type"], "application/json"); assert.equal(JSON.parse(calls[0][1].body).message, "m");
  assert.equal((await feedback.sendFeedback({}, { fetchFn: fx({ ok: false, status: 429, json: async () => ({ error: "slow down" }) }) })).error, "slow down");
  assert.equal((await feedback.sendFeedback({}, { fetchFn: fx({ ok: false, status: 404, json: async () => { throw new Error("html"); } }) })).ok, false);
  assert.equal((await feedback.sendFeedback({}, { fetchFn: fx({ ok: true, status: 200, json: async () => ({ ok: false }) }) })).ok, false);
  assert.equal((await feedback.sendFeedback({}, { fetchFn: fx(new TypeError("offline")) })).ok, false);
  assert.equal(calls.at(-1)[0], "/api/feedback");
  await feedback.sendFeedback({}, { fetchFn: fx({ ok: true, status: 200, json: async () => ({}) }), endpoint: "/x" }); assert.equal(calls.at(-1)[0], "/x");
});

test("the mistake dialog keeps the typed text when sending fails, offers the details, and forgets the draft after a send", async () => {
  await dom({ clipboard: { writeText: async (t) => { globalThis.__copied = t; } } }, async (d) => {
    const opener = d.doc.createElement("button"); d.body.append(opener); opener.focus();
    const mk = (fetchFn) => feedback.openFeedback({ key: "1031", name: "שדרות", indicator: "mmr" }, opener, { fetchFn });
    let h = mk(async () => { throw new TypeError("offline"); });
    const dlg = h.dlg, field = (cls, tag) => dlg.find((e) => e.tagName === tag && e.classes.has(cls));
    const msg = dlg.find((e) => e.tagName === "TEXTAREA"), form = dlg.find((e) => e.tagName === "FORM");
    assert.ok(dlg.open && d.doc.activeElement === msg, "the field is focused");
    const submit = () => form.fire("submit");
    await submit();
    assert.equal(msg.getAttribute("aria-invalid"), "true", "empty text is refused with a message");
    assert.match(dlg.find(byClass("n-kit-msg")).textContent, /כתבו כמה מילים/);
    msg.value = "הנתון לא נכון"; await msg.fire("input");
    await submit(); await tick();
    assert.match(dlg.find(byClass("n-kit-msg")).textContent, /^השליחה לא הצליחה\. אפשר להעתיק את הפרטים\.$/);
    assert.equal(msg.value, "הנתון לא נכון", "the text is still there");
    const details = dlg.findAll((e) => e.tagName === "TEXTAREA")[1];
    assert.equal(details.hidden, false); assert.match(details.value, /מה לא נכון: הנתון לא נכון/); assert.match(details.value, /יישוב: שדרות \(1031\)/);
    const copy = dlg.find((e) => e.tagName === "BUTTON" && /העתקת הפרטים/.test(e.textContent)); assert.equal(copy.hidden, false);
    await copy.click(); await tick(); assert.match(globalThis.__copied, /הנתון לא נכון/);
    h.close(); assert.equal(d.doc.activeElement, opener, "focus returns to the opener");
    // reopened: the draft is back; a successful send clears it
    let sentBody = null;
    h = mk(async (u, o) => { sentBody = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ ok: true }) }; });
    const msg2 = h.dlg.find((e) => e.tagName === "TEXTAREA"); assert.equal(msg2.value, "הנתון לא נכון");
    await h.dlg.find((e) => e.tagName === "FORM").fire("submit"); await tick();
    assert.equal(sentBody.message, "הנתון לא נכון"); assert.equal(sentBody.key, "1031"); assert.equal(sentBody.indicator, "mmr"); assert.equal(sentBody.route, "#/c/1031");
    assert.equal(h.dlg.find(byClass("n-kit-msg")).textContent, "תודה, הדיווח התקבל");
    h.close();
    h = mk(async () => ({ ok: true, json: async () => ({ ok: true }) }));
    assert.equal(h.dlg.find((e) => e.tagName === "TEXTAREA").value, "", "the draft was cleared after the send");
    h.close();
  });
});

// ── term, provenance, actions ────────────────────────────────────────────────────────────────────────────
test("termButton: an underlined word that opens the definition and gives the focus back", async () => {
  await dom({}, async (d) => {
    const btn = term.termButton("concern", "דורשים טיפול"); d.body.append(btn);
    assert.equal(btn.tagName, "BUTTON"); assert.equal(btn.textContent, "דורשים טיפול"); assert.equal(btn.getAttribute("aria-haspopup"), "dialog"); assert.ok(btn.classes.has("n-kit-term"));
    btn.focus(); await btn.click();
    const dlg = d.body.find((e) => e.tagName === "DIALOG");
    assert.ok(dlg.open && dlg.modal);
    assert.equal(dlg.find(byClass("n-kit-dlg-title")).textContent, "דורש טיפול");
    assert.equal(dlg.find(byClass("n-kit-def")).textContent, glossary.glossaryTerm("concern").short);
    assert.equal(dlg.find((e) => e.tagName === "A").getAttribute("href"), "#/c/1031/glossary#concern", "the page is a town page (#/c/1031): the link stays inside the town");
    assert.equal(dlg.getAttribute("aria-labelledby"), dlg.find(byClass("n-kit-dlg-title")).id);
    d.doc.activeElement = null; dlg.close();
    assert.equal(d.doc.activeElement, btn); assert.equal(d.body.find((e) => e.tagName === "DIALOG"), null);
    location.hash = "#/method";                                                              // a page without a town (the method page, the entry page): the top-level glossary
    await btn.click(); assert.equal(d.body.find((e) => e.tagName === "DIALOG").find((e) => e.tagName === "A").getAttribute("href"), "#/glossary#concern");
    d.body.find((e) => e.tagName === "DIALOG").close(); location.hash = "#/c/1031";
    await term.termButton("small").click(); assert.equal(d.body.find((e) => e.tagName === "DIALOG").find(byClass("n-kit-dlg-title")).textContent, "קבוצה קטנה");
    d.body.find((e) => e.tagName === "DIALOG").close();
    assert.equal(term.termButton("nope", "x").tagName, "SPAN", "an unknown id degrades to plain text");
    assert.equal(term.openTerm("nope"), null);
  });
});

test("provenance: publishers, years and date come from the rows and the model", async () => {
  await dom({}, async () => {
    const model = { builtAt: "2026-10-28T22:48:59.700Z", sources: [
      { id: "a", publisher: "משרד הבריאות (פורטל עולם הדאטה)" }, { id: "b", publisher: "משרד הבריאות, שירות בריאות התלמיד" },
      { id: "c", publisher: "הלשכה המרכזית לסטטיסטיקה" }, { id: "d", publisher: "המוסד לביטוח לאומי" }] };
    const rows = [{ id: "r1", source: "a", last: { year: 2021 } }, { id: "r2", source: "b", last: { year: 2024 } }, { id: "r3", source: "c", last: { year: 2023 } }];
    assert.deepEqual(provenance.publishersOf(model, rows), ["משרד הבריאות", "הלשכה המרכזית לסטטיסטיקה"]);
    assert.deepEqual(provenance.publishersOf(model, [{ id: "z" }]).length, 3, "rows that name no source: every source of the model, once each");
    assert.deepEqual(provenance.publishersOf(model, [{ id: "r1" }], { sourceOf: { r1: "d" } }), ["המוסד לביטוח לאומי"]);
    assert.deepEqual(provenance.publishersOf(model, [{ id: "r1" }], { sourceOf: (id) => (id === "r1" ? "c" : null) }), ["הלשכה המרכזית לסטטיסטיקה"]);
    assert.deepEqual(provenance.yearsOf(rows), { from: 2021, to: 2024 });
    assert.deepEqual(provenance.yearsOf([{ series: [{ year: 2015 }, { year: 2020 }], last: { year: 2020 } }], { span: "series" }), { from: 2015, to: 2020 });
    assert.equal(provenance.yearsOf([]), null);
    const text = provenance.provenanceText(model, rows).replace(/[⁦⁩]/g, "");
    assert.match(text, /^מקורות: משרד הבריאות ו?הלשכה המרכזית לסטטיסטיקה\. נתוני 2021-2024\. עודכן \d+ ב\S+ 2026\.$/);
    assert.equal(provenance.provenanceText({}, []), "");
    assert.equal(provenance.provenanceParts(model, [{ last: { year: 2022 } }]).years, "נתוני 2022.");
    const many = { sources: ["א", "ב", "ג", "ד", "ה", "ו"].map((p, i) => ({ id: "s" + i, publisher: p })) };
    assert.match(provenance.provenanceParts(many, []).sources, /^מקורות: א, ב, ג, ועוד 3 מקורות\.$/);
    const el = provenance.provenance(model, rows);
    assert.equal(el.tagName, "P"); assert.ok(el.classes.has("n-kit-prov"));
    const a = el.find((e) => e.tagName === "A"); assert.equal(a.getAttribute("href"), "#/method"); assert.match(a.textContent, /איך מחושבים המספרים/);
  });
});

test("actionsRow: the words of the copy table, the items of each variant, text links and no capsules", async () => {
  await dom({}, async () => {
    const star = () => { const b = document.createElement("button"); b.append("★"); return b; };
    const hero = actions.actionsRow({ variant: "hero", key: "1031", q: "1", star });
    const kids = hero.childNodes;
    assert.deepEqual(kids.map((k) => k.textContent), ["שיתוף", "דוח ליישוב (הדפסה / PDF)", "הורדת כל נתוני היישוב", "★"]);
    assert.equal(hero.getAttribute("role"), "group");
    assert.equal(kids[1].getAttribute("href"), "#/c/1031/brief"); assert.equal(kids[2].getAttribute("href"), "/api/city/1031/export.csv");
    const closing = actions.actionsRow({ variant: "closing", key: "1031", q: "2", download: { getRows: () => ({ rows: [], columns: [] }), name: "answer" }, feedback: { key: "1031" }, icons: true });
    assert.deepEqual(closing.childNodes.map((k) => k.textContent), ["לדוח ליישוב", "הורדת הטבלה של התשובה", "הדפסה", "שיתוף", "יש טעות בנתון?"]);
    assert.ok(closing.classes.has("n-kit-actions--icons"));
    assert.equal(closing.childNodes[1].tagName, "BUTTON");
    const some = actions.actionsRow({ items: ["print", "report", "star", "brief"], key: null });
    assert.deepEqual(some.childNodes.map((k) => k.textContent), ["הדפסה", "יש טעות בנתון?"], "no briefing link without a town, no star without a node");
    for (const el of [...kids, ...closing.childNodes]) assert.ok(el.classes.has("n-kit-act") || el.tagName === "BUTTON");
  });
});

// ── docs ─────────────────────────────────────────────────────────────────────────────────────────────────
test("kit README names every module and every export", () => {
  const readme = fs.readFileSync(path.join(KIT, "README.md"), "utf8");
  for (const [f, src] of kitFiles()) {
    if (!["csv.js", "glossary.js", "term.js", "feedback.js", "provenance.js", "actions.js", "plural.js", "from.js", "share.js", "base.js"].includes(f)) continue;
    assert.ok(readme.includes(f), f);
    for (const m of src.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)) assert.ok(readme.includes(m[1]), f + " " + m[1]);
  }
});
