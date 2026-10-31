// Method and sources: where every number comes from, what is measured, the decision rules (each with a small drawn example), how the recommendations
// are made, how to read the numbers and the limits. A hero with the journey of a number, then a sticky table of contents beside numbered sections.
// The page is a reading page: fast (plain HTML, a handful of small drawings), printable (folded parts open before printing), and every sentence of the
// rules comes from the numbers the server really uses (meta.rules, meta.recRules). The drawings are schematic and say so (css/pages/method.css, prefix .mt-).
import { h, svg, icon, ltr, num, iso, dateHe, outOf, statusChip, directionIcon } from "../ui.js";
import { getMeta, health } from "../api.js";
import { viz } from "../viz/core.js";
import { shareBtn, printBtn } from "./shared.js";

const FW_DOMAIN = { demography: "דמוגרפיה", socioeconomic: "חברה וכלכלה", immunization: "חיסונים", maternal_child: "אם וילד", outcomes: "תוצאי בריאות", child_health: "בריאות ילדים", injuries: "פציעות ובטיחות בדרכים", access_capacity: "נגישות ותשתיות", prevention: "מניעה וסקרים", behaviors: "התנהגויות בריאות", chronic_disease: "מחלות כרוניות", mental_health: "בריאות הנפש", older_adults: "קשישים", environment: "סביבה ומרחב עירוני" };
const UNIT_HE = { "%": "%", "per 1000": "ל-1,000", "per 10000": "ל-10,000", "per 100000": "ל-100,000", ILS: "₪", persons: "נפשות", "ug/m3": "מיקרוגרם למ״ק" };
const RULES0 = { minBase: 100, concernLevel: 25, concernWorseningLevel: 40, farBelowTarget: 10, strengthLevel: 75, goodLevel: 50, nearTarget: 5, trendSlope: 0.5, trendMove: 2, splitMin: 100, splitShare: 0.08, equityGap: 15, equityZ: 3 };          // only when the server sends none
const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const count = (n, one, many) => (n === 1 ? one : `${num(n, 0)} ${many}`);
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// "משרד הבריאות (פורטל עולם הדאטה)" -> the body and what is said in addition
function splitPublisher(p) {
  const s = String(p || "").trim(), i = s.search(/[,(]/);
  if (i < 0) return { org: s, detail: "" };
  let detail = s.slice(i).replace(/^[,\s]+/, "").trim();
  if (/^\(.*\)$/.test(detail)) detail = detail.slice(1, -1);
  return { org: s.slice(0, i).trim(), detail };
}

// a numbered section: eyebrow with its number, a title, one lead line
const section = (id, no, eyebrow, title, lead, ...body) => h("section.sec.mt-sec", { id, "aria-labelledby": id + "-t" },
  h("div.sec-head.rv", h("div", h("div.sec-eyebrow", h("b", no), eyebrow), h("h2.sec-title", { id: id + "-t" }, title), lead ? h("p.sec-lead", lead) : null)), ...body);

// a small drawing with its caption; `viz` plays the entrance when it scrolls into view. The drawing says what it is for, the caption says it is only an illustration.
const figure = (cls, label, cap, ...kids) => viz(h("figure.mt-fig." + cls, { role: "group", "aria-label": label }, ...kids, cap ? h("figcaption.mt-cap", cap) : null));
const stage = (w, ht, ...kids) => svg("svg", { class: "mt-svg", viewBox: `0 0 ${w} ${ht}`, width: w, height: ht, "aria-hidden": "true" }, ...kids);
const T = (x, y, text, o = {}) => svg("text", { x, y, "text-anchor": o.a || "middle", class: o.c || "", style: o.i != null ? { "--i": o.i } : null }, text);

// parts of a whole as one bar with direct labels (no legend to decode): [{ label, n, tone }]
function stackBar(parts, say) {
  const total = parts.reduce((s, p) => s + p.n, 0) || 1;
  return viz(h("div.mt-stack", { role: "group", "aria-label": say },
    h("div.mt-stack-bar", parts.filter((p) => p.n > 0).map((p, i) => h("i.mt-seg.t-" + p.tone + ".grow-x", { style: { flexGrow: p.n, "--i": i } }))),
    h("ul.mt-stack-key", parts.map((p) => h("li.t-" + p.tone, h("i.mt-sw", { "aria-hidden": "true" }), h("b", ltr(String(p.n))), h("span", p.label))))));
}

/* ═════════════════════════════ the hero ═════════════════════════════ */

function hero(meta, model, builtAt) {
  const orgs = [...new Set(Object.values(meta.sources).map((s) => splitPublisher(s.publisher).org))];
  const nSrc = Object.keys(meta.sources).length, nInd = meta.indicators.length, nDom = meta.domains.filter((d) => meta.indicators.some((i) => i.domain === d.id)).length;
  const fact = (label, value, counted) => h("div.hero-fact" + (counted ? "" : ".is-wide"), h("small", label), h("b", counted ? { "data-count": "" } : null, value));
  const facts = [fact("מקורות רשמיים", String(nSrc), true), fact("מדדים", String(nInd), true), fact("תחומים", String(nDom), true),
    model ? fact(`כיסוי ב${model.city.name}`, outOf(model.coverage.have, model.coverage.total)) : builtAt ? fact("הנתונים נאספו", dateHe(builtAt)) : null].filter(Boolean);
  const steps = [["נאסף", "ממקור רשמי", orgs.join(", ")], ["נשמר", "עם המקור שלו", "כל מדד מקושר למערך הנתונים שממנו בא"],
    ["מחושב", "אוטומטית, לפי כללים קבועים", "דירוג מול כל היישובים, סטטוס, מגמה ועדיפות"], ["מוצג", "עם קישור למקור", "הבינה המלאכותית מנסחת טקסט ואינה כותבת מספרים"]];
  const share = shareBtn(), print = printBtn();
  share.title = "העתקת קישור"; print.title = "הדפסה";
  const actions = h("div.hero-actions.no-print.rv", model ? h("a.btn.primary", { href: `#/c/${encodeURIComponent(model.city.key)}/coverage` }, icon("search"), `מה נמצא ומה חסר ב${model.city.name}`) : h("a.btn.primary", { href: "#/" }, icon("search"), "בחירת יישוב"), share, print);
  return h("section.hero.mt-hero",
    h("div.hero-grid",
      h("div.mt-hero-main", h("div.eyebrow.rv", "שיטה ומקורות"), h("h1.rv", "איך נבנה כל מספר"),
        h("p.lede.rv", "כל מספר במערכת מגיע ממערך נתונים רשמי, מחושב אוטומטית ונשמר עם המקור שלו. הסוכן והבינה המלאכותית אינם כותבים מספרים. כאן מפורטים המקורות, ההגדרות וכללי ההחלטה."),
        model && builtAt ? h("p.mt-built.rv", ["הנתונים נאספו ב-", dateHe(builtAt), ". "]) : null, actions),
      h("div.hero-visual.mt-hero-vis", h("div.mt-facts.rv", facts))),
    h("ol.mt-flow.rv", { "aria-label": "המסלול של כל מספר" }, steps.map(([verb, what, more], i) => h("li", h("span.mt-fl-n", { "aria-hidden": "true" }, String(i + 1)),
      h("b.mt-fl-t", verb, " ", h("span", what)), h("p", more), i < steps.length - 1 ? h("i.mt-fl-go", { "aria-hidden": "true" }, icon("left")) : null))));
}

/* ═════════════════════════════ 01 sources ═════════════════════════════ */

function sourcesSec(meta, model, no) {
  const used = {};
  meta.indicators.forEach((i) => { used[i.source] = (used[i.source] || 0) + 1; });
  const rows = Object.entries(meta.sources).map(([id, s]) => ({ id, s, ...splitPublisher(s.publisher), n: used[id] || 0 }));
  const groups = new Map();
  rows.forEach((r) => { if (!groups.has(r.org)) groups.set(r.org, []); groups.get(r.org).push(r); });
  const feed = (list) => list.reduce((t, r) => t + r.n, 0);
  const ordered = [...groups].sort((a, b) => feed(b[1]) - feed(a[1]) || b[1].length - a[1].length), max = Math.max(1, ...rows.map((r) => r.n));
  const commonOf = (list, k) => { const t = {}; list.forEach((r) => { const v = r.s[k] || ""; t[v] = (t[v] || 0) + 1; }); const top = Object.entries(t).sort((a, b) => b[1] - a[1])[0]; return top && top[1] > 1 ? top[0] : ""; };
  const row = (r, dflt) => {
    const meta = [r.s.frequency && r.s.frequency !== dflt.frequency ? "מתעדכן " + r.s.frequency : null, r.s.license && r.s.license !== dflt.license ? "רישיון: " + r.s.license : null].filter(Boolean);
    return h("tr", h("td.mt-c-name", { "data-label": "מערך נתונים" },
      h("div.mt-nm", r.s.url ? h("a", { href: r.s.url, target: "_blank", rel: "noopener" }, r.s.name) : h("b", r.s.name),
        h("span.mt-c-feeds", { "data-label": "מדדים" }, r.n ? [h("b", ltr(String(r.n))), h("span.mt-fd-w", r.n === 1 ? "מדד" : "מדדים"), h("span.mt-bar", { "aria-hidden": "true" }, h("i.grow-x", { style: { width: (r.n / max) * 100 + "%" } }))] : h("span.muted", "אין מדד"))),
      r.detail ? h("small.mt-det", r.detail) : null, meta.length ? h("p.mt-meta", meta.join(" · ")) : null,
      r.s.note ? h("details.mt-more", h("summary", "על מערך הנתונים", icon("down")), h("p", r.s.note)) : null));
  };
  const table = h("table.mt-tbl.mt-srcs", h("caption.sr", "מקורות הנתונים לפי גוף מפרסם"),
    h("thead", h("tr", h("th", { scope: "col" }, "מערך נתונים, וכמה מדדים נשענים עליו"))),
    ordered.map(([org, list]) => { const dflt = { frequency: commonOf(list, "frequency"), license: commonOf(list, "license") }, said = [dflt.frequency ? "מתעדכנים בדרך כלל: " + dflt.frequency : null, dflt.license ? "רישיון: " + dflt.license : null].filter(Boolean).join(" · ");
      return h("tbody", h("tr.mt-grp", h("th", { scope: "colgroup" }, org, h("small", count(list.length, "מערך נתונים אחד", "מערכי נתונים")), said ? h("small.mt-dflt", said) : null)), list.slice().sort((a, b) => b.n - a.n).map((r) => row(r, dflt))); }));
  return section("mt-sources", no, "מקורות", "מאיפה מגיע כל מספר",
    `${count(rows.length, "מקור אחד", "מקורות")} של ${count(groups.size, "גוף אחד", "גופים")}. בכל שורה: מי מפרסם, איפה הנתונים, וכמה מדדים נשענים עליהם. תדירות ורישיון כתובים פעם אחת לכל גוף, ובשורה רק כשהם שונים. כל שם הוא קישור למערך עצמו.`,
    viz(h("div.mt-tw.rv", table)),
    h("p.mt-foot.rv", icon("info"), model ? ["בעמוד של כל מדד מופיע המקור המדויק שלו. ", h("a", { href: `#/c/${encodeURIComponent(model.city.key)}/coverage` }, `מה נמצא ומה חסר ב${model.city.name}`), "."] : "בעמוד של כל מדד מופיע המקור המדויק שלו."));
}

/* ═════════════════════════════ 02 what is measured ═════════════════════════════ */

function measuresSec(meta, model, no) {
  const cov = model ? Object.fromEntries(model.indicators.map((a) => [a.id, a])) : {};
  const groups = meta.domains.map((d) => ({ d, list: meta.indicators.filter((i) => i.domain === d.id) })).filter((g) => g.list.length);
  const maxImp = Math.max(5, ...meta.indicators.map((i) => i.importance || 0));
  const hi = meta.indicators.filter((i) => i.direction === "higher").length, lo = meta.indicators.filter((i) => i.direction === "lower").length, bg = meta.indicators.length - hi - lo;
  const dirCell = (i) => { const d = i.direction === "higher" ? "גבוה = טוב" : i.direction === "lower" ? "נמוך = טוב" : "מדד רקע"; return h("span.mt-dir", icon(directionIcon(i.direction)), d); };
  const dots = (n) => h("span.mt-dots", { role: "img", "aria-label": `חשיבות ${n} מתוך ${maxImp}` }, Array.from({ length: maxImp }, (_, k) => h("i" + (k < n ? ".on" : ""))));
  const head = ["מדד", "כיוון", "חשיבות", ...(model ? ["שנים"] : [])];
  const accs = groups.map(({ d, list }) => {
    const have = model ? list.filter((i) => cov[i.id]).length : null;
    return h("details.mt-fw", h("summary", h("span.mt-fw-name", d.label),
      h("span.mt-cells", { "aria-hidden": "true" }, list.map((i) => h("i.d-" + (i.direction || "none") + (model && !cov[i.id] ? ".is-miss" : "")))),
      h("span.mt-fw-n", model ? `${count(list.length, "מדד אחד", "מדדים")} · יש נתון ל-${num(have, 0)}` : count(list.length, "מדד אחד", "מדדים")), icon("down")),
      h("div.mt-tw", h("table.mt-tbl.mt-measures", h("caption.sr", d.label), h("thead", h("tr", head.map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", list.map((i) => { const a = cov[i.id]; return h("tr", h("td.mt-c-name", { "data-label": "מדד" }, h("b", i.label), h("small.mt-note", i.definition)),
          h("td", { "data-label": "כיוון" }, dirCell(i)), h("td", { "data-label": "חשיבות" }, dots(i.importance || 0)),
          model ? h("td", { "data-label": "שנים" }, a ? ltr(a.series[0].year + "–" + a.last.year) : h("span.muted", "אין")) : null); })))));
  });
  return section("mt-measures", no, "מה נמדד", `${num(meta.indicators.length, 0)} מדדים ב-${num(groups.length, 0)} תחומים`,
    ["לכל מדד יש הגדרה, כיוון (מה נחשב טוב) וחשיבות שמשפיעה על סדר העדיפויות. כל תחום נפתח לרשימת המדדים שלו.", model ? ` כיסוי ל${model.city.name}: ${model.coverage.have} מתוך ${model.coverage.total}.` : ""],
    stackBar([{ label: "גבוה = טוב", n: hi, tone: "hi" }, { label: "נמוך = טוב", n: lo, tone: "lo" }, { label: "מדד רקע: מתאר בלי לשפוט", n: bg, tone: "bg" }], `מתוך ${meta.indicators.length} מדדים: ${hi} שגבוה בהם טוב, ${lo} שנמוך בהם טוב, ${bg} מדדי רקע`),
    h("div.mt-fws.rv", accs));
}

