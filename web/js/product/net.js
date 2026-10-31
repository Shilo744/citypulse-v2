// The network layer. The reads of the product do their own fetch (the memo of ../api.js keeps a hung promise and a junk answer for the whole session, so a retry
// through it fetched nothing): 10 s limit that really aborts the request, one retry with a short pause for the errors a second try can fix, nothing remembered
// but a good answer, and a body that is not an object counts as an error. Errors are sorted into classes a page can show in plain Hebrew.
// The old page modules still call api.js; installGuard() gives their requests the same limit and the same honesty (see the end of this file).
import { NET } from "./config.js";
import { regroup, regroupMeta, regroupDetail, regroupAnswer, dataOnlyMeta } from "./city/groups.js";

export const KINDS = ["offline", "timeout", "server", "badanswer", "notfound", "nodata", "unknown"];
export class NetError extends Error {
  constructor(kind, original) {
    super(original && original.message ? original.message : kind); this.name = "NetError"; this.kind = kind; this.original = original || null;
    // a second try helps against a lost connection, a slow server and a 5xx; never against a 4xx or an answer that is wrong
    this.retryable = kind === "offline" || kind === "timeout" || (kind === "server" && !(original && original.status && original.status < 500));
  }
}

// the keys of the real towns are 1 to 4 digits; anything else is not a key and never asks the server (R-21)
export const isKey = (k) => typeof k === "string" && /^[0-9]{1,6}$/.test(k);
const isId = (s) => typeof s === "string" && /^[A-Za-z0-9_.-]{1,60}$/.test(s);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
// a town answer at all: an object with a city that has a key and a name (net.city checks this much)
const isCity = (m) => isObj(m) && isObj(m.city) && (typeof m.city.key === "string" || typeof m.city.key === "number") && String(m.city.key) !== "" && typeof m.city.name === "string" && m.city.name !== "";
// the shape the router, the shell and the views stand on: that, and the domains and the indicators (the router checks this before any view gets the model)
export const isModel = (m) => isCity(m) && Array.isArray(m.domains) && Array.isArray(m.indicators) && m.domains.every(isObj) && m.indicators.every(isObj);

const FETCH_FAIL = /failed to fetch|networkerror|load failed|network request failed/i;
const BAD_ANSWER = "תשובה לא תקינה";            // what the guard below says for an answer that is not JSON

// pure: which class an error belongs to (online is passed in so that node can test it)
export function classify(err, online = true) {
  if (err instanceof NetError) return err.kind;
  const msg = String((err && err.message) || ""), st = err && err.status;
  if (typeof st === "number") {
    if (st === 404) return "notfound";
    if (st >= 500 || st === 429) return "server";
    if (st === 408) return "timeout";
    return "unknown";
  }
  if (msg === "locality not found") return "notfound";
  if (msg === "no data") return "nodata";
  if (/^שגיאה 404\b/.test(msg)) return "notfound";
  if (/^שגיאה 5\d\d\b/.test(msg) || /^internal|server error/i.test(msg)) return "server";
  if (msg === BAD_ANSWER) return "badanswer";
  if (FETCH_FAIL.test(msg)) return "offline";
  if (err && err.name === "AbortError") return "timeout";
  if (online === false && !(err && err.name === "TypeError")) return "offline";
  return "unknown";          // a defect: the page says it calmly, the console keeps the error
}

