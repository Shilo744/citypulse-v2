"use strict";
// node src/tools/chrome_probe.js --mode=targets|reflow|nav|groups [--base=http://localhost:8800/n.html] [--only=regex] [--widths=390,1280] [--json=out.json]
// The frame probes of the product (w3a): pointer targets under 24 by 24 CSS px (WCAG 2.5.8) and sideways scroll at 320 px with the root font at 200 percent (R-13).
// targets: every visible a, button, input, select, summary and [role=button|tab|option|link] on the routes, at each width; an inline link inside a sentence is listed apart (exempt by 2.5.8),
//   and so are the marks of a chart (an element inside an svg or with role=img: a bar, a chip, a cell of the years matrix; they show a card on hover or focus, do nothing on a click, and their value is also written
//   as text next to them: the 'essential presentation' exception of 2.5.8, q1). Everything else under 24 by 24 CSS px is an offender. --towns=1031,9000,... runs the routes of each of those towns instead of the fixed list (q1).
// reflow: 320 px wide, html{font-size:200%}: scrollWidth against clientWidth and the elements that stick out.
// nav (m3): every old address lands where MERGE.md section 4 says and leaves no history entry behind (overview, d/<each old domain id>, ?q=simple, ?q=<each question>, the alias),
//   and the level switch of the town page, used in a real browser both ways: the scroll position stays, the focus stays on the switch, the live region says it once.
//   --only=info (u1): the glossary, the accessibility statement and the privacy page open INSIDE the town: from the town page and from a category page the menu item, the footer links and the term link of the
//   dialog are clicked; the town menu stays (the town first, no "בחירת יישוב"), the way back and the crumbs are the town, the title names the town; the top-level form keeps the town-less menu.
// groups (u2): the category page d/child of towns 1031, 16, 99 and 472 at 1280 and 390: the figures are in closed groups (one per topic) with a summary row, exactly one open on the first load, the counts of the
//   summaries add up to the ring's own, "open all" and "close all" work and announce once, Enter and Space on a summary toggle it, a filter and the charts view draw the groups again, print opens every group,
//   no sideways scroll and no console error. --only=1031,16 runs those towns only.
// Several runs may go at the same time when each has its own CDP_SLOT.
const fs = require("fs");
const { launch } = require("./cdp");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith("--" + n + "=")); return a ? a.slice(n.length + 3) : d; };
const mode = arg("mode", "targets"), base = arg("base", "http://localhost:8800/n.html"), only = arg("only", ""), jsonOut = arg("json", ""), towns = arg("towns", "");
const widths = arg("widths", mode === "reflow" ? "320" : "390,1280").split(",").map(Number);

const TARGETS = `(() => {
  const vw = document.documentElement.clientWidth, out = [], inline = [], marks = [];
  const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=option], [role=link], [tabindex="0"]';
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden], [inert]') || (el.classList.contains('sr') && !el.matches(':focus'))) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    if (el.closest('.side') && !document.querySelector('#side.open')) continue;                    // a closed drawer
    if (el.closest('.results[hidden]') || el.closest('.scrim')) continue;
    if (r.width >= 24 && r.height >= 24) continue;
    const row = { tag: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/ +/).slice(0, 2).join('.') : ''), text: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\\s+/g, ' ').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
    const mark = !!el.closest('svg') || el.getAttribute('role') === 'img';
    (mark ? marks : cs.display === 'inline' && el.tagName === 'A' && el.parentElement && el.parentElement.textContent.trim().length > el.textContent.trim().length + 3 ? inline : out).push(row);
  }
  return { out, inline, marks };
})()`;

const LINKS = `(() => { const f = (p) => { const e = document.querySelector('#view a[href*="/' + p + '/"]'); const m = e && new RegExp('/' + p + '/([^/?#]+)').exec(e.getAttribute('href')); return m && m[1]; }; return { d: f('d'), i: f('i') }; })()`;

