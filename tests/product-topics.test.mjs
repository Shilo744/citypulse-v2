// The topics of the category page (web/js/product/city/groups.js TOPICS and pages/domain.js groupFigures): every figure of the catalogue is in exactly one topic and a topic never mixes
// categories; the one sentence of a topic says the true counts; the order is the order of attention; the groups are native details elements around the old page's own row nodes,
// they are made again when the old page draws its list again, one is open on the first load, "open all" announces once, and print opens them all.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { model, KEYS, haveStore } from "./helpers/city-models.mjs";
import { installDom } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => import(pathToFileURL(path.join(ROOT, "web", "js", "product", f)).href);
const G = await load("city/groups.js");
const require = createRequire(import.meta.url);
const { indicators: CATALOGUE } = require("../src/catalog/indicators");
const skip = !haveStore && "no store on this machine";
const CATEGORIES = ["child", "outcomes", "mental", "safety", "context"];
const COUNTS = { child: 13, outcomes: 8, mental: 8, safety: 4, context: 8 };
const say = (c) => G.sayText(G.topicSay(c));
const counts = (o) => G.topicCounts(Object.entries(o).flatMap(([status, n]) => Array.from({ length: n }, () => (status === "small" ? { status: "uncertain", last: { reliable: false } } : { status, last: {} }))));

test("TOPICS: every figure of the catalogue is in exactly one topic, and no topic holds a figure that the catalogue does not have", () => {
  const ids = CATALOGUE.map((i) => i.id), held = G.TOPICS.flatMap((t) => t.ids);
  assert.equal(ids.length, 41);
  assert.equal(held.length, new Set(held).size, "no figure in two topics");
  assert.deepEqual([...held].sort(), [...ids].sort(), "the topics hold the whole catalogue and nothing else");
  for (const id of ids) assert.ok(G.TOPIC_OF[id], id + " has a topic");
  assert.deepEqual(Object.keys(G.TOPIC_OF).sort(), [...ids].sort());
});

test("TOPICS: a topic never mixes categories, belongs to a known category, and has a plain name; the counts per category are 13 / 8 / 8 / 4 / 8", () => {
  const catOf = (id) => { const i = CATALOGUE.find((x) => x.id === id); return G.groupIdOf(i.domain, i.id); };
  assert.equal(new Set(G.TOPICS.map((t) => t.id)).size, G.TOPICS.length, "topic ids are unique");
  assert.equal(new Set(G.TOPICS.map((t) => t.label)).size, G.TOPICS.length, "topic names are unique");
  for (const t of G.TOPICS) {
    assert.ok(CATEGORIES.includes(t.category), t.id);
    assert.ok(t.ids.length >= 2 && t.label.length >= 3 && !/[A-Za-z_]/.test(t.label), t.id + ": a name that a city official reads");
    assert.deepEqual([...new Set(t.ids.map(catOf))], [t.category], `${t.id}: every figure is of the category ${t.category}`);
  }
  assert.deepEqual(Object.fromEntries(CATEGORIES.map((c) => [c, G.topicsOfCategory(c).flatMap((t) => t.ids).length])), COUNTS);
  assert.deepEqual(G.topicsOfCategory("child").map((t) => t.label), ["חיסונים", "מעקב והדרכה בטיפת חלב", "הנקה ותזונת תינוקות", "משקל עודף בבית הספר"]);
  assert.deepEqual(G.topicsOfCategory("context").map((t) => t.label), ["אוכלוסייה", "עוני", "סביבה"]);
  assert.deepEqual(G.TOPICS.find((t) => t.id === "clinic").ids, ["th_firstvisit", "th_headcirc", "th_devtests6", "th_language", "th_safesleep"], "the first visit of a newborn moved into the children's clinic topic");
});

test("TOPICS against the regrouped models: the category of every figure is the category of its topic", { skip }, () => {
  for (const key of KEYS) {
    const m = model(key);
    for (const a of m.indicators) assert.equal(G.TOPICS.find((t) => t.ids.includes(a.id)).category, a.domain, `${key}/${a.id}`);
  }
});

