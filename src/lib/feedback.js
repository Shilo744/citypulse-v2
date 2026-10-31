"use strict";
/**
 * Feedback store: append-only JSONL log with in-memory rate limiting.
 *
 *   createFeedbackStore({ file, maxBytes, limitPerHour })
 *
 * file        – path to the .jsonl file (created on first write)
 * maxBytes    – refuse writes once the file reaches this size (default 5 MB)
 * limitPerHour – max submissions per IP per hour, in-memory only (default 5)
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_LIMIT_PER_HOUR = 5;

// Strip ASCII control characters (0x00-0x1F, 0x7F) except tab, LF, CR,
// plus Unicode bidi-override and line/paragraph separator characters:
//   U+202A–U+202E (LRE, RLE, PDF, LRO, RLO)
//   U+2066–U+2069 (LRI, RLI, FSI, PDI)
//   U+2028 (line separator), U+2029 (paragraph separator)
function stripControls(s) {
  return String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u202A-\u202E\u2028\u2029\u2066-\u2069]/g, "");
}

function isValidEmail(s) {
  // simple but sufficient: local@domain.tld
  return /^[^\s@]{1,100}@[^\s@]{1,100}\.[^\s@]{1,50}$/.test(s);
}

/**
 * Validate and sanitise the incoming request body.
 * Returns { ok: true, record } or { ok: false, status, error }.
 */
function validate(body) {
  if (!body || typeof body !== "object") return { ok: false, status: 400, error: "body must be a JSON object" };

  // message – required, 1–2000 chars
  if (typeof body.message !== "string") return { ok: false, status: 400, error: "message is required" };
  const message = stripControls(body.message).trim();
  if (message.length < 1) return { ok: false, status: 400, error: "message must not be empty" };
  if (message.length > 2000) return { ok: false, status: 400, error: "message too long (max 2000)" };

  // email – optional
  let email = null;
  if (body.email !== undefined && body.email !== null && body.email !== "") {
    if (typeof body.email !== "string") return { ok: false, status: 400, error: "email must be a string" };
    email = stripControls(body.email).trim();
    if (email.length > 200) return { ok: false, status: 400, error: "email too long (max 200)" };
    if (!isValidEmail(email)) return { ok: false, status: 400, error: "email is not valid" };
  }

  // context – optional object (nested) OR flat fields on the body; context wins if both present
  const CONTEXT_FIELDS = ["key", "name", "indicator", "route", "url", "dataDate"];
  let context = null;

  // Validate flat fields first (so non-string flat fields are rejected even when context is also present)
  const flatSource = {};
  for (const k of CONTEXT_FIELDS) {
    if (body[k] !== undefined && body[k] !== null && body[k] !== "") {
      if (typeof body[k] !== "string") return { ok: false, status: 400, error: `${k} must be a string` };
      flatSource[k] = stripControls(body[k]).trim();
      if (flatSource[k].length > 300) return { ok: false, status: 400, error: `${k} too long (max 300)` };
    }
  }

  if (body.context !== undefined && body.context !== null) {
    if (typeof body.context !== "object" || Array.isArray(body.context)) return { ok: false, status: 400, error: "context must be an object" };
    context = {};
    for (const k of CONTEXT_FIELDS) {
      if (body.context[k] !== undefined && body.context[k] !== null) {
        if (typeof body.context[k] !== "string") return { ok: false, status: 400, error: `context.${k} must be a string` };
        const v = stripControls(body.context[k]).trim();
        if (v.length > 300) return { ok: false, status: 400, error: `context.${k} too long (max 300)` };
        context[k] = v;
      }
    }
  } else if (Object.keys(flatSource).length > 0) {
    context = flatSource;
  }

  return { ok: true, record: { message, email, context } };
}

function createFeedbackStore({ file, maxBytes = DEFAULT_MAX_BYTES, limitPerHour = DEFAULT_LIMIT_PER_HOUR } = {}) {
  if (!file) throw new Error("feedback store: file is required");

  // in-memory rate limit: Map<ip, timestamp[]>
  const rateMap = new Map();

  function checkRate(ip) {
    const now = Date.now();
    const window = now - 3600e3;
    const hits = (rateMap.get(ip) || []).filter((t) => t > window);
    if (hits.length >= limitPerHour) return false;
    hits.push(now);
    rateMap.set(ip, hits);
    return true;
  }

  /**
   * Submit feedback.
   *
   * @param {object}  body – raw parsed JSON body
   * @param {string}  ip   – caller's IP (never stored)
   * @returns {{ ok: true } | { error: string, status: number }}
   */
  function submit(body, ip) {
    // Validate first — invalid requests must not consume a rate-limit slot.
    const v = validate(body);
    if (!v.ok) return { error: v.error, status: v.status };

    // Rate limit (only counted after validation passes)
    if (!checkRate(ip)) return { error: "too many requests", status: 429 };

    // File size check
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      let size = 0;
      try { size = fs.statSync(file).size; } catch (e) { /* file does not exist yet – size stays 0 */ }
      if (size >= maxBytes) return { error: "feedback log full", status: 503 };
    } catch (e) {
      return { error: "could not access feedback file", status: 503 };
    }

    // Write one JSON line
    const line = JSON.stringify({ ...v.record, at: new Date().toISOString() }) + "\n";
    try {
      fs.appendFileSync(file, line, "utf8");
    } catch (e) {
      return { error: "could not write feedback", status: 503 };
    }

    return { ok: true };
  }

  return { submit };
}

module.exports = { createFeedbackStore, validate };
