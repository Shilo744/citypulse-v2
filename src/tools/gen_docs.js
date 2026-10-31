"use strict";
// Writes docs/INDICATORS.md and docs/METHOD.md from the catalog and from the constants the code really uses,
// so the documentation cannot drift away from the behaviour.   node src/tools/gen_docs.js
const fs = require("fs");
const path = require("path");
const { indicators } = require("../catalog/indicators");
const domains = require("../catalog/domains");
const sources = require("../catalog/sources");
const evidence = require("../catalog/evidence.json");
const interventions = require("../catalog/interventions");
const { RULES } = require("../model/analyze");
const { REC_RULES: Q } = require("../model/recommend");
const { staticGuide } = require("../model/guide");

const DOCS = path.join(__dirname, "..", "..", "docs");
const plain = (t) => String(t).replace(/[⁦⁩]/g, "");
const dirWord = { higher: "גבוה = טוב", lower: "נמוך = טוב" };
const STRENGTH = { strong: "חזקה", moderate: "בינונית", limited: "מוגבלת" };

// the official guideline and the reference figure of an indicator, with the source, or the words "אין יעד רשמי"
const SCOPE = { national: "יעד לאומי", international: "בין-לאומי" };
function guideLine(i) {
  const g = staticGuide(i, i.guideline);
  if (!g) return "- יעד רשמי: אין יעד רשמי (נבדק, ראו `research/GUIDELINES.md`)";
  const yearly = g.yearly ? "; הערך נקרא משנה לשנה מהנתונים הפתוחים" : "";
  const use = g.judges ? "משמש לשיפוט הסטטוס" : "מוצג להקשר ואינו משמש לשיפוט";
  return `- יעד רשמי: ${plain(g.text)} (${g.year}, ${SCOPE[g.scope]}; [${g.source.publisher}, ${g.source.title}](${g.source.url})${yearly}). ${use}. ${g.caveat}`;
}
function benchLine(i) {
  const b = staticGuide(i, i.benchmark);
  return b ? `- נקודת ייחוס בין-לאומית: ${plain(b.text)} (${b.year}; [${b.source.publisher}, ${b.source.title}](${b.source.url})). הקשר בלבד, לא משפיע על הסטטוס ולא על הדירוג. ${b.caveat}` : null;
}

function indicatorsDoc() {
  const out = ["# קטלוג המדדים", "", "נוצר אוטומטית מ-`src/catalog/indicators.js` ומ-`src/catalog/evidence.json` (`npm run docs`). אין לערוך ידנית.", ""];
  out.push(`סה"כ ${indicators.length} מדדים פעילים ב-${new Set(indicators.map((i) => i.domain)).size} תחומים.`, "");
  for (const d of domains) {
    const list = indicators.filter((i) => i.domain === d.id);
    if (!list.length) continue;
    out.push(`## ${d.label}`, "", d.blurb || "", "");
    for (const i of list) {
      const ev = i.evidence && evidence.parameters[i.evidence];
      const t = ev && ev.target && ev.target.by_year;
      out.push(`### ${i.label}`, "", `- מזהה: \`${i.id}\``, `- כיוון: ${dirWord[i.direction] || "תיאורי"} · חשיבות ${i.importance} מתוך 5 · גודל מינימלי לדירוג: ${i.minBase}${i.noun ? " " + i.noun : ""}`,
        `- מקור: ${sources[i.source].publisher}, ${sources[i.source].name}`,
        `- הגדרה: ${i.definition}`, `- למה זה חשוב: ${i.why}`, `- מה צריך לדעת לפני שמפרשים: ${i.caution}`);
      out.push(guideLine(i)); const bl = benchLine(i); if (bl) out.push(bl);
      if (t && Object.keys(t).length) out.push(`- יעד משרד הבריאות לפי שנה: ${Object.entries(t).map(([y, v]) => `${y}: ${v}%`).join(", ")}`);
      out.push("");
    }
  }
  return out.join("\n");
}

