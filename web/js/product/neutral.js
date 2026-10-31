// The neutral voice for the old page modules: they stay as they are (their files must not change), and a few of their sentences still speak as "we".
// watchNeutral(view) swaps those sentences for the product's own wording, in every text node and every label that appears under the view (and in the shared hover card), now and later
// (an answer that arrives). The same pass carries the product's other plain-words tables; all of them swap the old module's text on the screen, none edits a file of the old module:
//   PHRASES  sentences that speak as "we"                     WORDS   a word the product never says
//   PLACE    "העיר" said of a place (a town may be a city, a local council or a kibbutz)
//   NAMES    a Latin code in the name of a figure (MMR/MMRV, DTaP-IPV-Hib)      SPELL   one spelling of a word (התוכנית, בין-לאומי)
// The static scan of the product's own strings is tests/product-voice.test.mjs; the same test checks that every sentence of the old modules that speaks as "we" is in this table,
// and that no sentence of the old modules still says "העיר" after the swap.

// [the old sentence, the neutral one]; the finder is a plain string, the longest first where one contains another
export const PHRASES = [
  ["איך הגענו לכאן ולאן זה מוביל", "איך המצב הגיע לכאן ולאן הוא מוביל"],
  ["איך נדע שהצלחנו", "איך יודעים שהפעולה הצליחה"],
  ["איך נדע שהצליחה", "איך יודעים שהצליחה"],
  ["מי נמצא לידנו בדירוג", "מי נמצא קרוב בדירוג"],
  ["מי ממש מעלינו ומתחתינו", "מי נמצא ממש מעל ומתחת"],
  ["לא הצלחנו לטעון את המפה של המדד הזה.", "המפה של המדד הזה לא נטענה."],
  ["לא הצלחנו לטעון את המפה.", "המפה לא נטענה."],
  ["לא הצלחנו לטעון את תמונת המצב של:", "תמונת המצב לא נטענה עבור:"],
  ["לא הצלחנו לטעון את רשימת המדדים.", "רשימת המדדים לא נטענה."],
  ["לא הצלחנו לטעון את הדירוג של המדד הזה.", "הדירוג של המדד הזה לא נטען."],
  ["איפה אנחנו בדירוג", "המקום בדירוג"],
  ["מה אנחנו רואים בנתונים", "מה רואים בנתונים"],
  ["איפה אנחנו הכי חלשים?", "איפה המצב הכי חלש?"],
  ["במה אנחנו חזקים?", "במה המצב חזק?"],
  ["לא מצאנו מה להציג לשאלה הזו", "אין מה להציג לשאלה הזו"],
  ["לא מצאנו את היישוב", "היישוב לא נמצא"],
  ["בדקנו ", "נבדקו "],
  // the owners of an action in src/catalog/interventions.js are written with a slash for the two genders: the neutral form names the office
  ["מנהל/ת מחלקת הבריאות", "הנהלת מחלקת הבריאות"],
  ["מנהל/ת טיפות החלב", "הנהלת טיפות החלב"],
  ["מנהל/ת המחלקה", "הנהלת המחלקה"]
];

// [a word the product never says, the word it says]: the old status label of a group too small to judge is "בסיס קטן" (jargon; SPEC 7.1 forbids it, copy.js FORBIDDEN);
// the longest first, as above. Not "we" sentences, so the voice scan does not flag these; tests/product-voice.test.mjs checks them on their own.
export const WORDS = [
  ["בסיס קטן, ולכן אין מסקנה", "הקבוצה קטנה, ולכן אין מסקנה"],
  ["בסיס קטן, לא מדורג", "קבוצה קטנה, לא מדורגת"],
  ["בסיס קטן", "קבוצה קטנה"]
];

// The place. The old page modules call every town "העיר" ("איפה העיר מבין כולם", "מדד רקע: מתאר את העיר"); a town may be a city, a local council or a kibbutz, so the product says "היישוב".
// A sentence whose verb or adjective agrees with the noun is listed first, with its masculine form; every other "העיר" ("בעיר", "מהעיר", "והעיר") is swapped by the pattern under SPELL.
// "בעירייה" (an owner of an action in the catalogue's recommendations) is the local authority, which every town has, whatever its kind.
export const PLACE = [
  ["העיר מסומנת בכחול בכל התצוגות", "היישוב מסומן בכחול בכל התצוגות"],
  ["העיר מסומנת", "היישוב מסומן"],
  ["ואם אין או שהעיר עומדת בו", "ואם אין או שהיישוב עומד בו"],
  ["איפה העיר הכי חלשה", "איפה היישוב הכי חלש"],
  ["המגמה של העיר עצמה", "המגמה של היישוב עצמו"]
];

