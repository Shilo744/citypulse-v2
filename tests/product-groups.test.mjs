// The categories (web/js/product/city/groups.js): the 41 figures keep their count and their numbers, the categories hold what MERGE.md section 2 says, nothing that the server wrote from the
// nine old labels survives in the regrouped output, the catalogue, one figure and the answer of the ask page are regrouped the same way, and the fetch guard applies it at the boundary
// (and only there: other paths pass untouched).
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { rawModel, model, KEYS, haveStore } from "./helpers/city-models.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (f) => import(pathToFileURL(path.join(ROOT, "web", "js", "product", f)).href);
const G = await load("city/groups.js"), net = await load("net.js");
const skip = !haveStore && "no store on this machine";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const OLD_IDS = ["context", "outcomes", "immunization", "child", "nutrition", "mental", "welfare", "access", "safety", "env"];
const OLD_LABELS = ["הקשר ודמוגרפיה", "מצב הבריאות ותוחלת החיים", "בריאות הילד וההתפתחות", "תזונה והנקה", "רווחה ואלימות", "נגישות לשירותים", "בטיחות ופציעות"];
const COUNTS = { child: 13, outcomes: 8, mental: 8, safety: 4, context: 8 };
// everything that the product reads, without the copies of the old shape that the regrouped model keeps for the one who needs them (domainsOld, domainOld)
const readable = (o) => JSON.stringify(o, (k, v) => (k === "domainsOld" || k === "domainOld" ? undefined : v));

test("the groups: ids, labels, the order, the background flag, the move of th_firstvisit", () => {
  assert.deepEqual(G.GROUPS.map((g) => g.id), ["child", "outcomes", "mental", "safety", "context"]);
  assert.deepEqual(G.GROUPS.map((g) => g.label), ["ילדים והורים", "בריאות ושירותי בריאות", "נפש ורווחה", "בטיחות", "רקע על היישוב"]);
  assert.deepEqual(G.GROUPS.filter((g) => g.background).map((g) => g.id), ["context"]);
  assert.deepEqual(G.GROUPS.map((g) => !!g.blurb), [true, true, true, true, true]);
  assert.equal(G.groupIdOf("access", "th_firstvisit"), "child", "the first visit of a newborn is about children");
  assert.equal(G.groupIdOf("access", "wait_gyn_days"), "outcomes");
  assert.equal(G.groupIdOf("unknown-domain"), "unknown-domain", "a domain that nobody knows stays what it is");
  assert.equal(G.isBackground("context"), true); assert.equal(G.isBackground("child"), false);
  assert.equal(G.BACKGROUND_ID, "context");
});

test("categoryOfOldDomain knows all nine old ids (and env), and nothing else", () => {
  const to = { context: "context", env: "context", outcomes: "outcomes", access: "outcomes", immunization: "child", child: "child", nutrition: "child", mental: "mental", welfare: "mental", safety: "safety" };
  for (const id of OLD_IDS) assert.equal(G.categoryOfOldDomain(id), to[id], id);
  assert.equal(G.categoryOfOldDomain("child"), "child", "a category keeps the id of its main old domain");
  for (const id of ["capacity", "", "nope", undefined]) assert.equal(G.categoryOfOldDomain(id), null, String(id));
});

