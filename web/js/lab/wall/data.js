// The wall's logic, with no DOM in it (so node can run it): which mark a figure gets, the order of the figures inside a domain, the counts,
// the order of the domains, the plain words for a count and the filter that lives in the address (?d=<domain>&s=<status>).
// Nothing is invented here: every number comes from the model.
import { sortDomains } from "../../viz/matrix.js";
import { DOMAIN_ICON, countLabel, unitSuffix, fmtVal } from "../../ui.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const JUDGED = ["concern", "watch", "good", "strength"];
export const SMALL_NOTE = "הקבוצה קטנה מכדי להשוות או להסיק";

// the mark of one figure. A small group is never judged; an old figure and a background figure are hollow too.
export function kindOf(a) {
  if (a.status === "uncertain" || (a.last && a.last.reliable === false)) return "small";
  if (JUDGED.includes(a.status)) return a.status;
  return a.status === "stale" ? "stale" : "none";
}

// the status filter folds the marks into four groups: good and strength are both "fine"; stale, background and small groups are "not judged"
export const GROUP = { concern: "concern", watch: "watch", good: "good", strength: "good", stale: "none", none: "none", small: "none" };
export const GROUP_IDS = ["concern", "watch", "good", "none"];
export const GROUP_LABEL = { concern: "דורש טיפול", watch: "למעקב", good: "תקין או חוזק", none: "ללא שיפוט" };
// the same words agreeing with a count ("14 דורשים טיפול", "1 דורש טיפול")
export function groupWord(g, n) {
  if (g === "concern") return countLabel("concern", n);
  if (g === "good") return n === 1 ? "תקין או חוזק" : "תקינים או חוזקות";
  return GROUP_LABEL[g];
}

// inside a domain: the figures that are getting worse first, then needs treatment, watch, fine, background, small groups last
const RANK = { concern: 1, watch: 2, good: 3, strength: 4, stale: 5, none: 5, small: 6 };
export function orderCells(list) {
  const worse = (a) => JUDGED.includes(kindOf(a)) && !!a.history && a.history.trendClass === "worsening";
  return (list || []).map((a, i) => ({ a, i, w: worse(a) ? 0 : 1, r: RANK[kindOf(a)] }))
    .sort((x, y) => x.w - y.w || x.r - y.r || (isNum(y.a.priority) ? y.a.priority : 0) - (isNum(x.a.priority) ? x.a.priority : 0) || x.i - y.i).map((x) => x.a);
}

// how many figures carry each mark, and how many were judged (the denominator of every "x of y")
export function countKinds(list) {
  const c = { concern: 0, watch: 0, good: 0, strength: 0, stale: 0, none: 0, small: 0 };
  (list || []).forEach((a) => { c[kindOf(a)]++; });
  c.judged = c.concern + c.watch + c.good + c.strength;
  c.total = (list || []).length;
  return c;
}
// the same counts folded into the four groups of the filter
export function groupCounts(c) { return { concern: c.concern, watch: c.watch, good: c.good + c.strength, none: c.stale + c.none + c.small }; }

// the domains with something to show, the one under most pressure first (sortDomains: more concerns, then more watches, then fewer fine ones); each with its figures in wall order
export function wallDomains(model) {
  const key = encodeURIComponent(model.city.key);
  const raw = (model.domains || []).map((d) => ({ id: d.id, label: d.label, blurb: d.blurb, icon: DOMAIN_ICON[d.id] || "bars", href: `#/c/${key}/d/${d.id}`,
    indicators: (model.indicators || []).filter((i) => i.domain === d.id) })).filter((d) => d.indicators.length);
  return sortDomains(raw).map((d) => ({ id: d.id, label: d.label, icon: d.icon, href: d.href, cells: orderCells(d.indicators), c: countKinds(d.indicators) }));
}

// a short name for a tab: the first part of "תזונה והנקה" is "תזונה" (the full name stays in the heading and in the label)
export const shortLabel = (label) => String(label || "").split(/ ו|,/)[0].trim() || String(label || "");

// the count line under a domain's name, as parts: [{ n, of, word, tone }] or [{ text, tone }] ("3 מתוך 4 דורשים טיפול", then "1 למעקב")
export function domainLine(c) {
  if (c.concern) return [{ n: c.concern, of: c.judged, word: countLabel("concern", c.concern), tone: "attn" }, ...(c.watch ? [{ n: c.watch, word: "למעקב", tone: "watch" }] : [])];
  if (c.watch) return [{ n: c.watch, of: c.judged, word: "למעקב", tone: "watch" }];
  if (c.judged) return [{ text: c.judged === 1 ? (c.strength ? "חוזק" : "תקין") : "כולם תקינים או חוזקות", tone: "good" }];
  const rest = c.stale + c.none + c.small;
  return [{ text: c.small && c.small === rest ? (c.small === 1 ? "הקבוצה קטנה מכדי לשפוט" : "הקבוצות קטנות מכדי לשפוט") : c.none === rest ? "מדדי רקע" : "ללא שיפוט", tone: "none" }];
}
// the same line as one plain sentence (for aria labels and tooltips)
export function domainLineText(c) {
  return domainLine(c).map((p) => (p.text ? p.text : p.of != null ? `${p.n} מתוך ${p.of} ${p.word}` : `${p.n} ${p.word}`)).join(", ");
}

// the value with its unit, as the cell and the aria label write it: "51.9%", "10.2" + "לכל 100,000"
export const decimals = (a) => (a.unit === "index" ? 2 : 1);
export const unitWord = (a) => (a.unit !== "%" ? unitSuffix(a.unit) : "");
export const valueText = (a) => (a.last && isNum(a.last.v) ? fmtVal(a.unit, a.last.v, decimals(a)) : null);

// ── the filter that lives in the address: #/c/<key>/lab/wall?d=<domain>&s=<status> ──
export function readState(hash, domainIds) {
  const q = new URLSearchParams(String(hash || "").split("?")[1] || ""), d = q.get("d"), s = q.get("s");
  return { d: d && (domainIds || []).includes(d) ? d : "all", s: s && GROUP_IDS.includes(s) ? s : "all" };
}
export function writeHash(hash, st) {
  const path = String(hash || "").split("?")[0], q = new URLSearchParams();
  if (st.d && st.d !== "all") q.set("d", st.d);
  if (st.s && st.s !== "all") q.set("s", st.s);
  const qs = q.toString();
  return path + (qs ? "?" + qs : "");
}
// does a figure pass the filter
export const passes = (st, domainId, kind) => (st.d === "all" || st.d === domainId) && (st.s === "all" || st.s === GROUP[kind]);
