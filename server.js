"use strict";
// CityPulse V2 server: static web app + JSON API. No dependencies.
//   node server.js        then open http://localhost:8800
const http = require("http");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const cfg = require("./src/lib/config");
const api = require("./src/api");
const compress = require("./src/lib/compress");
const { sendBuf } = compress;
const shareState = require("./src/lib/share-state");
const { buildBundle } = require("./src/lib/css-bundle");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff2": "font/woff2"
};

// Security headers added to every response (API and static).
const SECURITY_HEADERS = {
  "X-Content-Type-Options":  "nosniff",
  "Referrer-Policy":         "strict-origin-when-cross-origin",
  "Permissions-Policy":      "camera=(), microphone=(), geolocation=()",
  "X-Frame-Options":         "DENY"
};

// Validate a Host header value: allow only letters, digits, dots, hyphens, and an optional port.
// Returns the value as-is if valid, or null otherwise.
function validateHost(raw) {
  if (!raw) return null;
  return /^[a-zA-Z0-9.\-]+(:\d{1,5})?$/.test(raw) ? raw : null;
}

// Return the public base URL for robots.txt, sitemap.xml, and share pages.
// Priority: PUBLIC_BASE_URL env var > validated Host header > fallback to localhost:<port>.
function resolveBase(req) {
  if (cfg.PUBLIC_BASE_URL) return cfg.PUBLIC_BASE_URL;
  const host = validateHost(req.headers["host"]);
  if (host) return `http://${host}`;
  return `http://localhost:${cfg.PORT}`;
}