function methodDoc() {
  const o = [];
  o.push("# שיטה", "", "נוצר אוטומטית מהקבועים שבקוד (`npm run docs`).", "");
  o.push("## עקרון על", "", "כל מספר שמוצג נשלף מנתוני מקור ומחושב בקוד. מודל שפה (אם הוגדר) בוחר איזה דף להציג ומנסח משפטים, אבל כל מספר במשפט שלו חייב להגיע מ-token שהשרת מחליף מהנתונים (`{{v:ID}}` וכדומה). טקסט שהמודל הקליד בו ספרה, או מילה באנגלית, נפסל (`src/agent/guard.js`).", "",
    "יש שני תפקידים למודלים: חיפוש וסינון (מודל קטן ומהיר, למשל איתור מערכי נתונים ב-data.gov.il) ומסקנות (מודל חזק: תוכנית דף התשובה, התשובה ותקציר המנהלים של היישוב). תקציר המנהלים נכתב לפי בקשה, עובר את אותה בדיקה, ונשמר עד שהנתונים נבנים מחדש. הקריאות מוגבלות לפי היתרה במפתח ולפי מספר הקריאות בשעה, ובלי מודל המערכת עונה לפי מילות מפתח.", "");
  o.push("## סטטוס של מדד", "",
    `- **דורש טיפול**: אחוזון מתחת ל-${RULES.concernLevel} בין הישובים (אלא אם המדד עומד ביעד הרשמי ואינו בהידרדרות), או רחוק מהיעד הרשמי (יותר מ-${RULES.farBelowTarget} נקודות מתחת ליעד באחוזים; ביחידה אחרת, כמו שיעור ל-100,000 או ימים, יותר מ-${Math.round(RULES.targetFarRel * 100)}% מערך היעד), או אחוזון מתחת ל-${RULES.concernWorseningLevel} יחד עם הידרדרות.`,
    `- **חוזק**: אחוזון ${RULES.strengthLevel} ומעלה, בלי להחמיץ יעד רשמי (כשיש) ובלי הידרדרות.`,
    `- **תקין**: אחוזון ${RULES.goodLevel} ומעלה, בקרבת היעד הרשמי (עד ${RULES.nearTarget} נקודות מתחת ליעד באחוזים; ביחידה אחרת עד ${Math.round(RULES.targetNearRel * 100)}% מערך היעד), בלי הידרדרות. מדד שעומד ביעד הרשמי ואינו בהידרדרות הוא תקין לכל הפחות, גם כשמקומו בין הישובים נמוך מהחציון; חוזק דורש גם אחוזון ${RULES.strengthLevel} ומעלה.`,
    "- **למעקב**: כל השאר.", "- **בסיס קטן**: הקבוצה קטנה מהסף של המדד. המספר מוצג כפי שהוא, אבל אין לו דירוג, מגמה, עדיפות, ממצא או המלצה.", "- **נתון ישן**: הנתון האחרון ישן בשנתיים ומעלה מהנתונים העדכניים ביותר; מוצג אך אינו משפיע על ממצאים והמלצות.", "");
  const withBar = indicators.filter((i) => i.guideline && staticGuide(i, i.guideline).judges), loose = indicators.filter((i) => i.guideline && !staticGuide(i, i.guideline).judges), withBench = indicators.filter((i) => i.benchmark);
  o.push("## יעדים רשמיים ונקודות ייחוס", "",
    "הדירוג בין הישובים וההשוואה לממוצע הארצי אומרים איפה היישוב ביחס לאחרים, לא אם המצב טוב בפני עצמו. לכן לכל מדד נבדק אם יש יעד או הנחיה רשמית עם מקור (משרד הבריאות ועוד). מופיע רק מה שנפתח, נקרא ואומת (`research/guidelines.json`, `research/GUIDELINES.md`); מה שלא אומת אינו משמש, ומדד בלי הנחיה מאומתת אומר \"אין יעד רשמי\".", "",
    `- **יעד ששופט** (${withBar.length} מדדים): יעד רשמי שמודד את אותו דבר באותה יחידה, והסטטוס משתמש בו לפי הכללים למעלה. כולם יעדי התוכנית הלאומית למדדי איכות של משרד הבריאות לנותני שירות. הערך נקרא משנה לשנה מהנתונים הפתוחים (הנתונים קודמים), ושנה בלי יעד נשארת בלי יעד. החלת יעד של נותן שירות על יישוב היא הרחבה, והמסך אומר זאת.`,
    `- **יעד שמוצג ואינו שופט** (${loose.length} מדדים): יעד רשמי שמודד דבר קרוב ולא זהה (יעד עולמי לגיל אחר, או הפחתה ארצית באחוזים). מוצג עם ההסתייגות שלו, בלי השפעה על הסטטוס.`,
    `- **נקודת ייחוס בין-לאומית** (${withBench.length} מדדים): ממוצע של מדינות אחרות, לא יעד. מוצגת להקשר בלבד ואינה משפיעה על סטטוס, דירוג או המלצה.`,
    "- **פער מהיעד**: חיובי = טוב מהיעד, ביחידה של המדד (נקודות לאחוזים), ובנוסף כשיעור מערך היעד. מדד על מעט מקרים, או מדד שרק מתאר, אינו מושווה ליעד.",
    `- **בלי יעד רשמי מאומת** (${indicators.length - withBar.length - loose.length} מדדים): נשפטים לפי הדירוג בין הישובים והמגמה בלבד. הרשימה בקובץ \`research/GUIDELINES.md\`.`, "");
  o.push("## מגמה", "", `לפחות שלוש שנים. שיפוע לפי Theil-Sen (חציון השיפועים בין כל זוגות השנים), כך שחריגה של שנה אחת לא מעוותת אותו. נחשב כמגמה רק אם הקצב לפחות ${RULES.trendSlope} נקודות בשנה והשינוי הכולל לפחות ${RULES.trendMove} נקודות.`, "");
  o.push("## פערים בתוך היישוב", "", `לפי מגזר ולפי הרמה החברתית-כלכלית של האזור. קבוצה נכללת אם יש בה לפחות ${RULES.splitMin} איש ולפחות ${Math.round(RULES.splitShare * 100)}% מהיישוב. פער נחשב אם הוא ${RULES.equityGap} נקודות ומעלה והוא מובהק (z ≥ ${RULES.equityZ}, מבחן הפרש בין שני שיעורים).`, "");
  o.push("## ישובים דומים", "", "המרחק בין ישובים: הפרש לוגריתמי בגודל האוכלוסייה, ועוד קנסות על סוג רשות שונה, פער באשכול החברתי-כלכלי, פער בשיעור האוכלוסייה הערבית, ובונוס קטן לאותו מחוז. 12 הישובים הקרובים ביותר שיש בהם לפחות ארבע שנות נתונים.", "");
  o.push("## המלצות", "",
    "המלצה נוצרת רק כשיש ממצאים של היישוב שמפעילים אותה (`src/catalog/interventions.js`). כל המלצה כוללת: למה (הממצאים עם המספרים), איך הגענו לכאן (היסטוריה ותחזית), מה עושים, יעד למדידה, אחראי וראיות.", "",
    `- **עדיפות**: חומרת הממצא החזק ביותר + ${Math.round(Q.otherWeight * 100)}% מחומרת האחרים (עד ${Q.otherCap} נקודות), מוכפל בגורם ראיות (חזקות ${Q.evidenceFactor.strong}, בינוניות ${Q.evidenceFactor.moderate}, מוגבלות ${Q.evidenceFactor.limited}, ללא ${Q.evidenceFactor.none}) ובגורם מאמץ (נמוך ${Q.effortFactor.low}, בינוני ${Q.effortFactor.medium}, גבוה ${Q.effortFactor.high}). המלצת שימור לא עולה על ${Q.strengthCap}.`,
    `- **יעד**: חצי מהפער לנקודת ההשוואה (היעד הרשמי, ואם אין, הגבוה מבין הממוצע הארצי וחציון הישובים הדומים), בין ${Q.kpiStepMin} ל-${Q.kpiStepMax} נקודות, שנתיים קדימה (בתוכנית שהראיות מדווחות עליה שיפור קטן: בין ${Q.kpiStepSmall[0]} ל-${Q.kpiStepSmall[1]} נקודות).`,
    `- **בדיקת נתונים קודם**: רק כשהמדד רחוק ${Q.outlierGap} נקודות לפחות מהממוצע הארצי ובתחתית ${Q.outlierLevel}% מהישובים, או כשגודל הקבוצה השתנה בחדות.`,
    `- **ישוב ללמוד ממנו**: ישוב דומה שטוב ב-${Q.peerEdge} נקודות לפחות.`, "");
  o.push("### ספריית הפעולות", "", "| המלצה | אופק | מאמץ | עוצמת ראיות | מקורות |", "|---|---|---|---|---|");
  for (const e of interventions) {
    const links = (e.evidence || []).map((id) => evidence.interventions[id]).filter(Boolean).map((x) => `[${x.id}](${x.url})`).join(", ") || "אין";
    o.push(`| ${e.title} | ${{ quick: "מהיר", mid: "בינוני", long: "אסטרטגי" }[e.horizon]} | ${{ low: "נמוך", medium: "בינוני", high: "גבוה" }[e.effort]} | ${STRENGTH[e.evidenceStrength] || "ללא (המלצה ניהולית)"} | ${links} |`);
  }
  o.push("", "## כללי פרשנות", "", "נאספו על ידי סוכן הראיות. חלקם מבוססים על דוח משרד הבריאות ועל הנתונים עצמם, חלקם על כללים מתודולוגיים כלליים.", "");
  for (const r of Object.values(evidence.rules)) o.push(`- ${plain(r.text)}${r.url ? ` ([מקור](${r.url}))` : ""}`);
  o.push("", "## מגבלות", "",
    "- הנתונים מתארים שירות שנרשם בתחנות טיפת חלב, לפי יישוב התחנה ולא לפי מקום המגורים.",
    "- הממוצע הארצי אינו יעד. יעד בין-לאומי אינו יעד ישראלי.",
    "- שנים 2020-2021 (קורונה) ו-2023-2024 (מלחמה) עשויות להשפיע על השירות ועל הדיווח.",
    "- פער בין קבוצות אינו מסביר את הסיבה, ואין לייחס גורם בלי בדיקה מקומית.",
    "- ההמלצות הן נקודת פתיחה לדיון עם הצוות המקצועי, לא תחליף להחלטה מקצועית.", "");
  return o.join("\n");
}

function main() {
  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(path.join(DOCS, "INDICATORS.md"), indicatorsDoc());
  fs.writeFileSync(path.join(DOCS, "METHOD.md"), methodDoc());
  console.log("docs: INDICATORS.md, METHOD.md");
}
if (require.main === module) main();
module.exports = { main };
