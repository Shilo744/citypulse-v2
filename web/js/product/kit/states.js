// The screens that are not an answer: not found, not measured, error, offline, loading, and the "new data" line (SPEC 6.6).
// Each is a plain node with its own h1, shown inside the shell with the town kept. The words are the table of SPEC 7.3.
import { h, icon } from "../../ui.js";
import { nodataSpot } from "../band.js";
import { townSearch } from "./townsearch.js";
import { MESSAGES, classify } from "../net.js";

// a model that came from a bad answer may have no city: the link is then left out
const hasCity = (model) => !!(model && model.city && model.city.key != null);
const homeLink = (model) => h("a.btn.sm", { href: `#/c/${encodeURIComponent(model.city.key)}` }, icon("grid"), `לדף של ${model.city.name}`);
const linkList = (items) => h("ul.n-state-list", items.map((it) => h("li", h("a", { href: it.href }, it.label))));

// kind: route | town | domain | indicator. opts: { model } (the town kept in the shell), { id } the unknown id
export function notFound(kind, opts = {}) {
  const { model } = opts;
  const T = {
    route: ["הדף לא נמצא", "אולי הקישור ישן או שהוקלד לא נכון. אפשר לחפש יישוב בשמו."],
    town: ["היישוב הזה לא נמצא", "אולי הקישור ישן. אפשר לחפש יישוב בשמו."],
    domain: ["אין תחום בשם הזה", hasCity(model) ? `אלה התחומים של ${model.city.name}:` : "אפשר לחפש יישוב ולבחור תחום."],
    indicator: ["אין מדד בשם הזה", hasCity(model) ? `אלה המדדים של ${model.city.name}:` : "אפשר לחפש יישוב ולבחור מדד."]
  }[kind] || ["הדף לא נמצא", ""];
  const rows = [];
  if (hasCity(model) && kind === "domain") rows.push(linkList(model.domains.filter((d) => d.indicators.length).map((d) => ({ href: `#/c/${encodeURIComponent(model.city.key)}/d/${d.id}`, label: d.label }))));
  if (hasCity(model) && kind === "indicator") rows.push(linkList(model.indicators.map((a) => ({ href: `#/c/${encodeURIComponent(model.city.key)}/i/${a.id}`, label: a.short || a.label }))));
  return h("section.n-state.n-state-nf", { "data-state": "notfound-" + kind },
    nodataSpot({ title: T[0], text: T[1], level: 1, actions: hasCity(model) ? homeLink(model) : null }),
    h("div.n-state-more", !hasCity(model) || kind === "route" || kind === "town" ? townSearch({ label: "חיפוש יישוב", placeholder: "חפשו יישוב…", big: true }) : null, rows));
}

// a valid indicator that this town has no figure for
export function notMeasured(model, indicatorId, domainId) {
  const sibs = model.indicators.filter((a) => a.domain === domainId && a.id !== indicatorId);
  return h("section.n-state.n-state-nf", { "data-state": "notmeasured" },
    nodataSpot({ title: `המדד הזה לא נמדד ב${model.city.name}`, text: "המקור הרשמי אינו מפרסם נתון על המדד הזה ליישוב. אפשר לראות מדדים אחרים בתחום.", level: 1, actions: homeLink(model) }),
    sibs.length ? h("div.n-state-more", linkList(sibs.map((a) => ({ href: `#/c/${encodeURIComponent(model.city.key)}/i/${a.id}`, label: a.short || a.label })))) : null);
}

// a failed load: the class of the error picks the words; "נסו שוב" runs retry()
export function errorState(err, { retry, model } = {}) {
  const kind = err && err.kind ? err.kind : classify(err, typeof navigator === "undefined" ? true : navigator.onLine);
  const [title, text] = MESSAGES[kind] || MESSAGES.unknown;
  return h("section.n-state.n-state-err", { "data-state": "error-" + kind, "data-title": title, role: "alert" },
    nodataSpot({ title, text, level: 1, actions: [
      retry ? h("button.btn.primary", { type: "button", onclick: retry }, icon("pulse"), "נסו שוב") : null,
      hasCity(model) ? homeLink(model) : h("a.btn.sm", { href: "#/" }, icon("search"), "חיפוש יישוב")] }));
}

// loading: shaped like the page that is coming, for a screen reader one word. aria-busy is what the test tools wait on.
export function skeleton(kind = "page") {
  const bar = (w, hh = 14) => h("div.sk", { style: { height: hh + "px", width: w } });
  return h("div.n-state-sk", { "aria-busy": "true", "data-skeleton": kind },
    h("span.sr", "טוען"),
    h("div.n-state-skband", bar("22%", 14), bar("46%", 40), bar("64%", 16)),
    h("div.n-state-skbody", bar("70%", 22), bar("100%", 120), bar("100%", 120)));
}

// loading has taken longer than usual: one quiet line inside the skeleton, with the way out (the router announces it once)
export const SLOW_TEXT = "הטעינה לוקחת יותר זמן מהרגיל";
export function slowLine(retry) {
  return h("p.n-state-slow", SLOW_TEXT + ". ", h("button.n-state-link", { type: "button", onclick: retry }, "נסו שוב"));
}

// the quiet line at the top of the page when new data arrived while the tab slept
export function staleLine() {
  return h("div.n-state-stale", { role: "status" }, "יש נתונים חדשים. ", h("button.n-state-link", { type: "button", onclick: () => location.reload() }, "רענון"));
}
