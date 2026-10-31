// Claude Code status line command (see NIGHT_PLAN.md, "USAGE GUARD").
// Claude Code pipes the session JSON to stdin after every assistant message. Only the account-wide rate-limit
// percentages are kept, in data/usage_latest.json (read by ops/usage_check.cjs); nothing else from the payload is stored.
// A short line goes to stdout, which Claude Code shows as the status bar.
const fs = require("fs");
const path = require("path");

const DATA = process.env.USAGE_DATA_DIR || path.join(__dirname, "..", "data");
const LATEST = path.join(DATA, "usage_latest.json");
const LOG = path.join(DATA, "usage_log.jsonl");

function pick(w) {
  return w && typeof w.used_percentage === "number" ? { used: w.used_percentage, resets_at: w.resets_at ?? null } : null;
}
function readPrev() {
  try { return JSON.parse(fs.readFileSync(LATEST, "utf8")); } catch { return null; }
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => { raw += c; });
process.stdin.on("end", () => {
  let line = "usage n/a";
  try {
    const rl = JSON.parse(raw).rate_limits || {};
    const rec = { at: Date.now(), five_hour: pick(rl.five_hour), seven_day: pick(rl.seven_day) };
    if (rec.five_hour || rec.seven_day) {
      fs.mkdirSync(DATA, { recursive: true });
      const prev = readPrev();
      const tmp = LATEST + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(rec));
      fs.renameSync(tmp, LATEST);
      const moved = !prev || Math.abs((rec.seven_day?.used ?? 0) - (prev.seven_day?.used ?? 0)) >= 0.5
        || Math.abs((rec.five_hour?.used ?? 0) - (prev.five_hour?.used ?? 0)) >= 2 || rec.at - prev.at > 10 * 60 * 1000;
      if (moved) fs.appendFileSync(LOG, JSON.stringify({ t: new Date(rec.at).toISOString(), week: rec.seven_day?.used ?? null, h5: rec.five_hour?.used ?? null }) + "\n");
      const f = (w) => (w ? Math.round(w.used) + "%" : "?");
      line = "week " + f(rec.seven_day) + " | 5h " + f(rec.five_hour);
    }
  } catch { /* a status line must never fail loudly */ }
  process.stdout.write(line);
});
