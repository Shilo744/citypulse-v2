// The overview of one city (DESIGN_V3.md, mockup option C): the town's dot map as the hero visual, the verdict as one huge sentence, the status counts as a
// row of numerals, the domain band, the headline figures against similar localities and the nation, the first three priorities. Below: where to start,
// what needs attention, where the city stands, what changed, the gaps inside the city, the plan, the AI briefing and the sources.
// The sentences come from the model; nothing is invented here (css/pages/overview.css, prefix .lm-).
import { h, svg, icon, num, fmtVal, unitSuffix, ltr, outOf, iso, dateHe, DOMAIN_ICON, statusChip, compareLine, statusReason, countLabel, directionNote } from "../../ui.js";
import { chip, horizonLabel, pageHead } from "../../components.js";
import { prioRow, findingList } from "./prio.js";
import { getBriefing, makeBriefing, getMeta, getIndicator, getGeo } from "../../api.js";
import { shareBtn, printBtn } from "../../pages/shared.js";
import { clamp, toneOfStatus, viz } from "../../viz/core.js";
import { progressRing, standingMeter } from "../../viz/rings.js";
import { divergingBars, dumbbell, lollipopRank, diffText } from "../../viz/compare.js";
import { sparkArea, trajectory, kpiTrajectory, lineChart, indicatorLine, legendOf } from "../../viz/time.js";
import { priorityQuadrant, sortDomains } from "../../viz/matrix.js";
import { dotMap } from "../../viz/spatial.js";
import { heroMap, tickRing, miniDumbbell, domainBand } from "./parts.js";

const STRENGTH_LABEL = { strong: "ראיות חזקות", moderate: "ראיות בינוניות", limited: "ראיות מוגבלות" }, EFFORT_LABEL = { low: "נמוך", medium: "בינוני", high: "גבוה" };
const KIND_ICON = { basis: "info", context: "users", state: "bars", concern: "alert", strength: "check", history: "trend", equity: "users" };
const ORDER_NOTE = ["below_target", "trend_down", "equity_sector", "equity_ses", "gap_widening", "level_low"];
const nm = (a) => a.short || a.label;
const hrefI = (key, id) => `#/c/${key}/i/${id}`;
const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const jumpTo = (root, id) => { const el = root.querySelector("#" + id) || root.querySelector("#lm-domains"); if (el) el.scrollIntoView({ behavior: smooth(), block: "start" }); };
const unitWord = (a) => (a.unit !== "%" && unitSuffix(a.unit) ? " " + unitSuffix(a.unit) : "");
const pad2 = (i) => String(i + 1).padStart(2, "0");

// the most telling concern about one parameter, in the finding's own words
function bestNote(model, id) {
  const fs = model.findings.filter((f) => f.indicator === id && f.polarity === "concern");
  fs.sort((a, b) => ORDER_NOTE.indexOf(a.type) - ORDER_NOTE.indexOf(b.type));
  const f = fs.find((x) => x.type !== "level_low") || null;
  return f ? f.text : null;
}

// a section head: a small label, the title as the one message, a lead line, an optional link on the far side
function secHead(eyebrow, title, lead, link) {
  return h("div.lm-sh.rv", h("div", h("div.lm-eyebrow", eyebrow), h("h2.lm-st", title), lead ? h("p.lm-sl", lead) : null), link || null);
}
const seeAll = (href, text) => h("a.sec-link.no-print", { href }, text, icon("left"));
const section = (id, ...kids) => h("section.sec.lm-sec", { id: "lm-" + id }, ...kids);

// ── 0. the one-time tip: one quiet line ──────────────────────────────────
function welcome() {
  try { if (localStorage.getItem("cp2-welcome") === "1") return null; } catch (e) { /* private mode */ }
  const box = h("div.lm-tip.no-print", { role: "note" }, icon("compass"),
    h("p", h("b", "איך קוראים את העמוד: "), "למעלה המסקנה במשפט אחד. אחריה המדדים שכדאי לטפל בהם קודם, ואז כל התחומים. לחיצה על מדד פותחת את ההיסטוריה, ההשוואות וההסבר שלו."),
    h("button", { type: "button", onclick: () => { box.remove(); try { localStorage.setItem("cp2-welcome", "1"); } catch (e) { /* ignore */ } } }, "הבנתי"));
  return box;
}

// ── 1. the hero ──────────────────────────────────────────────────────────
const COUNT_WORD = { concern: (n) => countLabel("concern", n), watch: () => "למעקב", good: (n) => countLabel("good", n), strength: (n) => countLabel("strength", n), none: () => "ללא שיפוט" };

// the domains as the band draws them (worst first); the hero line and the band both read this one list, so they can never disagree
function bandDomains(model) {
  const key = model.city.key;
  return model.domains.filter((d) => d.indicators.length).map((d) => ({ id: d.id, label: d.label, icon: DOMAIN_ICON[d.id] || "bars", href: `#/c/${key}/d/${d.id}`,
    indicators: model.indicators.filter((i) => i.domain === d.id).map((i) => ({ id: i.id, status: i.status })) }));
}
// the first domain of the band, with the reason in numbers: how many of its judged figures need work (or, with none, are on watch)
function weakest(model) {
  const top = sortDomains(bandDomains(model))[0];
  if (!top) return null;
  const c = top.counts, judged = (c.concern || 0) + (c.watch || 0) + (c.good || 0) + (c.strength || 0), st = c.concern ? "concern" : c.watch ? "watch" : null;
  if (!st || !judged) return null;
  const n = c[st], word = st === "concern" ? countLabel("concern", n) : "למעקב";
  return { name: top.label, id: top.id, why: [ltr(String(n)), " מתוך ", ltr(String(judged)), " מדדים ", word] };
}

