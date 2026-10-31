// The Cloudflare Worker: what the Node server (server.js + src/api.js) does at run time, for a host with no disk and no long-lived process.
//   - the site itself and every town's ready-made model are static assets (npm run build writes them to dist/)
//   - /api/* is answered here with the SAME functions the server uses (src/api.js, src/agent/*), fed by the store the Worker carries
//     and by the town models read from the assets; nothing is computed twice and nothing is typed by hand
//   - what the server keeps in files (the AI ledger, the briefing cache, the feedback log) lives in KV and D1
// A static asset request never reaches this file (wrangler.jsonc: run_worker_first lists only what needs code).
import storeData from "../data/store/store.json";
import * as sentence from "../web/js/product/city/sentence.js";
import api from "../src/api.js";
import cfg from "../src/lib/config.js";
import llm from "../src/lib/llm.js";
import http from "../src/lib/http.js";
import briefing from "../src/agent/briefing.js";
import askAgent from "../src/agent/ask.js";
import towns from "../src/agent/towns.js";
import feedback from "../src/lib/feedback.js";
import { Store } from "../src/model/store.js";
import { indicators as catalogIndicators } from "../src/catalog/indicators.js";

const store = new Store(storeData);
api.setStore(store);

// ── town models: parsed from the assets, kept for a short while in this isolate ──
const MODELS = new Map();
const MAX_MODELS = 8;
const KEY_RE = /^[0-9A-Za-z_-]{1,12}$/;
api.setModelProvider((key) => MODELS.get(String(key)) || null);
async function loadModels(env, origin, keys) {
  for (const k of [...new Set(keys.map(String))]) {
    if (MODELS.has(k) || !KEY_RE.test(k)) continue;
    const r = await env.ASSETS.fetch(new Request(`${origin}/_d/city/${k}.json`));
    if (r.status !== 200) continue;
    MODELS.set(k, await r.json());
    if (MODELS.size > MAX_MODELS) MODELS.delete(MODELS.keys().next().value);
  }
}

// ── the network for the language model and the dataset search: fetch, in the shape the server's helper returns ──
http.setTransport(async (url, { method = "GET", headers = {}, body = null, timeout = 120000 } = {}) => {
  const h = { ...headers }; delete h["Content-Length"]; delete h["content-length"];
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(url, { method, headers: { "User-Agent": http.UA, ...h }, body, signal: ac.signal, redirect: "follow" });
    return { status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) };
  } finally { clearTimeout(t); }
});

const SEC = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "X-Frame-Options": "DENY" };
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { ...SEC, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache", ...extra } });
const text = (body, type, status = 200, extra = {}) => new Response(body, { status, headers: { ...SEC, "Content-Type": type, ...extra } });

async function readBody(request, limit) {
  const buf = await request.arrayBuffer();
  if (buf.byteLength > limit) throw Object.assign(new Error("body too large"), { status: 413 });
  try { return JSON.parse(new TextDecoder().decode(buf) || "{}"); } catch (e) { throw Object.assign(new Error("bad json"), { status: 400 }); }
}

// a static file, with the conditional headers of the visitor passed on (the assets answer 304 themselves)
async function asset(env, request, path, type) {
  const r = await env.ASSETS.fetch(new Request(new URL(path, request.url), { headers: request.headers }));
  if (r.status === 404) return null;
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries({ ...SEC, "Cache-Control": "no-cache" })) h.set(k, v);
  if (type) h.set("Content-Type", type);
  return new Response(r.body, { status: r.status, headers: h });
}

// the AI's state (ledger, calls of the last hour, the balance of the key) is read from KV before a call and written back after it
async function withLlm(env, ctx, fn) {
  let saved = null;
  try { saved = env.STATE ? await env.STATE.get("llm", "json") : null; } catch (e) { saved = null; }
  llm.useState(saved);
  try { return await fn(); }
  finally { if (env.STATE) ctx.waitUntil(env.STATE.put("llm", JSON.stringify(llm.state())).catch(() => {})); }
}

