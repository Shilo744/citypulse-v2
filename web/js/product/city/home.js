// The town page (#/c/<key>, and its alias #/c/<key>/simple): ONE page with ONE level, the full one ("הפרטים המלאים"). The short level ("במבט אחד") and its switch were retired on
// 2026-11-01 at the owner's request; an old link with /simple, ?v= or ?q=simple still opens this page. The story is told in one order: how things stand, what goes well,
// what needs attention, [what changed, next to similar towns], what to do, what is missing, the foot (sections.js).
// The head is the shared band: the name, the facts, the basis, the background, the actions and the question field. ?q=weak|changed|peers|first|missing scrolls to that section.
import { h, icon, ltr, num, outOf } from "../../ui.js";
import { homeBand } from "../band.js";
import * as nav from "../nav.js";
import * as net from "../net.js";
import * as storage from "../storage.js";
import { KEYS } from "../config.js";
import { available } from "../routes.js";
import { starButton } from "../kit/star.js";
import { shareButton, shareUrl } from "../kit/share.js";
import { csvLink, exportHref } from "../kit/csv.js";
import { act, openDialog } from "../kit/base.js";
import { shortPublisher } from "../kit/provenance.js";
import { markFrom, clearFrom } from "../kit/from.js";
import { termButton } from "../kit/term.js";
import * as D from "./data.js";
import * as S from "./sentence.js";
import * as P from "./parts.js";
import * as X from "./sections.js";
import { T, WELCOME, welcomeLines, questionText } from "./copy.js";
import * as M from "../simple/model.js";
import { T as W } from "../simple/words.js";

const enc = encodeURIComponent;
const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const qOf = (id) => Object.keys(X.SECTION).find((k) => X.SECTION[k] === id) || null;          // the ?q= id of a section, or null (the good section has none)

// the three suggestions under the question field, made of the data of this town (SPEC 7.3)
function suggestions(model, kind, pick) {
  const name = model.city.name, key = model.city.key, out = [], toAsk = (text) => `#/c/${enc(key)}/ask?q=${enc(text)}`;
  if (kind === "full") {
    const wd = D.weakestDomain(model);
    if (wd) { const t = T.suggest.domain(wd.label, name); out.push(P.textLink(toAsk(t), t)); }
    const tr = model.indicators.filter((a) => !D.isStale(a) && D.years(a) >= 3 && a.history && a.history.trendClass === "worsening").sort((x, y) => Math.abs(D.changeSize(y)) - Math.abs(D.changeSize(x)) || x.id.localeCompare(y.id))[0];
    if (tr) { const t = T.suggest.trend(tr); out.push(P.textLink(toAsk(t), t)); }
  }
  if (kind !== "uncovered") { const t = questionText("missing", name); out.push(P.textLink(`#/c/${enc(key)}?q=missing`, t, () => pick("missing"))); }
  return out.length ? h("p.n-home-suggest", h("span.n-home-suggest-l", T.suggest.label + ": "), out.flatMap((l, i) => [i ? h("span.n-home-dot", { "aria-hidden": "true" }, "·") : null, l])) : null;
}

// the question field: a hairline field, Enter sends it to the ask page; an empty send says what to write
function askField(model, kind, signal) {
  const name = model.city.name, key = model.city.key, off = kind === "uncovered";
  const input = h("input.n-home-ask-in", { type: "text", name: "q", autocomplete: "off", enterkeyhint: "send", "aria-label": T.ask.label(name), disabled: off, "aria-describedby": "n-home-ask-msg n-home-ask-note" });
  const msg = h("p.n-home-ask-msg", { id: "n-home-ask-msg", role: "status", "aria-live": "polite" });
  const mq = typeof matchMedia === "function" ? matchMedia("(max-width: 560px)") : null;
  const place = () => { input.placeholder = off ? T.ask.off(name) : mq && mq.matches ? T.ask.short(name) : T.ask.placeholder(name); };
  place();
  if (mq && mq.addEventListener) { mq.addEventListener("change", place, { signal }); }
  const form = h("form.n-home-ask", { role: "search", novalidate: true, onsubmit: (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) { msg.textContent = T.ask.empty(name); input.setAttribute("aria-invalid", "true"); input.focus(); return; }
    nav.go(`#/c/${enc(key)}/ask?q=${enc(q)}`);
  } }, icon("search"), input, h("button.n-home-ask-go", { type: "submit", disabled: off }, T.ask.go, h("span.sr", ` ${T.ask.goLabel}`)));
  input.addEventListener("input", () => { msg.textContent = ""; input.removeAttribute("aria-invalid"); });
  return { form, msg };
}