test("the 41 figures are all kept, with their numbers, for every fixture town; the counts per category are the sums of the old ones", { skip }, () => {
  for (const key of KEYS) {
    const raw = rawModel(key), m = model(key);
    assert.equal(m.indicators.length, raw.indicators.length, key);
    const sum = (list, k) => list.reduce((n, a) => n + (a.status === k ? 1 : 0), 0);
    for (const [i, a] of raw.indicators.entries()) {
      const b = m.indicators[i];
      assert.equal(b.id, a.id); assert.deepEqual(b.last, a.last, `${key} ${a.id}: the numbers are the server's`); assert.deepEqual(b.series, a.series); assert.equal(b.status, a.status);
      assert.equal(b.domainOld, a.domain);
    }
    const flat = (d, k) => (d.counts && d.counts[k]) || 0;
    for (const k of ["strength", "good", "watch", "concern", "uncertain", "stale"]) {
      assert.equal(m.domains.reduce((n, d) => n + flat(d, k), 0), raw.domains.reduce((n, d) => n + flat(d, k), 0), `${key}: the total of "${k}" over the categories is the total over the old domains`);
    }
    assert.equal(m.domains.reduce((n, d) => n + d.indicators.length, 0), raw.indicators.length, `${key}: every figure is in exactly one category`);
    const ids = m.domains.flatMap((d) => d.indicators); assert.equal(new Set(ids).size, ids.length, `${key}: no figure twice`);
    for (const d of m.domains) {
      const members = G.GROUPS.find((g) => g.id === d.id).from;
      const moved = Object.entries(G.MOVES).filter(([, mv]) => mv.to === d.id).length - Object.entries(G.MOVES).filter(([, mv]) => G.categoryOfOldDomain(mv.from) === d.id && mv.to !== d.id).length;
      const expect = raw.domains.filter((o) => members.includes(o.id)).reduce((n, o) => n + (o.available || 0), 0) + moved;
      assert.equal(d.available, expect, `${key}/${d.id}: the catalogue count is the sum of the old ones (th_firstvisit moved)`);
      for (const k of ["concern", "watch", "good", "strength"]) assert.equal(flat(d, k), sum(m.indicators.filter((a) => a.domain === d.id), k), `${key}/${d.id}/${k}`);
    }
    assert.equal(m.domains.find((d) => d.id === "context").background, true, `${key}: the background is flagged`);
    assert.deepEqual(m.domains.filter((d) => !d.background).map((d) => d.id).every((id) => ["child", "outcomes", "mental", "safety"].includes(id)), true);
  }
});

test("the counts of the catalogue are 13 / 8 / 8 / 4 / 8 in a town that has every figure", { skip }, () => {
  const m = model("1031");
  assert.deepEqual(Object.fromEntries(m.domains.map((d) => [d.id, d.available])), COUNTS);
});

test("idempotent: a regrouped model is returned as it is, and what is not a model is returned as it came", { skip }, () => {
  const m = model("1031");
  assert.equal(G.regroup(m), m);
  assert.deepEqual(G.regroup(G.regroup(rawModel("16"))).domains, model("16").domains);
  for (const x of [null, undefined, 0, "x", [], {}, { domains: [] }, { indicators: [], domains: {} }]) assert.equal(G.regroup(x), x);
});

test("no old label survives: not in the domains, the figures, the findings, the recommendations or the headline", { skip }, () => {
  for (const key of KEYS) {
    const m = model(key), text = readable({ ...m, city: undefined, sources: undefined });
    for (const w of OLD_LABELS) assert.ok(!text.includes(w), `${key}: "${w}" is still in the regrouped model`);
    assert.ok(m.indicators.every((a) => Object.keys(COUNTS).includes(a.domain)), `${key}: every figure is in a category`);
    assert.ok(m.findings.every((f) => !f.indicator || Object.keys(COUNTS).includes(f.domain)), `${key}: every finding of a figure has a category`);
    assert.ok(m.findings.filter((f) => !f.indicator).every((f) => /^(domain_weak|domain_declining)$/.test(f.type) && Object.keys(COUNTS).includes(f.domain)));
    assert.ok(m.recommendations.every((r) => Object.keys(COUNTS).includes(r.domain)), `${key}: every recommendation has a category`);
    assert.ok(m.recommendations.length <= rawModel(key).recommendations.length, `${key}: the regrouping never adds a recommendation`);
    const titles = m.recommendations.map((r) => r.title); assert.equal(new Set(titles).size, titles.length, `${key}: no two recommendations with the same title`);
  }
});

