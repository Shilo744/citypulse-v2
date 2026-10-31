"use strict";
/**
 * Looking for data the model does not hold. The "search" role (a fast, cheap model) writes a few queries in the words the national
 * open-data portal uses, the portal answers with datasets, and the same cheap model drops the ones that cannot hold locality-level
 * data on the topic. Links only: no figure from a dataset enters the product without a collector that was checked.
 */
const llm = require("../lib/llm");
const { searchDatasets } = require("./tools");
const { hasStrayLatin, plainCodes } = require("./guard");

const Q_SYSTEM = `You help find open datasets on Israel's national data portal (data.gov.il). Given a question about the public health of a locality, write up to 3 short search queries in Hebrew, in the words that dataset titles on the portal use (for example "בתי מרקחת", "איכות אוויר תחנות ניטור", "תקציב רשויות מקומיות"). Reply with JSON only: {"queries": ["...", "..."]}.`;
const J_SYSTEM = `You judge search results. For the question, keep only datasets that plausibly hold data BY LOCALITY (city, town or statistical area) on the topic. Reply with JSON only: {"keep": [{"i": <index>, "why": "<at most 14 Hebrew words, no digits: what the dataset holds>"}]}, best first, at most 5.`;

async function queries(question, hint) {
  if (!llm.available()) return [];
  try {
    const { json } = await llm.chatJson([{ role: "system", content: Q_SYSTEM }, { role: "user", content: "Question: " + question.slice(0, 300) + (hint ? "\nA first query: " + hint : "") }], { role: "search", maxTokens: 200, temperature: 0 });
    return ((json && json.queries) || []).filter((q) => typeof q === "string" && q.trim()).map((q) => q.trim().slice(0, 80)).slice(0, 3);
  } catch (e) { return []; }
}

// -> [{ title, org, url, resources, modified, why? }]
async function discover(question, hint) {
  const q = String(question || "");
  const qs = [...new Set([hint, ...(await queries(q, hint))].filter(Boolean))].slice(0, 4);
  const seen = new Map();
  for (const text of qs) { try { for (const d of await searchDatasets(text, 6)) if (!seen.has(d.url)) seen.set(d.url, d); } catch (e) { /* the portal may be slow */ } }
  const cand = [...seen.values()].slice(0, 14);
  if (!cand.length || !llm.available()) return cand.slice(0, 5);
  try {
    const list = cand.map((d, i) => `${i}. ${d.title} (${d.org || "?"}, ${d.resources} resources)`).join("\n");
    const { json } = await llm.chatJson([{ role: "system", content: J_SYSTEM }, { role: "user", content: "Question: " + q.slice(0, 300) + "\nResults:\n" + list }], { role: "search", maxTokens: 500, temperature: 0 });
    const keep = ((json && json.keep) || []).map((k) => {
      const d = cand[Number(k && k.i)]; if (!d) return null;
      const why = typeof k.why === "string" && !/[0-9]/.test(k.why) && !hasStrayLatin(k.why) ? plainCodes(k.why).trim().slice(0, 120) : null;
      return why ? { ...d, why } : { ...d };
    }).filter(Boolean).slice(0, 5);
    return keep.length ? keep : cand.slice(0, 3);
  } catch (e) { return cand.slice(0, 5); }
}

module.exports = { discover };
