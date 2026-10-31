"use strict";
// node src/tools/motion_check.js [baseUrl=http://localhost:8800] [cityKey=9000]      (MOTION_ONLY="/trends|/compare" checks only some screens)
// Runs every screen with the animations ON: scrolls down through the page once, waits, and then looks for what an animation can break:
//   - a block that never appeared (.rv without .in), a chart that never started (.viz without .in) although it is on the page and visible;
//   - a page whose final text differs from the same page without animation (a counted number that stops short, a label that never shows);
//   - console errors and sideways overflow.
process.env.CP_MOTION = "on";
const { launch } = require("./cdp");

const [BASE = "http://localhost:8800", C = "9000"] = process.argv.slice(2).filter((a) => a !== "--n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// UI=n runs the product (web/n.html, npm run motion:n)
const N = process.env.UI === "n" || process.argv.includes("--n"), PAGE = N ? "/n.html" : "/";
const N_ROUTES = ["#/", `#/c/${C}`, `#/c/${C}?q=changed`, `#/c/${C}/simple`, "#/c/16/simple", `#/c/${C}/d/child`, `#/c/${C}/d/outcomes`, `#/c/${C}/i/th_mmrv`, `#/c/${C}/i/wait_gyn_days`, `#/c/${C}/trends`, `#/c/${C}/compare`, `#/c/${C}/actions`, `#/c/${C}/ask`, `#/c/${C}/coverage`, `#/c/${C}/brief`, "#/method", "#/c/16", "#/c/16/brief", "#/c/16/i/th_mmrv", "#/c/935", "#/c/935/brief"];
const ROUTES = (N ? N_ROUTES : ["#/", `#/c/${C}`, `#/c/${C}/d/access`, `#/c/${C}/i/th_mmrv`, `#/c/${C}/i/wait_gyn_days`, `#/c/${C}/trends`, `#/c/${C}/compare`, `#/c/${C}/actions`, `#/c/${C}/ask`, "#/method", "#/c/16", "#/c/16/i/th_mmrv", "#/lab/entry", `#/c/${C}/lab/map`, `#/c/${C}/lab/report`, `#/c/${C}/lab/bloom`, `#/c/${C}/lab/wall`, `#/c/${C}/lab/questions`, `#/c/${C}/lab/combo`, `#/c/${C}/lab/questions4`, `#/c/16/lab/questions4`, `#/c/${C}/lab/questions3`, `#/c/16/lab/questions3`, `#/c/${C}/lab/questions2`, `#/c/16/lab/questions2`, `#/c/${C}/lab/combo?t=wall`, `#/c/${C}/lab/combo?t=questions`])
  .filter((r) => !process.env.MOTION_ONLY || new RegExp(process.env.MOTION_ONLY).test(r));

const STUCK = `(() => {
  const out = [], vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const hiddenAnc = (el) => !!el.closest('details:not([open]), [hidden]');
  const tag = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/ +/).slice(0, 3).join('.') : '');
  for (const el of document.querySelectorAll('.rv:not(.in)')) if (vis(el) && !hiddenAnc(el)) out.push('block never appeared: ' + tag(el));
  for (const el of document.querySelectorAll('.viz:not(.in)')) if (vis(el) && !hiddenAnc(el)) out.push('chart never started: ' + tag(el));
  return { out: out.slice(0, 6), motion: document.documentElement.classList.contains('js-motion') };
})()`;
const TEXT = `(document.getElementById('view') || document.body).innerText.replace(/\\s+/g, ' ').trim()`;

(async () => {
  const b = await launch();
  let bad = 0, loads = 0;
  for (const [width, mobile] of [[1280, false], [390, true]]) {
    await b.viewport(width, mobile);
    for (const r of ROUTES) {
      loads++;
      const flags = [];
      await b.reduceMotion(false); b.clearProblems();
      await b.open(BASE + PAGE + r);
      await b.scrollThrough(); await sleep(1600);
      const st = await b.eval(STUCK), animated = await b.eval(TEXT), o = await b.overflow();
      if (!st.motion) flags.push("the page did not switch the motion layer on (html.js-motion missing)");
      flags.push(...st.out);
      if (o.scrollWidth > o.clientWidth + 1) flags.push(`OVERFLOW ${o.scrollWidth} > ${o.clientWidth}: ${o.leaves.join(", ")}`);
      flags.push(...b.problems().filter((p) => !(N && /\/js\/product\/.*404|404.*\/js\/product\//.test(p))).slice(0, 3));
      await b.reduceMotion(true);
      await b.open(BASE + PAGE + r);
      const still = await b.eval(TEXT);
      if (animated !== still) {
        let i = 0; while (i < animated.length && animated[i] === still[i]) i++;
        flags.push(`final text differs from the static page at character ${i}: animated "…${animated.slice(Math.max(0, i - 20), i + 40)}" vs static "…${still.slice(Math.max(0, i - 20), i + 40)}"`);
      }
      if (flags.length) { bad++; console.log(`[${width}] ${r}\n   ` + flags.join("\n   ")); }
    }
  }
  console.log(`motion check: ${loads} screens, ${bad} with problems`);
  await b.close();
  setTimeout(() => process.exit(bad ? 2 : 0), 800);
})().catch((e) => { console.error(e.message); process.exit(1); });
