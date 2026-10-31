// Lab direction "questions": the typographic pieces and the few charts that belong to this page (class prefix .lq-, css/lab/questions.css).
// Colour only through tokens, motion only through the vocabulary of css/motion.css (.rv for blocks, .viz with draw / grow / pop / rise inside charts),
// every chart has an aria-label with its numbers and a tooltip on focus. Nothing here invents a number: callers pass model fields.
import { h, svg, icon, num, fmtVal, ltr, iso, countLabel, STATUS, statusReason, compareLine, unitSuffix, directionNote, directionIcon } from "../../ui.js";
import { viz, uid, bindTip, tipHead, tipRow, C } from "../../viz/core.js";
import { domainCounts, stripWords } from "../../viz/matrix.js";
import { levelColor, scaleGradient, locator } from "../../viz/spatial.js";
import { getGeo } from "../../api.js";
import { isNum, nm, domainJudged, shortDomain } from "./data.js";

// ═════════ type: the sentence is the star ═════════
// a number inside a sentence: isolated (so that digits keep their order), counted up when it scrolls into view, coloured by tone
export const N = (n, tone) => h("b.lq-n.ltr" + (tone ? ".t-" + tone : ""), { "data-count": "" }, String(n));
export const qlabel = (text) => h("p.lq-ql.rv", text);
// the one big sentence of an answer. kids = what is drawn, plain = what a screen reader hears (the digits count up on screen, so the final sentence is the name)
export const sentence = (kids, plain, cls = "") => h("h2.lq-sentence.rv" + cls, { "aria-label": plain }, h("span", { "aria-hidden": "true" }, kids));
export const lede = (...kids) => h("p.lq-lede.rv", ...kids);
// an evidence block: a hairline, a small heading, a line saying what it shows, then the content
export function block(title, sub, ...kids) {
  const id = uid("lqb");
  return h("section.lq-block.rv", { "aria-labelledby": id }, h("h3.lq-bh", { id }, title), sub ? h("p.lq-bs", sub) : null, ...kids);
}
export const linkbtn = (text, onclick) => h("button.lq-linkbtn", { type: "button", onclick }, text);

// a status as the coloured word that starts its reason ("דורש טיפול כי ..."): the rest of the sentence stays quiet
export function reasonLine(a) {
  const t = statusReason(a) || compareLine(a).text, m = /^(דורש טיפול|למעקב|תקין|חוזק)([\s\S]*)$/.exec(t), s = STATUS[a.status] || STATUS.na;
  return h("p.lq-why", m ? [h("b.lq-stw.t-" + s.tone, icon(s.icon), m[1]), m[2]] : t);
}

// ═════════ the state of the town as a ledger of five numerals (hairlines, no boxes) ═════════
export function ledger(st) {
  const c = st.all, id = uid("lql");
  const word = { concern: (n) => countLabel("concern", n), watch: () => "למעקב", good: (n) => countLabel("good", n), strength: (n) => countLabel("strength", n), none: () => "ללא שיפוט" };
  const items = [["concern", c.concern || 0], ["watch", c.watch || 0], ["good", c.good || 0], ["strength", c.strength || 0], ["none", st.none]].filter(([k, n]) => (st.judged ? true : k === "none" && n > 0));
  if (!items.length) return null;
  return h("div.lq-ledger", h("p.lq-rail-h", { id }, "כמה מדדים בכל מצב"),
    h("ul", { "aria-labelledby": id }, items.map(([k, n]) => h("li.is-" + k + (n ? "" : ".is-zero"), h("b.lq-ln.ltr", { "data-count": "" }, String(n)), h("span", word[k](n))))));
}

