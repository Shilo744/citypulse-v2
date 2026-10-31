// The official guidelines in the product's screens (b2): kit/guide.js says them, the rows of the town page and of the category page carry the target, the figure's page has its panel,
// the cards say it, the method and coverage pages have their section, the entry page counts only data sources, the glossary explains the two words.
// Pure parts run on stub figures; the real figures come from the built store (skipped without it). The look is checked in a browser by src/tools (ui_smoke, product_matrix) and in pictures.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { haveStore, model as cityModel } from "./helpers/city-models.mjs";
import { installDom, fakeFetch } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = path.join(ROOT, "web", "js", "product");
const load = (f) => import(pathToFileURL(path.join(PROD, f)).href);
const require = createRequire(import.meta.url);
const { h, statusReason } = await import(pathToFileURL(path.join(ROOT, "web", "js", "ui.js")).href);
const G = await load("kit/guide.js"), D = await load("city/data.js"), S = await load("city/sentence.js"), M = await load("simple/model.js"), T = await load("kit/tips.js"), text = await load("entry/text.js"), groups = await load("city/groups.js"), net = await load("net.js");
const glossary = await load("kit/glossary.js"), method = await load("pages/method.js"), coverage = await load("pages/coverage.js"), domain = await load("pages/domain.js"), indicator = await load("pages/indicator.js");
const skip = !haveStore && "the built store is not there";
const dom = async (fn) => { const d = installDom(); try { await fn(d); await new Promise((r) => setTimeout(r, 400)); } finally { d.restore(); } };          // a short wait: the page finishes its own later work before the fake document goes away
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
// the page puts a no-break space after a colon: the text the eye reads is compared with plain spaces
const C = (t) => G.clean(t).replace(/ /g, " ");
const plainLines = (p) => p.lines.map((l) => C(l.t));
const catalogue = haveStore ? JSON.parse(JSON.stringify(require("../src/api").publicCatalog())) : null;

// a made-up figure with a judging official target (higher is better): 51.9 against 80, the country at 65.8
const guide = (o = {}) => ({ kind: "official_target", value: 80, unit: "%", direction: "atLeast", year: "2024", scope: "national", text: "לפחות ⁦80%⁩", caveat: "יעד של משרד הבריאות לנותני שירות.", judges: true, comparable: true, gap: -28.1, relGap: -0.35, meets: false,
  source: { id: "moh_quality_report", publisher: "משרד הבריאות", short: "משרד הבריאות", title: "התוכנית הלאומית למדדי איכות, עמוד 359", url: "https://example.org/a.pdf", where: "עמוד 359" }, ...o });
const fig = (o = {}) => ({ id: "th_x", domain: "child", label: "פעוטות שחוסנו", short: "חיסון", unit: "%", direction: "higher", importance: 4, status: "concern", statusWhy: ["rank", "target"], stale: false, guide: guide(), benchmark: null,
  last: { year: 2024, v: 51.9, nat: 65.8, target: 80, level: 10, rank: 167, of: 187, reliable: true, meetsTarget: false, gapTarget: -28.1 }, ...o });

// ── the table of reasons ──
test("NO_TARGET: a plain reason for every indicator the catalogue gives no official target, and for no other", () => {
  const { indicators } = require("../src/catalog/indicators");
  const without = indicators.filter((i) => !i.guideline).map((i) => i.id).sort();
  assert.deepEqual(Object.keys(G.NO_TARGET).sort(), without, "the table is the list of indicators with no official target");
  const research = JSON.parse(read("research/guidelines.json")).none.map((x) => x.indicator);
  for (const id of research) assert.ok(G.NO_TARGET[id], `${id}: the research looked for a target and found none, the product says why`);
  for (const [id, why] of Object.entries(G.NO_TARGET)) {
    assert.ok(/\.$/.test(why) && why.split(/\s+/).length <= 22, `${id}: one plain sentence: ${why}`);
    assert.ok(!/אנחנו|לנו|מצטערים|לצערנו|לא הצלחנו/.test(why), `${id}: no apology, no "we"`);
  }
});

// ── the state of a figure against its target ──
test("stateOf and rowTarget: meets, near, below, far in the distances of the status rules; a small group and a figure with no judging target say nothing", () => {
  const { RULES } = require("../src/model/analyze.js");
  assert.deepEqual([G.NEAR.pts, G.NEAR.rel, G.FAR.pts, G.FAR.rel], [RULES.nearTarget, RULES.targetNearRel, RULES.farBelowTarget, RULES.targetFarRel], "the words use the numbers of the rules");
  assert.equal(G.stateOf(fig()), "far", "28 points short");
  assert.equal(G.stateOf(fig({ statusWhy: ["rank"], status: "concern", guide: guide({ gap: -2.7 }) })), "near", "within 5 points, whatever the status says");
  assert.equal(G.stateOf(fig({ statusWhy: ["rank"], status: "concern", guide: guide({ gap: -7 }) })), "below", "between 5 and 10 points: not near, not far");
  assert.equal(G.stateOf(fig({ guide: guide({ gap: -10 }) })), "below"); assert.equal(G.stateOf(fig({ guide: guide({ gap: -10.1 }) })), "far"); assert.equal(G.stateOf(fig({ guide: guide({ gap: -5 }) })), "near");
  assert.equal(G.stateOf(fig({ unit: "days", direction: "lower", guide: guide({ unit: "days", direction: "atMost", gap: -4, relGap: -0.3 }) })), "far", "another unit: a share of the target");
  assert.equal(G.stateOf(fig({ unit: "days", direction: "lower", guide: guide({ unit: "days", direction: "atMost", gap: -1, relGap: -0.08 }) })), "near");
  assert.equal(G.stateOf(fig({ status: "good", statusWhy: [], guide: guide({ meets: true, gap: 4.2 }) })), "meets");
  assert.equal(G.stateOf(fig({ last: { ...fig().last, reliable: false } })), null, "a group too small is never set against a target");
  assert.equal(G.stateOf(fig({ guide: guide({ meets: null, gap: null }) })), null);
  assert.equal(G.stateOf(fig({ guide: guide({ judges: false }) })), null, "a reference that does not judge has no state");
  assert.equal(G.stateOf(fig({ guide: null })), null);
  const t = G.rowTarget(fig());
  assert.equal(t.tick, 80, "a percentage target is marked on the bar"); assert.equal(t.natMiss, true, "the country is short of it too");
  assert.equal(t.word, "רחוק מהיעד"); assert.equal(C(t.text), "לפחות 80%"); assert.equal(G.rowTarget(fig({ last: { ...fig().last, nat: 90 } })).natMiss, false, "no claim about the country when the data does not say it");
  assert.equal(typeof G.rowSegs, "undefined"); assert.equal(typeof G.rowPlain, "undefined"); assert.equal(typeof G.NAT_MISS, "undefined"); // the words of the line live in city/data.js tgtSegs/tgtPlain (pinned in product-simple-rows)
  assert.equal(G.rowTarget(fig({ unit: "days", guide: guide({ unit: "days", value: 14 }) })).tick, null, "no tick on a bar that has no fixed scale");
  const low = G.rowTarget(fig({ direction: "lower", guide: guide({ direction: "atMost", text: "עד 5%", value: 5, meets: true, gap: 1 }), last: { ...fig().last, v: 4, nat: 6 } }));
  assert.equal(low.state, "meets"); assert.equal(low.natMiss, true, "for a lower-is-better target the country above it is short of it");
  assert.equal(low.word, "עומד ביעד"); assert.equal(C(low.text), "עד 5%");
});

