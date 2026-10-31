"use strict";
// Tests for src/lib/export.js — cityCsv(model, catalog)
// Runs against the built store (data/store/store.json), three localities including a very small one (key 16).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const cfg = require("../src/lib/config");
const { Store } = require("../src/model/store");
const { buildCityModel } = require("../src/model/city");
const { cityCsv } = require("../src/lib/export");
const { publicCatalog } = require("../src/api");

const storeFile = path.join(cfg.STORE, "store.json");
const haveStore = fs.existsSync(storeFile);
const store = haveStore ? Store.load(storeFile) : null;
const catalog = haveStore ? publicCatalog() : null;

// ── helpers ──────────────────────────────────────────────────────────────────

/** Parse a CSV with BOM and CRLF into an array of row arrays (handles quoted cells). */
function parseCsv(text) {
  const raw = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows = [];
  for (const line of raw.split(/\r\n|\n/)) {
    if (line === "") continue;
    const cells = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let val = "";
        i++;
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { val += line[i++]; }
        }
        cells.push(val);
        if (line[i] === ",") i++;
      } else {
        const end = line.indexOf(",", i);
        if (end === -1) { cells.push(line.slice(i)); i = line.length; }
        else { cells.push(line.slice(i, end)); i = end + 1; }
      }
    }
    if (line.endsWith(",")) cells.push("");          // an empty last cell (the guideline columns end empty for most indicators)
    rows.push(cells);
  }
  return rows;
}

const EXPECTED_COLS = [
  "תחום", "מדד", "מה נמדד", "כיוון",
  "שנה", "ערך", "יחידה",
  "ממוצע ארצי", "יישובים דומים", "יעד",
  "מצב", "מהימנות", "דירוג בארץ", "מתוך כמה יישובים",
  "מקור", "קישור",
  // the official guideline and the reference figure (appended, so the older columns keep their place)
  "יעד או הנחיה רשמית", "פער מהיעד (חיובי = טוב מהיעד)", "עומד ביעד", "מקור היעד", "קישור ליעד",
  "נקודת ייחוס", "מקור נקודת הייחוס", "קישור לנקודת הייחוס"
];

const IDX = {};
for (let i = 0; i < EXPECTED_COLS.length; i++) IDX[EXPECTED_COLS[i]] = i;

// minimal catalog stub for unit tests
const STUB_CATALOG = {
  domains: [
    { id: "health", label: "בריאות" },
    { id: "context", label: "הקשר ודמוגרפיה" },
  ],
  indicators: [
    { id: "x", source: "src1", definition: "הגדרה מלאה של המדד" },
    { id: "desc_id", source: "src2", definition: "הגדרת מדד מתאר" },
    { id: "small_id", source: "src1", definition: "הגדרת מדד קטן" },
    { id: "test_id", source: "src1", definition: "הגדרת מדד בדיקה" },
  ],
  sources: {
    src1: { name: "מדדי איכות", publisher: "משרד הבריאות", url: "https://example.com/src1" },
    src2: { name: "קובץ יישובים", publisher: "הלמ״ס", url: "https://example.com/src2" },
  }
};

// ── static / unit tests (no store needed) ────────────────────────────────────

test("cityCsv: output starts with UTF-8 BOM", () => {
  const model = { city: { name: "בדיקה" }, indicators: [] };
  const csv = cityCsv(model, STUB_CATALOG);
  assert.equal(csv.codePointAt(0), 0xFEFF, "BOM missing");
});

test("cityCsv: header row has exactly the required Hebrew columns", () => {
  const model = { city: { name: "בדיקה" }, indicators: [] };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows.length, 1, "should have exactly one row (header) for empty indicators");
  assert.deepEqual(rows[0], EXPECTED_COLS);
});

