// One indicator (SPEC 4.4 and 5.4): the old page on the pale band, with the figure and its chart inside it. New here: the crumbs (town, then the question the reader came from or the domain, then the indicator),
// "back to the answer", the previous and next figure of the domain, the row of actions (the series as a CSV file, share, print, report a mistake) and the explained words.
// Nothing is fetched here (the question's name comes from the home's own copy table when that module exists).
import { h, icon, ltr, num, fmtVal, deltaUnit } from "../../ui.js";
import { actionsRow } from "../kit/actions.js";
import { termButton } from "../kit/term.js";
import { readFrom } from "../kit/from.js";
import * as G from "../kit/guide.js";
import * as D from "../city/data.js";

const hrefI = (key, id) => `#/c/${encodeURIComponent(key)}/i/${encodeURIComponent(id)}`;

// the name of the question the reader came from: the home's copy table when it is there, else a plain word
async function questionName(qid) {
  try {
    const m = await import("../city/copy.js");
    const q = (m.QUESTIONS || []).find((x) => String(x.id) === String(qid));
    const name = q && [q.short, q.label, q.title, q.text].find((s) => typeof s === "string" && s);
    if (name) return name;
  } catch (e) { /* the home is not part of this build: the plain word */ }
  return "התשובה";
}

// the series of the figure, in the words of the page (the old page offered the same numbers in English headers)
export function seriesRows(a, calm = false) {
  const own = [{ title: "שנה", get: (s) => s.year }, { title: "ערך", get: (s) => s.v }, { title: "בסיס החישוב", get: (s) => (s.d == null ? "" : s.d) }];
  const against = [{ title: "ארצי", get: (s) => (s.nat == null ? "" : s.nat) }, { title: "יישובים דומים (ערך אמצעי)", get: (s) => (s.peer == null ? "" : s.peer) }, { title: "יעד", get: (s) => (s.target == null ? "" : s.target) }];
  return { rows: a.series || [], columns: calm ? own : [...own, ...against] };          // the file of a figure that gets no comparison has none either
}

// ── a background figure of a very small town (city/data.js isCalmFigure): its own numbers, and no standing ──
// The old page sets every figure against the nation, similar towns and a place among all towns. Here the chips against them, the meter, the map of places, the ranked lists and the national lines of the history leave;
// the figure, its trend since the first year, its own values by year and one plain line remain.
const AGAINST = /ארצי|יישובים דומים|ערך אמצעי|יעד/;
function amount(unit, v) { return [ltr(num(Math.abs(v), 1)), deltaUnit(unit)]; }
function ownSentence(a) {
  const s = (a.series || []).filter((p) => Number.isFinite(p.v)), hi = a.history || {};
  if (s.length < 2) return null;
  const first = s[0], last = s[s.length - 1], delta = last.v - first.v;
  const verb = delta === 0 ? "לא השתנה" : (hi.trendClass === "stable" ? (delta > 0 ? "עלה מעט" : "ירד מעט") : delta > 0 ? "עלה" : "ירד");
  return ["בין ", ltr(String(first.year)), " ל-", ltr(String(last.year)), " הערך ", verb, delta !== 0 ? [" ב-", ...amount(a.unit, delta)] : null, ", מ-", ltr(fmtVal(a.unit, first.v)), " ל-", ltr(fmtVal(a.unit, last.v)), "."];
}
function ownHistory(node, a, name) {
  const sec = node.querySelector("#history"), plot = sec && sec.querySelector(".in-plot");
  if (!plot) return;
  const lead = sec.querySelector(".sec-lead");
  if (lead) lead.textContent = "הערכים בכל שנה, בלי השוואה: הקבוצה קטנה מכדי להסיק ממנה.";
  const toggle = sec.querySelector(".viewtoggle");
  if (toggle) toggle.remove();
  const rows = (a.series || []).filter((p) => Number.isFinite(p.v)), withBase = rows.some((p) => Number.isFinite(p.d));
  const read = sec.querySelector(".in-read"), sentence = ownSentence(a);
  plot.replaceChildren(h("div.tscroll", h("table.tbl.n-pg-indicator-own",
    h("caption.sr", `${a.label} ב${name}, לפי שנה`),
    h("thead", h("tr", h("th", { scope: "col" }, "שנה"), h("th.n", { scope: "col" }, name), withBase ? h("th.n", { scope: "col" }, "גודל הקבוצה") : null)),
    h("tbody", rows.map((p) => h("tr", h("td", ltr(String(p.year))), h("td.n", ltr(fmtVal(a.unit, p.v))), withBase ? h("td.n", Number.isFinite(p.d) ? ltr(num(p.d, 0)) : "") : null))))));
  if (read) read.replaceWith(sentence ? h("p.in-read.rv", icon("pulse"), h("span", sentence)) : "");
}
function calm(node, hero, a, name) {
  hero.querySelectorAll(".in-meter, .in-unitnote").forEach((el) => el.remove());
  const chips = hero.querySelector(".in-chips");
  if (chips) {
    chips.querySelectorAll(".in-chip").forEach((li) => { if (AGAINST.test(li.textContent)) li.remove(); });
    if (!chips.children.length) chips.remove();
    else if (a.unit === "%") chips.after(h("p.in-unitnote.rv", "נק׳ = נקודות אחוז: ההפרש בין שני אחוזים."));
  }
  const tail = hero.querySelector(".in-tail");
  if (tail) tail.prepend(h("p.n-pg-indicator-nocmp", D.NO_COMPARISON, " ", termButton("small", "מה זה קבוצה קטנה?")));
  ownHistory(node, a, name);
  node.querySelectorAll("#where, #peers").forEach((sec) => sec.remove());          // the place among all towns and the list of similar towns
  const toc = node.querySelector(".toc");
  if (toc) {
    toc.querySelectorAll(".chip").forEach((b) => { if (/^(המקום בין היישובים|יישובים דומים)$/.test(b.textContent.trim())) b.remove(); });
    if (toc.querySelectorAll(".chip").length < 2) toc.remove();
  }
  node.querySelectorAll("section.sec").forEach((sec, i) => { const b = sec.querySelector(".sec-eyebrow b"); if (b) b.textContent = String(i + 1).padStart(2, "0"); });
}