// ═════════ the free question: a hairline field; Enter sends it to the real ask page, which does the work ═════════
export function askField(model) {
  const key = model.city.key, name = model.city.name;
  const input = h("input.lq-ask-in", { type: "text", name: "q", placeholder: `מה תרצו לדעת על הבריאות ב${name}?`, "aria-label": `שאלה חופשית על הבריאות ב${name}`, autocomplete: "off", enterkeyhint: "send" });
  const form = h("form.lq-ask", { role: "search", onsubmit: (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    location.hash = `#/c/${encodeURIComponent(key)}/ask?q=${encodeURIComponent(q)}`;
  } }, icon("search"), input, h("button.lq-ask-go", { type: "submit", "aria-label": "שליחת השאלה לעוזר החכם" }, icon("left")));
  return h("div.lq-askwrap.no-print", form,
    h("p.lq-ask-note", "שאלה בניסוח חופשי נענית בעמוד \"שאלו את הסוכן\", בעזרת בינה מלאכותית. חמש השאלות שמתחת נענות ישירות מהנתונים."));
}

// ═════════ the town on the map of the country (a small locator; a locality the sources do not cover is added from its own coordinates) ═════════
export function locatorOf(model, width = 60) {
  const c = model.city, host = h("div.lq-loc");
  getGeo().then((geo) => {
    let list = Array.isArray(geo) ? geo : [];
    if (!list.length) return;
    if (!list.some((g) => String(g.k) === String(c.key)) && isNum(c.lon) && isNum(c.lat)) list = [...list, { k: c.key, n: c.name, x: c.lon, y: c.lat, p: 0 }];
    host.append(locator({ geo: list, cityKey: c.key, width, ariaLabel: `מיקום ${c.name} על מפת הארץ` }));
  }).catch(() => { /* no map: the name stands alone */ });
  return host;
}

// ═════════ question 1: five numbered rows, each a dumbbell on its own axis (the town, similar localities, the nation; better is to the right) ═════════
const DW = 300, DH = 38, DM = 16, DY = 19;
const px = (n) => Math.round(n * 10) / 10;
const valText = (a, v) => fmtVal(a.unit, v, a.unit === "index" ? 2 : 1);

// the marks of one figure: the town, similar localities (their middle value) and the national mean, whichever exist
export function dumbPoints(a, cityName) {
  const L = a.last;
  return [{ key: "nat", label: "ממוצע ארצי", v: L.nat }, { key: "peer", label: "יישובים דומים (הערך האמצעי)", v: L.peer }, { key: "city", label: cityName, v: L.v }].filter((p) => isNum(p.v));
}
// the axis of one row: just wide enough for its values, flipped when lower is better so that "better" is always to the right (a pure function)
export function dumbScale(pts, { unit = "", direction = null, width = DW, margin = DM } = {}) {
  const vals = pts.map((p) => p.v).filter(isNum);
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
  const label = `${nm(a)}: ${cityName} ${valText(a, city.v)}` + pts.filter((p) => p.key !== "city").map((p) => `, ${p.label} ${valText(a, p.v)}`).join("") + (a.direction ? ". ימינה טוב יותר" : "");
  const s = svg("svg", { class: "lq-db", viewBox: `0 0 ${DW} ${DH}`, role: "img", "aria-label": label, tabindex: "0", focusable: "true" });
  s.append(svg("line", { class: "lq-db-track", x1: DM - 6, x2: DW - DM + 6, y1: DY, y2: DY }));
  if (x1 - x0 > 0.5) s.append(svg("rect", { class: "lq-db-conn grow-x", x: x0, y: DY - 3.5, width: px(x1 - x0), height: 7, rx: 3.5, style: { "--origin": cx <= (x0 + x1) / 2 ? "0 50%" : "100% 50%", "--i": 0 } }));
  [...pts].sort((p, q) => (p.key === "city") - (q.key === "city")).forEach((p, i) => s.append(svg("g", { class: "pop", style: { "--i": i + 1 } },
    svg("circle", { class: "lq-db-knock", cx: sc.x(p.v), cy: DY, r: p.key === "city" ? 10 : 7.4 }), svg("circle", { class: "lq-db-dot k-" + p.key, cx: sc.x(p.v), cy: DY, r: p.key === "city" ? 7.6 : 5.2 }))));
  bindTip(s, () => [tipHead(nm(a)), ...[...pts].sort((p, q) => sc.x(q.v) - sc.x(p.v)).map((p) => tipRow(p.key === "city" ? C.city : p.key === "peer" ? C.peer : C.nat, p.label, ltr(valText(a, p.v))))]);
  return s;
}

