// One domain of a city (DESIGN_V3.md): a navy header with the status ring and where the domain stands, every figure against the nation over the years,
// the figures as rows or as small charts, and the findings and actions that belong to it. View layer only: every number comes from the model.
// A figure on a small group (last.reliable === false) is shown, never ranked, trended, compared or coloured as a verdict (css/pages/domain.css, prefix .dm-).
import { h, icon, num, ltr, outOf, DOMAIN_ICON, STATUS, toneOf, compareLine, countLabel, directionNote, directionIcon, trendInfo, deltaUnit } from "../ui.js";
import { pageHead } from "../components.js";
import { horizonLabel } from "./rec.js";
import { isSmall, nameOf, effStatus, whyLine, figure, sparkFor, bullet, SMALL_NOTE } from "./kpi.js";
import { statusDonut, standingMeter, progressRing } from "../viz/rings.js";
import { heatMatrix } from "../viz/matrix.js";
import { smallMultiples, smallItem } from "../viz/time.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const hrefI = (key, id) => `#/c/${key}/i/${id}`;
const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

// the most urgent first (what needs treatment, by priority), then the calm ones, then what is not judged; an old figure last
const RANK = { concern: 0, watch: 1, good: 2, strength: 3, stale: 4, uncertain: 5, na: 6 };
const byUrgency = (a, b) => (a.stale ? 1 : 0) - (b.stale ? 1 : 0) || (b.priority || 0) - (a.priority || 0) || (RANK[effStatus(a)] ?? 9) - (RANK[effStatus(b)] ?? 9);
// the groups of the filter: the same words as the legend of the ring ("ללא שיפוט" = background, small groups and old figures)
const groupOf = (a) => { const s = effStatus(a); return s === "concern" ? "concern" : s === "watch" ? "watch" : s === "good" || s === "strength" ? "fine" : "bg"; };
const FILTER_OF = { concern: "concern", watch: "watch", good: "fine", strength: "fine", background: "bg" };
const countsOf = (list) => list.reduce((c, a) => { const s = effStatus(a); c[s] = (c[s] || 0) + 1; return c; }, {});

function yearSpan(list) {
  const ys = list.flatMap((a) => (a.series || []).filter((s) => isNum(s.v) && isNum(s.year)).map((s) => s.year));
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
}

// a numbered section: eyebrow with its number, a title, one lead line, an optional link on the far side (the same head as the overview's)
const secHead = (no, eyebrow, title, lead, link) => h("div.sec-head.rv", h("div", h("div.sec-eyebrow", h("b", no), eyebrow), h("h2.sec-title", title), lead ? h("p.sec-lead", lead) : null), link || null);
const seeAll = (href, text) => h("a.sec-link.no-print", { href }, text, icon("left"));
const crumb = (key) => h("a.dm-crumb.no-print", { href: `#/c/${key}` }, icon("right"), "תמונת מצב");

// ── nothing to show: an unknown domain, or one the sources do not cover for this locality ──
function missing(model, d) {
  const key = model.city.key;
  return h("div.dm", crumb(key), pageHead("תחום", d ? d.label : "תחום", [], null),
    h("div.dm-none.rv", icon("info"), h("h2", "אין עדיין נתונים בתחום הזה ליישוב הזה"),
      h("p", d && d.available ? (d.available === 1 ? "בתחום הזה מדד אחד, ואין עליו נתון ביישוב הזה." : ["בתחום הזה ", ltr(String(d.available)), " מדדים, ואין עליהם נתון ביישוב הזה."]) : "אפשר לחזור לתמונת המצב ולבחור תחום אחר."),
      h("a.btn", { href: `#/c/${key}` }, icon("right"), "חזרה לתמונת המצב")));
}

