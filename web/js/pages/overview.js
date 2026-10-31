// The overview of one city (DESIGN_V3.md): a hero with the verdict and the status ring, the figures that matter, where to start, what needs attention,
// every domain at a glance, where the city stands in the country, what changed, the gaps inside the city and a short plan.
// Each block uses the chart that fits its data. The sentences come from the model; nothing is invented here (css/pages/overview.css, prefix .ov-).
import { h, svg, icon, num, fmtVal, unitSuffix, ltr, outOf, iso, dateHe, DOMAIN_ICON, statusChip, compareLine, statusReason, countLabel } from "../ui.js";
import { chip, horizonLabel, pageHead } from "../components.js";
import { prioRow, findingList } from "./prio.js";
import { getBriefing, makeBriefing, getMeta, getIndicator, getGeo } from "../api.js";
import { shareBtn, printBtn } from "./shared.js";
import { clamp, toneOfStatus, viz } from "../viz/core.js";
import { statusDonut, progressRing, standingMeter } from "../viz/rings.js";
import { divergingBars, dumbbell, lollipopRank, diffText } from "../viz/compare.js";
import { sparkArea, trajectory, kpiTrajectory, lineChart, indicatorLine, legendOf } from "../viz/time.js";
import { domainStrip, priorityQuadrant } from "../viz/matrix.js";
import { dotMap, locator } from "../viz/spatial.js";

const STRENGTH_LABEL = { strong: "ראיות חזקות", moderate: "ראיות בינוניות", limited: "ראיות מוגבלות" }, EFFORT_LABEL = { low: "נמוך", medium: "בינוני", high: "גבוה" };
const KIND_ICON = { basis: "info", context: "users", state: "bars", concern: "alert", strength: "check", history: "trend", equity: "users" };
const ORDER_NOTE = ["below_target", "trend_down", "equity_sector", "equity_ses", "gap_widening", "level_low"];
const nm = (a) => a.short || a.label;
const hrefI = (key, id) => `#/c/${key}/i/${id}`;
const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const jumpTo = (root, id) => { const el = root.querySelector("#" + id) || root.querySelector("#ov-domains"); if (el) el.scrollIntoView({ behavior: smooth(), block: "start" }); };
const unitWord = (a) => (a.unit !== "%" && unitSuffix(a.unit) ? " " + unitSuffix(a.unit) : "");

// the most telling concern about one parameter, in the finding's own words
function bestNote(model, id) {
  const fs = model.findings.filter((f) => f.indicator === id && f.polarity === "concern");
  fs.sort((a, b) => ORDER_NOTE.indexOf(a.type) - ORDER_NOTE.indexOf(b.type));
  const f = fs.find((x) => x.type !== "level_low") || null;
  return f ? f.text : null;
}

// a numbered section: eyebrow with its number, a title, one lead line, an optional link on the far side
function secHead(no, eyebrow, title, lead, link) {
  return h("div.sec-head.rv", h("div", h("div.sec-eyebrow", no ? h("b", no) : null, eyebrow), h("h2.sec-title", title), lead ? h("p.sec-lead", lead) : null), link || null);
}
const seeAll = (href, text) => h("a.sec-link.no-print", { href }, text, icon("left"));
const section = (id, ...kids) => h("section.sec", { id: "ov-" + id }, ...kids);

// ── 0. the one-time tip ──────────────────────────────────────────────────
function welcome() {
  try { if (localStorage.getItem("cp2-welcome") === "1") return null; } catch (e) { /* private mode */ }
  const box = h("div.ov-tip.no-print", { role: "note" }, h("span.ov-tip-ic", icon("compass")),
    h("p", h("b", "איך קוראים את העמוד: "), "למעלה המסקנה במשפט אחד. אחריה המדדים שכדאי לטפל בהם קודם, ואז כל התחומים. לחיצה על מדד פותחת את ההיסטוריה, ההשוואות וההסבר שלו."),
    h("button", { type: "button", onclick: () => { box.remove(); try { localStorage.setItem("cp2-welcome", "1"); } catch (e) { /* ignore */ } } }, "הבנתי"));
  return box;
}

// ── 1. the hero ──────────────────────────────────────────────────────────
// the two or three lines that carry the verdict: the worst thing, the best thing and the history; with nothing judged, what the model says instead
function heroLines(s) {
  if (!s) return [];
  const first = (k) => s.lines.find((l) => l.kind === k), out = [first("concern"), first("strength"), first("history")].filter(Boolean);
  for (const k of ["state", "context", "basis"]) { if (out.length >= 2) break; const l = first(k); if (l) out.push(l); }
  return out;
}