async function apiRoute(request, env, ctx, url) {
  const p = url.pathname, method = request.method;
  const postOk = /^\/api\/(feedback|ask)$/.test(p) || /^\/api\/city\/[^/]+\/briefing$/.test(p);
  if (method !== "GET" && method !== "HEAD" && !(postOk && method === "POST")) return json({ error: "method not allowed" }, 405, { Allow: postOk ? "GET, HEAD, POST" : "GET, HEAD" });

  if (p === "/api/health") return json({ ok: true, builtAt: store.builtAt, indicators: Object.keys(store.data.indicators).length, localities: Object.keys(store.localities).length, features: { share: true, feedback: !!env.DB, bundle: true } });
  if (p === "/api/meta") return (await asset(env, request, "/_d/meta.json")) || json({ error: "unknown endpoint" }, 404);
  if (p === "/api/geo") return (await asset(env, request, "/_d/geo.json")) || json({ error: "unknown endpoint" }, 404);
  if (p === "/api/search") return json(store.search(url.searchParams.get("q") || "", 12));

  let m = p.match(/^\/api\/city\/([^/]+)\/export\.csv$/);
  if (m) {
    const key = decodeURIComponent(m[1]);
    const r = KEY_RE.test(key) ? await asset(env, request, `/_d/csv/${key}.csv`, "text/csv; charset=utf-8") : null;
    if (!r) return json({ error: "locality not found" }, 404);
    r.headers.set("Content-Disposition", `attachment; filename="citypulse.csv"; filename*=UTF-8''${rfc5987("citypulse-" + store.name(key) + ".csv")}`);
    return r;
  }
  m = p.match(/^\/api\/city\/([^/]+)$/);
  if (m) {
    const key = decodeURIComponent(m[1]);
    const r = KEY_RE.test(key) ? await asset(env, request, `/_d/city/${key}.json`) : null;
    return r || json({ error: "locality not found" }, 404);
  }
  m = p.match(/^\/api\/city\/([^/]+)\/indicator\/([a-z0-9_]+)$/);
  if (m) {
    const key = decodeURIComponent(m[1]);
    await loadModels(env, url.origin, [key]);
    const d = api.indicatorDetail(key, m[2]);
    return d ? json(d) : json({ error: "no data" }, 404);
  }
  if (p === "/api/compare") {
    const keys = (url.searchParams.get("keys") || "").split(",").filter(Boolean).slice(0, 6);
    const ids = (url.searchParams.get("ids") || "").split(",").filter(Boolean);
    return json(api.compare(keys, ids.length ? ids : catalogIndicators.map((i) => i.id)));
  }

  m = p.match(/^\/api\/city\/([^/]+)\/briefing$/);
  if (m) {
    const key = decodeURIComponent(m[1]);
    await loadModels(env, url.origin, [key]);
    const model = api.getModel(key);
    if (!model) return json({ error: "locality not found" }, 404);
    const enough = briefing.enough(model), pending = new Map();
    let rec = null;
    try { rec = env.STATE ? await env.STATE.get("briefing:" + key, "json") : null; } catch (e) { rec = null; }
    briefing.setIO({ read: () => rec, write: (k, r) => { pending.set(k, r); } });
    return withLlm(env, ctx, async () => {
      if (method === "POST") {
        if (!llm.available() || !enough) return json({ available: false });
        try {
          const out = await briefing.briefing(store, model);
          for (const [k, r] of pending) if (env.STATE) ctx.waitUntil(env.STATE.put("briefing:" + k, JSON.stringify(r)).catch(() => {}));
          return json({ available: true, ...out });
        } catch (e) { return json({ error: "הכנת התקציר לא הצליחה כרגע: " + String(e.message).slice(0, 100) }, 502); }
      }
      const c = briefing.cached(String(model.city.key), store.builtAt);
      return json(c ? { available: true, ...c } : { available: llm.available() && enough, cached: false });
    });
  }

  if (p === "/api/ask" && method === "POST") {
    let body;
    try { body = await readBody(request, 200000); } catch (e) { return json({ error: e.message }, e.status || 400); }
    const city = String(body.city || ""), q = String(body.question || "").trim();
    await loadModels(env, url.origin, [city]);
    if (api.getModel(city) && q) {
      const found = towns.findTowns(store, q, String(city));          // the localities named in the question: their models are needed by the comparison
      await loadModels(env, url.origin, found.towns.map((t) => t.key).slice(0, 6));
    }
    return withLlm(env, ctx, async () => {
      try { return json(await askAgent.answer(store, api.getModel, body)); }
      catch (e) { return json({ error: e.message }, /empty question|locality not found/.test(e.message) ? 400 : 500); }
    });
  }

  if (p === "/api/feedback" && method === "POST") {
    let body;
    try { body = await readBody(request, 8192); } catch (e) { return json({ error: e.message }, e.status || 400); }
    const v = feedback.validate(body);
    if (!v.ok) return json({ error: v.error }, v.status);
    if (!env.DB) return json({ error: "could not write feedback" }, 503);
    if (env.FEEDBACK_LIMIT) {
      const { success } = await env.FEEDBACK_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") || "unknown" });
      if (!success) return json({ error: "too many requests" }, 429);
    }
    try {
      const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM feedback").first("n");
      if (n >= 5000) return json({ error: "feedback log full" }, 503);
      await env.DB.prepare("INSERT INTO feedback (at, message, email, context) VALUES (?, ?, ?, ?)").bind(new Date().toISOString(), v.record.message, v.record.email, v.record.context ? JSON.stringify(v.record.context) : null).run();
    } catch (e) { return json({ error: "could not write feedback" }, 503); }
    return json({ ok: true });
  }

  return json({ error: "unknown endpoint" }, 404);       // /api/llm, the spend and the balance of the key, is not served here
}

