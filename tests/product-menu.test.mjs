// The menu and the routes of the merged town page (m3): the town, exactly the four categories, the tools; none of the old items; every old address lands where
// design-ideas/product/MERGE.md section 4 says. Pure: the real menu is drawn on a fake document, the route table is called with fake models.
// The same addresses are walked in a real browser by `CDP_SLOT=3 node src/tools/chrome_probe.js --mode=nav`.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installDom } from "./helpers/fake-dom.mjs";
import { haveStore, model } from "./helpers/city-models.mjs";

const PRODUCT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "js", "product");
const load = (f) => import(pathToFileURL(path.join(PRODUCT, f)).href);
const skip = !haveStore && "the built store is not there";
const OLD_DOMAINS = { immunization: "child", child: "child", nutrition: "child", outcomes: "outcomes", access: "outcomes", mental: "mental", welfare: "mental", safety: "safety", context: "context", env: "context" };
const FOUR = ["child", "outcomes", "mental", "safety"];
const OLD_ITEMS = ["במבט אחד", "דוח ליישוב", "התמונה המלאה"];

let draws = 0;
async function drawMenu(m, active = "home") {
  const d = installDom();
  try {
    for (const id of ["side", "crumbs", "foot", "menu", "top", "quick", "scrim"]) { const e = d.doc.createElement("div"); e.setAttribute("id", id); d.body.append(e); }
    const shell = await import(pathToFileURL(path.join(PRODUCT, "shell.js")).href + "?draw=" + (++draws));          // a fresh copy: the module keeps the elements of the document it was loaded in
    shell.renderSide(m, active);
    const side = d.doc.getElementById("side");
    const items = side.findAll((e) => !e.closest(".n-shell-switch") && (e.classes.has("nav") || e.classes.has("navgroup") || e.classes.has("cityswitch")));
    return { items: items.map((e) => ({ kind: e.classes.has("navgroup") ? "group" : e.classes.has("cityswitch") ? "town" : "link", text: e.textContent.trim(), href: e.getAttribute("href"), current: e.getAttribute("aria-current") })), text: side.textContent, shell };
  } finally { d.restore(); }
}

