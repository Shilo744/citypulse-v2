"use strict";
/**
 * The city briefing: what a mayor or health officer reads first. A model (the "reason" role: Haiku class unless LLM_MODEL_REASON names a stronger one) connects the evidence into a
 * few plain Hebrew points. It sees statuses, trends and gaps but no figures; every number in its text is a token that the server
 * resolves (the guard of the ask-agent), and a text that breaks the rules gets one repair attempt and is then dropped.
 * A call costs real money and the data changes only when the store is rebuilt, so the result is cached per locality and store version.
 */
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const llm = require("../lib/llm");
const domains = require("../catalog/domains");
const { expand, explain, plainCodes, FORBIDDEN_RE } = require("./guard");
const { FIGURE_RULES } = require("./rules");

const DIR = path.join(cfg.CACHE, "briefing");
const SAFE_KEY = /^[0-9A-Za-z_-]{1,40}$/;
const MIN_JUDGED = 3;                                   // a briefing needs parameters that are judged good or bad, not only described
const judged = (model) => model.indicators.filter((a) => ["strength", "good", "watch", "concern"].includes(a.status)).length;
const CAUTION = "ההערכה מבוססת על נתונים רשמיים שפורסמו עד לשנים האחרונות. מדדים תיאוריים אינם נשפטים כטוב או רע, וקבוצות קטנות אינן מדורגות.";

const SYSTEM = `You write the executive briefing for the mayor or health officer of ONE Israeli locality, from the data model below.
You do not see figures. For every parameter you see its status, its trend, where it stands against the nation and the target, and whether the findings point to a gap inside the locality. The server fills in every number from official data.
Your job is to connect the evidence into a few plain points that tell a busy reader where the locality stands, what lies behind it and what to start with. Connect parameters that belong together (for example access to services with immunization or early childhood care, road safety with child injuries, waiting times with the number of doctors, gaps between sectors with low coverage). Do not go through the parameters one by one, and do not repeat a point.
Reply with ONE JSON object and nothing else:
{ "headline": "one Hebrew sentence: the overall picture",
  "points": [ { "title": "short Hebrew title", "text": "two or three Hebrew sentences: what the data shows and why it matters", "ids": ["the parameter ids the point rests on"] }, ... 3 to 5 points ],
  "first": "one or two Hebrew sentences: what to start with and why",
  "caution": "one Hebrew sentence on what these data cannot tell" }

${FIGURE_RULES}`;

const domainLabel = (id) => (domains.find((d) => d.id === id) || {}).label || id;

function catalog(model) {
  const eq = new Set(model.findings.filter((f) => f.type.startsWith("equity_")).map((f) => f.indicator));
  const rows = model.indicators.map((a) => {
    const L = a.last;
    const nat = L.gapNat == null ? "n/a" : Math.abs(L.gapNat) < (L.nat ? Math.abs(L.nat) * 0.02 : 0.05) ? "about the same as national" : L.gapNat > 0 ? "above national" : "below national";
    const target = L.target == null ? "no target" : L.meetsTarget ? "meets target" : "below target";
    const place = !a.direction ? "not judged" : L.rank == null ? "not ranked" : L.level >= 75 ? "top quarter" : L.level <= 25 ? "bottom quarter" : "middle";
    return `${a.id} | ${domainLabel(a.domain)} | ${plainCodes(a.label)} | ${a.direction ? a.direction + " is better" : "descriptive"} | status ${a.status} | trend ${a.history.trendClass} | ${nat} | ${target} | place ${place} | gap inside the locality: ${eq.has(a.id) ? "yes" : "no"}`;
  });
  const prio = model.priorities.slice(0, 6).join(", ");
  return `Locality: ${model.city.name}\nParameters (id | domain | label | direction | status | trend | vs nation | vs target | place among localities | gap inside):\n${rows.join("\n")}\nSystem priority order (most pressing first): ${prio}`;
}

// every text goes through the guard; what fails is collected so that one repair call can fix them together
function resolve(json, model) {
  const bad = [];
  const fix = (key, text) => {
    if (text == null || text === "") return null;                      // a missing optional piece is not an error
    const out = expand(text, model); if (out == null) bad.push({ key, text: String(text == null ? "" : text).slice(0, 700), why: explain(text, model) }); return out;
  };
  const ids = new Set(model.indicators.map((a) => a.id));
  const points = (Array.isArray(json.points) ? json.points : []).slice(0, 5).map((p, i) => ({
    title: fix("t" + i, p && p.title), text: fix("p" + i, p && p.text), ids: ((p && p.ids) || []).filter((x) => ids.has(x)).slice(0, 4)
  }));
  return { headline: fix("headline", json.headline), points, first: fix("first", json.first), caution: fix("caution", json.caution), bad };
}