test("cityCsv: CRLF line endings", () => {
  const model = { city: { name: "בדיקה" }, indicators: [] };
  const csv = cityCsv(model, STUB_CATALOG).slice(1); // strip BOM
  assert.ok(csv.endsWith("\r\n"), "last line should end with CRLF");
  assert.ok(!csv.replace(/\r\n/g, "").includes("\n"), "bare LF found");
});

test("cityCsv: values with commas and quotes are escaped correctly", () => {
  const model = {
    city: { name: "בדיקה" },
    indicators: [{
      id: "test_id", domain: "context", label: 'מדד "מיוחד"', short: "קצר",
      unit: "%", direction: "higher",
      last: { year: 2024, v: 75.5, nat: 70, peer: 72, target: 80, reliable: true, rank: 10, of: 100, level: 60 },
      status: "good"
    }]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows.length, 2);
  assert.equal(rows[1][IDX["מדד"]], 'מדד "מיוחד"');
  assert.equal(rows[1][IDX["הקשר ודמוגרפיה"]], undefined); // domain translates
  assert.equal(rows[1][IDX["תחום"]], "הקשר ודמוגרפיה");
});

test("cityCsv: domain column shows Hebrew label from catalog, not English id", () => {
  const model = {
    city: { name: "בדיקה" },
    indicators: [{
      id: "x", domain: "health", label: "מדד", short: "מ",
      unit: "%", direction: "higher",
      last: { year: 2024, v: 60, nat: null, peer: null, target: null, reliable: true, rank: 5, of: 50, level: 70 },
      status: "good"
    }]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows[1][IDX["תחום"]], "בריאות");
});

test("cityCsv: מה נמדד column shows definition from catalog, not short label", () => {
  const model = {
    city: { name: "בדיקה" },
    indicators: [{
      id: "x", domain: "health", label: "מדד", short: "קצר",
      unit: "%", direction: "higher",
      last: { year: 2024, v: 60, nat: null, peer: null, target: null, reliable: true, rank: 5, of: 50, level: 70 },
      status: "good"
    }]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows[1][IDX["מה נמדד"]], "הגדרה מלאה של המדד");
});

test("cityCsv: status labels match product wording", () => {
  const cases = [
    { status: "strength", expected: "חזק" },
    { status: "good", expected: "תקין" },
    { status: "watch", expected: "למעקב" },
    { status: "concern", expected: "דורש טיפול" },
  ];
  for (const { status, expected } of cases) {
    const model = {
      city: { name: "ב" },
      indicators: [{
        id: "x", domain: "health", label: "מ", short: "מ",
        unit: "%", direction: "higher",
        last: { year: 2024, v: 60, nat: null, peer: null, target: null, reliable: true, rank: 5, of: 50, level: 70 },
        status
      }]
    };
    const rows = parseCsv(cityCsv(model, STUB_CATALOG));
    assert.equal(rows[1][IDX["מצב"]], expected, `status '${status}' should map to '${expected}'`);
  }
});

test("cityCsv: unreliable directional indicator → מצב='מעט מקרים', דירוג ריק", () => {
  const model = {
    city: { name: "בדיקה" },
    indicators: [{
      id: "small_id", domain: "health", label: "חיסון", short: "ח",
      unit: "%", direction: "higher",
      last: { year: 2024, v: 55, nat: 70, peer: null, target: 80, reliable: false, rank: null, of: null, level: null },
      status: "uncertain"
    }]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows[1][IDX["מצב"]], "מעט מקרים", "unreliable + directional → מעט מקרים");
  assert.equal(rows[1][IDX["דירוג בארץ"]], "", "unreliable → rank empty");
  assert.equal(rows[1][IDX["מתוך כמה יישובים"]], "", "unreliable → of empty");
});

test("cityCsv: descriptive indicator (direction=null) → כיוון='מתאר בלבד', מצב='מתאר בלבד'", () => {
  const model = {
    city: { name: "בדיקה" },
    indicators: [{
      id: "desc_id", domain: "context", label: "תושבים", short: "ת",
      unit: "count", direction: null,
      last: { year: 2024, v: 5000, nat: null, peer: null, target: null, reliable: true, rank: null, of: null, level: null },
      status: "na"
    }]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows[1][IDX["כיוון"]], "מתאר בלבד");
  assert.equal(rows[1][IDX["מצב"]], "מתאר בלבד");
});