// the five statuses in plain words, with the thresholds the rule really uses (they arrive with the method numbers)
function statusHow() {
  const note = h("p.note", icon("info"), "הסטטוס נקבע מול כל היישובים, מול היעד הרשמי ומול מגמת העיר עצמה, ולא מול הממוצע הארצי בלבד. לכן מדד יכול להיות טוב מהממוצע הארצי ועדיין לדרוש טיפול. נק׳ = נקודות אחוז.");
  const body = h("div.ov-how-body", note), box = h("details.ov-how", h("summary", icon("info"), "איך נקבע הסטטוס?", icon("down")), body);
  getMeta().then((m) => {
    const R = m.rules;
    body.replaceChildren(h("dl.statusdl",
      [["concern", `הערך בין ${R.concernLevel}% היישובים החלשים ביותר, או שחסרות יותר מ-${R.farBelowTarget} נק׳ ליעד, או שהוא בין ${R.concernWorseningLevel}% החלשים והמגמה בהידרדרות.`],
       ["watch", "כל מה שאינו תקין וגם אינו דורש טיפול: למשל באמצע הדירוג, מתחת ליעד, או במגמת הידרדרות."],
       ["good", `הערך טוב יותר מ-${R.goodLevel}% מהיישובים, עד ${R.nearTarget} נק׳ מתחת ליעד, ואין הידרדרות.`],
       ["strength", `הערך בין ${100 - R.strengthLevel}% היישובים הטובים ביותר, לא מחמיץ יעד, ואין הידרדרות.`],
       ["na", "מדד שמתאר את העיר ואינו נשפט כטוב או רע."]].flatMap(([st, text]) => [h("dt", statusChip(st)), h("dd", text)])),
      note);
  }).catch(() => { /* the rule in words stays */ });
  return box;
}

// no judged figure at all: say so calmly, and why (the model's own sentence), instead of an empty ring
function calmNote(model) {
  const st = model.summary && model.summary.lines.find((l) => l.kind === "state"), small = model.indicators.some((a) => a.last && a.last.reliable === false);
  return h("div.ov-calm", h("span.ov-calm-ic", icon("info")), h("p.ov-calm-t", "אין כאן מדדים שאפשר לשפוט"),
    h("p", st ? st.text : "המדדים שיש עליהם נתון מתארים את היישוב בלבד."),
    small ? h("p.ov-calm-s", "הקבוצה קטנה מכדי להשוות או להסיק. הנתון עצמו מוצג, בלי דירוג, מגמה או המלצה.") : null);
}

function hero(model, root, all, judged) {
  const c = model.city, s = model.summary, key = c.key, lines = heroLines(s);
  const verdict = s ? (s.headline.startsWith(c.name + ": ") ? s.headline.slice(c.name.length + 2) : s.headline) : `${num(model.coverage.have, 0)} מדדים נבדקו ב${c.name}`;
  const fact = (label, value, title) => h("div.hero-fact", title ? { title } : null, h("small", label), h("b", value));          // a small label over its value: no capsule, no icon
  const chips = [c.status && fact("סוג יישוב", c.status), c.district && fact("מחוז", c.district), c.population && fact("אוכלוסייה", ltr(num(c.population, 0))),
    c.sesCluster != null && fact("אשכול חברתי-כלכלי", outOf(c.sesCluster, 10), "אשכול חברתי-כלכלי של הלמ״ס: 1 = הנמוך ביותר, 10 = הגבוה ביותר"),
    model.years && fact("שנות נתונים", ltr(model.years.from + "–" + model.years.to))].filter(Boolean);
  const share = shareBtn(), print = printBtn();                                     // icon buttons in the hero: the words stay for screen readers (css), the title for the pointer
  share.title = "העתקת קישור"; print.title = "הדפסה"; share.classList.add("ov-ibtn"); print.classList.add("ov-ibtn");
  const main = h("div.ov-hero-main",
    h("div.eyebrow.rv", "תמונת מצב"),
    h("h1.rv", c.name),
    chips.length ? h("div.hero-meta.rv", chips) : null,
    h("p.hero-verdict.rv", verdict),
    h("div.hero-actions.no-print.rv", h("a.btn.primary", { href: `#/c/${key}/actions` }, icon("list"), "תוכנית פעולה"), h("a.btn", { href: `#/c/${key}/ask` }, icon("chat"), "שאלו את הסוכן"), share, print));
  // the evidence behind the verdict: the worst thing, the best thing and the history, side by side along the bottom of the hero
  const checks = lines.length ? h("ul.ov-checks.rv", lines.map((l) => h("li.k-" + l.kind, icon(KIND_ICON[l.kind] || "info"),
    h("span", l.text, l.finding ? [" ", h("a", { href: hrefI(key, l.finding.split(":")[0]) }, "לפרטים")] : null)))) : null;

  // the visual: the status ring (centre = what to act on) with the locator tucked in a corner; with nothing judged, a calm note and a bigger locator
  const vis = h("div.hero-visual.ov-vis" + (judged ? "" : ".is-calm"));
  const slot = h("div.ov-loc");
  if (judged) {
    const go = (st) => jumpTo(root, st === "concern" || st === "watch" ? "ov-priorities" : "ov-domains");
    vis.append(h("div.ov-ring.rv", statusDonut({ counts: all, size: 204, onPick: go })),
      h("p.ov-vis-cap", ["מבוסס על ", ltr(String(model.coverage.have)), model.coverage.total > model.coverage.have ? [" מתוך ", ltr(String(model.coverage.total))] : null, " מדדים · ", h("a", { href: `#/c/${encodeURIComponent(model.city.key)}/coverage` }, "מה נמצא ומה חסר")]));
  } else vis.append(slot, h("div.rv", calmNote(model)));
  getGeo().then((geo) => { if (Array.isArray(geo) && geo.length) slot.append(locator({ geo, cityKey: key, width: judged ? 60 : 118, ariaLabel: `מיקום ${c.name} על המפה` })); }).catch(() => { /* no locator */ });

  // a quiet pulse line behind everything
  const pulse = viz(h("div.ov-pulse", { "aria-hidden": "true" }, svg("svg", { viewBox: "0 0 800 120", preserveAspectRatio: "none" }, svg("path", { class: "draw", style: "--len:2400", d: "M0 74H190l22-1 16-44 22 88 18-62 12 19H520l22-1 16-30 20 62 14-36 12 8H800" }))));
  return h("section.hero.ov-hero", pulse, h("div.hero-grid", main, vis), checks, statusHow(), judged ? slot : null);
}

