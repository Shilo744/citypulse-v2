// "התחילו כאן": the first recommendation as a typographic band: the title as one large sentence, who and how soon, three numbered steps, and "how we will know"
// with the first measurable goal drawn as a path from today to the target. Nothing is claimed beyond the recommendation's own evidence and caveat.
// With no recommendation the page says so and leads to the coverage page. (Wording of the goal rule is the one the action plan page uses.)
import { h, icon, num, ltr, directionNote, directionIcon } from "../../ui.js";
import { horizonLabel } from "../../components.js";
import { trajectory, kpiTrajectory, numberIn } from "../../viz/time.js";
import { section, seeAll, hrefI } from "./util.js";

const STRENGTH = { strong: "חזקות", moderate: "בינוניות", limited: "מוגבלות" }, EFFORT = { low: "נמוך", medium: "בינוני", high: "גבוה" };
const benchNum = (k) => { const m = /\(([^)]*)\)/.exec(k.bench || ""); return m ? numberIn(m[1]) : null; };

// how this goal was set, worked out from the three numbers printed with it (says nothing when they fit no rule)
function kpiReason(k, ind) {
  const from = numberIn(k.from), to = numberIn(k.to), b = benchNum(k);
  if (from == null || to == null || b == null) return null;
  const half = (x) => { const r = Math.round(x * 10) / 10; return num(r, Number.isInteger(r) ? 0 : 1); };
  const gap = Math.abs(b - from), step = Math.abs(to - from), tol = Math.max(0.15, gap * 0.02), pct = !!ind && ind.unit === "%";
  if (gap < 0.05) return null;
  if (Math.abs(step - gap) <= tol) return "הפער קטן, ולכן היעד הוא נקודת ההשוואה עצמה.";
  if (Math.abs(step - gap / 2) <= tol) return "היעד הוא חצי מהפער עד נקודת ההשוואה.";
  if (step < gap / 2 - tol) return pct ? `חצי מהפער הוא ${half(gap / 2)} נק׳, אבל היעד מוגבל ל-${num(step, 0)} נק׳ בשנתיים, כגודל ההשפעה שהראיות מדווחות.` : "חצי מהפער גדול מהשיפור הריאלי בשנתיים, ולכן היעד מוגבל לגודל ההשפעה שהראיות מדווחות.";
  if (step > gap / 2 + tol) return pct ? `חצי מהפער הוא ${half(gap / 2)} נק׳, ולכן היעד הוא שיפור של לפחות ${num(step, 0)} נק׳ בשנתיים.` : null;
  return null;
}

const fact = (label, value) => (value ? h("div.lr-fact", h("dt", label), h("dd", value)) : null);

// the goals: the first one that belongs to the whole town gets the chart; the rest are pairs of "today" and "target"
function knowBlock(model, rec) {
  const kpis = (rec.kpis || []).slice(0, 3), key = model.city.key;
  if (!kpis.length) return null;
  const ind = (k) => model.indicators.find((x) => x.id === k.indicator);
  const wholeTown = (k) => { const a = ind(k); return a && a.last && a.last.reliable !== false && k.label === (a.short || a.label); };          // a goal for one group inside the town has no history of its own
  const lead = kpis.find(wholeTown), cfg = lead ? kpiTrajectory(lead, ind(lead), { width: 460, height: 200 }) : null, a0 = lead ? ind(lead) : null;
  const pair = (k) => {
    const a = ind(k), small = a && a.last && a.last.reliable === false, why = !small && a ? kpiReason(k, a) : null;
    return h("div.lr-kpi", h("a.lr-kpi-n", { href: hrefI(key, k.indicator) }, k.label),
      small ? h("p.lr-kpi-s", icon("info"), "הקבוצה קטנה מכדי להשוות או להסיק, ולכן אין כאן יעד למדידה.")
        : [h("div.lr-kpi-r", h("span.lr-kpi-t", "היום"), h("b", k.from), icon("left"), h("span.lr-kpi-t", "יעד"), h("b.lr-kpi-to", k.to)),
          h("span.lr-kpi-y", ["בנתוני שנת ", ltr(String(k.byYear)), k.bench ? [" · ", k.bench] : null]),
          why ? h("span.lr-kpi-y", why) : null,
          k.people ? h("span.lr-kpi-y", ["משמעות היעד בבני אדם: כ-", num(k.people, 0), " ", k.noun || ""]) : null]);
  };
  return h("div.lr-know.rv", h("h4.lr-h4", icon("target"), "איך נדע שהצלחנו"),
    cfg ? h("figure.lr-traj", trajectory(cfg), h("figcaption", [h("b", lead.label), " · המסלול עד שנת ", ltr(String(lead.byYear))])) : null,
    a0 && a0.direction ? h("p.lr-dir.lr-dir-one", icon(directionIcon(a0.direction)), directionNote(a0.direction) + ".") : null,
    h("div.lr-kpis", kpis.map(pair)));
}

export function startSection(model) {
  const key = model.city.key, rec = (model.recommendations || [])[0];
  if (!rec) {
    return section("lr-start", "התחילו כאן", null,
      h("div.lr-start-in", h("p.lr-pull.is-quiet.rv", "אין עדיין המלצה ליישוב הזה."),
        h("p.lr-start-sum.rv", "ההמלצות נבנות מהמדדים שאפשר לשפוט, וכאן אין מספיק כאלה. אפשר לראות אילו מדדים נמצאו ואילו חסרים."),
        h("p.rv", seeAll(`#/c/${encodeURIComponent(key)}/coverage`, "מה נמצא ומה חסר"))));
  }
  const steps = (rec.actions || []).slice(0, 3), strength = rec.evidenceStrength ? STRENGTH[rec.evidenceStrength] || rec.evidenceStrength : null;
  const facts = h("dl.lr-facts.rv", fact("אחראי", rec.owner), fact("תוך כמה זמן", horizonLabel[rec.horizon] || rec.horizon), fact("מאמץ", rec.effort ? EFFORT[rec.effort] || rec.effort : null), fact("ראיות", strength || (rec.evidenceNote ? null : "ללא מחקר ייעודי")));
  const know = knowBlock(model, rec);
  const sec = section("lr-start", "התחילו כאן", null,
    h("div.lr-start-in",
      h("div.lr-start-grid" + (know ? "" : ".is-one"),
        h("div.lr-start-main", h("h3.lr-pull.rv", rec.title), rec.summary ? h("p.lr-start-sum.rv", rec.summary) : null, facts,
          !rec.evidenceStrength && rec.evidenceNote ? h("p.lr-note.rv", icon("info"), rec.evidenceNote) : null),
        know),
      steps.length ? h("ol.lr-steps", steps.map((t, i) => h("li.rv", h("span.lr-step-n", { "aria-hidden": "true" }, String(i + 1)), h("span.lr-step-t", t)))) : null,
      rec.caveat ? h("p.lr-note.lr-caveat.rv", icon("info"), rec.caveat) : null,
      h("p.lr-start-foot.no-print.rv", seeAll(`#/c/${key}/actions`, "לכל ההמלצות"))));
  sec.classList.add("lr-start");
  return sec;
}
