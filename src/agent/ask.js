"use strict";
/**
 * The ask-agent: a question asked on the page of a locality in, a tailored page out.
 *   0. other localities named in the question are found by name, in code (towns.js); the page is then their comparison with this one, in a block
 *      and a sentence that the server builds from the data, and the model's own sentence is not used
 *   1. a model (or the keyword fallback) chooses WHICH blocks answer the question - a JSON page spec that names parameters by id
 *   2. spec.js checks every id against the city model and fills in the numbers from the data
 *   3. prose may only contain tokens ({{v:th_mmrv}}) that the server resolves; a model-typed digit makes the text unusable (guard.js)
 *   4. if the model fails, or leaves nothing usable, the keyword planner answers instead, so the user always gets a page
 * If the question needs data the model does not hold, the agent adds links to datasets found on data.gov.il (links only).
 */
const llm = require("../lib/llm");
const { resolve } = require("./spec");
const { expand, explain, plainCodes } = require("./guard");
const { story } = require("../model/recommend");
const fallback = require("./fallback");
const { discover } = require("./discover");
const domains = require("../catalog/domains");
const towns = require("./towns");

const SYSTEM = `You plan a page that answers a question about public health, for the mayor or health officer of the Israeli locality whose page is open.
The system HOLDS official data on every locality of the country (more than a thousand). You see only the indicator list of the open locality, and you choose blocks; the server fills in every number from official data.
When the question names other localities, the server finds them by name, adds their comparison with the open locality as a block of its own with a sentence of its own, and tells you below which ones it found.
You do not see figures. You see which indicators (מדדים) exist for the open locality, with a status and a trend.
Answer in Hebrew. Reply with ONE JSON object and nothing else.

JSON shape:
{ "title": "short Hebrew title",
  "answer": "1-3 Hebrew sentences that answer the question directly",
  "blocks": [ ... up to 7 blocks ... ],
  "followups": ["up to 3 short Hebrew follow-up questions"],
  "search": "optional: short Hebrew query for the national open-data portal, ONLY if the question needs data that is not in the indicator list" }

Block types (use only indicator ids from the list):
 {"type":"kpis","inds":["id",...]}                      latest value, national value, rank, status and sparkline for up to 8 indicators
 {"type":"trend","ind":"id"}                            history of one indicator: city vs national vs similar localities vs target
 {"type":"multi_trend","inds":["id",...]}               several indicators over time
 {"type":"rank","ind":"id","show":"around|top|bottom","n":9}   where the city stands among all localities
 {"type":"compare","inds":["id",...]}                   the open locality against SIMILAR localities that the system picks, the nation and the target (never for localities the question names: the server adds those)
 {"type":"equity","ind":"id"}                           gaps inside the city by sector and by socio-economic level of the area
 {"type":"findings","filter":{"domain":"id","polarity":"concern|strength","indicator":"id","type":"..."},"limit":4}
 {"type":"recs","filter":{"domain":"id","indicator":"id"},"limit":3}   recommended actions that the system derived
 {"type":"table","inds":["id",...]}                     values by year
 {"type":"text","heading":"...","text":"..."}           short explanation

HARD RULES
 - NEVER write a digit in "answer", "title" or any "text". Write every figure with a token that the server resolves:
   {{v:ID}} latest value, {{nat:ID}} national value, {{target:ID}} official target, {{guide:ID}} official guideline of the Ministry of Health or another official body (only for an indicator that has one), {{peer:ID}} similar localities, {{gap:ID}} distance from national,
   {{rank:ID}} and {{of:ID}} place among localities, {{year:ID}} year, {{delta:ID}} change since the first year, {{first:ID}} the first year, {{city}} the locality name.
   Use a token only for an indicator you also show or that is listed. Example: "ב{{city}} החיסון עומד על {{v:th_mmrv}}, מקום {{rank:th_mmrv}} מתוך {{of:th_mmrv}} ישובים."
 - Write ONLY Hebrew. No English words and no Latin letters or codes at all: write the plain Hebrew name (חצבת, חזרת ואדמת; החיסון המחומש), never MMR, MMRV or DTaP. No digits in the title either.
 - The system holds data on ALL localities. NEVER write that it has data on this locality only, that a comparison with another locality is impossible, or that data about another locality is missing. Comparing with a locality that the question names is the server's job (see below).
 - Every token already ends with its unit (%, ל-1,000, שנים, נק׳ for percentage points): never write a unit word after a token. Put a hyphen between a one-letter Hebrew prefix and a token: ב-{{year:ID}}, ו-{{v:ID}}, מ-{{nat:ID}}, ל-{{target:ID}}.
 - VOCABULARY (mandatory): always write "מדד" (plural: מדדים), never "פרמטר" or "פרמטרים". Call a concern-status indicator "דורש טיפול", a watch-status indicator "למעקב", a good-status indicator "טוב", a strength-status indicator "חוזק". Never write "מדאיג", "מדאיגים", "מדאיגה". Never write "אחוזון", "מובהק". Never write "המודל" — refer to this product as "המערכת". To describe a change over time, use only: "השתפר", "הידרדר", "בשיפור", "בהידרדרות", "עולה", "יורד" — never "מחמירה" or any other judgmental term outside this list. Status na means the indicator only describes and does not judge: say only that it rises or falls, never that its trend is good or bad.
 - Do not claim a cause. Say what the data shows. Do not give medical advice.
 - Pick the blocks that answer THIS question; do not dump everything. Start with the most direct block.
 - If the question asks what to do, how to improve, what to start with, or for recommendations, include a "recs" block (filter by the domain or indicator the question names, if any) and say in "answer" that the recommended actions are listed below. The recommendations are produced by the system from the data and from published evidence; never invent actions yourself.
 - If the question is about something that NONE of the listed indicators measures (pharmacies, hospitals, schools, crime, budget, air quality ...), you MUST set "search" to a short Hebrew query, say plainly in "answer" that the system does not hold it yet, and show the closest listed indicators.
 - If the question is not about the health of this locality, answer politely in "answer" that you can help with its public-health indicators, and show "kpis" of the priority indicators.`;

