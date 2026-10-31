"use strict";
// node src/tools/audit_probe.js [key,key,...]   (CDP_SLOT=<n> to run beside other tools)   (q1)
// The mechanical look at the town page, by the DOM: for each town, the short level at 390 and the full level at 1280, in light and dark, it lists text under 4.5:1 (3:1 for large text; text over a picture is judged at 3:1),
// text a box hides, text boxes that overlap line by line, and empty boxes. Colours written as color(srgb ...) are read too. It only reads; exit code 0. What a person must still look at: tone, order of numbers, the picture itself.
const { launch } = require("./cdp");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const towns = (process.argv[2] || "1031,9000,3000,99,472,16").split(",");
const base = "http://localhost:8800/n.html";
function audit() {
  const skipped = { n: 0 };
  const parse = (c) => { let m = /rgba?\(([^)]+)\)/.exec(c); if (m) { const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; } m = /color\((?:srgb|srgb-linear|display-p3)\s+([^)]+)\)/.exec(c); if (m) { const p = m[1].split(/[ \/]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1 }; } skipped.n++; return null; };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const dark = document.documentElement.dataset.theme === "dark";
  const pageBg = parse(getComputedStyle(document.body).backgroundColor) || { r: dark ? 17 : 255, g: dark ? 24 : 255, b: dark ? 39 : 255, a: 1 };
  const bgOf = (el) => { const stack = []; let image = false; for (let p = el; p && p.nodeType === 1; p = p.parentElement) { const cs = getComputedStyle(p); const c = parse(cs.backgroundColor); if (cs.backgroundImage !== "none") image = true; if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let bg = { ...pageBg, a: 1 }; if (stack.length && stack[stack.length - 1].a >= 1) bg = stack.pop(); while (stack.length) bg = over(stack.pop(), bg); return { bg, image }; };
  const sel = (el) => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/ +/).slice(0, 2).join(".") : "");
  const res = { contrast: [], clipped: [], overlap: [], empty: [], skipped: skipped.n }; const seen = new Set();
  const tw = document.createTreeWalker(document.querySelector("#view") || document.body, NodeFilter.SHOW_TEXT);
  const texts = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.nodeValue.replace(/[\u2066-\u2069\s]/g, ""); if (!t) continue; const el = n.parentElement;
    if (!el || el.closest(".sr, [hidden], svg, script, style, [aria-hidden=true], .n-kit-live")) continue; { const dt = el.closest("details:not([open])"); if (dt && !el.closest("summary")) continue; }
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") continue; const er = el.getBoundingClientRect(); if (er.width <= 2 && er.height <= 2) continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; const lines = [...rg.getClientRects()].filter((x) => x.width > 1 && x.height > 1);
    let op = 1; for (let p = el; p && p.nodeType === 1; p = p.parentElement) op *= parseFloat(getComputedStyle(p).opacity);
    if (op < 0.05) continue;
    const fg = parse(cs.color); if (!fg) continue; const { bg, image } = bgOf(el);
    const fgEff = over({ ...fg, a: fg.a * op }, bg), cr = ratio(fgEff, bg), fs = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700, large = fs >= 24 || (fs >= 18.66 && bold);
    texts.push({ el, r, lines, text: n.nodeValue.trim().slice(0, 30) });
    if (cr < (large ? 3 : 4.5) && !image) { const k = sel(el) + "|" + cs.color + "|" + Math.round(bg.r) + "," + Math.round(bg.g) + "," + Math.round(bg.b); if (!seen.has(k)) { seen.add(k); res.contrast.push(`${cr.toFixed(2)} ${sel(el)} "${n.nodeValue.trim().slice(0, 24)}" fg ${cs.color} bg ${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)} ${fs}px`); } }
    else if (image && cr < 3) { const k = "img" + sel(el); if (!seen.has(k)) { seen.add(k); res.contrast.push(`(over a picture) ${cr.toFixed(2)} ${sel(el)} "${n.nodeValue.trim().slice(0, 24)}"`); } }
  }
  let minR = 99;
  for (const t of document.querySelectorAll("#view svg text")) {
    const txt = t.textContent.replace(/[⁦-⁩\s]/g, ""); if (!txt || t.closest("[hidden], .sr")) continue; const cs = getComputedStyle(t); if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = t.getBoundingClientRect(); if (r.width < 1) continue; const fg = parse(cs.fill); if (!fg) continue; const svgEl = t.ownerSVGElement, { bg, image } = bgOf(svgEl.parentElement || svgEl);
    const op = parseFloat(cs.opacity) * parseFloat(cs.fillOpacity || 1); const fgEff = over({ ...fg, a: fg.a * op }, bg), cr = ratio(fgEff, bg), fs = parseFloat(cs.fontSize);
    if (cr < minR) minR = cr; if (cr < (fs >= 24 ? 3 : 4.5) && !image) res.contrast.push(`svg ${cr.toFixed(2)} "${txt.slice(0, 20)}" fill ${cs.fill} bg ${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)} ${fs}px`);
  }
  res.minSvg = minR;
  // clipped text: an element that hides its overflow and holds more than it shows (except a deliberate line clamp)
  for (const el of document.querySelectorAll("#view *")) {
    const cs = getComputedStyle(el); if (!/(hidden|clip)/.test(cs.overflowX + cs.overflowY) || el.closest(".sr, [hidden], svg")) continue;
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== "none";
    if ((el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) && el.textContent.trim() && el.clientWidth > 1 && el.clientHeight > 1 && !clamp && cs.textOverflow !== "ellipsis") res.clipped.push(`${sel(el)} scroll ${el.scrollWidth}x${el.scrollHeight} client ${el.clientWidth}x${el.clientHeight} "${el.textContent.trim().slice(0, 30)}"`);
  }
  // overlapping text boxes of different elements
  texts.sort((a, b) => a.r.top - b.r.top);
  for (let i = 0; i < texts.length && res.overlap.length < 12; i++) for (let j = i + 1; j < texts.length; j++) { const a = texts[i], b = texts[j]; if (b.r.top > a.r.bottom) break; if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue; let ix = 0, iy = 0; for (const la of a.lines) for (const lb of b.lines) { const x = Math.min(la.right, lb.right) - Math.max(la.left, lb.left), y = Math.min(la.bottom, lb.bottom) - Math.max(la.top, lb.top); if (x > ix && y > 4) { ix = x; iy = y; } } if (ix > 3 && iy > 4) res.overlap.push(`"${a.text}" (${sel(a.el)}) x "${b.text}" (${sel(b.el)}) ${Math.round(ix)}x${Math.round(iy)}`); }
  // empty boxes: a card, row or section with no text and no svg/img/canvas and a visible size
  for (const el of document.querySelectorAll("#view section, #view li, #view article, #view [class*=card], #view [class*=box]")) { if (el.closest("[hidden], .sr") ) continue; const r = el.getBoundingClientRect(); if (r.width > 60 && r.height > 30 && !el.textContent.trim() && !el.querySelector("svg, img, canvas, input, button, a, i, b, span.n-kit-cat")) res.empty.push(sel(el) + " " + Math.round(r.width) + "x" + Math.round(r.height)); }
  return res;
}
(async () => {
  const b = await launch(); let total = 0;
  for (const key of towns) for (const [level, w] of [["simple", 390], ["full", 1280]]) for (const th of ["light", "dark"]) {
    await b.viewport(w, w < 700); b.clearProblems();
    await b.open(`${base}#/c/${key}?v=${level}`); if (th === "dark") await b.eval(`document.documentElement.dataset.theme = "dark"`); await sleep(500);
    if (process.env.SELFTEST) await b.eval(`(() => { const d = document.createElement("div"); d.id = "selftest"; d.style.cssText = "color:#aaaaaa;background:#ffffff;font-size:14px"; d.textContent = "selftest low contrast"; const d2 = document.createElement("div"); d2.style.cssText = "color:color-mix(in srgb, #888 60%, #444);background:#222;font-size:14px"; d2.textContent = "selftest mixed"; document.querySelector("#view").append(d, d2); })()`);
    const r = await b.eval("(" + audit.toString() + ")()");
    const n = r.contrast.length + r.clipped.length + r.overlap.length + r.empty.length; total += n;
    console.log(`== ${key} ${level} ${w} ${th}: (colours not read: ${r.skipped}, lowest svg text ${r.minSvg.toFixed(2)}) contrast ${r.contrast.length}, clipped ${r.clipped.length}, overlap ${r.overlap.length}, empty ${r.empty.length}${b.problems().length ? ", CONSOLE " + b.problems().join("|") : ""}`);
    for (const k of ["contrast", "clipped", "overlap", "empty"]) r[k].slice(0, 8).forEach((x) => console.log("   " + k + ": " + x));
  }
  console.log("total findings " + total);
  await b.close(); setTimeout(() => process.exit(0), 500);
})().catch((e) => { console.error(e.stack); process.exit(1); });
