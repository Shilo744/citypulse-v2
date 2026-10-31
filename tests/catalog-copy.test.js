"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { indicators } = require("../src/catalog/indicators");
const interventions = require("../src/catalog/interventions");

// Task 4: catalog copy quality checks

test("catalog: five updated short names are present", () => {
  const shorts = new Set(indicators.map((i) => i.short));
  assert.ok(shorts.has("שיעור פטירות מתוקנן"), "short 'שיעור פטירות מתוקנן' missing");
  assert.ok(shorts.has("אימהות שנבדקו לדיכאון אחרי לידה"), "short 'אימהות שנבדקו לדיכאון אחרי לידה' missing");
  assert.ok(shorts.has("אימהות שנשאלו על אלימות"), "short 'אימהות שנשאלו על אלימות' missing");
  assert.ok(shorts.has("תוסף ברזל לתינוקות"), "short 'תוסף ברזל לתינוקות' missing");
  assert.ok(shorts.has("פגיעות ילדים בחדר מיון"), "short 'פגיעות ילדים בחדר מיון' missing");
});

test("catalog: no displayed text contains 'אמהות'", () => {
  // check all user-visible text fields in indicators
  for (const ind of indicators) {
    for (const field of ["label", "short", "definition", "why", "caution"]) {
      if (ind[field]) assert.ok(!ind[field].includes("אמהות"), `indicator ${ind.id}.${field} contains 'אמהות'`);
    }
  }
  // check all user-visible text fields in interventions
  for (const iv of interventions) {
    for (const field of ["title", "summary", "caveat", "evidenceNote", "owner"]) {
      if (iv[field]) assert.ok(!iv[field].includes("אמהות"), `intervention ${iv.id}.${field} contains 'אמהות'`);
    }
    for (const action of iv.actions || []) {
      assert.ok(!action.includes("אמהות"), `intervention ${iv.id} action contains 'אמהות'`);
    }
  }
});

// Intervention titles that are intentionally left without a ל-verb prefix
// because the right verb is ambiguous (multiple equally valid options):
//   child_safe_sleep      - "הדרכה אחידה ומתועדת לשינה בטוחה לכל משפחה"
//   nutr_breastfeeding_support - "תמיכה בהנקה: ליווי אישי, קבוצות אימהות וחדרי הנקה"
//   road_safety_plan      - "תוכנית בטיחות בדרכים עירונית: ..."
//   child_obesity_program - "תוכנית בית-ספרית נגד עודף משקל: ..."
//   diabetes_prevention   - "תוכנית קהילתית למניעת סוכרת לאנשים בסיכון: ..."
const TITLE_EXCEPTIONS = new Set([
  "child_safe_sleep",
  "nutr_breastfeeding_support",
  "road_safety_plan",
  "child_obesity_program",
  "diabetes_prevention"
]);

test("interventions: every title starts with ל + Hebrew letters, except known exceptions", () => {
  for (const iv of interventions) {
    if (TITLE_EXCEPTIONS.has(iv.id)) continue;
    assert.match(
      iv.title,
      /^ל[\u05d0-\u05ea]/u,
      `intervention ${iv.id} title does not start with ל + Hebrew: "${iv.title}"`
    );
  }
});

// Task N: no em-dash / en-dash between digits anywhere in catalog files
test("catalog: no em-dash or en-dash between digits in any catalog file", () => {
  const EM_DASH_BETWEEN_DIGITS = /\d[–—]\d/;
  const catalogFiles = [
    "../src/catalog/indicators.js",
    "../src/catalog/interventions.js",
    "../src/catalog/sources.js",
    "../src/catalog/evidence.json",
  ];
  for (const rel of catalogFiles) {
    const content = fs.readFileSync(path.resolve(__dirname, rel), "utf8");
    const match = content.match(EM_DASH_BETWEEN_DIGITS);
    assert.ok(
      !match,
      `${rel} still contains digit–em-dash–digit: "${match && match[0]}"`
    );
  }
});
