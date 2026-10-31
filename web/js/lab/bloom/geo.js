// Lab direction "bloom": the geometry and the wording of the bloom, as pure functions (no DOM, so node tests them: tests/lab-bloom.test.mjs).
//
// The bloom is an honest radial bar chart. One slot per domain, at a fixed angle in the order of the model's domains (so a viewer learns where
// each domain lives). In its slot the domain grows a leaf whose LENGTH is the share of its judged indicators that need treatment:
//     pressure = (concern + 0.5 x watch) / judged        (0 .. 1; null when nothing in the domain is judged)
// Everything is drawn in one coordinate system (VIEW); a leaf is drawn pointing up from the centre and then rotated into its slot.
import { TAU, clamp, polar, slicePath } from "../../viz/math.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const count = (v) => (isNum(v) && v > 0 ? v : 0);
const r1 = (v) => { const x = Math.round(v * 10) / 10; return Object.is(x, -0) ? 0 : x; };

// ───────────────────────────── the frame ─────────────────────────────
export const VIEW = { w: 664, h: 624, cx: 332, cy: 312 };
// radii, from the middle outwards: the disc with the count, the ring of ticks, where the leaves start, where the labels sit
export const RING = { hub: 86, tickIn: 95, tickOut: 107, base: 116, label: 246 };
// leaf lengths: a domain where nothing needs treatment still grows a short leaf (floor), one where everything does reaches `full`; a bud is a domain with nothing judged
export const LEN = { floor: 24, full: 124, bud: 20 };

// ───────────────────────────── the encoding ─────────────────────────────
export function judgedOf(c = {}) { return count(c.concern) + count(c.watch) + count(c.good) + count(c.strength); }
// the share of the judged indicators that need treatment, a watch counting half; null when nothing is judged
export function pressureOf(c = {}) {
  const j = judgedOf(c);
  return j ? clamp((count(c.concern) + 0.5 * count(c.watch)) / j, 0, 1) : null;
}
export const petalLength = (p) => LEN.floor + clamp(isNum(p) ? p : 0, 0, 1) * (LEN.full - LEN.floor);
// where a share lies on the scale: the 50% ring and the dashed "everything" ring use this same function, so they can never disagree with a leaf
export const ringRadius = (p) => RING.base + petalLength(p);
export const halfWidth = (len) => 11 + Math.max(0, len - LEN.floor) * 0.235;
export const BUD_HALF = 11;

// concern = orange (intensity by pressure), only watch = an orange outline, everything fine = teal, nothing judged = a hollow grey bud, no indicators at all = nothing drawn
export function toneOf(c = {}, n = 0) {
  if (judgedOf(c)) return count(c.concern) ? "concern" : count(c.watch) ? "watch" : "good";
  return n > 0 ? "bud" : "empty";
}

// ───────────────────────────── slots and angles ─────────────────────────────
// angles are radians clockwise from 12 o'clock; slot i of n is centred half a slot in, so that no leaf sits exactly on top and the gap at 12 is quiet
export const slotAngle = (i, n) => (n > 0 ? ((i + 0.5) / n) * TAU : 0);
export const toDeg = (a) => r1((a * 180) / Math.PI);
// the sector of one slot (used as the hit area of a leaf), between radii r0 and r1, a little narrower than the slot
export function slotWedge(i, n, rIn = RING.base - 6, rOut = ringRadius(1) + 8, gap = 0.05, v = VIEW) {
  const half = TAU / n / 2 - gap / 2, a = slotAngle(i, n);
  return slicePath(v.cx, v.cy, rIn, rOut, a - half, a + half);
}