async function repair(model, bad) {
  const msgs = [
    { role: "system", content: "Rewrite each Hebrew text so that it passes the rules, keeping its meaning. Reply with JSON {\"fixed\": {\"<key>\": \"<text>\", ...}} for exactly the keys you were given.\n\n" + FIGURE_RULES + "\n\n" + catalog(model) },
    { role: "user", content: JSON.stringify(bad.map((b) => ({ key: b.key, text: b.text, rejectedBecause: b.why }))) }
  ];
  const { json, costUsd } = await llm.chatJson(msgs, { role: "reason", maxTokens: 900, temperature: 0.1 });
  return { fixed: (json && json.fixed) || {}, costUsd };
}

async function compose(model) {
  if (judged(model) < MIN_JUDGED) throw new Error("not enough data for a briefing");
  const msgs = [{ role: "system", content: SYSTEM + "\n\n" + catalog(model) }, { role: "user", content: `Write the briefing for ${model.city.name}.` }];
  const first = await llm.chatJson(msgs, { role: "reason", maxTokens: 1300, temperature: 0.3 });
  let cost = first.costUsd || 0, r = resolve(first.json || {}, model);
  if (r.bad.length) {                                                    // one repair attempt for everything that failed the guard
    try {
      const rep = await repair(model, r.bad); cost += rep.costUsd || 0;
      const patch = { ...first.json, points: (first.json.points || []).map((p) => ({ ...p })) };
      for (const [k, v] of Object.entries(rep.fixed)) {
        if (k === "headline" || k === "first" || k === "caution") patch[k] = v;
        else { const m = /^([tp])(\d)$/.exec(k); if (m && patch.points[Number(m[2])]) patch.points[Number(m[2])][m[1] === "t" ? "title" : "text"] = v; }
      }
      r = resolve(patch, model);
    } catch (e) { /* the pieces that failed are dropped below */ }
  }
  const points = r.points.filter((p) => p.text).map((p) => ({ title: p.title || "נקודה למחשבה", text: p.text, ids: p.ids }));
  if (points.length < 2) throw new Error("the model did not return a usable briefing");
  return {
    costUsd: cost, model: llm.modelFor("reason"),
    briefing: { headline: r.headline || (model.summary && model.summary.headline) || null, points, first: r.first || null, caution: r.caution || CAUTION }
  };
}

let io = null;                                                      // the Worker keeps the cache in KV: read(key) and write(key, rec), both synchronous (it loads before and saves after)
const setIO = (x) => { io = x || null; };
const file = (key) => path.join(DIR, key + ".json");
// a briefing written before the guard knew a word ("מדאיגה", "מחמירים") is not served: it counts as not written and is made again on the next request
const hasForbidden = (b) => !!b && FORBIDDEN_RE.test([b.headline, b.first, b.caution, ...(b.points || []).flatMap((p) => [p.title, p.text])].filter(Boolean).join("\n"));
function cached(key, builtAt) {
  if (!SAFE_KEY.test(key)) return null;
  try { const r = io ? io.read(key) : JSON.parse(fs.readFileSync(file(key), "utf8")); if (!r) return null; return r.builtAt === builtAt && !hasForbidden(r.briefing) ? r : null; } catch (e) { return null; }
}

const inflight = new Map();
// returns the cached briefing, or writes a new one (a paid call); concurrent requests for one locality share one call
async function briefing(store, model, { force = false } = {}) {
  const key = String(model.city.key);
  if (!SAFE_KEY.test(key)) throw new Error("bad locality key");
  if (!force) { const c = cached(key, store.builtAt); if (c) return c; }
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const out = await compose(model);
    const rec = { city: { key, name: model.city.name }, builtAt: store.builtAt, at: new Date().toISOString(), ...out };
    try { if (io) io.write(key, rec); else { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(file(key), JSON.stringify(rec)); } } catch (e) { /* the cache is a convenience */ }
    return rec;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

module.exports = { setIO, briefing, cached, hasForbidden, catalog, resolve, compose, SYSTEM, enough: (model) => judged(model) >= MIN_JUDGED };
