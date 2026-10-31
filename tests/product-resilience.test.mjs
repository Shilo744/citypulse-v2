// Resilience and plumbing of the product (red team R-01 .. R-08, R-14, R-20, R-21): the reads do their own fetch with a limit that really aborts, a retry really
// fetches again, a wrong answer is an error with a retry button, the classes of error are honest, the stored lists are capped when read, titles do not repeat the town.
// Everything runs in node with an injected fetch and short limits; the same scenarios against the live page were probed through the debug port (design-ideas/product/DONE/w1.md).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installDom } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = path.join(ROOT, "web", "js", "product");
const load = (f) => import(pathToFileURL(path.join(PROD, f)).href);
const net = await load("net.js"), cfg = await load("config.js"), seo = await load("seo.js"), st = await load("storage.js");
const GOOD = { city: { key: "1031", name: "שדרות" }, domains: [], indicators: [] };
const json = (body, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const html = () => new Response("<html>portal</html>", { status: 200, headers: { "Content-Type": "text/html" } });
const hang = (init) => new Promise((_, reject) => { if (init && init.signal) init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true }); });
const FAST = { timeoutMs: 40, delayMs: 1 };
// a fetch that answers from a queue of steps: a function(init) or a Response; the last step repeats. calls counts the requests.
function script(...steps) { const f = (url, init) => { f.calls.push({ url, init }); const s = steps[Math.min(f.calls.length - 1, steps.length - 1)]; return Promise.resolve(typeof s === "function" ? s(init) : s.clone()); }; f.calls = []; return f; }
const withFetch = async (f, fn) => { net.useFetch(f); net.forget(); try { return await fn(); } finally { net.useFetch(null); net.forget(); } };

test("limits: one try 10 s, one retry, the worst case is about 21 s, and the slow line comes before the first limit", () => {
  assert.equal(cfg.NET.timeoutMs, 10000); assert.ok(cfg.NET.timeoutMs * 2 + cfg.NET.retryDelayMs <= 21000);
  assert.ok(cfg.NET.slowAfterMs <= 6000 && cfg.NET.slowAfterMs < cfg.NET.timeoutMs);
});

test("R-01 hang: the request is really aborted at the limit, nothing is kept, and the retry fetches again and recovers", async () => {
  const f = script(hang, hang, json(GOOD));
  await withFetch(f, async () => {
    await assert.rejects(net.city("1031", FAST), (e) => e.kind === "timeout");
    assert.equal(f.calls.length, 2, "one try and one retry");
    assert.ok(f.calls.every((c) => c.init.signal.aborted), "both requests were aborted, not left hanging");
    const m = await net.city("1031", FAST);                              // what the retry button does
    assert.equal(m.city.name, "שדרות"); assert.equal(f.calls.length, 3, "a new request, not a memo");
    await net.city("1031", FAST); assert.equal(f.calls.length, 3, "a good answer is kept");
  });
});

test("R-01 junk 200: HTML, text, null, an array and an empty body are bad answers; the next try fetches again", async () => {
  for (const bad of [html(), json("null"), json("[]"), json("7"), json(""), json("{broken")]) {
    const f = script(bad, json(GOOD));
    await withFetch(f, async () => {
      await assert.rejects(net.city("1031", FAST), (e) => e.kind === "badanswer", "bad answer");
      assert.equal(f.calls.length, 1, "a wrong answer is not retried by itself");
      assert.equal((await net.city("1031", FAST)).city.key, "1031"); assert.equal(f.calls.length, 2);
    });
  }
});

test("R-02 shape: {} / [] / null / a city without a name are bad answers; the router's model check also wants the lists", async () => {
  for (const bad of [{}, [], null, { city: { key: "1161" } }, { city: null }, { city: { key: "", name: "x" } }]) {
    await withFetch(script(json(bad)), () => assert.rejects(net.city("1161", FAST), (e) => e.kind === "badanswer", JSON.stringify(bad)));
  }
  assert.equal(net.isModel(GOOD), true);
  for (const bad of [null, undefined, "x", [], {}, { city: { key: "1", name: "a" } }, { city: { key: "1", name: "a" }, domains: [] }, { city: { key: "1", name: "a" }, domains: {}, indicators: [] }, { ...GOOD, indicators: [null, 1, "x", {}] }, { ...GOOD, domains: [null] }]) assert.equal(net.isModel(bad), false, JSON.stringify(bad));
});

