// Trends and history (DESIGN_V3.md): how every figure of the locality moved over the years.
// 1 a hero whose three big numbers count the figures that worsen, improve and hold (one dot per figure), 2 the figures grouped by direction as small
// multiples (the worsening ones first, three at a time), 3 one heat map of every figure against the national mean, year by year, 4 the figures that cannot be given a trend, with the
// reason, 5 what to know before concluding. The view layer only: every number and sentence comes from the model (css/pages/trends.css, prefix .tr-).
import { h, svg, icon, ltr, outOf, fmtVal, unitSuffix, statusReason, DOMAIN_ICON, directionNote, directionIcon } from "../ui.js";
import { viz } from "../viz/core.js";
import { heatMatrix } from "../viz/matrix.js";
import { smallMultiples, smallItem } from "../viz/time.js";

const N = (n) => ltr(String(n));
const hrefI = (key, id) => `#/c/${key}/i/${id}`;
const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const jumpTo = (root, id) => { const el = root.querySelector("#" + id); if (el) el.scrollIntoView({ behavior: smooth(), block: "start" }); };
const CAP = 3;                                                               // a group shows this many figures (one row) before "show all"
const dirShort = (d) => (d === "higher" ? "גבוה = טוב" : d === "lower" ? "נמוך = טוב" : "מתאר בלבד");   // the short form; the whole sentence (directionNote) is the tooltip and the key at the head of the section

// ── what kind of movement a figure has ───────────────────────────────────
// worsening / improving / stable come from history.trendClass (3 years or more, a group big enough to count); rising / falling belong to figures that only
// describe the locality (no good or bad); the rest have no trend and the reason is kept: a small group, an old last figure, two years only, one point only.
export function trendKind(a) {
  const S = (a && a.series) || [], c = a && a.history ? a.history.trendClass : null;
  if (S.length < 2) return "single";
  if (a.last && a.last.reliable === false) return "small";
  if (a.stale) return "stale";
  if (S.length < 3) return "short";
  if (c === "worsening" || c === "improving" || c === "stable") return c;
  if (c === "rising" || c === "falling") return "describing";
  return "unclear";
}
export function groupByKind(list) {
  const by = { worsening: [], improving: [], stable: [], describing: [], small: [], stale: [], short: [], unclear: [], single: [] };
  for (const a of list) by[trendKind(a)].push(a);
  return by;
}
// the heat map's order inside a domain: the worst movement first, the figures that have no trend last
const KIND_RANK = { worsening: 0, stable: 1, describing: 2, improving: 3, short: 4, unclear: 5, small: 6, stale: 7 };
const byWorst = (x, y) => (KIND_RANK[trendKind(x)] - KIND_RANK[trendKind(y)]) || ((y.priority || 0) - (x.priority || 0)) || ((y.importance || 0) - (x.importance || 0)) || x.label.localeCompare(y.label, "he");
const byPressing = (x, y) => ((y.priority || 0) - (x.priority || 0)) || ((y.importance || 0) - (x.importance || 0)) || x.label.localeCompare(y.label, "he");

// one plain sentence about the balance between the figures that worsen and those that improve
export function balanceLine(w, i) {
  const worse = (n) => (n === 1 ? ["מדד אחד מידרדר"] : [N(n), " מדדים מידרדרים"]), better = (n) => (n === 1 ? ["מדד אחד משתפר"] : [N(n), " מדדים משתפרים"]);
  if (!w && !i) return ["אף מדד לא זז בבירור לאחד הכיוונים."];
  if (w === i) return [worse(w), i === 1 ? " ומדד אחד משתפר" : [" ו-", N(i), " משתפרים"], ", בדיוק באותה מידה."];
  if (w > i) return i ? [worse(w), ", ורק ", i === 1 ? "אחד" : N(i), i === 1 ? " משתפר." : " משתפרים."] : [worse(w), ", ואף מדד לא משתפר."];
  return w ? [better(i), ", ו", w === 1 ? "אחד" : ["-", N(w)], w === 1 ? " מידרדר." : " מידרדרים."] : [better(i), ", ואף מדד לא מידרדר."];
}
const joinParts = (parts) => parts.flatMap((p, k) => (k ? [", ", p] : [p]));

// a numbered section: eyebrow with its number, a title, one lead line
function secHead(no, eyebrow, title, lead) {
  return h("div.sec-head.rv", h("div", h("div.sec-eyebrow", no ? h("b", no) : null, eyebrow), h("h2.sec-title", title), lead ? h("p.sec-lead", lead) : null));
}