function catalogFor(model) {
  const rows = model.indicators.map((a) => `${a.id} | ${a.domain} | ${plainCodes(a.label)} | unit ${a.unit} | ${a.direction ? a.direction + " is better" : "descriptive"} | years ${a.series[0].year}-${a.last.year} | status ${a.status} | trend ${a.history.trendClass}`);
  const have = new Set(model.indicators.map((a) => a.domain));
  const doms = domains.filter((d) => have.has(d.id)).map((d) => `${d.id}=${d.label}`).join(", ");
  const ft = [...new Set(model.findings.map((f) => f.type))].join(", ");
  return `Locality: ${model.city.name}\nDomains: ${doms}\nFinding types: ${ft}\nParameters available for this locality:\n${rows.join("\n")}`;
}

// what the planner is told about the localities the question names (found by towns.findTowns): the server writes the comparison and its sentence
function townsNote(found) {
  if (!found || !(found.towns.length || found.ambiguous.length || found.noData.length)) return "";
  const lines = ["LOCALITIES NAMED IN THE QUESTION (found by the server, by name; the system holds their data):"];
  for (const t of found.towns) lines.push(`- ${t.name} (key ${t.key})`);
  for (const a of found.ambiguous) lines.push(`- the name "${a.text}" fits several localities (${a.options.slice(0, 4).map((o) => o.name).join(", ")}) and was not guessed`);
  for (const n of found.noData) lines.push(`- ${n.name} (key ${n.key}) is in the list of localities but has no figures`);
  if (found.ignored.length) lines.push(`- past the limit of five localities, left out: ${found.ignored.map((x) => x.name).join(", ")}`);
  if (found.towns.length) lines.push(
    "The server adds, as the first block, the comparison of the open locality with these localities: every figure, who is first in what, and a sentence of its own that REPLACES your \"answer\".",
    "So: set \"answer\" to an empty string; do not use a \"compare\" block for these localities; do not repeat any figure of the comparison; never write that the system has data on the open locality only, that a comparison is impossible, or that data about another locality is missing.",
    "You may add at most two other blocks about the open locality if they add something, and up to three short follow-up questions.");
  return "\n\n" + lines.join("\n");
}

