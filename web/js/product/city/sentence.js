// The sentence, the lede and the hero basis line of each of the five answers. Pure functions of the city model, no DOM: node imports this file
// (the tests; P6's server for /s/<key> share pages calls headline() and shareMeta()).
//
// A sentence is a list of segments, so the screen can colour a number or link a domain and a screen reader still hears the plain text:
//   "text"                      plain text
//   { n: "14", tone }           a number (tone: attn | good | teal | none)
//   { dom, tail }               the weakest domain as a link; the tail (count and period) never breaks away from it (C-24)
//   { peers: [{key, name}] }    the names of the similar localities, each a link
//   { term: "concern", text }   a word that opens its definition
//   { clause: [segments] }      a second sentence set smaller under the first (the weakest domain)
// answer(model, qid) -> { qid, kind, segs, plain, first, lede, ledePlain }   kind: answer | calm | nodata (the screen picks the type size from it)
import { cnt, cntOf, cntWord, withUnit } from "../kit/plural.js";
import { yearsOf } from "../kit/provenance.js";
import { dateHe, iso } from "../../ui.js";
import * as D from "./data.js";
import { T, shortName, questionText } from "./copy.js";
import { verdictOf } from "../simple/model.js";
import { T as SIMPLE, verdictSegs, legendPlain } from "../simple/words.js";

const n = (v, tone) => ({ n: String(v), tone });
export function plainOf(segs) {
  return [].concat(segs).flat(Infinity).filter((s) => s != null && s !== false).map((s) => (typeof s === "string" ? s : s.n != null ? s.n : s.dom ? s.dom.short + (s.tail || "") : s.peers ? s.peers.map((p) => p.name).join(", ") : s.clause ? " " + plainOf(s.clause) : s.text || "")).join("");
}
const make = (qid, kind, segs, lede, extra = {}) => ({ qid, kind, segs, plain: plainOf(segs), first: extra.first || plainOf(segs), lede, ledePlain: plainOf(lede), ...extra });

// ═════════ the hero basis line (SPEC 6.8, C-09, C-10) ═════════
export function basisLine(model) {
  const st = D.stateOf(model);
  if (!st.have) return { head: T.nodata.basis, tail: "", rest: [], text: T.nodata.basis };
  const head = `יש נתונים על ${st.have} מתוך ${st.total} מדדים`;
  // a town whose figures are mostly on small groups says how many can be judged (C-09)
  const tail = st.judged * 2 < st.have ? (st.judged ? `, ורק ${st.judged} מהם אפשר לשפוט` : ", אבל אי אפשר לשפוט אף אחד מהם") : "";
  const yrs = yearsOf(model.indicators), rest = [];
  if (yrs) rest.push("נתוני " + (yrs.from === yrs.to ? yrs.from : iso(`${yrs.from}-${yrs.to}`)));
  if (model.builtAt) rest.push("עודכן " + dateHe(model.builtAt));
  return { head, tail, rest, text: [head + tail, ...rest].join(" · ") };
}