// Escape characters that are unsafe inside a <script> JSON string: <, U+2028, U+2029.
function escScript(s) {
  return s.replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

// Allowed methods for each route class.
// Static files and read-only API endpoints: GET and HEAD only.
// POST endpoints: GET/HEAD are also included so the 405 fires only on exotic methods.
const ALLOW_READONLY = "GET, HEAD";
const ALLOW_POST    = "GET, HEAD, POST";

// Routes that accept POST in addition to GET/HEAD.
function isPostAllowed(pathname) {
  return /^\/api\/(feedback|ask)$/.test(pathname) ||
         /^\/api\/city\/[^/]+\/briefing$/.test(pathname);
}

// Long-lived cache: fonts and product images (assets/product/).
function isLongLived(filePath) {
  return /\.woff2$/.test(filePath) || filePath.includes(path.sep + "assets" + path.sep + "product" + path.sep) || filePath.includes("/assets/product/");
}

// ETag: "<mtime>-<size>" (weak is fine for static assets).
function makeEtag(stat) {
  return `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;
}

const PAGE_404 = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>דף לא נמצא – CityPulse</title>
<style>
*{box-sizing:border-box;margin:0}
:root{
  --bg:#F5F7FA;--ink:#14233A;--ink-3:#566679;--teal:#1F9A9A;--teal-dark:#15787A;
  --surface:#FFFFFF;--line:#DFE5EC;
  --font:"Heebo","Segoe UI",Arial,sans-serif
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:#0B1626;--ink:#E9EFF6;--ink-3:#9DB0C6;--teal:#34B3AD;--teal-dark:#34B3AD;
    --surface:#122238;--line:#223853
  }
}
html{height:100%}
body{
  font-family:var(--font);font-size:15px;line-height:1.6;
  color:var(--ink);background:var(--bg);
  min-height:100%;display:flex;align-items:center;justify-content:center;
  padding:2rem 1rem
}
.box{
  background:var(--surface);border:1px solid var(--line);border-radius:16px;
  padding:3rem 2.5rem;text-align:center;max-width:480px;width:100%
}
.code{
  font-size:5rem;font-weight:800;line-height:1;
  color:var(--teal);letter-spacing:-.04em;margin-bottom:.5rem
}
h1{font-size:1.5rem;font-weight:700;margin-bottom:.75rem}
p{color:var(--ink-3);margin-bottom:1.5rem}
.btn{
  display:inline-flex;align-items:center;gap:.5rem;
  background:var(--teal-dark);color:#fff;text-decoration:none;
  font-weight:700;font-size:1rem;padding:.75rem 1.75rem;
  border-radius:10px;border:none;cursor:pointer
}
.btn:hover{opacity:.88}
</style>
</head>
<body>
<div class="box">
  <div class="code" aria-hidden="true">404</div>
  <h1>הדף לא נמצא</h1>
  <p>הכתובת שביקשת אינה קיימת באתר.</p>
  <a class="btn" href="/n.html">חזרה לדף הבית</a>
</div>
</body>
</html>`;

function isFileRequest(pathname) {
  // A request for a "file" has a recognised non-html extension.
  const ext = path.extname(pathname).toLowerCase();
  return ext && ext !== ".html";
}

function serveStatic(req, res, url) {
  // Null bytes in URLs cause Node to throw an internal error; reject early with 400.
  if (url.pathname.includes("\x00")) {
    return sendFinal(res, 400, "text/plain; charset=utf-8", Buffer.from("bad request"));
  }

  let rel;
  try {
    rel = decodeURIComponent(url.pathname);
  } catch (e) {
    return sendFinal(res, 400, "text/plain; charset=utf-8", Buffer.from("bad request"));
  }

  if (rel === "/" || rel === "") rel = "/index.html";
  const file = path.normalize(path.join(cfg.WEB, rel));
  if (!file.startsWith(cfg.WEB + path.sep) && file !== cfg.WEB) {
    return sendFinal(res, 403, "text/plain; charset=utf-8", Buffer.from("forbidden"));
  }

  fs.stat(file, (err, stat) => {
    if (err) {
      // 404: file request → plain, page request → 404 HTML page
      if (isFileRequest(url.pathname)) {
        return sendFinal(res, 404, "text/plain; charset=utf-8", Buffer.from("not found"));
      }
      const buf = Buffer.from(PAGE_404);
      return sendFinal(res, 404, "text/html; charset=utf-8", buf);
    }

    // Directory listings are not served — treat as 404.
    if (stat.isDirectory()) {
      return sendFinal(res, 404, "text/plain; charset=utf-8", Buffer.from("not found"));
    }

    const ext = path.extname(file).toLowerCase();
    const etag = makeEtag(stat);

    // ETag / 304
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, { ...SECURITY_HEADERS, ETag: etag });
      return res.end();
    }

    const isLong = isLongLived(file);
    const cacheControl = isLong
      ? "public, max-age=86400, stale-while-revalidate=604800"
      : "no-cache";

    const contentType = TYPES[ext] || "application/octet-stream";
    const headers = {
      ...SECURITY_HEADERS,
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      ETag: etag
    };

    // Already-compressed formats: skip compression.
    if (/\.(png|jpg|webp|ico|woff2)$/.test(file)) {
      fs.readFile(file, (ferr, buf) => {
        if (ferr) return sendFinal(res, 500, "text/plain; charset=utf-8", Buffer.from("read error"));
        res.writeHead(200, { ...headers, "Content-Length": buf.length });
        res.end(buf);
      });
      return;
    }

    fs.readFile(file, (ferr, buf) => {
      if (ferr) return sendFinal(res, 500, "text/plain; charset=utf-8", Buffer.from("read error"));
      const cacheKey = `${file}|${stat.mtimeMs}`;
      sendBuf(req, res, 200, headers, buf, cacheKey);
    });
  });
}

// Low-level helper that writes security headers + a plain buffer (no compression).
function sendFinal(res, code, contentType, buf) {
  res.writeHead(code, { ...SECURITY_HEADERS, "Content-Type": contentType, "Content-Length": buf.length });
  res.end(buf);
}

// ── CSS bundle (/css/n.bundle.css) ───────────────────────────────────────────
// Built once and cached in memory; invalidated when any source file changes.
let _bundleCache = null; // { buf, mtimeKey, etag }

// Is the cached bundle still the bundle of the files on disk? One stat per source file (about 40), not a rebuild.
function bundleIsCurrent(cache) {
  try {
    return cache.files.every((f, i) => fs.statSync(f).mtimeMs === cache.mtimes[i]);
  } catch (e) { return false; }             // a file vanished: rebuild (and report the error if it is really gone)
}