// ───────────────────────────── the leaf ─────────────────────────────
// Right edge of the leaf as one cubic Bezier (the left edge mirrors it): pointed at both ends, the belly low (about 40% up), a sharper tip than base.
// The constants are ratios of the length L and the half width h, so a small leaf comes out plump like a bud and a long one slender.
const A1 = 0.366, B1 = 1.683, A2 = 0.391, B2 = 0.933;
function edge(base, L, h) {
  return { c1: [B1 * h, -(base + A1 * L)], c2: [B2 * h, -(base + L - A2 * L)], tip: [0, -(base + L)], from: [0, -base] };
}
const P = (pt) => `${r1(pt[0])} ${r1(pt[1])}`;
const mir = (pt) => [-pt[0], pt[1]];
// base: the radius where the leaf starts, length: how far it reaches, half: its widest half width. Local frame: pointing up (negative y) from the centre.
export function leafPath({ base = RING.base, length, half }) {
  const L = Math.max(0, length), h = Math.max(0, half), e = edge(base, L, h);
  return `M${P(e.from)}C${P(e.c1)} ${P(e.c2)} ${P(e.tip)}C${P(mir(e.c2))} ${P(mir(e.c1))} ${P(e.from)}Z`;
}
// the right half of the leaf: laid over it in a lighter tint it gives the leaf a fold
export function foldPath({ base = RING.base, length, half }) {
  const L = Math.max(0, length), h = Math.max(0, half), e = edge(base, L, h);
  return `M${P(e.from)}C${P(e.c1)} ${P(e.c2)} ${P(e.tip)}Z`;
}
// the midrib
export function veinPath({ base = RING.base, length }) {
  return `M0 ${r1(-(base + 0.07 * length))}L0 ${r1(-(base + 0.8 * length))}`;
}
// points of the right edge, for tests (is the leaf inside its slot, does the tip land where it should)
export function leafPoints({ base = RING.base, length, half }, steps = 24) {
  const e = edge(base, length, half), pts = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
    pts.push([b0 * e.from[0] + b1 * e.c1[0] + b2 * e.c2[0] + b3 * e.tip[0], b0 * e.from[1] + b1 * e.c1[1] + b2 * e.c2[1] + b3 * e.tip[1]]);
  }
  return pts;
}

// ───────────────────────────── labels and ticks ─────────────────────────────
// where the label of the slot at angle a sits: the point on the label ring (as a share of the frame, for absolute positioning) and which side of it the label's box lies on
export function labelSpot(a, r = RING.label, v = VIEW) {
  const [x, y] = polar(v.cx, v.cy, r, a), s = Math.sin(a), c = Math.cos(a);
  const side = Math.abs(s) < 0.38 ? (c >= 0 ? "t" : "b") : s > 0 ? "r" : "l";
  return { x: r1(x), y: r1(y), side, px: r1((x / v.w) * 100), py: r1((y / v.h) * 100) };
}
// a line from the end of a leaf to its label (a leaf is short when little is wrong, and its label still sits on the ring)
export function leaderLine(a, tipR, labelR = RING.label, gapIn = 7, gapOut = 9, v = VIEW) {
  const r0 = tipR + gapIn, r1_ = labelR - gapOut;
  if (r1_ - r0 < 12) return null;
  const [x1, y1] = polar(v.cx, v.cy, r0, a), [x2, y2] = polar(v.cx, v.cy, r1_, a);
  return { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2) };
}
// the fine ticks round the centre: n lines from 12 o'clock clockwise
export function tickLines(n = 60, r0 = RING.tickIn, r1_ = RING.tickOut, v = VIEW) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, [x1, y1] = polar(v.cx, v.cy, r0, a), [x2, y2] = polar(v.cx, v.cy, r1_, a);
    out.push({ k, a, x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2) });
  }
  return out;
}
export const TICK_ORDER = ["concern", "watch", "good", "strength"];
// which status each tick shows: the judged indicators spread over n ticks (largest remainder), concern first, every status that exists keeps at least one tick; null when nothing is judged
export function tickStatuses(c = {}, n = 60) {
  const j = judgedOf(c);
  if (!j) return null;
  const raw = TICK_ORDER.map((k) => ({ k, v: count(c[k]), q: (count(c[k]) / j) * n }));
  const give = raw.map((o) => ({ ...o, n: Math.floor(o.q), r: o.q - Math.floor(o.q) }));
  for (const o of give) if (o.v > 0 && o.n === 0) { o.n = 1; o.r = -1; }
  let left = n - give.reduce((s, o) => s + o.n, 0);
  for (const o of [...give].filter((x) => x.v > 0).sort((a, b) => b.r - a.r)) { if (left <= 0) break; o.n++; left--; }
  while (left < 0) { const big = give.filter((o) => o.n > 1).sort((a, b) => b.n - a.n)[0]; if (!big) break; big.n--; left++; }
  return give.flatMap((o) => Array.from({ length: o.n }, () => o.k));
}

// ───────────────────────────── the data of one bloom ─────────────────────────────
// the short name of a domain for a label ("בריאות הילד וההתפתחות" -> "בריאות הילד"): the part before the first " ו"
export const shortName = (label = "") => String(label).split(/ ו|,/)[0].trim();

