// The briefing as a document (SPEC 5.3): which sections it has and what every sentence, number and word in them is. No DOM and no import that touches one, so node can
// import it (the tests read the whole document as text). Nothing here is invented: sentences come from city/sentence.js, rules and figures from city/data.js, words from
// city/copy.js and kit/plural.js; brief.js only draws what this returns.
//   briefDoc(model, { meta }) -> { key, name, kind, title, facts, basis, sections: [{ id, heading, ... }], foot }
// Sections, in the order of the page: lead weakest changes peers first missing howto. Every town gets all seven; a town with little or nothing to rank gets short honest
// sentences in the same places, never an empty frame. meta (GET /api/meta) is optional: without it "מה חסר" has the sentence and no list.
import { iso, unitSuffix } from "../../ui.js";
import { withUnit } from "../kit/plural.js";
import { provenanceParts } from "../kit/provenance.js";
import * as D from "../city/data.js";
import * as S from "../city/sentence.js";
import { T, QIDS, howtoText, HORIZON, STRENGTH, EFFORT, QUESTIONS, shortName } from "../city/copy.js";

const { isNum } = D;
export const SECTIONS = ["lead", "weakest", "changes", "peers", "first", "missing", "howto"];
export const HEAD = {
  changes: "השינויים הבולטים", peers: "מול יישובים דומים", first: "הצעד הראשון", missing: "מה חסר", howto: "איך לקרוא",
  // "חמשת המדדים הכי חלשים": the number agrees with the rows that are really shown
  weakest: (n) => ({ 1: "המדד הכי חלש", 2: "שני המדדים הכי חלשים", 3: "שלושת המדדים הכי חלשים", 4: "ארבעת המדדים הכי חלשים", 5: "חמשת המדדים הכי חלשים" }[n] || "המדדים הכי חלשים")
};
export const COLUMNS = { figure: "מדד", value: "הערך", year: "שנה", nat: "ארצי", place: "המקום בין היישובים", dir: "מה טוב" };
export const DIRECTION = { higher: "גבוה טוב", lower: "נמוך טוב", none: "מתאר בלבד" };
const MISSING_ALL = (st) => `לא נמצא נתון על אף אחד מ-${iso(st.total)} המדדים.`;
const EMPTY_TABLE = (name) => `אין ב${name} מדד שאפשר להציג בטבלה.`;
const NO_LIST = "אילו מדדים חסרים, מדד אחרי מדד, כתוב בעמוד כיסוי הנתונים.";

// a value with its unit: the unit stands with the number (C-15); a unit without a word of its own (index) gets its suffix
export function valueText(a, v) {
  if (!isNum(v)) return "—";
  const s = withUnit(v, a.unit, a.unit === "index" ? 2 : 1);
  return ["index"].includes(a.unit) && unitSuffix(a.unit) ? `${s} ${unitSuffix(a.unit)}` : s;
}
// the place among the localities, as the table says it: "מקום 167 מתוך 187", and "האחרון" at the bottom
export function placeText(L) {
  if (!L || L.rank == null || !L.of) return "";
  return `מקום ${iso(L.rank)} מתוך ${iso(L.of)}` + (D.lastPlace(L) ? ", האחרון" : "");
}
const dirOf = (a) => DIRECTION[a.direction] || DIRECTION.none;

// ── the sentence and its lede, kept as segments so that brief.js can colour a number and link a name; plain strings for tests and for screen readers ──
const said = (a) => ({ segs: a.segs, plain: a.plain, lede: a.lede, ledePlain: a.ledePlain, kind: a.kind });

