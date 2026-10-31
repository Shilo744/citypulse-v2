// Tests for the three static information pages: glossary, privacy, accessibility.
// Each view(ctx) is built against a fake document (the same pattern as product-kit.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT  = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = path.join(ROOT, "web", "js", "product", "pages");
const load  = (f) => import(pathToFileURL(path.join(PAGES, f)).href);

// ── minimal fake document (mirrors product-kit.test.mjs) ────────────────
class FNode { constructor() { this.parentNode = null; this.childNodes = []; } }
class FText extends FNode { constructor(t) { super(); this.nodeType = 3; this.data = t; } get textContent() { return this.data; } }
class FEl extends FNode {
  constructor(tag) {
    super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = {}; this.on = {}; this.id = ""; this.value = ""; this.hidden = false;
    this.style = { setProperty() {} };
    const cls = new Set(); this.classes = cls;
    this.classList = { add: (...c) => c.forEach((x) => cls.add(x)), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) };
  }
  get className() { return [...this.classes].join(" "); }
  set className(v) { this.classes.clear(); String(v).split(" ").filter(Boolean).forEach((c) => this.classes.add(c)); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "id") this.id = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  append(...kids) { for (const k of kids) { const n = typeof k === "string" ? new FText(k) : k; if (n && n.parentNode) n.remove(); if (n) { n.parentNode = this; this.childNodes.push(n); } } }
  replaceChildren(...kids) { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; this.append(...kids); }
  remove() { if (this.parentNode) { this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this); this.parentNode = null; } }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === document?.documentElement; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this.replaceChildren(...(v ? [String(v)] : [])); }
  addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }
  removeEventListener() {}
  find(pred) { for (const c of this.childNodes) { if (c.nodeType === 1) { if (pred(c)) return c; const r = c.find(pred); if (r) return r; } } return null; }
  findAll(pred, out = []) { for (const c of this.childNodes) if (c.nodeType === 1) { if (pred(c)) out.push(c); c.findAll(pred, out); } return out; }
}

function installDom() {
  const body = new FEl("body"), html = new FEl("html"); html.append(body);
  const doc = {
    documentElement: html, body, activeElement: null,
    createElement: (t) => new FEl(t), createElementNS: (_ns, t) => new FEl(t),
    createTextNode: (t) => new FText(t),
    getElementById: (id) => body.find((e) => e.id === id),
  };
  const saved = {};
  const set = (k, v) => { saved[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };
  set("Node", FNode); set("document", doc); set("window", new FEl("window"));
  set("location", { origin: "https://cp.example", pathname: "/n.html", hash: "#/glossary", href: "https://cp.example/n.html#/glossary" });
  set("requestAnimationFrame", () => {/* skip lazy loads in tests */});
  return { doc, body, html, restore() { for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } } };
}

const dom = async (fn) => { const d = installDom(); try { await fn(d); } finally { d.restore(); } };

// ── forbidden words ──────────────────────────────────────────────────────
const FORBID = [/פרמטר/, /מדאיג/, /אחוזון/, /מובהק/, /המודל/, /(?<![א-ת])אנחנו(?![א-ת])/, /(?<![א-ת])לנו(?![א-ת])/];

function checkForbidden(label, text) {
  for (const re of FORBID) {
    assert.ok(!re.test(text), `${label}: forbidden word matched ${re}`);
  }
}

// ── ctx helpers ──────────────────────────────────────────────────────────
const ctx      = (key) => Object.freeze({ key: key || null, model: null, sub: null, parts: [], params: new URLSearchParams(), go() {}, announce() {}, setTitle() {}, setCrumbs() {}, recents: [], fav: null, mode: "n", themeBtn() {}, signal: null });
const ctxTown  = () => ctx("1031");
const ctxNoKey = () => ctx(null);

// ── glossary ─────────────────────────────────────────────────────────────
test("glossary view builds without error and returns a node and a band", async () => {
  await dom(async () => {
    const { view } = await load("glossary.js");
    const result = view(ctxTown());
    assert.ok(result && result.node, "returns an object with node");
    assert.ok(result.band, "returns a band");
    assert.equal(result.node.nodeType, 1);
    assert.equal(result.band.nodeType, 1);
  });
});

