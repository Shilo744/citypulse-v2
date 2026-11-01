# kit: the content kit of mode N

Small, independent modules. Each imports only `../../ui.js` (`h`, `icon`, `num`, `dateHe`, `iso`) and its own siblings. The pure ones (`plural`, `csv` text functions, `from`, `glossary`, `provenance` text, `share` URL) run in node; the DOM ones are tested against a fake document in `tests/product-kit.test.mjs`. Styles: `css/product/kit.css` (prefix `n-kit-`). No motion of its own: dialogs simply appear, reduced motion changes nothing.

Components return a DOM node; every Hebrew string is the one of SPEC 7.3. Actions are text with an icon (`button.n-kit-act` / `a.n-kit-act`), never capsules; 44 px targets on touch come from the CSS.

## base.js (internal, shared by the others)
- `announce(text)`: says it to screen readers. Uses `window.__cpAnnounce(text)` when the shell defines it, else its own `aria-live` node (`#n-kit-live`). `announce("הקישור הועתק")`
- `act(tag, attrs, iconName, label) -> Element`: an action (`"button"` or `"a"`). `act("button", { type: "button" }, "share", "שיתוף")`
- `setActLabel(el, iconName, label)`: swaps icon and label in place (the "copied" state).
- `safeSession.get(k) / .set(k, v) / .del(k)`: `sessionStorage` that never throws; a memory copy keeps the value until the page closes.
- `openDialog({ title, body, foot, opener, focus, wide, onClose }) -> { dlg, close, closeBtn }`: one native `<dialog>` at a time (a second call closes the first). The platform gives Esc and the focus trap; `aria-modal="true"` is set, the page behind is held with `inert` (`holdPage()`), a click on the dimmed page and a hash change close it, and focus goes into the dialog and returns to `opener` (or to where the reader was). `openDialog({ title: "הקישור", body: [h("p", "...")], opener: btn })`
- `holdPage() -> release`: sets `inert` on every child of `<body>` except dialogs, scripts and the live regions (`#live`, `.n-kit-live`) until `release()` is called; counted, so overlapping dialogs hand over cleanly. The keyboard help sheet uses it too.

## plural.js (pure)
- `cnt(n, one, many, zero?) -> string`: `one` is the whole phrase for exactly 1. `cnt(1, "מדד אחד", "מדדים")` is "מדד אחד"; `cnt(12, ...)` is "12 מדדים"; `cnt(0, ..., "אין מדדים")` is "אין מדדים".
- `cntOf(n, noun, zero?)`: the same for the table `NOUNS` (`metric step day year town domain case question source point`). `cntOf(2, "step")` is "2 צעדים"; `cntOf(1, "year")` is "שנה אחת".
- `more(n, noun)`: `more(1, "step")` is "עוד צעד אחד".
- `cntWord(n, one, many)`: only the word that agrees, for a verb or adjective after the number. `cntOf(n, "metric") + " " + cntWord(n, "חלש", "חלשים")` is "מדד אחד חלש" / "3 מדדים חלשים".
- `countBare(n, gender = "m")`: "אחד" / "אחת" for 1, the digits otherwise. `countBare(1, "f")` is "אחת".
- `withUnit(v, unit, d = 1)`: the unit stands with its value (C-15). `"מ-" + withUnit(17, "days") + " ב-2019"` is "מ-17 ימים ב-2019"; `withUnit(5.7, "per100k")` is "5.7 לכל 100,000"; `withUnit(66.1, "%")` is "66.1%".
- `lacking(gap, unit, { short, d })`: the verb agrees with the unit. `lacking(12, "days") + " ליעד הרשמי"` is "חסרים 12 ימים ליעד הרשמי"; `lacking(13.9, "%", { short: true })` is "חסרות 13.9 נק׳".

Numbers are digits (no "שני"); the space between a number and a word becomes a non-breaking space when the string goes through `h()`.

