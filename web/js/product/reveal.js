// Content is ready before the reader gets to it. The old motion module lifts a block (.rv), draws a chart (.viz) and counts a number only when it is already on screen, so a quick
// scroll shows empty space that then fills in. This module starts the same entrances one screen ahead (the same classes, the same animations, only earlier) and lets a number that
// is not yet in view show its final value at once: by the time it is seen it is simply there. Nothing is hidden or removed; with reduced motion nothing needs to run.
const AHEAD = "0px 0px 120% 0px";
const SEL = ".rv, .viz, .big .ltr, .big > b, .count b .ltr, .rscore b .ltr, [data-count]";
let io = null, mo = null;

function start(el) {
  if (el.__num && !el.__num.done) { el.__num.done = true; el.__num.node.nodeValue = el.__num.orig; }          // the old module's counter: the number is final
  if (el.classList.contains("rv") && !el.classList.contains("in")) { el.classList.add("in"); setTimeout(() => el.classList.add("done"), 900); }
  if (el.classList.contains("viz") && !el.classList.contains("in")) { el.dataset.seen = "1"; el.classList.add("in"); }
}
function watch(root) {
  if (!io) return;
  const list = root.matches && root.matches(SEL) ? [root] : [];
  if (root.querySelectorAll) list.push(...root.querySelectorAll(SEL));
  list.forEach((el) => { if (!el.__ahead) { el.__ahead = true; io.observe(el); } });
}
export function installReveal() {
  if (io || typeof IntersectionObserver !== "function" || typeof document === "undefined") return;
  if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); start(e.target); } }), { rootMargin: AHEAD });
  const view = document.getElementById("view") || document.body;
  watch(view);
  if (typeof MutationObserver === "function") {
    let queued = false;
    mo = new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; watch(view); }); });
    mo.observe(view, { childList: true, subtree: true });
  }
}
