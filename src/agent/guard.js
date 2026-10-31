"use strict";
/**
 * The rule that keeps the ask-agent honest: a model may write prose, but every figure in it must come from a token that the
 * server resolves from the data. Text with a digit the model typed itself is rejected.
 *
 *   {{v:ID}} latest value   {{nat:ID}} national value   {{target:ID}} official target   {{guide:ID}} official guideline (only one that judges)   {{peer:ID}} median of similar localities
 *   {{gap:ID}} distance from the national value (points)   {{rank:ID}} {{of:ID}} place among localities   {{year:ID}} year of the latest figure
 *   {{delta:ID}} change since the first year (points)   {{first:ID}} the first year   {{pop}} population   {{city}} the locality name
 */
const { unitText, pct, num, abs, pts, I, deltaText } = require("../lib/format");

// Words the product does not use; any model text containing one of these is rejected.
// The regex in fallback.js line 47 that detects user intent (מדאיג as a word the USER wrote) is intentionally excluded.
const FORBIDDEN_WORDS = ["פרמטר", "פרמטרים", "מדאיג", "מדאיגים", "מדאיגה", "אחוזון", "מובהק", "המודל", "מחמיר"];
const FORBIDDEN_RE = new RegExp(FORBIDDEN_WORDS.join("|"));

const TOKEN = /\{\{\s*([a-z]+)(?::([a-z0-9_]+))?\s*\}\}/g;

// The reader sees plain Hebrew, never a Latin code. A model that still writes one is not rejected for it: the code is swapped for the plain phrase of this
// table (the catalogue's own label says it: th_mmrv is "חצבת, חזרת ואדמת", th_penta is the "מחומש"). A Latin word that is NOT in the table is a model that
// slipped out of Hebrew, and the sentence is unusable (hasStrayLatin).
const MMRV = "חצבת, חזרת ואדמת", PENTA = "מחומש";
const CODES = {
  "MMR/MMRV": MMRV, "MMRV": MMRV, "MMR": MMRV, "mmr": MMRV, "mmrv": MMRV,                                       // th_mmrv
  "DTaP-IPV-Hib": PENTA, "DTaP+IPV+Hib": PENTA, "DTaP/IPV/Hib": PENTA, "DTaP": PENTA, "IPV": "פוליו", "Hib": "המופילוס אינפלואנזה",     // th_penta
  "BMI": "מדד מסת הגוף", "EPDS": "שאלון הדיכאון שאחרי לידה", "SIDS": "מוות בעריסה", "HPV": "נגיף הפפילומה", "HMO": "קופות החולים",
  "WHO": "ארגון הבריאות העולמי", "CDC": "המרכז האמריקאי לבקרת מחלות", "CBS": "הלשכה המרכזית לסטטיסטיקה",
  "COSI": "מחקר השמנת הילדים של ארגון הבריאות העולמי באירופה", "OECD": "מדינות הארגון לשיתוף פעולה כלכלי ופיתוח", "HBSC": "מחקר התנהגויות בריאות של בני נוער",
  "CPSTF": "צוות השירותים המונעים האמריקאי", "USPSTF": "צוות המשימה האמריקאי לשירותי מניעה", "AAP": "האקדמיה האמריקאית לרפואת ילדים", "CBT": "טיפול קוגניטיבי התנהגותי"
};
const CODE_ALT = Object.keys(CODES).sort((a, b) => b.length - a.length).map((c) => c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|");
const CODE_PAREN = new RegExp(`\\s*\\(\\s*(${CODE_ALT})\\s*\\)`, "g");                                       // "פעוטות שחוסנו נגד חצבת (MMR)"
const CODE_ATTACHED = new RegExp(`(?<![A-Za-z0-9_])([בלמהוכש]{1,2})-(${CODE_ALT})(?![A-Za-z0-9_])`, "g");       // "ב-MMR"
const CODE_BARE = new RegExp(`(?<![A-Za-z0-9_])(${CODE_ALT})(?![A-Za-z0-9_])`, "g");
const PLAIN_TWICE = new RegExp(`(${[...new Set(Object.values(CODES))].map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*(?:\\/|או|ו-?|,)\\s*\\1`, "g");
// a bracket that repeats what the text has just said is dropped; one that says something new keeps its plain phrase
function plainCodes(text) {
  if (typeof text !== "string" || !/[A-Za-z]/.test(text)) return text;
  const tokens = [];                                                                                  // {{v:th_mmrv}} is a token of the server, not a code: it is set aside and put back
  let t = text.replace(/\{\{[^}]*\}\}/g, (m) => { tokens.push(m); return "\u0001" + (tokens.length - 1) + "\u0001"; });
  t = t.replace(CODE_PAREN, (m, code, at, whole) => {
    const plain = CODES[code], before = whole.slice(Math.max(0, at - 60), at);
    return before.includes(plain.split(/[\s,]+/)[0]) ? "" : ` (${plain})`;
  });
  t = t.replace(CODE_ATTACHED, (m, pre, code) => pre + CODES[code]);
  t = t.replace(CODE_BARE, (m, code) => CODES[code]);
  return t.replace(PLAIN_TWICE, "$1").replace(/\u0001(\d+)\u0001/g, (m, i) => tokens[Number(i)]);
}
// a Latin word of three letters or more that the table did not swap
const hasStrayLatin = (t) => /[A-Za-z][A-Za-z-]{2,}/.test(plainCodes(t));

