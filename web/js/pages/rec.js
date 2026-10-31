// The recommendation, for every page that shows one. Two things live here:
//   recRow  : a row of the action plan: score ring, title, first step and a few facts; a button opens everything behind it (an accessible disclosure).
//   recCard : the block the other pages place (domain, ask): brief (reasons), lead (reasons, first steps, owner) or full (everything, open).
// View layer only: every sentence and number comes from the recommendation in the city model; nothing is typed here except the labels.
// The strength of the evidence always sits next to the claim, a figure on a small group is never trended or targeted, and a KPI of one
// group inside the city is never drawn on the history of the whole city. Style: css/pages/actions.css (prefix .ac-).
import { h, icon, num, ltr, iso, directionNote, directionIcon } from "../ui.js";
import { uid, motionOn } from "../viz/core.js";
import { progressRing } from "../viz/rings.js";
import { trajectory, kpiTrajectory, sparkArea, numberIn } from "../viz/time.js";
import { dumbbell } from "../viz/compare.js";
import { getCity } from "../api.js";

export const horizonLabel = { quick: `מהיר (עד ${iso("6")} חודשים)`, mid: `בינוני (${iso("6–18")} חודשים)`, long: "אסטרטגי (מעל שנה וחצי)" };
export const HORIZONS = [
  { id: "quick", name: "מהיר", range: `עד ${iso("6")} חודשים` },
  { id: "mid", name: "בינוני", range: `${iso("6–18")} חודשים` },
  { id: "long", name: "אסטרטגי", range: "מעל שנה וחצי" }
];
const HZ = Object.fromEntries(HORIZONS.map((x) => [x.id, x]));
const STRENGTH_WORD = { strong: "חזקות", moderate: "בינוניות", limited: "מוגבלות" };
const STRENGTH_LABEL = { strong: "ראיות חזקות", moderate: "ראיות בינוניות", limited: "ראיות מוגבלות" };
const EFFORT_LABEL = { low: "נמוך", medium: "בינוני", high: "גבוה" };
const NO_STUDY = "ללא מחקר ייעודי";
const SCORE_TITLE = "ציון העדיפות הוא מספר בין 0 ל-100: חומרת הממצאים, חוזק הראיות והמאמץ הנדרש. ככל שהוא גבוה יותר, כך העדיפות גבוהה יותר.";
const TARGET_HINT = "כל יעד נמדד בנתוני שנתיים קדימה. מתחת לכל יעד כתוב איך נקבע.";
const WHY_ICON = { concern: "alert", strength: "check" };

const domainName = (model, id) => { const d = model && model.domains && model.domains.find((x) => x.id === id); return d ? d.label : ""; };
const indOf = (model, id) => (model && model.indicators ? model.indicators.find((x) => x.id === id) || null : null);
const isSmall = (a) => !!(a && a.last && a.last.reliable === false);
const hrefI = (key, id) => `#/c/${key}/i/${id}`;

// ── small parts ──────────────────────────────────────────────────────────
// the score is a priority, not a verdict: the ring wears the colour of the horizon (css), never the "good" green
const ring = (r, size, i = 0) => h("span.ac-ring", { title: SCORE_TITLE }, progressRing({ value: r.score, tone: "city", size, thickness: size > 58 ? 6 : size > 48 ? 5 : 4, label: "ציון עדיפות", i }));
// the first whole sentence of a step (or its first clause when the sentence is long): a closed row never ends in the middle of a word
function firstClause(t, max = 84) {
  const s = String(t || "").trim(), m = /^(.+?[.;!?])(\s|$)/.exec(s), one = (m ? m[1] : s).replace(/[.;]$/, "");
  if (one.length <= max) return one;
  const cut = one.slice(0, max), i = Math.max(cut.lastIndexOf(": "), cut.lastIndexOf(", "), cut.lastIndexOf(" — "));
  return i > 24 ? cut.slice(0, i) : one;
}
const metaLine = (r, generic) => h("p.ac-meta-line", [generic ? "סקירה כללית של התחום · " : null, r.effort ? "מאמץ " + (EFFORT_LABEL[r.effort] || r.effort) : null, r.effort ? " · " : null, r.evidenceStrength ? STRENGTH_LABEL[r.evidenceStrength] || r.evidenceStrength : NO_STUDY]);
const hzWord = (r) => { const x = HZ[r.horizon]; return x ? h("span.ac-hz", { "data-hz": r.horizon }, icon("clock"), h("b", x.name), " · ", x.range) : null; };
const fact = (label, value, cls) => h("div.ac-fact" + (cls ? "." + cls : ""), h("dt", label), h("dd", value));
const factsOf = (r, { owner = true } = {}) => h("dl.ac-facts",
  r.effort ? fact("מאמץ", EFFORT_LABEL[r.effort] || r.effort) : null,
  fact("ראיות", r.evidenceStrength ? STRENGTH_WORD[r.evidenceStrength] || r.evidenceStrength : NO_STUDY),
  owner && r.owner ? fact("אחראי", r.owner, "is-owner") : null);