// ── 2. key figures ───────────────────────────────────────────────────────
// the headline figures: important, reliable, not stale if possible, the most pressing first, not more than two from one domain
function keyFigs(model) {
  const key = model.city.key;
  const pool = model.indicators.filter((a) => a.importance >= 3 && a.last && Number.isFinite(a.last.v) && a.last.reliable !== false)
    .sort((x, y) => (x.stale ? 1 : 0) - (y.stale ? 1 : 0) || y.priority - x.priority || y.importance - x.importance);
  const pick = [], per = {};
  for (const a of pool) if (pick.length < 4 && (per[a.domain] || 0) < 2) { pick.push(a); per[a.domain] = (per[a.domain] || 0) + 1; }
  for (const a of pool) if (pick.length < 4 && !pick.includes(a)) pick.push(a);
  pick.sort((x, y) => pool.indexOf(x) - pool.indexOf(y));
  if (!pick.length) return null;
  const figs = pick.map((a) => {
    const L = a.last, cmp = compareLine(a), n = ltr(fmtVal(a.unit, L.v, a.unit === "index" ? 2 : 1));
    n.setAttribute("data-count", "");
    const spark = a.series.length > 1 ? sparkArea(a.series.map((s) => ({ v: s.v, year: s.year })), a.series.map((s) => s.nat), { w: 168, h: 44, unit: a.unit, label: nm(a) }) : null;
    return h("a.keyfig.rv", { href: hrefI(key, a.id) },
      h("span.kf-label", nm(a), h("small", [" · ", ltr(String(L.year))]), a.stale ? h("small.ov-old", "נתון ישן") : null),
      h("span.kf-num", n, unitWord(a) ? h("small", unitWord(a).trim()) : null),
      L.gapNat != null ? h("span.kf-delta.ov-delta.tone-" + cmp.tone, icon(cmp.ic), cmp.text) : null,
      spark ? h("span.ov-kf-spark", spark) : null);
  });
  return h("section.keyfigs.ov-kf", { "aria-label": "המספרים החשובים" }, figs);
}

// ── 3. start here ────────────────────────────────────────────────────────
function recBand(model, rec) {
  const key = model.city.key, kpis = rec.kpis || [], k = kpis[0], ind = k && model.indicators.find((x) => x.id === k.indicator);
  const cfg = k && ind ? kpiTrajectory(k, ind, { width: 440, height: 176 }) : null, steps = (rec.actions || []).slice(0, 3);
  // from today to the target, one pair per figure; the first one is also the chart
  const pair = (q) => h("div.ov-kpi", h("span.ov-kpi-l", q.label), h("div.ov-kpi-row", h("span.ov-kpi-t", "היום"), h("span.ov-kpi-from", q.from)), h("div.ov-kpi-row.is-to", h("span.ov-kpi-t", "יעד"), h("b.ov-kpi-to", q.to)),
    h("span.ov-kpi-y", ["בנתוני שנת ", ltr(String(q.byYear)), q.bench ? [" · ", q.bench] : null]), q.people ? h("span.chip", "כ-" + num(q.people, 0) + " " + (q.noun || "")) : null);
  const meta = h("div.ov-start-meta", rec.owner ? h("span.ov-owner", icon("users"), h("span", h("b", "אחראי: "), rec.owner)) : null,
    h("div.ov-tags", h("span.pill.tone-good", icon("clock"), horizonLabel[rec.horizon] || rec.horizon), rec.effort ? h("span.pill.tone-none", "מאמץ: " + (EFFORT_LABEL[rec.effort] || rec.effort)) : null,
      rec.evidenceStrength ? h("span.pill.tone-none", icon("book"), STRENGTH_LABEL[rec.evidenceStrength] || rec.evidenceStrength) : null),
    !rec.evidenceStrength && rec.evidenceNote ? h("p.ov-evnote", icon("info"), rec.evidenceNote) : null);
  const side = kpis.length ? h("div.ov-start-side",
    h("h3.ov-h3", icon("target"), "איך נדע שהצלחנו"),
    cfg ? h("figure.ov-traj", trajectory(cfg), h("figcaption", h("b", k.label), [" · המסלול עד שנת ", ltr(String(k.byYear))])) : null,
    h("div.ov-kpis", kpis.slice(0, 3).map(pair)),
    h("p.hint", "היעד הוא כחצי מהפער עד נקודת ההשוואה (היעד הרשמי, או הממוצע הארצי), ונמדד בנתוני שנתיים קדימה."),
    meta) : h("div.ov-start-side", h("h3.ov-h3", icon("users"), "מי אחראי, ובכמה זמן"), meta);
  const why = (rec.why || []).slice(0, 3);
  const more = why.length || rec.caveat ? h("details.ov-why", h("summary", "על מה ההמלצה מבוססת", icon("down")),
    why.length ? h("ul", why.map((w) => h("li", w.text || w))) : null, rec.caveat ? h("p.note", icon("info"), rec.caveat) : null) : null;
  return h("section.band.ov-start", { id: "ov-start", "aria-labelledby": "ov-start-t" },
    h("div.ov-start-main",
      h("div.ov-start-head", h("div.sec-eyebrow", h("b", icon("star")), "התחילו כאן"),
        h("div.ov-score", { title: "ציון העדיפות הוא מספר בין 0 ל-100: חומרת הממצאים, חוזק הראיות והמאמץ הנדרש" }, progressRing({ value: rec.score, tone: "good", size: 58, label: "ציון עדיפות" }), h("span", { "aria-hidden": "true" }, "ציון עדיפות"))),
      h("h2.ov-start-title", { id: "ov-start-t" }, rec.title),
      rec.summary ? h("p.ov-start-sum", rec.summary) : null,
      steps.length ? h("ol.ov-steps", steps.map((t, i) => h("li", h("span.ov-step-n", String(i + 1)), i < steps.length - 1 ? h("i.ov-step-line", { "aria-hidden": "true" }) : null, h("span.ov-step-t", t)))) : null,
      more, h("div.ov-start-foot.no-print", seeAll(`#/c/${key}/actions`, "לכל ההמלצות"))),
    side);
}

