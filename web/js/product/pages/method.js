// Method and sources in the product (#/method and #/c/<key>/method): the old module's hero (the claim, three counting facts, the road of a number) becomes the pale band by
// the router's default; the sections stay as they are. Added here: one more section (the glossary, privacy, the data licence, the open data line) and a contents list
// that knows it, sticky beside the text on a wide screen and a strip under the band on a narrow one. Styles: css/product/pages/method.css (n-pg-method-).
import { h, icon, ltr } from "../../ui.js";
import { GLOSSARY, glossaryHref } from "../kit/glossary.js";
import { exportHref } from "../kit/csv.js";
import { infoHref, hereTown } from "../nav.js";
import * as G from "../kit/guide.js";
import { shortName } from "../city/copy.js";

const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
// The sentences of the rules come from the catalogue on the server (read-only). A few of them hold a word SPEC 7.1 forbids or a field name; the page says them in plain Hebrew.
// Each pair is [what the text holds, what the page says]; the words are written as escapes where SPEC 7.1 forbids them in a source file.
const PLAIN = [
  [new RegExp("\u05D0\u05D9\u05E0\u05DD \u05DE\u05D5\u05D1\u05D4\u05E7\u05D9\u05DD", "g"), "אינם משקפים הבדל אמיתי"],
  [/ ?\(station_city\)/g, ""],
  [/ \(station\)/g, ""],
  [/חיסון MMR\/MMRV מגן מפני חצבת, חזרת ואדמת \(וב.MMRV גם אבעבועות רוח\)/g, "החיסון מגן מפני חצבת, חזרת ואדמת (ובגרסה המשולבת גם מפני אבעבועות רוח)"],          // the row is under the vaccine's own name; the Latin codes are the name of two products
  [/ \(ראו data_hint להגדרה המדויקת בעמודה\)/g, ""],          // the table of the framework (when a row is opened) quotes the names of fields of the data files: the reader needs the sentence, not the field
  [/ \(שדה INJ0_19\s+במאגר\)/g, ""],          // (a number and the word after it are held together by a non-breaking space)
  [/ \((?:EPDS\/EDS|SIDS)\)/g, ""],
  [/עיר ענייה בביצועים שנובעים ממצבה/g, "יישוב עני בביצועים שנובעים ממצבו"],
  [/שדה target /g, "שדה היעד "],
  [/בשדה Socio Economic Group/g, "בשדה האשכול החברתי־כלכלי"],
  [/ולהציג רווח סמך או תרשים משפך \(funnel plot\)/g, "ולהציג טווח של אי־ודאות או תרשים משפך"],
  [/\(ייחוס בינלאומי\)/g, "(נקודת ייחוס)"],          // the old table calls every figure that is not an official target "international"; the US national objectives are a reference from abroad, and the product's word for one is "נקודת ייחוס"
  [/יעד בין-לאומי אינו יעד ישראלי: הוא נקודת ייחוס בלבד\./g, "נקודת ייחוס מחו״ל אינה יעד: היא משמשת להתמצאות בלבד."],
  [/ ?\(\u2066?z ≥ ?\d+\u2069?\)/g, ""]          // the name of a statistical test in brackets: a health officer needs the sentence ("clear enough not to be chance"), not the test
];
function plainWords(node) {
  if (node.nodeType === 3) { const v = node.nodeValue, s = PLAIN.reduce((x, [from, to]) => x.replace(from, to), v); if (s !== v) node.nodeValue = s; return; }
  node.childNodes.forEach(plainWords);
}

const PARTS = [["mt-sources", "מקורות"], ["mt-measures", "מה נמדד"], ["mt-framework", "מסגרת המדדים"], ["mt-rules", "כללי ההחלטה"], ["mt-guides", "יעדים רשמיים"], ["mt-recs", "איך נוצרות ההמלצות"], ["mt-reading", "מול הראיות"], ["mt-limits", "מגבלות"], ["mt-more", "מילון ופרטיות"]];