/* ═════════════════════════════ 03 the framework ═════════════════════════════ */

function fwTarget(p) {
  const t = p.target;
  if (!t || t.kind === "none" || t.value == null) return h("span.muted", "אין יעד");
  const val = t.value < 0 ? "הפחתה של " + Math.abs(t.value) + "%" : t.value + (UNIT_HE[p.unit] === "%" ? "%" : " " + (UNIT_HE[p.unit] || p.unit));
  return h("span", /[א-ת]/.test(val) ? val : ltr(val), " ", h("span.muted", t.kind === "official" ? "(יעד רשמי)" : "(ייחוס בינלאומי)"), t.url ? [" ", h("a", { href: t.url, target: "_blank", rel: "noopener" }, "מקור")] : null);
}
const fwState = (p) => (p.live ? "live" : p.dataset ? "data" : "none");

// what matters for running the public health of a city, parameter by parameter, and how far this tool covers it
function frameworkSec(meta, model, no) {
  const fw = meta.framework || [];
  if (!fw.length) return null;
  const live = fw.filter((p) => p.live).length, withData = fw.filter((p) => !p.live && p.dataset).length, none = fw.length - live - withData;
  const byDomain = {};
  for (const p of fw) (byDomain[p.domain] = byDomain[p.domain] || []).push(p);
  const state = (p) => (p.live ? h("span.st.t-good", icon("check"), "נמדד כאן") : p.dataset ? h("span.st.t-none", icon("clock"), "יש מערך נתונים, טרם נאסף") : h("span.st.t-none", icon("info"), "לא נמצא מקור"));
  const accs = Object.entries(byDomain).map(([d, list]) => h("details.mt-fw",
    h("summary", h("span.mt-fw-name", FW_DOMAIN[d] || d), h("span.mt-cells", { "aria-hidden": "true" }, list.map((p) => h("i.s-" + fwState(p)))), h("span.mt-fw-n", `${num(list.filter((p) => p.live).length, 0)} מתוך ${num(list.length, 0)} נמדדים`), icon("down")),
    h("div.mt-tw", h("table.mt-tbl.mt-fwt", h("thead", h("tr", ["מדד", "למה חשוב", "יעד", "התערבויות מתועדות", "מצב"].map((t) => h("th", { scope: "col" }, t)))),
      h("tbody", list.map((p) => h("tr", h("td.mt-c-name", { "data-label": "מדד" }, h("b", p.label), h("small.mt-note", p.definition)), h("td", { "data-label": "למה חשוב" }, p.why), h("td", { "data-label": "יעד" }, fwTarget(p)),
        h("td.n", { "data-label": "התערבויות מתועדות" }, ltr(String(p.interventions))), h("td", { "data-label": "מצב" }, state(p)))))))));
  return section("mt-framework", no, "מסגרת המדדים", "מה חשוב למדוד בניהול בריאות העיר",
    `${count(fw.length, "מדד אחד", "מדדים")} מתוך מסגרות בינלאומיות ונתונים ישראליים. ${num(live, 0)} נמדדים במערכת כבר, ל-${num(withData, 0)} נוספים זוהה מערך נתונים, ויתר המדדים נשארים ללא מקור שנמצא.`,
    stackBar([{ label: "נמדדים במערכת", n: live, tone: "live" }, { label: "יש מערך נתונים, טרם נאסף", n: withData, tone: "data" }, { label: "לא נמצא מקור", n: none, tone: "none" }], `מתוך ${fw.length} מדדים במסגרת: ${live} נמדדים כאן, ${withData} עם מערך נתונים שטרם נאסף, ${none} ללא מקור`),
    h("div.mt-fws.rv", accs),
    h("p.mt-foot.rv", icon("info"), "המסגרת נאספה מ-WHO Healthy Cities, Urban HEART, County Health Rankings, Healthy People 2030, OECD Regional Well-Being ונתוני משרד הבריאות. יעד בין-לאומי אינו יעד ישראלי: הוא נקודת ייחוס בלבד."));
}