// The name of a figure as the catalogue spells it, with a Latin code or a colon: the vaccine codes in brackets go, the bare code of the measles vaccine says its three diseases (the name the town page
// uses), and a name with a colon ("עוני: ילדים") is a phrase (a line that says what the name stands for had two colons). The exact name of a document stays as it is: a source line says "COSI" or
// "CO2.2" because that is what the document is called.
export const NAMES = [
  ["חיסון MMR/MMRV עד גיל", "חיסון חצבת, חזרת ואדמת עד גיל"],
  [" (MMR/MMRV)", ""],
  [" (DTaP-IPV-Hib)", ""],
  [" (DTaP+IPV+Hib)", ""],
  ["עוני: נפשות", "עוני באוכלוסייה"],
  ["עוני: ילדים", "עוני בקרב ילדים"],
  ["עוני: ותיקים", "עוני בקרב אזרחים ותיקים"],
  ["פגיעות ילדים: אשפוז", "אשפוזים בעקבות פגיעות ילדים"]
];

// One spelling of a word, by pattern (a Hebrew letter on either side means the match is part of a longer word, so it is left alone):
//   "העיר" and "בעיר" of the old modules, "בעירייה", "התכנית" (the product writes "התוכנית"), and "בין-לאומי" with a hyphen whichever way the old text spells it
const HE = "\\u05D0-\\u05EA";
export const SPELL = [
  [new RegExp(`(?<![${HE}])([ולמכשב]{0,2})העיר(?![${HE}])`, "g"), "$1היישוב"],
  [new RegExp(`(?<![${HE}])([וש]?)בעיר(?![${HE}])`, "g"), "$1ביישוב"],
  [new RegExp(`(?<![${HE}])([וש]?)בעירייה(?![${HE}])`, "g"), "$1ברשות המקומית"],
  [new RegExp(`(?<![${HE}])([ובלמכשה]{0,2})תכנית(?![${HE}])`, "g"), "$1תוכנית"],
  [/בינלאומ|בין[־‐‑]לאומ/g, "בין-לאומ"],
  [/(?<![A-Za-zא-ת])(?<!חיסון )MMR\/MMRV/g, "חצבת, חזרת ואדמת"],
  // "נק׳ מתחת ליעד משרד הבריאות (90%)" of a finding or a status line: a target is named by its kind ("ליעד הרשמי"); the publisher is named in the source line and in the panel
  [new RegExp(`(?<![${HE}])([ובל]{0,2})יעד משרד הבריאות`, "g"), (m, prefix) => (prefix ? prefix + "יעד הרשמי" : "יעד רשמי")]
];

const ALL = [...PHRASES, ...WORDS, ...PLACE, ...NAMES];
const MAP = new Map(ALL);
const RE = new RegExp(ALL.map(([from]) => from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
export const neutral = (text) => {
  if (typeof text !== "string" || !text) return text;
  return SPELL.reduce((s, [re, to]) => s.replace(re, to), text.replace(RE, (m) => MAP.get(m)));
};

const LABELS = ["aria-label", "title", "placeholder", "alt"];
function labels(el) { for (const a of LABELS) { const v = el.getAttribute(a); if (v) { const w = neutral(v); if (w !== v) el.setAttribute(a, w); } } }
function fix(n) {
  if (n.nodeType === 3) { const v = neutral(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; return; }
  if (n.nodeType !== 1) return;
  labels(n);
  n.childNodes.forEach(fix);
}

// one pass over what is there, then every node that is added and every text or label that changes
export function watchNeutral(view) {
  fix(view);
  if (typeof MutationObserver !== "function") return;
  const OPTS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: LABELS };
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "childList") m.addedNodes.forEach(fix);
      else if (m.type === "characterData") fix(m.target);
      else labels(m.target);
    }
  });
  mo.observe(view, OPTS);
  // the hover card is one element in the body (ui.js tip), outside the view: it speaks the same words
  const card = (el) => { if (el && el.nodeType === 1 && el.classList.contains("tt")) { fix(el); mo.observe(el, OPTS); } };
  const tip = typeof document !== "undefined" && document.querySelector && document.querySelector("body > .tt");
  if (tip) card(tip);
  else if (typeof document !== "undefined" && document.body) new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach(card))).observe(document.body, { childList: true });
}
