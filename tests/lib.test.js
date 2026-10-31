"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { norm, makeMatcher } = require("../src/lib/names");
const { trend, rankDesc, percentile, round } = require("../src/lib/stats");

test("norm: spelling variants of one locality collapse to one key", () => {
  assert.equal(norm("תל אביב - יפו"), norm("תל אביב -יפו"));
  assert.equal(norm("תל אביב - יפו"), norm("תל-אביב יפו"));
  assert.equal(norm("באר שבע"), norm("באר-שבע"));
  assert.equal(norm("קריית גת"), norm("קרית גת"));
  assert.equal(norm("אום אל-פחם"), norm("אום אל פחם"));
  assert.notEqual(norm("ג'ת"), norm("גת"));
});

test("matcher: exact, qualified and one-letter-off names", () => {
  const master = [
    { code: 3000, name_he: "ירושלים", population: 1000 },
    { code: 5000, name_he: "תל אביב - יפו", population: 500 },
    { code: 9000, name_he: "באר שבע", population: 300 },
    { code: 1031, name_he: "שדרות", population: 30 },
    { code: 6700, name_he: "קריית גת", population: 60 },
    { code: 1015, name_he: "מבשרת ציון", population: 25 }
  ];
  const m = makeMatcher(master);
  assert.equal(m("ירושלים").code, 3000);
  assert.equal(m("תל אביב -יפו").code, 5000);
  assert.equal(m("תל אביב").code, 5000);       // unique prefix
  assert.equal(m("באר-שבע").code, 9000);
  assert.equal(m("קרית גת").code, 6700);
  assert.equal(m("שדרוט"), null);               // five letters: too short for the one-letter-off rule
  assert.equal(m("מבשרת ציונ").code, 1015);    // six or more letters: one wrong letter still finds it
  assert.equal(m("עיר שלא קיימת"), null);
});

test("trend: Theil-Sen ignores one odd year", () => {
  const t = trend([{ x: 2020, y: 70 }, { x: 2021, y: 71 }, { x: 2022, y: 40 }, { x: 2023, y: 73 }, { x: 2024, y: 74 }]);
  assert.ok(Math.abs(t.slope - 1) < 0.01, "slope " + t.slope);
  assert.equal(trend([{ x: 1, y: 1 }, { x: 2, y: 2 }]), null);   // fewer than three points -> no trend
});

test("rank and percentile", () => {
  const v = [50, 60, 70, 80, 90];
  assert.equal(rankDesc(90, v), 1);
  assert.equal(rankDesc(60, v), 4);
  assert.equal(percentile(60, v), 20);
  assert.equal(round(2.345, 1), 2.3);
  assert.equal(round(NaN), null);
});

test("arcgis_table: categories are summed, a year needs all of them, and the window averages the last years that exist", () => {
  const { toNumber, figures, smooth } = require("../src/collect/arcgis_table");
  assert.equal(toNumber("14.4%"), 14.4);
  assert.equal(toNumber(" 7 "), 7);
  assert.equal(toNumber("אין"), null);
  const rows = [
    { code: 1, year: 2023, kind: "השמנה", v: "10.0%" }, { code: 1, year: 2023, kind: "עודף משקל", v: "20.0%" },
    { code: 1, year: 2024, kind: "השמנה", v: "12.0%" }, { code: 1, year: 2024, kind: "עודף משקל", v: "22.0%" },
    { code: 1, year: 2025, kind: "השמנה", v: "14.0%" },                                                    // the second category is missing: the year is dropped
    { code: 2, year: 2024, kind: "השמנה", v: "5.0%" }, { code: 2, year: 2024, kind: "השמנה", v: "6.0%" },  // two different values for one cell: ambiguous
    { code: 2, year: 2024, kind: "עודף משקל", v: "9.0%" }
  ];
  const spec = { yearField: "year", valueField: "v", sum: { field: "kind", values: ["השמנה", "עודף משקל"] } };
  const f = figures(rows, spec, (r) => String(r.code));
  assert.deepEqual(f.get("1"), { 2023: 30, 2024: 34 });
  assert.equal(f.has("2"), false);
  const s = smooth({ 2022: 30, 2023: 33, 2024: 36, 2026: 40 }, 3, 2023);
  assert.deepEqual(s, { 2023: 31.5, 2024: 33, 2026: 38 });          // 2023 has two values in its window, 2026 has itself and 2024
  assert.deepEqual(smooth({ 2024: 30 }, 3), {});                       // a single value is not a mean
  assert.deepEqual(smooth({ 2024: 30 }, 1), { 2024: 30 });
});

