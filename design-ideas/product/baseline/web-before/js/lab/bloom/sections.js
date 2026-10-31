// The page under the bloom (direction "bloom"): domain by domain, what to treat first, where to start, what changed, a closing question, the sources.
// Hairline rows and big numerals on the page itself; one tinted band (start here); no cards. Every sentence comes from the model; nothing is invented here.
import { h, svg, icon, num, fmtVal, unitSuffix, ltr, iso, dateHe, DOMAIN_ICON, statusReason, compareLine, directionNote } from "../../ui.js";
import { viz, bindTip, tipHead, tipRow, clamp, C, STATUS_WORD } from "../../viz/core.js";
import { sortIndicators } from "../../viz/matrix.js";
import { divergingBars } from "../../viz/compare.js";
import { trajectory, kpiTrajectory, lineChart, indicatorLine, legendOf } from "../../viz/time.js";
import { horizonLabel } from "../../components.js";
import * as G from "./geo.js";
import { leafMark } from "./chart.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const hrefI = (key, id) => `#/c/${encodeURIComponent(key)}/i/${id}`;
const unitWord = (a) => (a.unit !== "%" && unitSuffix(a.unit) ? " " + unitSuffix(a.unit) : "");
const pad2 = (i) => String(i + 1).padStart(2, "0");
const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const joinHe = (parts) => (parts.length < 2 ? parts[0] || "" : parts.slice(0, -1).join(", ") + " ו" + parts[parts.length - 1]);
const STRENGTH = { strong: "חזקים", moderate: "בינוניים", limited: "מוגבלים" }, EFFORT = { low: "נמוך", medium: "בינוני", high: "גבוה" };
const ORDER_NOTE = ["below_target", "trend_down", "equity_sector", "equity_ses", "gap_widening", "level_low"];

// the most telling concern about one figure, in the finding's own words (when the rule's reason is not enough)
function bestNote(model, id) {
  const fs = (model.findings || []).filter((f) => f.indicator === id && f.polarity === "concern").sort((a, b) => ORDER_NOTE.indexOf(a.type) - ORDER_NOTE.indexOf(b.type));
  const f = fs.find((x) => x.type !== "level_low") || null;
  return f ? f.text : null;
}
const why = (model, a) => statusReason(a) || bestNote(model, a.id) || compareLine(a).text;

// a section head: a small label with the leaf, the title as the one message, a lead line, an optional link on the far side
function secHead(id, eyebrow, title, lead, aside) {
  return h("header.lb-sh.rv", h("div.lb-sh-t", h("p.lb-eyebrow", leafMark(), eyebrow), h("h2.lb-st", { id }, title), lead ? h("p.lb-sl", lead) : null), aside || null);
}
const seeAll = (href, text) => h("a.lb-more.no-print", { href }, text, icon("left"));
const fact = (label, value) => h("div.lb-fact", h("small", label), h("b", value));

// ═══════════════════════════ 1. domain by domain ═══════════════════════════
// the worst figure of the domain, as one sentence with its value, and which way is good
function worstLine(a) {
  const L = a.last || {}, small = a.status === "uncertain" || L.reliable === false, ok = isNum(L.v);
  const val = ok ? h("span.lb-wv" + (small ? ".is-small" : ""), ltr(fmtVal(a.unit, L.v, a.unit === "index" ? 2 : 1)), unitWord(a)) : null;
  const note = small ? "הקבוצה קטנה מכדי להשוות או להסיק" : a.status === "stale" ? statusReason(a) : directionNote(a.direction);
  return h("div.lb-w", h("p.lb-w-s", small ? h("i.lb-hollow", { "aria-hidden": "true" }) : null, h("span", a.label), ok ? ": " : null, val), h("p.lb-w-n", note));
}

