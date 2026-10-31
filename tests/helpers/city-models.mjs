// The city models of the fixtures (1031 Sderot, 16 and 7 tiny, 935 no coverage, 99 weak, 472 stale and small, 2710 long domain label), built from the real store as the API does.
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { regroup } from "../../web/js/product/city/groups.js";
const require = createRequire(import.meta.url);
const cfg = require("../../src/lib/config");
const { Store } = require("../../src/model/store");
const { buildCityModel } = require("../../src/model/city");

export const KEYS = ["1031", "16", "7", "935", "99", "472", "2710"];
const file = path.join(cfg.STORE, "store.json");
export const haveStore = fs.existsSync(file);
let store = null;
// the model as the server sends it (nine domains): for the tests of the grouping itself and of the server
export function rawModel(key) {
  if (!haveStore) return null;
  store = store || Store.load(file);
  const m = buildCityModel(store, key);
  if (!m) return null;
  try { m.recommendations = require("../../src/model/recommend").recommend(m, store); } catch (e) { m.recommendations = []; }
  try { m.summary = require("../../src/model/summary").summarize(m); } catch (e) { m.summary = null; }
  return JSON.parse(JSON.stringify(m));
}
// the model as the product reads it: in its categories (web/js/product/city/groups.js regroup), which is what net.city() gives every screen
export function model(key) { return regroup(rawModel(key)); }
export const all = () => Object.fromEntries(KEYS.map((k) => [k, model(k)]));
