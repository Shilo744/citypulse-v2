"use strict";
// Collector that derives context parameters from the locality master (data/localities.json, built from the CBS locality file):
// no network access. Output is the "level" shape with keys "#<CBS code>".
//
//   collect: { type: "master", compute: "population" | "growth" | "ses_index", years: [...], span: 5 }
//
//   population  Israeli residents at the end of each year (the CBS series that excludes foreign nationals)
//   growth      percentage change of that population over `span` years, for each year that has a value `span` years earlier
//   ses_index   the CBS socio-economic index (one value per locality, the year of the index)
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");

async function collect(ind, log = () => {}) {
  const sp = ind.collect;
  const master = JSON.parse(fs.readFileSync(path.join(cfg.DATA, "localities.json"), "utf8"));
  const years = {};
  const put = (y, key, cell) => { (years[y] = years[y] || { nat: null, loc: {} }).loc["#" + key] = cell; };
  let rows = 0;
  for (const l of master) {
    const h = l.population_history || {};
    if (sp.compute === "population") for (const y of sp.years) if (h[y]) { put(y, l.code, { v: h[y] }); rows++; }
    if (sp.compute === "growth") for (const y of sp.years) if (h[y] && h[y - sp.span] && h[y - sp.span] >= 500) { put(y, l.code, { v: (h[y] / h[y - sp.span] - 1) * 100, d: h[y] }); rows++; }
    if (sp.compute === "ses_index" && l.ses_index != null) { put(sp.years[0], l.code, { v: l.ses_index }); rows++; }
  }
  if (sp.compute === "growth") {
    for (const y of sp.years) {
      let a = 0, b = 0;
      for (const l of master) { const h = l.population_history || {}; if (h[y] && h[y - sp.span]) { a += h[y]; b += h[y - sp.span]; } }
      if (years[y] && b) years[y].nat = { v: (a / b - 1) * 100 };
    }
  }
  log(`${ind.id}: ${rows} values`);
  return { rows, years };
}

module.exports = { collect };
