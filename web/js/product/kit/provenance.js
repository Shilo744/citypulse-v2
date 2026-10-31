// Where the figures on a screen come from: "מקורות: ... נתוני 2019-2025. עודכן 29 באוקטובר 2026. איך מחושבים המספרים ←"
// Built only from the rows it is given (their sources, their latest years) and the model's builtAt; nothing is typed here.
import { h, dateHe, iso } from "../../ui.js";
import { cntOf } from "./plural.js";

// "משרד הבריאות (פורטל עולם הדאטה)" and "משרד הבריאות, שירות בריאות התלמיד" are one publisher on a screen
export const shortPublisher = (p) => String(p || "").replace(/\s*\(.*$/, "").split(/[,،]/)[0].trim();
const joinHe = (parts) => (parts.length < 2 ? parts[0] || "" : parts.slice(0, -1).join(", ") + " ו" + parts[parts.length - 1]);
const MAX_PUBLISHERS = 4;

// the publishers of the rows. A row names its source (row.source, or opts.sourceOf[row.id] / sourceOf(id) from the catalogue); when no row does, every source of the model.
export function publishersOf(model, rows, opts = {}) {
  const sources = (model && model.sources) || [], byId = new Map(sources.map((s) => [s.id, s]));
  const sourceOf = opts.sourceOf, pick = (r) => (r && r.source) || (typeof sourceOf === "function" ? sourceOf(r && r.id) : sourceOf && r ? sourceOf[r.id] : null);
  const ids = new Set((rows || []).map(pick).filter(Boolean));
  const used = ids.size ? sources.filter((s) => ids.has(s.id)) : sources;
  const list = [];
  for (const s of used) { const p = shortPublisher(s.publisher); if (p && !list.includes(p)) list.push(p); }
  return list;
}

// the years of the latest figures of the rows (opts.span "series": the years the series cover)
export function yearsOf(rows, opts = {}) {
  const ys = [];
  for (const r of rows || []) {
    if (opts.span === "series" && r.series) for (const p of r.series) ys.push(p.year);
    else if (r.last && r.last.year != null) ys.push(r.last.year);
  }
  return ys.length ? { from: Math.min(...ys), to: Math.max(...ys) } : null;
}

export function provenanceParts(model, rows, opts = {}) {
  const pubs = publishersOf(model, rows, opts), yrs = yearsOf(rows, opts);
  const shown = pubs.length > MAX_PUBLISHERS ? [...pubs.slice(0, MAX_PUBLISHERS - 1), "ועוד " + cntOf(pubs.length - MAX_PUBLISHERS + 1, "source")] : pubs;
  const date = model && model.builtAt ? dateHe(model.builtAt) : "";
  return {
    sources: shown.length ? "מקורות: " + (pubs.length > MAX_PUBLISHERS ? shown.join(", ") : joinHe(shown)) + "." : "",
    years: yrs ? "נתוני " + (yrs.from === yrs.to ? yrs.from : iso(`${yrs.from}-${yrs.to}`)) + "." : "",
    updated: date ? "עודכן " + date + "." : ""
  };
}
export const provenanceText = (model, rows, opts) => Object.values(provenanceParts(model, rows, opts)).filter(Boolean).join(" ");

// provenance(model, rows, { href }): a paragraph; the link goes to the method page
export function provenance(model, rows, opts = {}) {
  const p = provenanceParts(model, rows, opts);
  return h("p.n-kit-prov", { "data-prov": "" }, [p.sources, p.years, p.updated].filter(Boolean).join(" "), " ", h("a.n-kit-link", { href: opts.href || "#/method" }, "איך מחושבים המספרים ←"));
}
