"use strict";
// Builds dist/: everything the site serves without running any code, from the same functions the Node server uses.
//   dist/                 the whole of web/ (the site), the 404 page, _headers
//   dist/css/n.bundle.css the stylesheet bundle the server builds at run time
//   dist/_d/meta.json     /api/meta          dist/_d/geo.json   /api/geo
//   dist/_d/city/<key>.json  /api/city/<key> (the town model, ready)
//   dist/_d/csv/<key>.csv    /api/city/<key>/export.csv
//   dist/_d/sitemap.xml   with BASEURL where the address of the site goes
// The Worker (worker/index.js) answers /api/* from these and from the store it carries; run with `npm run build` (wrangler does it before every deploy).
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "dist");
const api = require(path.join(ROOT, "src", "api"));
const cfg = require(path.join(ROOT, "src", "lib", "config"));
const { buildBundle } = require(path.join(ROOT, "src", "lib", "css-bundle"));
const { cityCsv } = require(path.join(ROOT, "src", "lib", "export"));

const t0 = Date.now();
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(cfg.WEB, OUT, { recursive: true });
const write = (rel, data) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, data); };

// the stylesheet bundle
write("css/n.bundle.css", buildBundle(cfg.CSS_BUNDLE_FILES, cfg.WEB).css);

// the catalogue, the map backdrop
const catalog = api.publicCatalog();
write("_d/meta.json", JSON.stringify(catalog));
write("_d/geo.json", JSON.stringify(api.geo()));

// every town: its model and its csv
const st = api.getStore();
let towns = 0, bytes = 0;
const have = new Set();
for (const key of Object.keys(st.localities)) {
  if (!/^[0-9A-Za-z_-]{1,12}$/.test(key)) continue;
  const model = api.getModel(key);
  if (!model) continue;
  const json = JSON.stringify(model);
  write(`_d/city/${key}.json`, json);
  write(`_d/csv/${key}.csv`, cityCsv(model, catalog));
  towns++; bytes += json.length;
}

// the sitemap: every locality with at least one figure
for (const ind of Object.values(st.data.indicators)) for (const key of Object.keys(ind.loc || {})) have.add(key);
const builtAt = st.builtAt ? st.builtAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
const rows = [`  <url><loc>BASEURL/</loc><lastmod>${builtAt}</lastmod></url>`, ...[...have].sort().map((k) => `  <url><loc>BASEURL/s/${encodeURIComponent(k)}</loc><lastmod>${builtAt}</lastmod></url>`)];
write("_d/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`);

// the 404 page of the server, as a file
const m = /const PAGE_404 = `([\s\S]*?)`;/.exec(fs.readFileSync(path.join(ROOT, "server.js"), "utf8"));
if (m) write("404.html", m[1]);

// headers of every response of the assets (the server adds the same four) and the long cache of fonts and product pictures
write("_headers", [
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "  X-Frame-Options: DENY",
  "/assets/product/*",
  "  Cache-Control: public, max-age=86400, stale-while-revalidate=604800",
  "/*.woff2",
  "  Cache-Control: public, max-age=86400, stale-while-revalidate=604800",
  ""
].join("\n"));

const files = (function count(d) { return fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : 1), 0); })(OUT);
console.log(`dist: ${files} files, ${towns} towns (${(bytes / 1e6).toFixed(0)} MB of models), built at ${st.builtAt}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