// the three numbers of a row, in the order of the legend (the town first), each with the colour of its mark
function dumbValues(a, pts) {
  const uw = a.unit !== "%" ? unitSuffix(a.unit) : "";
  return h("div.lq-wr-v", [...pts].sort((p, q) => ["city", "peer", "nat"].indexOf(p.key) - ["city", "peer", "nat"].indexOf(q.key)).map((p) =>
    h("span.lq-v.k-" + p.key, h("i", { "aria-hidden": "true" }), h("span.sr", p.label + ": "), h("b", ltr(valText(a, p.v))))), uw ? h("small.lq-unit", uw) : null);
}

// the chart of one figure: the dumbbell and its three numbers (a note instead when there is nothing to compare with)
export function dumbChart(a, cityName) {
  const pts = dumbPoints(a, cityName);
  return pts.length >= 2 ? [dumbSvg(a, pts, cityName), dumbValues(a, pts)] : [dumbValues(a, pts), h("p.lq-nocmp", "אין ממוצע ארצי או יישובים דומים להשוואה")];
}
// rows: the figures (already in the order to show); the whole list is one chart for the entrance (rows rise one after the other, marks pop).
// mixed = the rows do not share one direction, so each row says which way is good
export function weakRows(model, rows, { mixed = false } = {}) {
  const key = model.city.key, name = model.city.name;
  const ol = h("ol.lq-wrs");
  rows.forEach((a, i) => {
    ol.append(h("li.lq-wr.rise", { style: { "--i": Math.min(i, 8) } },
      h("span.lq-wr-n", { "aria-hidden": "true" }, String(i + 1)),
      h("div.lq-wr-t", h("a.lq-wr-name", { href: `#/c/${key}/i/${a.id}` }, a.label), reasonLine(a), mixed ? h("p.lq-dir", icon(directionIcon(a.direction)), directionNote(a.direction)) : null),
      h("div.lq-wr-c", dumbChart(a, name))));
  });
  return viz(ol);
}
// the key of the dumbbells, once for the block
export function dumbLegend(cityName, hasPeer, hasNat) {
  const item = (k, t) => h("span", h("i.k-" + k, { "aria-hidden": "true" }), t);
  return h("div.lq-lg", item("city", cityName), hasPeer ? item("peer", "יישובים דומים (הערך האמצעי)") : null, hasNat ? item("nat", "ממוצע ארצי") : null,
    h("span.lq-lg-better", "ימינה = טוב יותר", icon("right", 14)));
}

// ═════════ question 1: the domains as a tinted strip (worst to the left, better to the right) ═════════
// tint = the average place of the domain's judged figures among all localities; the numeral inside = how many of its figures need treatment
export function domainTiles(model) {
  const key = model.city.key;
  const list = model.domains.filter((d) => d.indicators.length).map((d) => ({ d, counts: domainCounts(model.indicators.filter((i) => i.domain === d.id)), judged: isNum(d.standing) && domainJudged(d.counts) > 0 }));
  if (!list.length) return null;
  list.sort((x, y) => (x.judged ? x.d.standing : 1000) - (y.judged ? y.d.standing : 1000) || y.counts.concern - x.counts.concern);
  const root = h("div.lq-doms", { style: { "--n": Math.min(list.length, 10) } });
  list.forEach(({ d, counts, judged }, i) => {
    const words = stripWords(counts), stand = judged ? `טוב מ-${Math.round(d.standing)}% מהיישובים` : "ללא שיפוט";
    const tile = h("a.lq-dom" + (judged ? "" : ".is-none"), { href: `#/c/${key}/d/${d.id}`, "aria-label": `${d.label}: ${stand}. ${words}`, style: { "--tint": judged ? levelColor(d.standing) : null } },
      h("span.lq-dom-tint.grow-y", { style: { "--i": Math.min(i, 12) } }, judged ? h("b.ltr", String(counts.concern)) : h("b", "—")),
      h("b.lq-dom-name.rise", { style: { "--i": Math.min(i, 12) } }, shortDomain(d.label)));
    bindTip(tile, () => [tipHead(d.label), tipRow(judged ? levelColor(d.standing) : null, "מקום ממוצע בין היישובים", stand), tipRow(null, "מצב המדדים", words)]);
    root.append(tile);
  });
  return viz(root, { label: `${list.length} תחומים, מהחלש משמאל לחזק מימין. ` + list.map(({ d, judged }) => `${d.label}: ${judged ? "טוב מ-" + Math.round(d.standing) + "% מהיישובים" : "ללא שיפוט"}`).join("; "), role: "group" });
}
export function domainLegend() {
  return h("div.lq-lg.lq-dom-lg", h("span.lq-scale", h("small", "חלש יותר"), h("i", { style: { background: scaleGradient(false) }, "aria-hidden": "true" }), h("small", "חזק יותר")),
    h("span", h("i.lq-dash", { "aria-hidden": "true" }), "ללא שיפוט בתחום"),
    h("span.lq-dom-how", "הצבע: המקום הממוצע של מדדי התחום בין כל היישובים. המספר בריבוע: כמה מדדים בתחום דורשים טיפול."));
}

