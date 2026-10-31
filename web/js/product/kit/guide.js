// The official references of a figure, in the words of the product. Pure: no DOM, node imports this file (tests/product-guide.test.mjs).
// The server decides everything (src/model/guide.js: a.guide, a.benchmark; the status rules in docs/METHOD.md); this file only reads those fields and says them plainly:
//   target   an official target of the same measure in the same unit (guide.judges): the status reads it. Said with the distance in words and which side the town is on.
//   orient   an official target that is shown and never judges (a different age band, a national cut): "יעד להתמצאות", said as context only, with no distance.
//   bench    a foreign or international reference figure (a.benchmark): "נקודת ייחוס", never judges, no distance.
// The words (the lead's list): "יעד רשמי" judges, "יעד להתמצאות" never does, "נקודת ייחוס" is a foreign figure; the publisher is named only in the panel and the cards.
// The way that is good is said once on a figure's page, by the line under its number; a panel never says it again (a figure with no way, a background figure, has none to say).
//   none     no official reference: one honest line from research/guidelines.json on why (NO_TARGET; tests/product-guide.test.mjs keeps the table equal to the research).
// Nothing is invented here: a number, a year and a source are fields of the model; a figure on too few cases is never set against a target (guide.meets is null).
import { num, iso, compareLine } from "../../ui.js";
import { lacking } from "./plural.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const BIDI = /[‎‏‪-‮⁦-⁩⁠]/g;
export const clean = (t) => String(t == null ? "" : t).replace(BIDI, "");

export const STATE = { meets: "עומד ביעד", near: "קרוב ליעד", below: "מתחת ליעד", far: "רחוק מהיעד" };
// the distances the status rules use (src/model/analyze.js RULES: nearTarget, farBelowTarget, targetNearRel, targetFarRel; tests/product-guide.test.mjs keeps them equal): in points for a percentage, a share of the target for any other unit
export const NEAR = { pts: 5, rel: 0.1 }, FAR = { pts: 10, rel: 0.25 };

// why an indicator has no official target: one line each, from research/guidelines.json (the `found` of every indicator that was looked for and not found)
export const NO_TARGET = {
  bmi_g1_over: "אין יעד מספרי רשמי לרמה של עודף משקל בקרב ילדים. היעד היחיד שנמצא היה ירידה יחסית עד 2020, והוא פג.",
  bmi_g7_over: "אין יעד מספרי רשמי לרמה של עודף משקל בקרב ילדים. היעד היחיד שנמצא היה ירידה יחסית עד 2020, והוא פג.",
  life_expectancy: "לא נמצא יעד מספרי רשמי לתוחלת החיים.",
  mortality_std: "היעד הקרוב ביותר, יעד 3.4 של האו״ם, הוא ירידה יחסית בארבע קבוצות מחלות ולא רמה של שיעור הפטירות הכללי.",
  diabetes_std: "משרד הבריאות וארגון הבריאות העולמי לא פרסמו יעד לשיעור חולי הסוכרת.",
  road_pedestrian_100k: "היעדים הרשמיים לבטיחות בדרכים נקבעו לכלל המשתמשים בדרך ולא להולכי רגל בנפרד.",
  child_injury_ed_1000: "אין יעד רשמי לביקורי מיון של ילדים. היעד היחיד שנמצא, של ארגון אזרחי, נוגע למוות מפציעה ולא למדד הזה.",
  child_injury_hosp_1000: "אין יעד רשמי לאשפוזי ילדים בשל פגיעה.",
  family_doctors_10k: "אין תקן רשמי למספר רופאי המשפחה ביחס לאוכלוסייה.",
  pediatricians_10k: "אין יחס רשמי של רופאי ילדים לאוכלוסייה.",
  wait_specialist_days: "משרד הבריאות לא קבע טווח מספרי לזמן ההמתנה לרופא מומחה בקהילה.",
  wait_gyn_days: "אין זמן המתנה מרבי רשמי לרופא נשים בקהילה.",
  mental_points_10k: "אין יעד רשמי למספר נקודות השירות לבריאות הנפש.",
  depressed_20: "לא נמצא יעד או נקודת השוואה רשמית לשאלה הזאת בסקר.",
  lonely_20: "התוכנית הלאומית לבדידות מ-2022 לא קבעה יעד מספרי להפחתה.",
  swd_recipients_1000: "המדד מתאר את היקף השירות, בלי טוב או רע, ולכן אין לו יעד.",
  swd_children_1000: "המדד מתאר את היקף השירות, בלי טוב או רע, ולכן אין לו יעד.",
  swd_violence_1000: "המספר תלוי בכמה מקרים מזוהים ומדווחים, ולכן יעד לא היה הוגן.",
  pov_persons: "אין יעד מספרי רשמי בישראל לשיעור העוני.",
  pov_children: "אין יעד מספרי רשמי בישראל לשיעור העוני בקרב ילדים.",
  pov_elderly: "אין יעד מספרי רשמי בישראל לשיעור העוני בקרב אזרחים ותיקים.",
  green_satisfaction: "הנחיות ארגון הבריאות העולמי לשטחים ירוקים נוגעות למרחק ולשטח ולא לשיעור המרוצים.",
  noise_bother: "הנחיות ארגון הבריאות העולמי לרעש נוגעות לעוצמה בדציבלים ולא לשיעור המוטרדים.",
  pop_size: "מדד רקע שמתאר את היישוב, ולכן אין לו יעד.",
  pop_growth: "מדד רקע שמתאר את היישוב, ולכן אין לו יעד.",
  ses_index: "מדד רקע שמתאר את היישוב, ולכן אין לו יעד."
};

