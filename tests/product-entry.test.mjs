// The entry page of the product (web/js/product/entry): it renders when /api/health fails and when storage is blocked, shows the towns this browser follows (favourites first),
// takes its numbers from the server, and keeps to the words of SPEC 5.1 and 7.1. The page runs against a tiny fake document (tests/helpers/fake-dom.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installDom, fakeFetch } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = path.join(ROOT, "web", "js", "product");
const load = (f) => import(pathToFileURL(path.join(PROD, f)).href);
const text = await load("entry/text.js"), storage = await load("storage.js"), entry = await load("entry/entry.js"), askfield = await load("entry/askfield.js");
const realFetch = globalThis.fetch;

const META = { domains: [{ id: "context", label: "הקשר" }, { id: "immunization", label: "חיסונים" }, { id: "child", label: "בריאות הילד" }, { id: "capacity", label: "יכולת" }],
  indicators: [{ id: "a", domain: "context" }, { id: "b", domain: "immunization", guideline: { judges: true } }, { id: "c", domain: "immunization", guideline: { judges: true } }, { id: "d", domain: "child", guideline: { judges: false } }],          // two figures with an official target that judges, one with a target that only orients
  sources: { s1: { name: "טיפות חלב", publisher: "משרד הבריאות (פורטל)", url: "https://example.org/a" }, s2: { name: "מרשם", publisher: "משרד הבריאות", url: "https://example.org/b" }, s3: { name: "יישובים", publisher: "הלשכה המרכזית לסטטיסטיקה" } } };
const CITY = { city: { key: "1031", name: "שדרות" }, counts: { concern: 14, watch: 7, good: 3, strength: 2 }, coverage: { have: 35, total: 41 }, builtAt: "2026-10-28T22:48:59.700Z" };
const HEALTH = { ok: true, builtAt: CITY.builtAt, indicators: 41, localities: 1494 };

const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
const ctxOf = (h) => ({ key: null, model: null, fav: storage.fav, recents: storage.recents, announce() {}, themeBtn: () => h("button.theme-btn", "מצב כהה"), go() {} });

async function render({ routes, backend = memory(), seed } = {}) {
  const d = installDom({ storage: backend });
  storage.use(backend);
  globalThis.fetch = fakeFetch({ "/api/meta": META, "/api/city/1031": CITY, "/api/health": HEALTH, ...routes });
  try {
    storage.recents.clear(); storage.fav.clear();          // storage.js keeps a copy in memory too: every page starts from empty lists
    if (seed) seed();
    const { h } = await import(pathToFileURL(path.join(ROOT, "web", "js", "ui.js")).href);
    const view = await entry.entryView(ctxOf(h));
    await view.ready;
    return { d, view, node: view.node, text: view.node.textContent };
  } finally { storage.use(undefined); globalThis.fetch = realFetch; }
}

// first on purpose: api.js keeps what it has read for the session, so a run with nothing from the server has to come before the runs that read the catalogue
test("entry: with nothing at all from the server the search, the headline and how it works are still there", async () => {
  const r = await render({ routes: { "/api/health": new TypeError("x"), "/api/meta": new TypeError("x"), "/api/city/1031": new TypeError("x") } });
  try {
    assert.match(r.text, /איך מצב הבריאות ביישוב שלכם/); assert.match(r.text, /איך זה עובד/);
    for (const c of ["n-entry-trust", "n-entry-sample", "n-entry-domains", "n-entry-sources"]) assert.equal(r.node.find((e) => e.classes.has(c)).hidden, true, c + " stays out");
  } finally { r.d.restore(); }
});

test("entry: the page is a landing view with one h1, the headline, the search and no menu link to another version", async () => {
  const r = await render();
  try {
    assert.equal(r.view.landing, true); assert.equal(r.view.band, false);
    const h1 = r.node.findAll((e) => e.tagName === "H1");
    assert.equal(h1.length, 1);
    assert.match(h1[0].textContent, /איך מצב הבריאות ביישוב שלכם/);
    assert.ok(r.node.find((e) => e.attrs["data-town-search"] !== undefined), "the town search is on the page (the / key finds it)");
    assert.ok(!/עיצוב הקודם|\?ui=/.test(r.text + JSON.stringify(r.node.findAll((e) => e.attrs.href).map((e) => e.attrs.href))), "no link to another mode");
    assert.ok(!r.text.includes("{{"));
  } finally { r.d.restore(); }
});

