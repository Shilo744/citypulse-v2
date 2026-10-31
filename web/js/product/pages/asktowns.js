// The comparison of named towns inside an answer of the ask page (block type "towns", built by the server in src/agent/towns.js from the data).
// The old ask module ignores a block type it does not know, so the product draws this one: a tally (who is first in how many figures), then one row per figure
// with the value of every town, the best value marked in words, and the way to the full compare page. Styles: css/product/pages/ask.css (n-pg-ask-).
import { h, fmtVal, unitSuffix, ltr, directionNote } from "../../ui.js";

const FIRST_ROWS = 8;

function cell(t, v, row) {
  if (!v || v.v == null) return h("td.n-pg-ask-tv", "אין נתון");
  const mark = row.best === t.key ? h("small.n-pg-ask-best", "הטוב ביותר") : v.reliable === false ? h("small", "קבוצה קטנה, לא מדורג") : null;
  return h("td.n-pg-ask-tv", h("b", ltr(fmtVal(row.ind.unit, v.v))), v.year && !row.sameYear ? h("small", String(v.year)) : null, mark);
}

export function townsBlock(b) {
  const towns = b.towns || [], rows = b.rows || [], by = new Map(towns.map((t) => [t.key, t]));
  const tally = h("ul.n-pg-ask-tally", (b.wins || []).map((w) => {
    const t = by.get(w.key), last = (b.lastPlace || []).find((x) => x.key === w.key);
    return h("li", t && t.href ? h("a", { href: t.href }, t.name) : t ? t.name : w.key, ": בראש ב-", String(w.n), " מדדים", last && last.n ? ", אחרון ב-" + last.n : "");
  }));
  const table = (list) => h("table.n-pg-ask-tbl",
    h("thead", h("tr", h("th", { scope: "col" }, "מדד"), towns.map((t) => h("th", { scope: "col" }, t.name)))),
    h("tbody", list.map((r) => h("tr", h("th", { scope: "row" }, r.ind.label, h("small", [unitSuffix(r.ind.unit), directionNote(r.ind.direction)].filter(Boolean).join(" · "))),
      towns.map((t) => cell(t, (r.values || []).find((v) => v.key === t.key), r))))));
  const rest = rows.slice(FIRST_ROWS);
  return h("section.n-pg-ask-towns", { "aria-label": b.title || "השוואה בין יישובים" },
    tally,
    (b.notes || []).map((n) => h("p.n-pg-ask-note", n)),
    rows.length ? table(rows.slice(0, FIRST_ROWS)) : null,
    rest.length ? h("details.n-pg-ask-more", h("summary", "הצגת כל " + rows.length + " המדדים"), table(rest)) : null,
    b.href ? h("p.n-pg-ask-towns-go", h("a", { href: b.href }, "לפתיחת ההשוואה המלאה בין היישובים")) : null);
}

// the answer arrives through the guarded fetch (net.js dispatches "cp-ask"), maybe before the page was adapted: the listener lives with the module.
// The block is drawn under the lead sentence of the newest answer, once the old module has drawn it.
let pending = null, rootNow = null;
const place = () => {
  if (!pending || !rootNow) return;
  const leads = rootNow.querySelectorAll(".as-lead");
  const lead = leads[leads.length - 1];
  if (!lead || (lead.nextElementSibling && lead.nextElementSibling.classList.contains("n-pg-ask-towns"))) return;
  const b = pending; pending = null;
  lead.after(townsBlock(b));
};
if (typeof document !== "undefined") document.addEventListener("cp-ask", (e) => {
  pending = e.detail && Array.isArray(e.detail.blocks) ? e.detail.blocks.find((x) => x && x.type === "towns") || null : null;
  setTimeout(place, 0);
});
export function watchAnswers(root) {
  rootNow = root;
  const early = globalThis.__cpAsk && Array.isArray(globalThis.__cpAsk.blocks) ? globalThis.__cpAsk.blocks.find((x) => x && x.type === "towns") : null;          // a question from a link (?q=) is sent before this module is adapted
  if (early && !pending) pending = early;
  place();
  if (typeof MutationObserver === "function") new MutationObserver(place).observe(root, { childList: true, subtree: true });
}