test("xlsx_panel: a plain number is kept, a rate on few cases is dropped, and the year is the end of the printed window", () => {
  const { plainNumber, windowEnd } = require("../src/collect/xlsx_panel");
  assert.equal(plainNumber(5.3), 5.3);
  assert.equal(plainNumber(" 4.8"), 4.8);          // the CBS pads plain rates with a space
  assert.equal(plainNumber("( 2.1)"), null);        // 5-19 cases: in brackets
  assert.equal(plainNumber(".."), null);            // fewer than 5 cases
  assert.equal(plainNumber(" -"), null);
  assert.equal(windowEnd("2024-2020"), 2024);
  assert.equal(windowEnd("2020 - 2024"), 2024);
  assert.equal(windowEnd("2022"), 2022);
  assert.equal(windowEnd("שנת עדכון"), null);
});

test("guard: a repeated unit collapses and a prefix gets its hyphen, but never before the city name", () => {
  const { expand } = require("../src/agent/guard");
  const plain = (t) => t.replace(/[\u2066\u2069]/g, "");
  const model = { city: { name: "אום אל-פחם" }, indicators: [{ id: "life_expectancy", unit: "years", last: { v: 79.6, nat: 83.1, year: 2024, rank: 40, of: 41 }, history: { first: { year: 2017 }, delta: 0.6 } }] };
  assert.equal(plain(expand("ב{{city}} תוחלת החיים {{v:life_expectancy}} שנים, לעומת {{nat:life_expectancy}} שנים ב{{year:life_expectancy}}", model)),
    "באום אל-פחם תוחלת החיים 79.6 שנים, לעומת 83.1 שנים ב-2024");
  assert.equal(expand("תוחלת החיים היא 79.6 שנים", model), null);          // a digit typed by the model is still rejected
  assert.equal(expand("{{v:no_such_parameter}}", model), null);              // so is a token that does not resolve
});

test("arcgis_registry: a provider listed under several funds counts once, and rows outside the filter or without a name are ignored", () => {
  const { providers } = require("../src/collect/arcgis_registry");
  const rows = [
    { c: 1, t: "רופאים", e: "משפחה", n: "ד״ר א", a: "x" },
    { c: 1, t: "רופאים", e: "משפחה", n: " ד״ר  א ", a: "y" },        // the same doctor under another fund, spacing differs
    { c: 1, t: "רופאים", e: "משפחה", n: "ד״ר ב", a: "x" },
    { c: 1, t: "רופאים", e: "ילדים", n: "ד״ר ג", a: "x" },          // another specialty
    { c: 1, t: "רופאים", e: "משפחה", n: "", a: "x" },               // no name
    { c: 2, t: "רופאים", e: "משפחה", n: "ד״ר א", a: "z" },          // the same name in another locality counts there
    { c: null, t: "רופאים", e: "משפחה", n: "ד״ר ד", a: "x" }        // no locality
  ];
  const f = providers(rows, { codeField: "c", match: { t: ["רופאים"], e: ["משפחה"] }, distinct: ["n"] });
  assert.equal(f.get("1").size, 2);
  assert.equal(f.get("2").size, 1);
  assert.equal(f.size, 2);
  // a regular expression and a two-field key: one name at two addresses is two service points
  const g = providers([
    { c: 1, e: "פסיכולוגיה", n: "מרכז", a: "רח׳ 1" }, { c: 1, e: "פסיכותרפיה ", n: "מרכז", a: "רח׳ 2" },
    { c: 1, e: "בריאות הנפש ", n: "מרכז", a: "רח׳ 1" }, { c: 1, e: "ילדים", n: "מרכז", a: "רח׳ 3" }
  ], { codeField: "c", like: { e: "פסיכ|בריאות הנפש" }, distinct: ["n", "a"] });
  assert.equal(g.get("1").size, 2);
});