/* ═════════════════════════════ 04 decision rules, each with a small drawing ═════════════════════════════ */

// the ranking: localities in a row, best on the right; small groups wait outside the row
function rankFig(R) {
  const n = 15, x1 = 332, dx = 15.5, y = 50, me = 5;
  const dots = Array.from({ length: n }, (_, k) => { const x = x1 - k * dx, self = k === me; return svg("circle", { class: "pop" + (self ? " mt-city" : " mt-dotc"), cx: x, cy: y, r: self ? 7.5 : 5, style: { "--i": Math.min(12, k) } }); });
  const xc = x1 - me * dx;
  return figure("mt-rank", `יישובים מסודרים מהחלש ביותר, משמאל, לטוב ביותר, מימין. העיר מסומנת. יישובים בקבוצה קטנה מוצגים בנפרד ואין להם מקום בדירוג.`, "איור להמחשה, לא נתון אמיתי.",
    stage(360, 108, svg("path", { class: "mt-axis fade", d: "M92 50H350" }), ...dots,
      ...[22, 38, 54].map((x) => svg("circle", { class: "pop mt-hollow", cx: x, cy: y, r: 5, style: { "--i": 3 } })), svg("path", { class: "mt-dash fade", d: "M72 30V72" }),
      T(38, 22, "קבוצה קטנה", { c: "rise", i: 2 }), T(38, 90, "לא מדורגת", { c: "rise", i: 2 }), T(x1 + 12, 22, "מקום 1", { a: "end", c: "rise", i: 3 }), T(xc, 28, "העיר", { c: "rise mt-t-city", i: 4 }),
      T(94, 94, "חלש יותר", { a: "start", c: "rise", i: 5 }), T(350, 94, "טוב יותר", { a: "end", c: "rise", i: 5 })));
}

