// Lab direction "questions": the five answers. Each builder returns a flat list of blocks (a question label, ONE big sentence, a lead line, then the evidence);
// the blocks rise one after the other (css/motion.css .rv). Every sentence is made of model fields; with too little data the answer says so calmly (no empty frames).
import { h, icon, num, fmtVal, ltr, iso, outOf, directionNote, trendInfo, deltaUnit, unitSuffix, statusChip, statusReason, compareLine } from "../../ui.js";
import { getIndicator, getMeta } from "../../api.js";
import { uid, viz, bindTip, tipHead, tipRow, toneOfStatus } from "../../viz/core.js";
import { standingMeter } from "../../viz/rings.js";
import { divergingBars, lollipopRank, signed } from "../../viz/compare.js";
import { trajectory, kpiTrajectory } from "../../viz/time.js";
import { horizonLabel } from "../../pages/rec.js";
import { shareBtn } from "../../pages/shared.js";
import * as D from "./data.js";
import * as P from "./parts.js";

const { isNum, nm } = D;
const Q = Object.fromEntries(D.QUESTIONS.map((q) => [q.id, q.text]));
const STRENGTH_LABEL = { strong: "חזקות", moderate: "בינוניות", limited: "מוגבלות" }, EFFORT_LABEL = { low: "נמוך", medium: "בינוני", high: "גבוה" };
const unitWord = (a) => (a.unit !== "%" && unitSuffix(a.unit) ? " " + unitSuffix(a.unit) : "");
const hrefI = (key, id) => `#/c/${key}/i/${id}`;
const nb = (...kids) => h("span.lq-nb", ...kids);                                   // never broken across lines ("ו-9")
const foot = () => h("div.lq-foot.no-print.rv", h("span", "לשתף את התשובה הזאת:"), shareBtn());
const acts = (...kids) => h("div.lq-acts.no-print.rv", ...kids);
const none = (text) => h("p.lq-none", text);
const NO_DATA = "המקורות הרשמיים שהמערכת קוראת מהם אינם מפרסמים נתונים על היישוב הזה. בדרך כלל מדובר ביישובים קטנים מאוד, באזורי תעשייה או במרכזים אזוריים.";

// a locality the sources do not cover: the same calm answer to every question except the last, which says exactly what is missing
function noData(model, id, ctx) {
  const name = model.city.name;
  const text = { weak: `אין עדיין נתונים על ${name}.`, changed: `אין היסטוריה להציג: אין עדיין נתונים על ${name}.`, peers: `אי אפשר להשוות ליישובים דומים: אין עדיין נתונים על ${name}.`, first: `אין המלצה: אין עדיין נתונים על ${name}.` }[id];
  return [P.qlabel(Q[id]), P.sentence([text], text), P.lede(id === "first" ? D.emptyPlanCause(model).text : NO_DATA),
    acts(P.linkbtn(Q.missing, () => ctx.go("missing")), h("a", { href: "#/" }, "בחירת יישוב אחר"))];
}

// ═════════ 1. where are we weakest ═════════
// the reason in numbers for the weakest domain: how many of its judged figures need work, and where its figures stand among all localities
function domainReason(wd) {
  const { standing, judged, worst, n } = wd, s = Math.round(standing), low = standing < 50, tail = [", ובממוצע הם טובים מ-", ltr(`${s}%`), low ? " בלבד" : "", " מהיישובים בארץ."];
  const one = { concern: "דורש טיפול", watch: "נמצא למעקב", good: "תקין", strength: "הוא חוזק" }[worst];
  if (judged === 1) return ["המדד היחיד שנשפט בתחום ", one, ", והוא טוב מ-", ltr(`${s}%`), low ? " בלבד" : "", " מהיישובים בארץ."];
  const many = { concern: "דורשים טיפול", watch: "נמצאים למעקב", good: "תקינים", strength: "חוזקות" }[worst];
  return n === 1 ? ["מתוך ", ltr(String(judged)), " מדדי התחום שנשפטו, אחד ", one.replace("הוא ", ""), ...tail]
    : [ltr(String(n)), " מתוך ", ltr(String(judged)), " מדדי התחום שנשפטו ", many, ...tail];
}