// ── the ledger: three big counts, each with a dot per figure; the worse on the left, the better on the right (shared with the compare page) ──
// cols = [{ n, tone: "good" | "none" | "attn", label, hint, onPick }] in the order they sit from the right edge
export function ledger({ cols, label }) {
  const root = h("div.keyfigs.tr-led");
  for (const c of cols) {
    const n = N(c.n);
    if (c.n > 0) n.setAttribute("data-count", "");
    const dots = h("span.tr-dots", { "aria-hidden": "true" }, Array.from({ length: Math.min(c.n, 48) }, (_, i) => h("i.tr-dot.pop", { style: { "--i": Math.min(i, 12) } })));
    const say = `${c.n} ${c.label}${c.hint ? ". " + c.hint : ""}`;
    const act = c.onPick && c.n > 0;                                         // a count of zero has no list to jump to
    root.append(h((act ? "button" : "div") + ".keyfig.tr-col.tone-" + c.tone + (c.n ? "" : ".is-zero"),
      act ? { type: "button", "aria-label": say + ". מעבר לרשימה", onclick: c.onPick } : { role: "group", "aria-label": say },
      h("span.kf-num", n), h("span.kf-label", c.label), c.hint ? h("span.tr-hint", c.hint) : null, dots));
  }
  return viz(root, { label, role: "group" });
}

// ── 1. the hero ───────────────────────────────────────────────────────────
function hero(model, root, k, hist, by) {
  const c = model.city, steady = k.stable + k.describing, judged = k.worsening + k.improving + steady, none = k.small + k.stale + k.short + k.unclear;
  const fact = (label, value) => h("div.hero-fact", h("small", label), h("b", value));
  const facts = [model.years && fact("שנות נתונים", ltr(model.years.from + "–" + model.years.to)), fact("מדדים עם היסטוריה", outOf(hist.length, model.indicators.length)),
    fact("מדדים עם מגמה", outOf(judged, hist.length))].filter(Boolean);
  const cols = [
    { n: k.improving, tone: "good", label: "משתפרים", hint: "המספר זז לכיוון הטוב", onPick: () => jumpTo(root, "tr-grp-better") },
    { n: steady, tone: "none", label: "יציבים ואחרים", hint: k.describing ? [k.stable, " יציבים, ", k.describing, " עולים או יורדים בלי טוב או רע"].join("") : "המספר כמעט לא זז", onPick: () => jumpTo(root, "tr-grp-even") },
    { n: k.worsening, tone: "attn", label: "מידרדרים", hint: "המספר זז לכיוון הלא טוב", onPick: () => jumpTo(root, "tr-grp-worse") }];
  const why = [k.small && [N(k.small), " בגלל קבוצה קטנה מדי"], k.stale && [N(k.stale), " בגלל נתון ישן"], k.short && [N(k.short), " עם פחות משלוש שנות נתונים"], k.unclear && [N(k.unclear), " שהנתונים אינם מאפשרים לקבוע להם מגמה"],
    k.single && [N(k.single), " שנמדדו פעם אחת בלבד, ולכן אין להם היסטוריה"]].filter(Boolean);
  const key = model.city.key, top = by.worsening.slice().sort(byPressing)[0];                 // the figure that worsens and weighs most: where to go next
  const acts = h("div.hero-actions.rv", h("a.btn.primary", { href: `#/c/${key}/actions` }, icon("list"), "לתוכנית הפעולה"),
    top ? h("a.btn", { href: hrefI(key, top.id), title: "מדד מידרדר שהעדיפות שלו גבוהה" }, icon("trenddown"), "מדד מידרדר בעדיפות גבוהה: " + (top.short || top.label)) : null);
  const fan = viz(h("div.tr-fan", { "aria-hidden": "true" }, svg("svg", { viewBox: "0 0 800 160", preserveAspectRatio: "none" },
    svg("path", { class: "draw tr-fan-none", style: "--len:1100", d: "M0 82C130 78 250 88 380 80S620 84 800 78" }),
    svg("path", { class: "draw tr-fan-good", style: "--len:1100; --i:1", d: "M0 118C140 114 270 98 410 76S650 34 800 14" }),
    svg("path", { class: "draw tr-fan-attn", style: "--len:1100; --i:2", d: "M0 30C140 36 270 54 410 82S650 126 800 148" }))));
  return h("section.hero.tr-hero", { "aria-labelledby": "tr-h1" }, fan,
    h("div.tr-hero-top",
      h("div.eyebrow.rv", model.city.name),
      h("h1.rv", { id: "tr-h1" }, "מגמות והיסטוריה"),
      h("p.hero-verdict.rv", judged ? balanceLine(k.worsening, k.improving) : "אין מספיק היסטוריה כדי לקבוע מגמה באף מדד."),
      h("div.hero-meta.rv", facts), acts),
    judged ? h("div.rv", ledger({ cols, label: `מדדים לפי כיוון התנועה: ${k.improving} משתפרים, ${steady} יציבים ואחרים, ${k.worsening} מידרדרים` })) : null,
    none || k.single ? h("p.tr-hero-note.rv", ["בלי מגמה: ", ...joinParts(why), "."]) : null);
}

