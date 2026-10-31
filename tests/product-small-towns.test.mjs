// A very small town on the pages of one figure (the w4b pass): one pure rule in city/data.js (isVerySmallTown, isCalmFigure), the indicator page and the domain page of such a town show the number and one plain line
// and nothing that sets it against the nation, similar towns or a place among all towns; towns that can be judged (472, 1031) keep every comparison. The download labels of the briefing and the coverage page.
// The live check over every route of a town is `node src/tools/small_town_probe.js`; this file covers the same rules on the models of the store, without a browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { haveStore, model } from "./helpers/city-models.mjs";
import { installDom } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCT = path.join(ROOT, "web", "js", "product");
const load = (f) => import(pathToFileURL(path.join(PRODUCT, f)).href);
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const skip = !haveStore && "the built store is not there";
const clean = (s) => String(s || "").replace(/[⁦-⁩‎‏⁠]/g, "").replace(/\s+/g, " ").trim();
const D = await load("city/data.js");
const ui = await load("../ui.js");

// a model made by hand: n figures of each kind
const fake = (spec) => {
  const indicators = [];
  for (const [status, count, reliable] of spec.kinds) for (let i = 0; i < count; i++) indicators.push({ id: `${status}${i}`, status, last: { v: 1, year: 2024, reliable } });
  return { city: { key: "x", name: "יישוב" }, indicators, coverage: { have: spec.have ?? indicators.length, total: 41 } };
};

test("isVerySmallTown: some figures on small groups and fewer than half of the figures with data can be judged", () => {
  assert.equal(D.isVerySmallTown(fake({ kinds: [["na", 3, true], ["uncertain", 15, false]] })), true, "16: nothing can be judged");
  assert.equal(D.isVerySmallTown(fake({ kinds: [["na", 3, true], ["uncertain", 15, false], ["good", 2, true]] })), true, "two of 20 judged");
  assert.equal(D.isVerySmallTown(fake({ kinds: [["good", 10, true], ["uncertain", 10, false]] })), false, "exactly half judged is not very small");
  assert.equal(D.isVerySmallTown(fake({ kinds: [["concern", 18, true], ["na", 10, true], ["uncertain", 3, false]], have: 31 })), false, "472: 18 of 31 judged");
  assert.equal(D.isVerySmallTown(fake({ kinds: [["good", 20, true]] })), false, "no small group at all");
  assert.equal(D.isVerySmallTown(fake({ kinds: [], have: 0 })), false, "935: no data, nothing to call small");
});

test("isCalmFigure: only a background figure on a group that is not itself small, in a very small town", () => {
  const m = fake({ kinds: [["na", 3, true], ["uncertain", 15, false]] }), bg = m.indicators[0], small = m.indicators[5];
  assert.equal(D.isCalmFigure(m, bg), true);
  assert.equal(D.isCalmFigure(m, small), false, "a small group has the page of its own (the old module)");
  assert.equal(D.isCalmFigure(m, null), false);
  assert.equal(D.isCalmFigure(m, { ...bg, last: null }), false);
  const big = fake({ kinds: [["na", 3, true], ["good", 20, true]] });
  assert.equal(D.isCalmFigure(big, big.indicators[0]), false, "a town that can be judged keeps the comparison");
  assert.equal(D.isCalmFigure(m, { ...bg, status: "good" }), false, "a figure with a verdict is never calm");
  assert.match(D.NO_COMPARISON, /הקבוצה קטנה, ולכן אין השוואה לממוצע הארצי/);
});

test("the store: 16 and 7 are very small, 472, 1031, 9000 are not, 935 has nothing to call small", { skip }, () => {
  for (const key of ["16", "7"]) assert.equal(D.isVerySmallTown(model(key)), true, key);
  for (const key of ["472", "1031", "9000", "935"]) assert.equal(D.isVerySmallTown(model(key)), false, key);
});

