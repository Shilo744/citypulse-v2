// The hero of the entry page (lab direction "entry", prefix .le-): the sky, the town picture that dissolves into it, the logo row,
// the question and the search box. The picture is decoration (alt="" and aria-hidden); everything that says something is real text.
// Day and dusk pictures both sit in the page and CSS shows the one that matches the theme. On a phone the portrait pictures are used.
import { h, add, icon, logoMark } from "../../ui.js";
import { searchBox } from "../../components.js";
import { viz } from "../../viz/core.js";

const IMG = "assets/lab/";
const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const narrow = () => typeof matchMedia === "function" && matchMedia("(max-width: 600px)").matches;          // the short placeholder where the long one would be cut
export const homeHref = () => (location.hash.startsWith("#/lab") ? "#/lab/entry" : "#/");

// one town picture: the wide one, and the portrait one for a phone (the browser picks by width, so only one of the two is downloaded)
export function picture(name, theme) {
  const wide = `${IMG}town-${name}.webp`, tall = `${IMG}town-portrait-${name}.webp`;
  const img = h("img.rv", { src: wide, width: 1536, height: 1024, alt: "", "aria-hidden": "true", loading: "eager", decoding: "async", fetchpriority: theme === (document.documentElement.dataset.theme === "dark" ? "dusk" : "day") ? "high" : "low" });
  const pic = h("picture.le-pic.le-pic-" + theme, h("source", { media: "(max-width: 720px)", srcset: tall, width: 1024, height: 1536 }), img);
  // the picture fades in when it has arrived (on a slow connection it never pops in after its own entrance has run)
  const ready = () => pic.classList.add("is-ready");
  if (img.complete && img.naturalWidth) ready(); else { img.addEventListener("load", ready, { once: true }); img.addEventListener("error", ready, { once: true }); }
  return pic;
}

// a few stars for the dusk sky (the picture's own sky is cropped away); fixed positions from a seed, so the page looks the same on every visit
function stars(n = 64) {
  let s = 20261029;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: n }, (_, i) => h("i.le-star.fade", { style: { left: (rnd() * 100).toFixed(1) + "%", top: (rnd() * 74).toFixed(1) + "%", "--i": i % 12, "--sz": (1.2 + rnd() * 1.8).toFixed(1) + "px", "--a": Math.round(46 + rnd() * 54) + "%" } }));
}

// the sky: a gradient from the colours of the picture (so that the picture dissolves into it), a wash of light that fades in slowly, stars at dusk
export function sky() {
  return viz(h("div.le-sky", { "aria-hidden": "true" }, h("div.le-wash.fade"), h("div.le-stars", stars())));
}

// no star is ever drawn behind a word: the stars that would touch text (or its neighbourhood) are hidden, again whenever the layout or the theme changes
export function keepStarsOffText(hero) {
  const TEXT = ".le-brand, .le-navlink, .le-nav .theme-btn, .le-eyebrow, .le-w, .le-lede, .le-search, .le-quick-l, .le-quick a, .le-stat";
  let queued = false, tries = 0, seen = false, ro = null, mo = null;
  const stop = () => { if (mo) mo.disconnect(); if (ro) ro.disconnect(); };
  const run = () => {
    queued = false;
    if (!hero.isConnected) { if (seen || ++tries > 20) stop(); else later(); return; }      // not mounted yet: look again in a moment; gone again (another route): stop watching
    seen = true;
    const stars = [...hero.querySelectorAll(".le-star")];
    if (!stars.length || !stars[0].offsetParent) return;                                    // light theme: the sky has no stars
    const pad = 9, boxes = [...hero.querySelectorAll(TEXT)].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
    stars.forEach((s) => {
      const r = s.getBoundingClientRect();
      s.style.visibility = boxes.some((b) => r.right > b.left - pad && r.left < b.right + pad && r.bottom > b.top - pad && r.top < b.bottom + pad) ? "hidden" : "";
    });
  };
  function later() { if (!queued) { queued = true; requestAnimationFrame(run); } }
  if (typeof ResizeObserver === "function") { ro = new ResizeObserver(later); ro.observe(hero); }
  mo = new MutationObserver(later);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  later();
  return later;
}

