// The geometry and the wording behind the lab direction "bloom" (web/js/lab/bloom/geo.js): no DOM, so it all runs in node.
// Run only this file: node --test tests/lab-bloom.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as G from "../web/js/lab/bloom/geo.js";
import { TAU } from "../web/js/viz/math.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web");
const ind = (domain, status, id = domain + Math.random().toString(36).slice(2, 6)) => ({ id, domain, status });
// a model with the canonical ten domains (only what the bloom reads)
const DOMS = [["context", "הקשר ודמוגרפיה"], ["outcomes", "מצב הבריאות ותוחלת החיים"], ["immunization", "חיסונים"], ["child", "בריאות הילד וההתפתחות"], ["nutrition", "תזונה והנקה"],
  ["mental", "בריאות הנפש"], ["welfare", "רווחה ואלימות"], ["access", "נגישות לשירותים"], ["safety", "בטיחות ופציעות"], ["env", "סביבה"]];
const model = (inds) => ({ domains: DOMS.map(([id, label]) => ({ id, label })), indicators: inds });
// the shape of Sderot: context only background, immunization and child all concern, welfare one concern, nutrition mixed, env without indicators
const SDEROT = model([
  ...Array.from({ length: 6 }, () => ind("context", "na")), ind("outcomes", "concern"), ind("outcomes", "watch"),
  ...Array.from({ length: 3 }, () => ind("immunization", "concern")), ...Array.from({ length: 4 }, () => ind("child", "concern")),
  ind("nutrition", "watch"), ind("nutrition", "watch"), ind("nutrition", "concern"), ind("nutrition", "concern"), ind("nutrition", "good"),
  ind("mental", "concern"), ind("mental", "strength"), ind("welfare", "na"), ind("welfare", "na"), ind("welfare", "na"), ind("welfare", "concern"),
  ind("access", "watch"), ind("access", "concern"), ind("access", "watch"), ind("access", "watch"), ind("access", "concern"),
  ind("safety", "watch"), ind("safety", "strength"), ind("safety", "good"), ind("safety", "good")]);

/* ── the encoding ── */
test("pressure is (concern + half the watch) over what was judged, and null when nothing is judged", () => {
  near(G.pressureOf({ concern: 3, watch: 0, good: 2 }), 3 / 5);
  near(G.pressureOf({ concern: 1, watch: 2, good: 0, strength: 1 }), 2 / 4);
  near(G.pressureOf({ watch: 4 }), 0.5);
  assert.equal(G.pressureOf({ concern: 0, watch: 0, good: 5 }), 0);
  assert.equal(G.pressureOf({ uncertain: 4, stale: 2, na: 3 }), null, "small groups, old figures and background figures are not judged");
  assert.equal(G.pressureOf({}), null); assert.equal(G.pressureOf(undefined), null);
  assert.equal(G.pressureOf({ concern: -3, watch: NaN, good: "x" }), null, "junk counts nothing");
  assert.equal(G.judgedOf({ concern: 2, watch: 1, good: 3, strength: 1, uncertain: 9 }), 7);
});

test("the leaf length grows with the pressure, from a floor to the full length, and the rings use the very same scale", () => {
  assert.equal(G.petalLength(0), G.LEN.floor); assert.equal(G.petalLength(1), G.LEN.full);
  assert.equal(G.petalLength(-5), G.LEN.floor); assert.equal(G.petalLength(7), G.LEN.full); assert.equal(G.petalLength(null), G.LEN.floor);
  let prev = -1;
  for (let k = 0; k <= 20; k++) { const l = G.petalLength(k / 20); assert.ok(l > prev); prev = l; }
  near(G.petalLength(0.5), (G.LEN.floor + G.LEN.full) / 2);
  assert.equal(G.ringRadius(1), G.RING.base + G.LEN.full, "the dashed ring is where a leaf with everything in trouble ends");
  assert.equal(G.ringRadius(0.5), G.RING.base + G.petalLength(0.5), "the inner ring is where a leaf with half in trouble ends");
  assert.ok(G.ringRadius(0.5) > G.ringRadius(0) && G.ringRadius(1) > G.ringRadius(0.5));
});

