# What changed during the product build

The project folder is not a git repository, so there is no commit log. This list is rebuilt from the work reports in `design-ideas/product/DONE/` (one per work package, named in brackets) and from the files themselves; times are when a report was written, and a report may be thin (a package that stopped says so). The first work was the seven audits in `design-ideas/product/audit/` on the evening of 2026-10-29. Nothing was deleted from the old app: it is byte-identical to its baseline (`tests/product-old-untouched.test.mjs`) except for the lab card described under "Release". Where a later change retired something, it says so; the current state is `docs/PRODUCT.md`.

## 2026-11-02: Haiku for every call

- At the owner's request the "reason" role (the city briefing of the older app at `/index.html`; the product never calls it) defaults to Claude Haiku 5.5 like the "search" role, which already planned and worded the whole ask page. Both roles run Haiku without reasoning; a Sonnet-class model named in `LLM_MODEL_REASON` still runs at low effort with headroom (`src/lib/llm.js`, `tests/llm.test.js`). Texts that said Sonnet words the answer were out of date and are corrected (`docs/COMPETITION.md`, `README.md`, `docs/RELEASE.md`, `.dev.vars.example`).

## 2026-11-01 (evening): the chat of the Orchestrate agent in the ask page

- At the owner's request the watsonx Orchestrate agent "CityPulse" can be talked to inside the site: the ask page ends with a section whose button opens IBM's embedded chat as a panel in the page (`kit/orchestrate.js`, the values in `config.js`, styles `n-pg-ask-agent-` in `css/product/pages/ask.css`). IBM's script is requested only when the button is pressed, once; a failure or a timeout shows one line and the question field keeps working; a second visit to the page restarts the chat in the new panel. The privacy page has a paragraph about it. The embed works only with IBM's Embed Security switched off for the instance (section 4 of `docs/ORCHESTRATE.md`). `tests/product-orchestrate.test.mjs`, 10 tests.

## 2026-11-01 (morning): the short level is retired

- At the owner's request the town page has one level, the full details. The switch "במבט אחד | הפרטים המלאים" is gone from the head, `simple/pref.js` and the stored choice (`cp2-view-2`) are deleted, `?v=`, `?q=simple` and the alias `#/c/<key>/simple` still open the page (they show the full level), the share button always shares `?q=weak`, the entry page and the privacy page no longer describe two levels. The tests and the browser probes that drove the switch now check that it is absent. The code of the short rows stays in `city/sections.js` (nothing opens it).

## 2026-10-29 (evening): plan and foundation

- Seven audit documents and the plan `design-ideas/product/SPEC.md` with `SPEC-ADDENDUM.md` (binding): the product is its own entry file, not a switch inside `index.html`.
- [p1a] `web/n.html`, the manifest, the self-hosted Heebo font, `web/css/product.css`, `pages-n.css`, `tokens shell band states`; the shell in `web/js/product/` (`boot app routes nav shell band net storage live seo config`) with fallbacks to the old page modules; `kit/{townsearch,states,star,helpsheet}.js`; `design-ideas/product/baseline/` (sha256 of the old files, a copy of the old `web/`) and its test; `--n` mode for `ui_smoke`, `a11y_check`, `motion_check`.
- [p1b] The content kit (`csv glossary term feedback provenance actions plural from share base`), `kit.css`, `kit/README.md`; the glossary rules were checked against `analyze.js` and corrected.
- [p2] The product's pictures in `web/assets/product/`.
- Server work by Bob: static files with ETag and 304, brotli or gzip, security headers, `robots.txt`, `sitemap.xml`, `POST /api/feedback`, `features` in `/api/health` (`server.js`, `src/api.js`, `src/lib/{compress,feedback,share-state}.js`).

## 2026-10-30 (night): the pages, the quality pass, resilience

- [p3, p3b, p3c, p4, p45, p5] The town home with five answers as tabs, the briefing `#/c/<key>/brief` (two A4 pages), the entry page, the analysis and tool pages as adapters of the old modules with their own styles. (The tabs, the overview page and the separate simple page were retired in the merge below.)
- [doc, qa1, rt] First documents, the QA matrix tool (`product_matrix.js`, `contact_sheet.js`), the red-team report (`design-ideas/product/qa/REDTEAM.md`), 40 modulepreload hints and `perf_probe.js`.
- [r1, r2, r3] Fixes from the red team: Back, the indicator page opened from an answer, grammar, `chartfit.js` (chart text never under 12 px), print in the light theme, the method page, a search list that no longer holds Tab. Server hardening (`tests/server-hardening.test.mjs`).
- [sv1, sv2] The "במבט אחד" page, its choice stored under `cp2-view`, rows that never contradict their heading. (Now a level of the town page.)
- [w1] `net.js` rewritten: own fetch with a 10 second limit that aborts, one retry, the class `badanswer`, key and model validation, `installGuard()`, the slow-loading line; `tests/product-resilience.test.mjs`.
- [w2] One town, one answer across screens (`product-consistency`, `consistency_probe.js`). The server joins the stylesheets into `/css/n.bundle.css`: a town page from 96 to 55 requests.
- [w3a, w3b] Targets of 24 px, reflow at 320 px, dialogs with `holdPage` and a sending state, the share preview of the short level and `VALID_QIDS` including `simple` on the server.
- [w4a, w4b, w5] The neutral voice (`neutral.js`, `product-voice`); the very small town (`isVerySmallTown`, `NO_COMPARISON`, `small_town_probe.js`); rows that agree with their heading (`standing()`).
- [w6, doc2] Tablet limits; the first full documents.