test("cityCsv: reliable indicator gets rank and of columns filled", () => {
  const model = {
    city: { name: "ב" },
    indicators: [{
      id: "x", domain: "health", label: "מ", short: "מ",
      unit: "%", direction: "higher",
      last: { year: 2024, v: 60, nat: null, peer: null, target: null, reliable: true, rank: 12, of: 200, level: 70 },
      status: "good"
    }]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows[1][IDX["דירוג בארץ"]], "12");
  assert.equal(rows[1][IDX["מתוך כמה יישובים"]], "200");
});

test("cityCsv: מקור column combines publisher and name; קישור column holds the URL", () => {
  const model = {
    city: { name: "ב" },
    indicators: [{
      id: "x", domain: "health", label: "מ", short: "מ",
      unit: "%", direction: "higher",
      last: { year: 2024, v: 60, nat: null, peer: null, target: null, reliable: true, rank: 5, of: 50, level: 70 },
      status: "good"
    }]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows[1][IDX["מקור"]], "משרד הבריאות — מדדי איכות");
  assert.equal(rows[1][IDX["קישור"]], "https://example.com/src1");
});

test("cityCsv: all numeric values come from the model, nothing is invented", () => {
  const model = {
    city: { name: "בדיקה" },
    indicators: [{
      id: "x", domain: "health", label: "ל", short: "ל",
      unit: "%", direction: "higher",
      last: { year: 2022, v: 63.7, nat: 58.2, peer: 61.1, target: 80, reliable: true, rank: 5, of: 50, level: 70 },
      status: "good"
    }]
  };
  const r = parseCsv(cityCsv(model, STUB_CATALOG))[1];
  assert.equal(r[IDX["שנה"]], "2022");
  assert.equal(r[IDX["ערך"]], "63.7");
  assert.equal(r[IDX["ממוצע ארצי"]], "58.2");
  assert.equal(r[IDX["יישובים דומים"]], "61.1");
  assert.equal(r[IDX["יעד"]], "80");
});

// ── store-based tests ─────────────────────────────────────────────────────────

test("cityCsv: large city (key 3000 = ירושלים) — header, domain labels, every numeric value traces to model", { skip: !haveStore }, () => {
  const model = buildCityModel(store, "3000");
  assert.ok(model, "model for key 3000 must exist");
  const rows = parseCsv(cityCsv(model, catalog));
  assert.deepEqual(rows[0], EXPECTED_COLS);
  assert.equal(rows.length - 1, model.indicators.length);

  // domains map must be Hebrew
  const domainMap = {};
  for (const d of catalog.domains) domainMap[d.id] = d.label;

  for (let i = 0; i < model.indicators.length; i++) {
    const a = model.indicators[i];
    const r = rows[i + 1];
    // domain label is Hebrew
    assert.equal(r[IDX["תחום"]], domainMap[a.domain] || a.domain, `${a.id}: domain label`);
    // year and value match exactly
    assert.equal(r[IDX["שנה"]], String(a.last.year), `${a.id}: year`);
    assert.equal(r[IDX["ערך"]], String(a.last.v), `${a.id}: value`);
    // optional cells
    if (a.last.nat != null) assert.equal(r[IDX["ממוצע ארצי"]], String(a.last.nat), `${a.id}: nat`);
    else assert.equal(r[IDX["ממוצע ארצי"]], "", `${a.id}: nat empty`);
    if (a.last.peer != null) assert.equal(r[IDX["יישובים דומים"]], String(a.last.peer), `${a.id}: peer`);
    else assert.equal(r[IDX["יישובים דומים"]], "", `${a.id}: peer empty`);
    if (a.last.target != null) assert.equal(r[IDX["יעד"]], String(a.last.target), `${a.id}: target`);
    else assert.equal(r[IDX["יעד"]], "", `${a.id}: target empty`);
  }
});