test("tone: concern is orange, only watch is an outline, all fine is teal, nothing judged is a bud, no indicators draws nothing", () => {
  assert.equal(G.toneOf({ concern: 1, good: 4 }, 5), "concern");
  assert.equal(G.toneOf({ watch: 2, good: 1 }, 3), "watch");
  assert.equal(G.toneOf({ good: 2, strength: 1 }, 3), "good");
  assert.equal(G.toneOf({ uncertain: 3 }, 3), "bud"); assert.equal(G.toneOf({}, 6), "bud");
  assert.equal(G.toneOf({}, 0), "empty");
});

/* ── slots and angles ── */
test("every domain has a fixed slot: even steps, clockwise from 12 o'clock, the same for every town", () => {
  const n = 10;
  for (let i = 0; i < n; i++) { const a = G.slotAngle(i, n); assert.ok(a > 0 && a < TAU); near(a, ((i + 0.5) / n) * TAU); if (i) assert.ok(a > G.slotAngle(i - 1, n)); }
  near(G.slotAngle(2, n) * (180 / Math.PI), 90, 1e-9);                       // the third domain (immunization) sits at 3 o'clock
  near(G.slotAngle(7, n) * (180 / Math.PI), 270, 1e-9);                      // the eighth (access) at 9 o'clock
  const a = G.bloomData(SDEROT), b = G.bloomData(model([ind("child", "good"), ind("access", "concern")]));
  assert.deepEqual(a.petals.map((p) => p.angle), b.petals.map((p) => p.angle), "the data of a town never moves a domain");
  assert.deepEqual(a.petals.map((p) => p.id), DOMS.map(([id]) => id), "the order is the model's order of domains");
  assert.equal(G.toDeg(G.slotAngle(0, 10)), 18);
});

test("the slot wedge is a closed sector inside its slot", () => {
  const d = G.slotWedge(3, 10);
  assert.match(d, /^M[\d. -]+A[\d. -]+L[\d. -]+A[\d. -]+Z$/);
  assert.ok(!/NaN/.test(d));
});

/* ── the leaf ── */
test("a leaf path is closed, finite, and ends exactly at the radius of its pressure", () => {
  for (const p of [0, 0.13, 0.5, 0.88, 1]) {
    const length = G.petalLength(p), half = G.halfWidth(length), spec = { base: G.RING.base, length, half };
    const d = G.leafPath(spec);
    assert.match(d, /^M0 -116C[\d. -]+C[\d. -]+Z$/); assert.ok(!/NaN|Infinity/.test(d));
    const pts = G.leafPoints(spec), tip = pts[pts.length - 1];
    near(tip[0], 0, 1e-9); near(-tip[1], G.ringRadius(p), 1e-9);
    near(pts[0][1], -G.RING.base, 1e-9);
    const wide = Math.max(...pts.map((q) => q[0]));
    assert.ok(wide > half * 0.9 && wide < half * 1.1, `widest ${wide} vs half ${half}`);
  }
  assert.ok(G.foldPath({ length: 80, half: 20 }).endsWith("Z")); assert.match(G.veinPath({ length: 80 }), /^M0 -[\d.]+L0 -[\d.]+$/);
  assert.ok(!/NaN/.test(G.leafPath({ length: 0, half: 0 })), "a zero leaf is still a valid path");
});

test("a leaf never leaves its slot, and two neighbouring leaves of any length keep clear of each other", () => {
  const n = 10, slot = TAU / n;
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    const length = G.petalLength(p), half = G.halfWidth(length), pts = G.leafPoints({ base: G.RING.base, length, half }, 40);
    for (const [x, y] of pts) { const r = Math.hypot(x, y), off = Math.atan2(x, -y); if (r > 1) assert.ok(Math.abs(off) < slot / 2 - 0.1, `p=${p} leaves its slot by ${off}`); }
  }
  // two full leaves side by side: the nearest points of their outlines are well apart
  const full = G.leafPoints({ base: G.RING.base, length: G.LEN.full, half: G.halfWidth(G.LEN.full) }, 60);
  const outline = (rot) => [...full, ...full.map(([x, y]) => [-x, y])].map(([x, y]) => [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)]);
  const A = outline(0), B = outline(slot);
  let min = Infinity; for (const a of A) for (const b of B) min = Math.min(min, Math.hypot(a[0] - b[0], a[1] - b[1]));
  assert.ok(min > 14, `neighbouring full leaves are only ${min.toFixed(1)} apart`);
});

