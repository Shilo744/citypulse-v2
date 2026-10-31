"use strict";
// One place that talks to the language models (OpenRouter / any OpenAI-compatible endpoint). Two roles:
//   search - cheap and fast (Haiku class): finds and filters things (dataset queries, relevance)
//   reason - strong (Sonnet class): writes the conclusions people read (page plan, answers, the city briefing)
// - the key is read from .dev.vars and never logged; error bodies are scrubbed
// - every call is added to data/cache/llm-usage.json (calls, tokens and dollars, per role)
// - a call is refused while the key's remaining balance (asked from OpenRouter, cached for a minute) is under the reserve,
//   or after too many calls in an hour, so callers fall back to the keyword path instead of draining a shared key
const fs = require("fs");
const path = require("path");
const { request } = require("./http");
const cfg = require("./config");

let ledgerFile = path.join(cfg.CACHE, "llm-usage.json");
const ROLES = ["search", "reason"];
// dollars per million tokens (input, output); used only when the API does not report the cost of a call
const PRICE = { "anthropic/claude-haiku-5.5": [0.1, 0.5], "anthropic/claude-sonnet-5.5": [2, 10] };

const REASON_HEADROOM = 1500;                                       // tokens the strong model may spend thinking, on top of the visible answer
let doRequest = request;
const _setRequest = (fn) => { doRequest = fn || request; };        // tests swap the network and the ledger file out
const _setLedger = (f) => { ledgerFile = f; };
let bal = { at: 0, v: null };
let recent = [];                                                    // timestamps of the calls of the last hour

const readLedger = () => { try { return JSON.parse(fs.readFileSync(ledgerFile, "utf8")); } catch (e) { return {}; } };

function costOf(model, usage) {
  if (usage && typeof usage.cost === "number") return usage.cost;
  const p = PRICE[model] || [1, 5];
  return (((usage && usage.prompt_tokens) || 0) * p[0] + ((usage && usage.completion_tokens) || 0) * p[1]) / 1e6;
}

function record(role, model, usage, cost) {
  try {
    fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });
    const l = readLedger(); l.byRole = l.byRole || {};
    const r = (l.byRole[role] = l.byRole[role] || { calls: 0, prompt: 0, completion: 0, costUsd: 0 });
    const p = (usage && usage.prompt_tokens) || 0, c = (usage && usage.completion_tokens) || 0;
    r.calls += 1; r.prompt += p; r.completion += c; r.costUsd = Math.round((r.costUsd + cost) * 1e6) / 1e6; r.model = model;
    l.calls = (l.calls || 0) + 1; l.prompt = (l.prompt || 0) + p; l.completion = (l.completion || 0) + c;
    l.costUsd = Math.round(((l.costUsd || 0) + cost) * 1e6) / 1e6; l.updated = new Date().toISOString();
    fs.writeFileSync(ledgerFile, JSON.stringify(l));
  } catch (e) { /* the ledger is a convenience */ }
}

// what is left on the key: { limit, usage, remaining } or null when unknown
async function balance(force) {
  if (!cfg.llm.key) return null;
  if (!force && Date.now() - bal.at < 60000) return bal.v;
  try {
    const r = await doRequest(`${cfg.llm.baseUrl}/key`, { method: "GET", timeout: 15000, headers: { Authorization: `Bearer ${cfg.llm.key}` } });
    const d = (JSON.parse(r.body.toString("utf8")) || {}).data || {};
    bal = { at: Date.now(), v: { limit: d.limit ?? null, usage: d.usage ?? null, remaining: d.limit_remaining ?? null } };
  } catch (e) { bal = { at: Date.now(), v: null }; }
  return bal.v;
}

async function guard() {
  const now = Date.now();
  recent = recent.filter((t) => now - t < 3600e3);
  if (recent.length >= cfg.llm.maxPerHour) throw new Error("LLM hourly call limit reached");
  const b = await balance();
  if (b && b.remaining != null && b.remaining < cfg.llm.reserveUsd) throw new Error(`LLM balance is under the reserve (${b.remaining.toFixed(2)} left)`);
}

// true while a call may be tried (key present, and the last balance check did not say "under the reserve")
const available = () => !!cfg.llm.key && !(bal.v && bal.v.remaining != null && bal.v.remaining < cfg.llm.reserveUsd) && recent.filter((t) => Date.now() - t < 3600e3).length < cfg.llm.maxPerHour;
const modelFor = (role) => cfg.llm.models[role];

// messages: [{role, content}] -> { text, usage, costUsd, model, role }
async function chat(messages, { role = "reason", maxTokens = 1200, temperature = 0.2, timeout = 90000 } = {}) {
  if (!cfg.llm.key) throw new Error("LLM not configured");
  if (!ROLES.includes(role)) throw new Error("unknown LLM role " + role);
  await guard();
  const model = modelFor(role);
  // the strong role cannot switch reasoning off (the endpoint refuses), so it runs at low effort and gets headroom for the thinking tokens
  const body = JSON.stringify({ model, messages, max_tokens: maxTokens + (role === "reason" ? REASON_HEADROOM : 0), temperature, usage: { include: true }, reasoning: { effort: role === "reason" ? "low" : "none" } });
  recent.push(Date.now());
  const r = await doRequest(`${cfg.llm.baseUrl}/chat/completions`, {
    method: "POST", timeout,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.llm.key}`, "X-Title": "CityPulse V2", "Content-Length": Buffer.byteLength(body) },
    body
  });
  const raw = r.body.toString("utf8");
  if (r.status !== 200) throw new Error(`LLM HTTP ${r.status}: ${raw.split(cfg.llm.key).join("[key]").slice(0, 200)}`);
  const j = JSON.parse(raw);
  const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  const used = j.model || model, costUsd = costOf(used, j.usage);
  record(role, used, j.usage, costUsd);
  if (bal.v && bal.v.remaining != null) bal.v.remaining -= costUsd;
  if (!text) throw new Error("LLM returned no text");
  return { text, usage: j.usage || null, costUsd, model: used, role };
}

// the model may wrap JSON in a ```json fence or add a sentence around it
function extractJson(text) {
  const tries = [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (fence) tries.push(fence[1]);
  const obj = text.match(/(\{[\s\S]*\})/);
  if (obj) tries.push(obj[1]);
  tries.push(text);
  for (const t of tries) { try { return JSON.parse(t.trim()); } catch (e) { /* next */ } }
  return null;
}

async function chatJson(messages, opts) {
  const { text, usage, costUsd, model, role } = await chat(messages, opts);
  const json = extractJson(text);
  if (!json) throw new Error("LLM answer was not JSON: " + text.slice(0, 120));
  return { json, usage, costUsd, model, role };
}

const usageSummary = () => ({ ...readLedger(), models: { ...cfg.llm.models }, reserveUsd: cfg.llm.reserveUsd, balance: bal.v });

module.exports = { chat, chatJson, extractJson, available, balance, modelFor, usageSummary, ROLES, _setRequest, _setLedger, _reset: () => { bal = { at: 0, v: null }; recent = []; } };