export function bloomData(model) {
  const doms = (model && model.domains) || [], inds = (model && model.indicators) || [], n = doms.length;
  const petals = doms.map((d, i) => {
    const mine = inds.filter((x) => x.domain === d.id), counts = { concern: 0, watch: 0, good: 0, strength: 0, stale: 0, uncertain: 0, na: 0 };
    for (const x of mine) counts[Object.prototype.hasOwnProperty.call(counts, x.status) ? x.status : "na"]++;
    const judged = judgedOf(counts), pressure = pressureOf(counts), tone = toneOf(counts, mine.length);
    const length = tone === "bud" ? LEN.bud : tone === "empty" ? 0 : petalLength(pressure), half = tone === "bud" ? BUD_HALF : halfWidth(length);
    return { id: d.id, label: d.label, short: shortName(d.label), index: i, slots: n, angle: slotAngle(i, n), counts, n: mine.length, judged, pressure, tone, length, half, ids: mine.map((x) => x.id) };
  });
  const total = { indicators: inds.length, judged: 0, concern: 0, watch: 0, good: 0, strength: 0, none: 0 };
  for (const x of inds) if (TICK_ORDER.includes(x.status)) { total[x.status]++; total.judged++; }
  total.none = total.indicators - total.judged;
  return { petals, total, slots: n, empty: petals.every((p) => p.tone === "empty") };
}

// the order of the rows under the bloom: the longest leaf first (more concerns first among equals), then the buds, then the domains without indicators
const GROUP = { concern: 0, watch: 0, good: 0, bud: 1, empty: 2 };
export function rankPetals(petals = []) {
  return [...petals].sort((a, b) => GROUP[a.tone] - GROUP[b.tone] || (b.pressure ?? -1) - (a.pressure ?? -1) || b.counts.concern - a.counts.concern || b.judged - a.judged || a.index - b.index);
}

// ───────────────────────────── the words ─────────────────────────────
const joinHe = (parts) => (parts.length < 2 ? parts[0] || "" : parts.slice(0, -1).join(", ") + " ו" + parts[parts.length - 1]);
const IN_N = { 2: "בשני", 3: "בשלושה", 4: "בארבעה", 5: "בחמישה", 6: "בשישה", 7: "בשבעה", 8: "בשמונה", 9: "בתשעה", 10: "בעשרה" };
const ONE = (n, one, many) => (n === 1 ? one : many);

// one domain in a sentence: "3 מתוך 5 מדדים דורשים טיפול". Used in the tooltip, the screen reader's label and the rows.
export function domainWords(c = {}) {
  const concern = count(c.concern), watch = count(c.watch), good = count(c.good), strength = count(c.strength), judged = judgedOf(c);
  if (!judged) {
    const rest = count(c.uncertain) + count(c.stale) + count(c.na);
    if (!rest) return "אין בתחום מדדים ביישוב הזה";
    if (count(c.uncertain)) return "ללא שיפוט: הקבוצה קטנה מכדי להשוות או להסיק";
    if (count(c.stale)) return "ללא שיפוט: הנתון ישן";
    return "ללא שיפוט: מדדים שמתארים את היישוב ואינם נשפטים";
  }
  if (concern) {
    const first = judged === 1 ? "המדד היחיד שנשפט בתחום דורש טיפול" : concern === 1 ? `מדד אחד מתוך ${judged} דורש טיפול` : `${concern} מתוך ${judged} מדדים דורשים טיפול`;
    return first + (watch ? `, ועוד ${ONE(watch, "מדד אחד", watch)} למעקב` : "");
  }
  if (watch) return judged === 1 ? "המדד היחיד שנשפט בתחום למעקב" : watch === 1 ? `מדד אחד מתוך ${judged} למעקב` : `${watch} מתוך ${judged} מדדים למעקב`;
  const word = strength && !good ? ONE(strength, "חוזק", "חוזקות") : good && !strength ? ONE(good, "תקין", "תקינים") : "תקינים או חוזקות";
  return judged === 1 ? `המדד היחיד שנשפט בתחום: ${word}` : `כל ${judged} המדדים שנשפטו ${word}`;
}