// the town on the map: the column is as tall as the text beside it; the country is drawn taller than that and slid so that the town sits in the middle
function placeMap(col, map, over) {
  const place = () => {
    const cw = col.clientWidth, ch = col.clientHeight;
    if (!cw || !ch) return;
    const ar = parseFloat(map.style.getPropertyValue("--ar")) || 0.9, mh = clamp(ch * (ch < 420 ? 2.3 : 1.75), 380, 1100), mw = mh * ar, cy = (parseFloat(map.dataset.cy) || 0.5) * mh;
    const set = (k, v) => col.style.setProperty(k, v);                // on the column: both map layers read the same numbers
    set("--mh", mh + "px"); set("--mw", mw + "px"); set("--top", clamp(ch * 0.5 - cy, ch - mh, 0) + "px"); set("--left", (cw - mw) / 2 + "px");
    // the town name must not run past the left edge: slide the whole picture right by what is missing
    const nameEl = over && over.querySelector(".lm-hm-name");
    if (nameEl) { const miss = 20 - (nameEl.getBoundingClientRect().left - col.getBoundingClientRect().left); if (miss > 0) set("--left", (cw - mw) / 2 + miss + "px"); }
  };
  place();
  if (typeof ResizeObserver === "function") new ResizeObserver(place).observe(col);
}

function heroVisual(model) {
  const c = model.city, wrap = h("div.lm-hviz"), col = h("div.lm-hbox");
  wrap.append(col);
  getGeo().then((geo) => {
    if (!Array.isArray(geo) || !geo.length) return;
    const map = heroMap({ geo, cityKey: c.key, city: { name: c.name, x: c.lon, y: c.lat }, ariaLabel: `מפת הארץ: כל יישוב הוא נקודה, ${c.name} מסומנת` });
    col.append(map);
    // the town marker and its name live in a second, unmasked layer on top, so that the soft fade of the dot field never eats the label
    const svgEl = map.querySelector(".lm-hmap-svg"), town = svgEl && svgEl.querySelector(".lm-hmap-town");
    let over = null;
    if (svgEl && town) {
      const top = svgEl.cloneNode(false); over = h("div.lm-hmap.lm-hmap-top", { "aria-hidden": "true" });
      top.append(town); over.append(top); viz(over); col.append(over);
    }
    placeMap(col, map, over);
  }).catch(() => { /* no map: the text stands alone */ });
  return wrap;
}

function facts(model) {
  const c = model.city, fact = (label, value, title) => h("div.hero-fact", title ? { title } : null, h("small", label), h("b", value));
  const list = [c.status && fact("סוג יישוב", c.status), c.district && fact("מחוז", c.district), c.population && fact("אוכלוסייה", ltr(num(c.population, 0))),
    c.sesCluster != null && fact("אשכול חברתי-כלכלי", outOf(c.sesCluster, 10), "אשכול חברתי-כלכלי של הלמ״ס: 1 = הנמוך ביותר, 10 = הגבוה ביותר"),
    model.years && fact("שנות נתונים", ltr(model.years.from + "–" + model.years.to))].filter(Boolean);
  return list.length ? h("div.hero-meta.lm-facts", list) : null;
}

// the verdict: the number to act on, huge, then what it is out of. With nothing judged, a calm sentence.
function verdict(model, all, judged) {
  const c = all.concern || 0;
  if (!judged) {
    const st = model.summary && model.summary.lines.find((l) => l.kind === "state"), small = model.indicators.some((a) => a.last && a.last.reliable === false);
    return h("div.lm-calm", h("h2.lm-calm-t", "אין כאן מדדים שאפשר לשפוט"), h("p", st ? st.text : "המדדים שיש עליהם נתון מתארים את היישוב בלבד."),
      small ? h("p.lm-calm-s", "הקבוצה קטנה מכדי להשוות או להסיק. הנתון עצמו מוצג, בלי דירוג, מגמה או המלצה.") : null);
  }
  const numEl = h("b.lm-num-n", { "data-count": "" }, String(c || judged));
  const text = c ? ["מתוך ", ltr(String(judged)), " מדדים ", c === 1 ? "דורש טיפול" : "דורשים טיפול"] : [ltr(String(judged)), " מדדים נבדקו, ואף אחד מהם אינו דורש טיפול"];
  return h("div.lm-verdict", h("div.lm-num" + (c ? "" : ".is-calm"), judged ? tickRing({ value: c, total: judged }) : null, numEl),
    h("h2.lm-vtext", { "aria-label": c ? `${c} מתוך ${judged} מדדים ${c === 1 ? "דורש טיפול" : "דורשים טיפול"}` : `${judged} מדדים נבדקו, ואף אחד מהם אינו דורש טיפול` }, h("span", { "aria-hidden": "true" }, text)));
}

function counts(model, root, all, judged) {
  const none = model.indicators.length - judged;
  const items = [["concern", all.concern || 0], ["watch", all.watch || 0], ["good", all.good || 0], ["strength", all.strength || 0], ["none", none]].filter(([k, n]) => (judged ? true : k === "none" && n > 0));
  if (!items.length) return null;
  const go = (k) => {
    if (k === "concern") return jumpTo(root, "lm-priorities");
    if (k === "watch") { const d = root.querySelector("#lm-watch"); if (d) { d.open = true; return d.scrollIntoView({ behavior: smooth(), block: "center" }); } return jumpTo(root, "lm-priorities"); }
    jumpTo(root, "lm-domains");
  };
  return h("div.lm-counts", { role: "group", "aria-label": "כמה מדדים בכל מצב" },
    items.map(([k, n]) => h("button.lm-cnt.c-" + k + (n ? "" : ".is-zero"), { type: "button", "aria-label": `${n} ${COUNT_WORD[k](n)}. מעבר לרשימה`, onclick: () => go(k) },
      h("b", { "data-count": "" }, String(n)), h("small", COUNT_WORD[k](n)))));
}