// each word of the headline rises in its turn (--w is the word's place in the sentence)
function words(text, from) {
  return text.split(" ").flatMap((w, i) => [h("span.le-w.rv", { style: { "--w": from + i } }, w), " "]).slice(0, -1);
}

export function hero(ctx) {
  const small = narrow(), last = readLast(), quick = h("div.le-quick.rv", quickChildren([], last)), stats = h("div.le-stats.rv");
  const search = searchBox({ big: true, openOnFocus: false, autofocus: !coarse(), placeholder: small ? "הקלידו שם יישוב" : "הקלידו שם יישוב, למשל: שדרות, חיפה, אום אל-פחם" });
  const el = h("section.le-hero", { "aria-labelledby": "le-h1" },
    sky(),
    h("div.le-art", { "aria-hidden": "true" }, picture("day", "day"), picture("dusk", "dusk")),
    h("div.le-top.le-wrap",
      h("a.le-brand", { href: homeHref(), "aria-label": "CityPulse, בריאות הציבור ברמת היישוב" }, logoMark(), h("span.le-brand-t", h("b", "CityPulse"), h("small", "בריאות הציבור ברמת היישוב"))),
      h("nav.le-nav", { "aria-label": "קישורים" }, h("a.le-navlink", { href: "#/method" }, icon("book"), "שיטה ומקורות"), ctx && ctx.themeBtn ? ctx.themeBtn() : null)),
    h("div.le-copy.le-wrap",
      h("p.le-eyebrow.rv", "נתונים רשמיים, בלשון פשוטה"),
      h("h1.le-h1", { id: "le-h1" }, h("span.le-h1a", words("איך מצב הבריאות ביישוב שלכם?", 0)), " ", h("span.le-h1b", words("במספרים שאפשר לבדוק", 6))),
      h("p.le-lede.rv", "בחרו יישוב וראו איפה הוא עומד מול הארץ, מה השתנה ומה כדאי לטפל בו קודם."),
      h("div.le-search.land-search.rv", search),
      quick,
      stats));
  const recull = keepStarsOffText(el);
  // the numbers and the popular towns arrive with the data (the search box works without them)
  const fill = (d) => {
    if (d.top && d.top.length) { quick.replaceChildren(); add(quick, quickChildren(d.top, last)); }
    stats.replaceChildren(...statLine(d));
    recull();
  };
  return { el, fill };
}

// localities with data, indicators, official sources: one quiet line, the numerals count up
export function statLine(d) {
  const stat = (n, label) => (n ? h("span.le-stat", h("b.ltr", { "data-count": "" }, Number(n).toLocaleString("en-US")), " ", label) : null);
  const localities = d.geo && d.geo.length ? stat(d.geo.length, ["יישובים", h("span.le-opt", " עם נתונים")]) : d.hl && d.hl.localities ? stat(d.hl.localities, "יישובים") : null;
  const indicators = d.meta && d.meta.indicators ? stat(d.meta.indicators.length, "מדדים") : d.hl ? stat(d.hl.indicators, "מדדים") : null;
  const sources = d.meta && d.meta.sources ? stat(Object.keys(d.meta.sources).length, "מקורות רשמיים") : null;
  return [localities, indicators, sources].filter(Boolean);
}

// the last locality this browser looked at (the same key the real entry page reads)
export function readLast() {
  try { const v = JSON.parse(localStorage.getItem("cp2-last") || "null"); return v && v.key && v.name ? v : null; } catch (e) { return null; }
}

// the row under a search box: "continue with the last locality" first (when this browser has one), then the popular towns
export function quickChildren(top, last) {
  const resume = last ? h("a.le-resume", { href: `#/c/${encodeURIComponent(last.key)}` }, icon("clock"), `היישוב האחרון שצפיתם בו: ${last.name}`, icon("left")) : null;
  const towns = top && top.length ? [h("span.le-quick-l", "או נסו:"), ...top.slice(0, 6).map((c, i) => h("a" + (i > 2 ? ".le-extra" : ""), { href: `#/c/${encodeURIComponent(c.key)}` }, c.name))] : [];          // a phone shows the first three
  return [resume, ...towns];
}
