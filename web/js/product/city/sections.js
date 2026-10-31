// The sections of the one town page (city/home.js): what each part of the story is made of. Class prefix n-home- (css/product/home.css).
// The story, in this order, on both levels of the page: how things stand, what goes well, what needs attention, [what changed, next to similar towns],
// what to do, what is missing, the foot. A section with nothing honest to say is dropped (a builder returns null) or is one quiet line, never an empty template.
// The choices (which rows, how many) live in simple/model.js, the sentences in simple/words.js and city/sentence.js, the evidence blocks of the long
// answers in city/answers.js; this file only draws them. One segmented bar (the verdict and every category row), one row (the good and the attention lists).
import { h, icon, ltr } from "../../ui.js";
import { viz } from "../../viz/core.js";
import { nodataSpot } from "../band.js";
import { provenanceParts } from "../kit/provenance.js";
import { cntOf } from "../kit/plural.js";
import { glossaryHref } from "../kit/glossary.js";
import { infoHref } from "../nav.js";
import { catArt } from "../kit/catart.js";
import * as D from "./data.js";
import * as S from "./sentence.js";
import * as P from "./parts.js";
import * as A from "./answers.js";
import { T as HOME } from "./copy.js";
import * as M from "../simple/model.js";
import { T, plainOf, verdictSegs, legendOf, legendPlain, restLine, whyLine, missingLines, catSegs, attLead, targetLede } from "../simple/words.js";

const enc = encodeURIComponent;
export const SECTION = { weak: "n-sec-weak", changed: "n-sec-changed", peers: "n-sec-peers", first: "n-sec-first", missing: "n-sec-missing" };   // the ?q= ids of the page and their sections
export const hrefD = P.hrefD, hrefI = P.hrefI;

// a sentence made of segments: a number is isolated so that its digits keep their order inside Hebrew
const segs = (list) => list.map((s) => (typeof s === "string" ? s : h("b.n-home-n.ltr" + (s.tone ? ".t-" + s.tone : ""), s.n)));
const value = (p) => [ltr(p.n), p.w ? " " + p.w : ""];
// a catalogue label: a number or a range ("2–3") is isolated so that its digits keep their order inside the Hebrew
const labelNodes = (t) => String(t).split(/(\d+(?:[.,–-]\d+)*)/).map((x, i) => (i % 2 ? ltr(x) : x));
// the cases behind a figure on a small group: " (1 מתוך 1)" for a share, " (3 מקרים)" for a count
const casesNodes = (c) => (!c ? "" : c.d != null ? [" (", ltr(String(c.n)), " מתוך ", ltr(String(c.d)), ")"] : [" (", c.n === 1 ? cntOf(1, "case") : [ltr(String(c.n)), " מקרים"], ")"]);

// a section: its id is the one the page, the index, ?q= and the tools know; the heading is what the index and the focus go to
export function section(id, title, ...kids) {
  return h("section.n-home-sec.rv#" + id, { "aria-labelledby": id + "-h" }, h("h2.n-home-h#" + id + "-h", title), ...kids);
}
const line = (text) => h("p.n-home-line", text);
const textLink = (href, text, onclick) => P.textLink(href, text, onclick);

// ═════════ the one segmented bar: the verdict (with its words) and every category row ═════════
export function segBar(counts, cls = "") {
  const parts = legendOf(counts);
  return viz(h("div.n-home-bar" + (cls ? "." + cls : ""), { "aria-hidden": "true" }, parts.map((x, i) => h("i.n-home-seg.is-" + x.id + ".grow-x", { style: { flexGrow: x.n, "--i": i } }))));
}
const legend = (counts) => h("ul.n-home-legend", { "aria-label": legendPlain(counts) }, legendOf(counts).map((x) => h("li", h("i.n-home-key.is-" + x.id, { "aria-hidden": "true" }), h("b.n-home-ln.ltr", String(x.n)), " ", x.label)));

// the categories (not the background), the one with the largest share of figures that need treatment first; the order of the by-category rows and of the attention groups
export function categoriesOf(model) {
  return model.domains.filter((d) => !d.background && d.indicators.length).map((d) => {
    const c = d.counts || {}, m = D.domainJudged(c), k = c.concern || 0;
    return { d, k, m, counts: { concern: k, watch: c.watch || 0, good: (c.good || 0) + (c.strength || 0) } };
  }).sort((x, y) => (y.m ? y.k / y.m : -1) - (x.m ? x.k / x.m : -1) || (D.isNum(x.d.standing) ? x.d.standing : 1000) - (D.isNum(y.d.standing) ? y.d.standing : 1000) || y.k - x.k || x.d.id.localeCompare(y.d.id));
}