// ── the panel of the figure's page ──
test("panelOf: a target that judges says who published it, the year, the distance in words and the caveat; the country and the target side by side only when they disagree", () => {
  const p = G.panelOf(fig());
  assert.equal(p.kind, "target"); assert.equal(p.label, "היעד הרשמי");
  assert.deepEqual(plainLines(p), ["היעד: לפחות 80% (משרד הבריאות, 2024).", "חסרות 28.1 נקודות אחוז להגיע ליעד.", "גם הממוצע הארצי (65.8%) לא הגיע ליעד."]);
  assert.equal(p.lines[1].em, true, "where the figure stands is the strong line"); assert.equal(p.note, "יעד של משרד הבריאות לנותני שירות."); assert.equal(p.source.url, "https://example.org/a.pdf");
  // better than the country and short of the target: the owner's question, answered in one sentence
  const better = G.panelOf(fig({ last: { ...fig().last, v: 68, nat: 65.8 }, guide: guide({ gap: -12, meets: false }), statusWhy: ["target"] }));
  assert.ok(plainLines(better).includes("הערך טוב מהממוצע הארצי, ובכל זאת רחוק מהיעד."), plainLines(better).join(" | "));
  assert.ok(G.panelOf(fig({ last: { ...fig().last, v: 73, nat: 65.8 }, guide: guide({ gap: -7, meets: false }) })).lines.some((l) => C(l.t) === "הערך טוב מהממוצע הארצי, ובכל זאת מתחת ליעד."));
  assert.ok(G.panelOf(fig({ last: { ...fig().last, v: 77.5, nat: 65.8 }, guide: guide({ gap: -2.5, meets: false }) })).lines.some((l) => C(l.t) === "הערך טוב מהממוצע הארצי, ובכל זאת קצת מתחת ליעד."));
  // worse than the country and meeting the target; "תקין" because of the target although the place among the towns is low
  const met = G.panelOf(fig({ status: "good", statusWhy: [], last: { ...fig().last, v: 82, nat: 85, level: 30, meetsTarget: true }, guide: guide({ meets: true, gap: 2 }) }));
  assert.deepEqual(plainLines(met), ["היעד: לפחות 80% (משרד הבריאות, 2024).", "עומד ביעד, הערך גבוה ממנו ב-2 נקודות אחוז.", "הערך נמוך מהממוצע הארצי, ובכל זאת עומד ביעד."], "that the status is תקין because of the target is said once, under the title (reasonOf), not again in the panel");
  // the country short of a target the town met: "גם" would say that the town missed it too
  const natLow = G.panelOf(fig({ status: "good", statusWhy: [], last: { ...fig().last, v: 82, nat: 70, level: 60, meetsTarget: true }, guide: guide({ meets: true, gap: 2 }) }));
  assert.ok(plainLines(natLow).includes("הממוצע הארצי (70%) עדיין מתחת ליעד."), plainLines(natLow).join(" | ")); assert.ok(!plainLines(natLow).join(" ").includes("גם"));
  const small = G.panelOf(fig({ guide: guide({ meets: null, gap: null }), last: { ...fig().last, reliable: false } }));
  assert.deepEqual(plainLines(small), ["היעד: לפחות 80% (משרד הבריאות, 2024).", "הקבוצה קטנה, ולכן אין השוואה ליעד."]);
});

test("panelOf: a reference that does not judge is orientation only, a benchmark is not a target, a figure with none says so without an apology", () => {
  const road = G.panelOf(fig({ id: "road_severe_100k", guide: guide({ judges: false, comparable: false, gap: null, meets: null, unit: "pct_reduction", text: "הפחתה של 25% בפגיעה חמורה בחמש שנים", scope: "national", source: { ...guide().source, short: "הרשות הלאומית לבטיחות בדרכים" } }) }));
  assert.equal(road.kind, "orient");
  assert.deepEqual(plainLines(road), ["היעד: הפחתה של 25% בפגיעה חמורה בחמש שנים (הרשות הלאומית לבטיחות בדרכים, 2024).", "הוא מוצג להתמצאות בלבד ואינו משנה את מצב המדד."]);
  assert.equal(road.label, "יעד להתמצאות");
  assert.ok(!plainLines(road).join(" ").includes("חסרות"), "no distance for a reference that does not judge");
  const infant = G.panelOf(fig({ guide: guide({ judges: false, scope: "international", text: "עד 25 ל-1,000", meets: true, gap: 22 }) }));
  assert.equal(plainLines(infant)[0], "היעד: עד 25 ל-1,000 (משרד הבריאות, 2024).", "no 'international target': the label says what kind of target it is, the line says what it is"); assert.ok(!plainLines(infant).join(" ").includes("עומד ביעד"), "no 'meets' for a loose ceiling");
  const bench = G.panelOf(fig({ id: "bmi_g7_over", guide: null, benchmark: guide({ kind: "international_benchmark", direction: "atMost", text: "22%", year: "2021/22", judges: false, gap: -8.9, meets: false, source: { ...guide().source, short: "ארגון הבריאות העולמי" } }) }));
  assert.equal(bench.kind, "bench"); assert.equal(bench.label, "נקודת ייחוס");
  assert.equal(plainLines(bench)[0], "נקודת הייחוס: 22% (ארגון הבריאות העולמי, 2021/22).");
  assert.equal(plainLines(bench)[1], "היא מוצגת להקשר בלבד, אינה יעד ואינה משנה את מצב המדד.", "context only, the status is not changed");
  assert.deepEqual(plainLines(bench).slice(2), [G.NO_TARGET.bmi_g7_over], "the reason there is no official target, said once (it says 'אין יעד' itself)");
  assert.ok(!plainLines(bench).join(" ").includes("חסרות") && !plainLines(bench).join(" ").includes("רחוק"), "a benchmark never judges");
  const none = G.panelOf(fig({ id: "life_expectancy", guide: null }));
  assert.deepEqual(plainLines(none), [G.NO_TARGET.life_expectancy], "a reason that says 'לא נמצא יעד' is not said twice"); assert.equal(none.source, null);
  assert.deepEqual(plainLines(G.panelOf(fig({ id: "mortality_std", guide: null }))), ["אין יעד רשמי למדד הזה.", G.NO_TARGET.mortality_std], "a reason that only explains gets the plain statement before it");
  assert.deepEqual(plainLines(G.panelOf(fig({ id: "future_id", guide: null }))), ["לא נמצא גוף רשמי שפרסם יעד מתאים לנתון הזה."], "a figure the table does not know still says it plainly");
});

