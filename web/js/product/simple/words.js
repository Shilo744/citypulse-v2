// The words of the one-glance page. Third person, gender-neutral around the town name, the vocabulary of SPEC 7.1 (מדד, דורש טיפול, למעקב, קבוצה קטנה).
// Every sentence is short (about 14 words); every number comes from a model field and is joined to its noun with kit/plural.js. No DOM: node imports this file.
//
// A sentence is a list of segments, like sentence.js: "text" or { n: "14", tone }, so the screen can set a number apart and a screen reader still hears the plain text.
import { cntWord, more } from "../kit/plural.js";
import { plainOf } from "../city/sentence.js";
import { T as HOME } from "../city/copy.js";

export { plainOf };
const n = (v, tone) => ({ n: String(v), tone });

export const T = {
  title: "במבט אחד",          // only the preview of an old share link (?q=simple) still says it (sentence.js)
  h: { good: "מה הולך טוב", attention: "מה דורש תשומת לב", changed: "מה השתנה", peers: "איך מול יישובים דומים", first: "מה כדאי לעשות", missing: "על מה אין מידע" },
  index: "תוכן העמוד", background: "רקע על היישוב", allSteps: "לכל ההמלצות", printReport: "הדפסת דוח",
  who: { nat: "הארץ" },
  // which way is good: the attention rows say what to aim for, the good rows say what is already so
  way: { higher: "כדאי שיהיה גבוה יותר.", lower: "כדאי שיהיה נמוך יותר." },
  wayGood: { higher: "גבוה יותר זה טוב.", lower: "נמוך יותר זה טוב." },
  noNat: "אין ממוצע ארצי למדד הזה.",
  moreNumbers: (k) => (k === 1 ? "יש עוד מספר אחד" : `יש עוד ${k} מספרים`) + ".",
  noAttention: "אין כרגע מדד שדורש תשומת לב.",
  noGood: "אין כרגע מדד שבולט לטובה.",
  asIs: "אלה המספרים שיש, בלי שיפוט.",
  smallRow: "קבוצה קטנה מדי, ולכן בלי שיפוט.",
  first: { who: "מי אחראי", when: "תוך כמה זמן", whyLead: "למה" },
  catNone: "אין מדד שאפשר לשפוט", byCat: "לפי תחום",
  missing: { link: "לכל הנתונים החסרים", eg: "למשל" },
  foot: { print: "הדפסה", share: "שיתוף", method: "איך מחושבים המספרים", how: "דורש טיפול אומר שהמצב חלש ביחס ליישובים אחרים או ליעד הרשמי. זה סימן לבדוק, לא פסק דין.", dict: "למילון" },
  // under "what goes well": a figure with no official target is judged by the country's average and the trend alone, so "better than the average" is not "good" in itself
  goodLede: "בלי יעד רשמי, מדד נשפט רק לפי הממוצע והמגמה: טוב מהממוצע אינו בהכרח טוב.",
  // the figures of the background line in the head of the town page: a tap opens what a reader must know about the figure (the catalogue's own caution and source)
  bg: { title: "לחצו כדי לקרוא מה צריך לדעת על המדד", loading: "הפרטים נטענים.", know: "מה צריך לדעת", source: "מקור", page: "לעמוד של המדד", none: "אין כרגע פרטים נוספים על המדד. הם בעמוד של המדד." },
  restLink: "לראות את כולם",
  moreLink: "לראות אותם"
};

// the sentence that answers "how is it?"
export function verdictSegs(v, name) {
  if (v.kind === "uncovered") return [HOME.nodata.weak(name)];
  if (v.kind === "calm") return ["יש מעט נתונים, ולכן קשה לשפוט."];
  const { concern: c } = v.counts, j = v.judged;
  if (j === 1) return [c ? "מדד הבריאות היחיד שנבדק דורש טיפול." : "מדד הבריאות היחיד שנבדק אינו דורש טיפול."];
  if (c === 0) return ["אף אחד מ-", n(j), " מדדי הבריאות אינו דורש טיפול."];
  if (c === j) return ["כל ", n(j), " מדדי הבריאות דורשים טיפול."];
  if (c === 1) return ["מדד בריאות אחד מתוך ", n(j), " דורש טיפול."];
  return [n(c, "attn"), " מתוך ", n(j), " מדדי בריאות דורשים טיפול."];
}

// one category in the by-category rows: how many of its judged figures need treatment (k of m)
export function catSegs(k, m) {
  if (!m) return [T.catNone + "."];
  if (m === 1) return [k ? "המדד היחיד שנבדק דורש טיפול." : "המדד היחיד שנבדק אינו דורש טיפול."];
  if (k === 0) return ["אף אחד מ-", n(m), " המדדים אינו דורש טיפול."];
  if (k === m) return ["כל ", n(m), " המדדים דורשים טיפול."];
  if (k === 1) return ["מדד אחד מתוך ", n(m), " דורש טיפול."];
  return [n(k, "attn"), " מתוך ", n(m), " מדדים דורשים טיפול."];
}

