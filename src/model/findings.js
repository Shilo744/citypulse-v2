"use strict";
/**
 * Turns the analysis of each indicator into FINDINGS: typed facts with a polarity (concern / strength / info), a severity and a sentence.
 * The sentence is built here from the numbers, so no model ever types a figure. Recommendations point back to finding ids.
 */
const { num, pct, abs, pts, I, unitText, deltaText } = require("../lib/format");
const { byId } = require("../catalog/indicators");
const { EQUITY_GAP, EQUITY_Z, RULES } = require("./analyze");
const { targetWho } = require("./guide");

const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const unit = (a, v) => unitText(a.unit, v);

function make(a, type, polarity, severity, facts, text) {
  return { id: `${a.id}:${type}`, type, polarity, indicator: a.id, domain: a.domain, severity: Math.round(clamp(severity) * 10) / 10, facts, text };
}

function findingsFor(a) {
  const out = [];
  if (a.stale) return out;                       // a figure two or more years old is shown, but it does not drive conclusions
  const ind = byId[a.id], L = a.last, H = a.history, imp = a.importance / 5;
  const yr = L.year, label = a.label;

  // a figure on too few cases gets a note and nothing else: its rank, its gap to the target and its trend would all be noise
  if (!L.reliable)
    return [make(a, "small_numbers", "info", 5, { year: yr, d: L.d, minBase: ind.minBase },
      `${label}: קבוצה קטנה (${num(L.d, 0)} ${ind.noun || ""}), לכן המספר לא יציב. הוא מוצג, אבל אינו נכלל בדירוג ובמסקנות.`)];

  // 1. where it stands among all localities
  if (L.rank != null && a.direction) {
    if (a.status === "concern" && L.level < 25)
      out.push(make(a, "level_low", "concern", (100 - L.level) * 0.9 * imp + 10, { year: yr, v: L.v, nat: L.nat, rank: L.rank, of: L.of },
        `${label}: ${unit(a, L.v)} ב-${I(yr)}, מקום ${I(L.rank)} מתוך ${I(L.of)} יישובים` + (L.nat != null ? ` (הממוצע הארצי ${unit(a, L.nat)})` : "") + "."));
    if (L.level >= 75 && H.trendClass !== "worsening")
      out.push(make(a, "level_high", "strength", L.level * 0.5 * imp, { year: yr, v: L.v, nat: L.nat, rank: L.rank, of: L.of },
        `${label}: ${unit(a, L.v)} ב-${I(yr)}, מקום ${I(L.rank)} מתוך ${I(L.of)} יישובים` + (L.nat != null ? ` (הממוצע הארצי ${unit(a, L.nat)})` : "") + "."));
  }

  // 2. against the official target (only a target of the same measure in the same unit: guide.judges; a reference figure of other countries never)
  const G = a.guide && a.guide.judges && a.guide.gap != null ? a.guide : null;
  if (G) {
    const who = targetWho(G), side = G.direction === "atLeast" ? "מתחת" : "מעל";
    const size = a.unit === "%" ? Math.abs(G.gap) : Math.abs(G.relGap || 0) * 100;           // points, or the percent of the target for any other unit
    if (!G.meets) {
      const natOff = L.nat != null && (G.direction === "atLeast" ? L.nat < G.value : L.nat > G.value);
      out.push(make(a, "below_target", "concern", clamp(size * 2.2, 8, 90) * imp + 5, { year: yr, v: L.v, target: G.value, gap: G.gap, nat: L.nat },
        `${label}: ${unit(a, L.v)} ב-${I(yr)}, ${deltaText(a.unit, G.gap)} ${side} ל${who} (${unit(a, G.value)})` + (natOff ? `. גם הממוצע הארצי (${unit(a, L.nat)}) ${side} ליעד` : "") + "."));
    } else {
      // the status says תקין even in the lower half of the localities when the target is met: the sentence says so, so that the reader sees why
      const lower = L.level != null && L.level < RULES.goodLevel && L.rank != null ? `, אף שהמקום בין היישובים נמוך יותר (מקום ${I(L.rank)} מתוך ${I(L.of)})` : "";
      out.push(make(a, "meets_target", "strength", 25 * imp, { year: yr, v: L.v, target: G.value },
        `${label}: ${unit(a, L.v)} ב-${I(yr)}, עומד ב${who} (${unit(a, G.value)})${lower}.`));
    }
  }

  // 3. history: direction and pace, set against what happened nationally
  if (H.trendClass === "worsening" || H.trendClass === "improving") {
    const worse = H.trendClass === "worsening";
    const natNote = H.natDelta != null ? `, לעומת ${H.natDelta === 0 ? "יציבות" : (H.natDelta > 0 ? "עלייה" : "ירידה") + " של " + deltaText(a.unit, H.natDelta)} בממוצע הארצי` : "";
    const move = I(`${H.first.year}–${yr}`);
    out.push(make(a, worse ? "trend_down" : "trend_up", worse ? "concern" : "strength",
      worse ? clamp(Math.abs(H.delta) * 3.5, 10, 80) * imp + 5 : clamp(Math.abs(H.delta) * 2, 5, 50) * imp,
      { from: H.first, to: { year: yr, v: L.v }, delta: H.delta, slope: H.slope, natDelta: H.natDelta, projection: H.projection },
      `${label}: ${worse ? "הידרדרות" : "שיפור"} של ${deltaText(a.unit, H.delta)} (${move}), מ-${unit(a, H.first.v)} ל-${unit(a, L.v)}${natNote}.`));
    if (H.gapMove != null && Math.abs(H.gapMove) >= 3 && L.gapNat != null) {
      const closing = H.gapMove > 0;
      out.push(make(a, closing ? "gap_closing" : "gap_widening", closing ? "strength" : "concern", closing ? 15 * imp : clamp(Math.abs(H.gapMove) * 3, 8, 60) * imp,
        { gapMove: H.gapMove, gapNow: L.gapNat },
        closing ? `${label}: היישוב מצמצם את הפער מהממוצע הארצי ב-${deltaText(a.unit, H.gapMove)} מאז ${I(H.first.year)}.`
                : `${label}: הפער מהממוצע הארצי מתרחב ב-${deltaText(a.unit, H.gapMove)} מאז ${I(H.first.year)}.`));
    }
  }

  // 4. equity inside the city
  for (const [field, name] of [["sector", "בין מגזרים"], ["ses", "בין אזורים לפי רמה חברתית-כלכלית"]]) {
    const e = a.equity[field];
    if (e && e.gap >= EQUITY_GAP && e.z >= EQUITY_Z && a.direction && !a.stale) {
      const hi = e.rows.find((r) => r.id === e.hi), lo = e.rows.find((r) => r.id === e.lo);
      out.push(make(a, `equity_${field}`, "concern", clamp(e.gap * 1.2, 10, 80) * imp + 5,
        { year: yr, gap: e.gap, hi: { label: hi.label, v: hi.v, d: hi.d }, lo: { label: lo.label, v: lo.v, d: lo.d } },
        `${label}: פער של ${pts(e.gap)} ${name} בתוך היישוב ב-${I(yr)}: ${hi.label} ${unit(a, hi.v)} (${num(hi.d, 0)} ${ind.noun || ""}) מול ${lo.label} ${unit(a, lo.v)} (${num(lo.d, 0)} ${ind.noun || ""}).`));
    }
  }

  if (a.baseShift != null)
    out.push(make(a, "base_shift", "info", 12, { year: yr, shiftPct: a.baseShift },
      `${label}: גודל הקבוצה ב-${I(yr)} ${a.baseShift > 0 ? "גדל" : "קטן"} ב-${I(Math.abs(a.baseShift) + "%")} לעומת השנים הקודמות (בהשוואה לשינוי הארצי). ייתכן שינוי באוכלוסייה או בדיווח, ולכן מגמות מול השנים הקודמות דורשות זהירות.`));

  return out;
}