// no recommendations: start with the first priority and its history
function priorityBand(model, a) {
  const key = model.city.key, why = bestNote(model, a.id) || statusReason(a) || compareLine(a).text, box = h("div.ov-line");
  lineChart(box, indicatorLine(a, model.city.name, { height: 230 }));
  return h("section.band.ov-start", { id: "ov-start", "aria-labelledby": "ov-start-t" },
    h("div.ov-start-main", h("div.sec-eyebrow", h("b", icon("star")), "התחילו כאן"), h("h2.ov-start-title", { id: "ov-start-t" }, nm(a)),
      h("p.ov-start-sum", why), h("div.ov-start-foot.no-print", seeAll(hrefI(key, a.id), "לפרטי המדד"))),
    h("div.ov-start-side", box, legendOf(indicatorLine(a, model.city.name))));
}

// ── 4. what needs attention ──────────────────────────────────────────────
function quadPoints(model) {
  const key = model.city.key;
  return model.indicators.filter((i) => i.priority > 0 && i.last && i.last.reliable !== false).map((i) => {
    const slope = i.history && i.history.slope != null ? i.history.slope : 0, adj = slope * (i.direction === "lower" ? -1 : 1);
    const spread = Math.max((i.last.p75 ?? 0) - (i.last.p25 ?? 0), Math.abs(i.last.v || 0) * 0.05, 1e-6);
    return { id: i.id, label: nm(i), x: i.last.level ?? 0, y: clamp(adj / spread, -1, 1), r: i.priority, tone: toneOfStatus(i.status), href: hrefI(key, i.id) };
  });
}

function prioritiesSec(model) {
  const key = model.city.key, c = model.counts, recs = model.recommendations || [], concrete = recs.filter((r) => !/^rec:(domain_review|sustain_strengths)/.test(r.id));
  const top = model.priorities.slice(0, 5).map((id) => model.indicators.find((x) => x.id === id)).filter(Boolean), pts = quadPoints(model);
  if (!top.length && !pts.length) return null;
  const rest = model.indicators.filter((a) => a.status === "concern" && !top.includes(a)).sort((x, y) => y.priority - x.priority);
  const why = (a) => statusReason(a) || bestNote(model, a.id) || compareLine(a).text;
  const lead = c.concern ? [c.concern === 1 ? "מדד אחד דורש טיפול" : [ltr(String(c.concern)), " מדדים ", countLabel("concern", c.concern)], ". הרשימה מסודרת לפי מקום לשיפור וחשיבות, לא רק לפי מי שהכי נמוך. בכל שורה מסומן אם יש לה המלצה בתוכנית הפעולה."]
    : "אין מדדים שדורשים טיפול. כאן המדדים שיש בהם הכי הרבה מקום לשיפור, לפי חשיבותם.";
  return section("priorities", secHead("01", "עדיפויות", "מה דורש תשומת לב", lead, seeAll(`#/c/${key}/actions`, "לתוכנית הפעולה")),
    h("div.split.ov-split-prio",
      pts.length ? h("div.plot.rv", h("h3.plot-title", "המדדים לפי מצב ומגמה"), h("p.plot-sub", "ימינה = מצב חזק יותר בין היישובים, למעלה = בשיפור. גודל הבועה = עדיפות."),
        priorityQuadrant({ points: pts, height: 400 })) : null,
      top.length ? h("div.plot.rv", h("h3.plot-title", top.length === 1 ? "המדד הראשון" : `${top.length} הראשונים`), h("p.plot-sub", "לחיצה על שורה פותחת את המדד."),
        h("div.rowlist", top.map((a, i) => prioRow(a, i, key, why(a), recs.length ? concrete.some((r) => r.indicators.includes(a.id)) : null)))) : null),
    rest.length ? h("details.ov-more.rv", h("summary", `כל שאר המדדים שדורשים טיפול (${rest.length})`, icon("down")),
      h("ul.ov-rest", rest.map((a) => h("li", h("a", { href: hrefI(key, a.id) }, nm(a)), h("span.ov-rest-v", [ltr(fmtVal(a.unit, a.last.v)), unitWord(a)]), h("div.hint", statusReason(a) || compareLine(a).text))))) : null);
}