// ── nav mode ──
const OLD_DOMAINS = { immunization: "child", child: "child", nutrition: "child", outcomes: "outcomes", access: "outcomes", mental: "mental", welfare: "mental", safety: "safety", context: "context", env: "context" };
const QUESTIONS = ["weak", "changed", "peers", "first", "missing"];
const SETTLE = `new Promise((res) => { let last = location.hash, n = 0; const t = setInterval(() => { if (location.hash === last) n++; else { last = location.hash; n = 0; } if (n >= 6) { clearInterval(t); res({ hash: location.hash, len: history.length, h1: document.querySelectorAll('#view h1').length }); } }, 100); })`;
// what the shell shows right now: the menu (a town item or "בחירת יישוב"), the way back, the crumbs, the title, the current menu item, the h1
const SHELL = `(() => { const t = (e) => (e ? (e.textContent || '').trim().replace(/\\s+/g, ' ') : ''); const side = document.querySelector('#side'); const back = document.querySelector('#view .n-band-back');
  return { hash: location.hash, town: !!side.querySelector('.cityswitch'), townName: t(side.querySelector('.cityswitch b')), choose: [...side.querySelectorAll('a.nav')].some((a) => t(a) === 'בחירת יישוב'), back: back ? back.getAttribute('href') : null, backText: t(back),
    crumbs: [...document.querySelectorAll('#crumbs a, #crumbs b')].map(t), title: document.title, current: [...side.querySelectorAll('a[aria-current=page]')].map(t), h1: [...document.querySelectorAll('#view h1')].map(t), nh1: document.querySelectorAll('#view h1').length,
    cats: [...side.querySelectorAll('a.nav')].filter((a) => /\\/d\\//.test(a.getAttribute('href'))).length }; })()`;
const PAGE_NAMES = { glossary: "מילון מונחים", accessibility: "הצהרת נגישות", privacy: "מדיניות פרטיות" };
async function infoPages(b, say) {
  const key = "1031", town = "#/c/" + key, settle = async () => { await sleep(400); return b.eval(SETTLE); };
  const clickText = (scope, text) => b.eval(`(() => { const a = [...document.querySelectorAll(${JSON.stringify(scope)})].find((e) => (e.textContent || '').trim().replace(/\\s+/g, ' ') === ${JSON.stringify(text)}); if (!a) return false; a.click(); return true; })()`);
  const inTown = (s, page, label) => {
    say(s.hash === `${town}/${page}` || s.hash.startsWith(`${town}/${page}#`), label + ": the address is inside the town", s.hash);
    say(s.town && !s.choose && s.townName.length > 0, label + ": the town menu stays (town item, no 'בחירת יישוב')", `town ${s.town}, choose ${s.choose}, name '${s.townName}'`);
    say(s.cats >= 3, label + ": the categories are in the menu", String(s.cats));
    say(s.back === town && s.backText === "דף היישוב", label + ": the way back is the town", `${s.back} '${s.backText}'`);
    say(s.crumbs.length === 2 && s.crumbs[0] === s.townName, label + ": the crumbs say the town", s.crumbs.join(" > "));
    say(s.title.includes(s.townName) && s.title.includes(PAGE_NAMES[page].replace("מדיניות ", "")), label + ": the title says page and town", s.title);
    say(s.nh1 === 1 && s.h1[0] === PAGE_NAMES[page], label + ": one h1 '" + PAGE_NAMES[page] + "'", s.h1.join("|"));
  };
  for (const w of [1280, 390]) {
    await b.viewport(w, w < 700);
    const openDrawer = async () => { if (w < 700) await b.eval(`document.getElementById('menu').click()`); };          // the drawer of a phone holds the menu
    for (const [where, start] of [["the town page", town], ["a category page", town + "/d/child"]]) {
      for (const via of ["menu", "footer"]) {
        for (const page of ["glossary", "accessibility", "privacy"]) {
          if (via === "menu" && page !== "glossary") continue;                              // the menu has only the glossary
          const label = `${w} ${where} -> ${PAGE_NAMES[page]} (${via})`;
          b.clearProblems(); await b.open(base + start); await b.eval(SETTLE);
          const before = await b.eval(`history.length`);
          let ok;
          if (via === "menu") { await openDrawer(); ok = await clickText("#side a.nav", "מילון מונחים"); } else ok = await clickText("#foot a", page === "privacy" ? "פרטיות" : PAGE_NAMES[page]);
          say(ok, label + ": the link is there");
          if (!ok) continue;
          const r = await settle(); const s = await b.eval(SHELL);
          inTown(s, page, label);
          const prob = b.problems(); if (prob.length) say(false, label + " console", prob.join(" | ").slice(0, 200));
          say(r.len === before + 1, label + ": one history entry", `${before} -> ${r.len}`);
          if (via === "footer" && page === "glossary") {                                 // the way back really goes back to the town
            await b.eval(`document.querySelector('#view .n-band-back').click()`); await settle();
            const s2 = await b.eval(SHELL); say(s2.hash === town, label + ": the back link returns to the town", s2.hash);
          }
        }
      }
    }
    // a term of the dialog: "לכל המונחים" keeps the town and the term
    b.clearProblems(); await b.open(base + town + "?v=full"); await b.eval(SETTLE);
    const opened = await b.eval(`(() => { const t = document.querySelector('#view .n-kit-term'); if (!t) return false; t.click(); return true; })()`);
    if (opened) {
      await sleep(250);
      const href = await b.eval(`(() => { const a = document.querySelector('dialog[open] a.n-kit-link'); return a ? a.getAttribute('href') : null; })()`);
      say(!!href && href.startsWith(town + "/glossary#"), w + " a term dialog on the town page links to the glossary of the town", String(href));
      await b.eval(`document.querySelector('dialog[open] a.n-kit-link').click()`); await settle();
      const s = await b.eval(SHELL); inTown(s, "glossary", w + " term dialog -> glossary");
      const at = await b.eval(`(() => { const id = decodeURIComponent(location.hash.split('#')[2] || ''); const e = id && document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().top) : null; })()`);
      say(at != null && at < 400, w + " the term is scrolled into view", String(at));
    } else say(false, w + " the town page has a term button");
  }
  // the top-level form: the town-less menu
  await b.viewport(1280, false);
  for (const page of ["glossary", "accessibility", "privacy"]) {
    await b.open(base + "#/" + page); await b.eval(SETTLE); const s = await b.eval(SHELL);
    say(!s.town && s.choose && s.back === "#/" && s.backText === "דף הבית", `top-level #/${page}: the town-less menu and the way back to the entry page`, `town ${s.town}, choose ${s.choose}, back ${s.back}`);
  }
  // switching town from the page keeps the page (the town search of the top bar)
  await b.open(base + town + "/glossary#concern"); await b.eval(SETTLE);
  await b.eval(`import('./js/product/kit/townsearch.js').then((m) => m.pickTown('16'))`); await settle();
  const sw = await b.eval(SHELL); say(sw.hash === "#/c/16/glossary#concern" && sw.town, "switching town from the glossary stays on the glossary of the new town", sw.hash);
}

