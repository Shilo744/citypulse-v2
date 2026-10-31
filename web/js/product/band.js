// The opening band of every page (SPEC 3.6): a pale sky ground that holds the eyebrow, the h1 and one line.
//   homeBand(spec)     the entry page and the city home: eyebrow, h1, facts, basis, actions, ask field and the picture window
//   titleBand(spec)    every other page: a title zone of 96 to 120 px, no picture
//   nodataSpot(spec)   the calm "no data" spot: tiny and uncovered towns, not-found and error states
//   autoBand(node, info)  the default for a page module that has no adapter yet: its own .hero is lifted into the band slot and re-grounded
// All of them return plain nodes; the router puts the band before the page body in #view. Pictures: assets/product/ (SPEC 8); a missing file shows
// the sky colour, never a broken-image box.
import { h, icon } from "../ui.js";

const PIC = "assets/product/";

// ── pictures that follow the theme: only the active one exists, the other is made on a theme toggle ──
const themed = new Set();
let watching = false;
const themeNow = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
function watch() {
  if (watching || typeof MutationObserver === "undefined") return;
  watching = true;
  new MutationObserver(() => {
    const t = themeNow();
    for (const slot of [...themed]) { if (!slot.el.isConnected) { themed.delete(slot); continue; } if (slot.theme !== t) { slot.theme = t; slot.el.replaceChildren(slot.make(t)); } }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
export function themedSlot(cls, make) {
  const el = h("span." + cls, { "aria-hidden": "true" }), t = themeNow();
  el.append(make(t)); themed.add({ el, make, theme: t }); watch();
  return el;
}
const hide = (img) => { img.addEventListener("error", () => img.remove(), { once: true }); return img; };

// the hero picture: wide on desktop (3 widths), the tight phone crop under 768
export function heroPicture(theme) {
  const k = theme === "dark" ? "dusk" : "day";
  return h("picture",
    h("source", { media: "(max-width: 767px)", srcset: `${PIC}hero-${k}-phone-585.webp 585w, ${PIC}hero-${k}-phone.webp 1170w`, sizes: "100vw" }),
    hide(h("img", { src: `${PIC}hero-${k}-wide-1280.webp`, srcset: `${PIC}hero-${k}-wide-1280.webp 1280w, ${PIC}hero-${k}-wide-1920.webp 1920w, ${PIC}hero-${k}-wide.webp 3000w`, sizes: "100vw", width: 3000, height: 750, alt: "", decoding: "async", fetchpriority: "high" })));
}
export const spotPicture = (theme) => hide(h("img", { src: `${PIC}nodata-${theme === "dark" ? "dusk" : "day"}.webp`, width: 1200, height: 800, alt: "", decoding: "async" }));
export const artWindow = () => themedSlot("n-band-art", heroPicture);

// ── the sky: its own layer, so the words are there at once while the colour washes in (the one new motion verb, band.css) ──
export function wash(el) {
  el.classList.add("wash");
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
  return el;
}
const sky = () => wash(h("span.n-band-sky", { "aria-hidden": "true" }));

// ── home / entry band ──
// spec: { eyebrow, title, id, facts: [node|string], basis, lines, switcher, actions: node, ask: node, art: true|false, tone: "calm", cls: an extra class of the page that owns the band }
//   lines and switcher are the page's own nodes, put straight into the band (the page hides and shows them itself): the quiet lines under the facts, and the level switch of the town page
export function homeBand(spec = {}) {
  const { eyebrow, title, id = "n-h1", facts, basis, lines, switcher, actions, ask, art = true, cls } = spec;
  return h("section.n-band.n-band-home" + (art ? "" : ".n-band-noart") + (spec.tone ? ".n-band-" + spec.tone : "") + (cls ? "." + cls : ""), { "aria-labelledby": id },
    sky(),
    h("div.n-band-in",
      eyebrow ? h("div.n-band-eyebrow", eyebrow) : null,
      h("h1.n-band-name", { id, tabindex: "-1" }, title),
      facts && facts.length ? h("div.n-band-facts", facts) : null,
      basis ? h("p.n-band-basis", basis) : null,
      lines || null,
      switcher || null,
      actions ? h("div.n-band-actions.no-print", actions) : null,
      ask ? h("div.n-band-ask.no-print", ask) : null),
    art ? artWindow() : null);
}

// ── title zone ──
// spec: { eyebrow, title, lede, back: { href, label }, id, actions }
export function titleBand(spec = {}) {
  const { eyebrow, title, lede, back, id = "n-h1", actions } = spec;
  const top = back ? h("a.n-band-back", { href: back.href }, icon("right", 16), back.label) : eyebrow ? h("div.n-band-eyebrow", eyebrow) : null;
  return h("header.n-band.n-band-title", { "aria-labelledby": id },
    sky(),
    h("div.n-band-in", top, h("h1.n-band-h1", { id, tabindex: "-1" }, title), lede ? h("p.n-band-lede", lede) : null, actions ? h("div.n-band-actions.no-print", actions) : null));
}

// ── the calm "nothing here" spot ──
// spec: { title, text, actions, level }
export function nodataSpot(spec = {}) {
  const { title, text, actions, level = 2 } = spec;
  return h("div.n-band-spot",
    themedSlot("n-band-spotpic", spotPicture),
    h("div.n-band-spottext", h("h" + level + ".n-band-spottitle", title), text ? h("p", text) : null, actions ? h("div.n-band-actions", actions) : null));
}

// ── the default for a page without an adapter ──

// the old pages call their title h1 inside their own heading block; a second h1 would break the page outline, so it becomes a level-2 heading (same element, same css)
export function demoteH1(root, except) {
  root.querySelectorAll("h1").forEach((x) => {
    if (x === except) return;
    if (x.classList.contains("h1")) {                                  // styled by its class alone: a real h2, so that no tool or reader counts a second h1
      const t = document.createElement("h2");
      for (const a of x.attributes) t.setAttribute(a.name, a.value);
      t.append(...x.childNodes); x.replaceWith(t);
    } else { x.setAttribute("role", "heading"); x.setAttribute("aria-level", "2"); }
  });
}

// the old navy .hero becomes the band: pale ground, theme tokens (the property list of css/layout.css is released in band.css)
export function regroundHero(hero) {
  hero.classList.add("n-band", "n-band-hero");
  const t = hero.querySelector("h1");
  if (t) t.setAttribute("tabindex", "-1");
  return hero;
}

// info: { eyebrow, title, lede, back }. Returns { band, node }: the band for the slot above the body and the page body without it.
export function autoBand(node, info = {}) {
  const hero = node.matches && node.matches(".hero") ? node : node.querySelector && node.querySelector(".hero");
  if (hero) {
    const t = hero.querySelector("h1");
    if (t) {
      if (hero === node) return { band: regroundHero(hero), node: null };
      hero.remove();
      demoteH1(node);
      return { band: regroundHero(hero), node };
    }
  }
  demoteH1(node);
  return { band: titleBand(info), node };
}
