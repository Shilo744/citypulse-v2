// The cards of the product (web/js/product/kit/tips.js): a card that shows on a mark must say something the page does not already say next to it.
// Pure parts run as they are: the text test (isRedundant: the owner's two examples are redundant, a new number or a new word is not), the figure helpers and every extra (one case for each, with a made-up figure and
// with the real figure of Sderot when the store is there), the plans. The part that reads the screen (visibleText, readCard) runs on the tiny fake document. The browser side is src/tools/tips_probe.js.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FEl, FText } from "./helpers/fake-dom.mjs";
import { haveStore, model as cityModel } from "./helpers/city-models.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const T = await import(pathToFileURL(path.join(ROOT, "web", "js", "product", "kit", "tips.js")).href);
const { isRedundant, rowRedundant, numbersOf, wordsOf, changeWords, diffWords, extrasFor, EXTRA, PLAN, seriesOf, visibleText, readCard, trimSeen } = T;
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
// the unit words come with a no-break space (ui.js deltaUnit): the tests compare plain spaces
const N = (x) => (x == null ? x : JSON.parse(JSON.stringify(x).replace(/\u00a0/g, " ")));
const X = new Proxy(EXTRA, { get: (t, k) => (...args) => N(t[k](...args)) });
const cw = (...a) => N(changeWords(...a)), dw = (...a) => N(diffWords(...a));

// a made-up figure: higher is better, five years, the group is large enough
const fig = (over = {}) => ({
  id: "x1", label: "פעוטות שחוסנו", short: "חיסון", unit: "%", direction: "higher", status: "concern", baseShift: null,
  series: [
    { year: 2020, v: 61.2, n: 477, d: 780, nat: 71.6, target: 75, peer: 75.5 }, { year: 2021, v: 58, n: 504, d: 869, nat: 67, target: 75, peer: 66.2 },
    { year: 2022, v: 50, n: 446, d: 892, nat: 63.7, target: 80, peer: 61.6 }, { year: 2023, v: 51.8, n: 433, d: 836, nat: 64, target: 80, peer: 66.2 },
    { year: 2024, v: 51.9, n: 450, d: 867, nat: 65.8, target: 80, peer: 63.3 }
  ],
  last: { year: 2024, v: 51.9, nat: 65.8, rank: 167, of: 187, level: 10, reliable: true }, ...over
});
const meta = { indicators: [{ id: "x1", source: "s1", definition: "מספר הפעוטות שחוסנו מתוך כל הפעוטות. המדד נמדד שנתי." }], sources: [{ id: "s1", name: "התכנית הלאומית", publisher: "משרד הבריאות (פורטל)" }] };
const base = (a, extra = {}) => ({ a, year: null, model: { city: { name: "שדרות" }, sources: meta.sources }, meta, self: true, cityName: "שדרות", ...extra });

test("isRedundant: the two examples of the owner are redundant, a new number or a new word is not", () => {
  // the cell of the years matrix: the card says the row, the year and the value, and the cell shows them
  assert.equal(isRedundant("פגיעות ילדים בחדר מיון, 2023 / ערך 68.2", "פגיעות ילדים בחדר מיון 2019 2020 2021 2022 2023 68.2 אין נתון"), true);
  // the standing bar: the marker already says "better than 24% of the towns"
  assert.equal(isRedundant("איפה התחום עומד בין היישובים טוב יותר מ-24% מהיישובים בארץ", "איפה התחום עומד בין היישובים טוב מ-24% מהיישובים 187"), true);
  assert.equal(isRedundant("פגיעות ילדים בחדר מיון, 2023 / ערך 68.2", "פגיעות ילדים בחדר מיון 2023 68.1"), false, "another number");
  assert.equal(isRedundant("פגיעות ילדים בחדר מיון, 2023 / ערך 68.2", "פגיעות ילדים 2023 68.2"), false, "a word of the card is nowhere on the page");
  assert.equal(isRedundant("טוב יותר מ-24% מהיישובים בארץ ובעולם", "טוב מ-24% מהיישובים"), false, "a new word");
  assert.equal(isRedundant("טוב יותר מ-25% מהיישובים בארץ", "טוב מ-24% מהיישובים"), false, "a new number");
  assert.equal(isRedundant("", "כל דבר"), true, "an empty card says nothing");
});

