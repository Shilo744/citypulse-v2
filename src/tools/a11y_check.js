"use strict";
// node src/tools/a11y_check.js [baseUrl=http://localhost:8800] [cityKey=9000]
// A quick structural accessibility audit of every kind of screen: names for buttons, links and inputs, one h1, heading order,
// unique ids, no positive tabindex, labelled charts and landmarks. It does not replace a screen-reader pass; it catches the
// mistakes that are easy to make and easy to see.
const { launch } = require("./cdp");

const [BASE = "http://localhost:8800", C = "9000"] = process.argv.slice(2).filter((a) => a !== "--n");
// UI=n audits the product (web/n.html, npm run a11y:n); an old h1 that the product demoted to a level-2 heading (aria-level) counts as the level it says
const N = process.env.UI === "n" || process.argv.includes("--n"), PAGE = N ? "/n.html" : "/";
const N_ROUTES = ["#/", "#/method", "#/glossary", `#/c/${C}/glossary`, `#/c/${C}/privacy`, `#/c/${C}`, `#/c/${C}?q=peers`, `#/c/${C}/simple`, "#/c/16/simple", "#/c/935/simple", `#/c/${C}/brief`, `#/c/${C}/d/child`, `#/c/${C}/d/outcomes`, `#/c/${C}/i/th_mmrv`, `#/c/${C}/i/road_severe_100k`, `#/c/${C}/i/bmi_g7_over`, `#/c/${C}/trends`, `#/c/${C}/compare`, `#/c/${C}/actions`, `#/c/${C}/ask`, `#/c/${C}/coverage`, `#/c/${C}/method`, "#/c/16", "#/c/16/brief", "#/c/935", "#/c/935/brief", "#/nonsense", `#/c/${C}/d/not-a-domain`, "#/c/not-a-city"];
const ROUTES = (N ? N_ROUTES : ["#/", "#/method", `#/c/${C}`, `#/c/${C}/d/access`, `#/c/${C}/i/th_mmrv`, `#/c/${C}/trends`, `#/c/${C}/compare`, `#/c/${C}/actions`, `#/c/${C}/ask`, "#/lab", "#/lab/entry", `#/c/${C}/lab/map`, `#/c/${C}/lab/report`, `#/c/${C}/lab/bloom`, `#/c/${C}/lab/wall`, `#/c/${C}/lab/questions`, `#/c/${C}/lab/combo`, `#/c/${C}/lab/questions4`, `#/c/16/lab/questions4`, `#/c/${C}/lab/questions3`, `#/c/16/lab/questions3`, `#/c/${C}/lab/questions2`, `#/c/16/lab/questions2`, `#/c/${C}/lab/combo?t=wall`, `#/c/${C}/lab/combo?t=questions`])
  .filter((r) => !process.env.A11Y_ONLY || new RegExp(process.env.A11Y_ONLY).test(r));       // A11Y_ONLY="/trends|/compare" checks only some screens

const AUDIT = `(() => {
  const issues = [], vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim();
  const tag = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/ +/).slice(0, 2).join('.') : '');
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role=button], summary')) {
    if (!vis(el) && !el.matches('.sr')) continue;
    if (!name(el)) issues.push('no accessible name: ' + tag(el));
    if (el.tagName === 'BUTTON' && !el.getAttribute('type')) issues.push('button without type: ' + tag(el));
    if (el.tabIndex > 0) issues.push('positive tabindex: ' + tag(el));
  }
  const lvl = (el) => Number(el.getAttribute('aria-level') || el.tagName[1]);
  const h1 = [...document.querySelectorAll('h1, [role=heading]')].filter((el) => vis(el) && lvl(el) === 1);
  if (h1.length !== 1) issues.push('h1 count is ' + h1.length);
  let prev = 0; for (const h of [...document.querySelectorAll('h1,h2,h3,h4,[role=heading]')].filter(vis)) { const n = lvl(h); if (prev && n > prev + 1) issues.push('heading jumps h' + prev + ' to h' + n + ': ' + h.textContent.trim().slice(0, 30)); prev = n; }
  const ids = {}; for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1;
  Object.entries(ids).filter(([, n]) => n > 1).forEach(([id]) => issues.push('duplicate id ' + id));
  for (const el of document.querySelectorAll('svg[role=img]')) if (!el.getAttribute('aria-label')) issues.push('chart without aria-label');
  for (const el of document.querySelectorAll('[role=img]:not(svg)')) if (!el.getAttribute('aria-label')) issues.push('role=img without aria-label: ' + tag(el));
  if (!document.querySelector('main')) issues.push('no main landmark');
  if (document.documentElement.lang !== 'he' || document.documentElement.dir !== 'rtl') issues.push('html lang/dir is not he/rtl');
  return issues;
})()`;

(async () => {
  const b = await launch();
  let total = 0;
  for (const [width, mobile] of [[1280, false], [390, true]]) {
    await b.viewport(width, mobile);
    for (const r of ROUTES) {
      await b.open(BASE + PAGE + r);
      const issues = [...new Set(await b.eval(AUDIT))];
      total += issues.length;
      if (issues.length) console.log(`[${width}] ${r}\n   ` + issues.slice(0, 8).join("\n   "));
    }
  }
  console.log(`a11y check: ${total} issues`);
  await b.close();
  setTimeout(() => process.exit(total ? 2 : 0), 800);
})().catch((e) => { console.error(e.message); process.exit(1); });