const COUNT_TITLE = { 1: "המדד החלש ביותר", 2: "שני המדדים החלשים ביותר", 3: "שלושת המדדים החלשים ביותר", 4: "ארבעת המדדים החלשים ביותר", 5: "חמשת המדדים החלשים ביותר" };

export function weak(model, ctx) {
  const st = D.stateOf(model), c = st.all.concern || 0, j = st.judged, name = model.city.name, key = model.city.key;
  if (!model.coverage.have) return noData(model, "weak", ctx);
  if (!j) return weakCalm(model, ctx);
  const wd = c >= 3 ? D.weakestDomain(model) : null;
  let kids, plain;
  if (c === 0) { kids = j === 1 ? ["המדד היחיד שנבדק אינו דורש טיפול."] : ["אף מדד מתוך ", P.N(j), " אינו דורש טיפול."]; plain = j === 1 ? kids[0] : `אף מדד מתוך ${j} אינו דורש טיפול.`; }
  else if (c === 1) { kids = ["מדד אחד מתוך ", P.N(j), " דורש טיפול."]; plain = `מדד אחד מתוך ${j} דורש טיפול.`; }
  else { kids = [P.N(c, "attn"), " מתוך ", P.N(j), " מדדים דורשים טיפול."]; plain = `${c} מתוך ${j} מדדים דורשים טיפול.`; }
  if (wd) { kids.push(" התחום החלש ביותר הוא ", h("a.lq-sdom", { href: `#/c/${key}/d/${wd.d.id}` }, wd.d.label), "."); plain += ` התחום החלש ביותר הוא ${wd.d.label}.`; }
  const w = st.all.watch || 0, g = (st.all.good || 0) + (st.all.strength || 0);
  const lead = wd ? domainReason(wd) : c === 0 ? [w ? [ltr(String(w)), w === 1 ? " מהם למעקב" : " מהם למעקב", g ? [", ו-", ltr(String(g)), g === 1 ? " תקין או חוזק." : " תקינים או חוזקות."] : "."] : "כולם תקינים או חוזקות."]
    : "למטה: המדדים שנמצאים הכי נמוך בין כל היישובים, והתחומים לפי מצבם.";
  const out = [P.qlabel(Q.weak), P.sentence(kids, plain), P.lede(lead)];

  const rows = D.weakestFive(model), dirs = new Set(rows.map((a) => a.direction)), mixed = dirs.size > 1;
  const hasPeer = rows.some((a) => isNum(a.last.peer)), hasNat = rows.some((a) => isNum(a.last.nat));
  out.push(P.block(COUNT_TITLE[rows.length] || "המדדים החלשים ביותר", ["מסודרים לפי המקום בין כל יישובי הארץ, מהחלש ביותר. כל שורה על ציר משלה, וימינה הוא תמיד הצד הטוב יותר. ", mixed ? "בכל שורה כתוב אם מספר גבוה טוב או נמוך." : directionNote([...dirs][0]) + "."],
    P.dumbLegend(name, hasPeer, hasNat), P.weakRows(model, rows, { mixed })));
  const tiles = P.domainTiles(model);
  if (tiles) out.push(P.block("תחומי הבריאות", "מהתחום החלש משמאל אל התחום החזק מימין. לחיצה על תחום פותחת אותו.", tiles, P.domainLegend()));
  out.push(foot());
  return out;
}

