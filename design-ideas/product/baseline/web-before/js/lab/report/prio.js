// "מה לטפל קודם" (the top priorities as numbered rows with their own axis) and "מצב התחומים" (every domain at a glance, then every indicator by status).
// The sentences are the model's own (statusReason, compareLine, the findings); the order of the rows is the model's priority order.
import { h, svg, icon, ltr, fmtVal, compareLine, statusReason, countLabel, toneOf, DOMAIN_ICON } from "../../ui.js";
import { domainStrip } from "../../viz/matrix.js";
import { bell } from "./bell.js";
import { section, directionLine, hrefI, unitWord, nm, isNum, pad2, jumpTo, seeAll } from "./util.js";

const ORDER_NOTE = ["below_target", "trend_down", "equity_sector", "equity_ses", "gap_widening", "level_low"];
// the most telling concern about one indicator, in the finding's own words
function bestNote(model, id) {
  const fs = model.findings.filter((f) => f.indicator === id && f.polarity === "concern");
  fs.sort((a, b) => ORDER_NOTE.indexOf(a.type) - ORDER_NOTE.indexOf(b.type));
  const f = fs.find((x) => x.type !== "level_low") || null;
  return f ? f.text : null;
}
const whyOf = (model, a) => statusReason(a) || bestNote(model, a.id) || compareLine(a).text;

// ── what to deal with first ──────────────────────────────────────────────
function prioRow(model, a, i) {
  const L = a.last, key = model.city.key, val = ltr(fmtVal(a.unit, L.v, a.unit === "index" ? 2 : 1)), bl = bell(a, model.city.name);
  val.setAttribute("data-count", "");
  return h("li.lr-prio.rv", h("a.lr-prio-a." + toneOf(a.status) + (bl ? "" : ".is-nobell"), { href: hrefI(key, a.id) },
    h("span.lr-prio-n", { "aria-hidden": "true" }, pad2(i)),
    h("div.lr-prio-t", h("span.lr-prio-name", a.label), h("span.lr-prio-why", whyOf(model, a))),
    bl,
    h("div.lr-prio-v", h("b", val), h("small", [unitWord(a).trim(), unitWord(a) ? " · " : "", ltr(String(L.year))]))));
}

export function prioritiesSection(model, onMore) {
  const list = (model.priorities || []).map((id) => model.indicators.find((x) => x.id === id)).filter((a) => a && a.last && isNum(a.last.v) && a.last.reliable !== false).slice(0, 5);
  if (!list.length) return null;
  const rest = model.indicators.filter((a) => a.status === "concern" && !list.includes(a)).length;
  const lead = ["המדדים שכדאי לטפל בהם קודם. הסדר נקבע לפי כמה מקום יש לשפר, כמה המדד חשוב והאם הוא מחמיר. בכל שורה: היישוב, יישובים דומים והממוצע הארצי על ציר אחד, והצד הימני הוא הטוב יותר."];
  return section("lr-prio", "מה לטפל קודם", lead, directionLine(list),
    h("ol.lr-prios", list.map((a, i) => prioRow(model, a, i))),
    rest ? h("p.lr-prio-more.rv.no-print", ["יש עוד ", ltr(String(rest)), rest === 1 ? " מדד שדורש טיפול. " : " מדדים שדורשים טיפול. ", h("button.lr-linkbtn", { type: "button", onclick: onMore }, "לרשימה המלאה")]) : null);
}

// ── the state of every domain ────────────────────────────────────────────
const TABS = [["concern", "דורשים טיפול"], ["watch", "למעקב"], ["good", "תקינים"], ["strength", "חוזקות"], ["none", "ללא שיפוט"]];
const kind = (a) => (["concern", "watch", "good", "strength"].includes(a.status) ? a.status : "none");
const hollow = () => svg("svg", { class: "lr-hollow", viewBox: "0 0 24 24", width: 18, height: 18, "aria-hidden": "true" }, svg("circle", { cx: 12, cy: 12, r: 6, fill: "none" }));

