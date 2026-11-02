// Byte ranges for the preview video. The static-assets service answers a Range request with the whole file and no Accept-Ranges header, and Safari does not play a video that way;
// the Worker (worker/index.js, the /media/ files) therefore cuts the range itself. Pure functions, tested in tests/worker-range.test.mjs.

// header: the Range header ("bytes=0-99", "bytes=500-", "bytes=-300"), total: the size of the file in bytes.
// Returns { start, end } (end is the last byte, inclusive), "none" when there is no single usable range (the whole file is served, as the standard allows),
// or "bad" when the range lies outside the file (answer 416).
export function parseRange(header, total) {
  if (!header || !Number.isFinite(total) || total <= 0) return "none";
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(String(header));
  if (!m || (m[1] === "" && m[2] === "")) return "none";                       // several ranges or another unit: ignored
  if (m[1] === "") {                                                           // the last n bytes
    const n = Number(m[2]);
    return n === 0 ? "bad" : { start: Math.max(total - n, 0), end: total - 1 };
  }
  const start = Number(m[1]);
  if (m[2] !== "" && Number(m[2]) < start) return "none";                      // last byte before the first: not a range at all
  if (start >= total) return "bad";
  return { start, end: m[2] === "" ? total - 1 : Math.min(Number(m[2]), total - 1) };
}

// A stream of bytes start..end (inclusive) of another stream; the rest is read and dropped, and the source is cancelled once the range is complete.
export function sliceBody(body, start, end) {
  const reader = body.getReader();
  let pos = 0;
  return new ReadableStream({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return controller.close();
        const from = Math.max(start - pos, 0), to = Math.min(end + 1 - pos, value.byteLength);
        pos += value.byteLength;
        const part = to > from ? value.subarray(from, to) : null;
        if (pos > end) {
          if (part) controller.enqueue(part);
          await reader.cancel().catch(() => {});
          return controller.close();
        }
        if (part) return controller.enqueue(part);
      }
    },
    cancel(reason) { return reader.cancel(reason); }
  });
}

// the same response with one more header (a copy: the headers of a fetched response cannot be changed)
export function withHeader(res, name, value) {
  const h = new Headers(res.headers);
  h.set(name, value);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