// nothing judged (small groups, or only figures that describe the town): a calm answer and the numbers as they are
function weakCalm(model, ctx) {
  const name = model.city.name, small = D.smallFigures(model), s = model.summary && model.summary.lines.find((l) => l.kind === "state");
  const text = `אין מספיק נתונים אמינים כדי לשפוט את מצב הבריאות ב${name}.`;
  return [P.qlabel(Q.weak), P.sentence([text], text), P.lede(s ? s.text : "המדדים שיש על היישוב מתארים אותו בלבד, ולכן אין בהם טוב או רע."),
    small.length ? P.block("המספרים שיש, כמו שהם", "הקבוצה קטנה מכדי להשוות או להסיק. לכן אין להם דירוג, מגמה או המלצה.", P.smallList(model, small, 6)) : null,
    acts(P.linkbtn(Q.missing, () => ctx.go("missing")), h("a", { href: `#/c/${model.city.key}/coverage` }, "מה נמצא ומה חסר, מדד אחרי מדד"))].filter(Boolean);
}

// ═════════ 2. what improved, what got worse ═════════
const SHOW = 5;
function changeItem(model, a) {
  const key = model.city.key, info = trendInfo(a), H = a.history, L = a.last;
  const delta = info && info.delta != null && isNum(H.delta) ? [" (", ltr(signed(H.delta)), deltaUnit(a.unit), ")"] : null;
  return h("li", h("a.lq-ch-name", { href: hrefI(key, a.id) }, a.label),
    h("p.lq-ch-w", info ? h("b.lq-tw.t-" + info.tone, icon(info.ic), info.word) : null, " · מ-", iso(fmtVal(a.unit, H.first.v)), " ב-", iso(String(H.first.year)), " ל-", iso(fmtVal(a.unit, L.v)), " ב-", iso(String(L.year)), unitWord(a), delta, a.stale ? " · נתון ישן" : ""));
}
function changeList(model, title, ic, list, emptyText) {
  const head = list.slice(0, SHOW), tail = list.slice(SHOW);
  return h("div.lq-ch-col", h("h4.lq-ch-h", icon(ic), title, h("b.ltr", String(list.length))),
    list.length ? [h("ul.lq-ch", head.map((a) => changeItem(model, a))), tail.length ? h("details.lq-more", h("summary", `עוד ${tail.length}`, icon("down")), h("ul.lq-ch", tail.map((a) => changeItem(model, a)))) : null] : none(emptyText));
}

