// The pieces the town page and the briefing are made of (class prefix n-home-, css/product/home.css): the segments of a sentence, evidence blocks, the strip chart of a row,
// the status row of the briefing, the figures on small groups. Colour only through tokens, motion only through the verbs of css/motion.css
// (.rv for blocks, .viz with draw / grow / pop / rise inside charts). Nothing here invents a number: callers pass model fields and the words of data.js and sentence.js.
import { h, svg, icon, num, fmtVal, ltr, iso, unitSuffix } from "../../ui.js";
import { uid, bindTip, tipHead, tipRow, C } from "../../viz/core.js";
import { termButton } from "../kit/term.js";
import { cntOf } from "../kit/plural.js";
import * as D from "./data.js";
import { howtoText, T, shortName } from "./copy.js";

const enc = encodeURIComponent;
export const hrefI = (key, id) => `#/c/${enc(key)}/i/${enc(id)}`;
export const hrefD = (key, id) => `#/c/${enc(key)}/d/${enc(id)}`;

// ═════════ type: the sentence is the star ═════════
// the segments of sentence.js on the screen: a number is isolated (digits keep their order) and counted up; a domain is a link whose tail never breaks away from it
export function segs(list, key) {
  return [].concat(list).flat(Infinity).filter((s) => s != null && s !== false).map((s) => {
    if (typeof s === "string") return s;
    if (s.n != null) return h("b.n-home-n.ltr" + (s.tone ? ".t-" + s.tone : ""), { "data-count": "" }, s.n);
    if (s.dom) return h("span.n-home-nb", h("a.n-home-sdom", { href: hrefD(key, s.dom.id) }, s.dom.short), s.tail || "");
    if (s.peers) return s.peers.flatMap((p, i) => [i ? ", " : "", h("a", { href: `#/c/${enc(p.key)}` }, p.name)]);
    if (s.term) return termButton(s.term, s.text);
    if (s.clause) return h("span.n-home-clause", segs(s.clause, key));
    return "";
  });
}
// one quiet sentence: how to read this answer. The first word of the first one opens its definition.
export function howto(qid, model) {
  const t = howtoText(qid, D.hasNoPeers(model)), pre = "״דורש טיפול״";
  return h("p.n-home-howto.rv", qid === "weak" && t.startsWith(pre) ? [termButton("concern", "דורש טיפול"), t.slice(pre.length)] : t);
}

// an evidence block: a hairline, a heading, a line saying what it shows, then the content
export function block(title, sub, ...kids) {
  const id = uid("nhb");
  return h("section.n-home-block.rv", { "aria-labelledby": id }, h("h3.n-home-bh", { id }, title), sub ? h("p.n-home-bs", sub) : null, ...kids);
}
export const none = (text) => h("p.n-home-none", text);
export const more = (summary, ...kids) => h("details.n-home-more", h("summary", summary, icon("down")), ...kids);

// a status as the word that starts a row's reason, with its icon: the colour never stands alone
export const statusWord = (r) => h("b.n-home-st.t-" + r.tone, icon(r.icon), r.word);