test("panelOf: a reference that does not judge never says which way is good and never contradicts the page (the page's own line says the way once; a background figure has none)", () => {
  const judged = (x) => !/טוב יותר|חלש יותר|נמוך ממנה|גבוה ממנה|לשפוט|לדרג/.test(plainLines(x).join(" "));
  const bench = (o = {}) => G.panelOf(fig({ id: "pov_children", direction: null, status: "na", statusWhy: [], guide: null, benchmark: guide({ kind: "international_benchmark", direction: "atMost", text: "12.2%", year: "2021", judges: false, gap: null, meets: null, source: { ...guide().source, short: "OECD" } }), ...o }));
  assert.ok(judged(bench()), "the panel of a background figure: the reference, who, the year, context only: " + plainLines(bench()).join(" | "));
  const lower = G.panelOf(fig({ id: "bmi_g1_over", direction: "lower", guide: null, benchmark: guide({ kind: "international_benchmark", direction: "atMost", text: "29%", year: "2022", judges: false, gap: 5.1, meets: true, source: { ...guide().source, short: "ארגון הבריאות העולמי" } }) }));
  assert.ok(judged(lower), plainLines(lower).join(" | ")); assert.ok(!plainLines(lower).join(" ").includes("5.1"), "no distance from a reference that must not judge: the caveat of the server says a town is not set against it");
  for (const x of [bench(), lower]) { assert.equal(x.lines.filter((l) => l.em).length, 1, "one strong line: the one that says it is context"); assert.equal(plainLines(x).filter((t) => /המדד/.test(t) && /משנה/.test(t)).length, 1, "the status is said once"); }
});

test("panelOf: the caveat that opens by saying the same thing at greater length is the line, said once; a caveat that adds no figure stays small print", () => {
  const road = G.panelOf(fig({ id: "road_severe_100k", guide: guide({ judges: false, comparable: false, gap: null, meets: null, unit: "pct_reduction", text: "הפחתה של 25% לעומת ממוצע 2020-2024", year: "2025",
    caveat: "יעד ארצי לחמש שנים: הפחתה של 25% לעומת ממוצע השנים 2020-2024, ולא יותר מ-273 הרוגים ב-2030. היעד סופר אנשים ולא תאונות. לכן הוא מוצג כרקע.", source: { ...guide().source, short: "הרשות" } }) }));
  assert.equal(C(road.lines[0].t), "יעד ארצי לחמש שנים: הפחתה של 25% לעומת ממוצע השנים 2020-2024, ולא יותר מ-273 הרוגים ב-2030 (הרשות, 2025).");
  assert.equal(road.note, "היעד סופר אנשים ולא תאונות. לכן הוא מוצג כרקע.", "the small print holds what the line did not say");
  const other = G.panelOf(fig({ guide: guide({ judges: false, comparable: false, gap: null, meets: null, text: "עד 25 ל-1,000", caveat: "תקרה רופפת של האו״ם לגיל אחר." }) }));
  assert.equal(other.note, "תקרה רופפת של האו״ם לגיל אחר."); assert.equal(C(other.lines[0].t).startsWith("היעד: עד 25"), true);
});

test("sourceLabel: the publisher once, the title once, no repeated half, no code, no colon of its own; the old spelling of the programme mended", () => {
  const lab = (short, title) => G.sourceLabel({ short, publisher: short, title });
  assert.equal(lab("ארגון הבריאות העולמי", "השמנה בילדים באזור אירופה של ארגון הבריאות העולמי: הסבב החמישי של COSI, הסבב החמישי של COSI"), "השמנה בילדים באזור אירופה של ארגון הבריאות העולמי · הסבב החמישי של COSI", "the publisher is in the title already, the half is said once");
  assert.equal(lab("OECD", "מאגר המשפחה של OECD: עוני ילדים (CO2.2), טבלה CO2.2"), "מאגר המשפחה של OECD · עוני ילדים", "the code in brackets and the table of that code leave");
  assert.equal(lab("משרד הבריאות", "התוכנית הלאומית למדדי איכות, דוח 2013-2024, עמוד 359"), "משרד הבריאות · התוכנית הלאומית למדדי איכות, דוח 2013-2024, עמוד 359", "a title that does not name the publisher gets it, once");
  assert.equal(lab("משרד הבריאות", "התכנית הלאומית למדדי איכות: טיפות חלב, שדה היעד"), "משרד הבריאות · התוכנית הלאומית למדדי איכות · טיפות חלב, שדה היעד");
  assert.equal(lab("האו״ם", ""), "האו״ם", "no title: the publisher"); assert.equal(G.sourceLabel(null), ""); assert.equal(G.sourceLabel({}), "");
  for (const x of [lab("OECD", "מאגר המשפחה של OECD: עוני ילדים"), lab("משרד הבריאות", "א: ב: ג")]) assert.ok(!x.includes(":"), "no colon: the 'מקור היעד:' before it has the one: " + x);
  assert.equal(G.respell("התכנית הלאומית, בתכנית"), "התוכנית הלאומית, בתכנית", "only the programme's name, as the catalogue writes it");
});
test("sourceLabel on the real catalogue: every link text is said once, with no colon of its own and no repeated half", { skip }, () => {
  for (const i of catalogue.indicators) for (const ref of [i.guideline, i.benchmark]) {
    if (!ref) continue;
    const label = G.sourceLabel(ref.source), parts = label.split(/ · |, /);
    assert.ok(label && !label.includes(":") && !/התכנית/.test(label), `${i.id}: ${label}`);
    assert.equal(new Set(parts).size, parts.length, `${i.id}: a half is said twice: ${label}`);
    assert.ok(!/\([^()]*[A-Za-z][^()]*\)/.test(label) && !/טבלה [A-Z]/.test(label), `${i.id}: a code stays in the document, not in the label: ${label}`);
  }
});

