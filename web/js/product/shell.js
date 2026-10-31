// The frame around every page: the navy side menu (SPEC 4.2), the top bar (4.3), the footer (7.3), the drawer on phones and the theme button.
// It keeps the element ids of the old shell (#side, #top, #crumbs, #quick, #view, #scrim) because js/motion.js looks for them.
import { h, icon, clear, logoMark, dateHe, DOMAIN_ICON } from "../ui.js";
import { townSearch } from "./kit/townsearch.js";
import { catArt } from "./kit/catart.js";
import { starButton } from "./kit/star.js";
import { openHelp, installKeys } from "./kit/helpsheet.js";
import { OLD_HOME, FEATURES } from "./config.js";
import { oldDesignHref, infoHref } from "./nav.js";
import { available, probeAll } from "./routes.js";
import * as storage from "./storage.js";
import { KEYS } from "./config.js";

const $ = (s) => document.querySelector(s);
const side = $("#side"), crumbs = $("#crumbs"), foot = $("#foot");
const key = (m) => encodeURIComponent(m.city.key);

// ── theme ──
const themeNow = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const themeLabel = () => (themeNow() === "dark" ? [icon("sun", 15), " מצב בהיר"] : [icon("moon", 15), " מצב כהה"]);
function toggleTheme() {
  const next = themeNow() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  storage.set(KEYS.theme, next);
  document.querySelectorAll(".theme-btn").forEach((b) => b.replaceChildren(...themeLabel()));
}
export const themeBtn = (cls = "") => { const b = h("button.theme-btn" + cls, { type: "button", onclick: toggleTheme, "aria-label": "החלפה בין מצב בהיר לכהה" }); b.replaceChildren(...themeLabel()); return b; };

// ── the menu as a rail of icons (a wide window): the choice is kept on the device ──
const railOn = () => document.documentElement.dataset.side === "rail";
function paintRail(btn) {
  btn.setAttribute("aria-pressed", String(railOn()));
  btn.setAttribute("aria-label", railOn() ? "הרחבת התפריט" : "צמצום התפריט לאייקונים");
  btn.title = btn.getAttribute("aria-label");
  btn.replaceChildren(icon("menu", 20));
}
try { if (storage.get("cp2-side") === "rail") document.documentElement.dataset.side = "rail"; } catch (e) { /* storage is blocked: the menu stays open */ }
const railBtn = () => {
  const b = h("button.n-shell-rail.no-print", { type: "button", onclick: () => {
    if (railOn()) delete document.documentElement.dataset.side; else document.documentElement.dataset.side = "rail";
    storage.set("cp2-side", railOn() ? "rail" : "open"); document.querySelectorAll(".n-shell-rail").forEach(paintRail);
  } });
  paintRail(b); return b;
};

// ── drawer (phones) ──
export function openDrawer(v) {
  if (v === side.classList.contains("open")) return;
  side.classList.toggle("open", v); document.body.classList.toggle("drawer", v);
  const btn = $("#menu"); btn.setAttribute("aria-expanded", String(v));
  if (v) { const first = side.querySelector("a, button"); if (first) first.focus({ preventScroll: true }); }
  else if (side.contains(document.activeElement)) btn.focus({ preventScroll: true });
}

// ── categories: only the weakest one or two get the orange dot (SPEC 3.3); the background line of the town is not a category and never gets one ──
const JUDGED = ["concern", "watch", "good", "strength"];
export function weakestDomains(model, n = 2) {
  const rows = model.domains.filter((d) => d.indicators.length && !d.background).map((d) => {
    const own = model.indicators.filter((a) => a.domain === d.id), j = own.filter((a) => JUDGED.includes(a.status)).length, c = own.filter((a) => a.status === "concern").length;
    return { id: d.id, c, share: j ? c / j : 0 };
  }).filter((r) => r.c > 0).sort((a, b) => b.share - a.share || b.c - a.c);
  return new Set(rows.slice(0, n).map((r) => r.id));
}

// ── side menu ──
let hl = null;
export const setHealth = (x) => { hl = x; };