// the lead of the full attention list: how many need treatment or follow-up, and how they split (the same counts as the sentence of the verdict)
export function attLead(c, w) {
  const t = c + w;
  if (!w) return t === 1 ? ["מדד אחד דורש טיפול."] : [n(t), " מדדים דורשים טיפול."];
  if (!c) return t === 1 ? ["מדד אחד למעקב."] : [n(t), " מדדים למעקב."];
  return [...(t === 1 ? ["מדד אחד דורש טיפול או מעקב."] : [n(t), " מדדים דורשים טיפול או מעקב."]), " ", ...(c === 1 ? ["אחד דורש טיפול"] : [n(c), " דורשים טיפול"]), " ו-", ...(w === 1 ? ["אחד למעקב"] : [n(w), " למעקב"]), "."];
}

// the three words under the bar: the count of each state and its name (the colour never stands alone)
export function legendOf(counts) {
  const { concern: c, watch: w, good: g } = counts;
  return [["concern", c, c === 1 ? "דורש טיפול" : "דורשים טיפול"], ["watch", w, "למעקב"], ["good", g, g === 1 ? "תקין" : "תקינים"]].filter(([, k]) => k > 0).map(([id, k, label]) => ({ id, n: k, label }));
}
export const legendPlain = (counts) => legendOf(counts).map((x) => `${x.n} ${x.label}`).join(", ");

// "עוד 5 מדדים דורשים טיפול או מעקב." (the two words of the bar's legend)
export const restLine = (k) => `${more(k, "metric")} ${cntWord(k, "דורש", "דורשים")} טיפול או מעקב.`;

// a catalogue label as a resident reads it: the Latin vaccine codes in brackets go, "מתוקנן לגיל" is said plainly
export const plainLabel = (s) => String(s || "").replace(/\s*\([^()]*[A-Za-z][^()]*\)/g, "").replace(/\s+מתוקנן לגיל/," בהתאמה לגיל התושבים").trim();
// the time to act: the words inside the brackets of the horizon ("מהיר (עד 6 חודשים)" -> "עד 6 חודשים")
export const whenOf = (h) => { const m = String(h || "").match(/\(([^)]+)\)/); return m ? m[1] : String(h || ""); };

// the first step: one line of why, from the figures of the step (the town and the country, side by side). A value is { n, w }: the number and its unit word.
const val = (x) => [n(x.n), x.w ? " " + x.w : ""];
export function whyLine(label, town, nat, name, dir) {
  return [T.first.whyLead + ": " + plainLabel(label) + ". ב" + name + " ", ...val(town), ...(nat ? [", בארץ ", ...val(nat), "."] : ["."]), ...(dir ? [" " + T.wayGood[dir]] : [])];
}
// the lede under the verdict: of the figures that have an official target of the Ministry of Health, how many meet it in the town and how many in the country as a whole
// o = { n: figures with a target, town: met in the town, natN: of them with a national average, nat: met in the country }. The country is counted over the figures that have a national average.
export function targetLede(o) {
  const { n: N, town, natN, nat } = o;
  const part = (k, of, where) => (of === 1 ? [where + (k ? " הוא עומד בו" : " הוא אינו עומד בו")]
    : k === 0 ? [where + " אף אחד מהם אינו עומד בו"] : k === of ? [where + (of === 2 ? " שניהם עומדים בו" : " כולם עומדים בו")] : k === 1 ? [where + " אחד מהם עומד בו"] : [where + " ", n(k), " מהם עומדים בו"]);
  const head = N === 1 ? ["למדד אחד של היישוב יש יעד רשמי של משרד הבריאות. "] : ["ל-", n(N), " מדדי היישוב יש יעד רשמי של משרד הבריאות. "];
  const natPart = natN ? [", ", ...part(nat, natN, "ובארץ כולה"), ...(natN < N ? [" (מבין ", n(natN), " שיש להם ממוצע ארצי)"] : [])] : [];
  return [...head, ...part(town, N, "ביישוב"), ...natPart, "."];
}

// who is responsible: the first party named; "in cooperation with" and the rest stay in the full plan
export const leadOwner = (s) => String(s || "").split(/\s+(?:בשיתוף|מול|יחד עם)\s+|[,;]/)[0].trim();

// what is missing: the count, then (second sentence) the examples a person would know, then the figures that were found but not judged
export function missingLines(m) {
  const out = [], k = (x, one) => (x === 1 ? one : "ב-" + x + " מדדים");
  if (m.missing) out.push(m.missing === 1 ? "אין נתונים על מדד אחד." : `אין נתונים על ${m.missing} מדדים.`);
  if (m.missing && m.examples.length) out.push(`${T.missing.eg}: ${m.examples.length > 1 ? m.examples.slice(0, -1).join(", ") + " ו" + m.examples[m.examples.length - 1] : m.examples[0]}.`);
  if (m.small) out.push(`${k(m.small, "במדד אחד")} יש מעט מקרים, ולכן ${m.small === 1 ? "הוא לא נשפט" : "הם לא נשפטו"}.`);
  if (m.stale) out.push(`${k(m.stale, "במדד אחד")} הנתון ישן, ולכן ${m.stale === 1 ? "הוא לא נשפט" : "הם לא נשפטו"}.`);
  return out;
}
