// The rules of SPEC 7.2 (C-01 to C-27) for the five answers of the city home, on the fixtures of SPEC 9.1: 1031, 16, 7, 935, 99, 472, 2710.
// The logic lives in web/js/product/city/{data,sentence,copy}.js, which have no DOM (the share pages of the server import them too).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { haveStore, all } from "./helpers/city-models.mjs";

const CITY = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "js", "product", "city");
const load = (f) => import(pathToFileURL(path.join(CITY, f)).href);
const D = await load("data.js"), S = await load("sentence.js"), C = await load("copy.js");
const M = haveStore ? all() : {};
const Q = C.QIDS;
const skip = !haveStore && "the built store is not there";
const text = (m, q) => { const a = S.answer(m, q); return a.plain + " " + a.ledePlain; };
// a copy of a model with chosen statuses and trends, to reach the plural forms (C-13) that the real towns do not
const variant = (m, f) => { const c = JSON.parse(JSON.stringify(m)); f(c); return c; };

test("the logic files import nothing that touches a document (the server loads them)", () => {
  for (const f of ["data.js", "sentence.js", "copy.js"]) {
    const src = fs.readFileSync(path.join(CITY, f), "utf8");
    const imports = [...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]);
    for (const i of imports) assert.ok(/^\.\/(copy|data|sentence)\.js$|kit\/(plural|provenance)\.js$|^\.\.\/simple\/(model|words)\.js$|^\.\.\/\.\.\/ui\.js$/.test(i), `${f} imports ${i}`);
    assert.ok(!/\b(document|window|location|localStorage)\b/.test(src.replace(/\/\/.*$/gm, "")), `${f} mentions a browser global`);
  }
});

test("C-01: the weakest domain is named only when at least 2 of its figures are judged and 2 need treatment", { skip }, () => {
  for (const [k, m] of Object.entries(M)) {
    const wd = D.weakestDomain(m);
    if (wd) { assert.ok(wd.m >= 2 && wd.k >= 2, `${k}: ${wd.label} ${wd.k}/${wd.m}`); assert.ok(S.answer(m, "weak").plain.includes(wd.short), k); }
    else assert.ok(!/התחום עם הכי הרבה/.test(S.answer(m, "weak").plain), k);
  }
  // the nine domains of the server became four categories: Sderot is weakest in children and parents, 9 of its 13 judged figures need treatment (the old 4 of 4 was the domain of child health alone)
  const wd = D.weakestDomain(M["1031"]);
  assert.deepEqual([wd.id, wd.short, wd.k, wd.m], ["child", "ילדים", 9, 13]);
  assert.ok(S.answer(M["1031"], "weak").plain.includes("ילדים (9 מתוך 13)"));
  for (const k of ["16", "7", "935"]) assert.equal(D.weakestDomain(M[k]), null);
});

test("C-02: no recommendation says why with the judged count; Shachar never reads as a clean bill of health", { skip }, () => {
  for (const k of ["7", "16"]) {
    const a = S.answer(M[k], "first");
    assert.equal(a.kind, "calm");
    assert.match(a.ledePlain, /אף מדד שאפשר לשפוט/);
    assert.doesNotMatch(a.ledePlain, /סף ההמלצה/);
  }
  assert.equal(D.emptyPlanCause({ ...M["1031"], recommendations: [] }).kind, "bar");
  assert.equal(D.emptyPlanCause(M["935"]).kind, "none");
});

test("C-03: the changes chart holds exactly the figures the sentence counts, none with fewer than 3 years, none stale", { skip }, () => {
  for (const [k, m] of Object.entries(M)) {
    for (const { a } of D.movers(m, 100)) { assert.ok(["improving", "worsening"].includes(a.history.trendClass), k + a.id); assert.ok(D.years(a) >= 3, k + a.id); assert.ok(!D.isStale(a), k + a.id); }
    const counted = m.indicators.filter((a) => !D.isStale(a) && ["improving", "worsening"].includes(a.history && a.history.trendClass));
    const shown = D.movers(m, 100).length, tc = D.trendCounts(m);
    assert.equal(tc.improving + tc.worsening, counted.length, k);
    assert.ok(shown <= counted.length, k);
  }
  const n = D.movers(M["1031"], 100).length;
  assert.ok(n >= 8, "Sderot has 11 counted figures, the chart shows the top 8 of them");
});

