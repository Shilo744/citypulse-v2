// The words of the city home (SPEC 7.1 to 7.3): no forbidden word, no raw template token, no leftover of code in a sentence, in the source strings of city/
// and in every sentence, lede and basis line of the fixtures.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { haveStore, all } from "./helpers/city-models.mjs";

const CITY = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "js", "product", "city");
const load = (f) => import(pathToFileURL(path.join(CITY, f)).href);
const S = await load("sentence.js"), C = await load("copy.js"), D = await load("data.js"), { GROUPS } = await load("groups.js");
const M = haveStore ? all() : {};
const skip = !haveStore && "the built store is not there";

// a word as a word: not inside a longer Hebrew word (לנו is not a part of כלנו), though a Hebrew prefix letter may stand before the long ones
const HE = "\\u0590-\\u05FF";
const WHOLE = ["אנחנו", "לנו"], PARTS = ["פרמטר", "מדאיג", "אחוזון", "מובהק", "המודל", "בסיס קטן", "{{"];
const found = (t) => [...WHOLE.filter((w) => new RegExp(`(^|[^${HE}])${w}($|[^${HE}])`).test(t)), ...PARTS.filter((w) => t.includes(w))];

const strings = (src) => {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l) && !/FORBIDDEN\s*=/.test(l)).join("\n").replace(/\s\/\/ .*$/gm, "");
  return [...code.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] || m[2] || m[3] || "").filter((s) => /[֐-׿]/.test(s));
};

test("no forbidden word in a string of city/ (SPEC 7.1)", () => {
  const bad = [];
  for (const f of fs.readdirSync(CITY).filter((x) => x.endsWith(".js"))) for (const s of strings(fs.readFileSync(path.join(CITY, f), "utf8"))) { const w = found(s); if (w.length) bad.push(`${f}: ${w.join(",")} in "${s.slice(0, 50)}"`); }
  assert.deepEqual(bad, []);
});

test("the forbidden list of the copy table is the list of SPEC 7.1 and the finder works", () => {
  assert.ok(["פרמטר", "מדאיג", "אחוזון", "מובהק", "המודל", "אנחנו", "לנו", "בסיס קטן", "{{"].every((w) => C.FORBIDDEN.includes(w)));
  assert.deepEqual(found("מה עושים אצלנו?"), []);
  assert.deepEqual(found("כלנו ולנו וגם לנו"), ["לנו"]);
  assert.deepEqual(found("פרמטרים מדאיגים"), ["פרמטר", "מדאיג"]);
});