// a small group, and what it gets: shown, but never ranked, judged, trended or recommended on
function smallFig(R) {
  const min = R.minBase || 100, rows = [["דירוג", "מדורג מול היישובים", "לא מדורג"], ["שיפוט", "נשפט ומקבל סטטוס", "לא נשפט"], ["מגמה", "יש מגמה", "אין מגמה"], ["עדיפות והמלצה", "נכנס לעדיפויות ולהמלצות", "לא נכנס"]];
  return figure("mt-small", "מה מקבלת קבוצה גדולה ומה מקבלת קבוצה קטנה", null,
    h("table.mt-sg", h("thead", h("tr", h("td"), h("th", { scope: "col" }, h("i.mt-dotk"), h("span", "קבוצה של ", ltr(String(min)), " איש ומעלה")), h("th", { scope: "col" }, h("i.mt-dotk.is-hollow"), h("span", "קבוצה קטנה יותר")))),
      h("tbody", rows.map(([k, yes, no]) => h("tr", h("th", { scope: "row" }, k), h("td.is-yes", icon("check"), yes), h("td.is-no", icon("minus"), no))))));
}

// the five statuses on one scale: how many of the localities the figure beats, worst on the left, best on the right
function statusScale(R) {
  const c = R.concernLevel, w = R.concernWorseningLevel, g = R.goodLevel, s = R.strengthLevel;
  const zones = [["concern", 0, c], ["watch", c, g], ["good", g, s], ["strength", s, 100]];
  const phrase = { concern: `מתחת ל-${c}%`, watch: `${c}% עד ${g}%`, good: `${g}% עד ${s}%`, strength: `${s}% ומעלה` };
  const bar = h("div.mt-sc-bar", zones.map(([st, a, b], i) => h("i.mt-z.z-" + st + ".grow-x", { style: { left: a + "%", width: b - a + "%", "--i": i, "--origin": "0 50%" } })),
    zones.slice(1).map(([, a]) => h("i.mt-sc-cut.fade", { style: { left: a + "%" } })));
  const labels = h("div.mt-sc-lab", zones.map(([st, a, b]) => h("div.mt-sc-l", { style: { left: a + "%", width: b - a + "%" } }, statusChip(st), h("span", phrase[st]))));
  const worse = h("div.mt-sc-worse.rise", { style: { left: c + "%", width: w - c + "%", "--i": 5 } }, h("span", "גם דורש טיפול כשהמגמה בהידרדרות"), h("i"));
  const ticks = h("div.mt-sc-ticks", [[0, "0"], [c, c], [w, w], [g, g], [s, s], [100, "100"]].map(([v, t]) => h("span", { style: { left: v + "%" } }, ltr(t + "%"))));
  return figure("mt-scale", `ציר שבו מסומן כמה מהיישובים הערך של המדד טוב מהם. מתחת ל-${c}% דורש טיפול, מ-${c}% עד ${g}% למעקב, מ-${g}% עד ${s}% תקין, מ-${s}% ומעלה חוזק. בין ${c}% ל-${w}% גם דורש טיפול אם המגמה בהידרדרות.`,
    "הציר: הערך של המדד טוב יותר מכמה אחוזים מהיישובים. ימינה = טוב יותר. הסף של כל סטטוס נקבע גם לפי היעד והמגמה, כפי שכתוב בהמשך.",
    h("div.mt-sc", worse, bar, ticks, labels));
}

