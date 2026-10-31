// The voice of the product (the owner's rule): neutral third person, never "we" (מצאנו, הצלחנו, נבדוק, אנחנו, לנו, שלנו),
// plural second person (לחצו, בחרו; never לחץ, בחר), no slash forms (תלחץ/י). The scan reads every string and template literal of
// web/js/product/** and every content: string of web/css/product/**, and fails with the file and the line.
// The old page modules (web/js/pages, web/js/viz ...) are not edited: their "we" sentences are swapped on the screen by neutral.js, and a test here keeps that table complete.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scan, walk, findVoice, literals } from "./helpers/voice-scan.mjs";
import { PHRASES, WORDS, neutral } from "../web/js/product/neutral.js";
import { FORBIDDEN } from "../web/js/product/city/copy.js";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const FILES = [...walk(path.join(WEB, "js", "product"), ".js"), ...walk(path.join(WEB, "css", "product"), ".css")];
const rel = (f) => path.relative(WEB, f).replace(/\\/g, "/");

// Real non-text cases only: file (under web/), the start of the string (or all: the whole file), and why it is not a sentence the reader meets.
const ALLOW = [
  { file: "js/product/city/copy.js", text: "אנחנו", why: "FORBIDDEN, the list of words the tests keep off the screen: a data list, never shown" },
  { file: "js/product/city/copy.js", text: "לנו", why: "FORBIDDEN, same list" },
  { file: "js/product/neutral.js", all: true, why: "the table of old sentences it swaps (the neutral side of the table is checked below)" }
];
const allowed = (h) => ALLOW.some((a) => rel(h.file) === a.file && (a.all || h.text.startsWith(a.text)));

test("no first person plural, singular imperative or slash form in a string of web/js/product or web/css/product", () => {
  const bad = scan(FILES).filter((h) => !allowed(h)).map((h) => `${rel(h.file)}:${h.line} [${h.kind}: ${h.word}] ${h.text}`);
  assert.deepEqual(bad, []);
});

test("every allow-list entry still matches a string (no stale reason left behind)", () => {
  const hits = scan(FILES);
  for (const a of ALLOW) assert.ok(hits.some((h) => rel(h.file) === a.file && (a.all || h.text.startsWith(a.text))), `stale: ${a.file} "${a.text || ""}"`);
});

test("the neutral side of the neutral.js table is clean, and the table swaps what it says", () => {
  for (const [from, to] of PHRASES) {
    assert.deepEqual(findVoice(to), [], to);
    assert.ok(findVoice(from).length, "the old side must be a sentence the scan flags: " + from);
    assert.equal(neutral(`x ${from} y`), `x ${to} y`);
  }
  assert.equal(neutral("מילה אחרת"), "מילה אחרת");
});

test("a word the product never says (the old status label \"בסיס קטן\") is swapped for the product's own, and the new side is clean", () => {
  for (const [from, to] of WORDS) {
    assert.ok(FORBIDDEN.some((w) => from.includes(w)), "the old side holds a forbidden word: " + from);
    assert.ok(!FORBIDDEN.some((w) => to.includes(w)), "the new side is clean: " + to);
    assert.deepEqual(findVoice(to), [], to);
    assert.equal(neutral(`x ${from} y`), `x ${to} y`);
  }
});

test("every sentence of the old page modules that speaks as \"we\" is in the neutral.js table", () => {
  const SKIP = /[\\/](product|lab)[\\/]|[\\/](main|gallery)\.js$/;          // the product itself is scanned above; the lab and the old shell are not the product
  const files = walk(path.join(WEB, "js"), ".js").filter((f) => !SKIP.test(f));
  const bad = scan(files).filter((h) => ["we", "we-verb", "we-future"].includes(h.kind) && findVoice(neutral(h.text)).some((x) => x[0].startsWith("we")))
    .map((h) => `${rel(h.file)}:${h.line} [${h.kind}: ${h.word}] ${h.text}`);
  assert.deepEqual(bad, [], "add the sentence to PHRASES in web/js/product/neutral.js");
});

