# CHART_COOKBOOK: real calls for every chart

Written by the people who built the charts, for the people who place them on pages. Every call below uses real model fields
(`model = await getCity(key)`, `key` = the locality key, `detail = await getIndicator(key, id)`). Copy the call, change the host.
The signatures are fixed in DESIGN_V3.md section 5; a gallery with live demos and edge cases is at
`http://localhost:8800/gallery.html?family=rings|compare|time|matrix|spatial` (add `&theme=dark`, `&city=<key>`).
Every chart returns an element (marked with `viz()`, with an aria-label that carries its key numbers) that you append to your block.
Helpers: `viz/core.js` (`h`, `svg`, `num`, `fmtVal`, `C`, `toneOfStatus`, `clamp`, ...), `ui.js` (`DOMAIN_ICON`, `ltr`, `outOf`, `ptsEl`, `iso`).
`h()` and `svg()` accept custom properties in a style object (`style: { "--i": 2 }`).

## matrix.js: domainStrip, heatMatrix, priorityQuadrant, compareHeat

### domainStrip({ domains, ariaLabel, legend = true, flow = "ltr" })
One row per domain: icon, name, a strip of one pill per indicator coloured by status, and the status in words. It sorts itself (worst domain
first, worst indicator first inside a row). `model.domains[].indicators` is only a list of ids, so map them to full indicators:

```js
import { domainStrip } from "./matrix.js";
import { DOMAIN_ICON } from "../ui.js";
import { fmtVal } from "./core.js";
const domains = model.domains.map((d) => ({
  id: d.id, label: d.label, icon: DOMAIN_ICON[d.id] || "bars", href: `#/c/${key}/d/${d.id}`,
  blurb: d.blurb.split(/[:.]/)[0].trim(),                       // the strip wants one short line
  indicators: model.indicators.filter((i) => i.domain === d.id).map((i) => ({
    id: i.id, label: i.short || i.label, status: i.status, href: `#/c/${key}/i/${i.id}`,
    value: i.last && i.last.v != null ? fmtVal(i.unit, i.last.v) : "", priority: i.priority })) }));
host.append(domainStrip({ domains }));
```
- `priority` is optional (orders cells inside one status). A domain with no indicators shows a dotted pill and "אין מדדים".
- Concern = solid orange, watch = a ring in --attn-bar with a light fill, not judged = grey. Hover/focus grows the cell, dims its siblings, shows a tooltip. A click follows the href; the whole row links to the domain. Arrow keys walk the cells. On a phone the words line moves under the strip.
- `flow: "rtl"` starts the strip at the right edge; the default "ltr" puts worst on the left and best on the right ("better = right").

### heatMatrix({ rows, years, ariaLabel, refLabel = "הממוצע הארצי" })
Rows = indicators, columns = years, colour = gap from the national mean (better = teal, worse = orange; intensity scaled to the row's own largest gap).

```js
import { heatMatrix } from "./matrix.js";
const rows = model.indicators.filter((i) => i.domain === "nutrition").map((i) => ({
  id: i.id, label: i.short || i.label, href: `#/c/${key}/i/${i.id}`, unit: i.unit, direction: i.direction,
  cells: i.series.map((s) => ({ year: s.year, v: s.v, ref: s.nat })) }));