// ── 1. the header ────────────────────────────────────────────────────────
// the counts in words, each in the colour of its status: "מתוך 5 מדדים: 3 דורשים טיפול, 2 למעקב"
function countsLine(all, total) {
  const n = (k) => all[k] || 0, fine = n("good") + n("strength"), bg = total - n("concern") - n("watch") - fine;
  if (total === 1) {
    const st = STATUS[Object.keys(all)[0]] || STATUS.na;
    return h("p.dm-verdict.rv", "המדד היחיד בתחום: ", h("span.dm-cnt.tone-" + st.tone, st.label));
  }
  const part = (tone, k, word) => h("span.dm-cnt.tone-" + tone, h("b", ltr(String(k))), " ", word);
  const parts = [n("concern") > 0 && part("attn", n("concern"), countLabel("concern", n("concern"))),
    n("watch") > 0 && part("watch", n("watch"), countLabel("watch", n("watch"))),
    fine > 0 && part("good", fine, n("good") && n("strength") ? "תקינים או חוזקות" : n("strength") ? countLabel("strength", fine) : countLabel("good", fine)),
    bg > 0 && part("none", bg, "ללא שיפוט")].filter(Boolean);
  return h("p.dm-verdict.rv", ["מתוך ", ltr(String(total)), " מדדים: "], parts.flatMap((p, i) => (i ? [", ", p] : [p])), ".");
}

// nothing here is judged as good or bad: say so calmly, and why
function calmNote(all) {
  const t = all.uncertain ? "במדדים בתחום הזה הקבוצות קטנות מדי, ולכן אף אחד מהם לא נשפט כטוב או רע. הנתונים מוצגים כפי שהם, בלי דירוג, מגמה או המלצה."
    : all.stale ? "הנתון האחרון במדדי התחום ישן, ולכן הוא אינו משפיע על המסקנות."
    : "המדדים בתחום הזה מתארים את העיר ואינם נשפטים כטוב או רע. הם משמשים לקריאת שאר המדדים.";
  return h("p.dm-note.rv", icon("info"), t);
}

// with nothing judged the header shows the figures themselves: the biggest numerals of the domain, each with its history
function heroFigs(key, list) {
  const pick = list.filter((a) => !isSmall(a) && isNum(a.last.v)).sort((x, y) => (y.importance || 0) - (x.importance || 0)).slice(0, 3);
  if (!pick.length) return null;
  return h("div.hero-visual.dm-vis", h("ul.dm-hf", pick.map((a) => {
    const spark = sparkFor(a, 120, 40);
    return h("li.rv", h("a.dm-hf-i", { href: hrefI(key, a.id) }, h("span.dm-hf-t", h("span.dm-hf-l", nameOf(a), h("small", [" · ", ltr(String(a.last.year))])), figure(a)), spark ? h("span.dm-hf-s", spark) : null));
  })));
}

function hero(model, d, list, all, judged, onPick, rec) {
  const key = model.city.key, span = yearSpan(list), fact = (label, value) => h("div.hero-fact", h("small", label), h("b", value));
  const facts = [fact("מדדים בתחום", d.available > list.length ? outOf(list.length, d.available) : ltr(String(list.length))),
    span && fact("שנות נתונים", ltr(span[0] === span[1] ? String(span[0]) : span[0] + "–" + span[1]))].filter(Boolean);
  const main = h("div.dm-main", crumb(key),
    h("div.dm-titlerow.rv", h("span.dm-ico", { "aria-hidden": "true" }, icon(DOMAIN_ICON[d.id] || "bars")), h("div", h("div.eyebrow", "תחום"), h("h1", d.label))),
    d.blurb ? h("p.lede.rv", d.blurb) : null,
    h("div.hero-meta.rv", facts),
    judged ? countsLine(all, list.length) : calmNote(all),
    rec ? h("a.dm-act.rv.no-print", { href: location.hash || "#", onclick: (e) => { e.preventDefault(); const t = document.getElementById("dm-recs"); if (t) t.scrollIntoView({ behavior: smooth(), block: "start" }); } },
      h("span.dm-act-k", "הצעד הראשון המומלץ"), h("span.dm-act-t", rec.title, icon("left"))) : null);
  let vis = null;
  if (judged) {
    vis = h("div.hero-visual.dm-vis", h("div.dm-ring.rv", statusDonut({ counts: all, size: 170, onPick }), h("p.dm-ring-hint.no-print", "לחצו על סטטוס כדי לסנן את המדדים")));
    if (isNum(d.standing)) vis.append(h("div.dm-stand.rv", standingMeter({ level: d.standing, label: "איפה התחום עומד בין היישובים" }), h("p.dm-stand-cap", ["התחום טוב יותר מ-", ltr(num(d.standing, 0) + "%"), " מהיישובים. זה ממוצע המדדים בתחום, מול כל היישובים בארץ."])));
  } else vis = heroFigs(key, list) || h("div.hero-visual.dm-vis", h("span.dm-bigico.rv", { "aria-hidden": "true" }, icon(DOMAIN_ICON[d.id] || "bars")));
  return h("section.hero.dm-hero", h("div.hero-grid", main, vis));
}