test("the findings and the review of a whole domain are written for the category, with the same rule and its own counts", { skip }, () => {
  for (const key of KEYS) {
    const m = model(key);
    for (const f of m.findings.filter((x) => x.type === "domain_weak")) {
      const list = m.indicators.filter((a) => a.domain === f.domain && a.direction && a.last && a.last.reliable), bad = list.filter((a) => a.status === "concern" || a.status === "watch");
      assert.equal(f.facts.count, bad.length); assert.equal(f.facts.of, list.length); assert.ok(bad.length >= 3 && bad.length / list.length >= 0.6, `${key}/${f.domain}: the rule of the server`);
      assert.ok(f.text.startsWith(G.groupById(f.domain).label + ":"), "the sentence names the category");
    }
    const sorted = m.findings.map((f) => f.severity); assert.deepEqual(sorted, sorted.slice().sort((a, b) => b - a), `${key}: strongest first, as the server sends them`);
    for (const r of m.recommendations.filter((x) => x.intervention === "domain_review")) {
      assert.ok(r.title.includes(G.groupById(r.domain).label), `${key}: the review names its category`);
      assert.ok(r.why.length && r.why.every((w) => w.text.startsWith(G.groupById(r.domain).label + ":")), "and rests on the category's own findings");
    }
  }
  const raw = rawModel("1031"), m = model("1031"), old = /והתחום החלש ביותר הוא (.+)\.$/.exec(raw.summary.headline);
  if (old) { const mine = /והתחום החלש ביותר הוא (.+)\.$/.exec(m.summary.headline); assert.ok(mine && G.GROUPS.some((g) => g.label === mine[1] && !g.background), "the headline names a category of the menu"); }
});

test("regroupMeta: the catalogue speaks the categories; every figure is mapped and keeps its old domain; idempotent; tolerant", async () => {
  const meta = await (async () => {
    const dom = (id) => ({ id, label: "old " + id, blurb: "" }), ind = (id, domain) => ({ id, domain, label: id });
    return { domains: [...OLD_IDS, "capacity"].map(dom), indicators: [ind("a", "immunization"), ind("b", "child"), ind("c", "nutrition"), ind("d", "access"), ind("th_firstvisit", "access"), ind("e", "outcomes"), ind("f", "mental"), ind("g", "welfare"),
      ind("h", "safety"), ind("i", "context"), ind("j", "env")], sources: { s: 1 }, rules: { x: 1 }, framework: [{ id: "fw", domain: "immunization" }] };
  })();
  const r = G.regroupMeta(meta);
  assert.deepEqual(r.domains.map((d) => d.id), ["child", "outcomes", "mental", "safety", "context"], "the categories, in order; the domain with no figure (capacity) is left out");
  assert.deepEqual(r.domains.map((d) => d.label), G.GROUPS.map((g) => g.label));
  assert.deepEqual(r.domains.filter((d) => d.background).map((d) => d.id), ["context"]);
  assert.deepEqual(Object.fromEntries(r.indicators.map((i) => [i.id, i.domain])), { a: "child", b: "child", c: "child", d: "outcomes", th_firstvisit: "child", e: "outcomes", f: "mental", g: "mental", h: "safety", i: "context", j: "context" });
  assert.ok(r.indicators.every((i) => i.domainOld === meta.indicators.find((x) => x.id === i.id).domain), "the old domain is kept on every figure");
  assert.deepEqual(r.sources, meta.sources); assert.deepEqual(r.rules, meta.rules); assert.deepEqual(r.framework, meta.framework, "the framework keeps its own topics");
  assert.equal(r.domainsOld.length, 11);
  assert.equal(G.regroupMeta(r), r, "idempotent");
  for (const x of [null, undefined, "x", 3, [], {}, { domains: [], indicators: [] }, { domains: ["d"], indicators: [] }, { domains: {}, indicators: [{}] }, { domains: [], indicators: [null, 1] }]) assert.equal(G.regroupMeta(x), x, JSON.stringify(x));
  const odd = G.regroupMeta({ domains: [dom0("zzz"), dom0("capacity")], indicators: [{ id: "q", domain: "zzz" }, null] });
  assert.deepEqual(odd.domains.map((d) => d.id), ["zzz"], "a domain nobody knows stays as the server says it, if a figure belongs to it");
  function dom0(id) { return { id, label: id }; }
});

