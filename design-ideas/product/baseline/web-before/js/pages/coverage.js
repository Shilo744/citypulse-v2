// Coverage: what the system found for one locality, indicator by indicator, where each figure comes from, and why something is missing.
// It is the answer to "did the system really look this place up?": every row can be checked against its source by the locality code.
import { h, icon, ltr, num, fmtVal, dateHe, iso, DOMAIN_ICON } from "../ui.js";
import { getMeta } from "../api.js";
import { countTo } from "../viz/core.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// one row of the table: what the model holds for this locality and this indicator
function resultOf(c, a, cityName) {
  const L = a && a.last;
  if (!L || !isNum(L.v)) {
    const many = isNum(c.covered) && c.covered >= 400;
    return { kind: "missing", value: null,
      why: isNum(c.covered) ? (many ? `במקור יש נתון על ${num(c.covered, 0)} יישובים, אבל לא על ${cityName}` : `המקור כולל נתון על ${num(c.covered, 0)} יישובים בלבד`) : `אין במקור נתון על ${cityName}` };
  }
  const fig = [ltr(fmtVal(c.unit, L.v)), " · ", iso(String(L.year))];
  if (L.reliable === false) return { kind: "small", value: fig, why: "הקבוצה קטנה: המספר מוצג כמו שהוא, בלי דירוג ובלי מסקנה" };
  if (a.stale) return { kind: "stale", value: fig, why: "הנתון ישן: לא מתעדכן בשנים האחרונות" };
  return { kind: "found", value: fig, why: isNum(L.d) && c.kind === "rate" ? `בסיס: ${num(L.d, 0)}` : "" };
}

const MARK = { found: "נמצא", stale: "נמצא, נתון ישן", small: "נמצא, קבוצה קטנה", missing: "לא נמצא" };

function rowEl(c, r, key, src) {
  return h("li.cv-row.k-" + r.kind,
    h("span.cv-dot", { "aria-hidden": "true" }),
    h("div.cv-name", h("a", { href: `#/c/${key}/i/${c.id}` }, c.short || c.label), r.why ? h("small", r.why) : null),
    h("div.cv-res", h("span.cv-state", MARK[r.kind]), r.value ? h("b", r.value) : null),
    h("div.cv-src", src && src.url ? h("a", { href: src.url, target: "_blank", rel: "noopener" }, src.publisher || src.name) : (src ? src.publisher || src.name : "")));
}

export async function coverageView(model) {
  const meta = await getMeta();
  const key = model.city.key, name = model.city.name, byId = new Map(model.indicators.map((a) => [a.id, a]));
  const cat = meta.indicators.map((c) => ({ ...c, r: resultOf(c, byId.get(c.id), name) }));
  const count = (k) => cat.filter((c) => c.r.kind === k).length;
  const found = count("found") + count("stale"), small = count("small"), missing = count("missing");
  const used = [...new Set(cat.filter((c) => c.r.kind !== "missing").map((c) => c.source))].filter((s) => meta.sources[s]);
  const fetched = used.map((s) => meta.sources[s].fetchedAt).filter(Boolean).sort().pop() || model.builtAt;
  const fig = (n, label) => h("div.keyfig", h("b.kf-num", countTo(n)), h("span.kf-label", label));
  const byDomain = meta.domains.map((d) => ({ d, rows: cat.filter((c) => c.domain === d.id) })).filter((g) => g.rows.length);

  return h("div.cv",
    h("header.cv-head",
      h("div.sec-eyebrow", "בדיקת כיסוי"),
      h("h1.sec-title", `מה המערכת מצאה על ${name}`),
      h("p.sec-lead", `בדקנו ${num(cat.length, 0)} מדדים ב-${num(Object.keys(meta.sources).length, 0)} מקורות רשמיים. כאן רואים לכל מדד אם נמצא נתון ליישוב, מה הוא ומאיפה הוא בא, ולמה נתון חסר.`)),
    h("div.keyfigs.cv-figs", fig(found, "נמצא נתון"), fig(small, "נמצא, קבוצה קטנה"), fig(missing, "לא נמצא"), fig(used.length, "מקורות שנתנו נתון")),
    h("p.cv-verify", icon("info"), h("span", ["איך מוודאים: פותחים את המקור שבשורה ומחפשים בו את סמל היישוב ", h("b", ltr(String(key))), " (או את השם). הנתונים הורדו מהמקורות ב-", dateHe(fetched), ". הם נשמרים במערכת ומתעדכנים כשמריצים עדכון."])),
    byDomain.map(({ d, rows }) => h("section.cv-sec",
      h("h2.cv-domain", icon(DOMAIN_ICON[d.id] || "bars"), d.label, h("small", ` · ${num(rows.filter((c) => c.r.kind !== "missing").length, 0)} מתוך ${num(rows.length, 0)}`)),
      h("ul.cv-list", rows.map((c) => rowEl(c, c.r, key, meta.sources[c.source]))))));
}