// ── the official reference of the figure (kit/guide.js panelOf): the target and where the figure stands against it, or the reference that is only shown, or why there is none ──
// A quiet block between the hairlines of the hero's tail: a small label, one or two sentences, the caveat in small type and the link to the document. No box, no stripe.
export function guidePanel(a) {
  const p = G.panelOf(a), id = "n-pg-indicator-guide-h";
  const src = p.source ? h("a.n-kit-link", { href: p.source.url, target: "_blank", rel: "noopener" }, (p.kind === "bench" ? "מקור נקודת הייחוס: " : "מקור היעד: ") + p.source.label, h("span.sr", " (נפתח בלשונית חדשה)")) : null;
  return h("section.n-pg-indicator-guide.is-" + p.kind, { "aria-labelledby": id },
    h("h2.n-pg-indicator-guide-h", { id }, p.label),
    p.lines.map((l, i) => h("p.n-pg-indicator-guide-l" + (i === 0 ? ".is-main" : l.em ? ".is-state" : ""), l.t)),
    p.note ? h("p.n-pg-indicator-guide-note", p.note) : null,
    src ? h("p.n-pg-indicator-guide-src", src) : null);
}
// "נק׳" is the short form of "נקודות אחוז": the first one on the page is spelled out (when the sentence under the title already spelled it, nothing is left to do), the later ones stay short and the line with the explanation is below
export function spellFirstPoint(root) {
  let done = false;
  const visit = (n) => {
    if (done) return;
    if (n.nodeType === 3) {
      const t = String(n.nodeValue);
      if (t.includes("נקודות אחוז")) done = true;
      else if (t.includes("נק׳")) { n.nodeValue = t.replace(/([\s ]*)נק׳/, (m, sp) => (sp || " ") + "נקודות אחוז"); done = true; }
    } else if (n.nodeType === 1) for (const c of [...n.childNodes]) visit(c);
  };
  visit(root);
}
// a target that judges is said by the panel: the old chip with the same number leaves (the dial keeps its mark)
function dropTargetChip(hero) {
  hero.querySelectorAll(".in-chips .in-chip").forEach((li) => { const ref = li.querySelector(".in-chip-ref"); if (ref && /^יעד\s/.test(ref.textContent.trim())) li.remove(); });
  const chips = hero.querySelector(".in-chips");
  if (chips && !chips.children.length) chips.remove();
}