host.append(heatMatrix({ rows }));      // years default to every year found, oldest on the left
```
- `direction: null` or no reference: a blue scale by value inside the row. A missing year is a dotted empty cell. `cells[].reliable === false` is hollow (no judgement).
- Cells are 28-36px (up to 56px when there are 6 years or fewer, 18px at the smallest); the number shows inside a cell of 40px or more. The tooltip always has year, value, reference, gap, verdict.
- Phone: the label sits above its cells. Hover highlights row and column; one tab stop, arrow keys move.

### priorityQuadrant({ points, height = 420, ariaLabel, yMax })
x = standing among all localities (0-100, higher is better), y = trend (up = improving, sign-adjusted for lower-is-better), bubble area = priority.

```js
import { priorityQuadrant } from "./matrix.js";
import { clamp, toneOfStatus } from "./core.js";
const points = model.indicators.filter((i) => i.priority > 0 && i.last).map((i) => {
  const slope = i.history && i.history.slope != null ? i.history.slope : 0;
  const adj = slope * (i.direction === "lower" ? -1 : 1);
  const spread = Math.max((i.last.p75 ?? 0) - (i.last.p25 ?? 0), Math.abs(i.last.v || 0) * 0.05, 1e-6);
  return { id: i.id, label: i.short || i.label, x: i.last.level ?? 0, y: clamp(adj / spread, -1, 1),
           r: i.priority, tone: toneOfStatus(i.status), href: `#/c/${key}/i/${i.id}` };
});
host.append(priorityQuadrant({ points, height: 420 }));
```
- Real trends are small (city 9000: largest |y| is 0.29), so the trend axis zooms to the largest |y| (minimum 0.25); `yMax` fixes it.
- Two faint zones ("דחוף: חלש ומידרדר", "חוזק: חזק ומשתפר"), axis titles, 6 name labels (3 on a phone) with leader lines, the rest on hover/focus; the top priority pulses quietly. Optional `note` per point shows in the tooltip. Over 150 points only the highest priorities are drawn, with a note.

### compareHeat({ cities, domains, cells, ariaLabel })
Cities (rows) by domains (columns); each cell shows the worst status present, with the concern count.

```js
import { compareHeat } from "./matrix.js";
import { getCity } from "../api.js";
import { DOMAIN_ICON } from "../ui.js";
const cities = [{ key, name: model.city.name }, ...model.peers.slice(0, 3)];          // peers are { key, name }
const models = await Promise.all(cities.map((c) => (c.key === key ? model : getCity(c.key))));
const cells = {};
models.forEach((m, k) => { cells[cities[k].key] = {}; for (const d of m.domains) cells[cities[k].key][d.id] = d.counts; });
const domains = model.domains.filter((d) => d.id !== "context").map((d) => ({
  id: d.id, label: d.label, short: d.label.split(/ ו|,/)[0], icon: DOMAIN_ICON[d.id] || "bars" }));   // short is optional
host.append(compareHeat({ cities, domains, cells }));
```
- Row headers link to `#/c/<key>`; the tooltip gives all four counts. On a phone the table scrolls horizontally with sticky row headers. One tab stop, arrow keys move.

Pure helpers exported for tests and for pages that need the same logic: domainCounts, sortIndicators, sortDomains, domainTone, stripParts, stripWords, heatRow, heatLayout, gapText, cellText, trendDomain, quadLayout, quadScales, bubbleNodes, placeLabels, quadrantOf, trendWord, worstStatus, WORST_ORDER, MAX_BUBBLES.
Known limits: the strip's cells are links (about 40 tab stops on a full overview; arrow keys also work); heatMatrix drops the oldest years with a note when even 18px cells cannot fit; `series[]` has no per-year reliability, so a hollow heat cell comes only from `cells[].reliable === false` set by the page.

## time.js: lineChart, columnChart, sparkArea, trajectory, smallMultiples (+ adapters)

Time always runs left to right, newest on the right. Examples use `a = model.indicators.find((x) => x.id === "bmi_g1_over")`, `key = model.city.key`.

### lineChart(host, cfg)
Takes the old cfg unchanged: `{ series, target, projection, unit, height, compact, ariaLabel, extra(x) }`; new optional fields: `band`, `events`, `hollow` on a point, `endLabel`, `dots`, `width`.
Returns `host`; calling it again on the same host updates the chart. It draws when the host gets a width (fine inside a hidden host: no `requestAnimationFrame` wrapper needed).