export function domainsSection(model, data, bus) {
  const key = model.city.key, ranked = G.rankPetals(data.petals), have = ranked.filter((p) => p.tone !== "empty"), none = ranked.filter((p) => p.tone === "empty");
  if (!have.length) return null;
  const rows = have.map((p) => {
    const list = sortIndicators(model.indicators.filter((a) => a.domain === p.id)), worst = list[0];
    const a = h("a.lb-row.rv.is-" + p.tone, { href: G.domainHref(key, p.id), "data-id": p.id },
      h("span.lb-row-ic", { "aria-hidden": "true" }, icon(DOMAIN_ICON[p.id] || "bars")),
      h("div.lb-row-name", h("b", p.label), h("small", p.tone === "bud" ? "ללא שיפוט" : G.domainWords(p.counts))),
      h("span.lb-dots", { "aria-hidden": "true" }, list.map((x) => h("i.lb-dot.s-" + x.status, { title: `${x.short || x.label}: ${STATUS_WORD[x.status] || STATUS_WORD.na}` }))),
      worst ? worstLine(worst) : h("div.lb-w"),
      h("span.lb-row-go", { "aria-hidden": "true" }, icon("left")));
    const say = (id) => bus.dispatchEvent(new CustomEvent("hot", { detail: { id, src: "rows" } }));
    a.addEventListener("pointerenter", () => say(p.id)); a.addEventListener("pointerleave", () => say(null));
    a.addEventListener("focus", () => say(p.id)); a.addEventListener("blur", () => say(null));
    return a;
  });
  bus.addEventListener("hot", (e) => { if (e.detail.src !== "rows") rows.forEach((r) => r.classList.toggle("is-hot", r.dataset.id === e.detail.id)); });
  const dkey = [["concern", "דורש טיפול"], ["watch", "למעקב"], ["good", "תקין"], ["strength", "חוזק"], ["na", "ללא שיפוט"]];
  return h("section.lb-sec#lb-domains", { "aria-labelledby": "lb-domains-t" },
    secHead("lb-domains-t", "מצב כל תחום", "תחום אחר תחום", "מהתחום שבו הכי גדול החלק של המדדים שדורשים טיפול ועד הרגוע ביותר, כמו אורך העלים למעלה. כל נקודה היא מדד אחד, ולחיצה על שורה פותחת את התחום."),
    h("ul.lb-dkey.rv", { "aria-label": "מקרא הנקודות" }, dkey.map(([s, w]) => h("li", h("i.lb-dot.s-" + s, { "aria-hidden": "true" }), w))),
    h("div.lb-rows", rows),
    none.length ? h("p.lb-nodata.rv", none.length === 1 ? `בתחום ${none[0].short} אין מדדים ליישוב הזה.` : `בתחומים ${joinHe(none.map((p) => p.short))} אין מדדים ליישוב הזה.`) : null);
}

// ═══════════════════════════ 2. what to treat first ═══════════════════════════
// one value against similar localities and the nation, on one axis, better on the right
function miniDumbbell(a, cityName, { w = 244, hgt = 58 } = {}) {
  const L = a.last;
  if (!L || !isNum(L.v) || L.reliable === false) return null;
  const pts = [{ key: "nat", label: "ממוצע ארצי", v: L.nat, rank: 1, r: 5, color: C.nat }, { key: "peer", label: "יישובים דומים", v: L.peer, rank: 2, r: 5, color: C.peer }, { key: "city", label: cityName, v: L.v, rank: 0, r: 8, color: C.city }].filter((x) => isNum(x.v));
  if (pts.length < 2) return null;
  const sc = G.miniScale(pts.map((x) => x.v), { unit: a.unit, direction: a.direction, width: w });
  if (!sc) return null;
  const y = 20, xs = pts.map((x) => sc.x(x.v)), s = svg("svg", { class: "lb-db", viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, tabindex: "0" });
  s.append(svg("line", { class: "lb-db-base", x1: 6, y1: y, x2: w - 6, y2: y }), svg("line", { class: "fade lb-db-link", style: { "--i": 0 }, x1: Math.min(...xs), y1: y, x2: Math.max(...xs), y2: y }));
  [...pts].sort((p, q) => q.rank - p.rank).forEach((p, i) => s.append(svg("circle", { class: `pop lb-db-dot is-${p.key}`, style: { "--i": i + 1 }, cx: sc.x(p.v), cy: y, r: p.r })));
  G.keepLabels(pts.filter((p) => p.key !== "city").map((p) => ({ ...p, x: sc.x(p.v) })), 44)
    .forEach((p) => s.append(svg("text", { class: "rise lb-db-t", style: { "--i": 3 }, x: clamp(p.x, 16, w - 16), y: y + 27, "text-anchor": "middle" }, fmtVal(a.unit, p.v))));
  const lab = `${cityName}: ${fmtVal(a.unit, L.v)}` + pts.filter((p) => p.key !== "city").map((p) => `, ${p.label}: ${fmtVal(a.unit, p.v)}`).join("") + (a.direction ? ". ימינה טוב יותר" : "");
  viz(s, { label: lab });
  bindTip(s, () => [tipHead(a.label), ...[...pts].sort((p, q) => sc.x(q.v) - sc.x(p.v)).map((p) => tipRow(p.color, p.label, fmtVal(a.unit, p.v)))]);
  return s;
}