// the old indicator page, as far as the adapter touches it
function indicatorPage(a) {
  const { h } = ui, chip = (t) => h("li.in-chip", h("span.in-chip-t", t));
  const hero = h("section.hero.in-hero", h("div.hero-grid",
    h("div.in-head", h("div.in-crumb", "הקשר"), h("p.in-reason", "מדד רקע")),
    h("div.hero-visual.in-visual", h("div.in-loc"), h("div.in-meter", h("p.in-meter-cap", "מקום 300 מתוך 921"))),
    h("div.in-tail", h("ul.in-chips", chip("גבוה מהממוצע הארצי ב-3.6 נק׳ ארצי 7.1%"), chip("גבוה מיישובים דומים ב-1 נק׳ ערך אמצעי 9.7%"), chip("מגמה: עולה +6.3 נק׳ מאז 2022")),
      h("p.in-unitnote", "נק׳ = נקודות אחוז"), h("div.hero-actions"))));
  const sec = (id, ...kids) => h("section.sec", { id }, h("div.sec-head", h("div", h("div.sec-eyebrow", h("b", "00"), id))), ...kids);
  return h("div.in-page", hero, h("nav.toc", h("span.hint", "קפצו אל:"), ["היסטוריה", "המקום בין היישובים", "יישובים דומים", "על המדד ומקורו"].map((t) => h("button.chip", t))),
    sec("history", h("p.sec-lead", "לעומת הממוצע הארצי ויישובים דומים."), h("div.viewtoggle"), h("div.in-plot", h("div.in-chart", "chart with the national line"), h("div.legend", "ארצי")), h("p.in-read", h("span", "בממוצע הארצי: ירידה"))),
    sec("where", h("h2", "המקום בין כל היישובים")), sec("peers", h("h2", "מול יישובים דומים")), sec("about", h("h2", "מה זה מודד")));
}
const ctxOf = (m, id) => ({ model: m, setCrumbs() {}, parts: ["c", m.city.key, "i", id], params: new URLSearchParams() });

test("indicator page of a very small town: the number, one plain line, its own values; no nation, no similar towns, no place", { skip }, async () => {
  const d = installDom();
  try {
    const { adapt } = await load("pages/indicator.js");
    for (const key of ["16", "7"]) {
      const m = model(key);
      for (const id of ["pop_growth", "pop_size", "ses_index"]) {
        const a = m.indicators.find((x) => x.id === id);
        if (!a || !D.isCalmFigure(m, a)) continue;
        const node = indicatorPage(a);
        await adapt(node, ctxOf(m, id));
        const all = clean(node.textContent);
        assert.ok(all.includes(D.NO_COMPARISON), `${key}/${id}: the plain line`);
        assert.ok(!/יישובים דומים|מהממוצע הארצי|מקום \d|מתוך 921|ערך אמצעי/.test(all.replace(D.NO_COMPARISON, "")), `${key}/${id}: nothing set against the nation, similar towns or a place: ${all.slice(0, 300)}`);
        for (const sel of [".in-meter", "#where", "#peers", ".v-time-spark-nat"]) assert.equal(node.querySelectorAll(sel).length, 0, `${key}/${id}: ${sel} is gone`);
        assert.equal(node.querySelectorAll(".in-chip").length, 1, `${key}/${id}: only the trend of the figure itself stays`);
        assert.deepEqual(node.querySelectorAll("section.sec .sec-eyebrow b").map((b) => b.textContent), ["01", "02"], "the sections are numbered again");
        assert.deepEqual(node.querySelectorAll(".toc .chip").map((b) => clean(b.textContent)), ["היסטוריה", "על המדד ומקורו"], "the contents list follows");
        const rows = node.querySelectorAll(".n-pg-indicator-own tbody tr");
        assert.equal(rows.length, a.series.filter((s) => Number.isFinite(s.v)).length, `${key}/${id}: one row of its own values per year`);
        const { seriesRows } = await load("pages/indicator.js");
        assert.deepEqual(seriesRows(a, true).columns.map((c) => c.title), ["שנה", "ערך", "בסיס החישוב"], "the file has no national or similar-town column either");
      }
    }
  } finally { d.restore(); }
});

test("indicator page of a town that can be judged is left alone (472, 1031)", { skip }, async () => {
  const d = installDom();
  try {
    const { adapt } = await load("pages/indicator.js");
    for (const key of ["472", "1031"]) {
      const m = model(key), a = m.indicators.find((x) => x.id === "pop_growth");
      assert.ok(a && !D.isCalmFigure(m, a), key);
      const node = indicatorPage(a);
      await adapt(node, ctxOf(m, "pop_growth"));
      assert.equal(node.querySelectorAll(".in-chip").length, 3, `${key}: the chips stay`);
      assert.equal(node.querySelectorAll("#where, #peers, .in-meter").length, 3, `${key}: the place and the similar towns stay`);
      assert.ok(!clean(node.textContent).includes(D.NO_COMPARISON), key);
    }
  } finally { d.restore(); }
});

