"use strict";
// node src/tools/oldlinks_probe.js   (CDP_SLOT=<n> to run beside other tools)   (q1)
// Every old address that a bookmark can hold, for towns 1031 and 16: #/c/<key>/overview, /simple, /d/<each of the ten old domain ids>, /glossary, /accessibility, /privacy, and the top-level #/glossary|accessibility|privacy.
// Each must land on the right page (the category page of the new categories, the town page, the page of information inside the town) with the town menu, the way back and no pile of history entries. Exit code 1 on any failure.
const { launch } = require("./cdp");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = process.env.BASE || "http://localhost:8800/n.html";          // BASE=http://host/n.html runs it against another server (the live site, another port)
const OLD = { immunization: "child", child: "child", nutrition: "child", outcomes: "outcomes", access: "outcomes", mental: "mental", welfare: "mental", safety: "safety", context: "context", env: "context" };
const LABEL = { child: "ילדים והורים", outcomes: "בריאות ושירותי בריאות", mental: "נפש ורווחה", safety: "בטיחות", context: "רקע על היישוב" };
function state() {
  const t = (e) => (e ? (e.textContent || "").trim().replace(/\s+/g, " ") : "");
  const side = document.querySelector("#side"), back = document.querySelector("#view .n-band-back");
  const navs = [...side.querySelectorAll("a.nav")].map((a) => ({ text: t(a), href: a.getAttribute("href"), cur: a.getAttribute("aria-current") === "page" }));
  return { hash: location.hash, h1: [...document.querySelectorAll("#view h1")].map(t), townItem: t(side.querySelector(".cityswitch b")), choose: navs.some((n) => n.text === "בחירת יישוב"),
    cats: navs.filter((n) => /\/d\//.test(n.href || "")).map((n) => n.text), current: navs.filter((n) => n.cur).map((n) => n.text), back: back ? back.getAttribute("href") : null, backText: t(back),
    crumbs: [...document.querySelectorAll("#crumbs a, #crumbs b")].map(t), nf: document.querySelectorAll(".n-state-nf").length, title: document.title, len: history.length,
    viewText: t(document.getElementById("view")).length };
}
(async () => {
  const b = await launch(); await b.viewport(1280, false);
  const bad = []; let n = 0;
  const check = (ok, what, extra = "") => { n++; if (!ok) { bad.push(what + " " + extra); console.log("FAIL " + what + "   " + extra); } };
  const land = async (from) => { b.clearProblems(); await b.send("Page.resetNavigationHistory"); await b.open(base + "#/"); await b.open(base + from); await sleep(700); return b.eval("(" + state.toString() + ")()"); };
  for (const key of ["1031", "16"]) {
    const c = "#/c/" + key;
    let s = await land(c + "/overview"); check(s.hash === c && s.h1.length === 1 && !s.nf, key + " overview -> town page", JSON.stringify([s.hash, s.h1]));
    check(s.cats.length === (key === "16" ? 3 : 4) && !s.choose && s.current.length === 1, key + " overview: menu has the town and four categories", JSON.stringify([s.cats, s.current]));
    s = await land(c + "/simple"); check(s.hash === c + "/simple" && s.h1.length === 1 && !s.nf, key + " simple alias stays", s.hash);
    check(s.cats.length === (key === "16" ? 3 : 4) && !s.choose, key + " simple: the menu is the town menu", JSON.stringify(s.cats));
    for (const [old, cat] of Object.entries(OLD)) {
      s = await land(c + "/d/" + old);
      check(s.hash === c + "/d/" + cat && s.h1.length === 1 && !s.nf, key + " d/" + old + " -> d/" + cat, JSON.stringify([s.hash, s.h1, s.nf]));
      check(s.h1[0] === LABEL[cat] || (key === "16" && s.h1.length === 1), key + " d/" + old + ": the h1 is the category '" + LABEL[cat] + "'", JSON.stringify(s.h1));
      check(s.back === c && s.backText === "דף היישוב", key + " d/" + old + ": the way back is the town", JSON.stringify([s.back, s.backText]));
      check(s.cats.length === (key === "16" ? 3 : 4) && !s.choose && s.townItem.length > 0, key + " d/" + old + ": the menu is intact", JSON.stringify([s.cats.length, s.choose, s.townItem]));
      check(s.len <= 3, key + " d/" + old + ": no pile of history entries", String(s.len));
      check(b.problems().length === 0, key + " d/" + old + ": no console error", b.problems().join(" | ").slice(0, 160));
    }
    s = await land(c + "/glossary"); check(s.hash === c + "/glossary" && s.h1[0] === "מילון מונחים" && s.back === c && s.cats.length === (key === "16" ? 3 : 4), key + " /glossary stays in the town", JSON.stringify([s.hash, s.h1, s.back, s.cats.length]));
    for (const p of ["accessibility", "privacy"]) { s = await land(c + "/" + p); check(s.hash === c + "/" + p && s.back === c && s.cats.length === (key === "16" ? 3 : 4) && s.h1.length === 1, key + " /" + p + " stays in the town", JSON.stringify([s.hash, s.h1, s.back])); }
  }
  for (const [p, h1] of [["glossary", "מילון מונחים"], ["accessibility", "הצהרת נגישות"], ["privacy", "מדיניות פרטיות"]]) {
    const s = await land("#/" + p); check(s.hash === "#/" + p && s.h1[0] === h1 && s.choose && s.cats.length === 0 && s.back === "#/", "#/" + p + ": the town-less page with its menu and the way home", JSON.stringify([s.hash, s.h1, s.choose, s.cats.length, s.back]));
  }
  console.log(`${n} checks, ${bad.length} failures`);
  await b.close(); setTimeout(() => process.exit(bad.length ? 1 : 0), 500);
})().catch((e) => { console.error(e.stack); process.exit(1); });