// ═════════ 1. where is the town weakest ═════════
function weak(model) {
  const st = D.stateOf(model), name = model.city.name, c = st.all.concern || 0, j = st.judged, qid = "weak";
  if (!st.have) return nodata(model, qid);
  if (!j) {
    const text = `אין מספיק נתונים אמינים כדי לשפוט את מצב הבריאות ב${name}.`;
    return make(qid, "calm", [text], [st.small ? `ב${name} מעט תושבים, ולכן מספר המקרים בכל מדד קטן מכדי לדעת אם הוא סימן למצב או מקרה. המספרים מוצגים כמו שהם.` : `המדדים שיש על ${name} מתארים אותו בלבד, ולכן אין בהם טוב או רע.`]);
  }
  let segs, clause = [];
  if (c === 0) segs = j === 1 ? ["המדד היחיד שנבדק אינו דורש טיפול."] : ["אף אחד מ-", n(j), " המדדים אינו דורש טיפול."];
  else if (c === 1) segs = ["מדד אחד מתוך ", n(j), " דורש טיפול."];
  else segs = [n(c, "attn"), " מתוך ", n(j), " מדדים דורשים טיפול."];
  const wd = c >= 2 ? D.weakestDomain(model) : null;
  if (wd) clause = [{ clause: ["התחום עם הכי הרבה מדדים שדורשים טיפול הוא ", { dom: wd, tail: ` (${wd.k} מתוך ${wd.m}).` }] }];
  const first = plainOf(segs);
  // the denominators in one sentence (C-11), then what is left out and why (C-13)
  const lede = [`מתוך ${st.have} מדדים שיש עליהם נתון, ${j} נשפטו.`];
  if (st.bg) lede.push(` ${cntOf(st.bg, "metric")} ${cntWord(st.bg, "מתאר", "מתארים")} בלבד ואין ${cntWord(st.bg, "בו", "בהם")} טוב או רע.`);
  if (st.small) lede.push(` ${cntOf(st.small, "metric")} ${cntWord(st.small, "מבוסס", "מבוססים")} על ${cntWord(st.small, "קבוצה קטנה מדי", "קבוצות קטנות מדי")}.`);
  if (st.stale) lede.push(` ${cnt(st.stale, "מדד אחד אינו נכלל כי הנתון האחרון ישן", "מדדים אינם נכללים כי הנתון האחרון ישן")}.`);
  return make(qid, "answer", [...segs, ...clause], lede, { first });
}

// ═════════ 2. what improved, what got worse ═════════
function changed(model) {
  const name = model.city.name, qid = "changed", tc = D.trendCounts(model), up = tc.improving, down = tc.worsening;
  if (!D.stateOf(model).have) return nodata(model, qid);
  if (!D.stateOf(model).judged && !up && !down) return make(qid, "calm", [`אין מספיק נתונים אמינים כדי לדבר על מגמה ב${name}.`], ["הקבוצות קטנות מדי, או שהמדדים מתארים בלבד. המספרים עצמם מופיעים בעמוד של כל מדד."]);
  const since = "מאז תחילת הנתונים.", noun = (k, tone) => (k === 1 ? "מדד אחד" : [n(k, tone), " מדדים"]);
  let segs;
  if (up && down) segs = [noun(up, "good"), " בשיפור ", down === 1 ? "ואחד" : ["ו-", n(down)], " בהידרדרות " + since];
  else if (down) segs = ["אף מדד לא בשיפור, ", down === 1 ? "ומדד אחד" : ["ו-", n(down), " מדדים"], " בהידרדרות " + since];
  else if (up) segs = [noun(up, "good"), " בשיפור, ואף מדד לא בהידרדרות " + since];
  else segs = [tc.maxYears >= 3 ? "אף מדד לא השתנה בבירור " + since : "יש נתונים על שנה או שתיים בלבד, ולכן אי אפשר לדבר על מגמה."];
  const lede = [];
  if (tc.stable) lede.push(`${cntOf(tc.stable, "metric")} ${cntWord(tc.stable, "נשאר יציב", "נשארו יציבים")}. `);
  if (tc.rising || tc.falling) lede.push("מדדי רקע, כמו גודל האוכלוסייה, אינם נספרים כשיפור או כהידרדרות. ");
  if (!up && !down && tc.maxYears === 1) lede.push(`יש נתונים על שנה אחת בלבד ב${name}. כשיתווספו שנים, תופיע כאן מגמה.`);
  const stale = model.indicators.filter(D.isStale).length;
  if (stale) lede.push(`${cnt(stale, "מדד אחד אינו נכלל כי הנתון האחרון ישן", "מדדים אינם נכללים כי הנתון האחרון ישן")}.`);
  return make(qid, up || down ? "answer" : "calm", segs, trimEnd(lede));
}
const trimEnd = (l) => (l.length ? [...l.slice(0, -1), String(l[l.length - 1]).replace(/\s+$/, "")] : l);

