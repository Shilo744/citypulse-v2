# CityPulse V2

**Live demo: https://citypulse.shilo744.workers.dev** (no sign-in). The page the address opens is the product; the API is described for agent platforms at `/openapi.json`.
Official Israeli open data (Ministry of Health, CBS, National Insurance) turned into a public-health picture of every locality: where it stands against the country, against similar localities and against Ministry targets; what needs attention; what changed over the years; and an ask page whose figures always come from the data, never from a model.
It runs as one Cloudflare Worker with static assets (`docs/CLOUDFLARE.md`). How **IBM Bob** and **watsonx Orchestrate** were used, with the evidence: `docs/COMPETITION.md`.

מודל לניהול בריאות הציבור ברמת היישוב, שנבנה מנתונים פתוחים ורשמיים. לכל יישוב בישראל שיש עליו נתונים המערכת בונה תמונת מצב, משווה אותו לארץ, ליעדי משרד הבריאות ולישובים דומים, מנתחת את ההיסטוריה (כל השנים הזמינות) ומפיקה מסקנות והמלצות לפעולה, עם מקורות. סוכן שאלות בונה דף מותאם לכל שאלה על היישוב.

## For maintainers: what this is and how to run it

CityPulse V2 turns official Israeli open data (Ministry of Health, Central Bureau of Statistics, National Insurance, Ministry of Welfare) into a public-health picture for one locality at a time. The server reads one prepared file (`data/store/store.json`), computes a model per locality (`src/model/`), and serves it as JSON. Two browser front ends read that JSON. There is no build step and no external dependency: Node 20 or newer is all you need.

### The two apps

| URL | Entry file | What it is |
|---|---|---|
| `http://localhost:8800/` | `web/index.html` | The old app. It is never edited during the product work: `tests/product-old-untouched.test.mjs` compares the sha256 of every old file with `design-ideas/product/baseline/OLD-HASHES.json`. |
| `http://localhost:8800/n.html` | `web/n.html` | The finished product ("mode N"), with its own code in `web/js/product/` and `web/css/product/`. A town is one page, `n.html#/c/1031`. The short level "במבט אחד" and its switch were retired on 2026-11-01 (the old addresses `?v=simple` and `n.html#/c/1031/simple` still open the page). |

The old app's lab list (`web/js/lab/index.js`) carries one card that links to the product (its second link, to the short level of a town, now opens the town page: that level was retired on 2026-11-01); this is the only deliberate change to an old file, and the baseline was re-baselined once for it (see `docs/RELEASE.md`). Both apps share the charts and page modules under `web/js/viz/` and `web/js/pages/`, which the product imports read-only.

### Run

```
node server.js          # http://localhost:8800 (start.cmd on Windows also opens the browser)
npm test                # node --test: the whole suite, about 45 s, no browser needed (total and date: docs/QA.md)
npm run refresh         # collect the open data again and rebuild data/store/store.json
npm run docs            # regenerate docs/INDICATORS.md and docs/METHOD.md from the code
```

The server listens on `127.0.0.1` only. Restart it when `server.js` or anything under `src/` changes; files under `web/` are read from disk on every request and need no restart.

### Settings

All of them are read once at start by `src/lib/config.js`. A value comes from the process environment first and then from `.dev.vars` (a `KEY=value` file in the project root, git-ignored, template in `.dev.vars.example`) unless the table says otherwise.