test("isRedundant: the little words of a card are no news, a sign and a year are", () => {
  assert.equal(isRedundant("מצב ערך 5", "דבר 5"), true, "the names of rows (ערך, מצב) are no news; the number is there");
  assert.equal(isRedundant("מצב ערך 5", "דבר 6"), false);
  assert.equal(isRedundant("ערך 5.7 מצב", "הערך 5.70 של המדד"), true, "5.70 and 5.7 are one number; ערך and מצב are the names of rows");
  assert.equal(isRedundant("פער −9.3 נק׳", "מאז 2020: 9.3 נק׳"), false, "the minus sign makes another number");
  assert.equal(isRedundant("ב-2019 מ-24%", "2019 24"), true, "a hyphen after a letter is no minus");
  assert.equal(isRedundant("1,221 יישובים", "1221 יישוב"), true, "thousands and a plural");
  assert.equal(isRedundant("חלש מהממוצע הארצי", "חלש מהממוצע הארצי: הצד החלש"), true, "prefixes of a word (מ, ה) are stripped on both sides");
  assert.equal(isRedundant("2023", "2022"), false, "another year");
  assert.deepEqual([...numbersOf("ב-2019 מ-24% −9.3 (−4) 1,221 30–35% 2020-2024 5.70")].sort(), ["-4", "-9.3", "1221", "2019", "2020", "2024", "24", "30", "35", "5.7"].sort());
  assert.deepEqual(wordsOf("טוב ב-24% Ab1"), ["טוב", "ab"]);
});

test("rowRedundant: an extra whose figures are all there already adds nothing", () => {
  assert.equal(rowRedundant("מאז 2020 ירד ב-9.3 נק׳", "−9.3 נק׳ מאז 2020 דורש טיפול"), true);
  assert.equal(rowRedundant("מאז 2017 ירד ב-9.3 נק׳", "−9.3 נק׳ מאז 2020"), false, "the year is not the same");
  assert.equal(rowRedundant("מקור משרד הבריאות", "מקור: משרד הבריאות · התכנית"), true);
  assert.equal(rowRedundant("מקור משרד הבריאות", "דבר אחר"), false);
});

test("changeWords and diffWords: the direction in words, never invented for a figure that has none", () => {
  const a = fig(), p = (v, year = 2024) => ({ year, v });
  assert.equal(cw(a, p(61.2, 2020), p(51.9)), "ירד ב-9.3 נק׳ · לכיוון הלא טוב");
  assert.equal(cw(a, p(50, 2022), p(51.8, 2023)), "עלה ב-1.8 נק׳ · לכיוון הטוב");
  assert.equal(cw(fig({ direction: "lower", unit: "per100k" }), p(6.9, 2020), p(10.2)), "עלה ב-3.3 לכל 100,000 · לכיוון הלא טוב");
  assert.equal(cw(fig({ direction: "lower", unit: "per100k" }), p(10.2, 2023), p(6.9)), "ירד ב-3.3 לכל 100,000 · לכיוון הטוב");
  assert.equal(cw(fig({ direction: null, unit: "count" }), p(25138, 2017), p(36061)), "עלה ב-10,923", "a background figure only rises or falls");
  assert.equal(cw(a, p(51.9, 2023), p(51.9)), "ללא שינוי");
  assert.equal(cw(fig({ unit: "days", direction: "lower" }), p(27, 2023), p(26)), "ירד ביום אחד · לכיוון הטוב", "one day is said as Hebrew says it");
  assert.equal(cw(fig({ unit: "days", direction: "lower" }), p(26, 2023), p(46)), "עלה ב-20 ימים · לכיוון הלא טוב");
  assert.equal(dw(fig({ unit: "years", direction: "higher" }), 1), "גבוה בשנה אחת · טוב יותר");
  assert.equal(cw(a, null, p(1)), null);
  assert.equal(dw(a, 5.2), "גבוה ב-5.2 נק׳ · טוב יותר");
  assert.equal(dw(a, -7.1), "נמוך ב-7.1 נק׳ · חלש יותר");
  assert.equal(dw(fig({ direction: null }), 3), "גבוה ב-3 נק׳");
  assert.equal(dw(a, 0.001), "ללא הפרש");
});

