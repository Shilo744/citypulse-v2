// The route table of the product (SPEC 2.2). Every entry loads its view with a dynamic import, so a page nobody opens is never downloaded,
// and every entry has a fallback to the old page module, so each route works while the new views are still being built (modules of other packages are optional).
//
//   load(ctx, c) -> View       c = nav.classify(parts): { id, key, sub, arg }
//   View = Node | { node, band?, title?, active?, crumbs?, landing? }
//        band undefined: the default (the page's own .hero becomes the band, or a title zone is made); a Node: your own band (band.js); false: none
//
// The names the new modules export are fixed here (README.md of this folder): entryView, cityHome, briefView, view (static pages), adapt (old pages).
import * as net from "./net.js";
import { notFound, notMeasured } from "./kit/states.js";
import { categoryOfOldDomain } from "./city/groups.js";
import { shortName } from "./city/copy.js";

// a module that may not exist yet: the import is soft, a failure is a warning, never an error (the view it would have given is replaced by the fallback)
const soft = async (load) => { try { return await load(); } catch (e) { console.warn("[product] module not loaded, using the fallback:", e && e.message ? e.message : e); return null; } };

// ── which optional modules exist (the menu shows a link only for a module that is there); no request is made to find out ──
// feedback.js is preloaded by n.html, so its import() costs nothing and is the real check. brief.js is not preloaded: it counts as there until the import of the
// route fails (markMissing), which is the same fallback the route has anyway.
const found = new Map([["brief", true]]);
export const available = (id) => found.get(id) === true;
export const markMissing = (id) => { found.set(id, false); };
export function probeAll() {
  return import("./kit/feedback.js").then((m) => { found.set("feedback", !!m.openFeedback); }, () => { found.set("feedback", false); });
}

// ── the words of the generic title zone (an eyebrow, an h1 that says WHAT is shown, one line that says how to read it) ──
export const PAGES = {
  simple: ["במבט אחד", "המצב ביישוב בקצרה: מה דורש תשומת לב, מה הולך טוב ומה כדאי לעשות קודם."],
  brief: ["דוח ליישוב", "שני עמודים להדפסה: התשובות העיקריות, המקורות והתאריך."],
  trends: ["מגמות והיסטוריה", "איך כל מדד השתנה לאורך השנים, ומה השתפר ומה הידרדר."],
  compare: ["השוואה ליישובים", "היישוב מול יישובים אחרים, מדד אחרי מדד."],
  actions: ["תוכנית פעולה", "מה כדאי לעשות קודם, לפי גודל הפער והיכולת להשפיע."],
  ask: ["שאלו את הסוכן", "שאלה בניסוח חופשי. התשובה מבוססת על מספרי המערכת בלבד."],
  coverage: ["כיסוי נתונים", "על אילו מדדים יש נתונים רשמיים ועל אילו חסרים."],
  method: ["שיטה ומקורות", "מאיפה הנתונים, ואיך מחושב כל דבר."],
  glossary: ["מילון מונחים", "המילים שבהן משתמשים בעמודים, בפשטות."],
  accessibility: ["הצהרת נגישות", "מה נבדק, מה ידוע שאינו מושלם, ואיך פונים."],
  privacy: ["פרטיות", "מה נשמר במכשיר שלכם, ומה לא."]
};
const dom = (m, id) => m.domains.find((d) => d.id === id);
const ind = (m, id) => m.indicators.find((a) => a.id === id);
const asView = (v) => (v && typeof v === "object" && !(v instanceof Node) && "node" in v ? v : { node: v });

// an old page module's node, then the adapter of the new product (optional), which may return the node or a view
async function oldPage(ctx, adapterLoad, make, extra = {}) {
  const node = await make();
  const a = await soft(adapterLoad);
  let v = { node, ...extra };
  if (a && a.adapt) { const r = await a.adapt(node, ctx); if (r) v = { ...v, ...asView(r) }; }
  return v;
}

// the one page of a town (city/home.js); the alias route passes the short level. The page decides its own band and title; the menu marks it "home" for both routes.
async function townPage(ctx, opts) {
  const m = await import("./city/home.js");
  return { active: "home", ...asView(await m.cityHome(ctx, opts)) };
}

