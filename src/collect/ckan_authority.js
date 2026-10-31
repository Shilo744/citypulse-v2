"use strict";
// Collector for tables with one row per local authority and year, keyed by the welfare ministry's authority code (the welfare
// department caseload files). The code is mapped to the CBS locality code through catalog/welfare_crosswalk.json (cities and local
// councils only; regional councils have no locality code and are left out). The value is a count turned into a rate per N residents.
//
//   collect: { type: "ckan_authority", resources: { 2021: "<resource id>", ... }, codeField: "סמל רשות",
//              fields: ["column name", "alternative name used in another year"], per: 1000 }
//
// Numbers in these files arrive as numbers or as text ("4,234"); cells such as "עד 10" are suppressed small counts and are skipped.
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { ckanEach } = require("../lib/http");

const toNumber = (v) => {
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v == null ? "" : v).replace(/[,\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
};

function populationOf(master) {
  return (code, year) => {
    const m = master[code]; if (!m) return null;
    const h = m.population_history || {};
    if (h[year]) return h[year];
    const ys = Object.keys(h).map(Number).sort((a, b) => a - b);
    if (!ys.length) return m.population || null;
    return h[ys.reduce((a, b) => (Math.abs(b - year) < Math.abs(a - year) ? b : a))];
  };
}

async function collect(ind, log = () => {}) {
  const sp = ind.collect;
  const cross = require("../catalog/welfare_crosswalk.json");
  const master = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(cfg.DATA, "localities.json"), "utf8")).map((l) => [String(l.code), l]));
  const pop = populationOf(master), per = sp.per || 1000;
  const years = {};
  let rows = 0;
  for (const [year, rid] of Object.entries(sp.resources)) {
    const loc = {}; let natN = 0, natPop = 0;
    await ckanEach(rid, { onRows(recs) {
      for (const r of recs) {
        const cbs = cross[String(Number(r[sp.codeField]))];
        if (!cbs) continue;
        const key = sp.fields.find((f) => r[f] !== undefined);
        const n = key ? toNumber(r[key]) : null, p = pop(String(cbs), Number(year));
        if (n == null || !p) continue;
        loc["#" + cbs] = { v: (n / p) * per, d: p, n };
        natN += n; natPop += p; rows++;
      }
    } });
    years[year] = { nat: natPop ? { v: (natN / natPop) * per, d: natPop, n: natN } : null, loc };
    log(`${ind.id} ${year}: ${Object.keys(loc).length} authorities`);
  }
  return { rows, years };
}

module.exports = { collect, toNumber };
