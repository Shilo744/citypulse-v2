# web/js/product: the product shell ("mode N")

Entry file: `web/n.html` (`http://localhost:8800/n.html#/c/1031`). `web/index.html` and every old file stay byte-identical to their baseline (`tests/product-old-untouched.test.mjs`; `docs/RELEASE.md` explains the one deliberate change).
The contract below is what every page, the tests and the tools rely on. Change a name here only together with all its users and its tests. Longer explanations: `docs/PRODUCT.md` (the product), `docs/SIMPLE.md` (the town page: sections and rows), `DESIGN_V3.md` section 9 (design rules).

## Files

| file | job |
|---|---|
| `boot.js` | feature test, then `app.js` `start()` |
| `app.js` | the router: hash, `ctx`, page change, scroll and focus, titles, error states, recents. It sets `document.body.dataset.route` to the route id (CSS keys on it in `shell.css`: the compact search of the town page is `body[data-route="home"]`; the alias route `simple` takes the value `home` too and `body.dataset.alias = "simple"` says which door was used), sends a View's `redirect` with `nav.go(..., { replace: true })`, arms the slow-loading line, and loads `chartfit.js` and `neutral.js` after the first paint |
| `routes.js` | the route table `ROUTES` and the fallbacks to the old page modules; `PAGES` (title and one line per page); `available(id)`. `home` and `simple` are the same page (`townPage`: `cityHome(ctx)` for both, active `home`; `simple` is an old link to the retired short level); `overview` redirects to the town page keeping `?q=`; `d/<old domain id>` redirects to `d/<category>` |
| `nav.js` | pure: `parse`, `classify`, `build`, `switchTown`; `infoHref(page, key, fragment)`, `townOf(hash)`, `hereTown()`; the lists `SUBS` (`simple brief overview d i trends compare actions ask coverage method glossary accessibility privacy`), `TOP` (`method glossary accessibility privacy`) and `QUESTIONS`; window: `go(hash, {replace})`, `replaceQuery(params)` |
| `shell.js` | side menu (collapsible to a rail, key `cp2-side`), top bar, footer, drawer; light only since 2026-10-31 (`themeBtn()` is a remnant, not shown) |
| `pages/asktowns.js` | the comparison block of named towns in an ask answer (`townsBlock`, built by the server in `src/agent/towns.js`); `net.js` tells it about an answer through the `cp-ask` event |
| `reveal.js` | early reveal: an IntersectionObserver prepares what is about to enter the screen (one screen ahead) and finishes number count-ups |
| `band.js` | the opening bands (below) |
| `net.js` | `city(key)`, `health()`, `geo()`, `meta()`, `search(q)`, `indicator(key,id)`, `ask(body)`; its own fetch per read (10 s limit that aborts the request, one retry for offline, timeout and 5xx, nothing kept but a good answer, a body that is not an object is an error); `isKey`, `isModel`; `installGuard()` gives the old page modules the same limit; `NetError.kind` is `offline timeout server badanswer notfound nodata unknown` |
| `storage.js` | every `localStorage` access; `recents`, `fav`, `get/set/getJSON/setJSON`, `shortcutsOn()`; works with storage blocked |
| `neutral.js` | `watchNeutral(view)`: the old page modules still say "we" in a few sentences, call every town "העיר" and name a figure with a Latin code; their text nodes and labels under the view, the crumbs and the shared hover card are swapped for the product's words, now and when an answer arrives; loaded after the first paint. One pass, five tables: `PHRASES` ("we"), `WORDS` (a word the product never says), `PLACE` and the pattern in `SPELL` ("העיר" is "היישוב"), `NAMES` (MMR/MMRV, DTaP-IPV-Hib, "עוני: ילדים"), `SPELL` (התוכנית, בין-לאומי, and "ליעד משרד הבריאות" of a finding or a status line is "ליעד הרשמי"). `neutral(text)` is also the plain name of a figure for a file (domain.js and trends.js CSV). The status dot of the trends page and the figure cards of an answer on the ask page say their cause in the words of the town page (`city/data.js` `causeText`/`causeOf`). `tests/product-voice.test.mjs` keeps the tables complete |
| `live.js` | `announce(text, {delay})`, `toast(text)`, `watchFresh` |
| `seo.js` | `titleFor`, `descriptionFor`, `apply` |
| `config.js` | constants: `SITE`, `OLD_HOME`, `FEEDBACK_ENDPOINT`, `ACCESSIBILITY_CONTACT`, `NET`, `STALE_AFTER_MIN`, `MAX_RECENT`, `MAX_FAV`, `FEATURES`, and `KEYS` (everything stored on the device, listed below) |
| `chartfit.js` | `watchChartText(view)`: chart text under 12 px on the screen is raised to 12 px after every render and resize (loaded dynamically after the first paint) |
| `kit/tips.js` | the cards that show on a mark (hover, keyboard focus, touch): a layer over the shared tooltip of the old chart modules, loaded after the first paint, `installTips()` once, `setContext(ctx)` at every route. A card must say something the page does not already say next to the mark: it gets the change from the year before and since the first year, the best or weakest year, the national average and the target of its own year, the status, the place among the towns (latest year only), the source and the definition; whatever the page already shows is dropped, and a card with nothing new is hidden (`isRedundant`). Pure part tested in `tests/product-tips.test.mjs`, browser check `node src/tools/tips_probe.js` |
| `kit/guide.js` | the official targets in plain words (no DOM): `kindOf`, `stateOf` (meets, near, far), `rowTarget` (the facts of the line under the bars of a row and the tick; its words are `city/data.js` `tgtSegs`), `panelOf` (the panel of the figure's page), `NO_TARGET` (why a figure has none), `catalogueOf` (method page). `tests/product-guide.test.mjs` |
| `kit/townsearch.js` | `townSearch(opts)`, `pickTown(key)` (switches town and keeps the page) |
| `kit/states.js` | `notFound(kind, {model})`, `notMeasured(model, id, domainId)`, `errorState(err, {retry, model})`, `skeleton()`, `staleLine()` |
| `kit/star.js` | `starButton({key,name}, {showText})` |
| `kit/helpsheet.js` | `openHelp()`, `focusSearch()`, `installKeys()` (the sheet holds the page `inert` like any dialog) |
| `kit/base.js` | `announce`, `act`, `openDialog` (one `<dialog>`, `aria-modal`, page `inert`, focus returns), `holdPage`, `safeSession` |
| `kit/catart.js` | `catArt(id, size, cls)`: the pictogram of a category (Tabler Icons, MIT, outline, inline svg on `currentColor`, credit in `docs/CREDITS.md`) in a rounded-square tile; colours only through the `--cat-*` tokens |
| `simple/model.js` | what the town page's rows and verdict show, chosen from the model: `verdictOf`, `attentionOf`, `goodOf`, `smallOf`, `firstStep`, `missingOf`, `rowOf`, `standing`. No DOM |
| `simple/words.js` | every text of the town page's short sentences, the headings and the sentence builders. No DOM |
| `city/home.js`, `city/sections.js` | the one town page: `cityHome(ctx)` (the head, the sections in the story order) and one function per section (`section ids n-sec-*`) |
| `city/{data,sentence,copy,answers,parts}.js` | the town page's counts and order (`data.js`: `stateOf`, `weakestFive`, `isVerySmallTown`), its sentences (`sentence.js`, also for the share preview and the briefing), its strings (`copy.js`), the long answers of "what changed" and "similar towns" (`answers.js`), small shared nodes (`parts.js`). No DOM at import except `parts.js` |
| `city/groups.js` | the categories (`GROUPS`, `MOVES`, `regroup`, `regroupMeta`) and the topics inside a category (`TOPICS`, `topicsFor`, `topicSay`): the category page (`pages/domain.js` `groupFigures`) shows its figures as closed native `details` groups, one per topic, with a summary row (name, one sentence, a short bar), the topic that needs the most attention first and open; a topic with no figure for the town is not shown. Every figure is in exactly one topic (`tests/product-topics.test.mjs`); `node src/tools/chrome_probe.js --mode=groups` checks it in a browser. No DOM |

The kit modules `csv, glossary, term, feedback, provenance, actions, plural, from, share` are in `kit/` too, documented in `kit/README.md`. `city/`, `entry/`, `brief/`, `pages/` and `simple/` hold the views the route table loads; their logic files (`city/{data,sentence,copy}.js`, `brief/doc.js`, `entry/text.js`, `simple/{model,words,pref}.js`) have no DOM at import so that node tests can load them.
The shell loads `kit/feedback.js` lazily (`openFeedback({ key, name, route, url, dataDate }, opener)`) and shows the footer link only when the file exists. It also sets `window.__cpAnnounce` and calls `kit/share.js` `setShareFeature(health.features.share)`. A second `#` in the hash (`#/glossary#concern`) is a fragment: `nav.parse` returns it and the router scrolls to that element id after the view is in place.

## Routes

`#/` entry, `#/c/<key>` the town page (`?q=weak|changed|peers|first|missing`), `#/c/<key>/` + `simple (alias: an old link, the same page) | brief | overview (redirects to the town page) | d/<categoryId> (an old domain id redirects) | i/<id> | trends | compare?with=a,b | actions | ask?q= | coverage | method`,
`glossary | accessibility | privacy` (the pages of information open inside the town: the town menu stays and the way back is the town),
`#/method`, `#/glossary`, `#/accessibility`, `#/privacy` (the same pages without a town: the town-less menu). A link written in a town page uses `nav.infoHref(page, key)` or `glossaryHref(id)`, never a fixed `#/glossary` (a test scans the sources). `#/lab*` and `#/c/<key>/lab*` redirect with `location.replace`. An unknown sub-route under a valid town replaces itself with the town home.
Links are relative to the hash, so an old page's `#/c/...` link stays inside `n.html`.

| route id | new module (optional, soft import) | export | fallback today |
|---|---|---|---|
| `entry` | `entry/entry.js` | `entryView(ctx)` | old `views-home.js` `homeView` |
| `home` `simple` | `city/home.js` | `cityHome(ctx)` | the one page of a town; the alias `simple` (an old link) shows the same page |
| `brief` | `brief/brief.js` | `briefView(ctx)` | redirect to the town home; menu link hidden until the file exists |
| `d i trends compare actions ask coverage method gmethod` | `pages/<name>.js` | `adapt(node, ctx)` | the old page module alone (`gmethod` uses `pages/method.js`); `overview` has no page: it is a redirect |
| `glossary accessibility privacy` | `pages/<name>.js` | `view(ctx)` | the not-found card |

A missing module is a `console.warn` and the fallback. A module that exists but throws is an error state with a retry button (and a `console.error`, so the smoke run fails): fix it, do not hide it.
Each missing optional module is a 404 in the network log; the three tools (`--n`) ignore 404 under `/js/product/`.

## ctx (frozen; created in `app.js`)

`{ key, model, sub, parts, params, go(hash, {replace}), announce(text, {delay}), setTitle(text), setCrumbs(items), recents, fav, mode: "n", themeBtn(), signal }`

- `go(hash, {replace:true})` for every redirect. Never write `location.hash =` (back trap; a test greps for it).
- `setTitle(page)` gives `"<page> · <town> · CityPulse"`; call it again when the page changes in place. `setCrumbs([{label, href?}])`, the last item is the page. If you call neither, the router sets the defaults.
- `announce(text, {delay: 400})` for a change that happens in place.
- `signal` aborts when the route changes: pass it to your own fetches.
- `nav.replaceQuery(params)` changes `?q=` without a history entry and without rendering again.

## What a view returns

`View = Node | { node, band?, title?, active?, crumbs?, landing?, redirect? }` (a route's `load` may also return `status` for a not-found or not-measured card)

- `band` undefined: the default. If the node contains a `.hero` with an h1 it is lifted into the band slot and re-grounded (pale sky, theme tokens); otherwise a title zone is built from `PAGES[id]` (eyebrow or "← דף היישוב", h1, one line). Every other h1 in the node becomes `role=heading aria-level=2`, so there is exactly one h1.
- `band` a Node: your own band (below). `band: false`: no band (states, entry).
- `landing: true`: no menu and no top bar (the entry page), the node fills the page.
- `active` is the menu item that is current: `home d:<categoryId> actions trends compare ask coverage method gmethod glossary entry` (the alias route and the town page are both `home`; the report and the old overview have no menu item).
- `redirect: "#/..."`: the router replaces the entry.
- The node is put into `div.n-shell-body` (gutter `var(--n-gutter)`, max width `--page-max` 1200 px). A band is a direct child of `#view`, so it is full bleed.

An adapter (`pages/<name>.js` `adapt(node, ctx)`) may return the node or a View; it may add classes, insert the eyebrow, move or hide blocks, never fetch data the old page did not fetch, and never import page-private modules.

## band.js

- `homeBand({ eyebrow, title, id, facts: [node|string], basis, actions, ask, art: true, tone })`: the entry and the city home; the picture window follows the theme (only the active picture exists; `assets/product/hero-{day|dusk}-{wide|phone}*.webp`; a missing file shows the sky). `title` is the h1.
- `titleBand({ eyebrow, title, lede, back: {href, label}, id, actions })`: every other page (96 to 120 px, hairline under it).
- `nodataSpot({ title, text, actions, level })`: the calm spot for tiny and uncovered towns, not-found and errors.
- `autoBand(node, info)`, `regroundHero(hero)`, `demoteH1(root, except)`, `themedSlot(cls, make)`, `heroPicture(theme)`, `spotPicture(theme)`, `wash(el)`.
- CSS: `band.css`. `.hero.n-band-hero` releases exactly the custom-property list of `css/layout.css` `.hero` (`--ink ... --teal-dark`); decorative white strokes of a page's own hero are yours to recolour with tokens.

## CSS rules (tested)

- Every top-level rule under `web/css/product/**` starts with `html[data-ui="n"]` (or is inside `@media`, `@supports`, `@font-face`). Dark is `html[data-ui="n"][data-theme="dark"]`.
- No hex outside `tokens.css`, no `@keyframes`, no import from `lab/`, no warm paper colours.
- One class prefix per css file, none in two files: `n-shell-` (shell.css), `n-band-` (band.css), `n-state-` (states.css), `n-kit-` (kit.css), `n-home-`, `n-brief-`, `n-entry-`, `n-pg-<page>-`.
- Offsets: `--pg` page gutter (28 px, 16 px under 861), `--top-h` top bar, `--n-gutter` inline padding for a full-bleed block that is a child of `#view`, `--page-max`, `--n-art-h` picture window, type `--fs-*`, space `--space-1..8`.
- Never a coloured side stripe; motion only through the verbs of `css/motion.css` plus `.wash`.

## How to add a screen

1. Add the file under `web/js/product/<area>/` exporting the function named in the table above.
2. Return a View. Use `homeBand` or `titleBand` (or leave `band` undefined). Put your CSS in your own file under `web/css/product/` with your prefix (the stub already exists and is imported by `product.css`).
3. Take data from `ctx.model` (already loaded); for more call `net.*`, never `fetch` directly.
4. Run `npm run smoke:n`, `npm run a11y:n`, `npm run motion:n` (`SMOKE_ONLY`, `A11Y_ONLY`, `MOTION_ONLY` take a regex) and `npm test`.

## What the device keeps (`config.js` `KEYS`)

The privacy page lists exactly these, with a reason for each (`pages/privacy.js`; `tests/product-simple.test.mjs` fails when a key has no description):

| name in `KEYS` | stored under | holds |
|---|---|---|
| `theme` | `cp2-theme` | not used: the product is light only since 2026-10-31 (`web/n.html` forces `light`) |
| `recent` | `cp2-recent` | recent towns (at most `MAX_RECENT` = 5) |
| `last` | `cp2-last` | the last town |
| `fav` | `cp2-fav` | followed towns (at most `MAX_FAV` = 12) |
| `welcome` | `cp2-welcome-n` | the first-visit note was shown |
| `shortcuts` | `cp2-keys` | single-key shortcuts `on` or `off` |
| `from` | `cp2-from` | which answer sent the reader to a page (session storage, one hour) |

Every access goes through `storage.js`, which never throws and keeps the value in memory when storage is blocked. The feedback draft (`cp2-feedback-draft`) is the one session-storage key outside `KEYS`; it lives in `kit/feedback.js` until a send succeeds.

## Stylesheets

`n.html` links `css/n.bundle.css`, built by the server from the list `CSS_BUNDLE_FILES` in `src/lib/config.js` (`src/lib/css-bundle.js`; every `@import` inlined, `url()`s made absolute). Without that route the `onerror` of the link loads the same six sheets one by one. A new CSS file under `web/css/product/` only needs an `@import` in `web/css/product.css`; a new top-level sheet must be added to `CSS_BUNDLE_FILES` and to the fallback list in `n.html` (`tests/product-shell.test.mjs` compares them).

## Tests that guard this folder

`npm test` (the whole suite, no browser; total and date in `docs/QA.md`). Shell and plumbing: `product-shell` (router, titles, storage, scoping, `n.html` as its own entry), `product-resilience` (`net.js`), `product-chrome` (calm chrome, search list, targets), `product-perf` (preload list, docs name real commands), `product-voice`, `design`. Content: `product-copy`, `product-questions`, `product-brief`, `product-entry`, `product-kit`, `product-pages`, `product-tools-pages`, `product-static-pages`, `product-consistency`, `product-small-towns`. The town page: `product-simple`, `product-simple-rows`, `product-share-simple`. Categories, menu, topics, pictograms: `product-groups`, `product-menu`, `product-topics`, `product-catart`. Targets and cards: `product-guide`, `product-tips`, `guidelines`, `guidelines-web`, `evidence-claims`. Tools and old files: `product-matrix`, `product-old-untouched`. Browser checks (server and Chrome needed): `npm run smoke:n`, `npm run a11y:n`, `npm run motion:n` (`SMOKE_ONLY`, `A11Y_ONLY`, `MOTION_ONLY` take a regex), `npm run matrix:n -- --subset`, and the probes listed in `docs/PRODUCT.md` section 11.

## Flip and rollback

The footer link "חזרה לעיצוב הקודם" goes to `index.html` plus the current hash (`config.js` `OLD_HOME`). Flip (the owner's word only): rename `web/index.html` to `old.html` and `web/n.html` to `index.html`, set `OLD_HOME = "old.html"`, the manifest `start_url` and `SHARE_TARGET` in `src/lib/config.js`, leave a redirect stub at `web/n.html`, and update the tools and tests that name `/n.html`. Rollback: rename back and undo the three values. The exact commands, the list of places that name `n.html`, and the deploy order are in `docs/RELEASE.md`.