test("C-04, C-05, C-19: ranks are in the rank form; never 'better than 0%' or '1%'", { skip }, () => {
  for (const [k, m] of Object.entries(M)) {
    for (const q of Q) assert.doesNotMatch(text(m, q), /טוב מ-\s*[01]%/, k + q);
    for (const a of D.weakestFive(m)) { const r = D.rowReason(a); assert.doesNotMatch(r.rest, /%\s*בלבד|טוב מ-/, k + a.id); assert.match(r.rest, /^מקום \d+ מתוך \d+ יישובים/, k + a.id); }
  }
  assert.equal(D.rankText({ rank: 183, of: 183 }), "מקום 183 מתוך 183 יישובים");
  assert.ok(D.lastPlace({ rank: 183, of: 183 }) && !D.lastPlace({ rank: 5, of: 183 }));
  assert.match(D.rowReason({ status: "concern", statusWhy: ["rank"], unit: "%", last: { rank: 183, of: 183 } }).rest, /האחרון בארץ/);
});

test("small groups are never ranked, judged or trended (rule 7)", { skip }, () => {
  for (const [k, m] of Object.entries(M)) {
    const small = new Set(m.indicators.filter(D.isSmall).map((a) => a.id));
    for (const a of D.weakestFive(m)) assert.ok(!small.has(a.id), k);
    for (const { a } of D.movers(m, 100)) assert.ok(!small.has(a.id), k);
    for (const r of D.peerVerdicts(m).rows) assert.ok(!small.has(r.a.id), k);
  }
  for (const k of ["16", "7"]) for (const q of Q) assert.doesNotMatch(text(M[k], q), /מקום \d|טוב מ-|חלש יותר מ|דורשים טיפול/, k + q);
});

test("C-07, C-08: the peers sentence splits by the size of the gap and names what 'similar' means", { skip }, () => {
  for (const k of ["1031", "99", "472", "2710"]) {
    const pv = D.peerVerdicts(M[k]);
    assert.equal(pv.better + pv.worse + pv.alike, pv.total, k);
    assert.ok(pv.bigWorse <= pv.worse && pv.bigBetter <= pv.better);
    assert.match(S.answer(M[k], "peers").plain, /המצב ב.+ (חלש|טוב) יותר מיישובים דומים/);
    assert.match(S.answer(M[k], "peers").ledePlain + C.HOWTO.peers, /בשיעור האוכלוסייה הערבית/);
  }
  assert.match(S.answer(M["1031"], "peers").plain, /בפער גדול/);
  for (const k of ["16", "7"]) assert.match(S.answer(M[k], "peers").plain, /הקבוצות קטנות מדי/);
});

test("C-10: an uncovered town gets neutral text, no 'עדיין', the same calm screen for every question", { skip }, () => {
  for (const q of Q) {
    const a = S.answer(M["935"], q);
    assert.equal(a.kind, "nodata");
    assert.match(a.plain, /אין (נתונים רשמיים|המלצה|היסטוריה)|אי אפשר להשוות/);
    assert.doesNotMatch(a.plain + a.ledePlain, /עדיין/);
  }
  assert.match(S.answer(M["935"], "weak").ledePlain, /המקורות הרשמיים אינם מפרסמים נתונים על .+ כיישוב נפרד\./);
  assert.doesNotMatch(S.answer(M["935"], "weak").ledePlain, /מועצה אזורית/, "the parent is not known");
  assert.equal(S.basisLine(M["935"]).text, "אין נתונים רשמיים על היישוב");
  assert.deepEqual(Object.values(D.availability(M["935"])), [null, null, null, null, null]);
});

test("C-09, C-11: the hero basis names how many can be judged in a tiny town; Q1 reconciles 41, 35 and 26", { skip }, () => {
  assert.match(S.basisLine(M["1031"]).text, /^יש נתונים על 35 מתוך 41 מדדים · נתוני .+ · עודכן /);
  assert.ok(!/ורק|אי אפשר לשפוט/.test(S.basisLine(M["1031"]).text));
  for (const k of ["16", "7"]) assert.match(S.basisLine(M[k]).head + S.basisLine(M[k]).tail, /אי אפשר לשפוט אף אחד מהם/);
  assert.match(S.answer(M["1031"], "weak").ledePlain, /^מתוך 35 מדדים שיש עליהם נתון, 26 נשפטו\. 9 מדדים מתארים בלבד ואין בהם טוב או רע\./);
  assert.match(S.answer(M["472"], "weak").ledePlain, /מדד אחד אינו נכלל כי הנתון האחרון ישן/);
  assert.match(S.answer(M["16"], "missing").plain, /נמצאו נתונים על 18 מתוך 41 מדדים, אבל 15 מהם על קבוצות קטנות מדי/);
});