function hero(model, root, all, judged) {
  const c = model.city, key = c.key, wk = judged ? weakest(model) : null;
  const share = shareBtn(), print = printBtn();                                     // icon buttons: the words stay for screen readers (css), the title for the pointer
  share.title = "העתקת קישור"; print.title = "הדפסה"; share.classList.add("lm-ibtn"); print.classList.add("lm-ibtn");
  const weak = wk ? h("p.lm-weak", h("span.lm-weak-l", "התחום שדורש הכי הרבה תשומת לב"), h("span.lm-weak-v", h("a", { href: `#/c/${key}/d/${wk.id}` }, wk.name), h("span.lm-weak-w", wk.why))) : null;
  const cov = model.coverage;
  const cap = h("p.lm-cap", ["מבוסס על ", ltr(String(cov.have)), cov.total > cov.have ? [" מתוך ", ltr(String(cov.total))] : null, " מדדים · ", h("a", { href: `#/c/${encodeURIComponent(key)}/coverage` }, "מה נמצא ומה חסר")]);
  const vd = verdict(model, all, judged); vd.classList.add("rv");
  const main = h("div.lm-hero-main",
    h("div.lm-hero-eyebrow.rv", "תמונת מצב"), h("h1.lm-h1.rv", c.name), vd, weak, counts(model, root, all, judged),
    h("div.lm-actions.no-print", h("a.btn.primary", { href: `#/c/${key}/actions` }, icon("list"), "תוכנית פעולה"), h("a.btn", { href: `#/c/${key}/ask` }, icon("chat"), "שאלו את הסוכן"), share, print),
    cap);
  const vis = heroVisual(model), fx = facts(model); if (fx) vis.append(fx);
  return h("section.lm-hero", h("div.lm-hero-grid", main, vis));
}