// the same in fewer words, for a legend: "3 מתוך 5 דורשים טיפול"
export function domainShort(c = {}) {
  const concern = count(c.concern), watch = count(c.watch), good = count(c.good), strength = count(c.strength), judged = judgedOf(c);
  if (!judged) return count(c.uncertain) + count(c.stale) + count(c.na) ? "ללא שיפוט" : "אין מדדים ביישוב";
  if (concern) return judged === 1 ? "דורש טיפול" : concern === 1 ? `אחד מתוך ${judged} דורש טיפול` : `${concern} מתוך ${judged} דורשים טיפול`;
  if (watch) return judged === 1 ? "למעקב" : `${watch} מתוך ${judged} למעקב`;
  return strength && !good ? "הכול חוזק" : "הכול תקין";
}

// the sentence under the town's name: where the leaves are longest. Only what the counts say; nothing about the rest.
export function leadSentence(data) {
  const t = data.total, judged = data.petals.filter((p) => p.judged > 0);
  if (!t.judged) return "אין כאן מדדים שאפשר לשפוט.";
  const byLen = (a, b) => b.counts.concern - a.counts.concern || a.index - b.index;
  if (t.concern > 0) {
    const withConcern = judged.filter((p) => p.counts.concern > 0), top = Math.max(...withConcern.map((p) => p.pressure));
    const lead = withConcern.filter((p) => p.pressure >= top - 1e-9).sort(byLen);
    if (top >= 1 - 1e-9) {
      if (lead.length === 1) return lead[0].judged === 1 ? `ב${lead[0].short} המדד היחיד שנשפט דורש טיפול.` : `ב${lead[0].short} כל המדדים שנשפטו דורשים טיפול.`;
      if (lead.length <= 3) return `${joinHe(lead.map((p) => "ב" + p.short))} כל המדדים שנשפטו דורשים טיפול.`;
      return `${IN_N[lead.length] || "ב-" + lead.length} תחומים כל המדדים שנשפטו דורשים טיפול.`;
    }
    const p = lead[0], w = p.counts.watch;
    return `ביחס לגודל התחום, הכי הרבה מדדים דורשים טיפול ב${p.short}: ${p.counts.concern} מתוך ${p.judged}${w ? `, ועוד ${ONE(w, "אחד", w)} למעקב` : ""}.`;
  }
  if (t.watch > 0) {
    const p = [...judged].sort((a, b) => b.pressure - a.pressure || a.index - b.index)[0];
    return `אף מדד אינו דורש טיפול. ביחס לגודל התחום, הכי הרבה מדדים למעקב ב${p.short}: ${p.counts.watch} מתוך ${p.judged}.`;
  }
  return "אף מדד אינו דורש טיפול או מעקב.";
}

// what the centre says under the big number: "מתוך 35 מדדים דורשים טיפול" (the app's own phrase; N is what was judged, never the 41 of the catalogue)
export const hubWords = (total) => `מתוך ${total.judged} מדדים ${total.concern === 1 ? "דורש" : "דורשים"} טיפול`;

// the words of one tooltip row and one aria-label
export const petalLabel = (p) => `${p.label}: ${domainWords(p.counts)}`;

// ───────────────────────────── one value against its comparisons (the small dumbbell of the priorities) ─────────────────────────────
// the axis of one row: the values with some air, flipped when lower is better so that better is always on the right (as everywhere in the app)
export function miniScale(values, { unit = "", direction = null, width = 230, margin = 14 } = {}) {
  const v = values.filter(isNum);
  if (!v.length) return null;
  const lo0 = Math.min(...v), hi0 = Math.max(...v), span = hi0 - lo0, pad = span > 0 ? span * 0.22 : Math.max(Math.abs(hi0) * 0.06, 1);
  let lo = lo0 - pad, hi = hi0 + pad;
  if (unit === "%") { lo = Math.max(0, lo); hi = Math.min(100, hi); if (hi - lo < 2) { lo = Math.max(0, lo0 - 1); hi = Math.min(100, hi0 + 1); } }
  const inner = Math.max(1, width - 2 * margin), flip = direction === "lower";
  return { lo, hi, flip, x: (val) => r1(margin + ((flip ? hi - val : val - lo) / (hi - lo || 1)) * inner) };
}
// labels along an axis: left to right, one that would sit closer than `gap` to a kept one is dropped (the tooltip has every value)
export function keepLabels(items, gap = 44) {
  const kept = [];
  for (const it of [...items].sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9))) if (kept.every((k) => Math.abs(k.x - it.x) >= gap)) kept.push(it);
  return kept;
}

export const domainHref = (key, id) => `#/c/${encodeURIComponent(key)}/d/${id}`;