// ── 2. the years: every figure against the national mean ─────────────────
function directionKey(rows) {
  const by = new Map();
  rows.forEach((r) => { const k = r.direction || "none"; if (!by.has(k)) by.set(k, []); by.get(k).push(r.label); });
  const lines = ["higher", "lower", "none"].filter((k) => by.has(k));
  return h("ul.dm-dirs.rv", { "aria-label": "כיוון הקריאה של כל מדד" }, lines.map((k) => h("li", icon(directionIcon(k === "none" ? null : k)), h("span", h("b", directionNote(k === "none" ? null : k)), h("span.dm-dir-n", by.get(k).map((n) => h("span.nw", n)).flatMap((n, i) => (i ? [" · ", n] : [n])))))));
}
function matrixSec(key, list, seq) {
  const rows = list.map((a) => ({ id: a.id, label: nameOf(a), href: hrefI(key, a.id), unit: a.unit, direction: a.direction || null,
    cells: (a.series || []).filter((s) => isNum(s.v) && isNum(s.year)).map((s) => ({ year: s.year, v: s.v, ref: !isSmall(a) && isNum(s.nat) ? s.nat : null, reliable: !isSmall(a) })) })).filter((r) => r.cells.length);
  const years = [...new Set(rows.flatMap((r) => r.cells.map((c) => c.year)))];
  if (!rows.length || years.length < 2 || rows.every((r) => r.cells.every((c) => c.reliable === false))) return null;
  const judged = rows.some((r) => r.direction), plain = rows.some((r) => !r.direction);
  const lead = (judged ? "כל שורה היא מדד וכל עמודה שנה. הצבע מראה אם היישוב היה טוב או חלש מהממוצע הארצי באותה שנה, וככל שהוא חזק יותר הפער גדול יותר מאשר בשנים האחרות של אותו מדד."
    : "כל שורה היא מדד וכל עמודה שנה. אלה מדדים שמתארים את העיר, ולכן הצבע אינו טוב או רע: הוא מראה רק אם הערך גבוה או נמוך ביחס לשנים האחרות של אותו מדד.")
    + (judged && plain ? " במדדים שמתארים את העיר בלבד הצבע מראה רק גבוה או נמוך." : "") + (list.some(isSmall) ? " מדד בקבוצה קטנה מצויר חלול, בלי השוואה." : "");
  // a row of a small group has no coloured cell, so the key of the plain scale must not appear for it alone
  const scaleUsed = rows.some((r) => (!r.direction || !r.cells.some((c) => c.reliable !== false && isNum(c.ref))) && r.cells.some((c) => c.reliable !== false));
  const chart = h("div.plot.dm-mx.rv" + (scaleUsed ? "" : ".no-scale"), directionKey(rows), heatMatrix({ rows, years, ariaLabel: `מפת חום של ${rows.length === 1 ? "מדד אחד" : rows.length + " מדדים"}, ${years[0]} עד ${years[years.length - 1]}` })), mv = movesEl(list, key);
  return h("section.sec", { id: "dm-years" }, secHead(seq(), "לאורך השנים", "איך המדדים השתנו לאורך השנים", lead), mv ? h("div.split.dm-mxsplit", chart, mv) : chart);
}