test("topicSay: the sentence says the true counts, in the product's words, and never judges a small group", () => {
  assert.equal(say(counts({ concern: 2, good: 1 })), "2 מתוך 3 דורשים טיפול");
  assert.equal(say(counts({ concern: 3 })), "כל 3 דורשים טיפול");
  assert.equal(say(counts({ concern: 1, good: 2 })), "אחד מתוך 3 דורש טיפול");
  assert.equal(say(counts({ concern: 1 })), "המדד היחיד שנבדק דורש טיפול");
  assert.equal(say(counts({ good: 2 })), "אין מדד שדורש טיפול");
  assert.equal(say(counts({ good: 1, strength: 1, watch: 1 })), "אין מדד שדורש טיפול, אחד למעקב");
  assert.equal(say(counts({ concern: 2, watch: 3, good: 1, small: 1 })), "2 מתוך 6 דורשים טיפול, 3 למעקב, אחד ללא שיפוט");
  assert.equal(say(counts({ concern: 1, good: 1, na: 2, stale: 1 })), "אחד מתוך 2 דורש טיפול, 3 ללא שיפוט");
  assert.equal(say(counts({ small: 3 })), "קבוצות קטנות: המספרים מוצגים כמות שהם");
  assert.equal(say(counts({ small: 1 })), "קבוצה קטנה: המספרים מוצגים כמות שהם");
  assert.equal(say(counts({ na: 3 })), "מתארים את היישוב, בלי שיפוט");
  assert.equal(say(counts({ stale: 2 })), "הנתונים ישנים, ולכן בלי שיפוט");
  assert.equal(say(counts({ small: 1, na: 1 })), "אין מדד שאפשר לשפוט: המספרים מוצגים כמות שהם");
  assert.deepEqual(G.topicSay(G.topicCounts([])), []);
  const c = counts({ concern: 2, watch: 1, good: 1, strength: 1, small: 2, stale: 1, na: 1 });
  assert.deepEqual({ ...c }, { concern: 2, watch: 1, fine: 2, small: 2, stale: 1, bg: 1, judged: 5, unjudged: 4, total: 9 });
  const small = G.topicCounts([{ status: "concern", last: { reliable: false } }]);
  assert.deepEqual([small.concern, small.small], [0, 1], "a figure on a small group is not a verdict, whatever its status says");
  assert.ok(G.topicSay(c).filter((s) => typeof s !== "string").every((s) => /^\d+$/.test(s.n)), "numbers come as segments the screen can set apart");
});