test("C-13: counts agree with their nouns (one, two, many) in every sentence", { skip }, () => {
  const base = M["1031"];
  const one = variant(base, (c) => { let seen = 0; for (const a of c.indicators) if (a.status === "concern" && seen++) a.status = "watch"; });
  assert.match(S.answer(one, "weak").plain, /^מדד אחד מתוך \d+ דורש טיפול\./);
  const none = variant(base, (c) => { for (const a of c.indicators) if (a.status === "concern") a.status = "watch"; });
  assert.match(S.answer(none, "weak").plain, /^אף אחד מ-\d+ המדדים אינו דורש טיפול\./);
  const tr = (u, d) => variant(base, (c) => { let i = 0, w = 0; for (const a of c.indicators) if (a.history) { if (a.history.trendClass === "improving" && i++ >= u) a.history.trendClass = "stable"; if (a.history.trendClass === "worsening" && w++ >= d) a.history.trendClass = "stable"; } });
  assert.match(S.answer(tr(1, 1), "changed").plain, /^מדד אחד בשיפור ואחד בהידרדרות מאז תחילת הנתונים\.$/);
  assert.match(S.answer(tr(1, 2), "changed").plain, /^מדד אחד בשיפור ו-2 בהידרדרות/);
  assert.match(S.answer(tr(0, 1), "changed").plain, /^אף מדד לא בשיפור, ומדד אחד בהידרדרות/);
  assert.match(S.answer(tr(2, 0), "changed").plain, /^2 מדדים בשיפור, ואף מדד לא בהידרדרות/);
  // peers: exactly one worse figure and one better, the rest alike
  const pe = variant(base, (c) => {
    let w = 0, b = 0;
    for (const a of c.indicators) {
      const L = a.last;
      if (!a.direction || !L || L.reliable === false || typeof L.v !== "number" || typeof L.peer !== "number") continue;
      const s = a.direction === "lower" ? -1 : 1;
      if (!w) { L.peer = L.v + s * Math.abs(L.v || 1) * 0.5; w = 1; } else if (!b) { L.peer = L.v - s * Math.abs(L.v || 1) * 0.5; b = 1; } else L.peer = L.v;
    }
  });
  assert.match(S.answer(pe, "peers").plain, /^במדד אחד מתוך \d+ המצב ב.+ חלש יותר מיישובים דומים\. במדד אחד המצב טוב יותר\.$/);
  assert.match(S.answer(pe, "peers").ledePlain, /^ב-\d+ מדדים המצב דומה\./);
  // several of each: the second sentence counts figures with their own noun (never "ב-2 הוא טוב יותר")
  const pe2 = variant(base, (c) => {
    let k = 0;
    for (const a of c.indicators) {
      const L = a.last;
      if (!a.direction || !L || L.reliable === false || typeof L.v !== "number" || typeof L.peer !== "number") continue;
      const s = a.direction === "lower" ? -1 : 1, i = k++;
      L.peer = i < 3 ? L.v + s * Math.abs(L.v || 1) * 0.5 : i < 5 ? L.v - s * Math.abs(L.v || 1) * 0.5 : L.v;
    }
  });
  assert.match(S.answer(pe2, "peers").plain, /^ב-3 מתוך \d+ מדדים המצב ב.+ חלש יותר מיישובים דומים.*\. ב-2 מדדים המצב טוב יותר\.$/);
  const alone = variant(base, (c) => {
    let seen = 0;
    for (const a of c.indicators) { const L = a.last; if (a.direction && L && typeof L.peer === "number" && typeof L.v === "number" && L.reliable !== false) { if (!seen++) L.peer = L.v; else L.peer = L.v * 1.5 + 1; } }
  });
  assert.match(S.answer(alone, "peers").ledePlain, /^במדד אחד המצב דומה\./);
});

