// The "matrix" family on real data (see gallery-kit.js): the domain strip, heat matrices, the priority quadrant and the compare heat table.
// The last demos use made-up numbers on purpose: they are the edge cases (nothing, one, twelve, forty, out of range) that a real locality rarely shows.
import { h, fmtVal, clamp, toneOfStatus } from "./core.js";
import { demo, wide } from "./gallery-kit.js";
import { domainStrip, heatMatrix, priorityQuadrant, compareHeat } from "./matrix.js";
import { DOMAIN_ICON, unitSuffix } from "../ui.js";
import { getCity } from "../api.js";

const firstPart = (t) => String(t || "").split(/[:.]/)[0].trim();                 // "a short blurb: the long one" -> "a short blurb"
const shortLabel = (t) => String(t || "").split(/ ו|,/)[0].trim();                 // "תזונה והנקה" -> "תזונה"
const valueText = (i) => (i.last && i.last.v != null ? fmtVal(i.unit, i.last.v) + (unitSuffix(i.unit) ? " " + unitSuffix(i.unit) : "") : "");

// the heat matrix rows of some indicators: v is the city's figure, nat the reference of that year
const heatRows = (key, inds) => inds.map((i) => ({ id: i.id, label: i.short || i.label, href: `#/c/${key}/i/${i.id}`, unit: i.unit, direction: i.direction,
  cells: (i.series || []).map((s) => ({ year: s.year, v: s.v, ref: s.nat })) }));
const centered = (node) => h("div", { style: { display: "flex", justifyContent: "center" } }, node);               // a heat matrix is a compact block: centre it in the wide box
const yearsOf = (rows) => [...new Set(rows.flatMap((r) => r.cells.map((c) => c.year)))].sort((a, b) => a - b);

// a tiny deterministic random source, so the 40 bubbles are the same on every visit
const lcg = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

