// The briefing "דוח ליישוב" (SPEC 5.3): one deterministic document about one town, to read on a screen and to print on A4 or save as PDF. Everything it says is in doc.js; this file
// draws it. The paper column is 820 px on the same tokens as every page; css/product/brief.css (prefix n-brief-) holds the screen and the print sheet.
// No band: the document opens with its own header (the leaf logo, the title, the facts). The only h1 of the page is the title.
import { h, icon, ltr, logoMark, directionIcon } from "../../ui.js";
import * as net from "../net.js";
import { infoHref } from "../nav.js";
import { act, announce, setActLabel } from "../kit/base.js";
import { csvLink, exportHref } from "../kit/csv.js";
import { copyText, showLink } from "../kit/share.js";
import * as D from "../city/data.js";
import * as P from "../city/parts.js";
import { briefDoc } from "./doc.js";
import { watchPrint } from "./print.js";

const enc = encodeURIComponent;
// a number inside Hebrew text keeps its order; the words around it stay in the Hebrew flow
const numbers = (text) => String(text).split(/(₪?\d[\d.,]*%?)/).map((t, i) => (i % 2 ? ltr(t) : t));
const still = (node) => { node.querySelectorAll("[data-count]").forEach((e) => e.removeAttribute("data-count")); return node; };      // a document does not count up

// ── the actions above the sheet (never printed): print, copy the link, download the table, back to the town ──
function actions(key) {
  const print = act("button", { type: "button" }, "print", "הדפסה / PDF");
  print.addEventListener("click", () => window.print());
  let timer;
  const copy = act("button", { type: "button" }, "link", "העתקת קישור");
  copy.addEventListener("click", async () => {
    const url = location.href;
    if (!(await copyText(url))) { showLink(url, copy); return; }
    announce("הקישור הועתק");
    setActLabel(copy, "check", "הקישור הועתק");
    clearTimeout(timer);
    timer = setTimeout(() => setActLabel(copy, "link", "העתקת קישור"), 2400);
  });
  const csv = csvLink(exportHref(key), "הורדת כל נתוני היישוב");          // the whole-town file, as on the home
  csv.setAttribute("aria-label", "הורדת כל נתוני היישוב (קובץ CSV)");          // the file type is said once, to the screen reader
  return h("div.n-kit-actions", { role: "group", "aria-label": "פעולות על הדוח" }, print, copy, csv);
}

// ── the header: the mark, the title, who the numbers are about, how much they rest on ──
function header(doc) {
  const facts = doc.facts.map((f, i) => [i ? h("span.n-brief-dot", { "aria-hidden": "true" }, "·") : null, h("span", numbers(f))]);
  return h("header.n-brief-head",
    h("div.n-brief-brand", logoMark("auto"), h("span.n-brief-wordmark", "CityPulse"), h("span.n-brief-kind", "דוח ליישוב")),
    h("h1.n-brief-title", { id: "n-h1", tabindex: "-1" }, doc.title),
    facts.length ? h("p.n-brief-facts", facts) : null,
    // the basis line breaks between its parts, never inside the date
    h("p.n-brief-basis", [doc.basis.head + doc.basis.tail, ...doc.basis.rest].map((t, i) => [i ? h("span.n-brief-dot", { "aria-hidden": "true" }, " · ") : null, h(i ? "span.n-brief-nb" : "span", numbers(t))])));
}

// a heading with the line that says what the block shows
const heading = (sec, id) => [h("h2.n-brief-h", { id }, sec.heading), sec.sub ? h("p.n-brief-sub", sec.sub) : null];
// the sentence of an answer, its lede (segments of city/sentence.js: a number is isolated, a name is a link)
const say = (key, s, cls = "") => [h("p.n-brief-say.is-" + s.kind + cls, { "aria-label": s.plain }, still(h("span", { "aria-hidden": "true" }, P.segs(s.segs, key)))),
  s.lede && s.lede.length ? h("p.n-brief-lede", P.segs(s.lede, key)) : null];
const link = (key, id, text) => h("a.n-brief-link", { href: P.hrefI(key, id) }, text);
const status = (st) => h("b.n-home-st.t-" + st.tone, icon(st.icon), st.word);

// ── 2. the weakest five (or the numbers that exist, on groups too small to judge) ──
function weakestTable(key, model, sec) {
  const byId = new Map(model.indicators.map((a) => [a.id, a])), id = "n-brief-t-weakest";
  const head = sec.small
    ? [["figure", "מדד"], ["value", "הערך"], ["year", "שנה"], ["cases", "מבוסס על (קבוצה קטנה)"], ["dir", "מה טוב"]]
    : [["figure", "מדד"], ["value", "הערך"], ["year", "שנה"], ["nat", "ארצי"], ["place", "המקום בין היישובים"], ["dir", "מה טוב"]];
  const dirIcon = (r) => (r.dir === "גבוה טוב" ? "up" : r.dir === "נמוך טוב" ? "downarrow" : "minus");
  const cell = (label, ...kids) => h("td", { "data-label": label }, ...kids);
  const body = sec.rows.map((r) => {
    const a = byId.get(r.id), cases = sec.small ? (P.casesOf(a) || "").replace(/^ · /, "") : "";
    return h("tr",
      h("th.n-brief-fig", { scope: "row" }, link(key, r.id, r.name), sec.small ? null : h("span.n-brief-st", status(r.status), r.target ? [" ", h("span.n-brief-target", numbers(r.target))] : null)),
      cell("הערך", h("b.n-brief-val", numbers(r.value))), cell("שנה", ltr(r.year)),
      sec.small ? cell("מבוסס על", cases ? numbers(cases) : "—") : [cell("ארצי", r.nat ? numbers(r.nat) : "—"), cell("המקום בין היישובים", r.place || "—")],
      cell("מה טוב", h("span.n-brief-dir", icon(dirIcon(r), 15), r.dir)));
  });
  return h("table.n-brief-table", { "aria-labelledby": id }, h("thead", h("tr", head.map(([k, t]) => h("th.n-brief-c-" + k, { scope: "col" }, t)))), h("tbody", body));
}
function weakest(key, model, sec) {
  const id = "n-brief-h-weakest";
  return h("section.n-brief-sec", { "aria-labelledby": id, "data-sec": "weakest" },
    heading(sec, id),
    sec.table ? (sec.rows.length ? weakestTable(key, model, sec) : null) : h("p.n-brief-say.is-calm.n-brief-small", sec.empty));
}