async function planWithModel(model, question, history, found) {
  const msgs = [{ role: "system", content: SYSTEM + "\n\n" + catalogFor(model) + townsNote(found) }];
  for (const h of (history || []).slice(-3)) if (h && h.q) msgs.push({ role: "user", content: String(h.q).slice(0, 300) }, { role: "assistant", content: JSON.stringify({ title: h.title || "", answer: "" }) });
  // choosing blocks from a menu is a small job: the cheap model (Haiku class) plans; the strong one is kept for the city briefing, whose conclusions people read
  msgs.push({ role: "user", content: String(question).slice(0, 500) });
  const { json } = await llm.chatJson(msgs, { role: "search", maxTokens: 1500, temperature: 0.2 });
  delete json.answerResolved;                                   // only server code may set a trusted answer
  if (typeof json.title !== "string" || /[0-9]/.test(json.title)) json.title = "תשובה";
  return json;
}

// One repair attempt for an answer the figure guard rejected (an English word, a typed digit, a token that does not resolve).
// The model sees the reason and rewrites only the sentence; the result goes through the same guard again.
async function repairAnswer(model, question, rejected) {
  const msgs = [
    { role: "system", content: "Rewrite the Hebrew answer so that it passes the rules, and reply with JSON {\"answer\": \"...\"} only. Rules: Hebrew words only (no English words), no digits at all, every figure through a token from this list: {{v:ID}} {{nat:ID}} {{target:ID}} {{guide:ID}} {{peer:ID}} {{gap:ID}} {{rank:ID}} {{of:ID}} {{year:ID}} {{delta:ID}} {{first:ID}} {{city}}. One to three sentences. Use only parameter ids from the list below.\n\n" + catalogFor(model) },
    { role: "user", content: "Question: " + String(question).slice(0, 300) + "\nRejected answer: " + String(rejected).slice(0, 600) + "\nWhy it was rejected: " + explain(rejected, model) }
  ];
  const { json } = await llm.chatJson(msgs, { role: "search", maxTokens: 400, temperature: 0.1 });
  return json && typeof json.answer === "string" ? json.answer : null;
}

// Topics people ask about that the model may not hold. If the question mentions one and the city model has no parameter for it,
// the agent looks for datasets on the open-data portal instead of leaving the question unanswered.
const TOPICS = [
  { re: /בית מרקחת|בתי מרקחת|מרקחת/, query: "בתי מרקחת לפי יישוב", ind: "pharmacies" },
  { re: /בית חולים|בתי חולים|חדר מיון|מיון/, query: "בתי חולים ומיון", ind: "hospital" },
  { re: /רופא|רופאים|רופאי משפחה/, query: "רופאים לפי יישוב", ind: "doctors" },
  { re: /תאונ|פצועים בדרכים|בטיחות בדרכים/, query: "תאונות דרכים עם נפגעים לפי יישוב", ind: "road" },
  { re: /פשיעה|עבריינות|משטרה/, query: "פשיעה לפי יישוב", ind: "crime" },
  { re: /זיהום|איכות (ה)?אוויר|חנקן|חלקיקים/, query: "איכות אוויר", ind: "air" },
  { re: /תקציב|הוצאות העירייה|הוצאות הרשות|מאזן/, query: "דוחות כספיים רשויות מקומיות", ind: "budget" },
  { re: /בתי ספר|תלמידים|בגרות|נשירה/, query: "תלמידים לפי יישוב", ind: "school" },
  { re: /אבטלה|תעסוקה|דורשי עבודה/, query: "דורשי עבודה לפי יישוב", ind: "unemployment" },
  { re: /עוני|קצבאות|ביטוח לאומי|הבטחת הכנסה/, query: "מקבלי קצבאות ביטוח לאומי לפי יישוב", ind: "poverty" },
  { re: /השמנה|משקל|BMI/i, query: "השמנה בקרב תלמידים", ind: "obesity" },
  { re: /סרטן|סוכרת|שבץ|תמותה|תוחלת חיים/, query: "תחלואה ותמותה לפי יישוב", ind: "mortality" }
];
function deriveSearch(q, model) {
  for (const t of TOPICS) if (t.re.test(q) && !model.indicators.some((a) => a.id.includes(t.ind))) return t.query;
  return null;
}

