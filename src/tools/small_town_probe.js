"use strict";
// node src/tools/small_town_probe.js [key,key,...] [--out=file.json] [--base=http://localhost:8800]   (CDP_SLOT=<n> to run beside other tools)
// The text probe of the small-town rule: opens every route of each town in a real browser and searches the visible text for what a town that is too small to judge must not show:
//   rank        מקום N / דירוג / "מתוך N יישובים" / אחוזון      nation   גבוה/נמוך מהממוצע      peers   יישובים דומים
// Prints one line per hit (town, route, the words around it) and, with --out, saves the whole text of every route (to compare a town before and after a change: node src/tools/small_town_probe.js --diff=a.json,b.json).
// It only reads: no server is started and nothing else is written.
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { launch } = require("./cdp");
const loadProduct = (f) => import(pathToFileURL(path.join(__dirname, "..", "..", "web", "js", "product", f)).href);

const args = process.argv.slice(2), opt = (n) => (args.find((a) => a.startsWith("--" + n + "=")) || "").slice(n.length + 3);
const base = (opt("base") || "http://localhost:8800").replace(/\/$/, ""), out = opt("out");
const keys = (args.find((a) => !a.startsWith("--")) || "16,7,472,935").split(",");
const clean = (s) => String(s || "").replace(/[⁦-⁩‎‏⁠]/g, "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PATTERNS = [
  ["rank", /מקום \d|במקום|המקום|דירוג|מתוך \d+ יישובים|אחוזון/g],
  ["nation", /(גבוה|גבוהה|נמוך|נמוכה|גבוהים|נמוכים)\s+(יותר\s+)?מהממוצע|(?:מ|ל)ממוצע הארצי|מהארצי/g],
  ["peers", /יישובים דומים|דומים לו|היישובים הדומים/g]
];

(async () => {
  if (opt("diff")) {
    const [a, b] = opt("diff").split(",").map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
    let same = 0, diff = 0;
    for (const k of Object.keys(a)) if (a[k] === b[k]) same++; else { diff++; console.log("CHANGED " + k); }
    console.log(`${same} routes identical, ${diff} changed`);
    return;
  }
  const Gr = await loadProduct("city/groups.js");
  const b = await launch();
  await b.viewport(1280, false);
  const text = async (hash) => {
    await b.open(`${base}/n.html#${hash}`);
    await sleep(1800);
    return clean(await b.eval(`(document.querySelector("#view") || document.body).innerText`));
  };
  const saved = {}, hits = [];
  for (const key of keys) {
    // the model as the product reads it (city/groups.js regroup): the routes of a town are its four categories and the background, not the server's nine domains
    const model = Gr.regroup(await (await fetch(`${base}/api/city/${key}`)).json());
    const inds = model.indicators || [], doms = model.domains || [];
    const pick = ["pop_growth", "th_mmrv"].filter((id) => inds.some((a) => a.id === id));
    for (const a of inds) if (pick.length < 3 && a.last && !pick.includes(a.id)) pick.push(a.id);
    const routes = [`/c/${key}`, `/c/${key}/brief`, ...doms.map((d) => `/c/${key}/d/${d.id}`), ...pick.map((id) => `/c/${key}/i/${id}`),
      `/c/${key}/trends`, `/c/${key}/compare?with=1031`, `/c/${key}/actions`, `/c/${key}/ask`, `/c/${key}/coverage`, `/c/${key}/method`, `/c/${key}/simple`];
    for (const r of routes) {
      const t = await text(r);
      saved[r] = t;
      for (const [kind, re] of PATTERNS) for (const m of t.matchAll(re)) hits.push({ key, route: r, kind, at: t.slice(Math.max(0, m.index - 28), m.index + m[0].length + 28) });
    }
  }
  for (const h of hits) console.log(`${h.key.padEnd(4)} ${h.kind.padEnd(6)} ${h.route}  ...${h.at}...`);
  console.log(`${hits.length} hits over ${Object.keys(saved).length} routes`);
  if (out) fs.writeFileSync(out, JSON.stringify(saved, null, 1));
  b.problems().forEach((p) => console.log("PROBLEM " + p));
  await b.close();
  setTimeout(() => process.exit(0), 500);
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
