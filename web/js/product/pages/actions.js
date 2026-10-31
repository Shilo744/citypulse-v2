// The action plan in the product: the old module's header (title, lede, tools, the three horizon numerals) becomes the pale band instead of a tinted box, and the line
// that says how the 0 to 100 score is made folds into a details element. The roadmap below is untouched. Styles: css/product/pages/actions.css (n-pg-actions-).
import { h, icon } from "../../ui.js";
import { wash } from "../band.js";
import * as D from "../city/data.js";

// under 860 px the rows of filter chips scroll sideways: the side where more chips wait fades (a class per side, the css draws it), and nothing fades when every chip fits
function chipEdges(node, signal) {
  const bar = node.querySelector(".ac-bar");
  if (!bar) return;
  const upd = () => bar.querySelectorAll(".ac-bar-g").forEach((g) => {
    const max = g.scrollWidth - g.clientWidth, pos = Math.abs(g.scrollLeft);          // the row starts at the right edge: the scroll position runs from 0 to minus max
    g.classList.toggle("is-more-start", max > 2 && pos > 2);
    g.classList.toggle("is-more-end", max > 2 && pos < max - 2);
  });
  bar.addEventListener("scroll", upd, { capture: true, passive: true, signal });
  if (typeof ResizeObserver === "function") { const ro = new ResizeObserver(upd); ro.observe(bar); signal.addEventListener("abort", () => ro.disconnect()); }
  else requestAnimationFrame(upd);
  if (typeof MutationObserver === "function") { const mo = new MutationObserver(upd); mo.observe(bar, { childList: true, subtree: true }); signal.addEventListener("abort", () => mo.disconnect()); }
}

export function adapt(node, ctx) {
  const band = node.querySelector(".ac-head");
  if (!band) return node;
  if (ctx.signal) chipEdges(node, ctx.signal);
  band.remove();
  band.classList.remove("band", "rv", "in", "done");
  band.classList.add("n-band", "n-band-title", "n-pg-actions-band");          // the geometry of every title zone, the numerals stay the page's own
  band.prepend(wash(h("span.n-band-sky", { "aria-hidden": "true" })));
  const title = band.querySelector("h1");
  if (title) title.setAttribute("tabindex", "-1");
  // each horizon numeral reads name, number, time range: the old label ("מהיר · עד 6 חודשים") is split so that the range never breaks in the middle
  band.querySelectorAll(".ac-kf-item").forEach((item) => {
    const label = item.querySelector(".kf-label"), num = item.querySelector(".kf-num"), name = label && label.querySelector("b");
    if (!label || !num || !name) return;
    const range = [...label.childNodes].filter((n) => n !== name).slice(1);          // what follows the name and the dot between
    if (!range.length) return;
    label.replaceChildren(name);
    num.after(h("span.n-pg-actions-range", range));
  });
  // the empty plan invites to compare with similar towns: a town that cannot be compared is sent to the list of what is covered instead
  const primary = band.querySelector(".ac-primary");
  if (primary && D.hasNoPeers(ctx.model) && /\/compare$/.test(primary.getAttribute("href") || "")) {
    primary.setAttribute("href", `#/c/${encodeURIComponent(ctx.model.city.key)}/coverage`);
    primary.replaceChildren("לכיסוי הנתונים", icon("left"));
  }
  const top = (band.querySelector(".ac-head-top") || {}).children && band.querySelector(".ac-head-top").children[0];
  if (top) top.prepend(h("a.n-band-back.n-pg-actions-back.no-print", { href: `#/c/${encodeURIComponent(ctx.model.city.key)}` }, icon("right", 16), "דף היישוב"));
  const how = band.querySelector(".ac-how");
  if (how) {
    const label = how.querySelector("b");
    if (label) label.remove();
    how.replaceWith(h("details.n-pg-actions-how", h("summary", "איך נקבע הציון"), h("p", [...how.childNodes])));
  }
  return { node, band };
}