test("R-08 classes: a server 500 with a JSON body is the server, a view bug is not offline, a junk answer is its own class, 4xx is never retried", async () => {
  const f = script(json({ error: "boom at line 7" }, 500));
  await withFetch(f, async () => {
    await assert.rejects(net.city("1031", FAST), (e) => e.kind === "server" && !/boom/.test(net.MESSAGES[e.kind].join(" ")));
    assert.equal(f.calls.length, 2, "a 5xx is tried once more");
  });
  const g = script(json({ error: "locality not found" }, 404));
  await withFetch(g, async () => { await assert.rejects(net.city("1031", FAST), (e) => e.kind === "notfound"); assert.equal(g.calls.length, 1); });
  const b = script(json({ error: "bad" }, 400));
  await withFetch(b, async () => { await assert.rejects(net.city("1031", FAST), (e) => e.kind === "unknown"); assert.equal(b.calls.length, 1); });
  const t = script(json({ error: "slow down" }, 429));
  await withFetch(t, async () => { await assert.rejects(net.city("1031", FAST), (e) => e.kind === "server"); assert.equal(t.calls.length, 1, "429 is a 4xx"); });
  const o = script(() => Promise.reject(new TypeError("Failed to fetch")), json(GOOD));
  await withFetch(o, async () => { assert.equal((await net.city("1031", FAST)).city.key, "1031"); assert.equal(o.calls.length, 2, "a lost connection is tried once more"); });
  const off = script(() => Promise.reject(new TypeError("Failed to fetch")));
  await withFetch(off, async () => { await assert.rejects(net.city("1031", FAST), (e) => e.kind === "offline"); });

  assert.equal(net.classify(new TypeError("Cannot read properties of undefined (reading 'city')")), "unknown", "a view bug is a defect");
  assert.equal(net.classify(new TypeError("Cannot read properties of null"), false), "unknown");
  assert.equal(net.classify(new TypeError("Failed to fetch")), "offline"); assert.equal(net.classify(new TypeError("NetworkError when attempting to fetch resource.")), "offline"); assert.equal(net.classify(new TypeError("Load failed")), "offline");
  assert.equal(net.classify(Object.assign(new Error("x"), { status: 503 })), "server"); assert.equal(net.classify(Object.assign(new Error("x"), { status: 404 })), "notfound");
  assert.equal(net.classify(new Error("תשובה לא תקינה")), "badanswer"); assert.equal(net.classify(Object.assign(new Error("a"), { name: "AbortError" })), "timeout");
  for (const k of net.KINDS) { assert.ok(net.MESSAGES[k], k); assert.ok(!/we |תקלה|שגיאת|exception|TypeError|undefined/i.test(net.MESSAGES[k].join(" ")), "plain words: " + k); }
  assert.notEqual(net.MESSAGES.unknown[0], net.MESSAGES.offline[0]);
});

test("R-21 a clearly-not-a-key town never reaches the server", async () => {
  const f = script(json(GOOD));
  await withFetch(f, async () => {
    for (const k of ["constructor", "__proto__", "1031\0", "‮1031", "javascript:alert(1)", "x".repeat(60000), "", "10 31", "-1", "1031/indicator"]) await assert.rejects(net.city(k, FAST), (e) => e.kind === "notfound", String(k).slice(0, 12));
    await assert.rejects(net.indicator("1031", "../x", FAST), (e) => e.kind === "notfound");
    assert.equal(f.calls.length, 0, "no request, so no console noise");
    for (const k of ["1", "16", "472", "1031", "9000", "99", "2800"]) assert.equal(net.isKey(k), true, k);
  });
});

test("R-06 the route's signal cancels the request and stops the retry", async () => {
  const f = script(hang), ac = new AbortController();
  await withFetch(f, async () => {
    const p = net.city("1031", { timeoutMs: 5000, delayMs: 1, signal: ac.signal });
    setTimeout(() => ac.abort(), 10);
    await assert.rejects(p); assert.equal(f.calls.length, 1, "no retry after the route changed"); assert.ok(f.calls[0].init.signal.aborted);
  });
});

test("R-06 the health call gets the same retry; a search is not retried; a write is never repeated", async () => {
  const f = script(json({}, 503), json({ ok: true, builtAt: "x" }));
  await withFetch(f, async () => { assert.equal((await net.health(FAST)).ok, true); assert.equal(f.calls.length, 2); });
  const s = script(json({}, 503));
  await withFetch(s, async () => { await assert.rejects(net.search("שד")); assert.equal(s.calls.length, 1); });
  const a = script(json({}, 503));
  await withFetch(a, async () => { await assert.rejects(net.ask({ q: 1 })); assert.equal(a.calls.length, 1); assert.equal(a.calls[0].init.method, "POST"); });
});