// ── 1b. the domain band, the legend, the two lines that are not on the first screen ─────────────
// the five statuses in plain words, with the thresholds the rule really uses (they arrive with the method numbers)
function statusHow() {
  const note = h("p.note", icon("info"), "הסטטוס נקבע מול כל היישובים, מול היעד הרשמי ומול מגמת העיר עצמה, ולא מול הממוצע הארצי בלבד. לכן מדד יכול להיות טוב מהממוצע הארצי ועדיין לדרוש טיפול. נק׳ = נקודות אחוז.");
  const body = h("div.lm-how-body", note), box = h("details.lm-how", h("summary", "איך נקבע הסטטוס?", icon("down")), body);
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

function domainsSec(model) {
  const key = model.city.key, domains = bandDomains(model);
  if (!domains.length) return null;
  const small = model.indicators.some((a) => a.last && a.last.reliable === false), s = model.summary, first = (k) => s && s.lines.find((l) => l.kind === k);
  const lines = [first("strength"), first("history")].filter(Boolean);
  const key2 = (cls, text) => h("span", h("i." + cls, { "aria-hidden": "true" }), text);
  return h("section.lm-domains", { id: "lm-domains", "aria-labelledby": "lm-dom-t" },
    h("h2.lm-h2.rv", { id: "lm-dom-t" }, "תחומי הבריאות"),
    domainBand({ domains }),
    h("div.lm-key.rv", key2("k-attn", "דורש טיפול"), key2("k-watch", "למעקב"), key2("k-good", "תקין או חוזק"), key2("k-none", "ללא שיפוט"), h("span.lm-key-h", "לחיצה על תחום פותחת אותו.", small ? " מדד בקבוצה קטנה נשאר אפור: הקבוצה קטנה מכדי להשוות או להסיק." : "")),
    lines.length ? h("ul.lm-lines.rv", lines.map((l) => h("li.k-" + l.kind, icon(KIND_ICON[l.kind] || "info"), h("span", l.text, l.finding ? [" ", h("a", { href: hrefI(key, l.finding.split(":")[0]) }, "לפרטים")] : null)))) : null,
    h("div.rv", statusHow()));
}

// ── 2. the headline figures, against similar localities and the nation ───
// important, reliable, not stale if possible, a known direction, the most pressing first, not more than two from one domain; small groups only to fill up
function keyPick(model) {
  const top3 = new Set((model.priorities || []).slice(0, 3));                       // those three have their own list next to this one: they come last here
  const ok = (a) => a.importance >= 3 && a.last && Number.isFinite(a.last.v), rel = model.indicators.filter((a) => ok(a) && a.last.reliable !== false)
    .sort((x, y) => (top3.has(x.id) ? 1 : 0) - (top3.has(y.id) ? 1 : 0) || (x.stale ? 1 : 0) - (y.stale ? 1 : 0) || (x.direction ? 0 : 1) - (y.direction ? 0 : 1) || y.priority - x.priority || y.importance - x.importance);
  const pick = [], per = {};
  for (const a of rel) if (pick.length < 5 && (per[a.domain] || 0) < 2) { pick.push(a); per[a.domain] = (per[a.domain] || 0) + 1; }
  for (const a of rel) if (pick.length < 5 && !pick.includes(a)) pick.push(a);
  if (pick.length < 3) {
    const small = model.indicators.filter((a) => a.last && Number.isFinite(a.last.v) && a.last.reliable === false && !pick.includes(a)).sort((x, y) => y.importance - x.importance || x.id.localeCompare(y.id));
    for (const a of small) if (pick.length < 4) pick.push(a);
  }
  return pick;
}

function keyRow(model, a) {
  const key = model.city.key, L = a.last, small = L.reliable === false, cmp = small ? null : compareLine(a);
  const n = ltr(fmtVal(a.unit, L.v, a.unit === "index" ? 2 : 1));
  if (!small) n.setAttribute("data-count", "");
  const spark = !small && a.series.length > 1 ? sparkArea(a.series.map((s) => ({ v: s.v, year: s.year })), a.series.map((s) => s.nat), { w: 84, h: 34, unit: a.unit, label: nm(a) }) : null;
  const cmpEl = small ? null : miniDumbbell(a, model.city.name, { w: 214, h: 50 });
  const hollow = svg("svg", { class: "lm-hollow", viewBox: "0 0 24 24", width: 20, height: 20, "aria-hidden": "true" }, svg("circle", { cx: 12, cy: 12, r: 6, fill: "none" }));
  return h("li.lm-kr.rv" + (small ? ".is-small" : ""),
    h("div.lm-kr-name", h("a", { href: hrefI(key, a.id), title: a.label }, a.label),
      h("small", [ltr(String(L.year)), a.stale ? " · נתון ישן" : "", small ? "" : " · " + directionNote(a.direction)]),
      small ? h("span.lm-kr-note", hollow, "הקבוצה קטנה מכדי להשוות או להסיק") : L.gapNat != null ? h("span.lm-delta.tone-" + cmp.tone, icon(cmp.ic), cmp.text) : null),
    h("div.lm-kr-val", h("b", n), unitWord(a) ? h("small", unitWord(a).trim()) : null, spark ? h("div.lm-kr-spark", spark) : null),
    h("div.lm-kr-cmp", cmpEl || (small ? null : h("span.lm-kr-none", "אין ממוצע ארצי או יישובים דומים להשוואה"))));
}

function keyBlock(model, pick) {
  const c = model.city.name, lg = (cls, text) => h("span", h("i." + cls, { "aria-hidden": "true" }), text), anyDir = pick.some((a) => a.direction && a.last.reliable !== false);
  return h("div.lm-keyblock", h("h2.lm-h2.rv", "המדדים המרכזיים"),
    h("div.lm-lg.rv", lg("l-city", c), lg("l-peer", "יישובים דומים"), lg("l-nat", "ממוצע ארצי"),
      anyDir ? h("span.lm-lg-better", "טוב יותר", svg("svg", { viewBox: "0 0 24 8", width: 24, height: 8, "aria-hidden": "true" }, svg("path", { d: "M1 4H22M18 1l4 3-4 3", fill: "none" }))) : null),
    anyDir ? h("p.lm-kb-note.rv", "בכל שורה הצד הימני של הציר הוא הטוב יותר. מתחת לשם כתוב אם מספר גבוה טוב או נמוך.") : null,
    h("ul.lm-krs", pick.map((a) => keyRow(model, a))));
}

// the first three priorities: a plain numbered list
function priorityList(model) {
  const key = model.city.key, recs = model.recommendations || [], concrete = recs.filter((r) => !/^rec:(domain_review|sustain_strengths)/.test(r.id));
  const top = model.priorities.slice(0, 3).map((id) => model.indicators.find((x) => x.id === id)).filter(Boolean);
  if (!top.length) return null;
  const why = (a) => statusReason(a) || bestNote(model, a.id) || compareLine(a).text;
  return h("div.lm-prlist", h("h2.lm-h2.rv", "סדרי עדיפויות"),
    h("ol.lm-pl", top.map((a, i) => h("li.rv", h("span.lm-pl-n", { "aria-hidden": "true" }, pad2(i)),
      h("div", h("a.lm-pl-t", { href: hrefI(key, a.id) }, a.label), h("p.lm-pl-w", why(a)),
        recs.length ? h("span.pill." + (concrete.some((r) => r.indicators.includes(a.id)) ? "tone-good" : "tone-none"), icon(concrete.some((r) => r.indicators.includes(a.id)) ? "list" : "minus"), concrete.some((r) => r.indicators.includes(a.id)) ? "יש המלצה בתוכנית הפעולה" : "אין עדיין המלצה בתוכנית") : null)))),
    seeAll(`#/c/${key}/actions`, "לתוכנית הפעולה"));
}

// ── 3. start here ────────────────────────────────────────────────────────
function recBand(model, rec) {
  const key = model.city.key, kpis = rec.kpis || [], k = kpis[0], ind = k && model.indicators.find((x) => x.id === k.indicator);
  const cfg = k && ind ? kpiTrajectory(k, ind, { width: 440, height: 176 }) : null, steps = (rec.actions || []).slice(0, 3);
  // from today to the target, one pair per figure; the first one is also the chart
  const pair = (q) => h("div.lm-kpi", h("span.lm-kpi-l", q.label), h("div.lm-kpi-row", h("span.lm-kpi-t", "היום"), h("span.lm-kpi-from", q.from)), h("div.lm-kpi-row.is-to", h("span.lm-kpi-t", "יעד"), h("b.lm-kpi-to", q.to)),
    h("span.lm-kpi-y", ["בנתוני שנת ", ltr(String(q.byYear)), q.bench ? [" · ", q.bench] : null]), q.people ? h("span.lm-kpi-y", "כ-" + num(q.people, 0) + " " + (q.noun || "")) : null);
  const meta = h("div.lm-start-meta", rec.owner ? h("span.lm-owner", icon("users"), h("span", h("b", "אחראי: "), rec.owner)) : null,
    h("div.lm-tags", h("span.pill.tone-good", icon("clock"), horizonLabel[rec.horizon] || rec.horizon), rec.effort ? h("span.pill.tone-none", "מאמץ: " + (EFFORT_LABEL[rec.effort] || rec.effort)) : null,
      rec.evidenceStrength ? h("span.pill.tone-none", icon("book"), STRENGTH_LABEL[rec.evidenceStrength] || rec.evidenceStrength) : null),
    !rec.evidenceStrength && rec.evidenceNote ? h("p.lm-evnote", icon("info"), rec.evidenceNote) : null);
  const side = kpis.length ? h("div.lm-start-side",
    h("h3.lm-h3", icon("target"), "איך נדע שהצלחנו"),
    cfg ? h("figure.lm-traj", trajectory(cfg), h("figcaption", h("b", k.label), [" · המסלול עד שנת ", ltr(String(k.byYear))])) : null,
    h("div.lm-kpis", kpis.slice(0, 3).map(pair)),
    h("p.hint", "היעד הוא כחצי מהפער עד נקודת ההשוואה (היעד הרשמי, או הממוצע הארצי), ונמדד בנתוני שנתיים קדימה."),
    meta) : h("div.lm-start-side", h("h3.lm-h3", icon("users"), "מי אחראי, ובכמה זמן"), meta);
  const why = (rec.why || []).slice(0, 3);
  const more = why.length || rec.caveat ? h("details.lm-why", h("summary", "על מה ההמלצה מבוססת", icon("down")),
    why.length ? h("ul", why.map((w) => h("li", w.text || w))) : null, rec.caveat ? h("p.note", icon("info"), rec.caveat) : null) : null;
  return h("section.band.lm-start", { id: "lm-start", "aria-labelledby": "lm-start-t" },
    h("div.lm-start-main",
      h("div.lm-start-head", h("div.lm-eyebrow", "התחילו כאן"),
        h("div.lm-score", { title: "ציון העדיפות הוא מספר בין 0 ל-100: חומרת הממצאים, חוזק הראיות והמאמץ הנדרש" }, progressRing({ value: rec.score, tone: "good", size: 58, label: "ציון עדיפות" }), h("span", { "aria-hidden": "true" }, "ציון עדיפות"))),
      h("h2.lm-start-title", { id: "lm-start-t" }, rec.title),
      rec.summary ? h("p.lm-start-sum", rec.summary) : null,
      steps.length ? h("ol.lm-steps", steps.map((t, i) => h("li", h("span.lm-step-n", String(i + 1)), i < steps.length - 1 ? h("i.lm-step-line", { "aria-hidden": "true" }) : null, h("span.lm-step-t", t)))) : null,
      more, h("div.lm-start-foot.no-print", seeAll(`#/c/${key}/actions`, "לכל ההמלצות"))),
    side);
}

// no recommendations: start with the first priority and its history
function priorityBand(model, a) {
  const key = model.city.key, why = bestNote(model, a.id) || statusReason(a) || compareLine(a).text, box = h("div.lm-line");
  lineChart(box, indicatorLine(a, model.city.name, { height: 230 }));
  return h("section.band.lm-start", { id: "lm-start", "aria-labelledby": "lm-start-t" },
    h("div.lm-start-main", h("div.lm-eyebrow", "התחילו כאן"), h("h2.lm-start-title", { id: "lm-start-t" }, nm(a)),
      h("p.lm-start-sum", why), h("div.lm-start-foot.no-print", seeAll(hrefI(key, a.id), "לפרטי המדד"))),
    h("div.lm-start-side", box, legendOf(indicatorLine(a, model.city.name))));
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
  const all = model.priorities.map((id) => model.indicators.find((x) => x.id === id)).filter(Boolean), next = all.slice(3), pts = quadPoints(model);
  const watch = model.indicators.filter((a) => a.status === "watch" && a.last && a.last.v != null).sort((x, y) => y.priority - x.priority);
  const rest = model.indicators.filter((a) => a.status === "concern" && !all.includes(a)).sort((x, y) => y.priority - x.priority);
  if (!all.length && !pts.length && !rest.length && !watch.length) return null;
  const why = (a) => statusReason(a) || bestNote(model, a.id) || compareLine(a).text;
  const lead = c.concern ? [c.concern === 1 ? "מדד אחד דורש טיפול" : [ltr(String(c.concern)), " מדדים ", countLabel("concern", c.concern)], ". הרשימה מסודרת לפי מקום לשיפור וחשיבות, לא רק לפי מי שהכי נמוך. שלושת הראשונים מופיעים למעלה."]
    : "אין מדדים שדורשים טיפול. כאן המדדים שיש בהם הכי הרבה מקום לשיפור, לפי חשיבותם.";
  const list = (a) => h("li", h("a", { href: hrefI(key, a.id) }, a.label), h("span.lm-rest-v", [ltr(fmtVal(a.unit, a.last.v)), unitWord(a)]), h("div.hint", statusReason(a) || compareLine(a).text));
  const sec = section("priorities", secHead("עדיפויות", "מה דורש תשומת לב", lead, seeAll(`#/c/${key}/actions`, "לתוכנית הפעולה")),
    pts.length || next.length ? h("div.split.lm-split-prio",
      pts.length ? h("div.plot.rv", h("h3.plot-title", "המדדים לפי מצב ומגמה"), h("p.plot-sub", "ימינה = מצב חזק יותר בין היישובים, למעלה = בשיפור. כל בועה היא מדד; מעבר על שורה מסמן את הבועה שלה."),
        priorityQuadrant({ points: pts, height: 400 })) : null,
      next.length ? h("div.plot.rv", h("h3.plot-title", "הבאים בתור"), h("p.plot-sub", "לחיצה על שורה פותחת את המדד."),
        h("div.rowlist.lm-next", next.map((a, i) => prioRow(a, i + 3, key, why(a), recs.length ? concrete.some((r) => r.indicators.includes(a.id)) : null)))) : null) : null,
    rest.length ? h("details.lm-more.rv", h("summary", `כל שאר המדדים שדורשים טיפול (${rest.length})`, icon("down")), h("ul.lm-rest", rest.map(list))) : null,
    watch.length ? h("details.lm-more.rv", { id: "lm-watch" }, h("summary", `המדדים שבמעקב (${watch.length})`, icon("down")), h("ul.lm-rest", watch.map(list))) : null);
  // a row of the list lights up its bubble in the chart (the chart's own hover, driven from here)
  const bub = (row) => { const href = row.getAttribute("href"); return href ? [...sec.querySelectorAll("a.v-mx-bub")].find((b) => b.getAttribute("href") === href) : null; };
  const fire = (row, type) => { const b = bub(row); if (b) b.dispatchEvent(new Event(type)); };
  sec.querySelectorAll(".lm-next a.lm-prio").forEach((row) => {
    row.addEventListener("pointerenter", () => fire(row, "pointerenter")); row.addEventListener("pointerleave", () => fire(row, "pointerleave"));
    row.addEventListener("focus", () => fire(row, "pointerenter")); row.addEventListener("blur", () => fire(row, "pointerleave"));
  });
  return sec;
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
  return h("div.lm-where-grid",
    h("div.lm-map", map),
    h("div.lm-side",
      h("div.lm-side-head", h("h3.lm-h3", a.label), statusChip(a.status)),
      h("p.lm-stand", sentence),
      h("p.lm-dirnote", directionNote(a.direction)),
      standingMeter({ level: L.level, rank: L.rank, of: L.of, tone: toneOfStatus(a.status), label: nm(a) }),
      statusReason(a) ? h("p.lm-reason", icon("info"), statusReason(a)) : null,
      h("h4.lm-h4", "מי נמצא לידנו בדירוג"),
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
  const body = h("div.lm-where-body", { "aria-live": "polite" });
  let seq = 0;
  const tone = (s) => ({ concern: "t-attn", watch: "t-watch", good: "t-good", strength: "t-good" }[s] || "t-none");
  const btns = options.map((a) => h("button.lm-opt", { type: "button", "aria-pressed": "false", onclick: () => pick(a) }, h("i.lm-dot." + tone(a.status), { "aria-hidden": "true" }), nm(a)));
  const skeleton = () => h("div.lm-where-grid", { "aria-busy": "true", "aria-label": "טוען" }, h("div.sk.lm-sk-map"), h("div.lm-sk-side", h("div.sk", { style: { height: "26px", width: "60%" } }), h("div.sk", { style: { height: "18px", width: "90%" } }), h("div.sk", { style: { height: "64px" } }), h("div.sk", { style: { height: "230px" } })));
  async function pick(a) {
    const my = ++seq;
    btns.forEach((b, i) => b.setAttribute("aria-pressed", String(options[i] === a)));
    if (a.last.reliable === false) {                                   // a small group: no ranking, nothing to fetch
      body.replaceChildren(h("div.lm-small", icon("info"), h("p", [nm(a), ": ", ltr(fmtVal(a.unit, a.last.v)), unitWord(a), ". הקבוצה קטנה מכדי להשוות או להסיק, ולכן אין דירוג ואין מפה."])));
      return;
    }
    body.replaceChildren(skeleton());
    try {
      const [det, geo] = await Promise.all([getIndicator(key, a.id), getGeo().catch(() => undefined)]);
      if (my !== seq) return;
      body.replaceChildren(whereBody(model, a, det, geo));
    } catch (e) {
      if (my !== seq) return;
      body.replaceChildren(h("div.lm-small", icon("alert"), h("p", "לא הצלחנו לטעון את המפה של המדד הזה."), h("button.btn.sm", { type: "button", onclick: () => pick(a) }, "ניסיון נוסף")));
    }
  }
  pick(options[0]);
  return section("where", secHead("מיקום", "איפה אתם בארץ", `בחרו מדד וראו איפה ${model.city.name} נמצאת בין כל יישובי הארץ. כל נקודה במפה היא יישוב, וליד העיר מסומנים יישובים דומים לה.`),
    h("div.lm-opts.no-print.rv", { role: "group", "aria-label": "בחירת מדד" }, btns), body);
}

// ── 7. what changed, and the gap from the nation ─────────────────────────
const spreadOf = (a) => Math.max(Number.isFinite(a.last.p25) && Number.isFinite(a.last.p75) ? a.last.p75 - a.last.p25 : 0, a.unit === "%" ? 5 : Math.abs(a.last.v) * 0.1 || 1);

function changesSec(model) {
  const key = model.city.key, sign = (a) => (a.direction === "lower" ? -1 : 1);
  const movers = model.indicators.filter((a) => !a.stale && a.direction && a.last && a.last.reliable !== false && a.history && a.history.first && a.history.delta != null && a.history.delta !== 0)
    .map((a) => ({ a, gap: (a.history.delta * sign(a)) / spreadOf(a) })).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap)).slice(0, 8);
  const usable = model.indicators.filter((a) => a.direction && a.last && Number.isFinite(a.last.gapNat) && Number.isFinite(a.last.nat) && a.last.reliable !== false && !a.stale);
  const gaps = usable.map((a) => ({ a, gap: (a.last.gapNat * sign(a)) / spreadOf(a) })).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap)).slice(0, 10);
  if (!movers.length && !gaps.length) return null;
  const SHOW = 5, byGap = (x, y) => y.gap - x.gap;
  const changeItem = ({ a, gap }) => ({ id: a.id, label: nm(a), sub: ["מאז ", iso(String(a.history.first.year))].join(""), gap,
    text: `מ-${iso(fmtVal(a.unit, a.history.first.v))} ל-${iso(fmtVal(a.unit, a.last.v))}${unitWord(a)}`, href: hrefI(key, a.id) });
  const gapItem = ({ a, gap }) => ({ id: a.id, label: nm(a), sub: `${iso(fmtVal(a.unit, a.last.v))} לעומת ${iso(fmtVal(a.unit, a.last.nat))} ארצי`, gap, text: diffText(a.unit, a.last.gapNat), href: hrefI(key, a.id) });
  // the five biggest first; the rest behind one fold, drawn on the same scale as the five so that the bars stay comparable
  const chart = (list, make, opts) => {
    const max = list.reduce((m, x) => Math.max(m, Math.abs(x.gap)), 0), head = list.slice(0, SHOW).sort(byGap), tail = list.slice(SHOW).sort(byGap);
    return [divergingBars({ items: head.map(make), max, ...opts }),
      tail.length ? h("details.lm-fold", h("summary", `עוד ${tail.length}`, icon("down")), divergingBars({ items: tail.map(make), max, ...opts })) : null];
  };
  return section("changes", secHead("שינוי", "מה השתנה, ואיפה הפער מהממוצע הארצי",
    "מה השתנה מאז השנה הראשונה שיש עליה נתון, ואיפה העיר מרוחקת מהממוצע הארצי. אורך הפס נמדד ביחס להפרש הרגיל בין יישובים באותו מדד, כדי שימים, אחוזים ושיעורים ישתתפו באותה סקאלה.",
    seeAll(`#/c/${key}/trends`, "כל המגמות")),
    h("div.split.even.lm-pair",
      movers.length ? h("div.plot.rv", h("h3.plot-title", "מה השתנה מאז השנה הראשונה"), h("p.plot-sub", `${Math.min(SHOW, movers.length)} השינויים הגדולים ביותר. ימינה = השתפר.`),
        chart(movers, changeItem, { zeroLabel: "ללא שינוי", betterLabel: "השתפר", worseLabel: "הידרדר" })) : null,
      gaps.length ? h("div.plot.rv", h("h3.plot-title", "הפער מהממוצע הארצי"), h("p.plot-sub", `${Math.min(SHOW, gaps.length)} הפערים הגדולים ביותר. ימינה = טוב מהממוצע הארצי.`),
        chart(gaps, gapItem, { zeroLabel: "ממוצע ארצי" })) : null));
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
  const panel = ({ f, a, field, e }) => h("div.lm-eq.rv",
    h("h3.lm-eq-t", h("a", { href: hrefI(key, a.id) }, a.label), h("small", field === "ses" ? "לפי רמה חברתית-כלכלית של האזור בעיר" : "בין מגזרים בעיר")),
    h("p.lm-eq-s", f.text),
    dumbbell({ unit: a.unit, shared: true, direction: a.direction, rows: e.rows.map((r) => ({ label: field === "ses" ? cut(r.label) : r.label, href: hrefI(key, a.id), note: `${num(r.d, 0)} בקבוצה`,
      points: [{ key: "nat", label: "ארצי, באותה קבוצה", v: r.natV }, { key: "city", label: model.city.name, v: r.v }] })) }));
  return section("gaps", secHead("פערים", "פערים בתוך העיר", "ממוצע העיר מסתיר הבדלים בין מגזרים ואזורים. כאן הפערים הברורים ביותר, ובכל שורה: הקבוצה בעיר מול אותה קבוצה בארץ."),
    panels.length ? h("div.lm-eq-grid", panels.map(panel)) : null,
    rest.length ? h("details.lm-more.rv", h("summary", panels.length ? `עוד ${rest.length} פערים` : `${rest.length} פערים`, icon("down")), findingList(rest, key)) : null);
}