// The current bundle (rebuilt only when a source file changed). Throws when a source cannot be read.
function currentBundle() {
  if (_bundleCache && bundleIsCurrent(_bundleCache)) return _bundleCache;
  const { css, mtimeKey, mtimes, files } = buildBundle(cfg.CSS_BUNDLE_FILES, cfg.WEB);
  if (!_bundleCache || _bundleCache.mtimeKey !== mtimeKey) {
    const buf = Buffer.from(css, "utf8");
    // ETag derived from mtimeKey (all mtimes concatenated).
    const etagRaw = mtimeKey.split(",").reduce((a, v) => a + Number(v), 0);
    const etag = `"${etagRaw.toString(36)}"`;
    _bundleCache = { buf, mtimeKey, etag, mtimes, files };
  } else {
    _bundleCache = { ..._bundleCache, mtimes, files };
  }
  return _bundleCache;
}

function serveCssBundle(req, res) {
  let bundle;
  try {
    bundle = currentBundle();
  } catch (e) {
    return sendFinal(res, 500, "text/plain; charset=utf-8", Buffer.from("bundle error: " + e.message));
  }

  const { buf, etag, mtimeKey } = bundle;

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, { ...SECURITY_HEADERS, ETag: etag });
    return res.end();
  }

  const headers = {
    ...SECURITY_HEADERS,
    "Content-Type": "text/css; charset=utf-8",
    "Cache-Control": "no-cache",
    ETag: etag,
  };
  sendBuf(req, res, 200, headers, buf, `n.bundle|${mtimeKey}`);
}

// ── Warm-up of the compression cache ─────────────────────────────────────────
// After the server has started, the compressible files of web/ (and the css bundle) are compressed in the
// background at the best level, so the first visitor finds them ready. It never delays the start (it begins after
// listen), uses two worker slots of the thread pool, and a file that vanishes or changes is skipped.
const WARM_EXT = /\.(js|mjs|css|html|svg|json)$/i;   // not webp, png, woff2: already compressed

async function listWarmFiles(root = cfg.WEB) {
  const out = [];
  async function walk(dir) {
    let ents;
    try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const ent of ents) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (ent.isFile() && WARM_EXT.test(ent.name)) out.push(p);
    }
  }
  await walk(root);
  // what a first load of the product needs comes first: the page, its modules, then the rest
  const rank = (f) => {
    const rel = path.relative(root, f).split(path.sep).join("/");
    if (rel === "n.html") return 0;
    if (rel.startsWith("js/product/")) return 1;
    if (/\.m?js$/.test(rel)) return 2;
    if (/\.(html|svg|json)$/.test(rel)) return 3;
    return 4;
  };
  return out.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
}

async function warmFiles(files, concurrency = 2) {
  const done = { files: 0, skipped: 0 };
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      try {
        const stat = await fs.promises.stat(file);
        if (!stat.isFile()) { done.skipped++; continue; }
        const buf = await fs.promises.readFile(file);
        // the same key serveStatic builds: path and mtime
        if (await compress.prime(`${file}|${stat.mtimeMs}`, buf)) done.files++; else done.skipped++;
      } catch (e) { done.skipped++; }               // vanished, unreadable: not a reason to stop
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return done;
}

async function warmCache({ concurrency = 2 } = {}) {
  const t0 = Date.now();
  const result = { bundle: false, files: 0, skipped: 0, ms: 0 };
  const bundleJob = (async () => {
    try { const b = currentBundle(); result.bundle = await compress.prime(`n.bundle|${b.mtimeKey}`, b.buf); } catch (e) { /* the request will report it */ }
  })();
  const files = await listWarmFiles();
  const done = await warmFiles(files, concurrency);
  await bundleJob;
  result.files = done.files; result.skipped = done.skipped; result.ms = Date.now() - t0;
  return result;
}

