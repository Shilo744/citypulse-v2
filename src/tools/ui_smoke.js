"use strict";
// node src/tools/ui_smoke.js [--wide] [baseUrl=http://localhost:8800] [cityKey=9000] [otherCityKey=1031]
// Opens every screen of two localities at desktop and phone width and reports only problems: console errors, exceptions,
// the in-app error card, a blank page, horizontal overflow. Needs the server running and Chrome installed.
// --wide adds the main screens of 13 very different localities (npm run smoke:wide, a few minutes).
const { launch } = require("./cdp");
// UI=n checks the product (web/n.html): its own routes, no lab, and the overflow assertions at 320, 768 and 844 on the key screens too (npm run smoke:n, which passes --n)
const N = process.env.UI === "n" || process.argv.includes("--n"), PAGE = N ? "/n.html" : "/";

const argv = process.argv.slice(2), wide = argv.includes("--wide");
const [BASE = "http://localhost:8800", C = "9000", C2 = "1031"] = argv.filter((a) => a !== "--wide" && a !== "--n");
// the biggest cities, Arab and Bedouin towns, a Haredi city, a development town, a kibbutz, a moshav, and a tribe the sources do not cover at all
const WIDE_CITIES = ["3000", "5000", "4000", "1161", "2600", "2710", "6100", "2800", "99", "16", "7", "472", "935"];
const OLD_ROUTES = ["#/", "#/method", `#/c/${C}`, `#/c/${C}/d/access`, `#/c/${C}/d/context`, `#/c/${C}/d/env`, `#/c/${C}/d/mental`, `#/c/${C}/i/th_mmrv`, `#/c/${C}/i/pop_size`, `#/c/${C}/i/wait_gyn_days`,
  `#/c/${C}/i/mental_points_10k`, `#/c/${C}/trends`, `#/c/${C}/compare`, `#/c/${C}/actions`, `#/c/${C}/ask`, `#/c/${C}/method`, `#/c/${C2}`, `#/c/${C2}/actions`, `#/c/${C2}/i/th_firstvisit`, `#/c/${C2}/compare`,
  "#/lab", "#/lab/entry", `#/c/${C}/lab/map`, `#/c/${C}/lab/report`, `#/c/${C}/lab/bloom`, `#/c/${C}/lab/wall`, `#/c/${C}/lab/questions`, `#/c/${C}/lab/combo`, `#/c/${C}/lab/questions4`, `#/c/16/lab/questions4`, `#/c/${C}/lab/questions3`, `#/c/16/lab/questions3`, `#/c/${C}/lab/questions2`, `#/c/16/lab/questions2`, `#/c/${C}/lab/combo?t=wall`, `#/c/${C}/lab/combo?t=questions`, `#/c/${C2}/lab/map`, `#/c/16/lab/report`, `#/c/16/lab/bloom`,           // the design lab (js/lab/index.js)
  ...(wide ? WIDE_CITIES.flatMap((k) => [`#/c/${k}`, `#/c/${k}/d/access`, `#/c/${k}/trends`, `#/c/${k}/actions`, `#/c/${k}/compare`, `#/c/${k}/ask`]) : []), "#/c/not-a-city"]
  ;