// ── the real figures ──
const KEYS = ["1031", "16", "7", "935", "99", "472", "2710", "9000", "3000"];
test("the real figures: the target the screens say is the target the status used; far is never good, strength never short of its target, a met target is at least תקין unless the trend is down", { skip }, () => {
  let seen = 0;
  for (const key of KEYS) {
    const m = cityModel(key);
    if (!m) continue;
    for (const a of m.indicators) {
      const kind = G.kindOf(a), st = G.stateOf(a);
      if (kind !== "target") { assert.equal(G.rowTarget(a), null, `${key} ${a.id}: a reference that does not judge draws no tick and no state`); continue; }
      seen++;
      assert.equal(a.guide.value, a.last.target, `${key} ${a.id}: one target`);
      if (a.last.reliable === false) { assert.equal(st, null); assert.equal(a.guide.meets, null, `${key} ${a.id}: a group too small is never compared`); continue; }
      assert.equal(a.guide.meets, a.last.meetsTarget, `${key} ${a.id}`);
      if (st === "far" || st === "below") assert.ok(["concern", "watch"].includes(a.status), `${key} ${a.id}: more than 5 points short of the target is never תקין (${a.status})`);
      if (st === "far") assert.ok(a.status === "concern" || a.statusWhy.includes("target"), `${key} ${a.id}: more than 10 points short needs treatment`);
      if (a.status === "strength") assert.equal(st, "meets", `${key} ${a.id}: a strength meets its target`);
      if (st === "meets" && !["good", "strength"].includes(a.status)) assert.ok(["concern", "watch"].includes(a.status) && a.statusWhy.includes("worsening"), `${key} ${a.id}: met and still ${a.status} only because of the trend`);
      const p = G.panelOf(a);
      assert.ok(plainLines(p)[0].startsWith("היעד: ") && plainLines(p)[1].length > 5, `${key} ${a.id}`);
    }
  }
  assert.ok(seen >= 30, "the check looked at real figures: " + seen);
});

test("the fixture towns whose statuses changed with the official targets read the same on every screen (472 and 9000)", { skip }, () => {
  for (const [key, ids] of [["472", ["th_pertussis", "th_safesleep", "th_iron"]], ["9000", ["th_safesleep", "th_iron", "th_ppd"]]]) {
    const m = cityModel(key), by = new Map(m.indicators.map((a) => [a.id, a]));
    for (const id of ids) {
      const a = by.get(id); assert.equal(a.status, "good", `${key} ${id}`);
      assert.equal(G.stateOf(a), "meets", `${key} ${id}: it is תקין because it meets the target`);
      assert.ok(C(G.reasonOf(a)).includes(a.last.level >= 50 ? "עומד ביעד הרשמי" : "תקין כי הוא עומד ביעד הרשמי"), `${key} ${id}: the sentence under the title says why it is תקין when the place among towns is low`);
    }
    // the verdict, the by-category rows and the lists use the same figures: the counts add up
    const verdict = M.verdictOf(m), cats = m.domains.filter((d) => !d.background).reduce((t, d) => t + (d.counts.concern || 0), 0);
    assert.equal(verdict.counts.concern, cats, `${key}: the concern count of the verdict is the sum of the categories`);
    const att = M.attentionOf(m, Infinity); assert.equal(att.rows.filter((r) => by.get(r.id).status === "concern").length, verdict.counts.concern, `${key}: the attention list holds every figure that needs treatment`);
  }
});

// ── the rows ──
test("rows: a figure with a judging target carries tgt; the line replaces the older 'יעד משרד הבריאות' line, never says it twice", () => {
  const ahead = fig({ last: { ...fig().last, v: 83, nat: 80, level: 30, target: 95 }, guide: guide({ value: 95, text: "לפחות 95%", gap: -12, meets: false }) });          // ahead of the country, 12 points short of the target
  const a = M.attentionOf({ city: { key: "1", name: "עיר" }, indicators: [ahead] });
  assert.equal(a.rows[0].tgt.state, "far"); assert.equal(a.rows[0].reason, undefined, "the target is said once, in the line under the bars");
  const behind = fig({ status: "good", statusWhy: [], last: { ...fig().last, v: 82, nat: 85, level: 30, meetsTarget: true }, guide: guide({ meets: true, gap: 2 }) });
  const g = M.goodOf({ city: { key: "1", name: "עיר" }, indicators: [behind] });
  assert.equal(g.rows.length, 1, "met target, not ahead of the country: it stands on the target"); assert.equal(g.rows[0].tgt.state, "meets"); assert.equal(g.rows[0].reason, undefined);
  const near = fig({ status: "good", statusWhy: [], last: { ...fig().last, v: 77, nat: 60, level: 70 }, guide: guide({ gap: -3, meets: false }) });          // ahead of the country, 3 points short of the target: the status says תקין and the line says near
  assert.equal(M.goodOf({ city: { key: "1", name: "עיר" }, indicators: [near] }).rows[0].tgt.state, "near");
  const legacy = fig({ guide: null, last: { ...fig().last, v: 90, nat: 80, level: 30 } });          // no official guide on the figure: no target line, the status line still says why
  assert.equal(M.attentionOf({ city: { key: "1", name: "עיר" }, indicators: [legacy] }).rows[0].tgt, null);
  assert.ok(M.attentionOf({ city: { key: "1", name: "עיר" }, indicators: [legacy] }).rows[0].cause);
});

test("the town page: the line and the tick are in the row of a figure with a judging target, and only there", { skip }, async () => dom(async () => {
  const backend = (() => { const mm = new Map(); return { getItem: (k) => (mm.has(k) ? mm.get(k) : null), setItem: (k, v) => mm.set(k, String(v)), removeItem: (k) => mm.delete(k) }; })();
  const storage = await load("storage.js"); storage.use(backend);
  const realFetch = globalThis.fetch; globalThis.fetch = fakeFetch({ "/api/meta": { domains: [], sources: {}, indicators: [] }, "/api/health": { ok: true } });
  try {
    const home = await load("city/home.js"), m = cityModel("1031");
    const v = await home.cityHome({ key: "1031", model: m, params: new URLSearchParams("v=full"), go() {}, announce() {}, setTitle() {}, signal: undefined }, {});
    const items = v.node.findAll((e) => e.classes.has("n-home-item")), withLine = items.filter((it) => it.find((e) => e.classes.has("n-home-tgt")));
    assert.ok(withLine.length >= 8, "the rows with an official target: " + withLine.length);
    for (const it of items) {
      const line = it.find((e) => e.classes.has("n-home-tgt")), tick = it.find((e) => e.classes.has("n-home-tick"));
      if (!line) { assert.equal(tick, null, "no tick without the words"); continue; }
      assert.match(C(line.textContent), /^יעד רשמי: לפחות \d+% · (עומד ביעד|קרוב ליעד|מתחת ליעד|רחוק מהיעד)\./);
      assert.ok(tick, "the tick on the town's bar"); assert.ok(it.find((e) => e.classes.has("n-home-track")).findAll((e) => e === tick).length, "inside the town's track");
      assert.equal(it.findAll((e) => e.classes.has("n-home-reason")).length, 0, "the target is said once, in its line: a row has no second reason line");
    }
    const good = v.node.find((e) => e.id === "n-sec-good"), weak = v.node.find((e) => e.id === "n-sec-weak");
    for (const it of good.findAll((e) => e.classes.has("n-home-item"))) assert.equal(!!it.find((e) => e.classes.has("n-home-tgt-w") && /רחוק/.test(e.textContent)), false, "a figure far from its target is not under what goes well");
    assert.ok(weak.findAll((e) => e.classes.has("n-home-tgt")).length >= 5);
  } finally { storage.use(undefined); globalThis.fetch = realFetch; }
}));

