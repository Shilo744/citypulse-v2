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

// the description of the API for agent platforms (watsonx Orchestrate imports it as a tool set): two tools, small answers; BASEURL becomes the address of the site
const kv = (type, description, extra = {}) => ({ type, description, ...extra });
write("_d/openapi.json", JSON.stringify({
  openapi: "3.0.3",
  info: { title: "CityPulse", version: "2.0.0", description: "Official public-health figures for every Israeli locality (Health Ministry, CBS, National Insurance), set against the country and against similar localities. Every figure comes from the data; none is estimated." },
  servers: [{ url: "BASEURL" }],
  paths: {
    "/api/search": { get: {
      operationId: "searchLocality", summary: "Find a locality by its name",
      description: "Returns up to 12 localities whose name matches the text (Hebrew). Use it first to get the key of a locality named by the user; the key is what the other tool needs.",
      parameters: [{ name: "q", in: "query", required: true, description: "Part of the locality name, in Hebrew, for example: שדרות", schema: { type: "string" } }],
      responses: { 200: { description: "A list of localities", content: { "application/json": { schema: { type: "array", items: { type: "object", properties: { key: kv("string", "The locality key (a number as text)"), name: kv("string", "The locality name") }, additionalProperties: true } } } } } }
    } },
    "/api/ask": { post: {
      operationId: "askAboutLocality", summary: "Answer a question about the public health of one locality",
      description: "Answers a question in Hebrew about one locality from the official data: where it stands against the country, what needs attention, what changed over the years, how it compares with other localities named in the question. Every number in the answer comes from the data. Show page.answer exactly as written, then the blocks in page.blocks in short; never add, round or compute figures yourself.",
      requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["city", "question"], properties: {
        city: kv("string", "The key of the locality the question is about (from searchLocality), for example 1031 for שדרות"),
        question: kv("string", "The question, in Hebrew, as the user asked it. Other localities may be named in it for a comparison."),
        noModel: kv("boolean", "Always true: the figures are brought by the keyword planner and your own model writes the reply", { default: true })
      } } } } },
      responses: { 200: { description: "A page: a title, an answer sentence and blocks (figures, trends, comparison tables) with their sources", content: { "application/json": { schema: { type: "object", properties: {
        question: kv("string", "The question as received"), via: kv("string", "keywords"), city: { type: "object", properties: { key: { type: "string" }, name: { type: "string" } } },
        page: { type: "object", description: "title, answer (a sentence, figures inside it are final) and blocks", additionalProperties: true }
      }, additionalProperties: true } } } }, 400: { description: "Empty question or unknown locality key" } }
    } }
  }
}));

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