| Name | Source | Default | Meaning |
|---|---|---|---|
| `PORT` | env, then `.dev.vars` | `8800` | Listening port. |
| `PUBLIC_BASE_URL` | env, then `.dev.vars` | empty | The public address (for example `https://citypulse.example.com`, trailing slash removed). When set, `robots.txt`, `sitemap.xml` and the `/s/<key>` share pages use it. When empty they use the `Host` header of the request if it looks like a plain host name, else `http://localhost:<port>`. Set it on any real host. |
| `SHARE_TARGET` | env, then `.dev.vars` | `/n.html` | Where `/s/<key>` sends a person after the preview, and where an unknown key is redirected. Change it at the flip (`docs/RELEASE.md`). |
| `FEEDBACK_FILE` | env only | `data/feedback.jsonl` | Where `POST /api/feedback` appends reports (one JSON object per line; 5 reports per client address per hour; the file stops accepting at 5 MB). |
| `LLM_API_KEY` | `.dev.vars` only | empty | Key of an OpenAI-compatible service. Without it the ask page answers by keywords and everything else works as usual. |
| `LLM_BASE_URL` | `.dev.vars` only | `https://openrouter.ai/api/v1` | The service address. |
| `LLM_MODEL_SEARCH`, `LLM_MODEL_REASON` | `.dev.vars` only | `anthropic/claude-haiku-5.5`, `anthropic/claude-sonnet-5.5` | The cheap role (finds and filters data sets) and the role that writes what people read (answer plan, answer, the manager briefing). |
| `LLM_RESERVE_USD`, `LLM_MAX_PER_HOUR` | `.dev.vars` only | `0.3`, `40` | Calls stop while the key has less than this left, and never exceed this many per hour. Usage is logged in `data/cache/llm-usage.json`. |

`.dev.vars.example` is stale: it lists an `LLM_MODEL` line that nothing reads. Use the two role names above.

### Browser tools (the product)

They need Chrome and the server running on port 8800. Set `CDP_SLOT=<number>` so two runs never share a Chrome profile.

```
npm run smoke:n         # every route of the product at desktop and phone width: console errors, failed requests, overflow, h1
npm run a11y:n          # structural accessibility of the product
npm run motion:n        # only the allowed motion verbs, and the final state under reduced motion
```

The probes and the matrix (one line each, in `docs/PRODUCT.md` section 11) are `node src/tools/consistency_probe.js`, `small_town_probe.js`, `chrome_probe.js`, `first_screen_probe.js`, `tips_probe.js`, `dialog_focus_probe.js`, `perf_probe.js`, `npm run matrix:n`, `npm run contact:n`. The older `npm run smoke`, `smoke:wide`, `a11y`, `motion` and `shot` do the same for the old app and for single screenshots.

### Where the documents are

| Document | What it is for |
|---|---|
| `docs/PRODUCT.md` | The product as built: routes, the town page, the categories, the official targets, the cards on marks, the honesty rules, resilience, server features, tools, known limits. |
| `docs/SIMPLE.md` | The content contract of the town page: the sections of the page, how rows are chosen, limits. |
| `docs/RELEASE.md` | Server settings for a real host, the CSS bundle, the order of a deploy, the flip to the default and the way back, and the owner's open decisions (section 8, the only place they are written). |
| `docs/QA.md` | Test total and date, results of the browser tools, the acceptance checklist, performance numbers (older), what the tools cannot test. |
| `docs/CHANGES.md`, `docs/CREDITS.md` | What was added, by date and wave; the credit and licence of the category icons. |
| `docs/INDICATORS.md`, `docs/METHOD.md` | Generated from the catalogue and the code (`npm run docs`); never edit by hand. METHOD.md has the status rules and the official targets. |
| `research/GUIDELINES.md`, `research/guidelines.json` | The official targets and reference points: what was verified, what was rejected and why, and the 26 figures with none. |
| `DESIGN_V3.md` | The design contract; section 9 is the product's. |
| `web/js/product/README.md`, `web/js/product/kit/README.md` | The shell contract and the shared parts, with signatures. |
| `design-ideas/product/` | The plan (`SPEC.md`, `SPEC-ADDENDUM.md` wins), the merge into one town page (`MERGE.md`), one report per work package (`DONE/`), requests for shared files (`NEEDS/`), the red-team and QA reports (`qa/`), the backups (`baseline/`). Working papers, not served. |

The long Hebrew sections below describe the data model, the design language and the data sources; they are still accurate except where a heading says otherwise.

## עיקרון אחד שלא משתנה

**שום מספר לא נכתב על ידי מודל.** מספרים מגיעים מנתוני מקור ומחושבים בקוד. מודל שפה בוחר אילו מדדים וגרפים עונים על שאלה ומנסח משפטים, אבל כל מספר במשפט הוא token (`{{v:th_mmrv}}`) שהשרת מחליף מהנתונים. טקסט שהמודל הקליד בו ספרה או מילה באנגלית נפסל (`src/agent/guard.js`), ואם נפסל, המודל מקבל ניסיון תיקון אחד לפני שהמערכת עוברת למענה לפי מילות מפתח.