test("glossary: has an element with id for every GLOSSARY entry", async () => {
  await dom(async () => {
    const { view } = await load("glossary.js");
    const { GLOSSARY } = await import(pathToFileURL(path.join(ROOT, "web", "js", "product", "kit", "glossary.js")).href);
    const result = view(ctxTown());
    for (const entry of GLOSSARY) {
      const el = result.node.find((e) => e.id === entry.id);
      assert.ok(el, `element with id="${entry.id}" not found`);
    }
  });
});

test("glossary: all 17 terms have id-anchored elements", async () => {
  await dom(async () => {
    const { view } = await load("glossary.js");
    const result = view(ctxTown());
    const terms = result.node.findAll((e) => e.classes.has("n-pg-static-term"));
    assert.equal(terms.length, 17, "17 glossary entries: 'יעד להתמצאות' is new (the two targets that never judge were said inside 'יעד רשמי'; the product's word for them now has its own entry beside 'יעד רשמי' and 'נקודת ייחוס')");
  });
});

test("glossary: back link points to town when ctx.key given, else home", async () => {
  await dom(async () => {
    const { view } = await load("glossary.js");
    const withKey = view(ctxTown());
    const backLink = withKey.band.find((e) => e.tagName === "A" && e.classes.has("n-band-back"));
    assert.ok(backLink && backLink.getAttribute("href") === "#/c/1031", "back href with key");

    const noKey = view(ctxNoKey());
    const backLink2 = noKey.band.find((e) => e.tagName === "A" && e.classes.has("n-band-back"));
    assert.ok(backLink2 && backLink2.getAttribute("href") === "#/", "back href without key");
  });
});

test("glossary: no forbidden words in text content", async () => {
  await dom(async () => {
    const { view } = await load("glossary.js");
    const result = view(ctxTown());
    checkForbidden("glossary node", result.node.textContent);
  });
});

// ── privacy ──────────────────────────────────────────────────────────────
test("privacy view builds without error and returns a node and a band", async () => {
  await dom(async () => {
    const { view } = await load("privacy.js");
    const result = view(ctxTown());
    assert.ok(result && result.node, "returns an object with node");
    assert.ok(result.band, "returns a band");
  });
});

test("privacy: every KEYS key appears in the page", async () => {
  await dom(async () => {
    const { view } = await load("privacy.js");
    const { KEYS } = await import(pathToFileURL(path.join(ROOT, "web", "js", "product", "config.js")).href);
    const result = view(ctxTown());
    const text = result.node.textContent;
    for (const name of Object.keys(KEYS)) {
      // KEY_LABELS uses the key name; each entry renders into the DOM
      const items = result.node.findAll((e) => e.classes.has("n-pg-static-key"));
      assert.ok(items.length >= Object.keys(KEYS).length, `expected at least ${Object.keys(KEYS).length} key items`);
    }
    // also check the rendered list item count
    const items = result.node.findAll((e) => e.classes.has("n-pg-static-key"));
    assert.equal(items.length, Object.keys(KEYS).length, "one list item per KEYS entry");
  });
});

test("privacy: no forbidden words", async () => {
  await dom(async () => {
    const { view } = await load("privacy.js");
    const result = view(ctxTown());
    checkForbidden("privacy node", result.node.textContent);
  });
});

// ── accessibility ─────────────────────────────────────────────────────────
test("accessibility view builds without error and returns a node and a band", async () => {
  await dom(async () => {
    const { view } = await load("accessibility.js");
    const result = view(ctxTown());
    assert.ok(result && result.node, "returns an object with node");
    assert.ok(result.band, "returns a band");
  });
});

test("accessibility: contains the standards and known-limitations sections", async () => {
  await dom(async () => {
    const { view } = await load("accessibility.js");
    const result = view(ctxTown());
    const text = result.node.textContent;
    assert.ok(text.includes("ת״י 5568"), "mentions ת״י 5568");
    assert.ok(text.includes("WCAG"), "mentions WCAG");
    assert.ok(text.includes("AA"), "mentions AA level");
    assert.ok(text.includes("ניווט"), "mentions keyboard navigation");
    assert.ok(text.includes("מגבלות ידועות"), "has known-limitations section");
    assert.ok(text.includes("קורא מסך"), "mentions screen reader");
  });
});

test("accessibility: has a contact slot element", async () => {
  await dom(async () => {
    const { view } = await load("accessibility.js");
    const result = view(ctxTown());
    const slot = result.node.find((e) => e.classes.has("n-pg-static-contact-slot"));
    assert.ok(slot, "contact slot exists");
  });
});