// ── 2. the heat map ───────────────────────────────────────────────────────
function heatKey(hasGap, hasScale) {
  const sw = (cls, p) => h("i.v-mx-sw." + cls, { style: { "--mx-p": p + "%" } }), kids = [];          // the same markup as the chart's own key, drawn once for the whole page
  if (hasGap) kids.push(h("div.v-mx-kg", h("span.lt", "חלש מהממוצע הארצי"), h("span.ramp", [["worse", 1], ["worse", 0.66], ["worse", 0.33], ["same", 0], ["better", 0.33], ["better", 0.66], ["better", 1]].map(([kk, t]) => sw("k-" + kk, Math.round(18 + 70 * t)))), h("span.rt", "טוב מהממוצע הארצי")));
  if (hasScale) kids.push(h("div.v-mx-kg", h("span.lt", "ערך נמוך"), h("span.ramp", [0, 0.25, 0.5, 0.75, 1].map((t) => sw("k-scale", Math.round(12 + 76 * t)))), h("span.rt", "ערך גבוה")));
  kids.push(h("div.v-mx-kg.solo", h("i.v-mx-sw.k-missing"), h("span", "אין נתון")));
  return h("div.v-mx-heat.tr-key", h("div.v-mx-hkey", kids));
}

// the years the map shows: the span in which enough figures have a value (a year that only one or two figures reach would be a column of empty frames)
export function heatYears(judgable) {
  const count = new Map();
  for (const a of judgable) for (const y of new Set(a.series.map((s) => s.year))) if (y != null) count.set(y, (count.get(y) || 0) + 1);
  const all = [...count.keys()].sort((x, y) => x - y), need = Math.min(judgable.length, Math.max(3, Math.ceil(judgable.length * 0.33)));
  const ok = all.filter((y) => count.get(y) >= need);
  if (!ok.length) return all;
  return all.filter((y) => y >= ok[0] && y <= ok[ok.length - 1]);
}

// the year row is drawn once for the whole map and stays under the top bar; it copies the size of the first block, so the columns line up
function yearAxis(years, first) {
  const heads = h("div.v-mx-hcells"), axis = h("div.v-mx-heat.tr-axis", { "aria-hidden": "true" }, h("div.v-mx-hhead", h("span.v-mx-hlab"), heads));
  const paint = () => {
    const cs = first.style, n = Math.min(years.length, parseInt(cs.getPropertyValue("--n"), 10) || years.length), pitch = (parseFloat(cs.getPropertyValue("--cell")) || 28) + (parseFloat(cs.getPropertyValue("--hg")) || 4);
    ["--cell", "--n", "--lab", "--hg"].forEach((v) => axis.style.setProperty(v, cs.getPropertyValue(v)));
    axis.classList.toggle("is-stacked", first.classList.contains("is-stacked"));
    const ys = years.slice(years.length - n), step = pitch >= 30 ? 1 : 2;
    heads.replaceChildren(...ys.map((y, k) => h("span.v-mx-hy" + ((ys.length - 1 - k) % step === 0 ? "" : ".off"), String(y))));
  };
  paint();
  if (typeof MutationObserver === "function") new MutationObserver(paint).observe(first, { attributes: true, attributeFilter: ["style", "class"] });
  return axis;
}