test("regroupMeta on the real catalogue: 41 figures, four categories and the background", async () => {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url), domains = require("../src/catalog/domains"), { indicators } = require("../src/catalog/indicators");
  const r = G.regroupMeta({ domains, indicators: indicators.map(({ collect, ...rest }) => rest) });
  assert.equal(r.indicators.length, 41);
  assert.deepEqual(Object.fromEntries(r.domains.map((d) => [d.id, r.indicators.filter((i) => i.domain === d.id).length])), COUNTS);
  assert.ok(r.domains.every((d) => !OLD_LABELS.includes(d.label)));
  assert.ok(!readable({ domains: r.domains, indicators: r.indicators }).match(new RegExp(OLD_LABELS.join("|"))), "no old label in what a page reads");
});

test("regroupDetail: the figure of one town takes its category and loses the review of a whole domain", () => {
  const d = { indicator: { id: "wait_gyn_days", domain: "access" }, analysis: { id: "wait_gyn_days", domain: "access" },
    findings: [{ id: "f1", indicator: "wait_gyn_days", domain: "access", type: "level_low" }],
    recommendations: [{ id: "r1", intervention: "x", domain: "access", indicators: ["wait_gyn_days"] }, { id: "r2", intervention: "domain_review", domain: "access", title: "נגישות לשירותים", indicators: ["wait_gyn_days"] }] };
  const r = G.regroupDetail(d);
  assert.equal(r.analysis.domain, "outcomes"); assert.equal(r.indicator.domain, "outcomes"); assert.equal(r.findings[0].domain, "outcomes");
  assert.deepEqual(r.recommendations.map((x) => x.id), ["r1"]); assert.equal(r.recommendations[0].domain, "outcomes");
  assert.equal(G.regroupDetail(r), r);
  assert.equal(G.regroupDetail({ x: 1 }).x, 1); assert.equal(G.regroupDetail(null), null);
  assert.equal(G.regroupDetail({ indicator: { id: "th_firstvisit", domain: "access" }, analysis: { id: "th_firstvisit", domain: "access" } }).analysis.domain, "child", "the moved figure");
});

test("rewriteWords and regroupAnswer: the old labels inside a sentence, the old-domain findings and reviews, the domain of a figure", () => {
  for (const w of OLD_LABELS) assert.ok(!G.rewriteWords(`בתחום ${w} יש מדדים`).includes(w), w);
  assert.equal(G.rewriteWords("בתחום נגישות לשירותים יש חמישה מדדים"), "בתחום בריאות ושירותי בריאות יש חמישה מדדים");
  assert.equal(G.rewriteWords("מצב החיסונים טוב"), "מצב החיסונים טוב", "an ordinary word is not a category");
  assert.equal(G.rewriteWords("בתחום חיסונים"), "בתחום ילדים והורים");
  assert.equal(G.rewriteWords(5), 5); assert.equal(G.rewriteWords(null), null);
  const ans = { title: "תחום נגישות לשירותים", answer: "x", followups: ["מה בתחום תזונה והנקה?"], blocks: [
    { type: "findings", items: [{ id: "a:domain_weak", type: "domain_weak", text: "נגישות לשירותים: 5 מתוך 5" }] },
    { type: "findings", items: [{ id: "i:level_low", type: "level_low", text: "t" }, { id: "b:domain_declining", type: "domain_declining", text: "u" }] },
    { type: "recs", items: [{ id: "rec:domain_review:access", title: "r" }] }, { type: "recs", items: [{ id: "rec:a", title: "ב בתחום בטיחות ופציעות", why: [{ type: "domain_weak" }, { type: "level_low" }] }] },
    { type: "table", rows: [{ id: "wait_gyn_days", domain: "access" }] }, { type: "compare", items: [{ ind: { id: "th_mmrv", domain: "immunization" } }] }] };
  const r = G.regroupAnswer(ans);
  assert.equal(r.title, "תחום בריאות ושירותי בריאות"); assert.deepEqual(r.followups, ["מה בתחום ילדים והורים?"]);
  assert.equal(r.blocks.length, 4, "the block that held only a whole-domain finding or review is gone");
  assert.deepEqual(r.blocks[0].items.map((x) => x.id), ["i:level_low"]);
  assert.equal(r.blocks[1].items[0].title, "ב בתחום בטיחות"); assert.deepEqual(r.blocks[1].items[0].why, [{ type: "level_low" }]);
  assert.equal(r.blocks[2].rows[0].domain, "outcomes"); assert.equal(r.blocks[3].items[0].ind.domain, "child");
  assert.equal(G.regroupAnswer(r), r); assert.equal(G.regroupAnswer(null), null); assert.deepEqual(G.regroupAnswer({ x: 1 }).x, 1);
});

