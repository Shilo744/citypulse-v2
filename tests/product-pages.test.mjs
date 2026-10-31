// The five analysis adapters of mode N (web/js/product/pages/{domain,indicator,trends,compare}.js; the overview adapter was retired with the page, m3): they stay adapters (no private imports of the old pages, no fetch of their own,
// no hash writes), speak the product's words, and build their CSV files from the page's own numbers. The look is covered by `node src/tools/ui_smoke.js --n` and `a11y_check.js --n`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const PAGES = ["domain", "indicator", "trends", "compare"];
const js = (n) => path.join(WEB, "js", "product", "pages", n + ".js"), css = (n) => path.join(WEB, "css", "product", "pages", n + ".css");
const read = (f) => fs.readFileSync(f, "utf8");
const noComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const load = (n) => import(pathToFileURL(js(n)).href);
const kit = await import(pathToFileURL(path.join(WEB, "js", "product", "kit", "csv.js")).href);
const { STATUS } = await import(pathToFileURL(path.join(WEB, "js", "ui.js")).href);

test("each page has an adapter file and a stylesheet of its own prefix", () => {
  for (const n of PAGES) {
    assert.ok(fs.existsSync(js(n)), n + ".js");
    assert.match(read(js(n)), /export (async )?function adapt\(node, ctx\)/, n + " exports adapt(node, ctx)");
    const sheet = noComments(read(css(n)));
    assert.ok(sheet.length > 200, n + ".css is written");
    assert.match(sheet, new RegExp("n-pg-" + n + "-"), n + ".css has its prefix");
  }
});

