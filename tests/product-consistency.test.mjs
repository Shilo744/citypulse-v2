// One town, one answer (the w2 pass): the town page states the count and the weakest category as the data does (the overview page is retired), the very small town rule moved to the town page's tests,
// the two download links have two different names, the voice has no "we", and the print rules of the adapters. The live check of every page against every other is
// `node src/tools/consistency_probe.js` (it opens the real pages); this file covers the same rules on the models of the store, without a browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { haveStore, model } from "./helpers/city-models.mjs";
import { installDom } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCT = path.join(ROOT, "web", "js", "product"), CSS = path.join(ROOT, "web", "css", "product", "pages");
const load = (f) => import(pathToFileURL(path.join(PRODUCT, f)).href);
const read = (f) => fs.readFileSync(f, "utf8");
const skip = !haveStore && "the built store is not there";
const TOWNS = ["1031", "9000", "3000", "99", "472", "2710", "16", "7", "935"];          // the nine towns of the red team (R-04)
const clean = (s) => String(s || "").replace(/[⁦-⁩‎‏⁠]/g, "").replace(/\s+/g, " ").trim();
const D = await load("city/data.js"), S = await load("city/sentence.js");
const ui = await load("../ui.js");

// R-04 (moved with the overview page, m3): the town page is the one screen that states the count, and it names the weakest category the way the data does
test("R-04: the first answer of the town page carries the count with its denominator and the weakest category, for the nine towns", { skip }, () => {
  let named = 0;
  for (const key of TOWNS) {
    const m = model(key);
    if (!m || !m.summary) continue;                                                            // 935: no coverage, the page shows the calm spot
    const said = clean(S.answer(m, "weak").plain), st = D.stateOf(m), c = st.all.concern || 0, wd = c >= 2 ? D.weakestDomain(m) : null;
    if (c >= 2) assert.ok(said.includes(`${c} מתוך ${st.judged} מדדים דורשים טיפול`), `${key}: the count has its denominator`);
    if (wd) { named++; assert.ok(said.includes(`${wd.short} (${wd.k} מתוך ${wd.m})`), `${key}: the weakest category is ${wd.short}`); }
    else assert.ok(!said.includes("התחום עם הכי הרבה"), `${key}: no category is named when the data names none`);
  }
  assert.ok(named >= 4, "the towns that have a weakest category were really compared");
});

test("the two downloads have two names, and the file type is said once in the name a screen reader hears", async () => {
  const d = installDom();
  try {
    const { actionsRow, LABELS } = await load("kit/actions.js");
    assert.notEqual(LABELS.hero.download, LABELS.closing.download);
    assert.equal(LABELS.hero.download, "הורדת כל נתוני היישוב");
    assert.equal(LABELS.closing.download, "הורדת הטבלה של התשובה");
    const hero = actionsRow({ variant: "hero", key: "1031", items: ["download"] }), closing = actionsRow({ variant: "closing", key: "1031", items: ["download"], download: { getRows: () => ({ rows: [], columns: [] }), name: "a" } });
    const own = actionsRow({ variant: "hero", key: "1031", items: ["download"], download: { getRows: () => ({ rows: [], columns: [] }), name: "c", label: "הורדת טבלת ההשוואה" } });
    const page = actionsRow({ variant: "hero", key: "1031", items: ["download"], download: { getRows: () => ({ rows: [], columns: [] }), name: "c" } });
    const names = [hero, closing, own, page].map((r) => r.childNodes[0].getAttribute("aria-label"));
    assert.deepEqual(names, ["הורדת כל נתוני היישוב (קובץ CSV)", "הורדת הטבלה של התשובה (קובץ CSV)", "הורדת טבלת ההשוואה (קובץ CSV)", "הורדת נתוני הדף (קובץ CSV)"]);
    for (const n of names) assert.equal(n.split("CSV").length - 1, 1, n + ": CSV once");
    for (const r of [hero, closing, own, page]) assert.ok(!/CSV/.test(r.childNodes[0].textContent), "the words on the screen do not repeat the file type");
    assert.equal(hero.childNodes[0].getAttribute("href"), "/api/city/1031/export.csv", "the whole-town link is still the server's file");
  } finally { d.restore(); }
});

test("voice: no first-person plural in the files of this pass, and the method link says how the numbers are calculated", () => {
  const owned = ["pages/compare.js", "pages/indicator.js", "pages/actions.js", "kit/actions.js", "kit/provenance.js", "brief/brief.js"].map((f) => path.join(PRODUCT, f));
  const we = /(^|[^א-ת])(אנחנו|אנו|שלנו|לנו|אותנו|חישבנו|בדקנו|מצאנו|הצלחנו|קיבלנו|הצענו|נצרף|נבדוק)([^א-ת]|$)/;
  for (const f of owned) assert.ok(!we.test(read(f).replace(/\/\/.*$/gm, "")), path.basename(f) + " speaks as \"we\"");
  assert.match(read(path.join(PRODUCT, "kit", "provenance.js")), /איך מחושבים המספרים ←/);
  assert.match(read(path.join(PRODUCT, "brief", "brief.js")), /איך מחושבים המספרים ←/);
  for (const f of ["kit/provenance.js", "brief/brief.js", "kit/README.md"]) assert.ok(!read(path.join(PRODUCT, f)).includes("איך חישבנו"), f);
});

test("print: the switch between chart and table is hidden on paper (compare and indicator)", () => {
  for (const n of ["compare", "indicator"]) assert.match(read(path.join(CSS, n + ".css")), /@media print \{[^}]*\.viewtoggle \{ display: none; \}/, n);
});

test("actions page: the chip rows fade on the side where more chips wait, only under 860 px", () => {
  const css = read(path.join(CSS, "actions.css")), js = read(path.join(PRODUCT, "pages", "actions.js"));
  assert.match(css, /@media \(max-width: 860px\) \{\s*html\[data-ui="n"\] \.ac-bar-g\.is-more-end \{[^}]*mask-image/);
  assert.match(css, /\.ac-bar-g\.is-more-start \{[^}]*mask-image/);
  assert.match(js, /is-more-start/); assert.match(js, /is-more-end/);
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css.slice(css.indexOf("the filter chips scroll"))), "no hex colour in the fade");
});
