/**
 * tests/server-hardening.test.mjs
 *
 * Integration tests covering the four red-team hardening items:
 *   R-03  Prototype-pollution keys return 404 / 302, not real data or 500
 *   R-07  Host header is never injected raw; PUBLIC_BASE_URL; script escaping; 302 security headers
 *   R-09  Null bytes → 400, directory requests → 404, broken JSON POST → 400
 *   R-10  Method enforcement: 405 + Allow for disallowed methods; TRACE has no body
 *
 * Rules: no git, no port 8800, server on port 0 only, no edits under web/.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import http from "node:http";
import os from "node:os";
import path from "node:path";

// the feedback store of these servers is a temporary file: no test line may reach data/feedback.jsonl (set before the first require)
process.env.FEEDBACK_FILE = path.join(os.tmpdir(), `feedback-hardening-${Date.now()}.jsonl`);

const require = createRequire(import.meta.url);
const { createServer } = require("../server.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function startServer() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const close = () => new Promise((resolve) => server.close(resolve));
  return { server, origin, port, close };
}

function request(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port,
      path:     parsed.pathname + parsed.search,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      );
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function get(url, headers = {}) {
  return request(url, { method: "GET", headers });
}

function send(url, method, contentType, rawBody) {
  const buf = typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody;
  return request(url, {
    method,
    headers: { "Content-Type": contentType, "Content-Length": buf.length },
    body: buf,
  });
}

// ---------------------------------------------------------------------------
// R-03  Prototype-pollution: keys like __proto__, constructor, toString
// ---------------------------------------------------------------------------

test("R-03 GET /api/city/__proto__ returns 404, not 200", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/api/city/__proto__`);
    assert.equal(r.status, 404, `expected 404, got ${r.status}`);
  } finally {
    await close();
  }
});

test("R-03 GET /api/city/constructor returns 404", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/api/city/constructor`);
    assert.equal(r.status, 404);
  } finally {
    await close();
  }
});

test("R-03 GET /api/city/toString returns 404", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/api/city/toString`);
    assert.equal(r.status, 404);
  } finally {
    await close();
  }
});

test("R-03 GET /api/city/__proto__/export.csv returns 404", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/api/city/__proto__/export.csv`);
    assert.equal(r.status, 404);
  } finally {
    await close();
  }
});

test("R-03 GET /s/__proto__ returns 302 (redirect), not 200 share page", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/__proto__`);
    assert.equal(r.status, 302, `expected 302, got ${r.status}`);
  } finally {
    await close();
  }
});

test("R-03 GET /s/constructor returns 302", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/constructor`);
    assert.equal(r.status, 302);
  } finally {
    await close();
  }
});

test("R-03 GET /api/compare?keys=__proto__,constructor does not return 500", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/api/compare?keys=__proto__,constructor&ids=th_mmrv`);
    assert.notEqual(r.status, 500, `compare with proto keys must not 500; got ${r.status}`);
  } finally {
    await close();
  }
});

test("R-03 GET /api/compare mixing proto keys with real key: 200, no error field", async () => {
  const { origin, close } = await startServer();
  try {
    // "1031" is a real locality; __proto__ and 99999 are not
    const r = await get(`${origin}/api/compare?keys=1031,__proto__,99999&ids=th_mmrv`);
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body.toString("utf8"));
    assert.ok(!body.error, `must not have error field; got: ${JSON.stringify(body)}`);
    // proto key must not appear in the cities list
    const names = (body.cities || []).map((c) => c.key);
    assert.ok(!names.includes("__proto__"), "__proto__ must be stripped from compare cities");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// R-07  Host header injection
// ---------------------------------------------------------------------------

test("R-07 /s/<unknown> 302 Location is a relative path, not http://evil.example/...", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/99999`, { host: "evil.example" });
    assert.equal(r.status, 302);
    const loc = r.headers["location"] || "";
    assert.ok(!loc.includes("evil.example"), `Location must not contain injected host; got: ${loc}`);
    // Must be a relative path (starts with /) or a safe absolute URL
    assert.ok(loc.startsWith("/"), `302 Location must be relative; got: ${loc}`);
  } finally {
    await close();
  }
});

test("R-07 /robots.txt with evil Host does not contain the injected host", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/robots.txt`, { host: 'evil.example"</script><b>' });
    const text = r.body.toString("utf8");
    assert.ok(!text.includes("evil.example"), `robots.txt must not include injected host; got:\n${text}`);
  } finally {
    await close();
  }
});

test("R-07 /sitemap.xml with evil Host does not contain the injected host", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/sitemap.xml`, { host: 'evil.example"<script>' });
    const xml = r.body.toString("utf8");
    assert.ok(!xml.includes("evil.example"), `sitemap.xml must not include injected host; got:\n${xml}`);
  } finally {
    await close();
  }
});

test("R-07 /s/<valid key> script tag does not contain raw <", async () => {
  const { origin, close } = await startServer();
  try {
    // 1031 is a known real locality
    const r = await get(`${origin}/s/1031`);
    if (r.status !== 200) return; // sentence.js may not be loaded in test env – skip
    const html = r.body.toString("utf8");
    // Extract content of the <script> tag
    const m = html.match(/<script>([\s\S]*?)<\/script>/);
    if (!m) return; // no script block
    const script = m[1];
    // Must not contain a raw < that could break out of the script context
    assert.ok(!script.includes("<"), `script content must not contain raw <; got: ${script}`);
  } finally {
    await close();
  }
});

test("R-07 valid Host header is reflected correctly in robots.txt", async () => {
  const { origin, close, port } = await startServer();
  try {
    const r = await get(`${origin}/robots.txt`, { host: `127.0.0.1:${port}` });
    const text = r.body.toString("utf8");
    assert.ok(
      text.includes(`http://127.0.0.1:${port}/sitemap.xml`),
      `robots.txt must use valid host; got:\n${text}`
    );
  } finally {
    await close();
  }
});

test("R-07 302 on unknown share page carries security headers", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/99999`);
    assert.equal(r.status, 302);
    assert.ok(r.headers["x-content-type-options"], "302 must carry X-Content-Type-Options");
    assert.ok(r.headers["x-frame-options"], "302 must carry X-Frame-Options");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// R-09  Weird paths
// ---------------------------------------------------------------------------

test("R-09 GET /%00 returns 400, not 500", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/%00`);
    assert.equal(r.status, 400, `expected 400 for null-byte URL, got ${r.status}`);
  } finally {
    await close();
  }
});

test("R-09 GET /index.html%00.png returns 400, not 500", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/index.html%00.png`);
    assert.equal(r.status, 400, `expected 400 for null-byte URL, got ${r.status}`);
  } finally {
    await close();
  }
});

test("R-09 GET /js/product/ (directory) returns 404, not 500", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/js/product/`);
    assert.equal(r.status, 404, `expected 404 for directory request, got ${r.status}`);
  } finally {
    await close();
  }
});

test("R-09 GET /css (directory) returns 404, not 500", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/css`);
    assert.equal(r.status, 404, `expected 404 for directory request, got ${r.status}`);
  } finally {
    await close();
  }
});

test("R-09 POST /api/ask with broken JSON returns 400, not 500", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await send(`${origin}/api/ask`, "POST", "application/json", "{broken json!!!");
    assert.equal(r.status, 400, `expected 400 for bad JSON, got ${r.status}`);
  } finally {
    await close();
  }
});

test("R-09 POST /api/feedback with broken JSON returns 400, not 500", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await send(`${origin}/api/feedback`, "POST", "application/json", "{bad");
    assert.equal(r.status, 400, `expected 400 for bad JSON, got ${r.status}`);
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// R-10  Method enforcement
// ---------------------------------------------------------------------------

test("R-10 DELETE /n.html returns 405 with Allow header", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await request(`${origin}/n.html`, { method: "DELETE" });
    assert.equal(r.status, 405);
    assert.ok(r.headers["allow"], "405 must include Allow header");
  } finally {
    await close();
  }
});

test("R-10 PUT /api/health returns 405 with Allow header", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await request(`${origin}/api/health`, { method: "PUT" });
    assert.equal(r.status, 405);
    assert.ok(r.headers["allow"], "405 must include Allow header");
  } finally {
    await close();
  }
});

test("R-10 POST /api/city/1031 returns 405 (read-only endpoint)", async () => {
  const { origin, close } = await startServer();
  try {
    const body = Buffer.from("{}");
    const r = await request(`${origin}/api/city/1031`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": body.length },
      body,
    });
    assert.equal(r.status, 405);
    const allow = r.headers["allow"] || "";
    assert.ok(allow.includes("GET"), `Allow must include GET; got: ${allow}`);
  } finally {
    await close();
  }
});

test("R-10 TRACE /n.html returns 405 with no body", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await request(`${origin}/n.html`, { method: "TRACE" });
    assert.equal(r.status, 405);
    assert.equal(r.body.length, 0, "TRACE response must have an empty body");
  } finally {
    await close();
  }
});

test("R-10 OPTIONS /n.html returns 405 (not 200)", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await request(`${origin}/n.html`, { method: "OPTIONS" });
    assert.equal(r.status, 405);
  } finally {
    await close();
  }
});

test("R-10 GET /api/health still works (GET is allowed everywhere)", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/api/health`);
    assert.equal(r.status, 200);
  } finally {
    await close();
  }
});

test("R-10 POST /api/feedback is allowed (POST endpoint)", async () => {
  const { origin, close } = await startServer();
  try {
    const body = Buffer.from(JSON.stringify({ message: "hardening test" }));
    const r = await request(`${origin}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": body.length },
      body,
    });
    // 200 or 429 (rate limit) are both fine — the point is it is not 405
    assert.notEqual(r.status, 405, "POST /api/feedback must not return 405");
  } finally {
    await close();
  }
});
