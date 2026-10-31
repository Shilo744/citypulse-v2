// The pure parts of the QA tools (src/tools/product_matrix.js and contact_sheet.js): detection of junk and forbidden words, the route list, the verdicts, the sheet layout.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const M = require("../src/tools/product_matrix.js"), S = require("../src/tools/contact_sheet.js");

test("junk text is found with its surroundings", () => {
  assert.deepEqual(M.junkIn("יישוב רגיל 12.5%").map((x) => x.word), []);
  assert.deepEqual(M.junkIn("ערך undefined כאן").map((x) => x.word), ["undefined"]);
  assert.deepEqual(M.junkIn("{{name}} NaN null [object Object] Infinity").map((x) => x.word).sort(), ["Infinity", "NaN", "[object", "null", "{{"].sort());
  assert.deepEqual(M.junkIn("nullable and Nancy"), [], "only whole words count");
});

test("forbidden Hebrew words: a short word only as a whole word", () => {
  assert.deepEqual(M.forbiddenIn("כלנו יחד, ולכן הכול טוב"), [], "לנו inside כלנו is not the word");
  assert.deepEqual(M.forbiddenIn("זה נתון לנו").map((x) => x.word), ["לנו"]);
  assert.deepEqual(M.forbiddenIn("אנחנו רואים פרמטר מדאיג").map((x) => x.word), ["אנחנו", "פרמטר", "מדאיג"]);
  assert.deepEqual(M.forbiddenIn("הפרמטרים של המודל").map((x) => x.word), ["פרמטר", "המודל"]);
  assert.deepEqual(M.forbiddenIn("בסיס קטן ואחוזון מובהק").map((x) => x.word).sort(), ["אחוזון", "בסיס קטן", "מובהק"].sort());
});

test("'still' is wrong only in a sentence that says there is no data", () => {
  assert.equal(M.noDataStill("אין נתונים על היישוב עדיין"), true);
  assert.equal(M.noDataStill("מדד אחד עדיין נמדד בכל שנה"), false);
  assert.equal(M.noDataStill("אין נתונים על היישוב"), false);
});

test("route list: five answers first, optional pages only when they exist", () => {
  const r = M.buildRoutes("1031", { brief: true, domain: "access", indicator: "th_mmrv" });
  assert.deepEqual(r.slice(0, 5).map((x) => x.hash), ["weak", "changed", "peers", "first", "missing"].map((q) => `#/c/1031?q=${q}`));
  assert.ok(r.slice(0, 5).every((x) => x.home));
  assert.deepEqual(r.slice(5).map((x) => x.id), ["brief", "simple", "domain", "indicator", "trends", "compare", "actions", "ask", "coverage", "method"]);
  assert.ok(r.find((x) => x.id === "domain").hash.endsWith("/d/access") && r.find((x) => x.id === "indicator").hash.endsWith("/i/th_mmrv"));
  const bare = M.buildRoutes("16", { brief: false });
  assert.deepEqual(bare.slice(5).map((x) => x.id), ["simple", "trends", "compare", "actions", "ask", "coverage", "method"]);
});

const ok = { text: "תוכן תקין", requests: [], h1: ["כותרת"], tabs: 0, sections: ["n-sec-state", "n-sec-good", "n-sec-weak", "n-sec-changed", "n-sec-peers", "n-sec-first", "n-sec-missing"], title: "מה חלש | CityPulse", sentence: "משפט", sentenceY: 300, states: [], images: [] };
const ctx = (over = {}) => ({ route: { id: "home-weak", home: "weak" }, width: 1280, key: "1031", overflow: { scrollWidth: 1280, clientWidth: 1280, leaves: [] }, problems: [], ms: 900, ...over });
const checks = (m, c) => M.judge(m, c).map((x) => x.check + ":" + x.severity);

test("judge: a clean home has no findings", () => assert.deepEqual(checks(ok, ctx()), []));