// What the ask-agent must never say. The system HOLDS the data of every locality of the country, and the server adds the comparison with the localities a
// question names; a model that is shown only one locality's indicators once wrote "the system shows data on this locality only and has no direct comparison
// with X and Y". That is false about the system, so the sentence is rejected like a typed digit.
const FALSE_CLAIMS = [
  /(?:נתונים|מידע)\s+(?:רק\s+)?(?:על|עבור|של)\s+[^.!?\n]{0,40}\sבלבד/,                     // "נתונים על שדרות בלבד"
  /(?:נתונים|מידע)\s+רק\s+(?:על|עבור|של)\s+(?:ה?יישוב|ה?עיר|יישוב אחד|עיר אחת)/,
  /(?:יישוב|ישוב|עיר|רשות|מקום)\s+אחד?ת?\s+בלבד/,                                          // "יישוב אחד בלבד"
  /אין[^.!?\n]{0,25}השוואה\s+ישירה/,                                                       // "אין בה כרגע השוואה ישירה מול ..."
  /אין[^.!?\n]{0,25}(?:להשוות|השוואה)[^.!?\n]{0,25}\s(?:מול|בין|עם)\s+(?:יישוב|ישוב|עיר|ערים|יישובים|ישובים|רשויות|אחר)/,
  /(?:לא\s+ניתן|אי[\s-]אפשר|אין\s+אפשרות|לא\s+אפשר)\s+(?:כרגע\s+)?(?:להשוות|לערוך\s+השוואה)/,
  /(?:אין|חסרים?|לא\s+קיימים?)\s+(?:במערכת\s+)?(?:נתונים|מידע)\s+(?:כרגע\s+)?(?:על|עבור)\s+(?:יישובים|ישובים|ערים|רשויות)\s+(?:אחר|נוספ)/,
  /המערכת\s+(?:מתמקדת|עוסקת|בנויה|מוגבלת)\s+ב?(?:יישוב|עיר)\s+אחד/
];
const falseClaim = (t) => { for (const re of FALSE_CLAIMS) { const m = re.exec(t); if (m) return m[0]; } return null; };

