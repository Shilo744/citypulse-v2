// Design lab direction "wall" (route #/c/<key>/lab/wall): the pulse of the town. Every figure the system holds for the town on ONE page, each as a tiny trend line
// against the national line, grouped under its domain (the domain under most pressure first, inside it the figures that are getting worse first), hairlines
// and numerals instead of boxes. A narrow column beside it holds the verdict, the numerals that filter the wall, the town on the map and the three priorities.
// Filters (domain, status) live in the address: ?d=<domain>&s=<status>. css/lab/wall.css, prefix .lw-
import { h, svg, icon, ltr, add, clear } from "../../ui.js";
import { viz, motionOn } from "../../viz/core.js";
import { shareBtn, printBtn } from "../../pages/shared.js";
import { wallDomains, countKinds, groupCounts, GROUP_IDS, GROUP_LABEL, shortLabel, readState, writeHash, passes, domainLineText } from "./data.js";
import { wallCell, markEl, staggerSpark } from "./cell.js";
import { summaryColumn, lineEl } from "./summary.js";

const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

// a town the official sources do not cover: say so calmly and offer the way out
function emptyTown(model) {
  return h("section.lw-empty", h("p.lw-eyebrow", "תמונת מצב בריאותית"), h("h1.lw-town", model.city.name),
    h("h2.lw-calm-t", "אין עדיין נתונים ברמת היישוב הזה"),
    h("p", "המקורות הרשמיים שהמערכת קוראת מהם אינם מפרסמים נתונים על היישוב הזה. בדרך כלל מדובר ביישובים קטנים מאוד, באזורי תעשייה או במרכזים אזוריים."),
    h("a.btn.primary", { href: "#/" }, icon("search"), "בחירת יישוב אחר"));
}

// the key under the title, once: what the marks, the arrows and the two lines mean
function legend(c) {
  const mk = (kind, text) => (kind === "none" ? c.none + c.stale + c.small : c[kind]) > 0 ? h("span.lw-lg", markEl(kind), text) : null, dir = (ic, text) => h("span.lw-lg", h("span.lw-dir", { "aria-hidden": "true" }, icon(ic, 12)), text);
  const ln = (cls, text) => h("span.lw-lg", h("i.lw-kl." + cls, { "aria-hidden": "true" }), text);
  return h("div.lw-legend.rv", { role: "group", "aria-label": "מקרא" },
    h("span.lw-lg-g", mk("concern", "דורש טיפול"), mk("watch", "למעקב"), mk("good", "תקין"), mk("strength", "חוזק"), mk("none", "לא נשפט")),
    h("span.lw-lg-g", h("span.lw-lg-l", "החץ אומר מה טוב:"), dir("up", "גבוה יותר"), dir("downarrow", "נמוך יותר"), dir("minus", "מתאר בלבד")),
    h("span.lw-lg-g", ln("lw-k-city", "היישוב"), ln("lw-k-nat", "הממוצע הארצי")));
}

// the little pulse beside the title: drawn once, like the lines below it
function pulse() {
  return viz(h("span.lw-ecg", { "aria-hidden": "true" }, svg("svg", { viewBox: "0 0 60 16", width: 60, height: 16, focusable: "false" }, svg("path", { class: "draw", d: "M0 8h14l3-6 5 12 3-9 2 3h33", fill: "none", style: { "--len": 82 } }))));
}

