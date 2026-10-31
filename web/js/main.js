// App shell and router. Hash routes: #/ (entry page), #/c/<key>, #/c/<key>/d/<domain>, /i/<id>, /trends, /compare?with=a,b, /actions, /ask?q=, /method
import { h, icon, ltr, iso, dateHe, DOMAIN_ICON, clear, logoMark } from "./ui.js";
import { getCity, health, getGeo } from "./api.js";
import { searchBox, skeleton, empty } from "./components.js";
import { overview } from "./pages/overview.js";
import { domainView } from "./pages/domain.js";
import { indicatorView } from "./pages/indicator.js";
import { trendsView } from "./pages/trends.js";
import { compareView } from "./pages/compare.js";
import { actionsView } from "./pages/actions.js";
import { askView } from "./pages/ask.js";
import { methodView } from "./pages/method.js";
import { coverageView } from "./pages/coverage.js";
import { homeView } from "./views-home.js";

const $ = (s) => document.querySelector(s);
const side = $("#side"), view = $("#view"), crumbs = $("#crumbs");
let hl = null;

const WORST = ["concern", "watch", "stale", "uncertain", "good", "strength"];
const DOT = { concern: "", watch: "watch", good: "good", strength: "good" };
// the API answers in English; a person reads Hebrew
const FRIENDLY = { "locality not found": ["לא מצאנו את היישוב הזה", "אולי הקישור ישן. אפשר לחפש יישוב בשמו."], "no data": ["אין נתונים על המדד הזה ביישוב הזה", "המדד לא נמדד ליישוב הזה. אפשר לחזור לתמונת המצב ולבחור מדד אחר."] };

// ── theme: light unless the person chose dark ───────────────────────────
const themeNow = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const themeLabel = () => (themeNow() === "dark" ? [icon("sun", 15), " מצב בהיר"] : [icon("moon", 15), " מצב כהה"]);
function toggleTheme() {
  const next = themeNow() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("cp2-theme", next); } catch (e) { /* private mode */ }
  document.querySelectorAll(".theme-btn").forEach((b) => b.replaceChildren(...themeLabel()));
}
const themeBtn = (cls = "") => { const b = h("button.theme-btn" + cls, { type: "button", onclick: toggleTheme, "aria-label": "החלפה בין מצב בהיר לכהה" }); b.replaceChildren(...themeLabel()); return b; };

function parse() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
  return { parts, params: new URLSearchParams(qs || "") };
}

// ── the navy side menu ──────────────────────────────────────────────────
function buildSide(model, active) {
  clear(side);
  side.append(h("a.brand", { href: "#/", "aria-label": "CityPulse, בריאות הציבור ברמת היישוב" }, logoMark("dark"), h("div", h("b", "CityPulse"), h("small", "בריאות הציבור ברמת היישוב"))));
  if (!model) {
    side.append(h("a.nav", { href: "#/", "aria-current": active === "home" ? "page" : null }, icon("search"), "בחירת יישוב"), h("a.nav", { href: "#/method", "aria-current": active === "method" ? "page" : null }, icon("book"), "שיטה ומקורות"));
  } else {
    const key = encodeURIComponent(model.city.key);
    const sw = h("a.cityswitch", { href: "#/", title: "החלפת יישוב" }, h("span.loc", icon("pin")), h("span.t", h("b", model.city.name), h("small", "החלפת יישוב")), icon("down"));
    side.append(sw);
    // the pin becomes a small map of the country with this locality lit (the chart module loads only when the menu is built for a locality)
    getGeo().then((geo) => import("./viz/spatial.js").then((m) => { if (Array.isArray(geo) && geo.length && sw.isConnected) { const loc = m.locator({ geo, cityKey: model.city.key, width: 26, ariaLabel: `מיקום ${model.city.name} על המפה` }); loc.dataset.seen = "1"; loc.classList.add("in"); sw.querySelector(".loc").replaceChildren(loc); } })).catch(() => { /* the pin stays */ });
    const link = (id, label, ic, sub) => h("a.nav", { href: `#/c/${key}${sub ? "/" + sub : ""}`, "aria-current": active === id ? "page" : null }, icon(ic), label);
    const withData = model.domains.filter((d) => d.indicators.length);
    side.append(link("overview", "תמונת מצב", "grid", ""));
    if (withData.length) side.append(h("div.navgroup", "תחומים"), h("div.dotkey", { "aria-hidden": "true" }, h("span", h("i"), "דורש טיפול"), h("span", h("i.watch"), "למעקב"), h("span", h("i.good"), "תקין")));
    withData.forEach((d) => {
      const worst = WORST.find((s) => model.indicators.some((a) => a.domain === d.id && a.status === s));
      side.append(h("a.nav", { href: `#/c/${key}/d/${d.id}`, "aria-current": active === "d:" + d.id ? "page" : null }, icon(DOMAIN_ICON[d.id] || "bars"), d.label,
        h("span.dot" + (DOT[worst] != null ? (DOT[worst] ? "." + DOT[worst] : "") : ".none"), { title: "המצב החמור ביותר בתחום" })));
    });
    side.append(h("div.navgroup", "כלי עבודה"), link("actions", "תוכנית פעולה", "list", "actions"), link("trends", "מגמות והיסטוריה", "trend", "trends"), link("compare", "השוואה ליישובים", "scale", "compare"), link("ask", "שאלו את הסוכן", "chat", "ask"),
      h("div.navgroup", "מידע"), link("coverage", "כיסוי נתונים", "search", "coverage"), link("method", "שיטה ומקורות", "book", "method"),
      h("div.navgroup", "בבחינה"), link("lab", "עיצובים לבחינה", "spark", "lab/map"));
  }
  side.append(h("div.sidefoot", hl ? [`נתונים עודכנו: ${dateHe(hl.builtAt)}`, h("br"), "מקורות: משרד הבריאות ועוד"] : "", h("div", themeBtn())));
}