function heatSection(model, hist, key, next) {
  const judgable = hist.filter((a) => trendKind(a) !== "small"), hidden = hist.length - judgable.length;          // a small group is never coloured as a verdict: it is listed further down, with its value
  const years = heatYears(judgable), inSpan = (a) => a.series.some((s) => years.includes(s.year)), outside = judgable.filter((a) => !inSpan(a)).length;
  const doms = model.domains.map((d) => ({ d, list: judgable.filter((a) => a.domain === d.id && inSpan(a)).sort(byWorst) })).filter((x) => x.list.length)
    .sort((x, y) => y.list.filter((a) => trendKind(a) === "worsening").length - x.list.filter((a) => trendKind(a) === "worsening").length);
  if (!doms.length || !years.length) return null;
  const body = h("div.tr-heat");
  for (const { d, list } of doms) {
    const w = list.filter((a) => trendKind(a) === "worsening").length, b = list.filter((a) => trendKind(a) === "improving").length;
    const rows = list.map((a) => ({ id: a.id, label: a.label, href: hrefI(key, a.id), unit: a.unit, direction: a.direction || null,
      cells: a.series.map((s) => ({ year: s.year, v: s.v, ref: s.nat })) }));
    body.append(h("section.tr-dom",
      h("h3.tr-dh", h("span.tr-dh-ic", icon(DOMAIN_ICON[d.id] || "bars", 16)), h("span", d.label),
        w || b ? h("span.tr-dh-n", [w ? h("span.tr-w", [N(w), w === 1 ? " מידרדר" : " מידרדרים"]) : null, w && b ? " · " : null, b ? h("span.tr-b", [N(b), b === 1 ? " משתפר" : " משתפרים"]) : null]) : null),
      heatMatrix({ rows, years, ariaLabel: `מפת חום של ${d.label}: ${list.length} מדדים מול הממוצע הארצי, ${years[0]} עד ${years[years.length - 1]}` })));
  }
  const gaps = judgable.some((a) => a.direction), scale = judgable.some((a) => !a.direction), first = body.querySelector(".v-mx-heat");
  const span = years.length > 1 ? ltr(years[0] + "–" + years[years.length - 1]) : String(years[0]);
  return h("section.sec.tr-sec", { id: "tr-heat" },
    secHead(next(), "כל המדדים", "מפת חום, שנה אחרי שנה",
      "כל שורה היא מדד וכל עמודה היא שנה. טורקיז: טוב מהממוצע הארצי באותה שנה. כתום: חלש ממנו. ככל שהצבע חזק יותר, הפער גדול יותר. הצבע כבר מביא בחשבון מה טוב בכל מדד, ולכן במדד שבו נמוך יותר טוב יותר, ערך נמוך נצבע בטורקיז."),
    heatKey(gaps, scale), h("div.tr-heatwrap", first ? yearAxis(years, first) : null, body),
    h("p.tr-sortnote", ["המפה מציגה את השנים ", span, ", שבהן נמדדו לפחות שליש מהמדדים. שנים מוקדמות יותר מופיעות בעמוד של כל מדד. בכל תחום, המדדים שהמגמה שלהם הכי רעה באים ראשונים, ואלה שאין להם מגמה בסוף.",
      outside ? [" ", outside === 1 ? "מדד אחד, שנמדד רק בשנים אחרות, לא נכנס למפה." : [N(outside), " מדדים, שנמדדו רק בשנים אחרות, לא נכנסים למפה."]] : null,
      hidden ? [" ", hidden === 1 ? "מדד אחד, שהקבוצה בו קטנה מדי, לא נכנס למפה כי אין מה להשוות. הוא מופיע בהמשך, בלי השוואה." : [N(hidden), " מדדים, שהקבוצה בהם קטנה מדי, לא נכנסים למפה כי אין מה להשוות. הם מופיעים בהמשך, בלי השוואה."]] : null]));
}

// ── 3. the groups ─────────────────────────────────────────────────────────
function group({ id, tone, ic, title, lead, list, key }) {
  const items = list.map((a) => ({ ...smallItem(a, hrefI(key, a.id)), label: a.label }));
  const head = h("div.tr-gh", h("span.tr-gic.tone-" + tone, icon(ic, 20)), h("h3.tr-gt", title), h("b.tr-gn", N(list.length)));
  if (!list.length) return h("div.tr-grp.is-empty", { id }, head, h("p.tr-glead", "אין מדד כזה."));
  const sm = smallMultiples({ items, cols: 3, ariaLabel: `${title}: ${list.length} מדדים` });
  sm.style.setProperty("--tr-n3", Math.min(3, list.length)); sm.style.setProperty("--tr-n2", Math.min(2, list.length));
  [...sm.children].forEach((li, i) => {
    if (i >= CAP) li.classList.add("tr-more-li");
    const a = list[i], cell = li.firstElementChild;                           // which way is good, under every figure whose change is coloured
    if (!cell) return;
    cell.append(h("span.tr-dir", { title: directionNote(a.direction) }, icon(directionIcon(a.direction), 13), dirShort(a.direction)));
    const dot = cell.querySelector(".v-time-sm-dot"), why = statusReason(a);          // the status dot says why, in words, when the pointer rests on it
    if (dot && why) { dot.title = why; const sr = dot.querySelector(".sr"); if (sr) sr.textContent = why; }
  });
  const grp = h("div.tr-grp.tone-" + tone, { id }, head, h("p.tr-glead", lead), sm);
  if (list.length > CAP) {
    const btn = h("button.tr-showall", { type: "button", "aria-expanded": "false" }, `הצגת כל ${list.length} המדדים`, icon("down", 16));
    btn.addEventListener("click", () => {
      const open = grp.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
      btn.replaceChildren(open ? "הצגת פחות" : `הצגת כל ${list.length} המדדים`, icon(open ? "up" : "down", 16));
    });
    grp.append(h("div.tr-showrow", btn));
  }
  return grp;
}