test("accessibility: date string is present and non-empty", async () => {
  await dom(async () => {
    const { view } = await load("accessibility.js");
    const result = view(ctxTown());
    const updated = result.node.find((e) => e.classes.has("n-pg-static-updated"));
    assert.ok(updated, "updated element exists");
    assert.ok(updated.textContent.includes("עודכן:"), "contains update label");
    assert.ok(updated.textContent.length > 10, "date is non-trivial");
  });
});

test("accessibility: no forbidden words", async () => {
  await dom(async () => {
    const { view } = await load("accessibility.js");
    const result = view(ctxTown());
    checkForbidden("accessibility node", result.node.textContent);
  });
});

// ── eyebrow / titleBand contract ──────────────────────────────────────────
test("all three pages have a back link: to the town with ctx.key, to the entry page without", async () => {
  await dom(async () => {
    // titleBand renders a back link when back is set (the eyebrow is also passed for the aria label but back takes the top slot)
    for (const file of ["glossary.js", "privacy.js", "accessibility.js"]) {
      const { view } = await load(file);

      const withKey = view(ctxTown());
      const backLink = withKey.band.find((e) => e.tagName === "A" && e.classes.has("n-band-back"));
      assert.ok(backLink, `${file}: band should have a back link when ctx.key is set`);
      assert.ok(backLink.getAttribute("href") === "#/c/1031", `${file}: back href with key`);

      const noKey = view(ctxNoKey());
      const backHome = noKey.band.find((e) => e.tagName === "A" && e.classes.has("n-band-back"));
      assert.ok(backHome, `${file}: band should have a back link without ctx.key`);
      assert.ok(backHome.getAttribute("href") === "#/", `${file}: back href to home without key`);
    }
  });
});

test("the way back says where it goes without a second arrow (the band draws the arrow), the town stays encoded, and each page is its own current page", async () => {
  await dom(async () => {
    for (const file of ["glossary.js", "privacy.js", "accessibility.js"]) {
      const { view } = await load(file), id = file.replace(".js", "");
      const town = view(ctxTown()), back = town.band.find((e) => e.tagName === "A" && e.classes.has("n-band-back"));
      assert.equal(back.textContent.trim(), "דף היישוב", file); assert.ok(!/[←→]/.test(back.textContent), file + ": no typed arrow");
      assert.equal(town.active, id, file + ": the menu marks this page, not the glossary");
      const free = view(ctxNoKey()), back0 = free.band.find((e) => e.tagName === "A" && e.classes.has("n-band-back"));
      assert.equal(back0.textContent.trim(), "דף הבית", file); assert.equal(free.active, id);
      assert.equal(view(ctx("10 31")).band.find((e) => e.tagName === "A" && e.classes.has("n-band-back")).getAttribute("href"), "#/c/10%2031", file + ": a key with a space is encoded");
    }
  });
});

test("all three pages have an h1 inside the band", async () => {
  await dom(async () => {
    for (const file of ["glossary.js", "privacy.js", "accessibility.js"]) {
      const { view } = await load(file);
      const result = view(ctxTown());
      const h1 = result.band.find((e) => e.tagName === "H1");
      assert.ok(h1, `${file}: band should contain an h1`);
    }
  });
});

test("glossary: the note at the foot says plainly how a rate is made; on a phone the entries sit closer (the page's own h2 rule no longer beats the title's)", async () => {
  await dom(async () => {
    const { view } = await load("glossary.js"), note = view(ctxTown()).node.find((e) => e.classes.has("n-pg-static-note")).textContent;
    assert.ok(/מספר המקרים מחולק במספר התושבים/.test(note) && !/במחנה/.test(note), note);
  });
  const css = fs.readFileSync(path.join(ROOT, "web", "css", "product", "pages", "static.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const phone = css.slice(css.indexOf("@media (max-width: 600px)"));
  assert.ok(/\.n-pg-static-terms \{[^}]*gap: var\(--space-4\)/.test(phone), "a smaller gap between entries on a phone");
  assert.ok(/\.n-pg-static-body \.n-pg-static-term-title \{[^}]*margin-block: 0 var\(--space-1\)/.test(phone), "the title sits on its entry: the stronger selector beats the h2 rule of the page (32 px above)");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css) && !/@keyframes/.test(css), "tokens only, no motion of its own");
});