// ── the guard: the old modules read the same categories ──
const META = { domains: OLD_IDS.map((id) => ({ id, label: "old " + id })), indicators: [{ id: "wait_gyn_days", domain: "access", label: "x" }] };
const CITY = { city: { key: "1", name: "עיר" }, domains: META.domains.map((d) => ({ ...d, available: 1, counts: {}, indicators: [] })), indicators: [{ id: "wait_gyn_days", domain: "access", label: "x", status: "good" }], findings: [], recommendations: [] };
function script(table) { const f = (url, init) => { f.calls.push({ url, init }); const key = Object.keys(table).find((k) => url === k || url.startsWith(k)); return Promise.resolve(key ? table[key]() : json({ other: true })); }; f.calls = []; return f; }

test("the guard regroups /api/city/<key>, /api/meta and one figure of a town, and leaves every other path alone", async () => {
  const detail = { indicator: { id: "wait_gyn_days", domain: "access" }, analysis: { id: "wait_gyn_days", domain: "access" }, findings: [], recommendations: [] };
  const geo = [{ k: "1", n: "x" }], cmp = { cities: [], rows: [{ id: "wait_gyn_days", domain: "access" }] };
  const f = script({ "/api/city/1/indicator/wait_gyn_days": () => json(detail), "/api/city/1": () => json(CITY), "/api/meta": () => json(META), "/api/geo": () => json(geo), "/api/compare": () => json(cmp), "/api/search": () => json([]), "/api/health": () => json({ ok: true }) });
  const g = net.guardFetch(f, { timeoutMs: 200 });
  const city = await (await g("/api/city/1")).json(); assert.equal(city.indicators[0].domain, "outcomes"); assert.deepEqual(city.domains.map((d) => d.id).sort(), ["child", "context", "mental", "outcomes", "safety"].sort());
  assert.equal((await (await g("/api/city/1?x=1")).json()).grouped, true, "a query string does not matter");
  const meta = await (await g("/api/meta")).json(); assert.equal(meta.indicators[0].domain, "outcomes"); assert.ok(meta.domains.every((d) => G.GROUPS.some((x) => x.id === d.id && x.label === d.label)), "only categories, with the category labels");
  const one = await (await g("/api/city/1/indicator/wait_gyn_days")).json(); assert.equal(one.analysis.domain, "outcomes"); assert.equal(one.indicator.domain, "outcomes");
  assert.deepEqual(await (await g("/api/geo")).json(), geo); assert.deepEqual(await (await g("/api/compare?keys=1&ids=wait_gyn_days")).json(), cmp, "the compare rows carry no domain and pass untouched");
  assert.deepEqual(await (await g("/api/search?q=x")).json(), []); assert.deepEqual(await (await g("/api/health")).json(), { ok: true });
  assert.equal(f.calls.length, 8);
});