test("the finder: catches the forms, lets the neutral voice and real words pass", () => {
  const kinds = (t) => findVoice(t).map((x) => x[0]);
  assert.ok(kinds("לא מצאנו את היישוב").includes("we-verb"));
  assert.ok(kinds("לא הצלחנו לטעון").includes("we-verb"));
  assert.ok(kinds("חישבנו מחדש").includes("we-verb"));
  assert.ok(kinds("נבדוק את זה").includes("we-future"));
  assert.ok(kinds("איך נדע").includes("we-future"));
  assert.ok(kinds("אנחנו חזקים").includes("we"));
  assert.ok(kinds("בנתונים שלנו").includes("we"));
  assert.ok(kinds("לחץ כאן").includes("singular"));
  assert.ok(kinds("בחר יישוב").includes("singular"));
  assert.ok(kinds("תלחץ/י כאן").includes("slash"));
  assert.ok(kinds("הנתונים שלך").includes("you-singular"));
  for (const ok of ["היישוב לא נמצא", "הדף לא נטען. נסו לרענן.", "נבדקו 41 מדדים", "לחצו כאן", "בחרו יישוב", "אפשר לבדוק", "המדד הבא", "הולך טוב", "הנתון אינו מתפרסם", "נתונים עודכנו: 2025", "ממנו", "המשך המגמה"]) assert.deepEqual(findVoice(ok), [], ok);
});

test("the tokenizer reads strings and templates, skips comments and regex, and gives the right line", () => {
  const src = ["// לא מצאנו (a comment)", "const a = /לא מצאנו/.test(x);", 'const b = "שלום";', "const c = `היי ${\"בדקנו\"} ועוד`;", "/* חישבנו */", "const d = 'ג';"].join("\n");
  const got = literals(src).map((l) => `${l.line}:${l.text.replace(/\s+/g, " ").trim()}`);
  assert.deepEqual(got, ["3:שלום", "4:בדקנו", "4:היי ועוד", "6:ג"]);
});

test("the catalogue sentences the server sends read in the neutral voice once neutral.js has run (the source stays Bob's)", async () => {
  const fs = await import("node:fs");
  const CAT = path.join(WEB, "..", "src", "catalog");
  const bad = scan(["domains.js", "indicators.js", "interventions.js", "sources.js"].map((f) => path.join(CAT, f)))
    .filter((h) => findVoice(neutral(h.text)).length).map((h) => `${path.basename(h.file)}:${h.line} ${h.word}`);
  assert.deepEqual(bad, [], "a slash form or a \"we\" in src/catalog: add it to PHRASES in neutral.js and list it in NEEDS for Bob");
  assert.ok(fs.existsSync(CAT));
});

// ── the place, the names of figures and the spelling: the same pass of neutral.js (f3) ──
import fs from "node:fs";
import { PLACE, NAMES, SPELL } from "../web/js/product/neutral.js";

test("the place: every old sentence about 'העיר' that agrees with the noun is swapped whole, and every other 'העיר', 'בעיר' and 'בעירייה' follows the pattern", () => {
  for (const [from, to] of PLACE) {
    assert.ok(/העיר/.test(from) && !/העיר/.test(to), from);
    assert.equal(neutral(`x ${from} y`), `x ${to} y`);
    assert.ok(findVoice(to).length === 0, to);
  }
  assert.equal(neutral("מדד רקע: מתאר את העיר ואינו נשפט כטוב או רע."), "מדד רקע: מתאר את היישוב ואינו נשפט כטוב או רע.");
  assert.equal(neutral("איפה העיר מבין כולם"), "איפה היישוב מבין כולם");
  assert.equal(neutral("פער בין קבוצות בעיר, מהעיר, והעיר, בתוך העיר"), "פער בין קבוצות ביישוב, מהיישוב, והיישוב, בתוך היישוב");
  assert.equal(neutral("העיר מסומנת בכחול בכל התצוגות"), "היישוב מסומן בכחול בכל התצוגות", "the verb agrees with the new noun");
  assert.equal(neutral("ואם אין או שהעיר עומדת בו"), "ואם אין או שהיישוב עומד בו");
  assert.equal(neutral("המחלקה לבריאות בעירייה"), "המחלקה לבריאות ברשות המקומית");
  for (const same of ["אגף ההנדסה של העירייה", "עירון", "צעיר", "העירייה", "בעיריית תל אביב"]) assert.equal(neutral(same), same, "a longer word is left alone: " + same);
});

