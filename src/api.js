"use strict";
// HTTP API. Everything the screens show is computed here from the store; nothing is typed by hand or by a model.
const crypto = require("crypto");
const { createFeedbackStore } = require("./lib/feedback");
const { Store } = require("./model/store");
const { buildCityModel } = require("./model/city");
const { indicators, byId } = require("./catalog/indicators");
const domains = require("./catalog/domains");
const sources = require("./catalog/sources");
const S = require("./lib/stats");
const { sendBuf } = require("./lib/compress");
const { RULES, isReliable } = require("./model/analyze");
const { staticGuide } = require("./model/guide");
const { REC_RULES } = require("./model/recommend");
const evidence = require("./catalog/evidence.json");
const cfg = require("./lib/config");
const path = require("path");

const feedbackStore = createFeedbackStore({ file: cfg.FEEDBACK_FILE || path.join(cfg.DATA, "feedback.jsonl") });

const SECURITY_HEADERS = {
  "X-Content-Type-Options":  "nosniff",
  "Referrer-Policy":         "strict-origin-when-cross-origin",
  "Permissions-Policy":      "camera=(), microphone=(), geolocation=()",
  "X-Frame-Options":         "DENY"
};

// GET endpoints whose responses may be ETag-cached.
const GET_ETAG_ROUTES = new Set(["/api/meta", "/api/geo", "/api/search"]);
function isEtagGet(method, pathname) {
  if (method !== "GET") return false;
  if (GET_ETAG_ROUTES.has(pathname)) return true;
  if (/^\/api\/city\/[^/]+$/.test(pathname)) return true;
  if (/^\/api\/compare$/.test(pathname)) return true;
  return false;
}

function makeBodyEtag(buf) {
  return '"' + crypto.createHash("sha1").update(buf).digest("hex").slice(0, 20) + '"';
}

let store = null, storeMtime = 0;
const modelCache = new Map();

let injectedStore = null, modelProvider = null;
// the Worker has no disk: it hands the store (built once from the bundled data) and a way to get a town's ready-made model (a static file, fetched before the request needs it)
const setStore = (s) => { injectedStore = s || null; };
const setModelProvider = (fn) => { modelProvider = fn || null; };

function getStore() {
  if (injectedStore) return injectedStore;
  const fs = require("fs"), path = require("path"), cfg = require("./lib/config");
  const file = path.join(cfg.STORE, "store.json");
  const m = fs.statSync(file).mtimeMs;
  if (!store || m !== storeMtime) { store = Store.load(file); storeMtime = m; modelCache.clear(); }
  return store;
}

function getModel(key) {
  if (modelProvider) return modelProvider(key);
  const st = getStore();
  if (modelCache.has(key)) return modelCache.get(key);
  const m = buildCityModel(st, key);
  if (m) {
    try { m.recommendations = require("./model/recommend").recommend(m, st); } catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; m.recommendations = []; }
    try { m.summary = require("./model/summary").summarize(m); } catch (e) { if (e.code !== "MODULE_NOT_FOUND") throw e; m.summary = null; }
  }
  modelCache.set(key, m);
  return m;
}

// the 44-parameter framework the evidence scout assembled: what matters for running a city's public health, what is measured here already, what has a dataset
function framework() {
  const live = new Set(indicators.map((i) => i.evidence).filter(Boolean));
  return Object.values(evidence.parameters).map((p) => ({
    id: p.id, domain: p.domain, label: p.label, definition: p.definition, unit: p.unit, direction: p.direction,
    target: p.target ? { value: p.target.value, kind: p.target.kind, url: p.target.source_url || null } : null,
    why: p.why, interventions: (p.interventions || []).length, live: live.has(p.id), dataset: !!p.dataHint
  }));
}

// how many localities the store holds a figure for, per indicator (the coverage page says why one locality lacks it)
const coveredBy = (id) => { try { const i = getStore().ind(id); return i && i.loc ? Object.keys(i.loc).length : 0; } catch (e) { return null; } };

const publicCatalog = () => ({
  domains,
  indicators: indicators.map(({ collect, guideline, benchmark, ...rest }) => ({ ...rest, guideline: staticGuide(byId[rest.id], guideline), benchmark: staticGuide(byId[rest.id], benchmark), covered: coveredBy(rest.id) })),
  sources,
  rules: RULES,
  recRules: REC_RULES,
  interpretation: Object.values(evidence.rules),
  framework: framework()
});

