// The cards of the product (hover, keyboard focus, touch): a layer over the shared tooltip of the old chart modules, installed once by app.js.
// The owner's rule: a card must say something the page does not already say next to the mark. Otherwise it has no reason to exist.
//   1. watch the shared tooltip element (viz/core.js bindTip, ui.js tip): when a card shows, find the figure and the year it is about (from the DOM around the mark and from the card's own head),
//   2. add what the model knows and the card lacks (the change from the year before, the change since the first year, the national average of that year, the target of that year, the status in the
//      product's words, the place among the towns of the latest year, who published the figure and what it measures),
//   3. drop every extra that the page already shows near the mark, and hide the whole card when nothing new is left (isRedundant).
// Pure parts (no DOM at import, tested in node): the text tests (isRedundant), the figure helpers, the extras (extrasFor). The DOM part is installTips().
// A figure on a group too small to judge gets no change, no comparison and no place here either (honest data); a place among the towns exists for the latest year only.
import { h, tip, tipRow, num, deltaUnit, STATUS } from "../../ui.js";
import { shortPublisher } from "./provenance.js";
import { withUnit } from "./plural.js";
import { stateOf, STATE, respell } from "./guide.js";

// ═════════ 1. text: numbers and meaningful words ═════════
const BIDI = /[‎‏‪-‮⁦-⁩⁠­]/g;
export const clean = (t) => String(t == null ? "" : t).replace(BIDI, "").replace(/[   ]/g, " ");

