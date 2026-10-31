"use strict";
// Paths and settings. Secrets come only from .dev.vars (git-ignored) and are never logged.
const fs = require("fs");
const path = require("path");

const HERE = typeof __dirname === "string" ? __dirname : "/src/lib";          // the Worker bundle has no real directory: the paths are only names there
const ROOT = path.join(HERE, "..", "..");
const DATA = path.join(ROOT, "data");

function readVars(file) {
  const out = {};
  let text = "";
  try { text = fs.readFileSync(file, "utf8"); } catch (e) { return out; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2];
  }
  return out;
}

const vars = readVars(path.join(ROOT, ".dev.vars"));

// The six top-level CSS files that n.html loads, in order.
// /css/n.bundle.css concatenates and inlines all their @imports.
const CSS_BUNDLE_FILES = [
  "css/app.css",
  "css/motion.css",
  "css/layout.css",
  "css/viz.css",
  "css/pages-n.css",
  "css/product.css",
];

module.exports = {
  ROOT,
  DATA,
  RAW: path.join(DATA, "raw"),
  STORE: path.join(DATA, "store"),
  CACHE: path.join(DATA, "cache"),
  WEB: path.join(ROOT, "web"),
  CSS_BUNDLE_FILES,
  FEEDBACK_FILE: process.env.FEEDBACK_FILE || "",
  PORT: Number(process.env.PORT || vars.PORT || 8800),
  SHARE_TARGET: process.env.SHARE_TARGET || vars.SHARE_TARGET || "/n.html",
  // Optional public base URL (e.g. "https://citypulse.example.com"). When set,
  // robots.txt, sitemap.xml, and share pages use it instead of the Host header.
  PUBLIC_BASE_URL: (process.env.PUBLIC_BASE_URL || vars.PUBLIC_BASE_URL || "").replace(/\/$/, ""),
  llm: {
    key: vars.LLM_API_KEY || "",
    baseUrl: vars.LLM_BASE_URL || "https://openrouter.ai/api/v1",
    // two roles: "search" finds and filters things (Haiku class), "reason" writes the conclusions people read (Sonnet class)
    models: {
      search: vars.LLM_MODEL_SEARCH || "anthropic/claude-haiku-5.5",
      reason: vars.LLM_MODEL_REASON || "anthropic/claude-sonnet-5.5"
    },
    reserveUsd: Number(vars.LLM_RESERVE_USD || 0.3),      // calls stop while the key has less than this left
    maxPerHour: Number(vars.LLM_MAX_PER_HOUR || 40)       // and never more than this many calls in an hour
  }
};

// The Worker has no .dev.vars: its settings arrive as bindings (secrets and plain variables). Called with them once per request; a missing value changes nothing.
module.exports.configure = function configure(env = {}) {
  const v = (k) => (typeof env[k] === "string" ? env[k].trim() : "");
  const c = module.exports, l = c.llm;
  if (v("LLM_API_KEY")) l.key = v("LLM_API_KEY");
  if (v("LLM_BASE_URL")) l.baseUrl = v("LLM_BASE_URL");
  if (v("LLM_MODEL_SEARCH")) l.models.search = v("LLM_MODEL_SEARCH");
  if (v("LLM_MODEL_REASON")) l.models.reason = v("LLM_MODEL_REASON");
  if (v("LLM_RESERVE_USD")) l.reserveUsd = Number(v("LLM_RESERVE_USD"));
  if (v("LLM_MAX_PER_HOUR")) l.maxPerHour = Number(v("LLM_MAX_PER_HOUR"));
  if (v("PUBLIC_BASE_URL")) c.PUBLIC_BASE_URL = v("PUBLIC_BASE_URL").replace(/\/$/, "");
  if (v("SHARE_TARGET")) c.SHARE_TARGET = v("SHARE_TARGET");
};
