// One domain (SPEC 5.4): the old domain page on the pale band. The crumb becomes the back link, the header gets the row of actions (share, the domain as a CSV file, print, report a mistake),
// the ring is as wide as the css says (smaller on a phone). Every sentence and every number is the old page's own; nothing is fetched here.
// The figures are sorted into topics (city/groups.js TOPICS): one closed group per topic with a summary row (name, one sentence, a short bar), the topic that needs the most
// attention open. The rows are the old page's own nodes, moved into the groups; when the old page draws its list again (a filter, the charts view) the groups are made again.
import { h, icon, STATUS } from "../../ui.js";
import { actionsRow } from "../kit/actions.js";
import { catArt } from "../kit/catart.js";
import * as D from "../city/data.js";
import * as G from "../city/groups.js";
import * as T from "../kit/guide.js";
import { neutral } from "../neutral.js";

const RING = "var(--n-pg-domain-ring)";

// the CSV of the domain: one row per measured figure, in the words of the page (the name of a figure as the page says it: neutral.js, no Latin vaccine code)
export function domainRows(model, domainId) {
  const list = model.indicators.filter((a) => a.domain === domainId && a.last), calm = (a) => D.isCalmFigure(model, a);          // a background figure of a very small town has no national value and no place
  const columns = [{ title: "מדד", get: (a) => neutral(a.label) }, { title: "יחידה", get: (a) => a.unit }, { title: "ערך", get: (a) => a.last.v }, { title: "שנה", get: (a) => a.last.year },
    { title: "מצב", get: (a) => (a.last.reliable === false ? "קבוצה קטנה" : (STATUS[a.status] || {}).label || "") }, { title: "ארצי", get: (a) => (calm(a) || a.last.nat == null ? "" : a.last.nat) },
    { title: "מקום", get: (a) => (calm(a) || a.last.reliable === false || a.last.rank == null ? "" : a.last.rank) }, { title: "מתוך", get: (a) => (calm(a) || a.last.reliable === false || a.last.of == null ? "" : a.last.of) }];
  return { rows: list, columns };
}

