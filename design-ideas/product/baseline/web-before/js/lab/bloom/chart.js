// The bloom: ten leaves round the count of what needs treatment. The leaves, rings and ticks are one SVG (viz/core.js plumbing: viz(), bindTip, tokens only, the
// motion vocabulary of css/motion.css); the centre and the labels are HTML laid over it, so that Hebrew and numbers lay out as everywhere else on the page.
// Every leaf is a focusable link to its domain; hovering or focusing one lights it and its label and dims the rest. Geometry and words: geo.js (tested).
import { h, svg, icon, DOMAIN_ICON } from "../../ui.js";
import { viz, bindTip, tipHead, tipRow, uid, arcPath, TAU, STATUS_COLOR, STATUS_WORD } from "../../viz/core.js";
import { sortIndicators } from "../../viz/matrix.js";
import * as G from "./geo.js";

const TONE_CLS = { concern: "is-concern", watch: "is-watch", good: "is-good", bud: "is-bud", empty: "is-empty" };
const stagger = (i) => Math.min(12, Math.round(i * 1.2));                 // the entrance staggers at most 12 deep (css/motion.css)

// a small leaf in the colour of a tone: the key under the chart, the legend on a phone and the marks of the rows use it
export function leafSwatch(tone, { w = 18, hgt = 28, cls = "" } = {}) {
  const L = hgt - 4, half = Math.min(w / 2 - 1.5, L * 0.36);
  return svg("svg", { class: `lb-sw ${TONE_CLS[tone] || ""} ${cls}`.trim(), viewBox: `${-w / 2} ${-(L + 2)} ${w} ${hgt}`, width: w, height: hgt, "aria-hidden": "true", focusable: "false" },
    svg("path", { d: G.leafPath({ base: 0, length: L, half }) }));
}

// the leaf as a small mark in front of an eyebrow (the brand's leaf, drawn with the same path as the bloom's)
export const leafMark = () => leafSwatch("good", { w: 11, hgt: 17, cls: "lb-mark" });