// ── the table ──
export const ROUTES = {
  entry: {
    landing: true,
    async load(ctx) {
      const m = await soft(() => import("./entry/entry.js"));
      if (m && m.entryView) return { ...asView(await m.entryView(ctx)), landing: true, band: false };
      const { homeView } = await import("../views-home.js");
      return { node: await homeView({ themeBtn: () => ctx.themeBtn() }), landing: true, band: false, active: "entry" };
    }
  },
  home: { load: (ctx) => townPage(ctx) },
  simple: { load: (ctx) => townPage(ctx, { level: "simple" }) },
  brief: {
    async load(ctx) {
      const m = await soft(() => import("./brief/brief.js"));
      if (m && m.briefView) return { active: "brief", title: PAGES.brief[0], ...asView(await m.briefView(ctx)) };
      markMissing("brief");
      return { redirect: `#/c/${encodeURIComponent(ctx.key)}` };           // no "soon" card: until the briefing exists the route sends you to the town page
    }
  },
  overview: { load: (ctx) => ({ redirect: `#/c/${encodeURIComponent(ctx.key)}${ctx.params && ctx.params.has("q") ? "?q=" + encodeURIComponent(ctx.params.get("q")) : ""}` }) },          // the old full picture is the town page now (a question link is kept)
  d: {
    async load(ctx, c) {
      const d = dom(ctx.model, c.arg);
      if (!d) {
        const to = categoryOfOldDomain(c.arg);                                  // an old link to one of the nine domains lands on the category that took it over
        if (to && to !== c.arg && dom(ctx.model, to)) return { redirect: `#/c/${encodeURIComponent(ctx.key)}/d/${to}` };
      }
      if (!d) return { node: notFound("domain", { model: ctx.model }), band: false, status: "notfound", title: "תחום לא נמצא" };
      return oldPage(ctx, () => import("./pages/domain.js"), async () => (await import("../pages/domain.js")).domainView(ctx.model, c.arg), { active: "d:" + c.arg, title: d.label });
    }
  },
  i: {
    async load(ctx, c) {
      const a = ind(ctx.model, c.arg);
      if (!a) {
        let known = null;
        try { const meta = await net.meta(); known = (meta.indicators || []).find((x) => x.id === c.arg) || null; } catch (e) { /* the catalogue could not be read: treat as unknown */ }
        return known ? { node: notMeasured(ctx.model, c.arg, known.domain), band: false, active: "d:" + known.domain, title: shortName(known), status: "notmeasured" }
          : { node: notFound("indicator", { model: ctx.model }), band: false, status: "notfound", title: "מדד לא נמצא" };
      }
      return oldPage(ctx, () => import("./pages/indicator.js"), async () => (await import("../pages/indicator.js")).indicatorView(ctx.model, c.arg), { active: "d:" + a.domain, title: shortName(a) });
    }
  },
  trends: { load: (ctx) => oldPage(ctx, () => import("./pages/trends.js"), async () => (await import("../pages/trends.js")).trendsView(ctx.model), { active: "trends", title: PAGES.trends[0] }) },
  compare: { load: (ctx) => oldPage(ctx, () => import("./pages/compare.js"), async () => (await import("../pages/compare.js")).compareView(ctx.model, ctx.params), { active: "compare", title: PAGES.compare[0] }) },
  actions: { load: (ctx) => oldPage(ctx, () => import("./pages/actions.js"), async () => (await import("../pages/actions.js")).actionsView(ctx.model), { active: "actions", title: PAGES.actions[0] }) },
  ask: { load: (ctx) => oldPage(ctx, () => import("./pages/ask.js"), async () => (await import("../pages/ask.js")).askView(ctx.model, ctx.params), { active: "ask", title: PAGES.ask[0] }) },
  coverage: { load: (ctx) => oldPage(ctx, () => import("./pages/coverage.js"), async () => (await import("../pages/coverage.js")).coverageView(ctx.model), { active: "coverage", title: PAGES.coverage[0] }) },
  method: { load: async (ctx) => oldPage({ ...ctx, meta: await soft(() => net.meta()) }, () => import("./pages/method.js"), async () => (await import("../pages/method.js")).methodView(ctx.model), { active: "method", title: PAGES.method[0] }) },
  gmethod: { load: async (ctx) => oldPage({ ...ctx, meta: await soft(() => net.meta()) }, () => import("./pages/method.js"), async () => (await import("../pages/method.js")).methodView(null), { active: "gmethod", title: PAGES.method[0] }) },
  glossary: { load: (ctx) => staticPage(ctx, "glossary", () => import("./pages/glossary.js")) },
  accessibility: { load: (ctx) => staticPage(ctx, "accessibility", () => import("./pages/accessibility.js")) },
  privacy: { load: (ctx) => staticPage(ctx, "privacy", () => import("./pages/privacy.js")) }
};

// the three small pages of the product have no old page to fall back on: until they exist the route shows the not-found card
async function staticPage(ctx, id, load) {
  const m = await soft(load);
  const fn = m && (m.view || m.default);
  if (!fn) return { node: notFound("route"), band: false, status: "notfound", active: id, title: "הדף לא נמצא" };
  return { active: id, title: PAGES[id][0], ...asView(await fn(ctx)) };
}