const sec = (title, hint, ...kids) => secL(4, title, hint, ...kids);
const secL = (lv, title, hint, ...kids) => h("section.ac-sec", h("h" + lv + ".ac-sec-h", title), hint ? h("p.ac-hint", hint) : null, ...kids);
const steps = (list) => h("ol.ac-steps", list.map((t, i) => h("li", h("span.ac-step-n", String(i + 1)), i < list.length - 1 ? h("i.ac-step-line", { "aria-hidden": "true" }) : null, h("span.ac-step-t", t))));
const whyList = (list, key) => h("ul.ac-why", list.map((w) => h("li", h("span.ac-why-ic.p-" + (w.polarity || "info"), icon(WHY_ICON[w.polarity] || "info")),
  h("span", w.text || w, w.indicator ? [" ", h("a", { href: hrefI(key, w.indicator) }, "לפרטים")] : null))));

// ── how we will know: one trajectory per KPI ─────────────────────────────
// A KPI of the whole city is drawn on the city's own history. A KPI of one group inside the city (its label carries the group) has no history of
// its own, so it gets only the way from today to the target: the history of the whole city would end at another level than today's dot.
// the number in the brackets of the benchmark text, e.g. "הממוצע הארצי (66.6%)"
const benchNum = (k) => { const m = /\(([^)]*)\)/.exec(k.bench || ""); return m ? numberIn(m[1]) : null; };
// the sentence that says how this target was set: it is worked out from the three numbers printed with it, and says nothing when they do not fit a rule
function kpiReason(k, ind) {
  const from = numberIn(k.from), to = numberIn(k.to), b = benchNum(k);
  if (from == null || to == null || b == null) return null;
  const half1 = (x) => { const r = Math.round(x * 10) / 10; return num(r, Number.isInteger(r) ? 0 : 1); };
  const gap = Math.abs(b - from), step = Math.abs(to - from), tol = Math.max(0.15, gap * 0.02), pct = !!ind && ind.unit === "%";
  if (gap < 0.05) return null;
  if (Math.abs(step - gap) <= tol) return "הפער קטן, ולכן היעד הוא נקודת ההשוואה עצמה.";
  if (Math.abs(step - gap / 2) <= tol) return "היעד הוא חצי מהפער עד נקודת ההשוואה.";
  if (step < gap / 2 - tol) return pct ? `חצי מהפער הוא ${half1(gap / 2)} נק׳, אבל היעד מוגבל ל-${num(step, 0)} נק׳ בשנתיים, כגודל ההשפעה שהראיות מדווחות.` : "חצי מהפער גדול מהשיפור הריאלי בשנתיים, ולכן היעד מוגבל לגודל ההשפעה שהראיות מדווחות.";
  if (step > gap / 2 + tol) return pct ? `חצי מהפער הוא ${half1(gap / 2)} נק׳, ולכן היעד הוא שיפור של לפחות ${num(step, 0)} נק׳ בשנתיים.` : null;
  return null;
}
function kpiChart(k, ind) {
  if (!ind || isSmall(ind)) return null;
  const group = k.label !== (ind.short || ind.label);
  if (group) {
    // one group inside the city has no history of its own: today, the target and the reference group on one scale show the gap, which is the point
    const from = numberIn(k.from), to = numberIn(k.to), ref = benchNum(k);
    if (from == null || to == null) return null;
    const pts = [{ key: "city", label: "היום", v: from }, { key: "target", label: "יעד", v: to }, ...(ref != null ? [{ key: "sector", label: "נקודת ההשוואה", v: ref }] : [])];
    return dumbbell({ rows: [{ label: k.label, points: pts }], unit: ind.unit, shared: true, direction: ind.direction, ariaLabel: `${k.label}: היום ${k.from}, יעד ${k.to}` });
  }
  const cfg = kpiTrajectory(k, ind, { width: 380, height: 150 });
  return cfg ? trajectory(cfg) : null;
}
function kpiBlock(k, ind, key) {
  const chart = kpiChart(k, ind), small = isSmall(ind), why = small ? null : kpiReason(k, ind);
  return h("div.ac-kpi", h("b.ac-kpi-name", h("a", { href: hrefI(key, k.indicator) }, k.label)),
    ind && ind.label && ind.label !== ind.short ? h("span.ac-kpi-what", "מה נמדד: " + ind.label) : null,
    small ? h("p.ac-dir", icon("info"), "הקבוצה קטנה מכדי להשוות או להסיק, ולכן אין כאן יעד למדידה.") : [
      h("div.ac-kpi-pair", h("span.ac-kpi-from", h("small", "היום"), h("b", k.from)), icon("left"), h("span.ac-kpi-to", h("small", "יעד"), h("b", k.to))),
      chart ? h("div.ac-kpi-chart", chart) : null,
      h("div.ac-kpi-t", h("span.ac-kpi-by", ["בנתוני שנת ", ltr(String(k.byYear)), k.bench ? [" · ", k.bench] : null]),
        why ? h("span.ac-kpi-why", why) : null,
        k.people ? h("span.ac-kpi-ppl", ["משמעות היעד בבני אדם: כ-", num(k.people, 0), " ", k.noun || ""]) : null,
        ind && ind.direction ? h("p.ac-dir", icon(directionIcon(ind.direction)), directionNote(ind.direction)) : null)]);
}

