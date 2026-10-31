// Gallery of the "time" family: the charts over the years, drawn from the real data of ctx (the city model and the indicator detail).
import { h, num } from "./core.js";
import { demo, wide } from "./gallery-kit.js";
import { lineChart, columnChart, sparkArea, trajectory, smallMultiples, lineLegend, legendOf, peerBand, indicatorLine, indicatorColumns, kpiTrajectory, smallItem, EVENTS_IL } from "./time.js";

const pts = (a) => (a.series || []).filter((s) => typeof s.v === "number");

export default async function (sec, ctx) {
  const { model, key } = ctx, name = model.city.name, inds = model.indicators;
  const by = (id) => inds.find((a) => a.id === id);
  const first = (test, ...prefer) => prefer.map(by).find((a) => a && test(a)) || inds.find(test);
  const peerSeries = (a) => (a.series || []).some((s) => s.peer != null);
  const main = first((a) => pts(a).length >= 6 && peerSeries(a), "bmi_g1_over", "life_expectancy", "infant_mortality");
  const withTarget = first((a) => pts(a).length >= 4 && (a.series || []).some((s) => s.target != null), "th_mmrv", "th_penta", "th_pertussis");
  const short = first((a) => pts(a).length >= 2 && pts(a).length <= 3 && (a.series || []).some((s) => s.nat != null), "pov_persons", "pov_children");
  const single = first((a) => pts(a).length === 1, "mental_points_10k", "family_doctors_10k", "ses_index");
  const guard = async (title, build) => { try { await build(); } catch (e) { demo(sec, title, "הגרף נכשל: " + e.message); console.error("gallery time: " + title + ": " + (e.stack || e.message)); } };
  const none = (title) => demo(sec, title, "אין ליישוב הזה מדד מתאים להדגמה. נסו ?city=9000");
  const hostOf = () => h("div");
  const href = (a) => `#/c/${encodeURIComponent(key)}/i/${a.id}`;

  /* ── lineChart ── */
  await guard("קו עם רצועה ואירועים", async () => {
    if (!main) return none("קו עם רצועה ואירועים");
    const d = await ctx.indicator(main.id), cfg = indicatorLine(main, name, { band: peerBand(d.peers, "iqr"), events: EVENTS_IL, projection: false }), host = hostOf();
    lineChart(host, cfg);
    wide(demo(sec, main.label, `קו העיר, הממוצע הארצי, החציון של יישובים דומים ורצועה של ${d.peers.length} יישובים דומים (מהרבעון התחתון לרבעון העליון, בכל שנה). קורונה 2020 עד 2021, המלחמה 2023.`, host, legendOf(cfg)));
  });

  await guard("יעד והמשך המגמה", async () => {
    if (!withTarget) return none("יעד והמשך המגמה");
    const d = await ctx.indicator(withTarget.id), cfg = indicatorLine(withTarget, name, { band: peerBand(d.peers, "range"), events: EVENTS_IL }), host = hostOf();
    cfg.extra = (x) => { const s = withTarget.series.find((q) => q.year === x); return s && s.d ? h("div.tr", h("span.k", "גודל הקבוצה"), h("b", num(s.d, 0))) : null; };
    lineChart(host, cfg);
    demo(sec, withTarget.label, "יעד משרד הבריאות (קו מקווקו וכתובית), המשך המגמה עם נקודה חלולה, וטווח היישובים הדומים מהנמוך לגבוה. ריחוף או חיצים מציגים את כל הערכים.", host, legendOf(cfg));
  });

  await guard("סדרה קצרה", async () => {
    if (!short) return none("סדרה קצרה");
    const cfg = indicatorLine(short, name, {}), host = hostOf();
    lineChart(host, cfg);
    demo(sec, short.label, `${pts(short).length} שנים בלבד. התוויות בקצה הקו לא מתנגשות, וציר השנים לא מתרבה.`, host, legendOf(cfg));
  });

  await guard("נקודה אחת", async () => {
    if (!single) return none("נקודה אחת");
    const cfg = indicatorLine(single, name, {}), host = hostOf();
    lineChart(host, cfg);
    demo(sec, single.label, "נתון לשנה אחת: נקודה גדולה עם הערך שלה, בלי קו.", host, legendOf(cfg));
  });

  await guard("שנים חסרות", async () => {
    if (!main) return none("שנים חסרות");
    const cut = { ...main, series: main.series.filter((s) => s.year < 2020 || s.year > 2022) }, cfg = indicatorLine(cut, name, { events: EVENTS_IL, projection: false }), host = hostOf();
    lineChart(host, cfg);
    demo(sec, "שנים חסרות שוברות את הקו", `אותם נתונים של "${main.label}", בלי 2020 עד 2022 (כדי להראות את ההתנהגות). הקו לא מחבר מעל החור.`, host);
  });

  await guard("קבוצה קטנה", async () => {
    if (!main) return none("קבוצה קטנה");
    const small = { ...main, series: main.series.slice() }, cfg = indicatorLine(small, name, { nat: true, peer: false, projection: false }), host = hostOf();
    cfg.series[0].points.slice(0, 3).forEach((p) => { p.hollow = true; });
    lineChart(host, cfg);
    demo(sec, "נקודה חלולה: קבוצה קטנה", "שלוש השנים הראשונות מסומנות כקבוצה קטנה כדי להראות את הסימון. בריחוף מופיעה ההערה.", host);
  });

  await guard("קומפקטי", async () => {
    const a = first((x) => pts(x).length >= 4 && peerSeries(x), "life_expectancy", "wait_gyn_days");
    if (!a) return none("קומפקטי");
    const cfg = indicatorLine(a, name, { compact: true }), host = hostOf();
    lineChart(host, cfg);
    demo(sec, a.label, "גרסה קומפקטית לכרטיס: פחות קווי רשת, בלי כיתובי אירועים.", host);
  });

  /* ── columnChart ── */
  await guard("עמודות", async () => {
    const a = first((x) => pts(x).length >= 4 && pts(x).length <= 8 && (x.series || []).some((s) => s.nat != null), "life_expectancy", "wait_gyn_days", "infant_mortality");
    if (!a) return none("עמודות");
    const host = hostOf();
    columnChart(host, { ...indicatorColumns(a), label: name });
    demo(sec, a.label, "העמודה האחרונה בצבע העיר, הקודמות בגוון בהיר. הסימון האפור הוא הממוצע הארצי של אותה שנה.", host, lineLegend([{ label: name, color: "var(--c-city)", sq: true }, { label: "ממוצע ארצי", color: "var(--c-nat)" }]));
  });

  await guard("עמודות עם יעד", async () => {
    if (!withTarget) return none("עמודות עם יעד");
    const host = hostOf();
    columnChart(host, { ...indicatorColumns(withTarget), label: name });
    demo(sec, withTarget.label, "קו היעד מקווקו, עם כיתוב בקצה.", host, lineLegend([{ label: name, color: "var(--c-city)", sq: true }, { label: "ממוצע ארצי", color: "var(--c-nat)" }, { label: "יעד", color: "var(--c-target)", dash: true }]));
  });

  await guard("הרבה עמודות", async () => {
    if (!main) return none("הרבה עמודות");
    const host = hostOf();
    columnChart(host, { ...indicatorColumns(main), label: name });
    demo(sec, main.label, "יותר משמונה עמודות: מוצג רק הערך האחרון. כל השאר בריחוף.", host);
  });

  /* ── sparkArea ── */
  await guard("גרף זעיר", async () => {
    const list = inds.filter((a) => pts(a).length >= 4).slice(0, 4);
    if (!list.length) return none("גרף זעיר");
    const rows = list.map((a) => {
      const p = a.series.map((s) => ({ v: s.v, year: s.year })), nat = a.series.map((s) => s.nat), o = { unit: a.unit, label: a.short || a.label };
      return h("div", { style: "display:flex;flex-wrap:wrap;align-items:center;gap:8px 22px;padding:12px 0;border-top:1px solid var(--line)" },
        h("span", { style: "flex:1 1 150px;min-width:0;font-size:.9rem;font-weight:600;color:var(--ink-2)" }, a.short || a.label),
        h("div", { style: "display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;direction:ltr" },
          sparkArea(p, nat, { ...o, w: 60, h: 24 }), sparkArea(p, nat, { ...o, w: 92, h: 30 }), sparkArea(p, nat, { ...o, w: 160, h: 48 })));
    });
    wide(demo(sec, "גרף זעיר בשלושה גדלים", "60×24, 92×30 ו-160×48. הקו החיוור הוא הממוצע הארצי; הנקודה היא הערך האחרון.", ...rows));
  });

  /* ── trajectory ── */
  await guard("מסלול אל היעד", async () => {
    const recs = (model.recommendations || []).filter((r) => r.kpis && r.kpis.length);
    if (!recs.length) return none("מסלול אל היעד");
    const picked = [];
    recs.slice(0, 3).forEach((r, i) => (i === 0 ? r.kpis.slice(0, 2) : r.kpis.slice(0, 1)).forEach((k) => picked.push(k)));
    const boxes = picked.map((k) => {
      const a = by(k.indicator), cfg = a && kpiTrajectory(k, a);
      return cfg ? h("div", { style: "flex:1 1 260px;max-width:300px;min-width:0" }, h("div", { style: "font-size:.88rem;font-weight:600;color:var(--ink-2);margin-bottom:6px" }, k.label), trajectory(cfg)) : null;
    }).filter(Boolean);
    const a0 = by(picked[0].indicator), cfg0 = a0 && kpiTrajectory(picked[0], a0, { width: 520, height: 150 });
    wide(demo(sec, "מסלול אל היעד של המלצה", "ההיסטוריה, הנקודה של היום, קו מקווקו ישר אל היעד עם דגל, והממוצע הארצי כקו חיוור. הנתונים מ-recommendations[].kpis. למטה: אותו מסלול ברוחב 520.", h("div", { style: "display:flex;flex-wrap:wrap;gap:22px 26px;align-items:flex-start" }, boxes), cfg0 ? h("div", { style: "margin-top:18px;max-width:520px" }, trajectory(cfg0)) : null));
  });

  /* ── smallMultiples ── */
  await guard("מדדים בקטן", async () => {
    const list = inds.filter((a) => pts(a).length >= 3).sort((p, q) => (q.priority || 0) - (p.priority || 0)).slice(0, 9);
    if (!list.length) return none("מדדים בקטן");
    wide(demo(sec, "תשעה מדדים בקטן", "כל משבצת: שם, הערך האחרון, שינוי מאז השנה הראשונה, הקו מול הממוצע הארצי ונקודת מצב. הצבע של השינוי נקבע רק כשידוע מה טוב.", smallMultiples({ items: list.map((a) => smallItem(a, href(a))), cols: 3, ariaLabel: "תשעה מדדים" })));
  });
}