test("no sentence of an old page module that the product shows says 'העיר' for a town after the swap, and none is left with a feminine verb for the new noun", () => {
  const PAGES = path.join(WEB, "js", "pages"), VIZ = path.join(WEB, "js", "viz");
  const files = [...fs.readdirSync(PAGES).filter((f) => f.endsWith(".js") && f !== "overview.js").map((f) => path.join(PAGES, f)), ...fs.readdirSync(VIZ).filter((f) => f.endsWith(".js") && !/^gallery/.test(f)).map((f) => path.join(VIZ, f)), path.join(WEB, "js", "ui.js")];
  const FEM = /היישוב\s+(מסומנת|עומדת|רחוקה|מרוחקת|טובה|חלשה|חזקה|נמצאת|מופיעה|נשפטת|נבדקת|נראית)/;
  const left = [];
  let seen = 0;
  for (const f of files) for (const s of literals(fs.readFileSync(f, "utf8"))) {
    if (!/העיר|בעיר|בעירייה/.test(s.text)) continue;
    seen++;
    const t = neutral(s.text);
    if (/(^|[^\u05D0-\u05EA])[ולמכשב]{0,2}העיר($|[^\u05D0-\u05EA])|(^|[^\u05D0-\u05EA])[וש]?בעיר($|[^\u05D0-\u05EA])/.test(t) || FEM.test(t)) left.push(`${rel(f)}:${s.line} ${t.slice(0, 80)}`);
  }
  assert.ok(seen >= 20, "the scan found the sentences it is about: " + seen);
  assert.deepEqual(left, []);
});

test("names of figures: a Latin code in brackets goes, the measles vaccine says its three diseases, a name with a colon is a phrase; a document's own name is left alone", () => {
  for (const [from, to] of NAMES) assert.equal(neutral(`x${from}y`), `x${to}y`);
  assert.equal(neutral("פעוטות שחוסנו נגד חצבת, חזרת ואדמת (MMR/MMRV) עד גיל 13 חודשים"), "פעוטות שחוסנו נגד חצבת, חזרת ואדמת עד גיל 13 חודשים");
  assert.equal(neutral("פעוטות שקיבלו 4 מנות חיסון מחומש (DTaP-IPV-Hib) עד גיל 18 חודשים"), "פעוטות שקיבלו 4 מנות חיסון מחומש עד גיל 18 חודשים");
  assert.equal(neutral("MMR/MMRV"), "חצבת, חזרת ואדמת");
  assert.equal(neutral("MMR/MMRV: 51.9%"), "חצבת, חזרת ואדמת: 51.9%");
  assert.equal(neutral("חיסון MMR/MMRV עד גיל 13 חודשים"), "חיסון חצבת, חזרת ואדמת עד גיל 13 חודשים");
  assert.equal(neutral("עוני: ילדים: נקודת ייחוס"), "עוני בקרב ילדים: נקודת ייחוס");
  assert.equal(neutral("פגיעות ילדים: אשפוז"), "אשפוזים בעקבות פגיעות ילדים");
  for (const same of ["השמנה בילדים באזור אירופה של ארגון הבריאות העולמי: הסבב החמישי של COSI", "מאגר המשפחה של OECD: עוני ילדים (CO2.2)", "חיסון MMR 359", "WHO Healthy Cities"]) assert.equal(neutral(same), same, "a document's name: " + same);
});

test("spelling: 'התוכנית' and one 'בין-לאומי' whichever way the old text spells it", () => {
  assert.equal(neutral("התכנית הלאומית למדדי איכות"), "התוכנית הלאומית למדדי איכות");
  assert.equal(neutral("בתכנית, לתכנית ותכנית"), "בתוכנית, לתוכנית ותוכנית");
  assert.equal(neutral("מסגרות בינלאומיות, יעד בין־לאומי, ארגון בין\u2011לאומי, בין-לאומי"), "מסגרות בין-לאומיות, יעד בין-לאומי, ארגון בין-לאומי, בין-לאומי");
  assert.equal(neutral("תכניות"), "תכניות", "a longer word is left alone");
  assert.ok(SPELL.length >= 5);
});

