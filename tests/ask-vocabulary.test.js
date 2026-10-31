"use strict";
/**
 * Vocabulary and tag-filling rules for the ask-agent.
 * No real LLM calls – tests only the pure functions in guard.js, spec.js, and fallback.js.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { expand, explain, FORBIDDEN_WORDS, FORBIDDEN_RE } = require("../src/agent/guard");
const { resolve } = require("../src/agent/spec");
const fallback = require("../src/agent/fallback");

// ---------------------------------------------------------------------------
// Minimal model stub – only the fields the tested functions actually read
// ---------------------------------------------------------------------------
function makeModel(cityName = "תל אביב") {
  return {
    city: { key: "tlv", name: cityName, population: 450000 },
    peers: [],
    priorities: ["th_mmrv"],
    findings: [],
    recommendations: [],
    indicators: [
      {
        id: "th_mmrv",
        label: "חיסון חמישה-בריביע",
        short: "חיסון MMRV",
        unit: "%",
        direction: "higher",
        domain: "immunization",
        status: "concern",
        statusWhy: "מתחת ליעד",
        priority: 10,
        importance: 10,
        series: [{ year: 2022, v: 88, nat: 92 }, { year: 2023, v: 87, nat: 91 }],
        last: { v: 87, year: 2023, nat: 91, target: 95, peer: 90, rank: 80, of: 150, d: 200, level: 2, gapNat: -4, gapTarget: -8, meetsTarget: false, reliable: true },
        history: { trendClass: "worsening", delta: -1, first: { year: 2022, v: 88 }, projection: null },
        equity: { sector: null, ses: null }
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// 1. Title tag filling: {{city}} in title resolves correctly
// ---------------------------------------------------------------------------
test("spec.resolve fills {{city}} token in title", () => {
  const model = makeModel("נצרת");
  const store = { distribution: () => [], name: (k) => k };
  const spec = {
    title: "התחומים החלשים ביותר ב{{city}}",
    answer: null,
    blocks: [],
    followups: []
  };
  const page = resolve(spec, store, model);
  assert.equal(page.title, "התחומים החלשים ביותר בנצרת");
});

// ---------------------------------------------------------------------------
// 2. Title with unresolvable {{ stays as raw text (not rejected to "תשובה")
//    – the fallback is the raw title, not the default
// ---------------------------------------------------------------------------
test("spec.resolve: title with unknown token falls back to raw title, not to default", () => {
  const model = makeModel("חיפה");
  const store = { distribution: () => [], name: (k) => k };
  const spec = {
    title: "מדד {{v:no_such_ind}} ב{{city}}",
    answer: null,
    blocks: [],
    followups: []
  };
  const page = resolve(spec, store, model);
  // expand fails (unknown token) -> raw title used as fallback -> NOT the default "תשובה"
  assert.equal(page.title, "מדד {{v:no_such_ind}} ב{{city}}");
  assert.notEqual(page.title, "תשובה");
});

// ---------------------------------------------------------------------------
// 3. After expand, no {{ must remain in any output field
// ---------------------------------------------------------------------------
test("expand rejects text where {{ remains after filling", () => {
  const model = makeModel();
  // A token with no matching indicator leaves an unresolved fragment
  const bad = "יש {{v:no_such_ind}} בבדיקה";
  assert.equal(expand(bad, model), null, "should reject – unresolved token");
});

test("expand: clean text with known token resolves and contains no {{", () => {
  const model = makeModel();
  const text = "ב{{city}} שיעור החיסון עומד על {{v:th_mmrv}}";
  const result = expand(text, model);
  assert.ok(result !== null, "should resolve successfully");
  assert.ok(!result.includes("{{"), "no {{ must remain after expand");
});

// ---------------------------------------------------------------------------
// 4. Forbidden words are rejected by expand
// ---------------------------------------------------------------------------
for (const word of FORBIDDEN_WORDS) {
  test(`expand rejects text containing forbidden word: "${word}"`, () => {
    const model = makeModel();
    const text = `זהו ${word} חשוב מאוד`;
    assert.equal(expand(text, model), null, `"${word}" must cause rejection`);
  });
}

// ---------------------------------------------------------------------------
// 5. explain() names the forbidden word when that is the reason
// ---------------------------------------------------------------------------
test("explain identifies forbidden word as the reason for rejection", () => {
  const model = makeModel();
  const reason = explain("הפרמטר הזה מדאיג מאוד", model);
  assert.match(reason, /forbidden word/);
});

// ---------------------------------------------------------------------------
// 6. Clean text (no forbidden words, no digits, no stray latin) passes expand
// ---------------------------------------------------------------------------
test("expand passes clean Hebrew text", () => {
  const model = makeModel();
  const clean = "מדד החיסון ב{{city}} דורש טיפול";
  const result = expand(clean, model);
  assert.ok(result !== null);
  assert.ok(!result.includes("{{"));
});

// ---------------------------------------------------------------------------
// 7. fallback.js text outputs contain no forbidden words
// ---------------------------------------------------------------------------
test("fallback.plan returns no forbidden words in title or followups", () => {
  const model = makeModel("ירושלים");
  // Cover multiple intent branches
  const questions = [
    "מה כדאי לעשות?",
    "איפה העיר חלשה?",
    "במה העיר חזקה?",
    "מה השתנה לאורך השנים?",
    "תמונת מצב כללית",
    "איך חיסון MMRV לאורך הזמן?"
  ];
  for (const q of questions) {
    const spec = fallback.plan(model, q);
    const allTexts = [spec.title, ...(spec.followups || [])].filter(Boolean);
    for (const t of allTexts) {
      assert.ok(!FORBIDDEN_RE.test(t), `Forbidden word found in fallback output for "${q}": "${t}"`);
    }
  }
});