test("entry: the three numbers come from /api/health and /api/meta, never typed", async () => {
  const r = await render({ routes: { "/api/health": { ...HEALTH, localities: 1777, indicators: 52 } } });
  try {
    const nums = r.node.find((e) => e.classes.has("n-entry-nums"));
    assert.ok(nums && !nums.parentNode.hidden);
    assert.match(nums.textContent, /1,777/); assert.match(nums.textContent, /52/);
    assert.match(nums.textContent, /3/, "the sources are counted from the catalogue");
    assert.ok(!/1,494/.test(r.text), "not the number of another run");
  } finally { r.d.restore(); }
});

test("entry: with a failing /api/health the page still renders, the numbers stay out and the rest is filled", async () => {
  const r = await render({ routes: { "/api/health": new TypeError("Failed to fetch") } });
  try {
    const trust = r.node.find((e) => e.classes.has("n-entry-trust"));
    assert.equal(trust.hidden, true, "no numbers without the server's count");
    assert.ok(r.node.find((e) => e.attrs["data-town-search"] !== undefined));
    assert.match(r.text, /איך זה עובד/); assert.match(r.text, /מאיפה המספרים/);
    assert.match(r.text, /14.*26/, "the live sample says what it is out of");
  } finally { r.d.restore(); }
});

test("entry: blocked storage does not stop the page, and the followed row stays out", async () => {
  const r = await render({ backend: blocked });
  try {
    assert.match(r.text, /איך מצב הבריאות ביישוב שלכם/);
    assert.equal(r.node.find((e) => e.classes.has("n-entry-mine")).hidden, true);
  } finally { r.d.restore(); }
});

test("entry: the followed row lists favourites first, then recents, each with a remove mark; removing and clearing work", async () => {
  const r = await render({ seed: () => { storage.recents.add({ key: "4000", name: "חיפה" }); storage.recents.add({ key: "5000", name: "תל אביב-יפו" }); storage.fav.add({ key: "3000", name: "ירושלים" }); } });
  try {
    const row = r.node.find((e) => e.classes.has("n-entry-mine"));
    assert.equal(row.hidden, false);
    const links = row.findAll((e) => e.tagName === "A").map((a) => a.textContent);
    assert.deepEqual(links, ["ירושלים", "תל אביב-יפו", "חיפה"], "favourites first, then the most recent");
    const xs = row.findAll((e) => e.classes.has("n-entry-x"));
    assert.equal(xs.length, 3);
    assert.match(xs[0].attrs["aria-label"], /הסרת ירושלים/);
    await xs[1].click();
    assert.ok(!storage.recents.has("5000") && storage.recents.has("4000"));
    assert.deepEqual(row.findAll((e) => e.tagName === "A").map((a) => a.textContent), ["ירושלים", "חיפה"]);
    await row.find((e) => e.classes.has("n-entry-clear")).click();
    assert.equal(row.hidden, true); assert.equal(storage.fav.list().length, 0); assert.equal(storage.recents.list().length, 0);
  } finally { r.d.restore(); }
});

test("entry: the compare link goes to the first followed town, or asks to choose a town first", async () => {
  const withTown = await render({ seed: () => storage.recents.add({ key: "4000", name: "חיפה" }) });
  try { assert.ok(withTown.node.find((e) => e.attrs.href === "#/c/4000/compare")); } finally { withTown.d.restore(); }
  const none = await render();
  try {
    const b = none.node.find((e) => e.classes.has("n-entry-cmp") && e.tagName === "BUTTON");
    assert.ok(b); await b.click();
    assert.match(none.node.find((e) => e.classes.has("n-entry-cmp-hint")).textContent, /בחרו יישוב קודם/);
  } finally { none.d.restore(); }
});

