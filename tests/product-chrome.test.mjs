// The frame of the product (w3a, m3): one chrome for the town page and its alias, the town search list, pointer targets and reflow.
// Browser behaviour (real key events, measured target sizes, 320 px at 200 percent text) is measured by src/tools/chrome_probe.js and recorded in design-ideas/product/DONE/w3a.md;
// these tests pin the source rules that make those numbers.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "web");
const read = (...p) => fs.readFileSync(path.join(WEB, ...p), "utf8");
const css = (f) => read("css", "product", f).replace(/\/\*[\s\S]*?\*\//g, "");
const SHELL = css("shell.css"), BAND = css("band.css"), HOME = css("home.css");
const SHELL_JS = read("js", "product", "shell.js"), TOWN_JS = read("js", "product", "kit", "townsearch.js"), HELP_JS = read("js", "product", "kit", "helpsheet.js");

// the declarations of every rule whose selector list contains `sel` exactly (as one of its comma parts), top level or inside @media
function rulesFor(source, sel) {
  const out = [];
  for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const parts = m[1].split(",").map((s) => s.trim().replace(/^@media[^{]*\{\s*/, ""));
    if (parts.includes(sel)) out.push(m[2].trim());
  }
  return out;
}
const decl = (rules, prop) => rules.map((r) => new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(r)).filter(Boolean).map((m) => m[1].trim());
const P = 'html[data-ui="n"]';

test("one chrome for both levels of the town page: the calm chrome of the old simple route is gone (the alias is the same page)", () => {
  assert.ok(!/data-route="simple"/.test(SHELL), "no rule of the shell keys on the route simple");
  assert.ok(!/n-shell-theme/.test(SHELL) && !/n-shell-theme/.test(SHELL_JS), "no theme button in the top bar: the menu (a drawer on phones) carries it");
  assert.ok(!/n-simple-topsw|syncViewSwitch|viewSwitch/.test(SHELL_JS), "the level switch is in the head of the page, not in the top bar");
  const APP_JS = read("js", "product", "app.js");
  assert.match(APP_JS, /dataset\.route = c\.id === "simple" \? "home" : c\.id/, "the alias takes the frame of the town page");
  assert.ok(decl(rulesFor(SHELL, `${P} body[data-route="home"] .crumbs`), "display").includes("none"), "the town page has no breadcrumb: its h1 is the town");
});

test("the shell footer keeps the links and the purpose line on every route", () => {
  assert.match(SHELL_JS, /p\.n-shell-foot-src\.n-shell-foot-prov/);
  assert.match(SHELL_JS, /"\.n-shell-foot-rep"\)/);
  // the warning about blocked storage is not the sources line: it stays visible on every route
  assert.match(SHELL_JS, /h\("p\.n-shell-foot-src", "הדפדפן חוסם/);
  for (const label of ["שיטה ומקורות", "מילון מונחים", "כיסוי נתונים", "הצהרת נגישות", "פרטיות", "קיצורי מקלדת", "חזרה לעיצוב הקודם"]) assert.ok(SHELL_JS.includes(label), label);
  assert.match(SHELL_JS, /route === "home" \|\| route === "simple" \? btn\("איך קוראים"/, "the help button shows on the town page and on its alias");
});

test("pointer targets: footer links, band back links and breadcrumb links are at least 24 px high, with room around them", () => {
  const h = (source, sel) => Math.max(0, ...decl(rulesFor(source, sel), "min-height").map((v) => parseFloat(v) || 0));
  assert.ok(h(SHELL, `${P} .n-shell-links a`) >= 24 && h(SHELL, `${P} .n-shell-link`) >= 24);
  assert.ok(h(BAND, `${P} .n-band-back`) >= 24);
  assert.ok(h(SHELL, `${P} .crumbs a`) >= 24);
  assert.match(css("entry.css"), /\.n-entry-src-g a \{ display: inline-block; padding-block: 2px;/);
});

test("town search: the list is not a Tab stop, Escape does not clear and reopen it, the arrows scroll the list and not the page", () => {
  assert.match(TOWN_JS, /role: "listbox"[^)]*tabindex: "-1"/);
  assert.match(TOWN_JS, /role: "option", tabindex: "-1"/);
  assert.match(TOWN_JS, /e\.key === "Escape"[^\n]*e\.preventDefault\(\)/);
  assert.ok(!/scrollIntoView/.test(TOWN_JS.replace(/\/\/.*$/gm, "")), "scrollIntoView would move the page that sits under the sticky bar");
  assert.match(TOWN_JS, /focusout/, "Tab out of the field closes the list");
});

test("town search: the open list of the top bar is never narrower than 260 px, and as wide as the page under 861 px", () => {
  assert.match(decl(rulesFor(SHELL, `${P} .top .searchbox .results`), "min-width")[0] || "", /260px/);
  const narrow = rulesFor(SHELL, `${P} body:not([data-route="home"]) .top .searchbox .results`);
  assert.ok(decl(narrow, "inset-inline").includes("var(--pg)"));
  assert.ok(decl(rulesFor(SHELL, `${P} body:not([data-route="home"]) #quick`), "position").includes("static"));
});

test("the sticky bar: the page stays where it was when a control of the bar gets focus, and the slash key does not scroll", () => {
  assert.match(HELP_JS, /i\.focus\(\{ preventScroll: true \}\)/);
  assert.match(SHELL_JS, /document\.addEventListener\("keydown", \(\) => \{ keyY = window\.scrollY; \}, true\)/);
  assert.match(SHELL_JS, /top\.addEventListener\("focusin", keep\); top\.addEventListener\("input", keep\)/);
});

test("reflow at 320 px and 200 percent text: the bar wraps, the bars of the town page shrink, nothing is nowrap", () => {
  const top = rulesFor(SHELL, `${P} .top`);
  assert.ok(decl(top, "height").includes("auto") && decl(top, "flex-wrap").includes("wrap") && decl(top, "min-height").includes("var(--top-h)"));
  assert.ok(decl(rulesFor(SHELL, `${P} .n-shell-body`), "overflow-wrap").includes("break-word"));
  assert.match(decl(rulesFor(HOME, `${P} .n-home-bars`), "grid-template-columns")[0] || "", /minmax\(0, 1fr\) minmax\(4rem, min\(7\.5rem, 40%\)\)/);
  assert.ok(!decl(rulesFor(HOME, `${P} .n-home-val`), "white-space").length, "a value may wrap");
});

test("reflow of the old pages (q1): below 340 px the view breaks long runs and wraps what the old modules keep on one line; the years matrix keeps its own cell size; the link of the foot wraps as a unit", () => {
  const block = /@media \(max-width: 340px\) \{([\s\S]*?)\n\}/.exec(SHELL);
  assert.ok(block, "one block for the narrowest window in the shell css");
  assert.ok(decl(rulesFor(block[1], `${P} #view`), "overflow-wrap").includes("anywhere") && decl(rulesFor(block[1], `${P} #view .n-shell-body`), "overflow-wrap").includes("anywhere"));
  assert.match(block[1], /#view :is\(\.nw, \.ltr, \.pill, \.btn, \.tag\):not\(svg \*\) \{ white-space: normal; \}/);
  assert.match(block[1], /\.split, \.split\.even\) \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  const DOMAIN = css(path.join("pages", "domain.css"));
  assert.ok(decl(rulesFor(DOMAIN, `${P} .dm-mx .v-mx-heat`), "--cell").some((v) => /^clamp\(18px,.*!important$/.test(v)), "the years matrix takes its cell from the width, never under the 18 px the matrix itself allows");
  assert.ok(decl(rulesFor(DOMAIN, `${P} .dm-mx .v-mx-hy.off`), "visibility").includes("hidden"), "the years the matrix leaves out of the axis stay out");
  assert.ok(decl(rulesFor(DOMAIN, `${P} .dm-hz`), "white-space").includes("normal"));
  const prov = decl(rulesFor(HOME, `${P} .n-home-prov a`), "white-space");
  assert.ok(prov.includes("normal") && !prov.includes("nowrap"), "an inline-block unit: it moves to the next line whole and wraps only inside a line narrower than itself");
});

test("pointer targets of the old modules (q1): a link alone on its line is at least 24 px high through padding and a negative margin, which keep every line where it was", () => {
  const PAGES = ["coverage", "method", "compare", "trends", "domain", "indicator"].map((n) => css(path.join("pages", n + ".css"))).join("\n");
  for (const sel of [`${P} .cv-src a`, `${P} .mt-nm a`, `${P} .mt-foot a`, `${P} .v-mx-rowh a`, `${P} a.v-mx-hlab`, `${P} .dm-names a`, `${P} .srcline a`, `${P} .tr-note a`]) {
    const d = decl(rulesFor(PAGES, sel), "padding-block");
    assert.ok(d.length && parseInt(d[0], 10) >= 2, sel + " has padding above and below");
  }
  for (const sel of [`${P} .mt-nm a`, `${P} .mt-foot a`, `${P} a.v-mx-hlab`, `${P} .srcline a`]) assert.ok(decl(rulesFor(PAGES, sel), "margin-block").some((m) => /^-\d+px$/.test(m)), sel + " gives the space back");
  assert.ok(decl(rulesFor(HOME, `${P} .n-home-peers-add`), "margin-block").includes("-2px"));
  assert.ok(decl(rulesFor(css("kit.css"), `${P} .n-kit-term`), "margin-block").includes("-1px"));
  // a short figure in a sentence ("8%" in the background line of the town page, 18 px wide) is a button of at least 24 px: side padding of 4 px, given back by the same negative margin so the line reads as it did
  const KIT = css("kit.css"), side = (prop) => decl(rulesFor(KIT, `${P} .n-kit-term`), prop);
  assert.ok(side("padding-inline").includes("4px") && side("margin-inline").includes("-4px"), "the term button is 8 px wider than its text and takes no room from the line");
  const rh = (prop) => decl(rulesFor(PAGES, `${P} .v-mx-rowh a`), prop);
  assert.ok(rh("padding-inline").includes("5px") && rh("margin-inline").includes("-5px"), "a three-letter town name in the compare table (22 px) is at least 24 px wide, with no room taken");
});

test("the frame probe is there and has both modes", () => {
  const src = fs.readFileSync(path.join(ROOT, "src", "tools", "chrome_probe.js"), "utf8");
  assert.match(src, /mode=targets\|reflow/);
  assert.match(src, /r\.width >= 24 && r\.height >= 24/);
  assert.match(src, /fontSize = "200%"/);
});

// ── the last look (g1): dark, print and keyboard ──
test("keyboard: the closed drawer of a phone is not in the tab order (15 invisible stops before the page), and the open one is", () => {
  assert.ok(decl(rulesFor(SHELL, `${P} .side:not(.open)`), "visibility").includes("hidden"), "hidden while closed (the width where css/app.css moves it off the screen)");
  assert.match(SHELL, /@media \(max-width: 860px\) \{\s*html\[data-ui="n"\] \.side:not\(\.open\)/, "the same breakpoint as the old drawer");
  assert.match(SHELL_JS, /classList\.toggle\("open", v\)/, "openDrawer opens it by the class the rule keys on");
  assert.match(SHELL_JS, /first\.focus\(/, "and puts the focus on its first link");
});

test("dark and light: the pale peach of 'למעקב' has a hairline of the concern colour (the shape is 1.5:1 against the pale page without it), in the verdict bar, its key and the bar of a topic", () => {
  const PAGES_D = css("pages/domain.css");
  for (const [src, sel] of [[HOME, `${P} .n-home-seg.is-watch`], [HOME, `${P} .n-home-key.is-watch`], [PAGES_D, `${P} .n-pg-domain-seg.is-watch`]]) {
    assert.ok(decl(rulesFor(src, sel), "box-shadow").some((v) => /inset 0 0 0 1\.5px var\(--attn-bar\)/.test(v)), sel);
    assert.ok(decl(rulesFor(src, sel), "background").some((v) => /var\(--watch-bar\)/.test(v)), sel + " keeps the ring's own colour");
  }
});

test("the value chips of the old charts are rectangles with a small corner, not capsules with text in them", () => {
  const KIT = css("kit.css"), sel = `${P} #view .v-cmp-chip-bg`;
  assert.ok(decl(rulesFor(KIT, sel), "rx").includes("4px") && decl(rulesFor(KIT, sel), "ry").includes("4px"));
  for (const c of ["v-time-tchip", "v-time-evchips"]) assert.ok(KIT.includes("."+c), c);
});

test("print: a chart's key or caption never stays without its chart (the figure that differs most and the ladder of the domains are printed; the long list of neighbours is not)", () => {
  const print = HOME.slice(HOME.lastIndexOf("@media print")), hidden = (print.match(/([^{}]+)\{\s*display: none;\s*\}/g) || []).join(" ");
  assert.ok(!/n-home-ladder|n-home-tell-db|n-home-lg\b/.test(hidden), "the ladder, the chart of the most telling figure and its key are not hidden");
  assert.ok(/n-home-bh2/.test(hidden) && /v-cmp-lol/.test(hidden), "the heading of the neighbours goes with the list it names");
  assert.match(print, /\.n-home-lr-dot[^{]*\{[^}]*print-color-adjust: exact/);
});

test("reflow: a figure with its year (the background line, the place among the towns) stays on one line, except on a 320 px screen with the text at 200%, where its label alone is wider than the page", () => {
  assert.ok(decl(rulesFor(HOME, `${P} .n-home-nb`), "white-space").includes("nowrap"), "on one line by default");
  const narrow = /@media \(max-width: 340px\) \{\s*html\[data-ui="n"\] \.n-home-nb \{ white-space: normal; \}\s*\}/;
  assert.match(HOME, narrow, "wrapping at its spaces under 340 px (the figure itself is a button and stays whole)");
});

test("the keyboard probe is there: real key events, the ring of every stop, the skip link, the level switch and the dialog of the background line", () => {
  const src = fs.readFileSync(path.join(ROOT, "src", "tools", "keys_probe.js"), "utf8");
  for (const needle of ["Input.dispatchKeyEvent", "דלגו", "הפרטים המלאים", "Escape", "dialog[open]", "data-kp-seen"]) assert.ok(src.includes(needle), needle);
});
