"use strict";
// Collector for quarterly ArcGIS tables where a locality's figure for a quarter is the MEAN OF SEVERAL CATEGORIES (the waiting time for a
// specialist, averaged over the most common specialties) and a year is the mean of its quarters. The period column is a text such as
// "03 - יולי- ספטמבר 2019": its leading number counts quarters from the first one, and its last four digits are the year, used as a check.
//
//   collect: { type: "arcgis_quarterly", url: "<layer url>", codeField: "sett_code", periodField: "period_time_desc", firstYear: 2019,
//              categoryField: "profession", categories: ["אורתופדיה", "נשים", "א.א.ג.", "עיניים", "עור"], valueField: "average",
//              minQuarters: 2,                                           // a year needs at least this many quarters with all categories
//              nat: { url: "<national table url>", periodField: "period_time_desc", categoryField: "profession", valueField: "mean" } }
//
// A quarter counts only when every category has a value; two different values for the same cell make that cell ambiguous and drop the quarter.
// Codes that are not in the locality master are skipped.
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { layerRows, toNumber } = require("./arcgis_table");

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

const periodOf = (desc, firstYear) => {
  const lead = /^\s*(\d+)\s*-/.exec(String(desc || "")), tail = /(\d{4})\s*$/.exec(String(desc || ""));
  if (!lead || !tail) return null;
  const i = Number(lead[1]) - 1, year = firstYear + Math.floor(i / 4);
  return year === Number(tail[1]) ? { year, q: (i % 4) + 1 } : null;
};

// rows -> Map(key -> { year -> mean over its quarters of the mean over the categories })
function yearly(rows, spec, keyOf) {
  const cells = new Map();                                                 // "key|year|q" -> { category -> value, NaN when ambiguous }
  for (const r of rows) {
    const key = keyOf(r), cat = r[spec.categoryField], v = toNumber(r[spec.valueField]), p = periodOf(r[spec.periodField], spec.firstYear);
    if (key == null || !p || v == null || !spec.categories.includes(cat)) continue;
    const id = key + "|" + p.year + "|" + p.q, c = cells.get(id) || {};
    c[cat] = cat in c && c[cat] !== v ? NaN : v;
    cells.set(id, c);
  }
  const quarters = new Map();                                              // "key|year" -> composite of each full quarter
  for (const [id, c] of cells) {
    if (!spec.categories.every((k) => typeof c[k] === "number" && !isNaN(c[k]))) continue;
    const [key, year] = id.split("|"), k = key + "|" + year;
    if (!quarters.has(k)) quarters.set(k, []);
    quarters.get(k).push(mean(spec.categories.map((x) => c[x])));
  }
  const out = new Map();
  for (const [k, qs] of quarters) {
    if (qs.length < (spec.minQuarters || 1)) continue;
    const [key, year] = k.split("|");
    if (!out.has(key)) out.set(key, {});
    out.get(key)[year] = mean(qs);
  }
  return out;
}

async function collect(ind, log = () => {}) {
  const sp = ind.collect;
  const master = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(cfg.DATA, "localities.json"), "utf8")).map((l) => [String(l.code), l]));
  let outOfMaster = 0;
  const seen = new Set();
  const byCode = yearly(await layerRows(sp.url), sp, (r) => {
    const code = r[sp.codeField] == null ? null : String(r[sp.codeField]);
    if (!code) return null;
    if (!master[code]) { if (!seen.has(code)) { seen.add(code); outOfMaster++; } return null; }
    return code;
  });

  const years = {};
  let rows = 0;
  for (const [code, byYear] of byCode) for (const [y, v] of Object.entries(byYear)) { (years[y] = years[y] || { nat: null, loc: {} }).loc["#" + code] = { v }; rows++; }
  if (sp.nat) {
    const n = { ...sp.nat, categories: sp.categories, firstYear: sp.firstYear, minQuarters: sp.minQuarters };
    const nat = yearly(await layerRows(n.url), n, () => "nat").get("nat") || {};
    for (const [y, v] of Object.entries(nat)) if (years[y]) years[y].nat = { v };
  }
  log(`${ind.id}: ${rows} values, ${byCode.size} localities (${outOfMaster} codes outside the locality master)`);
  return { rows, years };
}

module.exports = { collect, periodOf, yearly };