// ── the words and the numbers ──
test("text: fillTokens never lets braces show, vocab swaps the forbidden words", () => {
  assert.equal(text.fillTokens("מה מצב {{city}}?", { city: "שדרות" }), "מה מצב שדרות?");
  assert.equal(text.fillTokens("ב{{ name }} יש {{unknown}} מדדים.", { name: "חיפה" }), "בחיפה יש מדדים.");
  assert.equal(text.fillTokens("אין סוגריים"), "אין סוגריים");
  assert.ok(!text.hasToken(text.fillTokens("{{a}}{{b}} {{city}}", { city: "x" })));
  assert.equal(text.vocab("הפרמטרים וגם מדד רקע"), "המדדים וגם מדד מתאר בלבד");
  assert.equal(text.vocab("הנושאים המדאיגים"), "הנושאים הדורשים טיפול");
});

test("text: the sample sentence counts what was judged, and is null when nothing was", () => {
  assert.equal(text.sampleSentence(CITY).text, "בשדרות: 14 מתוך 26 מדדים דורשים טיפול");
  assert.equal(text.sampleSentence({ ...CITY, counts: { concern: 1, watch: 4 } }).text, "בשדרות: אחד מ-5 המדדים דורש טיפול");
  assert.equal(text.sampleSentence({ ...CITY, counts: { concern: 0, good: 3 } }).text, "בשדרות: אף אחד מ-3 המדדים אינו דורש טיפול");
  assert.equal(text.sampleSentence({ ...CITY, counts: { uncertain: 9 } }), null);
});

test("text: trust numbers, domains and sources are computed from the server's objects", () => {
  assert.deepEqual(text.trustNumbers(HEALTH, META).map((x) => [x.id, x.n]), [["localities", 1494], ["indicators", 41], ["sources", 3]]);
  assert.deepEqual(text.trustNumbers({}, null), []);
  assert.deepEqual(text.domainsOf(META).map((d) => [d.id, d.n]), [["context", 1], ["immunization", 2], ["child", 1]], "a domain without a figure is left out");
  const src = text.sourcesOf(META);
  assert.deepEqual(src.map((g) => [g.publisher, g.items.length]), [["משרד הבריאות", 2], ["הלשכה המרכזית לסטטיסטיקה", 1]]);
  assert.deepEqual(text.tracked([{ key: 1, name: "a" }], [{ key: 2, name: "b" }, { key: 1, name: "a" }]).map((t) => t.key + (t.fav ? "*" : "")), ["1*", "2"]);
});

test("ask field: an empty send says what to write and marks the field, the AI and privacy lines are always there", async () => {
  const d = installDom();
  try {
    let sent = null;
    const f = askfield.askField({ name: "שדרות", onSubmit: (q) => { sent = q; } });
    await f.form.fire("submit");
    assert.equal(f.input.getAttribute("aria-invalid"), "true");
    assert.equal(f.node.find((e) => e.classes.has("n-entry-ask-msg")).textContent, "כתבו שאלה, למשל: איך החיסונים בשדרות?");
    assert.equal(sent, null);
    f.input.value = " מה חלש? "; await f.form.fire("submit");
    assert.equal(sent, "מה חלש?"); assert.equal(f.input.getAttribute("aria-invalid"), null);
    assert.ok(f.node.textContent.includes("התשובה מנוסחת בבינה מלאכותית ומבוססת על מספרי המערכת בלבד."));
    assert.ok(f.node.textContent.includes("ואינה נשמרת בשרת"));
  } finally { d.restore(); }
});