test("domain page: the context rows of a very small town carry the plain line, never a distance from the nation; the file has no place", { skip }, async () => {
  const d = installDom();
  try {
    const { adapt, domainRows } = await load("pages/domain.js");
    const { h } = ui;
    for (const [key, calm] of [["16", true], ["7", true], ["472", false], ["1031", false]]) {
      const m = model(key), a = m.indicators.find((x) => x.id === "pop_growth");
      if (!a) continue;
      const row = h("a.row-item.dm-row", { href: `#/c/${key}/i/pop_growth` }, h("div.dm-viz", h("div.dm-spark", h("path.v-time-spark-nat")), h("span.dm-cmp", "גבוה מהממוצע הארצי ב-3.6 נק׳")));
      const node = h("div", h("section.dm-hero", h("div.dm-main", h("h1", "הקשר")), h("div.hero-meta")), h("div", row));
      adapt(node, { model: m, parts: ["c", key, "d", a.domain] });
      const said = clean(row.textContent);
      if (calm) {
        assert.ok(said.includes(D.NO_COMPARISON) && !/מהממוצע הארצי ב/.test(said), `${key}: ${said}`);
        assert.equal(row.querySelectorAll(".v-time-spark-nat").length, 0, `${key}: the national line of the small chart is gone`);
      } else assert.ok(/מהממוצע הארצי ב/.test(said) && row.querySelectorAll(".v-time-spark-nat").length === 1, `${key}: the comparison stays`);
      const { rows, columns } = domainRows(m, a.domain), mine = rows.find((x) => x.id === "pop_growth");
      const cell = (title) => columns.find((c) => c.title === title).get(mine);
      if (calm) assert.deepEqual([cell("ארצי"), cell("מקום"), cell("מתוך")], ["", "", ""], `${key}: no national value and no place in the file`);
    }
  } finally { d.restore(); }
});

test("compare page of a very small town does not name similar towns as the default", { skip }, async () => {
  const d = installDom();
  try {
    const { adapt } = await load("pages/compare.js");
    const { h } = ui, note = () => h("p.tr-keynote", "ברירת המחדל היא יישובים דומים בגודל. היישוב שלכם מסומן בעיגול כחול,");
    for (const [key, gone] of [["16", true], ["472", false]]) {
      const n = note(), top = h("div.tr-hero-top", h("div.hero-actions")), node = h("div", h("section.tr-hero", h("h1", "x"), top), h("div.tr-keybox", n));
      adapt(node, { model: model(key), parts: [], params: new URLSearchParams() });
      assert.equal(/יישובים דומים/.test(n.textContent), !gone, key);
      assert.ok(/היישוב שלכם מסומן/.test(n.textContent), key + ": the rest of the note stays");
    }
  } finally { d.restore(); }
});

test("labels: the briefing's file is the whole town, the coverage page's file is its list; the type is said once to the screen reader", () => {
  const brief = read("web/js/product/brief/brief.js"), cov = read("web/js/product/pages/coverage.js");
  assert.ok(brief.includes('csvLink(exportHref(key), "הורדת כל נתוני היישוב")') && brief.includes("הורדת כל נתוני היישוב (קובץ CSV)"));
  assert.ok(!brief.includes("הורדת נתונים (CSV)"));
  assert.ok(cov.includes('label: "הורדת רשימת הכיסוי"') && cov.includes("הורדת רשימת הכיסוי (קובץ CSV)"));
  assert.ok(!cov.includes("הורדת נתונים (CSV)"));
});

