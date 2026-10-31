"use strict";
// Collector for "x out of y" tables on data.gov.il (the tipat-halav quality measures): reads the whole table once and keeps
// only sums per locality and year, plus the same sums split by population sector and by the socio-economic band of the
// statistical area. The national totals are kept in the same shape, so a city can be compared with its own sector nationally.
const { ckanEach } = require("../lib/http");

const bandOf = (v) => {
  const n = parseInt(String(v == null ? "" : v).trim(), 10);
  if (!isFinite(n)) return "unk";
  return n <= 3 ? "low" : n <= 6 ? "mid" : "high";
};
const sectorOf = (v) => { const s = String(v == null ? "" : v).trim(); return s || "unk"; };

const cell = () => ({ all: [0, 0], sector: {}, ses: {} });
function add(c, sector, band, num, den) {
  c.all[0] += num; c.all[1] += den;
  const s = c.sector[sector] || (c.sector[sector] = [0, 0]); s[0] += num; s[1] += den;
  const b = c.ses[band] || (c.ses[band] = [0, 0]); b[0] += num; b[1] += den;
}

async function collect(ind, log = () => {}) {
  const sp = ind.collect;
  const fields = [sp.cityField, sp.yearField, sp.numField, sp.denField, sp.targetField, sp.sectorField, sp.sesField].filter(Boolean);
  const years = {};          // year -> { nat, loc: {raw: cell}, targets: {value: count} }
  const sectors = {};
  let read = 0;
  await ckanEach(sp.resource, {
    fields,
    onRows(rows, { offset, total }) {
      for (const r of rows) {
        const y = r[sp.yearField]; if (!y) continue;
        const num = Number(r[sp.numField]) || 0, den = Number(r[sp.denField]) || 0;
        const sector = sectorOf(r[sp.sectorField]), band = bandOf(r[sp.sesField]);
        const Y = years[y] || (years[y] = { nat: cell(), loc: {}, targets: {} });
        add(Y.nat, sector, band, num, den);
        const city = r[sp.cityField] && String(r[sp.cityField]).trim();
        if (city) add(Y.loc[city] || (Y.loc[city] = cell()), sector, band, num, den);
        const t = Number(r[sp.targetField]); if (t > 0) Y.targets[t] = (Y.targets[t] || 0) + 1;
        sectors[sector] = (sectors[sector] || 0) + 1;
      }
      read = offset + rows.length;
      log(`${ind.id}: ${read}/${total}`);
    }
  });
  const out = { rows: read, sectors, years: {} };
  for (const [y, Y] of Object.entries(years)) {
    const t = Object.entries(Y.targets).sort((a, b) => b[1] - a[1])[0];
    out.years[y] = { nat: Y.nat, loc: Y.loc, ...(t ? { target: Number(t[0]) } : {}) };
  }
  return out;
}

module.exports = { collect, bandOf, sectorOf };