// what moved, in words, next to the matrix: the figures whose trend the model judged (improving, worsening), the ones that only rose or fell, and the rest in one line each.
// A small group is never trended, and a figure with fewer than three years has no trend to speak of.
function movesEl(list, key) {
  const g = { good: [], attn: [], plain: [] }, flat = [], few = [];
  for (const a of list) {
    if (isSmall(a) || a.stale) continue;
    const t = trendInfo(a);
    if (!t) { few.push(a); continue; }
    if (t.ic === "minus") flat.push(a); else g[t.tone === "good" ? "good" : t.tone === "attn" ? "attn" : "plain"].push([a, t]);
  }
  const how = ([a, t]) => {
    const first = a.history && a.history.first ? a.history.first.year : null;
    return [t.delta != null && t.delta !== 0 ? [t.delta > 0 ? "עלייה" : "ירידה", " של ", ltr(num(Math.abs(t.delta), 1)), deltaUnit(a.unit)] : t.word, first ? [" מאז ", ltr(String(first))] : null];
  };
  const group = (title, items) => items.length ? h("div.dm-mv", h("h3.dm-mv-h", title),
    h("ul", items.map((it) => h("li", h("a.dm-mv-n", { href: hrefI(key, it[0].id) }, nameOf(it[0])), h("span.dm-mv-d.tone-" + it[1].tone, icon(it[1].ic), h("span", how(it))))))) : null;
  const names = (arr) => h("ul.dm-names", arr.map((a) => h("li", h("a.nw", { href: hrefI(key, a.id) }, nameOf(a)))));
  const blocks = [group("בשיפור", g.good), group("בהידרדרות", g.attn), group("עלו או ירדו, בלי טוב או רע", g.plain)].filter(Boolean);
  if (!blocks.length && !flat.length) return null;
  return h("div.dm-moves.rv", h("h3.plot-title", "מה זז לאורך השנים"), ...blocks,
    flat.length ? h("div.dm-mv", h("h3.dm-mv-h", "יציבים"), names(flat)) : null,
    few.length ? h("div.dm-mv", h("h3.dm-mv-h", "פחות משלוש שנות נתונים"), h("p.dm-mv-f", "לכן בלי הערכת מגמה."), names(few)) : null);
}

// ── 3. the figures: rows or small charts ─────────────────────────────────
// one row: the name and what it measures, the status with its reason, the big value, the history against the nation, the comparison and, with a target, a thin bar
function figRow(a, key, first) {
  const L = a.last, small = isSmall(a), st = effStatus(a), sub = a.short && a.short !== a.label, cmp = compareLine(a);
  const spark = small ? null : sparkFor(a, 168, 42);
  const rank = !small && a.direction && isNum(L.rank) && isNum(L.of) ? h("span.dm-rk", ["מקום ", ...outOf(L.rank, L.of)]) : null;
  const vz = small ? [isNum(L.d) ? h("p.dm-small", "גודל הקבוצה: ", ltr(num(L.d, 0))) : null]
    : [spark ? h("div.dm-spark", spark) : h("p.dm-small", "נתון לשנה אחת בלבד"), h("span.dm-cmp.tone-" + cmp.tone, icon(cmp.ic), cmp.text), isNum(L.target) ? bullet(a) : null];
  const nameEl = h("h3.dm-name", { id: "dm-n-" + a.id }, nameOf(a)), why = whyLine(a, "dm-why", { brief: true });
  why.id = "dm-w-" + a.id;
  return h("a.row-item.dm-row.rv." + toneOf(st) + (a.stale ? ".is-stale" : "") + (small ? ".is-small" : ""), { href: hrefI(key, a.id), "aria-labelledby": nameEl.id, "aria-describedby": why.id },
    h("div.dm-rmain", nameEl, sub ? h("p.dm-full", a.label) : null, why, small || st === "na" ? null : h("p.dm-dirnote", icon(directionIcon(a.direction)), directionNote(a.direction))),
    h("div.dm-val", figure(a, { count: first }), h("span.dm-yr", ltr(String(L.year))), rank),
    h("div.dm-viz", vz),
    h("span.dm-go", { "aria-hidden": "true" }, icon("left")));
}

// small multiples of the same figures; a small group keeps its number and says why it has no history, no change and no verdict
function chartsEl(items, key) {
  const ul = smallMultiples({ items: items.map((a) => smallItem(a, hrefI(key, a.id))), cols: 3, ariaLabel: "היסטוריית המדדים בתחום, לפי שנה" });
  items.forEach((a, i) => {
    const li = ul.children[i], cell = li && li.firstElementChild;
    if (!cell) return;
    if (isSmall(a)) {
      ["v-time-sm-spark", "v-time-sm-foot", "v-time-sm-delta"].forEach((c) => { const el = cell.querySelector("." + c); if (el) el.remove(); });
      cell.setAttribute("aria-label", `${nameOf(a)}, ${SMALL_NOTE}`);
    }
    cell.append(whyLine(a, "dm-sm-why", { brief: true }));
  });
  return ul;
}