// ── which reference a figure has ──
export function kindOf(a) {
  const g = a && a.guide;
  if (g && typeof g === "object") return g.judges ? "target" : "orient";
  return a && a.benchmark && typeof a.benchmark === "object" ? "bench" : "none";
}
// +1 when a higher value is better than the reference, -1 when a lower one is
const side = (g) => (g.direction === "atMost" ? -1 : 1);

// where the figure stands against its judging target, in the words of the status rules: meets; near (short of it by 5 points or less: it may still be תקין); below (more than 5: it cannot be תקין);
// far (more than 10: it needs treatment). A figure on a group too small to compare, or a reference that does not judge, has none.
export function stateOf(a) {
  const g = a && a.guide;
  if (!g || typeof g !== "object" || !g.judges || g.meets == null || (a.last && a.last.reliable === false)) return null;
  if (g.meets) return "meets";
  const pct = a.unit === "%", short = pct ? (isNum(g.gap) ? -g.gap : null) : (isNum(g.relGap) ? -g.relGap : null);
  if (short == null) return (a.statusWhy || []).includes("target") ? "far" : "near";
  return short > (pct ? FAR.pts : FAR.rel) ? "far" : short > (pct ? NEAR.pts : NEAR.rel) ? "below" : "near";
}

// the national figure is itself short of the target (a target the country has not reached)
const natShort = (a, g) => !!a.last && isNum(a.last.nat) && isNum(g.value) && (a.last.nat - g.value) * side(g) < 0;
// the town against the country at the printed precision, in the direction that is good: "better", "worse", "same", or null (no national figure, no direction)
function vsNation(a) {
  const L = a.last;
  if (!L || !isNum(L.v) || !isNum(L.nat) || (a.direction !== "higher" && a.direction !== "lower")) return null;
  const d = (Math.round(L.v * 10) - Math.round(L.nat * 10)) * (a.direction === "lower" ? -1 : 1);
  return d > 0 ? "better" : d < 0 ? "worse" : "same";
}

