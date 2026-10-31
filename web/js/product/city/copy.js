// The words of the city home (SPEC 7.1 to 7.3 and audit/content.md Parts B, D, E). One table, no DOM, so node (the tests, the share pages) can import it.
// Voice: third person, gender-neutral around the town name ("המצב ב{name}", never an adjective that must agree with the name). The vocabulary is one fact, one word.
import { iso } from "../../ui.js";

// the five questions, in the order a mayor asks them; the id is what the URL keeps (?q=weak)
export const QIDS = ["weak", "changed", "peers", "first", "missing"];
const TEXT = {
  weak: (name) => `איפה המצב הכי חלש ב${name}?`,
  changed: () => "מה השתפר ומה הידרדר?",
  peers: (name) => `איך ${name} מול יישובים דומים?`,
  first: () => "מה כדאי לעשות קודם?",
  missing: (name) => `אילו נתונים חסרים על ${name}?`
};
export const QUESTIONS = (name) => QIDS.map((id, i) => ({ id, n: i + 1, text: TEXT[id](name) }));
export const questionText = (id, name) => (TEXT[id] || TEXT.weak)(name);

// the catalogue short names the audit flagged (B-9, C-16): a fragment without a subject, or not Hebrew. P6 fixes the catalogue; an override that became redundant is deleted then.
export const SHORT = {
  th_mmrv: "חצבת, חזרת ואדמת",          // the catalogue's short name is the Latin code of the vaccine; the three diseases are its plain name (neutral.js says the same on every other screen)
  pov_persons: "עוני באוכלוסייה", pov_children: "עוני בקרב ילדים", pov_elderly: "עוני בקרב אזרחים ותיקים",          // the catalogue names them "עוני: ילדים": a colon inside a name makes two colons in a line that says what the name stands for
  mortality_std: "שיעור פטירות מתוקנן",
  th_ppd: "אימהות שנבדקו לדיכאון אחרי לידה",
  th_violence: "אימהות שנשאלו על אלימות",
  th_iron: "תוסף ברזל לתינוקות",
  child_injury_ed_1000: "פגיעות ילדים בחדר מיון",
  child_injury_hosp_1000: "אשפוזים בעקבות פגיעות ילדים"
};
export const shortName = (a) => SHORT[a.id] || a.short || a.label;

// The question "מה השתנה ב… בשנים האחרונות?" for a figure: what follows the "ב", with its own article, so that the sentence agrees whatever the gender or number of the name
// ("תאונות" is plural, "המתנה" feminine, "זמן" masculine): the verb belongs to "מה", never to the name. One phrase per figure of the catalogue (a test keeps the table whole).
export const CHANGE_OF = {
  pop_size: "מספר התושבים", pop_growth: "גידול האוכלוסייה", ses_index: "המדד החברתי-כלכלי",
  pov_persons: "שיעור העוני באוכלוסייה", pov_children: "שיעור העוני בקרב ילדים", pov_elderly: "שיעור העוני בקרב אזרחים ותיקים",
  swd_recipients_1000: "מספר מקבלי שירות הרווחה", swd_children_1000: "מספר הילדים מקבלי שירות הרווחה", swd_violence_1000: "מספר המטופלים בשל אלימות והזנחה",
  road_severe_100k: "תאונות הדרכים הקשות", road_pedestrian_100k: "הפגיעה בהולכי רגל בתאונות דרכים",
  life_expectancy: "תוחלת החיים", mortality_std: "שיעור הפטירות", infant_mortality: "תמותת התינוקות", diabetes_std: "שיעור חולי הסוכרת",
  child_injury_ed_1000: "ביקורי הילדים בחדר מיון בשל פגיעה", child_injury_hosp_1000: "אשפוזי הילדים בשל פגיעה",
  th_mmrv: "החיסון נגד חצבת, חזרת ואדמת", th_penta: "החיסון המחומש", th_pertussis: "החיסון נגד שעלת",
  th_headcirc: "מדידת היקף הראש", th_language: "בדיקת השפה והתקשורת", th_devtests6: "בדיקות ההתפתחות", th_safesleep: "ההדרכה לשינה בטוחה",
  th_bf_exclusive: "ההנקה הבלעדית", th_bf_keep: "המשך ההנקה הבלעדית", th_iron: "מתן תוסף הברזל לתינוקות",
  bmi_g1_over: "משקל העודף בכיתה א׳", bmi_g7_over: "משקל העודף בכיתה ז׳",
  th_ppd: "בדיקת הדיכאון אחרי לידה", depressed_20: "תחושת הדיכאון", lonely_20: "תחושת הבדידות", mental_points_10k: "שירותי בריאות הנפש",
  green_satisfaction: "שביעות הרצון מהשטחים הירוקים", noise_bother: "הרעש החיצוני המפריע בדירה",
  th_violence: "תשאול האימהות על אלימות", th_firstvisit: "הביקור הראשון בטיפת חלב",
  family_doctors_10k: "מספר רופאי המשפחה", pediatricians_10k: "מספר רופאי הילדים", wait_specialist_days: "זמן ההמתנה לרופא מומחה", wait_gyn_days: "זמן ההמתנה לרופא נשים"
};
// "ב" and the article join into one letter ("ב" + "המדד" is "במדד"), so a phrase that starts with the article gives it up.
// A figure that is not in the table (a new one in the catalogue) is named as a measure, which agrees with anything: "מה השתנה במדד {name} בשנים האחרונות?"
export const changeOf = (a) => {
  const p = a && typeof a === "object" ? CHANGE_OF[a.id] : null;
  return p ? "ב" + (p[0] === "ה" ? p.slice(1) : p) : `במדד ${typeof a === "string" ? a : shortName(a)}`;
};