function figuresSec(key, list, all, seq, api) {
  const state = { f: "all", v: "rows", first: true }, n = { concern: 0, watch: 0, fine: 0, bg: 0 };
  list.forEach((a) => { n[groupOf(a)]++; });
  const fineWord = (all.good && all.strength) ? "תקינים וחוזקות" : all.strength ? countLabel("strength", all.strength) : countLabel("good", all.good || 0);
  const groups = [["all", "הכל", list.length], ["concern", countLabel("concern", n.concern), n.concern], ["watch", countLabel("watch", n.watch), n.watch], ["fine", fineWord, n.fine], ["bg", "ללא שיפוט", n.bg]].filter(([k, , c]) => k === "all" || c > 0);
  const host = h("div.dm-figs"), live = h("p.sr", { role: "status" });
  const tabs = groups.length > 2 ? h("div.dm-tabs", { role: "group", "aria-label": "סינון המדדים לפי מצב" },
    groups.map(([k, label, c]) => h("button.chip.dm-tab", { type: "button", "aria-pressed": String(k === state.f), "data-f": k, onclick: () => setFilter(k) }, label, h("span.dm-tab-n", ltr(String(c)))))) : null;
  const views = list.length > 1 ? h("div.dm-views.no-print", { role: "group", "aria-label": "אופן התצוגה" },
    [["rows", "list", "שורות"], ["charts", "bars", "גרפים"]].map(([k, ic, label]) => h("button.chip.dm-vbtn", { type: "button", "aria-pressed": String(k === state.v), "data-v": k, onclick: () => setView(k) }, icon(ic), label))) : null;
  const bar = tabs || views ? h("div.dm-bar.no-print.rv", tabs || h("span"), views) : null;

  function paint() {
    const items = list.filter((a) => state.f === "all" || groupOf(a) === state.f);
    host.replaceChildren(state.v === "rows" ? h("div.rowlist.dm-rows", items.map((a) => figRow(a, key, state.first))) : chartsEl(items, key));
    state.first = false;
    live.textContent = items.length === 1 ? "מוצג מדד אחד" : `מוצגים ${items.length} מדדים`;
  }
  function setFilter(f) {
    if (!groups.some(([k]) => k === f)) f = "all";
    state.f = f;
    if (tabs) tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === f)));
    paint();
  }
  function setView(v) {
    state.v = v;
    if (views) views.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
    paint();
  }
  paint();
  const el = h("section.sec", { id: "dm-figs" }, secHead(seq(), "המדדים", "כל המדדים בתחום", "לחיצה על מדד פותחת את ההיסטוריה שלו, את ההשוואות ואת המקור המדויק של הנתון."), bar, host, live);
  // the notes that apply to the whole list, said once
  const notes = [list.some((a) => a.unit === "%" && !isSmall(a)) ? "נק׳ = נקודות אחוז: ההפרש בין שני אחוזים." : null, list.some(isSmall) ? "מדד בקבוצה קטנה מוצג בלי דירוג, מגמה או השוואה." : null,
    all.na && all.na < list.length ? "מדד רקע מתאר את העיר ואינו נשפט כטוב או רע." : null].filter(Boolean);
  if (notes.length) el.append(h("p.dm-foot.rv", icon("info"), notes.join(" ")));
  api.pick = (status) => { setFilter(FILTER_OF[status] || "all"); el.scrollIntoView({ behavior: smooth(), block: "start" }); };
  return el;
}