// the trend: the median of all the slopes between pairs of years ignores one strange year; an ordinary straight line is pulled toward it
function trendFig() {
  const v = [12, 3, 16, 18, 21, 23, 26], n = v.length, X = (i) => 36 + i * 46, Y = (u) => 124 - u * 3.7;
  const slopes = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) slopes.push((v[j] - v[i]) / (j - i));
  const ts = median(slopes), tb = median(v.map((u, i) => u - ts * i));
  const mx = (n - 1) / 2, my = v.reduce((a, b) => a + b, 0) / n, ols = v.reduce((a, u, i) => a + (i - mx) * (u - my), 0) / v.reduce((a, _, i) => a + (i - mx) ** 2, 0), ob = my - ols * mx;
  const line = (m, b) => `M${X(0)} ${Y(b).toFixed(1)}L${X(n - 1)} ${Y(m * (n - 1) + b).toFixed(1)}`;
  return figure("mt-trend", "שבע שנים ובהן שנה חריגה אחת, 2021. קו המגמה לפי חציון השיפועים נשאר עם רוב הנקודות, וקו ישר רגיל נמשך אל הנקודה החריגה.",
    "איור להמחשה, לא נתון אמיתי.",
    stage(360, 150, svg("path", { class: "mt-axis fade", d: `M20 130H340` }),
      svg("path", { class: "mt-line-ols draw", style: { "--len": 330, "--i": 3 }, d: line(ols, ob) }), svg("path", { class: "mt-line-ts draw", style: { "--len": 330, "--i": 1 }, d: line(ts, tb) }),
      ...v.map((u, i) => svg("circle", { class: "pop " + (i === 1 ? "mt-odd" : "mt-dotc"), cx: X(i), cy: Y(u), r: i === 1 ? 6 : 5, style: { "--i": i } })),
      T(X(1), 146, "2021", { c: "rise mt-t-odd", i: 4 })),
    h("ul.mt-key", h("li.k-ts", h("i"), "קו המגמה: חציון השיפועים"), h("li.k-ols", h("i"), "קו ישר רגיל: נמשך אל החריגה")));
}

// old data: the figure is shown, the nation has moved two years or more past it
function staleFig() {
  return figure("mt-stale", "ציר שנים. הנתון האחרון של המדד ישן בשנתיים ומעלה מהנתונים העדכניים ביותר, ולכן הוא מוצג אבל אינו משפיע.", "איור להמחשה: הנתון מוצג, אך אינו משפיע על הסטטוס, העדיפויות וההמלצות.",
    stage(360, 96, svg("path", { class: "mt-axis fade", d: "M16 46H344" }), ...Array.from({ length: 9 }, (_, k) => svg("path", { class: "mt-tick fade", d: `M${24 + k * 40} 42v8` })),
      svg("path", { class: "mt-brk fade", d: "M120 62v6H320v-6", style: { "--i": 3 } }), T(220, 88, "שנתיים ומעלה", { c: "rise", i: 4 }),
      svg("circle", { class: "pop mt-hollow", cx: 120, cy: 46, r: 6.5, style: { "--i": 1 } }), svg("circle", { class: "pop mt-dotc", cx: 320, cy: 46, r: 6.5, style: { "--i": 2 } }),
      T(120, 26, "הנתון האחרון של המדד", { c: "rise", i: 2 }), T(332, 26, "הנתונים העדכניים ביותר", { a: "end", c: "rise", i: 3 })));
}

// a gap between groups inside the city
function gapFig(R) {
  return figure("mt-gap", `שתי קבוצות בתוך העיר על אותו ציר, והפער ביניהן ${R.equityGap} נקודות ומעלה.`, "איור להמחשה, לא נתון אמיתי.",
    stage(360, 108, svg("path", { class: "mt-axis fade", d: "M16 64H344" }),
      svg("rect", { class: "mt-conn grow-x", x: 100, y: 61, width: 160, height: 6, rx: 3, style: { "--origin": "0 50%", "--i": 1 } }),
      svg("circle", { class: "pop mt-dotb", cx: 100, cy: 64, r: 7, style: { "--i": 2 } }), svg("circle", { class: "pop mt-city", cx: 260, cy: 64, r: 7, style: { "--i": 3 } }),
      svg("path", { class: "mt-brk fade", d: "M100 42v-6H260v6", style: { "--i": 3 } }), T(180, 26, `פער של ${R.equityGap} נק׳ ומעלה`, { c: "rise mt-t-gap", i: 4 }),
      T(100, 92, "קבוצה ב׳", { c: "rise", i: 4 }), T(260, 92, "קבוצה א׳", { c: "rise", i: 4 })));
}

// the similar localities: their middle value (the median) is drawn beside the national average, and the two are not the same thing
function peersFig() {
  const xs = [58, 88, 112, 140, 170, 200, 226, 262, 300], y = 56;
  return figure("mt-peers", "תשעה יישובים דומים על ציר אחד. הערך האמצעי שלהם מסומן מעל הציר, והממוצע הארצי מתחתיו, והם לא בהכרח באותו מקום. העיר מסומנת.", "איור להמחשה, לא נתון אמיתי.",
    stage(360, 118, svg("path", { class: "mt-axis fade", d: "M20 56H340" }),
      svg("path", { class: "mt-dash fade", d: "M250 40V84", style: { "--i": 3 } }),
      ...xs.map((x, k) => svg("circle", { class: "pop " + (k === 2 ? "mt-city" : "mt-dotc"), cx: x, cy: y, r: k === 2 ? 7 : 5, style: { "--i": k } })),
      svg("path", { class: "mt-line-ts draw", style: { "--len": 30, "--i": 4 }, d: "M170 40V72" }),
      T(170, 26, "הערך האמצעי של הדומים", { c: "rise mt-t-city", i: 5 }), T(250, 104, "ממוצע ארצי", { c: "rise", i: 5 }), T(112, 104, "העיר", { c: "rise mt-t-city", i: 5 })));
}