export function changed(model, ctx) {
  if (!model.coverage.have) return noData(model, "changed", ctx);
  const tc = D.trendCounts(model), up = tc.improving, down = tc.worsening, key = model.city.key;
  let kids, plain;
  const many = (n, tone) => (n === 1 ? "מדד אחד" : [P.N(n, tone), " מדדים"]), manyPlain = (n) => (n === 1 ? "מדד אחד" : `${n} מדדים`);
  if (up && down) {
    kids = [many(up, "good"), " בשיפור ", down === 1 ? "ואחד" : nb("ו-", P.N(down, "attn")), " בהידרדרות לאורך השנים."];
    plain = `${manyPlain(up)} בשיפור ${down === 1 ? "ואחד" : "ו-" + down} בהידרדרות לאורך השנים.`;
  } else if (down) {
    kids = ["אף מדד לא בשיפור, ", down === 1 ? "ומדד אחד" : [nb("ו-", P.N(down, "attn")), " מדדים"], " בהידרדרות לאורך השנים."];
    plain = `אף מדד לא בשיפור, ${down === 1 ? "ומדד אחד" : "ו-" + down + " מדדים"} בהידרדרות לאורך השנים.`;
  } else if (up) {
    kids = [many(up, "good"), " בשיפור, ואף מדד לא בהידרדרות לאורך השנים."];
    plain = `${manyPlain(up)} בשיפור, ואף מדד לא בהידרדרות לאורך השנים.`;
  } else {
    plain = tc.stable || tc.rising || tc.falling ? "אין מדד שהשתנה בבירור לאורך השנים." : "אין מספיק שנות נתונים כדי לדבר על מגמה.";
    kids = [plain];
  }
  const lead = ["נספרו מדדים עם נתונים לפחות לשלוש שנים, שערכם השתנה יותר מהתנודה הרגילה משנה לשנה. ", tc.stable ? [tc.stable === 1 ? "מדד אחד נשאר יציב" : [ltr(String(tc.stable)), " מדדים נשארו יציבים"], ". "] : "",
    tc.rising || tc.falling ? "מדדי רקע, כמו גודל האוכלוסייה, אינם נספרים כשיפור או כהידרדרות." : ""];
  const out = [P.qlabel(Q.changed), P.sentence(kids, plain), P.lede(lead)];

  const mv = D.movers(model, 8);
  if (mv.length) {
    const max = Math.max(1, ...mv.map((m) => Math.abs(m.gap)));                      // one full bar is one usual spread between localities: small changes stay short
    const items = mv.map(({ a, gap }) => ({ id: a.id, label: nm(a), sub: `מאז ${iso(String(a.history.first.year))}`, gap, text: `מ-${iso(fmtVal(a.unit, a.history.first.v))} ל-${iso(fmtVal(a.unit, a.last.v))}${unitWord(a)}`, href: hrefI(key, a.id) })).sort((x, y) => y.gap - x.gap);
    out.push(P.block("השינויים הגדולים ביותר מאז השנה הראשונה", "אורך כל פס נמדד ביחס להפרש הרגיל בין יישובים באותו מדד, כדי שימים, אחוזים ושיעורים ישתתפו באותה סקאלה. ימינה = השתפר.",
      divergingBars({ items, max, zeroLabel: "ללא שינוי", betterLabel: "השתפר", worseLabel: "הידרדר" })));
  }
  const { improved, worsened } = D.changeLists(model);
  if (improved.length || worsened.length) {
    out.push(P.block("במילים", "כל מדד עם השינוי שלו מהשנה הראשונה שיש עליה נתון. הגדולים ביותר ראשונים.",
      h("div.lq-ch-grid", changeList(model, "השתפרו", "trend", improved, "אף מדד לא השתפר בבירור."), changeList(model, "הידרדרו", "trenddown", worsened, "אף מדד לא הידרדר בבירור."))));
  }
  out.push(acts(h("a", { href: `#/c/${key}/trends` }, "כל המגמות וההיסטוריה"), P.linkbtn(Q.peers, () => ctx.go("peers"))), foot());
  return out;
}

// ═════════ 3. next to similar localities ═════════
// the figure where the town differs most from similar localities: its three marks, its place among all localities, and the localities right next to it in the ranking
function telling(model, r) {
  const a = r.a, L = a.last, key = model.city.key, name = model.city.name, id = uid("lqb");
  const body = h("div.lq-tell", { "aria-busy": "true" }, h("div.sk", { style: { height: "24px", width: "70%" } }), h("div.sk", { style: { height: "120px", marginTop: "14px" } }));
  const sec = h("section.lq-block.rv", { "aria-labelledby": id }, h("p.lq-bk", "המדד שבו ההבדל מיישובים דומים הגדול ביותר"), h("h3.lq-bh", { id }, a.label), body);
  const word = unitWord(a), place = L.rank != null && L.of ? ["מקום ", ...outOf(L.rank, L.of), " יישובים. "] : "";
  const line = h("p.lq-bs", "ב" + name + ": ", ltr(fmtVal(a.unit, L.v)), word, " ב-", ltr(String(L.year)), ". ", place, "הערך האמצעי ביישובים דומים: ", ltr(fmtVal(a.unit, L.peer)), word, isNum(L.nat) ? [", והממוצע הארצי: ", ltr(fmtVal(a.unit, L.nat)), word] : "", ". ", directionNote(a.direction) + ".");
  getIndicator(key, a.id).then((det) => {
    const I = det.indicator, items = det.neighbours.map((n) => ({ name: n.name, v: n.v, rank: n.rank, self: n.self, d: n.d, href: hrefI(n.k, a.id), hollow: isNum(n.d) && isNum(I.minBase) && I.minBase > 0 && n.d < I.minBase }));
    body.replaceChildren(line, h("div.lq-wr-c.lq-tell-db", P.dumbChart(a, name)), P.dumbLegend(name, true, isNum(L.nat)),
      standingMeter({ level: L.level, rank: L.rank, of: L.of, tone: toneOfStatus(a.status), label: nm(a) }),
      h("h4.lq-bh2", "מי נמצא לידנו בדירוג"), lollipopRank({ items, unit: I.unit, nat: L.nat, direction: I.direction, selfLabel: "העיר" }),
      h("p.lq-acts", h("a", { href: hrefI(key, a.id) }, "לעמוד המדד")));
    body.removeAttribute("aria-busy");
  }).catch(() => { body.replaceChildren(line, none("לא הצלחנו לטעון את הדירוג של המדד הזה.")); body.removeAttribute("aria-busy"); });
  return sec;
}