## csv.js
- `rowsToCsv(rows, columns) -> string`: UTF-8 BOM, comma, CRLF. A column is `{ key, title }`, `{ title, get(row, i) }` or a bare string. Text that begins with `= + - @` (or a tab / CR) gets a leading `'`; numbers stay numbers (pass numbers as numbers, not as strings); quotes, commas and line breaks are quoted. `rowsToCsv([{ v: 5 }], [{ key: "v", title: "ערך" }])`
- `csvCell(v)`: one cell. `BOM`: "﻿".
- `csvName(key, name, date = new Date()) -> string`: `csvName("1031", "all")` is "citypulse-1031-all-2026-10-29.csv".
- `downloadBlob(blob, filename)`: a hidden `a[download]` click.
- `csvButton(getRows, name, { key, label }) -> button`: `getRows()` (may be async) returns `{ rows, columns }` and runs when the button is pressed; a failure is announced ("הקובץ לא הוכן. נסו שוב."). `csvButton(() => ({ rows, columns }), "answer-1", { key: "1031" })`
- `exportHref(key)` is `/api/city/<key>/export.csv`; `csvLink(href, label) -> a[download]`: `csvLink(exportHref("1031"))`.

## guide.js (pure; the official targets in the words of the product)
The server decides (`src/model/guide.js`, `docs/METHOD.md`: `a.guide`, `a.benchmark`, the status rules); this file only says it. Never invents a number, a year or a source; a figure on a small group is never set against a target.
- `kindOf(a)`: `target` (a.guide.judges: the status reads it), `orient` (an official target that is shown and never judges), `bench` (a.benchmark: "נקודת ייחוס, לא יעד"), `none`. `stateOf(a)`: `meets | near | below | far | null` in the distances of the status rules (5 and 10 points for a percentage, 10 and 25 percent of the target for other units; `tests/product-guide.test.mjs` keeps them equal to `RULES`), so the words never disagree with the status.
- `rowTarget(a)`: the facts of the quiet line of a row (`text` "לפחות 80%", `word` "רחוק מהיעד", `state`, `natMiss`) and the tick position on the town's bar (percentages only). The words of the line ("יעד רשמי: לפחות 80% · רחוק מהיעד.", and for a town that met it, when the country is short of it, the aside "הממוצע בארץ עדיין מתחת ליעד.") are made by `city/data.js` `tgtSegs`/`tgtPlain`. Used by `simple/model.js` (`rowOf().tgt`), `city/sections.js`, `pages/domain.js`.
- `panelOf(a)`: the panel of the figure's page (`pages/indicator.js guidePanel`): label, lines (`em` = where the figure stands), the caveat, the link to the document. Each kind says what the reference is, who published it and the year; a target says where the figure stands (in words, "עומד ביעד" when met), "יעד להתמצאות" and "נקודת ייחוס" say that they are context and do not change the status, with no distance and no "which way is good" (the line under the figure's number says it once; a background figure has none). A caveat of the server that opens with the same thing at greater length becomes the line (said once). `sourceLabel(src)`: the link text of the document, the publisher once, no repeated half, no code, no colon of its own. `reasonOf(a)`: the sentence under the figure's title for a figure with a judging target ("דורש טיפול כי המגמה בהידרדרות, אף שהוא עומד ביעד הרשמי ..."); null for any other figure (ui.js `statusReason` stays). `respell` / `respellTree`: the catalogue still writes "התכנית" in one data set name; the product writes "התוכנית". `NO_TARGET`: one plain reason for each of the 26 indicators with no official target (equal to `research/guidelines.json`, `tests/product-guide.test.mjs`).
- `catalogueOf(meta)`: which figures have which reference and the documents behind them (method page); the count of sources of the entry page is `entry/text.js dataSources` (the documents of role "guideline" are not data sources).