// ── a row of the town page and of the category page: "יעד רשמי: לפחות 80% · רחוק מהיעד" ──
// tick: the place of the target on the bars of the row (a share of the track), only for a percentage (the bars of other units have no fixed scale)
export function rowTarget(a) {
  const g = a && a.guide, state = stateOf(a);
  if (!state) return null;
  const tick = a.unit === "%" && g.unit === "%" && isNum(g.value) && g.value > 0 && g.value < 100 ? g.value : null;
  return { text: g.text, state, word: STATE[state], natMiss: natShort(a, g), tick, value: g.value, unit: g.unit };
}
// the words of the line itself ("יעד רשמי: לפחות 80% · רחוק מהיעד.") are made by city/data.js tgtSegs from this object; nothing about the country is said for a missed target

// ── the panel of the figure's own page ──
// the distance in words: "עומד ביעד, הערך גבוה ממנו ב-4.2 נקודות אחוז." / "חסרות 28.1 נקודות אחוז להגיע ליעד."
function distance(a, g, state) {
  if (!state || !isNum(g.gap)) return null;
  const abs = Math.abs(g.gap), n = Number(num(abs, 1));
  if (state === "meets") {
    if (!n) return "עומד ביעד.";
    return a.unit === "%" ? `עומד ביעד, ${g.direction === "atMost" ? "הערך נמוך ממנו" : "הערך גבוה ממנו"} ב-${iso(num(abs, 1))} נקודות אחוז.` : "עומד ביעד.";
  }
  return `${lacking(g.gap, a.unit).replace(/[\d.,]+/, iso)} להגיע ליעד.`;
}
// the sentence that sets the two references side by side, only when they disagree (better than the country and short of the target, or the other way round)
function across(a, g, state) {
  const nat = vsNation(a);
  if (!state || !nat || nat === "same") return null;
  if (state === "meets") return nat === "worse" ? "הערך נמוך מהממוצע הארצי, ובכל זאת עומד ביעד." : null;
  return nat === "better" ? `הערך טוב מהממוצע הארצי, ובכל זאת ${state === "far" ? "רחוק מהיעד" : state === "below" ? "מתחת ליעד" : "קצת מתחת ליעד"}.` : null;
}
// a figure that is "תקין" only because it meets its target (the rank among the towns alone would have held it lower)
const heldByTarget = (a, state) => state === "meets" && (a.status === "good" || a.status === "strength") && a.last && isNum(a.last.level) && a.last.level < 50;

const sourceOf = (ref) => {
  const s = (ref && ref.source) || {};
  return { short: s.short || s.publisher || "", publisher: s.publisher || s.short || "", title: s.title || "", url: s.url || null, where: s.where || null };
};
// the catalogue spells the national programme the old way in a few names; the product writes "התוכנית"
export const respell = (t) => String(t == null ? "" : t).replace(/התכנית/g, "התוכנית");
// the old spelling mended inside a node that is already built (the names of data sets come from the catalogue)
export function respellTree(root) {
  const walk = (n) => {
    if (n.nodeType === 3) { const t = String(n.nodeValue), r = respell(t); if (r !== t) n.nodeValue = r; }
    else if (n.childNodes) for (const c of [...n.childNodes]) walk(c);
  };
  if (root) walk(root);
  return root;
}
// the name of a document as ONE label, for the link "מקור היעד: ...": the publisher once (not when the title already names it), the title without a code in brackets, without the table that code names and without a
// half that the first half already says ("X: Y, Y"), the colons of the title as dots: the link text then holds no colon of its own (the one before it is the label's)
export function sourceLabel(src) {
  const pub = clean((src && (src.short || src.publisher)) || "").trim();
  const raw = respell(clean((src && src.title) || "")).replace(/\s*\([^()]*[A-Za-z][^()]*\)/g, "").replace(/\s*,\s*טבלה\s+[A-Za-z][\w.-]*\s*$/u, "");
  const kept = [];
  for (const part of raw.split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean)) if (!kept.some((k) => k.includes(part))) kept.push(part);
  const title = kept.join(", ").replace(/\s*:\s*/g, " · ");
  return !title ? pub : !pub || title.includes(pub) ? title : `${pub} · ${title}`;
}

