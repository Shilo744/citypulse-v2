// The foundation of mode N (web/n.html, web/js/product, web/css/product): scoping, tokens, the route table and the pure parts of the router,
// the storage wrapper, the network classes and the contrast of the token pairs. Browser behaviour is covered by `npm run smoke:n`.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
const rel = (f) => path.relative(WEB, f).replace(/\\/g, "/");
const read = (f) => fs.readFileSync(f, "utf8");
const cssFiles = walk(path.join(WEB, "css", "product")), jsFiles = walk(path.join(WEB, "js", "product")).filter((f) => f.endsWith(".js"));
const noComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "");
const product = (p) => import(pathToFileURL(path.join(WEB, "js", "product", p)).href);

// ── css ──
test("every top-level rule under web/css/product starts with html[data-ui=\"n\"] or sits in @media, @supports or @font-face", () => {
  const bad = [];
  for (const f of cssFiles) {
    const css = noComments(read(f));
    let depth = 0, start = 0, head = "";
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === "{") { if (depth === 0) head = css.slice(start, i).trim(); depth++; }
      else if (ch === "}") { depth--; if (depth === 0) { start = i + 1; if (!/^(@media|@supports|@font-face)/.test(head) && !head.startsWith('html[data-ui="n"]')) bad.push(`${rel(f)}: ${head.slice(0, 60)}`); } }
      else if (ch === ";" && depth === 0) start = i + 1;
    }
    // inside @media and @supports every rule is scoped too
    for (const m of css.matchAll(/@(?:media|supports)[^{]*\{([\s\S]*?\n\})/g)) for (const r of m[1].matchAll(/(^|\})\s*([^{}@]+)\{/g)) { const sel = r[2].trim(); if (sel && !sel.startsWith('html[data-ui="n"]')) bad.push(`${rel(f)}: (in @media) ${sel.slice(0, 60)}`); }
  }
  assert.deepEqual(bad, []);
});