## catart.js
- `catArt(id, size = 28, cls = "") -> span.n-kit-cat | null`: the pictogram of a category (`child outcomes mental safety context`), a Tabler Icons outline drawing (MIT; credit and licence in `docs/CREDITS.md`) as one inline svg on `currentColor` inside a rounded-square tile; the stroke is 2, 1.75 or 1.5 by size and `size` sets `--cat`. Colours only through `--cat-tile`, `--cat-ink`, `--cat-nav-tile`, `--cat-nav-ink`. `hasArt(id)` says whether an id has a drawing. Used by the menu, the category rows and groups of the town page and the header of the category page.

## glossary.js
- `GLOSSARY`: `[{ id, term, short, long }]`, 17 rows (concern, watch, good, strength, rank, peers, cluster, small, background, trend, target = "יעד רשמי", orient = "יעד להתמצאות", benchmark = "נקודת ייחוס", pp, stdz, stale, per100k). The three words of the references: "יעד רשמי" judges, "יעד להתמצאות" never does, "נקודת ייחוס" is a foreign or international figure (spelled "בין-לאומי"). `short` is the definition for the dialog, `long` the exact rule with its numbers (for the glossary page). SPEC 7.4 was corrected to the code: see "Corrections" below.
- `TERM_IDS`, `glossaryTerm(id) -> row | null`, `glossaryHref(id, key = hereTown()) -> "#/c/<key>/glossary#<id>"` inside a town (the town of the address the reader is on) and `"#/glossary#<id>"` without one.

## term.js
- `termButton(termId, label?) -> button.n-kit-term`: underlined text (dotted line, solid on hover), `aria-haspopup="dialog"`. The label is the word as the sentence inflects it. An unknown id returns a plain `span`. `termButton("concern", "דורשים טיפול")`
- `openTerm(termId, opener) -> { dlg, close } | null`: the dialog (term as title, `short`, `long`, link "לכל המונחים" to `glossaryHref(id)`: the glossary of the town the reader is in).

## feedback.js
- `feedbackLink(ctx, { label }) -> button`: "יש טעות בנתון?" with an icon; `ctx` is an object or a function read when pressed. `feedbackLink(() => ({ key, name, indicator, dataDate: model.builtAt }))`
- `openFeedback(ctx, opener, io?) -> { dlg, close, closeBtn }`: the dialog (SPEC 6.7). Empty text is refused with a message. Sending: `POST /api/feedback`. Failure: the line "השליחה לא הצליחה. אפשר להעתיק את הפרטים.", the details in a field and a copy button; the typed text stays in the field and a draft is kept in `sessionStorage` (`cp2-feedback-draft`) until a send succeeds. While sending, the button is disabled and reads "שולח", the status says "שולח…" (`aria-busy`), and a second press sends nothing. After 15 seconds (`TIMEOUT`) the status says "אין תשובה מהשרת. אפשר לנסות שוב." and the button is enabled again with the text kept. Success: "תודה, הדיווח התקבל".
- `buildFeedback(ctx, message, email, loc?) -> payload`: the body of the POST, JSON:
  `{ message, email, key, name, indicator, route, url, dataDate }` (all strings; `message` at most 2000 characters, `email` 200; `route` is `location.hash` and `url` is `location.href` unless `ctx` overrides them). The server answers `{ ok: true }`; anything else (or a network error, or 15 s without an answer) counts as a failure.
- `sendFeedback(payload, { fetchFn, endpoint, timeout }) -> { ok: true } | { ok: false, error }`: never throws. The endpoint is `FEEDBACK_ENDPOINT` of `../config.js` when that module exports it (guarded dynamic import), else `/api/feedback`.
- `feedbackDetails(payload) -> string`: the same details as plain text.

## provenance.js
- `provenance(model, rows, { href, sourceOf, span }) -> p.n-kit-prov`: "מקורות: משרד הבריאות והלשכה המרכזית לסטטיסטיקה. נתוני 2021-2024. עודכן 29 באוקטובר 2026. איך מחושבים המספרים ←". `rows` are the analyses behind the screen (`model.indicators` entries). The publishers are those of the sources the rows name (`row.source`, or `sourceOf[row.id]` / `sourceOf(id)` from the catalogue); when no row names one, all `model.sources`. Publishers are shortened ("משרד הבריאות (פורטל ...)" is "משרד הבריאות") and listed once; more than four become "..., ועוד N מקורות". The years are those of the latest figure of each row (`span: "series"`: the years the series cover). The date is `model.builtAt`. The link goes to `#/method`.
- `provenanceText(model, rows, opts) -> string`, `provenanceParts(...) -> { sources, years, updated }`, `publishersOf(model, rows, opts)`, `yearsOf(rows, opts)`, `shortPublisher(p)`.