test("extras: the change from the year before and since the first year, with the years named", () => {
  const a = fig(), f = (year) => base(a, { year });
  assert.deepEqual(X.prev(f(2022)), { id: "prev", label: "לעומת 2021", value: "ירד ב-8 נק׳", sub: "לכיוון הלא טוב" });
  assert.deepEqual(X.prev(base(a)), { id: "prev", label: "לעומת 2023", value: "עלה ב-0.1 נק׳", sub: "לכיוון הטוב" }, "no year: the latest one");
  assert.equal(X.prev(f(2020)), null, "the first year has no year before it");
  assert.deepEqual(X.first(f(2024)), { id: "first", label: "מאז 2020", value: "ירד ב-9.3 נק׳", sub: "לכיוון הלא טוב" });
  assert.equal(X.first(f(2021)), null, "the year before the card's year is the first year: the row above says it");
  assert.equal(X.first(f(2020)), null);
});

test("extras: the best or the weakest year, in the words of the figure's direction", () => {
  const a = fig();
  assert.deepEqual(X.extreme(base(a, { year: 2022 })), { id: "extreme", label: "השנה הטובה בסדרה", value: "2020 · 61.2%" });
  assert.deepEqual(X.extreme(base(a, { year: 2020 })), { id: "extreme", label: "השנה החלשה בסדרה", value: "2022 · 50%" }, "the card's year is the best one: the weakest year is the news");
  assert.equal(X.extreme(base(fig({ series: fig().series.slice(0, 3) }))), null, "fewer than four years are not a history");
  const d = fig({ direction: null, unit: "count", series: [2017, 2018, 2019, 2020].map((year, i) => ({ year, v: 100 + i * 10 })) });
  assert.equal(X.extreme(base(d, { year: 2018 })).label, "השנה הגבוהה בסדרה", "a figure with no direction is neither best nor weakest");
  assert.equal(X.extreme(base(d, { year: 2020 })).label, "השנה הנמוכה בסדרה");
});

test("extras: the national average, the similar towns, the target and the cases of the card's own year", () => {
  const a = fig();
  assert.deepEqual(X.nat(base(a, { year: 2022 })), { id: "nat", label: "ממוצע ארצי ב-2022", value: "63.7%" }, "the national average of THAT year, not the latest one");
  assert.deepEqual(X.nat(base(a)), { id: "nat", label: "ממוצע ארצי ב-2024", value: "65.8%" });
  assert.deepEqual(X.peer(base(a, { year: 2021 })), { id: "peer", label: "יישובים דומים ב-2021", value: "66.2%" });
  assert.equal(X.peer(base(a, { noPeers: true })), null, "a very small town has no similar towns");
  assert.deepEqual(X.target(base(a, { year: 2021 })), { id: "target", label: "יעד ב-2021", value: "75%", key: "יעד 75%" });
  assert.deepEqual(X.base(base(a, { year: 2023 })), { id: "base", label: "מבוסס על", value: "433 מתוך 836" });
  assert.deepEqual(X.base(base(fig({ unit: "per1000" }), { year: 2023 })), { id: "base", label: "גודל הקבוצה", value: "836" });
  assert.equal(X.nat(base(a, { year: 1999 })), null, "a year the series does not have");
});