test("a bud is shorter than the shortest leaf of a judged domain and plumper", () => {
  assert.ok(G.LEN.bud < G.LEN.floor);
  const d = G.bloomData(model([ind("child", "uncertain"), ind("access", "good")]));
  const bud = d.petals.find((p) => p.id === "child"), ok = d.petals.find((p) => p.id === "access"), none = d.petals.find((p) => p.id === "env");
  assert.equal(bud.tone, "bud"); assert.equal(bud.pressure, null); assert.equal(bud.length, G.LEN.bud);
  assert.equal(ok.tone, "good"); assert.equal(ok.length, G.LEN.floor);
  assert.equal(none.tone, "empty"); assert.equal(none.length, 0);
  assert.ok(bud.half / bud.length > ok.half / ok.length, "plumper");
});

/* ── the data of one bloom ── */
test("bloomData counts statuses per domain and in total, and N is what was judged, never the catalogue", () => {
  const d = G.bloomData(SDEROT), by = (id) => d.petals.find((p) => p.id === id);
  assert.deepEqual(d.total, { indicators: 35, judged: 26, concern: 14, watch: 7, good: 3, strength: 2, none: 9 });
  assert.equal(by("context").tone, "bud"); assert.equal(by("context").judged, 0); assert.equal(by("context").n, 6);
  near(by("immunization").pressure, 1); near(by("welfare").pressure, 1); near(by("outcomes").pressure, 0.75); near(by("nutrition").pressure, 0.6);
  near(by("mental").pressure, 0.5); near(by("access").pressure, 0.7); near(by("safety").pressure, 0.125);
  assert.equal(by("env").tone, "empty"); assert.equal(d.empty, false);
  assert.equal(by("welfare").judged, 1, "a domain keeps its own denominator: three of its four figures are background");
  assert.equal(G.bloomData({ domains: DOMS.map(([id, label]) => ({ id, label })), indicators: [] }).empty, true);
  assert.deepEqual(G.bloomData(null).petals, []); assert.deepEqual(G.bloomData({}).total.judged, 0);
});

test("the rows run from the longest leaf to the shortest; buds follow, domains without indicators last", () => {
  const order = G.rankPetals(G.bloomData(SDEROT).petals).map((p) => p.id);
  assert.deepEqual(order, ["child", "immunization", "welfare", "outcomes", "access", "nutrition", "mental", "safety", "context", "env"]);
  assert.deepEqual(G.rankPetals(undefined), []);
});

/* ── the ring of ticks ── */
test("the ticks show the judged indicators: concern first, every status that exists keeps a tick, always n ticks", () => {
  const s = G.tickStatuses({ concern: 14, watch: 7, good: 3, strength: 2 }, 60);
  assert.equal(s.length, 60);
  const tally = s.reduce((c, k) => ((c[k] = (c[k] || 0) + 1), c), {});
  assert.deepEqual(tally, { concern: 32, watch: 16, good: 7, strength: 5 });
  assert.deepEqual(s.slice(0, 32).filter((k) => k !== "concern"), [], "concern fills the first stretch from 12 o'clock");
  const one = G.tickStatuses({ concern: 1, good: 200 }, 60);
  assert.equal(one.length, 60); assert.equal(one.filter((k) => k === "concern").length, 1, "a single concern still lights one tick");
  assert.deepEqual(G.tickStatuses({ concern: 5 }, 60).filter((k) => k !== "concern"), []);
  assert.equal(G.tickStatuses({ uncertain: 3 }, 60), null); assert.equal(G.tickStatuses({}, 60), null);
  for (const c of [{ concern: 1, watch: 1, good: 1, strength: 1 }, { concern: 59, watch: 1 }, { watch: 7, good: 7, strength: 7 }]) assert.equal(G.tickStatuses(c, 60).length, 60);
  const t = G.tickLines(60); assert.equal(t.length, 60); near(t[0].x1, G.VIEW.cx); assert.ok(t[0].y1 < G.VIEW.cy, "the first tick is at 12 o'clock");
  near(Math.hypot(t[15].x2 - G.VIEW.cx, t[15].y2 - G.VIEW.cy), G.RING.tickOut, 0.2);
});