// ── 5. every domain ──────────────────────────────────────────────────────
function domainsSec(model, root) {
  const key = model.city.key;
  const domains = model.domains.filter((d) => d.indicators.length).map((d) => ({
    id: d.id, label: d.label, icon: DOMAIN_ICON[d.id] || "bars", href: `#/c/${key}/d/${d.id}`, blurb: (d.blurb || "").split(/[:.]/)[0].trim(),
    indicators: model.indicators.filter((i) => i.domain === d.id).map((i) => ({ id: i.id, label: nm(i), status: i.status, href: hrefI(key, i.id), value: i.last && i.last.v != null ? fmtVal(i.unit, i.last.v) : "", priority: i.priority }))
  }));
  if (!domains.length) return null;
  const small = model.indicators.some((a) => a.last && a.last.reliable === false);
  const how = h("button.ov-linkbtn", { type: "button", onclick: () => { const d = root.querySelector(".ov-how"); if (d) { d.open = true; d.scrollIntoView({ behavior: smooth(), block: "center" }); } } }, "איך נקבע הסטטוס?");
  return section("domains", secHead("02", "תחומים", "מצב כל התחומים", "התחום שמצבו חמור ביותר למעלה. כל כמוסה היא מדד אחד: לחיצה עליה פותחת את המדד, ולחיצה על שם התחום פותחת את כל התחום."),
    h("div.rv", domainStrip({ domains })),
    h("p.ov-note.rv", icon("info"), "הצבע נקבע מול כל היישובים, מול היעד הרשמי ומול מגמת העיר עצמה, ולא מול הממוצע הארצי בלבד. ", small ? "מדד בקבוצה קטנה נשאר אפור: הקבוצה קטנה מכדי להשוות או להסיק. " : null, how));
}

// ── 6. where in the country ──────────────────────────────────────────────
// the chosen indicator: the dot map on one side; the standing, one sentence and the neighbours on the other
function whereBody(model, a, det, geo) {
  const key = model.city.key, L = a.last, I = det.indicator, inMap = det.map.some((p) => String(p.k) === String(key));
  const map = dotMap({ points: det.map, cityKey: key, unit: I.unit, direction: I.direction, nat: L.nat, peers: model.peers.map((p) => p.key), geo, minBase: I.minBase, label: nm(a), height: 640,
    city: inMap ? undefined : { k: key, name: model.city.name, v: null, x: model.city.lon, y: model.city.lat }, onPick: (p) => { location.hash = hrefI(p.k, a.id); } });
  const sentence = ["ב" + model.city.name + ": ", ltr(fmtVal(a.unit, L.v)), unitWord(a), " ב-", ltr(String(L.year)), ". ",
    L.rank != null && L.of ? ["מקום ", ...outOf(L.rank, L.of), " יישובים"] : L.level != null ? ["טוב יותר מ-", ltr(num(L.level, 0) + "%"), " מהיישובים"] : "",
    L.nat != null ? [L.rank != null || L.level != null ? ", " : "", "והממוצע הארצי ", ltr(fmtVal(a.unit, L.nat)), unitWord(a)] : "", "."];
  return h("div.ov-where-grid",
    h("div.ov-map", map),
    h("div.ov-side",
      h("div.ov-side-head", h("h3.ov-h3", a.label), statusChip(a.status)),
      h("p.ov-stand", sentence),
      standingMeter({ level: L.level, rank: L.rank, of: L.of, tone: toneOfStatus(a.status), label: nm(a) }),
      statusReason(a) ? h("p.ov-reason", icon("info"), statusReason(a)) : null,
      h("h4.ov-h4", "מי נמצא לידנו בדירוג"),
      lollipopRank({ items: det.neighbours.map((n) => ({ name: n.name, v: n.v, rank: n.rank, self: n.self, d: n.d, href: hrefI(n.k, a.id) })), unit: I.unit, nat: L.nat, direction: I.direction, selfLabel: "העיר" }),
      seeAll(hrefI(key, a.id), "לעמוד המדד")));
}

