// CityPulse V2 motion engine (the vocabulary lives in css/motion.css). Three jobs, all outside the charts:
//   1. blocks of a page rise into view the first time they are seen (.rv, tagged automatically from a short list of selectors),
//   2. the numbers that carry the message count up from zero,
//   3. the leaf scrollbar: a thin line with a leaf that slides on it, in place of the browser's scrollbar on a desktop.
// Charts animate themselves (viz/core.js); this file never touches their insides. Blocks and numbers are skipped when the system asks for
// reduced motion, and everything is made final before printing.
const doc = document.documentElement;
const view = document.getElementById("view") || document.getElementById("gallery");
const reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

/* ───────────────────────── the leaf scrollbar ───────────────────────── */
// A lane is a thin line with a leaf that slides on it. get() says how far something has scrolled (pos), how far it can go (max) and whether the
// lane is wanted at all (show); set(y) moves it. The page has one lane, the menu another (the browser's own grey bar is hidden in both).
function makeLane(cls, get, set) {
  const sb = document.createElement("div");
  sb.className = "cp-sb " + cls;
  sb.setAttribute("aria-hidden", "true");            // a helper for the pointer: the keyboard and screen readers use the page's own scrolling
  // the leaf is symmetric, its two tips sit on the centre line, and it is solid: the line behind it is cut out (see the mask in motion.css)
  sb.innerHTML = '<div class="rail"></div><div class="fill"></div><div class="leaf"><svg viewBox="0 0 18 22"><path d="M9 0C16.6 4.6 16.6 17.4 9 22C1.4 17.4 1.4 4.6 9 0Z" fill="#13ac9c"/></svg></div>';
  document.body.append(sb);
  const leaf = sb.querySelector(".leaf"), fill = sb.querySelector(".fill");
  let idle = 0, dragging = false, queued = false;

  function place() {
    queued = false;
    const g = get();
    sb.hidden = !g.show;                              // hidden first: a hidden lane has no height to measure
    if (sb.hidden) return;
    const track = Math.max(1, sb.clientHeight - leaf.offsetHeight), p = Math.min(1, Math.max(0, g.pos / Math.max(1, g.max)));
    leaf.style.top = p * track + "px";
    sb.style.setProperty("--lt", p * track + "px");
    fill.style.height = p * track + leaf.offsetHeight / 2 + "px";
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
  const wake = () => { sb.classList.add("on"); clearTimeout(idle); idle = setTimeout(() => sb.classList.remove("on"), 900); };

  function seek(y) {
    const r = sb.getBoundingClientRect(), track = Math.max(1, r.height - leaf.offsetHeight);
    set(Math.max(0, Math.min(1, (y - r.top - leaf.offsetHeight / 2) / track)) * get().max);
  }
  sb.addEventListener("pointerdown", (e) => { dragging = true; sb.classList.add("drag"); sb.setPointerCapture(e.pointerId); seek(e.clientY); e.preventDefault(); });
  sb.addEventListener("pointermove", (e) => { if (dragging) seek(e.clientY); });
  const end = (e) => { dragging = false; sb.classList.remove("drag"); try { sb.releasePointerCapture(e.pointerId); } catch (x) { /* already released */ } };
  sb.addEventListener("pointerup", end);
  sb.addEventListener("pointercancel", end);
  return { sb, place, schedule, wake };
}

// the page: the lane sits against the menu, on the content side of it; without a menu (the entry page) it sits at the window's edge
(function pageLane() {
  const side = document.getElementById("side");
  const maxScroll = () => Math.max(1, doc.scrollHeight - window.innerHeight);
  const L = makeLane("", () => ({ show: doc.scrollHeight > window.innerHeight + 4, pos: window.scrollY, max: maxScroll() }), (y) => window.scrollTo({ top: y, behavior: "instant" }));   // "instant": the page's smooth scrolling would lag behind the pointer
  doc.classList.add("cp-scroll");

  function lane() {
    const r = side && side.getBoundingClientRect(), vw = doc.clientWidth, top = document.querySelector(".top");
    const w = r && r.width && r.left < vw && r.right > 0 && doc.dir !== "ltr" && getComputedStyle(side).display !== "none" ? Math.max(0, vw - r.left) : 0;
    const t = top && top.offsetHeight && getComputedStyle(top).display !== "none" ? top.offsetHeight + 10 : 16;
    doc.style.setProperty("--mo-side", w + "px");
    doc.style.setProperty("--mo-top", t + "px");
  }
  window.addEventListener("scroll", () => { L.schedule(); L.wake(); }, { passive: true });
  window.addEventListener("resize", () => { lane(); L.schedule(); });
  if (window.ResizeObserver && side) new ResizeObserver(() => { lane(); L.schedule(); }).observe(side);
  new MutationObserver(() => { lane(); L.schedule(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  lane(); L.place(); L.wake(); setTimeout(() => { lane(); L.place(); }, 400);
})();

// the menu: it scrolls by itself when the window is short, so it gets its own lane at the window's right edge (the menu's outer edge in a Hebrew page)
(function sideLane() {
  const side = document.getElementById("side");
  if (!side) return;
  const reach = () => Math.max(1, side.scrollHeight - side.clientHeight);
  const L = makeLane("side-sb", () => {
    const r = side.getBoundingClientRect();                                           // a closed drawer sits off screen, the entry page has no menu at all
    const seen = r.width > 0 && r.right > 0 && r.left < doc.clientWidth;
    return { show: seen && side.scrollHeight > side.clientHeight + 4, pos: side.scrollTop, max: reach() };
  }, (y) => { side.scrollTop = y; });
  side.addEventListener("scroll", () => { L.schedule(); L.wake(); }, { passive: true });
  L.sb.addEventListener("wheel", (e) => { side.scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });          // the lane lies over the menu: the wheel still moves the menu
  window.addEventListener("resize", L.schedule);
  side.addEventListener("transitionend", L.schedule);                                  // the drawer finished sliding in or out
  if (window.ResizeObserver) new ResizeObserver(L.schedule).observe(side);
  new MutationObserver(L.schedule).observe(side, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });   // the menu is drawn again at every route
  new MutationObserver(L.schedule).observe(document.body, { attributes: true, attributeFilter: ["class"] });                       // entry page / drawer
  L.place(); setTimeout(L.place, 400);
})();

/* ───────────────────── blocks rise, numbers count ───────────────────── */
if (view && !reduce) {
  const AUTO = ".pagehead, .sechead, .card, .rv";
  // numbers worth counting: the big figure of a card, the counts of the status tiles, anything marked data-count
  const NUMS = ".big .ltr, .big > b, .count b .ltr, .rscore b .ltr, [data-count]";
  const DIGITS = /^\s*([−\-+]?[₪$€]?)(\d[\d,]*\.?\d*)([^\d]{0,10})\s*$/, MARKS = /[⁦-⁩‎‏؜]/g;   // the app wraps numbers in direction marks

  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target;
    if (el.__num) { countUp(el.__num); return; }
    el.classList.add("in");
    setTimeout(() => el.classList.add("done"), 900);                  // after the entrance, hover transitions must not wait for the stagger
  }), { threshold: 0.04, rootMargin: "0px 0px -5% 0px" }) : null;

  function parse(el) {
    let node = null;
    for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) { node = n; break; }
    if (!node) return null;
    const orig = node.nodeValue, m = DIGITS.exec(orig.replace(MARKS, ""));
    if (!m) return null;
    const tok = m[2], to = parseFloat(tok.replace(/,/g, ""));
    if (/^(19|20)\d{2}$/.test(tok) || !isFinite(to) || to === 0) return null;      // a year is a label, never a count
    return { node, orig, tok, to, dec: (tok.split(".")[1] || "").length, group: tok.includes(","), done: false };
  }
  const fmt = (r, v) => v.toLocaleString("en-US", { minimumFractionDigits: r.dec, maximumFractionDigits: r.dec, useGrouping: r.group });
  const show = (r, v) => { r.node.nodeValue = r.orig.replace(r.tok, () => fmt(r, v)); };
  const finish = (r) => { r.done = true; r.node.nodeValue = r.orig; };
  function countUp(r) {
    if (r.done) return;
    const t0 = performance.now();
    (function tick(now) {
      if (r.done) return;
      const p = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - p, 3);
      if (p < 1) { show(r, r.to * e); requestAnimationFrame(tick); } else finish(r);
    })(t0);
  }
  const counting = new Set();
  window.addEventListener("beforeprint", () => { counting.forEach(finish); view.querySelectorAll(".rv").forEach((el) => el.classList.add("in", "done")); });

  let queued = false;
  function scan() {
    queued = false;
    const fresh = [];
    view.querySelectorAll(AUTO).forEach((el) => {
      if (el.__rv) return;
      el.__rv = 1;
      const up = el.parentElement && el.parentElement.closest(AUTO);
      if (up && view.contains(up) && !el.classList.contains("rv")) return;           // inside another block: it rides along with it
      fresh.push(el);
    });
    const per = new Map();
    fresh.forEach((el) => { const p = el.parentElement, i = per.get(p) || 0; per.set(p, i + 1); el.style.setProperty("--d", Math.min(i, 6)); el.classList.add("rv", "rv-set"); });
    void view.offsetHeight;                                                           // the hidden state is applied once without a transition
    fresh.forEach((el) => { el.classList.remove("rv-set"); if (io) io.observe(el); else el.classList.add("in", "done"); });
    view.querySelectorAll(NUMS).forEach((el) => {
      if (el.__num !== undefined) return;
      const r = parse(el); el.__num = r;
      if (!r || !io) return;
      counting.add(r); show(r, 0); io.observe(el);
    });
  }
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(scan); } }).observe(view, { childList: true, subtree: true });
  scan();
}
