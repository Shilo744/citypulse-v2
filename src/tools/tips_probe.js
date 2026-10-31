"use strict";
// node src/tools/tips_probe.js [--base=http://localhost:8800/n.html] [--towns=1031,16,9000] [--only=regex] [--width=1280] [--json=out.json] [--touch] [--quiet]
// The cards of the product (kit/tips.js): every mark that has a card (hover, keyboard focus, touch) on trends, compare, the category pages, some figure pages, the town page and the plan page of the towns,
// found through the listeners the old chart modules put on their marks (addEventListener is watched before the page loads). Each mark is hovered (a real pointer event with its place), the card is read,
// and the probe fails when a card that stays on screen says nothing the text around its mark does not already say (every number and every meaningful word of it is there: the same test as isRedundant,
// but against the whole section of the mark, which is a wider, stricter text than the one tips.js uses), or when a card is empty. It also checks the native hover texts (title) of the marks:
// one that repeats the text of its element and is not cut off must be gone after the pointer came. It prints, per kind of mark, what the card said before (raw) and what it says now (final, or none).
// With --touch a sample of marks is also tapped through real touch events: a card that stays must carry something new, a tap on a mark without extra information shows nothing.
// Several runs may go at the same time when each has its own CDP_SLOT.
const fs = require("fs");
const { launch } = require("./cdp");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith("--" + n + "=")); return a ? a.slice(n.length + 3) : d; };
const base = arg("base", "http://localhost:8800/n.html"), only = arg("only", ""), width = Number(arg("width", "1280")), jsonOut = arg("json", "");
const towns = arg("towns", "1031,16,9000").split(",");
const touch = process.argv.includes("--touch"), quiet = process.argv.includes("--quiet");

// the listeners of the old chart modules, collected before any script of the page runs
const HOOK = `window.__tipTargets = new Map(); const __orig = EventTarget.prototype.addEventListener;
EventTarget.prototype.addEventListener = function (type, fn, o) { if (this instanceof Element && /^(pointermove|pointerdown|focus|pointerenter)$/.test(type)) { let s = window.__tipTargets.get(this); if (!s) window.__tipTargets.set(this, (s = new Set())); s.add(type); } return __orig.call(this, type, fn, o); };`;

// what is run in the page: hovers every mark of #view and returns the cards
const RUN = `(async (opts) => {
  const tips = await import('/js/product/kit/tips.js');
  const tt = document.querySelector('.tt');
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const hiddenEye = (el, root) => { for (let e = el; e && e !== root.parentElement; e = e.parentElement) { if (e.hidden || (e.classList && e.classList.contains('sr')) || ['TITLE', 'DESC', 'STYLE', 'SCRIPT'].includes(e.tagName)) return true; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return true; } return false; };
  const textOf = (root) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), out = []; for (let n; (n = w.nextNode());) { const p = n.parentElement; if (p && n.nodeValue.trim() && !hiddenEye(p, root)) out.push(n.nodeValue); } return out.join(' '); };
  const outer = (e) => { let s = e.closest('section'); while (s && s.parentElement && s.parentElement.closest('section')) s = s.parentElement.closest('section'); return s; };
  const wideOf = (el) => el.closest('.in-hero, .dm-hero') || outer(el) || el.closest('.n-home-block, figure, .viz') || document.querySelector('#view');
  const path = (el) => { const p = []; let e = el; for (let k = 0; k < 3 && e && e.tagName; k++, e = e.parentElement) p.push(e.tagName.toLowerCase() + (e.getAttribute && e.getAttribute('class') ? '.' + e.getAttribute('class').trim().split(/ +/).slice(0, 2).join('.') : '')); return p.join(' < '); };
  const view = document.querySelector('#view'), recs = [];
  const marks = [...window.__tipTargets].filter(([el]) => el.isConnected && view.contains(el) && el.getBoundingClientRect().width >= 2 && el.getBoundingClientRect().height >= 2);
  const wideCache = new Map();
  const reset = async () => { tt.classList.remove('on'); tt.replaceChildren(); await tick(); };
  const read = () => { const on = tt.classList.contains('on'); return { on, state: tt.dataset.nTip || '', raw: tt.dataset.nRaw || '', final: on && !tt.hidden ? tt.textContent : '' }; };
  const seenCards = new Set();
  for (const [el, types] of marks) {
    const r = el.getBoundingClientRect(), big = r.width > 150 || r.height > 100;
    const pts = big ? [0.1, 0.3, 0.5, 0.7, 0.9].flatMap((fx) => [0.3, 0.7].map((fy) => [r.left + r.width * fx, r.top + r.height * fy])) : [[r.left + r.width / 2, r.top + r.height / 2]];
    const attempts = [];
    for (const [x, y] of pts) attempts.push({ how: 'pointer', x, y });
    if (types.has('focus')) attempts.push({ how: 'focus' });
    for (const at of attempts) {
      await reset();
      const init = { bubbles: true, cancelable: true, composed: true, clientX: at.x || 0, clientY: at.y || 0, pointerType: 'mouse', pointerId: 1, isPrimary: true };
      if (at.how === 'pointer') { el.dispatchEvent(new PointerEvent('pointerenter', { ...init, bubbles: false })); el.dispatchEvent(new PointerEvent('pointermove', init)); await tick(); await tick(); }
      else { el.focus({ preventScroll: true }); await tick(); await tick(); }
      let c = read();
      if (!c.on && at.how === 'pointer' && types.has('pointerdown')) { el.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'touch' })); await tick(); await tick(); c = read(); }
      const tag = at.how + '|' + path(el) + '|' + c.raw;
      if (!c.on || seenCards.has(tag)) { if (at.how === 'pointer') el.dispatchEvent(new PointerEvent('pointerleave', { ...init, bubbles: false })); else el.blur(); continue; }
      seenCards.add(tag);
      const w = wideOf(el); if (!wideCache.has(w)) wideCache.set(w, textOf(w));
      const redundant = c.final ? tips.isRedundant(c.final, wideCache.get(w)) : false;
      recs.push({ how: at.how, path: path(el), state: c.state, raw: c.raw, final: c.final, redundant, aria: (el.getAttribute('aria-label') || '').slice(0, 80) });
      if (at.how === 'pointer') el.dispatchEvent(new PointerEvent('pointerleave', { ...init, bubbles: false })); else el.blur();
    }
  }
  await reset();
  // the native hover texts: a title that repeats the text of its element and is not cut must be dropped once the pointer comes
  const titles = [];
  for (const el of view.querySelectorAll('[title]')) {
    if (el.closest('abbr') || el.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
    const t = el.getAttribute('title'), cut = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const still = el.hasAttribute('title');
    titles.push({ title: t, text: textOf(el).slice(0, 60), cut, kept: still, repeats: still && !cut && tips.isRedundant(t, textOf(el)), path: path(el) });
  }
  return JSON.stringify({ marks: marks.length, recs, titles });
})`;