export function prioritiesSection(model) {
  const key = model.city.key, c = model.counts || {}, list = (model.priorities || []).map((id) => model.indicators.find((x) => x.id === id)).filter(Boolean).slice(0, 5);
  if (!list.length) return null;
  const lead = c.concern ? [c.concern === 1 ? "מדד אחד דורש טיפול" : [ltr(String(c.concern)), " מדדים דורשים טיפול"], ". אלה הראשונים בתור: המדדים שיש בהם הכי הרבה מקום לשיפור, לפי חשיבותם."] : "אין מדדים שדורשים טיפול. אלה המדדים שיש בהם הכי הרבה מקום לשיפור.";
  const anyDir = list.some((a) => a.direction && a.last && a.last.reliable !== false);
  const lg = (cls, text) => h("span", h("i." + cls, { "aria-hidden": "true" }), text);
  const items = list.map((a, i) => {
    const L = a.last || {}, db = miniDumbbell(a, model.city.name), small = L.reliable === false;
    return h("li.lb-pr.rv",
      h("span.lb-pr-n", { "aria-hidden": "true" }, pad2(i)),
      h("div.lb-pr-main", h("a.lb-pr-t", { href: hrefI(key, a.id) }, a.label), h("p.lb-pr-w", why(model, a)), h("p.lb-pr-d", directionNote(a.direction))),
      h("div.lb-pr-v", isNum(L.v) ? h("b", ltr(fmtVal(a.unit, L.v, a.unit === "index" ? 2 : 1))) : null, unitWord(a) ? h("small", unitWord(a).trim()) : null, L.year ? h("small", ["ב-", ltr(String(L.year))]) : null),
      h("div.lb-pr-c", db || (small ? h("span.lb-pr-none", "הקבוצה קטנה מכדי להשוות או להסיק") : h("span.lb-pr-none", "אין ממוצע ארצי או יישובים דומים להשוואה"))));
  });
  return h("section.lb-sec#lb-prio", { "aria-labelledby": "lb-prio-t" },
    secHead("lb-prio-t", "סדר עדיפויות", "מה לטפל קודם", lead, seeAll(`#/c/${encodeURIComponent(key)}/actions`, "לתוכנית הפעולה")),
    anyDir ? h("div.lb-lg.rv", lg("l-city", model.city.name), lg("l-peer", "יישובים דומים"), lg("l-nat", "ממוצע ארצי"), h("span.lb-lg-better", "טוב יותר", svg("svg", { viewBox: "0 0 24 8", width: 24, height: 8, "aria-hidden": "true" }, svg("path", { d: "M22 4H3M7 1 3 4l4 3", fill: "none" })))) : null,
    h("ol.lb-prs", items));
}

