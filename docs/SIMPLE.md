# The town page: content contract

One page, `#/c/<key>`, with one level, the full one ("הפרטים המלאים"). **Since 2026-11-01 the short level "במבט אחד" and its switch are retired** (at the owner's request): the alias `#/c/<key>/simple`, `?v=` and `?q=simple` still open the page, which always shows the full level. The "Short level" column below describes the retired level and is kept as history; the code of its rows is still in `city/sections.js` (`c.level`) but nothing opens it. The file keeps its old name; the old separate "simple page" no longer exists. How the page works as a whole (routes, kinds of town) is `docs/PRODUCT.md` section 2; the binding description of the merge is `design-ideas/product/MERGE.md`. This document is the contract of what each section contains and how rows are chosen.

The reader is a resident, a councillor or a journalist with no statistics background. The top of the page must answer in about ten seconds whether the town is doing well, what the main problem is and what to do first.

## Sections, in screen order

| id | Section | Short level | Full level |
|---|---|---|---|
| | Head | name (the only h1), status, residents, level switch, actions | the same, plus district and cluster, the basis line (figures with data, years, date), the background line, the question field |
| `n-sec-state` | How things stand | one sentence ("14 מתוך 26 מדדי בריאות דורשים טיפול."), one segmented bar with its counts and words, and, when the town has figures with an official target, one lede: how many of them meet it in the town and in the country as a whole (`simple/model.js officialOf`, `simple/words.js targetLede`) | the same, plus one quiet row per category (label as a link, "9 מתוך 13 דורשים טיפול", a short bar) |
| `n-sec-good` | מה הולך טוב | at most 3 rows, or one honest line ("אין כרגע מדד שבולט לטובה."); one lede line when a row has no official target: it is judged by the country's average and the trend alone | at most 6 rows, the same lede |
| `n-sec-weak` | מה דורש תשומת לב | at most 3 rows, then "עוד N" and "לראות את כולם" (opens the full level here) | every figure that needs treatment or follow-up, under its category, the weakest category and figure first |
| `n-sec-changed` | מה השתנה | none | what improved and what got worse |
| `n-sec-peers` | איך מול יישובים דומים | none | the comparison with similar towns; dropped for a town with no comparable towns |
| `n-sec-first` | מה כדאי לעשות | the first step: headline, why (two numbers and the good direction), who is responsible, how fast | the first three, same fields, and "לכל ההמלצות" (the plan page) |
| `n-sec-missing` | על מה אין מידע | the count, up to three examples, link to the coverage page | the missing answer, with the figures found but not judged |
| | Foot | sources and update date once, what "דורש טיפול" means, report a mistake | the same |

What to do comes after the bad on purpose: it answers it. A section with nothing honest to say is dropped or becomes one quiet line, never an empty template. `?q=weak|changed|peers|first|missing` scrolls to and focuses the section; the full level has a slim text index of the sections that exist.

Two other kinds of town replace the middle sections. A town whose figures all rest on groups too small to judge shows "אלה המספרים שיש, בלי שיפוט." and at most three numbers as they are, never ranked (`n-sec-small`). A town the sources do not cover shows the no-data spot and two links.

## Anatomy of a row

A row is built by `rowOf()` in `simple/model.js` and drawn by `item()` in `city/sections.js`:

1. The catalogue's full label as a heading that links to the figure's page (cleaned by `plainLabel`: Latin vaccine codes are removed, "מתוקנן לגיל" becomes "בהתאמה לגיל התושבים", digits and ranges are isolated).
2. Two bars, the town and the country ("הארץ"), on one scale that starts at zero (0 to 100 for percentages, otherwise the larger value), each with its value and unit word. No national value: "אין ממוצע ארצי למדד הזה." instead of the second bar.
3. For a figure with an official target that judges: a thin tick on the town's bar and the quiet line "יעד רשמי: לפחות 80% · רחוק מהיעד." (`city/data.js tgtSegs`; the words of distance are the status rules' own distances from `kit/guide.js`). Nothing about the country is added to it, except for a met target that the country's average has not reached: one aside on its own line, "הממוצע בארץ עדיין מתחת ליעד." (not printed).
4. For a figure that needs treatment or follow-up, on both levels: its status word and its cause, in the model's own causes (`statusWhy`: the place among the localities, the distance from the target, the trend): "דורש טיפול כי המגמה בהידרדרות." One function, `city/data.js causeOf`, serves the town page and the category page. The full level adds its place among the towns. The short level carries no rank, percentile or place anywhere (a test scans every sentence of 15 towns).
5. A good row that stands on a target the official guide does not carry gets one line, "עומד ביעד: 95%." (below).
6. One sentence about which way is good: "כדאי שיהיה גבוה יותר." / "כדאי שיהיה נמוך יותר." under attention, "גבוה יותר זה טוב." / "נמוך יותר זה טוב." under good.

## How rows are chosen

`attentionOf` and `goodOf` in `simple/model.js`; every number is a field of the model.