// ── 9. the plan in short ─────────────────────────────────────────────────
function planSec(model) {
  const key = model.city.key, recs = (model.recommendations || []).slice(1, 5);
  if (!recs.length) return null;
  return section("plan", secHead("תוכנית", "התוכנית בקצרה", "הפעולות הבאות בתור, אחרי הצעד הראשון. בכל אחת: למה, מה עושים ואיך נדע שהצליחה, בעמוד תוכנית הפעולה.", seeAll(`#/c/${key}/actions`, "לכל ההמלצות")),
    h("div.rowlist.lm-plan.rv", recs.map((r, i) => h("a.row-item.lm-plan-row", { href: `#/c/${key}/actions` },
      h("div.lm-plan-sc", { title: "ציון העדיפות הוא מספר בין 0 ל-100: חומרת הממצאים, חוזק הראיות והמאמץ הנדרש" }, progressRing({ value: r.score, tone: "good", size: 58, i, label: "ציון עדיפות" }), i === 0 ? h("small", { "aria-hidden": "true" }, "ציון עדיפות") : null),
      h("div", h("div.ri-title", r.title), r.actions && r.actions[0] ? h("div.ri-sub.lm-clamp", [h("b", "צעד ראשון: "), r.actions[0]]) : null),
      h("span.pill.tone-good", icon("clock"), horizonLabel[r.horizon] || r.horizon),
      h("span.lm-go", { "aria-hidden": "true" }, icon("left"))))));
}