// ═══════════════════════════ 3. start here ═══════════════════════════
function recBand(model, rec) {
  const key = model.city.key, kpis = rec.kpis || [], k = kpis[0], ind = k && model.indicators.find((x) => x.id === k.indicator);
  const cfg = k && ind ? kpiTrajectory(k, ind, { width: 440, height: 176 }) : null, steps = (rec.actions || []).slice(0, 3);
  const pair = (q) => h("div.lb-kpi", h("span.lb-kpi-l", q.label), h("div.lb-kpi-row", h("span.lb-kpi-t", "היום"), h("span.lb-kpi-from", q.from)), h("div.lb-kpi-row.is-to", h("span.lb-kpi-t", "יעד"), h("b.lb-kpi-to", q.to)),
    h("span.lb-kpi-y", ["בנתוני שנת ", ltr(String(q.byYear)), q.bench ? [" · ", q.bench] : null]), q.people ? h("span.lb-kpi-y", "כ-" + num(q.people, 0) + " " + (q.noun || "")) : null);
  const facts = [rec.owner ? fact("אחראי", rec.owner) : null, rec.horizon ? fact("זמן", horizonLabel[rec.horizon] || rec.horizon) : null, rec.effort ? fact("מאמץ", EFFORT[rec.effort] || rec.effort) : null,
    rec.evidenceStrength ? fact("חוזק הראיות", STRENGTH[rec.evidenceStrength] || rec.evidenceStrength) : null].filter(Boolean);
  const whyList = (rec.why || []).slice(0, 3);
  const more = whyList.length || rec.caveat || rec.evidenceNote ? h("details.lb-why", h("summary", "על מה ההמלצה מבוססת", icon("down")),
    whyList.length ? h("ul", whyList.map((w) => h("li", w.text || w))) : null, rec.evidenceNote && !rec.evidenceStrength ? h("p.lb-note", icon("info"), rec.evidenceNote) : null, rec.caveat ? h("p.lb-note", icon("info"), rec.caveat) : null) : null;
  const side = kpis.length ? h("div.lb-start-side", h("h3.lb-h3", "איך נדע שהצלחנו"),
    cfg ? h("figure.lb-traj", trajectory(cfg), h("figcaption", h("b", k.label), [" · המסלול עד שנת ", ltr(String(k.byYear))])) : null,
    h("div.lb-kpis", kpis.slice(0, 3).map(pair)),
    h("p.lb-hint", "היעד הוא כחצי מהפער עד נקודת ההשוואה (היעד הרשמי, או הממוצע הארצי), ונמדד בנתוני שנתיים קדימה.")) : null;
  return h("section.band.lb-start#lb-start", { "aria-labelledby": "lb-start-t" },
    h("div.lb-start-main",
      h("p.lb-eyebrow", leafMark(), "התחילו כאן"),
      h("h2.lb-start-title", { id: "lb-start-t" }, rec.title),
      rec.summary ? h("p.lb-start-sum", rec.summary) : null,
      steps.length ? h("ol.lb-steps", steps.map((t, i) => h("li", h("span.lb-step-n", { "aria-hidden": "true" }, String(i + 1)), h("span.lb-step-t", t)))) : null,
      facts.length ? h("div.lb-facts2", facts) : null, more, h("div.lb-start-foot.no-print", seeAll(`#/c/${encodeURIComponent(key)}/actions`, "לכל ההמלצות"))),
    side);
}
// no recommendation: start with the first priority and its history
function priorityBand(model, a) {
  const key = model.city.key, box = h("div.lb-line");
  lineChart(box, indicatorLine(a, model.city.name, { height: 230 }));
  return h("section.band.lb-start.is-line#lb-start", { "aria-labelledby": "lb-start-t" },
    h("div.lb-start-main", h("p.lb-eyebrow", leafMark(), "התחילו כאן"), h("h2.lb-start-title", { id: "lb-start-t" }, a.short || a.label), h("p.lb-start-sum", why(model, a)),
      h("div.lb-start-foot.no-print", seeAll(hrefI(key, a.id), "לפרטי המדד"))),
    h("div.lb-start-side", box, legendOf(indicatorLine(a, model.city.name))));
}
export function startSection(model) {
  const rec = (model.recommendations || [])[0];
  if (rec) return h("div.lb-block.rv", recBand(model, rec));
  const first = (model.priorities || []).map((id) => model.indicators.find((x) => x.id === id)).filter(Boolean)[0];
  return first ? h("div.lb-block.rv", priorityBand(model, first)) : null;
}

