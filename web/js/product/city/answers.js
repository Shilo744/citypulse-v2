// The long evidence of three of the questions of the town page (what changed, next to similar towns, what is missing); sections.js puts each under its heading. Each builder returns nodes:
//   { evidence: [Node], rows: [indicator rows behind the screen, for the provenance line] }
// The sentences come from sentence.js and parts.js (sections.js composes the section). With too little data an answer says so calmly (no empty frames).
// env: { model, key, pick(qid), signal } where pick(qid) switches the question without a new history entry.
import { h, ltr, fmtVal, deltaUnit, unitSuffix } from "../../ui.js";
import * as net from "../net.js";
import { uid, bindTip, tipHead, tipRow, viz } from "../../viz/core.js";
import { divergingBars, lollipopRank, signed } from "../../viz/compare.js";
import { themedSlot, spotPicture } from "../band.js";
import * as D from "./data.js";
import * as S from "./sentence.js";
import * as P from "./parts.js";
import { T, shortName, questionText } from "./copy.js";

const { isNum } = D;
const unitWord = (a) => (a.unit !== "%" && unitSuffix(a.unit) ? " " + unitSuffix(a.unit) : "");

// the calm picture for a town with nothing to rank, and the two ways on
function calmSpot(model, links) {
  return h("div.n-home-spot.rv", themedSlot("n-home-spotpic", spotPicture), h("div.n-home-spot-links", links));
}

// ═════════ 2. what improved, what got worse ═════════
export function changed(model, env) {
  const key = model.city.key, out = [], mv = D.movers(model, 8), spell = { used: false };
  if (mv.length) {
    const max = Math.max(1, ...mv.map((m) => Math.abs(m.gap)));                        // one full bar is one usual spread between localities: small changes stay short
    const items = mv.map(({ a, gap }) => {
      const line = S.changeLine(a, spell), H = a.history;
      return { id: a.id, label: shortName(a), sub: `${line.word}: ${line.text}`, gap, text: signed(H.delta) + deltaUnit(a.unit), tone: gap > 0 ? "good" : "none", href: P.hrefI(key, a.id) };
    }).sort((x, y) => y.gap - x.gap);
    out.push(P.block(T.block.changes, T.block.changesSub, divergingBars({ items, max, zeroLabel: "ללא שינוי", betterLabel: "השתפר", worseLabel: "הידרדר" })));
  }
  out.push(h("p.n-home-more.rv", P.textLink(`#/c/${encodeURIComponent(key)}/trends`, "כל המגמות וההיסטוריה")));
  return { evidence: out, rows: mv.map((m) => m.a) };
}

// ═════════ 3. next to similar localities ═════════
// the figure where the town differs most from similar localities: its three marks, its place among all localities, and the localities right next to it in the ranking
function telling(model, r, env) {
  const a = r.a, L = a.last, key = model.city.key, name = model.city.name, id = uid("nhb");
  const body = h("div.n-home-tell", { "aria-busy": "true" }, h("div.sk", { style: { height: "24px", width: "70%" } }), h("div.sk", { style: { height: "120px", marginTop: "14px" } }));
  const sec = h("section.n-home-block.rv", { "aria-labelledby": id }, h("h3.n-home-bh", { id }, T.block.telling(name)), h("p.n-home-bs.n-home-tell-name", P.hrefI ? h("a", { href: P.hrefI(key, a.id) }, a.label) : a.label), body);
  const word = unitWord(a);
  const line = h("p.n-home-bs", `ב-${L.year}: `, ltr(fmtVal(a.unit, L.v)), word, " ב", name, ", ", ltr(fmtVal(a.unit, L.peer)), word, " ביישובים דומים (הערך האמצעי)", isNum(L.nat) ? [", ", ltr(fmtVal(a.unit, L.nat)), word, " ממוצע ארצי"] : "", ". ", D.rankText(L) + ". ", a.direction ? (a.direction === "lower" ? "ככל שהמספר נמוך יותר, כך טוב יותר." : "ככל שהמספר גבוה יותר, כך טוב יותר.") : "");
  net.indicator(key, a.id).then((det) => {
    if (env.signal && env.signal.aborted) return;
    const I = det.indicator, items = det.neighbours.map((n) => ({ name: n.name, v: n.v, rank: n.rank, self: n.self, d: n.d, href: P.hrefI(n.k, a.id), hollow: isNum(n.d) && isNum(I.minBase) && I.minBase > 0 && n.d < I.minBase }));
    body.replaceChildren(line, h("div.n-home-tell-db", P.dumbChart(a, name)), P.dumbLegend(name, true, isNum(L.nat)),
      h("h4.n-home-bh2", T.block.near), lollipopRank({ items, unit: I.unit, nat: L.nat, direction: I.direction, selfLabel: "היישוב" }),
      h("p.n-home-more", P.textLink(P.hrefI(key, a.id), "לפרטי המדד")));
    body.removeAttribute("aria-busy");
  }).catch(() => { body.replaceChildren(line, P.none(T.loadErr.rank)); body.removeAttribute("aria-busy"); });
  return sec;
}

