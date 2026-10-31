// Lab direction "combo" (route #/c/<key>/lab/combo): the combined version. Three views of one town under underlined tabs:
//   תמונת מצב  = the report's cover (the town under its sky, the verdict, the numerals), then the bloom with the domain rows beside it, then the report's
//                sections (headline figures, trend, what to treat first, where to start, what changed, sources);
//   שאלות      = the "questions first" page;      כל המדדים = the wall of every indicator.
// It only assembles pieces that already exist in the lab (report/, bloom/, questions/, wall/); it adds no data and no chart of its own. Class prefix .lc-.
import { h } from "../../ui.js";
import { cover } from "../report/cover.js";
import { figuresSection, trendSection } from "../report/figures.js";
import { prioritiesSection } from "../report/prio.js";
import { startSection } from "../report/start.js";
import { changesSection, gapsSection, briefingSection, sourcesSection, closing } from "../report/tail.js";
import { jumpTo, pickFigures, pad2 } from "../report/util.js";
import { watchBleed } from "../report/report.js";
import { bloomChart } from "../bloom/chart.js";
import { bloomData } from "../bloom/geo.js";
import { domainsSection as bloomRows } from "../bloom/sections.js";

const TABS = [["overview", "תמונת מצב"], ["questions", "שאלות"], ["wall", "כל המדדים"]];
const number = (root) => root.querySelectorAll(".lr-sh-no").forEach((el, i) => { el.textContent = pad2(i); });

// the overview tab
function overview(model) {
  const root = h("div.lr.lc-ov");
  watchBleed(root);
  const go = (k) => { if (k === "concern" && jumpTo(root, "lr-prio")) return; jumpTo(root, "lb-domains"); };       // a numeral leads to its list
  root.append(cover(model, go));
  if (!model.coverage.have) { root.append(closing(model)); return root; }

  const data = bloomData(model), bus = new EventTarget(), chart = bloomChart(model, data, { bus }), rows = bloomRows(model, data, bus);
  if (rows) root.append(h("div.lb.lc-bl", h("div.lc-bl-fig", chart.el), h("div.lc-bl-rows", rows)));

  const figs = pickFigures(model), changes = changesSection(model), gaps = gapsSection(model);
  [figuresSection(model), trendSection(model, figs), prioritiesSection(model, () => jumpTo(root, "lb-domains")), startSection(model)].forEach((s) => { if (s) root.append(s); });
  if (changes || gaps) root.append(changes && gaps ? h("div.lr-pair", changes, gaps) : h("div.lr-pair.is-one", changes || gaps));
  root.append(briefingSection(model, () => number(root)));
  const src = sourcesSection(model); if (src) root.append(src);
  root.append(closing(model));
  number(root);
  return root;
}

const loaders = {
  overview: async (m) => overview(m),
  questions: async (m) => (await import("../questions/questions.js")).view(m),
  wall: async (m) => (await import("../wall/wall.js")).view(m),
};

export async function view(model) {
  const key = encodeURIComponent(model.city.key), base = `#/c/${key}/lab/combo`;
  const q = new URLSearchParams((location.hash.split("?")[1] || "")).get("t");
  let cur = TABS.some(([id]) => id === q) ? q : "overview", token = 0;
  const body = h("div.lc-body"), cache = new Map();
  const tabs = h("div.lc-tabs", { role: "tablist", "aria-label": "שלוש תצוגות של אותו יישוב" },
    TABS.map(([id, label]) => h("button.lc-tab", { type: "button", role: "tab", id: "lc-tab-" + id, "aria-controls": "lc-body", onclick: () => show(id, true), onkeydown: (e) => arrows(e, id) }, label)));
  body.id = "lc-body"; body.setAttribute("role", "tabpanel");

  function arrows(e, id) {                                                      // arrow keys walk the tabs (RTL: right = previous)
    const i = TABS.findIndex(([x]) => x === id), step = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = TABS[(i + step + TABS.length) % TABS.length][0]; show(n, true); tabs.querySelector("#lc-tab-" + n).focus();
  }
  async function show(id, user) {
    cur = id; const my = ++token;
    tabs.querySelectorAll(".lc-tab").forEach((b) => { const on = b.id === "lc-tab-" + id; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    body.setAttribute("aria-labelledby", "lc-tab-" + id);
    if (user) { try { history.replaceState(null, "", id === "overview" ? base : `${base}?t=${id}`); } catch (e) { /* ignore */ } }
    let node = cache.get(id);
    if (!node) {
      try { node = await loaders[id](model); } catch (e) { node = h("p.lc-err", "לא הצלחנו לבנות את התצוגה הזאת. " + String((e && e.message) || e)); }
      if (id !== "overview") cache.set(id, node);            // the overview is drawn again (its charts replay), the others keep their state
    }
    if (my !== token) return;
    body.replaceChildren(node);
    if (user) { const top = tabs.getBoundingClientRect().top + window.scrollY - 70; if (window.scrollY > top) window.scrollTo({ top, behavior: "auto" }); }
  }
  await show(cur, false);
  return h("div.lc", h("nav.lc-nav.no-print", tabs, h("a.lc-entry", { href: "#/lab/entry" }, "דף הכניסה בעיצוב המשולב")), body);
}
