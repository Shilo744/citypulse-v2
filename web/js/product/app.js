// The router of the product (mode N). It owns the hash, the shell, the page change, scroll and focus, titles, the live region, the error and
// not-found states and the list of recent towns. It never touches the page modules: those are imported per route (routes.js).
//
// ctx, the object every view and adapter receives. It is frozen; the keys never change, wave 2 builds on exactly these:
//   key        town key from the hash ("1031"), or null on town-less routes
//   model      the town model (getCity) already loaded, or null
//   sub        the third hash part: "", "d", "i", "trends", ...
//   parts      the decoded hash parts, params the URLSearchParams of its query
//   go(hash, { replace })   navigate; replace:true adds no history entry (use it for every redirect)
//   announce(text)          say something through the live region
//   setTitle(text)          document.title = "<text> · <town> · CityPulse"
//   setCrumbs(items)        [{ label, href? }], the last item is the page you are on
//   recents, fav            the local lists (storage.js): list(), add({key,name}), has(key), toggle(...)
//   mode "n", themeBtn()    a theme toggle button, signal an AbortSignal that fires when the route changes
import { h } from "../ui.js";
import * as nav from "./nav.js";
import * as net from "./net.js";
import * as seo from "./seo.js";
import * as storage from "./storage.js";
import * as live from "./live.js";
import * as shell from "./shell.js";
import { ROUTES, PAGES } from "./routes.js";
import { autoBand } from "./band.js";
import { notFound, errorState, skeleton, slowLine, staleLine, SLOW_TEXT } from "./kit/states.js";
import { NET } from "./config.js";

const $ = (s) => document.querySelector(s);
const view = $("#view");

let tips = null, tipCtx = null;                                              // kit/tips.js, loaded after the first paint: the cards that show on a mark (hover, focus, touch) say more than the page does
let token = 0, controller = null, hl = null, firstPaint = true, saving = true, watching = false, slowTimer = 0;
const HEALTH_GRACE = 1500;                                       // the page does not wait longer than this for the health answer once the rest is there
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── scroll memory (SPEC 4.5): the browser must not guess; the position lives in history.state ──
let saveTimer = 0;
function rememberScroll() {
  if (!saving) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { if (saving) try { history.replaceState({ ...(history.state || {}), y: Math.round(window.scrollY) }, ""); } catch (e) { /* sandboxed frame */ } }, 120);
}
// Back and Forward: a page that was never scrolled has no saved position, but it still gets its focus back (the Navigation API says it was a traversal)
let traversed = false;
try { if (window.navigation) window.navigation.addEventListener("navigate", (e) => { traversed = e.navigationType === "traverse"; }); } catch (e) { /* old browser */ }
const savedY = () => { const s = history.state; return s && typeof s.y === "number" ? s.y : null; };
const jump = (y) => window.scrollTo({ top: y, left: 0, behavior: "instant" });

const norm = (v) => (v && typeof v === "object" && !(v instanceof Node) && ("node" in v || "redirect" in v) ? v : { node: v });

// the share links need to know whether the server has /s/<key> pages (kit/share.js, a module of another package: optional)
function shareFlag(health) {
  import("./kit/share.js").then((m) => m.setShareFeature && m.setShareFeature(!!(health && health.features && health.features.share)), () => {});
}

// the health answer (build date, features, the watch for new data); it may come after the page, then the footer is drawn again
function adoptHealth(h0) {
  if (!h0 || hl) return false;
  hl = h0; shell.setHealth(hl); shareFlag(hl);
  if (!watching) { watching = true; live.watchFresh(hl.builtAt, () => view.prepend(staleLine())); }
  return true;
}

// after NET.slowAfterMs on the same skeleton: one quiet line with the way out, said once through the live region
function armSlowLine(my) {
  clearTimeout(slowTimer);
  slowTimer = setTimeout(() => {
    const sk = my === token ? view.querySelector("[data-skeleton]") : null;
    if (!sk || sk.querySelector(".n-state-slow")) return;
    sk.insertBefore(slowLine(() => render()), sk.querySelector(".n-state-skbody"));
    live.announce(SLOW_TEXT);
  }, NET.slowAfterMs);
}

