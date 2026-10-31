// Design rules a test can hold (see DESIGN_V3.md): no coloured side stripes, no hard-coded colours in the chart modules (dark mode would break).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(WEB).filter((f) => /\.(css|js|html)$/.test(f));
const rel = (f) => path.relative(WEB, f).replace(/\\/g, "/");
const read = (f) => fs.readFileSync(f, "utf8");

test("no card, row or menu item carries a coloured side stripe (a thick border on one side)", () => {
  const SIDE = /(border-(inline-start|inline-end|left|right)|border(InlineStart|InlineEnd|Left|Right))(-width)?["']?\s*[:=]\s*["'`]?\s*([3-9]|\d\d+)px/;
  const bad = [];
  for (const f of files) read(f).split("\n").forEach((line, i) => { if (SIDE.test(line)) bad.push(`${rel(f)}:${i + 1}`); });
  assert.deepEqual(bad, [], "a thick border on one side is a stripe: mark a state with a tint, an icon, a pill or a full ring instead");
});

test("no stripe is drawn with a pseudo-element either", () => {
  const bad = [];
  for (const f of files.filter((x) => x.endsWith(".css"))) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, sel, body] = m;
      if (!/::?(before|after)/.test(sel)) continue;
      const thick = /(^|[;\s])width:\s*[2-9]px/.test(body);
      const tall = /top:\s*-?\d+px[^}]*bottom:\s*-?\d+px|bottom:\s*-?\d+px[^}]*top:\s*-?\d+px|inset-block:\s*-?\d/.test(body) || /height:\s*100%/.test(body);
      const edge = /(inset-inline-(start|end)|left|right):\s*(-?\d+px|0)/.test(body);
      if (thick && tall && edge) bad.push(`${rel(f)}: ${sel.trim()}`);
    }
  }
  assert.deepEqual(bad, [], "a thin vertical bar on the edge of a box is a stripe");
});

test("chart modules use colour tokens, never hex literals (dark mode follows the tokens)", () => {
  const bad = [];
  for (const f of files.filter((x) => /[\\/]viz[\\/]/.test(x) && /\.(js|css)$/.test(x))) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    src.split("\n").forEach((line, i) => { if (/#[0-9a-fA-F]{3,8}\b/.test(line.replace(/url\([^)]*\)/g, "").replace(/&#\d+;/g, ""))) bad.push(`${rel(f)}:${i + 1}`); });
  }
  assert.deepEqual(bad, [], "use var(--c-city), var(--good-bar), color-mix(...) and the other tokens from css/app.css");
});

test("the logo and the motion layer are wired into the page", () => {
  const html = read(path.join(WEB, "index.html"));
  assert.ok(/assets\/logo\/favicon-64\.png/.test(html), "favicon");
  assert.ok(/css\/motion\.css/.test(html) && /js\/motion\.js/.test(html) && /css\/viz\.css/.test(html), "motion and chart styles");
  for (const f of ["mark.png", "mark-dark.png", "mark@2x.png", "mark-dark@2x.png", "lockup.png", "lockup-dark.png"]) assert.ok(fs.existsSync(path.join(WEB, "assets", "logo", f)), f);
});

test("no grey system scrollbar: the page and the menu have the leaf lane, every other scroll box a thin quiet bar", () => {
  const motionJs = read(path.join(WEB, "js", "motion.js")), motionCss = read(path.join(WEB, "css", "motion.css")), appCss = read(path.join(WEB, "css", "app.css"));
  assert.ok(/makeLane\("side-sb"/.test(motionJs) && /\.cp-sb\.side-sb\s*\{/.test(motionCss), "the menu has its own lane");
  assert.ok(/\.side\s*\{\s*scrollbar-width:\s*none/.test(motionCss) && /\.side::-webkit-scrollbar\s*\{\s*display:\s*none/.test(motionCss), "the menu hides the browser's bar where a mouse is the pointer");
  assert.ok(/\*\s*\{\s*scrollbar-width:\s*thin/.test(appCss) && /scrollbar-color:/.test(appCss), "a thin bar in the page's colours everywhere else");
});

// ── the product (web/n.html, web/js/product, web/css/product): the same contract, plus the extra rules of mode N ──
const prodFiles = files.filter((f) => /^(js|css)\/product\//.test(rel(f)));

test("the product follows the contract: colour only through tokens (hex lives in tokens.css alone)", () => {
  assert.ok(prodFiles.length > 10, "the product files are scanned");
  const bad = [];
  for (const f of prodFiles.filter((x) => !x.endsWith("tokens.css"))) {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    src.split("\n").forEach((line, i) => { if (/#[0-9a-fA-F]{3,8}\b/.test(line.replace(/url\([^)]*\)/g, "").replace(/&#\d+;/g, "").replace(/href[:=]\s*["'`]#/g, ""))) bad.push(`${rel(f)}:${i + 1}`); });
  }
  assert.deepEqual(bad, []);
});

test("the product has no text capsule: no pill radius on a rule that also gives a background and padding to text", () => {
  const bad = [];
  for (const f of prodFiles.filter((x) => x.endsWith(".css"))) {
    const css = read(f).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/border-radius:\s*(999|9999|100)(px|%)/.test(m[2]) && /background(-color)?:/.test(m[2]) && /padding:/.test(m[2])) bad.push(`${rel(f)}: ${m[1].trim().slice(0, 50)}`);
  }
  assert.deepEqual(bad, [], "text sits on the page, in hairlines or underlines, never in a rounded capsule (rule 11)");
});
