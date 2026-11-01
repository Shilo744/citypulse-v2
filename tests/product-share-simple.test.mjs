// w3b: the share preview of the one-glance page, the page held behind the dialogs, the sending state of the mistake report, and the voice of the kit.
// DOM parts run against the tiny fake document of tests/helpers/fake-dom.mjs (a modal <dialog> is added here); the real browser was probed separately (DONE/w3b.md).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { haveStore, model as cityModel } from "./helpers/city-models.mjs";
import { installDom, FEl } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCT = path.join(ROOT, "web", "js", "product");
const load = (f) => import(pathToFileURL(path.join(PRODUCT, f)).href);
const skip = haveStore ? false : "no data store";
const S = await load("city/sentence.js"), W = await load("simple/words.js"), M = await load("simple/model.js");
const share = await load("kit/share.js"), base = await load("kit/base.js"), feedback = await load("kit/feedback.js"), help = await load("kit/helpsheet.js");
const MODELS = Object.fromEntries(["1031", "16", "935", "472", "99", "7", "2710"].map((k) => [k, cityModel(k)]));

// a modal <dialog> for the fake document: showModal() opens it, close() fires "close" like the platform does
FEl.prototype.showModal = function () { this.open = true; };
FEl.prototype.close = function () { if (!this.open) return; this.open = false; this.fire("close"); };
FEl.prototype.contains = function (n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; };
Object.defineProperty(FEl.prototype, "className", { get() { return [...this.classes].join(" "); }, set(v) { this.classes.clear(); String(v).split(" ").filter(Boolean).forEach((c) => this.classes.add(c)); } });
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const byTag = (t) => (e) => e.tagName === t;

// ── the share preview of "במבט אחד" ──────────────────────────────────────────────────────────────────────
const RANKISH = /מקום|מקומות|אחוזון|דירוג|דורג|ממוקם|rank|percentile/i;

test("shareMeta(model, \"simple\"): the town and \"במבט אחד\" in the title, the verdict and the plain counts in the description", { skip }, () => {
  const m = MODELS["1031"], meta = S.shareMeta(m, "simple"), v = M.verdictOf(m);
  assert.equal(meta.title, `${m.city.name} במבט אחד`);
  assert.ok(meta.description.startsWith(W.plainOf(W.verdictSegs(v, m.city.name))), "the first sentence is the page's own verdict");
  assert.ok(meta.description.includes(W.legendPlain(v.counts)), "the counts of each state, as the legend under the bar says them");
  assert.ok(meta.description.endsWith("."), meta.description);
});

test("shareMeta simple: the same shape for every kind of town, and never a rank, a percentile or a place", { skip }, () => {
  const kinds = new Set();
  for (const [k, m] of Object.entries(MODELS)) {
    if (!m) continue;
    const meta = S.shareMeta(m, "simple"), v = M.verdictOf(m);
    kinds.add(v.kind);
    assert.deepEqual(Object.keys(meta), ["title", "description", "question"], k);
    assert.equal(meta.title, `${m.city.name} במבט אחד`, k);
    assert.ok(meta.description.length > 10, k);
    assert.ok(!RANKISH.test(meta.description) && !RANKISH.test(meta.title.replace(m.city.name, "")), `${k}: ${meta.description}`);
    assert.ok(!/\d+\s*(מתוך|\/)\s*\d{3,}/.test(meta.description), `${k}: no "place out of many localities"`);
    if (v.kind !== "full") assert.ok(!/בסך הכול/.test(meta.description), `${k}: a town that cannot be judged gets no count line`);
  }
  assert.ok(kinds.has("full") && kinds.size >= 2, "the fixtures cover a judged town and at least one that cannot be judged: " + [...kinds]);
  if (MODELS["935"]) assert.equal(S.shareMeta(MODELS["935"], "simple").description, W.plainOf(W.verdictSegs(M.verdictOf(MODELS["935"]), MODELS["935"].city.name)), "no coverage: only the calm sentence");
});

