// The pictograms of the categories (web/js/product/kit/catart.js): one quiet tile with a single line drawing, inline SVG on currentColor, the same grid and stroke for all five,
// the colours only through tokens, no picture file any more, the credit and the licence of the drawings in docs/CREDITS.md.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installDom } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "web"), PRODUCT = path.join(WEB, "js", "product");
const read = (f) => fs.readFileSync(f, "utf8");
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
const IDS = ["child", "outcomes", "mental", "safety", "context"];
const dom = async (fn) => { const d = installDom(); try { const m = await import(pathToFileURL(path.join(PRODUCT, "kit", "catart.js")).href); await fn(m, d); } finally { d.restore(); } };

test("catArt draws each of the five categories as a tile holding one inline svg on currentColor (no picture, no face)", async () => {
  await dom(async ({ catArt, hasArt }) => {
    for (const id of IDS) {
      assert.ok(hasArt(id), id);
      const tile = catArt(id, 40, "n-home-cat-ico");
      assert.equal(tile.tagName, "SPAN"); assert.ok(tile.classes.has("n-kit-cat") && tile.classes.has("n-home-cat-ico"), id + ": the base class and the class of the place");
      assert.equal(tile.getAttribute("aria-hidden"), "true", id + ": decoration, the name next to it says everything");
      assert.equal(tile.getAttribute("data-cat"), id);
      assert.equal(tile.findAll((e) => e.tagName === "IMG").length, 0, id + ": no picture file");
      const svgs = tile.findAll((e) => e.tagName === "SVG"); assert.equal(svgs.length, 1, id + ": one drawing");
      const g = svgs[0];
      assert.equal(g.getAttribute("viewBox"), "0 0 24 24"); assert.equal(g.getAttribute("stroke"), "currentColor"); assert.equal(g.getAttribute("fill"), "none");
      assert.equal(g.getAttribute("stroke-linecap"), "round"); assert.equal(g.getAttribute("stroke-linejoin"), "round"); assert.equal(g.getAttribute("aria-hidden"), "true");
      assert.ok(/<path /.test(g.innerHTML) && !/fill="(?!none)/.test(g.innerHTML) && !/stroke="/.test(g.innerHTML), id + ": line paths only, the colour comes from the tile");
      assert.ok(!/<(circle|ellipse)[^>]*(cx="(9|10|14|15)"[^>]*cy="(9|10|11)")/.test(g.innerHTML), id + ": no pair of eyes");
    }
    assert.equal(catArt("nope"), null); assert.equal(catArt(undefined), null); assert.equal(hasArt("toString"), false, "an inherited name is not a category");
  });
});

test("catArt keeps its signature: size sets --cat and the stroke weight, small tiles get is-sm, the class of the place is added", async () => {
  await dom(async ({ catArt }) => {
    const sizes = { 26: ["2", true], 32: ["2", true], 40: ["1.75", false], 88: ["1.5", false], 96: ["1.5", false] };
    for (const [size, [sw, small]] of Object.entries(sizes)) {
      const t = catArt("mental", Number(size), "x-place"), g = t.find((e) => e.tagName === "SVG");
      assert.equal(g.getAttribute("stroke-width"), sw, size + ": stroke");
      assert.equal(t.classes.has("is-sm"), small, size + ": is-sm");
      assert.ok(t.classes.has("x-place"));
    }
    assert.equal(catArt("child").find((e) => e.tagName === "SVG").getAttribute("stroke-width"), "2", "the default size is a small tile");
  });
});

test("the five drawings are distinct and share one grid (same attributes on every svg of the same size)", async () => {
  await dom(async ({ catArt }) => {
    const markup = IDS.map((id) => catArt(id, 40).find((e) => e.tagName === "SVG").innerHTML);
    assert.equal(new Set(markup).size, 5);
    const attrs = IDS.map((id) => { const g = catArt(id, 88).find((e) => e.tagName === "SVG"); return ["viewBox", "stroke-width", "stroke-linecap", "stroke-linejoin", "fill", "stroke"].map((k) => g.getAttribute(k)).join("|"); });
    assert.equal(new Set(attrs).size, 1, "one grid, one stroke for the whole set");
  });
});

