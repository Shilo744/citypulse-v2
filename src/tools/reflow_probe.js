"use strict";
// node src/tools/reflow_probe.js [key,key,...] [width=320] [font=200%]   (CDP_SLOT=<n> to run beside other tools)   (q1)
// Reflow at 320 px with the text at 200 percent on every kind of page of each town (town page, the short level, the five categories, four figures, the tools): anything whose box or text sticks out of the window sideways
// (the document is right to left: what goes past the left edge makes the sideways scroll) is printed with its selector. The font is set after each page opened and taken away again before the next one (chrome_probe --mode=reflow keeps it from page to page, so the pages are drawn at the large size; both ways were run in q1: 129 pages, none sticks out).
const { launch } = require("./cdp");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const towns = (process.argv[2] || "1031,9000,3000,99,472,16,935").split(","), W = Number(process.argv[3] || 320), PCT = process.argv[4] || "200%";
const base = "http://localhost:8800/n.html";
function inPage() {
  const vw = document.documentElement.clientWidth, ox = window.scrollX;
  const sel = (el) => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/ +/).slice(0, 3).join(".") : "");
  const clipped = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p); if (/(hidden|clip|auto|scroll)/.test(o.overflowX)) { const pr = p.getBoundingClientRect(); if (pr.left + ox >= -1 && pr.right + ox <= vw + 1) return true; } } return false; };
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest(".sr, .side, .scrim, .tt") || getComputedStyle(el).position === "fixed") continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 && r.height === 0) continue;
    if (!(r.left + ox < -1 || r.right + ox > vw + 1)) continue; if (clipped(el)) continue; if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    out.push(sel(el) + " [" + Math.round(r.left + ox) + ".." + Math.round(r.right + ox) + "]");
  }
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || el.closest(".sr, .side, .scrim, .tt, script, style") || getComputedStyle(el).position === "fixed") continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if (r.width === 0) continue;
    if (!(r.left + ox < -1 || r.right + ox > vw + 1)) continue; if (clipped(el)) continue;
    out.push(sel(el) + ' TEXT "' + n.nodeValue.trim().slice(0, 24) + '" [' + Math.round(r.left + ox) + ".." + Math.round(r.right + ox) + "]");
  }
  return { sw: document.documentElement.scrollWidth, vw, n: out.length, list: out.slice(0, 5) };
}
(async () => {
  const b = await launch(); let bad = 0, total = 0;
  await b.viewport(1280, false);
  for (const key of towns) {
    const c = "#/c/" + key;
    await b.viewport(1280, false); await b.open(base + c + "?v=full");
    const links = await b.eval("(" + (() => { const f = (p) => [...new Set([...document.querySelectorAll('#view a[href*="/' + p + '/"]')].map((e) => (new RegExp("/" + p + "/([^/?#]+)").exec(e.getAttribute("href")) || [])[1]).filter(Boolean))]; return { d: f("d"), i: f("i") }; }).toString() + ")()");
    const routes = [["home", c], ["simple", c + "/simple"], ...["child", "outcomes", "mental", "safety", "context"].map((d) => ["d/" + d, c + "/d/" + d]), ...links.i.slice(0, 4).map((i) => ["i/" + i, c + "/i/" + i]), ...["trends", "compare", "actions", "ask", "coverage", "method", "glossary", "brief"].map((p) => [p, c + "/" + p])];
    await b.viewport(W, true);
    for (const [id, hash] of routes) {
      await b.open(base + hash); await b.eval(`document.documentElement.style.fontSize = "${PCT}"`); await sleep(450);
      const r = await b.eval("(" + inPage.toString() + ")()"); total++;
      if (r.sw > r.vw + 1 || r.n) { bad++; console.log(`${key} ${id}: scrollWidth ${r.sw}/${r.vw}, ${r.n} out: ${r.list.join(" ; ")}`); }
      await b.eval(`document.documentElement.style.fontSize = ""`);
    }
  }
  console.log(`checked ${total} pages at ${W}px, font ${PCT}: ${bad} with something sticking out`);
  await b.close(); setTimeout(() => process.exit(0), 500);
})().catch((e) => { console.error(e.stack); process.exit(1); });