// ═════════ the status row: five figures separated by hairlines, only the concern figure is orange ═════════
export function ledger(model, { onPick } = {}) {
  const st = D.stateOf(model), c = st.all, key = model.city.key, id = uid("nhl");
  const item = (k, n, label, href, q) => ({ k, n, label, href, q });
  const list = st.judged
    ? [item("concern", c.concern || 0, (c.concern || 0) === 1 ? "דורש טיפול" : "דורשים טיפול", `#/c/${enc(key)}?q=weak`, "weak"), item("watch", c.watch || 0, "למעקב"), item("good", c.good || 0, (c.good || 0) === 1 ? "תקין" : "תקינים"),
      item("strength", c.strength || 0, (c.strength || 0) === 1 ? "חוזק" : "חוזקות"), item("none", st.none, "ללא שיפוט", `#/c/${enc(key)}/coverage`)]
    : st.none ? [item("none", st.none, "ללא שיפוט", `#/c/${enc(key)}/coverage`)] : [];
  if (!list.length) return null;
  // "ללא שיפוט" always with its cause
  const why = [st.bg ? `${cntOf(st.bg, "metric")} ${st.bg === 1 ? "מתאר" : "מתארים"} בלבד` : null, st.small ? `${cntOf(st.small, "metric")} על ${st.small === 1 ? "קבוצה קטנה" : "קבוצות קטנות"}` : null, st.stale ? `${cntOf(st.stale, "metric")} עם נתון ישן` : null].filter(Boolean);
  const li = (x) => {
    const body = [h("b.n-home-ln.ltr", { "data-count": "" }, String(x.n)), h("span", x.label)];
    const el = x.href ? h("a.n-home-lcell", { href: x.href }, body) : h("span.n-home-lcell", body);
    if (x.q && onPick) el.addEventListener("click", (e) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onPick(x.q); });
    return h("li.is-" + x.k + (x.n ? "" : ".is-zero"), el);
  };
  return h("div.n-home-ledger", h("p.n-home-ledger-h", { id }, T.ledgerHead(st.have)), h("ul", { "aria-labelledby": id }, list.map(li)), why.length ? h("p.n-home-ledger-why", "ללא שיפוט: " + why.join(", ") + ".") : null);
}

// ═════════ the strip chart of a row: the town, similar localities and the nation on one axis, flipped so that the better side is always to the right ═════════
const DW = 300, DH = 38, DM = 16, DY = 19;
const px = (v) => Math.round(v * 10) / 10;
const valText = (a, v) => fmtVal(a.unit, v, a.unit === "index" ? 2 : 1);

