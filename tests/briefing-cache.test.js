"use strict";
// A cached briefing that holds a word the product does not use is not served (it counts as not written and is made again).
const test = require("node:test");
const assert = require("node:assert/strict");
const { hasForbidden } = require("../src/agent/briefing");
const { FORBIDDEN_WORDS } = require("../src/agent/guard");

const clean = { headline: "בבאר שבע התמונה מעורבת.", points: [{ title: "נגישות לרופאים", text: "זמן ההמתנה ארוך מהממוצע בארץ." }], first: "להתחיל בחיסונים.", caution: "הנתונים אינם מוכיחים סיבה." };

test("a clean briefing is served", () => {
  assert.equal(hasForbidden(clean), false);
  assert.equal(hasForbidden(null), false);
  assert.equal(hasForbidden({}), false);
});

test("a forbidden word in any part of the briefing keeps it from being served", () => {
  for (const w of FORBIDDEN_WORDS) {
    assert.equal(hasForbidden({ ...clean, headline: `המצב ${w} מאוד.` }), true, `headline: ${w}`);
    assert.equal(hasForbidden({ ...clean, points: [{ title: "נקודה", text: `זה ${w}.` }] }), true, `point text: ${w}`);
    assert.equal(hasForbidden({ ...clean, first: w }), true, `first: ${w}`);
  }
});

test("the stem of the worsening word catches its plural and feminine forms, as the stale Beer Sheva briefing had", () => {
  for (const form of ["מחמיר", "מחמירה", "מחמירים", "מדאיגה", "מדאיגים"]) assert.equal(hasForbidden({ ...clean, first: `שניהם ${form}.` }), true, form);
});
