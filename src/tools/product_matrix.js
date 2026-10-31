"use strict";
// node src/tools/product_matrix.js [--subset] [--localities=1031,16,...] [--widths=390,1280] [--themes=light,dark] [--out=design-ideas/product/qa/matrix]
//                                  [--only=regex over the route] [--base=http://localhost:8800]
// The QA matrix of the product (web/n.html): every locality x width x theme x route is opened in ONE Chrome and measured.
// Per load: console errors and exceptions, failed requests (with the URL), sideways overflow, exactly one h1, the home tab and title,
// junk text ({{, undefined, NaN ...), the forbidden Hebrew words of SPEC 7.1, broken images, where the answer sentence sits, an unexpected
// error or not-found card, and the time the page took. Output: <out>.json (every load) and <out>.md (counts per check, failing screens with the URL).
// It only measures; it fixes nothing. --subset is about 250 loads (a few minutes), the full matrix is several thousand (run it in the background).
const fs = require("fs");
const path = require("path");

// ── the matrix ──
const FULL_LOCALITIES = ["1031", "9000", "3000", "5000", "4000", "1161", "2600", "2710", "6100", "2800", "7", "472", "935", "16", "99"];
const SUBSET = { localities: ["1031", "16", "7", "935", "472", "99"], widths: [390, 1280], themes: ["light", "dark"] };
const FULL = { localities: FULL_LOCALITIES, widths: [320, 390, 768, 1024, 1280, 1920], themes: ["light", "dark"] };
const NO_COVERAGE = new Set(["935", "472"]);               // the sources do not cover these at all: a no-data card is the right answer there
const QS = ["weak", "changed", "peers", "first", "missing"];
const HEIGHT = (w) => (w <= 480 ? 844 : 900);
const ANSWER_Y_LIMIT = (w) => (w <= 480 ? 680 : 560);      // the answer sentence should start above this line (SPEC 5.2)

// the routes of one locality; domain and indicator are the first links found on the full level of the town page (null: skipped, and the report says so)
function buildRoutes(key, { brief = true, domain = null, indicator = null } = {}) {
  const c = "#/c/" + key, r = QS.map((q) => ({ id: "home-" + q, hash: `${c}?q=${q}`, home: q }));
  if (brief) r.push({ id: "brief", hash: c + "/brief" });
  r.push({ id: "simple", hash: c + "/simple" });
  if (domain) r.push({ id: "domain", hash: c + "/d/" + domain });
  if (indicator) r.push({ id: "indicator", hash: c + "/i/" + indicator });
  for (const p of ["trends", "compare", "actions", "ask", "coverage", "method"]) r.push({ id: p, hash: `${c}/${p}` });
  return r;
}