// ── 3. what changed most ──
function changes(key, sec) {
  const id = "n-brief-h-changes";
  return h("section.n-brief-sec", { "aria-labelledby": id, "data-sec": "changes" },
    heading(sec, id), say(key, sec.said, ".n-brief-small"),
    sec.rows.length ? h("ul.n-brief-changes", sec.rows.map((r) => h("li", link(key, r.id, r.name), h("p", h("b.n-brief-move.t-" + r.tone, r.word), ": ", numbers(r.text))))) : null);
}

// ── 4. next to similar localities ──
function peers(key, sec) {
  const id = "n-brief-h-peers", t = sec.tell;
  return h("section.n-brief-sec", { "aria-labelledby": id, "data-sec": "peers" },
    heading(sec, id), say(key, sec.said, ".n-brief-small"),
    t ? h("div.n-brief-tell", h("h3.n-brief-h3", t.label), h("p.n-brief-tell-name", link(key, t.id, t.name), " ב-", ltr(t.year)),
      h("ul.n-brief-marks", t.marks.map((m) => h("li.k-" + m.k, h("span.n-brief-mark-l", h("i", { "aria-hidden": "true" }), m.label), h("b", numbers(m.value))))),
      h("p.n-brief-note", t.place ? [numbers(t.place), ". "] : "", t.direction ? t.direction + "." : "")) : null);
}

// ── 5. what to do first ──
function first(key, sec) {
  const id = "n-brief-h-first";
  return h("section.n-brief-sec", { "aria-labelledby": id, "data-sec": "first" },
    heading(sec, id), say(key, sec.said, ".n-brief-small"),
    sec.prepare ? h("p.n-brief-prepare", icon("info", 16), h("span", h("b", sec.prepare.head), " ", sec.prepare.text)) : null,
    sec.facts.length ? h("dl.n-brief-kv", sec.facts.map(([k, v]) => h("div", h("dt", k), h("dd", numbers(v))))) : null,
    sec.why ? h("p.n-brief-why", h("b", "למה דווקא זה: "), numbers(sec.why)) : null);
}

// ── 6. what is missing ──
function missing(key, sec) {
  const id = "n-brief-h-missing";
  return h("section.n-brief-sec", { "aria-labelledby": id, "data-sec": "missing" },
    heading(sec, id), say(key, sec.said, ".n-brief-small"),
    sec.groups.length ? h("ul.n-brief-miss", sec.groups.map((g) => h("li", h("p.n-brief-miss-names", g.names.join(" · ")), h("p.n-brief-miss-why", g.why)))) : null,
    sec.note ? h("p.n-brief-note.no-print", sec.note, " ", h("a.n-brief-link", { href: `#/c/${enc(key)}/coverage` }, "לכיסוי הנתונים ←")) : null);
}

// ── 7. how to read ──
function howto(sec) {
  const id = "n-brief-h-howto";
  return h("section.n-brief-sec.n-brief-howto", { "aria-labelledby": id, "data-sec": "howto" },
    heading(sec, id), h("ul", sec.lines.map((l) => h("li", h("b", l.question), " ", l.text))));
}

// ── the foot: where the figures come from, what the picture is for, where this page lives ──
function foot(doc, key) {
  const f = doc.foot;
  return h("footer.n-brief-foot",
    h("p.n-brief-prov", [f.sources, f.years, f.updated].filter(Boolean).join(" "), " ", h("a.n-brief-link.no-print", { href: infoHref("method", key) }, "איך מחושבים המספרים ←")),
    h("p.n-brief-statement", f.statement),
    h("p.n-brief-url", { dir: "ltr" }, h("span", { "data-url": "" }, location.href)),
    h("p.n-brief-printed", { "data-printed": "" }));
}

export async function briefView(ctx) {
  const model = ctx.model, key = String(model.city.key);
  let meta = null;
  if (D.townKind(model) !== "uncovered") { try { meta = await net.meta(); } catch (e) { /* the list of missing figures is left out; the sentence stays */ } }
  const doc = briefDoc(model, { meta }), S = Object.fromEntries(doc.sections.map((s) => [s.id, s]));
  const lead = h("section.n-brief-sec.n-brief-lead", { "aria-label": "המצב בקצרה", "data-sec": "lead" },
    h("h2.sr", "המצב בקצרה"), say(key, S.lead.said),
    doc.kind === "uncovered" ? null : h("div.n-brief-status", still(P.ledger(model) || h("span"))));
  const sheet = h("article.n-brief-paper", { "aria-labelledby": "n-h1" }, header(doc), lead, weakest(key, model, S.weakest), changes(key, S.changes), peers(key, S.peers), first(key, S.first), missing(key, S.missing), howto(S.howto), foot(doc, key));
  const node = h("div.n-brief",
    h("div.n-brief-bar.no-print", h("a.n-brief-back", { href: `#/c/${enc(key)}` }, icon("right", 16), "חזרה לדף היישוב"), actions(key)),
    sheet);
  watchPrint(node, { signal: ctx.signal });
  return { node, band: false, active: "brief" };
}
