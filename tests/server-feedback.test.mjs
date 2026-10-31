/**
 * tests/server-feedback.test.mjs
 *
 * Integration tests for:
 *   POST /api/feedback   (all cases)
 *   GET  /robots.txt
 *   GET  /sitemap.xml
 *   GET  /api/health     (features field)
 *
 * Each test group starts a fresh server on port 0 and tears it down afterwards.
 * The production server on port 8800 is never touched.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";

// Point the server's feedback store at a temporary file so integration tests
// never write to data/feedback.jsonl.  Must be set before the first require().
const _fbTmp = path.join(os.tmpdir(), `feedback-integration-${Date.now()}.jsonl`);
process.env.FEEDBACK_FILE = _fbTmp;

const require = createRequire(import.meta.url);
const { createServer } = require("../server.js");
const { createFeedbackStore } = require("../src/lib/feedback.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function startServer() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const close = () => new Promise((resolve) => server.close(resolve));
  return { server, origin, close };
}

function request(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function post(url, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  return request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": body.length, ...extraHeaders },
    body,
  });
}

function json(r) {
  return JSON.parse(r.body.toString("utf8"));
}

// ---------------------------------------------------------------------------
// /api/health – features field
// ---------------------------------------------------------------------------

test("/api/health has features.feedback=true", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await request(`${origin}/api/health`);
    assert.equal(r.status, 200);
    const b = json(r);
    assert.ok(b.features, "features field must be present");
    assert.equal(b.features.feedback, true);
    assert.equal(typeof b.features.share, "boolean", "features.share must be a boolean");
    // the bundle is served (GET /css/n.bundle.css), so the flag says so
    assert.equal(b.features.bundle, true);
    assert.equal((await request(`${origin}/css/n.bundle.css`)).status, 200);
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// /robots.txt
// ---------------------------------------------------------------------------

test("/robots.txt returns 200 text/plain", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await request(`${origin}/robots.txt`);
    assert.equal(r.status, 200);
    const ct = r.headers["content-type"] || "";
    assert.ok(ct.startsWith("text/plain"), `content-type must be text/plain, got ${ct}`);
  } finally {
    await close();
  }
});

test("/robots.txt allows all and points to sitemap using Host header", async () => {
  const { origin, close } = await startServer();
  const port = new URL(origin).port;
  try {
    const r = await request(`${origin}/robots.txt`, { headers: { host: `127.0.0.1:${port}` } });
    const text = r.body.toString("utf8");
    assert.ok(text.includes("User-agent: *"), "must have User-agent: *");
    assert.ok(text.includes("Allow: /"), "must allow all");
    assert.ok(text.includes(`http://127.0.0.1:${port}/sitemap.xml`), `must point to /sitemap.xml with correct host; got:\n${text}`);
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// /sitemap.xml
// ---------------------------------------------------------------------------

test("/sitemap.xml returns 200 application/xml", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await request(`${origin}/sitemap.xml`);
    assert.equal(r.status, 200);
    const ct = r.headers["content-type"] || "";
    assert.ok(ct.startsWith("application/xml"), `content-type must be application/xml, got ${ct}`);
  } finally {
    await close();
  }
});

test("/sitemap.xml is valid XML with urlset root", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await request(`${origin}/sitemap.xml`);
    const xml = r.body.toString("utf8");
    assert.ok(xml.startsWith("<?xml"), "must start with XML declaration");
    assert.ok(xml.includes("<urlset"), "must have urlset element");
    assert.ok(xml.includes("</urlset>"), "must close urlset element");
    assert.ok(xml.includes("<url>"), "must have at least one <url> element");
    assert.ok(xml.includes("<loc>"), "must have <loc> elements");
    assert.ok(xml.includes("<lastmod>"), "must have <lastmod> elements");
  } finally {
    await close();
  }
});

test("/sitemap.xml includes homepage", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await request(`${origin}/sitemap.xml`);
    const xml = r.body.toString("utf8");
    const port = new URL(origin).port;
    assert.ok(xml.includes(`http://127.0.0.1:${port}/</loc>`), "homepage URL must appear in sitemap");
  } finally {
    await close();
  }
});

test("/sitemap.xml contains /s/<key> for a known locality and key is percent-encoded", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await request(`${origin}/sitemap.xml`);
    const xml = r.body.toString("utf8");
    // Extract all /s/... paths from the sitemap
    const matches = [...xml.matchAll(/<loc>[^<]*\/s\/([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.ok(matches.length > 0, "sitemap must contain at least one /s/<key> URL");

    // Every key must be a valid percent-encoded token (no raw spaces, etc.)
    for (const encoded of matches.slice(0, 5)) {
      // Decoding and re-encoding must be stable
      try {
        const decoded = decodeURIComponent(encoded);
        const reEncoded = encodeURIComponent(decoded);
        assert.equal(encoded, reEncoded, `key ${encoded} must be properly percent-encoded`);
      } catch (e) {
        assert.fail(`key ${encoded} is not valid percent-encoding: ${e.message}`);
      }
    }

    // Specifically check that a known locality with non-ASCII characters is encoded.
    // The store has Hebrew locality keys (like "תל אביב יפו" → %D7%AA%D7%9C...).
    // Any key with a non-ASCII character must appear encoded, not raw.
    const rawHebrew = matches.find((k) => /[\u0590-\u05FF]/.test(k));
    assert.equal(rawHebrew, undefined, "Hebrew keys must be percent-encoded, not raw");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// POST /api/feedback – createFeedbackStore unit-level tests (no server)
// ---------------------------------------------------------------------------

function tmpFile() {
  return path.join(os.tmpdir(), `feedback-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
}

test("feedback: valid submission writes a JSONL line", () => {
  const file = tmpFile();
  try {
    const store = createFeedbackStore({ file, maxBytes: 1024 * 1024, limitPerHour: 100 });
    const result = store.submit({ message: "This is great!" }, "1.2.3.4");
    assert.deepEqual(result, { ok: true });
    const lines = fs.readFileSync(file, "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const rec = JSON.parse(lines[0]);
    assert.equal(rec.message, "This is great!");
    assert.ok(rec.at, "at timestamp must be present");
    assert.equal(rec.email, null);
    assert.equal(rec.context, null);
  } finally {
    try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});

test("feedback: optional email and context are stored", () => {
  const file = tmpFile();
  try {
    const store = createFeedbackStore({ file, limitPerHour: 100 });
    const result = store.submit({
      message: "Hello",
      email: "test@example.com",
      context: { key: "16", name: "תל אביב", indicator: "th_mmrv", route: "/c/16", url: "http://example.com", dataDate: "2024" }
    }, "1.2.3.4");
    assert.deepEqual(result, { ok: true });
    const rec = JSON.parse(fs.readFileSync(file, "utf8").trim());
    assert.equal(rec.email, "test@example.com");
    assert.equal(rec.context.key, "16");
    assert.equal(rec.context.indicator, "th_mmrv");
  } finally {
    try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});

test("feedback: empty message returns 400", () => {
  const store = createFeedbackStore({ file: tmpFile(), limitPerHour: 100 });
  const result = store.submit({ message: "" }, "1.2.3.4");
  assert.equal(result.status, 400);
  assert.ok(result.error);
});

test("feedback: missing message returns 400", () => {
  const store = createFeedbackStore({ file: tmpFile(), limitPerHour: 100 });
  const result = store.submit({ email: "a@b.com" }, "1.2.3.4");
  assert.equal(result.status, 400);
  assert.ok(result.error);
});

test("feedback: message too long (>2000) returns 400", () => {
  const store = createFeedbackStore({ file: tmpFile(), limitPerHour: 100 });
  const result = store.submit({ message: "x".repeat(2001) }, "1.2.3.4");
  assert.equal(result.status, 400);
  assert.ok(result.error);
});

test("feedback: invalid email returns 400", () => {
  const store = createFeedbackStore({ file: tmpFile(), limitPerHour: 100 });
  const result = store.submit({ message: "Hi", email: "not-an-email" }, "1.2.3.4");
  assert.equal(result.status, 400);
  assert.ok(result.error);
});

test("feedback: rate limit – 5th call ok, 6th returns 429", () => {
  const file = tmpFile();
  try {
    const store = createFeedbackStore({ file, limitPerHour: 5 });
    for (let i = 0; i < 5; i++) {
      const r = store.submit({ message: `msg ${i}` }, "9.8.7.6");
      assert.deepEqual(r, { ok: true }, `call ${i + 1} should succeed`);
    }
    const r6 = store.submit({ message: "one too many" }, "9.8.7.6");
    assert.equal(r6.status, 429);
  } finally {
    try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});

test("feedback: file full (>= maxBytes) returns 503", () => {
  const file = tmpFile();
  try {
    // Create a file that is already at capacity.
    fs.writeFileSync(file, "x".repeat(100));
    const store = createFeedbackStore({ file, maxBytes: 100, limitPerHour: 100 });
    const result = store.submit({ message: "Should be rejected" }, "1.2.3.4");
    assert.equal(result.status, 503);
  } finally {
    try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});

// ---------------------------------------------------------------------------
// POST /api/feedback – HTTP integration (413 on body > 8 KB)
// ---------------------------------------------------------------------------

test("POST /api/feedback with valid payload returns { ok: true }", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await post(`${origin}/api/feedback`, { message: "Integration test feedback" });
    assert.equal(r.status, 200);
    assert.deepEqual(json(r), { ok: true });
  } finally {
    await close();
  }
});

test("POST /api/feedback 413 when body > 8 KB", async () => {
  const { origin, close } = await startServer();
  try {
    // Build a JSON payload larger than 8 KB
    const huge = Buffer.from(JSON.stringify({ message: "a".repeat(9000) }), "utf8");
    const r = await request(`${origin}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": huge.length },
      body: huge,
    });
    assert.equal(r.status, 413);
  } finally {
    await close();
  }
});

test("POST /api/feedback 400 when message is missing", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await post(`${origin}/api/feedback`, { email: "a@b.com" });
    assert.equal(r.status, 400);
  } finally {
    await close();
  }
});

test("POST /api/feedback 400 when email is invalid", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await post(`${origin}/api/feedback`, { message: "Hi", email: "bad-email" });
    assert.equal(r.status, 400);
  } finally {
    await close();
  }
});

test("POST /api/feedback 429 after rate limit exceeded (per IP)", async () => {
  // Use the unit-level store directly to avoid hitting the shared production store's real rate state.
  const file = tmpFile();
  try {
    const store = createFeedbackStore({ file, limitPerHour: 2 });
    store.submit({ message: "first" }, "5.5.5.5");
    store.submit({ message: "second" }, "5.5.5.5");
    const r = store.submit({ message: "third" }, "5.5.5.5");
    assert.equal(r.status, 429);
  } finally {
    try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});

// ---------------------------------------------------------------------------
// POST /api/feedback – flat vs nested body shapes
// ---------------------------------------------------------------------------

test("feedback: flat body (no context field) is accepted and stored nested", () => {
  const file = tmpFile();
  try {
    const store = createFeedbackStore({ file, limitPerHour: 100 });
    const result = store.submit({
      message: "flat test",
      key: "16",
      name: "תל אביב",
      indicator: "th_mmrv",
      route: "/c/16",
      url: "http://example.com",
      dataDate: "2024"
    }, "1.2.3.4");
    assert.deepEqual(result, { ok: true });
    const rec = JSON.parse(fs.readFileSync(file, "utf8").trim());
    assert.equal(rec.message, "flat test");
    assert.ok(rec.context, "context must be present");
    assert.equal(rec.context.key, "16");
    assert.equal(rec.context.indicator, "th_mmrv");
  } finally {
    try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});

test("feedback: nested context body is accepted and stored nested", () => {
  const file = tmpFile();
  try {
    const store = createFeedbackStore({ file, limitPerHour: 100 });
    const result = store.submit({
      message: "nested test",
      context: { key: "16", name: "תל אביב", indicator: "th_mmrv", route: "/c/16", url: "http://example.com", dataDate: "2024" }
    }, "1.2.3.4");
    assert.deepEqual(result, { ok: true });
    const rec = JSON.parse(fs.readFileSync(file, "utf8").trim());
    assert.equal(rec.context.key, "16");
  } finally {
    try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});

test("feedback: when both flat and context present, context wins", () => {
  const file = tmpFile();
  try {
    const store = createFeedbackStore({ file, limitPerHour: 100 });
    const result = store.submit({
      message: "both test",
      key: "flat-key",
      context: { key: "nested-key" }
    }, "1.2.3.4");
    assert.deepEqual(result, { ok: true });
    const rec = JSON.parse(fs.readFileSync(file, "utf8").trim());
    assert.equal(rec.context.key, "nested-key", "context.key must win over flat key");
  } finally {
    try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});

test("feedback: non-string flat field returns 400", () => {
  const store = createFeedbackStore({ file: tmpFile(), limitPerHour: 100 });
  const result = store.submit({ message: "ok", key: 999 }, "1.2.3.4");
  assert.equal(result.status, 400);
  assert.ok(result.error);
});

test("feedback: invalid request does NOT consume a rate-limit slot", () => {
  // With limitPerHour=1, sending 1 invalid then 1 valid should both succeed (invalid doesn't count).
  const file = tmpFile();
  try {
    const store = createFeedbackStore({ file, limitPerHour: 1 });
    // Invalid: missing message
    const bad = store.submit({}, "10.0.0.1");
    assert.equal(bad.status, 400, "missing message must be 400");
    // Valid: must still succeed because the invalid request didn't use the slot
    const good = store.submit({ message: "ok" }, "10.0.0.1");
    assert.deepEqual(good, { ok: true }, "valid after invalid must succeed");
  } finally {
    try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});

test("feedback: bidi override characters are stripped from message and email", () => {
  const file = tmpFile();
  try {
    const store = createFeedbackStore({ file, limitPerHour: 100 });
    // U+202E (RLO), U+2066 (LRI), U+2029 (paragraph separator)
    const result = store.submit({
      message: "hello\u202Eworld\u2066test\u2069",
      email: "test\u2028@example.com"
    }, "1.2.3.4");
    assert.deepEqual(result, { ok: true });
    const rec = JSON.parse(fs.readFileSync(file, "utf8").trim());
    assert.ok(!rec.message.includes("\u202E"), "RLO must be stripped from message");
    assert.ok(!rec.message.includes("\u2066"), "LRI must be stripped from message");
    assert.ok(!rec.message.includes("\u2069"), "PDI must be stripped from message");
    assert.ok(!rec.email.includes("\u2028"), "line separator must be stripped from email");
    assert.equal(rec.message, "helloworldtest");
  } finally {
    try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
  }
});
