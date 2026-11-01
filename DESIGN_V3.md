# DESIGN_V3: the look, the motion and the charts of CityPulse V2

Everyone who touches `web/` reads this first. It is a contract: the rules in section 1 are tested, the APIs in section 5 are fixed (add, never change).
Real, copy-ready calls for every chart (with real model fields) are in `CHART_COOKBOOK.md`; the optional fields the builders added to the section 5 signatures are listed there.

## 0. Why this exists

The first V2 screens were called "not intuitive, ugly" and, after the rebuild, still "lower quality than the previous version":
the side stripe on cards "looks AI and ugly", "everything is squares with something small in them", "zero animations", "you did not think
about several chart types matched to the kind of data", "you forgot the logo and the leaf scroll bar". The bar is: a municipal health
officer, or a jury, opens it and wants to keep looking. It must feel like a finished product, not a template.

## 1. Hard rules (some are tests: `tests/design.test.mjs`)

1. **No side stripes.** Never a thick border on one side of a card, row, callout or menu item, and never a thin vertical bar drawn
   with `::before/::after`. Mark a state with a tint, an icon, a pill, a full ring, or position. (test)
2. **Not everything is a card.** Use a hero band, big numerals, full-width charts, rows separated by hairlines, whitespace and tinted
   bands. A card is for something you click or a clearly separate group. Never a card inside a card inside a card.
3. **The chart is chosen by the data** (section 3), never for decoration. No pie for more than 4 parts, no 3D, no dual axis, no rainbow.
4. **Motion only through the vocabulary** (section 4). Reduced motion, print and no-JS show the final state.
5. **Colour only through tokens** (`var(--c-city)`, `var(--good-bar)`, `color-mix(...)`). No hex in `web/js/viz` or `web/css/viz`. (test)
   That is what makes dark mode work: look at every chart in both themes.
6. **Hebrew, RTL.** The page is RTL; an SVG is drawn LTR inside (`.viz svg { direction: ltr }`), so write Hebrew labels with an explicit
   `text-anchor`. Never wrap Hebrew words in `ltr()`; isolate only numbers (`ltr(num)`, `outOf`, `ptsEl` from `ui.js`). Time always runs
   left to right (newest on the right). "Better" is always to the right ("ימינה = טוב יותר").
7. **Numbers come from the data props**, never typed. A figure on a group under the minimum base (`reliable === false`) is drawn
   hollow and takes no rank, trend or colour judgement.
8. **Accessible.** Every chart has an aria-label that says what it shows in one sentence with its key numbers; interactive marks are
   focusable (`tabindex="0"`) and show the same tooltip on focus; text contrast AA in both themes; touch targets 40px or more.