export function bloomChart(model, data, { bus } = {}) {
  const key = model.city.key, V = G.VIEW, n = data.slots, linked = !data.empty;
  // a town without a single indicator: a ring of closed buds, only a picture (nothing to open)
  const shown = data.empty ? data.petals.map((p) => ({ ...p, tone: "bud", length: G.LEN.bud, half: G.BUD_HALF })) : data.petals.filter((p) => p.tone !== "empty");
  const nodes = new Map(), t = data.total;

  const root = h("div.lb-bloom");
  const s = svg("svg", { class: "lb-svg", viewBox: `0 0 ${V.w} ${V.h}`, width: V.w, height: V.h, focusable: "false" });
  const defs = svg("defs"), rings = svg("g", { class: "lb-rings", "aria-hidden": "true" }), tickG = svg("g", { class: "lb-ticks", "aria-hidden": "true" }),
    leads = svg("g", { class: "lb-leads", "aria-hidden": "true" }), leaves = svg("g", { class: "lb-leaves" });
  s.append(defs, rings);

  // the scale: the base, the 50% ring and the dashed "everything" ring all come from the same function that sizes a leaf
  const ring = (r, cls, i) => svg("path", { class: `draw lb-ring ${cls}`, style: { "--len": Math.ceil(TAU * r), "--i": i }, d: arcPath(V.cx, V.cy, r, 0, TAU - 0.0005), fill: "none" });
  // nothing judged means nothing to measure: only the ring the buds sit on, and the labels come closer
  const labelR = t.judged ? G.RING.label : G.RING.base + G.LEN.bud + 56;
  rings.append(ring(G.RING.base, "is-base", 0));
  if (t.judged) {
    rings.append(ring(G.ringRadius(0.5), "is-mid", 1), svg("circle", { class: "fade lb-ring is-all", cx: V.cx, cy: V.cy, r: G.ringRadius(1), fill: "none" }));
    const label = (r, text, i) => svg("text", { class: "fade lb-rt", style: { "--i": i }, x: V.cx, y: V.cy - r + 3.5, "text-anchor": "middle" }, text);
    rings.append(label(G.ringRadius(0.5), "חצי", 4), label(G.ringRadius(1), "כולם", 5));
  }

  // the centre: a disc, and round it the ticks of the judged indicators (concern first, clockwise from 12 o'clock)
  const stat = G.tickStatuses(t, 60);
  G.tickLines(60).forEach((l) => tickG.append(svg("line", { class: `lb-tick ${stat ? "pop is-" + stat[l.k] : "fade is-off"}`, style: { "--i": Math.min(11, Math.floor(l.k / 5)) }, x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 })));
  s.append(svg("circle", { class: "fade lb-disc", cx: V.cx, cy: V.cy, r: G.RING.hub }), tickG, leads, leaves);

  const labels = [];
  shown.forEach((p, k) => {
    const deg = G.toDeg(p.angle), gid = uid("lbg"), spec = { base: G.RING.base, length: p.length, half: p.half }, bud = p.tone === "bud", i = stagger(p.index);
    defs.append(svg("linearGradient", { id: gid, class: `lb-g ${TONE_CLS[p.tone]}`, x1: 0, y1: 1, x2: 0, y2: 0, style: { "--k": Math.round((p.pressure ?? 0) * 100) } },
      svg("stop", { class: "lb-s0", offset: 0 }), svg("stop", { class: "lb-s1", offset: 1 })));
    const leaf = svg("g", { class: "lb-leaf grow-y", style: { "--i": i } },
      svg("path", { class: "lb-shape", d: G.leafPath(spec), fill: `url(#${gid})` }),
      bud ? null : svg("path", { class: "lb-fold", d: G.foldPath(spec) }),
      bud ? null : svg("path", { class: "lb-vein", d: G.veinPath(spec) }));
    const el = svg(linked ? "a" : "g", { class: `lb-pl ${TONE_CLS[p.tone]}`, "data-id": p.id, ...(linked ? { href: G.domainHref(key, p.id), "aria-label": `${G.petalLabel(p)}. לפתיחת התחום` } : {}) },
      svg("path", { class: "lb-wedge", d: G.slotWedge(p.index, n) }),
      svg("g", { transform: `translate(${V.cx} ${V.cy}) rotate(${deg})` }, leaf));
    leaves.append(el);

    const ld = G.leaderLine(p.angle, G.RING.base + p.length, labelR);
    const lead = ld ? svg("line", { class: "fade lb-lead", "data-id": p.id, style: { "--i": i }, ...ld }) : null;
    if (lead) leads.append(lead);

    const spot = G.labelSpot(p.angle, labelR);
    const lab = h(linked ? "a.lb-lab" : "span.lb-lab", { class: `is-${spot.side} ${TONE_CLS[p.tone]}`, "data-id": p.id, style: { left: spot.px + "%", top: spot.py + "%" },
      ...(linked ? { href: G.domainHref(key, p.id), tabindex: "-1" } : {}), "aria-hidden": "true" },
      h("span.lb-lab-in.rise", { style: { "--i": i } }, icon(DOMAIN_ICON[p.id] || "bars"), h("b", p.short)));
    labels.push(lab);
    nodes.set(p.id, [el, lab, lead].filter(Boolean));

    const on = () => hot(p.id), off = () => hot(null);
    for (const x of [el, lab]) { x.addEventListener("pointerenter", on); x.addEventListener("pointerleave", off); }
    if (linked) { el.addEventListener("focus", on); el.addEventListener("blur", off); }
    if (linked) { bindTip(el, () => tipFor(p)); bindTip(lab, () => tipFor(p)); }
  });

  // the hub: the number to act on, and what it is out of
  const hub = h("div.lb-hub" + (t.judged ? "" : ".is-none"),
    t.judged ? h("b.lb-hub-n." + (t.concern ? "is-attn" : "is-good"), { "data-count": "" }, String(t.concern)) : h("span.lb-hub-leaf", icon("leaf")),
    h("span.lb-hub-t", t.judged ? G.hubWords(t) : data.empty ? "אין נתונים ביישוב הזה" : "אין מדדים שנשפטו"));
  root.append(s, hub, ...labels);

  function tipFor(p) {
    const list = sortIndicators(model.indicators.filter((a) => a.domain === p.id));
    return [tipHead(p.label), h("div.lb-tt-w", G.domainWords(p.counts)),
      ...list.slice(0, 8).map((a) => tipRow(STATUS_COLOR[a.status] || STATUS_COLOR.na, a.short || a.label, STATUS_WORD[a.status] || STATUS_WORD.na)),
      list.length > 8 ? h("div.lb-tt-w", `ועוד ${list.length - 8} מדדים`) : null, h("div.lb-tt-go", "לחצו לפתיחת התחום")].filter(Boolean);
  }
  // highlight one leaf (null = none): its label and leader light up and the rest dim; the rows under the chart join in through the bus
  function hot(id, src = "chart") {
    root.classList.toggle("has-hot", id != null);
    nodes.forEach((list, k) => list.forEach((e) => e.classList.toggle("is-hot", k === id)));
    if (src === "chart" && bus) bus.dispatchEvent(new CustomEvent("hot", { detail: { id, src } }));
  }
  if (bus) bus.addEventListener("hot", (e) => { if (e.detail.src !== "chart") hot(e.detail.id, e.detail.src); });
  // arrow keys walk the leaves round the ring, as a clock
  s.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key], cur = e.target.closest && e.target.closest("a.lb-pl");
    if (!step || !cur) return;
    const all = [...s.querySelectorAll("a.lb-pl")], next = all[(all.indexOf(cur) + step + all.length) % all.length];
    if (next) { e.preventDefault(); next.focus(); }
  });

  root.setAttribute("role", linked ? "group" : "img");
  root.setAttribute("aria-label", data.empty ? "ורד התחומים: אין נתונים ביישוב הזה, ולכן העלים סגורים" : `ורד התחומים: ${t.judged ? `${t.concern} ${G.hubWords(t)}` : "אין מדדים שנשפטו"}. אורך כל עלה הוא החלק ממדדי התחום שדורשים טיפול.`);
  viz(root);

  // the key and the sentence that says how to read it; on a phone the labels are gone from the leaves and this list names them
  const legend = h("ul.lb-legend", shown.map((p) => h("li", h(linked ? "a.lb-leg" : "div.lb-leg", { class: TONE_CLS[p.tone], "data-id": p.id, ...(linked ? { href: G.domainHref(key, p.id) } : {}) },
    leafSwatch(p.tone, { w: 20, hgt: 32 }), h("span.lb-leg-t", h("b", p.short), h("small", G.domainShort(p.counts)))))));
  legend.querySelectorAll(".lb-leg").forEach((x) => {
    const id = x.dataset.id, on = () => hot(id), off = () => hot(null);
    x.addEventListener("pointerenter", on); x.addEventListener("pointerleave", off); x.addEventListener("focus", on); x.addEventListener("blur", off);
    if (nodes.has(id)) nodes.get(id).push(x);
  });
  const key4 = [["concern", "דורש טיפול"], ["watch", "רק למעקב"], ["good", "הכול תקין"], ["bud", "ללא שיפוט"]];
  const how = t.judged ? [h("p.lb-enc", "אורך העלה: כמה ממדדי התחום דורשים טיפול. למעקב נחשב חצי."),
    h("p.lb-enc.is-sub", "הטבעת המקווקווה: כולם דורשים טיפול. הטבעת הפנימית: חצי. לחצו על עלה לפתיחת התחום."),
    h("ul.lb-key", { "aria-label": "מקרא הצבעים" }, key4.map(([tone, word]) => h("li", leafSwatch(tone, { w: 14, hgt: 22 }), word)))]
    : [h("p.lb-enc", "העלים סגורים: אין מדד שאפשר לשפוט."), h("p.lb-enc.is-sub", "כשיהיו מדדים שנשפטים, אורך כל עלה יראה כמה ממדדי התחום דורשים טיפול.")];
  const fig = h("figure.lb-fig", h("div.lb-clip", root), data.empty ? null : legend, h("figcaption.lb-figcap", ...how));
  // the highlight also reaches the leaves of a page that listens (the rows): see bloom.js
  return { el: fig, hot, root };
}
