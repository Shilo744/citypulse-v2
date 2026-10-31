// Usage guard for the overnight build: node ops/usage_check.cjs [weeklyLimitPercent=80]
// Reads data/usage_latest.json written by ops/usage_probe.cjs (the Claude Code status line command).
// Exit codes: 0 = below the limit, 3 = at or above the limit (STOP), 4 = unknown or stale reading.
const fs = require("fs");
const path = require("path");

const LIMIT = Number(process.argv[2] || 80);
const STALE_MIN = 20;
const FILE = path.join(process.env.USAGE_DATA_DIR || path.join(__dirname, "..", "data"), "usage_latest.json");

function span(sec) {
  if (!(sec > 0)) return "-";
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m + "m";
}

let rec = null;
try { rec = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { /* handled below */ }
if (!rec) {
  console.log("UNKNOWN: no reading yet (" + FILE + "). The status line probe has not run, or this account exposes no rate limits.");
  process.exit(4);
}
const ageMin = (Date.now() - rec.at) / 60000;
const wk = rec.seven_day, h5 = rec.five_hour;
const now = Date.now() / 1000;
const parts = [
  "weekly " + (wk ? wk.used.toFixed(1) + "% (limit " + LIMIT + "%, resets in " + span(wk.resets_at - now) + ")" : "?"),
  "5h " + (h5 ? h5.used.toFixed(1) + "% (resets in " + span(h5.resets_at - now) + ")" : "?"),
  "reading " + ageMin.toFixed(1) + " min old",
];
if (!wk) { console.log("UNKNOWN: " + parts.join(" | ") + " | no weekly window in the data"); process.exit(4); }
if (ageMin > STALE_MIN) { console.log("UNKNOWN: " + parts.join(" | ") + " | stale (> " + STALE_MIN + " min)"); process.exit(4); }
if (wk.used >= LIMIT) { console.log("STOP: " + parts.join(" | ")); process.exit(3); }
console.log("OK: " + parts.join(" | "));