function citySwitch(model) {
  const panel = h("div.n-shell-switch", { hidden: true, id: "n-switch" },
    h("div.n-shell-switch-top", starButton(model.city, { showText: true })),
    townSearch({ inline: true, label: "יישוב אחר", placeholder: "חיפוש יישוב…", exclude: String(model.city.key) }),
    h("a.nav", { href: `#/c/${key(model)}/compare` }, icon("scale"), "השוואה בין יישובים"));
  const btn = h("button.cityswitch", { type: "button", "aria-expanded": "false", "aria-controls": "n-switch", onclick: () => {
    const open = panel.hidden; panel.hidden = !open; btn.setAttribute("aria-expanded", String(open));
    if (open) { const i = panel.querySelector("input"); if (i) i.focus({ preventScroll: true }); }
  } }, h("span.loc", icon("leaf")), h("span.t", h("b", model.city.name), h("small", "החלפת יישוב")), icon("down"));
  return [btn, panel];
}

let lastSide = null, lastFoot = null;
export function renderSide(model, active) {
  lastSide = [model, active];
  clear(side);
  side.append(h("div.n-shell-sidetop", h("a.brand", { href: "#/", "aria-label": "CityPulse, בריאות הציבור ברמת היישוב" }, logoMark("dark"), h("div", h("b", "CityPulse"), h("small", "בריאות הציבור ברמת היישוב"))), railBtn()));
  const nav = (id, label, ic, href) => h("a.nav", { href, "aria-current": active === id ? "page" : null }, icon(ic), label);
  if (!model) {
    side.append(nav("entry", "בחירת יישוב", "search", "#/"), h("div.navgroup", "מידע"), nav("gmethod", "שיטה ומקורות", "book", infoHref("method")), nav("glossary", "מילון מונחים", "info", infoHref("glossary")));
  } else {
    const base = `#/c/${key(model)}`, sub = (s) => `${base}/${s}`;
    side.append(...citySwitch(model));
    side.append(nav("home", "דף היישוב", "home", base));          // the town page, both of its levels; the report is the print button of that page
    const withData = model.domains.filter((d) => d.indicators.length && !d.background);
    if (withData.length) {
      const weak = weakestDomains(model);
      side.append(h("div.navgroup", "תחומים"), h("div.dotkey", { "aria-hidden": "true" }, h("span", h("i"), "הכי הרבה לטיפול"), h("span", h("i.none"), "שאר התחומים")));
      withData.forEach((d) => side.append(h("a.nav", { href: `${base}/d/${d.id}`, "aria-current": active === "d:" + d.id ? "page" : null }, catArt(d.id, 26, "n-shell-cat") || icon(DOMAIN_ICON[d.id] || "bars"), d.label,
        h("span.dot" + (weak.has(d.id) ? "" : ".none"), weak.has(d.id) ? { title: "מהתחומים עם הכי הרבה מדדים שדורשים טיפול" } : null))));
    }
    side.append(h("div.navgroup", "כלי עבודה"), nav("actions", "תוכנית פעולה", "list", sub("actions")), nav("trends", "מגמות והיסטוריה", "trend", sub("trends")), nav("compare", "השוואה ליישובים", "scale", sub("compare")), nav("ask", "שאלו את הסוכן", "chat", sub("ask")),
      h("div.navgroup", "מידע"), nav("coverage", "כיסוי נתונים", "search", sub("coverage")), nav("method", "שיטה ומקורות", "book", sub("method")), nav("glossary", "מילון מונחים", "info", sub("glossary")));          // the pages of information open inside the town: the town menu stays and the way back is the town
  }
  side.append(h("div.sidefoot", hl ? [`נתונים עודכנו: ${dateHe(hl.builtAt)}`, h("br"), "מקורות: משרד הבריאות ועוד"] : ""));
  side.querySelectorAll("a.nav").forEach((a) => { if (!a.title) a.title = a.textContent.trim(); });          // in the rail the words are gone: the name is the tooltip
}

// ── top bar ──
// items: [{ label, href? }]; the last one is the page you are on
export function setCrumbs(items) {
  clear(crumbs);
  (items || []).forEach((it, i, all) => {
    if (i) crumbs.append(icon("left"));
    crumbs.append(i === all.length - 1 || !it.href ? h("b", it.label) : h("a", { href: it.href }, it.label));
  });
  // the crumbs sit outside the view that neutral.js watches: they say the same words as the page (a figure's name has no Latin code); the module is loaded after the first paint, not before it
  import("./neutral.js").then((m) => crumbs.querySelectorAll("a, b").forEach((el) => { const t = m.neutral(el.textContent); if (t !== el.textContent) el.textContent = t; }), () => {});
}