// what the small dot beside a figure's name says (its status against the national picture, not the direction of the movement)
function dotKey() {
  const it = (cls, word) => h("span.tr-dk", h("i.v-time-sm-dot." + cls), word);
  return h("div.tr-dotkey.rv", { role: "group", "aria-label": "מקרא הנקודה ליד שם המדד" }, h("span.tr-dk-t", "הנקודה ליד השם היא מצב המדד:"), it("is-attn", "דורש טיפול"), it("is-watch", "למעקב"), it("is-good", "תקין"), it("hollow", "קבוצה קטנה, לא נשפט"));
}
function groupsSection(model, by, key, next) {
  const worse = by.worsening.slice().sort(byPressing), better = by.improving.slice().sort(byPressing), even = [...by.stable, ...by.describing].sort(byPressing);
  if (!worse.length && !better.length && !even.length) return null;
  const none = !worse.length && !better.length;
  return h("section.sec.tr-sec", { id: "tr-groups" },
    secHead(next(), "מי זז לאן", "מי מידרדר, מי משתפר, מי יציב",
      ["בכל מדד: הערך האחרון, השינוי מאז השנה הראשונה והקו לאורך השנים. הקו הכחול הוא ", model.city.name, ", הקו האפור הוא הממוצע הארצי והנקודה היא השנה האחרונה. צבע השינוי כבר מביא בחשבון מה טוב בכל מדד: ״גבוה = טוב״ אומר שככל שהמספר גבוה יותר, כך טוב יותר, ו״נמוך = טוב״ הפוך."]),
    dotKey(),
    none ? h("p.tr-glead.tr-none-line", "אף מדד אינו מידרדר או משתפר בבירור: המספרים כמעט לא זזו, או שאי אפשר לקבוע להם מגמה.") : [
      group({ id: "tr-grp-worse", tone: "attn", ic: "trenddown", title: "מידרדרים", lead: "המספר זז לכיוון הלא טוב לאורך השנים, יותר מתנודה רגילה משנה לשנה.", list: worse, key }),
      group({ id: "tr-grp-better", tone: "good", ic: "trend", title: "משתפרים", lead: "המספר זז לכיוון הטוב לאורך השנים, יותר מתנודה רגילה משנה לשנה.", list: better, key })],
    even.length ? group({ id: "tr-grp-even", tone: "none", ic: "minus", title: "יציבים ואחרים", lead: "המספר כמעט לא זז, או שהוא רק מתאר את היישוב ולכן עולה או יורד בלי שיש בזה טוב או רע.", list: even, key }) : null);
}