test("extras: the official guideline is read when a figure has one and never fails when it has none", () => {
  const none = fig({ series: fig().series.map((p) => ({ ...p, target: null })) });
  assert.equal(X.target(base(none)), null);
  assert.doesNotThrow(() => X.target(base(fig({ guide: undefined, series: [] }))));
  assert.deepEqual(X.target(base({ ...none, guide: "הנחיית משרד הבריאות: לפחות 90%" })), { id: "target", label: "הנחיה רשמית", note: "הנחיית משרד הבריאות: לפחות 90%" });
  assert.deepEqual(X.target(base({ ...none, guide: { text: "עד 5 ימים" } })), { id: "target", label: "יעד להתמצאות", note: "עד 5 ימים" }, "a reference that does not judge is called by its word, the target for orientation");
  assert.equal(X.target(base({ ...none, guide: { value: 90 } })), null, "an object it does not know is left alone");
  assert.equal(X.target(base({ ...none, guide: "טקסט" }, { year: 2022 })), null, "a guideline is not the target of a year");
});

test("extras: the status in the product's words, the place among the towns only for the latest year and a group that can be judged", () => {
  const a = fig();
  assert.deepEqual(X.status(base(a)), { id: "status", label: "מצב", value: "דורש טיפול" });
  assert.equal(X.status(base(a, { year: 2022 })), null, "the status belongs to the latest figure");
  assert.deepEqual(X.place(base(a)), { id: "place", label: "מקום בין היישובים", value: "167 מתוך 187" });
  assert.deepEqual(X.place(base(a, { year: 2024 })), { id: "place", label: "מקום בין היישובים", value: "167 מתוך 187" });
  assert.equal(X.place(base(a, { year: 2022 })), null, "a place among the towns exists for the latest year only");
  assert.equal(X.place(base(a, { calm: true })), null);
  assert.equal(X.status(base(fig({ status: "na" }))).value, "מדד רקע, ללא שיפוט");
});

test("a figure on a group too small to judge: no change, no comparison, no place, no status of judgement", () => {
  const s = fig({ last: { ...fig().last, reliable: false } }), f = base(s, { year: 2022 });
  for (const id of ["prev", "first", "extreme", "nat", "peer", "target", "place", "vsMain", "vsNat", "natSpan", "natPrev"]) assert.equal(X[id]({ ...f, value: 50, span: [2020, 2024] }), null, id);
  assert.equal(X.status(base(s)).value, "קבוצה קטנה, ללא שיפוט");
  assert.deepEqual(extrasFor("heat", f, "").map((r) => r.id), ["base"], "the heat cell of a small group gets the number of cases behind it and nothing that judges");
  const shifted = fig({ baseShift: 30 });
  assert.equal(X.prev(base(shifted)), null, "the basis of the figure moved: the years are not set against each other");
  assert.equal(X.first(base(shifted)), null);
  assert.equal(X.extreme(base(shifted)), null);
});

test("a background figure of a very small town (calm): its own change is told, the nation, similar towns, target and place are not", () => {
  const a = fig({ status: "na", direction: null }), f = base(a, { year: 2022, calm: true, span: [2020, 2024], value: 50 });
  for (const id of ["nat", "peer", "target", "place", "vsMain", "vsNat", "natSpan", "natPrev"]) assert.equal(X[id](f), null, id);
  assert.equal(X.prev(f).label, "לעומת 2021", "its own change from the year before is told, without a good or a bad way (it has no direction)");
  assert.equal(X.prev(f).sub, "");
  assert.deepEqual(extrasFor("chipNat", { ...f, year: null }, "").map((r) => r.id), []);
});

test("an extra that throws on a figure of an unknown shape is left out, the other rows stay", () => {
  const broken = { ...fig(), series: [null, { year: "x" }, { year: 2022, v: 5 }] };
  assert.doesNotThrow(() => extrasFor("heat", base(broken, { year: 2022 }), ""));
  assert.doesNotThrow(() => extrasFor("strip", { a: null, model: {}, meta: {}, self: true }, ""));
  assert.doesNotThrow(() => extrasFor("segment", { group: null }, ""));
});