// the priority: importance times the distance that is left, plus a little for a worsening and for a gap inside the city
function priorityFig() {
  const glyph = (kids) => stage(76, 46, ...kids);
  const term = (g, label) => h("div.mt-term", g, h("span", label));
  const op = (t) => h("span.mt-op", { "aria-hidden": "true" }, t);
  const imp = glyph(Array.from({ length: 5 }, (_, k) => svg("circle", { class: "pop " + (k < 4 ? "mt-dotc" : "mt-hollow"), cx: 10 + k * 14, cy: 23, r: 5, style: { "--i": k } })));
  const dist = glyph([svg("path", { class: "mt-axis fade", d: "M6 26H70" }), svg("path", { class: "mt-dash fade", d: "M20 26H58" }), svg("circle", { class: "pop mt-dotc", cx: 14, cy: 26, r: 6, style: { "--i": 1 } }), svg("path", { class: "mt-flag fade", d: "M60 36V12l10 5-10 5", style: { "--i": 2 } })]);
  const bad = glyph([svg("path", { class: "mt-line-ts draw", style: { "--len": 90, "--i": 2 }, d: "M8 12L28 20L40 18L68 38" }), svg("path", { class: "mt-line-ts draw", style: { "--len": 20, "--i": 3 }, d: "M58 38H68V28" })]);
  const gap = glyph([svg("path", { class: "mt-axis fade", d: "M6 26H70" }), svg("rect", { class: "mt-conn grow-x", x: 18, y: 23, width: 40, height: 6, rx: 3, style: { "--origin": "0 50%", "--i": 1 } }), svg("circle", { class: "pop mt-dotb", cx: 18, cy: 26, r: 6, style: { "--i": 2 } }), svg("circle", { class: "pop mt-city", cx: 58, cy: 26, r: 6, style: { "--i": 3 } })]);
  const out = glyph([svg("circle", { class: "mt-ring-t", cx: 38, cy: 23, r: 17 }), svg("path", { class: "mt-ring-v sweep", style: { "--len": 80, "--i": 4 }, d: "M38 6A17 17 0 1 1 21.3 26.2" })]);
  return figure("mt-prio", "הנוסחה של העדיפות: חשיבות המדד כפול המרחק שנשאר עד יעד ריאלי, ועוד תוספת להידרדרות ותוספת לפער ברור בין קבוצות בעיר.", null,
    h("div.mt-eq", term(imp, "חשיבות המדד"), op("×"), term(dist, "המרחק שנשאר עד יעד ריאלי"), op("+"), term(bad, "תוספת להידרדרות"), op("+"), term(gap, "תוספת לפער ברור בתוך העיר"), op("="), term(out, "עדיפות")));
}

function rulesSec(meta, model, no) {
  const R = { ...RULES0, ...(meta.rules || {}) }, S = R.minBase;
  const rule = (title, body, fig, cls, after) => h("article.mt-rule.rv" + (cls ? "." + cls : ""), h("div.mt-rule-t", h("h3", title), body), fig ? h("div.mt-rule-fig", fig) : null, after || null);
  const p = (t) => h("p", t);
  const sdl = h("dl.mt-sdl", [
    ["concern", `הערך בין ${R.concernLevel}% היישובים החלשים ביותר, או שחסרות יותר מ-${R.farBelowTarget} נק׳ ליעד הרשמי, או שהוא בין ${R.concernWorseningLevel}% החלשים והמגמה בהידרדרות.`],
    ["watch", "כל מה שאינו תקין וגם אינו דורש טיפול: למשל באמצע הדירוג, מתחת ליעד, או במגמת הידרדרות."],
    ["good", `הערך טוב יותר מ-${R.goodLevel}% מהיישובים, עד ${R.nearTarget} נק׳ מתחת ליעד, ואין הידרדרות.`],
    ["strength", `הערך בין ${100 - R.strengthLevel}% היישובים הטובים ביותר, לא מחמיץ יעד, ואין הידרדרות.`]].map(([st, t]) => h("div", h("dt", statusChip(st)), h("dd", t))));
  return section("mt-rules", no, "כללי ההחלטה", "איך המערכת מחליטה", "כל מספר נבדק לפי אותם כללים, בלי שיקול דעת של אדם ובלי בינה מלאכותית. נק׳ = נקודות אחוז, ההפרש בין שני אחוזים.",
    h("div.mt-rules",
      rule("דירוג", p(`כל מדד מדורג מול כל היישובים שבהם הקבוצה גדולה מספיק (לפחות ${S} איש). מקום 1 הוא הטוב ביותר, בלי קשר לכיוון המדד.`), rankFig(R)),
      rule("קבוצה קטנה", p("מדד שהקבוצה בו קטנה מהסף שלו מוצג כפי שהוא, אבל אינו מדורג ואינו נשפט, אין לו מגמה, והוא אינו נכנס לעדיפויות, לממצאים ולהמלצות. כשהקבוצה היא שניים-שלושה תינוקות, מקרה אחד משנה את האחוז בעשרות נקודות, וזו לא תמונת מצב."), smallFig(R), "is-wide"),
      rule("איך נקבע הסטטוס", p("הסטטוס נקבע לפי המקום של הערך בין כל היישובים, לפי הקרבה ליעד הרשמי ולפי המגמה של העיר עצמה. לכן מדד יכול להיות טוב מהממוצע הארצי ועדיין לדרוש טיפול."), statusScale(R), "is-wide", sdl),
      rule("מגמה", p([`לפחות שלוש שנים. השיפוע הוא החציון של השיפועים בין כל זוגות השנים (שיטת `, h("span.mt-nw", iso("Theil‑Sen")), `), כך שחריגה של שנה אחת, כמו 2021, לא מעוותת אותו. נחשב כמגמה רק אם הקצב ${R.trendSlope || 0.5} נקודות בשנה לפחות והשינוי הכולל ${R.trendMove || 2} נקודות לפחות.`]), trendFig()),
      rule("נתון ישן", p("אם הנתון האחרון ישן בשנתיים ומעלה מהנתונים העדכניים ביותר, הוא מוצג אך אינו משפיע על הסטטוס, העדיפויות וההמלצות."), staleFig()),
      rule("פערים בתוך העיר", p(`מתחלקים לפי מגזר ולפי הרמה החברתית-כלכלית של האזור. קבוצה נכללת אם יש בה לפחות ${R.splitMin || 100} איש ולפחות ${Math.round((R.splitShare || 0.08) * 100)}% מהעיר. פער נחשב רק אם הוא ${R.equityGap || 15} נקודות ומעלה וגם ברור מספיק כדי שלא יהיה מקרי (${iso("z ≥ " + (R.equityZ || 3))}).`), gapFig(R)),
      rule("יישובים דומים", p("לפי קרבה בגודל, ובנוסף לפי סוג יישוב ואשכול חברתי-כלכלי כשהם ידועים. השוואה לערך האמצעי שלהם (החציון) מוצגת לצד הממוצע הארצי."), peersFig()),
      rule("עדיפות", p("חשיבות המדד כפול המרחק שנשאר עד יעד ריאלי (היעד הרשמי או הרבעון העליון של היישובים), פלוס תוספת להידרדרות ולפער ברור בין קבוצות בעיר. מדד על קבוצה קטנה אינו מקבל עדיפות, ונתון ישן מקטין אותה."), priorityFig(), "is-wide")));
}