// the block of links and rules that the old page does not have
export function moreSection(model, no) {
  const key = model ? String(model.city.key) : "1031";
  const row = (title, ...body) => h("div.n-pg-method-row", h("h3", title), h("p", ...body));
  return h("section.sec.mt-sec.n-pg-method-more", { id: "mt-more", "aria-labelledby": "mt-more-t" },
    h("div.sec-head.rv", h("div", h("div.sec-eyebrow", h("b", no), "מילון ופרטיות"), h("h2.sec-title", { id: "mt-more-t" }, "מילון, פרטיות ורישיון הנתונים"),
      h("p.sec-lead", "מה פירוש המילים שבעמודים, מה נשמר במכשיר שלכם, ומה מותר לעשות עם הנתונים."))),
    h("div.n-pg-method-rows",
      row("מילון מונחים", "הסבר קצר לכל מילה שעשויה להיות לא ברורה: ", GLOSSARY.slice(0, 6).map((t, i) => [i ? ", " : "", h("a", { href: glossaryHref(t.id) }, t.term)]), ". ", h("a.n-pg-method-go", { href: glossaryHref() }, "לכל המונחים")),
      row("פרטיות", "אין עוגיות מעקב, אין כלי ניתוח ואין פנייה לשירותי צד שלישי בעת הצפייה בנתונים. המכשיר שלכם שומר רק את מצב התצוגה, את היישובים שבחרתם ואת המעקב שלכם. ", h("a.n-pg-method-go", { href: infoHref("privacy", hereTown()) }, "מדיניות הפרטיות")),
      row("רישיון הנתונים", "המספרים מגיעים ממקורות רשמיים, ולכל מקור תנאי שימוש משלו: הרישיון של כל אחד מהם מצוין בטבלת המקורות למעלה. ההצגה כאן היא למידע ולתעדוף, לא לציון או לדירוג של היישוב."),
      row("נתונים פתוחים", "את המספרים של יישוב אפשר להוריד כקובץ גיליון (CSV). לכל מדד בו כתובים התחום, הכיוון, השנה, הערך והיחידה, הממוצע הארצי, היישובים הדומים, המצב, המקום בין היישובים, המקור, היעד הרשמי והפער ממנו, ונקודת הייחוס כשיש. ",
        h("a.n-pg-method-go", { href: exportHref(key), download: "" }, model ? `הורדת הקובץ של ${model.city.name}` : "הורדת קובץ לדוגמה"),
        ". מי שמחבר את הנתונים למערכת אחרת יכול לקרוא אותם גם מהכתובת ", h("code", ltr(`/api/city/${key}`)), ".")));
}