export function peers(model, ctx) {
  if (!model.coverage.have) return noData(model, "peers", ctx);
  const st = D.stateOf(model), pv = D.peerVerdicts(model), name = model.city.name, key = model.city.key, list = model.peers || [];
  if (!st.judged || !pv.total) {
    const text = !st.judged ? `אי אפשר להשוות את ${name} ליישובים דומים: הקבוצות קטנות מדי.` : `אין ליישובים הדומים ל${name} מספיק נתונים להשוואה.`;
    return [P.qlabel(Q.peers), P.sentence([text], text), P.lede("הנתונים עצמם מוצגים בעמוד של כל מדד, בלי דירוג ובלי השוואה. קבוצה קטנה מכדי להשוות או להסיק."),
      acts(P.linkbtn(Q.missing, () => ctx.go("missing")), h("a", { href: `#/c/${key}` }, "תמונת המצב של " + name))];
  }
  const { better, worse, alike, total } = pv;
  let kids, plain;
  if (worse >= better) {
    kids = [P.N(worse, "attn"), " מתוך ", P.N(total), " מדדים חלשים יותר מאשר ביישובים דומים. ", better ? [P.N(better, "good"), " טובים יותר."] : "אף מדד לא טוב יותר."];
    plain = `${worse} מתוך ${total} מדדים חלשים יותר מאשר ביישובים דומים. ${better ? better + " טובים יותר." : "אף מדד לא טוב יותר."}`;
  } else {
    kids = [P.N(better, "good"), " מתוך ", P.N(total), " מדדים טובים יותר מאשר ביישובים דומים. ", worse ? [P.N(worse, "attn"), " חלשים יותר."] : "אף מדד לא חלש יותר."];
    plain = `${better} מתוך ${total} מדדים טובים יותר מאשר ביישובים דומים. ${worse ? worse + " חלשים יותר." : "אף מדד לא חלש יותר."}`;
  }
  const names = list.flatMap((p, i) => [i ? " · " : "", h("a", { href: `#/c/${encodeURIComponent(p.key)}` }, p.name)]);
  const lead = [alike ? [ltr(String(alike)), alike === 1 ? " מדד דומה להם. " : " מדדים דומים להם. "] : "",
    list.length ? ["ההשוואה היא לערך האמצעי של ", ltr(String(list.length)), " יישובים דומים בגודל, בסוג היישוב ובאשכול החברתי-כלכלי: ", names, "."] : "אין יישובים דומים שאפשר להשוות אליהם."];
  const out = [P.qlabel(Q.peers), P.sentence(kids, plain), P.lede(lead)];
  const t = D.mostTelling(model);
  if (t) out.push(telling(model, t));
  const lad = P.ladder(model);
  if (lad) out.push(P.block("המקום של כל תחום בין היישובים", "כל נקודה היא המקום הממוצע של מדדי התחום בין כל יישובי הארץ. ימינה = טוב יותר, והקו האמצעי הוא בדיוק באמצע.", lad));
  out.push(acts(h("a", { href: `#/c/${key}/compare` }, "להשוואה מפורטת ליישובים אחרים")), foot());
  return out;
}