function whereSec(model) {
  const key = model.city.key, ok = (a) => a && a.last && a.last.v != null;
  const prio = model.priorities.slice(0, 6).map((id) => model.indicators.find((x) => x.id === id)).filter(ok);
  const strong = model.indicators.filter((a) => ok(a) && a.last.reliable !== false && (a.status === "strength" || a.status === "good") && !prio.includes(a))
    .sort((x, y) => (x.status === "strength" ? 0 : 1) - (y.status === "strength" ? 0 : 1) || (y.last.level || 0) - (x.last.level || 0)).slice(0, 2);
  const options = [...prio, ...strong];
  if (!options.length) return null;
  const body = h("div.ov-where-body", { "aria-live": "polite" });
  let seq = 0;
  const tone = (s) => ({ concern: "t-attn", watch: "t-watch", good: "t-good", strength: "t-good" }[s] || "t-none");
  const btns = options.map((a) => h("button.ov-opt", { type: "button", "aria-pressed": "false", onclick: () => pick(a) }, h("i.ov-dot." + tone(a.status), { "aria-hidden": "true" }), nm(a)));
  const skeleton = () => h("div.ov-where-grid", { "aria-busy": "true", "aria-label": "טוען" }, h("div.sk.ov-sk-map"), h("div.ov-sk-side", h("div.sk", { style: { height: "26px", width: "60%" } }), h("div.sk", { style: { height: "18px", width: "90%" } }), h("div.sk", { style: { height: "64px" } }), h("div.sk", { style: { height: "230px" } })));
  async function pick(a) {
    const my = ++seq;
    btns.forEach((b, i) => b.setAttribute("aria-pressed", String(options[i] === a)));
    if (a.last.reliable === false) {                                   // a small group: no ranking, nothing to fetch
      body.replaceChildren(h("div.ov-small", icon("info"), h("p", [nm(a), ": ", ltr(fmtVal(a.unit, a.last.v)), unitWord(a), ". הקבוצה קטנה מכדי להשוות או להסיק, ולכן אין דירוג ואין מפה."])));
      return;
    }
    body.replaceChildren(skeleton());
    try {
      const [det, geo] = await Promise.all([getIndicator(key, a.id), getGeo().catch(() => undefined)]);
      if (my !== seq) return;
      body.replaceChildren(whereBody(model, a, det, geo));
    } catch (e) {
      if (my !== seq) return;
      body.replaceChildren(h("div.ov-small", icon("alert"), h("p", "לא הצלחנו לטעון את המפה של המדד הזה."), h("button.btn.sm", { type: "button", onclick: () => pick(a) }, "ניסיון נוסף")));
    }
  }
  pick(options[0]);
  return section("where", secHead("03", "מיקום", "איפה אתם בארץ", `בחרו מדד וראו איפה ${model.city.name} נמצאת בין כל יישובי הארץ. כל נקודה במפה היא יישוב, וליד העיר מסומנים יישובים דומים לה.`),
    h("div.ov-opts.no-print.rv", { role: "group", "aria-label": "בחירת מדד" }, btns), body);
}

// ── 7. what changed, and the gap from the nation ─────────────────────────
const spreadOf = (a) => Math.max(Number.isFinite(a.last.p25) && Number.isFinite(a.last.p75) ? a.last.p75 - a.last.p25 : 0, a.unit === "%" ? 5 : Math.abs(a.last.v) * 0.1 || 1);

function changesSec(model) {
  const key = model.city.key, sign = (a) => (a.direction === "lower" ? -1 : 1);
  const movers = model.indicators.filter((a) => !a.stale && a.direction && a.last && a.last.reliable !== false && a.history && a.history.first && a.history.delta != null && a.history.delta !== 0)
    .map((a) => ({ a, gap: (a.history.delta * sign(a)) / spreadOf(a) })).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap)).slice(0, 8).sort((x, y) => y.gap - x.gap);
  const usable = model.indicators.filter((a) => a.direction && a.last && Number.isFinite(a.last.gapNat) && Number.isFinite(a.last.nat) && a.last.reliable !== false && !a.stale);
  const gaps = usable.map((a) => ({ a, gap: (a.last.gapNat * sign(a)) / spreadOf(a) })).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap)).slice(0, 10).sort((x, y) => y.gap - x.gap);
  if (!movers.length && !gaps.length) return null;
  const changeItems = movers.map(({ a, gap }) => ({ id: a.id, label: nm(a), sub: ["מאז ", iso(String(a.history.first.year))].join(""), gap,
    text: `מ-${iso(fmtVal(a.unit, a.history.first.v))} ל-${iso(fmtVal(a.unit, a.last.v))}${unitWord(a)}`, href: hrefI(key, a.id) }));
  const gapItems = gaps.map(({ a, gap }) => ({ id: a.id, label: nm(a), sub: `${iso(fmtVal(a.unit, a.last.v))} לעומת ${iso(fmtVal(a.unit, a.last.nat))} ארצי`, gap, text: diffText(a.unit, a.last.gapNat), href: hrefI(key, a.id) }));
  return section("changes", secHead("04", "שינוי", "מה השתנה, ואיפה הפער מהממוצע הארצי",
    "מה השתנה מאז השנה הראשונה שיש עליה נתון, ואיפה העיר מרוחקת מהממוצע הארצי. אורך הפס נמדד ביחס להפרש הרגיל בין יישובים באותו מדד, כדי שימים, אחוזים ושיעורים ישתתפו באותה סקאלה.",
    seeAll(`#/c/${key}/trends`, "כל המגמות")),
    h("div.split.even.ov-pair",
      movers.length ? h("div.plot.rv", h("h3.plot-title", "מה השתנה מאז השנה הראשונה"), h("p.plot-sub", `${movers.length} השינויים הגדולים ביותר. ימינה = השתפר.`),
        divergingBars({ items: changeItems, zeroLabel: "ללא שינוי", betterLabel: "השתפר", worseLabel: "הידרדר" })) : null,
      gaps.length ? h("div.plot.rv", h("h3.plot-title", "הפער מהממוצע הארצי"), h("p.plot-sub", `${gaps.length} הפערים הגדולים ביותר. ימינה = טוב מהממוצע הארצי.`),
        divergingBars({ items: gapItems, zeroLabel: "ממוצע ארצי" })) : null));
}