function byStatus(model) {
  const key = model.city.key, groups = Object.fromEntries(TABS.map(([k]) => [k, []]));
  model.indicators.forEach((a) => groups[kind(a)].push(a));
  Object.values(groups).forEach((g) => g.sort((x, y) => y.priority - x.priority || y.importance - x.importance));
  const have = TABS.filter(([k]) => groups[k].length);
  if (!have.length) return null;
  const body = h("div.lr-bs-body", { role: "tabpanel", id: "lr-bs-panel", "aria-live": "polite" });
  const word = (k, n) => (k === "concern" ? countLabel("concern", n) : k === "good" ? countLabel("good", n) : k === "strength" ? countLabel("strength", n) : TABS.find((t) => t[0] === k)[1]);
  const tabs = have.map(([k]) => h("button.lr-tab", { type: "button", role: "tab", id: "lr-bs-" + k, "aria-controls": "lr-bs-panel", "aria-selected": "false", onclick: () => select(k) }, h("b", ltr(String(groups[k].length))), " ", word(k, groups[k].length)));
  const item = (a) => {
    const L = a.last, small = L && L.reliable === false, v = L && isNum(L.v) ? [ltr(fmtVal(a.unit, L.v)), unitWord(a)] : "—";
    const why = small ? "הקבוצה קטנה מכדי להשוות או להסיק" : statusReason(a) || (L && L.gapNat != null ? compareLine(a).text : null);
    return h("li.lr-li", h("a.lr-li-n", { href: hrefI(key, a.id) }, small ? hollow() : null, a.label), h("span.lr-li-v", v), why ? h("span.lr-li-w", why) : null);
  };
  function select(k) {
    tabs.forEach((t, i) => { const on = have[i][0] === k; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
    body.setAttribute("aria-labelledby", "lr-bs-" + k);
    body.replaceChildren(h("ul.lr-list", groups[k].map(item)));
  }
  const first = have.find(([k]) => k === "concern") || have[0];
  select(first[0]);
  const node = h("div.lr-bystatus.no-print", { id: "lr-bystatus" }, h("h3.lr-h3.rv", "כל המדדים לפי מצב"), h("div.lr-tabs.rv", { role: "tablist", "aria-label": "מצב המדד" }, tabs), body);
  return { node, select: (k) => select(groups[k] && groups[k].length ? k : first[0]) };
}

export function domainsSection(model) {
  const key = model.city.key;
  const domains = model.domains.filter((d) => d.indicators.length).map((d) => ({
    id: d.id, label: d.label, icon: DOMAIN_ICON[d.id] || "bars", href: `#/c/${key}/d/${d.id}`, blurb: (d.blurb || "").split(/[:.]/)[0].trim(),
    indicators: model.indicators.filter((i) => i.domain === d.id).map((i) => ({ id: i.id, label: i.short || i.label, status: i.status, href: hrefI(key, i.id), value: i.last && isNum(i.last.v) ? fmtVal(i.unit, i.last.v) : "", priority: i.priority })) }));
  if (!domains.length) return null;
  const small = model.indicators.some((a) => a.last && a.last.reliable === false);
  const bs = byStatus(model);
  const strip = domainStrip({ domains });
  strip.querySelectorAll(".v-mx-row").forEach((row) => { if (!row.querySelector(".v-mx-cell.s-concern, .v-mx-cell.s-watch, .v-mx-cell.s-good, .v-mx-cell.s-strength")) row.classList.add("lr-bgrow"); });          // a domain with nothing judged is left out of the printed page
  const node = section("lr-domains", "מצב התחומים", "כל תחום בשורה אחת, והתחום שדורש הכי הרבה תשומת לב ראשון. כל ריבוע הוא מדד אחד, וצבעו הוא מצבו. לחיצה על תחום או על מדד פותחת אותו.",
    h("div.lr-strip.rv", strip),
    small ? h("p.lr-note.rv", icon("info"), "מדד בקבוצה קטנה נשאר אפור: הקבוצה קטנה מכדי להשוות או להסיק.") : null,
    bs ? bs.node : null);
  return { node, select: bs ? bs.select : null, ready: !!bs };
}