// what a reader needs to know about the place before any number: the kind of authority, the district, the residents and the socio-economic cluster, on both levels
function facts(c, level) {
  return [c.status, c.district ? "מחוז " + c.district : null, c.population ? h("span", ltr(num(c.population, 0)), " תושבים") : null,
    c.sesCluster != null ? h("span", "אשכול ", termButton("cluster", "חברתי-כלכלי"), " ", outOf(c.sesCluster, 10)) : null].filter(Boolean).map((x) => h("span.n-home-fact", x));
}
// the two figures of the background line, in the words a resident uses (their catalogue labels are long: "תחולת העוני בקרב נפשות"), each with the year it is of
const BG = { pop_growth: { label: "גידול האוכלוסייה ב-5 שנים", at: " עד " }, pov_persons: { label: "תחולת העוני", at: " ב-" } };
// the quiet line of the background: the figures that describe the town and are neither good nor bad (the page of the category has the rest).
// A figure stands with its year, and is a button: a tap opens what the catalogue says a reader must know about it (open(id, button), below)
function background(model, key, open) {
  const has = model.domains.some((d) => d.background && d.indicators.length);
  if (!has) return null;
  const parts = Object.entries(BG).map(([id, o]) => [model.indicators.find((a) => a.id === id), o]).filter(([a]) => a && a.last && D.isNum(a.last.v) && a.last.reliable !== false)
    .map(([a, o]) => { const p = M.valueParts(a.unit, a.last.v), yr = a.last.year;
      const btn = h("button.n-kit-term", { type: "button", "aria-haspopup": "dialog", title: W.bg.title, onclick: (e) => open(a.id, e.currentTarget) }, ltr(p.n), p.w ? " " + p.w : "");
      return h("span.n-home-nb", o.label, yr == null ? "" : [o.at, ltr(String(yr))], ": ", btn); });          // a figure stays with its year and its value on one line
  return h("p.n-home-bg", h("a.n-home-bg-a", { href: P.hrefD(key, "context") }, W.background), parts.length ? ": " : "", parts.flatMap((p, i) => [i ? " · " : "", p]));
}