// ── 8. gaps inside the city ──────────────────────────────────────────────
function equitySec(model) {
  const key = model.city.key, eqAll = model.findings.filter((f) => f.type.startsWith("equity_")).sort((x, y) => (y.severity || 0) - (x.severity || 0));
  if (!eqAll.length) return null;
  const panels = [];
  for (const f of eqAll) {
    const a = model.indicators.find((x) => x.id === f.indicator), field = f.type === "equity_ses" ? "ses" : "sector", e = a && a.equity && a.equity[field];
    if (e && e.rows && e.rows.length >= 2 && panels.length < 4) panels.push({ f, a, field, e });
  }
  const shown = new Set(panels.map((p) => p.f)), rest = eqAll.filter((f) => !shown.has(f));
  const cut = (l) => String(l).replace(/^אזורים ברמה (חברתית-כלכלית )?/, "");
  const panel = ({ f, a, field, e }) => h("div.ov-eq.rv",
    h("h3.ov-eq-t", h("a", { href: hrefI(key, a.id) }, nm(a)), h("small", field === "ses" ? "לפי רמה חברתית-כלכלית של האזור בעיר" : "בין מגזרים בעיר")),
    h("p.ov-eq-s", f.text),
    dumbbell({ unit: a.unit, shared: true, direction: a.direction, rows: e.rows.map((r) => ({ label: field === "ses" ? cut(r.label) : r.label, href: hrefI(key, a.id), note: `${num(r.d, 0)} בקבוצה`,
      points: [{ key: "nat", label: "ארצי, באותה קבוצה", v: r.natV }, { key: "city", label: model.city.name, v: r.v }] })) }));
  return section("gaps", secHead("05", "פערים", "פערים בתוך העיר", "ממוצע העיר מסתיר הבדלים בין מגזרים ואזורים. כאן הפערים הברורים ביותר, ובכל שורה: הקבוצה בעיר מול אותה קבוצה בארץ."),
    panels.length ? h("div.ov-eq-grid", panels.map(panel)) : null,
    rest.length ? h("details.ov-more.rv", h("summary", panels.length ? `עוד ${rest.length} פערים` : `${rest.length} פערים`, icon("down")), findingList(rest, key)) : null);
}

// ── 9. the plan in short ─────────────────────────────────────────────────
function planSec(model) {
  const key = model.city.key, recs = (model.recommendations || []).slice(1, 5);
  if (!recs.length) return null;
  return section("plan", secHead("06", "תוכנית", "התוכנית בקצרה", "הפעולות הבאות בתור, אחרי הצעד הראשון. בכל אחת: למה, מה עושים ואיך נדע שהצליחה, בעמוד תוכנית הפעולה.", seeAll(`#/c/${key}/actions`, "לכל ההמלצות")),
    h("div.rowlist.ov-plan.rv", recs.map((r, i) => h("a.row-item.ov-plan-row", { href: `#/c/${key}/actions` },
      progressRing({ value: r.score, tone: "good", size: 58, i }),
      h("div", h("div.ri-title", r.title), r.actions && r.actions[0] ? h("div.ri-sub.ov-clamp", [h("b", "צעד ראשון: "), r.actions[0]]) : null),
      h("span.pill.tone-good", icon("clock"), horizonLabel[r.horizon] || r.horizon),
      h("span.ov-go", { "aria-hidden": "true" }, icon("left"))))));
}

// ── 10. the AI briefing, the ask strip, the sources, the jump bar ────────
// the strong model's briefing: written on request (it is a paid call), then kept for everyone until the data is rebuilt
function briefingBand(model) {
  const key = model.city.key, body = h("div.ov-brief-body"), box = h("section.ov-brief.no-print", { hidden: true, "aria-busy": "true", "aria-labelledby": "ov-brief-t" },
    h("div.ov-brief-head", h("div", h("h2.ov-h2", { id: "ov-brief-t" }, icon("spark"), "תקציר מנהלים"), h("p.hint", "המספרים בתקציר נלקחים ישירות מהנתונים הרשמיים. רק הניסוח נכתב על ידי בינה מלאכותית.")), h("span.ai-badge", icon("spark"), "נכתב בבינה מלאכותית")), body);
  const show = (r) => {
    body.replaceChildren(h("p.ov-brief-lead", r.briefing.headline),
      h("div.ov-brief-pts", r.briefing.points.map((p) => h("div.ov-brief-pt", h("h3.ov-h3", p.title), h("p", p.text, p.ids && p.ids[0] ? [" ", h("a", { href: hrefI(key, p.ids[0]) }, "לפרטים")] : null)))),
      h("p.note", icon("info"), r.briefing.caution, " נכתב ב-" + dateHe(r.at) + "."));
    box.hidden = false;
  };
  const ask = () => {
    const btn = h("button.btn.primary", { type: "button", onclick: async () => {
      btn.disabled = true; body.replaceChildren(h("div.loading", h("span.spin"), "הבינה המלאכותית כותבת את התקציר… זה לוקח כחצי דקה."));
      try { const r = await makeBriefing(key); if (r.briefing) show(r); else { box.hidden = true; } } catch (e) { body.replaceChildren(h("div.callout", icon("alert"), e.message), ask()); }
    } }, icon("spark"), "הכינו תקציר");
    return h("div", h("p", { style: { color: "var(--ink-2)", marginBottom: "12px" } }, "תקציר קצר בשפה פשוטה שמחבר בין הממצאים ומציע במה להתחיל. ההכנה נשמרת לשימוש חוזר."), btn);
  };
  getBriefing(key).then((r) => { if (r.briefing) show(r); else if (r.available) { body.replaceChildren(ask()); box.hidden = false; } }).catch(() => { /* no briefing offered */ }).finally(() => box.removeAttribute("aria-busy"));
  return box;
}

