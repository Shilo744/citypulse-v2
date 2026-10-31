// The fields of the official guidelines survive the product's regrouping into categories (web/js/product/city/groups.js copies indicators with a spread).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { model, rawModel, haveStore } from "./helpers/city-models.mjs";
import { regroupMeta } from "../web/js/product/city/groups.js";
const require = createRequire(import.meta.url);
const skip = !haveStore;

test("regroup keeps guide and benchmark on every indicator, and guideSources on the model", { skip }, () => {
  for (const key of ["1031", "2710", "99", "472"]) {
    const raw = rawModel(key), grouped = model(key);
    const byId = new Map(grouped.indicators.map((a) => [a.id, a]));
    let withGuide = 0;
    for (const a of raw.indicators) {
      const g = byId.get(a.id);
      assert.deepEqual(g.guide, a.guide, `${key}/${a.id}: guide`);
      assert.deepEqual(g.benchmark, a.benchmark, `${key}/${a.id}: benchmark`);
      assert.equal(g.status, a.status, `${key}/${a.id}: the status of an indicator is the server's`);
      if (a.guide) withGuide++;
    }
    assert.ok(withGuide >= 10, `${key}: ${withGuide} indicators with a guide`);
    assert.deepEqual(grouped.guideSources, raw.guideSources, `${key}: guideSources`);
  }
});

test("regroupMeta keeps the guideline and the benchmark of every catalogue entry", { skip }, () => {
  const meta = JSON.parse(JSON.stringify(require("../src/api").publicCatalog()));
  const grouped = regroupMeta(meta);
  const by = new Map(grouped.indicators.map((i) => [i.id, i]));
  for (const i of meta.indicators) {
    assert.deepEqual(by.get(i.id).guideline, i.guideline, i.id);
    assert.deepEqual(by.get(i.id).benchmark, i.benchmark, i.id);
  }
  assert.equal(grouped.sources.moh_quality_report.role, "guideline");
});