test("C-15: units stay with their values in the line of a changed figure", () => {
  const a = { id: "x", unit: "days", direction: "lower", history: { first: { year: 2019, v: 17 }, delta: 10, trendClass: "worsening" }, last: { year: 2025, v: 27 } };
  assert.equal(S.changeLine(a).text, "מ-17 ימים ב-2019 ל-27 ימים ב-2025 (עלייה של 10 ימים)");
  assert.equal(S.changeLine(a).word, "הידרדר");
  const p = { id: "y", unit: "%", direction: "higher", history: { first: { year: 2020, v: 61.2 }, delta: -9.3, trendClass: "worsening" }, last: { year: 2024, v: 51.9 } };
  const spell = { used: false };
  assert.match(S.changeLine(p, spell).text, /\(ירידה של 9\.3 נקודות אחוז\)$/);
  assert.match(S.changeLine(p, spell).text, /\(ירידה של 9\.3 נק׳\)$/, "spelled out once, short after it");
  const r = D.rowReason({ status: "concern", statusWhy: ["target"], unit: "days", last: { gapTarget: 12, rank: null } });
  assert.match(r.rest, /^חסרים 12 ימים ליעד הרשמי\.$/);
});

test("C-23, C-06: the first step is a headline of at most 70 characters, built from real figures", { skip }, () => {
  const h = D.stepHeadline({ title: "ת".repeat(40) + " " + "ת".repeat(40) });
  assert.ok(h.text.length <= 71 && h.clamped);
  assert.equal(D.stepHeadline({ title: "קצר", short: "תוכנית" }).text, "תוכנית");
  const a = S.answer(M["1031"], "first");
  assert.match(a.plain, /^הצעד הראשון: .+\.$/);
  assert.match(a.ledePlain, /חצבת, חזרת ואדמת: 51\.9% \(יעד 80%\)\./);          // the Latin code of the vaccine is not a name a reader knows (copy.js SHORT)
  assert.match(a.ledePlain, /בשלושתם המגמה בהידרדרות מאז 2020/);
  assert.ok(D.isCheck({ intervention: "data_check" }) && !D.isCheck({ intervention: "imm_reminder_recall" }));
});

test("C-16: the catalogue short names the audit flagged are overridden", () => {
  assert.equal(C.shortName({ id: "mortality_std", short: "פטירות מתוקנן" }), "שיעור פטירות מתוקנן");
  assert.equal(C.shortName({ id: "th_iron", short: "תוסף ברזל" }), "תוסף ברזל לתינוקות");
  assert.equal(C.shortName({ id: "other", short: "כך", label: "ארוך" }), "כך");
});

test("which questions a town can answer: the page drops the sections it cannot honestly fill", { skip }, () => {
  assert.deepEqual(D.availability(M["1031"]), { weak: null, changed: null, peers: null, first: null, missing: null });
  for (const k of ["16", "7"]) { const v = D.availability(M[k]); assert.equal(v.weak, null); assert.ok(v.changed && v.peers && v.first, k); assert.equal(v.missing, null); }
  assert.deepEqual(C.QUESTIONS("שדרות").map((q) => q.text), ["איפה המצב הכי חלש בשדרות?", "מה השתפר ומה הידרדר?", "איך שדרות מול יישובים דומים?", "מה כדאי לעשות קודם?", "אילו נתונים חסרים על שדרות?"]);
});

test("shareMeta and headline: the title of a share page is the answer, with no DOM", { skip }, () => {
  const m = M["1031"], st = D.stateOf(m), meta = S.shareMeta(m, "weak");
  assert.equal(meta.title, `שדרות: ${st.all.concern} מתוך ${st.judged} מדדים דורשים טיפול`);
  assert.ok(meta.description.length > 20);
  assert.equal(S.headline(m, "weak"), S.answer(m, "weak").plain);
  for (const q of Q) assert.ok(S.shareMeta(M["16"], q).title.length > 5);
  assert.equal(S.shareMeta(M["935"], "weak").title, "אין נתונים רשמיים על אבו סריחאן (שבט)");
});

test("this answer's table for the CSV button", { skip }, () => {
  for (const q of Q) { const t = D.answerTable(M["1031"], q, null); assert.ok(t.columns.length >= 2 && t.rows.length > 0, q); }
  assert.equal(D.answerTable(M["1031"], "weak").rows.length, 5);
  assert.ok(D.answerTable(M["16"], "weak").rows.every((r) => r.status === "קבוצה קטנה" || r.status === "מתאר בלבד"));
});
