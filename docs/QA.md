# QA record of the product (mode N)

Where each number comes from is written next to it. The test total was run by the documentation pass (`d1`) on 2026-10-30. The browser results are the last full runs written in the work reports of the final packages (mostly `design-ideas/product/DONE/b2.md`, run on the final state of that package, 2026-10-30); `q1.md`, a later full QA report, did not exist when this was written, and the documentation pass opened no browser. The performance numbers (section 2) are older: they were measured before the merge of the town page and before the official targets.

## 0. The live site (Cloudflare Worker), 2026-11-01

The same tools, pointed at `https://citypulse.shilo744.workers.dev` (Worker version of that night, headless Chrome from a home connection). `npm test` on the tree that was pushed: 842 tests, 842 pass.

| Check | Command | Result on the live site |
|---|---|---|
| Smoke | `node src/tools/ui_smoke.js --n <address> 9000 1031` | 119 screens, 0 with problems |
| Accessibility | `node src/tools/a11y_check.js --n <address> 9000` | 0 issues |
| Motion | `node src/tools/motion_check.js --n <address> 9000` | 42 screens, 0 with problems |
| Touch targets | `chrome_probe.js --mode=targets --base=<address>/n.html` | 0 offenders (11 chart marks exempt as essential) |
| Reflow at 320 px | `chrome_probe.js --mode=reflow` | no screen overflows |
| Navigation, level switch, old addresses | `chrome_probe.js --mode=nav` | all 252 checks passed |
| Topic groups | `chrome_probe.js --mode=groups` | all group checks passed |
| First screen | `CP_BASE=<address> node src/tools/first_screen_probe.js` | the verdict sentence starts at 556 px at 1280x900 (515 px at 1024x768, 682 px at 390x844); no sideways overflow in 13 sizes |
| Consistency | `consistency_probe.js --base=<address>` | 8 towns, 107 checks, 0 disagreements |
| Worker CPU time (`wrangler tail`) | 10 + 30 requests, including `/api/ask` for 31 towns | page, model, CSV, share: 0-6 ms; a warm ask 1-2 ms; the first ask in a fresh isolate 25 ms (above the 10 ms of the free plan, and still `ok`); no error 1102 |
| Questions to the ask page | clicking a sample question on `#/c/1031/ask`, and `POST /api/ask` with and without `noModel` | answered from the figures in about 0.15 s (keyword planner); with the AI key on a local Worker (`wrangler dev --local`) two questions came back with `via: "model"` in 2.4 and 2.9 s |
| Performance | `BASE=<address> node src/tools/perf_probe.js` | `#/c/1031` cold: 59 requests, 501 KB on the wire, LCP 1.2-2.2 s unthrottled and 4.1-4.2 s on the slow profile (budget 3.5 s: **not met**), CLS 0.008 (two runs). Entry page: 62 requests, 531 KB, slow LCP 3.5-3.9 s (at the budget or a little over). The wire size is above the 450 KB budget because Cloudflare compresses on the fly at a lower brotli level than the dev server's cached one (old measurement: 401 KB). One unthrottled phone load of the first run showed 6.2 s while other probes ran on the same machine; run alone it was 1.2 s |

## 1. Automated gates

