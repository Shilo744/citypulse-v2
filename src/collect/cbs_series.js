"use strict";
// Collector for the CBS open Series API table "quality of life in the large cities": one series per city slot and indicator,
//   https://apis.cbs.gov.il/series/data/path?id=45,3,<city slot>,<theme>,<indicator>
// The slots are the table's own numbers, not locality codes; the city is found by its name. Slot 16 is the national average.
// The API answers HTTP 500 for a slot that has no series for the indicator: such a city is simply missing for that indicator.
//
//   collect: { type: "cbs_series", path: "45,3", theme: 3, indicator: 6924, unit: 16, fromYear: 2015 }
//
// Only the unit the indicator is defined with is accepted (16 = percent), so a series whose unit changed is not mixed in.
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { request, sleep } = require("../lib/http");
const { makeMatcher } = require("../lib/names");

const API = "https://apis.cbs.gov.il/series/data/path";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", Accept: "application/json" };
const SLOTS = { 1: "אשדוד", 2: "אשקלון", 3: "באר שבע", 4: "בית שמש", 5: "בני ברק", 6: "בת ים", 7: "חולון", 8: "חיפה", 9: "ירושלים", 10: "נתניה", 11: "פתח תקווה",
  12: "ראשון לציון", 13: "רחובות", 14: "רמת גן", 15: "תל אביב-יפו", 17: "כפר סבא", 18: "חדרה", 19: "הרצליה" };
const NATIONAL = 16;

// the observations of one series as { year -> value }, or null when the API has no such series
function yearsOf(body, unit) {
  const s = ((JSON.parse(body).DataSet || {}).Series || [])[0];
  if (!s || (unit != null && (!s.unit || s.unit.value !== unit))) return null;
  const out = {};
  for (const o of s.obs || []) {
    const y = Number(String(o.TimePeriod).slice(0, 4)), v = o.Value;
    if (y > 1990 && typeof v === "number" && isFinite(v)) out[y] = v;
  }
  return Object.keys(out).length ? out : null;
}

async function fetchSeries(sp, slot) {
  const url = `${API}?id=${sp.path},${slot},${sp.theme},${sp.indicator}&format=json&download=false&PageSize=100`;
  for (let t = 0; t < 2; t++) {
    const r = await request(url, { headers: HEADERS }).catch(() => ({ status: 0 }));
    if (r.status === 200) return yearsOf(r.body.toString("utf8"), sp.unit);
    if (t === 0) await sleep(1200);
  }
  return null;
}

async function collect(ind, log = () => {}) {
  const sp = ind.collect;
  const master = JSON.parse(fs.readFileSync(path.join(cfg.DATA, "localities.json"), "utf8"));
  const match = makeMatcher(master);
  const years = {};
  const have = [], missing = [];
  for (const [slot, name] of Object.entries(SLOTS)) {
    const hit = match(name);
    if (!hit) { missing.push(name + " (name)"); continue; }
    const obs = await fetchSeries(sp, slot);
    await sleep(350);
    if (!obs) { missing.push(name); continue; }
    have.push(name);
    for (const [y, v] of Object.entries(obs)) if (!sp.fromYear || y >= sp.fromYear) (years[y] = years[y] || { nat: null, loc: {} }).loc["#" + hit.code] = { v };
  }
  const nat = await fetchSeries(sp, NATIONAL);
  if (nat) for (const [y, v] of Object.entries(nat)) if (years[y]) years[y].nat = { v };
  let rows = 0;
  for (const Y of Object.values(years)) rows += Object.keys(Y.loc).length;
  log(`${ind.id}: ${rows} values for ${have.length} cities; no series for: ${missing.join(", ") || "none"}; national ${nat ? "yes" : "no"}`);
  process.stdout.write(`   cities with a series: ${have.length}${missing.length ? "; none for " + missing.join(", ") : ""}; national: ${nat ? "yes" : "no"}\n`);
  return { rows, years };
}

module.exports = { collect, yearsOf };
