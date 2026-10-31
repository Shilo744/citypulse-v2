"use strict";
// Small HTTP helpers for collectors: retries, redirects, timeouts, CKAN paging.
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UA = "Mozilla/5.0 (compatible; CityPulse/2.0; +public-health research)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the Worker has no node:https that behaves: it plugs a fetch-based transport in (setTransport) and everything above this line of code stays the same
let transport = null;
const setTransport = (fn) => { transport = fn || null; };
function request(url, opts = {}) { return transport ? transport(url, opts) : nodeRequest(url, opts); }

function nodeRequest(url, { method = "GET", headers = {}, body = null, timeout = 120000, redirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.request(u, { method, headers: { "User-Agent": UA, Accept: "*/*", ...headers }, timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        return resolve(nodeRequest(new URL(res.headers.location, u).href, { method, headers, body, timeout, redirects: redirects - 1 }));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function withRetry(fn, tries = 4) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); } catch (e) { last = e; if (i < tries) await sleep(1500 * i); }
  }
  throw last;
}

async function getJson(url, opts) {
  return withRetry(async () => {
    const r = await request(url, { ...opts, headers: { Accept: "application/json", ...((opts && opts.headers) || {}) } });
    if (r.status !== 200) throw new Error(`HTTP ${r.status} for ${url.slice(0, 120)}`);
    return JSON.parse(r.body.toString("utf8"));
  });
}

async function getBuffer(url, opts) {
  return withRetry(async () => {
    const r = await request(url, opts);
    if (r.status !== 200) throw new Error(`HTTP ${r.status} for ${url.slice(0, 120)}`);
    return r.body;
  });
}

// Same as getBuffer, but the file is kept in data/cache for maxAgeHours (default 12), keyed by the URL.
async function getBufferCached(url, { maxAgeHours = 12, ...opts } = {}) {
  const dir = require("./config").CACHE;
  const file = path.join(dir, "dl-" + crypto.createHash("sha1").update(url).digest("hex").slice(0, 16) + ".bin");
  try { const st = fs.statSync(file); if (Date.now() - st.mtimeMs < maxAgeHours * 3600e3) return fs.readFileSync(file); } catch (e) { /* not cached yet */ }
  const buf = await getBuffer(url, opts);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, buf);
  return buf;
}

const CKAN = "https://data.gov.il/api/3/action";

// Read a whole datastore table page by page; onRows(rows) is called per page so big tables never sit in memory.
async function ckanEach(resourceId, { fields, filters, q, page = 30000, onRows, maxRows = 5e6 } = {}) {
  let offset = 0, total = Infinity;
  while (offset < total && offset < maxRows) {
    let url = `${CKAN}/datastore_search?resource_id=${resourceId}&limit=${page}&offset=${offset}`;
    if (fields) url += `&fields=${encodeURIComponent(Array.isArray(fields) ? fields.join(",") : fields)}`;
    if (filters) url += `&filters=${encodeURIComponent(JSON.stringify(filters))}`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    const j = await getJson(url);
    if (!j.success) throw new Error("CKAN: " + JSON.stringify(j.error).slice(0, 200));
    const rows = j.result.records || [];
    total = j.result.total;
    await onRows(rows, { offset, total });
    offset += rows.length;
    if (rows.length === 0) break;
  }
  return { total: isFinite(total) ? total : 0, read: offset };
}

async function ckanPackage(id) {
  const j = await getJson(`${CKAN}/package_show?id=${encodeURIComponent(id)}`);
  return j.result;
}

module.exports = { request, setTransport, getJson, getBuffer, getBufferCached, withRetry, sleep, ckanEach, ckanPackage, CKAN, UA };