```js
import { lineChart, legendOf, indicatorLine, peerBand, EVENTS_IL } from "./viz/time.js";
const d = await getIndicator(key, a.id);                                   // GET /api/city/:key/indicator/:id
const cfg = indicatorLine(a, model.city.name, { band: peerBand(d.peers, "iqr"), events: EVENTS_IL });
lineChart(box, cfg); box.after(legendOf(cfg));
```
- `indicatorLine(a, cityName, { nat, peer, target, projection, band, events, compact, height })`: nat, peer, target, projection default to true; the rest to null/false. A group with `a.last.reliable === false` is drawn hollow, no projection.
- `peerBand(peers, "range" | "iqr", label?)` returns `{ lo, hi, label, short }` ("range" = lowest to highest, "iqr" = the middle half). `EVENTS_IL = [{ x: 2020, x2: 2021, label: "קורונה" }, { x: 2023, label: "המלחמה" }]`.
- `lineLegend(items)` = `legendRow` from core.js (`[{ label, color, dash }]`); `legendOf(cfg)` builds the legend that matches a cfg.
- Default heights: 292 desktop, 252 below 480px, 168 `compact`; `cfg.height` overrides. Old call style still works: `lineChart(box, { series, target, projection, unit, ariaLabel, extra })`.
- City line 2.5px with a gradient area, national 2px, peers median dashed pink with an optional soft band, dashed target with a "יעד" chip, dashed projection ("המשך המגמה") with a hollow end dot, events as a pale band or hairline with a chip (a chip that does not fit is dropped; never in `compact`), the last city point pulses. Hover = crosshair + one tooltip; keyboard: Left/Right walk the years, Home/End, Escape. One point = a single large dot; gaps break the line.

### columnChart(host, cfg)
`cfg = { points: [{ x, y, hollow? }], nat: [{ x, y }], target: [{ x, y }], unit, height, ariaLabel, label?, extra? }`; values are written above the columns when there are at most 8, otherwise only the last.
```js
columnChart(box, { ...indicatorColumns(a), label: model.city.name });
```

### sparkArea(points, nat, { w = 92, h = 30, endDot = true, area = true, unit?, label? })  → `<svg>`
Drop-in for the old `sparkline`. With `year` on the points a missing year breaks the line; without it the points are spaced evenly. The aria-label states direction and numbers.
```js
sparkArea(a.series.map((s) => ({ v: s.v, year: s.year })), a.series.map((s) => s.nat), { w: 92, h: 30, unit: a.unit, label: a.short });
```

### trajectory({ history, from, to, nat, unit, width = 260, height = 120, label })  → element
History, the dot for today, a dashed line to the target with a flag, the national value as a reference. Scales to its container up to `width`.
```js
const rec = model.recommendations.find((r) => r.kpis && r.kpis.length), k = rec.kpis[0], ind = model.indicators.find((x) => x.id === k.indicator);
const cfg = kpiTrajectory(k, ind);          // from/to are display strings: the number is extracted; byYear is the target x
if (cfg) box.append(trajectory(cfg));       // null when the target has no number or no byYear
```

### smallMultiples({ items, cols?, ariaLabel? })  → `<ul>`
```js
smallMultiples({ items: model.indicators.filter((a) => a.series.length >= 3).slice(0, 9).map((a) => smallItem(a, `#/c/${key}/i/${a.id}`)), cols: 3 });
```
`cols` is a maximum; cells are never narrower than 200px (a phone gets one column). The delta chip shows the change since the first year with a sign and an arrow; its tone (good/attn) is set only when `direction` is known and the figure is reliable; an unreliable group gets a hollow status dot.

Adapters: indicatorLine, indicatorColumns, kpiTrajectory, smallItem, peerBand, legendOf. Pure helpers: deltaOf(first, last, { unit, direction, reliable }) → `{ d, dir, sign, mag, suffix, flat, tone }`, sparkSummary, numberIn, normLine, lineLayout, columnLayout, sparkLayout, trajectoryLayout, lineHeight, columnHeight, textWidth, cleanPts, typicalStep, splitRuns, xTickValues, slotTicks, yDomain, pathD, areaD, bandD, columnPath, polyLen, rectsOverlap, segHitsRect, polyHitsRect, polyYAt, placeBox, placeLabel.
Known limits: label widths are estimated from a character table (a very long Hebrew series label wraps only in the tooltip); lines are straight segments by design; the keyboard walk from the last year with ArrowLeft twice landed one year further than expected (not investigated); tooltip on a plain Tab focus depends on `:focus-visible`.

## compare.js: divergingBars, dumbbell, lollipopRank, distribution

`import { divergingBars, dumbbell, lollipopRank, distribution, diffText } from "./compare.js";` (`diffText(unit, v)` gives "+8.2 נק׳" / "−3 ימים"; `signed(v, d)` too.) Inside the app use `href: "#/c/<key>/i/<id>"`.

### divergingBars({ items, max, ariaLabel, zeroLabel, betterLabel, worseLabel })
`items = [{ id, label, sub?, gap, text, href?, tone? }]`; `gap` is signed (positive = better, shown to the right) and sets the bar length (|gap| / max); mix units only after putting `gap` on a common scale (the spread between localities). `text` is the string at the end of the row.
```js
const usable = model.indicators.filter((a) => a.direction && a.last && Number.isFinite(a.last.gapNat) && Number.isFinite(a.last.nat) && a.last.reliable !== false && !a.stale);
const spreadOf = (a) => Math.max(Number.isFinite(a.last.p25) && Number.isFinite(a.last.p75) ? a.last.p75 - a.last.p25 : 0, a.unit === "%" ? 5 : Math.abs(a.last.v) * 0.1 || 1);
const items = usable.map((a) => ({
  id: a.id, label: a.short || a.label, sub: `${fmtVal(a.unit, a.last.v)} לעומת ${fmtVal(a.unit, a.last.nat)} ארצי`,
  gap: (a.last.gapNat * (a.direction === "lower" ? -1 : 1)) / spreadOf(a),          // right = better
  text: diffText(a.unit, a.last.gapNat),                                           // keeps the real sign
  href: `#/c/${key}/i/${a.id}` })).sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap)).slice(0, 12).sort((x, y) => y.gap - x.gap);