test("judge: each failure is reported under its check", () => {
  assert.deepEqual(checks({ ...ok, h1: [] }, ctx()), ["h1:error"]);
  assert.deepEqual(checks({ ...ok, tabs: 5 }, ctx()), ["tab:error"]);
  assert.deepEqual(checks({ ...ok, title: "" }, ctx()), ["title:error"]);
  assert.deepEqual(checks(ok, ctx({ route: { id: "home-changed", home: "changed" } })), []);
  assert.deepEqual(checks({ ...ok, sections: ["n-sec-state"] }, ctx({ route: { id: "home-changed", home: "changed" } })), ["section:warn"]);
  assert.deepEqual(checks({ ...ok, sections: ["n-sec-state"] }, ctx({ route: { id: "home-peers", home: "peers" } })), ["section:info"], "a very small town has no peers section");
  assert.deepEqual(checks({ ...ok, sections: ["n-sec-state"] }, ctx({ key: "935", route: { id: "home-changed", home: "changed" } })), ["section:info"]);
  assert.deepEqual(checks(ok, ctx({ overflow: { scrollWidth: 500, clientWidth: 390, leaves: ["div.x"] } })), ["overflow:error"]);
  assert.deepEqual(checks({ ...ok, text: "ערך NaN" }, ctx()), ["junk:error"]);
  assert.deepEqual(checks({ ...ok, requests: ["404 http://localhost:8800/x.png"] }, ctx()), ["request:error"]);
  assert.deepEqual(checks(ok, ctx({ problems: ["exception: boom"] })), ["console:error"]);
  assert.deepEqual(checks({ ...ok, images: ["a.png"] }, ctx()), ["image:error"]);
  assert.deepEqual(checks(ok, ctx({ ms: 9000 })), ["slow:warn"]);
});

test("judge: the answer line has a limit per width, a 404 for a missing indicator is by design", () => {
  assert.deepEqual(checks({ ...ok, sentenceY: 600 }, ctx()), ["answer-y:warn"]);
  assert.deepEqual(checks({ ...ok, sentenceY: 600 }, ctx({ width: 390 })), []);
  assert.deepEqual(checks({ ...ok, sentenceY: 700 }, ctx({ width: 390 })), ["answer-y:warn"]);
  assert.deepEqual(checks({ ...ok, requests: ["404 http://localhost:8800/api/city/16/indicator/x"] }, ctx()), []);
});

test("judge: a not-found card is expected only where there is no coverage; an error card never", () => {
  const nf = { cls: "n-state n-state-nf", state: "notmeasured", text: "אין נתונים" }, er = { cls: "n-state n-state-err", state: "error-x", text: "לא הצלחנו" };
  assert.deepEqual(checks({ ...ok, states: [nf] }, ctx()), ["state:warn"]);
  assert.deepEqual(checks({ ...ok, states: [nf] }, ctx({ key: "935" })), ["state:info"]);
  assert.deepEqual(checks({ ...ok, states: [er] }, ctx({ key: "935" })), ["state:error"]);
});

test("summary and markdown count per check and name the reproduction URL", () => {
  const loads = [{ key: "1", width: 390, theme: "dark", route: "x", url: "http://h/n.html#/c/1", ms: 5, findings: [{ check: "h1", severity: "error", detail: "0 visible h1" }] }, { key: "1", width: 390, theme: "light", route: "y", url: "u2", ms: 7, findings: [] }];
  const s = M.summarize(loads);
  assert.equal(s.loads, 2); assert.equal(s.failing, 1); assert.equal(s.byCheck.h1.error, 1);
  const md = M.markdown({ date: "d", base: "http://h", seconds: 3, localities: ["1"], widths: [390], themes: ["light", "dark"], skipped: [] }, loads);
  assert.match(md, /390px dark http:\/\/h\/n\.html#\/c\/1 : 0 visible h1/);
});

test("arguments: --subset, explicit lists and the full default", () => {
  assert.deepEqual(M.parseArgs(["--subset"]).localities, ["1031", "16", "7", "935", "472", "99"]);
  assert.deepEqual(M.parseArgs(["--subset"]).widths, [390, 1280]);
  const o = M.parseArgs(["--localities=1,2", "--widths=320", "--themes=dark", "--out=x/y"]);
  assert.deepEqual([o.localities, o.widths, o.themes, o.out], [["1", "2"], [320], ["dark"], "x/y"]);
  const full = M.parseArgs([]);
  assert.equal(full.localities.length, 15); assert.deepEqual(full.widths, [320, 390, 768, 1024, 1280, 1920]);
});

test("contact sheet: never wider than 2400 px, captions default to the file name", () => {
  for (const cols of [1, 2, 3, 4, 6]) assert.ok(S.layout(cols, 12).width <= 2400, "cols " + cols);
  assert.equal(S.layout(3, 7).rows, 3);
  assert.deepEqual(S.entry("a/b/shot.png"), { file: "a/b/shot.png", caption: "shot.png" });
  assert.deepEqual(S.entry("a.png::Sderot 390"), { file: "a.png", caption: "Sderot 390" });
  const a = S.parseArgs(["--cols=2", "--out=o.png", "--label=L", "x.png", "y.png::cap"]);
  assert.deepEqual([a.cols, a.out, a.label, a.files], [2, "o.png", "L", ["x.png", "y.png::cap"]]);
  const h = S.html([{ src: "data:,", caption: "<b>" }], { cols: 1, label: "t" });
  assert.ok(h.includes("&lt;b&gt;") && !h.includes("<b>"));
});
