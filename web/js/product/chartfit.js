// Chart text is never smaller than 12 px on the screen (SPEC 3.9). The shared chart modules draw their labels at 10.5 to 11.5 units and a viewBox may scale the drawing down,
// so a label can end up at 9 px on a phone. Those modules are read-only: after a page, and after every redraw of a chart (a resize, a chart that opens late), the labels
// that are too small get a font size that comes out at 12 px. A label the chart sized on purpose (bigger already) is never touched.
const MIN = 12, FLOOR = 8;                                              // under FLOOR a text is a hidden helper, not a label

function fit(root) {
  const scale = new Map();
  for (const t of root.querySelectorAll("svg text")) {
    const svg = t.ownerSVGElement;
    if (!svg || !t.textContent.trim()) continue;
    if (t.hasAttribute("data-cp-fit")) { t.style.fontSize = ""; t.removeAttribute("data-cp-fit"); }
    let k = scale.get(svg);
    if (k === undefined) {
      const vb = svg.viewBox && svg.viewBox.baseVal, w = svg.getBoundingClientRect().width;
      k = vb && vb.width && w ? w / vb.width : 1;
      scale.set(svg, k);
    }
    const px = parseFloat(getComputedStyle(t).fontSize) * k;
    if (px >= FLOOR && px < MIN - 0.05) { t.style.fontSize = (MIN / k).toFixed(2) + "px"; t.setAttribute("data-cp-fit", ""); }
  }
}

export function watchChartText(view) {
  if (typeof MutationObserver !== "function") return;
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = setTimeout(() => fit(view), 160); };
  new MutationObserver(later).observe(view, { childList: true, subtree: true });
  window.addEventListener("resize", later, { passive: true });
}