// ── 2. the weakest five (or, when nothing can be judged, the numbers that exist, as they are) ──
function weakest(model) {
  const st = D.stateOf(model), name = model.city.name, judged = st.judged > 0;
  const list = judged ? D.weakestFive(model) : model.indicators.filter(D.isSmall).sort((x, y) => (y.importance || 0) - (x.importance || 0) || x.id.localeCompare(y.id));
  if (!list.length || D.townKind(model) === "uncovered") return { id: "weakest", heading: HEAD.weakest(5), empty: D.townKind(model) === "uncovered" ? "אין מדדים להצגה בטבלה." : EMPTY_TABLE(name), rows: [], table: false };
  const rows = list.map((a) => {
    const L = a.last, small = !judged || D.isSmall(a);
    return {
      id: a.id, name: shortName(a), small,
      status: small ? { word: "קבוצה קטנה", tone: "none", icon: "info" } : { word: D.statusWord(a.status), tone: D.statusTone(a.status), icon: D.statusIcon(a.status) },
      target: !small && (a.status === "concern" || a.status === "watch") && isNum(L.target) ? `יעד רשמי ${valueText(a, L.target)}` : "",
      value: valueText(a, L.v), year: L.year == null ? "" : String(L.year), nat: small ? "" : isNum(L.nat) ? valueText(a, L.nat) : "",
      place: small ? "ללא דירוג" : placeText(L), dir: dirOf(a)
    };
  });
  const concern = st.all.concern || 0;
  const sub = judged
    ? "מסודרים לפי המקום בין יישובי הארץ, מהנמוך ביותר." + (concern === 0 ? " אף אחד מהם אינו מוגדר כדורש טיפול." : "")
    : T.block.asIsSub;
  return { id: "weakest", heading: judged ? HEAD.weakest(rows.length) : T.block.asIs, sub, rows, table: true, small: !judged };
}

// ── 3. what changed most: the figures the sentence counts, the biggest first ──
function changes(model, A) {
  const spell = { used: false };
  const rows = D.movers(model, 5).map(({ a }) => { const line = S.changeLine(a, spell); return { id: a.id, name: shortName(a), word: line.word, tone: a.history.trendClass === "improving" ? "good" : "attn", text: line.text }; });
  return { id: "changes", heading: HEAD.changes, said: said(A.changed), rows };
}

// ── 4. next to similar localities: the sentence and the one figure that differs most ──
function peers(model, A) {
  const t = A.peers.kind === "answer" ? D.mostTelling(model) : null;
  let tell = null;
  if (t) {
    const a = t.a, L = a.last, name = model.city.name;
    tell = {
      id: a.id, label: T.block.telling(name), name: shortName(a), year: String(L.year), direction: a.direction ? (a.direction === "lower" ? "ככל שהמספר נמוך יותר, כך טוב יותר" : "ככל שהמספר גבוה יותר, כך טוב יותר") : "",
      place: placeText(L),
      marks: [{ k: "city", label: name, value: valueText(a, L.v) }, { k: "peer", label: "יישובים דומים (הערך האמצעי)", value: valueText(a, L.peer) }, isNum(L.nat) ? { k: "nat", label: "ממוצע ארצי", value: valueText(a, L.nat) } : null].filter(Boolean)
    };
  }
  return { id: "peers", heading: HEAD.peers, said: said(A.peers), tell };
}

// ── 5. what to do first: the headline, why this one, who, when, how much effort ──
function first(model, A) {
  const recs = model.recommendations || [], st = D.stateOf(model);
  const sec = { id: "first", heading: HEAD.first, said: said(A.first), facts: [], why: "", prepare: null };
  if (!recs.length || !st.judged || A.first.kind !== "answer") return sec;
  const r = recs[0], check = recs.slice(1, 4).find(D.isCheck) || null, why = (r.why || [])[0];
  if (check && !D.isCheck(r)) sec.prepare = { head: T.block.prepare || "בדיקה מקדימה:", text: check.title.replace(/[.\s]+$/, "") + "." };
  if (why) sec.why = String(why.text || why);
  const fact = (k, v) => (v ? [k, v] : null);
  sec.facts = [fact("מי אחראי", r.owner), fact("תוך כמה זמן", HORIZON[r.horizon] || r.horizon), fact("כמה מאמץ", EFFORT[r.effort] || r.effort),
    fact("כמה חזקות הראיות", r.evidenceStrength ? STRENGTH[r.evidenceStrength] || r.evidenceStrength : "אין מחקר ייעודי על פעולה כזאת")].filter(Boolean);
  return sec;
}

