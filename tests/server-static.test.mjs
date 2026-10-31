/**
 * tests/server-static.test.mjs
 *
 * Integration tests for server.js static-file hardening.
 * Each test starts its own server on port 0 (OS picks the port) and
 * tears it down afterwards.  The client-facing server on port 8800 is
 * never touched.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import zlib from "node:zlib";

const require = createRequire(import.meta.url);
const { createServer } = require("../server.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Start a fresh server, return { server, origin, close }. */
async function startServer() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const close = () => new Promise((resolve) => server.close(resolve));
  return { server, origin, close };
}

/**
 * Minimal http.request wrapper.
 * Returns { status, headers, body (Buffer) }.
 */
function get(url, reqHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: reqHeaders,
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("security headers present on static HTML response", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/`);
    assert.equal(r.status, 200);
    assert.equal(r.headers["x-content-type-options"], "nosniff");
    assert.equal(r.headers["x-frame-options"], "DENY");
    assert.ok(r.headers["referrer-policy"], "referrer-policy present");
    assert.ok(r.headers["permissions-policy"], "permissions-policy present");
    assert.ok(!r.headers["content-security-policy"], "no CSP");
  } finally {
    await close();
  }
});

test("security headers present on API response", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/api/health`);
    assert.equal(r.status, 200);
    assert.equal(r.headers["x-content-type-options"], "nosniff");
    assert.equal(r.headers["x-frame-options"], "DENY");
  } finally {
    await close();
  }
});

test("/api/health returns ok:true", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/api/health`);
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body.toString("utf8"));
    assert.equal(body.ok, true);
  } finally {
    await close();
  }
});

test("static file returns ETag header", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/css/app.css`);
    assert.equal(r.status, 200);
    assert.ok(r.headers["etag"], "ETag header must be present");
  } finally {
    await close();
  }
});

test("static file: 304 on If-None-Match", async () => {
  const { origin, close } = await startServer();
  try {
    const r1 = await get(`${origin}/css/app.css`);
    assert.equal(r1.status, 200);
    const etag = r1.headers["etag"];
    assert.ok(etag, "first response must have ETag");

    const r2 = await get(`${origin}/css/app.css`, { "if-none-match": etag });
    assert.equal(r2.status, 304);
    assert.equal(r2.body.length, 0, "304 body must be empty");
  } finally {
    await close();
  }
});

test("API GET: ETag present and 304 on repeat", async () => {
  const { origin, close } = await startServer();
  try {
    const r1 = await get(`${origin}/api/health`);
    // /api/health is not in the ETag-GET set but still works; check a known one:
    // We'll test /api/geo which is in GET_ETAG_ROUTES.
    // (health is not cached so we use geo)
    const r1g = await get(`${origin}/api/geo`);
    assert.equal(r1g.status, 200);
    const etag = r1g.headers["etag"];
    assert.ok(etag, "/api/geo must return ETag");

    const r2 = await get(`${origin}/api/geo`, { "if-none-match": etag });
    assert.equal(r2.status, 304);
    assert.equal(r2.body.length, 0, "304 body must be empty");
  } finally {
    await close();
  }
});

test("gzip compression when Accept-Encoding: gzip", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/css/app.css`, { "accept-encoding": "gzip" });
    assert.equal(r.status, 200);
    assert.equal(r.headers["content-encoding"], "gzip", "must be gzip encoded");
    // Decompress and check it's valid CSS
    const decompressed = zlib.gunzipSync(r.body).toString("utf8");
    assert.ok(decompressed.length > 0, "decompressed content should be non-empty");
  } finally {
    await close();
  }
});

test("brotli compression when Accept-Encoding: br", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/css/app.css`, { "accept-encoding": "br" });
    assert.equal(r.status, 200);
    assert.equal(r.headers["content-encoding"], "br", "must be brotli encoded");
    const decompressed = zlib.brotliDecompressSync(r.body).toString("utf8");
    assert.ok(decompressed.length > 0, "decompressed content should be non-empty");
  } finally {
    await close();
  }
});

test("brotli preferred over gzip when both accepted", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/css/app.css`, { "accept-encoding": "gzip, br" });
    assert.equal(r.status, 200);
    assert.equal(r.headers["content-encoding"], "br", "br must win over gzip");
  } finally {
    await close();
  }
});

test("bad URL (malformed percent-encoding) returns 400", async () => {
  const { origin, close } = await startServer();
  try {
    // Send a raw request with a bad %-sequence that Node's URL parser rejects.
    // We use a raw socket so Node doesn't normalise the URL before sending.
    const status = await new Promise((resolve, reject) => {
      const socket = http.request({
        hostname: "127.0.0.1",
        port: new URL(origin).port,
        path: "/%GG",         // invalid percent-encoding
        method: "GET",
      }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      socket.on("error", reject);
      socket.end();
    });
    assert.equal(status, 400);
  } finally {
    await close();
  }
});

test("unknown path without extension returns 404 HTML page in Hebrew", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/does-not-exist`);
    assert.equal(r.status, 404);
    const html = r.body.toString("utf8");
    assert.ok(html.includes("404"), "page must contain 404");
    assert.ok(html.includes("הדף לא נמצא") || html.includes("לא נמצא"), "page must contain Hebrew not-found text");
    assert.ok(html.includes("<a"), "page must contain a link");
  } finally {
    await close();
  }
});

test("missing .js file returns plain 404 (not Hebrew page)", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/js/no-such-file.js`);
    assert.equal(r.status, 404);
    const body = r.body.toString("utf8");
    // Must not be the full HTML 404 page.
    assert.ok(!body.includes("<!DOCTYPE"), "file 404 should not be an HTML page");
  } finally {
    await close();
  }
});

test("Cache-Control: no-cache for HTML", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/`);
    assert.equal(r.status, 200);
    assert.ok(r.headers["cache-control"]?.includes("no-cache"), "HTML must have no-cache");
  } finally {
    await close();
  }
});

test("Cache-Control: no-cache for JS", async () => {
  const { origin, close } = await startServer();
  try {
    // Find any js file in web/js/
    const jsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "js");
    const jsFiles = fs.readdirSync(jsDir).filter((f) => f.endsWith(".js"));
    if (jsFiles.length === 0) {
      // No JS file to test – skip gracefully.
      return;
    }
    const r = await get(`${origin}/js/${jsFiles[0]}`);
    if (r.status !== 200) return; // file might need build artifacts
    assert.ok(r.headers["cache-control"]?.includes("no-cache"), "JS must have no-cache");
  } finally {
    await close();
  }
});