function robotsTxt(req) {
  const base = resolveBase(req);
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`;
  return Buffer.from(body, "utf8");
}

function sitemapXml() {
  const st = api.getStore();
  const builtAt = st.builtAt ? st.builtAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  // collect every locality key that has at least one (non-context) indicator
  const have = new Set();
  for (const [, ind] of Object.entries(st.data.indicators)) {
    for (const key of Object.keys(ind.loc || {})) have.add(key);
  }
  const urls = [`  <url><loc>BASEURL/</loc><lastmod>${builtAt}</lastmod></url>`];
  for (const key of [...have].sort()) {
    urls.push(`  <url><loc>BASEURL/s/${encodeURIComponent(key)}</loc><lastmod>${builtAt}</lastmod></url>`);
  }
  // BASEURL placeholder is replaced at request time with the real host.
  return urls;
}

// ── Share-page: sentence.js loaded once, lazily, on first /s/ request ────────
// sentence.js is an ESM module; we load it with dynamic import() via pathToFileURL
// so the CJS server can consume it without changing its own module system.
let _sentence = null;       // { headline, shareMeta } once resolved
let _sentenceErr = null;    // Error if import failed
let _sentenceLoading = null; // in-flight Promise (prevents double-load)

function loadSentence() {
  if (_sentence) return Promise.resolve(_sentence);
  if (_sentenceErr) return Promise.reject(_sentenceErr);
  if (_sentenceLoading) return _sentenceLoading;
  const sentencePath = path.join(cfg.WEB, "js", "product", "city", "sentence.js");
  _sentenceLoading = import(pathToFileURL(sentencePath).href)
    .then((mod) => {
      _sentence = { headline: mod.headline, shareMeta: mod.shareMeta };
      _sentenceLoading = null;
      shareState.setShareReady(true);
      return _sentence;
    })
    .catch((err) => {
      _sentenceErr = err;
      _sentenceLoading = null;
      throw err;
    });
  return _sentenceLoading;
}

// Eagerly attempt to load on startup so /api/health reflects the real state quickly.
loadSentence().catch(() => {});

// HTML escape: every user-supplied string that enters the page goes through this.
function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const VALID_QIDS = new Set(["weak", "changed", "peers", "first", "missing", "simple"]);

// Build a relative destination URL inside the app (hash route).
// Only the path + hash is returned; callers that need an absolute URL prepend a base.
function appPath(key, q) {
  const hashKey = encodeURIComponent(key);
  const qSafe  = VALID_QIDS.has(q) ? q : "weak";
  let dest = cfg.SHARE_TARGET + "#/c/" + hashKey;
  if (qSafe === "simple") {
    dest += "/simple";
  } else if (qSafe !== "weak") {
    dest += "?q=" + encodeURIComponent(qSafe);
  }
  return dest;
}

async function handleShare(req, res, url) {
  // pathname is /s/<key>
  let key;
  try {
    key = decodeURIComponent(url.pathname.slice(3)); // strip "/s/"
  } catch (e) {
    return sendFinal(res, 400, "text/plain; charset=utf-8", Buffer.from("bad request"));
  }

  const rawQ = url.searchParams.get("q") || "weak";
  const q = VALID_QIDS.has(rawQ) ? rawQ : "weak";

  // Validate the key against the store.
  const model = api.getModel(key);
  if (!model) {
    // Use a relative redirect — avoids injecting the Host header into a Location value.
    res.writeHead(302, { ...SECURITY_HEADERS, Location: cfg.SHARE_TARGET });
    return res.end();
  }

  // Load sentence module (already in memory after startup).
  let meta = { title: escHtml(model.city.name), description: "" };
  try {
    const sent = await loadSentence();
    const raw = sent.shareMeta(model, q);
    meta = { title: escHtml(raw.title), description: escHtml(raw.description) };
  } catch (e) {
    // sentence.js failed to load – fall back to just the city name.
  }

  const base = resolveBase(req);
  const ogImage = base + "/assets/product/og.png";
  const canonicalUrl = base + "/s/" + encodeURIComponent(key) + (q !== "weak" ? "?q=" + encodeURIComponent(q) : "");
  // Relative URL for redirect/link — never trusts the Host header for navigation.
  const dest = appPath(key, q);
  const cityNameSafe = escHtml(model.city.name);

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
<meta property="og:url" content="${escHtml(canonicalUrl)}">
<meta property="og:image" content="${escHtml(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${escHtml(ogImage)}">
<meta http-equiv="refresh" content="0;url=${escHtml(dest)}">
</head>
<body>
<p>עוברים לדף של <a href="${escHtml(dest)}">${cityNameSafe}</a>.</p>
<script>location.replace(${escScript(JSON.stringify(dest))});</script>
</body>
</html>`;

  const buf = Buffer.from(html, "utf8");
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "Content-Length": buf.length
  });
  res.end(buf);
}