el.append(divergingBars({ items, zeroLabel: "ממוצע ארצי" }));
```
HTML rows (label and sub on the right, the bar lane in the middle, the value on the left in the tone colour); bars grow from the centre; rows with `href` are links; under 560px the label goes above the bar. `gap: 0` = a dot on the axis, `gap: null` = a "no data" row, an empty list = a quiet empty box; `tone: "watch"` draws an outline bar. A very small non-zero gap is drawn at least 10px wide.

### dumbbell({ rows, unit, shared = true, direction, ariaLabel })
`rows = [{ label, href?, note?, unit?, direction?, points: [{ key: "city"|"nat"|"peer"|"sector"|"ses"|"target", label, v, hollow? }] }]`; `direction: "lower"` flips the axis so that better is on the right. `shared: false` gives each row its own axis and unit (no tick labels; each value is labelled).
```js
// a) the gaps inside the city: rows = groups, points = the city's group value against the national value of the same group
const a = model.indicators.find((x) => x.equity && (x.equity.sector || x.equity.ses));
const rows = [...(a.equity.sector ? a.equity.sector.rows : []), ...(a.equity.ses ? a.equity.ses.rows : [])].map((r) => ({
  label: r.label, note: `${num(r.d, 0)} בקבוצה`, href: `#/c/${key}/i/${a.id}`,
  points: [{ key: "nat", label: "ארצי באותה קבוצה", v: r.natV }, { key: "city", label: model.city.name, v: r.v, hollow: r.d < minBase }] }));   // minBase from (await getIndicator(key, a.id)).indicator.minBase
dumbbell({ rows, unit: a.unit, shared: true, direction: a.direction });
// b) several percentages on one axis
dumbbell({ unit: "%", shared: true, direction: "higher", rows: pct.map((a) => ({ label: a.short || a.label, href: `#/c/${key}/i/${a.id}`, points: [
  { key: "city", label: city, v: a.last.v }, { key: "nat", label: "ארצי", v: a.last.nat },
  ...(a.last.peer != null ? [{ key: "peer", label: "יישובים דומים", v: a.last.peer }] : []),
  ...(a.last.target != null ? [{ key: "target", label: "יעד", v: a.last.target }] : [])] })) });
```
`target` and `hollow: true` are drawn as rings; value labels are spread apart and, when they still crowd, only the two extremes stay (the rest are in the tooltip); a long row label is cut with an ellipsis; one legend row under the chart; hovering a row dims the others.

### lollipopRank({ items, unit, nat, direction, ariaLabel, selfLabel })
`items = [{ name, v, rank?, self?, d?, href?, hollow? }]`, already in display order (`detail.neighbours` is).
```js
lollipopRank({ items: det.neighbours.map((n) => ({ name: n.name, v: n.v, rank: n.rank, self: n.self, d: n.d, href: `#/c/${n.k}/i/${id}` })),
  unit: det.indicator.unit, nat: det.analysis.last.nat, direction: det.indicator.direction });