const N_ROUTES = ["#/", "#/method", "#/glossary", "#/accessibility", "#/privacy", `#/c/${C}/glossary`, `#/c/${C}/accessibility`, `#/c/${C}/privacy`, `#/c/${C}`, `#/c/${C}?q=peers`, `#/c/${C}/brief`, `#/c/${C}/simple`, `#/c/16/simple`, "#/c/935/simple", `#/c/${C}/d/child`, `#/c/${C}/d/mental`, `#/c/16/d/child`, `#/c/${C}/d/outcomes`, `#/c/${C}/d/context`, `#/c/${C}/i/th_mmrv`, `#/c/${C}/i/road_severe_100k`, `#/c/${C}/i/bmi_g7_over`, `#/c/${C}/i/mortality_std`, `#/c/${C}/i/pop_size`, `#/c/${C}/i/wait_gyn_days`, `#/c/${C}/trends`, `#/c/${C}/compare`, `#/c/${C}/actions`, `#/c/${C}/ask`, `#/c/${C}/coverage`, `#/c/${C}/method`, `#/c/${C2}`, `#/c/${C2}/actions`, `#/c/${C2}/i/th_firstvisit`, `#/c/16`, `#/c/16/trends`, `#/c/16/brief`, "#/c/935", "#/c/935/brief", "#/lab", `#/c/${C}/lab/map`, `#/c/${C}/nonsense`, "#/nonsense", `#/c/${C}/d/not-a-domain`, `#/c/${C}/i/not-an-indicator`, ...(wide ? WIDE_CITIES.flatMap((k) => [`#/c/${k}`, `#/c/${k}/d/outcomes`, `#/c/${k}/trends`, `#/c/${k}/actions`, `#/c/${k}/compare`, `#/c/${k}/ask`]) : []), "#/c/not-a-city"];
// the nine old domains are gone from every reader's eyes (MERGE.md section 2): the seven old labels, and "חיסונים" as a heading, a chip, a tile or "תחום חיסונים" (as a word inside a sentence it is fine); the whole page counts: menu, text, aria-label, title
const OLD_WORDS = ["תזונה והנקה", "בריאות הילד וההתפתחות", "רווחה ואלימות", "נגישות לשירותים", "בטיחות ופציעות", "הקשר ודמוגרפיה", "מצב הבריאות ותוחלת החיים"];
// the names of the topics inside a category page (child: חיסונים, mental: רווחה ואלימות) are the topics' own words, not the old categories: they stay out of the reading (u2)
const OLD_CHECK = `(() => { const topics = [...document.querySelectorAll(".n-pg-domain-name")]; topics.forEach((e) => { e.style.display = "none"; }); const t = document.body.innerText + "\\n" + [...document.querySelectorAll("[aria-label],[title]")].map((e) => (e.getAttribute("aria-label") || "") + "\\n" + (e.getAttribute("title") || "")).join("\\n"), words = ${JSON.stringify(OLD_WORDS)};
  topics.forEach((e) => { e.style.display = ""; });
  const lines = t.split(/\\n+/).map((s) => s.trim()); return words.filter((w) => t.includes(w)).concat(lines.filter((l) => l === "חיסונים" || /^חיסונים\\s*[:·(]/.test(l) || /(^|\\s)(בתחום|תחום) (ה)?חיסונים/.test(l)).map((l) => "[" + l.slice(0, 30) + "]")); })()`;
const KEY = (r) => /^#\/(c\/(9000|16|1031)(\/(trends|compare|i\/th_mmrv))?)?$/.test(r.split("?")[0]);       // the screens that also run at the extra widths
const ROUTES = (N ? N_ROUTES : OLD_ROUTES)
  .filter((r) => !process.env.SMOKE_ONLY || new RegExp(process.env.SMOKE_ONLY).test(r));       // SMOKE_ONLY="/trends|/compare" checks only some screens

(async () => {
  const b = await launch();
  let loads = 0, bad = 0;
  for (const [width, mobile] of N ? [[1280, false], [390, true], [320, true], [768, false], [844, true]] : [[1280, false], [390, true]]) {
    await b.viewport(width, mobile);
    for (const r of ROUTES.filter((x) => !N || [1280, 390].includes(width) || KEY(x))) {
      b.clearProblems(); loads++;
      await b.open(BASE + PAGE + r);
      const info = await b.eval(`({ len: document.getElementById('view').innerText.length, errCard: /לא הצלחנו|לא נטען/.test(document.getElementById('view').innerText), notFound: /לא מצאנו את היישוב|היישוב( הזה)? לא נמצא/.test(document.getElementById('view').innerText), friendly: /אין נתונים על המדד הזה|אין מדדים להשוואה|אין עדיין/.test(document.getElementById('view').innerText) })`);
      const o = await b.overflow(), unknown = /not-a-city/.test(r), flags = [];
      if (unknown ? !info.notFound : info.errCard) flags.push(unknown ? "unknown city did not show the not-found card" : "ERROR CARD");
      if (!unknown && !info.friendly && info.len < (N ? 60 : 150)) flags.push("BLANK (" + info.len + " characters)");
      if (N && !unknown) { const old = await b.eval(OLD_CHECK); if (old && old.length) flags.push("OLD CATEGORY WORD: " + old.join(" / ")); }
      if (o.scrollWidth > o.clientWidth + 1) flags.push(`OVERFLOW ${o.scrollWidth} > ${o.clientWidth}: ${o.leaves.join(", ")}`);
      flags.push(...b.problems().filter((p) => !(N && /\/js\/product\/.*404|404.*\/js\/product\//.test(p)) && !(unknown && /404|failed to load/i.test(p)) && !/status of 404.*\/indicator\//.test(p)).slice(0, 3));     // a parameter a locality lacks is a 404 by design
      if (flags.length) { bad++; console.log(`[${width}] ${r}  ${flags.join(" | ")}`); }
    }
  }
  console.log(`ui smoke: ${loads} screens, ${bad} with problems`);
  await b.close();
  setTimeout(() => process.exit(bad ? 2 : 0), 800);
})().catch((e) => { console.error(e.message); process.exit(1); });