// ═════════ 1. how things stand ═════════
export function stateSection(model, v, { key, level }) {
  const name = model.city.name, full = level === "full", sv = verdictSegs(v, name), answer = S.answer(model, "weak"), kids = [];
  kids.push(h("h2.n-home-sentence.is-" + (v.kind === "full" ? "answer" : "calm") + (plainOf(sv).length > 60 && v.kind === "full" ? ".is-long" : ""), { id: "n-home-answer", tabindex: "-1", "aria-label": plainOf(sv) }, h("span", { "aria-hidden": "true" }, P.segs(sv, key))));
  if (v.kind === "full") {
    kids.push(segBar(v.counts), legend(v.counts));
    // how many of the figures that have an official target meet it, in the town and in the country as a whole (only when the town has such figures)
    const off = M.officialOf(model), offLede = off.n ? h("p.n-home-lede.n-home-offi", segs(targetLede(off))) : null;
    if (!full && offLede) kids.push(offLede);
    // the four categories, each with its own count and bar: the overview of the town, on both levels
    const cats = categoriesOf(model), catsNode = cats.length ? h("div.n-home-cats-wrap", h("p.n-home-cap", T.byCat), h("ul.n-home-cats", cats.map(({ d, k, m, counts }) => h("li.n-home-cat",
      h("div.n-home-cat-id", catArt(d.id, 40, "n-home-cat-ico"), h("a.n-home-cat-name", { href: hrefD(key, d.id) }, d.label)), h("p.n-home-cat-say", segs(catSegs(k, m))), m ? segBar(counts, "is-small") : null)))) : null;
    if (full) {
      // the denominators and what is left out, in one quiet sentence (C-11, C-13)
      if (answer.lede.length) kids.push(h("p.n-home-lede", P.segs(answer.lede, key)));
      if (offLede) kids.push(offLede);
    }
    if (catsNode) kids.push(catsNode);
  } else if (full && answer.lede.length) kids.push(h("p.n-home-lede", P.segs(answer.lede, key)));
  return h("section.n-home-sec.n-home-state.rv#n-sec-state", { "aria-labelledby": "n-home-answer" }, ...kids);
}

// ═════════ rows: what is measured, the town against the country, which way is good ═════════
// One bar per figure (a bullet graph, after Few): the town's value is the bar, the country's value is a diamond on the same scale, the official target (when the figure
// has one and it is a percentage) is a thin tick. The town's value stands beside the bar in numbers with its name under it, the country's value under the bar with its mark:
// no mark is left to be guessed (the words under the bar say the same as the bar)
function bars(row, name) {
  const tick = row.tgt && row.tgt.tick != null ? h("i.n-home-tick", { style: { insetInlineStart: row.tgt.tick + "%" } }) : null;
  const natMark = row.nat && row.widths.nat != null ? h("i.n-home-natmark", { style: { insetInlineStart: row.widths.nat + "%" } }) : null;
  const track = h("span.n-home-track", { "aria-hidden": "true" }, h("i.n-home-fill.is-town.grow-x", { style: { width: row.widths.town + "%" } }), natMark, tick);
  return viz(h("div.n-home-bars", track, h("span.n-home-who", h("i.n-home-dot.is-town", { "aria-hidden": "true" }), name), h("b.n-home-val", [ltr(row.town.n), row.town.w ? h("span.n-home-unit", row.town.w) : ""]),
    row.nat ? h("span.n-home-natkey", h("i.n-home-dot.is-nat", { "aria-hidden": "true" }), T.who.nat, " ", h("b.n-home-natval", value(row.nat))) : null));
}
// the quiet line of a figure with an official target: "יעד רשמי: לפחות 80% · רחוק מהיעד." (the word of where it stands is the only bold part; the colour never carries it)
const tgtLine = (t) => h("p.n-home-tgt.is-" + t.state, t.tick != null ? h("i.n-home-dot.is-tgt", { "aria-hidden": "true" }) : null, D.tgtSegs(t).map((x) => (typeof x === "string" ? x : x.b ? h("b.n-home-tgt-w", x.b) : h("span.n-home-tgt-aside", x.aside))));
// ctx: { key, name, words (the way line), full, byId (the figures of the model) }
// A figure that needs treatment or follow-up says so with its cause on both levels ("דורש טיפול כי המגמה בהידרדרות."); the full level adds the place among all the localities
// (never for a figure without a place; the colour is never alone: icon and word)
function item(row, ctx) {
  const way = row.dir ? h("p.n-home-way", icon(row.dir === "higher" ? "up" : "downarrow", 20), ctx.words[row.dir]) : null, a = ctx.full ? ctx.byId.get(row.id) : null;
  const rank = a && a.last && D.rankText(a.last) ? [" ", h("span.n-home-nb", D.rankText(a.last)), (D.lastPlace(a.last) ? (a.last.of >= 100 ? ", האחרון בארץ" : ", האחרון מביניהם") : "") + "."] : "";          // "מקום 124 מתוך 184 יישובים" never breaks between its words
  const st = row.status === "concern" || row.status === "watch" ? h("p.n-home-rowst", P.statusWord({ tone: D.statusTone(row.status), icon: D.statusIcon(row.status), word: D.statusWord(row.status) }), row.cause ? [" ", segs(row.cause)] : "", rank) : null;
  return h("li.n-home-item", h("h3.n-home-what", h("a.n-home-what-a", { href: hrefI(ctx.key, row.id) }, labelNodes(row.label))), bars(row, ctx.name),
    h("div.n-home-says", row.tgt ? tgtLine(row.tgt) : null, st, row.nat ? null : h("p.n-home-note", T.noNat), way));
}
const list = (rows, ctx) => h("ul.n-home-list", rows.map((r) => item(r, ctx)));
const rowCtx = (model, c, words) => ({ key: c.key, name: model.city.name, words, full: c.level === "full", byId: new Map(model.indicators.map((x) => [x.id, x])) });