// ── 4. findings and actions ──────────────────────────────────────────────
// A finding that only repeats what the row, the status reason or the verdict already say is not shown as news. One line per figure, the ones the rows do not
// carry first (a gap between groups, a gap that widens or closes); the rest of the lines wait behind a disclosure.
const ECHO = new Set(["level_low", "level_high", "below_target", "meets_target", "trend_down", "trend_up", "domain_weak"]);
const novelty = (f) => (ECHO.has(f.type) ? 0 : 1000) + (f.severity || 0);
function digest(fs) {
  const by = new Map();
  for (const f of fs) {
    if (f.type === "domain_weak") continue;
    const k = f.indicator || f.id, cur = by.get(k);
    if (!cur || novelty(f) > novelty(cur)) by.set(k, f);
  }
  return [...by.values()].sort((a, b) => novelty(b) - novelty(a));
}
function findItem(f, key, lead) {
  const m = /^([^:]{2,90}): ([\s\S]+)$/.exec(f.text || ""), head = m ? m[1] : null, body = m ? m[2] : f.text;
  const tone = f.polarity === "strength" ? "good" : "attn";
  return h("li.dm-f" + (lead ? ".is-lead" : "") + ".tone-" + tone,
    lead ? h("span.dm-f-ic", { "aria-hidden": "true" }, icon(f.polarity === "strength" ? "star" : "alert")) : null,
    h("div.dm-f-in", head ? h("small.dm-f-h", head) : null, h("p.dm-f-b", body, f.indicator && key ? [" ", h("a.dm-f-a", { href: hrefI(key, f.indicator) }, "לפרטים")] : null)));
}
function findingsSec(model, domainId, seq) {
  const fs = digest(model.findings.filter((f) => f.domain === domainId && f.polarity !== "info"));
  if (!fs.length) return null;
  const key = model.city.key, shown = fs.slice(0, 4), more = fs.slice(4, 12);
  return h("section.sec", { id: "dm-finds" }, secHead(seq(), "ממצאים", "מה עולה מהנתונים", "מה שהמערכת מצאה בנתוני התחום, בלי לחזור על מה שכבר כתוב בשורות."),
    h("div.dm-finds.rv", h("ul.dm-fl", shown.map((f, i) => findItem(f, key, i === 0))),
      more.length ? h("details.dm-more", h("summary", more.length === 1 ? "עוד ממצא אחד" : ["עוד ", ltr(String(more.length)), " ממצאים"]), h("ul.dm-fl", more.map((f) => findItem(f, key, false)))) : null));
}

function recsSec(model, domainId, seq) {
  const key = model.city.key, rs = (model.recommendations || []).filter((r) => r.domain === domainId);
  if (!rs.length) return null;
  return h("section.sec", { id: "dm-recs" }, secHead(seq(), "פעולות", "מה כדאי לעשות בתחום", "הצעדים והראיות המלאים נמצאים בתוכנית הפעולה.", seeAll(`#/c/${key}/actions`, "לכל ההמלצות")),
    h("div.rowlist.dm-recs.rv", rs.slice(0, 3).map((r, i) => h("a.row-item.dm-rec", { href: `#/c/${key}/actions` },
      h("div.dm-score", progressRing({ value: r.score, tone: "none", size: 58, i, label: "ציון עדיפות" }), h("small", "עדיפות")),
      h("div.dm-rec-main", h("h3.dm-rec-t", r.title), r.actions && r.actions[0] ? h("p.dm-rec-s", h("b", "צעד ראשון: "), r.actions[0]) : null),
      h("span.dm-hz", icon("clock"), horizonLabel[r.horizon] || r.horizon),
      h("span.dm-go", { "aria-hidden": "true" }, icon("left"))))));
}

// ── the page ─────────────────────────────────────────────────────────────
export function domainView(model, domainId) {
  const key = model.city.key, d = model.domains.find((x) => x.id === domainId);
  if (!d) return missing(model, null);
  const list = model.indicators.filter((a) => a.domain === domainId && a.last).sort(byUrgency);
  if (!list.length) return missing(model, d);
  const all = countsOf(list), judged = ["concern", "watch", "good", "strength"].some((k) => all[k] > 0), api = { pick: () => {} };
  const root = h("div.dm");
  let no = 0;
  const seq = () => String(++no).padStart(2, "0");
  const rec = (model.recommendations || []).find((r) => r.domain === domainId && r.title);
  root.append(hero(model, d, list, all, judged, (st) => api.pick(st), rec));
  // what to do comes before what the system found: the findings explain, the actions are what a reader came for
  [matrixSec(key, list, seq), figuresSec(key, list, all, seq, api), recsSec(model, domainId, seq), findingsSec(model, domainId, seq)].forEach((s) => { if (s) root.append(s); });
  return root;
}