test("shareMeta: the five answers keep their previews, an unknown id still gives the first answer", { skip }, () => {
  const m = MODELS["1031"];
  for (const q of ["weak", "changed", "peers", "first", "missing"]) assert.notEqual(S.shareMeta(m, q).title, `${m.city.name} במבט אחד`, q);
  assert.deepEqual(S.shareMeta(m, "nope"), S.shareMeta(m, "weak"));
});

test("sentence.js stays free of the browser when it imports the one-glance modules, in any import order", async () => {
  for (const f of ["simple/words.js", "simple/model.js"]) {
    const src = fs.readFileSync(path.join(PRODUCT, f), "utf8").replace(/\/\/.*$/gm, "");
    assert.ok(!/\b(document|window|location|localStorage|navigator)\b/.test(src), f + " mentions a browser global");
  }
  const { execFileSync } = await import("node:child_process");
  const href = (f) => pathToFileURL(path.join(PRODUCT, f)).href;
  for (const first of ["simple/words.js", "simple/model.js", "city/sentence.js"]) {
    const out = execFileSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(href(first))}); const S = await import(${JSON.stringify(href("city/sentence.js"))}); console.log(typeof S.shareMeta, typeof S.plainOf);`], { encoding: "utf8" });
    assert.equal(out.trim(), "function function", first);
  }
});

test("shareUrl(key, \"simple\"): the page itself without share pages, /s/<key>?q=simple with them", () => {
  const loc = { origin: "https://cp.example", pathname: "/n.html" };
  share.setShareFeature(false);
  assert.equal(share.shareUrl("1031", "simple", loc), "https://cp.example/n.html#/c/1031/simple");
  assert.equal(share.shareUrl("a b", "simple", loc), "https://cp.example/n.html#/c/a%20b/simple");
  assert.equal(share.shareUrl("1031", "2", loc), "https://cp.example/n.html#/c/1031?q=2", "an answer keeps its query");
  share.setShareFeature(true);
  try { assert.equal(share.shareUrl("1031", "simple", loc), "https://cp.example/s/1031?q=simple"); assert.equal(share.shareUrl("16", "simple", loc), "https://cp.example/s/16?q=simple"); }
  finally { share.setShareFeature(false); }
});

test("the share button of the town page always hands the id \"weak\" to shareUrl (the short level is retired) and builds no link of its own", () => {
  const src = fs.readFileSync(path.join(PRODUCT, "city", "home.js"), "utf8");
  assert.ok(src.includes("shareHref = () => shareUrl(key, \"weak\")"));
  assert.ok(!/shareQ|level === "simple"/.test(src));
  assert.match(fs.readFileSync(path.join(ROOT, "design-ideas", "product", "NEEDS", "w3b-bob.txt"), "utf8"), /simple/);
});

// ── the page behind a dialog ─────────────────────────────────────────────────────────────────────────────
function page(d) {
  const mk = (tag, id) => { const e = d.doc.createElement(tag); if (id) e.setAttribute("id", id); d.body.append(e); return e; };
  const app = mk("div", "app"), live = mk("div", "live"), script = mk("script"), nojs = mk("noscript");
  const opener = d.doc.createElement("button"); app.append(opener);
  return { app, live, script, nojs, opener };
}

test("a dialog holds the page behind it: inert on the app, never on the dialog or the live regions; aria-modal; focus in, and back to the opener", () => {
  const d = installDom();
  try {
    const p = page(d), kitLive = d.doc.createElement("div"); kitLive.classes.add("n-kit-live"); d.body.append(kitLive);
    const side = d.doc.createElement("div"); side.setAttribute("inert", ""); d.body.append(side);        // inert before the dialog: stays inert after it
    p.opener.focus();
    const h = base.openDialog({ title: "t", body: "b", opener: p.opener });
    assert.equal(h.dlg.getAttribute("aria-modal"), "true");
    assert.equal(p.app.getAttribute("inert"), "", "the app is held");
    for (const free of [h.dlg, p.live, p.script, p.nojs, kitLive]) assert.equal(free.getAttribute("inert"), null, free.tagName + (free.id ? "#" + free.id : ""));
    assert.ok(d.doc.activeElement && h.dlg.find((e) => e === d.doc.activeElement), "focus is inside the dialog");
    h.close();
    assert.equal(p.app.getAttribute("inert"), null, "released");
    assert.equal(side.getAttribute("inert"), "", "what was inert before stays inert");
    assert.equal(d.doc.activeElement, p.opener, "focus returns to the opener");
  } finally { d.restore(); }
});

test("one dialog replacing another keeps the page held until the last one closes", () => {
  const d = installDom();
  try {
    const p = page(d);
    const a = base.openDialog({ title: "a", body: "x", opener: p.opener }), b = base.openDialog({ title: "b", body: "y", opener: p.opener });
    assert.equal(p.app.getAttribute("inert"), "", "held by the second");
    b.close();
    assert.equal(p.app.getAttribute("inert"), null);
    assert.equal(a.dlg.isConnected, false);
  } finally { d.restore(); }
});

test("a dialog opened with no opener returns focus to where the reader was", () => {
  const d = installDom();
  try {
    const p = page(d); p.opener.focus();
    const h = base.openDialog({ title: "t", body: "b" });
    h.close();
    assert.equal(d.doc.activeElement, p.opener);
  } finally { d.restore(); }
});

test("the keyboard sheet is modal too: the page is held while it is open, Escape (the close event) releases it and focus goes back", () => {
  const d = installDom({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  try {
    const p = page(d); p.opener.focus();
    help.openHelp();
    const dlg = d.body.find(byTag("DIALOG"));
    assert.equal(dlg.getAttribute("aria-modal"), "true");
    assert.ok(dlg.open); assert.equal(p.app.getAttribute("inert"), "");
    assert.equal(dlg.getAttribute("inert"), null);
    assert.ok(dlg.find((e) => e === d.doc.activeElement), "focus is inside the sheet");
    help.openHelp();                                           // already open: nothing doubles
    dlg.close();                                               // what Escape does
    assert.equal(p.app.getAttribute("inert"), null);
    assert.equal(d.doc.activeElement, p.opener);
    help.openHelp(); dlg.close();
    assert.equal(p.app.getAttribute("inert"), null);
  } finally { d.restore(); }
});

// ── the mistake report: sending, no answer, errors ───────────────────────────────────────────────────────
const fb = (d, fetchFn, timeout) => {
  const p = page(d), h = feedback.openFeedback({ key: "1031", name: "שדרות" }, p.opener, { fetchFn, timeout });
  const q = { h, p, form: h.dlg.find(byTag("FORM")), msg: h.dlg.find(byTag("TEXTAREA")), send: h.dlg.find((e) => e.tagName === "BUTTON" && e.getAttribute("type") === "submit"), status: h.dlg.find((e) => e.id === "n-kit-fb-status") };
  q.msg.value = "המספר לא נכון";
  return q;
};

test("sending: the button is aria-disabled (not disabled: the focus stays) and says שולח, the live region says it, a second press sends nothing; the text is kept", async () => {
  const d = installDom({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  try {
    let calls = 0, release;
    const q = fb(d, () => { calls++; return new Promise((r) => { release = () => r({ ok: true, status: 200, json: async () => ({ ok: true }) }); }); });
    assert.equal(q.send.textContent, "שליחה");
    q.send.focus();
    const first = q.form.fire("submit");
    await tick(5);
    assert.ok(!q.send.disabled, "never the disabled attribute: a disabled button drops the focus to the page"); assert.equal(q.send.getAttribute("aria-disabled"), "true"); assert.equal(d.doc.activeElement, q.send, "the focus stays on the button while the request is held"); assert.equal(q.send.getAttribute("aria-busy"), "true"); assert.match(q.send.textContent, /^שולח/);
    assert.equal(q.status.getAttribute("role"), "status"); assert.match(q.status.textContent, /^שולח/);
    await q.form.fire("submit"); assert.equal(calls, 1, "no second request while one is on its way"); assert.equal(d.doc.activeElement, q.send);
    release(); await first; await tick(5);
    assert.equal(q.status.textContent === "" || /תודה/.test(q.form.textContent), true);
    assert.match(q.h.dlg.textContent, /תודה, הדיווח התקבל/);
  } finally { d.restore(); }
});

test("no answer: after the limit the dialog says so, the button works again and the typed text is kept", async () => {
  const d = installDom({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  try {
    const q = fb(d, () => new Promise(() => {}), 40);        // a server that never answers, and a fetch that ignores the abort signal
    q.send.focus();
    const run = q.form.fire("submit");
    await tick(10); assert.equal(q.send.getAttribute("aria-disabled"), "true"); assert.equal(d.doc.activeElement, q.send);
    await run;
    assert.equal(q.status.textContent, "אין תשובה מהשרת. אפשר לנסות שוב.");
    assert.ok(q.status.classes.has("is-err"));
    assert.equal(q.send.getAttribute("aria-disabled"), null); assert.equal(q.send.getAttribute("aria-busy"), null); assert.equal(q.send.textContent, "שליחה");
    assert.equal(q.msg.value, "המספר לא נכון");
    assert.equal(d.doc.activeElement, q.send, "focus is back on the button");
    assert.equal(feedback.sendFeedback.length >= 0, true);
  } finally { d.restore(); }
});

test("sendFeedback: the default limit is 15 seconds; a late answer after the limit changes nothing; other errors are not \"no answer\"", async () => {
  assert.match(fs.readFileSync(path.join(PRODUCT, "kit", "feedback.js"), "utf8"), /TIMEOUT = 15000/);
  const slow = await feedback.sendFeedback({}, { fetchFn: () => new Promise((r) => setTimeout(() => r({ ok: true, json: async () => ({ ok: true }) }), 80)), timeout: 20 });
  assert.deepEqual([slow.ok, slow.timedOut], [false, true]);
  const fast = await feedback.sendFeedback({}, { fetchFn: async () => ({ ok: true, json: async () => ({ ok: true }) }), timeout: 20 });
  assert.deepEqual(fast, { ok: true });
  const off = await feedback.sendFeedback({}, { fetchFn: async () => { throw new TypeError("offline"); }, timeout: 20 });
  assert.equal(off.ok, false); assert.equal(off.timedOut, undefined);
});

test("closing the dialog while a report is on its way does not pull the focus back into it", async () => {
  const d = installDom({ storage: { getItem: () => null, setItem() {}, removeItem() {} } });
  try {
    let release;
    const q = fb(d, () => new Promise((r) => { release = () => r({ ok: true, status: 200, json: async () => ({ ok: true }) }); }));
    const run = q.form.fire("submit"); await tick(5);
    q.h.close(); assert.equal(d.doc.activeElement, q.p.opener);
    release(); await run; await tick(5);
    assert.equal(d.doc.activeElement, q.p.opener, "the opener keeps the focus");
  } finally { d.restore(); }
});

// ── the voice of the kit and of the one-glance words ─────────────────────────────────────────────────────
test("voice: no \"we\" and no gendered slash forms in the strings of kit/*.js and simple/*.js", () => {
  const we = /(^|[^א-ת])(אנחנו|אנו|שלנו|לנו|אותנו|חישבנו|בדקנו|מצאנו|הצלחנו|קיבלנו|הצענו|נצרף|נבדוק)([^א-ת]|$)/;
  const slash = /[א-ת]\/[יהת]([^א-ת]|$)/;
  const files = [...fs.readdirSync(path.join(PRODUCT, "kit")).filter((f) => f.endsWith(".js")).map((f) => path.join(PRODUCT, "kit", f)), ...fs.readdirSync(path.join(PRODUCT, "simple")).map((f) => path.join(PRODUCT, "simple", f))];
  for (const f of files) {
    if (path.basename(f) === "states.js") continue;                                           // w1's file: listed in NEEDS/w3b.md
    const src = fs.readFileSync(f, "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
    assert.ok(!we.test(src), path.basename(f) + " speaks as \"we\"");
    assert.ok(!slash.test(src), path.basename(f) + " has a gendered slash form");
  }
  assert.equal(W.T.foot.method, "איך מחושבים המספרים");
});
