// Lab direction "questions2": the "questions first" page again, with a compact illustrated banner, a warm paper page, the huge sentence of the selected answer and a
// visual under it (the bloom for "where are we weakest"). The logic is the existing questions page's (data.js, answers.js, parts.js are imported, not edited);
// this file only recomposes it: banner, question list, status row, and the top of each answer (sentence, lead, visual). Class prefix .lk- (css/lab/questions2.css).
import { h, icon, ltr, num, outOf } from "../../ui.js";
import { getMeta } from "../../api.js";
import { viz } from "../../viz/core.js";
import * as D from "../questions/data.js";
import * as P from "../questions/parts.js";
import { ANSWERS } from "../questions/answers.js";
import { bloomChart, leafMark } from "../bloom/chart.js";
import { bloomData } from "../bloom/geo.js";

const dot = (list) => list.filter(Boolean).flatMap((x, i) => (i ? [" · ", x] : [x]));
const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const hasCls = (n, c) => !!(n && n.classList && n.classList.contains(c));

// what a reader needs to know about the place before any number: the kind of locality, the district, the people (all fields of the model)
function factsLine(c) {
  return h("p.lk-facts", dot([c.status, c.district ? "מחוז " + c.district : null, c.population ? [ltr(num(c.population, 0)), " תושבים"] : null, c.sesCluster != null ? ["אשכול חברתי-כלכלי ", ...outOf(c.sesCluster, 10)] : null]));
}

// the town under its sky: both pictures are in the page and css picks one by theme (decorative)
function art() {
  const img = (cls, file) => h("img.lk-art-img.fade." + cls, { src: `assets/lab/${file}`, width: 1536, height: 1024, alt: "", "aria-hidden": "true", loading: "eager", decoding: "async" });
  return viz(h("div.lk-art", { "aria-hidden": "true" }, img("lk-art-day", "town-day.webp"), img("lk-art-dusk", "town-dusk.webp")));
}

// the free question: a hairline field; Enter sends it to the real ask page, which does the work (no call is made here)
function askField(model) {
  const key = model.city.key, name = model.city.name;
  const input = h("input.lk-ask-in", { type: "text", name: "q", placeholder: `מה תרצו לדעת על הבריאות ב${name}?`, "aria-label": `שאלה חופשית על הבריאות ב${name}`, autocomplete: "off", enterkeyhint: "send" });
  const form = h("form.lk-ask", { role: "search", onsubmit: (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    location.hash = `#/c/${encodeURIComponent(key)}/ask?q=${encodeURIComponent(q)}`;
  } }, icon("search"), input, h("button.lk-ask-go", { type: "submit", "aria-label": "שליחת השאלה לעוזר החכם" }, icon("left")));
  return h("div.lk-askwrap.no-print", form, h("p.lk-ask-note", "שאלה חופשית נענית בעמוד \"שאלו את הסוכן\", בעזרת בינה מלאכותית."));
}

// the bloom under the weakest answer: the leaves are the domains (a longer leaf = more of its figures need treatment); hovering a row or the domain named in the sentence lights its leaf
function bloomFigure(model, wd) {
  const data = bloomData(model);
  if (data.empty || !data.total.judged) return null;
  const bus = new EventTarget(), chart = bloomChart(model, data, { bus });
  const cap = chart.el.querySelector(".lb-figcap"), how = cap ? h("div.lk-how", ...[...cap.childNodes]) : null;   // how to read the leaves goes under the lead line, so the picture itself stays short
  if (cap) cap.remove();
  const fig = h("div.lk-bloom", chart.el);
  if (wd) {                                                                      // the weakest domain is lit when the page opens, and the light goes with the first touch
    chart.hot(wd.d.id, "init");
    chart.root.classList.add("is-init");
    const clear = () => chart.root.classList.remove("is-init");
    chart.root.addEventListener("pointerenter", clear, { once: true });
    chart.root.addEventListener("focusin", clear, { once: true });
  }
  return { el: fig, how, say: (id) => bus.dispatchEvent(new CustomEvent("hot", { detail: { id, src: "rows" } })), chart };
}