// ── 10. the AI briefing, the ask strip, the sources, the jump bar ────────
// the strong model's briefing: written on request (it is a paid call), then kept for everyone until the data is rebuilt
// a written summary sits right under the counts; the offer to write one (a paid call) is not worth the top of the page and moves down beside the ask strip
function briefingBand(model, late) {
  const key = model.city.key, body = h("div.lm-brief-body"), box = h("section.lm-brief.no-print", { hidden: true, "aria-busy": "true", "aria-labelledby": "lm-brief-t" },
    h("div.lm-brief-head", h("h2.lm-h2", { id: "lm-brief-t" }, icon("spark"), "תקציר מנהלים"), h("span.ai-badge", icon("spark"), "נכתב בבינה מלאכותית")), body);
  const show = (r) => {
    const pts = r.briefing.points || [];
    body.replaceChildren(h("p.lm-brief-lead", r.briefing.headline),
      h("p.lm-brief-note", icon("info"), r.briefing.caution, " המספרים נלקחים ישירות מהנתונים הרשמיים, רק הניסוח נכתב בבינה מלאכותית. נכתב ב-" + dateHe(r.at) + "."),
      pts.length ? h("details.lm-more.lm-brief-more", h("summary", `${pts.length === 1 ? "הנקודה" : "הנקודות"} שמאחורי התקציר (${pts.length})`, icon("down")),
        h("div.lm-brief-pts", pts.map((p) => h("div.lm-brief-pt", h("h3.lm-h3", p.title), h("p", p.text, p.ids && p.ids[0] ? [" ", h("a", { href: hrefI(key, p.ids[0]) }, "לפרטים")] : null))))) : null);
    box.hidden = false;
  };
  const ask = () => {
    const btn = h("button.btn.primary", { type: "button", onclick: async () => {
      btn.disabled = true; body.replaceChildren(h("div.loading", h("span.spin"), "הבינה המלאכותית כותבת את התקציר… זה לוקח כחצי דקה."));
      try { const r = await makeBriefing(key); if (r.briefing) show(r); else { box.hidden = true; } } catch (e) { body.replaceChildren(h("div.callout", icon("alert"), e.message), ask()); }
    } }, icon("spark"), "הכינו תקציר");
    return h("div", h("p", { style: { color: "var(--ink-2)", marginBottom: "12px" } }, "תקציר קצר בשפה פשוטה שמחבר בין הממצאים ומציע במה להתחיל. ההכנה נשמרת לשימוש חוזר."), btn);
  };
  getBriefing(key).then((r) => { if (r.briefing) show(r); else if (r.available) { body.replaceChildren(ask()); box.classList.add("is-late"); if (late && late.parentNode) late.before(box); box.hidden = false; } }).catch(() => { /* no briefing offered */ }).finally(() => box.removeAttribute("aria-busy"));
  return box;
}