// a reference whose caveat opens by saying the same thing at greater length (it holds every number of the short text and more): the long sentence is the line, said once, and the rest is the small print
const sentences = (t) => String(t == null ? "" : t).trim().split(/(?<=\.)\s+/).filter(Boolean);          // the marks that keep a range of years in order stay in the text
const figuresIn = (t) => new Set(clean(t).match(/\d+(?:\.\d+)?/g) || []);
function leadOf(text, caveat) {
  const sents = sentences(respell(caveat)), mine = figuresIn(text);
  if (sents.length && mine.size && [...mine].every((n) => figuresIn(sents[0]).has(n))) return { lead: sents[0].replace(/\.$/, ""), note: sents.slice(1).join(" ") || null };
  return { lead: null, note: caveat ? respell(caveat) : null };
}
// why there is no official target: the reason of the research; a reason that says it itself ("אין יעד ...", "לא נמצא יעד ...") stands alone, any other gets the plain statement before it
const SAYS_NONE = /^(?:אין|לא נמצא)\s/u;
function noTarget(a) {
  const why = NO_TARGET[a.id] || "לא נמצא גוף רשמי שפרסם יעד מתאים לנתון הזה.";
  return SAYS_NONE.test(why) ? [why] : ["אין יעד רשמי למדד הזה.", why];
}
// the panel: { kind, label, lines: [{ t, em }], note (small, the caveat), source: { label, url } | null }; em marks the line that says where the figure stands (set bold)
// Each kind says what the reference is, who published it and the year; the target says where the figure stands; the other two say that they are context and do not change the status. Nothing about which way is good.
export function panelOf(a) {
  const kind = kindOf(a), line = (t, em = false) => ({ t, em });
  if (kind === "none") return { kind, label: "היעד הרשמי", lines: noTarget(a).map((t) => line(t)), note: null, source: null };
  const ref = kind === "bench" ? a.benchmark : a.guide, src = sourceOf(ref), year = ref.year ? `, ${iso(String(ref.year))}` : "", who = `${src.short}${year}`;
  const label = kind === "bench" ? "נקודת ייחוס" : kind === "orient" ? "יעד להתמצאות" : "היעד הרשמי";
  const source = src.url ? { label: sourceLabel(src), url: src.url } : null;
  if (kind === "target") {
    const state = stateOf(a), dist = state ? distance(a, ref, state) : null, nat = a.last && isNum(a.last.nat) ? iso(num(a.last.nat, 1) + (a.unit === "%" ? "%" : "")) : "";
    const lines = [line(`היעד: ${ref.text} (${who}).`), dist ? line(dist, true) : a.last && a.last.reliable === false ? line("הקבוצה קטנה, ולכן אין השוואה ליעד.") : null,
      across(a, ref, state) ? line(across(a, ref, state)) : null,
      state && natShort(a, ref) ? line(state === "meets" ? `הממוצע הארצי (${nat}) עדיין מתחת ליעד.` : `גם הממוצע הארצי (${nat}) לא הגיע ליעד.`) : null].filter(Boolean);          // that a met target is why the status is תקין is said once, in the sentence under the title (reasonOf)
    return { kind, label, lines, note: ref.caveat ? respell(ref.caveat) : null, source };
  }
  if (kind === "orient") {
    const { lead, note } = leadOf(ref.text, ref.caveat);
    return { kind, label, lines: [line(lead ? `${lead} (${who}).` : `היעד: ${ref.text} (${who}).`), line("הוא מוצג להתמצאות בלבד ואינו משנה את מצב המדד.", true)], note, source };
  }
  return { kind, label, lines: [line(`נקודת הייחוס: ${ref.text} (${who}).`), line("היא מוצגת להקשר בלבד, אינה יעד ואינה משנה את מצב המדד.", true), ...noTarget(a).map((t) => line(t))], note: ref.caveat ? respell(ref.caveat) : null, source };
}