```
40px rows, rank number, stem and dot, the city's row tinted with an "העיר" badge, a dashed national line with an "ארצי" tag; `hollow: true` = a ring, no rank, muted row.

### distribution({ values, city, nat, target, p25, p75, unit, direction, items, height = 190, ariaLabel, selfLabel })
```js
const l = det.analysis.last, d = det.distribution;
distribution({ values: d.values, city: l.v, nat: l.nat, target: l.target, p25: d.p25, p75: d.p75, unit: det.indicator.unit, direction: det.indicator.direction,
  items: det.map.map((m) => ({ name: m.name, v: m.v })), height: 230 });
```
Equal-width bins, the city's bin in `--c-city`, a density curve and the p25..p75 band behind, a solid national line and a dashed target line with chips that dodge each other, the city's pin with a value chip; `items` adds up to 3 locality names per bin to the tooltip. A city outside the range sits at the edge with an arrow; one value, equal values and no values are handled. Limits: on a phone the national and city chips can crowd when the values differ by a few tenths.

## rings.js: statusDonut, progressRing, gauge, standingMeter, waffle

```js
import { statusDonut, progressRing, gauge, standingMeter, waffle } from "./rings.js";
import { toneOfStatus } from "./core.js";                 // strength|good -> "good", watch -> "watch", concern -> "attn", stale|uncertain|na -> "none"
const ind = (id) => model.indicators.find((i) => i.id === id);
```
- **statusDonut({ counts, size = 220, thickness, centerValue, centerLabel, legend = true, onPick, ariaLabel })**: `statusDonut({ counts: model.counts, onPick: (status) => goTo(status) })`. `model.counts = { strength, good, watch, concern, stale }` (centre: the number of concerns and "דורשים טיפול"); a domain's `model.domains[i].counts` works too (`size: 200`, or `size: 120, legend: false`). `onPick` gets "concern" | "watch" | "good" | "strength" | "background"; segments and legend rows are buttons only when `onPick` is given. `model.counts` has no na/uncertain: to draw the grey "ללא שיפוט" arc build `all = model.indicators.reduce((c, i) => ((c[i.status] = (c[i.status] || 0) + 1), c), {})` and pass that (shares are then out of all 41). All-zero counts give an empty grey ring with "אין מדדים שנשפטו". Keep the legend when taps matter on a phone (the ring segments alone are under 40px).
- **progressRing({ value, max = 100, size = 72, thickness, tone = "good", label, display, i = 0 })**: `progressRing({ value: model.recommendations[0].score, tone: "attn", label: "עדיפות" })`; in a list row `size: 56, i: rowIndex`; `display: "4/6"` replaces the centre text. `watch` and `attn` are the same orange.
- **gauge({ value, min = 0, max, unit, nat, target, direction, tone, size = 240, label })**: `const m = ind("th_mmrv"); gauge({ value: m.last.v, unit: m.unit, nat: m.last.nat, target: m.last.target, direction: m.direction, tone: toneOfStatus(m.status), label: m.short })`. `max` defaults to 100 for "%" and otherwise a round number above value, nat and target; a missing nat or target removes just that tick; a value outside the scale stops the arc at the end, keeps the real number and says so in the tooltip; `null` shows "—". The drawing is wider than `size` (324×204 at size 240) and scales down; use `size: 200` in narrow cards. Do not draw it for a small group.
- **standingMeter({ level, rank, of, tone, label })**: `const r = ind("road_severe_100k"); standingMeter({ level: r.last.level, rank: r.last.rank, of: r.last.of, tone: toneOfStatus(r.status), label: r.short })` → "מקום 143 מתוך 155"; `standingMeter({ level: 8 })` → "טוב מ-8% מהיישובים"; `standingMeter({})` → "אין דירוג". Tone omitted: good from 66, attn up to 34, else none. Block element, up to 560px wide.
- **waffle({ value, nat, direction, tone, noun, size = 220, label })** (for unit "%"): `waffle({ value: b.last.v, nat: b.last.nat, direction: b.direction, tone: toneOfStatus(b.status), noun: "ילדי כיתה א׳", label: b.short })` → "מתוך כל 100 ילדי כיתה א׳: 24", and the cells above (or below) the national value are marked. Cells = round(value), filled row by row from the top right.
- **Small groups (`last.reliable === false`)**: the ring charts have no `reliable` input; for such a figure draw no gauge, meter or waffle (show the figure and the honest note), or pass `tone: "none"` and no `level`/`rank`.
- **Dark band** (a hero): set `--r-ink`, `--r-ink-2`, `--r-ink-3` (text), `--r-surface` (what the chart sits on) and `--r-track` on the band or any ancestor; the whole family follows (demo: gallery section "על רקע כהה").
- Reusable sentences: `targetPhrase({ unit: "%", direction: "higher", value: 66.1, target: 80 })` = "חסרות 13.9 נק׳ ליעד"; `meterText(meterModel({ level: 8, rank: 143, of: 155 }))`; `waffleCaption({ value, nat, noun })`.

## spatial.js: dotMap, locator

**dotMap({ points, cityKey, unit, direction, nat, peers = [], height = 540, ariaLabel, geo, city, minBase, label, onPick })** → `div.v-map`. One dot per locality at its real position; size = residents, colour = standing (a diverging scale from `--attn-bar` through a quiet neutral to `--good-bar`; with `direction: null` a sequential blue scale by quantile).
```js
import { dotMap, locator } from "./spatial.js";
import { getIndicator, getGeo } from "../api.js";
const [ind, geo] = await Promise.all([getIndicator(model.city.key, "th_mmrv"), getGeo()]);
const I = ind.indicator, last = ind.analysis.last;           // ind.map = [{ k, name, v, d, x, y }, ...]
box.append(dotMap({ points: ind.map, cityKey: model.city.key, unit: I.unit, direction: I.direction, nat: last ? last.nat : null,
  peers: ind.peers.map((p) => p.key), geo, minBase: I.minBase, label: I.short,
  onPick: (p) => { location.hash = `#/c/${p.k}/i/${I.id}`; } }));