/* ── labels ── */
test("labels sit on a ring outside the leaves, on the side of the slot, inside the frame, and never touch each other", () => {
  assert.ok(G.RING.label > G.ringRadius(1), "outside the dashed ring");
  const n = 10, sides = Array.from({ length: n }, (_, i) => G.labelSpot(G.slotAngle(i, n)).side);
  assert.deepEqual(sides, ["t", "r", "r", "r", "b", "b", "l", "l", "l", "t"]);
  // boxes: a label is an icon over a name, up to 76 wide and 57 high (icon, two lines), put on its side of the anchor with an 8 unit gap
  const W = 76, H = 57, G8 = 8, k = G.VIEW.w / 100, boxes = [];
  for (let i = 0; i < n; i++) {
    const s = G.labelSpot(G.slotAngle(i, n)); let x0, y0;
    if (s.side === "r") { x0 = s.x + G8; y0 = s.y - H / 2; } else if (s.side === "l") { x0 = s.x - G8 - W; y0 = s.y - H / 2; } else if (s.side === "t") { x0 = s.x - W / 2; y0 = s.y - G8 - H; } else { x0 = s.x - W / 2; y0 = s.y + G8; }
    boxes.push({ x0, y0, x1: x0 + W, y1: y0 + H });
    assert.ok(s.px > 0 && s.px < 100 && s.py > 0 && s.py < 100);
  }
  for (const b of boxes) assert.ok(b.x0 >= 0 && b.x1 <= G.VIEW.w && b.y0 >= 0 && b.y1 <= G.VIEW.h, "inside the frame: " + JSON.stringify(b));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) assert.ok(boxes[i].x1 <= boxes[j].x0 || boxes[j].x1 <= boxes[i].x0 || boxes[i].y1 <= boxes[j].y0 || boxes[j].y1 <= boxes[i].y0, `labels ${i} and ${j} overlap`);
  assert.ok(k > 0);
});

test("the leader line runs from the end of a short leaf to its label, and is dropped when there is no room", () => {
  const a = G.slotAngle(2, 10), l = G.leaderLine(a, G.ringRadius(0));
  assert.ok(l && Math.hypot(l.x2 - l.x1, l.y2 - l.y1) > 60);
  assert.equal(G.leaderLine(a, G.ringRadius(1)), null);
});

/* ── the words ── */
test("short names come from the model's labels", () => {
  assert.deepEqual(DOMS.map(([, l]) => G.shortName(l)), ["הקשר", "מצב הבריאות", "חיסונים", "בריאות הילד", "תזונה", "בריאות הנפש", "רווחה", "נגישות לשירותים", "בטיחות", "סביבה"]);
});

test("a domain in a few words, for the legend", () => {
  assert.equal(G.domainShort({ concern: 3, good: 2 }), "3 מתוך 5 דורשים טיפול");
  assert.equal(G.domainShort({ concern: 1, good: 4 }), "אחד מתוך 5 דורש טיפול");
  assert.equal(G.domainShort({ concern: 1 }), "דורש טיפול");
  assert.equal(G.domainShort({ watch: 2, good: 2 }), "2 מתוך 4 למעקב");
  assert.equal(G.domainShort({ good: 3 }), "הכול תקין"); assert.equal(G.domainShort({ strength: 2 }), "הכול חוזק");
  assert.equal(G.domainShort({ uncertain: 3 }), "ללא שיפוט"); assert.equal(G.domainShort({}), "אין מדדים ביישוב");
});

test("a domain in words: how many of the judged need treatment, and what is not judged says why", () => {
  assert.equal(G.domainWords({ concern: 3, good: 2 }), "3 מתוך 5 מדדים דורשים טיפול");
  assert.equal(G.domainWords({ concern: 1, good: 4 }), "מדד אחד מתוך 5 דורש טיפול");
  assert.equal(G.domainWords({ concern: 2, watch: 3 }), "2 מתוך 5 מדדים דורשים טיפול, ועוד 3 למעקב");
  assert.equal(G.domainWords({ concern: 1 }), "המדד היחיד שנשפט בתחום דורש טיפול");
  assert.equal(G.domainWords({ watch: 2, good: 2 }), "2 מתוך 4 מדדים למעקב");
  assert.equal(G.domainWords({ watch: 1, strength: 3 }), "מדד אחד מתוך 4 למעקב");
  assert.equal(G.domainWords({ good: 3 }), "כל 3 המדדים שנשפטו תקינים");
  assert.equal(G.domainWords({ good: 1, strength: 2 }), "כל 3 המדדים שנשפטו תקינים או חוזקות");
  assert.equal(G.domainWords({ strength: 2 }), "כל 2 המדדים שנשפטו חוזקות");
  assert.match(G.domainWords({ uncertain: 3 }), /הקבוצה קטנה מכדי להשוות או להסיק/);
  assert.match(G.domainWords({ na: 6 }), /ללא שיפוט/);
  assert.match(G.domainWords({}), /אין בתחום מדדים/);
});