// ── the share page /s/<key>: the preview a link gets in a chat, then a redirect to the site ──
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const escScript = (s) => s.replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029");
const VALID_QIDS = new Set(["weak", "changed", "peers", "first", "missing", "simple"]);
const rfc5987 = (s) => encodeURIComponent(s).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
function appPath(key, q) {
  let dest = cfg.SHARE_TARGET + "#/c/" + encodeURIComponent(key);
  if (q === "simple") dest += "/simple"; else if (q !== "weak") dest += "?q=" + encodeURIComponent(q);
  return dest;
}
async function share(request, env, url) {
  let key;
  try { key = decodeURIComponent(url.pathname.slice(3)); } catch (e) { return text("bad request", "text/plain; charset=utf-8", 400); }
  const rawQ = url.searchParams.get("q") || "weak", q = VALID_QIDS.has(rawQ) ? rawQ : "weak";
  await loadModels(env, url.origin, [key]);
  const model = api.getModel(key);
  if (!model) return new Response(null, { status: 302, headers: { ...SEC, Location: cfg.SHARE_TARGET } });
  let meta = { title: escHtml(model.city.name), description: "" };
  try { const raw = sentence.shareMeta(model, q); meta = { title: escHtml(raw.title), description: escHtml(raw.description) }; } catch (e) { /* the city name alone */ }
  const base = cfg.PUBLIC_BASE_URL || url.origin;
  const ogImage = base + "/assets/product/og.png", canonical = base + "/s/" + encodeURIComponent(key) + (q !== "weak" ? "?q=" + encodeURIComponent(q) : ""), dest = appPath(key, q);
  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${meta.title} – CityPulse</title>
<meta name="description" content="${meta.description}">
<meta property="og:type" content="website">
<meta property="og:locale" content="he_IL">
<meta property="og:site_name" content="CityPulse">
<meta property="og:title" content="${meta.title}">
<meta property="og:description" content="${meta.description}">
<meta property="og:url" content="${escHtml(canonical)}">
<meta property="og:image" content="${escHtml(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escHtml(ogImage)}">
<meta http-equiv="refresh" content="0;url=${escHtml(dest)}">
</head>
<body>
<p>עוברים לדף של <a href="${escHtml(dest)}">${escHtml(model.city.name)}</a>.</p>
<script>location.replace(${escScript(JSON.stringify(dest))});</script>
</body>
</html>`;
  return text(html, "text/html; charset=utf-8", 200, { "Cache-Control": "public, max-age=300" });
}

export default {
  async fetch(request, env, ctx) {
    cfg.configure(env);
    const url = new URL(request.url), p = url.pathname;
    try {
      if (p === "/") return env.ASSETS.fetch(new Request(new URL("/index.html", url.origin), request));          // html_handling is "none": the front page is asked for by its name
      if (p === "/robots.txt") return text(`User-agent: *\nAllow: /\n\nSitemap: ${cfg.PUBLIC_BASE_URL || url.origin}/sitemap.xml\n`, "text/plain; charset=utf-8");
      if (p === "/sitemap.xml") {
        const r = await env.ASSETS.fetch(new Request(new URL("/_d/sitemap.xml", url.origin)));
        return text((await r.text()).replace(/BASEURL/g, cfg.PUBLIC_BASE_URL || url.origin), "application/xml; charset=utf-8");
      }
      if (/^\/s\/[^/]+$/.test(p)) return await share(request, env, url);
      if (p.startsWith("/api/")) return await apiRoute(request, env, ctx, url);
      return env.ASSETS.fetch(request);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500);
    }
  }
};