// a background figure of a very small town (city/data.js isCalmFigure) is shown as it is: the line against the nation and the national line of its small chart are replaced by one plain sentence
function noComparison(node, model) {
  const byId = new Map(model.indicators.map((a) => [a.id, a]));
  node.querySelectorAll("a").forEach((link) => {
    const m = /\/i\/([^/?#]+)$/.exec(link.getAttribute("href") || ""), a = m && byId.get(decodeURIComponent(m[1]));
    if (!a || !D.isCalmFigure(model, a)) return;
    link.querySelectorAll(".v-time-spark-nat").forEach((line) => line.remove());
    const cmp = link.querySelector(".dm-cmp");
    if (cmp) cmp.replaceWith(h("span.dm-cmp.tone-none.n-pg-domain-nocmp", D.NO_COMPARISON));
  });
}

// ── the status line of a row and the official target of its figure ──
// The rows are the old page's nodes; what is added to each one is decided by the figure its link names, once (a row the old page draws again gets it again).
// 1. A figure that needs treatment or follow-up says why in the words of the town page (city/data.js causeOf: one function for both pages), in place of the old sentence.
// 2. A figure with a judging target says it under its status: "יעד רשמי: לפחות 80% · רחוק מהיעד" (city/data.js tgtSegs; kit/guide.js rowTarget; the row's own bar already marks the target).
//    A met target is said once on the row: the old reason loses its own "עומד ביעד משרד הבריאות".
const MET_IN_REASON = /,\s*עומד ביעד (?:משרד הבריאות|הרשמי)/;          // the old sentence, or the same after neutral.js swapped its words
function sayCause(why, a, t) {
  if (!why || why.dataset.nCause) return;
  why.dataset.nCause = "1";
  const cause = D.causeOf(a);
  if (cause) {
    const kids = [...why.childNodes], pill = why.querySelector(".pill"), at = pill ? kids.indexOf(pill) : -1;
    if (at >= 0) kids.slice(at + 1).forEach((n) => n.remove());
    why.append(" ", ...cause.map((s) => (typeof s === "string" ? s : h("span.ltr", s.n))));
  } else if (t && t.state === "meets") [...why.childNodes].forEach((n) => { if (n.nodeType === 3 && MET_IN_REASON.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(MET_IN_REASON, ""); });
}
export function targetLines(root, model) {
  const byId = new Map(model.indicators.map((a) => [a.id, a])), figure = (href) => { const m = ID_IN_HREF.exec(href || ""); return m ? byId.get(decodeURIComponent(m[1])) : null; };
  root.querySelectorAll("a.dm-row").forEach((row) => {
    if (row.querySelector(".n-pg-domain-tgt")) return;
    const a = figure(row.getAttribute("href")), t = a && T.rowTarget(a), main = a && row.querySelector(".dm-rmain");
    if (!main) return;
    const why = main.querySelector(".dm-why");
    sayCause(why, a, t);
    if (!t) return;
    const line = h("p.n-pg-domain-tgt.is-" + t.state, D.tgtSegs(t).map((x) => (typeof x === "string" ? x : x.b ? h("b.n-pg-domain-tgt-w", x.b) : h("span.n-pg-domain-tgt-aside", x.aside))));
    if (why) why.after(line); else main.append(line);
  });
  // the small charts of the charts view: the same words under the status
  root.querySelectorAll(".dm-sm-why").forEach((why) => {
    const link = why.closest ? why.closest("a[href]") : null, a = link && figure(link.getAttribute("href"));
    if (a) sayCause(why, a, T.rowTarget(a));
  });
}

// ── the figures in topics ──
const ID_IN_HREF = /\/i\/([^/?#]+)$/;
// the figure that a row (the link itself) or a small chart (a list item with a link inside) is about
const idOfItem = (el) => { const link = el.tagName === "A" ? el : el.querySelector("a"), m = link && ID_IN_HREF.exec(link.getAttribute("href") || ""); return m ? decodeURIComponent(m[1]) : null; };
// an empty list of the same kind as the one the old page drew (the rows list or the small charts), to hold the figures of one topic
function shellOf(box) {
  const el = h(box.tagName.toLowerCase() + String(box.className).split(/\s+/).filter(Boolean).map((c) => "." + c).join(""));
  ["style", "aria-label"].forEach((k) => { const v = box.getAttribute(k); if (v != null) el.setAttribute(k, v); });
  if (el.classList.contains("viz")) { el.classList.add("in"); el.dataset.seen = "1"; }          // a chart list made here has nothing to wait for: it is drawn as it is
  return el;
}
const segNodes = (say) => say.map((s) => (typeof s === "string" ? s : h("b.n-pg-domain-n.ltr" + (s.tone ? ".t-" + s.tone : ""), s.n)));
// the short bar of a topic: the figures of the ring's four groups side by side, a figure that is not judged as a hollow segment
function barOf(c) {
  const parts = [["concern", c.concern], ["watch", c.watch], ["good", c.fine], ["none", c.unjudged]].filter(([, n]) => n > 0);
  return h("span.n-pg-domain-bar", { "aria-hidden": "true" }, parts.map(([k, n]) => h("i.n-pg-domain-seg.is-" + k, { style: { flexGrow: n } })));
}
const TXT = { open: "פתיחת הכול", close: "סגירת הכול", opened: "כל הנושאים נפתחו", closed: "כל הנושאים נסגרו",
  order: "הנושאים מסודרים לפי מה שדורש יותר תשומת לב.", group: "המדדים מקובצים לפי נושא." };

// Builds the groups inside `host` (the old page's list of figures) and builds them again whenever the old page draws its list again.
// ctx: { filtered(): a status filter is on (every group that has a figure is then open), announce(text), signal }. Returns what the tests and the print handler need.
export function groupFigures(host, model, domainId, ctx = {}) {
  const { topics } = G.topicsFor(model, domainId);
  if (!host || !topics.length) return null;
  const topicOf = new Map(topics.flatMap((t) => t.ids.map((id) => [id, t.id]))), filtered = () => !!(ctx.filtered && ctx.filtered()), small = D.isVerySmallTown(model);
  const state = new Map();                                                    // topic id -> open, as the reader left it (not recorded while a filter or the printer opens everything)
  let root = null, printing = false, btn = null;
  const groups = () => (root ? [...root.querySelectorAll("details.n-pg-domain-group")] : []);
  const sync = () => {
    if (!btn) return;
    const all = groups(), every = all.length > 0 && all.every((d) => d.open);
    btn.setAttribute("aria-expanded", String(every));
    btn.textContent = every ? TXT.close : TXT.open;
  };
  function setAll(want, say) {
    groups().forEach((d) => { d.open = want; });
    sync();
    if (say && ctx.announce) ctx.announce(want ? TXT.opened : TXT.closed);
  }
  function groupEl(t, open) {
    const c = t.counts, body = h("div.n-pg-domain-body"), chev = icon("down", 20);
    chev.classList.add("n-pg-domain-chev");
    const d = h("details.n-pg-domain-group#n-pg-domain-g-" + t.id, { "data-topic": t.id, "data-total": c.total, "data-concern": c.concern, "data-watch": c.watch, "data-fine": c.fine, "data-small": c.small, "data-stale": c.stale, "data-unjudged": c.unjudged },
      h("summary.n-pg-domain-sum", chev, h("span.n-pg-domain-id", h("span.n-pg-domain-name", t.label), h("span.n-pg-domain-say", segNodes(t.say))), barOf(c)), body);
    d.open = !!open;
    d.addEventListener("toggle", () => { if (!printing && !filtered()) state.set(t.id, d.open); sync(); });
    return { d, body };
  }
  function regroup() {
    if (host.children.length !== 1) return;
    const box = host.children[0];
    if (box.classList.contains("n-pg-domain-groups")) return;                // already made
    if (small) noComparison(box, model);                                      // a list that the old page drew again has the national lines again
    const by = new Map(), loose = [];
    [...box.children].forEach((el) => { const t = topicOf.get(idOfItem(el)); if (t) by.set(t, (by.get(t) || []).concat(el)); else loose.push(el); });
    const shown = topics.filter((t) => by.has(t.id));
    if (!shown.length) return;
    const all = filtered();
    root = h("div.n-pg-domain-groups");
    if (shown.length > 1) {
      btn = h("button.n-pg-domain-all", { type: "button", "aria-expanded": "false", onclick: () => setAll(!groups().every((d) => d.open), true) }, TXT.open);
      root.append(h("div.n-pg-domain-head", h("p.n-pg-domain-order", topics.some((t) => t.counts.judged) ? TXT.order : TXT.group), btn));
    } else btn = null;
    shown.forEach((t) => {
      const g = groupEl(t, all || (state.has(t.id) ? state.get(t.id) : t.id === topics[0].id)), list = shellOf(box);          // a list of the same kind as the old page's own holds the rows of the topic
      by.get(t.id).forEach((el) => list.append(el));
      g.body.append(list);
      root.append(g.d);
    });
    if (loose.length) { const list = shellOf(box); loose.forEach((el) => list.append(el)); root.append(list); }
    host.replaceChildren(root);
    sync();
  }
  regroup();
  return { regroup, root: () => root, groups, setAll, state, print(on) { printing = on; if (on) groups().forEach((d) => { d.dataset.was = d.open ? "1" : "0"; d.open = true; }); else groups().forEach((d) => { d.open = d.dataset.was !== "0"; }); sync(); } };
}

// the old page draws its list again for a filter or for the charts view: the groups are made again. A printed page has every group open, and the reader's own state comes back after it.
function watchFigures(api, host, ctx) {
  const opt = ctx.signal ? { signal: ctx.signal } : undefined;
  if (typeof MutationObserver === "function") {
    const mo = new MutationObserver(() => api.regroup());
    mo.observe(host, { childList: true });
    if (ctx.signal) ctx.signal.addEventListener("abort", () => mo.disconnect());
  }
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("beforeprint", () => api.print(true), opt);
    window.addEventListener("afterprint", () => api.print(false), opt);
  }
}

export function adapt(node, ctx) {
  const hero = node.querySelector(".dm-hero");
  if (!hero) {                                              // a domain with no figures: the generic title zone already says the domain and the way back, so the old heading and crumb are not repeated
    node.querySelectorAll(".dm-crumb, .pagehead").forEach((el) => el.remove());
    return node;
  }
  const { model } = ctx, key = model.city.key, domainId = ctx.parts[3];
  if (D.isVerySmallTown(model)) noComparison(node, model);
  const crumb = hero.querySelector(".dm-crumb");
  if (crumb) crumb.replaceWith(h("a.n-band-back.n-pg-domain-back.no-print", { href: `#/c/${encodeURIComponent(key)}` }, icon("right", 16), "דף היישוב"));
  const fig = hero.querySelector(".dm-ring .v-ring-fig");
  if (fig) fig.style.width = RING;
  // the round line icon of the old header (a smile for the children) becomes the badge of the category, the same picture as in the menu and on the town page
  const badge = catArt(domainId, 96, "n-pg-domain-cat"), ico = hero.querySelector(".dm-ico");
  if (badge && ico) { ico.classList.add("n-pg-domain-art"); ico.replaceChildren(badge); }
  // the background of the town is not a category of the menu: it says so in its eyebrow and in the heading of its list
  if ((model.domains.find((d) => d.id === domainId) || {}).background) {
    const eyebrow = hero.querySelector(".eyebrow"); if (eyebrow) eyebrow.textContent = "רקע";
    node.querySelectorAll("#dm-figs .sec-title").forEach((t) => { t.textContent = "כל מדדי הרקע"; });
  }
  // the figures come right after the header, sorted into topics; the chart of the years, which shows the same figures over time, follows them (the numbers of the sections are made again)
  const figs = node.querySelector("#dm-figs"), host = figs && figs.querySelector(".dm-figs");
  if (figs && host) {
    hero.after(figs);
    node.querySelectorAll(".sec-eyebrow b").forEach((b, i) => { b.textContent = String(i + 1).padStart(2, "0"); });
    const filtered = () => [...figs.querySelectorAll(".dm-tab")].some((b) => b.getAttribute("aria-pressed") === "true" && b.getAttribute("data-f") !== "all");
    targetLines(host, model);
    if (typeof MutationObserver === "function") {          // the old page draws its list again for a filter: the lines come back with the rows
      const mo = new MutationObserver(() => targetLines(host, model));
      mo.observe(host, { childList: true });
      if (ctx.signal) ctx.signal.addEventListener("abort", () => mo.disconnect());
    }
    const api = groupFigures(host, model, domainId, { filtered, announce: ctx.announce, signal: ctx.signal });
    if (api) watchFigures(api, host, ctx);
  }

  const row = actionsRow({ variant: "hero", items: ["share", "download", "print", "report"], key, icons: true, label: "פעולות בדף התחום",
    title: (hero.querySelector("h1") || {}).textContent, shareHref: () => location.href,
    download: { getRows: () => domainRows(model, domainId), name: "domain-" + domainId },
    feedback: () => ({ key, name: model.city.name, dataDate: model.builtAt }) });
  const meta = hero.querySelector(".hero-meta");
  (meta || hero.querySelector(".dm-main")).after(h("div.n-pg-domain-actions.no-print", row));
  return node;
}
