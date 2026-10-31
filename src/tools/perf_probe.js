"use strict";
// Performance probe of the product (n.html), SPEC 9.4: requests, bytes on the wire, third parties, what blocks the first paint,
// waterfall depth, FCP, LCP, CLS, revalidations on a warm reload, the theme's picture, the modules of pages that were not visited.
// It drives its own headless Chrome over the DevTools protocol (cdp.js does not expose the Network domain).
//
//   node src/tools/perf_probe.js                  the full run (1031 and the entry, 1280 and 390, local and slow profile), table on stdout
//   node src/tools/perf_probe.js --quick          only #/c/1031 at 1280 and at 390
//   node src/tools/perf_probe.js --json=out.json  also write the raw numbers
//   node src/tools/perf_probe.js --preload        print the <link rel="modulepreload"> list for web/n.html (the static import graph) and exit
//
// Needs the server on http://localhost:8800 (BASE=... to change). Use CDP_SLOT=<n> to have a profile of your own.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..", "..");
const WEB = path.join(ROOT, "web");
const BASE = process.env.BASE || "http://localhost:8800";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the static import graph (what the page needs before the first paint of a route) ──
const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s[^"';]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;
function staticGraph(roots, seen = new Set()) {
  const out = [];
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    let src;
    try { src = fs.readFileSync(path.join(WEB, file), "utf8"); } catch (e) { return; }
    src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");        // an import in a comment is no import
    for (const m of src.matchAll(STATIC_IMPORT)) {
      const spec = m[1] || m[2];
      if (!spec.startsWith(".")) continue;
      walk(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
    }
    out.push(file);
  };
  for (const r of roots) walk(r);
  return out;                                                                       // dependencies first, as the browser would run them
}
// the roots: the router and the town page (the one page of a town, both levels; whatever it imports statically is preloaded with it)
const PRELOAD_ROOTS = ["js/product/app.js", "js/product/city/home.js"];
const preloadFiles = () => staticGraph(PRELOAD_ROOTS);

// ── a small DevTools client ──
function findChrome() {
  const c = [process.env.CHROME_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
  const f = c.find((p) => fs.existsSync(p));
  if (!f) throw new Error("Chrome not found; set CHROME_PATH");
  return f;
}
async function launch() {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = path.join(os.tmpdir(), "cp2-perf-profile" + (process.env.CDP_SLOT ? "-" + String(process.env.CDP_SLOT).replace(/[^\w-]/g, "") : ""));
  const get = (p, method = "GET") => new Promise((res, rej) => { const rq = http.request({ host: "127.0.0.1", port, path: p, method }, (r) => { let b = ""; r.on("data", (x) => (b += x)); r.on("end", () => res(b)); }); rq.on("error", rej); rq.end(); });
  const chrome = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
  let ver = null;
  for (let i = 0; i < 60 && !ver; i++) { try { ver = JSON.parse(await get("/json/version")); } catch (e) { await sleep(250); } }
  if (!ver) { chrome.kill(); throw new Error("Chrome did not start"); }
  const tab = JSON.parse(await get("/json/new?about:blank", "PUT"));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const waiting = new Map(), listeners = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); return; }
    for (const l of listeners) l(d.method, d.params || {});
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, (d) => (d.error ? rej(new Error(method + ": " + d.error.message)) : res(d.result))); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
  return {
    send, eval: evalJs, on: (fn) => listeners.push(fn), off: (fn) => listeners.splice(listeners.indexOf(fn), 1),
    async close() { try { await send("Browser.close"); } catch (e) { /* closing */ } setTimeout(() => { try { chrome.kill(); } catch (e) { /* gone */ } }, 500); }
  };
}

// the page records its own paint, largest paint and layout shifts before any script of the app runs
const INIT = `(() => {
  const P = window.__perf = { fcp: null, lcp: null, cls: 0, answer: null, shifts: [] };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") P.fcp = e.startTime; }).observe({ type: "paint", buffered: true }); } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { P.cls += e.value; P.shifts.push({ v: Math.round(e.value * 1000) / 1000, at: Math.round(e.startTime), n: (e.sources || []).slice(0, 2).map((s) => s.node && s.node.nodeType === 1 ? s.node.tagName.toLowerCase() + (s.node.className && s.node.className.baseVal === undefined ? "." + String(s.node.className).trim().split(/ +/)[0] : "") : "?").join(",") }); } }).observe({ type: "layout-shift", buffered: true }); } catch (e) {}
  // the first answer sentence: the moment the page has its h1 and the loading skeleton is gone
  const t = setInterval(() => { if (document.querySelector("h1") && !document.querySelector(".sk, [aria-busy='true']")) { P.answer = performance.now(); clearInterval(t); } }, 25);
})();`;