## איך המסך מסביר את עצמו

- **סטטוס עם סיבה.** `analyze.js` שומר ליד כל סטטוס של "דורש טיפול" או "למעקב" את התנאים שהכריעו (`statusWhy`: מקום בין הישובים, פער מהיעד, הידרדרות). המסך כותב מהם משפט (`statusReason` ב-`web/js/ui.js`), כך שמדד שטוב מהממוצע הארצי ועדיין דורש טיפול מסביר למה. בדיקה מוודאת שאין סטטוס כזה בלי סיבה.
- **סדר עמוד הסקירה של האפליקציה הישנה** (במוצר החדש הסדר בעמוד היישוב, `docs/SIMPLE.md`). מסקנה במשפט ומספרים, התחילו כאן (ההמלצה הראשונה עם הצעדים הראשונים והאחראי), תקציר מנהלים שנכתב בבינה מלאכותית (לפי בקשה, מסומן), מה דורש תשומת לב, תחומים, מה השתנה, פערים בתוך העיר, עוד פעולות, ומקורות הנתונים עם קישורים. סרגל קפיצה נשאר צמוד לראש העמוד.
- **יעד רשמי לצד הדירוג.** לכל מדד נבדק אם יש יעד או הנחיה רשמית עם מקור. 13 יעדי משרד הבריאות קובעים את הסטטוס; יעד קרוב ונקודת ייחוס בין-לאומית מוצגים בלבד ואינם שופטים; ל-26 מדדים אין יעד מאומת, והמסך אומר זאת (`docs/METHOD.md`, `research/GUIDELINES.md`, `src/model/guide.js`). מדד שעומד ביעד ואינו בהידרדרות הוא תקין לכל הפחות.
- **מקור מתחת לכל מספר גדול.** בעמוד כל מדד, מתחת לערך, מופיע הגוף המפרסם והקישור למערך הנתונים.
- **בדיקת כיסוי ליישוב.** `#/c/<קוד>/coverage` (בתפריט: "כיסוי נתונים", ובשורה "מה נמצא ומה חסר" בעמוד הסקירה הישן, ובמוצר החדש בקטע "על מה אין מידע" בעמוד היישוב) מראה לכל מדד אם נמצא נתון ליישוב, מה הערך והשנה, מאיזה מקור, ולמה נתון חסר ("המקור כולל נתון על 43 יישובים בלבד"). מוצג גם סמל היישוב, כדי לחפש אותו בקובץ המקור ולוודא. הנתונים נשמרים ב-`data/store/store.json` ומתעדכנים ב-`npm run refresh`.
- **קבוצה קטנה לא מניבה מסקנה.** מדד שהקבוצה בו קטנה מהסף שלו (למשל שני תינוקות בשנה) מוצג כפי שהוא, אבל אין לו דירוג, מגמה, עדיפות, ממצא או המלצה: `analyze.js` מסמן `reliable: false`, ו-`findings.js` מחזיר לו רק הערה. הכרטיס והעמוד אומרים זאת במפורש ולא משווים לשום דבר, ובעמוד ההשוואה קבוצה כזו היא נקודה חלולה שאינה נכללת בסדר המקומות. בדיקה עוברת על כל היישובים ומוודאת שאף עדיפות או המלצה לא נשענת על קבוצה כזו.

## עיצוב, גרפים ותנועה

החוזה המלא נמצא ב-`DESIGN_V3.md`; כל סוכן שנוגע בממשק קורא אותו קודם. בקצרה:

- **בלי פס צבעוני בצד כרטיס, ולא הכול כרטיס.** מצב מסומן בגוון, באייקון, בתג או בטבעת מלאה. כל עמוד בנוי מרצף של רכיבים שונים (רצועת פתיחה, מספרים גדולים בלי מסגרת, שורות דקות, רצועות צבע, גרף ברוחב מלא) ולא מקוביות לבנות שמונחות זו על זו. `tests/design.test.mjs` נכשל אם מופיע גבול עבה בצד אחד או פס שנעשה ב-`::before`, ואם קובץ גרף כולל צבע קבוע במקום טוקן (מצב כהה נשבר מזה).
- **הגרף נבחר לפי סוג המידע.** חמש משפחות ב-`web/js/viz/`, כל אחת עם קובץ סגנון ב-`web/css/viz/`:

  | משפחה | מה בה | למה |
  |---|---|---|
  | `rings.js` | `statusDonut`, `progressRing`, `gauge`, `standingMeter`, `waffle` | חלק מהשלם, ציון, ערך מול יעד, מקום בין כל היישובים, אחוז מתוך מאה |
  | `compare.js` | `divergingBars`, `dumbbell`, `lollipopRank`, `distribution` | פער ממוצע או ממדד אחר, שני ערכים על ציר אחד, דירוג שכנים, איפה היישוב בהתפלגות |
  | `time.js` | `lineChart` (עם טווח יישובים דומים, אירועים, יעד והמשך מגמה), `columnChart`, `sparkArea`, `trajectory`, `smallMultiples` | שינוי לאורך השנים, בגדלים שונים |
  | `matrix.js` | `domainStrip`, `heatMatrix`, `priorityQuadrant`, `compareHeat` | הרבה מדדים או יישובים בבת אחת |
  | `spatial.js` | `dotMap` (נקודה לכל יישוב לפי קואורדינטות, גודל לפי תושבים), `locator` | מקום בארץ |

  כל משפחה מייצאת גם מתאמים שהופכים נתוני מודל לקלט של גרף (למשל `indicatorLine`, `kpiTrajectory`, `peerBand`), כדי שדף לא יחשב סדרות בעצמו. הקווים והצירים רצים משמאל לימין בתוך כל SVG, "טוב יותר" בצד ימין, וקבוצה קטנה היא תמיד נקודה חלולה בלי דירוג או פסק דין.
- **תנועה מאוצר מילים אחד** (`web/css/motion.css`, `web/js/motion.js`): כניסה של עמוד, גילוי בגלילה (`.rv`), ספירת מספרים, ציור קו (`draw`), סריקה, עמודות שגדלות, נקודה שקופצת, פעימה על היישוב הנבחר. מצב ההתחלה המוסתר קיים רק תחת `html.js-motion`, שנקבע בסקריפט קטן אם אין `prefers-reduced-motion`; בלי JavaScript, בהדפסה ובכלי הבדיקה הכול גלוי מההתחלה. `npm run motion` מוודא שעמוד מונפש מסתיים באותו טקסט כמו עמוד סטטי ושום דבר לא נשאר מוסתר.
- **הלוגו והסרגל.** הלוגו (עלה מעל קו רקיע) ב-`web/assets/logo/`, וסרגל הגלילה בצורת עלה ב-`web/js/motion.js` (`makeLane`), כמו בגרסה של Bob: אחד לעמוד, צמוד לתפריט מצד התוכן, ואחד לתפריט עצמו בקצה הימני של המסך (התפריט גולל לבד כשהחלון נמוך). כל תיבת גלילה אחרת מקבלת פס דק בצבעי העמוד, ורשימת החיפוש מציירת אותו מימין. אין פס אפור של המערכת; בדיקה ב-`tests/design.test.mjs` שומרת על זה.
- **גלריה.** `http://localhost:8800/gallery.html?family=rings|compare|time|matrix|spatial` מציגה כל גרף עם נתוני אמת ועם מקרי הקצה (נקודה אחת, ערכים חסרים, קבוצה קטנה). אפשר להוסיף `&theme=dark` ו-`&city=<קוד>`.
- **כלים.** `src/tools/shot.js` (צילום מסך בכל רוחב, `--dark`, `--motion`), `ui_smoke.js` (כל המסכים ברוחב מחשב וטלפון), `a11y_check.js`, `motion_check.js`; כולם רצים בדפדפן בלי ממשק על פרופיל נפרד (`CDP_SLOT`).

## The product (n.html) in brief

The handbook is `docs/PRODUCT.md`; this is the one-screen version.