async function navMode(b) {
  const bad = [], say = (ok, what, extra = "") => { console.log((ok ? "ok    " : "FAIL  ") + what + (extra ? "   " + extra : "")); if (!ok) { bad.push(what); process.exitCode = 1; } };
  await b.viewport(1280, false);
  const land = async (from, to, label) => {
    await b.send("Page.resetNavigationHistory"); await b.open(base + "#/"); await b.open(base + to); const control = await b.eval(SETTLE);          // history starts again at one entry, so the two counts can be compared
    await b.send("Page.resetNavigationHistory"); await b.open(base + "#/"); b.clearProblems(); await b.open(base + from); const r = await b.eval(SETTLE);
    say(r.hash === to.replace(/^#?/, "#") && r.len === control.len && r.h1 === 1, label || from + " -> " + to, `landed ${r.hash}, history ${r.len} (direct: ${control.len}), h1 ${r.h1}`);
    const prob = b.problems ? b.problems() : []; if (prob && prob.length) say(false, label + " console", prob.join(" | ").slice(0, 200));
  };
  if (!only || /info/.test(only)) await infoPages(b, say);
  for (const key of /switch|info/.test(only) ? [] : ["1031", "16", "9000"]) {          // --only=switch runs the level switch alone, --only=redirect the addresses alone, --only=info the pages of information alone
    const c = "#/c/" + key;
    await land(c + "/overview", c, key + " overview");
    await land(c + "/overview?q=changed", c + "?q=changed", key + " overview keeps ?q=");
    for (const [old, cat] of Object.entries(OLD_DOMAINS)) { if (key === "16" && !["child", "outcomes", "mental", "safety", "context"].includes(cat)) continue; await land(c + "/d/" + old, c + "/d/" + cat, key + " d/" + old); }
    await land(c + "?q=simple", c + "/simple", key + " ?q=simple");
    for (const q of QUESTIONS) await land(c + "?q=" + q, c + "?q=" + q, key + " ?q=" + q + " stays");
    await land(c + "?q=nonsense", c + "?q=weak", key + " ?q=nonsense");
    await land(c + "/simple", c + "/simple", key + " alias stays");
  }
  // the level switch, both ways, in a real browser (the switch is built by the page of the town; here it is only used)
  for (const w of /redirect|info/.test(only) ? [] : [1280, 390]) {
    await b.viewport(w, w < 700);
    await b.open(base + "#/c/1031?v=full"); await b.eval(SETTLE);
    const SW = `(() => { const all = [...document.querySelectorAll('#view a, #view button')]; const f = (t) => all.find((e) => (e.textContent || '').trim() === t); return { simple: !!f('במבט אחד'), full: !!f('הפרטים המלאים') }; })()`;
    const have = await b.eval(SW); say(have.simple && have.full, w + " the switch has both levels");
    if (!(have.simple && have.full)) continue;
    for (const [to, from] of [["במבט אחד", "הפרטים המלאים"], ["הפרטים המלאים", "במבט אחד"]]) {
      await b.eval(`window.scrollTo(0, 90); document.getElementById('live').textContent = ''`);
      const before = await b.eval(`({ y: Math.round(scrollY), len: history.length, hash: location.hash })`);
      // like a person: the switch takes the focus first (a mouse click and the Enter key both leave it there), then it is activated; a bare .click() would leave the focus where the router put it (the h1)
      await b.eval(`(() => { const e = [...document.querySelectorAll('#view a, #view button')].find((x) => (x.textContent || '').trim() === ${JSON.stringify(to)}); e.focus(); e.click(); })()`);
      await sleep(900);
      const after = await b.eval(`(() => { const a = document.activeElement; return { y: Math.round(scrollY), len: history.length, text: a ? (a.textContent || '').trim() : '', inSwitch: !!(a && a.closest && a.closest('#view') && (a.closest('nav') || a.closest('[role=group]') || a.closest('[class*=switch]') || a.closest('[class*=-sw]'))), live: (document.getElementById('live').textContent || '').trim(), h1: document.querySelectorAll('#view h1').length }; })()`);
      say(Math.abs(after.y - before.y) <= 2, w + " switch to '" + to + "': scroll kept", `${before.y} -> ${after.y}`);
      say(after.len === before.len, w + " switch to '" + to + "': no history entry", `${before.len} -> ${after.len}`);
      say(after.inSwitch && after.text === to, w + " switch to '" + to + "': focus stays on the switch", `focus on '${after.text}'`);
      say(after.live.length > 0, w + " switch to '" + to + "': one announcement", `'${after.live}'`);
      say(after.h1 === 1, w + " switch to '" + to + "': one h1");
    }
  }
  console.log(bad.length ? "FAILED: " + bad.length : "all navigation checks passed");
}

// ── groups mode (u2): the closed, openable topics of the category page ──
const GROUP_STATE = `(async () => {
  const G = await import('./js/product/city/groups.js');
  const gs = [...document.querySelectorAll('#view details.n-pg-domain-group')], n = (d, k) => +d.getAttribute('data-' + k);
  const ring = {}; document.querySelectorAll('#view .dm-ring .v-ring-row').forEach((r) => { ring[r.getAttribute('data-k')] = +r.querySelector('.v-ring-n').textContent.replace(/[^\\d]/g, ''); });
  const say = (d) => d.querySelector('.n-pg-domain-say').textContent.replace(/[\\u2066-\\u2069\\u00a0\\u2060]/g, (c) => (c === '\\u00a0' ? ' ' : '')).replace(/\\s+/g, ' ').trim();
  const small = (d) => [...d.querySelectorAll('a.dm-row.is-small, ul.v-time-sm > li')].length;
  const want = (d) => G.sayText(G.topicSay({ concern: n(d, 'concern'), watch: n(d, 'watch'), fine: n(d, 'fine'), small: n(d, 'small'), stale: n(d, 'stale'), bg: n(d, 'unjudged') - n(d, 'small') - n(d, 'stale'), judged: n(d, 'concern') + n(d, 'watch') + n(d, 'fine'), unjudged: n(d, 'unjudged'), total: n(d, 'total') })).replace(/\\s+/g, ' ');
  const btn = document.querySelector('#view .n-pg-domain-all'), vw = document.documentElement.clientWidth;
  return { count: gs.length, open: gs.filter((d) => d.open).length, openNames: gs.filter((d) => d.open).map((d) => d.querySelector('.n-pg-domain-name').textContent), names: gs.map((d) => d.querySelector('.n-pg-domain-name').textContent), says: gs.map(say), wants: gs.map(want),
    sumConcern: gs.reduce((s, d) => s + n(d, 'concern'), 0), sumWatch: gs.reduce((s, d) => s + n(d, 'watch'), 0), sumFine: gs.reduce((s, d) => s + n(d, 'fine'), 0), sumUnjudged: gs.reduce((s, d) => s + n(d, 'unjudged'), 0),
    rows: gs.map((d) => d.querySelectorAll('a.dm-row, ul.v-time-sm > li').length), totals: gs.map((d) => n(d, 'total')),
    ring: { concern: ring.concern || 0, watch: ring.watch || 0, fine: (ring.good || 0) + (ring.strength || 0), background: ring.background || 0 }, ringTotal: Object.values(ring).reduce((s, x) => s + x, 0),
    allRows: document.querySelectorAll('#view .n-pg-domain-groups a.dm-row, #view .n-pg-domain-groups ul.v-time-sm > li').length, outside: document.querySelectorAll('#dm-figs .dm-figs > a.dm-row, #dm-figs .dm-figs > .rowlist').length,
    btn: btn ? { text: btn.textContent.trim(), expanded: btn.getAttribute('aria-expanded') } : null, live: (document.getElementById('live') || {}).textContent || '',
    order: [...document.querySelectorAll('#view .dm > section')].map((s) => s.id || (s.classList.contains('dm-hero') ? 'hero' : '')), eyebrows: [...document.querySelectorAll('#view .sec-eyebrow b')].map((b) => b.textContent),
    bodyVisible: gs.filter((d) => d.open).every((d) => d.querySelector('.n-pg-domain-body').getBoundingClientRect().height > 0), inView: gs.every((d) => d.querySelector('summary').getBoundingClientRect().width > 0 && d.querySelector('summary').getBoundingClientRect().right <= vw + 1) };
})()`;
async function groupsMode(b) {
  const bad = [], say = (ok, what, extra = "") => { console.log((ok ? "ok    " : "FAIL  ") + what + (extra ? "   " + extra : "")); if (!ok) { bad.push(what); process.exitCode = 1; } };
  const keys = only ? only.split(",") : ["1031", "16", "99", "472"];
  for (const w of [1280, 390]) {
    await b.viewport(w, w < 700);
    for (const town of keys) {
      const L = `${town}@${w}`;
      b.clearProblems(); await b.open(base + `#/c/${town}/d/child`); await b.eval(SETTLE); await sleep(300);
      let s = await b.eval(GROUP_STATE);
      say(s.count >= 2 && s.names.length === s.count, L + ": the figures are in groups, one per topic", `${s.count}: ${s.names.join(" | ")}`);
      say(s.open === 1, L + ": exactly one group is open on the first load", `${s.open} open`);
      say(s.order[0] === "dm-figs", L + ": the groups are the first section, right after the header (the ring and the position bar); the chart of the years follows", s.order.join(" > "));
      say(s.eyebrows.every((t, i) => t === String(i + 1).padStart(2, "0")), L + ": the section numbers run in order", s.eyebrows.join(","));
      const noRing = s.ringTotal === 0, total = s.allRows;          // a town where nothing is judged has no ring: then every figure is "not judged" in the summaries
      say(noRing ? s.sumConcern + s.sumWatch + s.sumFine === 0 && s.sumUnjudged === total : s.sumConcern === s.ring.concern && s.sumWatch === s.ring.watch && s.sumFine === s.ring.fine && s.sumUnjudged === s.ring.background, L + (noRing ? ": no ring (nothing is judged): every figure is 'not judged' in the summaries" : ": the summaries add up to the ring"), `groups ${s.sumConcern}/${s.sumWatch}/${s.sumFine}/${s.sumUnjudged}, ring ${s.ring.concern}/${s.ring.watch}/${s.ring.fine}/${s.ring.background}`);
      say((noRing || s.allRows === s.ringTotal) && s.rows.every((n, i) => n === s.totals[i]) && s.outside === 0, L + ": every figure is inside a group, and each group holds as many as it says", `${s.allRows} rows, ring ${s.ringTotal}, per group ${s.rows.join("/")} of ${s.totals.join("/")}`);
      say(s.says.every((t, i) => t === s.wants[i]), L + ": each summary sentence is the sentence of its own counts", s.says.join(" | "));
      say(s.bodyVisible && s.inView, L + ": the open group shows its figures; every summary row is in the window");
      const o = await b.overflow(); say(!(o.scrollWidth > o.clientWidth + 1), L + ": no sideways scroll", `${o.scrollWidth} > ${o.clientWidth}: ${(o.leaves || []).join(", ")}`);
      // open all, close all
      await b.eval(`document.getElementById('live').textContent = ''`);
      await b.eval(`document.querySelector('#view .n-pg-domain-all').click()`); await sleep(300);
      s = await b.eval(GROUP_STATE);
      say(s.open === s.count && s.btn && s.btn.text === "סגירת הכול" && s.btn.expanded === "true", L + ": 'open all' opens every group and the control says so", `${s.open}/${s.count}, '${s.btn && s.btn.text}', ${s.btn && s.btn.expanded}`);
      say(s.live === "כל הנושאים נפתחו", L + ": one announcement", `'${s.live}'`);
      const o2 = await b.overflow(); say(!(o2.scrollWidth > o2.clientWidth + 1), L + ": all open: no sideways scroll", `${o2.scrollWidth} > ${o2.clientWidth}: ${(o2.leaves || []).join(", ")}`);
      await b.eval(`document.querySelector('#view .n-pg-domain-all').click()`); await sleep(300);
      s = await b.eval(GROUP_STATE);
      say(s.open === 0 && s.btn && s.btn.text === "פתיחת הכול" && s.btn.expanded === "false", L + ": 'close all' closes every group", `${s.open} open, '${s.btn && s.btn.text}'`);
      // the keyboard: the summary takes focus, Enter and Space toggle it, the state is the native one
      const press = async (k, code, vk) => { for (const type of ["keyDown", "keyUp"]) await b.send("Input.dispatchKeyEvent", { type, key: k, code, windowsVirtualKeyCode: vk, text: type === "keyDown" ? (k === "Enter" ? "\r" : k) : undefined }); await sleep(200); };
      await b.eval(`(() => { const sm = document.querySelectorAll('#view .n-pg-domain-sum'); sm[1].focus(); window.__sum = sm[1]; })()`);
      const focused = await b.eval(`document.activeElement === window.__sum`);
      await press("Enter", "Enter", 13); const afterEnter = await b.eval(`window.__sum.parentElement.open`);
      await press(" ", "Space", 32); const afterSpace = await b.eval(`window.__sum.parentElement.open`);
      say(focused && afterEnter === true && afterSpace === false, L + ": the summary is focusable; Enter opens, Space closes", `focus ${focused}, after Enter ${afterEnter}, after Space ${afterSpace}`);
      // the filter (a tab of the old page) draws the list again: the groups are made again and open; "all" brings the reader's state back
      await b.eval(`document.querySelectorAll('#view details.n-pg-domain-group')[2].open = true`); await sleep(200);
      const kept = (await b.eval(GROUP_STATE)).openNames;
      const f = await b.eval(`(() => { const t = [...document.querySelectorAll('#view .dm-tab')].filter((x) => x.getAttribute('data-f') !== 'all'); if (!t.length) return null; t[0].click(); return t[0].getAttribute('data-f'); })()`);
      if (f) {
        await sleep(400); s = await b.eval(GROUP_STATE);
        const wantN = await b.eval(`+(document.querySelector('#view .dm-tab[aria-pressed=true] .dm-tab-n') || {}).textContent`);
        say(s.count >= 1 && s.open === s.count && s.allRows === wantN, L + `: the filter '${f}' draws the groups again, all open, with just its figures`, `${s.count} groups, ${s.open} open, ${s.allRows} rows, the tab says ${wantN}`);
        await b.eval(`document.querySelector('#view .dm-tab[data-f=all]').click()`); await sleep(400); s = await b.eval(GROUP_STATE);
        say(s.count >= 2 && s.allRows === total && s.openNames.join("|") === kept.join("|"), L + ": 'all' brings every group back, as the reader left them", `${s.count} groups, open now '${s.openNames.join("|")}', before '${kept.join("|")}'`);
      }
      // the charts view
      const hasViews = await b.eval(`!!document.querySelector('#view .dm-vbtn[data-v=charts]')`);
      if (hasViews) {
        await b.eval(`document.querySelector('#view .dm-vbtn[data-v=charts]').click()`); await sleep(500); s = await b.eval(GROUP_STATE);
        say(s.count >= 2 && s.allRows === total, L + ": the charts view is in groups too", `${s.count} groups, ${s.allRows} charts`);
        const o3 = await b.eval(`(() => { const ul = document.querySelector('#view details[open] ul.v-time-sm'); return ul ? { in: ul.classList.contains('in'), h: Math.round(ul.getBoundingClientRect().height) } : null; })()`);
        say(!o3 || (o3.in && o3.h > 40), L + ": the charts of an open group are drawn", JSON.stringify(o3));
        const o4 = await b.overflow(); say(!(o4.scrollWidth > o4.clientWidth + 1), L + ": charts view: no sideways scroll", `${o4.scrollWidth} > ${o4.clientWidth}: ${(o4.leaves || []).join(", ")}`);
        await b.eval(`document.querySelector('#view .dm-vbtn[data-v=rows]').click()`); await sleep(400);
      }
      // print: every group is open for the printer and the reader's state comes back after it
      await b.eval(`document.querySelectorAll('#view details.n-pg-domain-group').forEach((d, i) => { d.open = i === 0; })`); await sleep(200);
      await b.eval(`window.dispatchEvent(new Event('beforeprint'))`); await sleep(200); const printed = await b.eval(GROUP_STATE);
      await b.eval(`window.dispatchEvent(new Event('afterprint'))`); await sleep(200); const back = await b.eval(GROUP_STATE);
      say(printed.open === printed.count && back.open === 1, L + ": print opens every group and restores the reader's state", `${printed.open}/${printed.count} while printing, ${back.open} after`);
      const prob = b.problems(); say(!prob.length, L + ": no console error", prob.join(" | ").slice(0, 200));
    }
  }
  // a very small town and the uncovered one: still one calm page
  for (const town of ["935", "7"]) {
    for (const w of [1280, 390]) {
      await b.viewport(w, w < 700); b.clearProblems(); await b.open(base + `#/c/${town}/d/child`); await b.eval(SETTLE); await sleep(300);
      const s = await b.eval(`({ groups: document.querySelectorAll('#view details.n-pg-domain-group').length, h1: document.querySelectorAll('#view h1').length, text: document.getElementById('view').innerText.length })`);
      const o = await b.overflow(), prob = b.problems();
      say(s.h1 === 1 && s.text > 60 && !(o.scrollWidth > o.clientWidth + 1) && !prob.length, `${town}@${w}: d/child reads (one h1, ${s.groups} groups, no overflow, no console error)`, `${s.text} characters ${prob.join(" | ").slice(0, 160)}`);
    }
  }
  // print without the event: a closed group still prints (the css fallback)
  await b.viewport(1280, false); await b.open(base + "#/c/1031/d/child"); await b.eval(SETTLE);
  await b.eval(`document.querySelectorAll('#view details.n-pg-domain-group').forEach((d) => { d.open = false; })`); await b.media("print"); await sleep(300);
  const fallback = await b.eval(`(() => { const d = document.querySelector('#view details.n-pg-domain-group:not([open])'), cs = d && getComputedStyle(d, '::details-content'); return { cv: cs ? cs.contentVisibility : null, chevron: getComputedStyle(document.querySelector('.n-pg-domain-chev')).display }; })()`);
  await b.media("");
  say(fallback.cv === "visible" && fallback.chevron === "none", "print css alone (no event): the closed group's content is visible and the chevron is hidden", JSON.stringify(fallback));
  console.log(bad.length ? "FAILED: " + bad.length : "all group checks passed");
}

(async () => {
  const b = await launch();
  const rows = [];
  if (mode === "groups") { await groupsMode(b); await b.close(); setTimeout(() => process.exit(process.exitCode || 0), 300); return; }
  if (mode === "nav") { await navMode(b); await b.close(); setTimeout(() => process.exit(process.exitCode || 0), 300); return; }
  await b.viewport(1280, false); await b.open(base + "#/c/1031?v=full");
  const link = await b.eval(LINKS);
  const c = "#/c/1031";
  const routes = [["entry", "#/"], ["home", c], ["home-16", "#/c/16"], ["home-935", "#/c/935"], ["simple", c + "/simple"], ["simple-16", "#/c/16/simple"], ["simple-935", "#/c/935/simple"],
    link.d ? ["domain", c + "/d/" + link.d] : null, link.i ? ["indicator", c + "/i/" + link.i] : null, ["trends", c + "/trends"], ["compare", c + "/compare"], ["actions", c + "/actions"], ["ask", c + "/ask"],
    ["coverage", c + "/coverage"], ["method", c + "/method"], ["gmethod", "#/method"], ["glossary", "#/glossary"], ["accessibility", "#/accessibility"], ["privacy", "#/privacy"], ["glossary-town", c + "/glossary"], ["accessibility-town", c + "/accessibility"], ["privacy-town", c + "/privacy"]].filter(Boolean).filter((r) => !only || new RegExp(only).test(r[0]));
  if (towns) {          // q1: the routes of each town: its town page (both levels), the five categories, the first figures, and the pages of tools
    routes.length = 0;
    for (const key of towns.split(",")) {
      await b.viewport(1280, false); await b.open(base + "#/c/" + key + "?v=full");
      const f = await b.eval(`(() => { const all = (p) => [...new Set([...document.querySelectorAll('#view a[href*="/' + p + '/"]')].map((e) => (new RegExp('/' + p + '/([^/?#]+)').exec(e.getAttribute('href')) || [])[1]).filter(Boolean))]; return all('i').slice(0, 3); })()`);
      const t = "#/c/" + key;
      routes.push([key + " home", t], [key + " simple", t + "/simple"], ...["child", "outcomes", "mental", "safety", "context"].map((d) => [key + " d/" + d, t + "/d/" + d]), ...f.map((i) => [key + " i/" + i, t + "/i/" + i]),
        ...["trends", "compare", "actions", "ask", "coverage", "method"].map((p) => [key + " " + p, t + "/" + p]));
    }
  }
  for (const w of widths) {
    await b.viewport(w, w < 700);
    for (const [id, hash] of routes) {
      try {
        b.clearProblems(); await b.open(base + hash);
        if (mode === "reflow") { await b.eval(`document.documentElement.style.fontSize = "200%"`); await sleep(500); const o = await b.overflow(); rows.push({ route: id, w, over: o.scrollWidth - o.clientWidth, scrollWidth: o.scrollWidth, leaves: o.leaves }); }
        else { await sleep(250); const t = await b.eval(TARGETS); rows.push({ route: id, w, small: t.out, inline: t.inline.length, marks: t.marks }); }
      } catch (e) { rows.push({ route: id, w, error: e.message }); }
    }
  }
  await b.close();
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
  if (mode === "reflow") {
    for (const r of rows) console.log(`${String(r.w).padStart(4)} ${r.route.padEnd(14)} ${r.error ? "ERROR " + r.error : r.over > 1 ? "OVER +" + r.over + "px  " + r.leaves.join(", ") : "ok"}`);
    console.log("overflowing: " + rows.filter((r) => r.over > 1).map((r) => r.route).join(", "));
  } else {
    let n = 0, marksN = 0;
    for (const r of rows) {
      if (r.error) { console.log(`${r.w} ${r.route} ERROR ${r.error}`); continue; }
      n += r.small.length;
      const seen = new Map(); r.small.forEach((s) => { const k = `${s.tag} "${s.text}" ${s.w}x${s.h}`; seen.set(k, (seen.get(k) || 0) + 1); });
      marksN += r.marks.length;
      console.log(`${String(r.w).padStart(4)} ${r.route.padEnd(14)} ${r.small.length} small` + (r.inline ? `, ${r.inline} inline (exempt)` : "") + (r.marks.length ? `, ${r.marks.length} chart marks (exempt)` : "") + [...seen].map(([k, v]) => `\n        ${k}${v > 1 ? " x" + v : ""}`).join(""));
    }
    console.log("offenders in total: " + n + " (chart marks, exempt: " + marksN + ")");
  }
  setTimeout(() => process.exit(0), 600);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