test("the category page: every row with a judging target says where it stands once, and again after a redraw; a figure that needs treatment says why in the words of the town page", { skip }, async () => dom(async () => {
  const m = cityModel("9000"), by = new Map(m.indicators.map((a) => [a.id, a]));
  const label = { concern: "דורש טיפול", watch: "למעקב", good: "תקין", strength: "חוזק" };
  // the old page's own row: the status with its sentence (the old sentence says the target in its own words; the product replaces or trims it)
  const rowFor = (id) => { const a = by.get(id), need = a && ["concern", "watch"].includes(a.status);
    const old = need ? " כי הערך טוב יותר מ-17% בלבד מהיישובים וחסרות 10.8 נק׳ ליעד משרד הבריאות." : a && label[a.status] ? ` הערך טוב יותר מ-60% מהיישובים${a.last.meetsTarget === true ? ", עומד ביעד משרד הבריאות" : ""}, ואין הידרדרות.` : "";
    return h("a.row-item.dm-row", { href: `#/c/9000/i/${id}` }, h("div.dm-rmain", h("h3.dm-name", id), h("p.dm-why", h("span.pill", (a && label[a.status]) || "מדד רקע"), old)), h("div.dm-val")); };
  const ids = m.indicators.filter((a) => G.rowTarget(a) || ["concern", "watch"].includes(a.status)).map((a) => a.id);
  assert.ok(ids.length >= 5);
  const host = h("div.dm-figs", h("div.rowlist", [...ids.map(rowFor), rowFor("pop_size")]));
  domain.targetLines(host, m); domain.targetLines(host, m);
  let rows = 0, met = 0;
  for (const row of host.findAll((e) => e.classes.has("dm-row"))) {
    const id = /\/i\/(.+)$/.exec(row.getAttribute("href"))[1], a = by.get(id), lines = row.findAll((e) => e.classes.has("n-pg-domain-tgt")), t = G.rowTarget(a), say = C(row.find((e) => e.classes.has("dm-why")).textContent);
    rows++;
    if (!t) assert.equal(lines.length, 0, id);
    else { assert.equal(lines.length, 1, id + ": once"); assert.equal(C(lines[0].textContent), D.tgtPlain(t)); assert.ok(!/משרד הבריאות/.test(say), id + ": the old sentence's own target words are gone"); }
    if (["concern", "watch"].includes(a.status)) assert.equal(say, `${label[a.status]} ${C(S.plainOf(D.causeOf(a)))}`, id + ": the cause, in the words of the town page");
    if (t && t.state === "meets") { met++; assert.equal((C(row.textContent).match(/עומד ביעד/g) || []).length, 1, id + ": a met target is said once on the row"); }
  }
  assert.ok(rows >= 6 && met >= 1, `the check looked at real rows: ${rows}, met ${met}`);
}));

// ── the figure's page ──
test("guidePanel: label, the lines (the strong one marked), the caveat, the link to the document that opens in a new tab", { skip }, async () => dom(async () => {
  const m = cityModel("1031"), by = new Map(m.indicators.map((a) => [a.id, a]));
  const node = indicator.guidePanel(by.get("th_mmrv"));
  assert.equal(node.getAttribute("aria-labelledby"), "n-pg-indicator-guide-h"); assert.equal(node.find((e) => e.tagName === "H2").textContent, "היעד הרשמי");
  assert.equal(node.findAll((e) => e.classes.has("n-pg-indicator-guide-l")).length, 3); assert.equal(node.findAll((e) => e.classes.has("is-state")).length, 1);
  assert.match(C(node.find((e) => e.classes.has("is-state")).textContent), /^חסרות 28\.1 נקודות אחוז להגיע ליעד\.$/);
  assert.ok(node.find((e) => e.classes.has("n-pg-indicator-guide-note")).textContent.includes("ולא יעד שנקבע ליישוב מסוים"), "the caveat is shown");
  const a = node.find((e) => e.tagName === "A"); assert.equal(a.getAttribute("target"), "_blank"); assert.match(a.getAttribute("rel"), /noopener/); assert.ok(a.getAttribute("href").startsWith("https://www.gov.il/"));
  assert.equal(indicator.guidePanel(by.get("mortality_std")).find((e) => e.tagName === "A"), null, "no document, no link");
  assert.equal(indicator.guidePanel(by.get("road_severe_100k")).find((e) => e.tagName === "H2").textContent, "יעד להתמצאות");
  const roadText = C(indicator.guidePanel(by.get("road_severe_100k")).textContent), first = roadText.split(".")[0];
  assert.equal(roadText.split(first).length - 1, 1, "the first sentence of the road panel is said once, not again in grey");
  const link = (id) => C(indicator.guidePanel(by.get(id)).find((e) => e.tagName === "A").textContent);
  assert.match(link("pov_children"), /^מקור נקודת הייחוס: מאגר המשפחה של OECD · עוני ילדים/, "label once, one colon");
  assert.ok((link("bmi_g1_over").match(/:/g) || []).length === 1 && !/COSI.*COSI/.test(link("bmi_g1_over")), link("bmi_g1_over"));
  assert.ok((link("th_mmrv").match(/:/g) || []).length === 1, link("th_mmrv"));
  assert.equal(indicator.guidePanel(by.get("bmi_g7_over")).find((e) => e.tagName === "H2").textContent, "נקודת ייחוס");
}));