// every number of a text, in one canonical form: "1,221" is 1221, "5.70" is 5.7; a minus sign (U+2212, or a hyphen with nothing meaningful before it) keeps the sign, a hyphen after a letter ("מ-24%") or a digit (a range) does not
export function numbersOf(text) {
  const out = new Set(), t = clean(text), re = /\d+(?:,\d{3})*(?:\.\d+)?/g;
  for (let m; (m = re.exec(t));) {
    const prev = t[m.index - 1], before = t[m.index - 2], v = parseFloat(m[0].replace(/,/g, ""));
    const neg = prev === "−" || (prev === "-" && (before === undefined || /[\s(:,;]/.test(before)));
    if (Number.isFinite(v)) out.add((neg && v !== 0 ? "-" : "") + String(v));
  }
  return out;
}

// the words that carry no meaning of their own in a card: the names of its rows, little words, the pronouns, the way a status sentence is put together
const FILLER = new Set(["ערך", "מצב", "שנה", "מקום", "שנים", "יותר", "ארץ", "מתוך", "של", "עם", "על", "את", "גם", "כל", "זה", "זו", "הוא", "היא", "שלו", "שלה", "או", "אם", "כי", "מול", "בין", "עד", "לפי", "לעומת", "מאז", "אחרי", "המדד", "מדד"]);
const PREFIX = "ובהלמכש";
const variants = (w) => {
  const out = [w];
  for (let i = 1; i <= 2 && w.length - i >= 3 && PREFIX.includes(w[i - 1]); i++) out.push(w.slice(i));
  for (const v of out.slice()) if (v.length > 4 && /(ים|ות)$/.test(v)) out.push(v.slice(0, -2));
  return out;
};
export function wordsOf(text) {
  const t = clean(text).replace(/\d[\d.,]*/g, " ");
  return (t.match(/[֐-׿]+|[A-Za-z]+/g) || []).filter((w) => w.length > 1).map((w) => (/^[A-Za-z]/.test(w) ? w.toLowerCase() : w));
}
const keysOf = (text) => { const s = new Set(); for (const w of wordsOf(text)) for (const v of variants(w)) s.add(v); return s; };
const isFiller = (w) => variants(w).some((v) => FILLER.has(v));

// Does the card say nothing that the visible text around the mark does not already say? True when every number and every meaningful word of the card is in the visible text.
// The visible text is what a person reads on the screen: the text of the mark and of its row or chart, never a visually hidden twin.
export function isRedundant(cardText, visibleText) {
  const nums = numbersOf(cardText), words = wordsOf(cardText).filter((w) => !isFiller(w));
  if (!nums.size && !words.length) return true;
  const vn = numbersOf(visibleText), vk = keysOf(visibleText);
  for (const n of nums) if (!vn.has(n)) return false;
  for (const w of words) if (!variants(w).some((v) => vk.has(v))) return false;
  return true;
}
// a number that is evidence of the same thing when it is met twice: a decimal or from 10 up (small whole numbers meet by chance)
const strong = (n) => n.includes(".") || Math.abs(Number(n)) >= 10;
// an extra row that adds nothing: its figures (the years too) are all in the text already, or, with no figure, its words are. A row may name the part that identifies it (key): the target of a year is its value
export function rowRedundant(rowText, haystack) {
  const un = (set) => [...set].map((n) => n.replace(/^-/, "")), nums = un(numbersOf(rowText));          // an amount of change has no sign of its own: "ירד ב-9.3" says what "−9.3" says
  if (nums.length) { const hn = new Set(un(numbersOf(haystack))); return nums.every((n) => hn.has(n)); }
  return isRedundant(rowText, haystack);
}

// ═════════ 2. the figure: series, change, words ═════════
const fin = (v) => typeof v === "number" && Number.isFinite(v);
export const seriesOf = (a) => ((a && a.series) || []).filter((p) => p && fin(p.v) && fin(p.year)).sort((x, y) => x.year - y.year);
export const pointAt = (a, year) => seriesOf(a).find((p) => p.year === year) || null;
const lastPoint = (a) => { const s = seriesOf(a); return s.length ? s[s.length - 1] : null; };
const decOf = (unit, d) => (unit === "count" ? 0 : Math.abs(d) >= 100 ? 0 : Math.abs(d) >= 1 || unit === "%" ? 1 : 2);
const fmt = (a, v) => withUnit(v, a.unit, a.unit === "index" ? 2 : 1);          // the unit stands with its value: "26 ימים", "6.9 לכל 100,000", "66.1%"
export const small = (a) => !!(a && a.last && a.last.reliable === false);
const steady = (a) => small(a) || (a && a.baseShift != null);       // the basis of the figure moved, or the group is small: years are not set against each other
// "ב-1.8 נק׳", and one day or one year as Hebrew says it: "ביום אחד", "בשנה אחת"
const by = (unit, r, dec) => (r === 1 && unit === "days" ? "ביום אחד" : r === 1 && unit === "years" ? "בשנה אחת" : `ב-${num(r, dec)}${deltaUnit(unit)}`);
// "ירד ב-1.8 נק׳" and which way is good ("לכיוון הלא טוב"): the verb and the amount, and for a figure that has a direction the way, in words
export function changeParts(a, from, to) {
  if (!a || !from || !to || !fin(from.v) || !fin(to.v)) return null;
  const d = to.v - from.v, dec = decOf(a.unit, d), r = Math.round(Math.abs(d) * 10 ** dec) / 10 ** dec;
  if (r === 0) return { text: "ללא שינוי", way: "" };
  return { text: `${d > 0 ? "עלה" : "ירד"} ${by(a.unit, r, dec)}`, way: !a.direction ? "" : ((a.direction === "higher") === (d > 0) ? "לכיוון הטוב" : "לכיוון הלא טוב") };
}
export const changeWords = (a, from, to) => { const c = changeParts(a, from, to); return c && c.text + (c.way ? " · " + c.way : ""); };
// a town set against a reference: "גבוה ב-5.2 נק׳" and "טוב יותר"
export function diffParts(a, d) {
  const dec = decOf(a.unit, d), r = Math.round(Math.abs(d) * 10 ** dec) / 10 ** dec;
  if (r === 0) return { text: "ללא הפרש", way: "" };
  return { text: `${d > 0 ? "גבוה" : "נמוך"} ${by(a.unit, r, dec)}`, way: !a.direction ? "" : ((a.direction === "higher") === (d > 0) ? "טוב יותר" : "חלש יותר") };
}
export const diffWords = (a, d) => { const c = diffParts(a, d); return c.text + (c.way ? " · " + c.way : ""); };

// ═════════ 3. the extras: one function per kind of information; each returns { id, label, value } or { id, label, note } or null ═════════
// f = { a: a figure of the model, year: the year the card is about (null: the latest), model, meta (the catalogue, may be missing), self: the card is about the town of the page, value: the number of the card (a town set against the page's town) }
export const EXTRA = {
  // the change from the year before the card's year (the year it is set against is named)
  prev(f) {
    const { a } = f, s = seriesOf(a), p = f.year == null ? lastPoint(a) : pointAt(a, f.year);
    if (!p || steady(a)) return null;
    const before = s.filter((x) => x.year < p.year).pop(), c = changeParts(a, before, p);
    return c ? { id: "prev", label: `לעומת ${before.year}`, value: c.text, sub: c.way } : null;
  },
  // the change since the first year of the series (not shown when the first year is the year before: the row above says it)
  first(f) {
    const { a } = f, s = seriesOf(a), p = f.year == null ? lastPoint(a) : pointAt(a, f.year);
    if (!p || steady(a) || s.length < 3) return null;
    const first = s[0], before = s.filter((x) => x.year < p.year).pop();
    if (first.year >= p.year || (before && before.year === first.year)) return null;
    const c = changeParts(a, first, p);
    return c ? { id: "first", label: `מאז ${first.year}`, value: c.text, sub: c.way } : null;
  },
  // the best year of the series (the weakest when the card's year is the best one): where this year stands in its own history
  extreme(f) {
    const { a } = f, s = seriesOf(a), p = f.year == null ? lastPoint(a) : pointAt(a, f.year);
    if (!p || steady(a) || s.length < 4) return null;
    const top = s.reduce((m, x) => (x.v > m.v ? x : m)), low = s.reduce((m, x) => (x.v < m.v ? x : m));
    if (top.v === low.v) return null;
    const goodTop = a.direction === "higher" || !a.direction, best = goodTop ? top : low, worst = goodTop ? low : top;
    const showWorst = p.year === best.year, e = showWorst ? worst : best;
    if (e.year === p.year) return null;
    const label = a.direction ? (showWorst ? "השנה החלשה בסדרה" : "השנה הטובה בסדרה") : (e === top ? "השנה הגבוהה בסדרה" : "השנה הנמוכה בסדרה");
    return { id: "extreme", label, value: `${e.year} · ${fmt(a, e.v)}` };
  },
  // the national average of the card's year (never the latest one set under another year)
  nat(f) {
    const { a } = f, p = f.year == null ? lastPoint(a) : pointAt(a, f.year);
    if (!p || small(a) || f.calm || !fin(p.nat)) return null;
    return { id: "nat", label: `ממוצע ארצי ב-${p.year}`, value: fmt(a, p.nat) };
  },
  // the middle value of the similar towns, for the card's year
  peer(f) {
    const { a } = f, p = f.year == null ? lastPoint(a) : pointAt(a, f.year);
    if (!p || small(a) || f.calm || f.noPeers || !fin(p.peer)) return null;
    return { id: "peer", label: `יישובים דומים ב-${p.year}`, value: fmt(a, p.peer) };
  },
  // the official target (a.guide, kit/guide.js; the model has it per year in the series too). A target that judges is said with who published it and where the figure stands: of the latest year by
  // guide.text and the state the status rule used ("עומד ביעד", "קרוב ליעד", "רחוק מהיעד"), of an earlier year by the target of that year. A reference that does not judge is a plain note.
  target(f) {
    const { a } = f, p = f.year == null ? lastPoint(a) : pointAt(a, f.year), g = a && a.guide && typeof a.guide === "object" ? a.guide : null;
    const latest = f.year == null || !!(a && a.last && f.year === a.last.year), who = g && g.source ? g.source.short || g.source.publisher || "" : "";
    if (g && g.judges === true && who && !small(a) && !f.calm) {
      const st = latest ? stateOf(a) : null;
      if (latest && typeof g.text === "string" && g.text) return { id: "target", label: `יעד רשמי (${who})`, value: clean(g.text), sub: st ? STATE[st] : "" };
      if (!latest && p && fin(p.target) && fin(p.v)) return { id: "target", label: `יעד ב-${p.year} (${who})`, value: fmt(a, p.target), sub: (p.v - p.target) * (a.direction === "lower" ? -1 : 1) >= 0 ? "עומד ביעד" : "לא עומד ביעד" };
    }
    if (p && fin(p.target) && !small(a) && !f.calm) return { id: "target", label: `יעד ב-${p.year}`, value: fmt(a, p.target), key: `יעד ${fmt(a, p.target)}` };
    if (g || typeof (a && a.guide) === "string") { const t = typeof a.guide === "string" ? a.guide : g.text || g.label || g.name; if (typeof t === "string" && t && f.year == null) return { id: "target", label: g ? "יעד להתמצאות" : "הנחיה רשמית", note: clean(t) + (who ? ` (${who})` : "") }; }
    return null;
  },
  // the cases behind the figure of that year: how many of how many
  base(f) {
    const { a } = f, p = f.year == null ? lastPoint(a) : pointAt(a, f.year);
    if (!p || !fin(p.d) || p.d <= 0) return null;
    return a.unit === "%" && fin(p.n) ? { id: "base", label: "מבוסס על", value: `${num(p.n, 0)} מתוך ${num(p.d, 0)}` } : { id: "base", label: "גודל הקבוצה", value: num(p.d, 0) };
  },
  // the status of the latest figure in the product's words
  status(f) {
    const { a } = f;
    if (!a || !a.status || (f.year != null && a.last && f.year !== a.last.year)) return null;
    const word = small(a) ? "קבוצה קטנה, ללא שיפוט" : a.status === "na" ? "מדד רקע, ללא שיפוט" : (STATUS[a.status] || {}).label;
    return word ? { id: "status", label: "מצב", value: word } : null;
  },
  // the place among the towns: the latest year only, never for a group too small to judge
  place(f) {
    const { a } = f, L = a && a.last;
    if (!L || small(a) || f.calm || !fin(L.rank) || !fin(L.of) || (f.year != null && f.year !== L.year)) return null;
    return { id: "place", label: "מקום בין היישובים", value: `${num(L.rank, 0)} מתוך ${num(L.of, 0)}` };
  },
  // who published the figure, and the dataset
  source(f) {
    const mi = f.meta && (f.meta.indicators || []).find((x) => x.id === (f.a && f.a.id || f.metaId));
    const sources = (f.model && f.model.sources) || (f.meta && f.meta.sources) || [];
    const s = mi && sources.find((x) => x.id === mi.source);
    if (!s) return null;
    const pub = shortPublisher(s.publisher);
    return pub ? { id: "source", label: "מקור", value: pub, note: respell(s.name) } : null;
  },
  // what the figure measures, in the catalogue's own words (first sentence)
  def(f) {
    const mi = f.meta && (f.meta.indicators || []).find((x) => x.id === (f.a && f.a.id || f.metaId));
    const t = mi && typeof mi.definition === "string" ? mi.definition.trim() : "";
    return t ? { id: "def", label: "מה נמדד", note: t.split(/(?<=\.)\s/)[0] } : null;
  },
  // another town of a list or a map, set against the page's town and against the nation (the same year; never when either group is small)
  vsMain(f) {
    const { a } = f;
    if (!a || f.self || !fin(f.value) || f.hollow || small(a) || f.calm) return null;
    const p = f.year == null ? a.last : pointAt(a, f.year), mine = p && p.v;
    if (!fin(mine)) return null;
    const c = diffParts(a, f.value - mine);
    return { id: "vsMain", label: `מול ${f.cityName || "היישוב"}`, value: c.text, sub: c.way };
  },
  vsNat(f) {
    const { a } = f;
    if (!a || !fin(f.value) || f.hollow || small(a) || f.calm) return null;
    const p = f.year == null ? a.last : pointAt(a, f.year);
    if (!p || !fin(p.nat)) return null;
    const c = diffParts(a, f.value - p.nat);
    return { id: "vsNat", label: `מול הארצי ב-${p.year}`, value: c.text, sub: c.way };
  },
  // the figures a segment of the ring counts: the weakest first, at most five names
  names(f) {
    const g = f.group;
    if (!g || !g.length) return null;
    const rank = (x) => (x.last && fin(x.last.level) ? x.last.level : 101), list = [...g].sort((x, y) => rank(x) - rank(y) || String(x.id).localeCompare(String(y.id)));
    const name = (x) => x.short || x.label, top = list.slice(0, 5).map(name);
    return { id: "names", label: g.length === 1 ? "המדד" : "המדדים", list: top, more: g.length > top.length ? `ועוד ${num(g.length - top.length, 0)}` : null };
  },
  // where a category is strongest and weakest: the figure with the lowest and the highest place among the towns (judged figures on groups that can be compared)
  edges(f) {
    const ok = (f.list || []).filter((x) => x.last && !small(x) && fin(x.last.level) && fin(x.last.rank) && fin(x.last.of) && ["concern", "watch", "good", "strength"].includes(x.status));
    if (ok.length < 2) return null;
    const lo = ok.reduce((m, x) => (x.last.level < m.last.level ? x : m)), hi = ok.reduce((m, x) => (x.last.level > m.last.level ? x : m));
    if (lo === hi || lo.last.level === hi.last.level) return null;
    const line = (x) => `${x.short || x.label}, מקום ${num(x.last.rank, 0)} מתוך ${num(x.last.of, 0)}`;
    return { id: "edges", label: "בתוך התחום", list: [["החלש ביותר:", line(lo)], ["החזק ביותר:", line(hi)]] };
  },
  // the national average of the year before the last one (a card on the national mark: the nation's own change, never the town's)
  natPrev(f) {
    const { a } = f, s = seriesOf(a).filter((p) => fin(p.nat)), p = f.year == null ? s[s.length - 1] : s.find((x) => x.year === f.year);
    if (!p || small(a) || f.calm) return null;
    const before = s.filter((x) => x.year < p.year).pop();
    return before ? { id: "natPrev", label: `ממוצע ארצי ב-${before.year}`, value: fmt(a, before.nat) } : null;
  },
  // the national average at the two ends of a change the card tells (the nation may have moved too)
  natSpan(f) {
    const { a } = f;
    if (!a || small(a) || f.calm || !f.span) return null;
    const x = pointAt(a, f.span[0]), y = pointAt(a, f.span[1]);
    if (!x || !y || !fin(x.nat) || !fin(y.nat)) return null;
    return { id: "natSpan", label: "הממוצע הארצי באותן שנים", value: `מ-${fmt(a, x.nat)} ל-${fmt(a, y.nat)}` };
  }
};

// which extras a kind of card gets, in this order; the engine keeps the first ones that are not already in the card or on the page
export const PLAN = {
  heat: ["prev", "first", "base", "extreme", "target", "peer"],
  spark: ["prev", "first", "extreme", "target", "peer"],
  line: ["prev", "first", "extreme"],
  column: ["prev", "first", "extreme"],
  strip: ["status", "target", "place", "prev", "first", "extreme", "source", "def"],
  link: ["status", "target", "place", "prev", "first", "base", "source", "def"],
  hero: ["prev", "extreme"],
  lolli: ["vsMain", "prev", "first", "source"],
  dot: ["vsMain", "vsNat", "prev", "first", "source"],
  map: ["vsMain", "vsNat", "prev", "first", "source"],
  diverge: ["natSpan", "status", "source", "def"],
  cover: ["def", "source"],
  segment: ["names"],
  domainMeter: ["edges"],
  chipCity: ["prev", "first"],
  chipNat: ["natPrev"],
  chipTarget: [],
  meter: [],
  bin: [],
  traj: ["prev", "first", "extreme", "source"],
  dumb: ["prev", "first", "extreme"],
  subgroup: ["source", "def"],
  figure: ["source", "def"]
};
const MAX = { segment: 1, domainMeter: 2, heat: 3, spark: 3, line: 3, column: 3, strip: 3, link: 3, hero: 2, lolli: 3, dot: 3, map: 3, diverge: 3, cover: 2, chipCity: 2, chipNat: 1, traj: 3, dumb: 3, subgroup: 2, figure: 2 };

// A figure with an official target hears it first: a card about a year of such a figure that says only "קרוב לממוצע הארצי" while the point is 11 under its 90% would mislead. The target goes before the extras that describe the
// series (the change, the best year, the cases), after the status that a strip or a link opens with; a figure with none keeps the plan as it is. (A year without a target has no row: the extra returns nothing.)
export const hasTarget = (a) => !!a && (!!(a.guide && typeof a.guide === "object" && a.guide.judges === true) || seriesOf(a).some((p) => fin(p.target)));
export function planFor(kind, f) {
  const ids = PLAN[kind] || PLAN.figure;
  if (!ids.includes("target") || !hasTarget(f && f.a)) return ids;
  const rest = ids.filter((id) => id !== "target"), at = rest[0] === "status" ? 1 : 0;
  return [...rest.slice(0, at), "target", ...rest.slice(at)];
}
const textOfRow = (r) => `${r.label} ${r.value || ""} ${r.sub || ""} ${r.note || ""} ${(r.list || []).flat().join(" ")}`;
// the extras of one card, pure: kind says which list, f the figure, seen the text that is already there (the card and the page around the mark)
// the extras that describe the page's own town (its change, its status, its group): never put on the card of another town
const SELF_ONLY = new Set(["prev", "first", "extreme", "peer", "base", "status", "place"]);
export function extrasFor(kind, f, seen = "", limit = Infinity) {
  const out = [];
  if (f.empty) return out;
  for (const id of planFor(kind, f)) {
    if (SELF_ONLY.has(id) && f.self === false) continue;
    let row = null;
    try { const fn = EXTRA[id]; row = fn ? fn(f) : null; } catch (e) { row = null; }          // a figure the model sent in a shape this code does not know: no row, never a broken card
    if (!row) continue;
    const hay = seen + " " + out.map(textOfRow).join(" ");
    if (rowRedundant(row.key || textOfRow(row), hay) && (row.id !== "target" || /יעד/.test(hay))) continue;          // a number is no proof for a target unless the page says "יעד" too: the national mean 75% and a target of 75% are two facts
    out.push(row);
    if (out.length >= Math.min(MAX[kind] || 3, limit)) break;
  }
  return out;
}

// ═════════ 4. the DOM part ═════════
let env = { model: null, parts: [], meta: null }, ttEl = null, mo = null, last = null, warmed = false, installed = false, shownByTouch = null, held = null;
const NOW = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
export function setContext(ctx) {
  env = { ...env, model: (ctx && ctx.model) || null, parts: (ctx && ctx.parts) || [] }; scopeCache = new WeakMap();
  if (held && ttEl) { held = null; shownByTouch = null; ttEl.classList.remove("on"); }          // a card kept for a finger does not follow it to the next page
}
export function setMeta(meta) { env = { ...env, meta: meta || null }; }

// the card as the shared code built it: the head, the rows (label, value) and the plain text
export function readCard(tt) {
  const head = tt.querySelector(".th"), rows = [...tt.querySelectorAll(".tr")].map((r) => ({ label: (r.querySelector(".k") || {}).textContent || "", value: (r.querySelector("b") || {}).textContent || "" }));
  return { head: head ? head.textContent : "", rows, text: tt.textContent || "" };
}
const byLabel = (model) => { const m = new Map(); for (const a of model.indicators || []) { m.set(clean(a.label).trim(), a); if (a.short) m.set(clean(a.short).trim(), a); } return m; };
const idOfHref = (href) => { const m = /\/i\/([^/?#]+)/.exec(href || ""); return m ? decodeURIComponent(m[1]) : null; };
const yearIn = (s) => { const m = /(?:^|[\s,·(])((?:19|20)\d\d)(?=$|[\s·,)])/.exec(clean(s)); return m ? Number(m[1]) : null; };

// the figure of a mark: the indicator link it sits in or beside (the nearest ancestor that holds exactly one), the page of the figure, or the name in the card
function figureOf(target, card, model) {
  const byId = new Map((model.indicators || []).map((a) => [a.id, a])), own = target.closest && target.closest('a[href*="/i/"]');
  if (own && byId.has(idOfHref(own.getAttribute("href")))) return byId.get(idOfHref(own.getAttribute("href")));
  for (let e = target.parentElement, n = 0; e && n < 7; e = e.parentElement, n++) {
    const ids = new Set([...e.querySelectorAll('a[href*="/i/"]')].map((x) => idOfHref(x.getAttribute("href"))).filter(Boolean));
    if (ids.size === 1 && byId.has([...ids][0])) return byId.get([...ids][0]);
    if (ids.size > 1) break;
  }
  if (env.parts[2] === "i" && byId.has(env.parts[3])) return byId.get(env.parts[3]);
  const names = byLabel(model), cand = [card.head.replace(/[,\s]*(?:19|20)\d\d\s*$/, "").trim(), card.head.trim(), ...card.rows.map((r) => r.label.trim())];
  for (const c of cand) if (names.has(clean(c))) return names.get(clean(c));
  return null;
}

// what kind of mark it is, by the classes the old chart modules give it
const KINDS = [
  [".v-mx-hc", "heat"], [".v-time-sm-spark", "spark"], [".v-time-spark", "spark"], ["a.v-time-sm-cell", "link"], [".v-time-trajsvg", "traj"], [".v-time-svg", "line"],
  [".v-cmp-lrow", "lolli"], [".tr-pt", "dot"], [".tr-strip", "dot"], [".v-map", "map"], [".v-cmp-row", "diverge"], [".n-home-db", "strip"], [".n-home-cell", "cover"],
  [".v-cmp-bin", "bin"], [".v-cmp-chip.is-nat", "chipNat"], [".v-cmp-chip.is-target", "chipTarget"], [".v-cmp-chip.is-city", "chipCity"], [".v-cmp-db-row", "dumb"], [".v-ring-meter", "meter"], [".in-hero, .dm-hero", "hero"]
];
const kindOf = (t) => { for (const [sel, k] of KINDS) if (t.closest && t.closest(sel)) return k; return "figure"; };

// the text a person reads around a mark: its row, link or chart, without what is hidden from the eye
const SCOPES = "a[href], td, .tr-row, .n-home-tell, .n-home-lr, li, tr, .viz, figure, section";
let scopeCache = new WeakMap();
const HIDDEN_TAGS = new Set(["TITLE", "DESC", "STYLE", "SCRIPT", "TEMPLATE"]);
// an element the eye does not read: hidden, a visually hidden twin (class sr: the table for screen readers, the spoken twin of a figure), the text of an svg title, display none or visibility hidden
const unseen = (el) => {
  if (el.hidden || HIDDEN_TAGS.has(el.tagName) || (el.classList && el.classList.contains("sr"))) return true;
  const cs = typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
  return !!cs && (cs.display === "none" || cs.visibility === "hidden");
};
function collect(node, out) {
  if (node.nodeType === 3) { if (String(node.nodeValue).trim()) out.push(node.nodeValue); return; }
  if (node.nodeType !== 1 || unseen(node)) return;
  for (const c of node.childNodes) collect(c, out);
}
export function visibleText(root) {
  const hit = scopeCache.get(root);
  if (hit && NOW() - hit.t < 1500) return hit.text;
  const parts = [];
  collect(root, parts);
  const text = parts.join(" ");
  scopeCache.set(root, { text, t: NOW() });
  return text;
}
// a hero holds the figure and all its words; a matrix of years is read with its year labels and its key, which sit once above its groups: the section
const scopeOf = (t) => {
  if (!t.closest) return document.body;
  const heat = t.closest(".v-mx-heat");
  return t.closest(".in-hero, .dm-hero") || (heat && outerSection(heat)) || t.closest(SCOPES) || t.closest("#view") || document.body;
};
function outerSection(el) {
  let s = el.closest("section");
  while (s && s.parentElement && s.parentElement.closest("section")) s = s.parentElement.closest("section");
  return s || el;
}

// the value of a card's row (the number of "ערך"), for a town set against the page's town
const cardValue = (card) => { const r = card.rows.find((x) => /^ערך$|^היישוב$|^העיר$/.test(x.label.trim())); const n = r && [...numbersOf(r.value)][0]; return n == null ? null : Number(n); };

// the statuses a donut segment counts, by the word its card starts with (viz/rings.js segmentWord)
const SEGMENT = [[/דורש/, ["concern"]], [/מעקב/, ["watch"]], [/תקין/, ["good"]], [/חוזק/, ["strength"]], [/ללא שיפוט/, ["stale", "uncertain", "na"]]];
const TOWN_CARDS = new Set(["lolli", "dot", "map"]);
function describe(target, card) {
  const model = env.model;
  if (!model || !model.indicators) return null;
  let kind = kindOf(target);
  const head = clean(card.head).trim(), name = model.city && model.city.name;
  if (kind === "dumb" && /[—–]/.test(head)) kind = "subgroup";          // a row of one group of the town (a sector, a social-economic level): the change of the whole town is not its change
  let a = figureOf(target, card, model) || null, year = yearIn(head);
  const yr = card.rows.find((r) => r.label.trim() === "שנה");
  if (year == null && yr) year = yearIn(yr.value);
  // a card with a town as its head (a list, a strip of towns, a map) is about that town; every other card is about the page's town
  const self = TOWN_CARDS.has(kind) ? !!name && (head.startsWith(name) || /\((?:העיר|היישוב)\)/.test(head)) : true;
  const years = [...clean(card.text).matchAll(/(?:19|20)\d\d/g)].map((m) => Number(m[0])).filter((y, i, arr) => arr.indexOf(y) === i);
  const empty = /אין נתון/.test(card.text) && ![...numbersOf(card.text)].some((n) => !/^(?:19|20)\d\d$/.test(n));          // a blank cell: the key of the chart says what blank means
  const f = { a, year, empty, model, meta: env.meta, self, value: cardValue(card), cityName: name, hollow: /קבוצה קטנה/.test(card.text), noPeers: isTiny(model), metaId: null,
    span: kind === "diverge" && years.length >= 2 ? [Math.min(...years), Math.max(...years)] : null, calm: a ? isCalm(model, a) : false };
  if (!a && kind === "cover") { const mi = ((env.meta && env.meta.indicators) || []).find((x) => clean(x.short || x.label).trim() === head || clean(x.label).trim() === head); if (mi) f.metaId = mi.id; }
  // a category page: the segments of its ring and the meter of its standing speak about the figures of the category
  const dom = env.parts[2] === "d" ? (model.domains || []).find((d) => d.id === env.parts[3]) : null;
  if (dom && !a) {
    f.list = (model.indicators || []).filter((x) => x.domain === dom.id);
    if (target.closest(".v-ring-seg-g, .v-ring-row, .v-ring-legend")) {
      const seg = SEGMENT.find(([re]) => re.test(head));
      f.group = seg ? f.list.filter((x) => seg[1].includes(x.status)) : null;
      return { kind: "segment", f };
    }
    if (target.closest(".v-ring-meter, .dm-stand")) return { kind: "domainMeter", f };
  }
  return { kind, f };
}
let D = null;
const isCalm = (model, a) => !!(D && D.isCalmFigure && D.isCalmFigure(model, a));
const isTiny = (model) => !!(D && D.isVerySmallTown && D.isVerySmallTown(model));

function rowNode(r) {
  if (r.list) return h("div.n-kit-tipx.n-kit-tiplist", h("b", r.label), r.list.map((t) => (Array.isArray(t) ? h("div", h("b.n-kit-tiplead", t[0]), " ", t[1]) : h("div", t))), r.more ? h("div.n-kit-tipmore", r.more) : null);
  if (r.value == null) return h("div.n-kit-tipx.n-kit-tipnote", h("b", r.label + ": "), r.note);
  const row = tipRow(null, r.label, r.sub ? "" : r.value);
  if (r.sub) { const b = row.querySelector("b"); b.append(r.value, h("small.n-kit-tipsub", r.sub)); }
  if (!r.note) { row.classList.add("n-kit-tipx"); return row; }
  return h("div.n-kit-tipx", row, h("div.n-kit-tipnote", r.note));
}

// the rows of the shared card that the page already shows next to the mark are taken off the card (the head stays: it says what the card is about). A small whole number is no proof, a row with only small numbers stays.
export function trimSeen(tt, visible) {
  let n = 0;
  for (const el of [...tt.children]) {
    if (el.classList.contains("th") || el.classList.contains("n-kit-tipx")) continue;
    const text = el.textContent || "", nums = [...numbersOf(text)];
    if (nums.length && !nums.some(strong)) continue;
    if (isRedundant(text, visible)) { el.remove(); n++; }
  }
  return n;
}

// after rows were added the card is taller: keep it inside the window (a pointer: flip above it as the shared code does; the keyboard: move it up)
function keepInside(tt) {
  const r = tt.getBoundingClientRect(), pad = 14, vw = window.innerWidth, vh = window.innerHeight, pointer = last && last.pointer && NOW() - last.t < 1500;
  let x = r.left, y = r.top;
  if (r.right > vw - 8) x = pointer ? last.x - r.width - pad : vw - 8 - r.width;
  if (r.bottom > vh - 8) y = pointer ? last.y - r.height - pad : vh - 8 - r.height;
  tt.style.left = Math.max(8, x) + "px"; tt.style.top = Math.max(8, y) + "px";
}

function refine() {
  const tt = ttEl;
  if (!tt) return;
  if (!tt.classList.contains("on")) {
    // a finger lifts at once and the old marks hide their card with it (pointerleave): the card of a touched mark stays until the next touch elsewhere or a scroll
    if (shownByTouch && !tt.hidden && last && last.touch && /^(?:pointerleave|pointerout|pointerup|pointercancel)$/.test(last.type) && NOW() - shownByTouch.t < 1500) {
      mo.disconnect();
      try { tt.classList.add("on"); held = { mark: shownByTouch.target }; } finally { mo.observe(tt, { childList: true, attributes: true, attributeFilter: ["class"] }); }
      return;
    }
    tt.hidden = false; tt.removeAttribute("data-n-tip"); shownByTouch = null; held = null;
    return;
  }
  if (tt.querySelector(".n-kit-tipx")) return;
  const card = readCard(tt), target = last && NOW() - last.t < 4000 ? last.target : null;
  let rows = [], suppress = false, state = "plain", seenText = "";
  let trim = false;
  if (target && target.isConnected !== false) {
    try {
      const d = describe(target, card), visible = visibleText(scopeOf(target));
      seenText = visible;
      if (d) rows = extrasFor(d.kind, d.f, visible + " " + card.text, card.rows.length >= 4 ? 2 : Infinity);
      const emptyBar = d && d.kind === "bin" && card.rows.length <= 1 && card.rows.every((r) => [...numbersOf(r.value)].every((n) => n === "0"));          // a bar of no town
      suppress = emptyBar || (!rows.length && isRedundant(card.text, visible));
      trim = !suppress;
    } catch (e) { rows = []; suppress = false; trim = false; }          // the card the old module built stays as it is
    state = suppress ? "off" : rows.length ? "plus" : "plain";
  }
  mo.disconnect();
  try {
    tt.dataset.nRaw = card.text;
    if (trim) {
      tt.dataset.nTrim = String(trimSeen(tt, seenText));
      if (!rows.length && ![...tt.children].some((c) => !c.classList.contains("th"))) { suppress = true; state = "off"; }          // only the head is left: it is the name of the mark, already on the page
    }
    tt.dataset.nTip = state;
    for (const r of rows) tt.append(rowNode(r));
    tt.hidden = suppress;
    shownByTouch = !suppress && last && last.touch ? { target: last.target, t: NOW() } : null;
    if (rows.length) keepInside(tt);
  } finally { mo.observe(tt, { childList: true, attributes: true, attributeFilter: ["class"] }); }
}

// a title (the browser's own hover text) that says exactly what its element already says is dropped before it shows; one that completes a cut-off text stays
function dropRedundantTitle(ev) {
  const el = ev.target && ev.target.closest && ev.target.closest("[title]");
  if (!el || el.closest("abbr") || el.namespaceURI !== "http://www.w3.org/1999/xhtml") return;
  const title = el.getAttribute("title") || "", cut = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
  if (!cut && isRedundant(title, visibleText(el))) { el.setAttribute("data-n-title", title); el.removeAttribute("title"); }
}

async function warm() {
  if (warmed) return;
  warmed = true;
  try { const net = await import("../net.js"); setMeta(await net.meta()); } catch (e) { /* the catalogue is optional: the cards then carry what the model has */ }
}

export function installTips() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  import("../city/data.js").then((m) => { D = m; }, () => {});
  tip.hide();                                              // makes the shared element exist
  ttEl = document.querySelector(".tt");
  if (!ttEl) return;
  mo = new MutationObserver(refine);
  mo.observe(ttEl, { childList: true, attributes: true, attributeFilter: ["class"] });
  const release = () => { held = null; shownByTouch = null; if (ttEl.classList.contains("on")) ttEl.classList.remove("on"); };
  const mark = (kind) => (ev) => {
    warm();
    last = { target: ev.target, x: ev.clientX, y: ev.clientY, t: NOW(), pointer: kind === "pointer", touch: ev.pointerType === "touch", type: ev.type };
    if (held && ev.type === "pointerdown" && !(held.mark && held.mark.contains && held.mark.contains(ev.target))) release();
    // a tap sends no pointermove, and most marks show their card on a pointermove: when nothing showed, the touch point is handed to the mark as a move (a link or a button keeps its own job)
    if (ev.type === "pointerdown" && ev.pointerType === "touch") {
      const t = ev.target, init = { bubbles: true, cancelable: true, composed: true, clientX: ev.clientX, clientY: ev.clientY, pointerType: "touch", pointerId: ev.pointerId, isPrimary: true };
      setTimeout(() => { if (t && t.isConnected && !ttEl.classList.contains("on") && !(t.closest && t.closest("a[href], button, input, select, textarea"))) t.dispatchEvent(new PointerEvent("pointermove", init)); }, 0);
    }
  };
  for (const t of ["pointermove", "pointerdown", "pointerup", "pointerleave", "pointerout", "pointercancel"]) document.addEventListener(t, mark("pointer"), true);
  document.addEventListener("focus", mark("key"), true);
  document.addEventListener("keydown", (ev) => { last = { target: ev.target, x: 0, y: 0, t: NOW(), pointer: false, touch: false, type: "keydown" }; if (held && ev.key === "Escape") release(); }, true);
  window.addEventListener("scroll", () => { if (held) release(); }, { passive: true });
  document.addEventListener("mouseover", dropRedundantTitle, true);
}
