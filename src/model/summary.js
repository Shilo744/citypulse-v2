"use strict";
// The "state of the city" in a few lines, assembled from the findings. Deterministic and every number comes from the data.
// (An optional model pass may reword it, but only after a number check - see src/agent/guard.js.)
const domains = require("../catalog/domains");
const { num, I, unitText } = require("../lib/format");

const dLabel = Object.fromEntries(domains.map((d) => [d.id, d.label]));

function summarize(model) {
  if (!model || !model.indicators.length) return null;
  const c = model.counts, name = model.city.name, years = model.years;
  const lines = [];
  lines.push({ kind: "basis", text: `התמונה מבוססת על ${I(model.coverage.have)} מדדים מנתונים רשמיים, לשנים ${I(years.from + "–" + years.to)}, בהשוואה לכל היישובים בארץ, ליישובים דומים וליעדי משרד הבריאות.` });
  // context: who lives here (size, socio-economic cluster of the CBS, child poverty), so that no figure below is read without it
  const bits = [], city = model.city, pov = model.indicators.find((a) => a.id === "pov_children");
  if (city.population) bits.push(`אוכלוסייה ${num(city.population, 0)}`);
  if (city.sesCluster) bits.push(`אשכול חברתי-כלכלי ${I(city.sesCluster)} מתוך ${I(10)} (1 = הנמוך ביותר)`);
  if (pov) bits.push(`עוני ילדים ${unitText("%", pov.last.v)}` + (pov.last.nat != null ? ` (הארץ ${unitText("%", pov.last.nat)})` : "") + ` ב-${I(pov.last.year)}`);
  if (bits.length) lines.push({ kind: "context", text: "הקשר: " + bits.join(", ") + "." });
  const good = c.strength + c.good, judged = c.concern + c.watch + good;
  const many = (n, one, plural) => (n === 1 ? one : `${I(n)} ${plural}`);
  lines.push({ kind: "state", text: (judged ? `${many(c.concern, "מדד אחד דורש טיפול", "מדדים דורשים טיפול")}, ${many(c.watch, "אחד למעקב", "למעקב")}, ${many(good, "אחד תקין או חוזק", "תקינים או חוזקות")}.` : "אף מדד אינו נשפט כטוב או רע: הקבוצות קטנות מדי, או שהמדדים מתארים בלבד.") + (c.stale ? ` ${many(c.stale, "מדד אחד ישן (שנתיים ומעלה) מוצג", "מדדים ישנים (שנתיים ומעלה) מוצגים")} בלי להשפיע על המסקנות.` : "") });     // the same words as the status chips on the screen

  const concerns = model.findings.filter((f) => f.polarity === "concern" && f.indicator);
  const seen = new Set(), top = [];
  for (const f of concerns) { if (seen.has(f.indicator)) continue; seen.add(f.indicator); top.push(f); if (top.length === 3) break; }
  top.forEach((f) => lines.push({ kind: "concern", text: f.text, finding: f.id }));

  const strengths = model.findings.filter((f) => f.polarity === "strength" && f.indicator);
  const seenS = new Set(), tops = [];
  for (const f of strengths) { if (seenS.has(f.indicator)) continue; seenS.add(f.indicator); tops.push(f); if (tops.length === 2) break; }
  tops.forEach((f) => lines.push({ kind: "strength", text: f.text, finding: f.id }));

  const down = model.indicators.filter((a) => a.history.trendClass === "worsening").length;
  const up = model.indicators.filter((a) => a.history.trendClass === "improving").length;
  if (down || up) lines.push({ kind: "history", text: `לאורך השנים (מ-${I(years.from)}): ${up ? many(up, "מדד אחד בשיפור", "מדדים בשיפור") : "אף מדד לא בשיפור"}, ${down ? many(down, "מדד אחד בהידרדרות", "מדדים בהידרדרות") : "אף מדד לא בהידרדרות"}.` });

  const eq = model.findings.find((f) => f.type.startsWith("equity_"));
  if (eq) lines.push({ kind: "equity", text: eq.text, finding: eq.id });

  const weakDomain = model.domains.filter((d) => d.standing != null).sort((a, b) => a.standing - b.standing)[0];
  const headline = !judged ? `${name}: אין מספיק נתונים אמינים כדי לשפוט את מצב הבריאות.`
    : c.concern >= 3 && weakDomain
    ? `${name}: ${I(c.concern)} מדדים דורשים טיפול, והתחום החלש ביותר הוא ${dLabel[weakDomain.id]}.`
    : c.concern > 0 ? `${name}: תמונה מעורבת, ${c.concern === 1 ? "מדד אחד דורש" : I(c.concern) + " מדדים דורשים"} טיפול${good ? ` ו-${I(good)} ${good === 1 ? "תקין או חוזק" : "תקינים או חוזקות"}` : ""}.`
    : `${name}: אין מדד שדורש טיפול, ${I(good)} ${good === 1 ? "מדד תקין או חוזק" : "מדדים תקינים או חוזקים"}.`;
  return { headline, lines };
}

module.exports = { summarize };