// ═════════ 4. what to do first ═════════
const factsOf = (r) => {
  const f = (k, v) => (v ? h("div", h("dt", k), h("dd", v)) : null);
  return h("dl.lq-facts.rv", f("אחראי", r.owner), f("טווח", horizonLabel[r.horizon] || r.horizon), f("מאמץ", EFFORT_LABEL[r.effort] || r.effort), f("ראיות", r.evidenceStrength ? STRENGTH_LABEL[r.evidenceStrength] || r.evidenceStrength : "ללא מחקר ייעודי"));
};
const STEP_TITLE = { 1: "הצעד הראשון", 2: "שני צעדים ראשונים", 3: "שלושה צעדים ראשונים" };

// how we will know: the first figure of the recommendation, from its history to its target (a figure of one group inside the town has no history of its own: numbers only)
function successBlock(model, r) {
  const key = model.city.key, kpis = r.kpis || [];
  if (!kpis.length) return null;
  const ind = (k) => model.indicators.find((x) => x.id === k.indicator), cityLevel = (k) => { const i = ind(k); return i && !D.isSmall(i) && k.label === nm(i); };
  const k0 = kpis.find(cityLevel) || null, cfg = k0 ? kpiTrajectory(k0, ind(k0), { width: 460, height: 210 }) : null;
  const line = (k) => h("div.lq-kpi", h("b.lq-kpi-name", h("a", { href: hrefI(key, k.indicator) }, k.label)),
    D.isSmall(ind(k) || {}) ? h("p.lq-kpi-l", "הקבוצה קטנה מכדי להשוות או להסיק, ולכן אין כאן יעד למדידה.")
      : h("p.lq-kpi-l", "היום ", h("b", k.from), " · יעד ", h("b", k.to), " בנתוני שנת ", ltr(String(k.byYear)), k.bench ? [" · ", k.bench] : "", k.people ? [" · כ-", num(k.people, 0), " ", k.noun || ""] : ""));
  const side = h("div.lq-kpis", kpis.slice(0, 3).map(line), h("p.lq-hint", "היעד הוא כחצי מהפער עד נקודת ההשוואה (היעד הרשמי, או הממוצע הארצי), ונמדד בנתוני שנתיים קדימה."));
  return P.block("איך נדע שהצלחנו", null, h("div.lq-succ" + (cfg ? "" : ".is-one"), cfg ? h("figure.lq-traj", trajectory(cfg), h("figcaption", [h("b", k0.label), " · המסלול עד שנת ", ltr(String(k0.byYear))])) : null, side));
}

function nextRows(model, recs) {
  const key = model.city.key;
  return P.block("הבאות בתור", "אחרי הצעד הראשון. כל ההמלצות ופרטיהן בעמוד תוכנית הפעולה.",
    h("ol.lq-next", recs.map((r, i) => h("li", h("a", { href: `#/c/${key}/actions` }, h("span.lq-next-n", { "aria-hidden": "true" }, String(i + 2)),
      h("span.lq-next-b", h("b.lq-next-t", r.title), r.summary ? h("span.lq-next-s", r.summary) : null), h("small.lq-next-h", horizonLabel[r.horizon] || r.horizon))))));
}

