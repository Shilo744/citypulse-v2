"use strict";
// Collector for JSON tables (an array of rows) where the locality is given by NAME, not by code: the health ministry data dashboard.
// The name is matched to the CBS locality master; names that do not match (regional councils, district groupings) are skipped.
//
//   collect: { type: "json_table", url: "<table url>", nameField: "settlement", yearField: "year", valueField: "populationRate",
//              countField: "total", per: 1000,                               // count / rate * per = the population the rate is about
//              where: { measureCode: 1 },                                    // exact match on other columns
//              window: 3, fromYear: 2021, minPopulation: 5000 }
//
// Output is the "level" shape: one figure per locality and year, with the implied population base (d) when the count is published.
// No national figure: the table has none, and the sum of its localities is not the nation.
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { getBufferCached } = require("../lib/http");
const { makeMatcher } = require("../lib/names");
const { figures, smooth, toNumber } = require("./arcgis_table");

async function collect(ind, log = () => {}) {
  const sp = ind.collect, window = sp.window || 1;
  const master = JSON.parse(fs.readFileSync(path.join(cfg.DATA, "localities.json"), "utf8"));
  const match = makeMatcher(master), byCode = Object.fromEntries(master.map((l) => [String(l.code), l]));
  const residents = (l) => {
    const h = l.population_history;
    if (h) { const ys = Object.keys(h).map(Number).sort((a, b) => a - b); if (ys.length) return h[ys[ys.length - 1]]; }
    return l.population || 0;
  };

  const table = JSON.parse((await getBufferCached(sp.url, { headers: sp.headers || {} })).toString("utf8"));
  if (!Array.isArray(table)) throw new Error(`${ind.id}: ${sp.url} is not a table`);

  const codeOf = new Map();                                                   // one lookup per distinct name
  let skippedNames = 0, tooSmall = 0;
  const keyOf = (r) => {
    const name = r[sp.nameField];
    if (name == null) return null;
    if (!codeOf.has(name)) {
      const hit = /^מחוז /.test(name) ? null : match(name);
      const code = hit ? String(hit.code) : null;
      if (!code) skippedNames++;
      else if (sp.minPopulation && residents(byCode[code]) < sp.minPopulation) { tooSmall++; codeOf.set(name, null); return null; }
      codeOf.set(name, code);
    }
    return codeOf.get(name);
  };
  const rates = figures(table, sp, keyOf);

  // the population behind a rate: count / rate * per, where both are published
  const base = new Map();
  if (sp.countField) for (const r of table) {
    if (sp.where && Object.entries(sp.where).some(([f, v]) => r[f] !== v)) continue;
    const code = codeOf.get(r[sp.nameField]), n = toNumber(r[sp.countField]), v = toNumber(r[sp.valueField]), y = Number(r[sp.yearField]);
    if (code && y && n != null && v) base.set(code + "|" + y, Math.round((n / v) * (sp.per || 1)));
  }

  const years = {};
  let rows = 0;
  for (const [code, byYear] of rates) {
    for (const [y, v] of Object.entries(smooth(byYear, window, sp.fromYear))) {
      const cell = { v }, d = base.get(code + "|" + y);
      if (d) cell.d = d;
      (years[y] = years[y] || { nat: null, loc: {} }).loc["#" + code] = cell;
      rows++;
    }
  }
  log(`${ind.id}: ${rows} values, ${rates.size} localities (${skippedNames} names outside the locality master, ${tooSmall} below ${sp.minPopulation || 0} residents)`);
  return { rows, years };
}

module.exports = { collect };
