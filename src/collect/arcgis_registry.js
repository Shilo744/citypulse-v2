"use strict";
// Collector for a registry of service points where one row is a provider x specialty x health fund (the Ministry of Health health-services
// layer). A figure counts DISTINCT providers per locality, so a provider listed under several funds counts once, and divides by the
// locality's residents. The registry is a snapshot: its year is the year of the validity date, and every refresh adds a new snapshot year
// and keeps the earlier ones, which is how a trend builds up.
//
//   collect: { type: "arcgis_registry", url: "<layer url>", codeField: "city_code", dateField: "validity_date",
//              fields: ["city_code", "services_type_desc", "expertise_desc", "name", "address", "validity_date"],
//              match: { services_type_desc: ["רופאים"], expertise_desc: ["משפחה"] },     // the row must have one of these values in each field
//              like: { expertise_desc: "פסיכ|בריאות הנפש" },                              // and/or match a regular expression
//              distinct: ["name"],                                                        // rows equal in all these fields are one provider
//              per: 10000, minPopulation: 5000 }
//
// A locality with enough residents and no provider at all is a true zero (the registry covers the whole country), not a missing value.
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { getBufferCached, sleep } = require("../lib/http");

const PAGE = 1000;
const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

async function registryRows(url, fields) {
  const count = JSON.parse((await getBufferCached(`${url}/query?where=1%3D1&returnCountOnly=true&f=json`)).toString("utf8")).count;
  const out = [];
  for (let offset = 0; offset < count; offset += PAGE) {
    const u = `${url}/query?where=1%3D1&outFields=${encodeURIComponent(fields.join(","))}&returnGeometry=false&orderByFields=objectid&resultOffset=${offset}&resultRecordCount=${PAGE}&f=json`;
    const j = JSON.parse((await getBufferCached(u)).toString("utf8"));
    if (j.error) throw new Error("ArcGIS: " + JSON.stringify(j.error).slice(0, 200));
    const rows = (j.features || []).map((f) => f.attributes);
    if (!rows.length) break;
    out.push(...rows);
    await sleep(150);
  }
  if (out.length !== count) throw new Error(`registry ${url}: read ${out.length} of ${count} rows`);
  return out;
}

// rows -> Map(locality code -> Set of provider keys) for the rows that pass the filters
function providers(rows, spec) {
  const must = Object.entries(spec.match || {}), likes = Object.entries(spec.like || {}).map(([f, p]) => [f, new RegExp(p)]);
  const out = new Map();
  for (const r of rows) {
    if (must.some(([f, vals]) => !vals.includes(clean(r[f])))) continue;
    if (likes.some(([f, rx]) => !rx.test(clean(r[f])))) continue;
    const code = r[spec.codeField];
    if (!code) continue;
    const parts = spec.distinct.map((f) => clean(r[f]));
    if (parts.some((p) => !p)) continue;                                   // a row without a name (or address) is not a provider we can tell apart
    const k = String(code);
    if (!out.has(k)) out.set(k, new Set());
    out.get(k).add(parts.join("|"));
  }
  return out;
}

async function collect(ind, log = () => {}) {
  const sp = ind.collect;
  const master = JSON.parse(fs.readFileSync(path.join(cfg.DATA, "localities.json"), "utf8"));
  const residents = (l) => {
    const h = l.population_history;
    if (h) { const ys = Object.keys(h).map(Number).sort((a, b) => a - b); if (ys.length) return h[ys[ys.length - 1]]; }
    return l.population || 0;
  };
  const byCode = Object.fromEntries(master.map((l) => [String(l.code), l]));

  const rows = await registryRows(sp.url, sp.fields);
  let year = 0;                                                            // the snapshot year: the latest validity date in the registry
  for (const r of rows) { const y = Number(clean(r[sp.dateField]).slice(0, 4)); if (y > 2000 && y > year) year = y; }
  if (!year) throw new Error(`${ind.id}: no validity date in the registry`);
  const found = providers(rows, sp);

  const loc = {};
  let total = 0, outOfMaster = 0, tooSmall = 0;
  for (const [code, set] of found) { if (byCode[code]) total += set.size; else outOfMaster++; }
  for (const l of master) {
    const code = String(l.code), pop = residents(l);
    if (!pop || pop < (sp.minPopulation || 1)) { tooSmall++; continue; }
    const n = found.has(code) ? found.get(code).size : 0;
    loc["#" + code] = { v: (n / pop) * sp.per, d: pop, n };
  }
  const natPop = master.reduce((s, l) => s + residents(l), 0);

  const years = {};
  try {                                                                    // earlier snapshots stay: a trend needs more than one
    const prev = JSON.parse(fs.readFileSync(path.join(cfg.RAW, ind.source + ".json"), "utf8")).indicators[ind.id];
    if (prev && prev.years) for (const [y, v] of Object.entries(prev.years)) if (Number(y) < year) years[y] = v;
  } catch (e) { /* first snapshot */ }
  years[year] = { nat: { v: (total / natPop) * sp.per }, loc };

  log(`${ind.id}: ${Object.keys(loc).length} localities, ${total} providers nationwide (${outOfMaster} codes outside the locality master, ${tooSmall} below ${sp.minPopulation || 0} residents)`);
  return { rows: Object.keys(loc).length, years };
}

module.exports = { collect, providers, clean };
