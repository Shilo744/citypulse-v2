"use strict";
// Collector for event tables on data.gov.il (one row per event, a locality code on each row), turned into a yearly rate per
// 100,000 residents. Counts are smoothed over a window of years (default 3), because a mid-sized city has only a handful of
// serious road accidents a year and a single year jumps around.
//
//   collect: { type: "ckan_events", resources: { 2018: "<resource id>", ... }, codeField, yearField,
//              where: { FIELD: [allowed values] }, per: 100000, window: 3 }
//
// Population comes from data/localities.json (population_history, by year; the nearest year when one is missing).
// Output is the "level" shape; keys are CBS locality codes written "#1031". `d` is the population, `n` the events in the window.
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { ckanEach } = require("../lib/http");

const rowCache = new Map();          // resource id -> [[code, year, {where fields}]]; indicators of one run share the download

async function rowsOf(rid, fields) {
  const k = rid + "|" + fields.join(",");
  if (rowCache.has(k)) return rowCache.get(k);
  const out = [];
  await ckanEach(rid, { fields, onRows(rows) { for (const r of rows) out.push(r); } });
  rowCache.set(k, out);
  return out;
}

function populationOf(master) {
  return (code, year) => {
    const m = master[code]; if (!m) return null;
    const h = m.population_history || {};
    if (h[year]) return h[year];
    const ys = Object.keys(h).map(Number).sort((a, b) => a - b);
    if (!ys.length) return m.population || null;
    const near = ys.reduce((a, b) => (Math.abs(b - year) < Math.abs(a - year) ? b : a));
    return h[near];
  };
}

async function collect(ind, log = () => {}) {
  const sp = ind.collect;
  const master = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(cfg.DATA, "localities.json"), "utf8")).map((l) => [String(l.code), l]));
  const pop = populationOf(master);
  const win = sp.window || 3, per = sp.per || 100000;
  const where = Object.entries(sp.where || {});

  // counts[year][code]
  const counts = {};
  let read = 0;
  for (const [year, rid] of Object.entries(sp.resources)) {
    const rows = await rowsOf(rid, sp.fields || [sp.codeField, sp.yearField, ...where.map(([f]) => f)]);
    const c = counts[year] = {};
    for (const r of rows) {
      if (Number(r[sp.yearField]) !== Number(year)) continue;
      if (!where.every(([f, vals]) => vals.includes(Number(r[f])))) continue;
      const code = String(Number(r[sp.codeField]));
      if (code === "0" || !master[code]) continue;                 // outside any locality, or not in the master list
      c[code] = (c[code] || 0) + 1; read++;
    }
    log(`${ind.id} ${year}: ${Object.values(c).reduce((a, b) => a + b, 0)} events`);
  }

  const years = {};
  const ys = Object.keys(counts).map(Number).sort((a, b) => a - b);
  for (const y of ys.filter((v) => ys.includes(v - win + 1))) {
    const span = Array.from({ length: win }, (_, i) => y - win + 1 + i);
    const loc = {}; let natN = 0, natPop = 0;
    for (const code of Object.keys(master)) {
      const p = pop(code, y); if (!p) continue;
      let n = 0; for (const s of span) n += (counts[s] && counts[s][code]) || 0;
      natN += n; natPop += p;
      loc["#" + code] = { v: (n / win / p) * per, d: p, n };
    }
    years[y] = { nat: { v: (natN / win / natPop) * per, d: natPop, n: natN }, loc };
  }
  return { rows: read, years };
}

module.exports = { collect };