export function first(model, ctx) {
  const key = model.city.key, recs = model.recommendations || [];
  if (!model.coverage.have) return noData(model, "first", ctx);
  if (!recs.length) return firstNone(model, ctx);
  const r = recs[0], out = [P.qlabel(Q.first), P.sentence([r.title], r.title, ".is-title")];
  if (r.summary) out.push(P.lede(r.summary));
  out.push(factsOf(r));
  const steps = (r.actions || []).slice(0, 3);
  if (steps.length) out.push(P.block(STEP_TITLE[steps.length] || "צעדים", null, h("ol.lq-steps", steps.map((t, i) => h("li", h("span.lq-step-n", { "aria-hidden": "true" }, String(i + 1)), h("p", t)))),
    r.caveat ? h("p.lq-note", icon("info"), r.caveat) : null, (r.actions || []).length > 3 ? h("p.lq-acts", h("a", { href: `#/c/${key}/actions` }, `עוד ${(r.actions || []).length - 3} צעדים בתוכנית הפעולה`)) : null));
  const succ = successBlock(model, r); if (succ) out.push(succ);
  const learn = (r.learnFrom || []).slice(0, 3);
  if (learn.length) out.push(P.block("יישובים דומים שמצליחים יותר", "כדאי לשוחח איתם: מה הם עושים אחרת?", h("ul.lq-learn", learn.map((l) => h("li", h("a", { href: hrefI(l.key, l.indicator) }, l.name), h("span", [l.label + ": ", h("b", l.value), " ב-", ltr(String(l.year))]))))));
  if (recs.length > 1) out.push(nextRows(model, recs.slice(1, 3)));
  const why = (r.why || []).slice(0, 3);
  if (why.length) out.push(h("details.lq-more.lq-why-d.rv", h("summary", "על מה ההמלצה מבוססת", icon("down")), h("ul", why.map((w) => h("li", w.text || w)))));
  out.push(acts(h("a", { href: `#/c/${key}/actions` }, "לכל ההמלצות ולתוכנית הפעולה")), foot());
  return out;
}

// no recommendation: say so, say why in the words of the real action page, and show what is most worth checking instead
function firstNone(model, ctx) {
  const name = model.city.name, key = model.city.key, cause = D.emptyPlanCause(model), pr = D.topPriorities(model, 3);
  const text = `אין כרגע המלצה ל${name}.`;
  const out = [P.qlabel(Q.first), P.sentence([text], text), P.lede(cause.text)];
  if (pr.length) out.push(P.block("מה בכל זאת כדאי לבדוק קודם", "המדדים שיש בהם הכי הרבה מקום לשיפור, לפי חשיבותם.",
    h("ol.lq-pr", pr.map((a) => h("li", h("a.lq-wr-name", { href: hrefI(key, a.id) }, a.label), P.reasonLine(a))))));
  out.push(acts(P.linkbtn(Q.missing, () => ctx.go("missing")), h("a", { href: `#/c/${key}/actions` }, "לעמוד תוכנית הפעולה")));
  return out;
}

// ═════════ 5. what is missing in the data ═════════
const KIND_WORD = { found: "נמצא נתון", stale: "נמצא נתון, ישן", small: "נמצא, קבוצה קטנה מדי", missing: "לא נמצא" };

// one cell for each of the figures the system looks for: found, found on a small group (hollow), not found
function coverBar(cat) {
  const order = { found: 0, stale: 0, small: 1, missing: 2 }, cells = [...cat].sort((x, y) => order[x.kind] - order[y.kind]);
  const bar = h("div.lq-cb"), n = cells.length;
  cells.forEach((x, i) => {
    const cell = h("i.lq-cell.k-" + (x.kind === "stale" ? "found" : x.kind) + ".grow-y", { style: { "--i": Math.min(12, Math.floor((i * 12) / Math.max(1, n - 1))) } });
    bindTip(cell, () => [tipHead(x.c.short || x.c.label), tipRow(null, "מצב", KIND_WORD[x.kind])]);
    bar.append(cell);
  });
  const c = (k) => cells.filter((x) => (k === "found" ? x.kind === "found" || x.kind === "stale" : x.kind === k)).length;
  return viz(bar, { label: `${n} מדדים: ${c("found")} נמצא נתון, ${c("small")} קבוצה קטנה מדי, ${c("missing")} לא נמצא`, role: "img" });
}
const trioItem = (k, n, label) => h("div.lq-tri.is-" + k, h("b.lq-tri-n.ltr", n ? { "data-count": "" } : null, String(n)), h("span", h("i.lq-sw.k-" + k, { "aria-hidden": "true" }), label));