// ── pure text checks ──
const HE = "\\u0590-\\u05FF";
const WHOLE = ["אנחנו", "לנו"], PARTS = ["פרמטר", "מדאיג", "אחוזון", "מובהק", "המודל", "בסיס קטן"];
const JUNK = [["{{", /\{\{|\}\}/], ["undefined", /\bundefined\b/], ["NaN", /\bNaN\b/], ["null", /\bnull\b/], ["[object", /\[object\b/], ["Infinity", /Infinity/]];
const excerpt = (t, i, len) => t.slice(Math.max(0, i - 18), i + len + 18).replace(/\s+/g, " ");
// -> [{ word, at }] ; a short word counts only as a whole word (לנו is not a part of כלנו)
function junkIn(text) {
  const out = [];
  for (const [word, re] of JUNK) { const m = re.exec(text); if (m) out.push({ word, at: excerpt(text, m.index, m[0].length) }); }
  return out;
}
function forbiddenIn(text) {
  const out = [];
  for (const w of WHOLE) { const m = new RegExp(`(^|[^${HE}])${w}($|[^${HE}])`).exec(text); if (m) out.push({ word: w, at: excerpt(text, m.index, w.length + 1) }); }
  for (const w of PARTS) { const i = text.indexOf(w); if (i >= 0) out.push({ word: w, at: excerpt(text, i, w.length) }); }
  return out;
}
// "still" in a sentence that says there is no data: the data will not come, so the word promises something false
const noDataStill = (sentence) => /עדיין/.test(sentence) && /אין (נתונים|מספיק|מידע)|לא (נמדד|ניתן|נאסף|פורסם)|חסר/.test(sentence);

// ── what is measured inside the page (one expression, returns plain data) ──
const MEASURE = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const view = document.getElementById('view') || document.body;
  const text = document.body.innerText || '';
  const ans = document.getElementById('n-sec-state') || document.getElementById('n-home-answer');
  const secs = [...document.querySelectorAll('[id^="n-sec-"]')].map((e) => e.id);
  const bad = [...document.querySelectorAll('.n-state')].filter(vis).map((e) => ({ cls: e.className, state: e.getAttribute('data-state') || '', text: (e.innerText || '').replace(/\\s+/g, ' ').slice(0, 90) }));
  const imgs = [...document.images].filter((i) => vis(i) && i.complete && i.naturalWidth === 0 && i.currentSrc).map((i) => i.currentSrc.slice(0, 120));
  const res = performance.getEntriesByType('resource').filter((e) => e.responseStatus >= 400).map((e) => e.responseStatus + ' ' + e.name.slice(0, 160));
  return {
    text: text.slice(0, 60000), len: text.length,
    h1: [...document.querySelectorAll('h1')].filter(vis).map((e) => (e.innerText || '').trim().slice(0, 60)),
    sections: secs, tabs: document.querySelectorAll('[role="tab"]').length,
    title: document.title,
    sentence: ans ? (ans.innerText || '').trim() : null, sentenceY: ans ? Math.round(ans.getBoundingClientRect().top + window.scrollY) : null,
    states: bad, images: imgs, requests: res
  };
})()`;
// links of the town page (full level): the first category page and the first indicator page
const FIND_LINKS = (key) => `(() => { const base = ${JSON.stringify("#/c/" + key + "/")}; const q = (p) => { const a = [...document.querySelectorAll('a[href]')].map((x) => x.getAttribute('href') || '').find((h) => h.indexOf(base + p) === 0); return a ? a.slice(base.length + p.length).split(/[?#/]/)[0] : null; }; return { domain: q('d/'), indicator: q('i/') }; })()`;

// the checks of one measured load -> [{ check, severity: "error"|"warn"|"info", detail }]
function judge(m, ctx) {
  const f = [], add = (check, severity, detail) => f.push({ check, severity, detail });
  const { route, width, key, overflow, problems } = ctx;
  // by design: a parameter a locality lacks is a 404, and the optional modules (brief, feedback) are probed with a HEAD request
  const BY_DESIGN = /\/indicator\/|favicon|\/js\/product\/(brief\/brief|kit\/feedback)\.js/;
  for (const p of problems) if (!(BY_DESIGN.test(p) && /404/.test(p))) add("console", "error", p.slice(0, 200));
  for (const r of m.requests) if (!BY_DESIGN.test(r)) add("request", "error", r);
  if (overflow.scrollWidth > overflow.clientWidth + 1) add("overflow", "error", `${overflow.scrollWidth} > ${overflow.clientWidth}: ${overflow.leaves.join(", ")}`);
  if (m.h1.length !== 1) add("h1", "error", m.h1.length + " visible h1" + (m.h1.length ? ": " + m.h1.join(" | ") : ""));
  if (route.home) {
    // the town page is one story with sections (n-sec-*), not five tabs: no tab rail is left, the title names the town, and the section of the question in the link is there
    if (m.tabs) add("tab", "error", m.tabs + " tab(s) left on the town page");
    if (!/CityPulse/.test(m.title) || !m.title.trim()) add("title", "error", `title "${m.title}" is not a page title`);
    const want = route.home && route.home !== "weak" ? "n-sec-" + route.home : null;
    // a tiny town (16, 7) has no "changed" and no "first" section by design: its groups are too small to judge, so there is nothing to compare over time or to start with
    const byDesign = NO_COVERAGE.has(key) || route.home === "peers" || (["16", "7"].includes(key) && (route.home === "changed" || route.home === "first"));
    if (want && !m.sections.includes(want)) add("section", byDesign ? "info" : "warn", `no #${want} on the town page of ${key}`);
    if (m.sentenceY == null) add("sentence", "warn", "no #n-sec-state on the town page");
    else if (m.sentenceY > ANSWER_Y_LIMIT(width)) add("answer-y", "warn", `answer sentence at y=${m.sentenceY} (limit ${ANSWER_Y_LIMIT(width)})`);
    if (m.sentence && noDataStill(m.sentence)) add("forbidden", "error", `"עדיין" in a no-data sentence: ${m.sentence.slice(0, 80)}`);
  }
  for (const j of junkIn(m.text)) add("junk", "error", `${j.word}: ...${j.at}...`);
  for (const w of forbiddenIn(m.text)) add("forbidden", "error", `${w.word}: ...${w.at}...`);
  for (const i of m.images) add("image", "error", "broken image " + i);
  for (const s of m.states) {
    const err = /n-state-err/.test(s.cls), nf = /n-state-nf/.test(s.cls);
    if (err) add("state", "error", `error card (${s.state}): ${s.text}`);
    else if (nf) add("state", NO_COVERAGE.has(key) ? "info" : "warn", `${s.state || "not found"} card: ${s.text}`);
  }
  if (ctx.ms > 6000) add("slow", "warn", ctx.ms + " ms");
  return f;
}

const CHECKS = ["console", "request", "overflow", "h1", "tab", "title", "section", "sentence", "answer-y", "junk", "forbidden", "image", "state", "slow", "load"];

// ── report ──
function summarize(loads) {
  const byCheck = Object.fromEntries(CHECKS.map((c) => [c, { error: 0, warn: 0, info: 0 }]));
  let failing = 0;
  for (const l of loads) {
    if (l.findings.some((x) => x.severity !== "info")) failing++;
    for (const x of l.findings) (byCheck[x.check] || (byCheck[x.check] = { error: 0, warn: 0, info: 0 }))[x.severity]++;
  }
  return { loads: loads.length, failing, byCheck };
}
function markdown(meta, loads) {
  const s = summarize(loads), L = [];
  L.push(`# Product matrix`, "", `${meta.date}, ${meta.base}/n.html, ${s.loads} loads in ${Math.round(meta.seconds)} s. Localities ${meta.localities.join(", ")}; widths ${meta.widths.join(", ")}; themes ${meta.themes.join(", ")}.`, "",
    `Loads with at least one error or warning: **${s.failing}** of ${s.loads}.`, "", "| check | errors | warnings | info |", "|---|---:|---:|---:|");
  for (const [c, n] of Object.entries(s.byCheck)) L.push(`| ${c} | ${n.error} | ${n.warn} | ${n.info} |`);
  L.push("", "## Failing screens", "");
  const groups = {};
  for (const l of loads) for (const x of l.findings) if (x.severity !== "info") (groups[x.check] ||= []).push({ l, x });
  for (const [c, arr] of Object.entries(groups)) {
    L.push(`### ${c} (${arr.length})`, "");
    for (const { l, x } of arr.slice(0, 25)) L.push(`- ${x.severity} ${l.width}px ${l.theme} ${l.url} : ${x.detail}`);
    if (arr.length > 25) L.push(`- ... and ${arr.length - 25} more (see the JSON)`);
    L.push("");
  }
  if (meta.skipped.length) L.push("## Routes that could not be built", "", ...meta.skipped.map((x) => "- " + x), "");
  const slow = [...loads].sort((a, b) => b.ms - a.ms).slice(0, 5);
  L.push("## Slowest loads", "", ...slow.map((l) => `- ${l.ms} ms ${l.width}px ${l.theme} ${l.url}`), "");
  return L.join("\n");
}

function parseArgs(argv) {
  const o = { out: "design-ideas/product/qa/matrix", base: "http://localhost:8800", only: null };
  const set = argv.includes("--subset") ? SUBSET : FULL;
  o.localities = set.localities; o.widths = set.widths; o.themes = set.themes;
  for (const a of argv) {
    const m = /^--([a-z]+)=(.*)$/.exec(a);
    if (!m) continue;
    if (m[1] === "localities") o.localities = m[2].split(",").filter(Boolean);
    else if (m[1] === "widths") o.widths = m[2].split(",").map(Number).filter(Boolean);
    else if (m[1] === "themes") o.themes = m[2].split(",").filter((t) => t === "light" || t === "dark");
    else if (m[1] === "out") o.out = m[2];
    else if (m[1] === "only") o.only = m[2];
    else if (m[1] === "base") o.base = m[2];
  }
  return o;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const within = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + " timed out")), ms))]);