// everything the indicator page needs beyond the city's own analysis: where all localities stand, and the peers' history
function indicatorDetail(key, id) {
  const st = getStore(), ind = byId[id];
  if (!ind) return null;
  const model = getModel(key);
  const a = model && model.indicators.find((x) => x.id === id);
  if (!a) return null;
  const year = a.last.year;
  const dist = st.distribution(id, year, ind.minBase || 0).map((x) => ({ k: x.key, v: x.v, d: x.d }));
  const sorted = dist.slice().sort((x, y) => (ind.direction === "lower" ? x.v - y.v : y.v - x.v));
  const pos = sorted.findIndex((x) => x.k === key);
  // the rank is the competition rank used on the indicator's own analysis (ties share a place), so the list and the headline agree
  const better = (x, y) => (ind.direction === "lower" ? x.v < y.v - 1e-9 : x.v > y.v + 1e-9);
  const near = pos < 0 ? [] : sorted.slice(Math.max(0, pos - 3), pos + 4).map((x) => ({ ...x, name: st.name(x.k), rank: 1 + sorted.filter((y) => better(y, x)).length, self: x.k === key }));
  // every locality with a figure and a position: the dot map of the whole country (the page adds the city itself when its group is too small to be in this list)
  const loc = (k) => st.localities[k] || {};
  const map = dist.map((x) => (loc(x.k).lat != null && loc(x.k).lon != null ? { k: x.k, name: st.name(x.k), v: x.v, d: x.d, x: loc(x.k).lon, y: loc(x.k).lat } : null)).filter(Boolean);
  const peers = model.peers.slice(0, 8).map((p) => ({
    key: p.key, name: p.name,
    series: st.cityYears(id, p.key).map((y) => ({ year: y, v: st.cell(id, p.key, y).v, d: st.cell(id, p.key, y).d }))
  })).filter((p) => p.series.length);
  return {
    indicator: { ...ind, collect: undefined }, analysis: a,
    distribution: { year, values: dist.map((x) => x.v), n: dist.length, p25: a.last.p25, p75: a.last.p75, median: S.median(dist.map((x) => x.v)) },
    neighbours: near, peers, map,
    findings: model.findings.filter((f) => f.indicator === id),
    recommendations: (model.recommendations || []).filter((r) => (r.indicators || []).includes(id))
  };
}

// every locality that has data and a position: the backdrop of the maps on the entry page and the overview (x = longitude, y = latitude, p = residents)
let geoCache = null, geoAt = null;
function geo() {
  const st = getStore();
  if (geoCache && geoAt === st.builtAt) return geoCache;
  geoCache = st.search("", 100000).map((r) => { const l = st.localities[r.key] || {}; return l.lat != null && l.lon != null ? { k: r.key, n: r.name, x: l.lon, y: l.lat, p: r.pop || 0 } : null; }).filter(Boolean);
  geoAt = st.builtAt;
  return geoCache;
}

function compare(keys, ids) {
  const st = getStore();
  // Filter out prototype property names that would read Object.prototype instead of real data.
  const safeKeys = keys.filter((k) => st.hasLocality(k));
  const out = { cities: safeKeys.map((k) => ({ key: k, name: st.name(k) })), rows: [] };
  for (const id of ids) {
    const ind = byId[id]; if (!ind) continue;
    const row = { id, label: ind.label, short: ind.short, unit: ind.unit, direction: ind.direction, cells: [] };
    for (const k of safeKeys) {
      const ys = st.cityYears(id, k), y = ys[ys.length - 1], c0 = y ? st.cell(id, k, y) : null;
      row.cells.push(y ? { year: y, ...c0, reliable: isReliable(ind, c0.d), series: ys.map((yy) => { const c = st.cell(id, k, yy); return { year: yy, v: c ? c.v : null }; }) } : null);
    }
    const ny = st.years(id); const ly = ny[ny.length - 1];
    const nat = ly ? st.nat(id, ly) : null;                 // some parameters (survey series, registry counts) have no national figure
    row.nat = nat ? { year: ly, v: nat.v } : null;
    out.rows.push(row);
  }
  return out;
}