// the line of one changed figure (B-6, C-15): the unit stays with each value, the verb says which way. spell: "נקודות אחוז" in full once per page, "נק׳" after it
export function changeLine(a, spell = { used: false }) {
  const H = a.history, L = a.last, d = Math.abs(H.delta), up = H.delta > 0;
  let amount;
  if (a.unit === "%") { amount = spell.used ? `${num(d)} נק׳` : `${num(d)} ${Number(num(d)) === 1 ? "נקודת אחוז" : "נקודות אחוז"}`; spell.used = true; }
  else amount = withUnit(d, a.unit);
  return {
    word: H.trendClass === "improving" ? "השתפר" : "הידרדר",
    text: `מ-${withUnit(H.first.v, a.unit)} ב-${H.first.year} ל-${withUnit(L.v, a.unit)} ב-${L.year} (${up ? "עלייה" : "ירידה"} של ${amount})`
  };
}
const num = (v) => (Math.round(v * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });

// ═════════ 3. next to similar localities ═════════
function peers(model) {
  const name = model.city.name, qid = "peers", st = D.stateOf(model), pv = D.peerVerdicts(model);
  if (!st.have) return nodata(model, qid);
  if (!st.judged || !pv.total) {
    const text = !st.judged ? `אי אפשר להשוות את ${name} ליישובים דומים: הקבוצות קטנות מדי.` : `אין ליישובים הדומים ל${name} מספיק נתונים להשוואה.`;
    return make(qid, "calm", [text], [!st.judged ? "המספרים עצמם מופיעים בעמוד של כל מדד, בלי דירוג ובלי השוואה." : "לא נמצאו יישובים דומים עם נתונים מספיקים להשוואה."]);
  }
  const { better, worse, alike, total, bigWorse } = pv, list = model.peers || [];
  const inN = (k, tone) => (k === 1 ? ["במדד אחד מתוך ", n(total)] : ["ב-", n(k, tone), " מתוך ", n(total), " מדדים"]);
  const big = (k, all) => (!k ? [] : k === 1 ? [", אחד מהם בפער גדול"] : k === all ? [", כולם בפער גדול"] : [", ב-", n(k), " מהם בפער גדול"]);
  const other = (k, word, tone) => (k === 0 ? [`אין מדד שהמצב בו ${word} יותר.`] : k === 1 ? [`במדד אחד המצב ${word} יותר.`] : ["ב-", n(k, tone), ` מדדים המצב ${word} יותר.`]);
  const segs = worse >= better
    ? [...inN(worse), ` המצב ב${name} חלש יותר מיישובים דומים`, ...big(bigWorse, worse), ". ", ...other(better, "טוב", "good")]
    : [...inN(better, "good"), ` המצב ב${name} טוב יותר מיישובים דומים. `, ...other(worse, "חלש")];
  const lede = [];
  if (alike) lede.push(alike === 1 ? "במדד אחד המצב דומה. " : `ב-${alike} מדדים המצב דומה. `);
  if (list.length) lede.push(`ההשוואה היא לערך האמצעי של ${list.length} היישובים הדומים ביותר בגודל האוכלוסייה, בסוג הרשות, באשכול החברתי-כלכלי ובשיעור האוכלוסייה הערבית: `, { peers: list }, ".");
  else lede.push("אין יישובים דומים שאפשר להשוות אליהם.");
  return make(qid, "answer", segs, lede, { first: plainOf(segs) });
}