// ── footer ──
const emit = (name) => window.dispatchEvent(new CustomEvent(name));
async function openFeedback(info, opener) {
  try { const m = await import("./kit/feedback.js"); if (m.openFeedback) m.openFeedback(info, opener); } catch (e) { /* the module is not there */ }
}
let fbOk = false;
export function renderFooter(model, route) {
  lastFoot = [model, route];
  const link = (href, label) => h("li", h("a", { href }, label));
  const btn = (label, fn, cls = "") => h("li" + cls, h("button.n-shell-link", { type: "button", onclick: fn }, label));
  const town = model ? model.city.key : null;          // with a town the four pages of information are the ones of the town, without one the top-level pages
  const items = [
    link(infoHref("method", town), "שיטה ומקורות"), link(infoHref("glossary", town), "מילון מונחים"),
    model ? link(`#/c/${key(model)}/coverage`, "כיסוי נתונים") : null,
    link(infoHref("accessibility", town), "הצהרת נגישות"), link(infoHref("privacy", town), "פרטיות"),
    route === "home" || route === "simple" ? btn("איך קוראים", () => emit("n-howto")) : null,
    fbOk ? btn("דווחו על טעות", (e) => openFeedback({ key: model ? model.city.key : "", name: model ? model.city.name : "", route: location.hash, url: location.href, dataDate: hl && hl.builtAt ? dateHe(hl.builtAt) : "" }, e.currentTarget), ".n-shell-foot-rep") : null,
    btn("קיצורי מקלדת (?)", openHelp),
    FEATURES.footerOldLink ? h("li", h("a.n-shell-old", { href: oldDesignHref(OLD_HOME) }, "חזרה לעיצוב הקודם")) : null
  ];
  foot.replaceChildren(h("div.n-shell-foot-in",
    h("p.n-shell-foot-statement", "התמונה כאן מכוונת לשאלות ולתעדוף, לא לציון או לדירוג של היישוב."),
    h("p.n-shell-foot-src.n-shell-foot-prov", "מקורות: משרד הבריאות ועוד." + (hl && hl.builtAt ? ` נתונים עודכנו: ${dateHe(hl.builtAt)}.` : "")),
    h("nav", { "aria-label": "קישורים" }, h("ul.n-shell-links", items)),
    storage.available() ? null : h("p.n-shell-foot-src", "הדפדפן חוסם שמירת מידע, ולכן המעקב והיישובים האחרונים יישמרו רק עד סגירת הדף.")));
}

// ── start ──
export function mountShell() {
  $("#menu").replaceChildren(icon("menu"));
  $("#menu").addEventListener("click", () => openDrawer(!side.classList.contains("open")));
  $("#scrim").addEventListener("click", () => openDrawer(false));
  $("#quick").append(townSearch({ quiet: true, label: "יישוב אחר", placeholder: matchMedia("(pointer: coarse), (max-width: 860px)").matches ? "יישוב אחר…" : "יישוב אחר  ( / )" }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") openDrawer(false); });
  installKeys();
  // paper is white: a page printed in the dark theme takes the light one for the time of printing (the briefing does this itself)
  let wasDark = false;
  window.addEventListener("beforeprint", () => { if (document.body.dataset.route === "brief" || themeNow() !== "dark") return; wasDark = true; document.documentElement.dataset.theme = "light"; });
  window.addEventListener("afterprint", () => { if (wasDark) { wasDark = false; document.documentElement.dataset.theme = "dark"; } });
  const top = $("#top");
  const onScroll = () => top.classList.toggle("n-shell-scrolled", window.scrollY > 4);
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  // a control of the sticky bar lies inside the scroll-padding, so focusing it (Tab, the "/" key, typing) makes Chrome scroll the page back up by hundreds of pixels: the page stays where it was before the key
  let keyY = window.scrollY;
  document.addEventListener("keydown", () => { keyY = window.scrollY; }, true);
  const keep = () => { const y = keyY; requestAnimationFrame(() => { if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y); }); };
  top.addEventListener("focusin", keep); top.addEventListener("input", keep);          // typing in the search reveals the caret the same way
  window.addEventListener("hashchange", () => { const a = foot.querySelector(".n-shell-old"); if (a) a.setAttribute("href", oldDesignHref(OLD_HOME)); });
  // modules that other packages build are probed once; the menu and the footer show their links only when the file exists
  probeAll().then(() => { fbOk = available("feedback"); if (lastSide) renderSide(...lastSide); if (lastFoot) renderFooter(...lastFoot); }).catch(() => {});
}