## 2026-10-30 (day): the merge, the categories and the official targets

- [m3, 11:01] Router and menu: `overview` redirects to the town page, `d/<old domain id>` to `d/<category>`, the menu is the town, the four categories and the tools; the overview adapter, its css and the calm chrome of the simple route were removed; tool route lists and tests follow (`tests/product-menu.test.mjs`).
- [m1, 11:01] The nine domains became four categories and a background line at the boundary: `city/groups.js` (`regroup`, `regroupMeta`, `regroupDetail`, `regroupAnswer`), `net.js` and the fetch guard; the sentences the server wrote from the old labels are rewritten; `ui_smoke` flags any old category word; `tests/product-groups.test.mjs`.
- [m2, 11:13] One town page with two levels: `city/home.js`, `city/sections.js`, the level choice in `simple/pref.js` (no redirect), the in-place switch, `?q=` scroll and focus, the by-category rows, attention grouped by category; `home.css` rewritten; `city/rail.js` and `simple/switch.js` deleted. The package stopped at the usage guard before running the browser tools (listed in its report).
- [qa3, m4, 11:25 to 11:37] Verification and finishing packages that stopped at the usage guard and changed nothing. The owner has since waived usage accounting.
- [u1, 13:40] Glossary, accessibility and privacy open inside the town (`#/c/<key>/glossary` and so on; `nav.infoHref`); professional Tabler icons for the categories replace the illustrated badges (`kit/catart.js`, `docs/CREDITS.md`; the five `.webp` files were deleted).
- [u2, 13:41] The category page shows its figures in 13 closed, openable topic groups with a summary row (`TOPICS` in `groups.js`, `pages/domain.js groupFigures`).
- [b1, 14:07] Official targets in the catalogue, the model and the API: `research/GUIDELINES.md` and `guidelines.json`, `src/model/guide.js`, status rules (a met target is at least "תקין"), 8 appended CSV columns, `{{guide:ID}}` tokens for the ask agent; two catalogue texts corrected. 13 targets judge, 2 are shown for orientation, 3 international reference points, 26 figures have none.
- [t, 14:21] Cards on marks must add information: `kit/tips.js`, `tips_probe.js`, `tests/product-tips.test.mjs`.
- [b3, 14:35] The evidence framework no longer keeps claims the research rejected (the road target, school obesity, a breastfeeding sentence); `tests/evidence-claims.test.js`.
- [b2, 15:34] The official targets on screen: a line and tick on town and category rows, the figure-page panel, the method section, the coverage paragraph, glossary "יעד רשמי" and "נקודת ייחוס", the entry page counts 11 data sources; `kit/guide.js`, `tests/product-guide.test.mjs`; first screen back under the limit; print of the short level fixed for town 472.
- [d1] This documentation pass: README, `docs/PRODUCT.md`, `SIMPLE.md`, `RELEASE.md`, `QA.md`, this file, `DESIGN_V3.md` section 9 and the two READMEs of `web/js/product/` rewritten against the code.

## 2026-10-31: review, fixes and the owner's own findings