test("the target in a finding or a status line is the official one: 'ליעד משרד הבריאות' says 'ליעד הרשמי'; where the publisher is named as the source the words stay; no old module says it any other way after the swap", () => {
  assert.equal(neutral("5.9 נק׳ מתחת ליעד משרד הבריאות (90%)."), "5.9 נק׳ מתחת ליעד הרשמי (90%).");
  assert.equal(neutral("חסרות 28.1 נק׳ ליעד משרד הבריאות והמגמה בהידרדרות."), "חסרות 28.1 נק׳ ליעד הרשמי והמגמה בהידרדרות.");
  assert.equal(neutral("תקין: הערך טוב יותר מ-62% מהיישובים, עומד ביעד משרד הבריאות, ואין הידרדרות."), "תקין: הערך טוב יותר מ-62% מהיישובים, עומד ביעד הרשמי, ואין הידרדרות.");
  assert.equal(neutral("בנתוני שנת 2026 · יעד משרד הבריאות (80%)"), "בנתוני שנת 2026 · יעד רשמי (80%)");
  assert.equal(neutral("כדאי להשוות גם ליעד משרד הבריאות ולא רק לממוצע הארצי"), "כדאי להשוות גם ליעד הרשמי ולא רק לממוצע הארצי");
  for (const same of ["יעד של משרד הבריאות לנותני שירות בתוכנית הלאומית", "יעד רשמי של משרד הבריאות", "משרד הבריאות", "מדד שיעד משרד הבריאות"]) assert.equal(neutral(same), same, "left alone: " + same);
  const PAGES = path.join(WEB, "js", "pages"), VIZ = path.join(WEB, "js", "viz"), left = [];
  const files = [...fs.readdirSync(PAGES).filter((f) => f.endsWith(".js") && f !== "overview.js").map((f) => path.join(PAGES, f)), ...fs.readdirSync(VIZ).filter((f) => f.endsWith(".js") && !/^gallery/.test(f)).map((f) => path.join(VIZ, f)), path.join(WEB, "js", "ui.js")];
  let seen = 0;
  for (const f of files) for (const s of literals(fs.readFileSync(f, "utf8"))) { if (!/יעד משרד הבריאות/.test(s.text)) continue; seen++; if (/יעד משרד הבריאות/.test(neutral(s.text))) left.push(`${rel(f)}:${s.line}`); }
  assert.ok(seen >= 2, "the scan found the sentences it is about (ui.js statusReason, the old pages): " + seen);
  assert.deepEqual(left, []);
});

test("the pass reaches the shared hover card in the body and the crumbs (the two places outside the view)", () => {
  const src = fs.readFileSync(path.join(WEB, "js", "product", "neutral.js"), "utf8"), shell = fs.readFileSync(path.join(WEB, "js", "product", "shell.js"), "utf8");
  assert.ok(/body > \.tt/.test(src) && /classList\.contains\("tt"\)/.test(src), "the card element is watched");
  assert.ok(/import\("\.\/neutral\.js"\)/.test(shell) && !/^import .*neutral/m.test(shell), "the crumbs are swapped through a late import, not a static one (neutral.js stays off the first paint)");
});

test("the tab title and the crumb of a figure's page say its plain name (copy.js shortName), not the catalogue's code", () => {
  const routes = fs.readFileSync(path.join(WEB, "js", "product", "routes.js"), "utf8");
  assert.ok(/title: shortName\(a\)/.test(routes) && /title: shortName\(known\)/.test(routes) && !/title: (a|known)\.short/.test(routes));
  const SHORT = { th_mmrv: "חצבת, חזרת ואדמת", pov_children: "עוני בקרב ילדים" };
  return import("../web/js/product/city/copy.js").then((C) => { for (const [id, name] of Object.entries(SHORT)) assert.equal(C.shortName({ id, short: "MMR/MMRV" }), name); });
});