for (const key of ["1031", "9000", "16", "935"]) {
  test(`menu of ${key}: the town, then exactly the four categories (none for the background), then the tools`, { skip }, async () => {
    const m = model(key), { items, text } = await drawMenu(m);
    assert.equal(items[0].kind, "town", "the town comes first");
    assert.ok(items[0].text.includes(m.city.name));
    assert.equal(items[1].text, "דף היישוב");
    assert.equal(items[1].href, `#/c/${key}`);
    assert.equal(items[1].current, "page", "the town page is the current item");
    const cats = items.filter((i) => i.kind === "link" && /\/d\//.test(i.href)).map((i) => i.href.split("/d/")[1]);
    const expected = FOUR.filter((id) => (m.domains.find((d) => d.id === id) || { indicators: [] }).indicators.length);
    assert.deepEqual(cats, expected, "the four categories that have figures, in this order");
    assert.ok(!cats.includes("context"), "the background is not a category");
    const groups = items.filter((i) => i.kind === "group").map((i) => i.text);
    assert.deepEqual(groups, [...(expected.length ? ["תחומים"] : []), "כלי עבודה", "מידע"]);
    const tools = items.slice(items.findIndex((i) => i.text === "כלי עבודה") + 1).filter((i) => i.kind === "link").map((i) => i.text);
    assert.deepEqual(tools.slice(0, 4), ["תוכנית פעולה", "מגמות והיסטוריה", "השוואה ליישובים", "שאלו את הסוכן"]);
    for (const w of OLD_ITEMS) assert.ok(!text.includes(w), `the old item "${w}" is gone`);
    assert.ok(!items.some((i) => /\/(overview|simple|brief)$/.test(i.href || "")), "no link to the overview, the alias or the report");
  });
}

test("menu: the alias route marks the same item as the town page", { skip }, async () => {
  const m = model("1031");
  const { items } = await drawMenu(m, "home");                         // routes.js gives active "home" to both routes
  assert.equal(items.filter((i) => i.current === "page").length, 1);
});

test("menu: the orange dot rule ignores the background and picks at most two categories", { skip }, async () => {
  const { shell } = await drawMenu(model("1031"));
  for (const key of ["1031", "9000", "99", "16"]) {
    const m = model(key), w = shell.weakestDomains(m);
    assert.ok(w.size <= 2 && !w.has("context"), key);
  }
  const fake = { domains: [{ id: "context", background: true, indicators: ["a", "b"] }, { id: "child", indicators: ["c"] }], indicators: [{ id: "a", domain: "context", status: "concern" }, { id: "b", domain: "context", status: "concern" }, { id: "c", domain: "child", status: "good" }] };
  assert.equal(shell.weakestDomains(fake).size, 0, "a background full of concerns is never the weakest category");
});

// ── the pages of information inside the town (u1): the glossary, the accessibility statement and the privacy page ──
const INFO = [["glossary", "מילון מונחים"], ["accessibility", "הצהרת נגישות"], ["privacy", "פרטיות"]];
let foots = 0;
async function drawFooter(m, route) {
  const d = installDom();
  try {
    for (const id of ["side", "crumbs", "foot", "menu", "top", "quick", "scrim"]) { const e = d.doc.createElement("div"); e.setAttribute("id", id); d.body.append(e); }
    const shell = await import(pathToFileURL(path.join(PRODUCT, "shell.js")).href + "?foot=" + (++foots));
    shell.renderFooter(m, route);
    return d.doc.getElementById("foot").findAll((e) => e.tagName === "A").map((a) => ({ text: a.textContent.trim(), href: a.getAttribute("href") }));
  } finally { d.restore(); }
}

test("menu: inside a town the glossary item opens the glossary of the town and is the current item on that page", { skip }, async () => {
  for (const key of ["1031", "16"]) {
    const m = model(key), { items } = await drawMenu(m, "glossary");
    assert.equal(items[0].kind, "town", "the town menu stays: the town is first");
    const g = items.find((i) => i.text === "מילון מונחים");
    assert.equal(g.href, `#/c/${key}/glossary`); assert.equal(g.current, "page");
    assert.equal(items.filter((i) => i.current === "page").length, 1, "one current item");
    assert.ok(!items.some((i) => i.href === "#/glossary" || i.href === "#/method" || i.href === "#/"), "no link of the town menu leaves the town");
    const own = await drawMenu(m, "privacy");
    assert.equal(own.items.filter((i) => i.current === "page").length, 0, "the privacy page has no item of its own: no other item claims it");
  }
});

test("menu: without a town the menu is the town-less one (choose a town, the information) and the glossary item is the top-level page", async () => {
  const { items } = await drawMenu(null, "glossary");
  assert.deepEqual(items.map((i) => [i.kind, i.text, i.href]), [["link", "בחירת יישוב", "#/"], ["group", "מידע", null], ["link", "שיטה ומקורות", "#/method"], ["link", "מילון מונחים", "#/glossary"]]);
  assert.equal(items[3].current, "page");
  assert.ok(!items.some((i) => i.kind === "town" || /\/c\//.test(i.href || "")), "no town item, no town link");
});

test("footer: inside a town the four pages of information are the ones of the town; without a town the top-level pages", { skip }, async () => {
  const m = model("1031");
  for (const route of ["home", "d", "glossary", "trends"]) {
    const links = await drawFooter(m, route), by = Object.fromEntries(links.map((l) => [l.text, l.href]));
    assert.equal(by["שיטה ומקורות"], "#/c/1031/method"); assert.equal(by["מילון מונחים"], "#/c/1031/glossary");
    assert.equal(by["הצהרת נגישות"], "#/c/1031/accessibility"); assert.equal(by["פרטיות"], "#/c/1031/privacy"); assert.equal(by["כיסוי נתונים"], "#/c/1031/coverage");
    assert.deepEqual(links.filter((l) => /^#\/(method|glossary|accessibility|privacy)/.test(l.href)), [], "no top-level address in the footer of a town (" + route + ")");
  }
  const free = Object.fromEntries((await drawFooter(null, "glossary")).map((l) => [l.text, l.href]));
  assert.equal(free["שיטה ומקורות"], "#/method"); assert.equal(free["מילון מונחים"], "#/glossary"); assert.equal(free["הצהרת נגישות"], "#/accessibility"); assert.equal(free["פרטיות"], "#/privacy");
  assert.ok(!("כיסוי נתונים" in free), "the coverage page needs a town");
});

test("routes: each page of information is rendered with the town: the way back is the town, its menu item is its own, and without a town the way back is the entry page", async () => {
  const d = installDom();
  try {
    const { ROUTES } = await load("routes.js"), nav = await load("nav.js");
    for (const [id] of INFO) {
      const c = nav.classify(nav.parse(`#/c/7/${id}`).parts);
      const v = await ROUTES[c.id].load(ctxFor(fakeModel(FOUR)), c), back = v.band.find((e) => e.tagName === "A" && e.classes.has("n-band-back"));
      assert.equal(back.getAttribute("href"), "#/c/7", id + ": back to the town"); assert.equal(back.textContent.trim(), "דף היישוב");
      assert.equal(v.active, id, id + ": the page names itself as the current one");
      const free = nav.classify(nav.parse(`#/${id}`).parts), w = await ROUTES[free.id].load({ ...ctxFor(null), key: null, model: null }, free), back0 = w.band.find((e) => e.tagName === "A" && e.classes.has("n-band-back"));
      assert.equal(back0.getAttribute("href"), "#/", id + ": no town, back to the entry page"); assert.equal(back0.textContent.trim(), "דף הבית");
    }
  } finally { d.restore(); }
});

// ── the route table ──
const fakeModel = (ids) => ({ city: { key: "7", name: "עיר" }, domains: ids.map((id) => ({ id, label: id, indicators: [] })), indicators: [] });
const ctxFor = (m, qs = "") => ({ key: "7", model: m, params: new URLSearchParams(qs), parts: [], sub: "", go() {}, announce() {}, setTitle() {}, setCrumbs() {}, themeBtn() {}, mode: "n" });

test("routes: overview redirects to the town page and keeps ?q=", async () => {
  const d = installDom();
  try {
    const { ROUTES } = await load("routes.js");
    assert.deepEqual(await ROUTES.overview.load(ctxFor(fakeModel(FOUR))), { redirect: "#/c/7" });
    assert.deepEqual(await ROUTES.overview.load(ctxFor(fakeModel(FOUR), "q=changed")), { redirect: "#/c/7?q=changed" });
    assert.deepEqual(await ROUTES.overview.load(ctxFor(fakeModel(FOUR), "q=a b")), { redirect: "#/c/7?q=a%20b" }, "the value is encoded");
  } finally { d.restore(); }
});

test("routes: d/<old domain id> redirects to d/<category> for each of the old ids the model no longer has", async () => {
  const d = installDom();
  try {
    const { ROUTES } = await load("routes.js");
    const m = fakeModel([...FOUR, "context"]);
    for (const [old, cat] of Object.entries(OLD_DOMAINS)) {
      if (m.domains.some((x) => x.id === old)) continue;                       // an id the model has is a real page (child, outcomes, mental, safety, context)
      assert.deepEqual(await ROUTES.d.load(ctxFor(m), { arg: old }), { redirect: `#/c/7/d/${cat}` }, old);
    }
  } finally { d.restore(); }
});

test("routes: a redirect can never loop (the target is a domain of the model, or nothing happens)", async () => {
  const d = installDom();
  try {
    const { ROUTES } = await load("routes.js");
    const bare = fakeModel([]);                                                  // a town with no categories at all
    for (const old of Object.keys(OLD_DOMAINS)) {
      const v = await ROUTES.d.load(ctxFor(bare), { arg: old });
      assert.ok(!v.redirect, `${old}: no redirect to a page the model does not have`);
      assert.equal(v.status, "notfound");
    }
    const some = fakeModel(["child"]);                                           // the category of access (outcomes) is missing: not found, not a redirect
    assert.ok(!(await ROUTES.d.load(ctxFor(some), { arg: "access" })).redirect);
    const v = await ROUTES.d.load(ctxFor(fakeModel(FOUR)), { arg: "not-a-domain" });
    assert.equal(v.status, "notfound", "an id nobody knows stays not found");
  } finally { d.restore(); }
});

test("routes: home and simple are the same page (the alias is an old link to the retired short level), the old chrome logic is gone", async () => {
  const src = (await import("node:fs")).readFileSync(path.join(PRODUCT, "routes.js"), "utf8").replace(/\/\/.*$/gm, "");
  assert.match(src, /home: \{ load: \(ctx\) => townPage\(ctx\) \}/);
  assert.match(src, /simple: \{ load: \(ctx\) => townPage\(ctx\) \}/);
  assert.match(src, /active: "home"/);
  assert.ok(!/homeRedirect|KEYS\.view|pages\/overview/.test(src), "no redirect of the home by the stored choice and no overview page");
  const nav = await load("nav.js");
  for (const s of ["simple", "overview"]) assert.ok(nav.SUBS.includes(s), `${s} is still a known sub-route`);
  assert.equal(nav.classify(nav.parse("#/c/7/simple").parts).id, "simple");
  assert.equal(nav.classify(nav.parse("#/c/7/overview").parts).id, "overview");
});

test("nav: switching town keeps the alias, sends the overview to the same address (which redirects), and keeps ?q=", async () => {
  const nav = await load("nav.js");
  assert.equal(await nav.switchTown("#/c/1031/simple", "16"), "#/c/16/simple");
  assert.equal(await nav.switchTown("#/c/1031/overview", "16"), "#/c/16/overview");
  assert.equal(await nav.switchTown("#/c/1031?q=changed", "16"), "#/c/16?q=changed");
  for (const q of nav.QUESTIONS) assert.equal(nav.normalizeQuestion(q), q, q);
});

test("app.js: the redirects are applied with replace, an old ?q=simple lands on the alias, the crumbs are town > category and town > category > measure", async () => {
  const src = (await import("node:fs")).readFileSync(path.join(PRODUCT, "app.js"), "utf8");
  assert.match(src, /if \(v\.redirect\) \{ saving = true; nav\.go\(v\.redirect, \{ replace: true \}\); return; \}/);
  assert.match(src, /params\.get\("q"\) === "simple"[^\n]*sub: "simple"[^\n]*replace: true/);
  assert.match(src, /if \(c\.id === "home" \|\| c\.id === "simple"\) return \[town\]/);
  assert.match(src, /\[town, \{ label: d\.label, href: `\$\{town\.href\}\/d\/\$\{d\.id\}` \}, \{ label: title \}\]/);
  assert.ok(!/homeRedirect|syncViewSwitch|n-simple-topsw/.test(src));
});
