"use strict";
// Collector for statistical tables published as .xlsx files, one file per year (e.g. the National Insurance poverty report).
// The catalog entry says, for every file, where the locality rows start and which column holds the value; the national figure
// is read from a labelled row of another sheet of the same file. Output is the "level" shape: one figure per locality and year.
//
//   collect: { type: "xlsx_table", files: [ { year, url, sheet, firstRow, nameCol, valueCol,
//                                              nat: { sheet, label, col }, stop: /^\*/ } ] }
const { getBufferCached } = require("../lib/http");
const { parseXlsx } = require("../lib/xlsx");

const BROWSER = { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "he,en;q=0.8", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" };
const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
const sheetByName = (wb, name) => { const n = wb.names.find((x) => clean(x) === clean(name)); return n ? wb.sheet(n) : null; };

async function collect(ind, log = () => {}) {
  const spec = ind.collect, years = {};
  let rowsRead = 0;
  for (const f of spec.files) {
    const buf = await getBufferCached(f.url, { headers: BROWSER });
    const wb = parseXlsx(buf);
    const rows = sheetByName(wb, f.sheet);
    if (!rows) throw new Error(`${ind.id}: sheet "${f.sheet}" not found in ${f.url}`);
    const loc = {};
    for (let i = f.firstRow; i < rows.length; i++) {
      const name = clean(rows[i][f.nameCol]);
      if (!name || /^[*¹²³]/.test(name)) break;                 // the table ends at the first empty row or footnote
      const v = rows[i][f.valueCol];
      if (typeof v === "number" && isFinite(v)) { loc[name] = { v }; rowsRead++; }
    }
    let nat = null;
    if (f.nat) {
      const nrows = sheetByName(wb, f.nat.sheet);
      const hit = nrows && nrows.find((r) => clean(r[0]) === clean(f.nat.label));
      if (hit && typeof hit[f.nat.col] === "number") nat = { v: hit[f.nat.col] };
    }
    years[f.year] = { nat, loc };
    log(`${ind.id} ${f.year}: ${Object.keys(loc).length} localities, national ${nat ? nat.v.toFixed(1) : "none"}`);
  }
  return { rows: rowsRead, years };
}

module.exports = { collect };