// ═════════ 4. what to do first ═════════
// the lede of the first step, from the real figures, targets and trends of the figures it is about (C-06)
export function stepLede(model, r) {
  const list = (r.indicators || []).map((id) => model.indicators.find((x) => x.id === id)).filter((a) => a && a.last && D.isNum(a.last.v));
  if (!list.length) return r.summary || "";
  const part = (a) => {
    const L = a.last, ref = D.isNum(L.target) ? ` (יעד ${withUnit(L.target, a.unit)})` : D.isNum(L.nat) ? ` (הממוצע הארצי ${withUnit(L.nat, a.unit)})` : "";
    return `${shortName(a)}: ${withUnit(L.v, a.unit)}${ref}.`;
  };
  const worse = list.filter((a) => a.history && a.history.trendClass === "worsening"), since = Math.min(...worse.map((a) => a.history.first.year));
  let trend = "";
  if (worse.length === list.length && list.length > 1) trend = ` ${list.length === 2 ? "בשניהם" : list.length === 3 ? "בשלושתם" : "בכולם"} המגמה בהידרדרות מאז ${since}.`;
  else if (worse.length === list.length) trend = ` המגמה בהידרדרות מאז ${since}.`;
  else if (worse.length) trend = worse.length === 1 ? " באחד מהם המגמה בהידרדרות." : ` ב-${worse.length} מהם המגמה בהידרדרות.`;
  return list.map(part).join(" ") + trend;
}
function first(model) {
  const name = model.city.name, qid = "first", st = D.stateOf(model), recs = model.recommendations || [];
  if (!st.have) return nodata(model, qid);
  if (!recs.length || !st.judged) {
    const text = `אין כרגע המלצה ל${name}.`;
    return make(qid, "calm", [text], [D.emptyPlanCause(model).text]);
  }
  const r = recs[0], hd = D.stepHeadline(r), lede = [stepLede(model, r)];
  if (hd.clamped) lede.unshift(hd.full + ". ");
  // one colon per sentence: a headline that has its own ("לבדוק קודם אם הפער אמיתי: תיעוד, ...") puts its second part in brackets
  const text = hd.text.replace(/^([^:]+): (.+?)(…?)$/, "$1 ($2)$3");
  return make(qid, "answer", ["הצעד הראשון: ", text, text.endsWith("…") ? "" : "."], lede);
}

// ═════════ 5. what is missing ═════════
function missing(model) {
  const name = model.city.name, qid = "missing", st = D.stateOf(model);
  if (!st.have) return nodata(model, qid);
  const miss = st.total - st.have, smallN = st.small;
  let segs;
  if (!miss) segs = ["נמצאו נתונים על כל ", n(st.total), " המדדים."];
  else if (smallN) segs = ["נמצאו נתונים על ", n(st.have, "teal"), " מתוך ", n(st.total), " מדדים, אבל ", n(smallN), ` מהם על ${cntWord(smallN, "קבוצה קטנה מדי", "קבוצות קטנות מדי")}.`];
  else segs = ["נמצאו נתונים על ", n(st.have, "teal"), " מתוך ", n(st.total), " מדדים. ", miss === 1 ? "מדד אחד חסר." : [n(miss, "none"), " מדדים חסרים."]];
  const lede = [`מדד חסר הוא מדד שהמקור הרשמי לא מפרסם עליו נתון ב${name}.`];
  if (smallN) lede.push(` ${cntOf(smallN, "metric")} ${cntWord(smallN, "שנמצא מתייחס", "שנמצאו מתייחסים")} לקבוצה קטנה מדי: המספר מוצג כמו שהוא, בלי דירוג, מגמה או המלצה.`);
  return make(qid, "answer", segs, lede);
}

// ═════════ a town the sources do not cover (SPEC 5.2.6, C-10): the same calm screen for all five ═════════
function nodata(model, qid) {
  const name = model.city.name;
  return make(qid, "nodata", [T.nodata[qid](name)], [T.nodata.text(name, model.city.parent)]);
}

const BUILD = { weak, changed, peers, first, missing };
export function answer(model, qid = "weak") {
  const f = BUILD[qid] || weak;
  return f(model);
}

// the sentence as one string (aria-label, the live region, the title of the system share sheet, the share pages)
export const headline = (model, qid = "weak") => answer(model, qid).plain;

// the preview of the one-glance page (qid "simple"): "שדרות במבט אחד" and the sentence of its verdict with the plain count of each state, never a rank or a place
function simpleMeta(model) {
  const name = model.city.name, v = verdictOf(model);
  return { title: `${name} ${SIMPLE.title}`, description: plainOf(verdictSegs(v, name)) + (v.kind === "full" ? ` בסך הכול: ${legendPlain(v.counts)}.` : ""), question: SIMPLE.title };
}

// what a link preview shows: "שדרות: 14 מתוך 26 מדדים דורשים טיפול" and the lede (SPEC 6.1); qid "simple" is the one-glance page
export function shareMeta(model, qid = "weak") {
  if (qid === "simple") return simpleMeta(model);
  const a = answer(model, qid), name = model.city.name, first = a.first.replace(/[.\s]+$/, "");
  return { title: first.includes(name) ? first : `${name}: ${first}`, description: (a.ledePlain || a.plain).trim(), question: questionText(qid, name) };
}