test("topicsFor: topics with no figure are left out, the order is the order of attention, every shown figure is in exactly one topic", { skip }, () => {
  for (const key of KEYS) {
    const m = model(key);
    for (const cat of CATEGORIES) {
      const shown = m.indicators.filter((a) => a.domain === cat && a.last), { topics, rest } = G.topicsFor(m, cat);
      assert.deepEqual(rest, [], `${key}/${cat}: nothing is outside the topics`);
      assert.ok(topics.every((t) => t.figures.length > 0), `${key}/${cat}: a topic with no figure is not shown`);
      assert.deepEqual(topics.flatMap((t) => t.ids).sort(), shown.map((a) => a.id).sort(), `${key}/${cat}: the topics hold exactly the figures the page draws`);
      assert.equal(new Set(topics.flatMap((t) => t.ids)).size, shown.length, `${key}/${cat}: none twice`);
      const share = (t) => (t.counts.judged ? t.counts.concern / t.counts.judged : -1);
      for (let i = 1; i < topics.length; i++) assert.ok(share(topics[i - 1]) >= share(topics[i]), `${key}/${cat}: the larger share of figures that need treatment comes first`);
      // the sums are the ring's own: the same statuses the old page counts for its ring (a small group is "without a verdict")
      const eff = (a) => (a.last.reliable === false ? "uncertain" : a.status), n = (k) => shown.filter((a) => eff(a) === k).length;
      const sum = (f) => topics.reduce((s, t) => s + f(t.counts), 0);
      assert.equal(sum((c) => c.concern), n("concern"), `${key}/${cat} concern`);
      assert.equal(sum((c) => c.watch), n("watch"), `${key}/${cat} watch`);
      assert.equal(sum((c) => c.fine), n("good") + n("strength"), `${key}/${cat} fine`);
      assert.equal(sum((c) => c.total), shown.length, `${key}/${cat} total`);
      assert.equal(sum((c) => c.unjudged), shown.length - n("concern") - n("watch") - n("good") - n("strength"), `${key}/${cat} not judged`);
    }
  }
  const t1031 = G.topicsFor(model("1031"), "child").topics;
  assert.deepEqual(t1031.map((t) => t.id), ["vaccines", "clinic", "school-weight", "feeding"], "1031: vaccines (3 of 3), the clinic (4 of 5), school weight (1 of 2), feeding (1 of 3)");
  assert.equal(G.topicsFor(model("935"), "child").topics.length, 0, "a town that is not covered has no topic");
  const t16 = G.topicsFor(model("16"), "child").topics;
  assert.ok(t16.every((t) => t.counts.judged === 0 && /^קבוצ/.test(G.sayText(t.say))), "16: every topic of a tiny town is small groups, shown as they are");
  assert.deepEqual(t16.map((t) => t.id), ["vaccines", "clinic", "feeding"], "no judged topic: the table's own order");
});

// ── the page ──
const rowOf = (h, a) => h("a.row-item.dm-row", { href: `#/c/1031/i/${a.id}` }, h("h3.dm-name", a.label));
const cellOf = (h, a) => h("li", h("a", { href: `#/c/1031/i/${a.id}` }, a.label));
async function page(cat = "child", { key = "1031", charts = false, only = null } = {}) {
  const dom = installDom(), { h } = await load("../ui.js"), D = await load("pages/domain.js"), m = model(key);
  const figs = m.indicators.filter((a) => a.domain === cat && a.last && (!only || only.includes(a.id)));
  const list = () => (charts ? h("ul.v-time-sm.has-cols.viz", { "aria-label": "היסטוריה" }, figs.map((a) => cellOf(h, a))) : h("div.rowlist.dm-rows", figs.map((a) => rowOf(h, a))));
  const host = h("div.dm-figs", list());
  return { dom, h, D, m, figs, host, list, say: [], opts() { return { announce: (t) => this.say.push(t), filtered: () => this.filter }; }, filter: false };
}
const names = (g) => g.querySelectorAll(".n-pg-domain-name").map((x) => x.textContent);
const summary = (d) => d.querySelector("summary");
const rowsIn = (d) => d.querySelectorAll("a.dm-row");