// ═══════════════════════════ 4. what changed ═══════════════════════════
// bars of very different units share one scale by being measured against the usual spread between localities on the same figure
const spreadOf = (a) => Math.max(isNum(a.last.p25) && isNum(a.last.p75) ? a.last.p75 - a.last.p25 : 0, a.unit === "%" ? 5 : Math.abs(a.last.v) * 0.1 || 1);
export function changesSection(model) {
  const key = model.city.key, sign = (a) => (a.direction === "lower" ? -1 : 1);
  const movers = model.indicators.filter((a) => !a.stale && a.direction && a.last && a.last.reliable !== false && isNum(a.last.v) && a.history && a.history.first && a.history.delta != null && a.history.delta !== 0)
    .map((a) => ({ a, gap: (a.history.delta * sign(a)) / spreadOf(a) })).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap)).slice(0, 7);
  if (movers.length < 2) return null;
  const max = movers.reduce((m, x) => Math.max(m, Math.abs(x.gap)), 0);
  const items = movers.map(({ a, gap }) => ({ id: a.id, label: a.label, sub: `מאז ${iso(String(a.history.first.year))}`, gap, text: `מ-${iso(fmtVal(a.unit, a.history.first.v))} ל-${iso(fmtVal(a.unit, a.last.v))}${unitWord(a)}`, href: hrefI(key, a.id) })).sort((x, y) => y.gap - x.gap);
  const line = model.summary && (model.summary.lines || []).find((l) => l.kind === "history");
  return h("section.lb-sec#lb-changes", { "aria-labelledby": "lb-changes-t" },
    secHead("lb-changes-t", "שינוי לאורך השנים", "מה השתנה", line ? line.text : "מה השתנה מאז השנה הראשונה שיש עליה נתון.", seeAll(`#/c/${encodeURIComponent(key)}/trends`, "כל המגמות")),
    h("div.lb-chart.rv", h("p.lb-chart-s", `${movers.length} השינויים הגדולים ביותר, כל אחד לפי השנה הראשונה שיש עליה נתון. ימינה = השתפר. אורך הפס נמדד ביחס להפרש הרגיל בין יישובים באותו מדד, כדי שימים, אחוזים ושיעורים ישתתפו באותה סקאלה.`),
      divergingBars({ items, max, zeroLabel: "ללא שינוי", betterLabel: "השתפר", worseLabel: "הידרדר" })));
}

// ═══════════════════════════ 5. a closing question, over the town ═══════════════════════════
export function closingSection(model) {
  const key = model.city.key, input = h("input", { type: "text", placeholder: "למשל: איפה אנחנו הכי חלשים?", "aria-label": "שאלה לסוכן", autocomplete: "off" });
  const img = (cls, file) => h("img.lb-town." + cls, { src: `assets/lab/${file}`, width: 1536, height: 1024, alt: "", "aria-hidden": "true", loading: "lazy", decoding: "async" });
  // the picture's own sky is the page: its top edge dissolves (a mask), the question sits where the sky would be
  return h("section.lb-close.no-print", { "aria-labelledby": "lb-ask-t" },
    h("div.lb-close-in.rv", h("h2.lb-close-t", { id: "lb-ask-t" }, `יש שאלה על ${model.city.name}?`), h("p", "כתבו במילים שלכם, והסוכן יבנה דף עם התשובה."),
      h("form.lb-ask", { onsubmit: (e) => { e.preventDefault(); const q = input.value.trim(); location.hash = `#/c/${encodeURIComponent(key)}/ask` + (q ? "?q=" + encodeURIComponent(q) : ""); } }, input, h("button.btn.primary", { type: "submit" }, "שאלו"))),
    h("div.lb-scene", { "aria-hidden": "true" }, img("is-day", "town-day.webp"), img("is-dusk", "town-dusk.webp")));
}

// ═══════════════════════════ 6. the sources ═══════════════════════════
export function sourcesSection(model) {
  const src = model.sources || [];
  if (!src.length) return null;
  const by = new Map();
  src.forEach((s) => by.set(s.publisher, (by.get(s.publisher) || 0) + 1));
  return h("section.lb-sec.lb-src#lb-sources", { "aria-labelledby": "lb-src-t" },
    secHead("lb-src-t", "מאיפה המספרים", "מקורות הנתונים", `המידע נאסף ב-${dateHe(model.builtAt)}. בעמוד של כל מדד מופיע המקור המדויק שלו.`),
    h("ul.lb-pubs.rv", [...by].map(([p, n]) => h("li", p, h("b", ltr(String(n)))))),
    h("ul.lb-srclist.rv", src.map((x) => h("li", h("a", { href: x.url, target: "_blank", rel: "noopener" }, icon("link"), " ", x.name), h("span.lb-pub", " · " + x.publisher)))));
}

export { smooth };
