/**
 * tests/server-css-bundle.test.mjs
 *
 * Tests for GET /css/n.bundle.css:
 *   1. No @import statements remain in the bundle.
 *   2. Every url() that points to a relative file resolves to an absolute path
 *      that exists under web/.
 *   3. CSS rule order: the first rule of tokens.css appears before the first
 *      rule of shell.css (tokens comes before shell in product.css).
 *   4. HTTP: 200, correct Content-Type, ETag present, Cache-Control: no-cache.
 *   5. 304 on If-None-Match with the returned ETag.
 *   6. Compression when Accept-Encoding: gzip.
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

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB  = path.join(ROOT, "web");

// ── helpers ──────────────────────────────────────────────────────────────────

async function startServer() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const close = () => new Promise((resolve) => server.close(resolve));
  return { server, origin, close };
}

function get(url, reqHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
        );
      }
    );
    req.on("error", reject);
    req.end();
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

test("/css/n.bundle.css returns 200 with correct content-type", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/css/n.bundle.css`);
    assert.equal(r.status, 200, "must be 200");
    assert.ok(
      r.headers["content-type"]?.startsWith("text/css"),
      `content-type must be text/css, got: ${r.headers["content-type"]}`
    );
  } finally {
    await close();
  }
});

test("/css/n.bundle.css has ETag and Cache-Control: no-cache", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/css/n.bundle.css`);
    assert.ok(r.headers["etag"], "ETag must be present");
    assert.ok(
      r.headers["cache-control"]?.includes("no-cache"),
      `cache-control must include no-cache, got: ${r.headers["cache-control"]}`
    );
  } finally {
    await close();
  }
});

test("/css/n.bundle.css returns 304 on If-None-Match", async () => {
  const { origin, close } = await startServer();
  try {
    const r1 = await get(`${origin}/css/n.bundle.css`);
    assert.equal(r1.status, 200);
    const etag = r1.headers["etag"];
    assert.ok(etag, "first response must have ETag");

    const r2 = await get(`${origin}/css/n.bundle.css`, { "if-none-match": etag });
    assert.equal(r2.status, 304, "second request with matching ETag must return 304");
    assert.equal(r2.body.length, 0, "304 body must be empty");
  } finally {
    await close();
  }
});

test("/css/n.bundle.css is gzip-compressed when Accept-Encoding: gzip", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/css/n.bundle.css`, { "accept-encoding": "gzip" });
    assert.equal(r.status, 200);
    assert.equal(r.headers["content-encoding"], "gzip", "must be gzip encoded");
    const decompressed = zlib.gunzipSync(r.body).toString("utf8");
    assert.ok(decompressed.length > 100, "decompressed content must be non-trivial");
  } finally {
    await close();
  }
});

// ── bundle content checks (using buildBundle directly) ─────────────────────

const { buildBundle } = require("../src/lib/css-bundle.js");
const cfg = require("../src/lib/config.js");

test("bundle contains no @import statements", () => {
  const { css } = buildBundle(cfg.CSS_BUNDLE_FILES, WEB);
  // Strip string literals to avoid false positives inside comments or strings.
  // Use a simple approach: find any @import that is not inside a comment block.
  // (Real @import lines start at the beginning or after whitespace.)
  const importMatch = css.match(/@import\s/);
  assert.ok(!importMatch, `bundle must not contain @import; found: ${importMatch?.[0]}`);
});

test("bundle: every url() that points to an existing file resolves under web/", () => {
  const { css } = buildBundle(cfg.CSS_BUNDLE_FILES, WEB);

  // Extract all url("...") references (quoted form only; skip data: and http)
  const urlRe = /url\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  const bad = [];

  while ((match = urlRe.exec(css)) !== null) {
    const ref = match[1].trim();

    // Skip data URIs and external URLs.
    if (
      ref.startsWith("data:") ||
      ref.startsWith("http:") ||
      ref.startsWith("https:") ||
      ref.startsWith("//")
    ) {
      continue;
    }

    // Absolute paths (starting with /) must exist under WEB.
    if (ref.startsWith("/")) {
      const abs = path.join(WEB, ref);
      if (!fs.existsSync(abs)) {
        bad.push({ ref, reason: "file not found under web/" });
      }
      continue;
    }

    // Relative paths should not appear (the bundler rewrites them all).
    bad.push({ ref, reason: "url() is still relative (not rewritten)" });
  }

  assert.deepEqual(
    bad,
    [],
    `unexpected url() references:\n${bad.map((b) => `  ${b.ref} — ${b.reason}`).join("\n")}`
  );
});

test("bundle: tokens.css rules appear before shell.css rules", () => {
  const { css } = buildBundle(cfg.CSS_BUNDLE_FILES, WEB);

  // The first distinctive token of tokens.css is the html[data-ui="n"] selector
  // with --bg: #F5F7FA (light scheme).
  // The first distinctive rule of shell.css (after @font-face) uses scroll-padding-top.
  const tokensMarker = 'html[data-ui="n"] {';
  const shellMarker  = "scroll-padding-top";

  const tokensIdx = css.indexOf(tokensMarker);
  const shellIdx  = css.indexOf(shellMarker);

  assert.ok(tokensIdx !== -1, "tokens.css marker must be present in the bundle");
  assert.ok(shellIdx  !== -1, "shell.css marker must be present in the bundle");
  assert.ok(
    tokensIdx < shellIdx,
    `tokens.css (pos ${tokensIdx}) must appear before shell.css (pos ${shellIdx})`
  );
});