test("adapters never import page-private modules, never fetch, never write the hash", () => {
  for (const n of PAGES) {
    const src = noComments(read(js(n)));
    for (const m of src.matchAll(/import\s*(?:[^"']*from\s*)?\(?\s*["']([^"']+)["']/g)) {
      assert.ok(!/(^|\/)pages\//.test(m[1]) && !/\.\.\/\.\.\/viz\//.test(m[1]) && !/components\.js|api\.js/.test(m[1]), `${n}.js imports ${m[1]}`);
      assert.ok(/^\.\.\/(\.\.\/ui\.js|kit\/|band\.js|routes\.js|neutral\.js|city\/(copy|data|groups|sentence)\.js)/.test(m[1]), `${n}.js imports ${m[1]}, which is outside the allowed list`);          // neutral.js: the one place that says a figure's name in plain words (the file of the series says what the page says)
    }
    assert.ok(!/\bfetch\s*\(/.test(src), n + " calls fetch");
    assert.ok(!/net\.js|XMLHttpRequest|sendBeacon/.test(src), n + " reaches for the network");
    assert.ok(!/location\.hash\s*=/.test(src), n + " writes location.hash");
  }
});

test("no colour in the page scripts and no word the voice rules forbid", () => {
  const forbidden = ["פרמטר", "מדאיג", "אחוזון", "מובהק", "המודל", "אנחנו", "בסיס קטן", "{{"];
  for (const n of PAGES) {
    const src = read(js(n));
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(src.replace(/#\/c\//g, "")), n + " has a hex colour");
    for (const w of forbidden) assert.ok(!src.includes(w), `${n}.js says "${w}"`);
  }
});

test("the stylesheets keep the rules of the product: tokens only, no side stripe, no keyframes, no text capsule", () => {
  for (const n of PAGES) {
    const sheet = noComments(read(css(n)));
    assert.ok(!/@keyframes/.test(sheet), n + " has keyframes");
    assert.ok(!/border-(inline|left|right)-(start|end)?\s*:\s*[2-9]\d*px/.test(sheet) && !/border-(left|right|inline-start|inline-end)\s*:\s*[3-9]px/.test(sheet), n + " has a side stripe");
    assert.ok(!/border-radius\s*:\s*(99|999|9999)px/.test(sheet), n + " has a capsule");
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(sheet), n + " has a hex colour");
  }
});

test("sticky offsets use the top bar's token", () => {
  for (const n of PAGES) {
    for (const m of noComments(read(css(n))).matchAll(/(?<![-\w])top\s*:\s*([^;}]+)/g)) {
      if (/^\s*(0|auto|var\(--space)/.test(m[1])) continue;
      assert.match(m[1], /var\(--(top-h|space-\d)\)/, `${n}: top: ${m[1]}`);
    }
  }
});

// ── the files the pages offer ──
const columnsOf = (cols) => cols.map((c) => c.title);
const csv = (rows, columns) => kit.rowsToCsv(rows, columns);

test("the domain CSV has one row per measured figure; a small group has no place", async () => {
  const { domainRows } = await load("domain");
  const model = { indicators: [
    { id: "a", domain: "x", label: "מדד א", unit: "%", status: "concern", last: { v: 50.5, year: 2024, nat: 60, rank: 120, of: 140 } },
    { id: "b", domain: "x", label: "מדד ב", unit: "days", status: "good", last: { v: 3, year: 2023, reliable: false, rank: 5, of: 9 } },
    { id: "c", domain: "y", label: "אחר", unit: "%", status: "good", last: { v: 1, year: 2024 } },
    { id: "d", domain: "x", label: "בלי נתון", unit: "%", status: "na" }] };
  const { rows, columns } = domainRows(model, "x");
  assert.equal(rows.length, 2);
  assert.deepEqual(columnsOf(columns), ["מדד", "יחידה", "ערך", "שנה", "מצב", "ארצי", "מקום", "מתוך"]);
  const text = csv(rows, columns).split("\r\n");
  assert.ok(text[0].startsWith("﻿"), "BOM");
  assert.equal(text[1], `מדד א,%,50.5,2024,${STATUS.concern.label},60,120,140`);
  assert.equal(text[2], "מדד ב,days,3,2023,קבוצה קטנה,,,", "a small group is not ranked and not judged");
});

test("the domain CSV names a figure as the page does: no Latin vaccine code in the column of the name (neutral.js), the BOM and the Hebrew stay", async () => {
  const { domainRows } = await load("domain");
  const model = { indicators: [{ id: "th_mmrv", domain: "child", label: "פעוטות שחוסנו נגד חצבת, חזרת ואדמת (MMR/MMRV) עד גיל 13 חודשים", unit: "%", status: "concern", last: { v: 51.9, year: 2024, nat: 65.8, rank: 167, of: 187 } },
    { id: "th_penta", domain: "child", label: "פעוטות שקיבלו 4 מנות חיסון מחומש (DTaP-IPV-Hib) עד גיל 18 חודשים", unit: "%", status: "good", last: { v: 80, year: 2024, nat: 78, rank: 20, of: 180 } }] };
  const { rows, columns } = domainRows(model, "child"), lines = csv(rows, columns).split("\r\n");
  assert.ok(lines[0].startsWith("﻿מדד,"), "BOM and the Hebrew title");
  assert.ok(lines[1].startsWith('"פעוטות שחוסנו נגד חצבת, חזרת ואדמת עד גיל 13 חודשים",%,51.9,2024,'), lines[1]);
  assert.ok(lines[2].startsWith("פעוטות שקיבלו 4 מנות חיסון מחומש עד גיל 18 חודשים,%,80,"), lines[2]);
  assert.ok(!/[A-Za-z]/.test(lines.slice(1).map((l) => l.split("%")[0]).join(" ")), "no Latin letter in a name");
});

test("the indicator CSV is the series with Hebrew headers", async () => {
  const { seriesRows } = await load("indicator");
  const { rows, columns } = seriesRows({ series: [{ year: 2020, v: 5, d: 100, nat: 6 }, { year: 2021, v: 4.5, peer: 5, target: 4 }] });
  assert.equal(rows.length, 2);
  const lines = csv(rows, columns).split("\r\n");
  assert.equal(lines[0].replace("﻿", ""), "שנה,ערך,בסיס החישוב,ארצי,יישובים דומים (ערך אמצעי),יעד");
  assert.equal(lines[1], "2020,5,100,6,,");
  assert.equal(lines[2], "2021,4.5,,,5,4");
  assert.equal(seriesRows({}).rows.length, 0);
});

test("the trends CSV has a row per figure and year and says when a figure cannot be judged", async () => {
  const { seriesRows } = await load("trends");
  const model = { domains: [{ id: "x", label: "תחום" }], indicators: [
    { id: "a", domain: "x", label: "מדד", unit: "%", series: [{ year: 2020, v: 1 }, { year: 2021, v: null }, { year: 2022, v: 3, nat: 2 }], last: { reliable: false } },
    { id: "b", domain: "x", label: "בלי היסטוריה", unit: "%" }] };
  const { rows, columns } = seriesRows(model);
  assert.equal(rows.length, 2, "a missing value is not a row");
  const lines = csv(rows, columns).split("\r\n");
  assert.equal(lines[1], "מדד,תחום,%,2020,1,,,\"לא, קבוצה קטנה\"");
  assert.equal(lines[2], "מדד,תחום,%,2022,3,,2,\"לא, קבוצה קטנה\"");
});

test("the compare CSV is the table the page shows", async () => {
  const { tableRows } = await load("compare");
  const cell = (t) => ({ textContent: t });
  const row = (cells) => ({ children: cells.map(cell) });
  const table = { querySelectorAll: (s) => (s === "thead th" ? ["מדד", "שדרות", "ארצי"].map(cell) : [row(["מדד א", "5.1", "6"]), row(["מדד ב", " 7  ", ""])]) };
  const { rows, columns } = tableRows({ querySelector: () => table });
  assert.deepEqual(columnsOf(columns), ["מדד", "שדרות", "ארצי"]);
  assert.equal(csv(rows, columns).split("\r\n")[2], "מדד ב,7,");
  assert.deepEqual(tableRows({ querySelector: () => null }), { rows: [], columns: [] });
});

test("trends and compare keep a compact title band: the ledger and the facts are moved under it, in a block of their own", () => {
  for (const n of ["trends", "compare"]) {
    const src = noComments(read(js(n))), sheet = noComments(read(css(n)));
    assert.ok(src.includes(`h("div.n-pg-${n}-read"`), n + " builds the block");
    assert.match(src, /hero\.after\(read\)/, n + " puts it after the band");
    assert.match(src, /\.tr-led/, n + " moves the ledger");
    assert.match(sheet, new RegExp(String.raw`\.n-pg-${n}-read \{[^}]*grid-template-columns: minmax\(0, 1fr\)`), n + ": one shrinkable column, so a long button label never widens the page");
  }
  assert.match(noComments(read(css("trends"))), /\.n-pg-trends-read \.hero-actions \.btn \{[^}]*white-space: normal/, "the two links may wrap on a phone");
});

test("final pass: a small group is plain text (no outlined numeral, no dashed rounded box); a count of zero is not coloured; the heat grid shrinks with the window", () => {
  const ind = noComments(read(css("indicator"))), tr = noComments(read(css("trends")));
  assert.match(ind, /\.in-num\.is-hollow[^{]*\{[^}]*-webkit-text-stroke: 0/, "the hollow numeral becomes plain text");
  assert.match(ind, /\.in-small \{[^}]*border-radius: 0/, "the small-group note has no rounded box");
  assert.doesNotMatch(ind.slice(ind.indexOf(".in-small {")), /dashed/, "no dashed outline");
  assert.match(tr, /\.tr-col\.is-zero \.kf-num \{[^}]*color: var\(--ink-3\)/, "zero is quiet");
  assert.match(tr, /\.tr-heat > \.tr-dom \{ min-width: 0/, "a grid item may shrink, so a resize reaches the chart");
});

test("final pass: the uncovered domain page drops the old heading and crumb (the band says it)", () => {
  assert.match(noComments(read(js("domain"))), /\.dm-crumb, \.pagehead/);
});

// ── the words of a status outside the town page: the old pages take ui.js statusReason ("חסרות 28.1 נק׳ ליעד משרד הבריאות", a gap in days with no unit) ──
const { installDom } = await import(pathToFileURL(path.join(WEB, "..", "tests", "helpers", "fake-dom.mjs")).href);
const withDom = async (fn) => { const d = installDom(); try { return await fn(d); } finally { d.restore(); } };
const needs = { id: "th_x", unit: "%", status: "concern", statusWhy: ["rank", "target", "worsening"], last: { level: 10, gapTarget: -28.1 } };
const days = { id: "wait", unit: "days", status: "watch", statusWhy: ["target"], last: { level: 60, gapTarget: -4 } };
const fine = { id: "th_ok", unit: "%", status: "good", statusWhy: [], last: { level: 70 } };

test("trends: the status dot of a figure that needs treatment says why in the words of the town page, with the unit of a gap; a good figure keeps its old words", async () => withDom(async () => {
  const { dotWords } = await load("trends"), { h } = await import(pathToFileURL(path.join(WEB, "js", "ui.js")).href);
  const dot = (id, old) => h("a", { href: `#/c/1031/i/${id}` }, h("span.v-time-sm-dot", { title: old }, h("span.sr", old)));
  const root = h("div", dot("th_x", "דורש טיפול כי חסרות 28.1 נק׳ ליעד משרד הבריאות"), dot("wait", "למעקב כי חסרות 4 ליעד משרד הבריאות"), dot("th_ok", "תקין: הערך טוב יותר מ-70% מהיישובים, ואין הידרדרות."), dot("nobody", "x"));
  dotWords(root, { indicators: [needs, days, fine] });
  const [a, b, c, d] = root.findAll((e) => e.classes.has("v-time-sm-dot")), words = (e) => [e.getAttribute("title"), e.find((x) => x.classes.has("sr")).textContent].map((t) => t.replace(/⁠/g, "").replace(/ /g, " "));          // h() sets a word joiner after a hyphen that is followed by a digit and a no-break space after a percent sign
  assert.deepEqual(words(a), Array(2).fill("דורש טיפול כי רוב היישובים במצב טוב יותר, חסרות 28.1 נקודות אחוז ליעד הרשמי והמגמה בהידרדרות."));
  assert.deepEqual(words(b), Array(2).fill("למעקב כי חסרים 4 ימים ליעד הרשמי."), "a gap in days has its unit");
  assert.deepEqual(words(c), Array(2).fill("תקין: הערך טוב יותר מ-70% מהיישובים, ואין הידרדרות."), "no cause to name: the old words stay");
  assert.deepEqual(words(d), Array(2).fill("x"), "a link to no figure of the model stays as it was");
}));

test("ask: a figure card of an answer says why in the words of the town page, once, and leaves a good card alone", async () => withDom(async () => {
  const { cardWhy } = await load("ask"), { h } = await import(pathToFileURL(path.join(WEB, "js", "ui.js")).href);
  const card = (id, old) => h("a.dm-tile", { href: `#/c/1031/i/${id}` }, h("p.dm-tile-why", h("span.pill", "דורש טיפול"), " ", old));
  const model = { indicators: [needs, days, fine] }, a = card("th_x", "כי חסרות 28.1 נק׳ ליעד משרד הבריאות"), b = card("th_ok", "תקין: ואין הידרדרות."), c = card("wait", "כי חסרות 4 ליעד משרד הבריאות");
  for (const x of [a, b, c, a]) cardWhy(x, model);
  const say = (x) => x.find((e) => e.classes.has("dm-tile-why")).textContent;
  assert.equal(say(a), "דורש טיפול כי רוב היישובים במצב טוב יותר, חסרות 28.1 נקודות אחוז ליעד הרשמי והמגמה בהידרדרות.");
  assert.equal(say(c), "דורש טיפול כי חסרים 4 ימים ליעד הרשמי.", "a gap in days has its unit");
  assert.equal(say(b), "דורש טיפול תקין: ואין הידרדרות.", "a figure with no cause to name keeps the old words");
  assert.equal(a.find((e) => e.classes.has("pill")) !== null, true, "the status word stays in its place");
}));