test("the guard gives the old page modules the same limit, and a retry through api.js really fetches again", async () => {
  const saved = globalThis.fetch;
  try {
    const f = script(hang, html(), json({ domains: [], indicators: [] }), json({ error: "boom" }, 500));
    const g = net.guardFetch(f, { timeoutMs: 30 });
    await assert.rejects(g("/api/meta"), (e) => e.name === "AbortError");
    assert.ok(f.calls[0].init.signal.aborted, "the hung request was aborted");
    const bad = await g("/api/meta"); assert.equal(bad.status, 502); assert.deepEqual(await bad.json(), { error: "תשובה לא תקינה" });
    const ok = await g("/api/meta"); assert.equal(ok.status, 200); assert.deepEqual(Object.keys(await ok.json()), ["domains", "indicators"]);
    const five = await g("/api/geo"); assert.equal(five.status, 500); assert.deepEqual(await five.json(), { error: "שגיאה 500" });
    // the real api.js on top of the guard: nothing stays in its memo after a failure
    const h = script(hang, html(), json({ domains: ["d"], indicators: [] }));
    globalThis.fetch = net.guardFetch(h, { timeoutMs: 30 });
    const api = await import(pathToFileURL(path.join(ROOT, "web", "js", "api.js")).href);
    await assert.rejects(api.getMeta()); await assert.rejects(api.getMeta(), (e) => net.classify(e) === "badanswer");
    assert.deepEqual((await api.getMeta()).domains, ["d"]); assert.equal(h.calls.length, 3, "three real requests");
    // what is not a GET of the data stays as it was
    const p = script(json({ ok: true })); const gp = net.guardFetch(p, { timeoutMs: 30 });
    await gp("/api/ask", { method: "POST", body: "{}" }); await gp("/api/city/1/briefing"); await gp("/other.js");
    assert.equal(p.calls.length, 3); assert.ok(p.calls.every((c) => !c.init || !c.init.signal), "no limit on a write, the briefing or a static file");
  } finally { globalThis.fetch = saved; }
});

test("R-02 states: an error or a not-found state with a model that has no city does not throw and still offers a way out", async () => {
  const d = installDom();
  try {
    const { errorState, notFound, notMeasured, slowLine, SLOW_TEXT } = await load("kit/states.js");
    for (const model of [{}, { city: null }, { city: {} }, null, undefined]) {
      let retried = 0;
      const e = errorState({ kind: "badanswer" }, { retry: () => retried++, model });
      assert.equal(e.getAttribute("data-state"), "error-badanswer");
      const btn = e.findAll((x) => x.tagName === "BUTTON"); assert.equal(btn.length, 1, "the retry button");
      assert.ok(e.findAll((x) => x.tagName === "A").some((a) => a.getAttribute("href") === "#/"), "the search link instead of the town link");
      for (const kind of ["domain", "indicator", "town", "route"]) assert.ok(notFound(kind, { model }));
    }
    const ok = errorState({ kind: "server" }, { retry() {}, model: GOOD });
    assert.ok(ok.findAll((x) => x.tagName === "A").some((a) => a.getAttribute("href") === "#/c/1031"));
    assert.match(errorState(new TypeError("Cannot read properties of undefined"), { retry() {} }).textContent, new RegExp(net.MESSAGES.unknown[0]));
    assert.ok(!/Cannot read|TypeError/.test(errorState(new TypeError("Cannot read properties of undefined"), { retry() {} }).textContent), "a defect's own text never reaches the page");
    assert.ok(!/אין חיבור/.test(errorState(new TypeError("Cannot read properties of undefined"), { retry() {} }).textContent), "a view bug is not 'offline'");
    assert.ok(notMeasured(GOOD, "x", "y"));
    let n = 0; const line = slowLine(() => n++), b = line.findAll((x) => x.tagName === "BUTTON")[0];
    assert.match(line.textContent, new RegExp(SLOW_TEXT)); assert.equal(SLOW_TEXT, "הטעינה לוקחת יותר זמן מהרגיל"); assert.ok(b && /נסו שוב/.test(b.textContent));
    assert.ok(!line.getAttribute("role"), "no live role of its own: the router says it once through the live region");
  } finally { d.restore(); }
});

test("R-02 / R-06 app.js: validates the model, aborts with the route, arms the slow line once, keeps the console for defects only", () => {
  const app = fs.readFileSync(path.join(PROD, "app.js"), "utf8").replace(/\r\n/g, "\n");
  assert.match(app, /net\.isModel\(m\)\)\s*throw new net\.NetError\("badanswer"\)/);
  assert.match(app, /net\.city\(c\.key, \{ signal: controller\.signal \}\)/);
  assert.match(app, /NET\.slowAfterMs/); assert.match(app, /live\.announce\(SLOW_TEXT\)/);
  assert.match(app, /if \(kind === "unknown"\) console\.error/);
  assert.match(app, /net\.installGuard\(\)/);
  assert.ok(!/model = m;[\s\S]{0,40}isModel/.test(app), "the model is checked before it is used");
});