// ═════════ 2. what goes well ═════════
export function goodSection(model, c) {
  const g = M.goodOf(model, c.level === "full" ? 6 : 3), rc = rowCtx(model, c, T.wayGood);
  // a figure with no official target is judged by the country's average and the trend alone: said once, when the section holds such a figure
  const lede = g.rows.some((r) => M.hasNoOfficial(rc.byId.get(r.id))) ? h("p.n-home-lede", T.goodLede) : null;
  return section("n-sec-good", T.h.good, ...(g.rows.length ? [lede, list(g.rows, rc)] : [line(T.noGood)]));
}

// ═════════ 3. what needs attention ═════════
// the full level shows the figures category by category, as an accordion (overview first, details on demand): the summary row says how many need what, all closed (a link that asks for them opens every one),
// and a link that asks to see all of them ("?q=weak", the "see all" link of the short level) opens every one (city/home.js reveal)
function grp(g, i, rc, c) {
  const chev = icon("down", 20); chev.classList.add("n-home-grp-chev");
  const nc = g.rows.filter((r) => rc.byId.get(r.id).status === "concern").length, nw = g.rows.length - nc;
  const st = [nc ? (nc === 1 ? "אחד דורש טיפול" : nc + " דורשים טיפול") : null, nw ? (nw === 1 ? "אחד למעקב" : nw + " למעקב") : null].filter(Boolean).join(", ");
  return h("details.n-home-grp", { open: false },
    h("summary.n-home-grp-h", chev, catArt(g.d.id, 32, "n-home-grp-ico"), h("span.n-home-grp-name", g.d.label), h("span.n-home-grp-n", cntOf(g.rows.length, "metric"), " · ", st)),
    h("p.n-home-grp-go", textLink(hrefD(c.key, g.d.id), "לעמוד התחום ←")), list(g.rows, rc));
}
export function attentionSection(model, c) {
  const full = c.level === "full", a = M.attentionOf(model, full ? Infinity : M.MAX_ROWS);
  if (!a.rows.length) return section("n-sec-weak", T.h.attention, line(T.noAttention));
  const rc = rowCtx(model, c, T.way);
  if (!full) {
    const rest = a.total - a.rows.length;
    return section("n-sec-weak", T.h.attention, list(a.rows, rc), rest > 0 ? h("p.n-home-line", restLine(rest), " ", textLink(`#/c/${enc(c.key)}?q=weak`, T.restLink + " ←", () => c.toFull("weak"))) : null);
  }
  // every one that needs treatment or follow-up, under its category (the weakest category first), the weakest figure first
  const nc = a.rows.filter((r) => rc.byId.get(r.id).status === "concern").length;
  const groups = categoriesOf(model).map(({ d }) => ({ d, rows: a.rows.filter((r) => r.domain === d.id) })).filter((g) => g.rows.length);
  return section("n-sec-weak", T.h.attention, h("p.n-home-lead", segs(attLead(nc, a.rows.length - nc))),
    groups.map((g, i) => grp(g, i, rc, c)));
}

