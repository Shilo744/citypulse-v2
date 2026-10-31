"use strict";
// Collector for the CBS workbooks "Local authorities in Israel: processing files" (one workbook per year, one row per authority, about 300
// columns whose position moves between years). A column is found by the text of its header, and the reference period printed above it
// gives the year of the value: the last year of the window ("2024-2020" and "2020 - 2024" are both 2024). When two workbooks carry the
// same window, the later workbook (the revised figure) wins.
//
//   collect: { type: "xlsx_panel", urls: ["<workbook 2016>", ..., "<workbook 2024>"], match: "שיעור פטירות מתוקנן",
//              minPopulation: 5000 }
//
// Cells: a plain number is kept. The CBS writes a rate based on 5-19 cases in brackets "( 2.1)" and one based on fewer than 5 cases as "..":
// both are left out, so a figure that rests on a handful of events never reaches a ranking.
// The national figure is the row "כלל ארצי" of the main sheet (workbooks 2022 and later) or the matching row of the summary sheet (earlier ones).
// Codes that are not in the locality master (regional councils) are skipped.
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { getBufferCached } = require("../lib/http");
const { parseXlsx } = require("../lib/xlsx");

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const findSheet = (wb, prefix) => { const n = wb.names.find((x) => clean(x).startsWith(prefix)); return n ? wb.sheet(n) : null; };

// a plain number, or a text that is one; brackets and ".." mean too few cases
function plainNumber(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = clean(v);
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

// the last year named in a reference period such as "2024-2020", "2020 - 2024" or "2022"
function windowEnd(text) {
  const ys = (clean(text).match(/\d{4}/g) || []).map(Number);
  return ys.length ? Math.max(...ys) : null;
}

// the first column whose header (the two header rows together) contains the text
function findColumn(rows, match) {
  const width = Math.max(...rows.slice(0, 6).map((r) => (r || []).length));
  for (let j = 0; j < width; j++) if ((clean((rows[3] || [])[j]) + " " + clean((rows[4] || [])[j])).includes(match)) return j;
  return -1;
}

function nationalValue(wb, rows, col, match) {
  for (const r of rows.slice(4, 14)) if (clean(r && r[0]) === "כלל ארצי") return plainNumber(r[col]);       // workbooks 2022 and later
  const sum = findSheet(wb, "סיכומים");                                                                  // earlier workbooks: one row per variable, the nation in column C
  if (sum) for (const r of sum) if (r && clean(r[1]).includes(match) && plainNumber(r[2]) != null) return plainNumber(r[2]);
  return null;
}

async function collect(ind, log = () => {}) {
  const sp = ind.collect;
  const master = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(cfg.DATA, "localities.json"), "utf8")).map((l) => [String(l.code), l]));
  const residents = (l) => {
    const h = l.population_history;
    if (h) { const ys = Object.keys(h).map(Number).sort((a, b) => a - b); if (ys.length) return h[ys[ys.length - 1]]; }
    return l.population || 0;
  };

  const years = {};
  let rows = 0, skipped = 0;
  for (const url of sp.urls) {
    const wb = parseXlsx(await getBufferCached(url));
    const sheet = findSheet(wb, "נתונים פיזיים");
    if (!sheet) throw new Error(`${ind.id}: no main sheet in ${url}`);
    const col = findColumn(sheet, sp.match);
    if (col < 0) continue;                                                // this year's workbook does not carry the parameter
    const year = windowEnd((sheet[2] || [])[col]);
    if (!year) continue;
    const loc = {};
    for (const r of sheet.slice(4)) {
      if (!r || !/^\d+$/.test(clean(r[1]))) continue;                     // authority rows only: the code column is a number
      const code = String(Number(clean(r[1])));
      if (!master[code]) { skipped++; continue; }
      if (sp.minPopulation && residents(master[code]) < sp.minPopulation) { skipped++; continue; }
      const v = plainNumber(r[col]);
      if (v != null) { loc["#" + code] = { v }; rows++; }
    }
    const nat = nationalValue(wb, sheet, col, sp.match);
    years[year] = { nat: nat != null ? { v: nat } : null, loc };           // a later workbook with the same window replaces the earlier one
    log(`${ind.id} ${year}: ${Object.keys(loc).length} localities`);
  }
  rows = Object.values(years).reduce((n, y) => n + Object.keys(y.loc).length, 0);
  return { rows, years };
}

module.exports = { collect, plainNumber, windowEnd, findColumn };