async function handle(req, res, url) {
  const send = (code, obj) => {
    const buf = Buffer.from(JSON.stringify(obj));
    const baseHeaders = { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" };
    // ETag + 304 for cacheable GET endpoints.
    if (code === 200 && isEtagGet(req.method, url.pathname)) {
      const etag = makeBodyEtag(buf);
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304, { ...SECURITY_HEADERS, ETag: etag });
        return res.end();
      }
      return sendBuf(req, res, 200, { ...baseHeaders, ETag: etag }, buf);
    }
    return sendBuf(req, res, code, baseHeaders, buf);
  };
  const p = url.pathname;

  if (p === "/api/health") { const st = getStore(); return send(200, { ok: true, builtAt: st.builtAt, indicators: Object.keys(st.data.indicators).length, localities: Object.keys(st.localities).length, features: { share: require("./lib/share-state").shareReady(), feedback: true, bundle: true } }); }
  if (p === "/api/meta") return send(200, publicCatalog());
  if (p === "/api/search") return send(200, getStore().search(url.searchParams.get("q") || "", 12));
  if (p === "/api/geo") return send(200, geo());

  let m = p.match(/^\/api\/city\/([^/]+)\/export\.csv$/);
  if (m) {
    const key = decodeURIComponent(m[1]);
    const model = getModel(key);
    if (!model) return send(404, { error: "locality not found" });
    const { cityCsv, rfc5987 } = require("./lib/export");
    const csv = cityCsv(model, publicCatalog());
    const buf = Buffer.from(csv, "utf8");
    const safeName = rfc5987("citypulse-" + model.city.name + ".csv");
    return sendBuf(req, res, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="citypulse.csv"; filename*=UTF-8''${safeName}`,
      "Cache-Control": "no-cache"
    }, buf);
  }

  m = p.match(/^\/api\/city\/([^/]+)$/);
  if (m) { const model = getModel(decodeURIComponent(m[1])); return model ? send(200, model) : send(404, { error: "locality not found" }); }

  m = p.match(/^\/api\/city\/([^/]+)\/indicator\/([a-z0-9_]+)$/);
  if (m) { const d = indicatorDetail(decodeURIComponent(m[1]), m[2]); return d ? send(200, d) : send(404, { error: "no data" }); }

  if (p === "/api/compare") {
    const keys = (url.searchParams.get("keys") || "").split(",").filter(Boolean).slice(0, 6);     // the city plus up to five others
    const ids = (url.searchParams.get("ids") || indicators.map((i) => i.id).join(",")).split(",").filter(Boolean);
    return send(200, compare(keys, ids));
  }

  // the city briefing: GET returns the cached one, POST writes it (a paid call with the strong model, cached per store version)
  m = p.match(/^\/api\/city\/([^/]+)\/briefing$/);
  if (m) {
    const model = getModel(decodeURIComponent(m[1]));
    if (!model) return send(404, { error: "locality not found" });
    const llm = require("./lib/llm"), br = require("./agent/briefing"), st = getStore();
    const enough = br.enough(model);          // nothing to brief on for a locality the sources do not cover
    if (req.method === "POST") {
      if (!llm.available() || !enough) return send(200, { available: false });
      try { return send(200, { available: true, ...(await br.briefing(st, model)) }); }
      catch (e) { return send(502, { error: "הכנת התקציר לא הצליחה כרגע: " + String(e.message).slice(0, 100) }); }
    }
    const c = br.cached(String(model.city.key), st.builtAt);
    return send(200, c ? { available: true, ...c } : { available: llm.available() && enough, cached: false });
  }
  if (p === "/api/llm") return send(200, require("./lib/llm").usageSummary());

  if (p === "/api/ask" && req.method === "POST") {
    let body;
    try { body = await readJsonSafe(req, 200000); }
    catch (e) {
      const code = e.message === "body too large" ? 413 : 400;
      return send(code, { error: e.message });
    }
    const ask = require("./agent/ask");
    return send(200, await ask.answer(getStore(), getModel, body));
  }

  if (p === "/api/feedback" && req.method === "POST") {
    let body;
    try { body = await readJsonSafe(req, 8192); }
    catch (e) {
      const code = e.message === "body too large" ? 413 : 400;
      return send(code, { error: e.message });
    }
    const ip = req.socket.remoteAddress || "unknown";
    const result = feedbackStore.submit(body, ip);
    if (result.ok) return send(200, { ok: true });
    return send(result.status, { error: result.error });
  }

  return send(404, { error: "unknown endpoint" });
}

function readJson(req, limit = 200000) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on("data", (c) => { n += c.length; if (n > limit) { reject(new Error("body too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(new Error("bad json")); } });
  });
}

// Like readJson, but drains (instead of destroying) the socket on overflow so
// the caller can still write a 413 response before the connection closes.
function readJsonSafe(req, limit) {
  return new Promise((resolve, reject) => {
    let n = 0; let over = false; const chunks = [];
    req.on("data", (c) => {
      n += c.length;
      if (!over && n > limit) { over = true; reject(new Error("body too large")); }
      else if (!over) chunks.push(c);
    });
    req.on("end", () => {
      if (over) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(new Error("bad json")); }
    });
    req.on("error", () => { /* already handled via reject above or socket close */ });
  });
}

module.exports = { setStore, setModelProvider, handle, getStore, getModel, indicatorDetail, compare, publicCatalog, geo };