// ── the official targets: which figures are set against one, which only show one, which have none, and the documents behind them (the catalogue, GET /api/meta) ──
// A plain section after the decision rules, with the one rule that matters: a figure that meets its official target is "תקין" at least, a figure far from it stays "דורש טיפול".
const clean = G.clean;
const link = (url, text) => (url ? h("a", { href: url, target: "_blank", rel: "noopener" }, text, h("span.sr", " (נפתח בלשונית חדשה)")) : text);
const nameOf = (i) => shortName(i);
const joinNames = (list) => list.map(nameOf).join(", ");
export function guidesSection(meta, no) {
  const c = G.catalogueOf(meta), rules = (meta && meta.rules) || {}, near = rules.nearTarget, far = rules.farBelowTarget;
  const row = (title, ...body) => h("div.n-pg-method-row", h("h3", title), ...body);
  const docOf = (id) => c.docs.find((d) => d.id === id);
  // the documents that set a target the status reads: each with the figures it covers
  const judging = c.docs.filter((d) => d.judges).map((d) => h("li", link(d.url, `${d.short}: ${d.name}`), ": ", joinNames(c.target.filter((i) => i.guideline.source && i.guideline.source.id === d.id)), "."));
  const shown = [...c.orient.map((i) => [i, i.guideline, "יעד"]), ...c.bench.map((i) => [i, i.benchmark, "נקודת ייחוס"])].map(([i, ref, kind]) => {
    const d = docOf(ref.source && ref.source.id) || {};
    return h("li", h("b", nameOf(i)), ": ", kind === "יעד" ? "יעד להתמצאות, " : "נקודת ייחוס, ", clean(ref.text), " (", ref.source ? ref.source.short : d.short, ref.year ? ", " + ref.year : "", "). ", link(d.url || (ref.source && ref.source.url), "למקור"));
  });
  const rule = [`מדד שעומד ביעד הרשמי שלו ואינו בהידרדרות נחשב תקין לפחות, גם אם יישובים רבים טובים ממנו. חוזק מחייב גם שהמדד יעמוד ביעד.`,
    Number.isFinite(far) ? ` מדד שחסרות לו יותר מ-${far} נקודות אחוז ליעד נשאר דורש טיפול גם אם הוא טוב מהממוצע הארצי.` : " מדד שרחוק מהיעד נשאר דורש טיפול גם אם הוא טוב מהממוצע הארצי.",
    Number.isFinite(near) ? ` מדד שחסרות לו יותר מ-${near} נקודות אחוז ליעד אינו נחשב תקין.` : ""].join("");
  return h("section.sec.mt-sec.n-pg-method-guides", { id: "mt-guides", "aria-labelledby": "mt-guides-t" },
    h("div.sec-head.rv", h("div", h("div.sec-eyebrow", h("b", no), "יעדים רשמיים"), h("h2.sec-title", { id: "mt-guides-t" }, "מה היעד הרשמי, ואיך הוא נבדק"),
      h("p.sec-lead", "הממוצע הארצי אומר איפה היישוב ביחס לאחרים, ולא אם המצב טוב. לכן מדד שיש לו יעד רשמי נבדק גם מולו, והמצב נקבע לפי שניהם."))),
    h("div.n-pg-method-rows",
      row("הכלל", h("p", rule, " ", h("a.n-pg-method-go", { href: glossaryHref("target") }, "מה זה יעד רשמי"))),
      judging.length ? row(`יעד שקובע את המצב: ${cnt(c.target.length)}`, h("p", "יעד של גוף רשמי לאותו מדד ולאותה יחידה. הערך נבדק מולו, והדף של כל מדד אומר מי פרסם אותו ומה חסר ליעד."), h("ul.n-pg-method-glist", judging)) : null,
      shown.length ? row("מוצגים להתמצאות בלבד", h("p", "הם לא משנים את מצב המדד: היעד מודד דבר קרוב ולא אותו דבר, או מדינה ולא יישוב."), h("ul.n-pg-method-glist", shown)) : null,
      c.none.length ? row(`אין יעד רשמי: ${cnt(c.none.length)}`, h("details.n-pg-method-more", h("summary", "אילו מדדים"), h("p", joinNames(c.none), ".")), h("p", "בדף של כל מדד כתוב למה אין לו יעד.")) : null));
}
const cnt = (n) => (n === 1 ? "מדד אחד" : `${n} מדדים`);

// ── the evidence behind the recommendations: replaces the old section "איך לקרוא את המספרים", which was the 16 rules of the evidence framework written for the people who build the model
// (to-do lines, names of towns to check, field names). Two to four plain sentences, each a fact of the framework file (src/catalog/evidence.json, GET /api/meta): the strength labels and
// their ceiling are what tests/model.test.js keeps true (a recommendation claims at most the strength of the strongest page it cites; with no cited page it carries no label); the counts
// are counted from the catalogue the page was given (a count that is not there is left out, never typed).
export function readingSection(meta, model, no) {
  const fw = Array.isArray(meta && meta.framework) ? meta.framework : [], rules = Array.isArray(meta && meta.interpretation) ? meta.interpretation : [];
  const withWork = fw.filter((p) => p && p.interventions > 0).length;
  const sentences = [
    "התערבות שמאחורי המלצה מתועדת בעמוד מקור, ולכל עמוד כזה יש קישור ותווית של עוצמת הראיות: חזקות, בינוניות או מוגבלות.",
    "המלצה אינה מקבלת עוצמה גבוהה מזו של העמוד החזק ביותר שהיא מצטטת, והמלצה שאין מאחוריה עמוד מקור אינה מסומנת בעוצמה כלל.",
    fw.length && withWork ? `המסגרת מונה ${cnt(fw.length)}, ול-${withWork} מהם תועדה לפחות התערבות אחת.` : null,
    rules.length ? `${rules.length === 1 ? "כלל קריאה אחד נאסף" : `${rules.length} כללי קריאה נאספו`} יחד עם המסגרת, כדי להזהיר מפני טעויות נפוצות, כמו מסקנה ממספר קטן של מקרים או מהפרש קטן בדירוג.` : null
  ].filter(Boolean);
  return h("section.sec.mt-sec.n-pg-method-reading", { id: "mt-reading", "aria-labelledby": "mt-reading-t" },
    h("div.sec-head.rv", h("div", h("div.sec-eyebrow", h("b", no), "ראיות"), h("h2.sec-title", { id: "mt-reading-t" }, "איך נבדקות ההמלצות מול הראיות"))),
    h("div.n-pg-method-rows", h("div.n-pg-method-row", h("p", sentences.join(" ")),
      model ? h("p", h("a.n-pg-method-go", { href: `#/c/${encodeURIComponent(model.city.key)}/actions` }, "להמלצות של " + model.city.name)) : null)));
}

