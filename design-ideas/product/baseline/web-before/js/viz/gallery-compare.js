// Gallery of the compare family: every demo draws the real locality in ctx (see web/js/gallery.js and gallery-kit.js).
// Diverging bars, a dumbbell, a lollipop rank and a distribution, each on the real figures, plus the edge cases the contract names
// (1 item, 40 items, a gap of 0, all positive, all negative, a small group, a city outside the range, one value, equal values, nothing at all).
// A small locality lacks some parameters; each demo then takes another parameter the locality does have, or says so in one quiet line.
import { h, num, fmtVal } from "./core.js";
import { demo, wide } from "./gallery-kit.js";
import { divergingBars, dumbbell, lollipopRank, distribution, diffText } from "./compare.js";
import { unitSuffix } from "../ui.js";

const finite = (v) => typeof v === "number" && Number.isFinite(v);
// a demo that takes two columns, only where the grid has more than one (an implicit second column would push a phone sideways)
const span = (box, n) => { if (n > 1 && typeof matchMedia === "function" && matchMedia("(min-width: 820px)").matches) box.style.gridColumn = `span ${n}`; return box; };
const stack = (...kids) => h("div", { style: "display:grid;gap:22px" }, ...kids);
const cap = (t) => h("p.sub", { style: "margin:0 0 6px;font-weight:600;color:var(--ink-2)" }, t);
const nameOf = (a) => a.short || a.label;