// where each domain stands among all localities: a ladder with no trophies. Percent only here, inside a domain, always "of the localities that have a figure" (C-04).
function ladder(model) {
  const key = model.city.key;
  const list = model.domains.filter((d) => !d.background && d.indicators.length).map((d) => ({ d, judged: isNum(d.standing) && D.domainJudged(d.counts) > 0 }));
  if (!list.some((x) => x.judged)) return null;
  list.sort((x, y) => (x.judged ? x.d.standing : 1000) - (y.judged ? y.d.standing : 1000));
  const ul = h("ul.n-home-lad");
  list.forEach(({ d, judged }, i) => {
    const s = judged ? Math.max(0, Math.min(100, d.standing)) : null, r = s == null ? null : Math.round(s);
    const stand = !judged ? "ללא שיפוט" : r < 3 ? "בין החלשים ביותר" : ["טוב מ-", ltr(`${r}%`), " מהיישובים שיש עליהם נתון"];
    ul.append(h("li.n-home-lr.rise", { style: { "--i": Math.min(i, 12) } }, h("a", { href: P.hrefD(key, d.id), "aria-label": `${d.label}: ${!judged ? "ללא שיפוט" : r < 3 ? "בין החלשים ביותר" : "טוב מ-" + r + "% מהיישובים שיש עליהם נתון"}` },
      h("span.n-home-lr-name", D.shortDomain(d.label)),
      h("span.n-home-lr-track", { "aria-hidden": "true" }, h("i.n-home-lr-mid"), judged ? [h("i.n-home-lr-stem.grow-x", { style: { width: s + "%", "--origin": "0 50%", "--i": Math.min(i, 12) } }), h("b.n-home-lr-dot.pop", { style: { left: s + "%", "--i": Math.min(i, 12) } })] : null),
      h("span.n-home-lr-val" + (judged ? "" : ".is-none"), stand))));
  });
  return h("div.n-home-ladder", h("div.n-home-lr-head", { "aria-hidden": "true" }, h("span"), h("span.n-home-lr-ends", h("small", "חלש יותר"), h("small", "באמצע"), h("small", "חזק יותר")), h("span")), viz(ul));
}

export function peers(model, env) {
  const st = D.stateOf(model), pv = D.peerVerdicts(model), key = model.city.key, name = model.city.name, list = model.peers || [], out = [];
  if (!st.judged || !pv.total) {
    out.push(calmSpot(model, [P.textLink(`#/c/${encodeURIComponent(key)}?q=missing`, questionText("missing", name), () => env.pick("missing")), P.textLink(`#/c/${encodeURIComponent(key)}`, "חזרה לדף היישוב", () => env.pick("weak"))]));
    return { evidence: out, rows: [] };
  }
  const t = D.mostTelling(model);
  if (t) out.push(telling(model, t, env));
  const lad = ladder(model);
  if (lad) out.push(P.block(T.block.ladder, T.block.ladderSub, lad));
  if (list.length) {
    const near = list.slice(0, 3).map((p) => p.key);
    out.push(P.block(T.block.peerList, null, h("ul.n-home-peers", list.map((p) => h("li", h("a", { href: `#/c/${encodeURIComponent(p.key)}` }, p.name), h("a.n-home-peers-add", { href: `#/c/${encodeURIComponent(key)}/compare?with=${encodeURIComponent(p.key)}` }, "הוספה להשוואה")))),
      h("p.n-home-more", P.textLink(`#/c/${encodeURIComponent(key)}/compare?with=${near.map(encodeURIComponent).join(",")}`, "השוואה עם שלושת הדומים ביותר"))));
  }
  return { evidence: out, rows: pv.rows.map((r) => r.a) };
}