// ── the sentence under the title of a figure with a judging target ──
// ui.js statusReason says why a figure has its status, in the words of the rule that decided it, and says nothing of a met target when the trend is what decided; here the target has its own word, a met one is said
// ("דורש טיפול כי המגמה בהידרדרות, אף שהוא עומד ביעד הרשמי וטוב מהממוצע הארצי"), and the gap is spelled in points of percentage with its unit. Null for any other figure: the old sentence stays.
const joinHe = (parts) => (parts.length < 2 ? parts[0] || "" : parts.slice(0, -1).join(", ") + " ו" + parts[parts.length - 1]);
export function reasonOf(a) {
  const state = stateOf(a);
  if (!state || !a.last) return null;
  const L = a.last, st = a.status, why = a.statusWhy || [], word = { concern: "דורש טיפול", watch: "למעקב", good: "תקין", strength: "חוזק" }[st];
  if (!word) return null;
  if (st === "concern" || st === "watch") {
    const part = {
      rank: () => (L.level <= 2 ? (L.rank != null && L.of ? `המצב מהחלשים ביותר מבין היישובים (מקום ${L.rank} מתוך ${L.of})` : "המצב מהחלשים ביותר מבין היישובים") : `הערך טוב יותר מ-${num(L.level, 0)}% בלבד מהיישובים`),
      target: () => `${lacking(L.gapTarget, a.unit)} ליעד הרשמי`,
      worsening: () => "המגמה בהידרדרות"
    };
    const parts = why.map((w) => (part[w] && (w !== "target" || isNum(L.gapTarget)) ? part[w]() : null)).filter(Boolean);
    if (!parts.length) return null;
    const nat = compareLine(a), natText = nat.text.replace(/[\s ]+נק׳/g, " נקודות אחוז"), concede = [state === "meets" ? "עומד ביעד הרשמי" : null, nat.tone === "good" ? natText : null, a.history && a.history.trendClass === "improving" ? "בשיפור" : null].filter(Boolean);
    return `${word} כי ${joinHe(parts)}${concede.length ? `, אף שהוא ${joinHe(concede)}` : ""}.`;
  }
  if (!isNum(L.level)) return null;
  const met = state === "meets";
  if (heldByTarget(a, state)) return `${word} כי הוא עומד ביעד הרשמי, אף שהערך טוב יותר מ-${num(L.level, 0)}% בלבד מהיישובים, ואין הידרדרות.`;
  return `${word}: הערך טוב יותר מ-${num(L.level, 0)}% מהיישובים${met ? ", עומד ביעד הרשמי" : ""}, ואין הידרדרות.`;
}

// ── the catalogue (GET /api/meta): which figures have which reference, for the method and coverage pages ──
// (the documents of role "guideline" are not data sources: entry/text.js dataSources leaves them out of the count and the list of sources)
export function catalogueOf(meta) {
  const list = (meta && Array.isArray(meta.indicators) ? meta.indicators : []).filter((i) => i && typeof i === "object"), sources = (meta && meta.sources) || {};
  const out = { target: [], orient: [], bench: [], none: [], docs: [] }, uses = new Map();
  for (const i of list) {
    const g = i.guideline, b = i.benchmark;
    if (g && g.judges) out.target.push(i); else if (g) out.orient.push(i);
    if (b) out.bench.push(i);
    if (!g) out.none.push(i);
    for (const ref of [g, b]) { const id = ref && ref.source && ref.source.id; if (id) uses.set(id, [...(uses.get(id) || []), { id: i.id, judges: !!ref.judges, kind: ref === b ? "bench" : "guide" }]); }
  }
  out.docs = [...uses].map(([id, used]) => { const s = sources[id] || {}, ref = list.map((i) => i.guideline || i.benchmark).find((r) => r && r.source && r.source.id === id), rs = (ref && ref.source) || {};
    return { id, name: s.name || rs.title || id, publisher: s.publisher || rs.publisher || "", short: s.short || rs.short || s.publisher || "", url: s.url || rs.url || null, used, judges: used.some((u) => u.judges) }; });
  return out;
}
