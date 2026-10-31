// Performance hints and the documents of the release: the preload list in web/n.html is the real static import graph, nothing leaves the origin,
// and the commands named in the docs exist. (The numbers themselves come from src/tools/perf_probe.js and are recorded in docs/QA.md.)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { preloadFiles, staticGraph } = require(path.join(ROOT, "src", "tools", "perf_probe.js"));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const html = read("web/n.html");

test("n.html: the modulepreload list is exactly the static import graph of the router and the town home", () => {
  const listed = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]);
  const want = preloadFiles();
  assert.ok(want.length > 20, "the graph was found");
  assert.deepEqual([...listed].sort(), [...want].sort(), "regenerate with: node src/tools/perf_probe.js --preload");
  assert.equal(new Set(listed).size, listed.length, "no module twice");
  for (const f of listed) assert.ok(fs.existsSync(path.join(ROOT, "web", f)), f + " exists");
});

test("n.html: hints stay on the page's own origin and a module of a page that is not the home is never preloaded", () => {
  for (const m of html.matchAll(/<link[^>]+(?:href|src)="([^"]+)"/g)) assert.ok(!/^(?:https?:)?\/\//.test(m[1]), m[1] + " leaves the origin");
  for (const m of html.matchAll(/modulepreload" href="([^"]+)"/g)) {
    assert.ok(!/js\/product\/(pages|brief|entry)\//.test(m[1]) && !/js\/pages\//.test(m[1]), m[1] + " belongs to a page that was not asked for");
  }
});

test("the graph reader ignores comments and dynamic imports", () => {
  const g = staticGraph(["js/product/boot.js"]);
  assert.deepEqual(g, ["js/product/boot.js"], "boot.js imports app.js only dynamically");
  assert.ok(!preloadFiles().includes("js/product/entry/entry.js"), "entry.js is a dynamic import of routes.js");
});

test("docs: the handbook, the QA record, the release and the change list exist and name real commands", () => {
  const scripts = JSON.parse(read("package.json")).scripts;
  for (const f of ["docs/PRODUCT.md", "docs/QA.md", "docs/RELEASE.md", "docs/CHANGES.md"]) {
    assert.ok(fs.existsSync(path.join(ROOT, f)), f);
    for (const m of read(f).matchAll(/npm run ([\w:-]+)/g)) assert.ok(scripts[m[1]], `${f}: npm run ${m[1]} is not in package.json`);
  }
  for (const m of read("README.md").matchAll(/npm run ([\w:-]+)/g)) assert.ok(scripts[m[1]], `README.md: npm run ${m[1]}`);
  for (const f of ["docs/PRODUCT.md", "docs/QA.md", "docs/RELEASE.md", "README.md"]) {
    for (const m of read(f).matchAll(/node (src\/tools\/[\w.]+\.js)/g)) assert.ok(fs.existsSync(path.join(ROOT, m[1])), `${f}: ${m[1]}`);
  }
});

test("docs: the release explains the flip, the rollback, the re-baseline of the old files and the owner's decisions", () => {
  const r = read("docs/RELEASE.md");
  for (const w of ["old.html", "OLD_HOME", "SHARE_TARGET", "start_url", "product-old-untouched", "OLD-HASHES.json", "rollback", "assets/lab/raw"]) assert.ok(r.includes(w), w);
  assert.ok(/qa|QA/.test(read("docs/QA.md")) && read("docs/QA.md").includes("perf_probe"), "the QA record carries the probe numbers");
  assert.ok(read("DESIGN_V3.md").includes("Mode N"), "DESIGN_V3 section 9");
});

test("the project root has no stray device-name file", () => {
  assert.ok(!fs.readdirSync(ROOT).some((f) => /^nul$/i.test(f)), "NUL");
});