```
- `geo` (the `/api/geo` list) gives dots their size, draws localities without a figure as faint context dots, supplies up to 5 place names and finds the city when it is missing from `points`; leave it `undefined` and the chart fetches it itself, `geo: null` turns that off.
- `city: { k, name, v, x, y }` when the city is not in `points` (`v: null` draws it hollow with "אין נתון"): `city: { k: model.city.key, name: model.city.name, v: null, x: model.city.lon, y: model.city.lat }`.
- `minBase`: a point with `d < minBase` or `reliable === false` is hollow and takes no rank or colour. `label` = the figure's short name for tooltip and aria. `onPick(point)` on click or Enter.
- The city has a halo, a pulse and a chip with its name and value (placed where it covers the fewest dots); peers have a thin pink outline; hover dims the field and redraws the hot dot; the legend column (standing in words, the colour bar, the size key, keys for peers/small groups/no data, the national mean) sits beside the map and stacks under it below ~480px container width. Keyboard: one tab stop on the city, arrow keys walk to the nearest dot, Home = back to the city, Enter = onPick, Escape clears; an aria-live region announces the dot and a hidden table lists the city, peers and the 5 strongest and weakest.
- Fixed Israel frame, default canvas about 308×540 (centred in wide containers; `height: 700` gives about 395px wide). Give the container `min-width: 0` inside a grid.
- Entrance: the city first, then a wave of dots by distance, the chip at about 0.5s, the pulse last (the dot wave ends around 1.3s).

**locator({ geo, cityKey, width = 120, ariaLabel })** → `div.v-map-loc`: the country as a field of dots, the city lit in `--teal` with a ping. The dots use `currentColor` at half opacity, so put it in a container that sets `color` (a hero is white): `hero.append(locator({ geo, cityKey: model.city.key, width: 120, ariaLabel: `מיקום ${model.city.name} על המפה` }))`. The sidebar city switch already uses it at 26px.

## Rules of thumb that every family follows
- Every chart has an aria-label with its key numbers, focusable marks (or one tab stop with arrow keys), the same tooltip on focus as on hover, a screen-reader table; entrance motion only through the shared vocabulary; tokens only; time left to right; better to the right.
- Charts that need a width draw when their host gets one; a resize redraws without replaying the entrance (the `.in` state lives on the outer element).
- Never ask a chart to draw a small group (`reliable === false`) as a verdict: pass it hollow (`hollow: true` / `reliable: false`) or leave the chart out and write the honest note.
- `STATUS_COLOR.watch` is the token `--watch-bar` (a paler orange, theme-aware).