test("the sentence under the town's name says where the leaves are longest, and nothing else", () => {
  assert.equal(G.leadSentence(G.bloomData(SDEROT)), "בבריאות הילד, בחיסונים וברווחה כל המדדים שנשפטו דורשים טיפול.");
  const bs = model([ind("access", "concern"), ind("access", "concern"), ind("access", "watch"), ind("safety", "concern"), ind("safety", "concern"), ind("safety", "concern"), ind("safety", "watch"), ind("child", "good")]);
  assert.equal(G.leadSentence(G.bloomData(bs)), "ביחס לגודל התחום, הכי הרבה מדדים דורשים טיפול בבטיחות: 3 מתוך 4, ועוד אחד למעקב.");
  const many = model(DOMS.slice(1, 8).map(([id]) => ind(id, "concern")));
  assert.equal(G.leadSentence(G.bloomData(many)), "בשבעה תחומים כל המדדים שנשפטו דורשים טיפול.");
  assert.equal(G.leadSentence(G.bloomData(model([ind("child", "concern")]))), "בבריאות הילד המדד היחיד שנשפט דורש טיפול.");
  assert.equal(G.leadSentence(G.bloomData(model([ind("child", "watch"), ind("child", "good"), ind("access", "good")]))), "אף מדד אינו דורש טיפול. ביחס לגודל התחום, הכי הרבה מדדים למעקב בבריאות הילד: 1 מתוך 2.");
  assert.equal(G.leadSentence(G.bloomData(model([ind("child", "good"), ind("access", "strength")]))), "אף מדד אינו דורש טיפול או מעקב.");
  assert.equal(G.leadSentence(G.bloomData(model([ind("child", "uncertain"), ind("context", "na")]))), "אין כאן מדדים שאפשר לשפוט.");
  const d = G.bloomData(SDEROT);
  assert.equal(G.hubWords(d.total), "מתוך 26 מדדים דורשים טיפול");
  assert.equal(G.hubWords({ judged: 30, concern: 1 }), "מתוך 30 מדדים דורש טיפול");
  assert.equal(G.petalLabel(d.petals[2]), "חיסונים: 3 מתוך 3 מדדים דורשים טיפול");
});

/* ── one value against its comparisons ── */
test("the small dumbbell axis keeps better on the right and stays inside a percentage scale", () => {
  const hi = G.miniScale([51.9, 63.3, 65.8], { unit: "%", direction: "higher", width: 230 });
  assert.ok(hi.x(51.9) < hi.x(65.8), "higher is better: the larger value is further right");
  const lo = G.miniScale([20, 30, 46], { unit: "days", direction: "lower", width: 230 });
  assert.ok(lo.x(20) > lo.x(46), "lower is better: the smaller value is further right");
  const pc = G.miniScale([99, 100], { unit: "%", direction: "higher" });
  assert.ok(pc.hi <= 100 && pc.lo >= 0);
  for (const v of [51.9, 63.3, 65.8]) assert.ok(hi.x(v) >= 14 && hi.x(v) <= 230 - 14);
  assert.equal(G.miniScale([], {}), null); assert.ok(G.miniScale([5, 5], {}).x(5) > 0);
  const kept = G.keepLabels([{ x: 100, rank: 1 }, { x: 110, rank: 2 }, { x: 200, rank: 3 }], 44);
  assert.deepEqual(kept.map((k) => k.x), [100, 200]);
});

/* ── the rules that tests can hold ── */
test("my own files: no hex colour, no document in the pure module, no side stripes", () => {
  const files = [...fs.readdirSync(path.join(WEB, "js", "lab", "bloom")).filter((f) => f.endsWith(".js")).map((f) => path.join(WEB, "js", "lab", "bloom", f)), path.join(WEB, "css", "lab", "bloom.css")];
  assert.ok(files.length >= 2);
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    src.split("\n").forEach((line, i) => assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(line.replace(/url\([^)]*\)/g, "").replace(/&#\d+;/g, "")), `${path.basename(f)}:${i + 1} has a hex colour`));
  }
  const geo = fs.readFileSync(path.join(WEB, "js", "lab", "bloom", "geo.js"), "utf8");
  assert.ok(!/\bdocument\b|\bwindow\b/.test(geo.replace(/\/\/.*$/gm, "")), "geo.js is pure");
});