// ── 4. no trend, and why ──────────────────────────────────────────────────
function reasonOf(a, kind) {
  const L = a.last || {};
  if (kind === "small") return ["הקבוצה קטנה מכדי להשוות או להסיק", L.d != null ? [" (", N(Math.round(L.d)), " בקבוצה)"] : "", "."];
  if (kind === "stale") return ["הנתון האחרון (", N(L.year), ") ישן, ולכן אינו משפיע על המסקנות."];
  if (kind === "short") return "יש נתונים רק לשתי שנים, ומגמה נקבעת מ-3 שנים ומעלה.";
  return "הנתונים אינם מאפשרים לקבוע מגמה.";
}
function noTrendSection(by, key, next) {
  const list = [...by.small, ...by.stale, ...by.short, ...by.unclear];
  if (!list.length && !by.single.length) return null;
  const rows = list.map((a) => {
    const kind = trendKind(a), L = a.last || {}, unit = a.unit !== "%" && unitSuffix(a.unit) ? " " + unitSuffix(a.unit) : "";
    return h("a.tr-nt" + (kind === "small" ? ".is-small" : ""), { href: hrefI(key, a.id) },
      h("span.tr-nt-main", h("b.tr-nt-name", a.label), h("span.tr-nt-why", reasonOf(a, kind))),
      h("span.tr-nt-val", h("b", ltr(fmtVal(a.unit, L.v))), h("small", [unit.trim(), unit ? " · " : "", N(L.year)])));
  });
  return h("section.sec.tr-sec", { id: "tr-none" },
    secHead(next(), "בלי מגמה", "מדדים שאי אפשר לקבוע להם מגמה", "הנתון עצמו מוצג, אבל בלי השוואה, מגמה או מסקנה."),
    rows.length ? h("div.tr-ntlist", rows) : null,
    by.single.length ? h("p.tr-single", [N(by.single.length), by.single.length === 1 ? " מדד נוסף נמדד פעם אחת בלבד, ולכן אין לו היסטוריה." : " מדדים נוספים נמדדו פעם אחת בלבד, ולכן אין להם היסטוריה."]) : null);
}

// ── 5. what to know before concluding ─────────────────────────────────────
function notesSection(model, key, next) {
  const shifted = model.indicators.filter((a) => a.baseShift != null && a.series.length >= 2);
  const item = (title, ...kids) => h("div.tr-note", h("h3.tr-note-t", title), h("p", ...kids));
  return h("section.sec.tr-sec", { id: "tr-notes" },
    secHead(next(), "לפני שמסיקים", "מה כדאי לדעת"),
    h("div.tr-notes",
      item("הקורונה והמלחמה", "השנים 2020–2021 הושפעו מהקורונה, ומאוקטובר 2023 מהמלחמה. שינוי באותן שנים עשוי לשקף שיבוש בשירות או בדיווח, ולא רק שינוי בפועל."),
      item("מתי נקבעת מגמה", "מגמה נקבעת רק מ-3 שנים ומעלה, ורק כשהקבוצה גדולה מספיק, בשיטה שלא נבהלת משנה חריגה אחת. ״יציב״ אומר שהשינוי קטן מתנודה רגילה משנה לשנה. ", h("a", { href: `#/c/${key}/method` }, "איך זה מחושב")),
      item("איך קוראים את הקווים", "הקו הכחול הוא ", model.city.name, ", הקו האפור הוא הממוצע הארצי, והנקודה היא השנה האחרונה. נק׳ = נקודות אחוז."),
      shifted.length ? item("כשגודל הקבוצה השתנה", "גודל הקבוצה השתנה בחדות, יותר מבמדינה כולה (למשל בגלל פינוי, שכונה חדשה או שינוי בדיווח), ולכן כדאי לקרוא בזהירות את: ",
        ...shifted.flatMap((a, i) => [i ? ", " : "", h("a", { href: hrefI(key, a.id) }, a.label)]), ".") : null));
}

// ── the page ──────────────────────────────────────────────────────────────
export function trendsView(model) {
  const key = model.city.key, root = h("div.tr-page");
  const hist = model.indicators.filter((a) => a.series && a.series.length >= 2);
  if (!model.years || !hist.length) {
    root.append(h("section.hero.tr-hero.tr-calm", { "aria-labelledby": "tr-h1" },
      h("div.tr-hero-top", h("div.eyebrow.rv", model.city.name), h("h1.rv", { id: "tr-h1" }, "מגמות והיסטוריה"),
        h("p.hero-verdict.rv", !model.years ? "אין עדיין היסטוריה ליישוב הזה." : "אין מספיק היסטוריה להצגה."),
        h("p.tr-hero-note.rv", !model.years ? "המקורות הרשמיים אינם מפרסמים עליו נתונים לאורך זמן." : "נדרשות לפחות שתי שנות נתונים באותו מדד."),
        h("div.hero-actions.rv", h("a.btn.primary", { href: `#/c/${key}` }, icon("grid"), "חזרה לתמונת המצב")))));
    return root;
  }
  const by = groupByKind(model.indicators), k = Object.fromEntries(Object.entries(by).map(([name, list]) => [name, list.length]));
  let n = 0;
  const next = () => String(++n).padStart(2, "0");                      // the numbers follow what is on the page
  const groups = groupsSection(model, by, key, next), heat = heatSection(model, hist, key, next), none = noTrendSection(by, key, next);   // the answer first (who worsens), the whole map after it
  root.append(hero(model, root, k, hist, by), groups, heat, none, notesSection(model, key, next));
  return root;
}
