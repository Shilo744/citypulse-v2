// Lab direction "questions3": the questions page exactly as it was, with ONE addition: under the huge sentence of "where are we weakest" sits the bloom (the leaves are the domains).
// Everything else (head, tabs, ledger, evidence) is the questions page unchanged; this file is a copy of questions.js whose first answer is wrapped. Class prefix .lq- plus .lq3-.
// (original description follows) Lab direction "questions": the page is organised around the five questions a mayor or a health officer really asks, and the page IS the answer to the selected one:
// one big sentence, a lead line, then the evidence under it (css/lab/questions.css, prefix .lq-). The selected question lives in the URL (?q=weak|changed|peers|first|missing),
// updated with history.replaceState so that nothing re-renders and an answer can be shared. A free question goes to the real ask page, which does the work.
import { h, icon, ltr, num, outOf } from "../../ui.js";
import { getMeta } from "../../api.js";
import * as D from "../questions/data.js";
import * as P from "../questions/parts.js";
import { ANSWERS as BASE } from "../questions/answers.js";
import { bloomChart } from "../bloom/chart.js";
import { bloomData } from "../bloom/geo.js";

const hasCls = (n, c) => !!(n && n.classList && n.classList.contains(c));

// the one addition: the bloom under the weakest sentence; the weakest domain is lit when the page opens and the light goes with the first touch
function withBloom(nodes, model) {
  if (!model.coverage.have || !D.stateOf(model).judged) return nodes;
  const data = bloomData(model);
  if (data.empty || !data.total.judged) return nodes;
  const st = D.stateOf(model), wd = st.all.concern >= 3 ? D.weakestDomain(model) : null, bus = new EventTarget(), chart = bloomChart(model, data, { bus });
  const cap = chart.el.querySelector(".lb-figcap"), how = cap ? h("div.lq3-how", ...[...cap.childNodes]) : null;
  if (cap) cap.remove();
  if (wd) {
    chart.hot(wd.d.id, "init"); chart.root.classList.add("is-init");
    const clear = () => chart.root.classList.remove("is-init");
    chart.root.addEventListener("pointerenter", clear, { once: true }); chart.root.addEventListener("focusin", clear, { once: true });
  }
  const fig = h("div.lq3-bloom", chart.el, how);
  const out = nodes.filter((n) => !(n && n.querySelector && n.querySelector(".lq-doms")));   // the bloom says what the tinted strip said
  const at = out.findIndex((n) => hasCls(n, "lq-lede"));
  out.splice(at < 0 ? 1 : at + 1, 0, fig);
  return out;
}
const ANSWERS = { ...BASE, weak: (model, ctx) => withBloom(BASE.weak(model, ctx), model) };

const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const dot = (list) => list.filter(Boolean).flatMap((x, i) => (i ? [" · ", x] : [x]));

// what a reader needs to know about the place before any number: the kind of locality, the district, the people (all fields of the model)
function factsLine(c) {
  return h("p.lq-facts-line", dot([c.status, c.district ? "מחוז " + c.district : null, c.population ? [ltr(num(c.population, 0)), " תושבים"] : null, c.sesCluster != null ? ["אשכול חברתי-כלכלי ", ...outOf(c.sesCluster, 10)] : null]));
}

export function view(model) {
  const c = model.city, key = c.key, st = D.stateOf(model), cov = model.coverage;
  getMeta().catch(() => { /* question 5 asks again and says so */ });            // the catalogue is cached for the last question

  // ── the head: the name, who the numbers are about, how much the page rests on, the town on the map ──
  const basis = h("p.lq-basis", h("a", { href: `#/c/${encodeURIComponent(key)}/coverage` }, cov.total > cov.have ? ["מבוסס על ", ltr(String(cov.have)), " מתוך ", ltr(String(cov.total)), " מדדים"] : ["מבוסס על כל ", ltr(String(cov.total)), " המדדים"], icon("left")));
  const head = h("header.lq-head", h("div.lq-id", h("p.lq-eyebrow", "בריאות היישוב"), h("h1.lq-town", c.name), factsLine(c), basis), P.locatorOf(model, 62));

  // ── the five questions (underlined text, never capsules) and the ledger of the five numerals ──
  const panel = h("div.lq-panel", { id: "lq-panel", role: "tabpanel", tabindex: "-1" });
  let cur = null;
  const tabs = D.QUESTIONS.map((q, i) => h("button.lq-tab", { type: "button", role: "tab", id: "lq-tab-" + q.id, "data-q": q.id, "aria-selected": "false", "aria-controls": "lq-panel", tabindex: "-1", onclick: () => select(q.id) },
    h("span.lq-tab-n", { "aria-hidden": "true" }, String(i + 1).padStart(2, "0")), h("span.lq-tab-t", q.text)));
  const tablist = h("div.lq-tabs.no-print", { role: "tablist", "aria-label": "חמש שאלות על בריאות היישוב", "aria-orientation": "vertical" }, tabs);
  tablist.addEventListener("keydown", (e) => {
    const i = D.QUESTIONS.findIndex((q) => q.id === cur), n = D.QUESTIONS.length;
    const to = { ArrowDown: (i + 1) % n, ArrowLeft: (i + 1) % n, ArrowUp: (i + n - 1) % n, ArrowRight: (i + n - 1) % n, Home: 0, End: n - 1 }[e.key];
    if (to == null) return;
    e.preventDefault(); select(D.QUESTIONS[to].id); tabs[to].focus();
  });
  const ledger = P.ledger(st);
  const rail = h("div.lq-rail", tablist, ledger);

  // the answer is replaced in place; the new blocks rise one after the other (the shared .rv motion), with reduced motion they are simply there
  const ctx = { go: (id) => { select(id); panel.focus({ preventScroll: true }); } };
  function select(id, { url = true, scroll = true } = {}) {
    if (!ANSWERS[id]) id = "weak";
    cur = id;
    tabs.forEach((t) => { const on = t.dataset.q === id; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
    panel.setAttribute("aria-labelledby", "lq-tab-" + id);
    panel.replaceChildren(...ANSWERS[id](model, ctx));
    if (url) { try { history.replaceState(history.state, "", (location.hash.split("?")[0] || `#/c/${key}/lab/questions3`) + "?q=" + id); } catch (e) { /* a frame that does not allow it */ } }
    if (scroll) {                                                              // when the old answer was longer, bring the new one into view under the sticky bars
      const wide = typeof matchMedia === "function" && matchMedia("(min-width: 1181px)").matches, limit = wide ? 96 : 64 + tablist.offsetHeight + 12, top = panel.getBoundingClientRect().top;
      if (top < limit) window.scrollBy({ top: top - limit - 8, behavior: smooth() });
    }
  }

  const root = h("div.lq", head, P.askField(model), h("div.lq-main", rail, panel));
  select(D.readQuestion(location.hash) || "weak", { url: false, scroll: false });
  return root;
}