async function answer(store, getModel, { city, question, history } = {}) {
  const q = String(question || "").trim();
  if (!q) throw new Error("empty question");
  const model = getModel(String(city || ""));
  if (!model) throw new Error("locality not found");

  // other localities named in the question (code, no model). When there are some, the page is their comparison with this one, and its sentence is the server's:
  // a model that sees one locality's indicators only has no way to know the system holds the rest, and once wrote that it did not
  const found = towns.findTowns(store, q, model.city.key);
  const withTowns = found.towns.length > 0;
  const unresolved = towns.unresolvedSentence(found, model.city.name);          // names were found, but none can be compared (an ambiguous name, a place without figures)
  const serverSpeaks = withTowns || !!unresolved;

  let spec = null, via = "keywords", note = null;
  if (llm.available()) {
    try { spec = await planWithModel(model, q, history, found); via = "model"; }
    catch (e) { note = "הבינה המלאכותית לא זמינה כרגע, התשובה נבנתה לפי מילות מפתח (" + String(e.message).slice(0, 60) + ")"; }
    // a sentence the server replaces anyway is not worth a second paid call
    if (!serverSpeaks && spec && typeof spec.answer === "string" && spec.answer.trim() && !expand(spec.answer, model)) {
      try { const fixed = await repairAnswer(model, q, spec.answer); spec.answer = fixed && expand(fixed, model) ? fixed : null; } catch (e) { spec.answer = null; }
    }
    if (spec && withTowns) spec = withTownsBlock(spec, found, model, q);
  }
  let page = spec ? resolve(spec, store, model, getModel) : null;
  if (!page || !page.blocks.length) {
    if (spec) note = "הבינה המלאכותית לא החזירה תכנית שאפשר להציג, התשובה נבנתה לפי מילות מפתח";
    spec = fallback.plan(model, q, { found }); via = "keywords"; page = resolve(spec, store, model, getModel);
  }
  if (withTowns && !page.blocks.some((b) => b.type === "towns")) {               // the named localities have no figures to set against this one
    page.answer = towns.unresolvedSentence({ towns: [], ambiguous: found.ambiguous, noData: [...found.noData, ...found.towns.map((t) => ({ key: t.key, name: t.name }))] }, model.city.name);
  } else if (unresolved) page.answer = unresolved;

  let sources = null;
  const query = (spec.search && typeof spec.search === "string" && spec.search) || deriveSearch(q, model);
  if (query) {
    try { sources = await discover(q, query); } catch (e) { sources = null; }
    if (sources && sources.length) page.blocks.push({ type: "sources", title: "נתונים שחסרים במערכת: מערכי נתונים שנמצאו ב-data.gov.il", note: "קישורים בלבד. המערכת אינה מציגה מספרים ממקורות שלא נבדקו.", items: sources });
  }

  // a model answer that failed the figure check even after the repair is dropped; the page then leads with the history of the
  // parameters it shows, or with its most relevant finding, instead of a blank
  if (!page.answer) page.answer = fallbackLead(page, model);
  return { question: q, via, note, city: { key: model.city.key, name: model.city.name }, page };
}

// the model chose the blocks and the follow-ups; the comparison with the named localities comes first, in the server's own block, and the model's sentence goes
function withTownsBlock(spec, found, model, question) {
  const block = towns.blockSpec(found, fallback.topicScope(model, question));
  const rest = (Array.isArray(spec.blocks) ? spec.blocks : []).filter((b) => b && b.type !== "towns" && b.type !== "compare").slice(0, 2);
  return { ...spec, answer: null, answerResolved: null, title: null, blocks: [block, ...rest] };
}

function fallbackLead(page, model) {
  const ids = [];
  for (const b of page.blocks) {
    if (b.type === "trend" && b.ind) ids.push(b.ind.id);
    if (b.type === "multi_trend") ids.push(...(b.items || []).map((i) => i.id));
  }
  const stories = [...new Set(ids)].slice(0, 2).map((id) => model.indicators.find((a) => a.id === id)).filter(Boolean).map(story);
  if (stories.length) return stories.join(" ");
  const f = page.blocks.find((b) => b.type === "findings");
  return f && f.items[0] ? f.items[0].text : null;
}

module.exports = { answer, planWithModel, repairAnswer, catalogFor, townsNote, withTownsBlock, SYSTEM };