test("extras: who published the figure and what it measures (no catalogue, no row)", () => {
  const a = fig();
  assert.deepEqual(X.source(base(a)), { id: "source", label: "מקור", value: "משרד הבריאות", note: "התוכנית הלאומית" }, "the catalogue's old spelling of the programme is mended");
  assert.deepEqual(X.def(base(a)), { id: "def", label: "מה נמדד", note: "מספר הפעוטות שחוסנו מתוך כל הפעוטות." }, "the first sentence");
  assert.equal(X.source(base(a, { meta: null })), null);
  assert.equal(X.def(base(a, { meta: null })), null);
  assert.equal(X.source(base(a, { meta: { indicators: [{ id: "other" }] } })), null);
  assert.deepEqual(X.source({ a: null, metaId: "x1", model: base(a).model, meta }), { id: "source", label: "מקור", value: "משרד הבריאות", note: "התוכנית הלאומית" }, "a figure that is not measured for the town is found by its catalogue id");
});

test("extras: another town set against the page's town and against the nation, never for a small group", () => {
  const a = fig(), f = base(a, { self: false, year: 2024, value: 77.8 });
  assert.deepEqual(X.vsMain(f), { id: "vsMain", label: "מול שדרות", value: "גבוה ב-25.9 נק׳", sub: "טוב יותר" });
  assert.deepEqual(X.vsNat(f), { id: "vsNat", label: "מול הארצי ב-2024", value: "גבוה ב-12 נק׳", sub: "טוב יותר" });
  assert.equal(X.vsMain({ ...f, hollow: true }), null);
  assert.equal(X.vsNat({ ...f, value: null }), null);
  assert.equal(X.vsMain({ ...f, self: true }), null, "the page's own town is not set against itself");
  assert.deepEqual(X.vsNat({ ...f, year: 2022, value: 60 }), { id: "vsNat", label: "מול הארצי ב-2022", value: "נמוך ב-3.7 נק׳", sub: "חלש יותר" }, "the national average of the card's year");
});

test("extras: the national average at the two ends of a change, and the year before on the national mark", () => {
  const a = fig();
  assert.deepEqual(X.natSpan(base(a, { span: [2020, 2024] })), { id: "natSpan", label: "הממוצע הארצי באותן שנים", value: "מ-71.6% ל-65.8%" });
  assert.equal(X.natSpan(base(a, { span: [2019, 2024] })), null);
  assert.deepEqual(X.natPrev(base(a)), { id: "natPrev", label: "ממוצע ארצי ב-2023", value: "64%" });
});

test("extras of a category: the figures of a ring segment (weakest first, at most five) and the strongest and weakest figure of the category", () => {
  const mk = (id, level, status = "concern") => ({ id, label: "מדד " + id, short: "ש" + id, status, last: { level, rank: 100 - level, of: 187, reliable: true } });
  const list = ["a", "b", "c", "d", "e", "f", "g"].map((id, i) => mk(id, 10 + i * 5));
  const names = X.names({ group: list });
  assert.deepEqual(names.list, ["שa", "שb", "שc", "שd", "שe"]);
  assert.equal(names.more, "ועוד 2");
  assert.equal(X.names({ group: [list[0]] }).label, "המדד");
  assert.equal(X.names({ group: [] }), null);
  const e = X.edges({ list });
  assert.deepEqual(e.list[0], ["החלש ביותר:", "שa, מקום 90 מתוך 187"]);
  assert.deepEqual(e.list[1], ["החזק ביותר:", "שg, מקום 60 מתוך 187"]);
  assert.equal(X.edges({ list: [list[0]] }), null);
  assert.equal(X.edges({ list: [list[0], { ...list[1], status: "na" }] }), null, "a background figure is not judged");
  assert.equal(X.edges({ list: [list[0], { ...list[1], last: { ...list[1].last, reliable: false } }] }), null, "a small group is not set against the others");
});

