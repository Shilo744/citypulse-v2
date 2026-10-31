// The gallery of the rings family: every chart drawn with the real model of the chosen locality (ctx.model), then the edge cases.
// The calls here are the ones a page makes: copy them.
import { h, toneOfStatus } from "./core.js";
import { demo, wide } from "./gallery-kit.js";
import { statusDonut, progressRing, gauge, standingMeter, waffle } from "./rings.js";

const row = (...nodes) => h("div", { style: { display: "flex", flexWrap: "wrap", gap: "18px 26px", alignItems: "flex-start", justifyContent: "center" } }, ...nodes);
const cell = (node, caption) => h("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minWidth: "0" } }, node, caption ? h("span.sub", { style: { fontSize: ".8rem", textAlign: "center" } }, caption) : null);
const NOUN = { bmi_g1_over: "ילדי כיתה א׳", bmi_g7_over: "תלמידי כיתה ז׳", th_bf_exclusive: "תינוקות", th_mmrv: "ילדים", th_penta: "ילדים", th_safesleep: "תינוקות" };
const countStatuses = (list) => list.reduce((c, i) => { c[i.status] = (c[i.status] || 0) + 1; return c; }, {});

export default async function (sec, ctx) {
  const m = ctx.model, list = m.indicators || [], byId = new Map(list.map((i) => [i.id, i])), L = (i) => (i && i.last) || {};
  const has = (i) => i && L(i).v != null;
  const first = (ids, test) => ids.map((id) => byId.get(id)).find((i) => has(i) && test(i)) || list.find((i) => has(i) && test(i)) || null;
  const group = (title, note) => { const box = h("div"); sec.append(h("h3.h3", { style: { marginTop: "34px" } }, title), note ? h("p.sub", { style: { margin: "2px 0 14px" } }, note) : h("div", { style: { height: "12px" } }), box); return box; };
  const domains = (m.domains || []).filter((d) => d.counts && d.indicators && d.indicators.length);
  const weight = (d) => d.counts.concern * 100 + d.counts.watch * 10 + d.counts.good + d.counts.strength;

  /* ── 1. the status donut ── */
  const g1 = group("טבעת המצב", "ספירת המדדים לפי מצב. מעבר עם העכבר או מקש Tab על פלח או על שורה במקרא מעמעם את האחרים; לחיצה קוראת ל-onPick.");
  const picked = h("p.sub", { style: { marginTop: "12px", textAlign: "center", minHeight: "1.5em" } }, "עדיין לא נבחר פלח.");
  const onPick = (s) => { picked.textContent = "onPick קיבל: " + s; };
  demo(g1, "כל המדדים של היישוב", "model.counts: ארבעת המצבים שנשפטו. המספר במרכז הוא מה שדורש טיפול.", statusDonut({ counts: m.counts, onPick }), picked);
  demo(g1, "עם מדדי הרקע", "אותה ספירה כולל מדדים שלא נשפטים: הפלח האפור (ללא שיפוט).", statusDonut({ counts: countStatuses(list) }));
  const dom = domains.slice().sort((a, b) => weight(b) - weight(a))[0];
  if (dom) demo(g1, `תחום אחד: ${dom.label}`, "domains[i].counts", statusDonut({ counts: dom.counts, size: 200 }));
  const smalls = domains.filter((d) => d !== dom).sort((a, b) => weight(b) - weight(a)).slice(0, 3);
  if (smalls.length) demo(g1, "טבעת קטנה, בלי מקרא", "size 120, legend false: שורה של תחומים.", row(...smalls.map((d) => cell(statusDonut({ counts: d.counts, size: 120, legend: false }), d.label))));

  /* ── 2. the progress ring ── */
  const g2 = group("טבעת התקדמות", "ציון 0-100: עדיפות של המלצה בכרטיס או בשורה ברשימה. נשארת חדה גם ב-56 פיקסלים.");
  const recs = (m.recommendations || []).slice(0, 4), TONES = ["attn", "watch", "good", "none"];
  if (recs.length) {
    wide(demo(g2, "ציוני העדיפות של ההמלצות הראשונות", "recommendations[i].score, בארבעה גוונים: למעלה 72 פיקסלים (ברירת המחדל), למטה 56 פיקסלים כמו בשורה של רשימה.",
      row(...recs.map((r, i) => progressRing({ value: r.score, tone: TONES[i], label: "המלצה " + (i + 1), i }))),
      h("div", { style: { height: "18px" } }),
      row(...recs.map((r, i) => progressRing({ value: r.score, tone: TONES[i], size: 56, i })))));
  }

  /* ── 3. the gauge ── */
  const g3 = group("מד", "חצי עיגול: הערך, הממוצע הארצי והיעד. התוויות מחוץ לקשת ולעולם לא מעל המספר שבמרכז.");
  const gi = first(["th_mmrv"], (i) => L(i).target != null && i.unit === "%");
  if (gi) demo(g3, `עם יעד: ${gi.short}`, "last.v, last.nat, last.target. הצבע לפי המצב.", gauge({ value: L(gi).v, unit: gi.unit, nat: L(gi).nat, target: L(gi).target, direction: gi.direction, tone: toneOfStatus(gi.status), label: gi.short }));
  const gj = first(["wait_specialist_days"], (i) => L(i).target == null && L(i).nat != null && i.unit !== "%");
  if (gj) demo(g3, `בלי יעד: ${gj.short}`, "כשקטן יותר טוב יותר, הקשת עדיין מראה את הערך עצמו; הצבע אומר אם זה טוב.", gauge({ value: L(gj).v, unit: gj.unit, nat: L(gj).nat, direction: gj.direction, tone: toneOfStatus(gj.status), label: gj.short }));
  const gk = first(["th_penta", "th_safesleep"], (i) => L(i).target != null && L(i).nat != null && i.unit === "%");
  if (gk && gk !== gi) demo(g3, `סימונים קרובים לקצה: ${gk.short}`, "הממוצע והיעד גבוהים בסקאלה: התוויות זזות הצידה ולא נחתכות.", gauge({ value: L(gk).v, unit: gk.unit, nat: L(gk).nat, target: L(gk).target, direction: gk.direction, tone: toneOfStatus(gk.status), label: gk.short }));

  /* ── 4. the standing meter ── */
  const g4 = group("מקום בין היישובים", "פס עם סיכה במקום שבו היישוב עומד. הבועה לא יוצאת מהרוחב, והסיכה גולשת פנימה מהצד כשהגרף נחשף.");
  const mids = [first(["road_severe_100k"], (i) => L(i).level != null), first(["th_devtests6"], (i) => L(i).level != null), first(["mental_points_10k"], (i) => L(i).level != null)].filter(Boolean);
  const seen = new Set(), picks = mids.filter((i) => !seen.has(i.id) && seen.add(i.id));
  if (picks.length) wide(demo(g4, "שלושה מדדים", "last.level, last.rank, last.of", ...picks.map((i) => h("div", { style: { margin: "6px 0 18px" } }, standingMeter({ level: L(i).level, rank: L(i).rank, of: L(i).of, tone: toneOfStatus(i.status), label: i.short })))));

  /* ── 5. the waffle ── */
  const g5 = group("מתוך 100", "מה אומר אחוז בבני אדם: 100 משבצות, מסודרות מימין לשמאל. נקודות מסמנות את החלק הארצי.");
  const pcts = list.filter((i) => i.unit === "%" && has(i) && L(i).nat != null);
  const up = first(["bmi_g1_over", "bmi_g7_over"], (i) => i.unit === "%" && L(i).nat != null && Math.round(L(i).v) > Math.round(L(i).nat)) || pcts.find((i) => Math.round(L(i).v) > Math.round(L(i).nat));
  const down = first(["th_bf_exclusive", "th_bf_keep", "th_iron"], (i) => i.unit === "%" && L(i).nat != null && Math.round(L(i).v) < Math.round(L(i).nat)) || pcts.find((i) => Math.round(L(i).v) < Math.round(L(i).nat));
  [[up, "מעל הממוצע הארצי"], [down, "מתחת לממוצע הארצי"]].forEach(([i, what]) => {
    if (i) demo(g5, `${what}: ${i.short}`, "last.v, last.nat", waffle({ value: L(i).v, nat: L(i).nat, direction: i.direction, tone: toneOfStatus(i.status), noun: NOUN[i.id] || "תושבים", label: i.short }));
  });

  /* ── 6. on a dark band ── */
  const g7 = group("על רקע כהה", ["ברצועה כהה (hero) מציבים על הרצועה חמישה משתנים: ", h("code", "--r-ink"), " ", h("code", "--r-ink-2"), " ", h("code", "--r-ink-3"), " ", h("code", "--r-surface"), " ", h("code", "--r-track"), ". כל המשפחה עוקבת."]);
  const bandStyle = "background:var(--grad-hero);border-radius:24px;padding:32px 28px;display:flex;flex-wrap:wrap;gap:28px 48px;align-items:center;justify-content:center;"
    + "--r-ink:white;--r-ink-2:color-mix(in srgb, white 86%, transparent);--r-ink-3:color-mix(in srgb, white 70%, transparent);--r-surface:var(--navy);--r-track:color-mix(in srgb, white 16%, transparent)";
  wide(demo(g7, "טבעת, מד וציונים על רקע כהה", "אותן קריאות, בלי שינוי: רק המשתנים על הרצועה.", h("div", { style: bandStyle },
    statusDonut({ counts: countStatuses(list), size: 200 }),
    gi ? gauge({ value: L(gi).v, unit: gi.unit, nat: L(gi).nat, target: L(gi).target, direction: gi.direction, tone: toneOfStatus(gi.status), label: gi.short, size: 210 }) : null,
    recs.length ? row(...recs.slice(0, 3).map((r, i) => progressRing({ value: r.score, tone: TONES[i], label: "המלצה " + (i + 1), size: 76 }))) : null)));

  /* ── 7. edge cases ── */
  const g6 = group("מקרי קצה", "נתונים ריקים, חסרים, קיצוניים וענקיים. שום דבר לא נשבר ושום תווית לא יוצאת מהגרף.");
  demo(g6, "אין מדדים שנשפטו", "כל הספירות 0: טבעת אפורה ריקה.", statusDonut({ counts: { concern: 0, watch: 0, good: 0, strength: 0 } }));
  demo(g6, "פלח אחד בלבד", "טבעת מלאה, בלי רווחים.", statusDonut({ counts: { watch: 7 }, size: 180 }));
  demo(g6, "פלחים זעירים ומספרים ענקיים", "מדד אחד בין אלפים נשאר נקודה עגולה; המספר במרכז מצטמצם.", statusDonut({ counts: { concern: 1, watch: 12480, good: 2, strength: 1, na: 4200 }, size: 200 }));
  demo(g6, "מד בלי ממוצע ארצי", "nat חסר: אין סימון ואין תווית.", gauge({ value: 42, unit: "%", target: 60, direction: "higher", label: "בלי ממוצע" }));
  demo(g6, "ערך מחוץ לסקאלה", "הקשת נעצרת בקצה, המספר נשאר האמיתי, והבועה מסבירה.", gauge({ value: 118, min: 0, max: 100, unit: "%", nat: 71, target: 95, direction: "higher", label: "מעל המקסימום" }));
  demo(g6, "מד בלי נתון", "value חסר.", gauge({ value: null, unit: "%", nat: 50, label: "אין נתון" }));
  demo(g6, "וופל ב-0 וב-100", "הכול ריק ואז הכול מלא. מסגרות מקווקוות: החלק הארצי שהיישוב לא מגיע אליו; תאים כהים: העודף על הממוצע.", row(waffle({ value: 0, nat: 12, noun: "ילדים", size: 150, tone: "attn" }), waffle({ value: 100, nat: 88, noun: "ילדים", size: 150, tone: "good" })));
  demo(g6, "וופל בלי ממוצע, ובלי נתון", "בלי nat אין מסגרות מקווקוות. value חסר נותן רשת ריקה.", row(waffle({ value: 37, noun: "תושבים", size: 150 }), waffle({ value: null, noun: "תושבים", size: 150 })));
  demo(g6, "מד מקום ברמה 0, 100 ובלי דירוג", "הסיכה בקצה ועדיין בתוך הפס.", h("div", { style: { display: "grid", gap: "14px" } }, standingMeter({ level: 0, rank: 155, of: 155, tone: "attn", label: "הכי חלש" }), standingMeter({ level: 100, rank: 1, of: 155, tone: "good", label: "הכי חזק" }), standingMeter({ level: 8, label: "רק אחוז, בלי מקום" }), standingMeter({ label: "בלי דירוג" })));
  demo(g6, "טבעת התקדמות: 0, 100, טקסט, ענק", "אפס, מלא, display כטקסט, וערך מעל המקסימום (הטבעת נעצרת במלא).", row(progressRing({ value: 0, tone: "none", label: "אפס" }), progressRing({ value: 100, tone: "good", label: "מלא" }), progressRing({ value: 63, display: "4/6", tone: "watch", label: "טקסט" }), progressRing({ value: 1250, max: 100, tone: "attn", label: "מעל המקסימום" })));
}