// ── the sentence under the title ──
test("reasonOf: a met target is named in the sentence under the title (also when the trend decides the status), the gap is spelled in points, the old sentence stays for a figure with no judging target", () => {
  const met = fig({ status: "concern", statusWhy: ["worsening"], history: { trendClass: "worsening" }, last: { ...fig().last, v: 80.6, nat: 75, gapNat: 5.6, level: 32, rank: 124, of: 184, meetsTarget: true, gapTarget: 5.6 }, guide: guide({ meets: true, gap: 5.6, value: 75, text: "לפחות 75%" }) });
  assert.equal(C(G.reasonOf(met)), "דורש טיפול כי המגמה בהידרדרות, אף שהוא עומד ביעד הרשמי וטוב מהממוצע הארצי ב-5.6 נקודות אחוז.", "the owner's case (8300, iron): met, and 'דורש טיפול' because of the trend: both said");
  assert.equal(C(G.reasonOf({ ...met, status: "watch" })), "למעקב כי המגמה בהידרדרות, אף שהוא עומד ביעד הרשמי וטוב מהממוצע הארצי ב-5.6 נקודות אחוז.");
  assert.equal(C(G.reasonOf(fig())), "דורש טיפול כי הערך טוב יותר מ-10% בלבד מהיישובים וחסרות 28.1 נקודות אחוז ליעד הרשמי.", "not met: the gap, in the word of the target");
  const held = fig({ status: "good", statusWhy: [], last: { ...fig().last, v: 82, nat: 85, level: 30, meetsTarget: true }, guide: guide({ meets: true, gap: 2 }) });
  assert.equal(C(G.reasonOf(held)), "תקין כי הוא עומד ביעד הרשמי, אף שהערך טוב יותר מ-30% בלבד מהיישובים, ואין הידרדרות.", "תקין only because of the target: said so");
  assert.equal(C(G.reasonOf({ ...held, last: { ...held.last, level: 62 } })), "תקין: הערך טוב יותר מ-62% מהיישובים, עומד ביעד הרשמי, ואין הידרדרות.");
  assert.equal(G.reasonOf({ ...held, guide: null }), null, "no judging target: ui.js says it as before"); assert.equal(G.reasonOf({ ...held, last: { ...held.last, reliable: false } }), null, "a small group: nothing is said against a target");
  assert.equal(G.reasonOf({ ...held, status: "stale" }), null);
  assert.equal(C(G.reasonOf(fig({ unit: "days", direction: "lower", guide: guide({ unit: "days", direction: "atMost", gap: -4, relGap: -0.3, text: "עד 14 ימים", value: 14 }), last: { ...fig().last, v: 18, gapTarget: -4, nat: 20, level: 20 }, statusWhy: ["target"] }))), "דורש טיפול כי חסרים 4 ימים ליעד הרשמי.", "another unit: with its unit (ui.js said 'חסרות 4')");
});
test("reasonOf on the real figures: the same sentence as ui.js statusReason except for the word of the target, the points spelled and a met target said", { skip }, () => {
  let seen = 0, met = 0;
  for (const key of KEYS) {
    const m = cityModel(key);
    if (!m) continue;
    for (const a of m.indicators) {
      const r = G.reasonOf(a);
      if (G.kindOf(a) !== "target") { assert.equal(r, null, `${key} ${a.id}`); continue; }
      if (r == null) continue;
      seen++;
      const old = statusReason(a), norm = (t) => C(t).replace(/ליעד משרד הבריאות/g, "ליעד הרשמי").replace(/\s*נק׳/g, " נקודות אחוז"), now = C(r);
      assert.ok(!/משרד הבריאות|נק׳/.test(now), `${key} ${a.id}: ${now}`);
      if (G.stateOf(a) === "meets") { met++; assert.match(now, /ביעד הרשמי/, `${key} ${a.id}: a met target is named: ${now}`); }
      else assert.ok(!/עומד ביעד/.test(now), `${key} ${a.id}: only a met target says so: ${now}`);
      if (G.stateOf(a) !== "meets") assert.equal(now, norm(old), `${key} ${a.id}`);
      else assert.equal(now.split(" ")[0].replace(/:$/, ""), norm(old).split(" ")[0].replace(/:$/, ""), `${key} ${a.id}: the same status word`);
    }
  }
  assert.ok(seen >= 20 && met >= 3, `looked at ${seen} figures with a judging target, ${met} of them met`);
});

test("the figure page: the first 'נק׳' is spelled out, the later ones stay short; a mended spelling in the data set's name", async () => dom(async () => {
  const mk = (...kids) => h("div", ...kids.map((k) => (typeof k === "string" ? h("p", k) : k)));
  const hero = mk("דורש טיפול כי חסרות 5 נקודות אחוז ליעד.", "חלש מהממוצע הארצי ב-6.4 נק׳", "נק׳ = נקודות אחוז: ההפרש.");
  indicator.spellFirstPoint(hero);
  assert.deepEqual(hero.findAll((e) => e.tagName === "P").map((e) => C(e.textContent)), ["דורש טיפול כי חסרות 5 נקודות אחוז ליעד.", "חלש מהממוצע הארצי ב-6.4 נק׳", "נק׳ = נקודות אחוז: ההפרש."].map(C), "the sentence above already spelled it: nothing to do");
  const bare = mk("חלש מהממוצע הארצי ב-6.4 נק׳", h("p", "מגמה −13.2 נק׳"), "נק׳ = נקודות אחוז: ההפרש.");
  indicator.spellFirstPoint(bare);
  assert.deepEqual(bare.findAll((e) => e.tagName === "P").map((e) => C(e.textContent)), ["חלש מהממוצע הארצי ב-6.4 נקודות אחוז", "מגמה −13.2 נק׳", "נק׳ = נקודות אחוז: ההפרש."].map(C), "the first one, and only it");
  const src = h("div.srcline", "מקור: ", h("a", "משרד הבריאות · התכנית הלאומית למדדי איכות: טיפות חלב"));
  G.respellTree(src); assert.equal(C(src.textContent), C("מקור: משרד הבריאות · התוכנית הלאומית למדדי איכות: טיפות חלב"));
  assert.equal(G.respellTree(null), null);
}));

test("the words of the references in the files of the figure page, the cards and the glossary: one name for each, none of the retired ones", () => {
  const files = ["kit/guide.js", "kit/tips.js", "kit/glossary.js", "pages/indicator.js", "pages/coverage.js", "pages/glossary.js"];
  const RETIRED = [[/יעד לידיעה/, "יעד לידיעה"], [/יעד בינלאומי|יעד בין-לאומי/, "יעד בינלאומי"], [/יעד של משרד הבריאות/, "יעד של משרד הבריאות (in short labels: יעד רשמי)"], [/בינלאומי|בינלאומית|בין־לאומ/, "one spelling: בין-לאומי"], [/התכנית/, "התוכנית"]];
  for (const f of files) {
    const code = read("web/js/product/" + f).split(/\r?\n/).filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\s\/\/ .*$/, "")).join("\n").replace("/התכנית/g", "");          // the one place that names the old spelling is the function that mends it
    for (const [re, why] of RETIRED) assert.ok(!re.test(code), `${f}: ${why}`);
  }
});

