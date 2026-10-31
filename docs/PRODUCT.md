# CityPulse, the product (mode N): handbook for the next maintainer

The product is the second front end of CityPulse V2: its own entry file `web/n.html`, its own code in `web/js/product/` and its own styles in `web/css/product/`. The old app (`web/index.html` and everything it loads) still works and is byte-identical to its baseline (`tests/product-old-untouched.test.mjs`; the one deliberate exception is in `docs/RELEASE.md`). Both run side by side on the same server until the owner decides otherwise (`docs/RELEASE.md` section 8).

Open it: `http://localhost:8800/n.html` (entry page) and `http://localhost:8800/n.html#/c/1031` (Sderot, a town with complete data). Start the server with `node server.js` (Windows: `start.cmd`). There is no build step: the browser loads the files as they are, and the server joins the stylesheets into one bundle on request.

The interface is Hebrew and right to left. Hebrew strings are quoted here as they appear on screen; this document is English.

**What the product is, in four lines.** A town has one page with two levels, "במבט אחד" and "הפרטים המלאים". The 41 figures of the server's nine domains are shown as four categories and a background line. Every figure is judged against the other towns and, where an official target exists, against that target. Every number on a screen is a field of the model or is computed from fields in code; no language model writes a number.

## 1. Routes

Hash routes, the same scheme as the old app, so a link written by an old page stays inside `n.html`. The table is `ROUTES` in `web/js/product/routes.js`; the URL helpers are in `web/js/product/nav.js` (`SUBS`, `TOP`, `QUESTIONS`).

| Hash | Route id | What it shows | Module |
|---|---|---|---|
| `#/` | `entry` | Headline, town search, "המעקב שלי", trust numbers, a live sample sentence, the sources | `entry/entry.js` |
| `#/c/<key>` | `home` | The town page, both levels (section 2). `?v=simple\|full` picks the level for that visit; `?q=weak\|changed\|peers\|first\|missing` scrolls to a section (an unknown `q` becomes `weak`) | `city/home.js` |
| `#/c/<key>/simple` | `simple` | An alias: the same page at the short level, without writing the stored choice | `city/home.js` |
| `#/c/<key>/brief` | `brief` | "דוח ליישוב", two A4 pages. No menu item: the town page reaches it with "הדפסת דוח" | `brief/brief.js` |
| `#/c/<key>/overview` | `overview` | Redirect (replace) to `#/c/<key>`, `?q=` kept | `routes.js` |
| `#/c/<key>/d/<categoryId>` | `d` | One category (`child outcomes mental safety`) or the background `context`. An old `d/<one of the nine domain ids>` redirects (replace) to its category | `pages/domain.js` |
| `#/c/<key>/i/<indicatorId>` | `i` | One figure with its history and its official target | `pages/indicator.js` |
| `#/c/<key>/trends` `compare?with=a,b` `actions` `ask?q=` `coverage` `method` | same | Trends, comparison with other towns, plan, question field, data coverage, method with the town | `pages/<name>.js` |
| `#/method` | `gmethod` | The method page without a town | `pages/method.js` |
| `#/c/<key>/glossary` `accessibility` `privacy` | same | The three information pages inside the town: the town menu stays and the way back is the town (`#/c/<key>/glossary#concern` scrolls to one term) | `pages/<name>.js` |
| `#/glossary` `#/accessibility` `#/privacy` | same | The same pages for a visitor with no town (town-less menu). Links written in a town page never use these forms: `nav.infoHref(page, key)` and `glossaryHref(id)` build the right one | the same files |

Rules of the router (`app.js`):

- `#/lab*` leaves the product. An unknown sub-route under a valid town replaces itself with the town page. A bad key shows a not-found state inside the shell.
- Every redirect is `nav.go(hash, { replace: true })` or a View with `redirect`, never `location.hash =`, so Back is never trapped (a test greps for the forbidden form). Old `?q=simple` on the town page is sent to the alias.
- `document.body.dataset.route` carries the route id; the alias takes the value `home` and sets `body.dataset.alias = "simple"`. CSS keys on it (`shell.css`: the compact search of the town page).
- `d i trends compare actions ask coverage method` are adapters (`adapt(node, ctx)`) around the old page modules. They may restyle, move, hide and replace text, never fetch data the old page did not fetch, never import page-private modules, and the old modules are never edited. The contract is `web/js/product/README.md`.