test("the guard regroups the answer of the ask page without a time limit, and no other write is touched", async () => {
  const f = script({ "/api/ask": () => json({ title: "בתחום נגישות לשירותים", blocks: [{ type: "text", text: "בתחום בטיחות ופציעות" }] }), "/api/feedback": () => json({ ok: true }) });
  const g = net.guardFetch(f, { timeoutMs: 20 });
  const a = await (await g("/api/ask", { method: "POST", body: "{}" })).json(); assert.equal(a.title, "בתחום בריאות ושירותי בריאות"); assert.equal(a.blocks[0].text, "בתחום בטיחות");
  assert.ok(!f.calls[0].init || !f.calls[0].init.signal, "no limit on the write");
  const fb = await (await g("/api/feedback", { method: "POST", body: "{}" })).json(); assert.deepEqual(fb, { ok: true });
  const bad = net.guardFetch(script({ "/api/ask": () => new Response("not json", { status: 200 }) }), {}); assert.equal(await (await bad("/api/ask", { method: "POST" })).text(), "not json", "an answer that is not JSON is passed on as it came");
  const err = net.guardFetch(script({ "/api/ask": () => json({ error: "x" }, 429) }), {}); assert.equal((await err("/api/ask", { method: "POST" })).status, 429);
});

test("net.meta() and net.indicator() give the categories (the same shapes as the guard)", async () => {
  const f = script({ "/api/meta": () => json(META), "/api/city/1/indicator/wait_gyn_days": () => json({ indicator: { domain: "access" }, analysis: { id: "wait_gyn_days", domain: "access" }, findings: [], recommendations: [] }) });
  net.useFetch(f); net.forget();
  try {
    const m = await net.meta(); assert.equal(m.indicators[0].domain, "outcomes"); assert.equal(m.grouped, true);
    const d = await net.indicator("1", "wait_gyn_days"); assert.equal(d.analysis.domain, "outcomes");
    await net.meta(); assert.equal(f.calls.length, 2, "kept for the session in its categories");
  } finally { net.useFetch(null); net.forget(); }
});

// ── the adapters speak the categories ──
test("domain page of the background: the eyebrow says 'רקע' and the list is the background's own; a category keeps 'תחום'", { skip }, async () => {
  const { installDom } = await import("./helpers/fake-dom.mjs"), d = installDom();
  try {
    const { adapt } = await load("pages/domain.js"), { h } = await load("../ui.js");
    const m = model("1031");
    const page = (id) => { const node = h("div", h("section.dm-hero", h("div.dm-main", h("div.eyebrow", "תחום"), h("h1", "x")), h("div.hero-meta")), h("section#dm-figs", h("h2.sec-title", "כל המדדים בתחום"))); adapt(node, { model: m, parts: ["c", "1031", "d", id] }); return node; };
    const bg = page("context"), cat = page("child");
    assert.equal(bg.querySelector(".eyebrow").textContent, "רקע"); assert.equal(bg.querySelector(".sec-title").textContent, "כל מדדי הרקע");
    assert.equal(cat.querySelector(".eyebrow").textContent, "תחום"); assert.equal(cat.querySelector(".sec-title").textContent, "כל המדדים בתחום");
  } finally { d.restore(); }
});

test("compare page: the short names of the columns are the names of the categories, also when they are drawn later", { skip }, async () => {
  const { installDom } = await import("./helpers/fake-dom.mjs"), d = installDom();
  try {
    const { adapt } = await load("pages/compare.js"), { h } = await load("../ui.js");
    const col = (t) => h("th", t), node = h("div", h("section.tr-hero", h("div.tr-hero-top", h("div.eyebrow", "x"), h("h1", "x"))), h("table", h("tr", ["ילדים", "בריאות", "נפש", "בטיחות"].map(col))));
    adapt(node, { model: model("1031"), signal: new AbortController().signal });
    assert.deepEqual(node.querySelectorAll("th").map((x) => x.textContent), ["ילדים והורים", "בריאות ושירותים", "נפש ורווחה", "בטיחות"]);
  } finally { d.restore(); }
});