// ── the cards ──
test("tips: a card says the official target with who published it and where the figure stands; an earlier year says the target of that year; a reference that does not judge is a note", () => {
  const a = fig({ series: [{ year: 2022, v: 50, nat: 63, target: 75 }, { year: 2023, v: 80, nat: 64, target: 80 }, { year: 2024, v: 51.9, nat: 65.8, target: 80 }] });
  const N = (x) => (x == null ? x : JSON.parse(JSON.stringify(x).replace(/ /g, " ")));
  const base = (f, extra = {}) => ({ a: f, year: null, model: { city: { name: "שדרות" } }, meta: null, self: true, ...extra });
  assert.deepEqual(N(T.EXTRA.target(base(a))), { id: "target", label: "יעד רשמי (משרד הבריאות)", value: "לפחות 80%", sub: "רחוק מהיעד" });
  assert.deepEqual(N(T.EXTRA.target(base(a, { year: 2022 }))), { id: "target", label: "יעד ב-2022 (משרד הבריאות)", value: "75%", sub: "לא עומד ביעד" });
  assert.deepEqual(N(T.EXTRA.target(base(a, { year: 2023 }))), { id: "target", label: "יעד ב-2023 (משרד הבריאות)", value: "80%", sub: "עומד ביעד" });
  assert.equal(N(T.EXTRA.target(base(fig({ last: { ...a.last, reliable: false } })))).label !== "יעד רשמי (משרד הבריאות)", true, "a small group is not set against a target");
  const orient = fig({ series: [], guide: guide({ judges: false, text: "עד 25 ל-1,000", meets: true }) });
  assert.deepEqual(N(T.EXTRA.target(base(orient))), { id: "target", label: "יעד להתמצאות", note: "עד 25 ל-1,000 (משרד הבריאות)" });
  assert.ok(T.PLAN.strip.includes("target") && T.PLAN.link.includes("target") && T.PLAN.heat.includes("target") && T.PLAN.spark.includes("target"));
  const rows = T.extrasFor("strip", base(a), "", 3).map((r) => r.id);
  assert.ok(rows.includes("target"), "the card of the strip says the target: " + rows.join());
});

// ── the entry page, the guard, the catalogue ──
test("entry: the count and the list of sources are the data sources, not the documents of the official targets, and the sentence stays true", { skip }, () => {
  const all = Object.keys(catalogue.sources).length, docs = Object.values(catalogue.sources).filter((s) => s.role === "guideline").length;
  assert.ok(docs >= 6 && all - docs >= 11, `18 documents, 7 of them guidelines: ${all} and ${docs}`);
  const n = text.trustNumbers(null, catalogue).find((x) => x.id === "sources").n;
  assert.equal(n, all - docs); assert.equal(n, text.dataSources(catalogue).length);
  const listed = text.sourcesOf(catalogue).reduce((t, g) => t + g.items.length, 0);
  assert.equal(listed, n, "the list holds as many as the number says");
  const names = text.sourcesOf(catalogue).flatMap((g) => g.items.map((s) => s.name)), docNames = Object.values(catalogue.sources).filter((s) => s.role === "guideline").map((s) => s.name);
  for (const d of docNames) assert.ok(!names.includes(d), "a guideline document is not a data source: " + d);
  assert.equal(text.trustNumbers({ sources: 12 }, catalogue).find((x) => x.id === "sources").n, 12, "the server's own number still wins");
  assert.equal(text.trustNumbers(null, { sources: { a: { role: "guideline" } }, indicators: [] }).find((x) => x.id === "sources"), undefined, "no data source, no number");
});

test("the guard gives the old modules the data sources only; the product's own read of the catalogue keeps the guidelines", { skip }, async () => {
  const only = groups.dataOnlyMeta(catalogue);
  assert.ok(!Object.values(only.sources).some((s) => s.role === "guideline")); assert.equal(Object.keys(only.sources).length, text.dataSources(catalogue).length);
  assert.deepEqual(only.indicators, catalogue.indicators, "the indicators, with their guideline and benchmark, are untouched");
  assert.equal(groups.dataOnlyMeta(only), only, "idempotent"); for (const x of [null, "x", [], {}, { sources: {} }, { sources: { a: { role: "data" } } }]) assert.equal(groups.dataOnlyMeta(x), x);
  const f = async () => new Response(JSON.stringify(catalogue), { status: 200, headers: { "Content-Type": "application/json" } });
  const seen = await (await net.guardFetch(f, { timeoutMs: 500 })("/api/meta")).json();
  assert.equal(Object.keys(seen.sources).length, text.dataSources(catalogue).length, "what the old method page counts");
  assert.ok(seen.indicators.every((i) => i.domain), "still in the categories");
  assert.ok(Object.keys(catalogue.sources).some((k) => catalogue.sources[k].role === "guideline"), "the server's own answer is not changed");
});

test("catalogueOf: 13 figures judged, 2 orientation, 3 benchmarks, 26 with none; the documents behind them", { skip }, () => {
  const c = G.catalogueOf(catalogue);
  assert.equal(c.target.length, 13); assert.deepEqual(c.orient.map((i) => i.id).sort(), ["infant_mortality", "road_severe_100k"]); assert.deepEqual(c.bench.map((i) => i.id).sort(), ["bmi_g1_over", "bmi_g7_over", "pov_children"]);
  assert.equal(c.none.length, 41 - 13 - 2); assert.deepEqual(c.none.map((i) => i.id).sort(), Object.keys(G.NO_TARGET).sort());
  assert.ok(c.docs.every((d) => d.url && d.name && d.short), "every document has a name and a link");
  assert.ok(c.docs.some((d) => d.judges && d.short === "משרד הבריאות"));
  assert.deepEqual(G.catalogueOf(null).target, []);
});