// ═════════ 4. what changed, next to similar towns (the full level; the long answers of city/answers.js under one heading and one sentence each) ═════════
const lead = (a, key) => [h("p.n-home-lead", P.segs(a.segs, key)), a.lede.length ? h("p.n-home-lede", P.segs(a.lede, key)) : null];
export function changedSection(model, env) {
  const key = String(model.city.key), a = S.answer(model, "changed"), built = A.changed(model, env);
  return section("n-sec-changed", T.h.changed, ...lead(a, key), ...built.evidence);
}
export function peersSection(model, env) {
  const key = String(model.city.key), a = S.answer(model, "peers"), built = A.peers(model, env);
  return section("n-sec-peers", T.h.peers, ...lead(a, key), ...built.evidence);
}

// ═════════ 5. what to do ═════════
const facts = (s) => h("dl.n-home-facts2", s.who ? h("div", h("dt", T.first.who), h("dd", s.who)) : null, s.when ? h("div", h("dt", T.first.when), h("dd", s.when)) : null);
const why = (s, name) => (s.row ? h("p.n-home-why", segs(whyLine(s.row.label, s.row.town, s.row.nat, name, s.row.dir))) : null);
export function firstSection(model, c) {
  const full = c.level === "full", steps = M.firstSteps(model, full ? 3 : 1), name = model.city.name;
  if (!steps.length) return null;
  if (!full) return section("n-sec-first", T.h.first, h("p.n-home-do", steps[0].headline), why(steps[0], name), facts(steps[0]));
  return section("n-sec-first", T.h.first, h("ol.n-home-steps", steps.map((s) => h("li.n-home-step", h("p.n-home-do", s.headline), why(s, name), facts(s)))),
    h("p.n-home-line", textLink(`#/c/${enc(c.key)}/actions`, T.allSteps + " ←")));
}

// ═════════ 6. what is missing ═════════
export function missingSection(model, c, env, meta) {
  if (c.level === "full") return section("n-sec-missing", T.h.missing, ...A.missing(model, env).evidence);
  let lines = missingLines(M.missingOf(model, meta));
  if (c.kind === "calm") lines = lines.filter((l) => !/מעט מקרים/.test(l));
  if (!lines.length) return null;
  return section("n-sec-missing", T.h.missing, line(lines.join(" ")), h("p.n-home-line", textLink(`#/c/${enc(c.key)}/coverage`, T.missing.link + " ←")));
}

// ═════════ a town whose groups are all too small: the numbers as they are, never ranked ═════════
export function smallSection(model, c) {
  const rows = M.smallOf(model);
  if (!rows.length) return null;
  if (c.level === "full") return section("n-sec-small", HOME.block.asIs, h("p.n-home-bs", HOME.block.asIsSub), P.smallList(model, model.indicators.filter(D.isSmall).sort((x, y) => (y.importance || 0) - (x.importance || 0) || x.id.localeCompare(y.id)), 6));
  const rest = D.stateOf(model).have - rows.length;
  return section("n-sec-small", HOME.block.asIs, h("ul.n-home-list", rows.map((r) => h("li.n-home-item", h("h3.n-home-what", h("a.n-home-what-a", { href: hrefI(c.key, r.id) }, labelNodes(r.label))),
    h("p.n-home-small", h("b.n-home-val", value(r.town)), casesNodes(r.cases), r.year == null ? "" : [" ב-", ltr(String(r.year))], ". ", T.smallRow)))),
  rest > 0 ? h("p.n-home-line", T.moreNumbers(rest), " ", textLink(`#/c/${enc(c.key)}?q=missing`, T.moreLink + " ←", () => c.toFull("small"))) : null);
}

// ═════════ a town the sources do not cover: the calm no-data spot, one sentence, the two ways on ═════════
export function nodataSection(model) {
  const name = model.city.name, key = model.city.key;
  return h("section.n-home-sec.n-home-state.rv#n-sec-state", { "aria-label": HOME.nodata.weak(name) },
    nodataSpot({ title: HOME.nodata.weak(name), text: HOME.nodata.text(name, model.city.parent), actions: [textLink(`#/c/${enc(key)}/coverage`, HOME.nodata.coverage), textLink("#/", HOME.nodata.other)] }));
}

// ═════════ the foot: where the figures come from once, how to read "needs treatment", the way to report a mistake, print and share ═════════
export function foot(model, c) {
  const prov = provenanceParts(model, c.kind === "uncovered" ? [] : model.indicators);
  const how = c.kind !== "full" ? null : c.level === "full" ? P.howto("weak", model) : h("p.n-home-how", T.foot.how, " ", h("a.n-kit-link", { href: glossaryHref("concern") }, T.foot.dict, " ←"));
  return h("footer.n-home-foot",
    h("p.n-home-prov", [prov.sources, prov.years, prov.updated].filter(Boolean).join(" "), " ", h("a.n-kit-link", { href: infoHref("method", model.city.key) }, T.foot.method, " ←")), how);
}