// the "how to read" line under each answer: one quiet sentence, always visible (Part E)
export const HOWTO = {
  weak: "״דורש טיפול״ אומר שהמדד נמצא ברבע התחתון של יישובי הארץ, או רחוק מהיעד הרשמי, או בהידרדרות. זה סימן לבדוק, לא פסק דין. מקומות קרובים בדירוג אינם בהכרח שונים באמת.",
  changed: "מגמה נספרת רק כשיש נתונים לשלוש שנים לפחות והשינוי גדול מהתנודה הרגילה משנה לשנה. שינוי קטן אינו מופיע כשיפור או כהידרדרות.",
  peers: "ההשוואה היא לערך האמצעי של היישובים הדומים ביותר. ״דומה״ נקבע לפי גודל, סוג רשות, אשכול חברתי-כלכלי ושיעור האוכלוסייה הערבית. פער של פחות מ-2% מערך היישובים הדומים נחשב דומה, ומקומות קרובים בדירוג אינם בהכרח שונים באמת.",
  first: "ההמלצה נבחרת מהמדדים החלשים, ממגמות בהידרדרות ומפעולות שהרשות המקומית יכולה להשפיע עליהן. היא מבוססת על ידע מקצועי כללי, ואינה תחליף להכרת השטח.",
  missing: "חסר פירושו שהמקור הרשמי אינו מפרסם נתון על היישוב. זה לא אומר שהמדד תקין או לא תקין."
};

// a town that has no ranking among towns (very small, or without an answer to the comparison; data.js hasNoPeers) gets the definition without the rank
export const HOWTO_NO_RANK = { weak: "״דורש טיפול״ אומר שהמדד רחוק מהיעד הרשמי, או בהידרדרות. זה סימן לבדוק, לא פסק דין." };
export const howtoText = (qid, noRank) => (noRank && HOWTO_NO_RANK[qid]) || HOWTO[qid];

// the words of a recommendation's facts (who, when, how much effort, how strong the evidence): the home and the briefing say them the same way
export const HORIZON = { quick: `מהיר (עד ${iso("6")} חודשים)`, mid: `בינוני (${iso("6–18")} חודשים)`, long: "אסטרטגי (מעל שנה וחצי)" };
export const STRENGTH = { strong: "חזקות", moderate: "בינוניות", limited: "מוגבלות" };
export const EFFORT = { low: "נמוך", medium: "בינוני", high: "גבוה" };

// the first-visit note (J15): the title and three lines, SPEC 7.3. The first line names the sections the page really shows (the town page builds it from the sections it drew:
// a small town has no "what goes well", a very small one no "next to similar towns"), in the order they are on the page.
const SECTION_NAME = { "n-sec-good": "מה הולך טוב", "n-sec-weak": "מה דורש תשומת לב", "n-sec-changed": "מה השתנה", "n-sec-peers": "איך מול יישובים דומים", "n-sec-first": "מה כדאי לעשות", "n-sec-small": "המספרים שיש", "n-sec-missing": "על מה אין מידע" };
export const FULL_SECTIONS = ["n-sec-good", "n-sec-weak", "n-sec-changed", "n-sec-peers", "n-sec-first", "n-sec-missing"];
export const listOf = (names) => (names.length < 2 ? names.join("") : names.slice(0, -1).join(", ") + " ו" + names[names.length - 1]);
export const welcomeLines = (ids = FULL_SECTIONS) => [
  "המשפט הגדול הוא התמונה בקצרה. מתחתיו הסעיפים של הדף, לפי הסדר: " + listOf(ids.filter((id) => SECTION_NAME[id]).map((id) => SECTION_NAME[id])) + ".",
  "ליד כל מספר כתוב אם גבוה טוב או נמוך טוב. צבע לבדו אינו אומר זאת.",
  "מדד שמבוסס על קבוצה קטנה מדי מוצג כמו שהוא, בלי דירוג ובלי שיפוט."
];
export const WELCOME = {
  title: "איך קוראים את העמוד",
  lines: welcomeLines(),
  ok: "הבנתי"
};