function setTop(model, title) {
  clear(crumbs);
  crumbs.append(...(model ? [h("a", { href: `#/c/${encodeURIComponent(model.city.key)}` }, model.city.name), icon("left"), h("b", title)] : [h("b", title)]));
  document.title = (title ? title + " · " : "") + (model ? model.city.name + " · " : "") + "CityPulse";
}

const openDrawer = (v) => { side.classList.toggle("open", v); document.body.classList.toggle("drawer", v); $("#menu").setAttribute("aria-expanded", String(v)); };

// ── routing ─────────────────────────────────────────────────────────────
let token = 0;
async function render() {
  const my = ++token, { parts, params } = parse();
  openDrawer(false);
  const landing = parts[0] !== "c" && parts[0] !== "method";
  document.body.classList.toggle("landing", landing);
  if (!landing) view.replaceChildren(skeleton(3));
  try {
    if (!hl) hl = await health().catch(() => null);
    if (landing) {
      if (parts[0] === "lab") {                                    // the design lab: new directions next to the real pages (js/lab/index.js)
        const lab = await import("./lab/index.js"), v = await lab.labView(parts.slice(1), { themeBtn: () => themeBtn(".btn.sm.ghost") }); if (my !== token) return;
        document.title = "מעבדת עיצוב · CityPulse";
        return mount(v, true);
      }
      const v = await homeView({ themeBtn: () => themeBtn(".btn.sm.ghost") }); if (my !== token) return;
      document.title = "CityPulse · בריאות הציבור ברמת היישוב";
      return mount(v, true);
    }
    if (parts[0] === "method") { const v = await methodView(null); if (my !== token) return; buildSide(null, "method"); setTop(null, "שיטה ומקורות"); return mount(v); }
    const key = parts[1], sub = parts[2] || "";
    const model = await getCity(key);
    if (my !== token) return;
    let v, active = sub || "overview", title;
    if (!sub) { v = overview(model); title = "תמונת מצב"; }
    else if (sub === "d") { v = domainView(model, parts[3]); active = "d:" + parts[3]; title = (model.domains.find((d) => d.id === parts[3]) || {}).label || "תחום"; }
    else if (sub === "i") { v = await indicatorView(model, parts[3]); const a = model.indicators.find((x) => x.id === parts[3]); active = a ? "d:" + a.domain : "overview"; title = a ? (a.short || a.label) : "מדד"; }
    else if (sub === "trends") { v = trendsView(model); title = "מגמות והיסטוריה"; }
    else if (sub === "compare") { v = await compareView(model, params); title = "השוואה ליישובים"; }
    else if (sub === "actions") { v = actionsView(model); title = "תוכנית פעולה"; }
    else if (sub === "ask") { v = askView(model, params); title = "שאלו את הסוכן"; }
    else if (sub === "method") { v = await methodView(model); title = "שיטה ומקורות"; }
    else if (sub === "coverage") { v = await coverageView(model); title = "כיסוי נתונים"; }
    else if (sub === "lab") { const lab = await import("./lab/index.js"); v = await lab.labCityView(model, parts[3]); active = "lab"; title = "עיצוב לבחינה"; }
    else { location.hash = `#/c/${encodeURIComponent(key)}`; return; }
    if (my !== token) return;
    try { localStorage.setItem("cp2-last", JSON.stringify({ key: model.city.key, name: model.city.name })); } catch (e) { /* private mode */ }
    buildSide(model, active); setTop(model, title); mount(v);
  } catch (e) {
    if (my !== token) return;
    document.body.classList.remove("landing");
    buildSide(null, "home"); setTop(null, "שגיאה");
    const [title, text] = FRIENDLY[e.message] || ["לא הצלחנו לטעון את העמוד", e.message];
    mount(h("div.card.empty", icon("alert"), h("h3.h3", title), h("p", text), h("a.btn", { href: "#/", style: { marginTop: "14px" } }, icon("search"), "חזרה לבחירת יישוב")));
  }
}
function mount(node, landing) {
  view.replaceChildren(node); window.scrollTo(0, 0);
  view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");          // the page change: a short fade and rise (css/motion.css)
  if (!landing) view.focus({ preventScroll: true });
}

$(".sr").addEventListener("click", (e) => { e.preventDefault(); view.focus(); });          // the skip link must not change the route
$("#menu").replaceChildren(icon("menu"));
$("#menu").addEventListener("click", () => openDrawer(!side.classList.contains("open")));
$("#scrim").addEventListener("click", () => openDrawer(false));
$("#quick").append(searchBox({ placeholder: matchMedia("(pointer: coarse), (max-width: 860px)").matches ? "מעבר ליישוב אחר…" : "מעבר ליישוב אחר…  ( / )" }));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") openDrawer(false);
  else if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && !e.ctrlKey && !e.metaKey) { const i = $("#quick input") && !document.body.classList.contains("landing") ? $("#quick input") : document.querySelector(".land-search input"); if (i) { e.preventDefault(); i.focus(); } }
});
window.addEventListener("hashchange", render);
render();
