"use strict";
// Joins the raw collector files with the locality master and writes data/store/store.json - the one file the server reads.
//   node src/collect/build_store.js
//
// Locality key = the CBS locality code when the name is found in data/localities.json, otherwise "~" + normalised name.
// Names that could not be matched are listed in data/store/unmatched.json (largest first) so the matcher can be improved.
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { norm, makeMatcher } = require("../lib/names");
const { indicators, byId } = require("../catalog/indicators");
let evidence = { parameters: {} };
try { evidence = require("../catalog/evidence.json"); } catch (e) { console.log("no catalog/evidence.json: report targets are not added (run build_evidence.js)"); }

const r1 = (x) => Math.round(x * 10) / 10;
const MIN_SPLIT = 10;     // a sector / socio-economic band with fewer people than this is left out

function cellOut(c) {
  const [n, d] = c.all;
  if (!(d > 0)) return null;
  const out = { v: r1((100 * n) / d), n: Math.round(n), d: Math.round(d) };
  for (const [field, key] of [["sector", "s"], ["ses", "q"]]) {
    const o = {};
    for (const [label, [sn, sd]] of Object.entries(c[field] || {})) if (sd >= MIN_SPLIT) o[label] = { v: r1((100 * sn) / sd), n: Math.round(sn), d: Math.round(sd) };
    if (Object.keys(o).length) out[key] = o;
  }
  return out;
}

const isLevel = (c) => c && typeof c.v === "number";
function levelOut(c, dec) {
  const f = 10 ** dec, o = { v: Math.round(c.v * f) / f };
  if (c.d > 0) o.d = Math.round(c.d);
  if (c.n != null) o.n = Math.round(c.n);
  return o;
}

function mergeCells(a, b) {                       // two raw names that are the same locality
  const out = { all: [a.all[0] + b.all[0], a.all[1] + b.all[1]], sector: { ...a.sector }, ses: { ...a.ses } };
  for (const f of ["sector", "ses"]) for (const [k, [n, d]] of Object.entries(b[f] || {})) { const x = out[f][k] || [0, 0]; out[f][k] = [x[0] + n, x[1] + d]; }
  return out;
}

function main() {
  let master = [];
  try { master = JSON.parse(fs.readFileSync(path.join(cfg.DATA, "localities.json"), "utf8")); } catch (e) { console.log("no data/localities.json yet: keys will be names"); }
  const match = makeMatcher(master);
  const localities = {};
  for (const m of master) localities[String(m.code)] = { key: String(m.code), ...m };

  const store = { builtAt: new Date().toISOString(), indicators: {}, localities, sourcesFetched: {} };
  const unmatched = {};

  for (const f of fs.readdirSync(cfg.RAW).filter((x) => x.endsWith(".json"))) {
    const raw = JSON.parse(fs.readFileSync(path.join(cfg.RAW, f), "utf8"));
    store.sourcesFetched[raw.source] = raw.fetchedAt;
    for (const [id, data] of Object.entries(raw.indicators)) {
      if (!byId[id]) continue;
      const out = { years: [], nat: {}, target: {}, targetSrc: {}, loc: {} };
      for (const year of Object.keys(data.years).sort()) {
        const Y = data.years[year];
        const dec = byId[id].decimals != null ? byId[id].decimals : 1;
        const nat = Y.nat && isLevel(Y.nat) ? levelOut(Y.nat, dec) : Y.nat ? cellOut(Y.nat) : null;
        if (nat) { out.nat[year] = nat; out.years.push(Number(year)); }
        if (Y.target) out.target[year] = Math.round(Y.target * 100);
        const merged = {};
        for (const [name, cell] of Object.entries(Y.loc)) {
          const coded = /^#\d+$/.test(name);                                                                   // sources that carry the CBS code
          if (coded && !localities[name.slice(1)]) continue;                                                  // a code outside the master (a regional council) is not a locality of this model
          const byCode = coded ? { code: name.slice(1) } : null;
          const hit = byCode || match(name);
          const key = hit ? String(hit.code) : "~" + norm(name);
          if (!hit) { unmatched[name] = (unmatched[name] || 0) + (cell.all ? cell.all[1] : 1); if (!localities[key]) localities[key] = { key, name_he: name, unmatched: true }; }
          if (isLevel(cell)) { if (!merged[key]) merged[key] = cell; }
          else merged[key] = merged[key] ? mergeCells(merged[key], cell) : cell;
        }
        for (const [key, cell] of Object.entries(merged)) {
          const c = isLevel(cell) ? levelOut(cell, dec) : cellOut(cell); if (!c) continue;
          (out.loc[key] = out.loc[key] || {})[year] = c;
          if (!out.years.includes(Number(year))) out.years.push(Number(year));
        }
      }
      // the dataset field "target" is 0 for 2024 in nearly every measure: 0 means missing, so the Ministry report value fills that year
      const rep = byId[id].evidence && evidence.parameters[byId[id].evidence];
      if (rep && rep.target && rep.target.by_year)
        for (const [y, v] of Object.entries(rep.target.by_year)) if (out.years.includes(Number(y)) && out.target[y] == null && v > 0) { out.target[y] = v; out.targetSrc[y] = "report"; }
      store.indicators[id] = out;
    }
  }

  fs.mkdirSync(cfg.STORE, { recursive: true });
  fs.writeFileSync(path.join(cfg.STORE, "store.json"), JSON.stringify(store));
  const um = Object.entries(unmatched).sort((a, b) => b[1] - a[1]).map(([name, d]) => ({ name, base: Math.round(d) }));
  fs.writeFileSync(path.join(cfg.STORE, "unmatched.json"), JSON.stringify(um, null, 1));
  const size = Math.round(fs.statSync(path.join(cfg.STORE, "store.json")).size / 1024);
  console.log(`store: ${Object.keys(store.indicators).length} indicators, ${Object.keys(localities).length} localities, ${size} KB; unmatched names: ${um.length}`);
}

if (require.main === module) main();
module.exports = { main };