// everything else the screen says
export const T = {
  eyebrow: "בריאות היישוב",
  ask: {
    placeholder: (name) => `מה תרצו לדעת על הבריאות ב${name}?`,
    short: (name) => `שאלו על ${name}…`,
    off: (name) => `אין על ${name} נתונים כדי לענות`,
    label: (name) => `שאלה חופשית על הבריאות ב${name}`,
    go: "שאלו",
    goLabel: "שליחת השאלה",
    note: "התשובה מנוסחת בבינה מלאכותית ומבוססת על מספרי המערכת בלבד.",
    empty: (name) => `כתבו שאלה, למשל: איך החיסונים ב${name}?`
  },
  suggest: {
    label: "אפשר לשאול גם",
    // the whole name of the category ("ילדים והורים", "נפש ורווחה"): its short first word is not a sentence ("איך מצב נפש")
    domain: (dom, name) => `איך המצב בתחום ${dom} ב${name}?`,
    // the figure (or, for a caller that has only a name, the name): "מה השתנה בתאונות הדרכים הקשות בשנים האחרונות?"
    trend: (a) => `מה השתנה ${changeOf(a)} בשנים האחרונות?`
  },
  closing: { table: "לטבלה המלאה" },
  block: {
    asIs: "המספרים שיש",
    asIsSub: "אין להם דירוג, מגמה או המלצה, כי הקבוצה קטנה מדי.",
    changes: "השינויים הגדולים ביותר",
    changesSub: "אורך הפס: גודל השינוי ביחס להפרש הרגיל בין יישובים באותו מדד. כך אפשר להשוות ימים, אחוזים ושיעורים. ימינה = השתפר.",
    telling: (name) => `המדד שבו ${name} שונה ביותר מיישובים דומים`,
    near: "היישובים הקרובים בדירוג",
    ladder: "המקום של כל תחום בין היישובים",
    ladderSub: "כל נקודה: המקום הממוצע של מדדי התחום בין יישובי הארץ. ימינה = טוב יותר. הקו האמצעי: חצי מהיישובים טובים יותר וחצי פחות.",
    peerList: "היישובים שאליהם משווים",
    cover: (total) => `כל ${total} המדדים`,
    coverSub: "ריבוע אחד לכל מדד: מלא = נמצא נתון, ריק = קבוצה קטנה מדי, מקווקו = לא נמצא.",
    missingWhy: "מה חסר, ולמה",
    smallHere: "נמצא, אבל בקבוצה קטנה מדי"
  },
  nodata: {
    weak: (name) => `אין נתונים רשמיים על ${name}.`,
    changed: (name) => `אין היסטוריה: אין נתונים רשמיים על ${name}.`,
    peers: (name) => `אי אפשר להשוות ליישובים דומים: אין נתונים רשמיים על ${name}.`,
    first: (name) => `אין המלצה: אין נתונים רשמיים על ${name}.`,
    missing: (name) => `אין נתונים רשמיים על ${name}.`,
    text: (name, parent) => `המקורות הרשמיים אינם מפרסמים נתונים על ${name} כיישוב נפרד.` + (parent ? " ייתכן שהנתונים כלולים במועצה האזורית או ברשות שבתחומה היישוב." : ""),
    basis: "אין נתונים רשמיים על היישוב",
    coverage: "כיסוי נתונים",
    other: "חיפוש יישוב אחר"
  },
  loadErr: { cover: "רשימת המדדים לא נטענה. נסו לרענן, או פתחו את הטבלה המלאה.", rank: "הדירוג של המדד הזה לא נטען.", retry: "נסו שוב" },
  statement: "התמונה כאן מכוונת לשאלות ולתעדוף, לא לציון או לדירוג של היישוב.",
  ledgerHead: (n) => `המדדים לפי מצב (${n} עם נתונים)`,
  survey: "נתון זה מגיע מסקר מדגמי ולכן קיים רק ליישובים גדולים.",
  collector: (publisher) => `מי אוסף את הנתון: ${publisher}. אפשר לפנות אליהם ולבקש נתון לפי יישוב.`
};

// words a person must not meet on a screen (SPEC 7.1); product-copy.test.mjs scans the strings of city/ for them
export const FORBIDDEN = ["פרמטר", "מדאיג", "אחוזון", "מובהק", "המודל", "אנחנו", "לנו", "בסיס קטן", "{{"];