test("R-14 the stored lists are capped and checked when they are read", () => {
  const data = new Map();
  st.use({ getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) });
  try {
    const big = Array.from({ length: 5000 }, (_, i) => ({ key: String(1000 + i), name: "יישוב " + i, t: i }));
    data.set(cfg.KEYS.recent, JSON.stringify(big)); data.set(cfg.KEYS.fav, JSON.stringify(big));
    assert.equal(st.recents.list().length, cfg.MAX_RECENT); assert.equal(st.fav.list().length, cfg.MAX_FAV);
    assert.equal(st.fav.full(), true); assert.equal(st.fav.toggle({ key: "1031", name: "שדרות" }), false, "a full list refuses, and says so");
    data.set(cfg.KEYS.recent, JSON.stringify([null, 7, "x", [], {}, { key: "1031" }, { name: "a" }, { key: 5, name: "a" }, { key: "constructor", name: "Object" }, { key: "__proto__", name: "x" },
      { key: "1".repeat(40), name: "long key" }, { key: "2", name: "" }, { key: "3", name: "x".repeat(500) }, { key: "4", name: "<img src=x onerror=alert(1)>" }, { key: "1031", name: "שדרות" }]));
    assert.deepEqual(st.recents.list().map((t) => t.key), ["4", "1031"], "only well-formed towns; HTML stays text");
    st.recents.clear(); assert.deepEqual(st.recents.add({ key: "constructor", name: "Object" }), [], "a fake town is not added");
    st.recents.add({ key: "1031", name: "שדרות" }); assert.deepEqual(st.recents.list().map((t) => t.key), ["1031"]);
  } finally { st.use(undefined); }
});

test("R-20 titles: the town is named once, the length stays near 70, an error state keeps its own heading", () => {
  const q = "איפה המצב הכי חלש במסעודין אל-עזאזמה (שבט)?", town = "מסעודין אל-עזאזמה (שבט)";
  const t = seo.titleFor({ page: q, town });
  assert.equal(t.split(town).length - 1, 1, t); assert.ok(t.length <= 70, t.length + " " + t); assert.match(t, /CityPulse$/);
  assert.equal(seo.titleFor({ page: "מגמות והיסטוריה", town: "שדרות" }), "מגמות והיסטוריה · שדרות · CityPulse");
  assert.equal(seo.titleFor({ page: "איפה המצב הכי חלש בשדרות?", town: "שדרות" }), "איפה המצב הכי חלש בשדרות? · CityPulse");
  assert.equal(seo.titleFor({ page: "מידע" }), "מידע · CityPulse"); assert.equal(seo.titleFor({}), cfg.ENTRY_TITLE);
  const long = seo.titleFor({ page: "תוכנית פעולה ארוכה מאוד של הרשות", town: "מסעודין אל-עזאזמה (שבט)" });
  assert.ok(long.length <= 70, long);
  assert.equal(seo.titleFor({ page: "השרת מתקשה כרגע" }), "השרת מתקשה כרגע · CityPulse", "an error state is its own heading");
  assert.ok(seo.descriptionFor({ page: q, town }).split(town).length - 1 === 1, "the description names the town once as well");
});

test("item 6 routes: no HEAD probe on load; the soft import is the check, and a failed route import marks the module missing", async () => {
  const d = installDom();
  const saved = globalThis.fetch, calls = [];
  globalThis.fetch = (u, i) => { calls.push([String(u), i && i.method]); return Promise.resolve(json({})); };
  try {
    const r = await load("routes.js");
    assert.equal(r.available("brief"), true, "optimistic: no request needed");
    await r.probeAll();
    assert.deepEqual(calls, [], "no request at all");
    assert.equal(r.available("feedback"), true, "the preloaded module imported");
    r.markMissing("brief"); assert.equal(r.available("brief"), false);
    const src = fs.readFileSync(path.join(PROD, "routes.js"), "utf8");
    assert.ok(!/method:\s*"HEAD"/.test(src));
    assert.match(src, /markMissing\("brief"\)/);
  } finally { globalThis.fetch = saved; d.restore(); }
});
test("a town answer that the router would refuse is not kept: the retry asks again", async () => {
  const f = script(json({ city: { key: "1161", name: "רהט" } }), json(GOOD));
  await withFetch(f, async () => { assert.equal((await net.city("1161", FAST)).city.name, "רהט"); assert.equal(net.isModel(await net.city("1161", FAST)), true); assert.equal(f.calls.length, 2); });
});
