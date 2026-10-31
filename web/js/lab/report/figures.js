// "המספרים הראשיים" (the headline figures in one row, no boxes) and "המגמה" (one wide line chart with underlined tabs and one sentence that reads the trend).
// Every number and sentence comes from the model; the trend is the indicator's own history, never an aggregate of several.
import { h, add, clear, icon, num, ltr, fmtVal, compareLine, trendInfo, deltaUnit, directionNote, directionIcon } from "../../ui.js";
import { getIndicator } from "../../api.js";
import { sparkArea, lineChart, indicatorLine, legendOf, peerBand, EVENTS_IL } from "../../viz/time.js";
import { section, pickFigures, directionLine, nm, hrefI, unitWord, isNum, seeAll, onPrint } from "./util.js";

// ── the headline figures ─────────────────────────────────────────────────
function figure(model, a, mixed) {
  const L = a.last, cmp = compareLine(a), n = ltr(fmtVal(a.unit, L.v, a.unit === "index" ? 2 : 1));
  n.setAttribute("data-count", "");
  const spark = a.series.filter((s) => isNum(s.v)).length > 1 ? sparkArea(a.series.map((s) => ({ v: s.v, year: s.year })), a.series.map((s) => s.nat), { w: 176, h: 46, unit: a.unit, label: nm(a) }) : null;
  return h("a.lr-fig.rv", { href: hrefI(model.city.key, a.id), title: a.label },
    h("span.lr-fig-name", a.label),
    h("span.lr-fig-val", n, unitWord(a) ? h("small", unitWord(a).trim()) : null),
    h("span.lr-fig-year", ["נתוני ", ltr(String(L.year))], mixed ? h("span.lr-fig-dir", { title: directionNote(a.direction) }, icon(directionIcon(a.direction))) : null),
    h("span.lr-fig-spark", spark),
    h("span.lr-fig-cmp.tone-" + cmp.tone, icon(cmp.ic), cmp.text));
}

export function figuresSection(model) {
  const pick = pickFigures(model);
  if (!pick.length) return null;
  const mixed = new Set(pick.map((a) => a.direction || "none")).size > 1;
  return section("lr-figs", "המספרים הראשיים", "המדדים החשובים ביותר שיש עליהם נתון אמין. הקו הקטן מראה איך המספר השתנה בשנים האחרונות, והקו הדק והאפור את הממוצע הארצי.",
    directionLine(pick), h("div.lr-figs", pick.map((a) => figure(model, a, mixed))));
}

// ── the trend ────────────────────────────────────────────────────────────
// up to five indicators with at least four years of data: the headline figures first, then the most pressing; small groups and old figures are never trended
export function trendCandidates(model, first = []) {
  const years = (a) => a.series.filter((s) => isNum(s.v)).length;
  return model.indicators.filter((a) => a.last && isNum(a.last.v) && a.last.reliable !== false && !a.stale && years(a) >= 4)
    .sort((x, y) => (first.includes(x) ? 0 : 1) - (first.includes(y) ? 0 : 1) || y.priority - x.priority || y.importance - x.importance || years(y) - years(x)).slice(0, 5);
}

const TREND_NOUN = { improving: "בשיפור", worsening: "בהידרדרות", stable: "יציבה", rising: "עולה", falling: "יורדת" };