function askStrip(model) {
  const key = model.city.key, input = h("input", { type: "text", placeholder: "למשל: איפה אנחנו הכי חלשים?", "aria-label": "שאלה לסוכן", autocomplete: "off" });
  return h("section.lm-ask.no-print.rv", h("div", h("h2.lm-h2", `יש שאלה על ${model.city.name}?`), h("p", "כתבו במילים שלכם, והסוכן יבנה דף עם התשובה.")),
    h("form.askbox", { onsubmit: (e) => { e.preventDefault(); const q = input.value.trim(); location.hash = `#/c/${key}/ask` + (q ? "?q=" + encodeURIComponent(q) : ""); } }, input, h("button.btn.primary", { type: "submit" }, "שאלו")));
}

// where every number comes from: the publishers with their counts, then the full linked list (each parameter's own page names its exact source)
function sourcesSec(model) {
  if (!model.sources.length) return null;
  const by = new Map();
  model.sources.forEach((s) => by.set(s.publisher, (by.get(s.publisher) || 0) + 1));
  return section("sources", secHead("מקורות", "מקורות הנתונים", `המידע נאסף ב-${dateHe(model.builtAt)}. בעמוד של כל מדד מופיע המקור המדויק שלו.`),
    h("ul.lm-pubs.rv", [...by].map(([p, n]) => h("li", p, h("b", ltr(String(n)))))),
    h("ul.srclist.rv", model.sources.map((x) => h("li", h("a", { href: x.url, target: "_blank", rel: "noopener" }, icon("link"), " ", x.name), h("span.muted", " · " + x.publisher)))));
}