export async function cityHome(ctx) {
  const model = ctx.model, c = model.city, key = String(c.key), name = c.name, kind = D.townKind(model), uncovered = kind === "uncovered", signal = ctx.signal;
  const params = ctx.params || new URLSearchParams(), q = params.get("q");
  const level = "full";          // the one level of the page; the sections still take it from the context (sections.js)
  const v = M.verdictOf(model), av = D.availability(model);
  const title = `בריאות ב${name}`;
  const shareHref = () => shareUrl(key, "weak");

  // ── the head: name, facts, basis and background, the actions, the question field ──
  const basis = S.basisLine(model);
  const basisNode = uncovered ? h("span.n-home-basis", basis.text)
    : h("span.n-home-basis", h("a.n-home-basis-link", { href: `#/c/${enc(key)}/coverage` }, basis.head + basis.tail, icon("left")), basis.rest.map((t) => h("span.n-home-basis-part", t)));
  const linesNode = h("div.n-home-lines", basisNode, uncovered ? null : background(model, key, (id, opener) => backgroundNote(id, opener)));
  const factsHost = h("span.n-home-facts", facts(c, level));
  const star = starButton({ key, name });
  const csv = csvLink(exportHref(key), "הורדת כל נתוני היישוב"); csv.setAttribute("aria-label", "הורדת כל נתוני היישוב (קובץ CSV)");
  const actions = h("div.n-kit-actions.n-kit-actions--icons.n-home-hero-row", { role: "group", "aria-label": "פעולות על היישוב" },
    shareButton({ key, title, label: W.foot.share, getUrl: shareHref }),
    // ONE way to print: the report (two clean pages) when it exists, the page itself otherwise; a town without data has nothing to print or download
    uncovered ? null : available("brief") ? act("a", { href: `#/c/${enc(key)}/brief` }, "print", W.printReport) : act("button", { type: "button", onclick: () => window.print() }, "print", W.foot.print),
    uncovered ? null : csv, star);
  const ask = askField(model, kind, signal);
  const body = h("div.n-home-body");
  const band = homeBand({
    eyebrow: T.eyebrow, title: h("span.n-home-name", name), id: "n-h1", facts: [factsHost], lines: linesNode, actions,
    ask: h("div.n-home-askwrap", ask.form, ask.msg, h("p.n-home-ask-note", { id: "n-home-ask-note" }, T.ask.note), suggestions(model, kind, (id) => goSection(id))),
    art: kind === "full", cls: "n-home-hero"
  });
  // the band is the shared one: the page names its parts with its own classes, so that home.css never has to know the band's
  const part = (sel, cls) => { const el = band.querySelector(sel); if (el) el.classList.add(cls); };
  part(".n-band-in", "n-home-hero-in"); part(".n-band-eyebrow", "n-home-hero-eyebrow"); part(".n-band-actions", "n-home-hero-actions"); part(".n-band-ask", "n-home-hero-ask");
  if (kind !== "full") band.classList.add("n-home-noart");

  // ── first visit: three lines above the first section, dismissed for good, opened again from the footer ──
  const welcome = h("section.n-home-welcome.rv", { "aria-labelledby": "n-home-welcome-h" },
    h("h3.n-home-bh", { id: "n-home-welcome-h" }, WELCOME.title), h("ol.n-home-welcome-l", WELCOME.lines.map((l) => h("li", l))),
    h("button.n-kit-textbtn", { type: "button", onclick: () => { storage.set(KEYS.welcome, "1"); welcome.hidden = true; const s = body.querySelector("#n-home-answer"); if (s) s.focus({ preventScroll: true }); } }, WELCOME.ok));
  welcome.hidden = storage.get(KEYS.welcome) === "1";
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("n-howto", () => {
    if (uncovered) return;
    welcome.hidden = false; if (typeof welcome.scrollIntoView === "function") welcome.scrollIntoView({ block: "center", behavior: smooth() });
  }, { signal });

  // ── the sections of one level ──
  const meta = { value: null, done: false };
  const metaP = uncovered ? Promise.resolve(null) : net.meta().catch(() => null);
  // what a reader must know about a figure of the background line: what it measures, the catalogue's caution, who publishes it, the way to its page (the catalogue arrives while the dialog is open)
  function backgroundNote(id, opener) {
    const a = model.indicators.find((x) => x.id === id), body = h("div", h("p.n-kit-def", W.bg.loading));
    openDialog({ title: (a && a.label) || id, body, foot: h("a.n-kit-link", { href: P.hrefI(key, id) }, W.bg.page, " ←"), opener });
    metaP.then((m) => {
      const c = m && (m.indicators || []).find((x) => x.id === id), src = c && m.sources && m.sources[c.source];
      const kids = [c && c.definition ? h("p.n-kit-def", c.definition) : null, c && c.caution ? h("p.n-kit-def", h("b", W.bg.know + ": "), c.caution) : null,
        src ? h("p.n-kit-def-long", W.bg.source + ": " + [shortPublisher(src.publisher), src.name].filter(Boolean).join(", ") + ".") : null].filter(Boolean);
      body.replaceChildren(...(kids.length ? kids : [h("p.n-kit-def", W.bg.none)]));
    });
  }
  const page = () => ({ key, level, kind, name, toFull: (id) => reveal(id === "small" ? "n-sec-small" : X.SECTION[id]), shareHref });
  const env = { model, key, signal, pick: (id) => goSection(id) };
  function build() {
    const full = level === "full", cx = page(), out = [], idx = [];
    if (uncovered) out.push(X.nodataSection(model));
    else {
      out.push(X.stateSection(model, v, cx));
      if (full) out.push(welcome);
      const add = (id, label, node) => { if (node) { out.push(node); idx.push({ id, label }); } };
      if (kind === "full") {
        add("n-sec-good", W.h.good, X.goodSection(model, cx));
        add("n-sec-weak", W.h.attention, X.attentionSection(model, cx));
        if (full && av.changed == null) add("n-sec-changed", W.h.changed, X.changedSection(model, env));
        if (full && !D.hasNoPeers(model)) add("n-sec-peers", W.h.peers, X.peersSection(model, env));
        add("n-sec-first", W.h.first, X.firstSection(model, cx));
      } else add("n-sec-small", T.block.asIs, X.smallSection(model, cx));
      add("n-sec-missing", W.h.missing, X.missingSection(model, cx, env, meta.value));
      if (full) welcome.querySelector("ol").replaceChildren(...welcomeLines(idx.map((s) => s.id)).map((l) => h("li", l)));          // the note names the sections this page really has
      if (full && idx.length >= 3) out.splice(out.indexOf(welcome) + 1, 0, h("nav.n-home-index.no-print", { "aria-label": W.index }, idx.flatMap((s, i) => [i ? h("span.n-home-index-sep", { "aria-hidden": "true" }) : null,
        h("a.n-home-index-a", { href: `#/c/${enc(key)}` + (qOf(s.id) ? `?q=${qOf(s.id)}` : ""), onclick: (e) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); reveal(s.id); } }, s.label)])));
    }
    out.push(X.foot(model, cx));
    return out;
  }
  metaP.then((m) => { meta.value = m; meta.done = true; }).catch(() => {});

  // the section heading takes the focus and the page scrolls to it (under the sticky bars); a section that is not there leaves the page where it is
  // the printer gets every category open; the reader's own state comes back after it (the same as the category page)
  if (typeof window !== "undefined" && !body.__printHook) {
    body.__printHook = true; let was = null;
    window.addEventListener("beforeprint", () => { was = [...body.querySelectorAll("details.n-home-grp")].map((d) => [d, d.open]); was.forEach(([d]) => { d.open = true; }); });
    window.addEventListener("afterprint", () => { (was || []).forEach(([d, o]) => { d.open = o; }); was = null; });
  }
  function reveal(id) {
    const sec = body.querySelector("#" + id), head = sec && sec.querySelector("h2");
    if (!head) return false;
    sec.querySelectorAll("details.n-home-grp").forEach((d) => { d.open = true; });          // asking for the section means asking for all of its figures
    head.setAttribute("tabindex", "-1");
    head.focus({ preventScroll: true });
    if (typeof head.scrollIntoView === "function") head.scrollIntoView({ block: "start", behavior: smooth() });
    return true;
  }
  // a link to a section (the question field's suggestion, the "see all" links)
  function goSection(id) { reveal(X.SECTION[id]); }
  // which section sent the reader away: the figure's page offers the way back to it (kit/from.js)
  body.addEventListener("click", (e) => {
    const a = e.target && e.target.closest && e.target.closest('a[href*="/i/"]');
    if (!a) return;
    const sec = a.closest("section"), qid = sec && qOf(sec.id);
    if (qid) markFrom(qid, key); else clearFrom();
  });

  const root = h("div.n-home", { "data-kind": kind, "data-level": level }, body);
  body.replaceChildren(...build());
  const qSection = !uncovered && X.SECTION[q];
  const back = typeof history !== "undefined" && history.state && typeof history.state.y === "number";
  if (qSection && !back && typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(() => { try { reveal(qSection); } catch (err) { /* the page was left already */ } }));          // after the router has put the page in place and scrolled it to the top
  return { node: root, band, active: "home", title };
}