// ═════════ 5. what is missing in the data ═════════
const KIND_WORD = { found: "נמצא נתון", stale: "נמצא נתון, ישן", small: "נמצא, קבוצה קטנה מדי", missing: "לא נמצא" };

// one cell for each of the figures the system looks for: found, found on a small group (hollow), not found
function coverBar(cat) {
  const order = { found: 0, stale: 0, small: 1, missing: 2 }, cells = [...cat].sort((x, y) => order[x.kind] - order[y.kind]);
  const bar = h("div.n-home-cb"), n = cells.length;
  cells.forEach((x, i) => {
    const cell = h("i.n-home-cell.k-" + (x.kind === "stale" ? "found" : x.kind) + ".grow-y", { style: { "--i": Math.min(12, Math.floor((i * 12) / Math.max(1, n - 1))) } });
    const year = x.a && x.a.last && x.a.last.year;
    bindTip(cell, () => [tipHead(x.c.short || x.c.label), tipRow(null, "מצב", KIND_WORD[x.kind] + (year && (x.kind === "found" || x.kind === "stale") ? ` (${year})` : ""))]);
    bar.append(cell);
  });
  const c = (k) => cells.filter((x) => (k === "found" ? x.kind === "found" || x.kind === "stale" : x.kind === k)).length;
  return viz(bar, { label: `${n} מדדים: ${c("found")} נמצא נתון, ${c("small")} קבוצה קטנה מדי, ${c("missing")} לא נמצא`, role: "img" });
}
const trioItem = (k, v, label) => h("div.n-home-tri.is-" + k, h("b.n-home-tri-n.ltr", v ? { "data-count": "" } : null, String(v)), h("span", h("i.n-home-sw.k-" + k, { "aria-hidden": "true" }), label));

export function missing(model, env) {
  const key = model.city.key, name = model.city.name, st = D.stateOf(model), out = [], small = model.indicators.filter(D.isSmall).sort((x, y) => (y.importance || 0) - (x.importance || 0) || x.id.localeCompare(y.id));
  const total = st.total, smallN = small.length, miss = total - st.have;
  const trio = [["found", st.have - smallN, "נמצא נתון"], ["small", smallN, "נמצא, קבוצה קטנה מדי"], ["missing", miss, "לא נמצא"]].filter(([, v]) => v > 0);
  const barHost = h("div.n-home-cb-host", { "aria-busy": "true" }, h("div.sk", { style: { height: "30px" } }));
  const groupsHost = h("div.n-home-mg-host");
  out.push(P.block(T.block.cover(total), T.block.coverSub, h("div.n-home-trio", trio.map(([k, v, l]) => trioItem(k, v, l))), barHost));
  out.push(groupsHost);
  net.meta().then((meta) => {
    if (env.signal && env.signal.aborted) return;
    const c = D.coverageOf(model, meta);
    barHost.replaceChildren(coverBar(c.cat)); barHost.removeAttribute("aria-busy");
    const groups = D.missingGroups(c.cat, name, meta.sources);
    if (groups.length) {
      const id = uid("nhb");
      groupsHost.replaceWith(h("section.n-home-block.rv", { "aria-labelledby": id }, h("h3.n-home-bh", { id }, T.block.missingWhy), h("p.n-home-bs", `לכל קבוצת מדדים: הסיבה שאין עליהם נתון ב${name}, והמקור שנבדק.`),
        h("ul.n-home-mg", groups.map((g) => h("li", h("p.n-home-mg-names", g.items.map((m, i) => [i ? " · " : "", h("span", { title: m.label }, m.short || m.label)])), h("p.n-home-mg-why", g.why + "."),
          g.src ? h("p.n-home-mg-src", T.collector(g.src.publisher || g.src.name), " ", g.src.url ? h("a", { href: g.src.url, target: "_blank", rel: "noopener" }, "למקור") : null,
            /סקר/.test(`${g.src.name || ""} ${g.source}`) ? [" ", T.survey] : "") : null)))));
    } else groupsHost.remove();
  }).catch(() => { barHost.replaceChildren(P.none(T.loadErr.cover)); barHost.removeAttribute("aria-busy"); groupsHost.remove(); });
  if (smallN) out.push(P.block(T.block.smallHere, T.block.asIsSub, P.smallList(model, small, 6)));
  out.push(h("p.n-home-more.rv", P.textLink(`#/c/${encodeURIComponent(key)}/coverage`, T.closing.table)));
  return { evidence: out, rows: model.indicators };
}

export const BUILD = { changed, peers, missing };
