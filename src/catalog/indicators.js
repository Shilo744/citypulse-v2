"use strict";
/**
 * THE PARAMETER CATALOG - what CityPulse V2 measures, why, and where each figure comes from.
 * One entry per parameter. Everything else (collectors, analysis, screens, recommendations) reads this file.
 *
 *   id          stable key used in the data store, the API and the recommendation rules
 *   domain      one of catalog/domains.js
 *   label       the name shown to a mayor; short = for tight spaces
 *   unit        "%" | "per1000" | "per10k" | "count" | "index" | "ils" | "years" | "score"
 *   direction   "higher" = higher is better, "lower" = lower is better, null = describes, does not judge
 *   importance  1-5, how decision-relevant it is; used to rank priorities
 *   kind        "rate" = numerator / denominator (a share of a group), "level" = a single figure per locality-year
 *   minBase     smallest group size for a rate to be ranked / trusted (smaller -> flagged "small numbers")
 *   source      key in catalog/sources.js
 *   collect     how the collector fetches it (see src/collect)
 *   noun, done  how the group is named in a sentence: "812 מתוך 874 {noun} {done}"
 *   evidence    id of the parameter in catalog/evidence.json (official target per year, source pages, interventions)
 *   caution     what a reader must know before judging a figure
 *   guideline   the official target of the indicator, when a verified one exists (see GUIDELINES below and research/guidelines.json):
 *               { kind, value, unit, direction: "atLeast"|"atMost", year, scope, source (id in sources.js), where, caveat, judges }
 *               judges = true only when it measures the same thing in the same unit, so the status may compare the figure with it
 *   benchmark   an international reference figure shown as context, never used for a status (same shape)
 *
 * The definitions of the tipat-halav measures follow the Ministry of Health report "התוכנית הלאומית למדדי איכות 2013-2024"
 * (read by the evidence scout), which differs in places from the short titles of the open datasets.
 */

const TH_COLLECT = (resource) => ({
  type: "ckan_rate", resource,
  cityField: "station_city", yearField: "measurement_year", numField: "number_of_cases_approved", denField: "number_of_cases",
  targetField: "target", sectorField: "sector", sesField: "Socio Economic Group"
});

const TH_CAUTION = "המדד נמדד רק בקרב משפחות שמטופלות בתחנות טיפת חלב. שיעור נמוך עשוי לשקף גם שירות שניתן מחוץ לתחנה (קופה, רופא פרטי) שלא תועד.";

// poverty by locality: Annex 8 of the National Insurance poverty report (localities above 5,000 residents), national figure from Annex 2
const BTL_POVERTY = (valueCol, natCol) => ({
  type: "xlsx_table",
  files: [2024, 2023, 2022].map((y) => ({ year: y, url: `https://www.btl.gov.il/Publications/oni_report/Documents/luhot${y}.xlsx`, sheet: "נספח 8", firstRow: 4, nameCol: 0, valueCol,
    nat: { sheet: "נספח 2", label: "כלל האוכלוסייה", col: natCol } }))
});
// road accidents with casualties (CBS, one resource per year): accidents per 100,000 residents, 3-year average
const ROAD_RESOURCES = { 2018: "97d37f19-ddf3-4767-a1d9-440dd5b49514", 2019: "68d4d598-ddd4-4557-b9cb-b0976c60fa78", 2020: "70a93f04-2ffe-4b02-a062-a818600a5b67",
  2021: "6957e7c2-6d68-4332-bbc8-2ee8d5ba6bd6", 2022: "ede3f02a-f9aa-4a6f-9eca-4c11a06f0043", 2023: "ae0f1679-139f-4e69-a869-a60d5d76518b", 2024: "05d14adb-fe54-49f7-b7ce-f30348e2d959" };
const ROAD = (where) => ({ type: "ckan_events", resources: ROAD_RESOURCES, codeField: "SEMEL_YISHUV", yearField: "SHNAT_TEUNA", fields: ["SEMEL_YISHUV", "SHNAT_TEUNA", "HUMRAT_TEUNA", "SUG_TEUNA"], where, per: 100000, window: 3 });
const ROAD_CAUTION = "היישוב הוא מקום התאונה ולא מקום מגורי הנפגעים. חומרת התאונה נקבעת לפי הנפגע החמור ביותר בה. הנתון הוא ממוצע של שלוש שנים לכל 100,000 תושבים, כי ביישוב בינוני יש מעט תאונות קשות בשנה והשיעור קופץ משנה לשנה. ספירה של תאונות ולא של נפגעים. ערים שמושכות הרבה מבקרים ועובדים שאינם תושבים (כמו תל אביב) נראות גרועות יותר ממה שהן עבור תושביהן, כי המכנה הוא התושבים בלבד. אין יעד רשמי לשיעור ביישוב בודד.";

// health outcomes from the CBS "local authorities" workbooks, 2016-2024: every figure is a window of years that ends in the year shown
const LA_BASE = "https://www.cbs.gov.il/he/publications/DocLib/2019/hamakomiot1999_2017/";
const LA_FILES = ["2016.xlsx", "2017.xlsx", "2018.xlsx", "2019.xlsx", "2020.xlsx", "p_libud_2021.xlsx", "p_libud_22.xlsx", "p_libud_23.xlsx", "p_libud_24.xlsx"].map((f) => LA_BASE + f);
const LA = (match, extra) => ({ type: "xlsx_panel", urls: LA_FILES, match, ...extra });
const LA_CAUTION = "הנתון של הלמ״ס לפי מקום המגורים הרשום. הערך של שנה הוא ממוצע של חלון שנים שמסתיים באותה שנה, ולכן הוא משתנה לאט ושנים סמוכות חופפות. החלונות המאוחרים כוללים את שנות הקורונה (2020-2021) ואת שנות המלחמה (מ-2023). הנתון מתאר תוצאה ואינו מראה מה גרם לה: הוא מושפע מאוד מהרכב האוכלוסייה ומהמצב החברתי-כלכלי, ולכן כדאי להשוות ליישובים דומים.";

// child injury (Ministry of Health data dashboard): emergency-department visits and hospitalisations per 1,000 children
const CHILD_INJURY = (measureCode, window) => ({ type: "json_table", url: "https://datadashboard.health.gov.il/api/child-injury/authorities", nameField: "settlement", yearField: "year",
  valueField: "populationRate", countField: "total", per: 1000, where: { measureCode }, window, minPopulation: 5000 });
const CHILD_INJURY_CAUTION = "הספירה היא של ביקורי מיון ואשפוזים שתועדו בבתי חולים, והמכנה הוא אוכלוסיית הילדים של היישוב. הנתונים שנפתחו אינם מפרטים אם היישוב הוא מקום המגורים או מקום הטיפול, ולכן קרבה לבית חולים והרגלי פנייה למיון משפיעים על המספר ולא רק הסיכון עצמו. שנת 2020 כוללת את השפעת הסגרים של הקורונה. בטבלה אין נתון ארצי, ולכן ההשוואה היא ליישובים דומים ולכלל היישובים. נכללים רק יישובים של 5,000 תושבים ומעלה. לא נמצאה בחבילת הראיות התערבות ייעודית לפגיעות ילדים בכלל (פגיעות בדרכים כלולות בתוכנית הבטיחות בדרכים), ולכן אין המלצת פעולה אוטומטית. כדאי לבקש מלשכת הבריאות פילוח לפי סוג פגיעה (נפילות, כוויות, הרעלות, טביעה).";

// welfare department caseload (Ministry of Welfare "intervention file"), per 1,000 residents
const SWD_RESOURCES = { 2021: "eb0dbb8a-006e-42a3-96fd-b44d568d1217", 2022: "3167c2d0-8542-4af7-9de4-784cc27f9a02", 2023: "c64c313a-76fe-4c7e-9d51-a9ef804f057d",
  2024: "3b5313f3-af65-4c77-8a2a-4dacb1cd368e", 2025: "67ab0fcc-7a97-453f-993f-285f45a550a0" };