// ── 6. what is missing: the sentence, and the figures that are not published, grouped by who would have to publish them ──
function missing(model, A, meta) {
  const st = D.stateOf(model), name = model.city.name, kind = D.townKind(model);
  const sec = { id: "missing", heading: HEAD.missing, said: kind === "uncovered" ? { segs: [MISSING_ALL(st)], plain: MISSING_ALL(st), lede: [], ledePlain: "", kind: "nodata" } : said(A.missing), groups: [], note: "" };
  if (kind === "uncovered" || st.total - st.have <= 0) return sec;
  if (!meta || !meta.indicators) { sec.note = NO_LIST; return sec; }
  const cov = D.coverageOf(model, meta);
  sec.groups = D.missingGroups(cov.cat, name, meta.sources).map((g) => ({ names: g.items.map((c) => c.short || c.label), why: g.why + "." }));
  return sec;
}

// ── 7. how to read: the five lines of the home, under the question each one answers ──
// a town that cannot be set against similar towns (very small, or without an answer to that question) does not get the definition of that comparison either
function howto(model) {
  const noPeers = D.hasNoPeers(model);
  return { id: "howto", heading: HEAD.howto, lines: QUESTIONS(model.city.name).filter((q) => !(noPeers && q.id === "peers")).map((q) => ({ q: q.id, question: q.text, text: howtoText(q.id, noPeers) })) };
}

export function briefDoc(model, { meta = null } = {}) {
  const c = model.city, name = c.name, kind = D.townKind(model), A = Object.fromEntries(QIDS.map((q) => [q, S.answer(model, q)]));
  const facts = [c.status, c.district ? "מחוז " + c.district : null, c.population ? `${iso(c.population.toLocaleString("en-US"))} תושבים` : null,
    c.sesCluster != null ? `אשכול חברתי-כלכלי ${iso(c.sesCluster)} מתוך ${iso(10)}` : null].filter(Boolean);
  const basis = S.basisLine(model), prov = provenanceParts(model, model.indicators);
  const lead = { id: "lead", said: said(A.weak) };
  // for a town the sources do not cover, the sections that repeat "there are no data" keep one short sentence each and no lede: the lead already says why
  const quiet = (sec) => (kind === "uncovered" && sec.said ? { ...sec, said: { ...sec.said, lede: [], ledePlain: "" } } : sec);
  return {
    key: String(c.key), name, kind, title: `דוח בריאות היישוב: ${name}`, facts, basis,
    sections: [lead, weakest(model), quiet(changes(model, A)), quiet(peers(model, A)), quiet(first(model, A)), quiet(missing(model, A, meta)), howto(model)],
    foot: { sources: prov.sources, years: prov.years, updated: prov.updated, statement: T.statement }
  };
}

// every string of the document as one text (the tests scan it for raw tokens and forbidden words; a screen reader reads the same words)
export function docText(doc) {
  const out = [doc.title, ...doc.facts, doc.basis.text];
  const sayIt = (s) => out.push(s.plain, s.ledePlain);
  for (const s of doc.sections) {
    if (s.heading) out.push(typeof s.heading === "string" ? s.heading : "");
    if (s.said) sayIt(s.said);
    if (s.sub) out.push(s.sub);
    if (s.empty) out.push(s.empty);
    for (const r of s.rows || []) out.push(...["name", "target", "value", "year", "nat", "place", "dir", "word", "text"].map((k) => r[k]), r.status ? r.status.word : "");
    if (s.tell) out.push(s.tell.label, s.tell.name, s.tell.direction, s.tell.place, ...s.tell.marks.map((m) => `${m.label} ${m.value}`));
    for (const f of s.facts || []) out.push(...f);
    out.push(s.why || "", s.prepare ? `${s.prepare.head} ${s.prepare.text}` : "", s.note || "");
    for (const g of s.groups || []) out.push(g.names.join(" "), g.why);
    for (const l of s.lines || []) out.push(l.question, l.text);
  }
  out.push(doc.foot.sources, doc.foot.years, doc.foot.updated, doc.foot.statement);
  return out.filter(Boolean).join("\n");
}
