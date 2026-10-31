"use strict";
// Number formatting for sentences. Every number the product shows in text is produced here, from data, never typed by a model.
// Each number is wrapped in a left-to-right isolate (U+2066 ... U+2069), so "67.6%" or "2020–2024" keep their order inside Hebrew text.
const I = (x) => "⁦" + x + "⁩";
const nf = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
const ok = (v) => v != null && isFinite(v);

const num = (v, d = 1) => (ok(v) ? I(nf(v, d)) : "—");
const pct = (v, d = 1) => (ok(v) ? I(nf(v, d) + "%") : "—");
const abs = (v, d = 1) => (ok(v) ? I(nf(Math.abs(v), d)) : "—");
// "5.6 נק׳" - percentage points
const pts = (v, d = 1) => (ok(v) ? I(nf(Math.abs(v), d)) + " נק׳" : "—");
const unitText = (unit, v, d = 1) => {
  if (!ok(v)) return "—";
  if (unit === "%") return pct(v, d);
  if (unit === "per1000") return num(v, d) + " ל-1,000";
  if (unit === "per10k") return num(v, d) + " ל-10,000";
  if (unit === "per100k") return num(v, d) + " ל-100,000";
  if (unit === "ils") return I("₪" + nf(v, 0));
  if (unit === "years") return num(v, d) + " שנים";
  if (unit === "days") return num(v, d) + " ימים";
  return num(v, d);
};

// a difference between two values of one parameter: "5.6 נק׳" for percentages, "2.1 ל-1,000" for rates, a plain number otherwise
const deltaText = (unit, v, d = 1) => {
  if (!ok(v)) return "—";
  if (unit === "%") return pts(v, d);
  if (unit === "per1000") return num(Math.abs(v), d) + " ל-1,000";
  if (unit === "per10k") return num(Math.abs(v), d) + " ל-10,000";
  if (unit === "per100k") return num(Math.abs(v), d) + " ל-100,000";
  if (unit === "ils") return I("₪" + nf(Math.abs(v), 0));
  if (unit === "years") return num(Math.abs(v), d) + " שנים";
  if (unit === "days") return num(Math.abs(v), d) + " ימים";
  return num(Math.abs(v), d);
};

module.exports = { I, num, pct, abs, pts, unitText, deltaText };