test("groupFigures: one native details per topic in the order of attention, a summary row, the first group open, the rows are the old page's own nodes", { skip }, async () => {
  const p = await page();
  try {
    const before = p.host.querySelectorAll("a.dm-row"), api = p.D.groupFigures(p.host, p.m, "child", p.opts());
    const root = p.host.children[0], groups = api.groups();
    assert.ok(root.classList.contains("n-pg-domain-groups") && p.host.children.length === 1);
    assert.deepEqual(names(root), ["חיסונים", "מעקב והדרכה בטיפת חלב", "משקל עודף בבית הספר", "הנקה ותזונת תינוקות"], "the topic that needs the most attention first");
    assert.deepEqual(groups.map((d) => d.tagName), ["DETAILS", "DETAILS", "DETAILS", "DETAILS"], "native details");
    assert.deepEqual(groups.map((d) => d.open), [true, false, false, false], "exactly one is open on the first load: the one that needs the most attention");
    for (const d of groups) assert.ok(summary(d) && d.children[0] === summary(d), "the summary is the first child, so it stays visible when the group is closed");
    const after = groups.flatMap(rowsIn);
    assert.equal(after.length, 13); assert.ok(before.every((r) => after.includes(r)), "the very nodes of the old page, moved, not rebuilt");
    assert.deepEqual(groups.map((d) => rowsIn(d).length), [3, 5, 2, 3]);
    assert.ok(groups.every((d) => d.querySelector(".rowlist")), "the same kind of list inside every group");
    const first = groups[0];
    assert.equal(summary(first).querySelector(".n-pg-domain-say").textContent, "כל 3 דורשים טיפול");
    assert.equal(summary(groups[1]).querySelector(".n-pg-domain-say").textContent, "4 מתוך 5 דורשים טיפול, אחד למעקב", "the same counts as the ring: 4 + 2 + 1 + 1 + ... of the 13");
    assert.deepEqual(groups.map((d) => [d.getAttribute("data-concern"), d.getAttribute("data-watch"), d.getAttribute("data-fine"), d.getAttribute("data-unjudged")].join("/")), ["3/0/0/0", "4/1/0/0", "1/0/1/0", "1/2/0/0"]);
    assert.deepEqual([0, 1, 2, 3].map((i) => [...groups.map((d) => +d.getAttribute(["data-concern", "data-watch", "data-fine", "data-unjudged"][i]))].reduce((s, x) => s + x, 0)), [9, 3, 1, 0], "the ring of 1031's children says 9, 3, 1");
    assert.ok(first.querySelector(".n-pg-domain-bar") && first.querySelector(".n-pg-domain-bar").getAttribute("aria-hidden") === "true", "the bar is a picture of the sentence, not a second reading");
    assert.equal(first.querySelector(".n-pg-domain-chev").tagName.toLowerCase(), "svg");
  } finally { p.dom.restore(); }
});

test("groupFigures: 'open all' is one toggle with aria-expanded and one polite announcement; a toggle of one group updates it", { skip }, async () => {
  const p = await page();
  try {
    const api = p.D.groupFigures(p.host, p.m, "child", p.opts()), btn = p.host.querySelector(".n-pg-domain-all");
    assert.ok(btn && btn.tagName === "BUTTON" && btn.getAttribute("type") === "button");
    assert.equal(btn.textContent, "פתיחת הכול"); assert.equal(btn.getAttribute("aria-expanded"), "false");
    await btn.click();
    assert.ok(api.groups().every((d) => d.open), "all open");
    assert.equal(btn.textContent, "סגירת הכול"); assert.equal(btn.getAttribute("aria-expanded"), "true");
    assert.deepEqual(p.say, ["כל הנושאים נפתחו"], "one announcement");
    await btn.click();
    assert.ok(api.groups().every((d) => !d.open)); assert.equal(btn.textContent, "פתיחת הכול"); assert.equal(btn.getAttribute("aria-expanded"), "false");
    assert.deepEqual(p.say, ["כל הנושאים נפתחו", "כל הנושאים נסגרו"]);
    api.groups()[1].open = true; await api.groups()[1].fire("toggle");
    assert.equal(btn.textContent, "פתיחת הכול", "one open is not all open");
    api.groups().forEach((d) => { d.open = true; }); await api.groups()[0].fire("toggle");
    assert.equal(btn.getAttribute("aria-expanded"), "true", "all opened by hand: the control says so");
  } finally { p.dom.restore(); }
});

