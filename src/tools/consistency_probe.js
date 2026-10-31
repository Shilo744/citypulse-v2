"use strict";
// node src/tools/consistency_probe.js [key,key,...] [--base=http://localhost:8800]   (CDP_SLOT=<n> to run beside other tools)
// One town, one answer: reads the city model (GET /api/city/<key>), puts it in the product's categories (city/groups.js regroup: what every screen of the product reads), works out what the product
// should say (city/data.js, city/sentence.js, simple/words.js: the sentence of the verdict and the by-category rows of the town page), then opens the town page (full level and the short alias), the briefing
// and the coverage page in a real browser and checks that each of them says the same thing:
//   count     the verdict sentence "N מתוך M מדדי בריאות דורשים טיפול." (town page) and "N מתוך M מדדים דורשים טיפול" (briefing)    weakest category (town page rows, briefing)
//   rows      every category row ("9 מתוך 13 מדדים דורשים טיפול"), the weakest figures (names), and the official target line of every row that has one ("יעד רשמי: לפחות 80% · רחוק מהיעד")
//   first     the first recommendation (town page, briefing, short level)
//   coverage  "יש נתונים על N מתוך M" (town page), the coverage page's own numbers
// Prints one line per check (ok or DISAGREE with what each page said) and exits 1 when any check disagrees. It only reads: no server is started and nothing is written.
const path = require("path");
const { pathToFileURL } = require("url");
const { launch } = require("./cdp");