export function dumbPoints(a, cityName) {
  const L = a.last;
  return [{ key: "nat", label: "ממוצע ארצי", v: L.nat }, { key: "peer", label: "יישובים דומים (הערך האמצעי)", v: L.peer }, { key: "city", label: cityName, v: L.v }].filter((p) => D.isNum(p.v));
}
// the axis of one row: just wide enough for its values, flipped when lower is better (a pure function)
export function dumbScale(pts, { unit = "", direction = null, width = DW, margin = DM } = {}) {
  const vals = pts.map((p) => p.v).filter(D.isNum);
  if (!vals.length) return null;
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals), span = hi0 - lo0, pad = span > 0 ? span * 0.32 : Math.max(Math.abs(hi0) * 0.06, 1);
  let lo = lo0 - pad, hi = hi0 + pad;
  if (unit === "%") { lo = Math.max(0, lo); hi = Math.min(100, hi); if (hi - lo < 2) { lo = Math.max(0, lo0 - 1); hi = Math.min(100, hi0 + 1); } }
  const flip = direction === "lower", inner = width - 2 * margin;
  return { lo, hi, flip, x: (v) => px(margin + ((flip ? hi - v : v - lo) / (hi - lo || 1)) * inner) };
}
function dumbSvg(a, pts, cityName) {
  const sc = dumbScale(pts, { unit: a.unit, direction: a.direction });
  const xs = pts.map((p) => sc.x(p.v)), x0 = Math.min(...xs), x1 = Math.max(...xs), city = pts.find((p) => p.key === "city"), cx = sc.x(city.v);
  const label = `${shortName(a)}: ${cityName} ${valText(a, city.v)}` + pts.filter((p) => p.key !== "city").map((p) => `, ${p.label} ${valText(a, p.v)}`).join("") + (a.direction ? ". ימינה טוב יותר" : "");
  const s = svg("svg", { class: "n-home-db", viewBox: `0 0 ${DW} ${DH}`, role: "img", "aria-label": label });
  s.append(svg("line", { class: "n-home-db-track", x1: DM - 6, x2: DW - DM + 6, y1: DY, y2: DY }));
  if (x1 - x0 > 0.5) s.append(svg("rect", { class: "n-home-db-conn grow-x", x: x0, y: DY - 3.5, width: px(x1 - x0), height: 7, rx: 3.5, style: { "--origin": cx <= (x0 + x1) / 2 ? "0 50%" : "100% 50%", "--i": 0 } }));
  [...pts].sort((p, q) => (p.key === "city") - (q.key === "city")).forEach((p, i) => s.append(svg("g", { class: "pop", style: { "--i": i + 1 } },
    svg("circle", { class: "n-home-db-knock", cx: sc.x(p.v), cy: DY, r: p.key === "city" ? 10 : 7.4 }), svg("circle", { class: "n-home-db-dot k-" + p.key, cx: sc.x(p.v), cy: DY, r: p.key === "city" ? 7.6 : 5.2 }))));
  bindTip(s, () => [tipHead(shortName(a)), ...[...pts].sort((p, q) => sc.x(q.v) - sc.x(p.v)).map((p) => tipRow(p.key === "city" ? C.city : p.key === "peer" ? C.peer : C.nat, p.label, ltr(valText(a, p.v))))]);
  return s;
}
// the three numbers of a row, in the order of the legend (the town first), each with the colour of its mark; the unit stands with them
function dumbValues(a, pts) {
  const uw = a.unit !== "%" ? unitSuffix(a.unit) : "";
  return h("div.n-home-vals", [...pts].sort((p, q) => ["city", "peer", "nat"].indexOf(p.key) - ["city", "peer", "nat"].indexOf(q.key)).map((p) =>
    h("span.n-home-v.k-" + p.key, h("i", { "aria-hidden": "true" }), h("span.sr", p.label + ": "), h("b", ltr(valText(a, p.v))))), uw ? h("small.n-home-unit", uw) : null);
}
// the chart of one figure: the strip and its numbers (a note instead when there is nothing to compare with)
export function dumbChart(a, cityName) {
  const pts = dumbPoints(a, cityName);
  return pts.length >= 2 ? [dumbSvg(a, pts, cityName), dumbValues(a, pts)] : [dumbValues(a, pts), h("p.n-home-nocmp", "אין ממוצע ארצי או יישובים דומים להשוואה")];
}
// the key of the strips, once for the block; the direction goes here, and into a row only when it differs (mixed)
export function dumbLegend(cityName, hasPeer, hasNat, note) {
  const item = (k, t) => h("span", h("i.k-" + k, { "aria-hidden": "true" }), t);
  return h("div.n-home-lg", item("city", cityName), hasPeer ? item("peer", "יישובים דומים (הערך האמצעי)") : null, hasNat ? item("nat", "ממוצע ארצי") : null,
    h("span.n-home-lg-better", note || "ימינה = טוב יותר", icon("right", 14)));
}

// ═════════ the figures that exist on a group too small to judge, as they are: a hollow mark, never ranked, with the case count when the model has it (C-09) ═════════
export function casesOf(a) {
  const c = D.caseCount(a);
  return !c ? "" : c.d != null ? ` · ${c.n} מתוך ${c.d}` : ` · ${cntOf(c.n, "case")}`;
}
export function smallList(model, list, cap = 6) {
  const key = model.city.key;
  const row = (a) => h("li", svg("svg", { class: "n-home-hollow", viewBox: "0 0 24 24", width: 18, height: 18, "aria-hidden": "true" }, svg("circle", { cx: 12, cy: 12, r: 6.5, fill: "none" })),
    h("a", { href: hrefI(key, a.id) }, shortName(a)), h("span.n-home-sm-v", ltr(valText(a, a.last.v)), a.unit !== "%" && unitSuffix(a.unit) ? " " + unitSuffix(a.unit) : "", " · ", iso(String(a.last.year)), casesOf(a), " · קבוצה קטנה"));
  const head = list.slice(0, cap), tail = list.slice(cap);
  return h("div.n-home-small", h("ul.n-home-sm", head.map(row)), tail.length ? more(`עוד ${num(tail.length, 0)}`, h("ul.n-home-sm", tail.map(row))) : null);
}

// the one place where an action row of an answer is a text link (not a button)
export const textLink = (href, text, onclick) => {
  const a = h("a.n-home-link", { href }, text);
  if (onclick) a.addEventListener("click", (e) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onclick(); });
  return a;
};
