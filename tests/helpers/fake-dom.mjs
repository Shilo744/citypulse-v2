// A tiny fake document for the tests of the entry page and the tool pages: elements, text, listeners, simple selectors (tag, .class, #id, descendants), focus.
// It is enough for h(), the town search, the bands and the adapters; it is not a browser. installDom() puts it on globalThis, restore() takes it away.
class FNode {
  constructor() { this.parentNode = null; this.childNodes = []; }
  get parentElement() { return this.parentNode; }
  remove() { if (this.parentNode) { this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this); this.parentNode = null; } }
}
export class FText extends FNode {
  constructor(t) { super(); this.nodeType = 3; this.nodeValue = t; }
  get textContent() { return this.nodeValue; }
}
export class FEl extends FNode {
  constructor(tag) {
    super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = {}; this.on = {}; this.id = ""; this.value = ""; this.hidden = false; this.open = false; this.innerHTML = "";
    this.style = { setProperty() {} }; this.dataset = {};
    const cls = new Set(); this.classes = cls;
    this.classList = { add: (...c) => c.forEach((x) => cls.add(x)), remove: (...c) => c.forEach((x) => cls.delete(x)), contains: (c) => cls.has(c), toggle: (c, on) => { const v = on === undefined ? !cls.has(c) : !!on; if (v) cls.add(c); else cls.delete(c); return v; } };
  }
  get className() { return [...this.classes].join(" "); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "id") this.id = String(v); if (k === "value") this.value = String(v); if (k === "hidden") this.hidden = true; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; if (k === "hidden") this.hidden = false; }
  _put(kids, at) { for (const k of kids) { const n = typeof k === "string" ? new FText(k) : k; if (n.parentNode) n.remove(); n.parentNode = this; this.childNodes.splice(at === undefined ? this.childNodes.length : at++, 0, n); } }
  append(...kids) { this._put(kids); }
  prepend(...kids) { this._put(kids, 0); }
  replaceChildren(...kids) { this.childNodes.forEach((c) => { c.parentNode = null; }); this.childNodes = []; this._put(kids); }
  after(...kids) { const p = this.parentNode, i = p.childNodes.indexOf(this); p._put(kids, i + 1); }
  replaceWith(n) { const p = this.parentNode, i = p.childNodes.indexOf(this); this.remove(); p._put([n], i); }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  get nextElementSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes.slice(p.childNodes.indexOf(this) + 1).find((c) => c.nodeType === 1) || null; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === globalThis.document.documentElement; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this.replaceChildren(...(v ? [String(v)] : [])); }
  addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }
  removeEventListener() {}
  async fire(t, ev = {}) { const e = { target: this, preventDefault() {}, stopImmediatePropagation() {}, ...ev }; for (const f of this.on[t] || []) await f(e); }
  click() { return this.fire("click"); }
  focus() { globalThis.document.activeElement = this; }
  select() {}
  matches(sel) {
    const m = /^([a-z0-9]*)((?:[.#][\w-]+)*)$/i.exec(sel);
    if (!m) return false;
    if (m[1] && m[1].toUpperCase() !== this.tagName) return false;
    return (m[2].match(/[.#][\w-]+/g) || []).every((t) => (t[0] === "." ? this.classes.has(t.slice(1)) : this.id === t.slice(1)));
  }
  closest(sel) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (n.matches(sel)) return n; return null; }
  _all(out = []) { for (const c of this.childNodes) if (c.nodeType === 1) { out.push(c); c._all(out); } return out; }
  querySelectorAll(sel) {
    return sel.split(",").flatMap((one) => {
      const steps = one.trim().split(/\s+/);
      let set = [this];
      for (const st of steps) { const next = []; for (const root of set) for (const e of root._all()) if (e.matches(st) && !next.includes(e)) next.push(e); set = next; }
      return set;
    });
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  find(pred) { return this._all().find(pred) || null; }
  findAll(pred) { return this._all().filter(pred); }
}

export function installDom({ storage } = {}) {
  const body = new FEl("body"), html = new FEl("html"); html.append(body);
  const listeners = {};
  const doc = {
    documentElement: html, body, activeElement: null, title: "T",
    createElement: (t) => new FEl(t), createElementNS: (ns, t) => new FEl(t), createTextNode: (t) => new FText(t),
    getElementById: (id) => body.find((e) => e.id === id), querySelector: (s) => body.querySelector(s), querySelectorAll: (s) => body.querySelectorAll(s),
    addEventListener: (t, f) => (listeners[t] = listeners[t] || []).push(f), removeEventListener() {}
  };
  const saved = {}, set = (k, v) => { saved[k] = Object.getOwnPropertyDescriptor(globalThis, k); Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true }); };
  set("Node", FNode); set("document", doc); set("window", new FEl("window")); set("matchMedia", () => ({ matches: false }));
  set("location", { origin: "https://cp.example", pathname: "/n.html", hash: "#/", href: "https://cp.example/n.html#/" });
  if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);          // stays: a frame callback may fire after restore()
  if (storage !== undefined) set("localStorage", storage);
  return { doc, body, restore() { for (const [k, d] of Object.entries(saved)) { if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k]; } } };
}

// a fetch that answers by path (a function or a value); a path without an answer fails the way a dead network does
export function fakeFetch(routes) {
  return async (url) => {
    const path = String(url).split("?")[0], hit = routes[path];
    if (hit === undefined || hit instanceof Error) throw (hit || new TypeError("Failed to fetch"));
    const body = typeof hit === "function" ? hit(url) : hit;
    return { ok: true, status: 200, json: async () => body };
  };
}
