// Coverage in the product: a title zone with the four numerals (three of them filter the list below, a numeral of 0 has nothing to show and stays plain text), a button for the file, and the old module's list untouched.
// The file is built from the rows on the page, so it holds exactly what the person sees. Styles: css/product/pages/coverage.css (n-pg-coverage-).
import { h, icon } from "../../ui.js";
import { titleBand } from "../band.js";
import { csvButton } from "../kit/csv.js";
import { cnt } from "../kit/plural.js";
import * as G from "../kit/guide.js";
import { infoHref } from "../nav.js";

const FILTERS = [["found", ["k-found", "k-stale"]], ["small", ["k-small"]], ["missing", ["k-missing"]]];

// one row of the file per row of the page: domain, indicator, state, value (a number), unit, year, note, source; the number, the unit and the year come from the model (the page shows them as one text)
export function coverageRows(root, model) {
  const rows = [], byId = new Map(((model && model.indicators) || []).map((a) => [a.id, a]));
  root.querySelectorAll(".cv-sec").forEach((sec) => {
    const dom = sec.querySelector(".cv-domain"), dname = [...(dom ? dom.childNodes : [])].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join("").trim();
    sec.querySelectorAll(".cv-row").forEach((li) => {
      const txt = (sel) => { const e = li.querySelector(sel); return e ? e.textContent.trim() : ""; };
      const a = li.querySelector(".cv-name a"), src = li.querySelector(".cv-src a");
      const m = a && /\/i\/([^/?#]+)$/.exec(a.getAttribute("href") || ""), ind = m ? byId.get(decodeURIComponent(m[1])) : null, last = ind && ind.last && Number.isFinite(ind.last.v) ? ind.last : null;
      rows.push({ domain: dname, indicator: a ? a.textContent.trim() : "", state: txt(".cv-state"), value: last ? last.v : "", unit: last ? ind.unit : "", year: last ? last.year : "", note: txt(".cv-name small"), source: txt(".cv-src"), link: src ? src.getAttribute("href") : "" });
    });
  });
  return rows;
}
export const COLUMNS = [{ key: "domain", title: "תחום" }, { key: "indicator", title: "מדד" }, { key: "state", title: "מצב" }, { key: "value", title: "ערך" }, { key: "unit", title: "יחידה" }, { key: "year", title: "שנה" }, { key: "note", title: "הערה" }, { key: "source", title: "מקור" }, { key: "link", title: "קישור למקור" }];

// ── the official targets of the town's figures, in one plain paragraph at the end of the page; the detail (who published, which figures) is on the method page ──
const forN = (n) => (n === 1 ? "למדד אחד" : `ל-${n} מדדים`);
export function guidesBlock(model) {
  const list = ((model && model.indicators) || []).filter((a) => a && a.last), k = { target: 0, orient: 0, bench: 0, none: 0 };
  list.forEach((a) => { const kind = G.kindOf(a); k[kind === "bench" ? "none" : kind]++; if (kind === "bench") k.bench++; });
  if (!list.length) return null;
  const parts = [k.target ? `${forN(k.target)} יש יעד רשמי שקובע את המצב` : null, k.orient ? `${forN(k.orient)} יש יעד להתמצאות, שאינו משנה את המצב` : null].filter(Boolean);
  const none = k.none ? `${k.target || k.orient ? "ולאחרים" : forN(k.none)} אין יעד רשמי${k.bench ? ` (${k.bench === 1 ? "לאחד מהם" : `ל-${k.bench} מהם`} יש נקודת ייחוס בין-לאומית)` : ""}` : null;
  const sentence = `מתוך ${cnt(list.length, "המדד אחד שיש", "המדדים שיש")} עליהם נתונים ב${model.city.name}, ${[...parts, none].filter(Boolean).join(", ")}.`;
  return h("section.n-pg-coverage-guides", { "aria-labelledby": "n-pg-coverage-guides-h" }, h("h2.n-pg-coverage-guides-h", { id: "n-pg-coverage-guides-h" }, "יעדים רשמיים"), h("p", sentence, " ", h("a.n-kit-link", { href: infoHref("method", model.city.key, "mt-guides") }, "מי פרסם אותם ואיך הם נבדקים ←")));
}

export function adapt(node, ctx) {
  const root = node, head = root.querySelector(".cv-head"), figs = root.querySelector(".cv-figs");
  if (!head || !figs) return node;
  G.respellTree(root);          // the names of the data sets come from the catalogue, which still writes "התכנית" in one of them
  const model = ctx.model, key = model.city.key;
  const title = head.querySelector("h1"), lead = head.querySelector(".sec-lead");
  const status = h("p.n-pg-coverage-status", { role: "status" });
  const reset = h("button.n-pg-coverage-reset", { type: "button", hidden: true }, "הצגת כל המדדים");
  const buttons = [];

  // the first three numerals become buttons that show only the rows of that kind (pressed again: all rows)
  const items = [...figs.children];
  FILTERS.forEach(([id, classes], i) => {
    const fig = items[i];
    if (!fig || !root.querySelector(classes.map((c) => ".cv-row." + c).join(", "))) return;          // nothing of this kind on the page: no button
    const btn = h("button.keyfig.n-pg-coverage-fig", { type: "button", "aria-pressed": "false", "data-filter": id, onclick: () => apply(btn.getAttribute("aria-pressed") === "true" ? null : id) }, ...fig.childNodes);
    btn.title = "הצגת רק המדדים האלה";          // the name of the button is its own text: the number and what it counts
    fig.replaceWith(btn);
    buttons.push([btn]);
  });
  const all = [...root.querySelectorAll(".cv-row")];
  function apply(id) {
    const classes = (FILTERS.find((f) => f[0] === id) || [])[1];
    all.forEach((li) => li.classList.toggle("n-pg-coverage-off", !!classes && !classes.some((c) => li.classList.contains(c))));
    root.querySelectorAll(".cv-sec").forEach((sec) => sec.classList.toggle("n-pg-coverage-off", !!classes && ![...sec.querySelectorAll(".cv-row")].some((li) => !li.classList.contains("n-pg-coverage-off"))));
    buttons.forEach(([b]) => b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === id)));
    const shown = all.filter((li) => !li.classList.contains("n-pg-coverage-off")).length;
    reset.hidden = !classes;
    status.textContent = classes ? `${shown === 1 ? "מוצג" : "מוצגים"} ${cnt(shown, "מדד אחד", "מדדים")} מתוך ${all.length}` : "";
    if (classes) ctx.announce(status.textContent);
  }
  reset.addEventListener("click", () => apply(null));

  const csv = csvButton(() => ({ rows: coverageRows(root, model), columns: COLUMNS }), "coverage", { key, label: "הורדת רשימת הכיסוי" });
  csv.setAttribute("aria-label", "הורדת רשימת הכיסוי (קובץ CSV)");
  const band = titleBand({ eyebrow: "בדיקת כיסוי", title: title ? title.textContent : "כיסוי נתונים", lede: lead ? lead.textContent.replace(/^בדקנו /, "נבדקו ") : null,          // the neutral voice: the old sentence says "we checked"
    actions: csv, id: "n-h1" });
  band.classList.add("n-pg-coverage-band");
  band.querySelector(".n-band-in").prepend(h("a.n-band-back.n-pg-coverage-back.no-print", { href: `#/c/${encodeURIComponent(key)}` }, icon("right", 16), "דף היישוב"));
  band.querySelector(".n-band-in").append(figs, h("div.n-pg-coverage-filter", status, reset));
  head.remove();
  const guides = guidesBlock(model);
  if (guides) node.append(guides);
  return { node, band };
}