- [q1, r1] Full verification and an independent review with the owner's eyes (13 ranked findings, no blocker): `DONE/q1.md`, `DONE/r1.md`.
- [f1] Every row that says "דורש טיפול" or "למעקב" names its cause (`city/data.js causeOf`); one target line; a lede under the verdict counts the figures with an official target; the background line of the head carries years and the catalogue caution. [f2] Panels of target, orientation target and benchmark no longer contradict themselves; a met target is said under the title; the target comes first in hover cards of figures that have one; "יעד להתמצאות" in the glossary. [f3] Method section 07 rewritten for readers; question chips with correct grammar; plain names instead of Latin codes; entry page copy for the merged product. [s1] One population per town in the search and the page; "הרשות המקומית" instead of "עירייה" in server texts; `/api/health` reports the bundle.
- [g1] Pointer targets of 24 px in the head line; the five decorative transitions removed; dead code removed; dark theme, print (short level one A4 page, full level 1031 seven pages, brief two) and the keyboard walk looked at (`src/tools/keys_probe.js`). [g2] `src/lib/compress.js`: brotli 11 for cached static answers with a background warm-up, brotli 6 for JSON: the town page went from 467 KB to 412 KB on the wire; the 16 evidence rules rewritten for readers; "התוכנית" in the catalogue.
- [h2a] The question box reaches the other localities: `src/agent/towns.js` finds towns named in a question, the `towns` block holds a comparison computed from the data (who leads in how many figures), the sentence is the server's, a guard rejects "the system has data on one locality only", Latin codes are replaced by plain names. The planner of the answer now runs on the small model; the strong one is kept for the city briefing. The ask page draws the block (`pages/asktowns.js`).
- Owner's findings in the browser, fixed directly: the town search drew a second frame inside its box and opened its list inside the same row (one ring around the box, the list under the field); the three counts of the compare page (first place, middle, last place) only scrolled and now filter the list and say what is shown; the town page opens on "במבט אחד" and shows the district, the residents, the cluster and the background line on both levels; the menu folds into a rail of icons (`cp2-side`); the story column is centred on a wide window.
- The figure rows of the town page, redone after research (the owner: "load, not charts; clarity matters"). Sources looked at: Few's bullet graph (one bar per measure, the comparison as a short mark, no gauges), the spine charts of the English local health profiles (one row per indicator, benchmark marked on it, grouped by chapter), and Shneiderman's "overview first, details on demand". A figure is now ONE row on both levels: its name, the status with its cause and the way that is good on one side; on the other the town's value as a bar, the country as a diamond on the same scale, the official target as a tick, the values in numbers with the name of what they are of beside the bar (the keys are in the row itself). The old block of two bars and four stacked lines is gone. The full level groups the figures that need attention by category as an accordion (summary row: how many of each; the weakest category open; the "see all" link and `?q=weak` open all; print opens all). The two-column list is gone (one ledger column). The text-only experiment of the short level was taken back. The stored-level key is now `cp2-view-2`. Print: the short level is still one A4 sheet for all ten towns checked (categories two by two, the room kept for the picture dropped, rows tighter); the full level of 1031 is 7 pages, as before. Full level of 1031: about 8,300 px against 9,400 and more before; the short level about 2,800 px.

## Release

- The lab list of the old app got a link card for the product (`web/js/lab/index.js`, three small edits; thumbnails in `web/assets/lab/thumbs/`). `OLD-HASHES.json` was re-baselined once for it (`docs/RELEASE.md` section 4).

## What is in the repository now, by folder

### web/ (the product)

- `web/n.html`, `web/manifest.webmanifest`.
- `web/js/product/`: 58 JavaScript files: 13 at the top (shell, router, net, storage), `city/` (8), `simple/` (3), `entry/` (3), `brief/` (3), `pages/` (11), `kit/` (17); two README files (the shell contract and the kit).
- `web/css/product.css`, `web/css/pages-n.css`, and `web/css/product/` (17 files: `tokens shell band states kit entry home brief` and 9 under `pages/`).
- `web/assets/product/` (19 files), `web/assets/fonts/`, a few working pictures in `web/assets/lab/`.

### src/, server, research

- `server.js`, `src/api.js`, `src/lib/{compress,css-bundle,export,feedback,share-state}.js`, `src/model/guide.js`.
- `src/tools/` (15 files): `ui_smoke a11y_check motion_check` (mode `--n`), `product_matrix consistency_probe small_town_probe chrome_probe perf_probe first_screen_probe tips_probe dialog_focus_probe contact_sheet`, and `cdp shot gen_docs`.
- `research/`: the data-set cards, `evidence-framework.json`, `GUIDELINES.md` and `guidelines.json`.

### tests/, docs/, top level

- `tests/`: 51 test files and three helpers (`tests/helpers/{fake-dom,city-models,voice-scan}.mjs`); the total is in `docs/QA.md`.
- `docs/`: `PRODUCT.md` (handbook), `SIMPLE.md` (the town page contract), `QA.md`, `RELEASE.md`, `CHANGES.md`, `CREDITS.md`; `INDICATORS.md` and `METHOD.md` are generated by `npm run docs`.
- `README.md`: a maintainer's section at the top. `DESIGN_V3.md`: section 9 "Mode N".

### design-ideas/product/ (working papers, not served)

- `SPEC.md`, `SPEC-ADDENDUM.md`, `MERGE.md` (the merge, binding for that wave), `audit/`, `images/`, `qa/`, `baseline/` (`OLD-HASHES.json`, `web-before/`, `product-before-merge/`), `DONE/*.md` (one report per package) and `NEEDS/*` (requests for shared files).
