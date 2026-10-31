// Helpers for the chart gallery (web/gallery.html): one demo box per chart, with a title and a line about the data it shows.
import { h } from "./core.js";

export function demo(sec, title, note, ...nodes) {
  let grid = sec.querySelector(":scope > .gal-grid");
  if (!grid) { grid = h("div.gal-grid"); sec.append(grid); }
  const box = h("div.gal-demo", h("h3.h3", title), note ? h("p.sub", note) : null, ...nodes);
  grid.append(box);
  return box;
}
// a demo that takes the whole row
export const wide = (box) => { box.style.gridColumn = "1 / -1"; return box; };