## actions.js
- `actionsRow({ variant, items, key, q, title, download, star, feedback, icons, label }) -> div.n-kit-actions[role=group]`. `variant` is `"hero"` (items share, brief, download, star) or `"closing"` (brief, download, print, share, report); `items` overrides the list. `download` is `{ getRows, name, label }` (a file built here) or `{ href, label }`; by default the server's `/api/city/<key>/export.csv` (the whole town, "הורדת כל נתוני היישוב"). `label` says what the file holds; without one a page's own table reads "הורדת נתוני הדף" and the closing row of an answer "הורדת הטבלה של התשובה". The aria-label adds "(קובץ CSV)" once. `star` is a node or a function that returns one (`kit/star.js`). `icons: true` shows only icons under 560 px (labels stay for screen readers). `LABELS` holds the copy table words.
  `actionsRow({ variant: "hero", key: "1031", q: "1", title: sentence, star: () => starButton(key) })`

## from.js
- `markFrom(qid, key?)`: remembers which answer sent the reader (`sessionStorage` key `cp2-from`, JSON `{ q, k, t }`). An id that is not `[\w-]{1,24}` is ignored; `markFrom(null)` clears.
- `readFrom(key?) -> qid | null`: null after an hour, or when the marker was written for another town. `clearFrom()`.
- Storage that throws (private mode, blocked) is safe: the marker lives in memory until the page closes. `markFrom("2", "1031"); readFrom("1031") // "2"`

## share.js
- `shareUrl(key, q, loc = location) -> string`: `location.origin + location.pathname + "#/c/<key>?q=<q>"`; after `setShareFeature(true)` (the server announced `features.share` in `/api/health`) `origin + "/s/<key>?q=<q>"`. Without `q` there is no query. `q = "simple"` is the retired short level of the town page (its alias route; the town page itself now always shares `weak`), not an answer: `<page>#/c/<key>/simple`, or `origin + "/s/<key>?q=simple"` with share pages. `shareUrl("1031", "2")`
- `setShareFeature(on)`, `hasSharePages()`, `probeShareFeature(fetchFn?) -> Promise` (reads `/api/health` once; `shareButton` calls it by itself).
- `shareButton({ key, q, title, label, getUrl }) -> button`: on touch devices with `navigator.share` the system sheet (a cancelled sheet is not an error); otherwise copy, announce "הקישור הועתק" and show it in the label for 2.4 s. When the clipboard is blocked, a dialog shows the link in a selected field. `getUrl()` replaces the link (a compare set).
- `copyText(text) -> Promise<boolean>`, `showLink(url, opener)`.