/* ═════════════════════════════ 05 how the recommendations are made ═════════════════════════════ */

// a factor between 0 and 1 as dots on a line: the nearer the right, the less the score is cut. Dots that are close alternate above and below the line.
function factorLine(title, items) {
  const vals = items.map((x) => x.v), lo = Math.min(...vals) - 0.05, hiv = 1.05, at = (v) => ((v - lo) / (hiv - lo)) * 100, sorted = items.slice().sort((a, b) => a.v - b.v);
  const side = new Map(); let prev = -99, flip = 0;
  sorted.forEach((x) => { const a = at(x.v); flip = a - prev < 17 ? 1 - flip : 0; side.set(x, flip); prev = a; });
  return h("div.mt-fac", h("div.mt-fac-t", title),
    h("div.mt-fac-line", { dir: "ltr" }, h("i.mt-fac-track.fade"), sorted.map((x, i) => h("div.mt-fac-pt." + (side.get(x) ? "dn" : "up") + ".pop", { style: { left: at(x.v) + "%", "--i": i * 2 } }, h("span.mt-fac-w", { dir: "rtl" }, x.w), h("i"), h("b.mt-fac-v", ltr("×" + x.v))))));
}

function recsSec(meta, model, no) {
  const Q = meta.recRules;
  if (!Q) return null;
  const E = Q.evidenceFactor, F = Q.effortFactor;
  const term = (t, d) => h("div.mt-term-row.rv", h("dt", t), h("dd", d));
  return section("mt-recs", no, "המלצות", "איך נוצרות ההמלצות", "המלצה מופיעה רק כשיש מאחוריה ממצא של היישוב, והציון שלה מחושב באותה דרך לכל יישוב.",
    figure("mt-score", `הציון של המלצה: חומרת הממצא החזק ביותר ועוד ${Math.round(Q.otherWeight * 100)}% מהממצאים האחרים, כפול גורם ראיות וגורם מאמץ. גורם ראיות: חזקות ${E.strong}, בינוניות ${E.moderate}, מוגבלות ${E.limited}, ללא ראיות ${E.none}. גורם מאמץ: נמוך ${F.low}, בינוני ${F.medium}, גבוה ${F.high}.`, "כל גורם מקטין את הציון: ככל שהנקודה קרובה יותר לימין, כך הציון נשאר גבוה יותר.",
      factorLine("גורם ראיות", [{ w: "חזקות", v: E.strong }, { w: "בינוניות", v: E.moderate }, { w: "מוגבלות", v: E.limited }, { w: "ללא ראיות", v: E.none }]),
      factorLine("גורם מאמץ", [{ w: "נמוך", v: F.low }, { w: "בינוני", v: F.medium }, { w: "גבוה", v: F.high }])),
    h("dl.mt-terms",
      term("מתי יש המלצה", "המלצה נוצרת רק כשיש ממצא של היישוב שמפעיל אותה: מתחת ליעד, בתחתית הדירוג, בהידרדרות, פער בין קבוצות בעיר או שינוי חד בגודל הקבוצה. אין המלצות כלליות שמוצגות לכולם."),
      term("סדר עדיפות", `החומרה של הממצא החזק ביותר מאחורי ההמלצה, ועוד ${Math.round(Q.otherWeight * 100)}% מחומרת שאר הממצאים (עד ${Q.otherCap} נקודות). הציון מוכפל בגורם לפי עוצמת הראיות (חזקות ${E.strong}, בינוניות ${E.moderate}, מוגבלות ${E.limited}, ללא ראיות ${E.none}) ולפי המאמץ (נמוך ${F.low}, בינוני ${F.medium}, גבוה ${F.high}). המלצת שימור לא עולה על ${Q.strengthCap}, וסקירה כללית של תחום לא עולה על ${Q.reviewCap} (מוצגות עד ${Q.maxReviews} כאלה).`),
      term("יעד למדידה", `חצי מהפער עד נקודת ההשוואה: היעד הרשמי, ואם אין או שהעיר עומדת בו, הגבוה מבין הממוצע הארצי והערך האמצעי של היישובים הדומים. הצעד נע בין ${Q.kpiStepMin} ל-${Q.kpiStepMax} נקודות, בהתאם לגודל השיפורים שהראיות מדווחות (בתוכנית שהראיות מדווחות עליה שיפור קטן, כמו עודף משקל בבתי ספר, הצעד נע בין ${Q.kpiStepSmall[0]} ל-${Q.kpiStepSmall[1]} נקודות), ונמדד שנתיים קדימה. מספר האנשים הוא הצעד כאחוז מגודל הקבוצה בשנה האחרונה.`),
      term("בדיקת נתונים קודם", `ההמלצה לבדוק אם הפער אמיתי מופיעה רק כשהמדד רחוק ${Q.outlierGap} נקודות לפחות מהממוצע הארצי ובתחתית ${Q.outlierLevel}% מהיישובים, או כשגודל הקבוצה השתנה בחדות לעומת הארץ.`),
      term("יישוב ללמוד ממנו", `מוצג יישוב דומה רק אם התוצאה שלו טובה ב-${Q.peerEdge} נקודות לפחות מזו של העיר והקבוצה בו גדולה מספיק.`),
      term("עוצמת ראיות", "חזקות: המלצה בראיות חזקות של צוות השירותים המונעים בארה״ב. בינוניות: המלצה בדרגה B או ראיות מספיקות. מוגבלות: מסגרת עבודה בלבד או ראיות חלשות. אין תווית: המלצה ניהולית ללא מחקר. כל קישור הוא לעמוד שנפתח ונבדק.")));
}

