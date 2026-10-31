"use strict";
// Collector for ArcGIS feature layers whose rows carry the CBS locality code (the Ministry of Health publishes its school-health tables
// this way: one row per locality, school year, grade and category). Layers have no national row, so the national figure comes from a
// second, JSON table of the same data (the health ministry data dashboard), where the row with an empty locality name is the nation.
//
//   collect: { type: "arcgis_table", url: "<layer url>", codeField: "municipal_code", yearField: "year", valueField: "population_rate_txt",
//              where: { class_desc: "א" },                                       // exact match on other columns
//              sum: { field: "variable_desc", values: ["השמנה", "עודף משקל"] },   // the figure is the sum of these categories (all must be present)
//              window: 3, fromYear: 2013,                                        // mean of the last 3 years (at least 2 with a value), from this year on
//              minPopulation: 5000,                                              // localities with fewer Israeli residents are left out
//              nat: { url, nameField: "settlement", yearField, valueField, where, sum } }
//
// Codes that are not in the locality master (regional councils) are skipped: the model describes localities.
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { getBufferCached } = require("../lib/http");

const PAGE = 1000;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// "14.4%" -> 14.4
const toNumber = (v) => {
  if (typeof v === "number") return isFinite(v) ? v : null;
  const m = String(v == null ? "" : v).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

async function layerRows(url) {
  const count = JSON.parse((await getBufferCached(`${url}/query?where=1%3D1&returnCountOnly=true&f=json`)).toString("utf8")).count;
  const out = [];
  for (let offset = 0; offset < count; offset += PAGE) {
    const j = JSON.parse((await getBufferCached(`${url}/query?where=1%3D1&outFields=*&returnGeometry=false&resultOffset=${offset}&resultRecordCount=${PAGE}&f=json`)).toString("utf8"));
    if (j.error) throw new Error("ArcGIS: " + JSON.stringify(j.error).slice(0, 200));
    const rows = (j.features || []).map((f) => f.attributes);
    if (!rows.length) break;
    out.push(...rows);
  }
  if (out.length !== count) throw new Error(`ArcGIS layer ${url}: read ${out.length} of ${count} rows`);
  return out;
}

// rows -> Map(key -> { year -> value }); keyOf returns null for rows that are not wanted
function figures(rows, spec, keyOf) {
  const parts = new Map();                                              // "key|year" -> { category -> value }
  const clash = new Set();
  for (const r of rows) {
    if (spec.where && Object.entries(spec.where).some(([f, v]) => r[f] !== v)) continue;
    const key = keyOf(r), year = Number(r[spec.yearField]), v = toNumber(r[spec.valueField]);
    if (key == null || !year || v == null) continue;
    const cat = spec.sum ? r[spec.sum.field] : "*";
    if (spec.sum && !spec.sum.values.includes(cat)) continue;
    const id = key + "|" + year, p = parts.get(id) || {};
    if (cat in p && p[cat] !== v) clash.add(id);                        // two different values for the same cell: ambiguous, left out
    p[cat] = v; parts.set(id, p);
  }
  const need = spec.sum ? spec.sum.values : ["*"], out = new Map();
  for (const [id, p] of parts) {
    if (clash.has(id) || !need.every((c) => p[c] != null)) continue;
    const [key, year] = id.split("|");
    if (!out.has(key)) out.set(key, {});
    out.get(key)[year] = need.reduce((s, c) => s + p[c], 0);
  }
  return out;
}

// the year's own value must exist; the mean runs over the last `window` years that have one (at least 2)
function smooth(byYear, window, fromYear) {
  const out = {};
  for (const y of Object.keys(byYear).map(Number)) {
    if (fromYear && y < fromYear) continue;
    const vals = [];
    for (let k = 0; k < window; k++) if (byYear[y - k] != null) vals.push(byYear[y - k]);
    if (vals.length >= Math.min(2, window)) out[y] = mean(vals);
  }
  return out;
}

async function collect(ind, log = () => {}) {
  const sp = ind.collect, window = sp.window || 1;
  const master = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(cfg.DATA, "localities.json"), "utf8")).map((l) => [String(l.code), l]));
  const residents = (l) => {
    const h = l.population_history;
    if (h) { const ys = Object.keys(h).map(Number).sort((a, b) => a - b); if (ys.length) return h[ys[ys.length - 1]]; }
    return l.population || 0;
  };

  const raw = await layerRows(sp.url);
  let outOfMaster = 0, tooSmall = 0;
  const seen = new Set();
  const byCode = figures(raw, sp, (r) => {
    const code = String(r[sp.codeField]);
    if (!master[code]) { if (!seen.has("m" + code)) { seen.add("m" + code); outOfMaster++; } return null; }
    if (sp.minPopulation && residents(master[code]) < sp.minPopulation) { if (!seen.has("s" + code)) { seen.add("s" + code); tooSmall++; } return null; }
    return code;
  });

  const years = {};
  let rows = 0;
  for (const [code, byYear] of byCode) {
    for (const [y, v] of Object.entries(smooth(byYear, window, sp.fromYear))) {
      (years[y] = years[y] || { nat: null, loc: {} }).loc["#" + code] = { v };
      rows++;
    }
  }

  if (sp.nat) {
    const n = sp.nat, table = JSON.parse((await getBufferCached(n.url, { headers: n.headers || {} })).toString("utf8"));
    const nat = figures(table, n, (r) => (r[n.nameField] == null ? "nat" : null)).get("nat") || {};
    for (const [y, v] of Object.entries(smooth(nat, window, sp.fromYear))) if (years[y]) years[y].nat = { v };
  }

  log(`${ind.id}: ${rows} values, ${byCode.size} localities (${outOfMaster} codes outside the locality master, ${tooSmall} below ${sp.minPopulation || 0} residents)`);
  return { rows, years };
}

module.exports = { collect, toNumber, figures, smooth, layerRows };
