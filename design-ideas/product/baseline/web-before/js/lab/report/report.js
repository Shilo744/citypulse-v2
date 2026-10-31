// The overview as a typeset annual report (lab direction "report", css/lab/report.css, prefix .lr-): read it top to bottom like a magazine.
// A cover (name, verdict, the town under its sky, the five numerals), then one message per section: the headline figures, the trend, what to deal with first,
// every domain at a glance, where to start, what changed, the gaps inside the town, the summary, the sources. On paper it becomes two A4 pages.
// Every sentence and number comes from the city model (or from the cached summary); nothing is invented here.
import { h } from "../../ui.js";
import { cover } from "./cover.js";
import { figuresSection, trendSection } from "./figures.js";
import { prioritiesSection, domainsSection } from "./prio.js";
import { startSection } from "./start.js";
import { changesSection, gapsSection, briefingSection, sourcesSection, closing } from "./tail.js";
import { jumpTo, pickFigures, pad2, runPrint } from "./util.js";

// the cover bleeds to both edges of the main column; the shell's page has its own padding and maximum width, so the amount is measured, not guessed
export function watchBleed(root) {
  if (typeof ResizeObserver !== "function") return;
  let main = null;
  const set = () => {
    if (!main) return;
    const gap = Math.floor((main.clientWidth - root.clientWidth) / 2);
    if (gap >= 0 && gap < 800) root.style.setProperty("--lr-bleed", gap + "px");
  };
  const ro = new ResizeObserver(() => {
    const m = root.closest(".main");
    if (m && m !== main) { main = m; ro.observe(m); }
    set();
  });
  ro.observe(root);
}

// paper is light: while this page is printed a dark theme is switched off and switched back afterwards, and the parts that depend on the width
// (the trend chart) are drawn at the width of the paper. All of it only when this page is the one on screen.
let wasDark = false;
if (typeof window !== "undefined" && !window.__lrPrint) {
  window.__lrPrint = true;
  window.addEventListener("beforeprint", () => {
    if (!document.querySelector(".lr")) return;
    if (document.documentElement.dataset.theme === "dark") { wasDark = true; document.documentElement.dataset.theme = "light"; }
    runPrint("before");
  });
  window.addEventListener("afterprint", () => {
    if (!document.querySelector(".lr")) return;
    if (wasDark) { wasDark = false; document.documentElement.dataset.theme = "dark"; }
    runPrint("after");
  });
}

// the small numbers in front of the section titles follow the order in which the sections really appear
function number(root) {
  root.querySelectorAll(".lr-sh-no").forEach((el, i) => { el.textContent = pad2(i); });
}

export function view(model) {
  const root = h("div.lr");
  watchBleed(root);
  let dom = null;
  const go = (k) => {                                 // a numeral on the cover leads to its list: the concerns to the priorities, the rest to the list by status
    if (k === "concern" && jumpTo(root, "lr-prio")) return;
    if (dom && dom.select) dom.select(k);
    if (!jumpTo(root, "lr-bystatus")) jumpTo(root, "lr-domains");
  };
  root.append(cover(model, go));
  if (!model.coverage.have) { root.append(closing(model)); return root; }

  dom = domainsSection(model);
  const figs = pickFigures(model);
  const more = () => { if (dom && dom.select) dom.select("concern"); jumpTo(root, "lr-bystatus"); };
  const changes = changesSection(model), gaps = gapsSection(model);
  [figuresSection(model), trendSection(model, figs), prioritiesSection(model, more), dom && dom.node, startSection(model)].forEach((s) => { if (s) root.append(s); });
  if (changes || gaps) root.append(changes && gaps ? h("div.lr-pair", changes, gaps) : h("div.lr-pair.is-one", changes || gaps));
  root.append(briefingSection(model, () => number(root)));
  const src = sourcesSection(model); if (src) root.append(src);
  root.append(closing(model));
  number(root);
  return root;
}
