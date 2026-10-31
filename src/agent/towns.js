"use strict";
/**
 * Other localities named in a question, and the comparison with them.
 *
 * The ask-agent is opened on the page of ONE locality, but the system holds data on every locality of the store, and the compare page
 * (#/c/<key>/compare?with=<keys>) already sets up to five of them side by side. This module is the part that lets a question reach them:
 *
 *   findTowns(store, question, currentKey)   which localities the question names (code only, no model): Hebrew prefixes (ב ל מ ו ה ש כ and
 *                                            their combinations), multi-word names, the spellings the store knows, the longest name first,
 *                                            no overlap, the current locality left out, at most four others. A name that fits several
 *                                            localities is never guessed: it is reported, and the answer says it was not understood.
 *   buildBlock(spec, ctx)                    the block { type: "towns", ... }: for every figure that has a direction, every locality's value,
 *                                            who is first and who is last, and a lead sentence written by the server.
 *
 * The rules of the block are the compare page's (web/js/pages/compare.js): only a figure with a direction is ranked; a group too small to
 * count (reliable === false) is shown but never ranked and never counted; a figure with fewer than two reliable values is not compared;
 * a tie is not a win; the year stays per locality; nothing is averaged. Every number comes from the store and from the locality models.
 */
const { indicators, byId } = require("../catalog/indicators");
const domains = require("../catalog/domains");
const { isReliable } = require("../model/analyze");
const { I } = require("../lib/format");
const { plainCodes } = require("./guard");

const MAX_OTHERS = 4;                       // the compare page takes five localities in all
const MAX_WORDS = 6;                        // the longest name is read as up to this many words
const MAX_ROWS = 41;
const NIKUD = /[֑-ׇ]/g;

