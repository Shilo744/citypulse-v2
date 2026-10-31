"use strict";
// A throw-away headless Chrome driven over the DevTools protocol (Node 22 has a WebSocket client built in).
// It gives the screenshot and smoke tools a real viewport width (phones included), which the --screenshot flag cannot.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [process.env.CHROME_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error("Chrome not found; set CHROME_PATH");
  return found;
}

async function launch() {
  const port = 9400 + Math.floor(Math.random() * 400);
  // one profile per slot: tools that run side by side (CDP_SLOT=1, 2, ...) never fight over a profile lock
  const profile = path.join(os.tmpdir(), "cp2-chrome-profile" + (process.env.CDP_SLOT ? "-" + String(process.env.CDP_SLOT).replace(/[^\w-]/g, "") : ""));
  const get = (p, method = "GET") => new Promise((res, rej) => { const rq = http.request({ host: "127.0.0.1", port, path: p, method }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => res(b)); }); rq.on("error", rej); rq.end(); });
  const chrome = spawn(findChrome(), ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
  let ver = null;
  for (let i = 0; i < 60 && !ver; i++) { try { ver = JSON.parse(await get("/json/version")); } catch (e) { await sleep(250); } }
  if (!ver) { chrome.kill(); throw new Error("Chrome did not start"); }
  const tab = JSON.parse(await get("/json/new?about:blank", "PUT"));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let id = 0, problems = [];
  const handlers = {};          // protocol events a tool listens to: b.on("Fetch.requestPaused", (params) => ...)
  const waiting = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); return; }
    const p = d.params || {};
    if (d.method && handlers[d.method]) handlers[d.method].forEach((fn) => fn(p));
    if (d.method === "Runtime.consoleAPICalled" && ["error", "assert"].includes(p.type)) problems.push("console." + p.type + ": " + p.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
    else if (d.method === "Runtime.exceptionThrown") problems.push("exception: " + (p.exceptionDetails.exception?.description || p.exceptionDetails.text).slice(0, 300));
    else if (d.method === "Log.entryAdded" && p.entry.level === "error" && !/fonts\.g/.test(p.entry.url || "")) problems.push("log: " + p.entry.text.slice(0, 160) + " " + (p.entry.url || "").slice(0, 80));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; waiting.set(i, (d) => (d.error ? rej(new Error(method + ": " + d.error.message)) : res(d.result))); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.value; };
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
  // Animations are off by default (the page is then in its final state, which is what a screenshot or a layout check wants);
  // CP_MOTION=on (or --motion in shot.js) keeps them, for the tools that test the motion itself.
  let mediaType = "", reduced = process.env.CP_MOTION !== "on";
  const applyMedia = () => send("Emulation.setEmulatedMedia", { media: mediaType, features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] });
  await applyMedia();

  let size = { width: 1280, mobile: false };
  const viewport = (width, mobile, height = 900) => { size = { width, mobile }; return send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile }); };
  return {
    viewport, eval: evalJs, send, on: (method, fn) => { (handlers[method] = handlers[method] || []).push(fn); },
    media: (type) => { mediaType = type || ""; return applyMedia(); },      // "print" shows the page as the printer would
    reduceMotion: (on = true) => { reduced = on; return applyMedia(); },
    // walks down the page so that everything below the fold gets its turn to animate in, then back to the top
    async scrollThrough(step = 450, pause = 140) {
      const total = await evalJs("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)");
      for (let y = 0; y < total; y += step) { await evalJs(`window.scrollTo(0, ${y})`); await sleep(pause); }
      await evalJs("window.scrollTo(0, 0)"); await sleep(200);
    },
    problems: () => [...new Set(problems)],
    clearProblems: () => { problems = []; },
    // navigate and wait until the app has left its loading state (skeleton blocks gone, document complete)
    async open(url) {
      await send("Page.navigate", { url }); await sleep(500);
      for (let i = 0; i < 40; i++) { if (!(await evalJs(`!!document.querySelector('.sk, [aria-busy="true"]') || document.readyState !== 'complete' || (!!document.getElementById('gallery') && document.documentElement.dataset.ready !== '1')`))) break; await sleep(200); }
      await sleep(300);
    },
    // a full-height PNG: the viewport is stretched to the content, so sticky and 100vh parts lay out as on a tall screen
    async screenshot(file) {
      const h = Math.min(9000, Math.max(900, await evalJs("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)")));
      await viewport(size.width, size.mobile, h); await sleep(400);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
      return h;
    },
    // only what the window shows now, at its real size (the page stays scrollable: sticky bars and the leaf scrollbar are visible)
    async viewportShot(file) {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    },
    // anything sticking out sideways is a layout bug on a phone: { scrollWidth, clientWidth, leaves: [...] }
    overflow: () => evalJs(`(() => { const vw = document.documentElement.clientWidth, off = new Set(); for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && !el.closest('.side, .tt, .scrim') && getComputedStyle(el).position !== 'fixed') off.add(el); } const leaves = [...off].filter((el) => ![...off].some((o) => o !== el && el.contains(o))); return { scrollWidth: document.documentElement.scrollWidth, clientWidth: vw, leaves: leaves.slice(0, 6).map((el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/ +/).join('.') : '')) }; })()`),
    async close() { try { await send("Browser.close"); } catch (e) { /* closing */ } setTimeout(() => { try { chrome.kill(); } catch (e) { /* gone */ } }, 500); }
  };
}

module.exports = { launch };