// ── the method and coverage pages ──
function oldMethod() {
  const sec = (id, n) => h("section.sec.mt-sec", { id }, h("div.sec-head", h("div", h("div.sec-eyebrow", h("b", n), "x"), h("h2.sec-title", "כותרת " + id))));
  return h("div", h("section.hero.mt-hero"), h("div.mt-layout", h("nav.mt-toc"), h("div.mt-content", sec("mt-sources", "01"), sec("mt-measures", "02"), sec("mt-framework", "03"), sec("mt-rules", "04"), sec("mt-recs", "05"), sec("mt-reading", "06"), sec("mt-limits", "07"))));
}
test("method: the section of the official targets follows the decision rules, the numbers of the sections follow it, the contents list knows it", { skip }, async () => dom(async () => {
  const section = method.guidesSection(catalogue, "05"), t = C(section.textContent);
  assert.match(t, /יעד שקובע את המצב: 13 מדדים/); assert.match(t, /מוצגים להתמצאות בלבד/); assert.match(t, /אין יעד רשמי: 26 מדדים/);
  assert.ok(t.includes(`חסרות לו יותר מ-${catalogue.rules.farBelowTarget} נקודות אחוז ליעד נשאר דורש טיפול`) && t.includes(`יותר מ-${catalogue.rules.nearTarget} נקודות אחוז ליעד`), "the numbers of the rule are the server's rules");          // the rule says "חסרות לו יותר מ-10 נקודות אחוז ליעד" (it said "בלמעלה מ-10": not a phrase a reader says)
  assert.match(t, /נחשב תקין לפחות/); assert.match(t, /נשאר דורש טיפול גם אם הוא טוב מהממוצע הארצי/);
  const links = section.findAll((e) => e.tagName === "A" && /^https:/.test(e.getAttribute("href") || ""));
  assert.ok(links.length >= 6 && links.every((a) => a.getAttribute("target") === "_blank" && /noopener/.test(a.getAttribute("rel"))), "the documents are linked and open in a new tab");
  const root = oldMethod(); method.adapt(root, { model: { city: { key: "1031", name: "שדרות" } }, meta: catalogue });
  const ids = root.findAll((e) => e.classes.has("mt-sec")).map((e) => e.id);
  assert.deepEqual(ids, ["mt-sources", "mt-measures", "mt-framework", "mt-rules", "mt-guides", "mt-recs", "mt-reading", "mt-limits", "mt-more"]);
  assert.deepEqual(root.findAll((e) => e.classes.has("mt-sec")).map((e) => e.find((x) => x.tagName === "B").textContent), ["01", "02", "03", "04", "05", "06", "07", "08", "09"], "the numbers follow the order");
  assert.ok(root.findAll((e) => e.classes.has("mt-toc-b")).some((b) => /יעדים רשמיים/.test(b.textContent)));
  const bare = oldMethod(); method.adapt(bare, { model: null });
  assert.equal(bare.find((e) => e.id === "mt-guides"), null, "without the catalogue the page is as it was");
}));

test("coverage: one plain paragraph on the official targets of the town's figures, with the way to the method page", { skip }, async () => dom(async () => {
  const node = coverage.guidesBlock(cityModel("1031")), t = C(node.textContent);
  assert.match(t, /^יעדים רשמיים\s*מתוך 35 המדדים שיש עליהם נתונים בשדרות, ל-13 מדדים יש יעד רשמי שקובע את המצב, למדד אחד יש יעד להתמצאות, שאינו משנה את המצב, ולאחרים אין יעד רשמי \(ל-3 מהם יש נקודת ייחוס בין-לאומית\)\./);
  assert.equal(node.find((e) => e.tagName === "A").getAttribute("href"), "#/c/1031/method#mt-guides");
  assert.equal(coverage.guidesBlock({ city: { key: "935", name: "x" }, indicators: [] }), null);
}));

// ── the glossary ──
test("glossary: 'יעד רשמי' and 'נקודת ייחוס' are explained in one plain sentence each, and the status words say how a met target counts", () => {
  const t = glossary.glossaryTerm("target"), b = glossary.glossaryTerm("benchmark");
  assert.equal(t.term, "יעד רשמי"); assert.equal(b.term, "נקודת ייחוס");
  const o = glossary.glossaryTerm("orient"), ids = glossary.GLOSSARY.map((x) => x.id);
  assert.equal(o.term, "יעד להתמצאות"); assert.deepEqual(ids.slice(ids.indexOf("target"), ids.indexOf("target") + 3), ["target", "orient", "benchmark"], "the three words of the references side by side");
  for (const k of ["short", "long"]) assert.ok(o[k].split(/\.\s+/).filter(Boolean).length <= 2, `orient ${k}: at most two sentences`);
  assert.match(o.short, /אינו משנה את מצב המדד/); assert.ok(!/בינלאומי|בינלאומית/.test(glossary.GLOSSARY.map((x) => x.short + x.long).join(" ")), "one spelling: בין-לאומי");
  assert.match(glossary.glossaryTerm("concern").short, /אלא אם הוא עומד ביעד הרשמי ואינו בהידרדרות/, "the short text says what the long one says");
  assert.ok(t.short.split(". ").length <= 2 && b.short.split(". ").length <= 2 && t.short.length <= 200 && b.short.length <= 200);
  assert.match(b.short, /לא יעד/); assert.match(t.short, /נחשב תקין לפחות/);
  assert.match(glossary.glossaryTerm("good").long, /עומד ביעד הרשמי, גם אם מקומו בין היישובים נמוך/);
  assert.match(glossary.glossaryTerm("concern").long, /אלא אם הוא עומד ביעד הרשמי/);
  assert.match(glossary.glossaryTerm("strength").long, /עומד ביעד הרשמי כשיש יעד/);
});

// ── the styles ──
test("the new rules are in their own files with their own prefix, tokens only, no stripe, no capsule", () => {
  const css = (f) => read("web/css/product/" + f).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [file, cls] of [["home.css", "n-home-tgt"], ["home.css", "n-home-tick"], ["pages/indicator.css", "n-pg-indicator-guide"], ["pages/domain.css", "n-pg-domain-tgt"], ["pages/method.css", "n-pg-method-glist"], ["pages/coverage.css", "n-pg-coverage-guides"]]) assert.ok(css(file).includes("." + cls), `${file} has ${cls}`);
  const added = css("pages/indicator.css").slice(css("pages/indicator.css").indexOf(".n-pg-indicator-guide {"));
  assert.ok(!/border-inline-(start|end)\s*:/.test(added) && !/border-radius\s*:\s*(9{2}|[2-9]\d)/.test(added) && !/#[0-9a-fA-F]{3,8}\b/.test(added), "no side stripe, no pill, no hex in the panel");
  assert.ok(/\.n-home-tick \{[^}]*var\(--c-target\)/.test(css("home.css")), "the tick is the colour of targets, no new colour");
  const print = css("home.css").slice(css("home.css").lastIndexOf("@media print"));
  assert.ok(/\.n-home-tgt-aside \{ display: none; \}/.test(print) && /\.n-home-tgt \{[^}]*font-size: 8\.5pt/.test(print), "the short level stays on one A4 sheet (town 472 went to two with the lines): the second sentence is left out and the line is small in print");
});