// ── names ──────────────────────────────────────────────────────────────────
// Two keys for one spelling. The strict key keeps the letters (nikud, quotes and punctuation off; a hyphen is a space), so that "צוקי ים" and "צוקים" stay two names.
// The loose key also folds a doubled yod or vav, the way the store spells "הרצלייה" and a person writes "הרצליה". A name is looked up strict first, then loose.
const strict = (s) => String(s == null ? "" : s).replace(NIKUD, "").replace(/[׳’‘`´]/g, "'").replace(/[״"”“]/g, "").replace(/[?!:;,.()[\]]+/g, " ").replace(/[\-–—_/\s]+/g, " ").trim();
const loose = (s) => strict(s).replace(/יי/g, "י").replace(/וו/g, "ו");
const coreOf = (name) => String(name == null ? "" : name).replace(/\([^)]*\)/g, " ");     // the name without the qualifier in brackets
const FAMILIES = [strict, loose];

// words that are also names of small localities, or that a question in this product uses every day ("יעד", "מנות", "אזור", "שני", "רווחה" ...), or that become
// an everyday word after a prefix letter ("מגזר" = מ + גזר, "משקף" = מ + שקף): such a name is taken for a locality only after a word that says it is one ("ביישוב יעד")
const COMMON_WORDS = ["יעד", "מנות", "רווחה", "שני", "מתן", "מגן", "מסלול", "חוסן", "עזר", "סולם", "שורש", "יבול", "חזון", "דור", "חבר", "אזור", "סעד", "עידן", "מאור", "ברכה",
  "מיטב", "רחוב", "אומץ", "בניה", "מלאה", "שפר", "יקום", "כליל", "קשת", "גשר", "מעון", "נווה", "פורת", "אוהד", "קציר", "חלוץ", "רעים", "זמר", "ישע", "משען", "אפק",
  "גבולות", "אשכולות", "מצפה", "מגדל", "תלם", "עלי", "אור", "דן", "גת", "גן", "לב", "שלום", "נחל", "יד", "בית", "כפר", "הר", "גזר", "שקף", "קדימה", "קבועה"];
const PREFIX_SEQ = /^(?:ו?ש?[בכלמ]?|ו[בכלמ]?)$/;                       // the prefixes a Hebrew word takes in front of a name: ו, ש, and one of ב כ ל מ (the article ה is not one: "הגדרה" is a word, not "the Gedera")
const MARKER_WORDS = ["יישוב", "ישוב", "עיר", "עיירה", "קיבוץ", "מושב", "מועצה", "רשות", "כפר"];

// colloquial names no spelling rule can fold into the official one (the same idea as ALIASES in src/lib/names.js)
const ALIASES = { "נצרת עילית": "נוף הגליל", "נצרת עלית": "נוף הגליל", "מודיעין": "מודיעין-מכבים-רעות", "יהוד": "יהוד-מונוסון" };
// abbreviations with their quote mark (without it "תא" or "פת" are ordinary words)
const ABBREVIATIONS = { 'ת"א': "תל אביב-יפו", 'ב"ש': "באר שבע", 'פ"ת': "פתח תקווה", 'ראשל"צ': "ראשון לציון", 'ר"ג': "רמת גן", 'ב"ב': "בני ברק" };

const COMMON = new Set(COMMON_WORDS.map(loose));
const MARKERS = new Set(MARKER_WORDS.map(loose));
const isMarker = (tok) => {
  const t = String(tok).replace(/[?!:;,.]+$/, "");
  for (let k = 0; k < t.length - 1 && k <= 3; k++) { if (k && !PREFIX_SEQ.test(t.slice(0, k))) break; if (MARKERS.has(loose(t.slice(k)))) return true; }
  return false;
};

const indexes = new WeakMap();
function indexOf(store) {
  let ix = indexes.get(store);
  if (ix) return ix;
  const have = new Set(store.search("", 1e6).map((r) => r.key));              // the localities that have at least one figure
  const entries = Object.keys(store.localities).map((key) => {
    const name = store.name(key), core = coreOf(name), words = core.split(/[\s-]+/).filter(Boolean);
    return { key, name, core, words: words.length, data: have.has(key), segs: core.split(/\s*[-–]\s*/).map((x) => x.trim()).filter(Boolean) };
  });
  const push = (m, k, e) => { if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k).push(e); };
  ix = { entries, fam: FAMILIES.map((norm) => {
    const full = new Map(), core = new Map(), partial = new Map();
    for (const e of entries) {
      push(full, norm(e.name), e); push(core, norm(e.core), e);
      for (let n = 1; n < e.segs.length; n++) { const k = norm(e.segs.slice(0, n).join(" ")); if (k.replace(/ /g, "").length >= 5) push(partial, k, e); }     // "תל אביב" for "תל אביב-יפו"
    }
    for (const e of entries) {                                                  // every other name that starts with the same words, so that a first word is not mistaken for one place
      const w = norm(e.core).split(" ");
      for (let n = 1; n < w.length; n++) { const k = w.slice(0, n).join(" "); const p = partial.get(k); if (p && !p.includes(e)) p.push(e); }
    }
    const alias = new Map();
    for (const [a, official] of Object.entries(ALIASES)) { const t = (full.get(norm(official)) || [])[0]; if (t && !core.has(norm(a))) alias.set(norm(a), t); }
    return { norm, full, core, partial, alias };
  }), abbr: new Map(Object.entries(ABBREVIATIONS).map(([a, official]) => [a, entries.find((e) => strict(e.name) === strict(official))]).filter(([, t]) => t)) };
  indexes.set(store, ix);
  return ix;
}

// the one the text names, or the list it could be, or nothing. `phrase` is the text as typed (a prefix letter already taken off, if any)
function lookup(ix, phrase) {
  const raw = String(phrase).replace(/[״”“]/g, '"').replace(/[?!:;,.]+$/, "");
  if (ix.abbr.has(raw)) return { one: ix.abbr.get(raw) };
  const pick = (list) => (list.length === 1 ? { one: list[0] } : { many: list });          // one place of that name, or several: never a guess
  for (const F of ix.fam) {
    const f = F.norm(phrase);
    if (!f) return null;
    if (F.full.has(f)) return pick(F.full.get(f));                              // the whole official name, the qualifier in brackets included
    if (F.core.has(f)) return pick(F.core.get(f));                              // the name without its qualifier: unique, or ambiguous
    if (F.alias.has(f)) return { one: F.alias.get(f) };
    if (F.partial.has(f)) {                                                     // the first part of a name with a hyphen ("תל אביב" of "תל אביב-יפו"): only a place that has figures
      const list = F.partial.get(f).filter((e) => e.data);
      if (list.length) return pick(list);
    }
  }
  return null;
}

const compareCue = /השווא|השוו|לעומת|בהשוואה|ביחס ל|מי\s+(?:מנצח|מוביל|יותר|טוב|חזק|חלש|עדיף|מצליח)|מנצח|מובילה?\b|עדיף|טוב יותר|יותר טוב|חלש יותר|חזק יותר|גרוע יותר|איזה מהם|איזה מהן|מי מהם|\bvs\b/i;

/**
 * -> { towns: [{ key, name, text }]   the other localities, in the order the question names them (at most four)
 *      ignored: [{ key, name }]       named too, but past the limit
 *      ambiguous: [{ text, options: [{ key, name }] }]   a name that fits several localities and was not guessed
 *      noData: [{ key, name }]        in the store, but without a single figure
 *      cue: bool                      the question asks for a comparison in so many words }
 */
function findTowns(store, question, currentKey) {
  const out = { towns: [], ignored: [], ambiguous: [], noData: [], cue: false };
  const q = String(question || "").slice(0, 600);
  const toks = q.replace(/[,;،\u200e\u200f]/g, " ").split(/\s+/).filter(Boolean);
  out.cue = compareCue.test(q);
  if (!toks.length) return out;
  const ix = indexOf(store);
  const markerBefore = (i) => i > 0 && isMarker(toks[i - 1]);
  const found = [];
  for (let i = 0; i < toks.length; i++) {
    for (let L = Math.min(MAX_WORDS, toks.length - i); L >= 1; L--) {
      const phrase = toks.slice(i, i + L).join(" ");
      const first = toks[i];
      let hit = lookup(ix, phrase), lost = 0;
      for (let k = 1; !hit && k <= 3 && k < first.length - 1; k++) {                // ו ש ב כ ל מ in front of the name, as a Hebrew word takes them
        if (!PREFIX_SEQ.test(first.slice(0, k))) break;
        hit = lookup(ix, (first.slice(k) + " " + toks.slice(i + 1, i + L).join(" ")).trim()); lost = k;
      }
      if (!hit) continue;
      const everyday = (e) => e.words === 1 && (loose(e.core).replace(/ /g, "").length <= 2 || COMMON.has(loose(e.core)));
      const one = hit.one, marked = markerBefore(i);
      if (one && everyday(one) && !marked) continue;                               // an everyday word: only after "יישוב", "קיבוץ" ...
      if (hit.many && hit.many.every(everyday) && !marked) continue;
      if (one && !one.data && !out.cue && !lost && L === 1 && !marked) continue;    // a place without figures, named by a bare word in a question that does not compare: most likely just a word
      found.push({ i, j: i + L, words: L, size: phrase.length - lost, one, many: hit.many, text: phrase.slice(lost).replace(/[?!:;,.]+$/, "") });
    }
  }
  found.sort((a, b) => b.words - a.words || b.size - a.size || a.i - b.i);
  const taken = new Array(toks.length).fill(false), chosen = [];
  for (const m of found) {
    let free = true; for (let p = m.i; p < m.j; p++) if (taken[p]) free = false;
    if (!free) continue;
    for (let p = m.i; p < m.j; p++) taken[p] = true;
    chosen.push(m);
  }
  chosen.sort((a, b) => a.i - b.i);
  const seen = new Set([String(currentKey)]);
  for (const m of chosen) {
    if (m.many) {
      const options = m.many.map((e) => ({ key: e.key, name: e.name }));
      if (!out.ambiguous.some((x) => x.text === m.text)) out.ambiguous.push({ text: m.text, options });
      continue;
    }
    const e = m.one;
    if (seen.has(e.key)) continue;
    seen.add(e.key);
    if (!e.data) { out.noData.push({ key: e.key, name: e.name }); continue; }
    if (out.towns.length >= MAX_OTHERS) out.ignored.push({ key: e.key, name: e.name });
    else out.towns.push({ key: e.key, name: e.name, text: m.text });
  }
  return out;
}

// ── the comparison ─────────────────────────────────────────────────────────
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const same = (a, b) => Math.abs(a - b) < 1e-9;

// the order of one figure: who is first and who is last among the values that count. A tie is nobody's: best and worst are null then.
// -> null when fewer than two values count (the figure is not compared)
function rankRow(values, direction) {
  const live = values.filter((x) => x && x.reliable !== false && isNum(x.v));
  if (live.length < 2) return null;
  const lower = direction === "lower";
  const top = live.reduce((m, x) => (lower ? (x.v < m ? x.v : m) : (x.v > m ? x.v : m)), live[0].v);
  const bottom = live.reduce((m, x) => (lower ? (x.v > m ? x.v : m) : (x.v < m ? x.v : m)), live[0].v);
  const firsts = live.filter((x) => same(x.v, top)), lasts = live.filter((x) => same(x.v, bottom));
  const all = same(top, bottom);
  return { best: !all && firsts.length === 1 ? firsts[0].key : null, worst: !all && lasts.length === 1 ? lasts[0].key : null, counted: live.length };
}

const domainIndex = new Map(domains.map((d, i) => [d.id, i]));
const domainLabel = (id) => (domains.find((d) => d.id === id) || {}).label || id;

// the figures of the current locality that can be set against others: a direction, and not behind the newest year (the compare page's own list)
const comparable = (model) => model.indicators.filter((a) => !a.stale && a.direction);

function cellOf(store, id, key) {
  const ys = store.cityYears(id, key), y = ys[ys.length - 1], c = y ? store.cell(id, key, y) : null;
  return c ? { year: y, v: c.v, d: c.d == null ? null : c.d } : null;
}

// ── words ──────────────────────────────────────────────────────────────────
const joinHe = (xs) => (xs.length <= 1 ? xs[0] || "" : xs.slice(0, -1).join(", ") + " ו" + xs[xs.length - 1]);
const nMeasures = (n) => (n === 1 ? "מדד אחד" : n === 2 ? "שני מדדים" : I(n) + " מדדים");
const inN = (n) => (n === 1 ? "במדד אחד" : "ב-" + I(n));            // "ב-12" / "במדד אחד"
const inMeasures = (n) => (n === 1 ? "במדד אחד" : "ב-" + I(n) + " מדדים");

// the lead sentence, from the counts of the block. Plain neutral Hebrew; no "we"; no claim about a cause; "יישוב", never "עיר", for a place that may be a council or a kibbutz.
// No verb that agrees with the name of a place (a city is "היא", a kibbutz is "הוא"): "אשקלון בראש ב-12 מהם".
function lead(b) {
  const byKey = new Map(b.towns.map((t) => [t.key, t])), M = b.compared, cur = b.towns[0].name, single = b.mode === "single";
  const where = b.scope && b.scope.where ? " " + b.scope.where : "";
  const parts = [];
  if (single) parts.push(`השאלה היא על ${b.towns[1].name}, ולכן כאן ההשוואה בין ${cur} ל${b.towns[1].name}.`);
  const head = single ? "" : `בין ${joinHe(b.towns.map((t) => t.name))} `;
  if (!M) parts.push(`${head}אין כרגע מדד${where} שאפשר לדרג: בכל מדד יש פחות משני יישובים עם קבוצה גדולה מספיק.`);
  else {
    parts.push(`${head}אפשר להשוות ${nMeasures(M)}${where}.`);
    const leaders = b.wins.filter((w) => w.n > 0);
    if (!leaders.length) parts.push("בכל המדדים האלה יש תיקו בראש, ולכן אף יישוב אינו בראש באף אחד מהם.");
    else {
      parts.push(joinHe(leaders.map((w, i) => `${byKey.get(w.key).name} ${i === 0 ? "בראש " : ""}${inN(w.n)}${i === 0 ? " מהם" : ""}`)) + ".");
      const tied = M - leaders.reduce((s, w) => s + w.n, 0);
      if (tied > 0) parts.push(`${inMeasures(tied)} אין יישוב אחד בראש, כי כמה יישובים באותו ערך.`);
    }
  }
  if (b.smallRows > 0 && b.smallTowns.length) {
    const many = b.smallTowns.length > 1;
    parts.push(`${inMeasures(b.smallRows)} ${many ? "הקבוצות" : "הקבוצה"} ${joinHe(b.smallTowns.map((k) => "ב" + byKey.get(k).name))} ${many ? "קטנות" : "קטנה"} מדי, ולכן ${many ? "הנתונים מוצגים" : "הנתון מוצג"} בלי דירוג.`);
  }
  for (const a of b.ambiguous) parts.push(`השם ״${a.text}״ מתאים לכמה יישובים (${a.options.slice(0, 4).map((o) => o.name).join(", ")}), ולכן לא נכלל.`);
  if (b.noData.length) parts.push(`אין במערכת נתונים על ${joinHe(b.noData.map((x) => x.name))}.`);
  if (b.ignored.length) parts.push(`אפשר להשוות עד חמישה יישובים בבת אחת. מחוץ להשוואה: ${joinHe(b.ignored.map((x) => x.name))}.`);
  parts.push("הרשימה והפירוט למטה, וההשוואה המלאה בעמוד ההשוואה.");
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// notes the screen prints under the list (the sentence above does not repeat the year)
function notesOf(b) {
  const notes = [];
  if (b.yearsDiffer) notes.push("בחלק מהמדדים השנה האחרונה שונה בין היישובים. השנה מופיעה ליד כל ערך, וההשוואה היא בין השנים האחרונות של כל יישוב.");
  if (b.smallRows > 0) notes.push("קבוצה קטנה מדי מוצגת אבל לא מדורגת: היא אינה נספרת כמקום ראשון או אחרון.");
  if (b.notCompared > 0) notes.push(b.notCompared === 1 ? "מדד אחד לא הושווה, כי אין בו שני יישובים עם קבוצה גדולה מספיק." : `${I(b.notCompared)} מדדים לא הושוו, כי אין בהם שני יישובים עם קבוצה גדולה מספיק.`);
  return notes;
}

// ── the block ──────────────────────────────────────────────────────────────
/**
 * spec: { keys: [keys of the other localities], mode: "named" | "single", scope?: { ids?: [...], domains?: [...] }, ignored, ambiguous, noData }
 * ctx:  { store, model (of the current locality), getModel(key) }
 */
function buildBlock(spec, ctx) {
  const { store, model, getModel } = ctx;
  if (!spec || !Array.isArray(spec.keys) || typeof getModel !== "function") return null;
  const cur = String(model.city.key), keys = [...new Set(spec.keys.map(String))].filter((k) => k !== cur && store.hasLocality(k)).slice(0, MAX_OTHERS);
  if (!keys.length) return null;
  const noData = [...(spec.noData || [])];
  const models = new Map([[cur, model]]);
  const used = [];
  for (const k of keys) { const m = getModel(k); if (m && m.indicators.length) { models.set(k, m); used.push(k); } else noData.push({ key: k, name: store.name(k) }); }
  if (!used.length) return null;
  const order = [cur, ...used];

  // every figure of the current locality that has a direction, in the order of the catalogue's domains
  let universe = comparable(model).slice().sort((a, b) => (domainIndex.get(a.domain) ?? 99) - (domainIndex.get(b.domain) ?? 99));
  const build = (list) => {
    const rows = [], skipped = [];
    for (const a of list) {
      const ind = byId[a.id];
      if (!ind) continue;
      const values = order.map((k) => {
        const c = cellOf(store, a.id, k), m = models.get(k), am = m && m.indicators.find((x) => x.id === a.id);
        if (!c) return { key: k, v: null, year: null, d: null, reliable: null, status: null, stale: false };
        return { key: k, v: c.v, year: c.year, d: c.d, reliable: isReliable(ind, c.d), status: am ? am.status : null, stale: !!(am && am.status === "stale") };
      });
      const r = rankRow(values, a.direction);
      const ys = [...new Set(values.filter((x) => x.year != null).map((x) => x.year))].sort();
      const ly = store.years(a.id), nat = ly.length ? store.nat(a.id, ly[ly.length - 1]) : null;
      const row = { ind: { id: a.id, label: plainCodes(a.label), short: plainCodes(a.short), unit: a.unit, direction: a.direction, domain: a.domain }, values, years: ys, sameYear: ys.length <= 1,
        best: r ? r.best : null, worst: r ? r.worst : null, national: nat ? { v: nat.v, year: ly[ly.length - 1] } : null };
      (r ? rows : skipped).push(row);
    }
    return { rows, skipped };
  };

  // a topic in the question narrows the list; if nothing in that topic can be compared the whole list is used, and the block says so
  let scope = null, got = build(universe);
  const sc = spec.scope || {};
  const ids = new Set((sc.ids || []).filter((id) => universe.some((a) => a.id === id))), doms = new Set((sc.domains || []).filter((d) => universe.some((a) => a.domain === d)));
  if (ids.size || doms.size) {
    const narrowed = build(universe.filter((a) => ids.has(a.id) || doms.has(a.domain)));
    if (narrowed.rows.length) {
      got = narrowed;
      const only = [...ids].map((id) => byId[id]).filter(Boolean);
      const label = !ids.size && doms.size === 1 ? domainLabel([...doms][0]) : only.length === 1 ? plainCodes(only[0].short || only[0].label) : null;
      scope = { kind: ids.size ? "indicators" : "domain", ids: [...ids], domains: [...doms], label, where: label ? (ids.size ? `בנושא ${label}` : `בתחום ${label}`) : "בנושא השאלה" };
    } else scope = { kind: "all", ids: [], domains: [], label: null, where: "", fellBack: true };
  }
  const rows = got.rows.slice(0, MAX_ROWS);

  const towns = order.map((k, i) => {
    const m = models.get(k), c = m.counts || {};
    return { key: k, name: store.name(k), population: m.city.population || null, self: i === 0, href: "#/c/" + encodeURIComponent(k),
      counts: { concern: c.concern || 0, watch: c.watch || 0, good: c.good || 0, strength: c.strength || 0, judged: (c.concern || 0) + (c.watch || 0) + (c.good || 0) + (c.strength || 0) } };
  });
  const wins = order.map((k) => ({ key: k, inds: rows.filter((r) => r.best === k).map((r) => r.ind.id) })).map((w) => ({ key: w.key, n: w.inds.length, inds: w.inds }));
  const lastPlace = order.map((k) => ({ key: k, n: rows.filter((r) => r.worst === k).length }));
  wins.sort((a, b) => b.n - a.n || order.indexOf(a.key) - order.indexOf(b.key));
  const smallRows = rows.filter((r) => r.values.some((v) => v.reliable === false)).length;
  const smallTowns = order.filter((k) => rows.some((r) => r.values.some((v) => v.key === k && v.reliable === false)));

  const b = {
    type: "towns", mode: spec.mode === "single" ? "single" : "named", towns, rows, wins, lastPlace,
    compared: rows.length, notCompared: got.skipped.length, yearsDiffer: rows.some((r) => !r.sameYear), smallRows, smallTowns, scope,
    ignored: (spec.ignored || []).map((x) => ({ key: x.key, name: x.name })), ambiguous: (spec.ambiguous || []).map((x) => ({ text: x.text, options: x.options.slice(0, 6) })), noData: noData.map((x) => ({ key: x.key, name: x.name })),
    href: "#/c/" + encodeURIComponent(cur) + "/compare?with=" + used.map(encodeURIComponent).join(",")
  };
  b.title = b.mode === "single" ? `השוואה בין ${towns[0].name} ל${towns[1].name}` : "השוואה בין " + joinHe(towns.map((t) => t.name));
  b.lead = lead(b);
  b.notes = notesOf(b);
  return b;
}

// what the planners put into a spec when the question names other localities
function blockSpec(found, scope) {
  if (!found || !found.towns.length) return null;
  const single = found.towns.length === 1 && !found.cue;
  return { type: "towns", keys: found.towns.map((t) => t.key), mode: single ? "single" : "named", scope: scope || null, ignored: found.ignored, ambiguous: found.ambiguous, noData: found.noData };
}

// a sentence for the case where names were found but none can be compared (only ambiguous names, or localities without a figure)
function unresolvedSentence(found, curName) {
  if (!found || found.towns.length || !(found.ambiguous.length || found.noData.length)) return null;
  const parts = [];
  for (const a of found.ambiguous) parts.push(`השם ״${a.text}״ מתאים לכמה יישובים (${a.options.slice(0, 4).map((o) => o.name).join(", ")}), ולכן לא ברור עם מי להשוות את ${curName}. אפשר לכתוב את השם המלא.`);
  if (found.noData.length) parts.push(`אין במערכת נתונים על ${joinHe(found.noData.map((x) => x.name))}, ולכן לא נעשתה השוואה.`);
  return parts.join(" ");
}

module.exports = { findTowns, buildBlock, blockSpec, unresolvedSentence, rankRow, lead, joinHe, strict, loose, MAX_OTHERS, MAX_ROWS, COMMON_WORDS, ALIASES, ABBREVIATIONS };