// ── everything behind a recommendation ───────────────────────────────────
export function recBody(r, key, { model, hl = 4 } = {}) {
  const sec = (...a) => secL(hl, ...a);
  const why = r.why || [], list = r.actions || [], kpis = r.kpis || [], learn = r.learnFrom || [], hist = r.history || [], ev = r.evidence || [], notes = r.notes || [];
  const small = (r.indicators || []).map((id) => indOf(model, id)).filter(isSmall);
  const own = (id) => { const k = kpis.find((x) => x.indicator === id && indOf(model, id) && x.label === (indOf(model, id).short || indOf(model, id).label)); return k ? k.from : null; };
  const colA = [
    why.length ? sec("למה זו המלצה", null, whyList(why, key)) : null,
    list.length ? sec("מה עושים", null, steps(list)) : null,
    r.owner ? sec("מי אחראי", null, h("p", r.owner)) : null
  ].filter(Boolean);
  const colB = [
    kpis.length ? sec("איך נדע שהצלחנו", TARGET_HINT, h("div.ac-kpis", kpis.map((k) => kpiBlock(k, indOf(model, k.indicator), key)))) : null,
    learn.length ? sec("יישובים דומים שמצליחים יותר", "כדאי לשוחח איתם: מה הם עושים אחרת?", h("ul.ac-learn", learn.map((l) => {
      const mine = own(l.indicator);
      return h("li", h("a", { href: hrefI(l.key, l.indicator) }, l.name), h("span", [l.label + ": ", h("b", l.value), " ב-", ltr(String(l.year)), mine ? [" · אצלכם: ", mine] : null]));
    }))) : null,
    hist.length ? sec("איך הגענו לכאן ולאן זה מוביל", null, h("ul.ac-hist", hist.map((x) => {
      const ind = indOf(model, x.indicator), pts = ind && !isSmall(ind) ? (ind.series || []).filter((s) => s.v != null) : [];
      const spark = pts.length > 1 ? sparkArea(ind.series.map((s) => ({ v: s.v, year: s.year })), ind.series.map((s) => s.nat), { w: 112, h: 34, unit: ind.unit, label: ind.short || ind.label }) : null;
      return h("li", spark ? h("span.ac-spark", spark) : null, h("span", x.text, " ", h("a", { href: hrefI(key, x.indicator) }, "לפרטים")));
    }))) : null,
    ev.length || r.evidenceNote ? sec("על מה זה נשען", null,
      ev.length ? h("ul.ac-ev", ev.map((e) => h("li", h("a", { href: e.url, target: "_blank", rel: "noopener" }, icon("link"), " ", e.title), " ", h("span.ac-str", STRENGTH_LABEL[e.strength] || e.strength), e.description ? h("p.ac-ev-d", e.description) : null))) : null,
      r.evidenceNote ? h("p.note.ac-note", icon("info"), r.evidenceNote) : null) : null
  ].filter(Boolean);
  return h("div.ac-body",
    r.summary ? h("p.ac-sum", r.summary) : null,
    r.caveat ? h("p.note.ac-note.is-caveat", icon("info"), h("span", h("b", "שימו לב: "), r.caveat)) : null,
    small.length ? h("p.note.ac-note", icon("info"), "הקבוצה קטנה מכדי להשוות או להסיק: " + small.map((a) => a.short || a.label).join(", ") + ".") : null,
    colA.length || colB.length ? h("div.ac-cols" + (colA.length && colB.length ? "" : ".is-one"), colA.length ? h("div.ac-col", colA) : null, colB.length ? h("div.ac-col", colB) : null) : null,
    notes.length ? h("details.ac-notes", h("summary", "איך לקרוא את המספרים בהמלצה הזו"),
      h("ul", notes.map((n) => h("li", n.text, n.url ? [" ", h("a", { href: n.url, target: "_blank", rel: "noopener" }, "מקור")] : null)))) : null);
}

