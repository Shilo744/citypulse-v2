// The pictogram of a category: one quiet tile with one line drawing in it, the same grid and the same stroke for all five (24 px grid, round caps and joins, no faces, no figures).
// The drawings are Tabler Icons (MIT, tabler.io/icons; the licence text and the credit are in docs/CREDITS.md): child = baby carriage, outcomes = stethoscope, mental = brain, safety = shield with a check,
// context = a building among houses. They are inline SVG with stroke="currentColor", so the colour comes from the tile (css/product/kit.css, tokens --cat-tile and --cat-ink) and follows the theme.
// One function, so that the menu (26 px), the town page (40 px and 32 px) and the category page (88 px) show the same picture for the same category. The picture is decoration: the name next to it says
// everything, so it is hidden from assistive technology. A category without a drawing (an unknown id) gets none and the caller keeps its own icon.
import { h, svg } from "../../ui.js";

// the inner markup of each drawing (Tabler Icons outline, the empty bounding path of the originals left out)
const ART = {
  child: '<path d="M8 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M18 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M2 5h2.5l1.632 4.897a6 6 0 0 0 5.693 4.103h2.675a5.5 5.5 0 0 0 0 -11h-.5v6" /><path d="M6 9h14" /><path d="M9 17l1 -3" /><path d="M16 14l1 3" />',
  outcomes: '<path d="M6 4h-1a2 2 0 0 0 -2 2v3.5h0a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1" /><path d="M8 15a6 6 0 1 0 12 0v-3" /><path d="M11 3v2" /><path d="M6 3v2" /><path d="M20 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />',
  mental: '<path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" /><path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" /><path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" /><path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" /><path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5" /><path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" />',
  safety: '<path d="M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06" /><path d="M15 19l2 2l4 -4" />',
  context: '<path d="M8 9l5 5v7h-5v-4m0 4h-5v-7l5 -5m1 1v-6a1 1 0 0 1 1 -1h10a1 1 0 0 1 1 1v17h-8" /><path d="M13 7l0 .01" /><path d="M17 7l0 .01" /><path d="M17 11l0 .01" /><path d="M17 15l0 .01" />'
};
export const hasArt = (id) => Object.prototype.hasOwnProperty.call(ART, id);

// the same optical weight at every size: a thinner line in the large tile, the full line in the small one
const strokeFor = (size) => (size >= 64 ? 1.5 : size >= 36 ? 1.75 : 2);

// size: the side of the tile in CSS px (--cat; the css of the place that holds it may change it, the drawing follows); cls: extra classes of the place that holds it
export function catArt(id, size = 28, cls = "") {
  if (!hasArt(id)) return null;
  const g = svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": strokeFor(size), "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false" });
  g.innerHTML = ART[id];
  return h("span.n-kit-cat" + (size <= 32 ? ".is-sm" : "") + (cls ? "." + cls : ""), { "aria-hidden": "true", "data-cat": id, style: { "--cat": size + "px" } }, g);
}