export function missing(model, ctx) {
  const key = model.city.key, name = model.city.name, cov = model.coverage, have = cov.have, total = Math.max(cov.total, have), miss = total - have;
  const small = D.smallFigures(model), smallN = small.length;
  let kids, plain;
  if (!have) { kids = ["לא נמצא נתון על אף אחד מ-", P.N(total), " המדדים."]; plain = `לא נמצא נתון על אף אחד מ-${total} המדדים.`; }
  else if (!miss) { kids = ["נמצאו נתונים על כל ", P.N(total), " המדדים."]; plain = `נמצאו נתונים על כל ${total} המדדים.`; }
  else {
    kids = ["נמצאו נתונים על ", P.N(have, "teal"), " מתוך ", P.N(total), " מדדים. ", miss === 1 ? "מדד אחד חסר." : [P.N(miss, "none"), " מדדים חסרים."]];
    plain = `נמצאו נתונים על ${have} מתוך ${total} מדדים. ${miss === 1 ? "מדד אחד חסר." : miss + " מדדים חסרים."}`;
  }
  const lead = ["מדד נחשב חסר כשאין עליו נתון ב" + name + " במקור הרשמי. ", smallN ? [ltr(String(smallN)), smallN === 1 ? " מהמדדים שנמצאו מתייחס" : " מהמדדים שנמצאו מתייחסים", " לקבוצה קטנה מכדי להשוות או להסיק: המספר מוצג כמו שהוא, בלי דירוג, מגמה או המלצה."] : ""];
  const out = [P.qlabel(Q.missing), P.sentence(kids, plain), P.lede(lead)];

  // the numbers at once, the cell-by-cell bar and the reasons when the catalogue has arrived
  const barHost = h("div.lq-cb-host", { "aria-busy": "true" }, h("div.sk", { style: { height: "30px" } }));
  const groupsHost = h("div.lq-mg-host");
  out.push(P.block("כל המדדים, אחד אחד", `לכל מדד שהמערכת מחפשת יש ריבוע אחד. ${total} ריבועים בסך הכול.`,
    h("div.lq-trio", trioItem("found", have - smallN, "נמצא נתון"), trioItem("small", smallN, "נמצא, קבוצה קטנה מדי"), trioItem("missing", miss, "לא נמצא")), barHost));
  out.push(groupsHost);
  getMeta().then((meta) => {
    const c = D.coverageOf(model, meta);
    barHost.replaceChildren(coverBar(c.cat)); barHost.removeAttribute("aria-busy");
    const groups = D.missingGroups(c.cat, name, meta.sources);
    if (groups.length) {
      const id = uid("lqb");
      groupsHost.replaceWith(h("section.lq-block.rv", { "aria-labelledby": id }, h("h3.lq-bh", { id }, "מה חסר, ולמה"), h("p.lq-bs", `לכל קבוצת מדדים: הסיבה שאין עליהם נתון ב${name}, והמקור שבדקנו.`),
        h("ul.lq-mg", groups.map((g) => h("li", h("p.lq-mg-names", g.items.map((m, i) => [i ? " · " : "", h("span", { title: m.label }, m.short || m.label)])), h("p.lq-mg-why", g.why + "."),
          g.src ? h("p.lq-mg-src", "מקור: ", g.src.url ? h("a", { href: g.src.url, target: "_blank", rel: "noopener" }, g.src.publisher || g.src.name) : g.src.publisher || g.src.name) : null)))));
    } else groupsHost.remove();
  }).catch(() => { barHost.replaceChildren(none("לא הצלחנו לטעון את רשימת המדדים.")); barHost.removeAttribute("aria-busy"); groupsHost.remove(); });
  if (smallN) out.push(P.block("נמצא, אבל בקבוצה קטנה מדי", "המספר מוצג כמו שהוא. הקבוצה קטנה מכדי להשוות או להסיק, ולכן אין דירוג, מגמה או המלצה.", P.smallList(model, small, 6)));
  out.push(acts(h("a.lq-bigl", { href: `#/c/${key}/coverage` }, "לטבלה המלאה: כל מדד, הערך שלו והמקור", icon("left"))), foot());
  return out;
}

export const ANSWERS = { weak, changed, peers, first, missing };