// the words for each class (plain Hebrew, SPEC 6.6): [title, text]
export const MESSAGES = {
  offline: ["אין חיבור לשרת", "בדקו את החיבור ונסו שוב."],
  timeout: ["השרת מתקשה כרגע", "הטעינה לקחה יותר זמן מדי. נסו שוב בעוד רגע."],
  server: ["השרת מתקשה כרגע", "נסו שוב בעוד רגע."],
  badanswer: ["התשובה מהשרת לא הגיעה תקינה", "נסו שוב בעוד רגע. אם זה חוזר, ייתכן שהרשת שאתם מחוברים אליה חוסמת את האתר."],
  notfound: ["היישוב הזה לא נמצא", "אולי הקישור ישן. אפשר לחפש יישוב בשמו."],
  nodata: ["המדד הזה לא נמדד כאן", "המקור הרשמי אינו מפרסם נתון על המדד הזה ליישוב. אפשר לראות מדדים אחרים בתחום."],
  unknown: ["העמוד לא נטען", "משהו השתבש בטעינה. נסו שוב; אם זה חוזר, אפשר לדווח על כך בקישור שבתחתית העמוד."]
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const online = () => (typeof navigator === "undefined" || navigator.onLine !== false);

// the fetch of the page, before installGuard replaced it; tests swap it with useFetch
let injected = null;
export const useFetch = (f) => { injected = f || null; };
const rawFetch = () => injected || (globalThis.fetch && globalThis.fetch.__native) || globalThis.fetch;
const httpError = (status, msg) => Object.assign(new Error(msg || `שגיאה ${status}`), { status });

// GET or POST a path and give back its JSON object (or array). A status above 399, a body that does not parse and a body that is not an object are errors.
export async function getJson(path, init = {}) {
  const r = await rawFetch().call(globalThis, path, init);
  let body = null, parsed = true;
  try { body = await r.json(); } catch (e) { if (e && e.name === "AbortError") throw e; parsed = false; }
  if (!r.ok) throw httpError(r.status, body && typeof body.error === "string" ? body.error : "");
  if (!parsed || !body || typeof body !== "object") throw new NetError("badanswer");
  return body;
}

// run a read; fn(signal) is called again once after the pause when the first try failed for a reason a second try can fix. The limit aborts the request itself.
// opts: retry, timeoutMs, delayMs, signal (the route: when it fires the request is cancelled and nothing is retried)
export async function read(fn, { retry = true, timeoutMs = NET.timeoutMs, delayMs = NET.retryDelayMs, signal } = {}) {
  const once = async () => {
    const ac = new AbortController(), cancel = () => ac.abort();
    let timer;
    if (signal) { if (signal.aborted) cancel(); else signal.addEventListener("abort", cancel, { once: true }); }
    const limit = new Promise((_, reject) => { timer = setTimeout(() => { reject(new NetError("timeout")); cancel(); }, timeoutMs); });
    try { return await Promise.race([Promise.resolve().then(() => fn(ac.signal)), limit]); }
    catch (e) { throw e instanceof NetError ? e : new NetError(classify(e, online()), e); }
    finally { clearTimeout(timer); if (signal) signal.removeEventListener("abort", cancel); }
  };
  try { return await once(); } catch (e) {
    if (!retry || !e.retryable || (signal && signal.aborted)) throw e;
    await sleep(delayMs);
    return once();
  }
}

// the answers worth keeping are kept for the session (like api.js did); a failure or an answer that is not whole is never kept (so a retry asks again)
const kept = new Map();
export const forget = () => kept.clear();
function keep(id, path, ok, opts = {}, whole = ok, shape = (b) => b) {
  if (kept.has(id)) return Promise.resolve(kept.get(id));
  return read((signal) => getJson(path, { signal }).then((b) => { if (!ok(b)) throw new NetError("badanswer"); return b; }), opts).then((b) => { b = shape(b); if (whole(b)) kept.set(id, b); return b; });
}
const notFound = () => Promise.reject(new NetError("notfound"));
const isMeta = (m) => isObj(m) && Array.isArray(m.indicators) && Array.isArray(m.domains);

// the model enters the product in its categories (city/groups.js regroup): children and parents, health and its services, mind and welfare, safety, and the background
export const city = (key, opts) => (isKey(String(key)) ? keep("city:" + key, `/api/city/${encodeURIComponent(key)}`, isCity, opts, isModel, regroup) : notFound());
export const health = (opts) => read((signal) => getJson("/api/health", { signal }).then((b) => { if (!isObj(b)) throw new NetError("badanswer"); return b; }), opts);
export const geo = (opts) => keep("geo", "/api/geo", Array.isArray, opts);
export const meta = (opts) => keep("meta", "/api/meta", isMeta, opts, isMeta, regroupMeta);          // the catalogue speaks the categories too (the old modules read it through the guard)
export const search = (q, opts) => read((signal) => getJson("/api/search?q=" + encodeURIComponent(q), { signal }).then((b) => { if (!Array.isArray(b)) throw new NetError("badanswer"); return b; }), { retry: false, ...opts });
export const indicator = (key, id, opts) => (isKey(String(key)) && isId(id) ? keep(`ind:${key}:${id}`, `/api/city/${encodeURIComponent(key)}/indicator/${encodeURIComponent(id)}`, isObj, opts, isObj, regroupDetail) : notFound());
// a write is never repeated by itself
export const ask = (body) => read((signal) => getJson("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }), { retry: false, timeoutMs: 60000 });

// ── the old page modules ──
// They call api.js, which memoises a pending promise and any answer it got (a junk 200 becomes null for the whole session) and forgets only a rejection.
// So a request that never answers, or an answer that is not JSON, would stay in its memo and a retry would get the same dead result. The guard is a thin
// fetch for GET /api/...: the same 10 s limit that aborts the request (api.js then sees a rejection and forgets it), a 200 that is not a JSON object turns into
// a 502 "תשובה לא תקינה", and a 5xx loses the server's own sentence and says "שגיאה <status>" (the class "server"). Everything else passes untouched.
export function guardFetch(base, { timeoutMs = NET.timeoutMs } = {}) {
  const g = async function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    // the one write whose answer is read on its way back: it names domains (regroupAnswer). It keeps its own time (the model may take a minute): no limit here, and no other write is touched
    if (method === "POST" && /^\/api\/ask(\?|$)/.test(url)) {
      const r = await base.call(globalThis, input, init);
      if (!r.ok) return r;
      try { const ans = regroupAnswer(await r.clone().json()); globalThis.__cpAsk = ans && ans.page; if (typeof document !== "undefined") document.dispatchEvent(new CustomEvent("cp-ask", { detail: ans && ans.page })); return new Response(JSON.stringify(ans), { status: r.status, headers: { "Content-Type": "application/json" } }); } catch (e) { if (e && e.name === "AbortError") throw e; return r; }
    }
    if (method !== "GET" || !/^\/api\//.test(url) || /\/briefing(\?|$)/.test(url)) return base.call(globalThis, input, init);
    const ac = new AbortController(), outer = init && init.signal;
    if (outer) { if (outer.aborted) ac.abort(); else outer.addEventListener("abort", () => ac.abort(), { once: true }); }
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const json = (status, o) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
    try {
      const r = await base.call(globalThis, input, { ...init, signal: ac.signal });
      if (r.status >= 500) return json(r.status, { error: `שגיאה ${r.status}` });
      if (!r.ok) return r;
      let ok = false;
      try { const b = await r.clone().json(); ok = !!b && typeof b === "object"; } catch (e) { if (e && e.name === "AbortError") throw e; }
      if (!ok) return json(502, { error: BAD_ANSWER });
      // the old modules read the model of a town, the catalogue and one figure of a town in the same categories as the product (city/groups.js lists every endpoint that carries domains)
      const shape = /^\/api\/city\/[^/?#]+(\?.*)?$/.test(url) ? regroup : /^\/api\/meta(\?.*)?$/.test(url) ? (m) => dataOnlyMeta(regroupMeta(m)) : /^\/api\/city\/[^/?#]+\/indicator\/[^/?#]+(\?.*)?$/.test(url) ? regroupDetail : null;
      if (shape) { try { return json(200, shape(await r.clone().json())); } catch (e) { if (e && e.name === "AbortError") throw e; } }
      return r;
    } finally { clearTimeout(timer); }
  };
  g.__native = base;
  return g;
}
export function installGuard() {
  if (typeof globalThis.fetch !== "function" || globalThis.fetch.__native) return;
  globalThis.fetch = guardFetch(globalThis.fetch);
}