const SWD = (fields) => ({ type: "ckan_authority", resources: SWD_RESOURCES, codeField: "סמל רשות", fields, per: 1000 });
const SWD_CAUTION = "המדד משקף גם את היקף הצורך וגם את היכולת של המחלקה לשירותים חברתיים לאתר ולטפל, ולכן מספר גבוה אינו בהכרח רע ומספר נמוך אינו בהכרח טוב. נכלל רק ביישובים שהם עיריות ומועצות מקומיות. ספירות של 10 ומטה מוסתרות. בשנים של פינוי או חירום (שדרות, 2023-2025) העלייה משקפת גם את המצב המיוחד.";

const POVERTY_WHY = "עוני קשור לפערי בריאות בכל העולם, ולכן הוא ההקשר שבו כדאי לקרוא את שאר המדדים של היישוב ולתכנן שירותים לאוכלוסייה שזקוקה להם.";
const POVERTY_CAUTION = "מחושב רק ליישובים של יותר מ-5,000 תושבים, על בסיס הכנסה נטו לנפש תקנית. ביישובים שפונו במלחמה (למשל שדרות) ירידת העוני ב-2023-2024 משקפת ככל הנראה תשלומי פינוי ופיצויים שנספרו כהכנסה, ולא ירידה בצורך. יישובים קטנים נושאים רעש סטטיסטי גדול יותר.";

// school health checkups (Ministry of Health): share of pupils with overweight or obesity in a grade, 3-year mean of the school-year figures
const BMI_CATEGORIES = ["השמנה", "עודף משקל"];
const BMI = (grade) => ({
  type: "arcgis_table", url: "https://services5.arcgis.com/dlrDjz89gx9qyfev/arcgis/rest/services/Growth_Indexes_in_Shools_Obesity/FeatureServer/2",
  codeField: "municipal_code", yearField: "year", valueField: "population_rate_txt", where: { class_desc: grade }, sum: { field: "variable_desc", values: BMI_CATEGORIES },
  window: 3, fromYear: 2013, minPopulation: 5000,
  nat: { url: "https://datadashboard.health.gov.il/api/checkup/checkupMunicipalObesity", nameField: "settlement", yearField: "year", valueField: "populationRate", where: { class: grade }, sum: { field: "measure", values: BMI_CATEGORIES } }
});
const BMI_CAUTION = "הנתונים הם של בדיקות בית הספר של שירות בריאות התלמיד (אחיות בריאות הציבור) ומתפרסמים כאחוז מהנבדקים ביישוב, בלי מספר הילדים, ולכן אי אפשר לדעת על כמה ילדים השיעור מבוסס. ביישוב קטן כיתה אחת משנה את השיעור בכמה נקודות, ולכן הנתון הוא ממוצע של שלוש שנות לימודים ונכללים רק יישובים של 5,000 תושבים ומעלה. השנה היא שנת סיום שנת הלימודים (2025 = תשפ״ה). ביישובים שפונו במלחמה (למשל שדרות, 2023-2025) הרכב התלמידים הנבדקים עשוי להשתנות, ולכן שינויים בתקופה הזו דורשים זהירות. אין יעד ישראלי ליישוב. יעד Healthy People 2030 האמריקאי (15.5% השמנה בגילי 2-19) מתייחס להגדרה ולאוכלוסייה אחרות ואינו ישים להשוואה ישירה.";

// providers registered in the Ministry of Health health-services layer, each counted once, per 10,000 residents (a snapshot: August 2026)
const REGISTRY = (match, distinct, like, minPopulation = 5000) => ({
  type: "arcgis_registry", url: "https://services5.arcgis.com/dlrDjz89gx9qyfev/arcgis/rest/services/HMO_Services2/FeatureServer/6", codeField: "city_code", dateField: "validity_date",
  fields: ["city_code", "services_type_desc", "expertise_desc", "name", "address", "validity_date"], match, like, distinct, per: 10000, minPopulation
});
const REGISTRY_CAUTION = "הנתון מבוסס על רישום נותני שירות במשרד הבריאות (תמונת מצב של אוגוסט 2026) ולא על מי שמקבל את השירות בפועל. תושבי יישוב קטן או פרבר משתמשים בשירותים של יישוב סמוך (בשדרות, למשל, חלק מהשירותים נמצאים באשקלון ובבאר שבע), ולכן ערך נמוך אינו בהכרח חוסר נגישות, וערך גבוה בעיר אזורית משקף גם שירות לתושבי הסביבה. נותן שירות נספר לפי השם כפי שהוא רשום, ונותן שירות שפועל בכמה יישובים נספר בכל אחד. הרישום כולל גם שירותים פרטיים ושירותי שב״ן שבהסכם עם הקופות, ואינו מציין היקף משרה או שעות קבלה, ולכן אי אפשר לדעת אם נותן שירות ברישום עובד משרה מלאה או כמה שעות בשבוע. יש תמונת מצב אחת בלבד, ולכן אין מגמה; כל רענון מוסיף שנה.";

// waiting time for a specialist in the community (Ministry of Health): mean days to the next free non-urgent appointment, averaged over the five most common specialties
const WAIT = (categories) => ({
  type: "arcgis_quarterly", url: "https://services5.arcgis.com/dlrDjz89gx9qyfev/arcgis/rest/services/LinWaitingReduction/FeatureServer/1", codeField: "sett_code",
  periodField: "period_time_desc", firstYear: 2019, categoryField: "profession", categories, valueField: "average", minQuarters: 2,
  nat: { url: "https://services5.arcgis.com/dlrDjz89gx9qyfev/arcgis/rest/services/waiting_time_country/FeatureServer/0", periodField: "period_time_desc", categoryField: "profession", valueField: "mean" }
});
const WAIT_COMMON5 = ["אורתופדיה", "נשים", "א.א.ג.", "עיניים", "עור"];

// CBS "quality of life in the large cities" (Social Survey): share of adults 20+ in each of the 17 largest cities, annual
const CBS_CITY = (theme, indicator) => ({ type: "cbs_series", path: "45,3", theme, indicator, unit: 16, fromYear: 2015 });
const CBS_SURVEY_CAUTION = "הנתון מבוסס על הסקר החברתי של הלמ״ס, שהוא סקר מדגמי. ברמת עיר המדגם קטן, ולכן בכל נתון יש טעות דגימה שאינה מפורסמת בטבלה, ופערים של כמה נקודות אחוז בין ערים או בין שנים אינם בהכרח אמיתיים. הנתון קיים רק לערים הגדולות שהלמ״ס מפרסמת (עד 17 ערים), ולכן לרוב היישובים אין נתון. המדד מתאר ואינו שופט: לא נקבע לו כיוון טוב או רע ולא יעד.";