test("groupFigures: the old page draws its list again (a filter, the charts view): the groups are made again, what the reader opened stays open, a filter opens what it finds", { skip }, async () => {
  const p = await page();
  try {
    const api = p.D.groupFigures(p.host, p.m, "child", p.opts());
    api.groups()[2].open = true; await api.groups()[2].fire("toggle");            // the reader opens school weight
    api.groups()[0].open = false; await api.groups()[0].fire("toggle");           // and closes vaccines
    p.host.replaceChildren(p.list()); api.regroup();                                // the old page paints again
    assert.deepEqual(api.groups().map((d) => d.open), [false, false, true, false], "the reader's own state");
    assert.equal(api.groups().flatMap(rowsIn).length, 13);
    // a status filter: only some figures come back; every group that has one is open, and the summary still says the truth of the whole topic
    const only = p.figs.filter((a) => a.status === "concern");
    p.filter = true; p.host.replaceChildren(p.h("div.rowlist.dm-rows", only.map((a) => rowOf(p.h, a)))); api.regroup();
    assert.equal(api.groups().flatMap(rowsIn).length, only.length);
    assert.ok(api.groups().every((d) => d.open), "a filter opens every group that has a figure");
    assert.equal(summary(api.groups()[1]).querySelector(".n-pg-domain-say").textContent, "4 מתוך 5 דורשים טיפול, אחד למעקב", "the summary is the topic, not the filter");
    assert.equal(p.host.querySelectorAll(".n-pg-domain-sum").length, api.groups().length);
    p.filter = false; p.host.replaceChildren(p.list()); api.regroup();
    assert.deepEqual(api.groups().map((d) => d.open), [false, false, true, false], "the filter did not overwrite the reader's state");
    // a list that is already in groups is not touched
    const root = p.host.children[0]; api.regroup(); assert.equal(p.host.children[0], root);
  } finally { p.dom.restore(); }
});

test("groupFigures: the charts view is grouped the same way, every group has a list of the same kind and a list item per figure", { skip }, async () => {
  const p = await page("child", { charts: true });
  try {
    const api = p.D.groupFigures(p.host, p.m, "child", p.opts()), lists = api.groups().map((d) => d.querySelector("ul"));
    assert.ok(lists.every((u) => u && u.classList.contains("v-time-sm") && u.classList.contains("has-cols") && u.getAttribute("aria-label") === "היסטוריה"));
    assert.ok(lists.every((u) => u.classList.contains("in")), "a list made here is drawn as it is");
    assert.deepEqual(lists.map((u) => u.children.length), [3, 5, 2, 3]);
  } finally { p.dom.restore(); }
});

test("groupFigures: a figure that no topic holds is kept after the groups, a single topic has no head, a town with nothing is not touched", { skip }, async () => {
  const p = await page();
  try {
    const stray = p.h("a.row-item.dm-row", { href: "#/c/1031/i/unknown_figure" }, "x");
    p.host.children[0].append(stray);
    const api = p.D.groupFigures(p.host, p.m, "child", p.opts());
    assert.ok(p.host.children[0].children.at(-1).querySelector("a.dm-row") === stray, "after the groups, not lost");
    assert.equal(p.D.groupFigures(null, p.m, "child"), null);
    assert.equal(p.D.groupFigures(p.host, model("935"), "child"), null, "an uncovered town has no topic: the old page's list is left alone");
  } finally { p.dom.restore(); }
  const one = await page("child", { only: ["th_mmrv", "th_penta"] });
  try {
    const api = one.D.groupFigures(one.host, one.m, "child", one.opts());
    assert.equal(api.groups().length, 1); assert.equal(one.host.querySelector(".n-pg-domain-all"), null, "nothing to open all of"); assert.ok(api.groups()[0].open);
    assert.equal(rowsIn(api.groups()[0]).length, 2);
    assert.equal(summary(api.groups()[0]).querySelector(".n-pg-domain-say").textContent, "כל 3 דורשים טיפול", "the summary is the topic's (3 figures), not the two rows that were drawn");
  } finally { one.dom.restore(); }
});