test("planFor: the official target is the first extra of a figure that has one (after the status of a strip or a link), the plan is untouched for a figure that has none, and a year with no target says nothing of it", () => {
  const { planFor, hasTarget } = T;
  const judged = fig({ guide: { judges: true, text: "לפחות 80%", source: { short: "משרד הבריאות" } } }), orient = fig({ guide: { judges: false, text: "עד 5" }, series: fig().series.map((p) => ({ ...p, target: null })) }), none = fig({ series: fig().series.map((p) => ({ ...p, target: null })) });
  assert.equal(hasTarget(judged), true); assert.equal(hasTarget(orient), false, "a reference that does not judge is no target"); assert.equal(hasTarget(none), false); assert.equal(hasTarget(null), false);
  assert.deepEqual(planFor("heat", { a: judged }), ["target", "prev", "first", "base", "extreme", "peer"]);
  assert.deepEqual(planFor("spark", { a: judged }), ["target", "prev", "first", "extreme", "peer"]);
  assert.deepEqual(planFor("strip", { a: judged }), ["status", "target", "place", "prev", "first", "extreme", "source", "def"], "a strip opens with the status, then the target");
  assert.deepEqual(planFor("link", { a: judged }).slice(0, 3), ["status", "target", "place"]);
  assert.deepEqual(planFor("heat", { a: none }), PLAN.heat, "no target: the plan as it is"); assert.deepEqual(planFor("heat", { a: orient }), PLAN.heat);
  assert.deepEqual(planFor("line", { a: judged }), PLAN.line, "a kind whose plan has no target is not given one"); assert.deepEqual(planFor("nope", { a: judged }), PLAN.figure);
  // a year that has no target value: no target row (nothing is invented), the other rows come as before
  const noYear = fig({ guide: judged.guide, series: fig().series.map((p) => (p.year === 2022 ? { ...p, target: null } : p)) });
  assert.ok(!extrasFor("heat", base(noYear, { year: 2022 }), "").some((r) => r.id === "target"));
  assert.equal(extrasFor("heat", base(noYear, { year: 2021 }), "")[0].id, "target");
  // the cards of every year of a figure with a target carry it, the first one too (the card says who published it and where the figure stands)
  for (const year of [2020, 2021, 2022, 2023]) assert.equal(extrasFor("heat", base(judged, { year }), "", 2)[0].id, "target", String(year));
  assert.equal(extrasFor("heat", base(judged, { year: 2024 }), "", 2)[0].label, "יעד רשמי (משרד הבריאות)");
  // the national mean of the card is 80% and so is the target (8300, iron): the number 80 is on the card, the target is not: it stays
  const same = fig({ guide: judged.guide, series: fig().series.map((p) => ({ ...p, nat: 80 })), last: { ...fig().last, nat: 80 } });
  assert.equal(extrasFor("heat", base(same, { year: 2024 }), "ממוצע ארצי 80%", 2)[0].id, "target", "a number that two facts share is no proof that the card says the target");
  assert.ok(!extrasFor("heat", base(same, { year: 2024 }), "ממוצע ארצי 80% יעד לפחות 80%", 2).some((r) => r.id === "target"), "the page that says the target next to the mark has it already");
});