- **One town page.** `n.html#/c/<key>` tells the story of a town: how things stand, what goes well, what needs attention, what changed and how it compares with similar towns, what to do first, what data is missing. It has one level, the full details. The short level "במבט אחד" and its switch were retired on 2026-11-01 at the owner's request; old addresses with `?v=` or `#/c/<key>/simple` still open the page. Contract: `docs/SIMPLE.md`.
- **Four categories.** The 41 figures are shown as ילדים והורים, בריאות ושירותי בריאות, נפש ורווחה and בטיחות, plus a background line about the town. The server still groups them in nine domains; the product regroups them at the boundary (`web/js/product/city/groups.js`). A category page shows its figures in closed topic groups (13 in all), each with a one-sentence summary before it opens. An old `overview` or `d/<old domain>` address redirects.
- **Official targets.** 13 Ministry of Health targets judge a figure's status; 2 related targets and 3 international reference points are shown for orientation and never judge; 26 figures have no verified official reference (`docs/METHOD.md`, `research/GUIDELINES.md`). A figure that meets its target and does not deteriorate is at least "תקין".
- **Cards on marks.** What shows on hover, keyboard focus or touch adds information (the national value with its year, change, best and worst year, cases, status, source, definition, the target); a card that repeats the visible text is hidden.
- **Report, share, CSV, print.** "הדפסת דוח" opens `#/c/<key>/brief`, two A4 pages. Share copies `/s/<key>`, a server page whose preview shows the verdict. A CSV button per page and `/api/city/<key>/export.csv` from the server. Every page prints without menu and bars, and the dark theme prints light.
- **Other pages.** Category (`d/<id>`), figure (`i/<id>`), trends, compare, plan, ask, coverage and method; the glossary, the accessibility statement and the privacy page open inside the town (`#/c/<key>/glossary` and so on; `#/glossary` for a visitor with no town).
- **Honesty.** A figure on too few cases is never ranked, trended, coloured or sentenced, and a very small town gets no comparison with the nation or with similar towns. Every row says what it is of and which way is good.
- **Privacy.** No cookies, no analytics, no third party. The device keeps only the keys listed in `web/js/product/config.js` `KEYS` (the privacy page lists the same set).
- **Feedback.** "דווחו על טעות" in the footer posts to `POST /api/feedback`; without the server it offers a report to copy.
- **Known limits.** Not tested in Safari, Firefox, with a screen reader or on a real printer; the CSV column "תחום" and the generated briefing text still use the nine old labels; a clinic town is not the place of residence. Full list: `docs/PRODUCT.md` section 13.

## מבנה