/* ═════════════════════════════ 06 reading the numbers, 07 limits ═════════════════════════════ */

function readingSec(meta, model, no) {
  const rules = meta.interpretation || [];
  if (!rules.length) return null;
  const split = (t) => { const m = /^([^:]{3,42}):\s*([\s\S]+)$/.exec(t); return m ? [h("b", m[1] + ": "), m[2]] : [t]; };
  return section("mt-reading", no, "קריאת המספרים", "איך לקרוא את המספרים", `${count(rules.length, "כלל אחד", "כללים")} שנאספו מהתקנון של משרד הבריאות, מהנתונים עצמם וממקורות מתודולוגיים, כדי למנוע טעויות קריאה נפוצות.`,
    h("ol.mt-read", rules.map((r) => h("li.rv", h("p", split(r.text), r.url ? [" ", h("a", { href: r.url, target: "_blank", rel: "noopener" }, "מקור")] : null)))));
}

function limitsSec(meta, model, no) {
  const items = ["הנתונים מתארים שירותים שנרשמו בתחנות טיפת חלב. שיעור נמוך עשוי לשקף גם שירות שניתן בקופה או אצל רופא פרטי ולא תועד.", "הממוצע הארצי אינו יעד. ביעדים רבים גם הממוצע הארצי רחוק מהיעד, ולכן מוצגים שניהם.",
    "שנים 2020–2021 (קורונה) ו-2023–2024 (מלחמה) עשויות להשפיע על השירות ועל הדיווח, בעיקר ביישובים שפונו.", "מדד שרואים בו פער בין קבוצות אינו מסביר את הסיבה. הוא מצביע על המקום שכדאי לבדוק בו.", "ההמלצות הן נקודת פתיחה לדיון עם הצוות המקצועי, לא תחליף להחלטה מקצועית."];
  return section("mt-limits", no, "מגבלות", "מגבלות שחשוב להכיר", null,
    h("ol.mt-lim", items.map((t, i) => h("li", h("b", String(i + 1).padStart(2, "0")), h("p", t.replace(/(\d{4})–(\d{4})/g, (m) => iso(m)))))));
}

/* ═════════════════════════════ the table of contents ═════════════════════════════ */

function toc(root, parts) {
  const have = parts.filter(([id]) => root.querySelector("#" + id));
  if (have.length < 2) return null;
  const jump = (id) => { const el = root.querySelector("#" + id); if (el) el.scrollIntoView({ behavior: smooth(), block: "start" }); };
  const btns = new Map(have.map(([id, label], i) => [id, h("button.mt-toc-b", { type: "button", onclick: () => jump(id) }, h("b", String(i + 1).padStart(2, "0")), label)]));
  const nav = h("nav.mt-toc.no-print", { "aria-label": "תוכן העניינים" }, h("div.mt-toc-t", "בעמוד הזה"), h("div.mt-toc-in", [...btns.values()]));
  btns.values().next().value.setAttribute("aria-current", "true");
  if (typeof IntersectionObserver === "function") {
    const live = new Set(), order = have.map(([id]) => id);
    const mark = () => { const cur = order.filter((id) => live.has(id)).pop() || order[0]; btns.forEach((b, id) => (id === cur ? b.setAttribute("aria-current", "true") : b.removeAttribute("aria-current"))); };
    const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) live.add(e.target.id); else live.delete(e.target.id); }); mark(); }, { rootMargin: "-140px 0px -55% 0px" });
    order.forEach((id) => io.observe(root.querySelector("#" + id)));
  }
  return nav;
}

/* ═════════════════════════════ the page ═════════════════════════════ */

export async function methodView(model) {
  const [meta, hl] = await Promise.all([getMeta(), model ? Promise.resolve(null) : health().catch(() => null)]);
  const builtAt = model ? model.builtAt : hl && hl.builtAt;
  const root = h("div.mt");
  const sections = [sourcesSec, measuresSec, frameworkSec, rulesSec, recsSec, readingSec, limitsSec];
  const made = sections.map((fn) => fn(meta, model, null)).filter(Boolean);
  // the numbers of the sections follow the ones that exist; the section functions get their number as the first text of the eyebrow
  made.forEach((s, i) => { const b = s.querySelector(".sec-eyebrow b"); if (b) b.textContent = String(i + 1).padStart(2, "0"); });
  const content = h("div.mt-content", made);
  const layout = h("div.mt-layout", content);
  root.append(hero(meta, model, builtAt), layout);
  const nav = toc(root, [["mt-sources", "מקורות"], ["mt-measures", "מה נמדד"], ["mt-framework", "מסגרת המדדים"], ["mt-rules", "כללי ההחלטה"], ["mt-recs", "איך נוצרות ההמלצות"], ["mt-reading", "איך לקרוא את המספרים"], ["mt-limits", "מגבלות"]]);
  if (nav) layout.append(nav);
  // a printed page cannot unfold what is folded
  const unfold = () => { if (!root.isConnected) { window.removeEventListener("beforeprint", unfold); return; } root.querySelectorAll("details").forEach((d) => { d.open = true; }); };
  window.addEventListener("beforeprint", unfold);
  return root;
}