test("groupFigures: a tiny town (16), a weak one (99) and the stale one (472) read as they are", { skip }, async () => {
  for (const [key, cat, first, firstSay] of [["16", "child", "חיסונים", "קבוצות קטנות: המספרים מוצגים כמות שהם"], ["99", "child", "חיסונים", "כל 3 דורשים טיפול"], ["472", "child", "הנקה ותזונת תינוקות", "אחד מתוך 2 דורש טיפול, אחד ללא שיפוט"], ["1031", "context", "אוכלוסייה", "מתארים את היישוב, בלי שיפוט"]]) {
    const p = await page(cat, { key });
    try {
      const api = p.D.groupFigures(p.host, p.m, cat, p.opts()), g = api.groups();
      assert.equal(names(p.host)[0], first, `${key}/${cat}`);
      assert.equal(summary(g[0]).querySelector(".n-pg-domain-say").textContent, firstSay, `${key}/${cat}`);
      assert.equal(g.filter((d) => d.open).length, 1, `${key}/${cat}: one open`);
      assert.equal(g.flatMap(rowsIn).length, p.figs.length, `${key}/${cat}: no figure lost`);
      if (key === "16") assert.ok(g.every((d) => d.querySelectorAll(".n-pg-domain-seg").length === 1 && d.querySelector(".n-pg-domain-seg").classList.contains("is-none")), "16: the bars are all hollow: nothing is judged");
    } finally { p.dom.restore(); }
  }
});

test("adapt: the figures come right after the header, the years chart after them, the section numbers are made again, print opens every group and restores them", { skip }, async () => {
  const p = await page();
  try {
    const { h, m } = p, sec = (id, no, kids = []) => h("section.sec#" + id, h("div.sec-head", h("div", h("div.sec-eyebrow", h("b", no), "x"), h("h2.sec-title", "כל המדדים בתחום"))), ...kids);
    const tabs = h("div.dm-tabs", [["all", "הכל"], ["concern", "דורשים טיפול"]].map(([k, t]) => h("button.chip.dm-tab", { "aria-pressed": String(k === "all"), "data-f": k }, t)));
    const node = h("div.dm", h("section.hero.dm-hero", h("div.dm-main", h("div.eyebrow", "תחום"), h("h1", "ילדים והורים")), h("div.hero-meta")), sec("dm-years", "01"), sec("dm-figs", "02", [tabs, p.host]), sec("dm-recs", "03"));
    const say = [], ctx = { model: m, parts: ["c", "1031", "d", "child"], announce: (t) => say.push(t) };
    p.D.adapt(node, ctx);
    assert.deepEqual(node.children.map((c) => c.id || c.classList.contains("dm-hero") && "hero"), ["hero", "dm-figs", "dm-years", "dm-recs"], "the figures first, the years chart after");
    assert.deepEqual(node.querySelectorAll(".sec-eyebrow b").map((b) => b.textContent), ["01", "02", "03"], "numbered in the order they are shown");
    const groups = p.host.querySelectorAll("details.n-pg-domain-group");
    assert.equal(groups.length, 4); assert.deepEqual(groups.map((d) => d.open), [true, false, false, false]);
    await window.fire("beforeprint");
    assert.ok(groups.every((d) => d.open), "print: every group is open");
    await window.fire("afterprint");
    assert.deepEqual(groups.map((d) => d.open), [true, false, false, false], "and the reader's state comes back");
  } finally { p.dom.restore(); }
});

test("domain.css: the groups are plain (hairlines, no boxes), keyboard-visible, print-open, one prefix, no motion of its own (the chevron turns at once)", () => {
  const css = fs.readFileSync(path.join(ROOT, "web", "css", "product", "pages", "domain.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(/\.n-pg-domain-sum::-webkit-details-marker \{ display: none/.test(css), "the native marker is replaced by the chevron");
  assert.ok(/\.n-pg-domain-sum:focus-visible/.test(css), "the summary shows where the keyboard is");
  assert.ok(/@media print \{[^@]*details\.n-pg-domain-group::details-content \{ content-visibility: visible/.test(css), "print css fallback: a closed group still prints");
  assert.ok(/\.n-pg-domain-group\[open\] > \.n-pg-domain-sum \.n-pg-domain-chev \{ transform: rotate\(180deg\)/.test(css));
  assert.ok(!/transition|animation|@keyframes/.test(css), "real motion only through the verbs of css/motion.css: the chevron and the hover of a group change at once, so there is nothing to switch off for reduced motion");
  const group = /\.n-pg-domain-group \{([^}]*)\}/.exec(css)[1];
  assert.ok(!/background|box-shadow|border-radius/.test(group), "a group is not a box");
});