// the contents list: the old one is replaced so that the new section is in it and in the "where am I" mark
function contents(root) {
  const have = PARTS.filter(([id]) => root.querySelector("#" + id));
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

// The framework section lists the 44 parameters by the framework's own topics (not the categories of the product): its topic "חיסונים" is named for what it covers, so that no
// reader takes it for the old category of the town pages
function frameworkTopics(node) {
  node.querySelectorAll(".mt-fw-name").forEach((el) => { if (el.textContent.trim() === "חיסונים") el.textContent = "כיסוי חיסונים"; });
  // "1 מתוך 1 נמדדים" is not a sentence: a topic of one figure says so
  node.querySelectorAll(".mt-fw-n").forEach((el) => {
    const m = /^(\d+)\s+מתוך\s+1\s+נמדדים$/.exec(el.textContent.replace(/[\u2060\u2066-\u2069]/g, "").trim());          // the page keeps a number and its word together with a non-breaking space
    if (m) el.textContent = m[1] === "1" ? "מדד אחד · נמדד" : "מדד אחד · טרם נמדד";
  });
}

// the rule of the trend names its method in brackets: "(שיטת Theil-Sen)". The sentence already says what is done (the median of the slopes); the name is for a statistician
function dropMethodName(node) {
  node.querySelectorAll(".mt-nw").forEach((sp) => {
    if (!/Theil/.test(sp.textContent)) return;
    const prev = sp.previousSibling, next = sp.nextSibling;
    if (prev && next && prev.nodeType === 3 && next.nodeType === 3 && /\(\s*שיטת\s*$/.test(prev.nodeValue) && /^\s*\)/.test(next.nodeValue)) {
      prev.nodeValue = prev.nodeValue.replace(/\s*\(\s*שיטת\s*$/, ""); next.nodeValue = next.nodeValue.replace(/^\s*\)/, ""); sp.remove();
    }
  });
}

export function adapt(node, ctx) {
  plainWords(node);
  frameworkTopics(node);
  dropMethodName(node);
  const content = node.querySelector(".mt-content"), layout = node.querySelector(".mt-layout");
  if (!content || !layout) return node;
  // the section of the official targets goes after the decision rules; ctx.meta is the catalogue (routes.js reads it); without it the page is as it was
  const meta = ctx.meta;
  const reading = content.querySelector("#mt-reading");
  if (reading) reading.replaceWith(readingSection(meta, ctx.model, "00"));          // the 16 rules written for the builders leave the page
  const rules = content.querySelector("#mt-rules");
  if (rules && meta && Array.isArray(meta.indicators) && meta.indicators.some((i) => i && (i.guideline || i.benchmark))) rules.after(guidesSection(meta, "00"));
  content.querySelectorAll(".mt-sec").forEach((sec, i) => { const b = sec.querySelector(".sec-eyebrow b"); if (b) b.textContent = String(i + 1).padStart(2, "0"); });          // the numbers follow the order the sections are in
  const sections = content.querySelectorAll(".mt-sec").length;
  content.append(moreSection(ctx.model, String(sections + 1).padStart(2, "0")));
  const old = layout.querySelector(".mt-toc"), nav = contents(node);
  if (old) old.remove();
  if (nav) layout.append(nav);
  // the road of a number leaves the band (on a phone it made the band a full screen tall) and opens the page; a town's own method page has the way back to the town
  const hero = node.querySelector(".mt-hero"), road = hero && hero.querySelector(".mt-flow");
  if (road) hero.after(h("div.n-pg-method-road", road));
  const main = hero && hero.querySelector(".mt-hero-main");
  if (main && ctx.model) main.prepend(h("a.n-band-back.n-pg-method-back.no-print", { href: `#/c/${encodeURIComponent(ctx.model.city.key)}` }, icon("right", 16), "דף היישוב"));
  return node;
}
