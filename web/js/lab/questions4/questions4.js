// Lab direction "questions4": the opening of the entry page (the sky, the town picture dissolving into it, the big words, the pill-shaped question field) on top of the
// questions page, unchanged (no bloom). The town name takes the place of the entry headline. Class prefix .lq- (questions), .le- (entry hero), .q4-.
// (questions3 description follows) Lab direction "questions3": the questions page exactly as it was, with ONE addition: under the huge sentence of "where are we weakest" sits the bloom (the leaves are the domains).
// Everything else (head, tabs, ledger, evidence) is the questions page unchanged; this file is a copy of questions.js whose first answer is wrapped. Class prefix .lq- plus .lq3-.
// (original description follows) Lab direction "questions": the page is organised around the five questions a mayor or a health officer really asks, and the page IS the answer to the selected one:
// one big sentence, a lead line, then the evidence under it (css/lab/questions.css, prefix .lq-). The selected question lives in the URL (?q=weak|changed|peers|first|missing),
// updated with history.replaceState so that nothing re-renders and an answer can be shared. A free question goes to the real ask page, which does the work.
import { h, icon, ltr, num, outOf } from "../../ui.js";
import { getMeta } from "../../api.js";
import * as D from "../questions/data.js";
import * as P from "../questions/parts.js";
import { ANSWERS as BASE } from "../questions/answers.js";
import { picture, sky, keepStarsOffText } from "../entry/hero.js";

const ANSWERS = BASE;                                                          // the questions page's answers as they are (no bloom here)

const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const dot = (list) => list.filter(Boolean).flatMap((x, i) => (i ? [" · ", x] : [x]));

// what a reader needs to know about the place before any number: the kind of locality, the district, the people (all fields of the model)
function factsLine(c) {
  return h("p.lq-facts-line", dot([c.status, c.district ? "מחוז " + c.district : null, c.population ? [ltr(num(c.population, 0)), " תושבים"] : null, c.sesCluster != null ? ["אשכול חברתי-כלכלי ", ...outOf(c.sesCluster, 10)] : null]));
}

export function view(model) {
  const c = model.city, key = c.key, st = D.stateOf(model), cov = model.coverage;
  getMeta().catch(() => { /* question 5 asks again and says so */ });            // the catalogue is cached for the last question

  // ── the opening: the entry page's sky and town picture, the town name as its headline, who the numbers are about, the question field ──
  const basis = h("p.q4-basis.le-lede", h("a", { href: `#/c/${encodeURIComponent(key)}/coverage` }, cov.total > cov.have ? ["מבוסס על ", ltr(String(cov.have)), " מתוך ", ltr(String(cov.total)), " מדדים"] : ["מבוסס על כל ", ltr(String(cov.total)), " המדדים"], icon("left")));
  const input = h("input", { type: "text", name: "q", placeholder: `מה תרצו לדעת על הבריאות ב${c.name}?`, "aria-label": `שאלה חופשית על הבריאות ב${c.name}`, autocomplete: "off", enterkeyhint: "send" });
  const ask = h("form.q4-ask.le-search.no-print", { role: "search", onsubmit: (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    location.hash = `#/c/${encodeURIComponent(key)}/ask?q=${encodeURIComponent(q)}`;
  } }, icon("search"), input, h("button.q4-go", { type: "submit" }, "שאלו"));
  const hero = h("section.le-hero.q4-hero", { "aria-labelledby": "q4-h1" },
    sky(), h("div.le-art", { "aria-hidden": "true" }, picture("day", "day"), picture("dusk", "dusk")),
    h("div.le-copy.q4-copy",
      h("p.le-eyebrow", "בריאות היישוב"),
      h("h1.le-h1.q4-town", { id: "q4-h1" }, h("span.le-w", c.name)),
      h("p.le-lede.q4-facts", factsLine(c).childNodes.length ? [...factsLine(c).childNodes] : ""),
      basis, ask));
  keepStarsOffText(hero);

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
    if (url) { try { history.replaceState(history.state, "", (location.hash.split("?")[0] || `#/c/${key}/lab/questions4`) + "?q=" + id); } catch (e) { /* a frame that does not allow it */ } }
    if (scroll) {                                                              // when the old answer was longer, bring the new one into view under the sticky bars
      const wide = typeof matchMedia === "function" && matchMedia("(min-width: 1181px)").matches, limit = wide ? 96 : 64 + tablist.offsetHeight + 12, top = panel.getBoundingClientRect().top;
      if (top < limit) window.scrollBy({ top: top - limit - 8, behavior: smooth() });
    }
  }

  const root = h("div.lq.le.q4", hero, h("div.lq-main", rail, panel));
  select(D.readQuestion(location.hash) || "weak", { url: false, scroll: false });
  return root;
}