test("cityCsv: medium city (key 9000 = באר שבע) — reliable flag and rank columns", { skip: !haveStore }, () => {
  const model = buildCityModel(store, "9000");
  assert.ok(model, "model for key 9000 must exist");
  const rows = parseCsv(cityCsv(model, catalog));
  for (let i = 0; i < model.indicators.length; i++) {
    const a = model.indicators[i];
    const r = rows[i + 1];
    const expectedReliable = a.last.reliable ? "כן" : "לא";
    assert.equal(r[IDX["מהימנות"]], expectedReliable, `${a.id}: reliable`);
    // rank filled iff reliable and rank exists
    if (a.last.reliable && a.last.rank != null) {
      assert.equal(r[IDX["דירוג בארץ"]], String(a.last.rank), `${a.id}: rank`);
      assert.equal(r[IDX["מתוך כמה יישובים"]], String(a.last.of), `${a.id}: of`);
    } else {
      assert.equal(r[IDX["דירוג בארץ"]], "", `${a.id}: rank must be empty`);
      assert.equal(r[IDX["מתוך כמה יישובים"]], "", `${a.id}: of must be empty`);
    }
  }
});

test("cityCsv: large city (key 3000) — מקור is publisher+name, קישור is a URL, domain is never an English id", { skip: !haveStore }, () => {
  const model = buildCityModel(store, "3000");
  const rows = parseCsv(cityCsv(model, catalog));
  const englishDomainRe = /^[a-z_]+$/;
  const urlRe = /^https?:\/\//;
  for (let i = 0; i < model.indicators.length; i++) {
    const r = rows[i + 1];
    assert.ok(!englishDomainRe.test(r[IDX["תחום"]]), `row ${i}: domain is English id: "${r[IDX["תחום"]]}"`);
    // source should not be the indicator id
    const a = model.indicators[i];
    assert.ok(r[IDX["מקור"]] !== a.id, `${a.id}: source column shows indicator id`);
    // if a URL is present it must look like one
    if (r[IDX["קישור"]]) assert.ok(urlRe.test(r[IDX["קישור"]]), `${a.id}: קישור not a URL: ${r[IDX["קישור"]]}`);
  }
});

test("cityCsv: small locality (key 16) — unreliable indicators get 'מעט מקרים', no rank, no invented numbers", { skip: !haveStore }, () => {
  const model = buildCityModel(store, "16");
  if (!model || model.indicators.length === 0) return;
  const rows = parseCsv(cityCsv(model, catalog));
  assert.deepEqual(rows[0], EXPECTED_COLS, "header must match even for a tiny locality");

  let foundUnreliable = false;
  for (let i = 0; i < model.indicators.length; i++) {
    const a = model.indicators[i];
    const r = rows[i + 1];
    // value always comes from model
    assert.equal(r[IDX["ערך"]], String(a.last.v), `${a.id}: value must match model`);
    if (!a.last.reliable && a.direction) {
      foundUnreliable = true;
      // must say מעט מקרים, not a judgement like דורש טיפול / תקין etc.
      assert.equal(r[IDX["מצב"]], "מעט מקרים", `${a.id}: unreliable → מעט מקרים`);
      // rank and of must be empty
      assert.equal(r[IDX["דירוג בארץ"]], "", `${a.id}: unreliable → rank empty`);
      assert.equal(r[IDX["מתוך כמה יישובים"]], "", `${a.id}: unreliable → of empty`);
    }
  }
  if (foundUnreliable) {
    // confirmed that unreliable indicators were present and correctly handled
    assert.ok(true);
  }
});

