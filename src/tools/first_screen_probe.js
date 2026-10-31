"use strict";
// node src/tools/first_screen_probe.js [--towns=1031,99,472,16,9000] [--sizes=768x1024,1024x768] [--json]
// Where does the answer sentence of the town home start, compared with the height of the window? One line per town and size:
// top of the answer (#n-home-answer), window height, the share of the window, the bottom of the picture band and of the ask box.
// The plan (FINAL.md row 2): at most 520 px at 1280x900, at most 640 at 390x844, and at most 0.62 of the window height on tablets.
// Read-only: it opens pages of the running server and never writes to it.
const { launch } = require("./cdp");

const SIZES = "320x700,360x740,390x844,480x900,600x960,768x1024,900x1000,1024x768,1180x820,1280x900,1366x768,1440x900,1920x1080";
const arg = (name, dflt) => ((process.argv.find((a) => a.startsWith("--" + name + "=")) || "").slice(name.length + 3)) || dflt;
const towns = arg("towns", "1031,99,472,16,9000").split(",");
const sizes = arg("sizes", SIZES).split(",").map((s) => s.split("x").map(Number));
const BASE = process.env.CP_BASE || "http://localhost:8800";

const MEASURE = `(() => {
  const top = (el) => (el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null);
  const bottom = (el) => (el ? Math.round(el.getBoundingClientRect().bottom + window.scrollY) : null);
  const ans = document.getElementById('n-home-answer'), hero = document.querySelector('.n-home-hero'), ask = document.querySelector('.n-home-ask'), art = document.querySelector('.n-band-art');
  return { y: top(ans), hero: bottom(hero), ask: bottom(ask), art: art ? Math.round(art.getBoundingClientRect().height) : 0, vh: window.innerHeight, over: document.documentElement.scrollWidth - document.documentElement.clientWidth };
})()`;

(async () => {
  const b = await launch();
  const rows = [];
  for (const key of towns) {
    for (const [w, h] of sizes) {
      await b.viewport(w, w <= 768, h);
      await b.open(`${BASE}/n.html#/c/${key}`);
      await new Promise((r) => setTimeout(r, 300));
      const m = await b.eval(MEASURE);
      rows.push({ key, w, h, ...m, share: m.y == null ? null : +(m.y / m.vh).toFixed(2) });
    }
  }
  if (process.argv.includes("--json")) console.log(JSON.stringify(rows));
  else {
    console.log("town   size        answer-y  share  hero-bottom  ask-bottom  art-h  overflow");
    for (const r of rows) console.log(`${r.key.padEnd(6)} ${(r.w + "x" + r.h).padEnd(11)} ${String(r.y).padStart(8)}  ${String(r.share).padStart(5)}  ${String(r.hero).padStart(11)}  ${String(r.ask).padStart(10)}  ${String(r.art).padStart(5)}  ${r.over}`);
  }
  b.problems().forEach((p) => console.log("  " + p));
  await b.close();
  setTimeout(() => process.exit(0), 800);
})().catch((e) => { console.error(e.message); process.exit(1); });