// ═════════ question 3: where each domain stands among all localities (a ladder with no trophies) ═════════
export function ladder(model) {
  const key = model.city.key;
  const list = model.domains.filter((d) => d.indicators.length).map((d) => ({ d, judged: isNum(d.standing) && domainJudged(d.counts) > 0 }));
  if (!list.some((x) => x.judged)) return null;
  list.sort((x, y) => (x.judged ? x.d.standing : 1000) - (y.judged ? y.d.standing : 1000));
  const ul = h("ul.lq-lad");
  list.forEach(({ d, judged }, i) => {
    const s = judged ? Math.max(0, Math.min(100, d.standing)) : null, stand = judged ? ["טוב מ-", ltr(`${Math.round(s)}%`), " מהיישובים"] : "ללא שיפוט";
    ul.append(h("li.lq-lr.rise", { style: { "--i": Math.min(i, 12) } }, h("a", { href: `#/c/${key}/d/${d.id}`, "aria-label": `${d.label}: ${judged ? "טוב מ-" + Math.round(s) + "% מהיישובים" : "ללא שיפוט"}` },
      h("span.lq-lr-name", shortDomain(d.label)),
      h("span.lq-lr-track", { "aria-hidden": "true" }, h("i.lq-lr-mid"), judged ? [h("i.lq-lr-stem.grow-x", { style: { width: s + "%", "--origin": "0 50%", "--i": Math.min(i, 12) } }), h("b.lq-lr-dot.pop", { style: { left: s + "%", background: levelColor(s), "--i": Math.min(i, 12) } })] : null),
      h("span.lq-lr-val" + (judged ? "" : ".is-none"), stand))));
  });
  return h("div.lq-ladder", h("div.lq-lr-head", { "aria-hidden": "true" }, h("span"), h("span.lq-lr-ends", h("small", "חלש יותר"), h("small", "באמצע"), h("small", "חזק יותר")), h("span")), viz(ul));
}

// ═════════ question 1 and 5: the figures that exist on a group too small to judge, as they are (a hollow mark, never ranked) ═════════
export function smallList(model, list, cap = 6) {
  const key = model.city.key, row = (a) => h("li", svg("svg", { class: "lq-hollow", viewBox: "0 0 24 24", width: 18, height: 18, "aria-hidden": "true" }, svg("circle", { cx: 12, cy: 12, r: 6.5, fill: "none" })),
    h("a", { href: `#/c/${key}/i/${a.id}` }, a.label), h("span.lq-sm-v", ltr(valText(a, a.last.v)), a.unit !== "%" && unitSuffix(a.unit) ? " " + unitSuffix(a.unit) : "", " · ", iso(String(a.last.year))));
  const head = list.slice(0, cap), tail = list.slice(cap);
  return h("div.lq-small", h("ul.lq-sm", head.map(row)), tail.length ? h("details.lq-more", h("summary", `עוד ${num(tail.length, 0)}`, icon("down")), h("ul.lq-sm", tail.map(row))) : null);
}
