// The voice scan: every string and template literal of a JS file (and every content: string of a CSS file) with the line it starts on,
// and the finder for the words the product must not speak in (SPEC 7.1: neutral third person, plural second person, no slash forms).
import fs from "node:fs";
import path from "node:path";

const HE = "\\u0590-\\u05FF";
const HEB = /[֐-׿]/;

// A small tokenizer: skips comments and regex literals, returns the text of each string with its line.
// A template literal gives its fixed parts as one string; the code inside ${} is scanned for strings of its own.
export function literals(src) {
  const out = [];
  let i = 0, line = 1;
  const n = src.length;
  let prev = ""; // last significant character, to tell a regex from a division
  const scanCode = (stop) => {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === "\n") { line++; i++; continue; }
      if (stop && c === "{") depth++;
      if (stop && c === "}") { if (depth === 0) { i++; return; } depth--; }
      if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") { i += 2; while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; } i += 2; continue; }
      if (c === '"' || c === "'") {
        const start = line; let s = ""; i++;
        while (i < n && src[i] !== c && src[i] !== "\n") { if (src[i] === "\\") { s += src[i + 1]; i += 2; } else s += src[i++]; }
        i++; out.push({ line: start, text: s }); prev = "a"; continue;
      }
      if (c === "`") { template(); prev = "a"; continue; }
      if (c === "/" && /[(,=:[!&|?{};>+\-*%<~^]|^$/.test(prev)) { // a regex literal
        i++; let inClass = false;
        while (i < n && (src[i] !== "/" || inClass) && src[i] !== "\n") { if (src[i] === "\\") i++; else if (src[i] === "[") inClass = true; else if (src[i] === "]") inClass = false; i++; }
        i++; while (/[a-z]/.test(src[i] || "")) i++; prev = "a"; continue;
      }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  };
  const template = () => {
    const start = line; let s = ""; i++;
    while (i < n && src[i] !== "`") {
      if (src[i] === "\\") { s += src[i + 1]; i += 2; continue; }
      if (src[i] === "$" && src[i + 1] === "{") { i += 2; s += " "; const keep = prev; prev = "{"; scanCode(true); prev = keep; continue; }
      if (src[i] === "\n") line++;
      s += src[i++];
    }
    i++; out.push({ line: start, text: s });
  };
  scanCode(false);
  return out;
}

export function cssContent(src) {
  const out = [];
  src.split("\n").forEach((l, k) => { for (const m of l.matchAll(/content:\s*([^;}]*)/g)) for (const s of m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) out.push({ line: k + 1, text: s[1] }); });
  return out;
}

const word = (w, pre = "") => new RegExp(`(^|[^${HE}])(?:[${pre}]{0,1})(${w})(?=$|[^${HE}])`, "u");

// first person plural: verb forms, and the pronouns
const WE_WORDS = ["אנחנו", "אנו", "לנו", "שלנו", "אצלנו", "אותנו", "איתנו", "עמנו", "בנו", "עלינו", "אלינו", "מאיתנו", "בינינו", "לידנו", "אתנו", "שלנו", "ידינו", "דעתנו"];
// future first person plural verbs that begin with nun (נ and no plural ending): the ones that can sit in a sentence of the product
const WE_FUTURE = ["נבדוק", "נדע", "נצרף", "נעדכן", "נוכל", "נמשיך", "נציע", "נציג", "נשמח", "נשתדל", "נחזור", "נטפל", "נתקן", "נבחן", "נבין", "נסביר", "נפרסם", "נוסיף", "נקבל", "נהיה", "נחשוב"];
// singular imperative addressed to the reader (the plural is לחצו, בחרו ...)
const SINGULAR = ["לחץ", "בחר", "הזן", "הקלד", "נסה", "חפש", "הוסף", "סגור", "פתח", "שתף", "העתק", "הורד", "בדוק", "חזור", "בטל", "אשר", "שלח", "שאל", "קרא", "גלול", "הקש", "נווט", "צפה", "עיין", "ראה", "זכור", "שים", "הרשם", "התחבר", "הדפס", "השתמש", "הסתכל", "חכה", "המתן", "רענן", "נקה", "מחק", "ערוך", "הצג", "הסתר", "סמן", "דווח", "פנה", "בקר", "גש", "עזור", "הכנס", "תלחץ", "תבחר", "תנסה", "תוכל", "תראה", "תקליד", "תחפש", "תוסיף", "תסגור", "תפתח", "תשתף", "תעתיק", "תוריד", "תבדוק", "תחזור", "תמשיך", "תבטל", "תשלח", "תכתוב", "תשאל", "תקרא", "תגלול", "תקיש"];
// second person singular pronouns and suffixes
const YOU = ["אתה", "שלך", "לך", "אליך", "עליך", "בשבילך", "ממך", "איתך", "אצלך", "אותך", "בך", "תוכלי", "ברשותך", "דעתך", "שאלתך", "בחירתך"];

const reWe = word(WE_WORDS.join("|"), "והבלכמש");
const reFuture = word(WE_FUTURE.join("|"), "ו");
const reSing = word(SINGULAR.join("|"), "ו");
const reYou = word(YOU.join("|"), "ו");
// a past or present first person plural verb: a Hebrew word of 4 letters or more that ends in נו (מצאנו, הצלחנו, בדקנו, חישבנו)
const reNu = new RegExp(`(^|[^${HE}])([${HE}]{3,}נו)(?=$|[^${HE}])`, "u");
// a slash between Hebrew letters: תלחץ/י, בחר/י, מוזמן/ת, הוא/היא
const reSlash = new RegExp(`[${HE}]\\/[${HE}]`, "u");

// words that end in נו and are not a first person plural: ממנו (from it), אינו (is not), and the third person plural past of a root that ends in nun (השתנו, עודכנו: said of things, never of the product)
export const NU_OK = new Set(["ממנו", "אינו", "השתנו", "עודכנו", "שונו", "מתוכנו", "חוסנו", "התחסנו", "אובחנו", "פונו", "נתנו", "נטענו", "הכינו", "ניתנו", "הופנו"]);
const nuOk = (w) => [0, 1, 2].some((k) => /^[ושהבלכמ]*$/.test(w.slice(0, k)) && NU_OK.has(w.slice(k)));

export function findVoice(text) {
  if (!HEB.test(text)) return [];
  const hits = [];
  let m;
  if ((m = reWe.exec(text))) hits.push(["we", m[2]]);
  if ((m = reFuture.exec(text))) hits.push(["we-future", m[2]]);
  if ((m = reNu.exec(text)) && !nuOk(m[2])) hits.push(["we-verb", m[2]]);
  if ((m = reSing.exec(text))) hits.push(["singular", m[2]]);
  if ((m = reYou.exec(text))) hits.push(["you-singular", m[2]]);
  if ((m = reSlash.exec(text))) hits.push(["slash", text.slice(Math.max(0, m.index - 6), m.index + 6)]);
  return hits;
}

export function walk(dir, ext, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, ext, out); else if (f.name.endsWith(ext)) out.push(p);
  }
  return out;
}

// every hit of the voice scan in a list of files: { file, line, kind, word, text }
export function scan(files) {
  const hits = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    const lits = file.endsWith(".css") ? cssContent(src) : literals(src);
    for (const { line, text } of lits) for (const [kind, w] of findVoice(text)) hits.push({ file, line, kind, word: w, text: text.slice(0, 90) });
  }
  return hits;
}