test("every sentence, lede and basis line of every fixture is clean", { skip }, () => {
  const bad = [];
  for (const [k, m] of Object.entries(M)) {
    const lines = [S.basisLine(m).text, ...C.QUESTIONS(m.city.name).map((q) => q.text)];
    for (const q of C.QIDS) { const a = S.answer(m, q), meta = S.shareMeta(m, q); lines.push(a.plain, a.ledePlain, meta.title, meta.description, C.HOWTO[q]); }
    for (const a of D.weakestFive(m)) lines.push(D.rowReason(a).rest);
    for (const t of lines) {
      const w = found(t);
      if (w.length) bad.push(`${k}: ${w.join(",")} in "${t.slice(0, 60)}"`);
      if (/undefined|NaN|\bnull\b|\[object|\$\{/.test(t)) bad.push(`${k}: leftover in "${t.slice(0, 60)}"`);
      if (/\b1 (מדדים|צעדים|יישובים)|\b0 מדד\b/.test(t)) bad.push(`${k}: a digit for one or none in "${t.slice(0, 60)}"`);
    }
  }
  assert.deepEqual(bad, []);
});

test("one fact, one word: the vocabulary of SPEC 7.1 in the sentences", { skip }, () => {
  const t = Object.values(M).flatMap((m) => C.QIDS.map((q) => { const a = S.answer(m, q); return a.plain + " " + a.ledePlain; })).join(" ");
  assert.doesNotMatch(t, /מדד רקע/);
  assert.doesNotMatch(t, /מחמיר|טוב יותר\/חלש יותר/);
  assert.match(t, /דורשים טיפול/);
  assert.match(t, /קבוצות? קטנות? מדי/);
});

test("the no-data sentences never promise data to come", () => {
  const nd = ["weak", "changed", "peers", "first", "missing"].map((q) => C.T.nodata[q]("אבו סריחאן")).join(" ") + C.T.nodata.text("אבו סריחאן", false) + C.T.nodata.text("אבו סריחאן", true);
  assert.doesNotMatch(nd, /עדיין/);
});

test("the copy table of SPEC 7.3 is in the strings", () => {
  assert.equal(C.T.ask.placeholder("שדרות"), "מה תרצו לדעת על הבריאות בשדרות?");
  assert.equal(C.T.ask.short("שדרות"), "שאלו על שדרות…");
  assert.equal(C.T.ask.note, "התשובה מנוסחת בבינה מלאכותית ומבוססת על מספרי המערכת בלבד.");
  assert.equal(C.T.ask.empty("שדרות"), "כתבו שאלה, למשל: איך החיסונים בשדרות?");
  assert.equal(C.T.ask.off("שדרות"), "אין על שדרות נתונים כדי לענות");
  assert.equal(C.WELCOME.title, "איך קוראים את העמוד");
  assert.equal(C.WELCOME.lines.length, 3);
  assert.equal(C.WELCOME.ok, "הבנתי");
  assert.equal(C.T.suggest.domain("נפש ורווחה", "אבו גוש"), "איך המצב בתחום נפש ורווחה באבו גוש?");          // was "איך מצב נפש באבו גוש?" (the first word of the category, which is not a sentence)
  assert.equal(C.T.suggest.trend("שעלת"), "מה השתנה במדד שעלת בשנים האחרונות?");          // was "איך שעלת השתנה" (the verb has to agree with the name; "מה השתנה" agrees with none)
  assert.equal(C.T.nodata.basis, "אין נתונים רשמיים על היישוב");
  assert.match(C.T.nodata.text("אבו סריחאן", true), /ייתכן שהנתונים כלולים במועצה האזורית/);
  assert.equal(C.T.statement, "התמונה כאן מכוונת לשאלות ולתעדוף, לא לציון או לדירוג של היישוב.");
});

test("C-23: a long step headline is cut at a clause, ends with an ellipsis and no full stop, and the lede carries the whole title", { skip }, () => {
  const h = D.stepHeadline({ title: "להציג את זמני ההמתנה ואת מחסור הרופאים לקופות החולים ולמחוז משרד הבריאות ולדרוש תוכנית כתובה" });
  assert.ok(h.clamped && h.text.endsWith("…") && h.text.length <= 70, h.text);
  assert.ok(!/(משרד|ל|ו|את|של|עם)…$/.test(h.text) && h.text.endsWith("החולים…"), h.text);
  for (const [k, m] of Object.entries(M)) {
    const a = S.answer(m, "first");
    assert.ok(!/…\./.test(a.plain), `${k}: ${a.plain}`);
    if (a.kind === "answer" && a.plain.includes("…")) assert.ok(a.ledePlain.startsWith(D.stepHeadline(m.recommendations[0]).full), k);
  }
});

test("the hero parts are named with n-home- classes, the home never styles the classes of the shared band, and the chart labels are plain text", () => {
  const css = fs.readFileSync(path.join(CITY, "..", "..", "..", "css", "product", "home.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/\.n-(band|kit|shell)-[a-z]/.test(css), "home.css uses a class of another file");
  assert.match(css, /\.v-cmp-badge \{[^}]*border-radius: 0;[^}]*background: none/);
  assert.match(css, /\.v-cmp-ref-tag \{[^}]*border-radius: 0;[^}]*box-shadow: none/);
  const home = fs.readFileSync(path.join(CITY, "home.js"), "utf8");
  for (const c of ["n-home-hero-in", "n-home-hero-actions", "n-home-hero-ask", "n-home-hero-row"]) assert.ok(home.includes(c), c);
  assert.ok(!/ask-note[^}]*text-shadow/.test(css), "the note no longer needs a glow: it is above the picture");
});

test("answers.js keeps no bidi control character in its source (none is needed any more)", () => {
  const src = fs.readFileSync(path.join(CITY, "answers.js"), "utf8");
  assert.ok(!/[\u2066-\u2069\u200e\u200f\u202a-\u202e]/.test(src));
});

// ── the question chips and the how-to-read note (f3) ──
const require = createRequire(import.meta.url);
const CATALOGUE = require("../src/catalog/indicators.js").indicators;
const NAMES = ["אבו גוש", "שדרות", "בית ניר", "הרצליה", "תל אביב-יפו"];

test("question chips: every figure of the catalogue has its own phrase, and 'מה השתנה' is the only verb of the sentence, so nothing has to agree with the name", () => {
  assert.deepEqual(CATALOGUE.map((i) => i.id).filter((id) => !C.CHANGE_OF[id]), [], "a figure without a phrase would be said as 'במדד …'");
  assert.deepEqual(Object.keys(C.CHANGE_OF).filter((id) => !CATALOGUE.some((i) => i.id === id)), [], "a phrase for a figure that is no longer in the catalogue");
  for (const i of CATALOGUE) {
    const t = C.T.suggest.trend(i);
    assert.ok(/^מה השתנה ב\S/.test(t) && t.endsWith(" בשנים האחרונות?"), t);
    assert.equal(t.split(" השתנ").length, 2, "one verb, and it is 'מה השתנה': " + t);
    assert.ok(!/השתנו|השתנתה|ישתנה/.test(t), t);
    assert.ok(!/\bב(המדד|החיסון|הרעש|הביקור|הפגיעה|ההנקה|התאונות|הרצון|השיעור|הזמן)/.test(t), "ב and the article are one letter: " + t);
    assert.ok(!/[A-Za-z/]|\d/.test(t), "no Latin letter or digit in a chip: " + t);
  }
  assert.equal(C.T.suggest.trend({ id: "road_severe_100k" }), "מה השתנה בתאונות הדרכים הקשות בשנים האחרונות?");
  assert.equal(C.T.suggest.trend({ id: "wait_gyn_days" }), "מה השתנה בזמן ההמתנה לרופא נשים בשנים האחרונות?");
  assert.equal(C.T.suggest.trend({ id: "child_injury_ed_1000" }), "מה השתנה בביקורי הילדים בחדר מיון בשל פגיעה בשנים האחרונות?");
  assert.equal(C.T.suggest.trend({ id: "ses_index" }), "מה השתנה במדד החברתי-כלכלי בשנים האחרונות?");
  assert.equal(C.T.suggest.trend({ id: "a_new_figure", short: "מדד חדש" }), "מה השתנה במדד מדד חדש בשנים האחרונות?", "a figure that is not in the table is named as a measure");
  assert.equal(C.T.suggest.trend("שעלת"), "מה השתנה במדד שעלת בשנים האחרונות?");
});

test("question chips: the category chip carries the whole name the menu shows, for several towns", { skip }, () => {
  for (const name of NAMES) for (const g of GROUPS.filter((x) => !x.background)) {
    const t = C.T.suggest.domain(g.label, name);
    assert.equal(t, `איך המצב בתחום ${g.label} ב${name}?`);
    assert.ok(!/איך מצב (נפש|ילדים|בריאות|בטיחות) /.test(t), "the first word of a category is not a sentence: " + t);
  }
  for (const k of Object.keys(M)) {
    const wd = D.weakestDomain(M[k]);
    if (wd) assert.ok(GROUPS.some((g) => g.label === wd.label), k + ": the weakest category is one of the menu's");
  }
});

test("the how-to-read note names only the sections the page shows, in the page's order", () => {
  const all = C.welcomeLines()[0];
  assert.equal(C.WELCOME.lines[0], all, "the default is the full page");
  const order = ["מה הולך טוב", "מה דורש תשומת לב", "מה השתנה", "איך מול יישובים דומים", "מה כדאי לעשות", "על מה אין מידע"].map((s) => all.indexOf(s));
  assert.ok(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1])), all);
  const small = C.welcomeLines(["n-sec-small", "n-sec-missing"])[0];
  assert.match(small, /המספרים שיש ועל מה אין מידע\.$/);
  for (const w of ["מה הולך טוב", "מה דורש תשומת לב", "מה כדאי לעשות", "מה השתנה", "יישובים דומים"]) assert.ok(!small.includes(w), "a small town has no section '" + w + "'");
  assert.equal(C.welcomeLines(["n-sec-weak"])[0].includes(" ו"), false, "one section is not a list");
  assert.equal(C.welcomeLines().length, 3);
});