test("the source of the drawings has no colour literal and no picture file; the callers keep their sizes and classes", () => {
  const src = read(path.join(PRODUCT, "kit", "catart.js"));
  const code = src.replace(/\/\/.*$/gm, "");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(code), "no colour in the drawing code: the tile asks the tokens");
  assert.ok(!/\.webp|\.png|<img|"img/.test(code), "no picture file");
  const use = (f) => read(path.join(PRODUCT, f));
  assert.match(use("shell.js"), /catArt\(d\.id, 26, "n-shell-cat"\)/);
  assert.match(use("pages/domain.js"), /catArt\(domainId, 96, "n-pg-domain-cat"\)/);
  assert.match(use("city/sections.js"), /catArt\(d\.id, 40, "n-home-cat-ico"\)/);
  assert.match(use("city/sections.js"), /catArt\(g\.d\.id, 32, "n-home-grp-ico"\)/);
});

test("the old picture badges are gone and nothing names them", () => {
  assert.ok(!fs.existsSync(path.join(WEB, "assets", "product", "cat")), "web/assets/product/cat is deleted");
  const files = [...walk(path.join(WEB, "js", "product")), ...walk(path.join(WEB, "css", "product")), path.join(WEB, "n.html"), ...walk(path.join(ROOT, "src", "lib"))];
  const bad = files.filter((f) => /assets\/product\/cat\b|artSrc/.test(read(f)));
  assert.deepEqual(bad.map((f) => path.relative(ROOT, f)), []);
});

test("the tile asks the tokens: --cat-tile and --cat-ink (and the two of the navy menu) are defined in tokens.css and used by kit.css and shell.css, a rounded tile and not a circle", () => {
  const tokens = read(path.join(WEB, "css", "product", "tokens.css")), kit = read(path.join(WEB, "css", "product", "kit.css")), shell = read(path.join(WEB, "css", "product", "shell.css"));
  for (const t of ["--cat-tile", "--cat-ink", "--cat-nav-tile", "--cat-nav-ink"]) assert.ok(new RegExp(t + ":").test(tokens), t + " is a token");
  assert.ok(/--cat-tile:\s*var\(--teal-soft\)/.test(tokens) && /--cat-ink:\s*var\(--teal-ink\)/.test(tokens), "the dark theme re-values the two teal tokens, so the tile follows it");
  const rule = /html\[data-ui="n"\] \.n-kit-cat \{[^}]*\}/.exec(kit)[0];
  assert.ok(/background:\s*var\(--cat-tile\)/.test(rule) && /color:\s*var\(--cat-ink\)/.test(rule) && !/#[0-9a-f]{3,8}/i.test(rule));
  assert.ok(/border-radius:\s*\d+%/.test(rule) && !/border-radius:\s*(50|999)/.test(rule), "a rounded tile, not a circle");
  assert.ok(/\.n-shell-cat \{[^}]*var\(--cat-nav-tile\)[^}]*var\(--cat-nav-ink\)/.test(shell), "on the navy menu the tile is quiet and light");
});

test("the credit and the licence of the drawings are in docs/CREDITS.md", () => {
  const credits = read(path.join(ROOT, "docs", "CREDITS.md"));
  assert.match(credits, /Tabler Icons/); assert.match(credits, /MIT/); assert.match(credits, /Permission is hereby granted, free of charge/); assert.match(credits, /Copyright \(c\) 2020-2024 Paweł Kuna/);
  for (const n of ["baby-carriage", "stethoscope", "brain", "shield-check", "building-community"]) assert.ok(credits.includes("`" + n + "`"), n);
});