function defaultCrumbs(c, model, title) {
  if (c.id === "entry") return [];
  if (!model) return [{ label: title }];
  const town = { label: model.city.name, href: `#/c/${encodeURIComponent(model.city.key)}` };
  if (c.id === "home" || c.id === "simple") return [town];                    // the alias shows the same page
  if (c.id === "i") { const a = model.indicators.find((x) => x.id === c.arg), d = a && model.domains.find((x) => x.id === a.domain); return d ? [town, { label: d.label, href: `${town.href}/d/${d.id}` }, { label: title }] : [town, { label: title }]; }
  return [town, { label: title }];
}

function makeCtx(c, model, parts, params, my, custom) {
  return Object.freeze({
    key: c.key != null ? String(c.key) : null, model, sub: parts[2] || "", parts, params,
    go: nav.go,
    announce: (text, opts) => live.announce(text, opts),
    setTitle: (text) => { custom.title = true; seo.apply({ page: text, town: model && model.city.name }); },
    setCrumbs: (items) => { custom.crumbs = true; shell.setCrumbs(items); },
    recents: storage.recents, fav: storage.fav,
    mode: "n", themeBtn: () => shell.themeBtn(".btn.sm.ghost"),
    signal: controller.signal
  });
}

// the band slot and the body: a page that does not bring its own band gets the default (its own .hero, or a title zone)
function compose(v, c, model, title) {
  let { node, band } = v;
  if (band === undefined && node) {
    const meta = PAGES[c.id] || [], key = model && encodeURIComponent(model.city.key);
    const r = autoBand(node, { title: title || meta[0] || "", lede: meta[1], back: model && c.id !== "home" && c.id !== "simple" ? { href: `#/c/${key}`, label: "דף היישוב" } : null, eyebrow: model ? null : "מידע" });
    band = r.band; node = r.node;
  }
  return [band || null, v.landing ? node : node ? h("div.n-shell-body", node) : null].filter(Boolean);
}

function focusStart(c, back) {
  if (firstPaint) return;                                              // the first load keeps the browser's own focus (skip links stay first in the tab order)
  const t = view.querySelector("h1");
  if (t && !t.hasAttribute("tabindex")) t.setAttribute("tabindex", "-1");
  (t || view).focus({ preventScroll: true });
}

async function render() {
  const my = ++token;
  if (controller) controller.abort();
  controller = new AbortController();
  const wasBack = savedY() != null || traversed, y = savedY(), prevH = view.offsetHeight;
  traversed = false;
  saving = false;
  const { parts, params, fragment } = nav.parse(location.hash), c = nav.classify(parts);
  shell.openDrawer(false);

  // redirects add no history entry: that is what keeps the Back button free
  if (c.id === "lab") { saving = true; location.replace(c.target); return; }
  if (c.id === "badsub") { saving = true; nav.go(nav.build({ key: c.key }), { replace: true }); return; }
  if (c.id === "home" && params.get("q") === "simple") { saving = true; nav.go(nav.build({ key: c.key, sub: "simple" }), { replace: true }); return; }          // an old link that names the short page as a question lands on the alias, which shows the short level
  if (c.id === "home" && params.has("q") && nav.normalizeQuestion(params.get("q")) !== params.get("q")) { saving = true; const p = new URLSearchParams(params); p.set("q", "weak"); nav.go(nav.build({ key: c.key, params: p }), { replace: true }); return; }

  const def = ROUTES[c.id];
  const custom = { title: false, crumbs: false };
  document.body.classList.toggle("landing", !!(def && def.landing));
  document.body.dataset.route = c.id === "simple" ? "home" : c.id;          // the alias is the town page: one frame for both (css keys on "home"); data-alias says which door was used
  if (c.id === "simple") document.body.dataset.alias = "simple"; else delete document.body.dataset.alias;
  if (wasBack) view.style.minHeight = prevH + "px";                    // the page keeps its height while it loads, so the saved position is not clamped
  view.replaceChildren(skeleton(c.id));
  armSlowLine(my);
  seo.apply({ page: "טוען" });                                           // the tab does not keep the title of the town that was left
  let model = null, ctx = null;
  try {
    if (!def) { mountState(notFound("route"), c, null); return done(c, wasBack, y, my); }
    const healthP = hl ? Promise.resolve(hl) : net.health({ signal: controller.signal }).catch(() => null);
    const m = c.key != null ? await net.city(c.key, { signal: controller.signal }) : null;
    if (my !== token) return;
    if (m != null && !net.isModel(m)) throw new net.NetError("badanswer");          // a 200 of the wrong shape is an error with a retry button, never a skeleton
    adoptHealth(await Promise.race([healthP, wait(HEALTH_GRACE)]));
    if (!hl) healthP.then((x) => { if (adoptHealth(x) && my === token) shell.renderFooter(model, c.id); });
    if (my !== token) return;
    model = m;
    ctx = makeCtx(c, model, parts, params, my, custom);
    tipCtx = ctx; if (tips) tips.setContext(ctx);
    const v = norm(await def.load(ctx, c));
    if (my !== token) return;
    if (v.redirect) { saving = true; nav.go(v.redirect, { replace: true }); return; }
    const title = v.title || (PAGES[c.id] && PAGES[c.id][0]) || "";
    view.replaceChildren(...compose(v, c, model, title));
    document.body.classList.toggle("landing", !!v.landing);
    view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");          // the page change: a short fade and rise (css/motion.css)
    shell.renderSide(c.id === "entry" ? null : model, v.active || c.id);
    shell.renderFooter(model, c.id);
    if (!custom.crumbs) shell.setCrumbs(v.crumbs || defaultCrumbs(c, model, title));
    if (!custom.title) seo.apply(c.id === "entry" ? {} : { page: title, town: model && model.city.name });
    if (model) { storage.recents.add({ key: model.city.key, name: model.city.name }); storage.rememberLast({ key: model.city.key, name: model.city.name }); }
    live.announce(c.id === "entry" ? "דף הבית" : [title, model && model.city.name].filter(Boolean).join(", "), { delay: 50 });
    done(c, wasBack, y, my, fragment);
  } catch (e) {
    if (my !== token) return;
    const kind = (e && e.kind) || net.classify(e, navigator.onLine);
    if (kind === "unknown") console.error("[product] route failed:", c.id, e);               // a real defect must show in the smoke run
    document.body.classList.remove("landing");
    if (kind === "notfound" && c.key != null && !model) mountState(notFound("town"), c, null, "היישוב לא נמצא");
    else { const st = errorState(e, { retry: () => render(), model }); mountState(st, c, model, st.getAttribute("data-title")); }          // the tab title says what happened (offline, slow, server), not "not found"
    done(c, wasBack, y, my);
  }
}

