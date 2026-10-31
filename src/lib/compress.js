"use strict";
// Compression helpers: brotli preferred, gzip fallback.
//
//  - An answer WITH a cache key (static files, the css bundle: the same bytes for as long as the key stays the same)
//    is compressed once, at the best level (brotli 11, text mode), by the ASYNC zlib calls, so the event loop is never
//    blocked by the slow level. Concurrent first requests for one key share one promise. The answer is sent only when
//    the whole compressed body is ready (never half compressed).
//  - An answer WITHOUT a cache key (dynamic JSON) is compressed on the spot at a fast level (brotli 6 is still a few
//    milliseconds for 150 KB and smaller than gzip on every payload measured; brotli 4 was often larger than gzip).
//  - The cache holds one version per path: a new version (a new mtime) of a path drops the older one. It also has a
//    hard limit on the number of paths and on bytes, oldest used first.
const zlib = require("zlib");
const { promisify } = require("util");

const C = zlib.constants;
const brotliAsync = promisify(zlib.brotliCompress);
const gzipAsync = promisify(zlib.gzip);

const MIN_SIZE = 1024;          // smaller bodies are not worth an encoding
const BEST_QUALITY = 11;        // cached answers (compressed once)
const FAST_QUALITY = 6;         // answers without a key (compressed on every request)
const MAX_PATHS = 1500;
const MAX_BYTES = 64 * 1024 * 1024;

function brotliParams(len, quality) {
  return { params: { [C.BROTLI_PARAM_QUALITY]: quality, [C.BROTLI_PARAM_MODE]: C.BROTLI_MODE_TEXT, [C.BROTLI_PARAM_SIZE_HINT]: len } };
}

// ── the cache ────────────────────────────────────────────────────────────────
// key `${path}|${version}` (the version is the mtime) → one record per path: { version, slots: Map(enc → slot), bytes, dead }
// slot: { buf: Buffer|null, promise: Promise<Buffer> }. The Map order is the order of use (oldest first).
const store = new Map();
let totalBytes = 0;
let encodes = 0;

function splitKey(cacheKey) {
  const i = cacheKey.lastIndexOf("|");
  return i < 0 ? { id: cacheKey, version: "" } : { id: cacheKey.slice(0, i), version: cacheKey.slice(i + 1) };
}

function drop(id, rec) {
  rec.dead = true;
  totalBytes -= rec.bytes;
  rec.bytes = 0;
  if (store.get(id) === rec) store.delete(id);
}

function trim(keepId) {
  for (const [id, rec] of store) {
    if (store.size <= MAX_PATHS && totalBytes <= MAX_BYTES) break;
    if (id !== keepId) drop(id, rec);
  }
}

function encode(enc, buf, quality) {
  encodes++;
  return enc === "br" ? brotliAsync(buf, brotliParams(buf.length, quality)) : gzipAsync(buf, { level: 9 });
}

function slotFor(cacheKey, enc, buf) {
  const { id, version } = splitKey(cacheKey);
  let rec = store.get(id);
  if (rec && rec.version !== version) { drop(id, rec); rec = null; }       // a new version of the path: the older one goes
  if (!rec) {
    rec = { version, slots: new Map(), bytes: 0, dead: false };
    store.set(id, rec);
  } else {
    store.delete(id); store.set(id, rec);                                   // used now: last in the order
  }
  let slot = rec.slots.get(enc);
  if (!slot) {
    const mine = rec;
    slot = { buf: null, promise: null };
    slot.promise = encode(enc, buf, BEST_QUALITY).then((out) => {
      slot.buf = out;
      if (!mine.dead) { mine.bytes += out.length; totalBytes += out.length; trim(id); }
      return out;
    }, (err) => {
      if (mine.slots.get(enc) === slot) mine.slots.delete(enc);            // a failure is not remembered
      throw err;
    });
    rec.slots.set(enc, slot);
  }
  return slot;
}

// Compress a body in the background so the first real request finds it ready. Never rejects.
function prime(cacheKey, buf, enc = "br") {
  if (!cacheKey || !buf || buf.length < MIN_SIZE) return Promise.resolve(false);
  return slotFor(cacheKey, enc, buf).promise.then(() => true, () => false);
}

function stats() {
  return { paths: store.size, bytes: totalBytes, encodes };
}

function reset() {
  store.clear(); totalBytes = 0; encodes = 0;
}

// ── negotiation ──────────────────────────────────────────────────────────────
// Parse an Accept-Encoding header and return whether an encoding is acceptable
// (present and not disabled with q=0). Spaces around ';' and '=' are allowed.
function accepts(ae, enc) {
  for (const part of ae.split(",")) {
    const [name, ...params] = part.split(";");
    if (name.trim().toLowerCase() !== enc) continue;
    for (const p of params) {
      const m = p.trim().match(/^q\s*=\s*([0-9.]+)$/i);
      if (m && !(parseFloat(m[1]) > 0)) return false;
    }
    return true;
  }
  return false;
}

/**
 * sendBuf(req, res, code, headers, buf, cacheKey?)
 *  cacheKey – optional string `${path}|${version}` identifying the source (e.g. `${filePath}|${mtimeMs}`).
 *             When supplied, the compressed result is kept (best level, async); omit for one-off dynamic responses.
 *  Returns undefined (sent at once) or a promise that never rejects (sent when the cached compression is ready).
 */
function sendBuf(req, res, code, headers, buf, cacheKey) {
  const ae = String((req && req.headers && req.headers["accept-encoding"]) || "");
  const wantBr   = accepts(ae, "br");
  const wantGzip = accepts(ae, "gzip");

  // Responses that could be compressed should always carry Vary: Accept-Encoding
  // so caches know the representation depends on the encoding negotiation.
  const raw = () => {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(code, { ...headers, Vary: "Accept-Encoding", "Content-Length": buf.length });
    res.end(buf);
  };
  const compressed = (encoding, out) => {
    if (res.destroyed || res.writableEnded) return;
    if (!out || out.length >= buf.length) return raw();                       // never larger than the plain body
    res.writeHead(code, { ...headers, "Content-Encoding": encoding, Vary: "Accept-Encoding", "Content-Length": out.length });
    res.end(out);
  };

  if (buf.length < MIN_SIZE || (!wantBr && !wantGzip)) return raw();

  const encoding = wantBr ? "br" : "gzip";

  if (cacheKey) {
    let slot;
    try { slot = slotFor(`${cacheKey}`, encoding, buf); } catch (e) { return raw(); }
    if (slot.buf) return compressed(encoding, slot.buf);
    return slot.promise.then((out) => compressed(encoding, out), () => raw()).catch(() => {});
  }

  let out = null;
  try {
    out = encoding === "br" ? zlib.brotliCompressSync(buf, brotliParams(buf.length, FAST_QUALITY)) : zlib.gzipSync(buf);
  } catch (e) { out = null; }
  compressed(encoding, out);
}

module.exports = { sendBuf, prime, stats, reset, accepts, BEST_QUALITY, FAST_QUALITY };
