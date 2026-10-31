"use strict";
// Planner that needs no model: reads the question for a topic and an intent, and returns the same page spec a model would.
// It is also the safety net when the model is unavailable or answers badly.
const { byId } = require("../catalog/indicators");
const domains = require("../catalog/domains");
const { unitText, pts, num } = require("../lib/format");
const towns = require("./towns");

const TOPICS = [
  { re: /חצבת|mmr|חזרת|אדמת/i, ind: "th_mmrv" },
  { re: /מחומש|פוליו|דיפתריה|טטנוס/, ind: "th_penta" },
  { re: /שעלת/, ind: "th_pertussis" },
  { re: /הנקה בלעדית|הנקה/, ind: "th_bf_exclusive" },
  { re: /ברזל|אנמיה/, ind: "th_iron" },
  { re: /דיכאון|אחרי לידה|לאחר לידה/, ind: "th_ppd" },
  { re: /אלימות|התעללות/, ind: "th_violence" },
  { re: /ביקור ראשון/, ind: "th_firstvisit" },
  { re: /עריסה|שינה בטוחה/, ind: "th_safesleep" },
  { re: /שפה|תקשורת/, ind: "th_language" },
  { re: /היקף ראש/, ind: "th_headcirc" },
  { re: /בדיקות התפתחות|בדיקת התפתחות/, ind: "th_devtests6" },
  { re: /השמנה|עודף משקל|משקל עודף|bmi/i, ind: "bmi_g1_over" },
  { re: /השמנה|עודף משקל|משקל עודף|bmi/i, ind: "bmi_g7_over" },
  { re: /תוחלת/, ind: "life_expectancy" },
  { re: /תמותת תינוקות|פטירות תינוקות/, ind: "infant_mortality" },
  { re: /תמותה|פטירות|נפטר/, ind: "mortality_std" },
  { re: /סוכרת/, ind: "diabetes_std" },
  { re: /פגיעות ילדים|היפגעות|פציעות ילדים|תאונות ילדים|ילדים.*(פגיעה|פציעה)/, ind: "child_injury_ed_1000" },
  { re: /פגיעות ילדים|היפגעות|פציעות ילדים|תאונות ילדים|ילדים.*(פגיעה|פציעה)/, ind: "child_injury_hosp_1000" },
  { re: /רופא(י)? משפחה|רפואה ראשונית|רופאים בקהילה/, ind: "family_doctors_10k" },
  { re: /רופא(י)? ילדים|רפואת ילדים/, ind: "pediatricians_10k" },
  { re: /המתנה|תורים|תור לרופא|רופא מומחה|רופאים מומחים|מומחים בקהילה/, ind: "wait_specialist_days" },
  { re: /בריאות הנפש|פסיכולוג|פסיכיאטר|טיפול נפשי|מטפלים/, ind: "mental_points_10k" }
];
const DOMAIN_WORDS = [
  { re: /בטיחות|תאונ|פציע|פגיעות|היפגעות/, domain: "safety" },
  { re: /תוחלת|תמותה|פטירות|סוכרת|תוצאות בריאות|מצב הבריאות/, domain: "outcomes" },
  { re: /חיסון|חיסונים|מחוסנ/, domain: "immunization" },
  { re: /הנקה|תזונה|האכלה|השמנה|עודף משקל|משקל עודף|bmi/i, domain: "nutrition" },
  { re: /נפש|דיכאון|חרדה|מצוקה/, domain: "mental" },
  { re: /רווחה|אלימות|נשים/, domain: "welfare" },
  { re: /נגישות|שירות|טיפת חלב|טיפות חלב|תחנה|תחנות|רופא|רופאים|תורים|המתנה|מומחה/, domain: "access" },
  { re: /התפתחות|גדילה|ילדים|פעוטות|תינוקות/, domain: "child" }
];
const INTENT = {
  compare: /השווא|לעומת|דומות|שכנ|בהשוואה|מול ערים|מול ישובים/,
  history: /מגמ|היסטור|עם השנים|שינוי|השתנ|התקדמ|הידרדר|ירידה|עלייה|לאורך/,
  weak: /חלש|בעיה|בעיות|מדאיג|גרוע|נמוך|דחוף|לתקן|כשל|פער/,
  strong: /חזק|טוב|מצטיינ|הצלחה|גאווה|יתרון/,
  recs: /המלצ|מה לעשות|איך משפרים|לשפר|פעולה|תוכנית|צעדים/,
  rank: /דירוג|מקום|בין כל|מתוך|טופ|הכי/,
  equity: /מגזר|ערבי|יהודי|חרדי|שכונ|אזורים|פערים בתוך|בתוך העיר|בתוך היישוב/
};

function domainLabel(id) { const d = domains.find((x) => x.id === id); return d ? d.label : id; }

// the topic a question is about, by keywords: the figures it names and the domains it names. The comparison with other localities is narrowed by it.
function topicScope(model, question) {
  const q = String(question || "");
  const ids = TOPICS.filter((t) => t.re.test(q) && model.indicators.some((a) => a.id === t.ind)).map((t) => t.ind);
  const doms = DOMAIN_WORDS.filter((w) => w.re.test(q)).map((w) => w.domain);
  return ids.length || doms.length ? { ids: [...new Set(ids)], domains: ids.length ? [] : [...new Set(doms)] } : null;
}