// the previous and the next figure of the domain, in the order of the model
function steps(model, a) {
  const list = model.indicators.filter((x) => x.domain === a.domain && x.last), i = list.findIndex((x) => x.id === a.id);
  if (i < 0 || list.length < 2) return null;
  const dom = model.domains.find((d) => d.id === a.domain), name = (x) => x.short || x.label;
  const one = (x, cls, ic, word) => (x ? h("a.n-pg-indicator-step." + cls, { href: hrefI(model.city.key, x.id) }, icon(ic, 16), h("span", h("small", word), h("b", name(x)))) : h("span"));
  return h("nav.n-pg-indicator-steps.no-print", { "aria-label": "מדדים נוספים בתחום" },
    one(list[i - 1], "is-prev", "right", "המדד הקודם"),
    h("span.n-pg-indicator-pos", `מדד ${i + 1} מתוך ${list.length} ב${dom ? dom.label : "תחום"}`),
    one(list[i + 1], "is-next", "left", "המדד הבא"));
}

export async function adapt(node, ctx) {
  const hero = node.querySelector(".in-hero");
  if (!hero) return node;
  const { model } = ctx, key = model.city.key, a = model.indicators.find((x) => x.id === ctx.parts[3]);
  if (!a) return node;
  const isCalm = D.isCalmFigure(model, a);
  const dom = model.domains.find((d) => d.id === a.domain), name = a.short || a.label, town = { label: model.city.name, href: `#/c/${encodeURIComponent(key)}` };
  const qid = readFrom(key), qname = qid ? await questionName(qid) : null;

  // crumbs: town > question > figure, or town > domain > figure
  ctx.setCrumbs([town, qid ? { label: qname, href: `#/c/${encodeURIComponent(key)}?q=${encodeURIComponent(qid)}` } : { label: dom ? dom.label : "תחום", href: `#/c/${encodeURIComponent(key)}/d/${encodeURIComponent(a.domain)}` }, { label: name }]);

  // the top line of the band: the domain, and the way back to the answer
  const crumb = hero.querySelector(".in-crumb");
  if (crumb && qid) {
    const top = h("div.n-pg-indicator-top.no-print", h("a.n-pg-indicator-back", { href: `#/c/${encodeURIComponent(key)}?q=${encodeURIComponent(qid)}` }, icon("right", 16), "חזרה לתשובה"));
    crumb.replaceWith(top);       // the crumb goes into its own row, in the place it had (moving it into the row first would detach its sibling)
    top.prepend(crumb);
  }

  // the row of actions replaces the old buttons
  const old = hero.querySelector(".hero-actions");
  const row = actionsRow({ variant: "hero", items: ["share", "download", "print", "report"], key, icons: true, label: "פעולות בדף המדד", title: a.label, shareHref: () => location.href,
    download: { getRows: () => seriesRows(a, isCalm), name: "indicator-" + a.id, label: "הורדת נתוני המדד" }, feedback: () => ({ key, name: model.city.name, indicator: a.id, dataDate: model.builtAt }) });
  if (old) old.replaceWith(h("div.n-pg-indicator-actions.no-print", row));

  // the explained words (a figure with no comparison has no similar towns and no place to explain: it explains the small group)
  const chips = hero.querySelector(".in-chips");
  if (chips && !isCalm) chips.after(h("p.n-pg-indicator-terms", termButton("peers", "מה זה יישובים דומים?")));
  const cap = hero.querySelector(".in-meter-cap");
  if (cap && !isCalm) cap.append(" ", termButton("rank", "איך נקבע המקום?"));
  if (isCalm) calm(node, hero, a, model.city.name);
  const small = hero.querySelector(".in-small-t");
  if (small) small.after(h("p.n-pg-indicator-terms", termButton("small", "מה זה קבוצה קטנה?")));
  // the sentence under the title: for a figure with an official target it names the target (and says so when it is met, whatever else decides the status)
  const why = G.reasonOf(a), reason = hero.querySelector(".in-reason");
  if (why && reason) reason.textContent = why;
  // the official reference (or the plain line that there is none), above the line of the data source
  const panel = guidePanel(a), tail = hero.querySelector(".in-tail");
  if (G.kindOf(a) === "target") dropTargetChip(hero);
  const srcLine = tail && tail.querySelector(".srcline");
  if (srcLine) G.respellTree(srcLine);
  if (tail) (srcLine ? srcLine.before(panel) : tail.append(panel));
  spellFirstPoint(hero);

  const st = steps(model, a);
  if (st) node.prepend(st);
  return node;
}
