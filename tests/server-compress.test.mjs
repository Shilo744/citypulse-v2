/**
 * tests/server-compress.test.mjs
 *
 * The compression of answers (src/lib/compress.js) and the warm-up of its cache (server.js):
 *   - an answer with a cache key is compressed once at the best level, the body decodes to the same bytes;
 *   - a client that sends gzip only gets gzip, one that sends nothing gets the raw bytes;
 *   - concurrent first requests for one key get the same answer and share one compression;
 *   - a new version of a path drops the older one, so the cache does not grow;
 *   - an answer without a key (dynamic JSON) is not kept, and is not larger than gzip;
 *   - the warm-up skips what is already compressed, survives a vanished file and fills the same keys the server asks for.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import zlib from "node:zlib";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const { createServer, warmFiles, listWarmFiles } = require("../server.js");
const compress = require("../src/lib/compress.js");
const { buildBundle } = require("../src/lib/css-bundle.js");
const cfg = require("../src/lib/config.js");

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "web");

// ── helpers ──────────────────────────────────────────────────────────────────
async function startServer() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, close: () => new Promise((resolve) => server.close(resolve)) };
}

function get(url, headers = {}, method = "GET") {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

// a response object that resolves when the answer has been written
function fakeRes() {
  const r = { code: null, headers: null, body: null };
  r.done = new Promise((resolve) => {
    r.writeHead = (c, h) => { r.code = c; r.headers = h; };
    r.end = (b) => { r.body = b; resolve(r); };
  });
  return r;
}
const reqOf = (ae) => ({ headers: ae === undefined ? {} : { "accept-encoding": ae } });

// a text body of about 30 KB that compresses well, the same on every call
function textBody(seed = "x") {
  const lines = [];
  for (let i = 0; i < 700; i++) lines.push(`{"id":"${seed}${i}","name":"יישוב מספר ${i}","status":"${i % 3 ? "תקין" : "למעקב"}","v":${(i * 7.31) % 100}}`);
  return Buffer.from("[" + lines.join(",\n") + "]", "utf8");
}

// ── direct tests of sendBuf ──────────────────────────────────────────────────
test("compress: an answer with a key is brotli, the body decodes to the same bytes, the length header is right", async () => {
  compress.reset();
  const buf = textBody("a");
  const res = fakeRes();
  await compress.sendBuf(reqOf("gzip, deflate, br"), res, 200, { "Content-Type": "application/json" }, buf, "/p/a.json|111");
  await res.done;
  assert.equal(res.code, 200);
  assert.equal(res.headers["Content-Encoding"], "br");
  assert.equal(res.headers["Vary"], "Accept-Encoding");
  assert.equal(res.headers["Content-Length"], res.body.length, "Content-Length is the length of the compressed body");
  assert.ok(res.body.length < buf.length / 3, "text must shrink a lot");
  assert.deepEqual(zlib.brotliDecompressSync(res.body), buf, "decodes to the same bytes");
  // the best level: not larger than the fast level the dynamic answers use
  const fast = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: compress.FAST_QUALITY } });
  assert.ok(res.body.length <= fast.length, `quality ${compress.BEST_QUALITY} (${res.body.length}) must not be larger than quality ${compress.FAST_QUALITY} (${fast.length})`);
});

test("compress: a client that sends gzip only gets gzip; one that sends nothing gets the raw bytes", async () => {
  compress.reset();
  const buf = textBody("b");
  const g = fakeRes();
  await compress.sendBuf(reqOf("gzip"), g, 200, {}, buf, "/p/b.json|1");
  await g.done;
  assert.equal(g.headers["Content-Encoding"], "gzip");
  assert.equal(g.headers["Content-Length"], g.body.length);
  assert.deepEqual(zlib.gunzipSync(g.body), buf);

  for (const ae of [undefined, "", "identity", "br;q=0, gzip;q=0", "br; q=0, gzip; q=0"]) {
    const n = fakeRes();
    await compress.sendBuf(reqOf(ae), n, 200, {}, buf, "/p/b.json|1");
    await n.done;
    assert.equal(n.headers["Content-Encoding"], undefined, `no encoding for Accept-Encoding ${JSON.stringify(ae)}`);
    assert.equal(n.headers["Vary"], "Accept-Encoding");
    assert.equal(n.headers["Content-Length"], buf.length);
    assert.deepEqual(n.body, buf, "the raw bytes");
  }
  // the same path in both encodings is two entries of one record, not two paths
  assert.equal(compress.stats().paths, 1);
});

test("compress: concurrent first requests for one key get the same answer and share one compression", async () => {
  compress.reset();
  const buf = textBody("c");
  const before = compress.stats().encodes;
  const rs = [fakeRes(), fakeRes(), fakeRes()];
  const pending = rs.map((r) => compress.sendBuf(reqOf("br"), r, 200, {}, buf, "/p/c.json|7"));
  assert.ok(pending.every((p) => p && typeof p.then === "function"), "a first request waits for the compression, it is not answered half compressed");
  assert.ok(rs.every((r) => r.body === null), "nothing is written before the compression is ready");
  await Promise.all(pending);
  assert.equal(compress.stats().encodes - before, 1, "one compression for three requests");
  for (const r of rs) {
    assert.equal(r.headers["Content-Encoding"], "br");
    assert.deepEqual(r.body, rs[0].body, "the same bytes");
    assert.equal(r.headers["Content-Length"], r.body.length);
  }
  // later requests are served at once from the cache
  const late = fakeRes();
  const ret = compress.sendBuf(reqOf("br"), late, 200, {}, buf, "/p/c.json|7");
  assert.equal(ret, undefined, "a ready entry is answered synchronously");
  assert.deepEqual(late.body, rs[0].body);
  assert.equal(compress.stats().encodes - before, 1);
});

test("compress: a new version of a path drops the older one, the cache stays bounded", async () => {
  compress.reset();
  const buf1 = textBody("d1");
  const buf2 = textBody("d2");
  const r1 = fakeRes();
  await compress.sendBuf(reqOf("br"), r1, 200, {}, buf1, "/p/d.js|100");
  const bytes1 = compress.stats().bytes;
  assert.ok(bytes1 > 0);
  const r2 = fakeRes();
  await compress.sendBuf(reqOf("br"), r2, 200, {}, buf2, "/p/d.js|200");
  await r2.done;
  const s = compress.stats();
  assert.equal(s.paths, 1, "one path, one version");
  assert.equal(s.bytes, r2.body.length, "only the newer body is counted");
  assert.deepEqual(zlib.brotliDecompressSync(r2.body), buf2, "the new version is served, not the old one");
  // many different paths: the number of paths never passes the limit, and the sum of bytes stays counted right
  for (let i = 0; i < 40; i++) await compress.sendBuf(reqOf("gzip"), fakeRes(), 200, {}, buf1, `/p/many${i}.js|1`);
  const s2 = compress.stats();
  assert.equal(s2.paths, 41);
  assert.ok(s2.bytes > 0 && s2.bytes < 64 * 1024 * 1024);
});

test("compress: an answer without a key is compressed on the spot, not kept, not larger than gzip, not larger than the body", async () => {
  compress.reset();
  const buf = textBody("e");
  const res = fakeRes();
  const ret = compress.sendBuf(reqOf("br, gzip"), res, 200, {}, buf);
  assert.equal(ret, undefined, "synchronous");
  assert.equal(res.headers["Content-Encoding"], "br");
  assert.equal(res.headers["Content-Length"], res.body.length);
  assert.deepEqual(zlib.brotliDecompressSync(res.body), buf);
  assert.ok(res.body.length <= zlib.gzipSync(buf).length, "brotli must not be larger than gzip for text");
  assert.equal(compress.stats().paths, 0, "nothing is kept for a dynamic answer");

  const gz = fakeRes();
  compress.sendBuf(reqOf("gzip"), gz, 200, {}, buf);
  assert.equal(gz.headers["Content-Encoding"], "gzip");
  assert.deepEqual(zlib.gunzipSync(gz.body), buf);

  // random bytes do not shrink: the plain body is sent, with the right length
  const noise = crypto.randomBytes(4096);
  for (const key of [undefined, "/p/noise.bin|1"]) {
    const n = fakeRes();
    await compress.sendBuf(reqOf("br"), n, 200, {}, noise, key);
    await n.done;
    assert.equal(n.headers["Content-Encoding"], undefined);
    assert.equal(n.headers["Content-Length"], noise.length);
    assert.deepEqual(n.body, noise);
  }
});

test("compress: a connection that went away is not written to, and nothing throws", async () => {
  compress.reset();
  const res = fakeRes();
  res.destroyed = true;
  await compress.sendBuf(reqOf("br"), res, 200, {}, textBody("f"), "/p/f.js|1");
  assert.equal(res.body, null);
});

// ── through the server ───────────────────────────────────────────────────────
test("server: the css bundle in brotli, gzip and plain decodes to the same bytes, with the right headers", async () => {
  const expected = Buffer.from(buildBundle(cfg.CSS_BUNDLE_FILES, WEB).css, "utf8");
  const { origin, close } = await startServer();
  try {
    const br = await get(`${origin}/css/n.bundle.css`, { "accept-encoding": "gzip, deflate, br" });
    assert.equal(br.status, 200);
    assert.equal(br.headers["content-encoding"], "br");
    assert.equal(br.headers["vary"], "Accept-Encoding");
    assert.equal(Number(br.headers["content-length"]), br.body.length);
    assert.deepEqual(zlib.brotliDecompressSync(br.body), expected);
    const gz = await get(`${origin}/css/n.bundle.css`, { "accept-encoding": "gzip" });
    assert.equal(gz.headers["content-encoding"], "gzip");
    assert.deepEqual(zlib.gunzipSync(gz.body), expected);
    assert.ok(br.body.length < gz.body.length, "brotli must beat gzip on the css bundle");
    const plain = await get(`${origin}/css/n.bundle.css`, {});
    assert.equal(plain.headers["content-encoding"], undefined);
    assert.equal(Number(plain.headers["content-length"]), expected.length);
    assert.deepEqual(plain.body, expected);
    // the best level is smaller than the fast one the dynamic answers use
    const fast = zlib.brotliCompressSync(expected, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } });
    assert.ok(br.body.length < fast.length, `bundle ${br.body.length} must be smaller than brotli 4 (${fast.length})`);
  } finally {
    await close();
  }
});

test("server: concurrent first requests for a static file get one answer", async () => {
  compress.reset();
  const file = path.join(WEB, "js", "product", "app.js");
  const raw = fs.readFileSync(file);
  const { origin, close } = await startServer();
  try {
    const rs = await Promise.all([1, 2, 3, 4].map(() => get(`${origin}/js/product/app.js`, { "accept-encoding": "br" })));
    for (const r of rs) {
      assert.equal(r.status, 200);
      assert.equal(r.headers["content-encoding"], "br");
      assert.deepEqual(r.body, rs[0].body);
      assert.deepEqual(zlib.brotliDecompressSync(r.body), raw);
    }
    assert.equal(compress.stats().encodes, 1, "one compression for four requests");
  } finally {
    await close();
  }
});

test("server: a font is already compressed and is sent as it is", async () => {
  const file = path.join(WEB, "assets", "fonts", "heebo-hebrew.woff2");
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/assets/fonts/heebo-hebrew.woff2`, { "accept-encoding": "gzip, br" });
    assert.equal(r.status, 200);
    assert.equal(r.headers["content-encoding"], undefined);
    assert.equal(Number(r.headers["content-length"]), fs.statSync(file).size);
  } finally {
    await close();
  }
});

test("server: dynamic JSON is compressed, decodes to the same bytes, and brotli is not larger than gzip", async () => {
  const { origin, close } = await startServer();
  try {
    const plain = await get(`${origin}/api/meta`, {});
    const br = await get(`${origin}/api/meta`, { "accept-encoding": "br" });
    const gz = await get(`${origin}/api/meta`, { "accept-encoding": "gzip" });
    assert.equal(br.headers["content-encoding"], "br");
    assert.equal(gz.headers["content-encoding"], "gzip");
    assert.deepEqual(zlib.brotliDecompressSync(br.body), plain.body);
    assert.deepEqual(zlib.gunzipSync(gz.body), plain.body);
    assert.ok(br.body.length <= gz.body.length, `brotli (${br.body.length}) must not be larger than gzip (${gz.body.length})`);
  } finally {
    await close();
  }
});

// ── the warm-up ──────────────────────────────────────────────────────────────
test("warm-up: lists the compressible files first-load first, and none of the already compressed", async () => {
  const files = await listWarmFiles(WEB);
  const rel = files.map((f) => path.relative(WEB, f).split(path.sep).join("/"));
  assert.equal(rel[0], "n.html", "the page comes first");
  assert.ok(rel.includes("js/product/app.js") && rel.includes("css/app.css"));
  assert.ok(rel.indexOf("js/product/app.js") < rel.indexOf("css/app.css"), "scripts of the product before old stylesheets");
  assert.ok(!rel.some((f) => /\.(webp|png|woff2|jpg|ico)$/.test(f)), "images and fonts are not compressed again");
  assert.ok(rel.every((f) => /\.(js|mjs|css|html|svg|json)$/.test(f)));
  assert.deepEqual(await listWarmFiles(path.join(ROOT, "no-such-folder")), [], "a missing folder is an empty list, not a crash");
});

test("warm-up: survives a vanished file, and fills the key the server asks for", async () => {
  compress.reset();
  const file = path.join(WEB, "js", "product", "app.js");
  const gone = path.join(WEB, "js", "product", "vanished-before-warm.js");
  const done = await warmFiles([gone, file, path.join(WEB, "js")], 2);   // a missing file, a real one, a folder
  assert.equal(done.files, 1);
  assert.equal(done.skipped, 2);
  assert.equal(compress.stats().encodes, 1);
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/js/product/app.js`, { "accept-encoding": "br" });
    assert.equal(r.headers["content-encoding"], "br");
    assert.deepEqual(zlib.brotliDecompressSync(r.body), fs.readFileSync(file));
    assert.equal(compress.stats().encodes, 1, "the request found the warmed entry: no new compression");
  } finally {
    await close();
  }
});
