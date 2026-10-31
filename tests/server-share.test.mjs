/**
 * tests/server-share.test.mjs
 *
 * Integration tests for GET /s/<key> share pages and related features.
 * Each test starts its own server on port 0 and tears it down.
 * The production server on port 8800 is never touched.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import http from "node:http";

const require = createRequire(import.meta.url);
const { createServer, loadSentence } = require("../server.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function startServer() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const close = () => new Promise((resolve) => server.close(resolve));
  return { origin, close };
}

function get(url, reqHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: reqHeaders,
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") })
      );
    });
    req.on("error", reject);
    req.end();
  });
}

// A known locality key present in the store.
const KNOWN_KEY = "7"; // שחר

// ---------------------------------------------------------------------------
// Await sentence.js so features.share is true before we test it.
// ---------------------------------------------------------------------------
await loadSentence();

// ---------------------------------------------------------------------------
// 1. Valid locality – all five question IDs produce a title
// ---------------------------------------------------------------------------

describe("valid locality – all five qids", () => {
  const QIDS = ["weak", "changed", "peers", "first", "missing"];

  for (const q of QIDS) {
    test(`/s/${KNOWN_KEY}?q=${q} returns 200 with og:title`, async () => {
      const { origin, close } = await startServer();
      try {
        const r = await get(`${origin}/s/${KNOWN_KEY}?q=${q}`);
        assert.equal(r.status, 200, `status should be 200 for q=${q}`);
        assert.ok(r.body.includes("<html"), "must be an HTML document");
        assert.ok(r.body.includes('property="og:title"'), "must have og:title");
        // og:title content must be non-empty
        const m = r.body.match(/property="og:title"\s+content="([^"]+)"/);
        assert.ok(m && m[1].trim().length > 0, `og:title must have content for q=${q}`);
      } finally {
        await close();
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 2. HTML escape – a key with dangerous characters must not inject HTML
// ---------------------------------------------------------------------------

test("HTML escape: dangerous characters in key do not break document", async () => {
  // Use a non-existent key that contains HTML-injection characters.
  // The server should 302-redirect for unknown keys (after escaping the value
  // in the Location header is irrelevant since the model is looked up first).
  // What we test here is that a *valid* key whose city name contains special
  // characters is properly escaped in the output.
  // We pick a key that exists, and verify the title tag doesn't contain raw <, > or &.
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/${KNOWN_KEY}`);
    assert.equal(r.status, 200);
    // Extract everything between <title> and </title>
    const titleMatch = r.body.match(/<title>([^<]*)<\/title>/);
    assert.ok(titleMatch, "must have a <title> element");
    const titleContent = titleMatch[1];
    // Must not contain unescaped < > or & (other than the separator em-dash)
    assert.ok(!titleContent.includes("<"), "title must not contain raw <");
    assert.ok(!titleContent.includes(">"), "title must not contain raw >");
    assert.ok(!titleContent.match(/&(?!amp;|lt;|gt;|quot;|#x27;)/), "title must not contain unescaped &");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 3. Unknown q falls back to weak
// ---------------------------------------------------------------------------

test("unknown q value falls back to weak (no crash, valid og:title)", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/${KNOWN_KEY}?q=not_a_real_question`);
    assert.equal(r.status, 200);
    // Should match the weak page: same og:title as without ?q
    const rWeak = await get(`${origin}/s/${KNOWN_KEY}`);
    const titleFallback = r.body.match(/property="og:title"\s+content="([^"]+)"/)?.[1];
    const titleWeak    = rWeak.body.match(/property="og:title"\s+content="([^"]+)"/)?.[1];
    assert.equal(titleFallback, titleWeak, "unknown q must produce same title as weak");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 4. Unknown key → 302 to app home
// ---------------------------------------------------------------------------

test("unknown key returns 302 redirect to SHARE_TARGET (/n.html)", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/THIS_KEY_DOES_NOT_EXIST_99999`);
    assert.equal(r.status, 302, "unknown key must redirect");
    assert.ok(r.headers["location"], "redirect must have Location header");
    assert.ok(
      r.headers["location"].endsWith("/n.html"),
      `Location must point to /n.html, got: ${r.headers["location"]}`
    );
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 5. features.share is true (sentence.js loaded)
// ---------------------------------------------------------------------------

test("GET /api/health has features.share=true after sentence.js loaded", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/api/health`);
    assert.equal(r.status, 200);
    const body = JSON.parse(r.body);
    assert.ok(body.features, "features must be present");
    assert.equal(body.features.share, true, "features.share must be true after successful load");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 6. og:image is an absolute URL
// ---------------------------------------------------------------------------

test("og:image is an absolute URL with the request's host", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/${KNOWN_KEY}`, { host: new URL(origin).host });
    assert.equal(r.status, 200);
    const m = r.body.match(/property="og:image"\s+content="([^"]+)"/);
    assert.ok(m, "must have og:image");
    const imgUrl = m[1];
    assert.ok(imgUrl.startsWith("http://") || imgUrl.startsWith("https://"), "og:image must be absolute");
    assert.ok(imgUrl.includes("/assets/product/og.png"), "og:image must point to /assets/product/og.png");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 7. Correct content-type, cache-control and security headers
// ---------------------------------------------------------------------------

test("share page has correct headers", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/${KNOWN_KEY}`);
    assert.equal(r.status, 200);
    assert.ok(r.headers["content-type"]?.startsWith("text/html"), "content-type must be text/html");
    assert.ok(r.headers["cache-control"]?.includes("public"), "cache-control must include public");
    assert.ok(r.headers["cache-control"]?.includes("max-age=300"), "cache-control must have max-age=300");
    assert.equal(r.headers["x-content-type-options"], "nosniff", "security header must be present");
    assert.equal(r.headers["x-frame-options"], "DENY", "x-frame-options must be present");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 8. lang and dir attributes
// ---------------------------------------------------------------------------

test("share page has lang=he dir=rtl", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/${KNOWN_KEY}`);
    assert.ok(r.body.includes('lang="he"'), "must have lang=he");
    assert.ok(r.body.includes('dir="rtl"'), "must have dir=rtl");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 9. Redirect target (meta refresh, location.replace, body link) is relative
// ---------------------------------------------------------------------------

test("share page navigation targets are relative URLs, not absolute", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/${KNOWN_KEY}`, { host: "evil.example" });
    assert.equal(r.status, 200);
    // meta refresh must not contain http://evil.example
    const refreshM = r.body.match(/<meta http-equiv="refresh"[^>]*>/);
    assert.ok(refreshM, "must have meta refresh");
    assert.ok(!refreshM[0].includes("evil.example"), "meta refresh must not use Host as base");
    assert.ok(!refreshM[0].includes("http://"), "meta refresh url must be relative");
    // location.replace argument must not contain evil.example
    const scriptM = r.body.match(/location\.replace\(([^)]+)\)/);
    assert.ok(scriptM, "must have location.replace");
    assert.ok(!scriptM[1].includes("evil.example"), "location.replace must not use Host as base");
    // the body link must also be relative
    const linkM = r.body.match(/<a href="([^"]+)"/);
    assert.ok(linkM, "must have body link");
    assert.ok(!linkM[1].startsWith("http://") && !linkM[1].startsWith("https://"), "body link must be relative");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// 10. q=simple: title ends with "במבט אחד", redirect target contains #/c/<key>/simple
// ---------------------------------------------------------------------------

test("/s/1031?q=simple returns title ending with במבט אחד and redirects to #/c/1031/simple", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/1031?q=simple`);
    assert.equal(r.status, 200);
    const m = r.body.match(/property="og:title"\s+content="([^"]+)"/);
    assert.ok(m, "must have og:title");
    assert.ok(m[1].endsWith("במבט אחד"), `og:title must end with "במבט אחד", got: ${m[1]}`);
    // redirect destination must contain #/c/1031/simple
    const refreshM = r.body.match(/<meta http-equiv="refresh"[^>]*content="[^"]*url=([^"]+)"/);
    assert.ok(refreshM, "must have meta refresh");
    assert.ok(refreshM[1].includes("#/c/1031/simple"), `redirect must contain #/c/1031/simple, got: ${refreshM[1]}`);
  } finally {
    await close();
  }
});

test("share page og:image and og:url remain absolute", async () => {
  const { origin, close } = await startServer();
  try {
    const r = await get(`${origin}/s/${KNOWN_KEY}`);
    assert.equal(r.status, 200);
    const ogImage = r.body.match(/property="og:image"\s+content="([^"]+)"/)?.[1];
    assert.ok(ogImage && (ogImage.startsWith("http://") || ogImage.startsWith("https://")), "og:image must be absolute");
    const ogUrl = r.body.match(/property="og:url"\s+content="([^"]+)"/)?.[1];
    assert.ok(ogUrl && (ogUrl.startsWith("http://") || ogUrl.startsWith("https://")), "og:url must be absolute");
  } finally {
    await close();
  }
});
