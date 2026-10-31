"use strict";
// Runs every collector the catalog asks for and writes one raw file per source into data/raw/.
//   node src/collect/run.js                  all sources
//   node src/collect/run.js --only th_mmrv   only these indicator ids (comma separated); the rest of the raw file is kept
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { indicators } = require("../catalog/indicators");

const COLLECTORS = {
  ckan_rate: require("./ckan_rate"),
  xlsx_table: require("./xlsx_table"),
  ckan_events: require("./ckan_events"),
  ckan_authority: require("./ckan_authority"),
  master: require("./master"),
  arcgis_table: require("./arcgis_table"),
  xlsx_panel: require("./xlsx_panel"),
  json_table: require("./json_table"),
  arcgis_registry: require("./arcgis_registry"),
  arcgis_quarterly: require("./arcgis_quarterly"),
  cbs_series: require("./cbs_series")
  // more collectors are registered here as sources are verified (ckan_level, ...)
};

async function main() {
  const onlyArg = process.argv.indexOf("--only");
  const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(",") : null;
  fs.mkdirSync(cfg.RAW, { recursive: true });

  const bySource = {};
  for (const ind of indicators) {
    if (only && !only.includes(ind.id)) continue;
    if (!ind.collect || !COLLECTORS[ind.collect.type]) continue;
    (bySource[ind.source] = bySource[ind.source] || []).push(ind);
  }

  for (const [source, list] of Object.entries(bySource)) {
    const file = path.join(cfg.RAW, source + ".json");
    let raw = { source, fetchedAt: null, indicators: {} };
    try { raw = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { /* first run for this source */ }
    for (const ind of list) {
      const t0 = Date.now();
      process.stdout.write(`${source} / ${ind.id} ...\n`);
      raw.indicators[ind.id] = await COLLECTORS[ind.collect.type].collect(ind, () => {});
      raw.fetchedAt = new Date().toISOString();
      fs.writeFileSync(file, JSON.stringify(raw));           // saved after every indicator, so a stopped run loses little
      const yrs = Object.keys(raw.indicators[ind.id].years).sort();
      process.stdout.write(`   ${raw.indicators[ind.id].rows} rows, years ${yrs[0]}-${yrs[yrs.length - 1]}, ${Math.round((Date.now() - t0) / 1000)}s\n`);
    }
  }
  process.stdout.write("done\n");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
