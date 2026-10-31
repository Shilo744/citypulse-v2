"use strict";
// Rules every model-written text must follow, shared by the briefing and the dataset finder. They match the guard in guard.js:
// a text that breaks them is rejected there, never shown.
const FIGURE_RULES = `HARD RULES
 - NEVER write a digit anywhere (titles included). Write every figure with a token that the server resolves:
   {{v:ID}} latest value, {{nat:ID}} national value, {{target:ID}} official target, {{guide:ID}} official guideline (only for an indicator that has one), {{peer:ID}} similar localities, {{gap:ID}} distance from national,
   {{rank:ID}} and {{of:ID}} place among localities, {{year:ID}} year, {{delta:ID}} change since the first year, {{first:ID}} the first year, {{city}} the locality name.
   Use a token only for an indicator that is listed below.
 - Write ONLY Hebrew. No English words and no Latin codes at all: write the plain Hebrew name of a vaccine or an institution (חצבת, חזרת ואדמת; החיסון המחומש; ארגון הבריאות העולמי), never MMR, MMRV, DTaP or WHO.
 - Every token already ends with its unit (%, ל-1,000, שנים, נק׳ for percentage points): never write a unit word after a token. Put a hyphen between a one-letter Hebrew prefix and a token: ב-{{year:ID}}, ו-{{v:ID}}, מ-{{nat:ID}}, ל-{{target:ID}}.
 - VOCABULARY (mandatory): always write "מדד" (plural: מדדים), never "פרמטר" or "פרמטרים". Call a concern-status indicator "דורש טיפול", a watch-status indicator "למעקב", a good-status indicator "טוב", a strength-status indicator "חוזק". Never write "מדאיג", "מדאיגים", "מדאיגה", "אחוזון", "מובהק". To describe a change over time, use only: "השתפר", "הידרדר", "בשיפור", "בהידרדרות", "עולה", "יורד" — never "מחמירה". Status na means the indicator only describes and does not judge: say only that it rises or falls, never that its trend is positive or negative.
 - PLACES: the locality may be a city, a local council or a kibbutz. Call it "היישוב" (or by its name), never "העיר", "העירייה" or "בעירייה"; call its authority "הרשות המקומית". Write "עיר" only for a fact that is true of cities, for example the CBS social survey that exists for the large cities.
 - Do not claim a cause. Say what the data shows and what it may point to. Do not give medical advice. Do not invent actions: the system lists the recommended actions separately.
 - Refer to this product as "המערכת" in Hebrew. Never write "המודל" or "מודל שפה" for it (the reader is a municipal officer, not an engineer).`;

module.exports = { FIGURE_RULES };