export default async function (sec, ctx) {
  const { model, key, geo } = ctx, city = model.city.name, link = (k, id) => `./#/c/${k}/i/${id}`;
  const said = new Set();
  const quiet = (t) => { if (!said.has(t)) { said.add(t); sec.append(h("p.sub", { style: "margin:12px 0" }, t)); } };
  // the parameter the demo wants if this locality has it, otherwise the first one that fits
  const ok = (a) => a.last && finite(a.last.v) && a.last.reliable !== false && !a.stale;
  const pick = (pref, test) => model.indicators.find((a) => a.id === pref && ok(a)) || model.indicators.find((a) => test(a) && ok(a)) || null;
  const higher = pick("th_mmrv", (a) => a.direction === "higher" && a.unit === "%");
  const lower = pick("wait_gyn_days", (a) => a.direction === "lower" && a.unit !== "%");
  const zeroBased = pick("road_severe_100k", (a) => a.direction === "lower" && a.unit !== "%" && a !== lower) || lower;
  const detail = async (a) => { try { return await ctx.indicator(a.id); } catch (e) { quiet(`אין נתוני התפלגות על ${nameOf(a)} ביישוב הזה.`); return null; } };

  // ── 1. diverging bars: how every figure stands against the nation ──
  // the bar is the gap, signed so that right = better, and sized against the usual spread between localities (so days, points and rates share a scale);
  // the text keeps the real sign of the figure ("+17 ימים" is a longer wait, drawn to the left)
  const usable = model.indicators.filter((a) => a.direction && a.last && finite(a.last.gapNat) && finite(a.last.nat) && a.last.reliable !== false && !a.stale);
  const spreadOf = (a) => Math.max(finite(a.last.p25) && finite(a.last.p75) ? a.last.p75 - a.last.p25 : 0, a.unit === "%" ? 5 : Math.abs(a.last.v) * 0.1 || 1);
  const toItem = (a) => ({
    id: a.id, label: nameOf(a), sub: `${fmtVal(a.unit, a.last.v)} לעומת ${fmtVal(a.unit, a.last.nat)} ארצי${unitSuffix(a.unit) && a.unit !== "%" ? " " + unitSuffix(a.unit) : ""}`,
    gap: (a.last.gapNat * (a.direction === "lower" ? -1 : 1)) / spreadOf(a), text: diffText(a.unit, a.last.gapNat), href: link(key, a.id)
  });
  const items12 = usable.map(toItem).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap)).slice(0, 12).sort((x, y) => y.gap - x.gap);
  wide(demo(sec, `${city}: איפה העיר טובה יותר ואיפה חלשה יותר מהממוצע הארצי`, "הפערים הגדולים ביותר, מהטוב אל החלש. אורך הפס: הפער ביחס להפרש הרגיל בין יישובים. הטקסט: הפער עצמו.",
    divergingBars({ items: items12, zeroLabel: "ממוצע ארצי" })));

  // 40 real rows: the biggest localities against the national figure of one parameter
  const det40 = higher ? await detail(higher) : null;
  if (det40) {
    const nat = det40.analysis.last.nat, unit = higher.unit, pop = new Map(geo.map((g) => [g.k, g.p]));
    const big = det40.map.filter((m) => finite(pop.get(m.k)) && finite(m.v)).sort((a, b) => pop.get(b.k) - pop.get(a.k)).slice(0, 40)
      .map((m) => ({ id: m.k, label: m.name, sub: `${num(pop.get(m.k), 0)} תושבים`, gap: (m.v - nat) * (higher.direction === "lower" ? -1 : 1), text: diffText(unit, m.v - nat), href: link(m.k, higher.id) })).sort((a, b) => b.gap - a.gap);
    span(demo(sec, `${big.length} שורות: היישובים הגדולים מול הממוצע הארצי`, `${nameOf(higher)}, ממוצע ארצי ${fmtVal(unit, nat)}. כל שורה מובילה ליישוב.`, divergingBars({ items: big, zeroLabel: "ארצי" })), 2);
  }

  // 2 items, and the edge cases in one box
  const two = items12.length > 1 ? [items12[0], items12[items12.length - 1]] : items12;
  const pos = items12.filter((x) => x.gap > 0).slice(0, 4), neg = items12.filter((x) => x.gap < 0).slice(-4);
  const background = model.indicators.find((a) => a.last && a.last.gapNat === 0 && !a.direction);
  const noNat = model.indicators.find((a) => a.direction && a.last && !finite(a.last.gapNat) && !a.stale);
  const long = usable.slice().sort((a, b) => b.label.length - a.label.length)[0];
  demo(sec, "שני פריטים", "הפס הארוך ביותר קובע את הסקאלה.", divergingBars({ items: two }));
  demo(sec, "מקרי קצה", "פריט אחד, פער אפס, רק טובים, רק חלשים, שורה בלי נתון ושם ארוך מאוד.", stack(
    stack(cap("פריט אחד"), divergingBars({ items: items12.slice(0, 1) })),
    background ? stack(cap("פער אפס: נקודה על הציר"), divergingBars({ items: [{ id: background.id, label: nameOf(background), sub: "מדד רקע, בלי שיפוט", gap: 0, text: "0" + (background.unit === "%" ? " נק׳" : ""), href: link(key, background.id) }] })) : null,
    pos.length ? stack(cap("כולם טובים יותר"), divergingBars({ items: pos })) : null,
    neg.length ? stack(cap("כולם חלשים יותר"), divergingBars({ items: neg })) : null,
    stack(cap("שורה בלי נתון ושם ארוך"), divergingBars({ items: [
      ...(noNat ? [{ id: noNat.id, label: nameOf(noNat), sub: "אין ממוצע ארצי להשוואה", gap: null, text: "אין נתון" }] : []),
      ...(long ? [{ ...toItem(long), label: long.label, sub: long.label + " · " + long.label }] : [])] })),
    stack(cap("אין נתונים"), divergingBars({ items: [] }))));

  // ── 2. dumbbell ──
  // (a) the gaps inside the city: each group's figure against the national figure of the same group
  const eqInd = model.indicators.find((a) => a.equity && ((a.equity.sector && a.equity.sector.rows.length) || (a.equity.ses && a.equity.ses.rows.length)));
  if (eqInd) {
    const det = await detail(eqInd), minBase = (det && det.indicator && det.indicator.minBase) || 0;
    const rows = [...(eqInd.equity.sector ? eqInd.equity.sector.rows : []), ...(eqInd.equity.ses ? eqInd.equity.ses.rows : [])].map((r) => ({
      label: r.label, note: finite(r.d) ? `${num(r.d, 0)} בקבוצה` : undefined, href: link(key, eqInd.id),
      points: [{ key: "nat", label: "ארצי באותה קבוצה", v: r.natV }, { key: "city", label: city, v: r.v, hollow: !!minBase && r.d < minBase }]
    }));
    wide(demo(sec, `פערים בתוך העיר: ${nameOf(eqInd)}`, "כל שורה היא קבוצה: הנקודה הכחולה היא העיר, האפורה היא הממוצע הארצי של אותה קבוצה.", dumbbell({ rows, unit: eqInd.unit, shared: true, direction: eqInd.direction })));
  } else quiet("ביישוב הזה אין מדד עם נתונים לפי מגזר או רמה חברתית-כלכלית, ולכן אין דמבל של פערים בתוך העיר.");
  // (b) several figures that share a scale: the city, the nation, similar localities and the target
  const pctRows = model.indicators.filter((a) => a.unit === "%" && a.direction === "higher" && ok(a) && finite(a.last.nat)).slice(0, 6);
  if (pctRows.length) {
    const mk = (a) => ({ label: nameOf(a), href: link(key, a.id), points: [
      { key: "city", label: city, v: a.last.v }, { key: "nat", label: "ארצי", v: a.last.nat },
      ...(finite(a.last.peer) ? [{ key: "peer", label: "יישובים דומים", v: a.last.peer }] : []), ...(finite(a.last.target) ? [{ key: "target", label: "יעד", v: a.last.target }] : [])] });
    wide(demo(sec, "העיר, הממוצע הארצי, יישובים דומים והיעד", "אותו ציר לכל השורות (אחוזים), כך שאפשר להשוות את אורך הקו.", dumbbell({ rows: pctRows.map(mk), unit: "%", shared: true, direction: "higher" })));
  }
  // (c) different units: every row has its own axis and its own unit
  const mixed = ["wait_specialist_days", "life_expectancy", "road_severe_100k", "th_mmrv"].map((id) => model.indicators.find((a) => a.id === id)).filter((a) => a && ok(a));
  const mixedRows = (mixed.length >= 2 ? mixed : model.indicators.filter((a) => ok(a) && a.direction).slice(0, 4));
  if (mixedRows.length) span(demo(sec, "מדדים ביחידות שונות", "לכל שורה ציר משלו ויחידה משלה; ימינה = טוב יותר גם כשהערך הנמוך הוא הטוב.",
    dumbbell({ rows: mixedRows.map((a) => ({
      label: `${nameOf(a)}${unitSuffix(a.unit) && a.unit !== "%" ? " (" + unitSuffix(a.unit) + ")" : ""}`, unit: a.unit, direction: a.direction, href: link(key, a.id),
      points: [{ key: "city", label: city, v: a.last.v }, ...(finite(a.last.nat) ? [{ key: "nat", label: "ארצי", v: a.last.nat }] : []), ...(finite(a.last.peer) ? [{ key: "peer", label: "יישובים דומים", v: a.last.peer }] : [])]
    })), shared: false })), 2);
  // (d) lower is better: the axis turns so that better is still on the right
  const lows = model.indicators.filter((a) => a.unit === "%" && a.direction === "lower" && ok(a) && finite(a.last.nat)).slice(0, 3);
  if (lows.length) demo(sec, "ככל שהערך נמוך יותר זה טוב יותר", "הציר מתהפך: ימינה = טוב יותר.", dumbbell({ rows: lows.map((a) => ({ label: nameOf(a), href: link(key, a.id), points: [
    { key: "city", label: city, v: a.last.v }, { key: "nat", label: "ארצי", v: a.last.nat }, ...(finite(a.last.peer) ? [{ key: "peer", label: "יישובים דומים", v: a.last.peer }] : [])] })), unit: "%", shared: true, direction: "lower" }));
  demo(sec, "מקרי קצה בדמבל", "נתוני הדגמה: שורה עם נקודה אחת, ארבע נקודות כמעט זהות (נשארות רק התוויות הקיצוניות), שם ארוך מאוד, ושורה בלי נתון.", dumbbell({ unit: "%", rows: [
    { label: "נקודה אחת בלבד", points: [{ key: "city", label: city, v: 64 }] },
    { label: "ארבעה ערכים כמעט זהים", points: [{ key: "city", label: city, v: 70.2 }, { key: "nat", label: "ארצי", v: 70.5 }, { key: "peer", label: "יישובים דומים", v: 70.9 }, { key: "sector", label: "מגזר", v: 70.1 }] },
    { label: "שם ארוך מאוד של קבוצה שלא נכנס בשורה אחת ולכן נחתך באמצע המשפט, והשאר נמצא בחלון המידע", note: "קבוצה קטנה", points: [{ key: "city", label: city, v: 48, hollow: true }, { key: "nat", label: "ארצי", v: 80 }] },
    { label: "שורה בלי נתון", points: [] }] }));

  // ── 3. lollipop rank: who is just above and below the city ──
  const lolDemo = async (a, title, note, tweak) => {
    if (!a) return;
    const det = await detail(a);
    if (!det) return;
    let list = det.neighbours.map((n) => ({ name: n.name, v: n.v, rank: n.rank, self: n.self, d: n.d, href: link(n.k, a.id) }));
    if (tweak) list = tweak(list);
    demo(sec, title, note, lollipopRank({ items: list, unit: det.indicator.unit, nat: det.analysis.last.nat, direction: det.indicator.direction }));
  };
  await lolDemo(higher, `מי ממש מעלינו ומתחתינו: ${higher ? nameOf(higher) : ""}`, "יישובים סמוכים בדירוג, מהטוב אל החלש. הקו המקווקו: הממוצע הארצי.");
  await lolDemo(lower, `ככל שהערך נמוך יותר זה טוב יותר: ${lower ? nameOf(lower) : ""}`, "תיקו בין כמה יישובים מקבל אותו מקום, ושמות עם גרשיים נקראים נכון.");
  await lolDemo(higher, "קבוצה קטנה: חלולה ובלי מקום", "יישוב עם בסיס קטן מדי נשאר ברשימה אבל לא מדורג.", (l) => l.map((x, i) => (i === l.length - 1 ? { ...x, hollow: true } : x)));
  demo(sec, "מקרי קצה בדירוג", "נתוני הדגמה: שורה אחת, ערכים זהים, ובלי ממוצע ארצי.", stack(
    stack(cap("יישוב אחד"), lollipopRank({ items: [{ name: city, v: 50, rank: 1, self: true }], unit: "%", nat: 48 })),
    stack(cap("כל הערכים זהים"), lollipopRank({ items: [{ name: "א", v: 12, rank: 1 }, { name: city, v: 12, rank: 1, self: true }, { name: "ב", v: 12, rank: 1 }], unit: "days", nat: 12 })),
    stack(cap("אין ממוצע ארצי"), lollipopRank({ items: [{ name: "א", v: 31, rank: 1 }, { name: city, v: 27, rank: 2, self: true }, { name: "ב", v: 22, rank: 3 }], unit: "per1000" })),
    stack(cap("אין יישובים"), lollipopRank({ items: [] }))));

  // ── 4. distribution: where the city sits among all localities ──
  const distDemo = async (a, title, note, place = wide) => {
    if (!a) return null;
    const det = await detail(a);
    if (!det) return null;
    const l = det.analysis.last, d = det.distribution, ind = det.indicator;
    place(demo(sec, title, note, distribution({
      values: d.values, city: l.v, nat: l.nat, target: l.target, p25: d.p25, p75: d.p75, unit: ind.unit, direction: ind.direction,
      items: det.map.map((m) => ({ name: m.name, v: m.v })), height: 230
    })));
    return det;
  };
  const detHigher = await distDemo(higher, `איפה ${city} בין כל היישובים: ${higher ? nameOf(higher) : ""}`, "כל עמודה היא טווח ערכים, וגובהה הוא מספר היישובים בו. הפס האפור: מחצית היישובים באמצע. לחצו על עמודה כדי לראות מי בתוכה.");
  await distDemo(lower, `ככל שהערך נמוך יותר זה טוב יותר: ${lower ? nameOf(lower) : ""}${lower && unitSuffix(lower.unit) ? ` (${unitSuffix(lower.unit)})` : ""}`, "הציר מתהפך כדי שימינה יהיה טוב יותר. הנתונים מספרים שלמים, לכן רוחב העמודה לפחות יחידה אחת.", (b) => span(b, 2));
  await distDemo(zeroBased, `ערכים שמתחילים באפס: ${zeroBased ? nameOf(zeroBased) : ""}`, "הציר מתחיל באפס כי אי אפשר לרדת מתחתיו.", (b) => span(b, 2));
  if (detHigher) {
    const vals = detHigher.distribution.values, u = detHigher.indicator.unit, mid = vals.slice().sort((x, y) => x - y)[Math.floor(vals.length * 0.6)];
    const cut = vals.filter((v) => v < mid), cutLo = Math.min(...cut), cutHi = Math.max(...cut), far = cutHi + (cutHi - cutLo) * 1.2;
    demo(sec, "מקרי קצה בהתפלגות", "נתוני הדגמה על בסיס ההתפלגות האמיתית: עיר מחוץ לטווח, ערך בודד, ערכים זהים ובלי נתונים.", stack(
      stack(cap("העיר רחוקה מחוץ לטווח (מסומנת בקצה עם חץ)"), distribution({ values: cut, city: u === "%" ? Math.min(100, far) : far, nat: detHigher.analysis.last.nat, unit: u, direction: detHigher.indicator.direction, height: 190 })),
      stack(cap("ערך בודד"), distribution({ values: [vals[0]], city: vals[0], unit: u, height: 150 })),
      stack(cap("כל הערכים זהים"), distribution({ values: [vals[0], vals[0], vals[0], vals[0], vals[0]], city: vals[0], nat: vals[0], unit: u, height: 150 })),
      stack(cap("אין נתונים"), distribution({ values: [] }))));
  }
}