export function view(model) {
  const root = h("div.lw");
  if (!model.coverage || !model.coverage.have || !(model.indicators || []).length) { root.append(emptyTown(model)); return root; }
  const domains = wallDomains(model), counts = countKinds(model.indicators), gc = groupCounts(counts), total = counts.total;
  const state = readState(location.hash, domains.map((d) => d.id));
  let seq = 0, domTabs = [], stTabs = [];

  // ── the wall: one block per domain, one cell per figure ──
  const blocks = domains.map((d, di) => {
    const items = d.cells.map((a, k) => { const c = wallCell(model, a, di, k); return { li: h("li", c.el), kind: c.kind, spark: c.spark }; });
    const head = h("a.lw-dh", { href: d.href, "aria-label": `${d.label}: ${domainLineText(d.c)}` },
      h("span.lw-di", { "aria-hidden": "true" }, icon(d.icon, 20)), h("div.lw-dt", h("h3.lw-dn", d.label), h("p.lw-dl", lineEl(d.c), " ", h("span.lw-dgo", { "aria-hidden": "true" }, icon("left", 14)))));
    return { d, di, items, el: h("section.lw-dom.rv" + (d.c.concern ? ".lw-hot" : ""), head, h("ul.lw-cells", items.map((i) => i.li))) };
  });
  const wall = h("div.lw-wall", blocks.map((b) => b.el));
  const reset = () => set({ d: "all", s: "all" });
  const none = h("div.lw-none", { hidden: true }, h("p", "אין מדדים שמתאימים לבחירה."), h("button.lw-link", { type: "button", onclick: reset }, "הצגת כל המדדים"));
  const result = h("p.lw-result"), live = h("p.sr", { "aria-live": "polite" });

  // ── the filters: underlined tabs for the domain, a second row for the status ──
  const tab = (id, text, pressed, onpick, label, n) => h("button.lw-tab", { type: "button", "aria-pressed": String(pressed), "data-v": id, "aria-label": label || null, onclick: onpick }, text, n != null ? h("span.lw-tc", ltr(String(n))) : null);
  const domRow = domains.length > 1 ? h("div.lw-tabrow", { role: "group", "aria-label": "סינון לפי תחום" }, h("span.lw-tabs-l", { "aria-hidden": "true" }, "תחום"),
    [tab("all", "הכל", state.d === "all", () => set({ d: "all" })), ...domains.map((d) => tab(d.id, shortLabel(d.label), state.d === d.id, () => set({ d: d.id }), d.label))]) : null;
  const stIds = GROUP_IDS.filter((id) => gc[id] > 0);
  const stRow = stIds.length > 1 ? h("div.lw-tabrow", { role: "group", "aria-label": "סינון לפי מצב" }, h("span.lw-tabs-l", { "aria-hidden": "true" }, "מצב"),
    [tab("all", "הכל", state.s === "all", () => set({ s: "all" })), ...stIds.map((id) => tab(id, GROUP_LABEL[id], state.s === id, () => set({ s: state.s === id ? "all" : id }), null, gc[id]))]) : null;
  if (domRow) domTabs = [...domRow.querySelectorAll(".lw-tab")];
  if (stRow) stTabs = [...stRow.querySelectorAll(".lw-tab")];

  const sum = summaryColumn(model, { domains, counts, onPick: (g) => { set({ s: state.s === g ? "all" : g }); const r = head.getBoundingClientRect(); if (r.top > innerHeight * 0.7 || r.bottom < 0) head.scrollIntoView({ behavior: smooth(), block: "start" }); } });
  const head = h("header.lw-head.rv", h("h2.lw-h2", { id: "lw-wall-h" }, ["הדופק של ", model.city.name], pulse()), h("div.lw-acts.no-print", shareBtn(), printBtn()),
    h("p.lw-sub", "כל המדדים של היישוב בעמוד אחד. בכל תחום, קודם אלה שמידרדרים."));
  const main = h("section.lw-main", { "aria-labelledby": "lw-wall-h" }, head, h("div.lw-filters.no-print.rv", domRow, stRow, result), legend(counts), wall, none, live);
  root.append(h("div.lw-grid", sum.el, main));

  // ── showing and hiding: the figures that pass the filter stay; a domain with none of them goes ──
  function paint() {
    const vis = []; let shown = 0;
    blocks.forEach((b) => {
      let n = 0;
      b.items.forEach((it) => { const ok = passes(state, b.d.id, it.kind); it.li.hidden = !ok; if (ok) n++; });
      b.el.hidden = !n;
      if (n) vis.push(b);
      shown += n;
    });
    domTabs.forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.v === state.d)));
    stTabs.forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.v === state.s)));
    sum.press(state.s);
    vis.forEach((b, i) => { b.el.style.setProperty("--d", String(Math.min(i, 6))); b.items.forEach((it) => { if (it.spark) staggerSpark(it.spark, i * 2); }); });          // the entrance staggers by domain, counted from the first one that is shown
    none.hidden = shown > 0;
    const filtered = state.d !== "all" || state.s !== "all";
    clear(result); result.hidden = !filtered;
    if (filtered) add(result, ["מוצגים ", ltr(String(shown)), " מתוך ", ltr(String(total)), " מדדים · ", h("button.lw-link", { type: "button", onclick: reset }, "הצגת הכל")]);
    return { vis, shown, filtered };
  }

  // a new choice: what was shown fades out (a fifth of a second), the new set is put in place, the blocks rise again domain by domain and the lines draw again. Reduced motion: at once.
  function apply(animate) {
    const my = ++seq, was = blocks.filter((b) => !b.el.hidden && b.el.classList.contains("in"));
    const done = ({ vis, shown, filtered }) => { live.textContent = animate ? (filtered ? `מוצגים ${shown} מתוך ${total} מדדים` : `מוצגים כל ${total} המדדים`) : ""; return vis; };
    if (!animate || !motionOn() || !was.length) { done(paint()); return; }
    was.forEach((b) => b.el.classList.remove("in"));
    setTimeout(() => {
      if (my !== seq) return;
      const vis = done(paint()), again = vis.filter((b) => b.el.classList.contains("in") || was.includes(b));
      wall.classList.add("lw-reset");                                                 // for one frame nothing transitions: the start state is put in place, unseen
      again.forEach((b) => { b.el.classList.remove("in", "done"); b.items.forEach((it) => { if (it.spark) it.spark.classList.remove("in"); }); });
      void wall.offsetHeight;
      wall.classList.remove("lw-reset");
      requestAnimationFrame(() => {
        if (my !== seq) return;
        again.forEach((b) => { b.el.classList.add("in"); b.items.forEach((it) => { if (it.spark) it.spark.classList.add("in"); }); });
        setTimeout(() => again.forEach((b) => b.el.classList.add("done")), 1100);
      });
    }, 200);
  }
  // the choice lives in the address (replaceState: the router does not draw the page again)
  function set(patch) {
    Object.assign(state, patch);
    try { history.replaceState(history.state, "", writeHash(location.hash, state)); } catch (e) { /* a sandbox without history */ }
    apply(true);
  }

  paint();
  return root;
}