test("entry css and js follow the rules: prefix n-entry-, no cream, no warm spots, no forbidden words", () => {
  const css = fs.readFileSync(path.join(ROOT, "web", "css", "product", "entry.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/cream|#f8f5ee|#f7f0e3|--le-/i.test(css));
  assert.ok(/html\[data-ui="n"\] \.n-entry/.test(css));
  const src = ["entry/entry.js", "entry/askfield.js", "entry/text.js"].map((f) => fs.readFileSync(path.join(PROD, f), "utf8")).join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const w of ["פרמטר", "מדאיג", "אחוזון", "מובהק", "המודל", "אנחנו", "בסיס קטן", "{{"]) assert.ok(!src.includes(w), "forbidden word in the entry sources: " + w);
  assert.ok(!/location\.hash\s*=/.test(src));
});

test("the opening is one centred column, and the entry stylesheet touches the band only through its own class and structure", async () => {
  const css = fs.readFileSync(path.join(ROOT, "web", "css", "product", "entry.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.match(css, /\.n-entry-band > :nth-child\(2\) \{[^}]*justify-items: center[^}]*text-align: center/, "eyebrow, headline, lede, search and towns share one axis");
  assert.match(css, /\.n-entry-band > :nth-child\(2\) > :last-child \{[^}]*max-width: 720px/, "the search is a column of its own width");
  assert.ok(!/\.n-band-/.test(css), "no class of band.css is restyled from here");
});

test("text: the old ask page's link to the ranking part is said without the first person plural", () => {
  const we = String.fromCharCode(0x05D0, 0x05E0, 0x05D7, 0x05E0, 0x05D5);          // the word SPEC 7.1 forbids
  const fixed = text.vocab("איפה " + we + " בדירוג · MMR/MMRV");
  assert.equal(fixed, "איפה היישוב בדירוג · MMR/MMRV");
});

// ── the words of the finished product (f3): one page, official targets, no word of the pages before the merge, no word of the retired short level ──
test("entry: the copy says what the finished product is: a town, one page, what it says, the official target, the sources", async () => {
  const r = await render();          // (api.js keeps the catalogue it read first: the fixture above is the one every run reads)
  try {
    const t = r.text.replace(/[\u2060\u2066-\u2069]/g, "").replace(/\u00A0/g, " ");
    for (const old of ["חמש שאלות פשוטות", "ככה נראית התשובה", "לתשובה המלאה", "ליעד של משרד הבריאות", "יעד של משרד הבריאות", "בעיר שלכם", "העיר", "״במבט אחד״", "״הפרטים המלאים״"]) assert.ok(!t.includes(old), "a word of the pages before the merge: " + old);
    for (const now of ["ביישוב שלכם", "דף אחד", "מה הולך טוב", "מה דורש תשומת לב", "מה כדאי לעשות", "על מה אין מידע", "דף היישוב של שדרות", "מה בודקים ביישוב", "יעד רשמי", "שיטה ומקורות"]) assert.ok(t.includes(now), "missing: " + now);
    assert.ok(t.includes("ול-2 מהם יש גם יעד רשמי שפרסם משרד הבריאות"), "the count of the figures with a target that judges is counted from the catalogue (2 of 4, and the orientation one is not in it)");
    assert.ok(t.includes("ועוד מדד רקע אחד, שמתאר את היישוב ואינו נשפט"), "the background figures are counted and named as such");
    assert.equal(r.node.findAll((e) => e.classes.has("n-entry-eyebrow") && e.textContent.trim() === "מה בודקים").length, 0, "no eyebrow that says the title again");
    const src = fs.readFileSync(path.join(PROD, "entry", "entry.js"), "utf8");          // the fake document cannot draw the icon of the link, so the link text is read from the source
    assert.ok(src.includes("`לדף של ${s.name}`") && src.includes("\"מה נמצא ומה חסר\"") && !src.includes("לתשובה המלאה"), "the link says the name the page has now: the town page");
    const links = r.node.findAll((e) => e.tagName === "A").map((a) => a.getAttribute("href"));
    assert.ok(links.includes("#/method"), "the sources line points at the method page");
  } finally { r.d.restore(); }
});

test("text: a single judged figure is the only one, and the count stands before the noun", () => {
  assert.equal(text.sampleSentence({ ...CITY, counts: { concern: 0, good: 1 } }).text, "בשדרות: המדד היחיד שנבדק אינו דורש טיפול");
  assert.equal(text.sampleSentence({ ...CITY, counts: { concern: 1, watch: 0 } }).text, "בשדרות: המדד היחיד שנבדק דורש טיפול");
});