// a state replaces the whole view; the shell stays and keeps the town when there is one
function mountState(node, c, model, title) {
  view.replaceChildren(h("div.n-shell-body", node));
  view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");
  shell.renderSide(model, "x"); shell.renderFooter(model, c.id);
  shell.setCrumbs([{ label: "CityPulse", href: "#/" }]);
  seo.apply({ page: title || (model ? "שגיאה" : "הדף לא נמצא"), town: model && model.city.name });
}

// scroll and focus after a view is in place
function done(c, back, y, my, fragment) {
  if (my !== token) return;
  view.style.minHeight = "";
  if (back && y != null) { jump(y); setTimeout(() => { if (my === token && Math.abs(window.scrollY - y) > 2) jump(y); }, 350); } else jump(0);   // the second try covers charts that grow the page after they draw
  focusStart(c, back);
  const target = fragment && document.getElementById(fragment);
  if (target) target.scrollIntoView({ block: "start" });          // a link to a term of the glossary
  firstPaint = false;
  setTimeout(() => { if (my === token) saving = true; }, 400);
}

export function start() {
  import("./reveal.js").then((m) => m.installReveal()).catch(() => {});          // blocks, charts and counts start one screen before they are seen
  net.installGuard();                                                     // the old page modules get the same time limit and the same honest errors (net.js)
  window.__cpAnnounce = (text) => live.announce(text);                    // the kit (kit/base.js) speaks through the shell's live region when it is there
  try { history.scrollRestoration = "manual"; } catch (e) { /* old browser */ }
  shell.mountShell();
  import("./neutral.js").then((m) => m.watchNeutral(view), () => {});          // the old page modules still say "we" in a few sentences: the product says them in the neutral voice (neutral.js)
  import("./chartfit.js").then((m) => m.watchChartText(view), () => {});          // after the first paint, so it is not on the path of the first screen
  import("./kit/tips.js").then((m) => { tips = m; m.installTips(); if (tipCtx) m.setContext(tipCtx); }, () => {});          // the same: not on the path of the first screen; every route hands it the context (setContext)
  $(".sr").addEventListener("click", (e) => { e.preventDefault(); view.focus(); });          // the skip link must not change the route
  window.addEventListener("scroll", rememberScroll, { passive: true });
  window.addEventListener("hashchange", render);
  window.addEventListener("n-route", render);
  return render();
}