// a printed page cannot unfold what is folded: the small notes open for the printer and close again
if (typeof window !== "undefined" && !window.__acPrint) {
  window.__acPrint = true;
  window.addEventListener("beforeprint", () => document.querySelectorAll("details.ac-notes").forEach((d) => { d.dataset.was = d.open ? "1" : "0"; d.open = true; }));
  window.addEventListener("afterprint", () => document.querySelectorAll("details.ac-notes").forEach((d) => { d.open = d.dataset.was === "1"; }));
}

// ── a row of the plan ────────────────────────────────────────────────────
// The row shows what decides a first look (score, title, first step, effort, evidence, owner); the button opens the rest in place.
// Closed, the rest stays laid out but invisible (css), so its charts are already drawn when it opens and when it is printed.
export function recRow(r, key, { model, index = 0, showHorizon = false, start = false, lead = false } = {}) {
  const id = uid("acr"), tid = id + "-t", mid = id + "-m", lid = id + "-l", dom = domainName(model, r.domain), first = r.actions && r.actions[0];
  const generic = /^domain_review:/.test(r.id || "");          // a general review of a domain: quieter than a concrete action
  const more = h("div.ac-more", { id: mid, hidden: true, role: "group", "aria-labelledby": tid }, recBody(r, key, { model, hl: 5 }));
  const label = h("span", { id: lid }, "פרטים וצעדים");
  const btn = h("button.ac-toggle", { type: "button", "aria-expanded": "false", "aria-controls": mid, "aria-labelledby": `${lid} ${tid}` }, label, icon("down"));
  const row = h("article.ac-rec.rv" + (lead ? ".is-lead" : "") + (generic ? ".is-generic" : ""), { id: r.id, "data-hz": r.horizon },
    h("div.ac-top",
      h("div.ac-ringc", ring(r, lead ? 60 : generic ? 40 : 46, index)),
      h("div.ac-main", showHorizon ? hzWord(r) : null, start ? h("div.ac-start", icon("star"), "התחילו כאן") : null, dom ? h("div.ac-dom", dom) : null, h("h4.ac-title", { id: tid }, r.title),
        first && !generic ? h("p.ac-first", h("b", "צעד ראשון: "), firstClause(first)) : null,
        metaLine(r, generic)),
      btn),
    more);
  const setOpen = (open) => {
    btn.setAttribute("aria-expanded", String(open)); more.hidden = !open; row.classList.toggle("is-open", open);
    label.textContent = open ? "סגירה" : "פרטים וצעדים";
    if (open && motionOn() && more.animate) more.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.7,.2,1)" });
  };
  btn.addEventListener("click", () => setOpen(btn.getAttribute("aria-expanded") !== "true"));
  return row;
}

// ── the block other pages place ──────────────────────────────────────────
// brief: ring, title, summary, two reasons. lead: also the first steps and the owner. full (default): the whole recommendation, open.
export function recCard(r, key, { brief, lead, model } = {}) {
  const dom = domainName(model, r.domain), small = !!(brief || lead);
  const top = h("div.ac-card-top",
    h("div.ac-ringc", ring(r, small ? 56 : 64)),
    h("div.ac-main", h("div.ac-meta", hzWord(r), dom ? h("span.ac-dom", dom) : null), h(brief ? "h3.ac-title" : "h2.ac-title", r.title)),
    factsOf(r, { owner: false }));
  if (!small) {
    const body = recBody(r, key, { model, hl: 3 });
    if (!model) getCity(key).then((m) => { body.replaceWith(recBody(r, key, { model: m, hl: 3 })); }).catch(() => { /* the card stays without charts */ });
    return h("article.ac-card.ac-full.rv", { "data-hz": r.horizon }, top, body);
  }
  const why = (r.why || []).slice(0, 2), list = (r.actions || []).slice(0, 3);
  return h("article.ac-card.rv" + (lead ? ".is-lead" : ".is-brief"), { "data-hz": r.horizon }, top,
    r.summary ? h("p.ac-sum", r.summary) : null,
    h("div.ac-card-cols",
      why.length ? secL(lead ? 3 : 4, "למה זו המלצה", null, whyList(why, key)) : null,
      lead && list.length ? secL(3, "הצעדים הראשונים", null, steps(list)) : null),
    lead && r.owner ? h("p.ac-own", h("b", "אחראי: "), r.owner) : null,
    h("a.ac-card-go.no-print", { href: `#/c/${key}/actions` }, "לתוכנית הפעולה המלאה", icon("left")));
}