export default async function (sec, ctx) {
  const { key, model } = ctx, inds = model.indicators || [], doms = model.domains || [];
  const of = (d) => inds.filter((i) => i.domain === d.id);

  // 1. domain strip: every domain, every indicator, worst first
  const strip = doms.map((d) => ({ id: d.id, label: d.label, icon: DOMAIN_ICON[d.id] || "bars", href: `#/c/${key}/d/${d.id}`, blurb: firstPart(d.blurb),
    indicators: of(d).map((i) => ({ id: i.id, label: i.short || i.label, status: i.status, href: `#/c/${key}/i/${i.id}`, value: valueText(i), priority: i.priority })) }));
  wide(demo(sec, "פס מצב לפי תחום", "שורה לכל תחום, תא לכל מדד. התחום הבעייתי ביותר למעלה, והמדד הבעייתי ביותר בראש השורה. מעבירים עכבר או מתמקדים בתא לפרטים, ולחיצה פותחת את המדד.",
    domainStrip({ domains: strip })));

  // 2. heat matrix of the domain with the most indicators (here the background figures: no direction, so the colour is a blue scale),
  //    then of the domain with the most judged ones (better and worse than the national mean)
  const byCount = [...doms].sort((a, b) => of(b).length - of(a).length), biggest = byCount[0];
  if (biggest) {
    const rows = heatRows(key, of(biggest));
    wide(demo(sec, `מפת חום: ${biggest.label}`, "מדדי רקע אין להם כיוון טוב או רע, ולכן הצבע הוא סולם כחול לפי הערך בתוך השורה. תא מנוקד = אין נתון בשנה הזאת.", centered(heatMatrix({ rows, years: yearsOf(rows) }))));
    const judged = (d) => of(d).filter((i) => i.direction).length, second = [...doms].filter((d) => d.id !== biggest.id).sort((a, b) => judged(b) - judged(a))[0];
    if (second && judged(second)) {
      const rows2 = heatRows(key, of(second).filter((i) => i.direction));
      wide(demo(sec, `מפת חום מול הממוצע הארצי: ${second.label}`, "כתום = חלש מהממוצע הארצי באותה שנה, ירוק-כחלחל = טוב ממנו. עוצמת הצבע נמדדת מול הפער הגדול ביותר באותה שורה.", centered(heatMatrix({ rows: rows2, years: yearsOf(rows2) }))));
    }
  }

  // 3. priority quadrant: every indicator with a priority; x = standing, y = the slope in the good direction against the usual spread
  const points = inds.filter((i) => i.priority > 0 && i.last).map((i) => {
    const slope = i.history && i.history.slope != null ? i.history.slope : null, adj = (slope == null ? 0 : slope) * (i.direction === "lower" ? -1 : 1);
    const spread = Math.max((i.last.p75 ?? 0) - (i.last.p25 ?? 0), Math.abs(i.last.v || 0) * 0.05, 1e-6);
    return { id: i.id, label: i.short || i.label, x: i.last.level ?? 0, y: clamp(adj / spread, -1, 1), r: i.priority, tone: toneOfStatus(i.status), href: `#/c/${key}/i/${i.id}`,
      note: slope == null ? "אין מספיק שנים כדי לחשב מגמה" : null };
  });
  wide(demo(sec, "מפת עדיפויות", "כל מדד שיש לו עדיפות. ימינה = חזק יותר מיישובים אחרים, למעלה = משתפר. גודל הבועה = העדיפות. הפינה השמאלית-תחתונה היא מה שדחוף.", priorityQuadrant({ points })));

  // 4. compare heat: this locality and three similar ones
  const cities = [{ key, name: model.city.name }, ...(model.peers || []).slice(0, 3).map((p) => ({ key: p.key, name: p.name }))];
  const got = await Promise.allSettled(cities.map((c) => (c.key === key ? Promise.resolve(model) : getCity(c.key))));
  const ok = cities.map((c, k) => ({ c, m: got[k].status === "fulfilled" ? got[k].value : null })).filter((x) => x.m);
  const cells = {};
  ok.forEach(({ c, m }) => { cells[c.key] = {}; for (const d of m.domains) cells[c.key][d.id] = d.counts; });
  const cdoms = doms.filter((d) => d.id !== "context").map((d) => ({ id: d.id, label: d.label, short: shortLabel(d.label), icon: DOMAIN_ICON[d.id] || "bars" }));
  wide(demo(sec, "השוואת יישובים לפי תחום", "בכל תא המצב החמור ביותר בתחום: כתום מלא = דורש טיפול (והמספר אומר כמה מדדים), מתאר כתום = למעקב, ירוק בהיר = תקין, ירוק מלא = חוזק.",
    compareHeat({ cities: ok.map((x) => x.c), domains: cdoms, cells })));

  // ── edge cases, made-up numbers ──
  const mk = (n, f) => Array.from({ length: n }, (_, k) => f(k));
  const st = ["concern", "watch", "good", "strength", "na", "uncertain", "stale"];
  wide(demo(sec, "מקרי קצה: פס מצב", "תחום בלי מדדים, תחום עם מדד אחד, תחום עם 12 מדדים, שם ארוך מאוד, ורשימה ריקה למטה.",
    domainStrip({ domains: [
      { id: "e0", label: "תחום בלי מדדים", icon: "book", href: "#/x/0", blurb: "אין בו עדיין מדדים", indicators: [] },
      { id: "e1", label: "תחום עם מדד אחד", icon: "heart", href: "#/x/1", blurb: "מדד אחד שדורש טיפול", indicators: [{ id: "a", label: "המדד היחיד", status: "concern", href: "#/x/1/a", value: "12.5%" }] },
      { id: "e12", label: "תחום עם שנים-עשר מדדים", icon: "grid", href: "#/x/12", blurb: "כל סוגי המצב יחד, כדי לראות איך השורה מתמלאת", indicators: mk(12, (k) => ({ id: "m" + k, label: "מדד מספר " + (k + 1), status: st[(k * 3) % st.length], href: "#/x/12/" + k, value: (k * 7.3).toFixed(1) + "%" })) },
      { id: "elong", label: "תחום עם שם ארוך מאוד שממשיך ממשיך וממשיך עוד קצת כדי לבדוק גלישה", icon: "pin", href: "#/x/2", blurb: "וגם תיאור ארוך מאוד שלא אמור לשבור את השורה ולא לצאת מהקופסה שלו בשום מצב ובשום רוחב מסך", indicators: mk(4, (k) => ({ id: "l" + k, label: "מדד ארוך " + k, status: ["watch", "good", "good", "strength"][k], href: "#/x/2/" + k })) }
    ] })));
  wide(demo(sec, "מקרי קצה: רשימה ריקה", "אין נתונים בכלל: כל אחד מהגרפים מחזיר הודעה קצרה ולא שבור.",
    h("div", { style: { display: "grid", gap: "8px" } }, domainStrip({ domains: [] }), heatMatrix({ rows: [] }), priorityQuadrant({ points: [] }), compareHeat({ cities: [], domains: [] }))));

  const rnd = lcg(7), many = mk(40, (k) => ({ id: "p" + k, label: "מדד לדוגמה מספר " + (k + 1), x: rnd() * 100, y: (rnd() * 2 - 1) * 0.9, r: 1 + rnd() * 99, tone: ["good", "attn", "watch", "none"][Math.floor(rnd() * 4)], href: "#/x/p/" + k }));
  wide(demo(sec, "מקרי קצה: ארבעים בועות", "חפיפות נשארות קריאות כי הבועות שקופות למחצה והקטנות מעל הגדולות. רק שש הגדולות מסומנות בשם, השאר מופיעות במעבר עכבר.", priorityQuadrant({ points: many })));
  wide(demo(sec, "מקרי קצה: בועה אחת, אותו מקום, מחוץ לטווח", "משמאל לימין: נקודה בודדת; חמש נקודות באותו x; ערכים שחורגים מהטווח נעצרים בתוך המסגרת.",
    h("div", { style: { display: "grid", gap: "16px" } },
      priorityQuadrant({ points: [{ id: "one", label: "המדד היחיד", x: 62, y: 0.3, r: 40, tone: "good", href: "#/x/one" }], height: 320 }),
      priorityQuadrant({ points: mk(5, (k) => ({ id: "s" + k, label: "אותו מצב " + (k + 1), x: 30, y: -0.6 + k * 0.3, r: 20 + k * 15, tone: k % 2 ? "attn" : "watch", href: "#/x/s/" + k })), height: 320 }),
      priorityQuadrant({ points: [{ id: "o1", label: "חורג שמאלה ולמטה", x: -20, y: -3, r: 80, tone: "attn", href: "#/x/o1" }, { id: "o2", label: "חורג ימינה ולמעלה", x: 140, y: 5, r: 10, tone: "good", href: "#/x/o2" }], height: 320 }))));

  const yrs = mk(8, (k) => 2017 + k);
  const edgeRows = [
    { id: "r1", label: "מדד עם כל הערכים מול ממוצע", href: "#/x/r1", unit: "%", direction: "higher", cells: yrs.map((y, k) => ({ year: y, v: 60 + k * 2.5 - (k % 3) * 4, ref: 62 })) },
    { id: "r2", label: "מדד שבו הנמוך טוב יותר, וחסרות שנים", href: "#/x/r2", unit: "per1000", direction: "lower", cells: yrs.filter((y) => y !== 2019 && y !== 2020).map((y, k) => ({ year: y, v: 12 - k, ref: 9 })) },
    { id: "r3", label: "מדד בלי ממוצע ארצי בשנים הראשונות", href: "#/x/r3", unit: "%", direction: "higher", cells: yrs.map((y, k) => ({ year: y, v: 40 + k * 3, ref: k < 3 ? null : 50 })) },
    { id: "r4", label: "קבוצה קטנה: אין שיפוט", href: "#/x/r4", unit: "%", direction: "higher", cells: yrs.map((y, k) => ({ year: y, v: 70 - k, ref: 65, reliable: k < 6 })) },
    { id: "r5", label: "ערך אפס לאורך כל הדרך", href: "#/x/r5", unit: "days", direction: "lower", cells: yrs.map((y) => ({ year: y, v: 0, ref: 0 })) }
  ];
  wide(demo(sec, "מקרי קצה: מפת חום", "פער חיובי ושלילי, שנים חסרות, שנים בלי ממוצע ארצי, קבוצה קטנה (תא חלול), וערך אפס.", centered(heatMatrix({ rows: edgeRows, years: yrs }))));
  const few = [{ id: "f1", label: "שלוש שנים בלבד: התאים גדלים ומראים את המספר", href: "#/x/f1", unit: "%", direction: "higher", cells: [{ year: 2022, v: 3.2, ref: 9.8 }, { year: 2023, v: 3.9, ref: 7.9 }, { year: 2024, v: 4, ref: 7.1 }] },
    { id: "f2", label: "שורה בלי כיוון", href: "#/x/f2", unit: "count", direction: null, cells: [{ year: 2022, v: 214162 }, { year: 2023, v: 217057 }, { year: 2024, v: 217990 }] }];
  wide(demo(sec, "מקרי קצה: מעט שנים", "כשיש שש שנים או פחות התאים רחבים מספיק כדי להציג את המספר בתוכם.", centered(heatMatrix({ rows: few }))));
  wide(demo(sec, "מקרי קצה: השוואה עם נתונים חסרים", "יישוב בלי נתונים בכלל, ותחום שאין בו מדד שנשפט בשום יישוב.", compareHeat({
    cities: [{ key: "a", name: "יישוב עם שם ארוך מאוד לבדיקה" }, { key: "b", name: "יישוב ב" }, { key: "c", name: "יישוב בלי נתונים" }],
    domains: [{ id: "d1", label: "חיסונים", icon: "shield" }, { id: "d2", label: "תזונה והנקה", short: "תזונה", icon: "apple" }, { id: "d3", label: "סביבה", icon: "leaf" }, { id: "d4", label: "בטיחות", icon: "warn" }],
    cells: { a: { d1: { concern: 12, watch: 0, good: 1, strength: 0 }, d2: { concern: 0, watch: 3, good: 0, strength: 0 }, d3: { concern: 0, watch: 0, good: 0, strength: 0 }, d4: { concern: 1, watch: 0, good: 0, strength: 2 } },
      b: { d1: { concern: 0, watch: 0, good: 4, strength: 0 }, d2: { concern: 0, watch: 0, good: 0, strength: 2 }, d3: { concern: 0, watch: 0, good: 0, strength: 0 }, d4: { concern: 3, watch: 1, good: 0, strength: 0 } } }
  })));
}