const PROFILES = {
  local: null,
  slow: { offline: false, latency: 150, downloadThroughput: (1.6 * 1e6) / 8, uploadThroughput: (0.75 * 1e6) / 8 }       // 150 ms RTT, 1.6 Mbit/s
};

// one page load: everything that crossed the network between navigate and "quiet for 1.2 s"
async function load(b, url, profile) {
  const reqs = new Map();
  const hook = (method, p) => {
    if (method === "Network.requestWillBeSent") {
      if (!reqs.has(p.requestId)) reqs.set(p.requestId, { url: p.request.url, type: p.type, initiator: p.initiator, method: p.request.method, t0: p.timestamp, status: null, wire: 0, cache: false, done: false });
    } else if (method === "Network.responseReceived") {
      const r = reqs.get(p.requestId); if (!r) return;
      r.status = r.status || p.response.status; r.cache = !!p.response.fromDiskCache || !!p.response.fromPrefetchCache;
      r.enc = (p.response.headers["content-encoding"] || p.response.headers["Content-Encoding"] || "");
    } else if (method === "Network.responseReceivedExtraInfo") {
      const r = reqs.get(p.requestId); if (r) r.status = p.statusCode;                       // the status on the wire (a 304 shows as 200 in responseReceived)
    } else if (method === "Network.loadingFinished") {
      const r = reqs.get(p.requestId); if (r) { r.wire = p.encodedDataLength; r.done = true; r.t1 = p.timestamp; }
    } else if (method === "Network.loadingFailed") {
      const r = reqs.get(p.requestId); if (r) { r.failed = p.errorText; r.done = true; }
    }
  };
  b.on(hook);
  await b.send("Network.emulateNetworkConditions", profile || { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const t0 = Date.now();
  await b.send("Page.navigate", { url });
  let quiet = 0;
  while (Date.now() - t0 < 45000) {
    await sleep(200);
    const busy = [...reqs.values()].some((r) => !r.done);
    quiet = busy ? 0 : quiet + 200;
    if (quiet >= 1200 && (await b.eval("document.readyState")) === "complete") break;
  }
  b.off(hook);
  const page = await b.eval(`(() => { const P = window.__perf || {}; const blocking = performance.getEntriesByType("resource").filter((e) => e.renderBlockingStatus === "blocking").map((e) => e.name); return { fcp: P.fcp, lcp: P.lcp, cls: P.cls, answer: P.answer, shifts: P.shifts, blocking, h1: !!document.querySelector("h1") }; })()`);
  return { reqs: [...reqs.values()], page };
}

// request chain: a request's parent is the request whose url is its initiator (a module's importer, a script's fetch); the document is depth 0
function depthOf(reqs) {
  const byUrl = new Map(reqs.map((r) => [r.url, r]));
  const memo = new Map();
  const d = (r, guard = 0) => {
    if (memo.has(r)) return memo.get(r);
    let n = 1;
    const ini = r.initiator && (r.initiator.url || (r.initiator.stack && r.initiator.stack.callFrames && r.initiator.stack.callFrames[0] && r.initiator.stack.callFrames[0].url));
    const parent = ini && ini !== r.url ? byUrl.get(ini) : null;
    if (parent && guard < 20) n = d(parent, guard + 1) + 1;
    memo.set(r, n);
    return n;
  };
  const deepest = reqs.reduce((a, r) => (d(r) > d(a) ? r : a), reqs[0] || { url: "" });
  const chain = [];
  for (let r = deepest, i = 0; r && i < 20; i++) { chain.unshift(r.url.replace(BASE, "")); const ini = r.initiator && r.initiator.url; r = ini && ini !== r.url ? byUrl.get(ini) : null; }
  return { n: reqs.length ? d(deepest) : 0, chain };
}

function summarize(L, label) {
  const own = L.reqs.filter((r) => r.url.startsWith(BASE) && r.method === "GET");
  const origin = new URL(BASE).origin;
  const third = L.reqs.filter((r) => /^https?:/.test(r.url) && new URL(r.url).origin !== origin).map((r) => r.url);
  const fromCache = (r) => r.cache || (r.status === 200 && r.wire === 0 && r.done && !r.failed);
  const n304 = own.filter((r) => r.status === 304).length;
  const memo = own.filter(fromCache).length;
  const pics = own.filter((r) => /\/assets\/product\/hero-/.test(r.url)).map((r) => r.url.replace(/^.*\/assets\/product\//, "") + " " + Math.round(r.wire / 1024) + "KB");
  const pageModules = own.filter((r) => /\/js\/(product\/)?pages\//.test(r.url)).map((r) => r.url.replace(/^.*\/js\//, ""));
  const failed = L.reqs.filter((r) => r.method === "GET" && (r.failed || (r.status >= 400 && !/\/js\/product\//.test(r.url)))).map((r) => (r.status || r.failed) + " " + r.url.replace(BASE, ""));
  return {
    label, requests: L.reqs.length, wireKB: Math.round(L.reqs.reduce((s, r) => s + (r.wire || 0), 0) / 102.4) / 10,
    depth: depthOf(L.reqs).n, chain: depthOf(L.reqs).chain, third, n304, fromMemory: memo, notModified: n304 + memo,
    fcp: round(L.page.fcp), lcp: round(L.page.lcp), cls: Math.round((L.page.cls || 0) * 1000) / 1000, answer: round(L.page.answer),
    shifts: L.page.shifts, blocking: (L.page.blocking || []).map((u) => u.replace(BASE, "")), pics, pageModules, failed, h1: L.page.h1,
    heads: L.reqs.filter((r) => r.method === "HEAD").map((r) => r.status + " " + r.url.replace(BASE, ""))
  };
}
const round = (x) => (x == null ? null : Math.round(x));

async function run() {
  const args = process.argv.slice(2);
  const quick = args.includes("--quick");
  const jsonOut = (args.find((a) => a.startsWith("--json=")) || "").slice(7);
  const scenarios = [["#/c/1031", 1280, false], ["#/c/1031", 390, true]];
  if (!quick) scenarios.push(["#/", 1280, false], ["#/", 390, true]);
  const b = await launch();
  const results = [];
  try {
    await b.send("Page.enable"); await b.send("Runtime.enable"); await b.send("Network.enable");
    await b.send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
    for (const [hash, width, mobile] of scenarios) {
      await b.send("Emulation.setDeviceMetricsOverride", { width, height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile });
      const url = BASE + "/n.html" + hash;
      for (const pname of ["local", "slow"]) {
        await b.send("Network.setCacheDisabled", { cacheDisabled: false });
        await b.send("Network.clearBrowserCache");
        await b.send("Page.navigate", { url: "about:blank" });
        await b.eval("0");
        const cold = summarize(await load(b, url, PROFILES[pname]), `${hash} ${width} ${pname} cold`);
        await sleep(500);
        await b.send("Page.navigate", { url: "about:blank" });
        const warm = summarize(await load(b, url, PROFILES[pname]), `${hash} ${width} ${pname} warm`);
        results.push(cold, warm);
        process.stderr.write(`${cold.label}: ${cold.requests} req, ${cold.wireKB} KB, LCP ${cold.lcp}; warm ${warm.notModified}/${warm.requests} revalidated, ${warm.wireKB} KB\n`);
      }
    }
    // the dark theme must fetch the dark picture only
    await b.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await b.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await b.send("Page.navigate", { url: BASE + "/n.html#/c/1031" }); await sleep(1500);
    await b.eval(`localStorage.setItem("cp2-theme", "dark")`);
    await b.send("Network.clearBrowserCache");
    await b.send("Page.navigate", { url: "about:blank" });
    const dark = summarize(await load(b, BASE + "/n.html#/c/1031", null), "#/c/1031 1280 dark cold");
    await b.eval(`localStorage.removeItem("cp2-theme")`);
    results.push(dark);
  } finally { await b.close(); }

  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2));
  const rows = results.map((r) => `| ${r.label} | ${r.requests} | ${r.wireKB} | ${r.depth} | ${r.third.length} | ${r.fcp} | ${r.lcp} | ${r.answer} | ${r.cls} | ${r.notModified} |`);
  console.log("| load | requests | wire KB | depth | third party | FCP ms | LCP ms | h1 and no skeleton ms | CLS | 304 or memory |\n|---|---|---|---|---|---|---|---|---|---|\n" + rows.join("\n"));
  console.log("\ndeepest chain (first row):", results[0].chain.join(" > "));
  console.log("blocking the first paint (cold, first row):", JSON.stringify(results[0].blocking));
  for (const r of results.filter((x) => /1031 (1280|390) (local|slow) cold/.test(x.label))) console.log(`shifts [${r.label}]:`, JSON.stringify(r.shifts));
  for (const r of results.filter((x) => / cold/.test(x.label))) console.log(`pictures [${r.label}]:`, r.pics.join(", ") || "none", "| page modules:", r.pageModules.join(", ") || "none", "| failed:", r.failed.join(", ") || "none", "| HEAD probes:", (r.heads || []).join(", ") || "none");
}

module.exports = { staticGraph, preloadFiles, PRELOAD_ROOTS, launch };

if (require.main === module) {
  if (process.argv.includes("--preload")) {
    for (const f of preloadFiles()) console.log(`<link rel="modulepreload" href="${f}">`);
  } else run().catch((e) => { console.error(e); process.exit(1); });
}