test("the how-to-read note of the town page is built from the sections the page drew (a small town, a town with everything)", { skip }, async () => {
  const { installDom, fakeFetch } = await import("./helpers/fake-dom.mjs");
  const storage = await import(pathToFileURL(path.join(CITY, "..", "storage.js")).href), home = await load("home.js");
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  for (const key of ["1031", "16"].filter((k) => M[k])) {
    const backend = mem(), d = installDom({ storage: backend }), realFetch = globalThis.fetch;
    storage.use(backend);
    const base = fakeFetch({ "/api/meta": { domains: [], sources: {}, indicators: [] }, "/api/health": { ok: true } });
    globalThis.fetch = async (url) => (/\/indicator\//.test(String(url)) ? { ok: false, status: 404, json: async () => ({}) } : base(url));
    try {
      const v = await home.cityHome({ key, model: M[key], params: new URLSearchParams("v=full"), go() {}, announce() {}, setTitle() {}, signal: undefined }, {});
      await new Promise((r) => setTimeout(r, 60));
      const sections = v.node.findAll((e) => e.tagName === "SECTION" && /^n-sec-/.test(e.id)).map((e) => e.id);
      const note = v.node.find((e) => e.classes.has("n-home-welcome-l")), first = note.findAll((e) => e.tagName === "LI")[0].textContent;
      assert.equal(first, C.welcomeLines(sections)[0], key + ": the note lists the sections drawn: " + sections.join(","));
      if (key === "16") assert.ok(!sections.includes("n-sec-good") && !first.includes("מה הולך טוב"), "a small town: no 'what goes well' in the note");
    } finally { d.restore(); storage.use(undefined); globalThis.fetch = realFetch; }
  }
});