function resolveToken(kind, id, model) {
  if (kind === "city") return model.city.name;
  if (kind === "pop") return model.city.population ? num(model.city.population, 0) : null;
  const a = model.indicators.find((x) => x.id === id);
  if (!a) return null;
  const L = a.last, H = a.history, fmt = (v) => (v == null ? null : unitText(a.unit, v));
  switch (kind) {
    case "v": return fmt(L.v);
    case "nat": return fmt(L.nat);
    case "target": return fmt(L.target);
    case "guide": return a.guide && a.guide.judges && a.guide.comparable ? fmt(a.guide.value) : null;     // an international reference figure or a national percentage cut never becomes a figure in a sentence
    case "peer": return fmt(L.peer);
    case "gap": return L.gapNat == null ? null : deltaText(a.unit, L.gapNat);
    case "rank": return L.rank == null ? null : I(L.rank);
    case "of": return L.of == null ? null : I(L.of);
    case "year": return I(L.year);
    case "first": return I(H.first.year);
    case "delta": return H.delta == null ? null : deltaText(a.unit, H.delta);
    default: return null;
  }
}

// a one-letter Hebrew prefix (ב, ל, מ, ו, כ, ש) in front of a figure takes a hyphen: ב-2024, ל-1,000. Before the city name it does not: באום אל-פחם.
const fixPrefixes = (t) => t.replace(/(^|[\s("״])([בלמוכש])(\{\{\s*(?!city|pop)[a-z]+:)/g, "$1$2-$3");
// a token already ends with its unit; when the model writes the unit again, one copy is kept
const dedupeUnits = (t) => t.replace(/(שנים|ימים|נק׳|ל-1,000|ל-10,000|ל-100,000)(\s+\1)+/g, "$1");

// returns the text with every token filled in, or null when the text is unusable (unknown token, missing figure, typed digit, forbidden word)
function expand(text, model) {
  if (typeof text !== "string" || !text.trim()) return null;
  text = fixPrefixes(plainCodes(text));                 // a Latin code of the table becomes its plain Hebrew phrase
  const bare = text.replace(TOKEN, "");
  if (/[0-9٠-٩]/.test(bare)) return null;               // a figure the model typed itself
  if (hasStrayLatin(bare)) return null;                 // an English word in a Hebrew answer
  if (FORBIDDEN_RE.test(bare)) return null;             // a word the product does not use
  if (falseClaim(bare)) return null;                    // "the system holds data on this locality only"
  let ok = true;
  const out = text.replace(TOKEN, (_, kind, id) => {
    const r = resolveToken(kind, id, model);
    if (r == null) { ok = false; return ""; }
    return r;
  });
  if (!ok) return null;
  const resolved = dedupeUnits(out.replace(/\s{2,}/g, " ").trim());
  // after filling every token, no {{ must remain
  if (/\{\{/.test(resolved)) return null;
  return resolved;
}

// why a text was rejected, in words a model can act on (used for the one repair attempt in ask.js)
function explain(text, model) {
  if (typeof text !== "string" || !text.trim()) return "the answer is empty";
  const bare = plainCodes(text).replace(TOKEN, "");
  if (/[0-9٠-٩]/.test(bare)) return "it contains digits typed directly; every figure must be a {{token}}";
  const stray = bare.match(/[A-Za-z][A-Za-z-]{2,}/g) || [];
  if (stray.length) return "it contains English words (" + stray.join(", ") + "); write only Hebrew";
  const claim = falseClaim(bare);
  if (claim) return "it says \"" + claim + "\", which is false about the system: the system holds official data on every locality of the country, and the server adds the comparison with the localities that the question names; do not write that the data is of this locality only, that a comparison is impossible, or that data about another locality is missing";
  const forbiddenMatch = bare.match(FORBIDDEN_RE);
  if (forbiddenMatch) return `it contains the forbidden word "${forbiddenMatch[0]}"; use the correct product vocabulary`;
  let bad = null;
  text.replace(TOKEN, (m, kind, id) => { if (bad == null && resolveToken(kind, id, model) == null) bad = m; return m; });
  return bad ? "the token " + bad + " cannot be resolved for this locality" : "ok";
}

module.exports = { expand, explain, resolveToken, hasStrayLatin, plainCodes, falseClaim, CODES, TOKEN, FORBIDDEN_WORDS, FORBIDDEN_RE };