- Attention rows are the weakest judged figures in the same order as `city/data.js weakestFive`, narrowed to "דורש טיפול" and "למעקב". A figure on a small group, a stale figure and a descriptive one (status `na`) never appears, because none carries a verdict.
- Good rows are figures with status good or strength, a national value to compare with, and a town visibly ahead of the country at the printed precision (30.9 against 30.8 where lower is better is not ahead). Strengths first, then the figures that beat the most localities. A figure not ahead of the country but standing on its target keeps one plain line built from the target field. A figure far from its target is never under "what goes well".
- A row must not contradict its heading. `standing()` compares town and country at the printed precision in the good direction. An attention row says its cause whatever the bars show (a row whose bars show the town level with or ahead of the country and that misses no official target goes after the rows with a visible gap or target). The separate reason line is now only for a good row on a target that the official guide does not carry. Do not remove the cause lines to make a page shorter; `tests/product-simple-rows.test.mjs` runs over 60 stored towns and requires zero contradictions.
- A figure that needs attention without a visible gap or target is never left without its reason: the property test takes the probe towns and 100 more and checks every figure with the status concern or watch.
- The first step is the model's first recommendation (the first three on the full level); its "why" line is built from the figures behind it, never from rank text.

## Limits

- At most 3 attention and 3 good rows on the short level (`MAX_ROWS`), 6 good rows on the full level.
- At most 14 words in any sentence built in `simple/words.js`, for every test town (`tests/product-simple.test.mjs`); a recommendation headline is held to 20 words, the owner line and a row label to 14. The test is the rule.
- Voice: third person with the town name, plural second person, no slash forms, none of the forbidden words (`docs/PRODUCT.md` section 7). A sentence is never cut with an ellipsis, and no Latin code or machine phrase may remain.
- A number inside Hebrew text is isolated with `ltr()` or `h("b.ltr")` and joined to its noun by `kit/plural.js`.
- Layout rules are the owner's: no coloured side stripe, not everything in boxes, no text in capsules, one accent colour, tokens only (`DESIGN_V3.md` section 9).

## Where each part lives

| File | Job |
|---|---|
| `web/js/product/simple/model.js` | Pure logic, no DOM: `verdictOf`, `attentionOf`, `goodOf`, `smallOf`, `firstSteps`, `missingOf`, `rowOf`, `standing`, `valueParts`, `barWidths`. Reuses `city/data.js`, so the counts equal the rest of the product's |
| `web/js/product/simple/words.js` | Every text of the page and the functions that assemble sentences from segments. No DOM |
| `web/js/product/city/home.js` | The page: head, sections, `?q=` |
| `web/js/product/city/sections.js` | One function per section (the DOM), the bars and rows |
| `web/js/product/city/{data,sentence,copy,answers}.js` | Counts and order, sentences (also for the share preview and the briefing), strings, the long answers of "what changed" and "similar towns" |
| `web/js/product/kit/guide.js` | The target line and tick of a row |
| `web/css/product/home.css` | Styles, class prefix `n-home-`, tokens only, print and forced-colours blocks |

Wiring outside: `routes.js` (`home` and `simple` call `cityHome`), `nav.js` (`SUBS`), `shell.js` (menu), `config.js` (`KEYS.view`), `pages/privacy.js` (describes the key), `kit/share.js`, `server.js` (`VALID_QIDS` includes `simple`).

## How to change a sentence safely

1. Change the text in `simple/words.js` (or `city/copy.js` if other parts share it), in the voice above, with the number as a segment of its own.
2. Find the tests that pin it: `grep -rn "<a few words of the old sentence>" tests/`. Sentences are pinned by `tests/product-simple.test.mjs` (parts, words, plain words, the page against a fake document), `product-simple-rows.test.mjs` (reason lines) and `product-share-simple.test.mjs` (the share preview and the voice scan). Update the expected text in the same change.
3. A new section or row type needs a place in `simple/model.js` (logic), `simple/words.js` (text), `city/sections.js` (DOM) and `home.css`, plus a test for each. A test allows one class prefix per css file.

## What to check after a change

```
node --test tests/product-simple.test.mjs tests/product-simple-rows.test.mjs tests/product-share-simple.test.mjs tests/product-chrome.test.mjs tests/product-voice.test.mjs tests/product-perf.test.mjs
npm test
SMOKE_ONLY='c/1031$|c/16$|c/935$|/simple' npm run smoke:n
node src/tools/consistency_probe.js 1031,9000,3000,99,472,16,7,935
node src/tools/chrome_probe.js --mode=nav --only=switch
node src/tools/first_screen_probe.js
```

The browser commands need Chrome and the server on port 8800 (`CDP_SLOT=<n>`). Then look at the page: 1031 at 390 and 1280 in both themes (verdict, bar and the start of the good or bad section visible without scrolling), the tiny town 16, the uncovered town 935, and a print preview. If `simple/*` or `city/*` gained a static import, the preload list in `web/n.html` may change: run `node src/tools/perf_probe.js --preload` and compare (`tests/product-perf.test.mjs` fails when they differ). A change to the server's handling of `?q=` needs a server restart before a shared link is checked (`docs/RELEASE.md`).