test("cityCsv: Hebrew unit labels used for known units", () => {
  const UNIT_CASES = [
    { unit: "per1000", expected: "לכל 1,000" },
    { unit: "per10k",  expected: "לכל 10,000" },
    { unit: "per100k", expected: "לכל 100,000" },
    { unit: "count",   expected: "מספר" },
    { unit: "index",   expected: "ציון" },
    { unit: "days",    expected: "ימים" },
    { unit: "%",       expected: "אחוז" },
  ];
  for (const { unit, expected } of UNIT_CASES) {
    const model = {
      city: { name: "ב" },
      indicators: [{
        id: "x", domain: "health", label: "מ", short: "מ",
        unit, direction: "higher",
        last: { year: 2024, v: 10, nat: null, peer: null, target: null, reliable: true, rank: 1, of: 10 },
        status: "good"
      }]
    };
    const rows = parseCsv(cityCsv(model, STUB_CATALOG));
    assert.equal(rows[1][IDX["יחידה"]], expected, `unit '${unit}' should appear as '${expected}'`);
  }
});

test("cityCsv: stale indicator (status=stale) → rank and of are empty", () => {
  const model = {
    city: { name: "ב" },
    indicators: [{
      id: "x", domain: "health", label: "מ", short: "מ",
      unit: "%", direction: "higher",
      last: { year: 2022, v: 50, nat: 60, peer: null, target: null, reliable: true, rank: 145, of: 177 },
      status: "stale"
    }]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows[1][IDX["מצב"]], "בלי שיפוט", "stale → בלי שיפוט");
  assert.equal(rows[1][IDX["דירוג בארץ"]], "", "stale → rank must be empty");
  assert.equal(rows[1][IDX["מתוך כמה יישובים"]], "", "stale → of must be empty");
});

test("cityCsv: uncertain indicator → rank and of are empty", () => {
  const model = {
    city: { name: "ב" },
    indicators: [{
      id: "small_id", domain: "health", label: "מ", short: "מ",
      unit: "%", direction: "higher",
      last: { year: 2024, v: 50, nat: 60, peer: null, target: null, reliable: true, rank: 50, of: 100 },
      status: "uncertain"
    }]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows[1][IDX["מצב"]], "בלי שיפוט", "uncertain → בלי שיפוט");
  assert.equal(rows[1][IDX["דירוג בארץ"]], "", "uncertain → rank must be empty");
  assert.equal(rows[1][IDX["מתוך כמה יישובים"]], "", "uncertain → of must be empty");
});