function askStrip(model) {
  const key = model.city.key, input = h("input", { type: "text", placeholder: "למשל: איפה אנחנו הכי חלשים?", "aria-label": "שאלה לסוכן", autocomplete: "off" });
  return h("section.ov-ask.no-print.rv", h("div", h("h2.ov-h2", `יש שאלה על ${model.city.name}?`), h("p", "כתבו במילים שלכם, והסוכן יבנה דף עם התשובה.")),
    h("form.askbox", { onsubmit: (e) => { e.preventDefault(); const q = input.value.trim(); location.hash = `#/c/${key}/ask` + (q ? "?q=" + encodeURIComponent(q) : ""); } }, input, h("button.btn.primary", { type: "submit" }, "שאלו")));
}

// where every number comes from: the publishers as pills, then the full linked list (each parameter's own page names its exact source)
function sourcesSec(model) {
  if (!model.sources.length) return null;
  const by = new Map();
  model.sources.forEach((s) => by.set(s.publisher, (by.get(s.publisher) || 0) + 1));
  return section("sources", secHead("", "מקורות", "מקורות הנתונים", `המידע נאסף ב-${dateHe(model.builtAt)}. בעמוד של כל מדד מופיע המקור המדויק שלו.`),
    h("ul.ov-pubs.rv", [...by].map(([p, n]) => h("li", h("span.chip", p, h("b", ltr(String(n))))))),
    h("ul.srclist.rv", model.sources.map((x) => h("li", h("a", { href: x.url, target: "_blank", rel: "noopener" }, icon("link"), " ", x.name), h("span.muted", " · " + x.publisher)))));
}

// a slim pill row that stays under the top bar and follows the part you are reading
function jumpBar(root, parts) {
  const have = parts.filter(([id]) => root.querySelector("#" + id));
  if (have.length < 2) return null;
  const btns = new Map(have.map(([id, label]) => [id, h("button", { type: "button", onclick: () => jumpTo(root, id) }, label)]));
  const nav = h("nav.ov-jump.no-print", { "aria-label": "קפיצה לחלק בעמוד" }, h("div.ov-jump-in", [...btns.values()]));
  if (typeof IntersectionObserver === "function") {
    const live = new Set(), order = have.map(([id]) => id);
    const mark = () => { const cur = order.filter((id) => live.has(id)).pop(); btns.forEach((b, id) => (id === cur ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"))); };
    const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) live.add(e.target.id); else live.delete(e.target.id); }); mark(); }, { rootMargin: "-150px 0px -55% 0px" });
    order.forEach((id) => io.observe(root.querySelector("#" + id)));
  }
  return nav;
}

// ── the page ─────────────────────────────────────────────────────────────
export function overview(model) {
  const key = model.city.key, root = h("div.ov");
  if (!model.coverage.have) {                      // a locality the official sources do not cover: say so, offer the way out
    root.append(pageHead("תמונת מצב", model.city.name, [model.city.status && chip("building", model.city.status), model.city.district && chip("pin", model.city.district), model.city.population && chip("users", ["אוכלוסייה ", ltr(num(model.city.population, 0))])].filter(Boolean), null),
      h("div.card.empty", { style: { marginTop: "24px" } }, icon("info"), h("h2.h3", "אין עדיין נתונים ברמת היישוב הזה"),
        h("p", "המקורות הרשמיים שהמערכת קוראת מהם אינם מפרסמים נתונים על היישוב הזה. בדרך כלל מדובר ביישובים קטנים מאוד, באזורי תעשייה או במרכזים אזוריים."),
        h("a.btn.primary", { href: "#/", style: { marginTop: "14px" } }, icon("search"), "בחירת יישוב אחר")));
    return root;
  }
  const all = model.indicators.reduce((c, i) => ((c[i.status] = (c[i.status] || 0) + 1), c), {});
  const judged = ["concern", "watch", "good", "strength"].reduce((n, k) => n + (all[k] || 0), 0);
  const w = welcome(); if (w) root.append(w);
  const top = hero(model, root, all, judged);
  root.append(top);
  const kf = keyFigs(model); if (kf) root.append(h("div.ov-block", kf));
  const start = (model.recommendations || []).length ? recBand(model, model.recommendations[0]) : (model.priorities || []).length ? priorityBand(model, model.indicators.find((x) => x.id === model.priorities[0]) || model.indicators[0]) : null;
  if (start) root.append(h("div.ov-block.rv", start));
  [prioritiesSec(model), domainsSec(model, root), whereSec(model), changesSec(model), equitySec(model), planSec(model)].forEach((s) => { if (s) root.append(s); });
  root.append(briefingBand(model), askStrip(model));
  const src = sourcesSec(model); if (src) root.append(src);
  const jump = jumpBar(root, [["ov-start", "התחילו כאן"], ["ov-priorities", "מה דורש תשומת לב"], ["ov-domains", "תחומים"], ["ov-where", "איפה בארץ"], ["ov-changes", "מה השתנה"], ["ov-gaps", "פערים"], ["ov-plan", "התוכנית"], ["ov-sources", "מקורות"]]);
  if (jump) top.after(jump);
  return root;
}