test("extrasFor: what the page already says is not said again; a blank cell and a count get nothing; the most is kept", () => {
  const a = fig(), f = base(a, { year: 2022 }), plain = base({ ...a, series: a.series.map((p) => ({ ...p, target: null })) }, { year: 2022 });
  const all = extrasFor("heat", plain, "");
  assert.deepEqual(all.map((r) => r.id), ["prev", "first", "base"], "the heat cell of a figure with no target: at most three rows, in the order of the plan");
  assert.deepEqual(extrasFor("heat", plain, "", 2).map((r) => r.id), ["prev", "first"], "a card that already has four rows gets two");
  assert.deepEqual(extrasFor("heat", f, "").map((r) => r.id), ["target", "prev", "first"], "a figure with an official target hears it first (the plan puts it fifth: it never came)");
  assert.deepEqual(extrasFor("heat", f, "", 2).map((r) => r.id), ["target", "prev"], "and a card that already has four rows keeps the target");
  assert.deepEqual(extrasFor("spark", f, "").map((r) => r.id), ["target", "prev", "first"]);
  const seen = extrasFor("heat", f, "ירד ב-8 נק׳ לעומת 2021 ירד ב-11.2 נק׳ מאז 2020");
  assert.ok(!seen.some((r) => r.id === "prev" || r.id === "first"), "a change that the card or the page tells is not added");
  assert.deepEqual(extrasFor("heat", { ...f, empty: true }, ""), [], "a blank cell: the key of the chart says what blank means");
  assert.deepEqual(extrasFor("bin", f, ""), [], "a bar of towns is not about the page's town");
  assert.deepEqual(extrasFor("meter", f, ""), [], "the place among the towns is on the page: no historical place exists, so the card has nothing to add");
  // the change of the page's own town is never put on the card of another town
  const other = extrasFor("lolli", base(a, { self: false, value: 40, year: null }), "");
  assert.ok(other.every((r) => !["prev", "first", "extreme", "status", "place", "peer", "base"].includes(r.id)), other.map((r) => r.id).join());
  assert.ok(other.some((r) => r.id === "vsMain"));
  assert.deepEqual(extrasFor("chipNat", base(a), "").map((r) => r.id), ["natPrev"], "the national mark gets the nation's own year before, not the town's change");
  assert.deepEqual(PLAN.subgroup, ["source", "def"], "a row of one group of the town says only who published the figure and what it measures");
  assert.deepEqual(PLAN.figure, ["source", "def"], "a mark of an unknown kind never gets the change of the page's own town");
  const sub = extrasFor("subgroup", base(a, { year: 2022 }), "").map((r) => r.id);
  assert.ok(sub.every((id) => ["source", "def"].includes(id)) && sub.length === 2, sub.join());
  for (const kind of Object.keys(PLAN)) for (const id of PLAN[kind]) assert.equal(typeof EXTRA[id], "function", `${kind}: ${id}`);
});

test("the real figure of Sderot: every extra on a card is a number the model has", { skip: !haveStore }, () => {
  const m = cityModel("1031"), a = m.indicators.find((x) => x.id === "th_mmrv");
  const f = { a, year: 2022, model: m, meta: null, self: true, cityName: m.city.name };
  const prev = X.prev(f), first = X.first({ ...f, year: 2024 }), nat = X.nat(f);
  assert.equal(prev.label, "לעומת 2021");
  assert.equal(first.label, "מאז 2020");
  assert.equal(nat.value, "63.7%", "the national average of 2022 in the series");
  for (const x of m.indicators) for (const kind of ["heat", "spark", "line", "strip", "link"]) for (const year of [null, ...seriesOf(x).map((p) => p.year)]) {
    const rows = extrasFor(kind, { a: x, year, model: m, meta: null, self: true, cityName: m.city.name }, "");
    for (const r of rows) assert.ok(typeof r.label === "string" && r.label && (r.value || r.note || r.list), `${x.id} ${kind} ${year}`);
    if (x.last && x.last.reliable === false) assert.ok(rows.every((r) => ["status", "source", "def"].includes(r.id)), `${x.id}: a small group gets no change or comparison`);
  }
});

// ── the part that reads the screen, on the tiny fake document ──
const el = (tag, cls, ...kids) => { const e = new FEl(tag); if (cls) cls.split(" ").forEach((c) => e.classList.add(c)); e.append(...kids.map((k) => (typeof k === "string" ? new FText(k) : k))); return e; };

test("visibleText: the text of the mark and its row, without what is hidden from the eye (a screen-reader twin, a hidden block, an svg title)", () => {
  const row = el("li", "", el("span", "", "שיעור חיסון"), el("span", "sr", "טקסט לקורא מסך 99"), el("table", "sr", el("td", "", "טבלה 77")),
    el("div", "", "42%"), (() => { const h = el("div", "", "מוסתר 55"); h.hidden = true; return h; })(), el("title", "", "כותרת של svg 33"), el("svg", "", el("text", "", "2024")));
  const t = visibleText(row);
  for (const want of ["שיעור חיסון", "42%", "2024"]) assert.ok(t.includes(want), want);
  for (const not of ["99", "77", "55", "33"]) assert.ok(!t.includes(not), "hidden text counted: " + not);
  assert.equal(isRedundant("שיעור חיסון 42%", t), true);
  assert.equal(isRedundant("שיעור חיסון 99%", t), false, "the number of the screen-reader twin does not count as seen");
});

