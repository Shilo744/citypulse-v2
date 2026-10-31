// The last part of the report: what changed (diverging bars), the gaps inside the town (dumbbell rows by group), the AI summary when one is already written
// (never written from here: that is a paid call), the sources with their links, and one quiet closing line with the date of the data.
import { h, icon, ltr, iso, num, fmtVal, dateHe, directionNote, directionIcon } from "../../ui.js";
import { getBriefing } from "../../api.js";
import { divergingBars, dumbbell } from "../../viz/compare.js";
import { section, seeAll, hrefI, nm, unitWord, isNum } from "./util.js";

const spreadOf = (a) => Math.max(isNum(a.last.p25) && isNum(a.last.p75) ? a.last.p75 - a.last.p25 : 0, a.unit === "%" ? 5 : Math.abs(a.last.v) * 0.1 || 1);

// ── what changed since the first year with a figure ──────────────────────
export function changesSection(model) {
  const key = model.city.key, sign = (a) => (a.direction === "lower" ? -1 : 1);
  const movers = model.indicators.filter((a) => !a.stale && a.direction && a.last && isNum(a.last.v) && a.last.reliable !== false && a.history && a.history.first && a.history.delta != null && a.history.delta !== 0)
    .map((a) => ({ a, gap: (a.history.delta * sign(a)) / spreadOf(a) })).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap)).slice(0, 6);
  if (!movers.length) return null;
  const max = movers.reduce((m, x) => Math.max(m, Math.abs(x.gap)), 0);
  const items = movers.sort((x, y) => y.gap - x.gap).map(({ a, gap }) => ({ id: a.id, label: nm(a), sub: "מאז " + iso(String(a.history.first.year)),
    gap, text: `מ-${iso(fmtVal(a.unit, a.history.first.v))} ל-${iso(fmtVal(a.unit, a.last.v))}${unitWord(a)}`, href: hrefI(key, a.id) }));
  return section("lr-changes", "מה השתנה", "השינויים הגדולים ביותר מאז השנה הראשונה שיש עליה נתון. ימינה = השתפר, שמאלה = הידרדר, ובכל מדד נלקח בחשבון איזה כיוון טוב יותר.",
    h("div.lr-plot.rv", divergingBars({ items, max, zeroLabel: "ללא שינוי", betterLabel: "השתפר", worseLabel: "הידרדר" })),
    h("p.lr-note.rv", icon("info"), "אורך הפס נמדד ביחס להפרש הרגיל בין יישובים באותו מדד, כדי שמדדים שונים יהיו ברי השוואה."),
    h("p.lr-plot-foot.no-print.rv", seeAll(`#/c/${key}/trends`, "כל המגמות")));
}

// ── gaps inside the town: one group against the same group in the country ─
export function gapsSection(model) {
  const key = model.city.key, eqAll = model.findings.filter((f) => f.type.startsWith("equity_")).sort((x, y) => (y.severity || 0) - (x.severity || 0));
  const panels = [];
  for (const f of eqAll) {
    const a = model.indicators.find((x) => x.id === f.indicator), field = f.type === "equity_ses" ? "ses" : "sector", e = a && a.equity && a.equity[field];
    if (e && e.rows && e.rows.length >= 2 && panels.length < 2) panels.push({ f, a, field, e });
  }
  if (!panels.length) return null;
  const cut = (l) => String(l).replace(/^אזורים ברמה (חברתית-כלכלית )?/, "");
  const panel = ({ f, a, field, e }) => h("div.lr-eq.rv",
    h("h3.lr-h3", h("a", { href: hrefI(key, a.id) }, a.label)),
    h("p.lr-eq-k", field === "ses" ? "לפי רמה חברתית-כלכלית של האזור בעיר" : "בין מגזרים בעיר"),
    h("p.lr-eq-s", f.text),
    a.direction ? h("p.lr-dir.lr-dir-one", icon(directionIcon(a.direction)), directionNote(a.direction) + ".") : null,
    dumbbell({ unit: a.unit, shared: true, direction: a.direction, rows: e.rows.map((r) => ({ label: field === "ses" ? cut(r.label) : r.label, href: hrefI(key, a.id), note: `${num(r.d, 0)} בקבוצה`,
      points: [{ key: "nat", label: "ארצי, באותה קבוצה", v: r.natV }, { key: "city", label: model.city.name, v: r.v }] })) }));
  return section("lr-gaps", "פערים בתוך היישוב", "ממוצע העיר מסתיר הבדלים בין מגזרים ואזורים. בכל שורה: הקבוצה בעיר מול אותה קבוצה בארץ.", panels.map(panel));
}

// ── the summary written by the model (only when it already exists) ───────
export function briefingSection(model, onShow) {
  const key = model.city.key, host = h("section.lr-sec.lr-brief", { hidden: true, "aria-labelledby": "lr-brief-t" });
  getBriefing(key).then((r) => {
    const b = r && r.briefing;
    if (!b || !b.headline) return;
    const pts = b.points || [];
    host.replaceChildren(
      h("div.lr-sh", h("div.lr-sh-top.rv", h("span.lr-sh-no", { "aria-hidden": "true" }), h("i.lr-sh-rule", { "aria-hidden": "true" })),
        h("h2.lr-h2.rv", { id: "lr-brief-t" }, "תקציר בשפה פשוטה"), h("p.lr-ai.rv", h("span.ai-badge", icon("spark"), "נכתב בבינה מלאכותית"))),
      h("p.lr-brief-lead.rv", b.headline),
      b.first ? h("p.lr-brief-first.rv", h("b", "במה להתחיל: "), b.first) : null,
      pts.length ? h("details.lr-fold.rv", h("summary", `${pts.length === 1 ? "הנקודה" : "הנקודות"} שמאחורי התקציר (${pts.length})`, icon("down")),
        h("div.lr-brief-pts", pts.map((p) => h("div.lr-brief-pt", h("h3.lr-h3", p.title), h("p", p.text, p.ids && p.ids[0] ? [" ", h("a", { href: hrefI(key, p.ids[0]) }, "לפרטים")] : null))))) : null,
      h("p.lr-note.rv", icon("info"), [b.caution ? b.caution + " " : "", "המספרים נלקחים ישירות מהנתונים הרשמיים, רק הניסוח נכתב בבינה מלאכותית. נכתב ב-" + dateHe(r.at) + "."]));
    host.hidden = false;
    if (onShow) onShow();
  }).catch(() => { /* no summary offered */ });
  return host;
}

// ── sources ──────────────────────────────────────────────────────────────
export function sourcesSection(model) {
  if (!model.sources || !model.sources.length) return null;
  const by = [...new Set(model.sources.map((s) => s.publisher))];
  return section("lr-sources", "מקורות הנתונים", `המידע נאסף ב-${dateHe(model.builtAt)}. בעמוד של כל מדד מופיע המקור המדויק שלו.`,
    h("p.lr-pubs.rv", by.join(" · ")),
    h("ul.lr-srcs.rv", model.sources.map((x) => h("li", h("a", { href: x.url, target: "_blank", rel: "noopener" }, x.name), h("span.lr-src-p", x.publisher)))));
}

// ── the closing line ─────────────────────────────────────────────────────
export function closing(model) {
  const y = model.years;
  return h("footer.lr-close.rv", h("p", ["נתונים עודכנו ב-", dateHe(model.builtAt), y ? [". מבוסס על נתוני ", ltr(`${y.from}–${y.to}`)] : null, "."]),
    h("p", "CityPulse · כלי עזר לקבלת החלטות, לא תחליף לשיקול דעת מקצועי."));
}
