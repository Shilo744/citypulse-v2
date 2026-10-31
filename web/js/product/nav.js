// Hash routes of the product. The scheme is the one of js/main.js, so a link written by an old page lands inside n.html unchanged.
//   #/   #/c/<key>   #/c/<key>/(simple|brief|overview|d/<id>|i/<id>|trends|compare|actions|ask|coverage|method|glossary|accessibility|privacy)   (simple is the alias of the town page, overview a redirect to it: both stay known sub-routes)   #/method   #/glossary   #/accessibility   #/privacy
// The pages of information (method, glossary, accessibility, privacy) exist in two forms: inside a town (the town menu stays, the way back is the town) and without one (the town-less menu, the way back is the entry page).
// A link written in a town page must use the first form: infoHref(page, key) builds either, hereTown() says which one the reader is in.
// The pure part (parse, classify, build, switchTown) has no DOM and is tested in node; the last block touches the window.

export const SUBS = ["simple", "brief", "overview", "d", "i", "trends", "compare", "actions", "ask", "coverage", "method", "glossary", "accessibility", "privacy"];
export const TOP = ["method", "glossary", "accessibility", "privacy"];
export const QUESTIONS = ["weak", "changed", "peers", "first", "missing"];

const dec = (p) => { try { return decodeURIComponent(p); } catch (e) { return p; } };

export function parse(hash) {
  let raw = String(hash == null ? "" : hash).replace(/^#/, "") || "/";
  const f = raw.indexOf("#"), fragment = f < 0 ? "" : dec(raw.slice(f + 1));           // "#/glossary#concern": the second # names an element of the page
  if (f >= 0) raw = raw.slice(0, f);
  const i = raw.indexOf("?");
  const path = i < 0 ? raw : raw.slice(0, i), qs = i < 0 ? "" : raw.slice(i + 1);
  return { parts: path.split("/").filter(Boolean).map(dec), params: new URLSearchParams(qs), fragment };
}

// what a path means: { id, key, sub, arg } where id is one of
// entry home brief overview d i trends compare actions ask coverage method gmethod glossary accessibility privacy lab badsub notfound
export function classify(parts) {
  if (!parts.length) return { id: "entry" };
  const [a, b, c, d] = parts;
  if (a === "lab") return { id: "lab", target: "#/" };
  if (TOP.includes(a) && parts.length === 1) return { id: a === "method" ? "gmethod" : a };
  if (a !== "c" || !b) return { id: "notfound" };
  if (!c) return { id: "home", key: b };
  if (c === "lab") return { id: "lab", key: b, target: `#/c/${encodeURIComponent(b)}` };
  if (!SUBS.includes(c)) return { id: "badsub", key: b, sub: c };
  if ((c === "d" || c === "i") && !d) return { id: "notfound", key: b, sub: c };
  return { id: c, key: b, sub: c, arg: d || null };
}

const enc = encodeURIComponent;
export function build({ key, sub, arg, params, hash } = {}) {
  let h = "#/";
  if (key != null) { h += "c/" + enc(key); if (sub) h += "/" + sub + (arg ? "/" + enc(arg) : ""); }
  else if (sub) h += sub;
  const q = params instanceof URLSearchParams ? params.toString() : params ? new URLSearchParams(params).toString() : "";
  return h + (q ? "?" + q : "") + (hash ? "#" + hash : "");
}

// the address of one of the pages of information: inside the town when there is a key (#/c/1031/glossary#concern), else the top-level page (#/glossary#concern). fragment: the element of the page to scroll to
export const infoHref = (page, key, fragment) => build({ key: key == null || key === "" ? undefined : key, sub: page, hash: fragment });
// the town an address is in ("#/c/1031/trends" -> "1031"), or null
export const townOf = (hash) => { const c = classify(parse(hash).parts); return c.key != null ? String(c.key) : null; };
// the town of the address the reader is on now; null without a window (the node tests) and on the town-less pages
export const hereTown = () => { try { return townOf(location.hash); } catch (e) { return null; } };

// the same page for another town. An indicator only exists where it was measured, so that check is asked of the caller (has(newKey, id) -> boolean | Promise<boolean>);
// without it, or when it answers no, the new town's home opens. The question (?q=) and a compare set (?with=) are kept except that the new town leaves a compare set.
export async function switchTown(hash, newKey, has) {
  const { parts, params, fragment } = parse(hash), c = classify(parts);
  if (!c.key) return build({ key: newKey });
  if (c.id === "home") return build({ key: newKey, params });
  if (c.id === "i") {
    let ok = false;
    try { ok = has ? !!(await has(newKey, c.arg)) : false; } catch (e) { ok = false; }
    return ok ? build({ key: newKey, sub: "i", arg: c.arg }) : build({ key: newKey });
  }
  if (c.id === "compare") { const keep = new URLSearchParams(params); const w = (keep.get("with") || "").split(",").filter((k) => k && k !== String(newKey)); if (w.length) keep.set("with", w.join(",")); else keep.delete("with"); return build({ key: newKey, sub: "compare", params: keep }); }
  if (c.sub === "glossary") return build({ key: newKey, sub: c.sub, hash: fragment });          // the term the reader was reading stays
  if (SUBS.includes(c.sub)) return build({ key: newKey, sub: c.sub, arg: c.arg, params });
  return build({ key: newKey });
}

// question id normalisation for ?q= on the home (an unknown value is replaced by "weak")
export const normalizeQuestion = (q) => (QUESTIONS.includes(q) ? q : "weak");

// ── the window (browser only) ───────────────────────────────────────────────
export const currentHash = () => location.hash || "#/";

// go to a route. replace: no history entry is added, which is what a redirect must do (a normal assignment leaves a back trap).
// replaceState fires no event, so the router is told through "n-route".
export function go(hash, { replace = false } = {}) {
  if (hash === currentHash() && !replace) { window.dispatchEvent(new Event("n-route")); return; }
  if (replace) { history.replaceState(history.state, "", hash); window.dispatchEvent(new Event("n-route")); }
  else location.hash = hash;
}
// change the query of the current route without a new history entry and without rendering again (the question switch on the home)
export function replaceQuery(params) {
  const { parts } = parse(currentHash());
  const q = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  const base = "#/" + parts.map(enc).join("/");
  history.replaceState(history.state, "", base + (q ? "?" + q : ""));
  window.dispatchEvent(new CustomEvent("n-query"));
}
// the link in the footer back to the previous design keeps the hash
export const oldDesignHref = (page) => page + currentHash();