## 2. The town page

One page, `#/c/<key>`, builds the whole story of a town. The binding description of the merge is `design-ideas/product/MERGE.md`; the contract of the rows and the limits is `docs/SIMPLE.md`. A copy of the product before the merge is in `design-ideas/product/baseline/product-before-merge/`.

**Head** (the shared band, `band.js homeBand`): the town name (the one h1), a facts line (kind, residents; the full level adds district and cluster), the level switch (two underlined texts in a `nav`, no capsules), the actions (share, "הדפסת דוח" = link to `brief`, the town's CSV, star). The full level adds the basis line (how many of the 41 figures have data, the years, the update date), the background line ("רקע על היישוב": growth and poverty as plain figures, link to `d/context`) and the question field.

**Sections, in story order** (ids are read by the tools): `n-sec-state` how things stand (the verdict sentence, the one segmented bar with its counts; the full level adds a row per category); `n-sec-good` what goes well (at most 3 rows, 6 on the full level); `n-sec-weak` what needs attention (3 rows and "עוד N" on the short level; every figure that needs treatment or follow-up, grouped by category, on the full level); `n-sec-changed` what changed and `n-sec-peers` how it compares with similar towns (full level only; peers dropped for a town with no comparable towns); `n-sec-first` what to do (the first step; the full level shows three and links to the plan page); `n-sec-missing` what has no data; then the foot (sources and date once, what "דורש טיפול" means, the report-a-mistake link). The short level prints on one A4 page.

**Kinds of town.** A very small town (some figures on small groups, fewer than half judgeable: `isVerySmallTown`) gets a calm sentence, "אלה המספרים שיש, בלי שיפוט." and the numbers as they are (`n-sec-small`). A town the sources do not cover gets the no-data spot, no level switch and no question field.

**Which level opens** (`simple/pref.js chooseLevel`, pure): `?v=`, else the alias route or `?q=simple`, else a `?q=` that names a section (full level only), else the stored choice (`cp2-view-2`, `simple` or `full`), else the full level. The switch redraws the sections in place: no new history entry, scroll and focus stay, one polite announcement, the choice is stored. The alias and `?v=` never write the choice. There is no redirect.

**One town, one answer.** The verdict, the legend, the category rows, the attention lead, the briefing, the coverage page and the share preview state the same counts (`tests/product-consistency.test.mjs`, `src/tools/consistency_probe.js`). The code that makes it so: `city/data.js` (counts, weakest-first order), `city/sentence.js` (sentences for the page, the share preview and the briefing), `simple/model.js` (which rows), `city/sections.js` (the DOM of each section).

**Share and print.** Share copies `/s/<key>` (`?q=simple` for the short level, `?q=weak` for the full level), a server page whose preview shows the verdict; without the server feature it copies the hash link. Every page prints without menu and bars, and the dark theme prints light.

## 3. Categories and topics

The server groups the 41 figures into nine domains by where the data comes from. The product regroups them where the model enters (`city/groups.js regroup()`, applied by `net.js` and by the fetch guard that serves the old modules, so every screen speaks the same categories):

| id | label | figures |
|---|---|---|
| `child` | ילדים והורים | 13 (immunization, child, nutrition, and `th_firstvisit`) |
| `outcomes` | בריאות ושירותי בריאות | 8 |
| `mental` | נפש ורווחה | 8 |
| `safety` | בטיחות | 4 |
| `context` | רקע על היישוב (a line on the town page and `d/context`, never a menu category) | 8 |

The menu and every list of categories show only the four. `regroup` also rewrites the sentences the server wrote from the old labels (findings, the generic recommendation, the summary headline) and `/api/meta`, one figure's detail and the answer of the ask page are regrouped at the boundary the same way (the audit is the header of `groups.js`).

The category page shows its figures as closed, openable topic groups, 13 in all (`TOPICS` in `groups.js`; `pages/domain.js groupFigures`). Each group has a summary row (name, one sentence such as "4 מתוך 5 דורשים טיפול", a short bar) before it is opened; the topic that needs the most attention comes first and is open on the first visit; "פתיחת הכול" / "סגירת הכול" opens or closes all; print opens all. Every figure is in exactly one topic (`tests/product-topics.test.mjs`); a future 42nd figure needs a line in `TOPICS`.

Professional pictograms (Tabler Icons, MIT, `kit/catart.js`) mark the categories; the credit and the licence are in `docs/CREDITS.md`.

## 4. Official targets and reference points

The status of a figure used to rest on rank among towns alone. Now each figure says whether an official, sourced reference exists. The rules and the list are generated into `docs/METHOD.md` (section "יעדים רשמיים ונקודות ייחוס"); the research is `research/GUIDELINES.md` and `research/guidelines.json`; the code is `src/model/guide.js` (server) and `web/js/product/kit/guide.js` (words).

- 13 figures have a Ministry of Health target that judges the status. 2 more have a related official target that is shown for orientation and never judges (infant mortality, severe road injuries). 3 figures have an international reference point that is not a target (it never touches status, rank or recommendation; the 3 are among the 26). 26 figures have no verified official reference.
- A figure that meets its target and does not deteriorate is at least "תקין", and "חוזק" needs rank 75 and the target met (`held` in `src/model/analyze.js`; the lift is an open decision, `docs/RELEASE.md` section 8).
- Where it shows: a line and a tick under the bars of a row (town page, category page), the panel on a figure's page (target, distance in words, the source link, or why there is none: `NO_TARGET`), the card of a mark, the method page (section "יעדים רשמיים"), a paragraph on the coverage page, the glossary ("יעד רשמי", "יעד להתמצאות", "נקודת ייחוס": the three words of the references; "יעד רשמי" judges, "יעד להתמצאות" never does, "נקודת ייחוס" is a foreign figure). On a figure's page each panel says what the reference is, who published it and the year; the target says where the figure stands, the other two say that they are context and do not change the status; the sentence under the title names a met target even when the trend is what decides the status (`reasonOf`).
- The evidence framework behind the recommendations (`research/evidence-framework.json`, built into `src/catalog/evidence.json` by `npm run evidence`) no longer carries claims the research rejected; the changes are listed in the file's `meta.change_notes` and pinned by `tests/evidence-claims.test.js`.

## 5. Cards on marks (hover, focus, touch)

A card that shows on a mark must add something the page does not already say next to the mark. The old chart modules build the card; `kit/tips.js` (loaded after the first paint, never edits them) adds the national value with its year, the change from the previous year and since the first year, the best and worst year, the cases behind a figure, the status, the publisher and definition, and the official target of the card's own year (for a figure that has one it is the first extra, `planFor`: a card on a year of such a figure says who published the target and whether that year met it). A row the page already shows is dropped, and a card with nothing new is hidden (`isRedundant`). A small group gets only its cases and "קבוצה קטנה, ללא שיפוט". On touch the card stays until the next tap. Tests: `tests/product-tips.test.mjs`; browser check: `src/tools/tips_probe.js`. Details: `kit/README.md`.

## 6. What a person can do

| Feature | Where | How it works |
|---|---|---|
| Find a town | entry page, top bar, `/` key | `kit/townsearch.js`; recent and followed towns live on the device |
| Switch level | head of the town page | section 2 |
| Report | "הדפסת דוח" on the town page, `#/c/<key>/brief` | `brief/doc.js` (pure) builds it from the model, `brief/brief.js` draws it, `brief/print.js` fills date and address |
| Share | share button | section 2; falls back to the hash link when `/api/health` says `features.share` is false |
| CSV | the town's CSV, a CSV button per page | `kit/csv.js` builds a file in the browser (UTF-8 byte order mark; text starting with `= + - @` gets a leading `'`); the server builds the whole-town file (`/api/city/<key>/export.csv`) |
| Glossary | `#/c/<key>/glossary`, term buttons in sentences | `kit/glossary.js` is the only table of terms (16); `kit/term.js` opens one in a dialog |
| Feedback | footer "דווחו על טעות" | `kit/feedback.js` posts to `POST /api/feedback`; without the server it offers a report to copy |
| Keyboard | `/` search, `?` help, `Esc` | `kit/helpsheet.js`; the single-key shortcuts have an off switch (WCAG 2.1.4) |
| Theme | sun and moon button | `data-theme` light or dark |

What the device keeps is exactly `KEYS` in `web/js/product/config.js` (theme, recent, last, fav, welcome, shortcuts, from, view = `cp2-theme cp2-recent cp2-last cp2-fav cp2-welcome-n cp2-keys cp2-from cp2-view-2`), and the privacy page lists the same set (`tests/product-simple.test.mjs` compares them). Nothing leaves the device except requests to this server: no cookies, no analytics, no third-party host (a test checks `n.html`).

## 7. The honesty rules

- **A figure on too few cases is never judged.** `src/model/analyze.js` marks it `reliable: false`: no rank, trend, priority, sentence or target distance. It is shown as it is, and the card says so.
- **A very small town.** For such a town (`isVerySmallTown`) a background figure gets the one plain line `NO_COMPARISON`, "הקבוצה קטנה, ולכן אין השוואה לממוצע הארצי", and no comparison with the nation or similar towns on the town page, the figure page, the category page and compare. What is left on towns 16 and 7 is in `design-ideas/product/NEEDS/w4b.md`.
- **Say what a figure is of and which way is good**, on every row, chart and card.
- **Plain words.** The forbidden words of SPEC 7.1 ("מובהק", "אחוזון", "המודל") never reach a screen (`tests/product-copy.test.mjs`, `product-questions.test.mjs`, `product-simple.test.mjs`, fixture towns 1031, 16, 7, 935, 99, 472, 2710).
- **The voice** is the neutral third person with the town's name, never "we"; plural second person for the reader ("לחצו"); no slash forms. `tests/product-voice.test.mjs` scans every string and template literal in `web/js/product/**` and every `content:` string in `web/css/product/**`. The old modules still say "we" in a few sentences and cannot be edited: `neutral.js` swaps them on the screen (table `PHRASES`).

## 8. Resilience

Code: `web/js/product/net.js`, `app.js`; test: `tests/product-resilience.test.mjs`.

- Every read does its own `fetch` with a 10 second limit that aborts the request (`NET.timeoutMs`); one retry after 0.8 s, only for offline, timeout and 5xx. Only a whole, good answer is kept.
- Error classes (`KINDS`): `offline timeout server badanswer notfound nodata unknown`, each with its own words and a retry button that fetches again. After 6 seconds on a skeleton the page adds one quiet line.
- Keys are validated before any request (`isKey`), the model before any view receives it (`isModel`). `installGuard()` gives the old modules' own requests the same limit and regroups the model.
- Storage is capped, validated, and never throws when blocked (`storage.js`).
- Dialogs (`kit/base.js openDialog`): one native `<dialog>`, `aria-modal`, the page behind `inert` (`holdPage`), focus returns to the opener. The feedback dialog shows "שולח…", ignores a second press and gives up after 15 seconds keeping the typed text.

## 9. Server features (by Bob)

Served by `server.js` and `src/lib/`; tests `tests/server-*.test.*` and `export.test.js`. Static files with ETag and 304; brotli or gzip; security headers; `/robots.txt` and `/sitemap.xml`; share pages `/s/<key>` (preview of the verdict, then a redirect to `SHARE_TARGET`); `/css/n.bundle.css` (the stylesheets joined; `docs/RELEASE.md` section 2); `POST /api/feedback` (appends to a file, 5 reports per client address per hour, stops at 5 MB); `GET /api/city/<key>/export.csv`; a styled 404 page; `GET /api/health` with `features`. Hardening: prototype names are not localities, a `Host` header that is not a plain host name is ignored, odd methods answer 405 with `Allow`, a null byte answers 400. The settings are in `README.md` and `docs/RELEASE.md`.

## 10. Layout of the code

- `web/n.html`: the entry. It runs two inline lines (theme and motion class) before the first paint, links `css/n.bundle.css` (with an `onerror` fallback to the six sheets), preloads two font subsets and carries the `modulepreload` list generated by `node src/tools/perf_probe.js --preload` (`tests/product-perf.test.mjs` demands equality).
- `web/js/product/`: `boot.js` starts `app.js` (router), which reads `routes.js`. Also `shell.js` (menu, top bar, footer), `band.js`, `net.js`, `storage.js`, `live.js`, `seo.js`, `config.js`, `nav.js`, `chartfit.js`, `neutral.js`. Folders: `city/` (the town page, categories, sentences), `simple/` (which rows, their words, the level choice), `entry/`, `brief/`, `pages/`, `kit/`.
- `web/css/product/`: `tokens.css` (the only place for hex colours), `shell band states kit entry home brief` and `pages/*.css`. `web/css/product.css` imports them; `web/css/pages-n.css` imports the old page styles the adapters reuse.
- `web/assets/product/` (icons, manifest images, share pictures, band pictures) and `web/assets/fonts/` (Heebo, self-hosted).

Rules that bind every change: `DESIGN_V3.md` section 9 and `web/js/product/README.md`. In short: one accent colour; colours only as tokens; no coloured side stripe; no text in capsules; motion only through the verbs of `css/motion.css` and `.wash`; every css file has one class prefix and no prefix is in two files; every top-level css rule starts with `html[data-ui="n"]`.

## 11. Tools

Browser tools need Chrome and the server on port 8800; set `CDP_SLOT=<n>` so two runs never share a Chrome profile. They only read and none starts a server. Numbers of the last runs: `docs/QA.md`.

| Command | What it does |
|---|---|
| `node server.js` | the dev server |
| `npm test` | the whole suite, no browser needed |
| `npm run smoke:n` | opens every route at desktop and phone width: console errors, failed requests, overflow, missing h1, old category words |
| `npm run a11y:n` | headings, names, focus, target sizes, contrast pairs, landmarks |
| `npm run motion:n` | only the allowed motion verbs; the final state under reduced motion |
| `npm run matrix:n -- --subset` (`src/tools/product_matrix.js`) | town x width x theme x route with a check list per load; writes `design-ideas/product/qa/matrix.md` and `.json`, so pass `--out=<path>` for a throwaway run |
| `node src/tools/consistency_probe.js 1031,16` | the town page, the briefing and the coverage page of each town state the same count, weakest category, first step and coverage; exit code 1 on a disagreement |
| `node src/tools/small_town_probe.js 16,7,472,935` | searches the visible text of every route for rank words and comparisons where a town is too small to have them |
| `node src/tools/chrome_probe.js --mode=targets\|reflow\|nav\|groups` | pointer targets under 24 px; sideways scroll at 320 px with 200 percent text; every old address lands right and the level switch works (`--only=redirect\|switch\|info`); the topic groups of the category page |
| `node src/tools/first_screen_probe.js` | where the verdict sentence starts against the window height, 13 sizes |
| `node src/tools/tips_probe.js --towns=1031,16,9000 --touch` | hovers, focuses and taps every mark; fails when a card that stays repeats what its section says |
| `node src/tools/dialog_focus_probe.js` | the feedback dialog with real key events and a held POST (nothing reaches the server) |
| `node src/tools/perf_probe.js` | requests, bytes, third parties, FCP, LCP, CLS, 304s; `--quick`, `--json=out.json`, `--preload` |
| `npm run contact:n -- --cols=3 --out=sheet.png a.png::caption ...` | many screenshots in one picture |
| `npm run shot -- <url> <out.png> [width] [mobile=0\|1] [--dark]` | one full-page screenshot |
| `npm run docs` | regenerates `docs/INDICATORS.md` and `docs/METHOD.md` (never edit them by hand) |

`SMOKE_ONLY`, `A11Y_ONLY` and `MOTION_ONLY` take a regular expression over the route.

## 12. How to add a screen

See `web/js/product/README.md` and `DESIGN_V3.md` section 9.7. A file under `web/js/product/<area>/` exporting the function the route table names; a View with a band; a CSS file with its own class prefix; a route line in `routes.js` (and `PAGES`, and `SUBS` of `nav.js` for a town sub-route); then the three browser checks and `npm test`. The product is meant to get smaller, not bigger: a new page, route or menu item needs the owner's yes.

## 13. Known limits

- Not tested in Safari or Firefox, with a screen reader (NVDA, VoiceOver), in Windows High Contrast, or on a real printer; print was checked as PDF page counts through the DevTools protocol. Manual steps: `docs/QA.md` section 4.
- The CSV column "תחום" and the generated briefing text (`/api/city/<key>/briefing`) still use the nine old catalogue labels (server side, `design-ideas/product/NEEDS/m1.md`). The product reads neither the briefing nor the CSV text; the CSV is a download.
- The clinic town is the town of the Tipat Halav station, not the place of residence, and the CBS outcome figures are multi-year averages (`docs/METHOD.md`, "מגבלות").
- Over HTTP/1.1 (the dev server) the modules are still fetched one by one; performance numbers are in `docs/QA.md`.
- Open items on old modules: `design-ideas/product/NEEDS/w3a.md` (target sizes and reflow at 320 px with 200 percent text) and `NEEDS/w4b.md`.