const indicators = [
  // ── הקשר חברתי-כלכלי ──────────────────────────────────────────────────────
  { id: "pop_size", domain: "context", label: "תושבי היישוב", short: "תושבים",
    unit: "count", direction: null, decimals: 0, importance: 3, kind: "level", minBase: 0, source: "cbs_localities", collect: { type: "master", compute: "population", years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] }, evidence: "population_size",
    definition: "מספר התושבים הישראלים ביישוב בסוף השנה, לפי הלמ״ס (ללא תושבים זרים).",
    why: "גודל היישוב קובע את גודל הקבוצות שעליהן מחושבים השיעורים ואת היקף השירותים הנדרש. ביישוב קטן שיעורים קופצים משנה לשנה.",
    caution: "הסדרה היא של תושבים ישראלים ולא כוללת זרים, ולכן היא קטנה במעט מהאוכלוסייה הכוללת ביישובים עם מהגרי עבודה רבים." },
  { id: "pop_growth", domain: "context", label: "גידול האוכלוסייה ב-5 השנים האחרונות", short: "גידול אוכלוסייה",
    unit: "%", direction: null, decimals: 1, importance: 3, kind: "level", minBase: 0, source: "cbs_localities", collect: { type: "master", compute: "growth", years: [2022, 2023, 2024], span: 5 },
    definition: "השינוי באחוזים באוכלוסייה הישראלית של היישוב לעומת חמש שנים קודם.",
    why: "יישוב שגדל מהר צריך להרחיב תחנות, גנים ושירותי רווחה בקצב שלו. גידול מהיר בלי הרחבת שירותים מתבטא בהמשך בפערים במדדי בריאות הילד.",
    caution: "יישובים עם פחות מ-500 תושבים בשנת ההשוואה אינם מחושבים. קליטת מפונים, בנייה חדשה ושינויי גבולות יוצרים קפיצות." },
  { id: "ses_index", domain: "context", label: "המדד החברתי-כלכלי של הלמ״ס", short: "מדד חברתי-כלכלי",
    unit: "index", direction: null, decimals: 2, importance: 3, kind: "level", minBase: 0, source: "cbs_localities", collect: { type: "master", compute: "ses_index", years: [2021] }, evidence: "socioeconomic_cluster",
    definition: "מדד חברתי-כלכלי של הלמ״ס לשנת 2021 (ממוצע 0 בקירוב; ערך גבוה = מצב חברתי-כלכלי טוב יותר). האשכול הוא הדירוג ל-10 קבוצות.",
    why: "המדד מרכז הכנסה, השכלה, תעסוקה ותנאי מגורים. הוא הבסיס להשוואה הוגנת בין יישובים: יישוב צריך להיבחן מול יישובים ברמה דומה.",
    caution: "מדד של שנה אחת (2021). מדד חדש מתפרסם אחת לכמה שנים." },
  { id: "pov_persons", domain: "context", label: "תחולת העוני בקרב נפשות", short: "עוני: נפשות",
    unit: "%", direction: null, decimals: 1, importance: 3, kind: "level", minBase: 0, source: "btl_poverty", collect: BTL_POVERTY(2, 4), evidence: "poverty_rate",
    definition: "אחוז הנפשות ביישוב שההכנסה נטו שלהן (אחרי מיסים וקצבאות) נמוכה מקו העוני, שהוא 50% מההכנסה החציונית לנפש תקנית.",
    why: POVERTY_WHY, caution: POVERTY_CAUTION },
  { id: "pov_children", domain: "context", label: "תחולת העוני בקרב ילדים", short: "עוני: ילדים",
    unit: "%", direction: null, decimals: 1, importance: 3, kind: "level", minBase: 0, source: "btl_poverty", collect: BTL_POVERTY(3, 5),
    definition: "אחוז הילדים ביישוב שחיים במשפחה שהכנסתה נטו נמוכה מקו העוני.",
    why: "עוני ילדים הוא הקשר הישיר ביותר לבריאות הילד ולשירותי הרווחה. " + POVERTY_WHY, caution: POVERTY_CAUTION },
  { id: "pov_elderly", domain: "context", label: "תחולת העוני בקרב אזרחים ותיקים", short: "עוני: ותיקים",
    unit: "%", direction: null, decimals: 1, importance: 3, kind: "level", minBase: 0, source: "btl_poverty", collect: BTL_POVERTY(4, 6),
    definition: "אחוז האזרחים הוותיקים ביישוב שהכנסתם נטו נמוכה מקו העוני.",
    why: "עוני בגיל מבוגר מגדיל את הצורך בשירותי רווחה וסיעוד. " + POVERTY_WHY, caution: POVERTY_CAUTION },

  // ── רווחה ──────────────────────────────────────────────────────────────────
  { id: "swd_recipients_1000", domain: "welfare", label: "מקבלי שירות במחלקה לשירותים חברתיים", short: "מקבלי שירות רווחה",
    unit: "per1000", direction: null, decimals: 1, importance: 3, kind: "level", minBase: 5000, source: "molsa_intervention_files", collect: SWD(["מספר מקבלי שירות"]),
    definition: "מספר הפרטים שקיבלו שירות במחלקה לשירותים חברתיים של הרשות בשנה, לכל 1,000 תושבים.",
    why: "מראה את היקף העבודה של מחלקת הרווחה ברשות המקומית ביחס לגודל היישוב. זה ההקשר לכל מדד אחר בתחום האלימות והמצוקה.", caution: SWD_CAUTION },
  { id: "swd_children_1000", domain: "welfare", label: "ילדים ובני נוער (0-17) המקבלים שירות רווחה", short: "ילדים מקבלי שירות",
    unit: "per1000", direction: null, decimals: 1, importance: 3, kind: "level", minBase: 5000, source: "molsa_intervention_files", collect: SWD(["0-17", "17"]),
    definition: "מספר המקבלים שירות במחלקה לשירותים חברתיים בגילי 0-17, לכל 1,000 תושבים (מכל הגילים).",
    why: "ילדים שמטופלים ברווחה הם בדרך כלל ילדים במצוקה. מדד ההקשר הזה עוזר לקרוא את מדדי בריאות הילד והאלימות.", caution: SWD_CAUTION + " המכנה הוא כלל התושבים ולא רק ילדים." },
  { id: "swd_violence_1000", domain: "welfare", label: "מטופלים בשל אלימות, ניצול והזנחה", short: "אלימות והזנחה ברווחה",
    unit: "per1000", direction: null, decimals: 1, importance: 4, kind: "level", minBase: 5000, source: "molsa_intervention_files", collect: SWD(["אלימות, ניצול והזנחה"]),
    definition: "מספר המקבלים שירות שסוג הנזקקות שלהם הוא אלימות, ניצול והזנחה (כולל ילדים בסיכון), לכל 1,000 תושבים.",
    why: "המקור הפתוח היחיד ברמת הרשות שמתאר אלימות והזנחה שאותרו. הוא משלים את מדד תשאול הנשים בטיפת חלב.", caution: SWD_CAUTION + " הנתון מבוסס על מקרים שאותרו ולא על שכיחות אמיתית." },

  // ── בטיחות ופציעות ────────────────────────────────────────────────────────
  { id: "road_severe_100k", domain: "safety", label: "תאונות דרכים קטלניות וקשות", short: "תאונות קשות",
    unit: "per100k", direction: "lower", decimals: 1, importance: 4, kind: "level", minBase: 8000, source: "cbs_road_accidents", collect: ROAD({ HUMRAT_TEUNA: [1, 2] }), evidence: "road_severe_injuries_per_100k",
    definition: "מספר תאונות הדרכים הקטלניות והקשות (לפי הנפגע החמור ביותר בתאונה) שאירעו בתחום היישוב, לכל 100,000 תושבים בשנה, כממוצע של שלוש שנים.",
    why: "פגיעות בתאונות דרכים הן סיבה מרכזית לפציעה קשה ולמוות בגיל צעיר, והן ניתנות למניעה בהתערבות של הרשות המקומית: תכנון רחובות, ניהול מהירות והגנה על הולכי רגל.",
    caution: ROAD_CAUTION },
  { id: "road_pedestrian_100k", domain: "safety", label: "תאונות קטלניות וקשות עם פגיעה בהולכי רגל", short: "פגיעה בהולכי רגל",
    unit: "per100k", direction: "lower", decimals: 1, importance: 3, kind: "level", minBase: 8000, source: "cbs_road_accidents", collect: ROAD({ HUMRAT_TEUNA: [1, 2], SUG_TEUNA: [1] }),
    definition: "מספר התאונות הקטלניות והקשות שבהן נפגע הולך רגל, לכל 100,000 תושבים בשנה, כממוצע של שלוש שנים.",
    why: "הולכי רגל, ובהם ילדים וקשישים, הם המשתמשים הפגיעים ביותר בכבישים שבתוך היישוב. הפער בין יישובים בפגיעה בהם משקף במידה רבה את תכנון הרחובות והמהירות.",
    caution: ROAD_CAUTION },

  // ── מצב הבריאות ותוחלת החיים ──────────────────────────────────────────────
  { id: "life_expectancy", domain: "outcomes", label: "תוחלת חיים בלידה", short: "תוחלת חיים",
    unit: "years", direction: "higher", decimals: 1, importance: 3, kind: "level", minBase: 0, source: "cbs_local_authorities", collect: LA("תוחלת חיים בלידה"),
    definition: "מספר השנים הממוצע שאדם שנולד ביישוב צפוי לחיות, בהנחה ששיעורי התמותה לפי גיל בחמש השנים שמסתיימות בשנה המוצגת יישארו קבועים. מפורסם רק לערים של 50,000 תושבים ומעלה.",
    why: "תוחלת החיים היא התוצאה הכוללת של מצב הבריאות, ההכנסה, הסביבה ושירותי הבריאות. ההשוואה בין יישובים דומים מראה פערי בריאות שרשות מקומית צריכה להכיר, גם אם אינה יכולה לסגור אותם בעצמה.",
    caution: LA_CAUTION + " קיים רק לערים של 50,000 תושבים ומעלה." },
  { id: "mortality_std", domain: "outcomes", label: "שיעור פטירות מתוקנן לגיל", short: "שיעור פטירות מתוקנן",
    unit: "per1000", direction: "lower", decimals: 2, importance: 3, kind: "level", minBase: 0, source: "cbs_local_authorities", collect: LA("שיעור פטירות מתוקנן", { minPopulation: 5000 }),
    definition: "מספר הפטירות ל-1,000 תושבים, מתוקנן להרכב הגילים של האוכלוסייה כדי שאפשר יהיה להשוות יישוב צעיר ליישוב מבוגר, כממוצע של חמש שנים שמסתיימות בשנה המוצגת.",
    why: "תמותה מתוקננת מנטרלת את ההבדל בגיל האוכלוסייה, ולכן היא הדרך ההוגנת להשוות את מצב הבריאות של יישובים. היא יציבה יותר ממדדי תמותה לפי סיבה, גם ביישובים קטנים.",
    caution: LA_CAUTION + " נכלל רק ביישובים של 5,000 תושבים ומעלה." },
  { id: "infant_mortality", domain: "outcomes", label: "תמותת תינוקות", short: "תמותת תינוקות",
    unit: "per1000", direction: "lower", decimals: 1, importance: 3, kind: "level", minBase: 0, source: "cbs_local_authorities", collect: LA("שיעור פטירות תינוקות"), evidence: "infant_mortality_rate",
    definition: "מספר התינוקות שנפטרו לפני גיל שנה, לכל 1,000 לידות חי, כממוצע של חמש שנים שמסתיימות בשנה המוצגת.",
    why: "תמותת תינוקות היא מדד קלאסי של בריאות האם והילד ושל איכות הטיפול סביב הלידה והשנה הראשונה. לפי דוח משרד הבריאות, מוות בעריסה הוא הסיבה הרביעית לתמותת תינוקות בישראל, והדרכה להורים נועדה להקטין את הסיכון.",
    caution: LA_CAUTION + " נכלל רק כשהשיעור מבוסס על 20 מקרים לפחות בחמש שנים: הלמ״ס מסמנת שיעור שמבוסס על 5 עד 19 מקרים בסוגריים ועל פחות מ-5 מקרים בשתי נקודות, ושניהם הושמטו כאן, ולכן המדד קיים רק בערים גדולות יחסית ולא בכל שנה. הפערים בין יישובים הם לעיתים בתחום הטעות הסטטיסטית. אין יעד ישראלי ליישוב, והיעד האמריקאי (5.0 ל-1,000) אינו ישים להשוואה כי הממוצע הישראלי כבר נמוך ממנו." },
  { id: "diabetes_std", domain: "outcomes", label: "שיעור חולי סוכרת מתוקנן לגיל", short: "חולי סוכרת",
    unit: "per1000", direction: "lower", decimals: 1, importance: 4, kind: "level", minBase: 0, source: "cbs_local_authorities", collect: LA("שיעור מקרי סוכרת מתוקנן"), evidence: "diabetes_prevalence",
    definition: "מספר חולי הסוכרת הרשומים ברישום הלאומי לסוכרת (מקרים קיימים, סוג 1 וסוג 2) לכל 1,000 תושבים, מתוקנן להרכב הגילים, כממוצע של שלוש שנים. מפורסם לעיריות ולמועצות מקומיות של 10,000 תושבים ומעלה.",
    why: "סוכרת היא מחלה כרונית נפוצה. לפי צוות השירותים המונעים האמריקאי (CPSTF), תוכניות קהילתיות של תזונה ופעילות גופנית מפחיתות את המעבר לסוכרת אצל אנשים בסיכון, ולכן יש מה לעשות גם ברמת היישוב.",
    caution: LA_CAUTION + " הרישום מבוסס על דיווח קופות החולים (אבחנה, בדיקות דם או רכישת תרופות) ומתאר מקרים קיימים. החלונות הם של שלוש שנים שאינן חופפות (2014-2016, 2017-2019, 2020-2022), ולכן יש רק שלוש נקודות. הגדרת החולה בקופת חולים מאוחדת השתנתה ב-2020, ולכן ההשוואה לחלונות הקודמים דורשת זהירות." },

  { id: "child_injury_ed_1000", domain: "safety", label: "ביקורי מיון של ילדים בשל פגיעה", short: "פגיעות ילדים בחדר מיון",
    unit: "per1000", direction: "lower", decimals: 1, importance: 3, kind: "level", minBase: 3000, source: "moh_child_injury", collect: CHILD_INJURY(1, 1),
    definition: "מספר ביקורי המיון של ילדים (עד גיל 17) בשל פגיעה, לכל 1,000 ילדים ביישוב, בשנה.",
    why: "פגיעות הן סיבה שכיחה לפנייה למיון בילדים, והן תחום שבו לרשות מקומית יש כלים: תשתיות ומתקני משחק בטוחים, אכיפה והסברה. ההשוואה ליישובים דומים מראה היכן הסיכון גבוה יותר.",
    caution: CHILD_INJURY_CAUTION },
  { id: "child_injury_hosp_1000", domain: "safety", label: "אשפוזי ילדים בשל פגיעה", short: "פגיעות ילדים: אשפוז",
    unit: "per1000", direction: "lower", decimals: 1, importance: 4, kind: "level", minBase: 3000, source: "moh_child_injury", collect: CHILD_INJURY(2, 3),
    definition: "מספר האשפוזים של ילדים (עד גיל 17) בשל פגיעה, לכל 1,000 ילדים ביישוב, כממוצע של שלוש שנים.",
    why: "אשפוז בשל פגיעה מצביע על פגיעה חמורה יותר מביקור במיון. הוא נדיר יחסית, ולכן הנתון הוא ממוצע של שלוש שנים.",
    caution: CHILD_INJURY_CAUTION },

  // ── חיסונים ───────────────────────────────────────────────────────────────
  { id: "th_mmrv", domain: "immunization", label: "פעוטות שחוסנו נגד חצבת, חזרת ואדמת (MMR/MMRV) עד גיל 13 חודשים", short: "MMR/MMRV",
    unit: "%", direction: "higher", decimals: 1, importance: 5, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("0e91ec84-846a-46ab-bbb0-0d315104abe3"), noun: "פעוטות", done: "חוסנו במועד", evidence: "mmr_mmrv_by_13m",
    definition: "שיעור הפעוטות שמלאו להם 13 חודשים בתקופה הנמדדת וקיבלו מנה אחת של MMR או MMRV בין גיל 12 ל-13 חודשים.",
    why: "חצבת מדבקת מאוד: כדי למנוע התפרצות צריך כיסוי של 95% בשתי מנות. מנה ראשונה במועד היא הצעד הראשון, ופערים בה מתורגמים לפעוטות חשופים לחצבת.",
    caution: TH_CAUTION + " זה כיסוי במועד ולא כיסוי סופי: לפי דוח משרד הבריאות, לקראת גיל 19 חודשים כ-90% מהתינוקות בארץ מחוסנים, ולכן ערך נמוך אינו אומר שכל הילדים האחרים נשארו בלי חיסון." },
  { id: "th_penta", domain: "immunization", label: "פעוטות שקיבלו 4 מנות חיסון מחומש (DTaP-IPV-Hib) עד גיל 18 חודשים", short: "מחומש 4 מנות",
    unit: "%", direction: "higher", decimals: 1, importance: 5, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("4083f942-9ef3-4205-bf75-69a985337c94"), noun: "פעוטות", done: "קיבלו 4 מנות", evidence: "dtap_ipv_hib_4doses_by_18m",
    definition: "שיעור הפעוטות שמלאו להם 18 חודשים וקיבלו ארבע מנות של חיסון מחומש (דיפתריה, טטנוס, שעלת, פוליו, המופילוס).",
    why: "השלמת סדרת הבסיס מגנה מפני שעלת, פוליו ודיפתריה. ירידה בכיסוי חושפת את הילדים הלא מחוסנים למחלות שהיו נדירות.",
    caution: TH_CAUTION },
  { id: "th_pertussis", domain: "immunization", label: "תינוקות שחוסנו נגד שעלת", short: "שעלת",
    unit: "%", direction: "higher", decimals: 1, importance: 4, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("2aefe23d-0256-4456-90e7-a8d672eb6e3a"), noun: "תינוקות", done: "קיבלו 3 מנות", evidence: "pertussis_3doses_by_7m",
    definition: "שיעור התינוקות שמלאו להם 7 חודשים וקיבלו שלוש מנות חיסון נגד שעלת (בגילי 2, 4 ו-6 חודשים, ברווח של 8 שבועות לפחות בין מנות). במאגר הכותרת היא ״שעלת״ בלבד.",
    why: "שעלת מסוכנת במיוחד לתינוקות בחודשים הראשונים, לפני שהשלימו את סדרת החיסונים. המדד בודק אם שלוש המנות ניתנו במועד.",
    caution: TH_CAUTION },

  // ── בריאות הילד וההתפתחות ───────────────────────────────────────────────
  { id: "th_headcirc", domain: "child", label: "תינוקות שנמדד להם היקף הראש (עד גיל 8 חודשים)", short: "מדידת היקף ראש",
    unit: "%", direction: "higher", decimals: 1, importance: 2, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("05c89ca7-7dcb-4669-b864-0d83c640ddc8"), noun: "תינוקות", done: "נמדדו", evidence: "head_circumference_3measurements_by_8m",
    definition: "שיעור התינוקות שמלאו להם 8 חודשים ונערכו להם לפחות שלוש מדידות של היקף ראש (בלידה עד חודש וחצי, בחודשיים עד חמישה חודשים ובשישה עד שמונה חודשים).",
    why: "היקף ראש חריג בתינוק הוא סימן מוקדם להפרעות התפתחות. המדידה הזולה הזו היא חלק מהמעקב הבסיסי.",
    caution: TH_CAUTION + " הגדרת המדד עודכנה ב-2021 ומדידה חדשה החלה ב-2022, ולכן קיימת רק סדרה קצרה (2023-2024) ואין להשוות אותה לנתונים ישנים." },
  { id: "th_language", domain: "child", label: "ילדים שנבדקו להתפתחות שפה ותקשורת (גיל 2-3)", short: "בדיקת שפה ותקשורת",
    unit: "%", direction: "higher", decimals: 1, importance: 3, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("37217656-50b8-4c8a-a870-5a8e225ec866"), noun: "ילדים", done: "נבדקו", evidence: "language_communication_check_2_3y",
    definition: "שיעור הילדים שמלאו להם שלוש שנים וביצעו בגילי שנתיים עד שלוש בדיקת התפתחות הכוללת התייחסות לשפה ולתקשורת.",
    why: "משרד הבריאות רואה בבדיקת השפה והתקשורת בגיל 2-3 חלק מהמעקב ההתפתחותי הרגיל, כדי לאתר עיכוב ולהפנות להערכה.",
    caution: TH_CAUTION + " הבדיקה היא מדיניות של משרד הבריאות. ועדת ההמלצות האמריקאית (USPSTF) קבעה ב-2024 שאין די ראיות כדי להעריך תועלת מול נזק של סקר שפה לילדים ללא תסמינים בני 5 ומטה." },
  { id: "th_devtests6", domain: "child", label: "ילדים שנבדקו בבדיקת התפתחות (עד גיל 6)", short: "בדיקת התפתחות",
    unit: "%", direction: "higher", decimals: 1, importance: 3, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("550a5ced-f7e3-457c-bf2a-32d8b2f6f4d2"), noun: "ילדים", done: "נבדקו", evidence: "developmental_tests_by_age_6",
    definition: "שיעור הילדים שמלאו להם 6 שנים ובוצעה להם בדיקת התפתחות בין גיל 4 ל-6.",
    why: "מראה אם כל מערך בדיקות ההתפתחות מגיע לילדים, ולא רק הבדיקה הבודדת.",
    caution: TH_CAUTION + " הנתון קיים רק בשנים 2020-2022 ושיעוריו נמוכים בכל הארץ." },
  { id: "th_safesleep", domain: "child", label: "הורים שקיבלו הדרכה לשינה בטוחה (מניעת מוות בעריסה)", short: "הדרכה לשינה בטוחה",
    unit: "%", direction: "higher", decimals: 1, importance: 3, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("891d8c43-246a-4a3e-a1cd-08605a151fa0"), noun: "תינוקות", done: "הוריהם קיבלו הדרכה", evidence: "safe_sleep_guidance_2m",
    definition: "שיעור התינוקות הרשומים בתחנה שמלאו להם חודשיים והוריהם קיבלו הדרכה למניעת מוות בעריסה.",
    why: "לפי דוח משרד הבריאות, מוות בעריסה הוא הסיבה הרביעית לתמותת תינוקות בישראל. הדרכה פשוטה להורים (שינה על הגב, מזרן קשיח, מיטה ריקה מחפצים) נועדה להקטין את הסיכון.",
    caution: TH_CAUTION },

  // ── תזונה והנקה ──────────────────────────────────────────────────────────
  { id: "th_bf_exclusive", domain: "nutrition", label: "תינוקות שהונקו בהנקה בלעדית בגיל 4 חודשים", short: "הנקה בלעדית",
    unit: "%", direction: "higher", decimals: 1, importance: 4, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("5256590e-b340-4a00-910a-181f54654232"), noun: "תינוקות", done: "הונקו בלעדית", evidence: "exclusive_breastfeeding_4m",
    definition: "שיעור התינוקות שמלאו להם 4 חודשים ו-15 יום, הרשומים בטיפות חלב, שדווחה לגביהם הנקה בלעדית סביב גיל 4 חודשים.",
    why: "הנקה בלעדית מפחיתה זיהומים בגיל הרך ומשפרת בריאות לטווח ארוך. ארגון הבריאות העולמי ממליץ עליה עד גיל 6 חודשים.",
    caution: TH_CAUTION + " קיים רק לשנת 2024, ולכן אין מגמה. יעד ארגון הבריאות העולמי מתייחס ל-6 חודשים ולכן אינו ישים להשוואה ישירה." },
  { id: "th_bf_keep", domain: "nutrition", label: "נשים שהמשיכו בהנקה בלעדית", short: "המשך הנקה בלעדית",
    unit: "%", direction: "higher", decimals: 1, importance: 2, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("9dbd407b-165b-4df9-9d7f-3073dff0010a"), noun: "נשים", done: "המשיכו להניק בלעדית", evidence: "breastfeeding_maintenance",
    definition: "שיעור הנשים שהחלו בהנקה בלעדית והמשיכו בה.",
    why: "מראה אם התמיכה אחרי הלידה מחזיקה את ההנקה, ולא רק מתחילה אותה.",
    caution: TH_CAUTION + " הנתון קיים רק לשנת 2020." },
  { id: "th_iron", domain: "nutrition", label: "תינוקות שקיבלו תוסף ברזל (עד גיל 13 חודשים)", short: "תוסף ברזל לתינוקות",
    unit: "%", direction: "higher", decimals: 1, importance: 2, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("727a22ac-95c4-4a73-b489-054e7ac545b9"), noun: "תינוקות", done: "תועד להם תוסף ברזל", evidence: "iron_supplement_documented",
    definition: "שיעור התינוקות הרשומים בתחנה שמלאו להם 14 חודשים (במאגר: ״עד 13 חודשים״) ובתיק הרפואי תועד לפחות פעמיים שקיבלו תוסף ברזל.",
    why: "אנמיה מחוסר ברזל בגיל הרך קשורה לפגיעה בהתפתחות. משרד הבריאות ממליץ על מזון עשיר בברזל ועל תוסף ברזל לתינוקות בגיל 4 עד 18 חודשים.",
    caution: TH_CAUTION + " המדד מודד תיעוד של מתן התוסף, ולא צריכה בפועל." },

  { id: "bmi_g1_over", domain: "nutrition", label: "עודף משקל והשמנה בכיתה א׳", short: "משקל עודף בכיתה א׳",
    unit: "%", direction: "lower", decimals: 1, importance: 4, kind: "level", minBase: 0, source: "moh_school_bmi", collect: BMI("א"), evidence: "school_obesity",
    definition: "אחוז התלמידים בכיתה א׳ (בני 6-7) שנבדקו בבדיקות בית הספר של משרד הבריאות ונמצאו עם עודף משקל או עם השמנה, לפי מדד מסת הגוף (BMI) של התלמיד מול עקומות של ארגון הבריאות העולמי. שתי הקטגוריות מחוברות, וכל נתון הוא ממוצע של שלוש שנות לימודים.",
    why: "עודף משקל והשמנה בילדים נמנים על מדדי הבריאות המובילים בתוכנית Healthy People 2030 האמריקאית. בית הספר הוא מקום שבו רשות מקומית יכולה לשנות את הסביבה: המזון המוגש, שיעורי החינוך הגופני והזדמנויות לפעילות. כיתה א׳ מראה את נקודת הפתיחה בכניסה לבית הספר.",
    caution: BMI_CAUTION },
  { id: "bmi_g7_over", domain: "nutrition", label: "עודף משקל והשמנה בכיתה ז׳", short: "משקל עודף בכיתה ז׳",
    unit: "%", direction: "lower", decimals: 1, importance: 4, kind: "level", minBase: 0, source: "moh_school_bmi", collect: BMI("ז"), evidence: "school_obesity",
    definition: "אחוז התלמידים בכיתה ז׳ (בני 12-13) שנבדקו בבדיקות בית הספר של משרד הבריאות ונמצאו עם עודף משקל או עם השמנה, לפי מדד מסת הגוף (BMI) של התלמיד מול עקומות של ארגון הבריאות העולמי. שתי הקטגוריות מחוברות, וכל נתון הוא ממוצע של שלוש שנות לימודים.",
    why: "עודף משקל והשמנה בילדים נמנים על מדדי הבריאות המובילים בתוכנית Healthy People 2030 האמריקאית. כיתה ז׳ מראה את המצב בכניסה לגיל ההתבגרות, ולכן משקפת גם את מה שקרה בשנות בית הספר היסודי, שבהן הרשות המקומית יכולה להשפיע על המזון ועל הפעילות.",
    caution: BMI_CAUTION },

  // ── בריאות הנפש ──────────────────────────────────────────────────────────
  { id: "th_ppd", domain: "mental", label: "אימהות שנבדקו לאיתור דיכאון אחרי לידה", short: "אימהות שנבדקו לדיכאון אחרי לידה",
    unit: "%", direction: "higher", decimals: 1, importance: 4, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("b7af4c2f-254f-4978-9cf2-529bdeeadadf"), noun: "נשים", done: "נבדקו", evidence: "postpartum_depression_screening",
    definition: "שיעור האימהות לתינוקות שמלאו להם שלושה חודשים שמילאו שאלון לאיתור דיכאון אחרי לידה (EPDS) עד שלושה חודשים מהלידה.",
    why: "דיכאון אחרי לידה פוגע באם ובהתפתחות התינוק, ואיתורו מוקדם מאפשר טיפול. הסקר הוא הצעד הראשון.",
    caution: TH_CAUTION + " המדד מראה כמה נבדקו, לא כמה אובחנו עם דיכאון." },
  { id: "depressed_20", domain: "mental", label: "תחושת דיכאון בקרב מבוגרים (בני 20 ומעלה)", short: "תחושת דיכאון",
    unit: "%", direction: null, decimals: 1, importance: 3, kind: "level", minBase: 0, source: "cbs_quality_of_life", collect: CBS_CITY(3, 6924),
    definition: "אחוז בני 20 ומעלה בעיר שדיווחו בסקר החברתי של הלמ״ס על תחושת דיכאון (נוסח השאלה המדויק בתיעוד הסקר). מפורסם לערים הגדולות בלבד.",
    why: "זה אחד המדדים הבודדים של מצב נפשי שיש ברמת עיר. הוא משלים את סקר הדיכאון אחרי לידה בטיפות החלב, שמכסה רק אימהות לתינוקות, ואת ספירת שירותי בריאות הנפש, שמתארת היצע ולא צורך.",
    caution: CBS_SURVEY_CAUTION },
  { id: "lonely_20", domain: "mental", label: "תחושת בדידות בקרב מבוגרים (בני 20 ומעלה)", short: "תחושת בדידות",
    unit: "%", direction: null, decimals: 1, importance: 2, kind: "level", minBase: 0, source: "cbs_quality_of_life", collect: CBS_CITY(8, 6952),
    definition: "אחוז בני 20 ומעלה בעיר שדיווחו בסקר החברתי של הלמ״ס על תחושת בדידות (נוסח השאלה המדויק בתיעוד הסקר). מפורסם לערים הגדולות בלבד.",
    why: "בדידות היא מדד של חוסן חברתי, שרשות מקומית משפיעה עליו דרך מועדונים, שירותים לאזרחים ותיקים ומרחבים משותפים.",
    caution: CBS_SURVEY_CAUTION },

  { id: "mental_points_10k", domain: "mental", label: "נקודות שירות לבריאות הנפש ביישוב", short: "שירותי בריאות הנפש",
    unit: "per10k", direction: "higher", decimals: 1, importance: 3, kind: "level", minBase: 10000, source: "moh_services_registry",
    collect: REGISTRY(null, ["name", "address"], { expertise_desc: "פסיכ|בריאות הנפש" }, 10000),
    definition: "מספר נותני השירות השונים (שם וכתובת) הרשומים בקופות החולים בהתמחויות פסיכיאטריה, פסיכולוגיה, פסיכותרפיה ובריאות הנפש, לכל 10,000 תושבים. כולל מרפאות, רופאים ומטפלים. נכלל רק ביישובים של 10,000 תושבים ומעלה.",
    why: "שירותי בריאות הנפש בקהילה הם הכתובת למצוקה נפשית שאינה מגיעה לאשפוז. פער בהיצע בין יישובים דומים הוא פער בנגישות שאפשר לדון בו עם הקופות ועם משרד הבריאות.",
    caution: REGISTRY_CAUTION + " נקודת שירות היא שם וכתובת: מטפל שמקבל במקום אחד נספר פעם אחת, ומטפל שמקבל בשתי כתובות נספר פעמיים. הרישום אינו מבדיל בין מרפאה ציבורית לקליניקה פרטית בהסכם, ואינו מראה את זמני ההמתנה." },

  // ── סביבה ────────────────────────────────────────────────────────────────
  { id: "green_satisfaction", domain: "env", label: "שביעות רצון מפארקים ומשטחים ירוקים באזור המגורים", short: "שביעות רצון משטחים ירוקים",
    unit: "%", direction: null, decimals: 1, importance: 2, kind: "level", minBase: 0, source: "cbs_quality_of_life", collect: CBS_CITY(7, 6946),
    definition: "אחוז בני 20 ומעלה בעיר שדיווחו בסקר החברתי של הלמ״ס שהם מרוצים מפארקים ומשטחים ירוקים באזור מגוריהם (נוסח השאלה המדויק בתיעוד הסקר). מפורסם לערים הגדולות בלבד.",
    why: "פארקים ומשטחים ירוקים הם חלק מהסביבה שרשות מקומית מתכננת ומתחזקת, והם המקום הזמין ביותר לפעילות גופנית של תושבים.",
    caution: CBS_SURVEY_CAUTION + " השביעות מתארת תחושה ולא את שטח הפארקים לנפש." },
  { id: "noise_bother", domain: "env", label: "רעש חיצוני המפריע בדירה", short: "רעש חיצוני",
    unit: "%", direction: null, decimals: 1, importance: 2, kind: "level", minBase: 0, source: "cbs_quality_of_life", collect: CBS_CITY(7, 6947),
    definition: "אחוז בני 20 ומעלה בעיר שדיווחו בסקר החברתי של הלמ״ס שרעש חיצוני מפריע להם בדירה (נוסח השאלה המדויק בתיעוד הסקר). מפורסם לערים הגדולות בלבד.",
    why: "רעש מתחבורה ומפעילות עירונית הוא גורם סביבתי שרשות מקומית יכולה להשפיע עליו דרך תכנון תנועה, אכיפה ותכנון שכונות.",
    caution: CBS_SURVEY_CAUTION + " הדיווח הוא על הפרעה שהמשיב מרגיש ולא על מדידת רעש." },

  // ── רווחה ואלימות ────────────────────────────────────────────────────────
  { id: "th_violence", domain: "welfare", label: "אימהות שנשאלו על אלימות כלפי נשים", short: "אימהות שנשאלו על אלימות",
    unit: "%", direction: "higher", decimals: 1, importance: 4, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("2614d0c1-553f-4434-8f81-05b87ff2bd10"), noun: "נשים", done: "תושאלו", evidence: "violence_screening_women_4m",
    definition: "שיעור הנשים שמלאו לתינוק שלהן 4 חודשים ונערך להן תשאול לאלימות כלפי נשים במהלך ארבעת החודשים שאחרי הלידה.",
    why: "טיפת חלב היא מקום שבו נשים פוגשות איש מקצוע באופן שגרתי, ולכן הזדמנות לאיתור אלימות. שיעור תשאול נמוך הוא הזדמנות שהוחמצה.",
    caution: TH_CAUTION + " המדד מראה כמה תושאלו, לא כמה דיווחו על אלימות." },

  // ── נגישות לשירותים ──────────────────────────────────────────────────────
  { id: "th_firstvisit", domain: "access", label: "תינוקות שהגיעו לביקור ראשון בטיפת חלב בשבועיים הראשונים", short: "ביקור ראשון",
    unit: "%", direction: "higher", decimals: 1, importance: 4, kind: "rate", minBase: 100, source: "moh_tipat_halav",
    collect: TH_COLLECT("fa1b80f7-ae95-4afd-a707-c2bd2e13cd0e"), noun: "תינוקות", done: "הגיעו לביקור במועד", evidence: "first_visit_within_2_weeks",
    definition: "שיעור התינוקות הרשומים בתחנה שמלאו להם שבועיים והגיעו לביקור ראשון בתחנה, או שנערך להם ביקור בית, במהלך השבועיים הראשונים מהלידה.",
    why: "הביקור הראשון הוא שער הכניסה לשירותי טיפת חלב: מעקב משקל והאכלה, איתור צהבת וסימני סכנה, והיכרות עם המשפחה. לפי הגדרת משרד הבריאות גם ביקור בית נספר בו.",
    caution: TH_CAUTION + " כדאי להשוות גם ליעד משרד הבריאות ולא רק לממוצע הארצי, כי הממוצע הארצי עצמו עשוי להיות רחוק מהיעד." },

  { id: "family_doctors_10k", domain: "access", label: "רופאי משפחה רשומים ביישוב", short: "רופאי משפחה",
    unit: "per10k", direction: "higher", decimals: 1, importance: 3, kind: "level", minBase: 5000, source: "moh_services_registry",
    collect: REGISTRY({ services_type_desc: ["רופאים"], expertise_desc: ["משפחה"] }, ["name"]),
    definition: "מספר הרופאים השונים (לפי שם) הרשומים בקופות החולים כרופאי משפחה ביישוב, לכל 10,000 תושבים. רופא שרשום בכמה קופות נספר פעם אחת.",
    why: "רופא משפחה הוא הכתובת הראשונה במערכת הבריאות. ההבדל בין יישובים בכמות הרופאים הרשומים בהם מראה היכן ההיצע המקומי של רפואה ראשונית חלש יותר, ובאילו יישובים התושבים תלויים בשירות מחוץ ליישוב.",
    caution: REGISTRY_CAUTION },
  { id: "pediatricians_10k", domain: "access", label: "רופאי ילדים רשומים ביישוב", short: "רופאי ילדים",
    unit: "per10k", direction: "higher", decimals: 1, importance: 3, kind: "level", minBase: 5000, source: "moh_services_registry",
    collect: REGISTRY({ services_type_desc: ["רופאים"], expertise_desc: ["ילדים"] }, ["name"]),
    definition: "מספר הרופאים השונים (לפי שם) הרשומים בקופות החולים כרופאי ילדים ביישוב, לכל 10,000 תושבים.",
    why: "רופא ילדים מטפל בילדים גם אחרי הגיל הרך, שבו פועלות טיפות החלב. המדד מראה היכן ההיצע המקומי של רפואת ילדים חלש יותר.",
    caution: REGISTRY_CAUTION + " המכנה הוא כלל התושבים ולא ילדים בלבד, ולכן ביישוב צעיר, שיש בו יותר ילדים לכל תושב, הנגישות לכל ילד נמוכה ממה שהמספר מראה." },
  { id: "wait_specialist_days", domain: "access", label: "זמן המתנה לרופא מומחה בקהילה", short: "המתנה למומחה",
    unit: "days", direction: "lower", decimals: 0, importance: 4, kind: "level", minBase: 0, source: "moh_waiting_times", collect: WAIT(WAIT_COMMON5),
    definition: "ממוצע מספר הימים עד התור הפנוי (הלא דחוף) אצל רופא מומחה בקהילה, לפי התורים שארבע קופות החולים מציעות למבוטח שבוחר רופא מסוים. הממוצע הוא על פני חמש ההתמחויות השכיחות (אורתופדיה, נשים, אף אוזן גרון, עיניים ועור), כל אחת במשקל שווה, וערך של שנה הוא ממוצע הרבעונים שלה.",
    why: "משרד הבריאות מודד את זמני ההמתנה כדי לאתר בעיות בזמינות שירותים רפואיים, למפות פערים בין אזורים ולתכנן פעולות לקיצור ההמתנה. המדד מראה באילו יישובים רפואה מומחית זמינה פחות.",
    caution: "זמן ההמתנה מחושב מהתורים הפנויים הלא דחופים שהקופות מציעות ולא ממועדי הביקור בפועל, ובמקרים דחופים הקופות נותנות מענה מיידי. היישוב הוא היישוב שבו עובדים הרופאים ולא בהכרח מקום מגורי המטופלים. נכללים רק יישובים שיש בהם חמישה רופאים מומחים או יותר בכל התמחות, ולכן יישובים קטנים אינם מופיעים. הממוצע מושפע מתורים רחוקים מאוד, והממוצע של ההתמחויות בלי משקל משתנה אם מבנה ההתמחויות שונה בין יישובים. בשנות הקורונה (2020-2021) ובמלחמה (מ-2023) הזמינות השתנתה בכל הארץ. אין יעד ישראלי לזמן המתנה ליישוב." },
  { id: "wait_gyn_days", domain: "access", label: "זמן המתנה לרופא נשים בקהילה", short: "המתנה לרופא נשים",
    unit: "days", direction: "lower", decimals: 0, importance: 3, kind: "level", minBase: 0, source: "moh_waiting_times", collect: WAIT(["נשים"]),
    definition: "ממוצע מספר הימים עד התור הפנוי (הלא דחוף) אצל רופא נשים בקהילה, לפי התורים שארבע קופות החולים מציעות למבוטחת שבוחרת רופא מסוים. ערך של שנה הוא ממוצע הרבעונים שלה.",
    why: "רופא נשים מלווה בדיקות סקר והיריון, ולכן זמינותו קשורה לבריאות האישה והאם. המדד מכסה יותר יישובים מהמדד המשותף לחמש ההתמחויות, כי די בחמישה רופאי נשים ביישוב.",
    caution: "זמן ההמתנה מחושב מהתורים הפנויים הלא דחופים שהקופות מציעות ולא ממועדי הביקור בפועל, ובמקרים של בעיות רפואיות דחופות הקופות נותנות מענה מיידי. היישוב הוא היישוב שבו עובדים הרופאים ולא בהכרח מקום מגורי המטופלות. נכללים רק יישובים שיש בהם חמישה רופאי נשים או יותר, ולכן יישובים קטנים אינם מופיעים. הממוצע מושפע מתורים רחוקים מאוד. בשנות הקורונה (2020-2021) ובמלחמה (מ-2023) הזמינות השתנתה בכל הארץ. אין יעד ישראלי לזמן המתנה ליישוב." }
];