const ROOT = path.join(__dirname, "..", "..", "web", "js", "product");
const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const clean = (s) => String(s || "").replace(/[⁦-⁩‎‏⁠]/g, "").replace(/[ ]/g, " ").replace(/\s+/g, " ").trim();
const args = process.argv.slice(2), base = ((args.find((a) => a.startsWith("--base=")) || "").slice(7) || "http://localhost:8800").replace(/\/$/, "");
const keys = ((args.find((a) => !a.startsWith("--")) || "1031,9000,3000,99,472,16,7,935").split(","));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const D = await load("city/data.js"), S = await load("city/sentence.js"), SM = await load("simple/model.js"), W = await load("simple/words.js"), Gr = await load("city/groups.js"), Gd = await load("kit/guide.js");
  const b = await launch();
  await b.viewport(1280, false);
  const text = async (hash) => {
    await b.open(`${base}/n.html#${hash}`);
    await sleep(2200);
    return clean(await b.eval(`(document.querySelector("#view") || document.body).innerText`));
  };
  let bad = 0;
  const line = (key, what, ok, detail) => { if (!ok) bad++; console.log(`${ok ? "ok      " : "DISAGREE"} ${String(key).padEnd(5)} ${what}${detail ? "  " + detail : ""}`); };
  for (const key of keys) {
    // the model as every screen of the product reads it: in the four categories (the server's nine domains are not what a page says)
    const raw = await (await fetch(`${base}/api/city/${key}`)).json();
    if (raw.recommendations == null) raw.recommendations = [];
    const model = Gr.regroup(raw);
    const st = D.stateOf(model), c = st.all.concern || 0, kind = D.townKind(model);
    const wd = c >= 2 ? D.weakestDomain(model) : null, first = kind === "full" ? model.recommendations[0] : null;
    const pages = {
      home: await text(`/c/${key}?v=full&q=weak`), homeFirst: await text(`/c/${key}?v=full&q=first`), brief: await text(`/c/${key}/brief`),
      coverage: await text(`/c/${key}/coverage`), simple: await text(`/c/${key}/simple`)
    };
    const count = (t) => { const m = t.match(/(\d+) מתוך (\d+) מדדי(?:ם| בריאות) דורשים טיפול/) || t.match(/מדד(?: בריאות)? אחד מתוך (\d+) דורש טיפול/); return m ? m[0] : null; };
    // count: the verdict sentence of the town page is the reference (the words of simple/words.js verdictSegs); the briefing carries the same two numbers in its own words
    const verdict = clean(S.plainOf(W.verdictSegs(SM.verdictOf(model), model.city.name)));
    const wantBrief = c >= 2 ? `${c} מתוך ${st.judged} מדדים דורשים טיפול` : null;
    line(key, `count on the town page = "${verdict}"`, pages.home.includes(verdict), pages.home.includes(verdict) ? "" : `said ${count(pages.home)}`);
    if (!wantBrief) line(key, "count on brief: no 'N of M' sentence expected", !/(\d+) מתוך (\d+) מדדים דורשים טיפול/.test(pages.brief), count(pages.brief) || "");
    else line(key, `count on brief = "${wantBrief}"`, pages.brief.includes(wantBrief), pages.brief.includes(wantBrief) ? "" : `said ${count(pages.brief)}`);
    if (c >= 1) { const want = [String(c), String(st.judged)]; const nums = pages.simple.match(/\d+/g) || []; line(key, `short level has ${c} and ${st.judged}`, want.every((w) => nums.includes(w)) || st.judged === 0, ""); }
    // the by-category rows of the town page (full level): label and "k מתוך m ... דורשים טיפול", in the words of catSegs; the weakest category is the first row and the one the briefing names
    const cats = model.domains.filter((d) => !d.background && d.indicators.length).map((d) => { const cc = d.counts || {}, m = D.domainJudged(cc), k = cc.concern || 0; return { d, k, m, say: clean(S.plainOf(W.catSegs(k, m))) }; });
    if (st.judged) for (const x of cats) line(key, `category row ${x.d.label}: "${x.say}"`, pages.home.includes(x.d.label) && pages.home.includes(x.say), "");
    if (wd) line(key, `weakest category on brief = ${wd.short} (${wd.k} מתוך ${wd.m})`, pages.brief.includes(`${wd.short} (${wd.k} מתוך ${wd.m})`), "");
    else line(key, "no weakest category named on brief", !pages.brief.includes("התחום עם הכי הרבה מדדים"), "");
    // first recommendation
    if (first) {
      const hd = D.stepHeadline(first), head = clean(hd.full || hd.text).replace(/[:()]/g, " ").replace(/\s+/g, " ").slice(0, 18);
      const norm = (t) => t.replace(/[:()]/g, " ").replace(/\s+/g, " ");
      for (const p of ["homeFirst", "brief", "simple"]) line(key, `first recommendation on ${p} starts "${head}"`, norm(pages[p]).includes(head), "");
    } else line(key, "no first recommendation expected", !/הצעד הראשון: /.test(pages.homeFirst) || kind !== "full", "");
    // weakest figures: every figure that needs treatment or follow-up is on the full town page (by its full label), the three weakest are on the briefing (by short name) and the short level shows the same ids in the same order
    if (c + (st.all.watch || 0) > 0) {
      const att = SM.attentionOf(model, Infinity).rows, lostHome = att.filter((r) => !pages.home.includes(clean(r.label)));
      line(key, `weakest figures on the town page (${att.length} rows)`, !lostHome.length, lostHome.length ? "not found: " + lostHome.map((r) => r.label).join(" | ") : "");
      const unsaid = att.filter((r) => !r.cause || !pages.home.includes(clean(S.plainOf(r.cause))));          // every row that needs treatment or follow-up says why, in the words of the model's own causes
      line(key, `every row that needs treatment or follow-up says why on the town page (${att.length} rows)`, !unsaid.length, unsaid.length ? "no cause: " + unsaid.map((r) => r.label).join(" | ") : "");
      const weak = D.weakestFive(model, 3).map((a) => D.shortName(a)), missing = weak.filter((n) => !pages.brief.includes(clean(n)));
      line(key, "weakest figures on brief", !missing.length, missing.length ? "not found: " + missing.join(" | ") : "");
      const want = D.weakestFive(model, 1000).filter((a) => a.status === "concern" || a.status === "watch").slice(0, 3).map((a) => a.id), rows = SM.attentionOf(model).rows;
      const lost = rows.filter((r) => !pages.simple.includes(clean(r.label)));
      line(key, "weakest figures on simple (same ids, same order, shown)", JSON.stringify(rows.map((r) => r.id)) === JSON.stringify(want) && !lost.length, lost.length ? "not shown: " + lost.map((r) => r.label).join(" | ") : "");
    }
    // the official target line of every row that has one: the same words on the full level (all rows) as in the model
    const tgtRows = [...SM.attentionOf(model, Infinity).rows, ...SM.goodOf(model, 6).rows].filter((r) => r.tgt);
    if (tgtRows.length) { const missing = tgtRows.filter((r) => !pages.home.includes(clean(D.tgtPlain(r.tgt)))); line(key, `official target lines on the town page (${tgtRows.length} rows)`, !missing.length, missing.length ? "not found: " + missing.map((r) => r.id).join(" | ") : ""); }
    // coverage: have/total
    const cov = st.have ? `${st.have} מתוך ${st.total}` : null;
    if (cov) {
      line(key, `town page basis "${cov}"`, pages.home.includes(`יש נתונים על ${cov}`), "");
      // the coverage page splits "have" into "found" and "found, small group": together they are the town page's N
      const tile = (re) => { const m = pages.coverage.match(re); return m ? Number(m[1]) : 0; }, found = tile(/(\d+) נמצא נתון/), small = tile(/(\d+) נמצא, קבוצה קטנה/), total = tile(/(?:בדקנו|נבדקו) (\d+) מדדים/);
      line(key, `coverage page: ${found} found + ${small} small = ${st.have}, of ${st.total}`, found + small === st.have && total === st.total, `said ${found} + ${small} of ${total}`);
    } else line(key, "no coverage: nothing claimed", !/יש נתונים על [1-9]/.test(pages.home), "");
  }
  b.problems().forEach((p) => console.log("PROBLEM " + p));
  await b.close();
  setTimeout(() => process.exit(bad ? 1 : 0), 800);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