test("the adapters of the small-town rule keep the product's rules: tokens only, no we, the rule lives in one place", () => {
  for (const f of ["pages/indicator.js", "pages/domain.js", "pages/compare.js"]) {
    const src = read("web/js/product/" + f);
    assert.ok(!/st\.small > 0 && st\.judged \* 2 < st\.have/.test(src), f + " repeats the rule of the very small town instead of importing it");
    assert.ok(!/(^|[^א-ת])(אנחנו|אנו|שלנו|בדקנו|מצאנו|חישבנו)([^א-ת]|$)/.test(src.replace(/\/\/.*$/gm, "").replace(/\/\^בדקנו \//, "")), f + ": the voice is neutral");
  }
  assert.ok(/export function isVerySmallTown/.test(read("web/js/product/city/data.js")));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(read("web/css/product/pages/indicator.css").split("/* a background figure of a very small town")[1] || ""), "no hex colour in the new rules");
});

// ── the qa2 pass: no invitation to compare a town that cannot be compared ──
test("hasNoPeers: very small towns and towns the home dims the question for; towns that can be compared keep everything", { skip }, () => {
  for (const key of ["16", "7", "935"]) assert.equal(D.hasNoPeers(model(key)), true, key);
  for (const key of ["1031", "9000", "99", "2710"]) { const m = model(key); if (m) assert.equal(D.hasNoPeers(m), false, key); }
  assert.equal(D.hasNoPeers(model("472")), D.availability(model("472")).peers != null, "472 follows the home: the question is dimmed there or it is not");
});

test("ask page: the starting question about similar towns is dropped where the home has no answer to it", { skip }, async () => {
  const { samples } = await load("pages/ask.js");
  for (const key of ["16", "7", "935"]) {
    const list = samples(model(key).city.name, model(key));
    assert.equal(list.length, 5, key);
    assert.ok(!list.some((q) => /יישובים דומים/.test(q)), key);
  }
  const full = samples(model("1031").city.name, model("1031"));
  assert.equal(full.length, 6);
  assert.ok(full.some((q) => /לעומת יישובים דומים/.test(q)));
  assert.equal(samples("x").length, 6, "without a model the list is the whole list");
});

test("briefing: the closing \"how to read\" block drops the definition of similar towns for a town without that comparison, and keeps the rest", { skip }, async () => {
  const { briefDoc } = await load("brief/doc.js"), { QIDS } = await load("city/copy.js");
  for (const key of ["16", "7"]) {
    const howto = briefDoc(model(key)).sections.find((s) => s.id === "howto");
    assert.deepEqual(howto.lines.map((l) => l.q), QIDS.filter((q) => q !== "peers"), key);
    assert.ok(!howto.lines.some((l) => /יישובים דומים|מקומות קרובים בדירוג/.test(l.question + " " + l.text.replace(/^[^]*dorsh/, "")) && l.q === "peers"), key);
  }
  assert.equal(briefDoc(model("1031")).sections.find((s) => s.id === "howto").lines.length, QIDS.length, "1031 keeps all five");
});

test("the definition of \"דורש טיפול\" has no rank for a town without a ranking (home and briefing); 1031 and 472 keep the full one", { skip }, async () => {
  const { briefDoc } = await load("brief/doc.js"), P = await load("city/parts.js"), { HOWTO, HOWTO_NO_RANK } = await load("city/copy.js");
  const d = installDom();
  try {
    const bare = (t) => clean(t).replace(/״/g, ""), weakLine = (key) => briefDoc(model(key)).sections.find((x) => x.id === "howto").lines.find((l) => l.q === "weak").text;
    for (const key of ["16", "7", "935"]) {
      assert.ok(D.hasNoPeers(model(key)), key);
      assert.equal(weakLine(key), HOWTO_NO_RANK.weak, key + " briefing");
      assert.equal(bare(P.howto("weak", model(key)).textContent), bare(HOWTO_NO_RANK.weak), key + " home");
      assert.ok(!/ברבע התחתון|בדירוג|יישובי הארץ/.test(weakLine(key)), key + " says nothing of a rank or of the other towns");
    }
    for (const key of ["1031", "472"]) {
      assert.ok(!D.hasNoPeers(model(key)), key);
      assert.equal(weakLine(key), HOWTO.weak, key + " briefing");
      assert.equal(bare(P.howto("weak", model(key)).textContent), bare(HOWTO.weak), key + " home");
    }
    assert.equal(clean(P.howto("changed", model("16")).textContent), clean(HOWTO.changed), "the other four lines are the same for every town");
  } finally { d.restore && d.restore(); }
});

test("actions page: the empty plan of a town without comparison sends to the coverage, not to the comparison", { skip }, async () => {
  const d = installDom();
  try {
    const { adapt } = await load("pages/actions.js"), { h } = ui;
    const make = (key) => h("div", h("section.ac-head", h("div.ac-head-top", h("div", h("div.ac-eyebrow", "x"), h("h1.ac-h1", "x"), h("a.btn.primary.ac-primary", { href: `#/c/${key}/compare` }, "להשוות ליישובים דומים", ui.icon("left"))))));
    for (const [key, sent] of [["16", true], ["7", true], ["1031", false]]) {
      const node = make(key), view = adapt(node, { model: model(key), signal: new AbortController().signal });
      const btn = (view.node || view).querySelector ? (view.band || node).querySelector(".ac-primary") : null;
      assert.ok(btn, key);
      assert.equal(btn.textContent.includes("לכיסוי הנתונים"), sent, key);
      assert.equal(btn.getAttribute("href"), sent ? `#/c/${key}/coverage` : `#/c/${key}/compare`, key);
      assert.equal(/להשוות ליישובים דומים/.test(btn.textContent), !sent, key);
    }
  } finally { d.restore(); }
});