// When the question names other localities the page is their comparison with this one: one block, and the sentence is written by the server from its counts.
// found: the result of towns.findTowns
function townsPlan(model, question, found) {
  const spec = towns.blockSpec(found, topicScope(model, question));
  return spec ? {
    title: null, answerResolved: null, blocks: [spec],
    followups: ["איפה היישוב הכי חלש?", "מה השתנה בשנים האחרונות?", "מה כדאי לעשות קודם?"]
  } : null;
}

// ctx: { found }  the localities the question names (towns.findTowns), or { store }  to look for them here
function plan(model, question, ctx = {}) {
  const found = ctx.found || (ctx.store ? towns.findTowns(ctx.store, question, model.city.key) : null);
  const named = townsPlan(model, question, found);
  if (named) return named;
  const q = String(question || "");
  const has = (id) => model.indicators.some((a) => a.id === id);
  const byTopic = TOPICS.filter((t) => t.re.test(q) && has(t.ind)).map((t) => t.ind);
  const domainHits = DOMAIN_WORDS.filter((w) => w.re.test(q)).map((w) => w.domain);
  const intents = Object.keys(INTENT).filter((k) => INTENT[k].test(q));
  const blocks = [];
  let title, answer = null;

  // which parameters the question is about
  let inds = byTopic.slice();
  if (!inds.length && domainHits.length) inds = model.indicators.filter((a) => domainHits.includes(a.domain)).map((a) => a.id);
  const scope = domainHits[0] || (inds[0] ? byId[inds[0]].domain : null);

  if (intents.includes("recs") && !inds.length) {
    title = "מה כדאי לעשות";
    blocks.push({ type: "recs", limit: 5 }, { type: "findings", filter: { polarity: "concern" }, limit: 4 });
  } else if (intents.includes("weak") && !inds.length) {
    title = "איפה היישוב חלש";
    const worst = model.indicators.filter((a) => a.status === "concern" || a.status === "watch").sort((a, b) => b.priority - a.priority).slice(0, 6).map((a) => a.id);
    blocks.push({ type: "kpis", inds: worst }, { type: "findings", filter: { polarity: "concern" }, limit: 5 }, { type: "recs", limit: 3 });
  } else if (intents.includes("strong") && !inds.length) {
    title = "במה היישוב חזק";
    const best = model.indicators.filter((a) => a.status === "strength" || a.status === "good").sort((a, b) => (b.last.level || 0) - (a.last.level || 0)).slice(0, 6).map((a) => a.id);
    blocks.push({ type: "kpis", inds: best }, { type: "findings", filter: { polarity: "strength" }, limit: 5 });
  } else if (intents.includes("history") && !inds.length) {
    title = "מה השתנה לאורך השנים";
    const movers = model.indicators.filter((a) => a.history.delta != null).sort((a, b) => Math.abs(b.history.delta) - Math.abs(a.history.delta)).slice(0, 5).map((a) => a.id);
    blocks.push({ type: "multi_trend", inds: movers }, { type: "findings", filter: { type: "trend_down" }, limit: 4 }, { type: "findings", filter: { type: "trend_up" }, limit: 3 });
  } else if (inds.length) {
    const main = inds[0];
    title = byTopic.length ? byId[main].label : `תחום ${domainLabel(scope)}`;
    blocks.push({ type: "kpis", inds: inds.slice(0, 6) });
    blocks.push({ type: "trend", ind: main });
    if (intents.includes("compare") || intents.includes("rank")) blocks.push({ type: "compare", inds: inds.slice(0, 3) }, { type: "rank", ind: main, show: "around", n: 9 });
    else blocks.push({ type: "rank", ind: main, show: "around", n: 9 });
    if (intents.includes("equity") || model.indicators.find((a) => a.id === main).equity.sector) blocks.push({ type: "equity", ind: main });
    blocks.push({ type: "findings", filter: byTopic.length ? { indicator: main } : { domain: scope }, limit: 4 });
    if (intents.includes("recs") || intents.includes("weak")) blocks.push({ type: "recs", filter: byTopic.length ? { indicator: main } : { domain: scope }, limit: 3 });
    const a = model.indicators.find((x) => x.id === main);
    if (a) {
      const L = a.last;
      answer = `${model.city.name}: ${a.short} ${unitText(a.unit, L.v)} ב-${L.year}` + (L.nat != null ? `, לעומת ${unitText(a.unit, L.nat)} בממוצע הארצי (${L.gapNat >= 0 ? "מעל" : "מתחת"} ב-${pts(L.gapNat)})` : "") +
        (L.rank ? `, מקום ${L.rank} מתוך ${L.of} ישובים` : "") + ".";
    }
  } else if (intents.includes("compare")) {
    title = "השוואה לישובים דומים";
    const top = model.indicators.filter((a) => a.direction).sort((a, b) => b.importance - a.importance).slice(0, 4).map((a) => a.id);
    blocks.push({ type: "compare", inds: top }, { type: "findings", filter: { polarity: "concern" }, limit: 3 });
  } else {
    title = "תמונת מצב";
    blocks.push({ type: "kpis", inds: model.priorities.slice(0, 6) }, { type: "findings", limit: 5 }, { type: "recs", limit: 3 });
  }

  return {
    title, answerResolved: answer, blocks,
    followups: ["איפה היישוב הכי חלש?", "איך המצב לעומת ישובים דומים?", "מה השתנה בשנים האחרונות?", "מה כדאי לעשות קודם?"]
  };
}

module.exports = { plan, topicScope, townsPlan };
