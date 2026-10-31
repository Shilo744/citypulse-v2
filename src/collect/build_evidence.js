"use strict";
// Turns the evidence scout's output (research/evidence-framework.json) into the catalog file the app reads: src/catalog/evidence.json
//   node src/collect/build_evidence.js
//
// The scout only recorded pages it actually opened. This script keeps that guarantee: it drops any intervention or rule
// whose source_url is missing, and it never adds text of its own. Strength labels are the scout's classification
// (Community Guide "strong evidence" -> strong; "sufficient" / USPSTF grade B -> moderate; framework-only -> limited).
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "research", "evidence-framework.json");
const OUT = path.join(__dirname, "..", "catalog", "evidence.json");

// A place is not always a city: these scout sentences say "city" or "municipality" about any locality, so the catalogue reads them as a locality / a local
// authority. Only the wording changes (the same replacements were applied to the committed evidence.json).
const WORDING = [
  ["אלימות במשפחה בעיר.", "אלימות במשפחה ביישוב."],
  ["ברמה העירונית זה יכול להיות", "ברמת הרשות המקומית זה יכול להיות"],
  ["על התערבות עירונית ספציפית", "על התערבות ספציפית של רשות מקומית"],
  ["הראיות לגבי התערבות עירונית ספציפית מוגבלות", "הראיות לגבי התערבות ספציפית של רשות מקומית מוגבלות"]
];
const reword = (text) => WORDING.reduce((t, [a, b]) => t.split(a).join(b), text);

// The framework prose names three things by their letters. A reader gets the names, in the words the research file itself uses:
//  - HP2030: "Healthy People 2030" (the file calls its objectives "יעדים לאומיים אמריקאיים");
//  - CPSTF: "צוות השירותים המונעים האמריקאי", the name the catalogue gives it in indicators.js; the first mention in a text carries the letters in brackets, a text that already
//    spells it out is left alone;
//  - "לפי אחוזוני BMI": the research card of the child overweight measure (cards-cbs.json) says what it is: the body mass index (BMI) of the pupil, above the 85th
//    percentile of the curves of the World Health Organization is overweight, above the 97th is obesity. The sentence says it without the word for a percentile.
const SPELL = [
  [/HP2030/g, () => "Healthy People 2030"],
  [/לפי אחוזוני BMI/g, () => "לפי מדד מסת הגוף (BMI) של התלמיד מול עקומות של ארגון הבריאות העולמי"]
];
const CPSTF_FULL = "צוות השירותים המונעים האמריקאי";
function spell(text) {
  if (typeof text !== "string") return text;
  let t = SPELL.reduce((s, [re, to]) => s.replace(re, to), text);
  if (/CPSTF/.test(t) && !/צוות[^()]*\(CPSTF\)/.test(t)) {
    let first = true;
    t = t.replace(/([ובכלמש]־)?CPSTF/g, (m, pre) => {
      const lead = pre ? pre[0] : "";                       // a prefix letter joins the Hebrew name without the hyphen ("ש־CPSTF" -> "שצוות ...")
      const out = lead + CPSTF_FULL + (first ? " (CPSTF)" : "");
      first = false;
      return out;
    });
  }
  return t;
}
const spellNote = (n) => (n && typeof n.text_he === "string" ? { ...n, text_he: spell(n.text_he) } : n);

function main(dest = OUT) {
  const j = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const interventions = {}, uses = {};
  const parameters = {};

  for (const p of j.parameters) {
    for (const iv of p.interventions || []) {
      if (!iv.source_url) continue;
      interventions[iv.id] = {
        id: iv.id, title: iv.title_he, description: spell(reword(iv.description_he || "")), strength: iv.evidence_strength,
        url: iv.source_url, owner: iv.owner_he || null, cost: iv.typical_cost || null, effectMonths: iv.time_to_effect_months || null
      };
      (uses[iv.id] = uses[iv.id] || []).push(p.id);
    }
    parameters[p.id] = {
      id: p.id, domain: p.domain, label: p.label_he, definition: spell(p.definition_he), unit: p.unit, direction: p.direction,
      target: p.target ? (p.target.note ? { ...p.target, note: spell(p.target.note) } : p.target) : null,
      why: spell(p.why_it_matters_he), interventions: (p.interventions || []).map((x) => x.id),
      frameworks: p.source_frameworks || [], notes: (p.evidence_notes || []).map(spellNote), dataHint: p.data_hint || null
    };
  }
  for (const id of Object.keys(interventions)) interventions[id].parameters = uses[id];

  const rules = {};
  for (const r of j.interpretation_rules) rules[r.id] = { id: r.id, text: reword(r.text_he || ""), url: r.source_url || null };

  const out = {
    generated: new Date().toISOString().slice(0, 10), from: "research/evidence-framework.json",
    interventions, rules, parameters, frameworks: j.frameworks_consulted || []
  };
  fs.writeFileSync(dest, JSON.stringify(out, null, 1));
  console.log(`evidence: ${Object.keys(interventions).length} interventions, ${Object.keys(rules).length} rules, ${Object.keys(parameters).length} parameters, ${out.frameworks.length} frameworks -> ${path.relative(process.cwd(), dest)}`);
}

if (require.main === module) main();
module.exports = { main, spell };