test("arcgis_quarterly: the period text gives year and quarter, a quarter needs every category, and a year needs enough quarters", () => {
  const { periodOf, yearly } = require("../src/collect/arcgis_quarterly");
  assert.deepEqual(periodOf("03 - יולי- ספטמבר 2019", 2019), { year: 2019, q: 3 });
  assert.deepEqual(periodOf("25 - ינואר מרץ - 2025", 2019), { year: 2025, q: 1 });
  assert.deepEqual(periodOf("30 - אפריל-יוני 2026", 2019), { year: 2026, q: 2 });
  assert.equal(periodOf("30 - אפריל-יוני 2025", 2019), null);       // the number and the printed year disagree: not trusted
  assert.equal(periodOf("רבעון ראשון", 2019), null);
  const spec = { periodField: "p", categoryField: "c", valueField: "v", firstYear: 2019, categories: ["א", "ב"], minQuarters: 2 };
  const q = (n) => "0" + n + " - רבעון 2019";
  const rows = [
    { k: 1, p: q(1), c: "א", v: 10 }, { k: 1, p: q(1), c: "ב", v: 20 },        // locality 1: quarter 1 = 15
    { k: 1, p: q(2), c: "א", v: 20 }, { k: 1, p: q(2), c: "ב", v: 30 },        // quarter 2 = 25
    { k: 1, p: q(3), c: "א", v: 99 },                                         // quarter 3 lacks a category: not used
    { k: 2, p: q(1), c: "א", v: 1 }, { k: 2, p: q(1), c: "ב", v: 3 },          // locality 2: one full quarter only
    { k: 3, p: q(1), c: "א", v: 1 }, { k: 3, p: q(1), c: "א", v: 2 }, { k: 3, p: q(1), c: "ב", v: 3 },   // locality 3: two values for one cell
    { k: 3, p: q(2), c: "א", v: 4 }, { k: 3, p: q(2), c: "ב", v: 6 }
  ];
  const out = yearly(rows, spec, (r) => String(r.k));
  assert.deepEqual(out.get("1"), { 2019: 20 });
  assert.equal(out.has("2"), false);
  assert.equal(out.has("3"), false);
});

test("cbs_series: observations become a year map, empty values and a different unit are left out", () => {
  const { yearsOf } = require("../src/collect/cbs_series");
  const body = JSON.stringify({ DataSet: { Series: [{ unit: { value: 16 }, obs: [{ TimePeriod: "2023-01", Value: 17.2 }, { TimePeriod: "2022-01", Value: null }, { TimePeriod: "2021-01", Value: 18.4 }] }] } });
  assert.deepEqual(yearsOf(body, 16), { 2021: 18.4, 2023: 17.2 });
  assert.equal(yearsOf(body, 67), null);                                  // another unit is never mixed in
  assert.equal(yearsOf(JSON.stringify({ DataSet: { Series: [] } }), 16), null);
});

test("format and guard: days carry their unit once, even when the model writes it again", () => {
  const { unitText, deltaText } = require("../src/lib/format");
  const { expand } = require("../src/agent/guard");
  const plain = (t) => t.replace(/[\u2066\u2069]/g, "");
  assert.equal(plain(unitText("days", 29, 0)), "29 ימים");
  assert.equal(plain(deltaText("days", -3.4, 0)), "3 ימים");
  const model = { city: { name: "חיפה" }, indicators: [{ id: "wait_gyn_days", unit: "days", last: { v: 18, nat: 23, year: 2025 }, history: { first: { year: 2019 }, delta: 4 } }] };
  assert.equal(plain(expand("ההמתנה היא {{v:wait_gyn_days}} ימים", model)), "ההמתנה היא 18 ימים");
});

test("compress: sendBuf adds Vary: Accept-Encoding on uncompressed response", () => {
  const { sendBuf } = require("../src/lib/compress");
  let capturedHeaders = null;
  const fakeRes = {
    writeHead(code, hdrs) { capturedHeaders = hdrs; },
    end() {}
  };
  // Small buffer (<1024) — not compressed, but Vary must still be set.
  const buf = Buffer.from("hello");
  sendBuf({}, fakeRes, 200, {}, buf);
  assert.equal(capturedHeaders["Vary"], "Accept-Encoding", "Vary must be set on uncompressed response");
});

test("compress: sendBuf ignores br when q=0", () => {
  const { sendBuf } = require("../src/lib/compress");
  let capturedHeaders = null;
  const fakeRes = {
    writeHead(code, hdrs) { capturedHeaders = hdrs; },
    end() {}
  };
  // Large enough buffer to trigger compression attempt.
  const buf = Buffer.alloc(2000, 0x61); // 2 KB of 'a'
  const req = { headers: { "accept-encoding": "br;q=0, gzip;q=0" } };
  sendBuf(req, fakeRes, 200, {}, buf);
  // Neither encoding is acceptable — response must be uncompressed.
  assert.equal(capturedHeaders["Content-Encoding"], undefined, "Content-Encoding must be absent when both encodings are q=0");
});

test("compress: sendBuf uses gzip when br is q=0 but gzip is not", () => {
  const { sendBuf } = require("../src/lib/compress");
  let capturedHeaders = null;
  const fakeRes = {
    writeHead(code, hdrs) { capturedHeaders = hdrs; },
    end() {}
  };
  const buf = Buffer.alloc(2000, 0x61);
  const req = { headers: { "accept-encoding": "br;q=0, gzip" } };
  sendBuf(req, fakeRes, 200, {}, buf);
  assert.equal(capturedHeaders["Content-Encoding"], "gzip", "must fall back to gzip when br is q=0");
});