// ── OFFICIAL GUIDELINES AND REFERENCE FIGURES ─────────────────────────────────────────────────────────────────
// Written from research/guidelines.json: only references that an independent check opened and confirmed (value, year and fit).
// An indicator that is not listed here has no verified reference and the product says so ("אין יעד רשמי").
// The 13 program targets of the Ministry of Health are the same figures the collector reads from the open data (targetField "target"):
// for them the model takes the value of the figure's own year from the data, and `value` here is the latest report year.
const MOH_BASE = "יעד רשמי של משרד הבריאות לנותני שירות בתוכנית הלאומית למדדי איכות, ולא יעד שנקבע ליישוב מסוים. החלתו על יישוב היא הרחבה.";
const MOH_TARGET = (value, where, more = "", year = "2024", source = "moh_quality_report") => ({
  kind: "official_target", value, unit: "%", direction: "atLeast", year, scope: "national", source, where, judges: true, caveat: MOH_BASE + (more ? " " + more : "")
});
const GUIDELINES = {
  th_mmrv: { guideline: MOH_TARGET(80, "עמוד 359", "לפי הנתונים הפתוחים היעד היה 75 ב-2020 עד 2021 ו-80 מ-2022. יעד של 95% בשתי מנות (ארגון הבריאות העולמי) הוא מדד אחר ואינו משמש כאן.") },
  th_penta: { guideline: MOH_TARGET(90, "עמוד 366") },
  th_pertussis: { guideline: MOH_TARGET(75, "עמוד 373", "המדד דורש מנות בגילי חודשיים, 4 ו-6 חודשים, ברווח של 8 שבועות לפחות. לפי הנתונים הפתוחים היעד היה 70 ב-2020 עד 2021 ו-75 מ-2022.") },
  th_headcirc: { guideline: MOH_TARGET(95, "עמוד 338", "הגדרת המדד עודכנה, ולכן קיימת רק סדרה קצרה.") },
  th_language: { guideline: MOH_TARGET(90, "עמוד 344") },
  th_devtests6: { guideline: MOH_TARGET(25, "עמוד 310", "יש יעד לשנת 2022 בלבד, והמדד אינו מופיע בדוח 2013-2024, ולכן אין לו יעד עדכני. הדוח מגדיר בדיקה שנעשתה בין גיל 4 ל-6.", "2022", "moh_quality_report_2022") },
  th_safesleep: { guideline: MOH_TARGET(90, "עמוד 380", "משרד הבריאות הנחה את התחנות בנושא ב-2019.") },
  th_bf_exclusive: { guideline: MOH_TARGET(26, "עמוד 231", "המדד נמדד מ-2021. יעד לגיל 6 חודשים הוא מדד אחר ואינו משמש כאן.") },
  th_bf_keep: { guideline: MOH_TARGET(70, "שדה היעד במאגר הפתוח של משרד הבריאות (משאב 9dbd407b)", "היעד מופיע רק בשדה היעד של הנתונים הפתוחים, לא בעמוד של דוח. המדד הוצא מהתוכנית אחרי 2020, ולכן אין יעד עדכני.", "2020", "moh_tipat_halav") },
  th_iron: { guideline: MOH_TARGET(75, "עמוד 239", "המדד בודק תיעוד של מתן התוסף ולא צריכה בפועל. לפי הנתונים הפתוחים היעד היה 70 ב-2021 ו-73 ב-2022 עד 2023.") },
  th_ppd: { guideline: MOH_TARGET(90, "עמוד 266", "המדד סופר מי מילאה שאלון ולא מי אובחנה עם דיכאון.") },
  th_violence: { guideline: MOH_TARGET(95, "עמוד 278", "המדד סופר כמה נשאלו ולא כמה דיווחו על אלימות. לפי הנתונים הפתוחים היעד היה 90 ב-2020 עד 2022.") },
  th_firstvisit: { guideline: MOH_TARGET(75, "עמוד 351", "נספר ביקור בתחנה של תינוק רשום; טיפול במקום אחר עשוי שלא להיספר.") },

  // official, but it does not judge: a different age band, or a national relative cut that is not a rate of a locality
  infant_mortality: { guideline: {
    kind: "official_target", value: 25, unit: "per1000", direction: "atMost", year: "2030", scope: "international", source: "un_sdg3", where: "יעד 3.2", judges: false,
    caveat: "יעד עולמי של האו״ם לתמותת ילדים עד גיל 5 (לא עד גיל שנה): לא יותר מ-25 ל-1,000 לידות חי. תמותת תינוקות היא חלק ממנה, ולכן זו תקרה רחבה מאוד ולא אמת מידה. זה יעד למדינות ולא ליישוב, וישראל נמוכה ממנו בהרבה. הוא מוצג להקשר ואינו משמש לשיפוט."
  } },
  road_severe_100k: { guideline: {
    kind: "official_target", value: 25, unit: "pct_reduction", direction: "atLeast", year: "2025", scope: "national", source: "nrsa_plan_2026", where: "עמוד 5", judges: false,
    valueText: "הפחתה של 25% בפגיעה חמורה בחמש שנים, לעומת ממוצע 2020-2024",
    caveat: "יעד ארצי לחמש שנים: הפחתה של 25% בפגיעה החמורה לעומת ממוצע השנים 2020-2024, ולא יותר מ-273 הרוגים ב-2030. היעד סופר אנשים ולא תאונות, חל על כל הארץ ואינו שיעור ל-100,000 תושבים ביישוב, וההגדרה של פגיעה חמורה אינה מפורטת בעמוד. בעיתונות פורסם שהממשלה אישרה את התוכנית (נובמבר 2025), ונוסח ההחלטה לא נמצא. לכן הוא מוצג כרקע ארצי בלבד ואינו משמש לשיפוט שיעור של יישוב."
  } },

  // international reference figures: an average of other countries, shown as context, never a goal
  bmi_g1_over: { benchmark: {
    kind: "international_benchmark", value: 29, unit: "%", direction: "atMost", year: "2022", scope: "international", source: "who_europe_cosi", where: "הסבב החמישי של COSI",
    caveat: "ממוצע של 33 מדינות באירופה בקרב ילדים בני 7-9 (הסבב החמישי של המחקר COSI, פורסם ב-2022), ולא יעד. הגיל (7-9 לעומת 6-7 בכיתה א׳) ושיטת המדידה שונים, ושנות המדידה לא אומתו. אין לשפוט או לדרג יישוב מולו."
  } },
  bmi_g7_over: { benchmark: {
    kind: "international_benchmark", value: 22, unit: "%", direction: "atMost", year: "2021/22", scope: "international", source: "who_europe_hbsc", where: "תמצית המחקר",
    caveat: "ממוצע של 44 מדינות ואזורים בקרב בני 11, 13 ו-15 יחד, בסקר 2021/22, ולא יעד. כיתה ז׳ היא גילי 12-13, והדף אינו מציין איך נמדד המשקל (הסקר מבוסס על דיווח של התלמידים). אין לשפוט או לדרג יישוב מולו."
  } },
  pov_children: { benchmark: {
    kind: "international_benchmark", value: 12.2, unit: "%", direction: "atMost", year: "2021", scope: "international", source: "oecd_child_poverty", where: "טבלה CO2.2",
    caveat: "ממוצע מדינות OECD (2021 או השנה האחרונה שיש בכל מדינה), ולא יעד. המדד כאן מתאר ואינו שופט. OECD מחשב לפי הכנסה פנויה למשק בית עם סולם שורש ריבועי ובני 0-17, והביטוח הלאומי לפי הכנסה נטו לנפש תקנית, ולכן ההשוואה אינה מדויקת. לפי הדף ישראל בין שש מדינות עם יותר מ-20%."
  } }
};
for (const [id, g] of Object.entries(GUIDELINES)) Object.assign(indicators.find((i) => i.id === id), g);

const byId = Object.fromEntries(indicators.map((i) => [i.id, i]));
module.exports = { indicators, byId, GUIDELINES };