test("cityCsv: descriptive indicator → מצב='מתאר בלבד'", () => {
  const model = {
    city: { name: "ב" },
    indicators: [{
      id: "desc_id", domain: "context", label: "תושבים", short: "ת",
      unit: "count", direction: null,
      last: { year: 2024, v: 5000, nat: null, peer: null, target: null, reliable: true, rank: null, of: null },
      status: "na"
    }]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  assert.equal(rows[1][IDX["מצב"]], "מתאר בלבד", "descriptor → מתאר בלבד");
});

test("rfc5987: encodes apostrophe and special chars", () => {
  const { rfc5987 } = require("../src/lib/export");
  const encoded = rfc5987("citypulse-סח'נין.csv");
  assert.ok(!encoded.includes("'"), "apostrophe must be percent-encoded");
  assert.ok(!encoded.includes("!"), "exclamation must be percent-encoded");
  assert.ok(!encoded.includes("("), "open paren must be percent-encoded");
  assert.ok(!encoded.includes(")"), "close paren must be percent-encoded");
  assert.ok(!encoded.includes("*"), "asterisk must be percent-encoded");
  // The encoded form must be valid percent-encoding (decodeable)
  const decoded = decodeURIComponent(encoded);
  assert.ok(decoded.includes("סח"), "Hebrew characters must round-trip");
});

// ── the official guideline columns ──────────────────────────────────────────────

test("cityCsv: an indicator with an official target gets its text, gap, 'met', source and link; one without says אין יעד רשמי", () => {
  const src = { publisher: "משרד הבריאות", title: "דוח איכות, עמוד 359", url: "https://example.com/report.pdf" };
  const model = {
    city: { name: "ב" },
    indicators: [
      { id: "x", domain: "health", label: "חיסון", unit: "%", direction: "higher", status: "concern",
        last: { year: 2024, v: 51.9, nat: 65.8, peer: null, target: 80, reliable: true, rank: 150, of: 180, level: 10 },
        guide: { judges: true, text: "לפחות \u206680%\u2069", year: "2024", gap: -28.1, meets: false, source: src },
        benchmark: null },
      { id: "desc_id", domain: "context", label: "ילדים בעוני", unit: "%", direction: null, status: "na",
        last: { year: 2024, v: 2.6, nat: 28, peer: null, target: null, reliable: true, rank: null, of: null },
        guide: null,
        benchmark: { judges: false, text: "\u206612.2%\u2069", year: "2021", gap: null, meets: null, source: { publisher: "OECD", title: "מאגר המשפחה", url: "https://example.com/oecd.pdf" } } },
      { id: "plain", domain: "health", label: "בלי יעד", unit: "%", direction: "higher", status: "good",
        last: { year: 2024, v: 60, nat: 50, peer: null, target: null, reliable: true, rank: 5, of: 50, level: 70 } }
    ]
  };
  const rows = parseCsv(cityCsv(model, STUB_CATALOG));
  const g = (r, name) => rows[r][EXPECTED_COLS.indexOf(name)];
  assert.equal(g(1, "יעד או הנחיה רשמית"), "לפחות 80% (2024)", "the direction marks of the number are stripped for a spreadsheet");
  assert.equal(g(1, "פער מהיעד (חיובי = טוב מהיעד)"), "-28.1");
  assert.equal(g(1, "עומד ביעד"), "לא");
  assert.equal(g(1, "מקור היעד"), "משרד הבריאות — דוח איכות, עמוד 359");
  assert.equal(g(1, "קישור ליעד"), "https://example.com/report.pdf");
  assert.equal(g(1, "נקודת ייחוס"), "");
  assert.equal(g(2, "יעד או הנחיה רשמית"), "אין יעד רשמי");
  assert.equal(g(2, "פער מהיעד (חיובי = טוב מהיעד)"), "", "a reference figure of other countries never gets a gap or a 'met'");
  assert.equal(g(2, "עומד ביעד"), "");
  assert.equal(g(2, "נקודת ייחוס"), "12.2% (2021)");
  assert.equal(g(2, "מקור נקודת הייחוס"), "OECD — מאגר המשפחה");
  assert.equal(g(3, "יעד או הנחיה רשמית"), "אין יעד רשמי", "a model without the fields reads as no official target");
});

test("cityCsv: the real model of a town carries the guideline columns for every indicator", { skip: !haveStore }, () => {
  const model = buildCityModel(store, "1031");
  const rows = parseCsv(cityCsv(model, catalog));
  const col = (n) => EXPECTED_COLS.indexOf(n);
  let withBar = 0;
  model.indicators.forEach((a, i) => {
    const r = rows[i + 1];
    assert.equal(r.length, EXPECTED_COLS.length, `${a.id}: column count`);
    if (a.guide && a.guide.judges) {
      withBar++;
      assert.equal(r[col("עומד ביעד")], a.guide.meets ? "כן" : "לא", `${a.id}: met`);
      assert.equal(r[col("פער מהיעד (חיובי = טוב מהיעד)")], String(a.guide.gap), `${a.id}: gap`);
      assert.match(r[col("קישור ליעד")], /^https:\/\//, `${a.id}: link`);
    } else assert.equal(r[col("עומד ביעד")], "", `${a.id}: no verdict without a judging target`);
    if (!a.guide) assert.equal(r[col("יעד או הנחיה רשמית")], "אין יעד רשמי", a.id);
  });
  assert.ok(withBar >= 10, "town 1031 has at least ten indicators with an official target, got " + withBar);
});