// a few touch taps through real touch events (the page decides what a tap shows)
const TOUCH = (sel) => `(() => { const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.top > 0 && r.bottom < innerHeight; }); const e = els[Math.floor(els.length / 2)]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`;

async function pickRoutes(b, key) {
  const m = JSON.parse(await b.eval(`fetch('/api/city/${key}').then((r) => r.text())`));
  const doms = (m.domains || []).filter((d) => d.indicators && d.indicators.length);
  const inds = m.indicators || [], pick = [];
  const add = (a) => { if (a && !pick.includes(a.id)) pick.push(a.id); };
  add(inds.find((a) => (a.series || []).length >= 5 && ["concern", "watch"].includes(a.status) && a.direction));
  add(inds.find((a) => (a.series || []).length >= 3 && !a.direction));
  add(inds.find((a) => a.last && a.last.reliable === false));
  add(inds.find((a) => ["good", "strength"].includes(a.status) && (a.series || []).length >= 3));
  add(inds.find((a) => (a.series || []).some((p) => p.target != null) && a.last && a.last.reliable !== false));
  const c = "#/c/" + key;
  return [["home", c + "?v=full"], ["short", c + "/simple"], ["trends", c + "/trends"], ["compare", c + "/compare"], ["actions", c + "/actions"], ["ask", c + "/ask"], ["coverage", c + "/coverage"],
    ...["context", "child", "outcomes", "mental", "safety"].filter((id) => doms.some((d) => d.id === id) || true).map((id) => ["d/" + id, c + "/d/" + id]),
    ...pick.map((id) => ["i/" + id, c + "/i/" + id])];
}