function createServer() {
  return http.createServer(async (req, res) => {
    // TRACE must not echo the request body; refuse it immediately.
    if (req.method === "TRACE") {
      res.writeHead(405, { ...SECURITY_HEADERS, Allow: ALLOW_READONLY });
      return res.end();
    }

    // Parse URL – a malformed URL string throws; return 400.
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch (e) {
      return sendFinal(res, 400, "text/plain; charset=utf-8", Buffer.from("bad request"));
    }

    // Null bytes anywhere in the URL: reject with 400.
    // %00 is the percent-encoded null byte; Node's URL keeps it as-is in pathname.
    // A literal \x00 could also appear in rare cases; catch both forms.
    if (req.url.includes("\x00") || url.pathname.includes("\x00") ||
        url.pathname.includes("%00") || req.url.includes("%00")) {
      return sendFinal(res, 400, "text/plain; charset=utf-8", Buffer.from("bad request"));
    }

    // decodeURIComponent of the pathname is done inside serveStatic / api.handle;
    // a bad %-sequence in the path itself is caught here.
    try { decodeURIComponent(url.pathname); } catch (e) {
      return sendFinal(res, 400, "text/plain; charset=utf-8", Buffer.from("bad request"));
    }

    // Method enforcement: determine which methods are allowed for this path,
    // then reject anything outside that set.
    const method = req.method;
    const allowed = isPostAllowed(url.pathname) ? ALLOW_POST : ALLOW_READONLY;
    if (method !== "GET" && method !== "HEAD" && !(isPostAllowed(url.pathname) && method === "POST")) {
      res.writeHead(405, { ...SECURITY_HEADERS, Allow: allowed });
      return res.end();
    }

    try {
      if (url.pathname === "/robots.txt") {
        const buf = robotsTxt(req);
        return sendFinal(res, 200, "text/plain; charset=utf-8", buf);
      }
      if (url.pathname === "/sitemap.xml") {
        const base = resolveBase(req);
        const rows = sitemapXml();
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.map((r) => r.replace(/BASEURL/g, base)).join("\n")}\n</urlset>\n`;
        return sendFinal(res, 200, "application/xml; charset=utf-8", Buffer.from(xml, "utf8"));
      }
      if (url.pathname === "/css/n.bundle.css") return serveCssBundle(req, res);
      if (/^\/s\/[^/]+$/.test(url.pathname)) return await handleShare(req, res, url);
      if (url.pathname.startsWith("/api/")) return await api.handle(req, res, url);
      return serveStatic(req, res, url);
    } catch (e) {
      console.error("[error]", req.method, url.pathname, e.message);
      if (!res.headersSent) {
        res.writeHead(500, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8" });
      }
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(cfg.PORT, "127.0.0.1", () => {
    console.log(`CityPulse V2 on http://localhost:${cfg.PORT}`);
    // CITYPULSE_NO_WARM=1 leaves the compression cache cold (to measure the first request)
    if (!process.env.CITYPULSE_NO_WARM) {
      setImmediate(() => warmCache().then((r) => console.log(`[warm] ${r.files} files${r.bundle ? " and the css bundle" : ""} compressed in ${r.ms} ms${r.skipped ? ` (${r.skipped} skipped)` : ""}`)).catch(() => {}));
    }
  });
}

module.exports = { createServer, loadSentence, warmCache, warmFiles, listWarmFiles };
