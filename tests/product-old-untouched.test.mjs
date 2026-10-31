// The live default must stay byte-identical while the product is built (design-ideas/product/SPEC-ADDENDUM.md A1):
// design-ideas/product/baseline/OLD-HASHES.json holds the sha256 of every old file the product reuses or sits next to.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const hashes = JSON.parse(fs.readFileSync(path.join(ROOT, "design-ideas", "product", "baseline", "OLD-HASHES.json"), "utf8"));
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

test("the baseline lists index.html, main.js and every shared old file", () => {
  for (const f of ["web/index.html", "web/js/main.js", "web/js/ui.js", "web/js/components.js", "web/js/api.js", "web/js/motion.js", "web/css/app.css", "web/css/layout.css", "web/css/pages.css", "web/css/viz.css", "web/css/motion.css"]) assert.ok(hashes[f], f);
  assert.ok(Object.keys(hashes).some((f) => f.startsWith("web/js/pages/")) && Object.keys(hashes).some((f) => f.startsWith("web/js/lab/")) && Object.keys(hashes).some((f) => f.startsWith("web/js/viz/")), "the folders");
});

test("every old file has the sha256 it had before the product was built", () => {
  const changed = [];
  for (const [rel, want] of Object.entries(hashes)) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) changed.push(rel + " (missing)"); else if (sha(f) !== want) changed.push(rel);
  }
  assert.deepEqual(changed, [], "an old file changed: the live default must not move (put the change in web/js/product or web/css/product, or ask the lead through NEEDS)");
});

test("the rollback copy of web/ exists", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "design-ideas", "product", "baseline", "web-before", "index.html")));
});