## tips.js (the cards of the marks; loaded by app.js after the first paint, not part of the static graph)
The owner's rule: what shows when the pointer or the finger is on a mark, or the keyboard focus, must say something the page does not already say next to the mark; otherwise the card has no reason to exist. The old chart modules build the shared card (`ui.js` `tip`, `viz/core.js` `bindTip`); this layer watches that one element and never touches them.
- `installTips()` (once), `setContext(ctx)` (every route: the model and the hash parts), `setMeta(meta)` (the catalogue, fetched with the first pointer: the sources and the definitions).
- `isRedundant(cardText, visibleText)`: true when every number and every meaningful word of the card is in the visible text. Numbers are compared in one form (`1,221` is `1221`, `5.70` is `5.7`, a minus sign is a sign), words without their prefix letters and plural endings, and the names of rows (ערך, מצב, שנה, little words) never count. `rowRedundant(rowText, haystack)` is the same for an extra row (the years count, the sign does not). `visibleText(root)` is what a person reads: the text under a mark's row or chart without `[hidden]`, `.sr` twins, svg titles, `display:none`; the aria-label is not counted (a mark such as a matrix cell has no text of its own, and the card is the only way to read its value).
- `extrasFor(kind, f, seen)` and the table `EXTRA`: `prev` (the change from the year before), `first` (since the first year), `extreme` (the best year, or the weakest when the card's year is the best), `nat`, `peer`, `target` (of the card's own year; `a.guide` when a figure has one), `base`, `status`, `place` (latest year only), `source`, `def`, `vsMain`, `vsNat` (another town set against the page's town and the nation), `natSpan`, `natPrev`, `names` (the figures of a ring segment), `edges` (the strongest and weakest figure of a category). A figure on a group too small to judge, or whose basis moved (`baseShift`), gets no change, comparison or place. The extras that describe the page's own town are never put on the card of another town.
- `PLAN` says which extras each kind of mark gets (heat cell, spark, line chart, strip, list row, dot, map, change row, coverage cell, ring segment, category meter, ...); `MAX` how many. A kind with an empty plan (a bar of towns, the place meter) shows its own card or none. `planFor(kind, f)`: for a figure that has an official target (`hasTarget`) the `target` extra comes first (after the status of a strip or a link), so a card on a year of such a figure says who published the target and whether the year met it (never for a year the series has no target for); a number the card shares with the target (the national mean 75% and a target of 75%) does not make the target row redundant, only the word "יעד" on the page does.
- The card's state is on the shared element for the tools: `data-n-tip` (`plus`, `plain`, `off`) and `data-n-raw` (what the old module wrote). A hidden card is `hidden` on the element. A `title` that repeats the text of its element and is not cut off is removed when the pointer comes.
- Styles: `kit.css` (`n-kit-tipx`, `n-kit-tipnote`, `n-kit-tiplist`). Browser check: `node src/tools/tips_probe.js` (all marks of the town page, trends, compare, the categories, some figures, the plan page, for three towns).

## Corrections to SPEC 7.4 (checked against `src/model/analyze.js`, `src/model/city.js`, `ui.js STATUS`)
- concern: rank below 25% of the localities (unless the figure meets its official target and does not deteriorate), far below an official target that judges (more than 10 points for a percentage, more than 25% of the target for another unit), or worsening with rank below 40%. The draft said "רחוק מיעד" without the number and "במקום נמוך" without the 40%.
- watch and good: the draft was vague. Good needs rank 50% or better (or a met official target), at most 5 points below the target (10% of it for another unit) and no worsening; watch is everything between. A figure that meets its official target and does not deteriorate is at least good. Added the row **strength** (75% and target met), which `STATUS` has and the draft did not.
- small: a figure is small when its base is under the minimum of that indicator (the minimum differs per indicator) or when fewer than 10 localities have a figure; it gets no rank, trend or status.
- trend: needs 3 years and both a slope (0.5 point a year; for other units 3% of the typical value) and a total move (2 points; 12%).
- target: "if there is none the comparison is the national mean" is not what the code does. Without an official target (26 of the 41 figures) the status comes from the rank among localities; the national mean is shown but decides nothing. Only a target that judges takes part; a related target and an international reference point never do (`docs/METHOD.md`).
- stale: not "left out of ranking and comparisons". The rank is still computed; the figure is not judged and its weight in the priorities is a fifth.
- background: the term is "מתאר בלבד" (SPEC 7.1 forbids "מדד רקע" on user screens); the id stays `background`.
- peers: 12 localities by size, authority type, socio-economic cluster and Arab share (the same district counts as slightly closer), only localities with data on at least 4 indicators; a figure is compared with their median only when at least 3 of them have it. cluster: the draft is right; the value is of 2021.

## Not in the kit (other packages)
`townsearch`, `states`, `star`, `helpsheet` belong to P1a. `actionsRow` takes the star as a node so that it does not import `star.js`.