9. **No libraries, no build step.** Vanilla ES modules and SVG/HTML. A chart under about 2,000 nodes; redraw on resize is debounced.
10. **Plain Hebrew, no jargon.** "נק׳" = percentage points, spelled out once on a page. No "אחוזון", "מובהק", "המודל" on user screens.
11. **No text in capsules.** The owner: "text pushed into a rounded circle each time looks AI". A fully rounded container holds at most one short word or a number. Metadata is a small label over its value (`.hero-fact`), a choice among several is an underlined tab (`button.chip[aria-pressed]`, `.ov-opt`, `.ov-jump`), a status is a coloured word with its icon (`.st`, `.pill`), a change against the nation is a coloured sentence with an arrow, a link is underlined text. Icons are for actions and status, not decoration on every fact.
12. **Say what is measured and which way is good.** A name states WHAT the figure is of ("אימהות שנבדקו לאיתור דיכאון אחרי לידה", not "סקר דיכאון אחרי לידה", which reads as the rate of the illness); next to a figure the page says whether higher is better, lower is better or neither (`directionNote(direction)` and `directionIcon` in `ui.js`). A colour alone never says it: a green end of a scale means "better", never "higher".
13. **No grey system scrollbars.** The owner, looking at the menu: "I want the scrollbar on the right and custom, not this one" (the browser's grey bar sat on the left edge of the menu). The page and the menu each have a leaf lane (`makeLane` in `motion.js`, `.cp-sb` in `motion.css`): the menu's lane is light on the navy at the window's right edge, the page's lane sits against the menu on the content side. Any other scroll box gets the thin quiet bar from `app.css` (`scrollbar-width: thin`, `scrollbar-color`), and a vertical scroll box inside the RTL page is `direction: ltr` with its children set back to `rtl`, so that its bar is on the right (see `.searchbox .results`). Before writing `overflow: auto` look at how its bar will look.

## 2. The look

**Brand.** The CityPulse leaf-over-skyline mark (`web/assets/logo/`: `mark.png` for pale surfaces, `mark-dark.png` for navy, `@2x` for
retina, `lockup*.png` for the horizontal lockup, `favicon-64.png`). Use `logoMark("dark" | "light" | "auto")` from `ui.js`. The leaf
returns in the scrollbar (motion.js). Navy `#0f2a4d` menu on the right, teal brand `#1f9a9a`, the city's line blue, orange only for
"needs attention".

**Tokens** (css/app.css `:root`, with a dark twin under `[data-theme="dark"]`):

| purpose | tokens |
|---|---|
| surfaces | `--bg --surface --surface-2 --line --line-2 --line-strong --track` |
| text | `--ink --ink-2 --ink-3 --muted --navy` |
| brand | `--teal --teal-dark --teal-ink --teal-soft --teal-line` |
| verdict tones | `--good-bar/-ink/-soft`, `--attn-bar/-ink/-soft`, `--none-bar/-ink/-soft` (watch = attn drawn as an outline or a lighter mix) |
| chart marks | `--c-city` (the one coloured line), `--c-nat` (national, grey-blue), `--c-peer` (similar localities, pink, dashed), `--c-target` (navy, dashed), `--c-band`, `--c-bin` |
| shape and depth | `--r-lg 16px --r-md 12px --r-sm 8px`, `--shadow`, `--shadow-up`, `--shadow-card` |
| richness | `--grad-hero` (deep navy to teal), `--aurora` (soft teal and blue glow for pale surfaces), `--ease`, `--ease-pop` |

**Type.** Heebo only (400 to 900). Display numerals 800 to 900 with `font-variant-numeric: tabular-nums`. Scale: hero title 3 to 3.4rem,
section title 1.7 to 2rem, card title 1.05rem, body 15 to 16px, small 12.5 to 13px. Big numbers are the visual anchors of a page: 2.4 to 5rem.

**Composition** (the shared pieces live in `css/layout.css`):
- `.hero`: a rounded 24px panel with `--grad-hero`, white text, a quiet decorative layer (pulse line, dot map), a visual on the opposite
  side (donut, locator), the verdict sentence large.
- `.sec`: a section = small numbered eyebrow ("01 · מצב"), a 1.8rem title, one lead line, then content straight on the page background.
- `.keyfigs`: 3 to 4 big figures in one row separated by hairlines (no boxes), each with a small spark area and a delta.
- `.band`: a full-width tinted band for the single most important block of a page ("start here").
- `.rowlist`: rows separated by hairlines, with a leading mark, a title, a sentence and a small visual at the end.
- Whitespace between sections 56 to 72px; inside a section 16 to 24px.

## 3. Which chart for which kind of data

| the question | the data | the chart | module |
|---|---|---|---|
| How is the city doing overall? | status counts | **status donut** (centre = the number to act on) | rings |
| How far is this one figure from its target? | one value, a target, the national mean | **gauge** (semicircle with ticks) | rings |
| Where does the city stand among all localities? | a rank or percentile | **standing meter** (bar with a pin) and the **dot map** | rings, spatial |
| What does "24%" mean in people? | a percentage | **waffle** (100 cells, the national share marked) | rings |
| One score out of 100 | priority, progress | **progress ring** | rings |
| Which figures are better or worse than the nation, and by how much? | signed gaps in one direction | **diverging bars** (centre line, right = better) | compare |
| City vs sector vs socio-economic group vs nation | 2 to 4 values per row on one scale | **dumbbell** | compare |
| Who is just above and below us? | a ranked list | **lollipop rank** | compare |
| Where does one value sit in the spread of all localities? | a distribution | **distribution** (histogram with pin, national and target lines) | compare |
| How did one figure change over the years? | a series | **line with area, national line, peer band, target, projection** | time |
| A short or count-like series | 3 to 8 yearly values | **columns** | time |
| A figure in a list or a card | a short series | **spark area** | time |
| Where is this KPI heading, what must change? | history, target, year | **trajectory** (history, dashed path to the target) | time |
| Many figures' histories at once | N short series | **small multiples** | time |
| What is the state of every domain and every figure in it? | statuses per figure | **domain strip** (one cell per figure) | matrix |
| How did every figure of a domain fare year by year? | figure x year vs a reference | **heat matrix** | matrix |
| What should we act on first? | standing, trend, priority | **priority quadrant** (bubbles) | matrix |
| How do the cities compare domain by domain? | counts by city and domain | **compare heat table** | matrix |
| Where in the country, and next to whom? | value and position per locality | **dot map** and the small **locator** | spatial |

## 4. Motion

One vocabulary in `css/motion.css`; nothing else is allowed (no private keyframes in a chart).

- **Page**: `#view.enter` fades and rises on every route change (main.js).
- **Blocks**: `.rv` (added automatically by `motion.js` to `.card`, `.sechead`, `.pagehead`, or by hand) rises on first sight. `--d` staggers siblings.
- **Numbers**: `motion.js` counts up the figures in `.big`, `.count b`, `.rscore b` and `[data-count]`. In a chart use `countTo(value, { dec, fmt })` from `viz/core.js`.
- **Charts**: pass the outer element through `viz(el, { label })` once. It adds `.viz` and, on first sight, `.in`. Marks carry:
  `draw` / `sweep` (stroke draws itself, set `--len` = `getTotalLength()`), `fade` (area, band, labels), `pop` (dots), `grow-x` / `grow-y` (bars;
  HTML bars in RTL grow from the right by default, set `--origin: 0 50%` for LTR SVG bars), `rise` (labels), `ping` (a pulsing marker).
  `--i` staggers marks. The `.in` state lives on the outer element, so a redraw after a resize does not replay the entrance.
- **Hover and focus**: 120 to 220ms: highlight the mark, dim the rest (`opacity .35`), show the tooltip. Focus shows the same.
- Durations 0.4 to 1.2s, `var(--ease)`. Entrances stagger at most 12 marks deep (cap `--i` at 12) so a long chart does not take seconds.

## 5. Chart modules: the contract

All modules import from `viz/core.js` (`h, svg, clear, tip, tipHead, tipRow, num, fmtVal, icon, viz, fit, whenVisible, countTo, bindTip,
srTable, legendRow, svgRoot, uid, C, TONE, TONE_INK, TONE_SOFT, STATUS_COLOR, STATUS_WORD, toneOfStatus` and everything in `viz/math.js`).
Every function **returns an element** (the page appends it); a function that needs the width redraws itself with `fit()`.
`tone` is one of `"good" | "attn" | "watch" | "none"`. `unit` is the indicator unit (`"%"`, `"per1000"`, `"per10k"`, `"per100k"`, `"days"`, `"years"`, `"index"`, `"count"`); format
values with `fmtVal(unit, v)`. Direction: `"higher"` (higher is better), `"lower"`, or `null` (a background figure: no good or bad).

### 5.1 `viz/rings.js`
```
statusDonut({ counts, size = 220, thickness = 26, centerValue, centerLabel, legend = true, onPick, ariaLabel })
    counts = { concern, watch, good, strength, stale?, uncertain?, na? }  (arcs: concern, watch, good, strength, background grey)
    centre defaults to the concern count (or the judged total when there is no concern). onPick(status) when a segment or legend row is clicked.
progressRing({ value, max = 100, size = 72, thickness = 8, tone = "good", label, display })
gauge({ value, min = 0, max, unit, nat, target, direction, tone, size = 240, label })
standingMeter({ level /* 0..100 = % of localities it beats */, rank, of, tone, label })
waffle({ value /* % of 100 */, nat /* national % */, direction, tone, noun, size = 220, label })
    solid cells = the city's share; with nat: dashed outlines show the difference to the national share
```
### 5.2 `viz/compare.js`
```
divergingBars({ items, max, ariaLabel })
    items = [{ id, label, sub?, gap /* signed; positive = better */, text /* shown at the end */, href?, tone? }]
dumbbell({ rows, unit, shared = true, ariaLabel })
    rows = [{ label, href?, note?, points: [{ key: "city" | "nat" | "peer" | "sector" | "ses" | "target", label, v, hollow? }] }]
lollipopRank({ items, unit, nat, direction, ariaLabel })
    items = [{ name, v, rank?, self?, d?, href?, hollow? }]  (already in the order to show)
distribution({ values, city, nat, target, p25, p75, unit, direction, items?, height = 190, ariaLabel })
    items = [{ name, v }] (optional: lets the tooltip name localities in a bin)
```
### 5.3 `viz/time.js`
```
lineChart(host, cfg)   // compatible with the old charts.js lineChart; draws into host
    cfg = { series: [{ key: "city" | "nat" | "peer" | other, label, color, points: [{ x, y, hollow? }], width, dots, endLabel }],
            target: [{x,y}], projection: [{x,y},{x,y}], band: { lo: [{x,y}], hi: [{x,y}], label }, events: [{ x, x2?, label }],
            unit, height, compact, ariaLabel, extra(x) }
columnChart(host, cfg) // cfg = { points: [{ x, y, hollow? }], nat: [{x,y}], target: [{x,y}], unit, height, ariaLabel }
sparkArea(points, nat, { w = 92, h = 30, endDot = true, area = true })   // points = [{ v }], nat = [v | null]; returns an element
trajectory({ history: [{ x, y }], from: { x, y }, to: { x, y }, nat, unit, width = 260, height = 120, label })
smallMultiples({ items, cols, ariaLabel })
    items = [{ id, label, unit, series: [{ year, v, nat }], status, href, last: { v, year } }]
```
### 5.4 `viz/matrix.js`
```
domainStrip({ domains, ariaLabel })
    domains = [{ id, label, icon, href, blurb?, indicators: [{ id, label, status, href, value? }] }]  (sorts itself: worst domain first)
heatMatrix({ rows, years, ariaLabel })
    rows = [{ id, label, href, unit, direction, cells: [{ year, v, ref }] }]   ref = the reference of that year (national mean); colour = how much better/worse than ref
priorityQuadrant({ points, height = 420, ariaLabel })
    points = [{ id, label, x /* 0..100 standing, high = strong */, y /* -1..1 trend, + = improving */, r /* 0..100 priority */, tone, href, note? }]
compareHeat({ cities, domains, cells, ariaLabel })
    cities = [{ key, name }], domains = [{ id, label, icon }], cells = { [cityKey]: { [domainId]: { concern, watch, good, strength } } }
```
### 5.5 `viz/spatial.js`
```
dotMap({ points, cityKey, unit, direction, nat, peers = [], height = 540, ariaLabel })
    points = [{ k, name, v, d, x /* longitude */, y /* latitude */ }]  (from /api/city/:key/indicator/:id -> map). If the city is not in points, pass it in `city: { k, name, v, x, y }`.
locator({ geo, cityKey, width = 120, ariaLabel })       // geo = /api/geo
```

## 6. Data you get (real shapes)

- City model `GET /api/city/:key`: `{ city: { key, name, lat, lon, population, district, sesCluster }, indicators: [{ id, domain, label, short, unit,
  direction, importance, status, statusWhy, stale, baseShift, headroom, priority, series: [{ year, v, n, d, nat, target, peer }],
  last: { year, v, d, nat, target, peer, rank, of, level, gapNat, gapTarget, gapPeer, meetsTarget, reliable, p25, p75 },
  history: { first: { year, v }, delta, slope, trendClass, natSlope, natDelta, gapMove, projection, yearsToTarget }, equity: { sector, ses } }],
  domains: [{ id, label, blurb, indicators: [ids], counts: { strength, good, watch, concern, uncertain, stale }, standing, available }],
  counts, coverage, years, priorities: [ids], findings, recommendations, summary, peers, sources }`.
- Indicator detail `GET /api/city/:key/indicator/:id`: `{ indicator, analysis, distribution: { year, values, n, p25, p75, median },
  neighbours: [{ k, v, d, name, rank, self }], peers: [{ key, name, series: [{ year, v, d }] }], map: [{ k, name, v, d, x, y }], findings, recommendations }`.
- `GET /api/geo`: `[{ k, n, x /* lon */, y /* lat */, p /* residents */ }]` for the 1,228 localities with data. `GET /api/compare?keys=a,b&ids=x,y`.
- `d` is the size of the group behind a figure; `reliable: false` means it is under the indicator's minimum base.

## 7. Building and checking a chart

1. Write the module, its CSS (class prefix per family: `.v-ring-`, `.v-cmp-`, `.v-time-`, `.v-mx-`, `.v-map-`) and its gallery demos
   (`web/js/viz/gallery-<family>.js`, with `demo(sec, title, note, chart)` from `gallery-kit.js`), using the real data in `ctx`.
2. Look at it: `CDP_SLOT=<n> node src/tools/shot.js "http://localhost:8800/gallery.html?family=<f>" <out.png> 1280` (also `390 1` for a phone,
   `--dark` for dark mode, `--motion` to run the animations). Open the PNG and judge it like a designer. Iterate.
3. Pure geometry goes in exported functions that do not touch `document`, with tests in `tests/viz-<family>.test.mjs`.
4. `node --test` stays green; `node src/tools/ui_smoke.js` shows no problems.
5. Edge cases to try with `?city=` and other indicators: a locality with one data point, a series with gaps, `reliable: false`,
   a null national figure, a very long Hebrew label, a value of 0, negative gaps, 40 items.

## 8. Who owns which file

`viz/core.js`, `viz/math.js`, `viz/gallery-kit.js`, `motion.js`, `motion.css`, `viz.css`, `app.css`, `layout.css`, `ui.js`, `main.js` belong to the lead.
Each chart family owns exactly its own `viz/<family>.js`, `css/viz/<family>.css`, `viz/gallery-<family>.js` and `tests/viz-<family>.test.mjs`.
Each page owns its own view file and `css/pages/<page>.css`. If you need a change in a file you do not own, say so in your report.

## 9. Mode N: the product (`web/n.html`)

Mode N is the finished product: its own entry file, its own scripts (`web/js/product/`) and styles (`web/css/product/`). It reuses the charts, the page modules and the shared old styles read-only, and it follows sections 1 to 8 with the changes below. The plan is `design-ideas/product/SPEC.md` (with `SPEC-ADDENDUM.md` which wins), the handbook is `docs/PRODUCT.md`, the shell contract is `web/js/product/README.md`, the town page (one page) has its content contract in `docs/SIMPLE.md`, and the deploy and flip procedure is `docs/RELEASE.md`. The product is meant to get smaller and clearer, never bigger: no new page, route, menu item or variant of a page without the owner's yes.

### 9.1 Tokens and scoping
- Every colour is a token from `web/css/product/tokens.css`, the only file that may contain a hex value (test). Light and dark both live there, dark under `html[data-ui="n"][data-theme="dark"]`. The palette is cool: paper, ink, grey-blue, one teal brand colour. The owner rejected warm cream and yellow, and cartoon colours (a test greps for the old warm values).
- Every top-level rule in `web/css/product/**` starts with `html[data-ui="n"]` (or sits inside `@media`, `@supports`, `@font-face`). That gives the specificity to beat the shared old stylesheets, and keeps the product's rules from touching the old app.
- One class prefix per css file and none in two files: `n-shell-`, `n-band-`, `n-state-`, `n-kit-`, `n-home-`, `n-brief-`, `n-entry-`, `n-pg-<page>-`.
- Space is the 4 px scale `--space-1..8`, type is `--fs-*` (Heebo only, 800 is the heaviest weight), the page gutter is `--pg` (28 px, 16 px under 861 px), `--n-gutter` for a full-bleed block, `--top-h` for sticky offsets. Never a literal for these.

### 9.2 The one-accent rule
There is one attention colour (`--attn-*`). It appears only on: the count of figures that need treatment in a verdict or category sentence, the underline of the weakest category, the status word and its icon in a row, the "needs treatment" segment of the segmented bars, and the dot beside the weakest one or two categories in the menu. It is not used on buttons, links, chart marks of strength or decoration. Strengths use the teal, "not judged" uses the grey (`--none-*`). If a new screen seems to need a second accent, it needs a different device (position, weight, an icon).

### 9.3 The band
Every page opens with one band (`web/js/product/band.js`): `homeBand` for the entry and the town page (the picture window follows the theme, only the active picture is fetched; the town page fills its `lines` and `switcher` slots), `titleBand` for every other page (an eyebrow or a way back, the h1 that says WHAT is shown, one line that says how to read it), `nodataSpot` for tiny and uncovered towns and for errors. There is exactly one h1 per page; an old page's own hero is re-grounded or demoted by the router. A band is full bleed; the content under it sits in `.n-shell-body`.

### 9.4 The kit
Small shared parts in `web/js/product/kit/` (see `kit/README.md`): states (skeleton, not found, not measured, error with retry), `plural.js` (every count agrees with its noun: use `cnt`, never a template with "ים"), `csv.js`, `share.js`, `provenance.js` (what, from where, as of when), `glossary.js` and `term.js`, `feedback.js`, `star.js`, `helpsheet.js`, `guide.js` (the official targets in plain words), `catart.js` (the category pictograms, Tabler icons on `currentColor`), `tips.js` (the cards on marks) and `base.js` (`openDialog`, `holdPage`, `announce`). Network access is `net.js`, never `fetch` (9.5). A new screen uses these before it invents a part. Actions are text with an icon, never capsules, 44 px targets on touch.

### 9.5 Rules that changed or were added for N
- Touch targets: at least 24 px everywhere and 44 px on coarse pointers (section 1 rule 8 said 40).
- Cards: a box is only for something clickable or a dialog. Rows are separated by hairlines; the answer is a sentence and numerals, not a card.
- Single-key shortcuts (`/`, `?`) have an off switch (WCAG 2.1.4) and never fire inside a field.
- Back never traps: redirects use `ctx.go(hash, {replace: true})`, and only `nav.go` writes the hash.
- A figure on too few cases is never ranked, coloured or sentenced; the tiny-town and no-coverage states say so in words.
- Chart marks are not tab stops unless they have an action; a chart keeps its one-sentence `aria-label`.
- Motion: only the verbs of `css/motion.css` plus `.wash` (in `band.css`); no `@keyframes` in the product; entrances shift nothing (CLS at most 0.02); reduced motion, print and no-JS show the final state.
- Network: every read goes through `net.js` (its own `fetch`, 10 second limit that aborts, one retry for offline, timeout and 5xx, error classes `offline timeout server badanswer notfound nodata unknown`, a slow-loading line after 6 seconds). A view never shows a raw error message. Keys are validated with `net.isKey` and the model with `net.isModel` before a view receives them.
- Dialogs: one native `<dialog>` at a time through `kit/base.js` `openDialog`, `aria-modal="true"`, the page behind `inert` (`holdPage`), focus returns to the opener. A dialog that sends something has a sending state and a time limit (the feedback dialog: 15 seconds).
- Voice: neutral third person with the town's name, plural second person, no slash forms, no "we" (`tests/product-voice.test.mjs`; `neutral.js` swaps the few sentences of old modules).
- Very small towns: a figure on a small group is never ranked, and a very small town (`city/data.js` `isVerySmallTown`) gets the one plain line `NO_COMPARISON` instead of any comparison with the nation or with similar towns on the town page, the figure page, the category page and compare.
- One town, one answer: the town page, the briefing, the coverage page and the share preview state the same count, weakest category, first recommendation and coverage (`tests/product-consistency.test.mjs`, `src/tools/consistency_probe.js`).
- Categories: the menu and every list show the four categories (`city/groups.js`); the nine server domains and their labels never reach a reader (`ui_smoke --n` flags the old words). A category page groups its figures in closed topic groups with a summary row.
- A card on a mark adds information the page does not already show (the national value with its year, change, best and worst year, cases, status, source, definition, the official target), and a card that repeats the visible text is hidden (`kit/tips.js`, `tips_probe.js`). A native `title` that repeats its element is dropped.
- Official targets: a target that judges (`guide.judges`) is the only one that touches status; a related target and an international reference point are shown for orientation and never judge; a figure with none says so in one plain line. The words come from `kit/guide.js`, never from the screen's own thresholds.
- Chart text is never under 12 px on the screen (`chartfit.js`); targets are at least 24 px, 44 px on coarse pointers.

### 9.6 What the tests enforce (so you do not have to remember)
`npm test` runs the whole suite without a browser (the total and the date are in `docs/QA.md`). The ones that guard the product:
- `design.test.mjs`: hex outside tokens, side stripes, capsules, warm colours, `@keyframes`, lab imports, scoping, class prefixes, contrast pairs computed from the tokens.
- `product-shell`: the router, titles, storage, the network classes, the contract of the README, and that `n.html` is its own entry (the bundle link and its fallback list equal `CSS_BUNDLE_FILES`). `product-resilience`: retries, timeouts, wrong shapes, key validation.
- `product-copy`, `product-questions`, `product-brief`, `product-entry`, `product-kit`, `product-pages`, `product-tools-pages`, `product-static-pages`: the forbidden words of SPEC 7.1 and the honesty rules of 7.2 on fixtures 1031, 16, 7, 935, 99, 472, 2710.
- `product-simple`, `product-simple-rows`, `product-share-simple`: the town page, the agreement of its rows with their headings, the share preview and the dialogs.
- `product-groups`, `product-menu`, `product-topics`, `product-catart`: the categories at the boundary, the menu and the routes, the topic groups of the category page, the pictograms and their credit.
- `product-guide`, `product-tips`, `guidelines`, `guidelines-web`, `evidence-claims`: the official targets in the model and on screen, the cards on marks, the evidence framework.
- `product-consistency`, `product-small-towns`, `product-chrome`, `product-voice`: one town one answer, the very small town, targets and reflow, the neutral voice.
- `product-perf`: the preload list in `n.html` is the real import graph, nothing leaves the origin, the docs name real commands. `product-matrix`: the pure parts of the QA tools.
- `product-old-untouched`: the old files keep their sha256.
- `server-static`, `server-share`, `server-feedback`, `server-hardening`, `server-css-bundle`, `export.test.js`: the server side.

Then the browser checks `npm run smoke:n`, `npm run a11y:n`, `npm run motion:n`, `npm run matrix:n -- --subset`, and look at the screens in both themes.

### 9.7 How to add a screen
1. Create `web/js/product/<area>/<name>.js` exporting the function the route table names (`routes.js`), returning a View (`{ node, band?, title?, active?, crumbs?, redirect? }`).
2. Open with `homeBand` or `titleBand`; say WHAT the figures are of and WHICH WAY is good; use `kit/states.js` for every empty, loading and error case.
3. Take the data from `ctx.model`; for more call `net.*` (never `fetch`); pass `ctx.signal` to your own requests.
4. Put the styles in a css file of your own with its prefix, imported by `web/css/product.css`; colours as tokens only. The bundle `/css/n.bundle.css` picks it up through the import; a new top-level sheet must also be added to `CSS_BUNDLE_FILES` in `src/lib/config.js` and to the `onerror` list in `n.html`.
5. Add the route to `routes.js` (and a title line to `PAGES`), the name to `SUBS` of `nav.js` if it is a town sub-route, a menu entry in `shell.js` if it is a top-level page, and the route to the lists in `ui_smoke.js`, `a11y_check.js`, `motion_check.js` and `product_matrix.js`.
6. Write the Hebrew in plain words (no "מובהק", "אחוזון", "המודל"), numbers isolated with `ltr()`/`num()`, never Hebrew words; the voice rules of 9.5.
7. Run the tests and the three browser checks; do not add a preload hint unless the module is needed for the first paint (`node src/tools/perf_probe.js --preload` regenerates the list, `tests/product-perf.test.mjs` checks it).

### 9.8 The town page
One page, `#/c/<key>`, tells the story of a town. It had two levels, "במבט אחד" (short) and "הפרטים המלאים" (full); the short level and its switch were retired on 2026-11-01 at the owner's request, and the page shows the full level only. The content contract is `docs/SIMPLE.md`; the design rules are:
- **One page, no variants.** `home` and `simple` are the same page (`routes.js townPage` → `city/home.js cityHome`); `#/c/<key>/simple` and `?v=` are only old links and open it. Nothing is stored for a level and there is no redirect.
- **Story order:** how things stand, what goes well, what needs attention, what changed, similar towns, what to do (after the bad on purpose: it answers it), what is missing, the foot. A section with nothing honest to say is dropped or one quiet line, never an empty template. The first screen shows the town name, the verdict and bar, and the start of the good or bad section (limits in `first_screen_probe.js`).
- **Type and rhythm.** One column of up to 900 px with body text of 16 px (wider on a wide screen: the page follows the window). Line height 1.7. Nothing is a card: rows are hairline-separated, the two bars sit on one scale from zero, a thin tick marks an official target, and colour never carries a meaning alone (the legend and the status words name each state).
- **Chrome.** The same chrome as every page (side menu and drawer). The menu is the town, then the four categories, then the tools; the report is the "הדפסת דוח" action of the page.
- **Print.** The page prints without the index, the question field and the welcome lines. Controls carry `no-print`.

### 9.9 Delivery of the styles
`n.html` links `css/n.bundle.css`, which the server builds from the six sheets in `CSS_BUNDLE_FILES` (`src/lib/config.js`) with every `@import` inlined (`src/lib/css-bundle.js`). Where the route is missing the `onerror` of the link loads the six sheets one by one. `tests/product-shell.test.mjs` keeps the two lists equal; the procedure for hosting is `docs/RELEASE.md`.
