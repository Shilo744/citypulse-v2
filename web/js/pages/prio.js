// One row of "what needs attention first", and the list of findings. Re-exported by components.js.
// Both are rows, not cards: a hairline between them, a tinted numeral or icon at the start, a small chart at the end (css/pages/overview.css, prefix .ov-).
import { h, icon, toneOf, fmtVal, unitSuffix, ltr } from "../ui.js";
import { sparkArea } from "../viz/time.js";

// does the action plan have anything for this figure? (null = the page has no plan to compare with)
const flagPill = (yes) => h("span.pill.ov-flag." + (yes ? "tone-good" : "tone-none"), icon(yes ? "list" : "minus"), yes ? "יש המלצה בתוכנית הפעולה" : "אין עדיין המלצה בתוכנית");

export function prioRow(a, i, key, why, recFlag) {
  const L = a.last, name = a.short && a.short !== a.label ? a.short : a.label, suffix = a.unit !== "%" ? unitSuffix(a.unit) : "";
  const spark = a.series.length > 1 ? sparkArea(a.series.map((s) => ({ v: s.v, year: s.year })), a.series.map((s) => s.nat), { w: 92, h: 30, unit: a.unit, label: name }) : null;
  return h("a.row-item.ov-prio." + toneOf(a.status), { href: `#/c/${key}/i/${a.id}` },
    h("span.ov-rank", { "aria-hidden": "true" }, String(i + 1)),
    h("div.ov-prio-main", h("div.ri-title", name), why ? h("div.ri-sub", why) : null, recFlag == null ? null : flagPill(recFlag)),
    h("div.ri-val.ov-prio-val", h("div.ov-prio-fig", h("b", ltr(fmtVal(a.unit, L.v))), suffix ? h("small", suffix) : null), spark),
    h("span.ov-go", { "aria-hidden": "true" }, icon("left")));
}

const FIND_ICON = { concern: "alert", strength: "check", info: "info" };
export function findingList(items, key) {
  return h("ul.ov-finds", items.map((f) => h("li.ov-find." + (FIND_ICON[f.polarity] ? f.polarity : "info"),
    h("span.ov-find-ic", { "aria-hidden": "true" }, icon(FIND_ICON[f.polarity] || "info")),
    h("span.ov-find-tx", f.text, f.indicator && key ? [" ", h("a", { href: `#/c/${key}/i/${f.indicator}` }, "לפרטים")] : null))));
}
