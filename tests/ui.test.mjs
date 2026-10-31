// The pure parts of the web layer (no DOM): the sentence that compares a figure with the nation, trend words, tick marks,
// and a source scan for the one bidi mistake that cost a day: a Hebrew word inside an LTR isolate swaps places with its numbers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compareLine, trendInfo, fmtVal, statusReason } from "../web/js/ui.js";
import { niceTicks } from "../web/js/charts.js";

test("compareLine knows which direction is good", () => {
  const hi = compareLine({ unit: "%", direction: "higher", last: { gapNat: -5, nat: 50 } });
  assert.equal(hi.tone, "attn"); assert.match(hi.text, /^חלש מהממוצע הארצי ב-5 נק׳$/);
  const wait = compareLine({ unit: "days", direction: "lower", last: { gapNat: 17, nat: 29 } });
  assert.equal(wait.tone, "attn"); assert.match(wait.text, /חלש מהממוצע הארצי ב-17 ימים/);
  const waitOk = compareLine({ unit: "days", direction: "lower", last: { gapNat: -4, nat: 29 } });
  assert.equal(waitOk.tone, "good"); assert.match(waitOk.text, /^טוב מהממוצע/);
});

test("compareLine never judges a descriptive parameter, and says so when there is nothing to compare", () => {
  const d = compareLine({ unit: "%", direction: null, last: { gapNat: 8, nat: 20 } });
  assert.equal(d.tone, "none"); assert.ok(!/טוב|חלש/.test(d.text)); assert.match(d.text, /גבוה מהממוצע הארצי/);
  assert.equal(compareLine({ unit: "%", direction: "higher", last: { gapNat: null } }).text, "אין ממוצע ארצי להשוואה");
  assert.equal(compareLine({ unit: "%", direction: "higher", last: { gapNat: 0.3, nat: 60 } }).text, "דומה לממוצע הארצי");
});

test("trendInfo: improving and worsening carry a tone, rising and falling only describe, unknown says nothing", () => {
  assert.equal(trendInfo({ history: { trendClass: "improving", delta: 3 } }).tone, "good");
  assert.equal(trendInfo({ history: { trendClass: "worsening", delta: -3 } }).tone, "attn");
  assert.equal(trendInfo({ history: { trendClass: "rising", delta: 2 } }).tone, "none");
  assert.equal(trendInfo({ history: { trendClass: "stable", delta: 0.2 } }).delta, null);
  assert.equal(trendInfo({ history: { trendClass: "unknown", delta: null } }), null);
});

test("fmtVal and niceTicks", () => {
  assert.equal(fmtVal("%", 66.123), "66.1%"); assert.equal(fmtVal("days", 46), "46"); assert.equal(fmtVal("%", null), "—");
  const t = niceTicks(61, 87, 4);
  assert.ok(t[0] <= 61 && t[t.length - 1] >= 87 && t.length >= 3 && t.every((v, i) => !i || v > t[i - 1]));
});

test("source scan: no ltr() call wraps Hebrew text (use outOf/ptsEl and isolate only the numbers)", () => {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "js");
  const bad = [];
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));     // pages/ and viz/ too
  for (const file of walk(dir).filter((x) => x.endsWith(".js"))) {
    const f = path.relative(dir, file), src = readFileSync(file, "utf8");
    for (let i = src.indexOf("ltr("); i !== -1; i = src.indexOf("ltr(", i + 1)) {
      if (/[A-Za-z0-9_$]/.test(src[i - 1] || "")) continue;                // a longer name that merely ends in "ltr"
      let depth = 0, j = i + 3;
      for (; j < src.length; j++) { if (src[j] === "(") depth++; else if (src[j] === ")" && --depth === 0) break; }
      if (/[֐-׿]/.test(src.slice(i, j + 1))) bad.push(f + ": " + src.slice(i, Math.min(j + 1, i + 70)).replace(/\s+/g, " "));
    }
  }
  assert.deepEqual(bad, []);
});

test("statusReason names the rule that decided a concern or a watch, and admits when the figure beats the national mean", () => {
  const a = { unit: "%", direction: "higher", status: "concern", statusWhy: ["target", "worsening"], last: { level: 35, gapTarget: -13.9, gapNat: 2.5, nat: 60, meetsTarget: false } };
  const t = statusReason(a);
  assert.match(t, /^דורש טיפול כי חסרות 13.9 נק׳ ליעד משרד הבריאות והמגמה בהידרדרות/);
  assert.match(t, /אף שהוא טוב מהממוצע הארצי ב-2.5 נק׳\.$/);
  const w = statusReason({ unit: "days", direction: "lower", status: "watch", statusWhy: ["rank"], last: { level: 38, gapNat: 4, nat: 29 } });
  assert.match(w, /^למעקב כי הערך טוב יותר מ-38% בלבד מהיישובים/); assert.ok(!/אף ש/.test(w));
  assert.match(statusReason({ unit: "days", direction: "lower", status: "concern", statusWhy: ["rank"], last: { level: 0, gapNat: 17, nat: 29, rank: 49, of: 49 } }), /מהחלשים ביותר מבין היישובים \(מקום 49 מתוך 49\)/);
  assert.equal(statusReason({ unit: "%", direction: "higher", status: "concern", statusWhy: [], last: { level: 10 } }), null);
});

test("statusReason for the calm statuses and the unjudged ones", () => {
  assert.match(statusReason({ unit: "%", direction: "higher", status: "good", last: { level: 62, meetsTarget: true } }), /^תקין: הערך טוב יותר מ-62% מהיישובים, עומד ביעד משרד הבריאות, ואין הידרדרות\.$/);
  assert.match(statusReason({ unit: "%", direction: "higher", status: "strength", last: { level: 90, meetsTarget: null } }), /^חוזק: /);
  assert.match(statusReason({ unit: "%", direction: null, status: "na", last: {} }), /מדד רקע/);
  assert.match(statusReason({ unit: "%", direction: "higher", status: "uncertain", last: {} }), /קטנה/);
});

test("statusReason concedes what is good about a concern: better than the nation, and improving", () => {
  const a = { unit: "%", direction: "higher", status: "concern", statusWhy: ["target"], history: { trendClass: "improving" }, last: { level: 40, gapTarget: -13.5, gapNat: 13.9, nat: 47.6 } };
  assert.match(statusReason(a), /^דורש טיפול כי חסרות 13.5 נק׳ ליעד משרד הבריאות, אף שהוא טוב מהממוצע הארצי ב-13.9 נק׳ ובשיפור\.$/);
  const worse = { ...a, status: "watch", statusWhy: ["rank", "worsening"], history: { trendClass: "worsening" }, last: { level: 30, gapNat: -2, nat: 60 } };
  assert.ok(!/בשיפור/.test(statusReason(worse)));
});

test("countLabel agrees with the count", async () => {
  const { countLabel, deltaUnit } = await import("../web/js/ui.js");
  assert.equal(countLabel("concern", 1), "דורש טיפול"); assert.equal(countLabel("concern", 10), "דורשים טיפול");
  assert.equal(countLabel("good", 1), "תקין"); assert.equal(countLabel("strength", 1), "חוזק"); assert.equal(countLabel("strength", 4), "חוזקות");
  assert.equal(deltaUnit("%"), " נק׳"); assert.equal(deltaUnit("per100k"), " לכל 100,000"); assert.equal(deltaUnit("index"), "");
});