// ONE sentence in words: from what to what, in which years, whether that is good, and what the nation did meanwhile
export function trendSentence(a) {
  const hs = a.history, F = hs && hs.first, L = a.last;
  if (!F || !L || !isNum(F.v) || !isNum(L.v) || F.year === L.year) return null;
  const d = L.v - F.v, mag = Math.abs(d), dec = mag >= 10 ? 0 : 1, flat = Math.round(mag * 10 ** dec) === 0, ti = trendInfo(a);
  const amount = [ltr(num(mag, dec)), deltaUnit(a.unit)];
  const nat0 = (a.series.find((s) => s.year === F.year) || {}).nat, nat1 = L.nat;
  const word = ti && TREND_NOUN[hs.trendClass] && (hs.trendClass !== "stable" || flat) ? h("span.lr-tw.tone-" + ti.tone, icon(ti.ic), "מגמה " + TREND_NOUN[hs.trendClass]) : null;
  return ["מ-", ltr(fmtVal(a.unit, F.v)), " ב-", ltr(String(F.year)), " ל-", ltr(fmtVal(a.unit, L.v)), " ב-", ltr(String(L.year)), ": ",
    flat ? "כמעט ללא שינוי" : [d > 0 ? "עלייה של " : "ירידה של ", ...amount], word ? [", ", word] : null,
    isNum(nat0) && isNum(nat1) ? [", בזמן שהממוצע הארצי עבר מ-", ltr(fmtVal(a.unit, nat0)), " ל-", ltr(fmtVal(a.unit, nat1))] : null, "."];
}

export function trendSection(model, firstFigures) {
  const cands = trendCandidates(model, firstFigures);
  if (!cands.length) return null;
  const key = model.city.key, uid = "lr-tr";
  const title = h("h3.lr-ct"), dirNote = h("p.lr-dir.lr-dir-one"), read = h("p.lr-read", { "aria-live": "polite" }), box = h("div.lr-chart"), legend = h("div.legend.lr-legend"), more = h("div.lr-trend-more.no-print");
  const panel = h("div.lr-panel", { role: "tabpanel", id: uid + "-panel" }, title, dirNote, read, box, legend, more);
  let seq = 0, cfgNow = null;
  const tabs = cands.map((a, i) => h("button.lr-tab", { type: "button", role: "tab", id: `${uid}-${i}`, "aria-controls": uid + "-panel", "aria-selected": "false", tabindex: "-1", onclick: () => show(i) }, nm(a)));
  const list = h("div.lr-tabs.rv", { role: "tablist", "aria-label": "בחירת מדד למגמה" }, tabs);
  list.addEventListener("keydown", (e) => {
    const cur = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true"), k = e.key;
    const next = k === "ArrowLeft" ? cur + 1 : k === "ArrowRight" ? cur - 1 : k === "Home" ? 0 : k === "End" ? tabs.length - 1 : null;     // a Hebrew page runs right to left: the left arrow is "next"
    if (next == null || next < 0 || next >= tabs.length) return;
    e.preventDefault(); show(next); tabs[next].focus();
  });
  async function show(i) {
    const a = cands[i], my = ++seq;
    tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    panel.setAttribute("aria-labelledby", `${uid}-${i}`);
    title.replaceChildren(a.label);
    dirNote.replaceChildren(icon(directionIcon(a.direction)), directionNote(a.direction) + ".");
    const sentence = trendSentence(a);
    add(clear(read), [sentence || "אין מספיק שנים כדי לקרוא מגמה."]);
    more.replaceChildren(seeAll(hrefI(key, a.id), "לעמוד המדד, עם ההסבר והמקור"));
    let det = null;
    try { det = await getIndicator(key, a.id); } catch (e) { /* the chart is drawn without the band of similar localities */ }
    if (my !== seq) return;
    const band = det && det.peers ? peerBand(det.peers, "iqr") : null;
    const cfg = indicatorLine(a, model.city.name, { band: band && band.lo.length ? band : null, events: EVENTS_IL, height: 340 });
    cfgNow = cfg;
    lineChart(box, cfg);
    legend.replaceChildren(...legendOf(cfg).childNodes);
  }
  // on paper the chart is drawn at the width of the page (188mm of an A4 sheet) and a little lower, so that it prints at its own size
  onPrint(box, () => { box.style.width = "188mm"; if (cfgNow) lineChart(box, { ...cfgNow, height: 200 }); }, () => { box.style.width = ""; if (cfgNow) lineChart(box, cfgNow); });
  show(0);
  return section("lr-trend", "המגמה", null, list, panel);
}