// patterns across several indicators of the same domain
function domainFindings(analyses, domains) {
  const out = [];
  for (const d of domains) {
    const list = analyses.filter((a) => a.domain === d.id && a.direction && a.last.reliable);
    if (list.length < 3) continue;
    const bad = list.filter((a) => a.status === "concern" || a.status === "watch");
    const worsening = list.filter((a) => a.history.trendClass === "worsening");
    if (bad.length >= 3 && bad.length / list.length >= 0.6)
      out.push({ id: `${d.id}:domain_weak`, type: "domain_weak", polarity: "concern", indicator: null, domain: d.id,
        severity: Math.min(85, 40 + bad.length * 8), facts: { count: bad.length, of: list.length, ids: bad.map((a) => a.id) },
        text: `${d.label}: ${I(bad.length)} מתוך ${I(list.length)} המדדים בתחום דורשים טיפול או מעקב. דפוס כזה מצביע על בעיה במערך השירות ולא רק על מדד בודד.` });
    if (worsening.length >= 3)
      out.push({ id: `${d.id}:domain_declining`, type: "domain_declining", polarity: "concern", indicator: null, domain: d.id,
        severity: Math.min(90, 45 + worsening.length * 9), facts: { count: worsening.length, of: list.length, ids: worsening.map((a) => a.id) },
        text: `${d.label}: ${I(worsening.length)} מדדים בתחום בהידרדרות לאורך השנים. הירידה רחבה, לא נקודתית.` });
  }
  return out;
}

function buildFindings(analyses, domains) {
  const all = analyses.flatMap(findingsFor).concat(domainFindings(analyses, domains));
  return all.sort((x, y) => y.severity - x.severity);
}

module.exports = { buildFindings, findingsFor };