async function main() {
  const { launch } = require("./cdp");
  const o = parseArgs(process.argv.slice(2)), started = Date.now(), b = await launch(), loads = [], skipped = [];
  const page = o.base + "/n.html";
  // does the one-page brief exist? (the menu shows its link only then; the route is measured only then)
  let brief = false;
  try { const r = await fetch(o.base + "/js/product/brief/brief.js", { method: "HEAD" }); brief = r.ok; } catch (e) { /* server problem shows later */ }
  // the first category and measure of each locality, found once on the full level of its town page
  const links = {};
  await b.viewport(1280, false, 900);
  for (const key of o.localities) {
    try { await within(b.open(`${page}#/c/${key}?v=full`), 30000, "open"); links[key] = await b.eval(FIND_LINKS(key)); }
    catch (e) { links[key] = {}; skipped.push(`${key}: town page links not read (${e.message})`); }
    if (!links[key].domain) skipped.push(`${key}: no domain link on the town page, the category route is not measured`);
    if (!links[key].indicator) skipped.push(`${key}: no indicator link on the town page, the indicator route is not measured`);
  }
  for (const width of o.widths) {
    await b.viewport(width, width <= 480, HEIGHT(width));
    for (const theme of o.themes) {
      for (const key of o.localities) {
        const routes = buildRoutes(key, { brief, ...links[key] }).filter((r) => !o.only || new RegExp(o.only).test(r.hash));
        for (const route of routes) {
          const url = `${page}${route.hash}`, t0 = Date.now();
          let rec = { key, width, theme, route: route.id, url, ms: 0, findings: [] };
          try {
            b.clearProblems();
            await within(b.open(url), 40000, "open");
            rec.ms = Date.now() - t0;
            await b.eval(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`); await sleep(120);
            const m = await within(b.eval(MEASURE), 20000, "measure"), overflow = await b.overflow();
            rec.findings = judge(m, { route, width, key, overflow, problems: b.problems(), ms: rec.ms });
            rec.facts = { h1: m.h1, title: m.title, sentenceY: m.sentenceY, textLength: m.len };
          } catch (e) {
            rec.ms = Date.now() - t0;
            rec.findings.push({ check: "load", severity: "error", detail: e.message });
          }
          loads.push(rec);
        }
      }
      process.stderr.write(`done ${width}px ${theme}: ${loads.length} loads\n`);
    }
  }
  await b.close();
  const meta = { date: new Date().toISOString().slice(0, 16).replace("T", " "), base: o.base, seconds: (Date.now() - started) / 1000, localities: o.localities, widths: o.widths, themes: o.themes, skipped };
  const out = path.resolve(o.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out + ".json", JSON.stringify({ meta, summary: summarize(loads), loads }, null, 1));
  fs.writeFileSync(out + ".md", markdown(meta, loads));
  const s = summarize(loads);
  console.log(`product matrix: ${s.loads} loads, ${s.failing} with problems. Report: ${out}.md`);
  setTimeout(() => process.exit(s.failing ? 2 : 0), 800);
}

module.exports = { buildRoutes, junkIn, forbiddenIn, noDataStill, judge, summarize, markdown, parseArgs, SUBSET, FULL, QS, ANSWER_Y_LIMIT };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