```
src/catalog/    מה נמדד: מדדים, תחומים, מקורות, ספריית פעולות, בסיס ראיות (evidence.json)
src/collect/    איסוף: מאסף לכל סוג מקור (ckan_rate, ckan_events, ckan_authority, xlsx_table, xlsx_panel, arcgis_table, arcgis_registry, arcgis_quarterly, json_table, cbs_series, master), רשימת היישובים, בניית המאגר data/store/store.json
src/model/      הניתוח: store, analyze (מדד אחד), guide (יעדים רשמיים ונקודות ייחוס), findings (ממצאים), city (מודל יישוב), recommend (המלצות), summary
src/agent/      סוכן השאלות: planner (מודל או מילות מפתח), spec (בדיקת התוכנית ומילוי מספרים), guard, briefing (תקציר מנהלים), discover (חיפוש מערכי נתונים), rules
src/lib/        עזרים: http, config (הגדרות), llm (שני תפקידים, מאזן ותקרות), stats, format, names, וליד השרת: css-bundle (חבילת העיצוב /css/n.bundle.css), compress, export (CSV), feedback, share-state
src/tools/      כלי בדיקה בדפדפן וגשושיות (ui_smoke, a11y_check, motion_check, product_matrix, consistency_probe, small_town_probe, chrome_probe, first_screen_probe, tips_probe, dialog_focus_probe, perf_probe, contact_sheet, shot, cdp, gen_docs); רשימה ב-docs/PRODUCT.md
src/api.js      ה-API: /api/health, /api/city/:key, /api/city/:key/indicator/:id, /api/city/:key/briefing, /api/city/:key/export.csv, /api/search, /api/compare, /api/meta, /api/llm, POST /api/ask, POST /api/feedback
server.js       שרת הקבצים: ETag ו-304, דחיסה (קבצים סטטיים וחבילת העיצוב: brotli ברמה 11, פעם אחת לכל קובץ וגרסה, ברקע אחרי ההפעלה; תשובות ה-API ברמה מהירה; CITYPULSE_NO_WARM=1 מבטל את החימום), כותרות אבטחה, robots.txt, sitemap.xml, דפי שיתוף /s/<קוד>, /css/n.bundle.css
web/            הממשק (RTL, עמוד כניסה בלי תפריט, תפריט צד כחול, בהיר וכהה, מותאם לנייד, בלי build)
  js/viz/       הגרפים, בחמש משפחות, עם גלריה לכל משפחה (gallery-*.js)
  js/pages/     קובץ לכל מסך (סקירה, תחום, מדד, מגמות, השוואה, פעולות, שאלה, שיטה) וכרטיסים משותפים
  css/          app.css (טוקנים), layout.css (רכיבי הרכבה), motion.css, viz/ ו-pages/ לפי משפחה ולפי מסך
  n.html        כניסת המוצר; js/product/ (הקליפה, city/ עמוד היישוב והקטגוריות, simple/ בחירת השורות והמילים, brief/ הדוח, entry/ הכניסה, pages/ העמודים, kit/) ו-css/product/ (טוקנים וסגנונות), assets/product/ (תמונות), assets/fonts/ (Heebo)
ops/            כלים לריצת הלילה (לא חלק מהמוצר): מדידת צריכה שבועית של Claude Code ועצירה ב-80%
research/       הממצאים של סוכני המחקר: כרטיסי מערכי נתונים שנבדקו, מסגרת ראיות, יעדים והנחיות רשמיים (GUIDELINES.md, guidelines.json)
docs/           תיעוד: INDICATORS ו-METHOD נוצרים מהקוד; PRODUCT, SIMPLE, QA, RELEASE, CHANGES ו-CREDITS נכתבים ביד
tests/          בדיקות
```

## זרימת הנתונים

1. `collect` מוריד את הנתונים מהמקורות הרשמיים (עם ניסיון חוזר ומטמון של 12 שעות) ומסכם לפי יישוב ושנה. בטיפות חלב יש גם פילוח לפי מגזר ורמה חברתית-כלכלית. מקור שמזהה יישוב בשם בלבד מותאם לקוד הלמ״ס, ושורה שאינה יישוב במודל (מועצה אזורית, מחוז) מושמטת.
2. `build_store` מצמיד את שמות היישובים לקוד הלמ"ס, ממלא יעדים חסרים מדוח משרד הבריאות, וכותב קובץ אחד ש-API קורא.
3. `buildCityModel` מחשב לכל מדד: מיקום בדירוג, מגמה, פער מהארץ, מהיעד ומישובים דומים, פערים פנימיים, סטטוס ועדיפות; מהם נגזרים ממצאים, ומהממצאים נגזרות המלצות.
4. הממשק מציג את המודל. הסוכן משתמש באותו מודל.

## מקורות הנתונים