(async () => {
  const b = await launch();
  const bad = [], table = new Map(), all = [];
  await b.send("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
  await b.viewport(width, width < 700);
  for (const key of towns) {
    await b.open(base + "#/c/" + key);
    const routes = (await pickRoutes(b, key)).filter(([id]) => !only || new RegExp(only).test(id + " " + key));
    for (const [id, hash] of routes) {
      b.clearProblems();
      await b.open(base + hash);
      if (await b.eval(`!document.querySelector('#view h1, #view [role=heading]')`)) { console.log(`${key} ${id}: no page (skipped)`); continue; }
      await b.scrollThrough(450, 150); await sleep(400);
      await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 40, y: 40 }); await sleep(500);          // the first pointer wakes the catalogue (the sources, the definitions)
      await b.eval(`window.__tipTargets.size`);
      let res;
      try { res = JSON.parse(await b.eval(`${RUN}(${JSON.stringify({})})`)); } catch (e) { bad.push(`${key} ${id}: probe error ${e.message}`); continue; }
      const probs = b.problems().filter((p) => !/favicon/.test(p));
      for (const p of probs) bad.push(`${key} ${id}: ${p}`);
      let off = 0, plus = 0, plain = 0;
      for (const r of res.recs) {
        const kind = r.path.split(" < ").slice(0, 2).join(" < ");
        const row = table.get(kind) || { n: 0, off: 0, plus: 0, plain: 0, ex: null };
        row.n++; if (r.state === "off") { row.off++; off++; } else if (r.state === "plus") { row.plus++; plus++; } else { row.plain++; plain++; }
        if (!row.ex || (r.state === "plus" && row.ex.state !== "plus")) row.ex = { ...r, route: `${key} ${id}` };
        table.set(kind, row);
        all.push({ town: key, route: id, ...r });
        if (r.final && r.redundant) bad.push(`${key} ${id}: a card repeats the page [${kind}] "${r.final.slice(0, 110)}"`);
        if (r.state !== "off" && r.on !== false && !r.final.trim()) bad.push(`${key} ${id}: an empty card [${kind}]`);
      }
      for (const t of res.titles) if (t.repeats) bad.push(`${key} ${id}: a title repeats its text "${t.title}"`);
      console.log(`${key.padEnd(5)} ${id.padEnd(22)} marks ${String(res.marks).padStart(4)}  cards ${String(res.recs.length).padStart(4)}  plus ${String(plus).padStart(4)}  plain ${String(plain).padStart(4)}  hidden ${String(off).padStart(4)}  titles ${res.titles.length}`);
    }
  }
  if (touch) {
    // real touch (a phone): a tap on a mark with something to say shows its card and keeps it until the next touch elsewhere; a tap on a mark with nothing new (a blank cell) shows nothing
    await b.viewport(390, true);
    // what the card says, and whether the section of the touched mark already says all of it (the same test as for the pointer)
    const read = (p) => b.eval(`(async () => { const tips = await import('/js/product/kit/tips.js'); const t = document.querySelector('.tt'), shown = t.classList.contains('on') && !t.hidden;
      const at = document.elementFromPoint(${p ? p.x : 0}, ${p ? p.y : 0}), sec = (at && at.closest('.in-hero, .dm-hero, .tr-dom, .n-home-block, figure, section, .viz')) || document.querySelector('#view');
      return JSON.stringify({ shown, state: t.dataset.nTip || '', text: t.textContent.slice(0, 100), repeats: shown && tips.isRedundant(t.textContent, tips.visibleText(sec)) }); })()`).then(JSON.parse);
    const tapAll = async (list) => {
      for (const [name, hash, sel, wantShown] of list) {
        await b.open(base + hash); await b.scrollThrough(450, 150); await b.eval(`window.scrollTo(0, 0)`);
        await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 5, y: 5 }); await sleep(500);
        await b.eval(`document.querySelector(${JSON.stringify(sel)}) && document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center' })`); await sleep(300);
        const p = await b.eval(TOUCH(sel));
        if (!p) { console.log(`touch ${name}: no mark in view`); continue; }
        await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] }); await sleep(80);
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(500);
        const c = await read(p);
        console.log(`touch ${name.padEnd(10)} shown=${c.shown} state=${c.state} ${c.text.replace(/\s+/g, " ").slice(0, 70)}`);
        if (wantShown === true && !c.shown) bad.push(`touch ${name}: a tap shows no card`);
        if (c.repeats || (wantShown === false && c.shown)) bad.push(`touch ${name}: a tap shows a card that has nothing new`);
        if (c.shown) {
          await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 4, y: 4 }] }); await sleep(80);
          await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(300);
          const d = await read({ x: 4, y: 4 });
          if (d.shown) bad.push(`touch ${name}: the card stays after a tap elsewhere`);
        }
      }
    };
    await tapAll([["heat cell", "#/c/1031/trends", ".v-mx-hc.k-worse", true], ["blank cell", "#/c/1031/trends", ".v-mx-hc.k-missing", null], ["list row", "#/c/1031/i/th_mmrv", ".v-cmp-lrow", true], ["line chart", "#/c/1031/i/th_mmrv", "svg.v-time-svg", true], ["strip", "#/c/1031", "svg.n-home-db", true], ["map", "#/c/1031/compare", ".v-map-svg", true]]);
    // a wide window with the same touch: the year labels of the matrix are on the screen, so a blank cell has nothing to add and a tap on it shows nothing
    await b.viewport(1280, false);
    await tapAll([["blank cell (wide)", "#/c/1031/trends", ".v-mx-hc.k-missing", false]]);
  }
  await b.close();
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(all, null, 1));
  if (!quiet) {
    console.log("\nkinds of marks (cards: shown with more / shown as they were / hidden because nothing new) and one example:");
    for (const [kind, r] of [...table].sort((x, y) => y[1].n - x[1].n)) {
      console.log(`\n[${r.n}] ${kind}   more ${r.plus}  as-is ${r.plain}  hidden ${r.off}   (${r.ex.route})`);
      console.log("   before: " + r.ex.raw.replace(/\s+/g, " ").slice(0, 200));
      console.log("   after : " + (r.ex.final ? r.ex.final.replace(/\s+/g, " ").slice(0, 300) : "(no card)"));
    }
  }
  console.log(bad.length ? "\nFAILED: " + bad.length + "\n" + [...new Set(bad)].slice(0, 60).join("\n") : "\nall cards add something (or are gone)");
  process.exitCode = bad.length ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode || 0), 500);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