// plain underlined tabs that stay under the top bar and follow the part you are reading
function jumpBar(root, parts) {
  const have = parts.filter(([id]) => root.querySelector("#" + id));
  if (have.length < 2) return null;
  const btns = new Map(have.map(([id, label]) => [id, h("button", { type: "button", onclick: () => jumpTo(root, id) }, label)]));
  const nav = h("nav.lm-jump.no-print", { "aria-label": "קפיצה לחלק בעמוד" }, h("div.lm-jump-in", [...btns.values()]));
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
    root.append(h("section.lm-hero.is-empty", h("div.lm-hero-grid", h("div.lm-hero-main", h("div.lm-hero-eyebrow", "תמונת מצב"), h("h1.lm-h1", model.city.name),
      h("div.lm-calm", h("h2.lm-calm-t", "אין עדיין נתונים ברמת היישוב הזה"),
        h("p", "המקורות הרשמיים שהמערכת קוראת מהם אינם מפרסמים נתונים על היישוב הזה. בדרך כלל מדובר ביישובים קטנים מאוד, באזורי תעשייה או במרכזים אזוריים.")),
      h("div.lm-actions", h("a.btn.primary", { href: "#/" }, icon("search"), "בחירת יישוב אחר"))), (() => { const v = heroVisual(model), fx = facts(model); if (fx) v.append(fx); return v; })())));
    return root;
  }
  const all = model.indicators.reduce((c, i) => ((c[i.status] = (c[i.status] || 0) + 1), c), {});
  const judged = ["concern", "watch", "good", "strength"].reduce((n, k) => n + (all[k] || 0), 0);
  root.append(hero(model, root, all, judged));
  const w = welcome(); if (w) root.append(w);                                   // the tip comes after the verdict, not before it
  const asked = askStrip(model);
  root.append(briefingBand(model, asked));                                              // the plain-words summary sits right under the counts
  const dom = domainsSec(model); if (dom) root.append(dom);
  const pick = keyPick(model), prl = priorityList(model);
  if (pick.length || prl) root.append(h("div.lm-duo" + (pick.length && prl ? "" : ".is-one"), pick.length ? keyBlock(model, pick) : null, prl));
  const marker = h("div.lm-marker", { "aria-hidden": "true" });
  root.append(marker);
  const start = (model.recommendations || []).length ? recBand(model, model.recommendations[0]) : (model.priorities || []).length ? priorityBand(model, model.indicators.find((x) => x.id === model.priorities[0]) || model.indicators[0]) : null;
  if (start) root.append(h("div.lm-block.rv", start));
  [prioritiesSec(model), whereSec(model), changesSec(model), equitySec(model), planSec(model)].forEach((s) => { if (s) root.append(s); });
  root.append(asked);
  const src = sourcesSec(model); if (src) root.append(src);
  const jump = jumpBar(root, [["lm-start", "התחילו כאן"], ["lm-priorities", "מה דורש תשומת לב"], ["lm-where", "איפה בארץ"], ["lm-changes", "שינויים ופערים"], ["lm-plan", "התוכנית"]]);
  if (jump) marker.replaceWith(jump); else marker.remove();
  return root;
}