test("no hex colour in the product css or js outside tokens.css", () => {
  const bad = [];
  for (const f of [...cssFiles.filter((x) => !x.endsWith("tokens.css")), ...jsFiles]) {
    noComments(read(f)).replace(/\/\/.*$/gm, "").split("\n").forEach((line, i) => { if (/#[0-9a-fA-F]{3,8}\b/.test(line.replace(/url\([^)]*\)/g, "").replace(/&#\d+;/g, "").replace(/href[:=]\s*["'`]#/g, ""))) bad.push(`${rel(f)}:${i + 1}`); });
  }
  assert.deepEqual(bad, [], "colour only through tokens (web/css/product/tokens.css)");
});

test("no warm paper colour, no @keyframes, no import from lab/ in the product", () => {
  const bad = [];
  for (const f of [...cssFiles, ...jsFiles, path.join(WEB, "n.html"), path.join(WEB, "css", "pages-n.css"), path.join(WEB, "css", "product.css")]) {
    const src = read(f);
    if (/#f8f5ee|#f7f0e3|--le-cream/i.test(src)) bad.push(rel(f) + " warm paper");
    if (/@keyframes/.test(noComments(src)) && f.includes("product")) bad.push(rel(f) + " @keyframes");
    if (/(import\s*\(|from\s+|@import\s+url\()\s*["']?[^"')]*\blab\b[^"')]*\//.test(noComments(src).replace(/\/\/.*$/gm, "")) ) bad.push(rel(f) + " imports lab/");
  }
  assert.deepEqual(bad, []);
});

test("real motion only through the verbs of css/motion.css: the product css has no transition or animation but the sky of a picture (.wash, band.css: opacity only, only when motion is allowed)", () => {
  const found = [];
  for (const f of cssFiles) for (const m of noComments(read(f)).matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/\b(transition|animation)\b/.test(m[2]) && !(f.endsWith("band.css") && /\.js-motion \.wash$/.test(m[1].trim()))) found.push(rel(f) + " :: " + m[1].trim());
  assert.deepEqual(found, [], "a decorative transition (a hover colour, a turning chevron) is not a verb of motion.css: the state changes at once");
  assert.match(noComments(read(cssFiles.find((f) => f.endsWith("band.css")))), /\.wash \{ opacity: 0; transition: opacity 1\.2s var\(--ease\); \}/, "the wash is opacity only");
});

test("one class prefix per css file, and no prefix in two files", () => {
  const seen = new Map(), bad = [];
  for (const f of cssFiles) {
    const css = noComments(read(f)), prefixes = new Set([...css.matchAll(/\.(n-[a-z]+(?:-[a-z]+)?)-[\w-]+/g)].map((m) => (m[1].startsWith("n-pg-") ? m[1] : m[1].split("-").slice(0, 2).join("-"))));
    if (prefixes.size > 1) bad.push(`${rel(f)} uses ${[...prefixes].join(", ")}`);
    for (const p of prefixes) { if (seen.has(p) && seen.get(p) !== f) bad.push(`${p} in ${rel(seen.get(p))} and ${rel(f)}`); seen.set(p, f); }
  }
  assert.deepEqual(bad, []);
});

test("n.html is its own entry: mode N attribute, no old main.js, no pages.css, no third-party host", () => {
  const html = read(path.join(WEB, "n.html"));
  assert.ok(/<html[^>]*data-ui="n"/.test(html) && /lang="he"/.test(html) && /dir="rtl"/.test(html));
  assert.ok(/js\/product\/boot\.js/.test(html) && /js\/motion\.js/.test(html));
  // one stylesheet request: the server's bundle; where that route is missing the page loads the same six sheets one by one (onerror), in the server's own order
  assert.ok(/<link rel="stylesheet" href="css\/n\.bundle\.css"/.test(html), "n.html links the bundle");
  const sheets = [...(html.match(/forEach\(function\(n\)/) ? html.match(/\['app'[^\]]*\]/)[0].matchAll(/'([^']+)'/g) : [])].map((m) => `css/${m[1]}.css`);
  const cfg = createRequire(import.meta.url)("../src/lib/config.js");
  assert.deepEqual(sheets, cfg.CSS_BUNDLE_FILES, "the fallback names the sheets of the bundle, in order");
  assert.deepEqual(sheets.slice(-2), ["css/pages-n.css", "css/product.css"]);
  assert.ok(!/js\/main\.js|css\/pages\.css|css\/lab|googleapis|gstatic/.test(html));
  assert.ok(!/googleapis|gstatic/.test(cssFiles.map(read).join("") + read(path.join(WEB, "css", "pages-n.css")) + read(path.join(WEB, "css", "product.css"))));
  assert.ok(/rel="preload"[^>]*heebo-hebrew\.woff2/.test(html), "the Hebrew font is preloaded");
  for (const f of ["heebo-hebrew.woff2", "heebo-latin.woff2", "OFL.txt"]) assert.ok(fs.existsSync(path.join(WEB, "assets", "fonts", f)), f);
  assert.ok(/font-family:\s*"Heebo CP"[\s\S]*?font-weight:\s*100 900[\s\S]*?font-display:\s*swap/.test(read(path.join(WEB, "css", "product", "shell.css"))));
});

test("every css file the barrel imports exists (stubs included), and the manifest is valid json", () => {
  const barrel = read(path.join(WEB, "css", "product.css")) + read(path.join(WEB, "css", "pages-n.css"));
  for (const m of barrel.matchAll(/@import url\("([^"]+)"\)/g)) assert.ok(fs.existsSync(path.join(WEB, "css", m[1])), m[1]);
  const man = JSON.parse(read(path.join(WEB, "manifest.webmanifest")));
  assert.equal(man.lang, "he"); assert.equal(man.dir, "rtl"); assert.equal(man.display, "standalone");
});

// ── contrast of the token pairs (SPEC 3.11) ──
const lum = (hex) => { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
test("text pairs reach 4.5:1 and graphics 3:1 in both themes (computed from tokens.css)", () => {
  const css = noComments(read(path.join(WEB, "css", "product", "tokens.css")));
  const blocks = [...css.matchAll(/html\[data-ui="n"\](\[data-theme="dark"\])?\s*\{([^}]*)\}/g)];
  const tok = (dark) => { const t = {}; for (const b of blocks.filter((x) => !!x[1] === false || dark && x[1])) for (const m of b[2].matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)) t[m[1]] = m[2]; return t; };
  const bad = [];
  for (const dark of [false, true]) {
    const t = tok(dark), name = dark ? "dark" : "light";
    const text = [["--ink", "--bg"], ["--ink", "--surface"], ["--ink-2", "--bg"], ["--ink-3", "--bg"], ["--ink-3", "--surface-2"], ["--teal-ink", "--bg"], ["--teal-ink", "--surface"], ["--attn-ink", "--bg"], ["--attn-ink", "--attn-soft"],
      ["--none-ink", "--bg"], ["--good-ink", "--bg"], ["--on-primary", "--teal-dark"], ["--on-nav", "--nav"], ["--on-nav-dim", "--nav"], ["--c-city-ink", "--surface"], ["--ink", "--sky-a"], ["--ink-2", "--sky-b"], ["--teal-ink", "--sky-b"]];
    for (const [fg, bg] of text) { if (!t[fg] || !t[bg]) { bad.push(`${name}: missing ${fg} or ${bg}`); continue; } const r = ratio(t[fg], t[bg]); if (r < 4.5) bad.push(`${name}: ${fg} on ${bg} is ${r.toFixed(2)}`); }
    for (const [fg, bg] of [["--focus", "--bg"], ["--attn-bar", "--bg"], ["--none-bar", "--bg"], ["--good-bar", "--bg"]]) { const r = ratio(t[fg], t[bg]); if (r < 3) bad.push(`${name}: graphic ${fg} on ${bg} is ${r.toFixed(2)}`); }
  }
  assert.deepEqual(bad, []);
});

// ── router: the pure parts ──
test("hash parsing and classification follow the scheme of main.js", async () => {
  const nav = await product("nav.js");
  const id = (h) => nav.classify(nav.parse(h).parts).id;
  assert.equal(id(""), "entry"); assert.equal(id("#/"), "entry");
  assert.equal(id("#/c/1031"), "home"); assert.equal(id("#/c/1031/trends"), "trends"); assert.equal(id("#/c/1031/d/access"), "d"); assert.equal(id("#/c/1031/i/th_mmrv"), "i");
  assert.equal(id("#/c/1031/brief"), "brief"); assert.equal(id("#/c/1031/compare?with=a,b"), "compare");
  assert.equal(id("#/method"), "gmethod"); assert.equal(id("#/glossary"), "glossary"); assert.equal(id("#/accessibility"), "accessibility"); assert.equal(id("#/privacy"), "privacy");
  assert.equal(id("#/lab"), "lab"); assert.equal(id("#/lab/entry"), "lab"); assert.equal(id("#/c/1031/lab/questions4"), "lab");
  assert.equal(id("#/c/1031/nonsense"), "badsub"); assert.equal(id("#/nonsense"), "notfound"); assert.equal(id("#/c"), "notfound"); assert.equal(id("#/c/1031/d"), "notfound"); assert.equal(id("#/method/x"), "notfound");
  assert.deepEqual(nav.classify(nav.parse("#/c/1031/lab/map").parts).target, "#/c/1031"); assert.equal(nav.classify(["lab"]).target, "#/");
  assert.deepEqual(nav.parse("#/c/10%2031/i/a%20b?q=weak").parts, ["c", "10 31", "i", "a b"]); assert.equal(nav.parse("#/c/1?q=peers").params.get("q"), "peers");
  assert.equal(id("#/glossary#concern"), "glossary"); assert.equal(nav.parse("#/glossary#concern").fragment, "concern");
  assert.deepEqual(nav.parse("#/c/%E0%A4%A").parts, ["c", "%E0%A4%A"], "a broken escape does not throw");
});

test("the glossary, the accessibility statement and the privacy page are sub-routes of a town as well as top-level pages", async () => {
  const nav = await product("nav.js"), cls = (h) => nav.classify(nav.parse(h).parts);
  for (const page of ["glossary", "accessibility", "privacy"]) {
    assert.ok(nav.SUBS.includes(page), page + " is a known sub-route");
    assert.deepEqual(cls("#/c/1031/" + page), { id: page, key: "1031", sub: page, arg: null }, "inside the town: the same route id, with the town");
    assert.deepEqual(cls("#/" + page), { id: page }, "top-level: the same id and no town");
  }
  assert.equal(cls("#/c/1031/method").id, "method"); assert.equal(cls("#/method").id, "gmethod");
  assert.deepEqual(cls("#/c/1031/glossary#concern"), { id: "glossary", key: "1031", sub: "glossary", arg: null }); assert.equal(nav.parse("#/c/1031/glossary#concern").fragment, "concern");
  assert.equal(cls("#/c/1031/nonsense").id, "badsub", "an unknown sub-route is still sent to the town home");
});

test("infoHref and townOf: the page of information inside the town when there is one, else the top-level page; the term fragment is kept", async () => {
  const nav = await product("nav.js");
  assert.equal(nav.infoHref("glossary", "1031"), "#/c/1031/glossary"); assert.equal(nav.infoHref("glossary"), "#/glossary"); assert.equal(nav.infoHref("glossary", null), "#/glossary"); assert.equal(nav.infoHref("glossary", ""), "#/glossary");
  assert.equal(nav.infoHref("glossary", "1031", "concern"), "#/c/1031/glossary#concern"); assert.equal(nav.infoHref("glossary", undefined, "concern"), "#/glossary#concern");
  assert.equal(nav.infoHref("accessibility", "1031"), "#/c/1031/accessibility"); assert.equal(nav.infoHref("privacy", "1031"), "#/c/1031/privacy"); assert.equal(nav.infoHref("method", "1031"), "#/c/1031/method"); assert.equal(nav.infoHref("method"), "#/method");
  for (const h of ["#/c/1031", "#/c/1031/trends?x=1", "#/c/1031/glossary#concern", "#/c/1031/d/child", "#/c/1031/privacy"]) assert.equal(nav.townOf(h), "1031", h);
  for (const h of ["#/", "#/glossary", "#/method", "#/privacy#x", "", "#/nonsense"]) assert.equal(nav.townOf(h), null, h);
  assert.equal(nav.hereTown(), null, "without a window there is no town");
  for (const page of ["glossary", "accessibility", "privacy", "method"]) { const c = nav.classify(nav.parse(nav.infoHref(page, "7")).parts); assert.equal(c.key, "7"); assert.equal(c.sub, page); }
});

test("switching town from a page of information stays on the same page of the new town (the term stays); the top-level pages go to the town", async () => {
  const nav = await product("nav.js");
  assert.equal(await nav.switchTown("#/c/1031/glossary", "16"), "#/c/16/glossary");
  assert.equal(await nav.switchTown("#/c/1031/glossary#concern", "16"), "#/c/16/glossary#concern");
  assert.equal(await nav.switchTown("#/c/1031/accessibility", "16"), "#/c/16/accessibility");
  assert.equal(await nav.switchTown("#/c/1031/privacy", "16"), "#/c/16/privacy");
  assert.equal(await nav.switchTown("#/c/1031/method", "16"), "#/c/16/method");
  assert.equal(await nav.switchTown("#/glossary", "16"), "#/c/16"); assert.equal(await nav.switchTown("#/privacy", "16"), "#/c/16");
});

test("no source of the product writes a fixed top-level address of the glossary, the accessibility statement or the privacy page: every link is made by infoHref or glossaryHref", () => {
  const bad = [];
  for (const f of jsFiles) {
    const code = noComments(read(f)).replace(/\/\/.*$/gm, "");
    if (/#\/(glossary|accessibility|privacy)\b/.test(code)) bad.push(rel(f));
  }
  assert.deepEqual(bad, [], "a link written like that loses the town (the menu turns into the town-less one)");
});

test("every route id the router can produce has a table entry", async () => {
  const nav = await product("nav.js"), { ROUTES } = await product("routes.js");
  const ids = ["entry", "home", ...nav.SUBS, "gmethod", "glossary", "accessibility", "privacy"];
  for (const i of ids) assert.equal(typeof (ROUTES[i] && ROUTES[i].load), "function", i);
  assert.ok(ROUTES.entry.landing);
});

test("build is the inverse of parse", async () => {
  const nav = await product("nav.js");
  for (const h of ["#/", "#/c/1031", "#/c/1031?q=peers", "#/c/1031/d/access", "#/c/1031/i/th_mmrv", "#/c/1031/compare?with=a%2Cb", "#/method"]) {
    const { parts, params } = nav.parse(h), c = nav.classify(parts);
    assert.equal(nav.build({ key: c.key, sub: c.sub || (c.id === "gmethod" ? "method" : undefined), arg: c.arg, params }), c.id === "gmethod" ? "#/method" : h);
  }
});

test("a town switch keeps the page; an indicator the new town lacks goes to its home", async () => {
  const nav = await product("nav.js"), has = (k, id) => k === "9000" && id === "th_mmrv";
  assert.equal(await nav.switchTown("#/c/1031/trends", "9000", has), "#/c/9000/trends");
  assert.equal(await nav.switchTown("#/c/1031?q=peers", "9000", has), "#/c/9000?q=peers");
  assert.equal(await nav.switchTown("#/c/1031/d/access", "9000", has), "#/c/9000/d/access");
  assert.equal(await nav.switchTown("#/c/1031/i/th_mmrv", "9000", has), "#/c/9000/i/th_mmrv");
  assert.equal(await nav.switchTown("#/c/1031/i/other", "9000", has), "#/c/9000");
  assert.equal(await nav.switchTown("#/c/1031/i/th_mmrv", "9000", () => { throw new Error("offline"); }), "#/c/9000");
  assert.equal(await nav.switchTown("#/c/1031/compare?with=9000,3000", "9000", has), "#/c/9000/compare?with=3000");
  assert.equal(await nav.switchTown("#/", "9000", has), "#/c/9000");
  assert.equal(await nav.switchTown("#/method", "9000", has), "#/c/9000");
});

test("redirects never write location.hash (that is the back trap); only nav.go may, for a normal step", () => {
  const writers = jsFiles.filter((f) => /location\.hash\s*=[^=]/.test(noComments(read(f)).replace(/\/\/.*$/gm, ""))).map(rel);
  assert.deepEqual(writers, ["js/product/nav.js"]);
  const app = read(path.join(WEB, "js", "product", "app.js"));
  assert.ok(/scrollRestoration\s*=\s*"manual"/.test(app) && /replaceState/.test(app) && /location\.replace/.test(app));
});

test("the ctx given to every view has exactly the keys of the contract and is frozen", () => {
  const app = read(path.join(WEB, "js", "product", "app.js"));
  const body = /Object\.freeze\(\{([\s\S]*?)\n  \}\);/.exec(app)[1];
  const keys = [...body.matchAll(/(?:^|[,{\s])(\w+)(?=\s*:|\s*,|\s*$)/gm)].map((m) => m[1]);
  for (const k of ["key", "model", "sub", "parts", "params", "go", "announce", "setTitle", "setCrumbs", "recents", "fav", "mode", "themeBtn", "signal"]) assert.ok(keys.includes(k), "ctx." + k);
  assert.ok(/mode:\s*"n"/.test(body));
});

// ── seo, net, storage ──
test("titles follow SPEC 4.4", async () => {
  const seo = await product("seo.js");
  assert.equal(seo.titleFor({}), "CityPulse · בריאות הציבור ברמת היישוב");
  assert.equal(seo.titleFor({ page: "מגמות והיסטוריה", town: "שדרות" }), "מגמות והיסטוריה · שדרות · CityPulse");
  assert.equal(seo.titleFor({ page: "מידע" }), "מידע · CityPulse");
});

test("network errors are sorted into the classes of SPEC 6.6", async () => {
  const net = await product("net.js");
  assert.equal(net.classify(new Error("locality not found")), "notfound"); assert.equal(net.classify(new Error("no data")), "nodata");
  assert.equal(net.classify(new Error("שגיאה 503")), "server"); assert.equal(net.classify(new Error("שגיאה 404")), "notfound");
  assert.equal(net.classify(new TypeError("Failed to fetch")), "offline"); assert.equal(net.classify(new Error("x"), false), "offline"); assert.equal(net.classify(new Error("boom")), "unknown");
  for (const k of net.KINDS) assert.ok(net.MESSAGES[k], k);
});

test("read() retries a read once, never a missing town, and gives up after the limit", async () => {
  const net = await product("net.js");
  let n = 0;
  assert.equal(await net.read(async () => { if (++n < 2) throw new TypeError("Failed to fetch"); return "ok"; }, { delayMs: 1 }), "ok"); assert.equal(n, 2);
  n = 0; await assert.rejects(net.read(async () => { n++; throw new Error("locality not found"); }, { delayMs: 1 }), (e) => e.kind === "notfound"); assert.equal(n, 1);
  await assert.rejects(net.read(() => new Promise(() => {}), { timeoutMs: 5, delayMs: 1, retry: false }), (e) => e.kind === "timeout");
});

test("the storage wrapper survives storage that throws, and keeps the lists in memory", async () => {
  const st = await product("storage.js");
  const boom = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  st.use(boom);
  assert.equal(st.available(), false); assert.equal(st.get("x", "d"), "d");
  st.set("x", "1"); assert.equal(st.get("x"), "1", "memory fallback");
  st.recents.add({ key: "1", name: "א" }); st.recents.add({ key: "2", name: "ב" }); assert.deepEqual(st.recents.list().map((t) => t.key), ["2", "1"]);
  assert.equal(st.fav.toggle({ key: "1", name: "א" }), true); assert.equal(st.fav.has("1"), true); assert.equal(st.fav.toggle({ key: "1", name: "א" }), false);
  st.use(null); assert.equal(st.get("never", "z"), "z");
  st.use(undefined);
});

test("recents keep five, newest first, without duplicates; favourites keep twelve; bad json is ignored", async () => {
  const st = await product("storage.js"), data = new Map();
  st.use({ getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) });
  for (let i = 1; i <= 7; i++) st.recents.add({ key: String(i), name: "t" + i });
  st.recents.add({ key: "5", name: "t5" });
  assert.deepEqual(st.recents.list().map((t) => t.key), ["5", "7", "6", "4", "3"]);
  for (let i = 1; i <= 13; i++) st.fav.toggle({ key: String(i), name: "f" + i });
  assert.equal(st.fav.list().length, 12); assert.equal(st.fav.has("13"), false);
  data.set("cp2-recent", "{not json"); assert.deepEqual(st.recents.list(), []);
  data.set("cp2-recent", JSON.stringify([{ key: 1 }, { key: "2", name: "ok" }])); assert.deepEqual(st.recents.list().map((t) => t.key), ["2"]);
  st.recents.clear(); assert.equal(data.has("cp2-recent"), false);
  st.use(undefined);
});

test("shortcuts default to on and can be switched off (WCAG 2.1.4)", async () => {
  const st = await product("storage.js"), data = new Map();
  st.use({ getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) });
  assert.equal(st.shortcutsOn(), true); st.setShortcuts(false); assert.equal(st.shortcutsOn(), false); st.setShortcuts(true); assert.equal(st.shortcutsOn(), true);
  st.use(undefined);
});

test("the README of web/js/product documents the contract of wave 2", () => {
  const md = read(path.join(WEB, "js", "product", "README.md"));
  for (const w of ["ctx", "homeBand", "titleBand", "nodataSpot", "adapt", "entryView", "cityHome", "briefView", "n-shell-", "n-band-"]) assert.ok(md.includes(w), w);
});

test("final pass: chart text is lifted to 12 px by chartfit.js (loaded after the first paint), a second h1 of an old page becomes an h2, print takes the light theme", () => {
  const fit = read(path.join(WEB, "js", "product", "chartfit.js")), app = read(path.join(WEB, "js", "product", "app.js"));
  assert.match(fit, /const MIN = 12/); assert.match(fit, /export function watchChartText/);
  assert.match(app, /import\("\.\/chartfit\.js"\)/); assert.doesNotMatch(app, /^import .*chartfit/m, "not on the static path of the first screen");
  assert.match(read(path.join(WEB, "js", "product", "band.js")), /createElement\("h2"\)/);
  assert.match(read(path.join(WEB, "js", "product", "shell.js")), /beforeprint/);
});
