// Small helpers shared by the parts of the "report" direction (lab direction, css/lab/report.css, class prefix .lr-).
// Nothing here is a number of its own: every figure on the page comes from the city model.
import { h, icon, unitSuffix, directionNote, directionIcon } from "../../ui.js";

export const nm = (a) => a.short || a.label;
export const hrefI = (key, id) => `#/c/${key}/i/${id}`;
export const unitWord = (a) => (a.unit !== "%" && unitSuffix(a.unit) ? " " + unitSuffix(a.unit) : "");
export const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const pad2 = (i) => String(i + 1).padStart(2, "0");
export const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

export function jumpTo(root, id) {
  const el = root.querySelector("#" + id);
  if (el) el.scrollIntoView({ behavior: smooth(), block: "start" });
  return !!el;
}

// how many indicators are in each status; "judged" are the four that carry a verdict (the denominator of every "how many need work")
export const statusCounts = (model) => model.indicators.reduce((c, i) => ((c[i.status] = (c[i.status] || 0) + 1), c), {});
export const judgedOf = (all) => ["concern", "watch", "good", "strength"].reduce((n, k) => n + (all[k] || 0), 0);

export const seeAll = (href, text) => h("a.lr-more.no-print", { href }, text, icon("left"));

// one section: a small number (filled in by report.js, in the order the sections really appear), a hairline, the title as the one message, a lead line
export function section(id, title, lead, ...kids) {
  return h("section.lr-sec", { id, "aria-labelledby": id + "-t" },
    h("div.lr-sh",
      h("div.lr-sh-top.rv", h("span.lr-sh-no", { "aria-hidden": "true" }), h("i.lr-sh-rule", { "aria-hidden": "true" })),
      h("h2.lr-h2.rv", { id: id + "-t" }, title),
      lead ? h("p.lr-lead.rv", lead) : null),
    ...kids);
}

// the headline figures: important, reliable, not old, the most pressing first, at most two from one domain (the same rule as the real overview)
export function pickFigures(model, n = 4) {
  const pool = model.indicators.filter((a) => a.importance >= 3 && a.last && isNum(a.last.v) && a.last.reliable !== false && !a.stale)
    .sort((x, y) => y.priority - x.priority || y.importance - x.importance);
  const pick = [], per = {};
  for (const a of pool) if (pick.length < n && (per[a.domain] || 0) < 2) { pick.push(a); per[a.domain] = (per[a.domain] || 0) + 1; }
  for (const a of pool) if (pick.length < n && !pick.includes(a)) pick.push(a);
  return pick.sort((x, y) => pool.indexOf(x) - pool.indexOf(y));
}

// ONE line that says which way is good for a whole block of figures. All the same direction: one sentence. Mixed: the sentence for each direction, with the names under it.
export function directionLine(list, cls = "") {
  const seen = (list || []).filter((a) => a && a.last && a.last.reliable !== false);
  if (!seen.length) return null;
  const groups = new Map();
  for (const a of seen) { const k = a.direction || "none"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
  const real = (k) => (k === "none" ? null : k);
  if (groups.size === 1) {
    const d = real([...groups.keys()][0]);
    return h("p.lr-dir.rv" + (cls ? "." + cls : ""), icon(directionIcon(d)), h("span", seen.length > 1 ? "בכל המדדים כאן: " : null, directionNote(d) + "."));
  }
  return h("p.lr-dir.is-mixed.rv" + (cls ? "." + cls : ""), [...groups].map(([k, arr]) => h("span.lr-dir-g", icon(directionIcon(real(k))), h("span", directionNote(real(k)) + ": ", h("b", arr.map(nm).join(", "))))));
}

// things that must change while the page is printed (the trend chart is drawn again at the width of the paper); report.js calls these around the print
const printHooks = new Set();
export function onPrint(el, before, after) { printHooks.add({ el, before, after }); }
export function runPrint(phase) {
  for (const k of [...printHooks]) {
    if (!k.el.isConnected) { printHooks.delete(k); continue; }
    try { k[phase](); } catch (e) { /* the page still prints */ }
  }
}
