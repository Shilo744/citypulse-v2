// Byte ranges for the preview video (worker/range.js): the Worker cuts the range itself because the assets service ignores Range and Safari needs a 206 answer for a video.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { parseRange, sliceBody, withHeader } = await import(pathToFileURL(path.join(ROOT, "worker", "range.js")).href);

test("range: a single byte range is read as start and last byte, an open end and a suffix included", () => {
  assert.deepEqual(parseRange("bytes=0-1", 1000), { start: 0, end: 1 });
  assert.deepEqual(parseRange("bytes=100-199", 1000), { start: 100, end: 199 });
  assert.deepEqual(parseRange("bytes=500-", 1000), { start: 500, end: 999 });
  assert.deepEqual(parseRange("bytes=-300", 1000), { start: 700, end: 999 });
  assert.deepEqual(parseRange("bytes=-5000", 1000), { start: 0, end: 999 }, "a suffix longer than the file is the whole file");
  assert.deepEqual(parseRange("bytes=900-5000", 1000), { start: 900, end: 999 }, "the last byte is cut at the end of the file");
  assert.deepEqual(parseRange(" Bytes = 10 - 20 ", 1000), { start: 10, end: 20 }, "spaces and capitals are tolerated");
});

test("range: what is not one usable range is ignored (the whole file), what lies outside the file is refused", () => {
  for (const h of [null, "", "items=0-5", "bytes=", "bytes=-", "bytes=0-1,5-6", "bytes=a-b", "bytes=50-10"]) assert.equal(parseRange(h, 1000), "none", String(h));
  assert.equal(parseRange("bytes=0-1", 0), "none", "an empty file has no ranges");
  assert.equal(parseRange("bytes=0-1", NaN), "none");
  assert.equal(parseRange("bytes=1000-", 1000), "bad", "the first byte is past the end");
  assert.equal(parseRange("bytes=2000-3000", 1000), "bad");
  assert.equal(parseRange("bytes=-0", 1000), "bad", "the last zero bytes");
});

// a source stream of the given chunk sizes over bytes 0, 1, 2 ... (modulo 251) so that every position can be checked
const source = (total, sizes) => {
  const all = Uint8Array.from({ length: total }, (_, i) => i % 251);
  let at = 0, k = 0;
  const stream = new ReadableStream({
    pull(c) {
      if (at >= total) return c.close();
      const n = Math.min(sizes[k++ % sizes.length], total - at);
      c.enqueue(all.slice(at, at + n)); at += n;
    }
  });
  return { stream, all };
};
const read = async (stream) => new Uint8Array(await new Response(stream).arrayBuffer());

test("range: sliceBody returns exactly the bytes asked for whatever the chunking, and stops reading the source after the range", async () => {
  const total = 5000;
  for (const sizes of [[1], [7], [64], [1000], [4096, 1], [5000]]) {
    for (const [start, end] of [[0, 0], [0, 1], [0, 4999], [10, 10], [1, 4998], [999, 1001], [4096, 4999], [4999, 4999], [2500, 3000]]) {
      const { stream, all } = source(total, sizes);
      const got = await read(sliceBody(stream, start, end));
      assert.equal(got.length, end - start + 1, `${sizes} ${start}-${end} length`);
      assert.deepEqual(got, all.slice(start, end + 1), `${sizes} ${start}-${end} content`);
    }
  }
  let pulled = 0;
  const big = new ReadableStream({ pull(c) { pulled++; c.enqueue(new Uint8Array(100)); if (pulled > 10000) c.close(); } });
  const got = await read(sliceBody(big, 0, 249));
  assert.equal(got.length, 250);
  assert.ok(pulled < 50, `the source is not read to the end (${pulled} pulls)`);
});

test("range: withHeader is a copy with one more header, the body and the status are kept", async () => {
  const res = new Response("abc", { status: 200, headers: { "Content-Type": "video/mp4" } });
  const r2 = withHeader(res, "Accept-Ranges", "bytes");
  assert.equal(r2.status, 200);
  assert.equal(r2.headers.get("Accept-Ranges"), "bytes");
  assert.equal(r2.headers.get("Content-Type"), "video/mp4");
  assert.equal(await r2.text(), "abc");
  const nm = withHeader(new Response(null, { status: 304 }), "Accept-Ranges", "bytes");
  assert.equal(nm.status, 304, "a 304 has no body and stays a 304");
});
