// The parts of the entry page under the hero: what is checked (spot illustrations), why it can be trusted, the closing search, the sources and the footer.
// Names, counts, publishers and links come from /api/meta and /api/health; only the plain sentences are written here.
import { h, add, icon, logoMark, dateHe } from "../../ui.js";
import { searchBox } from "../../components.js";
import { homeHref, quickChildren, readLast } from "./hero.js";

const IMG = "assets/lab/spots/";
const b = (n) => h("b.ltr", { "data-count": "" }, Number(n).toLocaleString("en-US"));
const publisherOf = (s) => String(s.publisher || "").split(/[,(]/)[0].trim();
const put = (el, ...kids) => { el.replaceChildren(); return add(el, kids); };          // like replaceChildren, but the text goes through the same tidying as h() (no lone number at a line end)
const nw = (...kids) => h("span.nw", ...kids);
const joinHe = (parts) => (parts.length < 2 ? parts[0] || "" : parts.slice(0, -1).join(", ") + " ו" + parts[parts.length - 1]);

// the six illustrated domains: the picture, the domain's id in the model and one plain line about what is looked at in it (from the domain's own description)
const SPOTS = [
  { spot: "vaccine", domain: "immunization", say: "חצבת, שעלת ושיתוק ילדים בגיל הרך" },
  { spot: "child", domain: "child", say: "מעקב גדילה והתפתחות בטיפות חלב" },
  { spot: "mind", domain: "mental", say: "דיכאון אחרי לידה ושירותי בריאות הנפש" },
  { spot: "nutrition", domain: "nutrition", say: "הנקה, תוסף ברזל ומשקל התלמידים" },
  { spot: "access", domain: "access", say: "כמה מחכים לרופא מומחה וכמה רופאים יש" },
  { spot: "environment", domain: "env", say: "שטחים ירוקים ורעש בערים הגדולות" }
];

const head = (id, eyebrow, title, lead) => h("div.le-head", h("p.le-eyebrow.rv", eyebrow), h("h2.le-h2.rv", { id }, title), lead || null);

// ── 2. what is checked ───────────────────────────────────────────────────
export function domains() {
  const list = h("ul.le-spots"), more = h("p.le-more.rv"), lead = h("p.le-lead.rv");
  const el = h("section.le-sec.le-domains", { "aria-labelledby": "le-d-t", hidden: true }, h("div.le-wrap", head("le-d-t", "מה בודקים", "מה בודקים ביישוב שלכם", lead), list, more));
  const fill = (d) => {
    const meta = d.meta;
    if (!meta || !meta.indicators || !meta.domains) return;
    const count = {};
    meta.indicators.forEach((i) => { count[i.domain] = (count[i.domain] || 0) + 1; });
    const byId = Object.fromEntries(meta.domains.map((x) => [x.id, x]));
    const shown = SPOTS.filter((s) => byId[s.domain] && count[s.domain]);
    if (!shown.length) return;
    list.replaceChildren(...shown.map((s, i) => h("li.le-spot.rv", { style: { "--i": i } },
      h("div.le-spot-art",
        h("img.le-spot-img.on-light", { src: `${IMG}${s.spot}.webp`, width: 512, height: 512, alt: "", "aria-hidden": "true", loading: "lazy", decoding: "async" }),
        h("img.le-spot-img.on-dark", { src: `${IMG}${s.spot}-paper.webp`, width: 512, height: 512, alt: "", "aria-hidden": "true", loading: "lazy", decoding: "async" })),
      h("h3.le-spot-n", byId[s.domain].label), h("p.le-spot-c", s.say),
      h("p.le-spot-k", count[s.domain] === 1 ? "מדד אחד" : [b(count[s.domain]), "\u00A0מדדים"]))));
    const withData = meta.domains.filter((x) => count[x.id]).length;
    put(lead, b(meta.indicators.length), "\u00A0מדדים ", nw("ב-", b(withData)), "\u00A0תחומים. איפה שיש עם מה להשוות, כל מדד מושווה לממוצע הארצי, ליישובים דומים וליעד של משרד הבריאות.");
    const rest = meta.domains.filter((x) => count[x.id] && !SPOTS.some((s) => s.domain === x.id));
    if (rest.length) put(more, "ועוד ", b(rest.reduce((n, x) => n + count[x.id], 0)), "\u00A0מדדים: ", joinHe(rest.map((x) => x.label)), ".");
    el.hidden = false;
  };
  return { el, fill };
}

// ── 3. why it can be trusted ─────────────────────────────────────────────
export function trust() {
  const p1 = h("p.le-promise-p", "כל מספר באתר מגיע ממקור רשמי. ליד כל מדד מצורף המקור שלו, ואפשר לפתוח אותו ולבדוק."), spec1 = h("div.le-spec");
  const promise = (n, title, text, spec) => h("li.le-promise.rv", h("span.le-no", { "aria-hidden": "true" }, String(n)), h("h3.le-promise-h", title), text, spec);
  const el = h("section.le-sec.le-trust", { "aria-labelledby": "le-t-t" }, h("div.le-wrap",
    head("le-t-t", "למה אפשר לסמוך", "למה אפשר לסמוך על המספרים"),
    h("ol.le-promises",
      promise(1, "כל מספר מגיע ממקור רשמי", p1, spec1),
      promise(2, "קבוצה קטנה מדי לא מדורגת", h("p.le-promise-p", "ביישוב קטן מספר אחד קופץ משנה לשנה. כשהקבוצה קטנה מכדי להסיק ממנה, המספר מוצג כמו שהוא, בסימון חלול, בלי דירוג ובלי השוואה ליישובים אחרים."),
        h("div.le-spec", h("span.le-hollow", { "aria-hidden": "true" }), "הקבוצה קטנה מכדי להשוות או להסיק")),
      promise(3, "הבינה המלאכותית כותבת משפטים, לא מספרים", h("p.le-promise-p", "כל מספר נלקח ישירות מהנתונים הרשמיים. הבינה המלאכותית רק מנסחת את המילים, וכל טקסט שהיא כתבה מסומן."),
        h("div.le-spec", h("span.ai-badge", icon("spark"), "נכתב בבינה מלאכותית")))),
    h("p.le-trust-more.rv", h("a", { href: "#/method" }, "איך מחשבים, ומה מגבלות הנתונים: שיטה ומקורות", icon("left")))));
  const fill = (d) => {
    const srcs = d.meta && d.meta.sources ? Object.values(d.meta.sources) : [];
    if (!srcs.length) return;
    const pubs = [...new Set(srcs.map(publisherOf).filter(Boolean))], first = srcs.find((s) => s.url) || null;
    put(p1, `הנתונים מתפרסמים על ידי ${joinHe(pubs)}. ליד כל מדד מצורף המקור שלו, ואפשר לפתוח אותו ולבדוק.`);
    if (first) spec1.replaceChildren(h("a.le-srcline", { href: first.url, target: "_blank", rel: "noopener" }, icon("link"), h("span", "מקור: " + [first.publisher, first.name].filter(Boolean).join(" · "), h("span.sr", " (נפתח בלשונית חדשה)"))));
  };
  return { el, fill };
}

// ── 5a. the closing search: someone who scrolled down can start here ─────
export function closing() {
  const last = readLast(), quick = h("div.le-quick.rv", quickChildren([], last));
  const el = h("section.le-sec.le-closing", { "aria-labelledby": "le-c-t" }, h("div.le-wrap.le-closing-in",
    h("h2.le-h2.rv", { id: "le-c-t" }, "מוכנים? מצאו את היישוב שלכם"),
    h("p.le-lead.rv", "הקלידו את שם היישוב וקבלו את התמונה שלו."),
    h("div.le-search.rv", searchBox({ big: true, openOnFocus: false, placeholder: "הקלידו שם יישוב" })),
    quick));
  const fill = (d) => { if (d.top && d.top.length) { quick.replaceChildren(); add(quick, quickChildren(d.top, last)); } };
  return { el, fill };
}

// ── 5b. the sources: every publisher with its datasets, each a link to the original ─
export function sources() {
  const grid = h("div.le-srcs"), lead = h("p.le-lead.rv");
  const el = h("section.le-sec.le-sources", { "aria-labelledby": "le-r-t", hidden: true }, h("div.le-wrap", head("le-r-t", "המקורות", "מאיפה המספרים", lead), grid));
  const fill = (d) => {
    const srcs = d.meta && d.meta.sources ? Object.values(d.meta.sources) : [];
    if (!srcs.length) return;
    const groups = new Map();
    srcs.forEach((s) => { const p = publisherOf(s) || "מקורות נוספים"; if (!groups.has(p)) groups.set(p, []); groups.get(p).push(s); });
    grid.replaceChildren(...[...groups].map(([p, list], i) => h("div.le-src-g.rv", { style: { "--i": i } }, h("h3.le-src-p", p),
      h("ul", list.map((s) => h("li", s.url ? h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.name, h("span.sr", " (נפתח בלשונית חדשה)")) : s.name))))));
    put(lead, b(srcs.length), "\u00A0מקורות רשמיים. כל קישור פותח את הנתונים המקוריים.");
    el.hidden = false;
  };
  return { el, fill };
}

// ── 5c. the footer ───────────────────────────────────────────────────────
export function footer() {
  const when = h("p.le-foot-d");
  const el = h("footer.le-foot", h("div.le-wrap.le-foot-in",
    h("a.le-foot-brand", { href: homeHref(), "aria-label": "CityPulse" }, logoMark(), h("b", "CityPulse")),
    h("p.le-foot-t", "כלי עזר לקבלת החלטות, לא תחליף לשיקול דעת מקצועי."),
    h("div.le-foot-r", when, h("a", { href: "#/method" }, "שיטה ומקורות"))));
  const fill = (d) => { if (d.hl && d.hl.builtAt) when.textContent = "הנתונים עודכנו ב-" + dateHe(d.hl.builtAt); };
  return { el, fill };
}