| מקור | מה בו | מאסף |
|---|---|---|
| משרד הבריאות, התוכנית הלאומית למדדי איכות (data.gov.il) | 13 מדדי טיפות חלב וחיסונים, 2020–2024 | `ckan_rate` |
| משרד הבריאות, שירות בריאות התלמיד (עולם הדאטה) | עודף משקל והשמנה בכיתות א׳ ו-ז׳, 2013–2025 | `arcgis_table` |
| משרד הבריאות, היפגעות ילדים (עולם הדאטה) | ביקורי מיון ואשפוזים בשל פגיעה, 2020–2024 | `json_table` |
| משרד הבריאות, מרשם השירותים הרפואיים של קופות החולים (עולם הדאטה) | רופאי משפחה ורופאי ילדים רשומים ונקודות שירות לבריאות הנפש לכל 10,000 תושבים, תמונת מצב של אוגוסט 2026 | `arcgis_registry` |
| משרד הבריאות, זמני המתנה לרופא מומחה בקהילה (קיצור תורים) | ממוצע ימי ההמתנה לחמש ההתמחויות השכיחות ולרופא נשים, 2019–2025 | `arcgis_quarterly` |
| הלמ״ס, מדדי איכות חיים בערים גדולות (ממשק הסדרות) | תחושת דיכאון ובדידות, שביעות רצון משטחים ירוקים ורעש חיצוני, ל-17 הערים הגדולות | `cbs_series` |
| הלמ״ס, הרשויות המקומיות בישראל | תוחלת חיים, תמותה מתוקננת, תמותת תינוקות, סוכרת, 2016–2024 | `xlsx_panel` |
| הלמ״ס, קובץ היישובים והמדד החברתי-כלכלי | אוכלוסייה, גידול, אשכול חברתי-כלכלי | `master` |
| הלמ״ס, תאונות דרכים עם נפגעים (data.gov.il) | תאונות קשות והולכי רגל, 2018–2024 | `ckan_events` |
| ביטוח לאומי, דוח ממדי העוני | עוני נפשות, ילדים וותיקים, 2022–2024 | `xlsx_table` |
| משרד הרווחה, תיק התערבות (data.gov.il) | מקבלי שירות במחלקות לשירותים חברתיים, 2021–2025 | `ckan_authority` |

כתובות, תנאי שימוש והערות לכל מקור: `src/catalog/sources.js`. ההגדרה, האזהרות והסיבה לכל מדד: `docs/INDICATORS.md`.

## הוספת מדד

1. רשומה ב-`src/catalog/indicators.js` (הגדרה, כיוון, חשיבות, מקור, הוראות איסוף).
2. אם יש יעד או הנחיה רשמית מאומתים: `guideline` או `benchmark` ברשומה (הצורה בכותרת הבלוק `GUIDELINES` ב-`indicators.js`), עם המסמך ב-`sources.js`; אם אין, שורה ב-`NO_TARGET` (`web/js/product/kit/guide.js`). כל מדד גם צריך נושא ב-`TOPICS` (`web/js/product/city/groups.js`); בדיקה נכשלת אם חסר.
3. `npm run refresh` ואז `npm test`.
4. אם יש התערבויות מבוססות ראיות למדד: להוסיף ל-`src/catalog/interventions.js` עם מזהי ראיות מ-`evidence.json`. בדיקה אוטומטית מוודאת שהמלצה לא טוענת לראיות חזקות יותר ממה שהמקורות שצירפה תומכים בו.

## מגבלות

ראו `docs/METHOD.md`. בקצרה: מדדי טיפת חלב הם לפי יישוב התחנה ולא מקום המגורים; מדדי התוצאה של הלמ״ס הם ממוצעים של חלון שנים (חמש או שלוש) ולכן משתנים לאט וחופפים משנה לשנה; תמותת תינוקות ותוחלת חיים קיימות רק ליישובים גדולים, כי שיעור שמבוסס על מעט מקרים מושמט; הממוצע הארצי אינו יעד; מדדי הרישום (רופאים ושירותי נפש) הם תמונת מצב אחת בלי מגמה, סופרים נותני שירות ביישוב ולא את מי שמקבל שירות, ואינם מראים היקף משרה; סדרות הסקר החברתי של הלמ״ס קיימות רק ל-17 הערים הגדולות ויש בהן טעות דגימה, ולכן הן מתארות ואינן שופטות; אין מדד בתי מרקחת, כי הספירה ברישום אינה אחידה ומשרד הבריאות אישר ב-2021 שאין בידיו קובץ מרוכז; ההמלצות הן נקודת פתיחה לדיון מקצועי ולא ייעוץ קליני. במוצר: הוא לא נבדק בספארי, בפיירפוקס, בקורא מסך ובמדפסת אמיתית; עמודת "תחום" בקובץ ה-CSV והתקציר שהשרת כותב עדיין משתמשים בתשע תוויות התחום הישנות (`docs/PRODUCT.md`, סעיף 13).