// the top of an answer: its question (a quiet label), the one huge sentence, the lead line; and, beside or under them, the visual when the answer has one
function compose(id, nodes, model) {
  const ql = nodes.find((n) => hasCls(n, "lq-ql")), sen = nodes.find((n) => hasCls(n, "lq-sentence")), led = nodes.find((n) => hasCls(n, "lq-lede"));
  let rest = nodes.filter((n) => n && n !== ql && n !== sen && n !== led), vis = null;
  if (id === "weak" && model.coverage.have && D.stateOf(model).judged) {
    const wd = D.stateOf(model).all.concern >= 3 ? D.weakestDomain(model) : null;
    vis = bloomFigure(model, wd);
    if (vis) {
      rest = rest.filter((n) => !(n.querySelector && n.querySelector(".lq-doms")));      // the bloom says what the tinted strip said
      const dom = sen && sen.querySelector(".lq-sdom");
      if (dom && wd) { const on = () => vis.say(wd.d.id), off = () => vis.say(null); dom.addEventListener("pointerenter", on); dom.addEventListener("pointerleave", off); dom.addEventListener("focus", on); dom.addEventListener("blur", off); }
      const five = D.weakestFive(model);
      rest.forEach((n) => n.querySelectorAll && n.querySelectorAll("li.lq-wr").forEach((li, i) => {
        const a = five[i]; if (!a) return;
        const on = () => vis.say(a.domain), off = () => vis.say(null);
        li.addEventListener("pointerenter", on); li.addEventListener("pointerleave", off); li.addEventListener("focusin", on); li.addEventListener("focusout", off);
      }));
    }
  }
  if (ql && ql.classList) ql.classList.remove("rv");                       // the label is hidden at wide widths and has no reveal of its own
  const lead = h("div.lk-lead", ql, sen, led, vis ? vis.how : null);
  return [h("div.lk-top" + (vis ? ".has-vis" : ""), lead, vis ? vis.el : null), ...rest];
}

export function view(model) {
  const c = model.city, key = c.key, st = D.stateOf(model), cov = model.coverage;
  getMeta().catch(() => { /* question 5 asks again and says so */ });            // the catalogue is cached for the last question

  // ── the banner: the town under a calm sky, with its name, its facts, what the page rests on and the free question ──
  const basis = h("p.lk-basis", h("a", { href: `#/c/${encodeURIComponent(key)}/coverage` }, cov.total > cov.have ? ["מבוסס על ", ltr(String(cov.have)), " מתוך ", ltr(String(cov.total)), " מדדים"] : ["מבוסס על כל ", ltr(String(cov.total)), " המדדים"], icon("left")));
  const head = h("header.lk-head", art(),
    h("div.lk-id", h("p.lk-eyebrow", leafMark(), "בריאות היישוב"), h("h1.lk-town", c.name), factsLine(c), basis),
    P.locatorOf(model, 40), askField(model));

  // ── the five questions (large, numbered, underlined when selected; never capsules or stripes) and the five status numerals as one slim row ──
  const panel = h("div.lk-panel", { id: "lk-panel", role: "tabpanel", tabindex: "-1" });
  let cur = null;
  const tabs = D.QUESTIONS.map((q, i) => h("button.lk-tab", { type: "button", role: "tab", id: "lk-tab-" + q.id, "data-q": q.id, "aria-selected": "false", "aria-controls": "lk-panel", tabindex: "-1", onclick: () => select(q.id) },
    h("span.lk-tab-n", { "aria-hidden": "true" }, String(i + 1).padStart(2, "0")), h("span.lk-tab-t", q.text)));
  const tablist = h("div.lk-tabs.no-print", { role: "tablist", "aria-label": "חמש שאלות על בריאות היישוב", "aria-orientation": "vertical" }, tabs);
  tablist.addEventListener("keydown", (e) => {
    const i = D.QUESTIONS.findIndex((q) => q.id === cur), n = D.QUESTIONS.length;
    const to = { ArrowDown: (i + 1) % n, ArrowLeft: (i + 1) % n, ArrowUp: (i + n - 1) % n, ArrowRight: (i + n - 1) % n, Home: 0, End: n - 1 }[e.key];
    if (to == null) return;
    e.preventDefault(); select(D.QUESTIONS[to].id); tabs[to].focus();
  });
  const rail = h("div.lk-rail", tablist, P.ledger(st));

  // the answer is replaced in place; the new blocks rise one after the other (the shared .rv motion), with reduced motion they are simply there
  const ctx = { go: (id) => { select(id); panel.focus({ preventScroll: true }); } };
  function select(id, { url = true, scroll = true } = {}) {
    if (!ANSWERS[id]) id = "weak";
    cur = id;
    tabs.forEach((t) => { const on = t.dataset.q === id; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
    panel.setAttribute("aria-labelledby", "lk-tab-" + id);
    panel.dataset.q = id;
    panel.replaceChildren(...compose(id, ANSWERS[id](model, ctx), model));
    if (url) { try { history.replaceState(history.state, "", (location.hash.split("?")[0] || `#/c/${key}/lab/questions2`) + "?q=" + id); } catch (e) { /* a frame that does not allow it */ } }
    if (scroll) {                                                              // when the old answer was longer, bring the new one into view under the sticky bars
      const stacked = typeof matchMedia === "function" && matchMedia("(max-width: 1000px)").matches, limit = stacked ? 64 + tablist.offsetHeight + 12 : 96, top = panel.getBoundingClientRect().top;
      if (top < limit) window.scrollBy({ top: top - limit - 8, behavior: smooth() });
    }
  }

  const root = h("div.lk", head, h("div.lk-main", rail, panel));
  select(D.readQuestion(location.hash) || "weak", { url: false, scroll: false });
  return root;
}