test("readCard: the head, the rows (name and value) and the plain text of a shared card", () => {
  const tt = el("div", "tt", el("div", "th", "פעוטות, 2021"), el("div", "tr", el("span", "k", "ערך"), el("b", "", "58%")), el("div", "tr", el("span", "k", "ממוצע ארצי"), el("b", "", "67%")));
  const c = readCard(tt);
  assert.equal(c.head, "פעוטות, 2021");
  assert.deepEqual(c.rows, [{ label: "ערך", value: "58%" }, { label: "ממוצע ארצי", value: "67%" }]);
  assert.equal(c.text, "פעוטות, 2021ערך58%ממוצע ארצי67%");
});

test("trimSeen: the rows of the shared card that the page shows next to the mark are taken off, the head and the new rows stay", () => {
  const row = (k, v) => el("div", "tr", el("span", "k", k), el("b", "", v));
  const tt = el("div", "tt", el("div", "th", "ביתר עילית"), row("מקום", "186"), row("ערך", "62.5%"), row("מול הארצי", "−18.1 נק׳"), row("גודל הקבוצה", "2,528"), row("מקום", "1 מתוך 6"), el("div", "", "טוב יותר מ-24% מהיישובים בארץ"));
  const n = trimSeen(tt, "ביתר עילית 186 62.5% טוב מ-24% מהיישובים 1 2 3 4 5 6");
  assert.equal(n, 3, "the place (186), the value (62.5%) and the sentence that the marker already says");
  assert.deepEqual(tt.children.map((c) => c.textContent), ["ביתר עילית", "מול הארצי−18.1 נק׳", "גודל הקבוצה2,528", "מקום1 מתוך 6"], "a row with only small numbers stays: they could meet by chance");
  const extra = el("div", "tr n-kit-tipx", el("span", "k", "לעומת 2023"), el("b", "", "עלה ב-0.1 נק׳"));
  tt.append(extra);
  trimSeen(tt, "לעומת 2023 עלה ב-0.1 נק׳");
  assert.ok(tt.children.includes(extra), "an extra row is never trimmed");
});

// ── the plumbing: loaded after the first paint, in the kit's own stylesheet, with no word the product does not speak ──
test("app.js loads the cards after the first paint and hands over the context of every route", () => {
  const app = read("web/js/product/app.js");
  assert.match(app, /import\("\.\/kit\/tips\.js"\)/);
  assert.doesNotMatch(app, /^import .*kit\/tips/m, "not on the static path of the first screen");
  assert.match(app, /setContext\(ctx\)/);
});

test("the extra rows are styled in kit.css with the n-kit- prefix, with tokens only", () => {
  const css = read("web/css/product/kit.css"), block = css.slice(css.indexOf("the extra rows of a card"));
  assert.ok(block.length > 200 && /n-kit-tipx/.test(block) && /n-kit-tipnote/.test(block));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block) && !/border-(?:left|right|inline-start|inline-end)\s*:\s*[3-9]px/.test(block), "no hex, no side stripe");
  for (const line of block.split("\n").filter((l) => /\{/.test(l))) assert.ok(line.trim().startsWith('html[data-ui="n"]') || line.trim().startsWith("/*"), line);
});

test("tips.js: no hex, no keyframes, no first person, no word the kit forbids", () => {
  const src = read("web/js/product/kit/tips.js").replace(/\/\/.*$/gm, "");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(src.replace(/&#\d+;/g, "")) && !/@keyframes/.test(src));
  for (const re of [/פרמטר/, /מדאיג/, /אחוזון/, /מובהק/, /המודל/, /(?<![א-ת])אנחנו(?![א-ת])/, /(?<![א-ת])לנו(?![א-ת])/, /בסיס קטן/]) assert.ok(!re.test(src), String(re));
});