| Gate | Command | Result |
|---|---|---|
| Unit and contract tests | `npm test` | 842 tests, 842 pass, 0 fail (`node --test`, 2026-10-31, after the review fixes; the earlier 737 was the count of 2026-10-30) |
| Old files untouched | `node --test tests/product-old-untouched.test.mjs` | green in that run (sha256 of every old file against `design-ideas/product/baseline/OLD-HASHES.json`) |
| Smoke | `npm run smoke:n` | 119 screens, 0 with problems (b2) |
| A11y | `npm run a11y:n` | 0 issues (b2) |
| Motion | `npm run motion:n` | 42 screens, 0 with problems (b2) |
| Matrix | `node src/tools/product_matrix.js --subset` | 352 loads, 0 problems (b2); report format in `design-ideas/product/qa/`. The full 15-town, 8-width matrix was never run |
| Consistency | `node src/tools/consistency_probe.js` | 8 towns, 100 checks, 0 disagreements (b2): verdict wording, category rows, target lines, the same counts on every screen |
| First screen | `node src/tools/first_screen_probe.js` | verdict sentence starts at 518 px at 1280x900 (limit 520); no sideways overflow in 13 sizes for 2 towns (b2). The 390x844 limit is 640; the last number written for it is 614 (m2, before later edits) |
| Level switch and old addresses | `node src/tools/chrome_probe.js --mode=nav` | all passed (b2); the redirect part: 60 checks, 0 failures (u1); the info pages inside the town: 170 checks, 0 failures (u1) |
| Topic groups | `node src/tools/chrome_probe.js --mode=groups` | 169 checks, 0 failures (u2), all passed again in b2 |
| Cards on marks | `node src/tools/tips_probe.js --towns=1031,16,9000 --touch` | 3432 cards hovered or focused, 0 failures (t); "all cards add something" again in b2 |
| Small towns | `node src/tools/small_town_probe.js 16,7,472,935` | not pass or fail: 1226 text hits on 133 routes, all of the old kinds (explanations, method text, real places of judged figures); towns 16, 7, 935 show no place number outside the method page (b2) |
| Targets | `node src/tools/chrome_probe.js --mode=targets` | 8 to 30 targets under 24 px remain per page, all in old modules (matrix labels, chart marks, term buttons, "הוספה להשוואה", coverage rows) (b2) |
| Reflow | `node src/tools/chrome_probe.js --mode=reflow` | 320 px with 200 percent text: u1 found the glossary, privacy, category and the two town forms clean; b2 found the town page, figure page, compare, actions and method overflowing, "as before" (it had not run the probe earlier), and u2 measured `d/child` at 435 px (old row grid and matrix). The reports disagree for the town page and nobody re-ran it afterwards: open |
| Dialog | `node src/tools/dialog_focus_probe.js` | not re-run for the merge (the feedback dialog did not change) |
| Performance | `node src/tools/perf_probe.js` | section 2 |
| Print | print emulation through the DevTools protocol | the short level fits one A4 page for 8 towns (b2: town 472 went to two pages and was fixed); the full level and the report were not checked after the merge |
| Visual diff | not built | the screens were looked at by the package workers; contact sheets and pictures in `design-ideas/product/images/` and `qa/sheets/` |

## 2. Performance, `perf_probe.js` (measured before the merge)

Method: own headless Chrome over the DevTools protocol; cold = cache cleared, warm = reload; "slow" = 150 ms RTT, 1.6 Mbit/s down, 0.75 up. The dev server speaks HTTP/1.1. The last full measurement, with the stylesheet bundle, on `#/c/1031` of the old five-tab home:

| Load | Requests | Wire | Slow LCP | CLS |
|---|---|---|---|---|
| `#/c/1031` cold, 1280 and 390 | 55 | 401 KB | 3.08 s and 2.99 s | at most 0.010 |
| `#/` (entry) cold | 59 | 454 KB | 3.48 s and 3.39 s | at most 0.010 |

Local LCP was 0.33 to 0.40 s; warm reloads answered 304 or from memory for 96 percent of requests (27 KB). Without the bundle the town page needed 96 requests (41 stylesheets).

Budgets, which the town page must keep: 0 third-party requests; at most 60 requests and 450 KB for `#/c/1031`; waterfall depth at most 3; slow-profile LCP at most 3.5 s; CLS at most 0.02; only the active theme's picture; no module of a page not visited on the first load. Left over: the verdict sentence arrived 0.2 s later than its own target (2.5 s) on the slow profile, about half of the bundle is the CSS of pages that are not on screen, and the 450-switch heap probe was never built. After the merge the town page is a different page (new modules such as `city/sections.js`, `kit/guide.js`, `kit/catart.js`; the preload list was regenerated); **the budgets were not re-measured**. Run `node src/tools/perf_probe.js` before the owner flips the default.

## 3. Acceptance checklist

Marked `[x]` only where a report or a test gives evidence for the merged product; `[ ]` where it was last checked before the merge or not at all.

- [x] The product is `/n.html`; the old app at `/` is unchanged (`product-old-untouched`).
- [x] The town page: one page, two levels, the story order, in-place switch with focus kept, `?v=` and `?q=` and the alias, old `overview` and `d/<oldDomain>` addresses landing right (`product-simple`, `product-menu`, `chrome_probe --mode=nav`).
- [x] First screen: verdict sentence at 518 px at 1280x900 (limit 520).
- [x] Four categories and a background line everywhere a reader sees them; no old category word (`ui_smoke --n` checks the seven old labels on every screen; `product-groups`, `product-menu`).
- [x] The category page in openable topic groups, counts equal to its ring (`product-topics`, `chrome_probe --mode=groups`).
- [x] Official targets on the town and category rows, the figure panel, the method, coverage and glossary pages; the status rules and their words agree (`product-guide`, `guidelines`, `guidelines-web`, `evidence-claims` tests; pictures looked at, 26, b2).
- [x] Cards on marks add information and a card that repeats the page is hidden (`product-tips`, `tips_probe`).
- [x] Information pages inside the town; professional pictograms with their credit (`product-menu`, `product-catart`, `docs/CREDITS.md`).
- [x] One accent colour, tokens only, no side stripe, no capsule, motion verbs only, one class prefix per css file (`design`, `product-shell`, `product-kit`, `motion:n`).
- [x] Honesty: a figure on too few cases is never ranked or judged; very small towns get no comparison; no row contradicts its heading, 0 contradictions over 60 stored towns (`product-small-towns`, `product-simple-rows`).
- [x] Voice: no "we", no singular imperative, no slash form in `web/js/product/**` (`product-voice`).
- [x] Resilience: a hung request ends in an error with a working retry; a junk 200 is `badanswer`; the slow line after 6 seconds (`product-resilience`, probed in a real browser by w1).
- [x] `docs/RELEASE.md` explains the flip, the rollback, the bundle and the open decisions.
- [x] Git: the folder is not a repository; the rollback copy of the old app is `design-ideas/product/baseline/web-before/`, of the product before the merge `design-ideas/product/baseline/product-before-merge/`.
- [ ] The report `#/c/<key>/brief` on two A4 pages with date and address (2 pages, MediaBox 595 x 842 pt, measured before the merge) and the full level printed: not repeated after the merge.
- [ ] CSV: `/api/city/1031/export.csv` starts with the UTF-8 BOM (checked before; the server is unchanged except 8 appended columns for the targets); opening it in Excel is manual.
- [ ] Back keeps scroll and focus, no back trap (checked before the merge by r1 and r3 with real events; the redirects of the merge were checked for history length by m3).
- [ ] The dark theme on the whole town page after the merge: looked at only for the pictograms, the figure page and the topic groups (u1, u2, b2).
- [ ] The perf budgets of section 2.

## 4. What the tools cannot test (manual steps)

| Item | Manual steps |
|---|---|
| Safari 16.4 and later (Mac and iPhone) | Open `http://<host>:8800/n.html#/c/1031`. Check the font, the level switch, the openable topic groups (`details` with a grid summary), the dialogs, the sticky top bar and the 100vh band on the phone, the share button. Then print preview of the report and of the short level |
| Firefox 115 and later | The same pages; the leaf scrollbar (CSS scrollbar properties differ), `:has()` rules, `color-mix` colours, dialog Esc |
| NVDA (Windows) and VoiceOver (macOS, iOS) | Town page: Tab to "דלגו לתוכן"; one h1; the level switch announces the new level once; the segmented bar is read as its sentence; a topic group opens with Enter and Space; headings and landmarks; a card on a mark by keyboard focus; the glossary dialog traps focus and Esc returns it |
| Windows High Contrast | The current level in the switch, focus ring, buttons and chart marks stay visible (the `forced-colors` blocks) |
| A real printer or PDF printer | The report on A4 from Chrome and Edge: two pages, no cut table; the short level of the town page (one page) and a town with long labels (for example 2800 or 6100); the dark theme prints light; the full level |
| Excel | Open a town's CSV by double click: Hebrew letters, numbers as numbers, no `####` |
| A real keyboard on a device | Tab through the town page and the report without a mouse; `/` opens the search, `?` the help |
| Phone keyboards | The town search with the on-screen keyboard of iOS and Android: the list stays open under the field, the page does not jump |
| Tab order inside dialogs in a headed browser | Headless Chrome wraps through the document; a headed Chrome has the address bar as an extra stop. Open the help sheet (`?`) and press Tab ten times |
| Touch cards | `tips_probe --touch` uses touch events, not a real finger: tap a mark on a phone and on a tablet |

## 5. The tools

All need the server on port 8800; the browser ones need Chrome and `CDP_SLOT=<n>`. Commands and one-line descriptions: `docs/PRODUCT.md` section 11. `src/tools/cdp.js` is the shared headless-Chrome driver.
