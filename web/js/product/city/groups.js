// The categories of the product. The server groups the 41 figures by where the data comes from (nine "domains"); a mayor reads them by who runs what:
// children and parents, health and its services, mind and welfare, safety. regroup(model) returns the same model in those categories: model.domains, and the
// domain of every indicator, finding and recommendation. It is applied once, where the model enters the product (net.js) and where the old page modules read it
// (the fetch guard), so every screen speaks the same categories. Pure: no DOM, no network.
//
// A category takes the id of its main old domain, so the icons and colours that the old modules keep per domain id still find an entry.
// "context" is the background of the town (who lives there, poverty, environment): it is a line at the top of the page, not a category of the menu.
//
// WHICH ENDPOINTS CARRY DOMAINS (audit of server.js and src/api.js, every one the product or the old modules read), and what is done at the boundary (net.js):
//   GET /api/city/<key>                      regroup()        net.city() and the guard
//   GET /api/meta                            regroupMeta()    net.meta() and the guard (the catalogue: domains and the domain of each indicator)
//   GET /api/city/<key>/indicator/<id>       regroupDetail()  net.indicator() and the guard (analysis, indicator, findings and recommendations of one figure)
//   POST /api/ask                            regroupAnswer()  the guard only (the old ask page posts; the answer names domains in its blocks and in its sentences)
//   GET /api/compare, /api/geo, /api/search, /api/health   nothing: rows carry id, label, unit and values, no domain (checked in src/api.js compare(), geo(), search)
//   GET /api/city/<key>/export.csv           not JSON and never read by a page: a link that downloads the server's file. Its "תחום" column still holds the nine
//                                            old labels (src/lib/export.js): that is the server's, reported in design-ideas/product/NEEDS/m1.md
//   GET/POST /api/city/<key>/briefing        the server's text (cached or written by the model from the old labels): not read here, reported in NEEDS/m1.md
//   /api/feedback, /api/llm, share           no domains
// The texts that the server wrote from the old labels sit in the model: the findings "domain_weak" and "domain_declining", the generic recommendation
// "domain_review" that rests on them, and the headline of model.summary ("the weakest domain is ..."). regroup() writes them again for the categories, with the
// same rules and the same words, so that no sentence names a domain that the reader never sees.

export const GROUPS = [
  { id: "child", label: "ילדים והורים", from: ["immunization", "child", "nutrition"],
    blurb: "חיסונים, מעקב התפתחות, הנקה ומשקל בבית הספר: מה שקורה לילדים מהלידה ועד כיתה ז׳." },
  { id: "outcomes", label: "בריאות ושירותי בריאות", from: ["outcomes", "access"],
    blurb: "תוחלת חיים, תמותה וסוכרת, ולצדן הנגישות לרופאים וזמני ההמתנה." },
  { id: "mental", label: "נפש ורווחה", from: ["mental", "welfare"],
    blurb: "בריאות הנפש, דיכאון ובדידות, ושירותי הרווחה: כמה מקבלים שירות, וכמה מהם בגלל אלימות או הזנחה." },
  { id: "safety", label: "בטיחות", from: ["safety"],
    blurb: "תאונות דרכים ופגיעה בהולכי רגל, ופציעות של ילדים." },
  { id: "context", label: "רקע על היישוב", from: ["context", "env"], background: true,
    blurb: "מי גר כאן: אוכלוסייה, עוני וסביבה. הרקע שבלעדיו אי אפשר לפרש מספר אחר." }
];
export const BACKGROUND_ID = "context";
// an indicator that belongs to another category than its old domain: the first visit of a newborn at the family health clinic is about children, not about access
export const MOVES = { th_firstvisit: { to: "child", from: "access" } };

// ── the topics inside a category (the category page shows its figures as closed groups that open, one group per topic) ──
// A city official recognises these as the things that are run side by side: vaccines, the family health clinic, feeding of babies, weight at school, and so on.
// Every figure of the catalogue is in exactly one topic and a topic never mixes categories (tests/product-groups.test.mjs checks both against the whole catalogue).
// The order of this list is the tie-break of the page order and the order of the figures inside a topic.
export const TOPICS = [
  { id: "vaccines", category: "child", label: "חיסונים", ids: ["th_mmrv", "th_penta", "th_pertussis"] },
  { id: "clinic", category: "child", label: "מעקב והדרכה בטיפת חלב", ids: ["th_firstvisit", "th_headcirc", "th_devtests6", "th_language", "th_safesleep"] },
  { id: "feeding", category: "child", label: "הנקה ותזונת תינוקות", ids: ["th_bf_exclusive", "th_bf_keep", "th_iron"] },
  { id: "school-weight", category: "child", label: "משקל עודף בבית הספר", ids: ["bmi_g1_over", "bmi_g7_over"] },
  { id: "results", category: "outcomes", label: "תוצאות בריאות", ids: ["life_expectancy", "mortality_std", "infant_mortality", "diabetes_std"] },
  { id: "doctors", category: "outcomes", label: "זמינות רופאים ותורים", ids: ["family_doctors_10k", "pediatricians_10k", "wait_specialist_days", "wait_gyn_days"] },
  { id: "mind", category: "mental", label: "בריאות הנפש", ids: ["th_ppd", "depressed_20", "lonely_20", "mental_points_10k"] },
  { id: "welfare", category: "mental", label: "רווחה ואלימות", ids: ["swd_recipients_1000", "swd_children_1000", "swd_violence_1000", "th_violence"] },
  { id: "roads", category: "safety", label: "תאונות דרכים", ids: ["road_severe_100k", "road_pedestrian_100k"] },
  { id: "child-injury", category: "safety", label: "פגיעות ילדים", ids: ["child_injury_ed_1000", "child_injury_hosp_1000"] },
  { id: "population", category: "context", label: "אוכלוסייה", ids: ["pop_size", "pop_growth", "ses_index"] },
  { id: "poverty", category: "context", label: "עוני", ids: ["pov_persons", "pov_children", "pov_elderly"] },
  { id: "environment", category: "context", label: "סביבה", ids: ["green_satisfaction", "noise_bother"] }
];
export const TOPIC_OF = Object.fromEntries(TOPICS.flatMap((t) => t.ids.map((id) => [id, t.id])));          // figure id -> topic id
export const topicsOfCategory = (categoryId) => TOPICS.filter((t) => t.category === categoryId);

// how one figure counts in a topic: the same rule as the ring of the category page (a figure on a small group is never a verdict, whatever its status says)
const effOf = (a) => (a && a.last && a.last.reliable === false ? "uncertain" : a && a.status);
// the counts of a list of figures, in the words of the ring: concern, watch, fine (good and strength) and the rest, which is not judged (small group, old figure, describes only)
export function topicCounts(figs) {
  const c = { concern: 0, watch: 0, fine: 0, small: 0, stale: 0, bg: 0 };
  for (const a of figs) {
    const s = effOf(a);
    if (s === "concern") c.concern++; else if (s === "watch") c.watch++; else if (s === "good" || s === "strength") c.fine++; else if (s === "uncertain") c.small++; else if (s === "stale") c.stale++; else c.bg++;
  }
  return { ...c, judged: c.concern + c.watch + c.fine, unjudged: c.small + c.stale + c.bg, total: figs.length };
}
// the one sentence of a closed topic, as segments (a string, or { n, tone } for a number that the screen sets apart): how many of the judged figures need treatment, then what
// is for follow-up, then what is not judged. A topic where nothing is judged says why and that the numbers are shown as they are.
export function topicSay(c) {
  const n = (v, tone) => ({ n: String(v), tone });
  if (!c.total) return [];
  if (!c.judged) {
    if (c.small === c.total) return [c.total === 1 ? "קבוצה קטנה" : "קבוצות קטנות", ": המספרים מוצגים כמות שהם"];
    if (c.stale === c.total) return [c.total === 1 ? "הנתון ישן, ולכן בלי שיפוט" : "הנתונים ישנים, ולכן בלי שיפוט"];
    if (c.bg === c.total) return [c.total === 1 ? "מתאר את היישוב, בלי שיפוט" : "מתארים את היישוב, בלי שיפוט"];
    return ["אין מדד שאפשר לשפוט: המספרים מוצגים כמות שהם"];
  }
  const { concern: k, judged: m } = c, out = [];
  if (!k) out.push("אין מדד שדורש טיפול");
  else if (m === 1) out.push("המדד היחיד שנבדק דורש טיפול");
  else if (k === m) out.push("כל ", n(m, "attn"), " דורשים טיפול");
  else if (k === 1) out.push("אחד מתוך ", n(m), " דורש טיפול");
  else out.push(n(k, "attn"), " מתוך ", n(m), " דורשים טיפול");
  if (c.watch) out.push(c.watch === 1 ? ", אחד למעקב" : [", ", n(c.watch), " למעקב"]);
  if (c.unjudged) out.push(c.unjudged === 1 ? ", אחד ללא שיפוט" : [", ", n(c.unjudged), " ללא שיפוט"]);
  return out.flat();
}
export const sayText = (say) => say.map((s) => (typeof s === "string" ? s : s.n)).join("");

// the topics of one category for one town, in the order of the page: the topic with the larger share of judged figures that need treatment first, then the weaker average place
// among the localities (a small group has no place and is never averaged), then the order of TOPICS. A topic with no figure measured for the town is left out.
// `shown` are the figures the page draws (default: the category's figures that have a value); `rest` are figures that no topic holds (none, while the table is complete).
export function topicsFor(model, categoryId, shown) {
  const figs = shown || model.indicators.filter((a) => a.domain === categoryId && a.last), byId = new Map(figs.map((a) => [a.id, a]));
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  const topics = topicsOfCategory(categoryId).map((t, order) => {
    const list = t.ids.map((id) => byId.get(id)).filter(Boolean), counts = topicCounts(list);
    const placed = list.filter((a) => a.direction && !a.stale && effOf(a) !== "uncertain" && ["concern", "watch", "good", "strength"].includes(a.status) && isNum(a.last && a.last.level));
    const standing = placed.length ? placed.reduce((s, a) => s + a.last.level, 0) / placed.length : null;
    return { id: t.id, label: t.label, ids: list.map((a) => a.id), figures: list, counts, standing, order, say: topicSay(counts) };
  }).filter((t) => t.figures.length);
  const share = (t) => (t.counts.judged ? t.counts.concern / t.counts.judged : -1);
  topics.sort((x, y) => share(y) - share(x) || (isNum(x.standing) ? x.standing : 1000) - (isNum(y.standing) ? y.standing : 1000) || y.counts.concern - x.counts.concern || x.order - y.order);
  return { topics, rest: figs.filter((a) => !TOPIC_OF[a.id]) };
}

export const OLD_TO_GROUP = Object.fromEntries(GROUPS.flatMap((g) => g.from.map((id) => [id, g.id])));
export const groupIdOf = (oldDomainId, indicatorId) => (MOVES[indicatorId] ? MOVES[indicatorId].to : OLD_TO_GROUP[oldDomainId] || oldDomainId);
export const groupById = (id) => GROUPS.find((g) => g.id === id) || null;
export const isBackground = (id) => id === BACKGROUND_ID;
// the old domain ids that now live inside a category: an old link #/c/<key>/d/immunization lands on d/child
export const categoryOfOldDomain = (id) => OLD_TO_GROUP[id] || null;

const COUNT_KEYS = ["strength", "good", "watch", "concern", "uncertain", "stale"];
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const I = (x) => "⁦" + x + "⁩";                 // the isolate marks that the server puts around a number inside Hebrew text (src/lib/format.js)

// ── the sentences that the server wrote about a whole domain, written again for a category (same rules as src/model/findings.js domainFindings) ──
function categoryFindings(indicators) {
  const out = [];
  for (const g of GROUPS) {
    const list = indicators.filter((a) => a.domain === g.id && a.direction && a.last && a.last.reliable);
    if (list.length < 3) continue;
    const bad = list.filter((a) => a.status === "concern" || a.status === "watch");
    const worsening = list.filter((a) => a.history && a.history.trendClass === "worsening");
    if (bad.length >= 3 && bad.length / list.length >= 0.6)
      out.push({ id: `${g.id}:domain_weak`, type: "domain_weak", polarity: "concern", indicator: null, domain: g.id, severity: Math.min(85, 40 + bad.length * 8),
        facts: { count: bad.length, of: list.length, ids: bad.map((a) => a.id) },
        text: `${g.label}: ${I(bad.length)} מתוך ${I(list.length)} המדדים בתחום דורשים טיפול או מעקב. דפוס כזה מצביע על בעיה במערך השירות ולא רק על מדד בודד.` });
    if (worsening.length >= 3)
      out.push({ id: `${g.id}:domain_declining`, type: "domain_declining", polarity: "concern", indicator: null, domain: g.id, severity: Math.min(90, 45 + worsening.length * 9),
        facts: { count: worsening.length, of: list.length, ids: worsening.map((a) => a.id) },
        text: `${g.label}: ${I(worsening.length)} מדדים בתחום בהידרדרות לאורך השנים. הירידה רחבה, לא נקודתית.` });
  }
  return out;
}
const isDomainFinding = (f) => !!f && (f.type === "domain_weak" || f.type === "domain_declining");
const MAX_REVIEWS = 2;                                    // the server's own cap (REC_RULES.maxReviews): a general review never fills the plan

// the generic "review the service of domain X" recommendation: one per category, built on the category's own findings, with the words of the old one
function reviewRecs(old, findings, labelOf) {
  const byCat = new Map();
  for (const r of old) { const c = groupIdOf(r.domain); byCat.set(c, [...(byCat.get(c) || []), r]); }
  const out = [];
  for (const [cat, list] of byCat) {
    const fs = findings.filter((f) => isDomainFinding(f) && f.domain === cat);
    if (!fs.length) continue;                              // the pattern that the review rests on is not there in the category: no review
    const tpl = list.slice().sort((x, y) => (y.score || 0) - (x.score || 0))[0], g = groupById(cat);
    const say = (t) => (typeof t === "string" ? list.reduce((s, r) => (labelOf[r.domain] ? s.split(labelOf[r.domain]).join(g ? g.label : cat) : s), t) : t);
    out.push({ ...tpl, id: "rec:" + tpl.intervention + ":" + cat, domainOld: tpl.domain, domain: cat, title: say(tpl.title), summary: say(tpl.summary),
      indicators: [...new Set(fs.flatMap((f) => (f.facts && f.facts.ids) || []))], score: Math.max(...list.map((r) => r.score || 0)),
      why: fs.slice(0, 4).map((f) => ({ findingId: f.id, text: f.text, indicator: f.indicator, type: f.type, polarity: f.polarity })) });
  }
  return out.sort((x, y) => y.score - x.score || String(x.id).localeCompare(String(y.id))).slice(0, MAX_REVIEWS);
}

// the same model with the categories instead of the nine domains; idempotent; anything that is not a model is returned as it came
export function regroup(model) {
  if (!model || model.grouped || !Array.isArray(model.indicators) || !Array.isArray(model.domains)) return model;
  const oldDomains = new Map(model.domains.map((d) => [d.id, d]));
  const labelOf = Object.fromEntries(model.domains.map((d) => [d.id, d.label]));
  const indicators = model.indicators.map((a) => ({ ...a, domainOld: a.domain, domain: groupIdOf(a.domain, a.id) }));
  const shift = {};                                                     // how many figures of the catalogue moved into or out of each category
  for (const m of Object.values(MOVES)) {
    const fromG = OLD_TO_GROUP[m.from];
    if (fromG && fromG !== m.to) { shift[fromG] = (shift[fromG] || 0) - 1; shift[m.to] = (shift[m.to] || 0) + 1; }
  }
  const domains = GROUPS.map((g) => {
    const list = indicators.filter((a) => a.domain === g.id);
    const members = g.from.map((id) => oldDomains.get(id)).filter(Boolean);
    const judged = list.filter((a) => a.direction && a.last && typeof a.last.level === "number" && !a.stale);
    const counts = Object.fromEntries(COUNT_KEYS.map((k) => [k, list.filter((a) => a.status === k).length]));
    const available = members.reduce((n, d) => n + (d.available || 0), 0) + (shift[g.id] || 0);
    return {
      id: g.id, label: g.label, blurb: g.blurb, indicators: list.map((a) => a.id), counts,
      standing: judged.length ? Math.round(mean(judged.map((a) => a.last.level))) : null,           // average place among localities, 0-100 (100 = best): the server's own rule
      available, ...(g.background ? { background: true } : {})
    };
  }).filter((d) => d.available > 0 || d.indicators.length);
  const byInd = new Map(indicators.map((a) => [a.id, a]));
  let findings = model.findings;
  if (Array.isArray(findings)) {
    findings = findings.filter((f) => !isDomainFinding(f)).map((f) => ({ ...f, domainOld: f.domain, domain: byInd.has(f.indicator) ? byInd.get(f.indicator).domain : groupIdOf(f.domain) }));
    findings = findings.concat(categoryFindings(indicators)).sort((x, y) => (y.severity || 0) - (x.severity || 0));
  }
  let recommendations = model.recommendations;
  if (Array.isArray(recommendations)) {
    const isReview = (r) => !!r && r.intervention === "domain_review";
    const domainOf = (r) => { const lead = byInd.get((r.indicators || [])[0]); return lead && lead.domainOld === r.domain ? lead.domain : groupIdOf(r.domain); };          // led by a moved figure: its category
    recommendations = recommendations.filter((r) => !isReview(r)).map((r) => ({ ...r, domainOld: r.domain, domain: domainOf(r) }))
      .concat(reviewRecs(recommendations.filter(isReview), findings || [], labelOf)).sort((x, y) => (y.score || 0) - (x.score || 0) || String(x.id).localeCompare(String(y.id)));
  }
  let summary = model.summary;
  if (summary && typeof summary.headline === "string") {
    const weak = domains.filter((d) => !d.background && typeof d.standing === "number").sort((a, b) => a.standing - b.standing)[0];
    const m = /^(.*והתחום החלש ביותר הוא )(.+)\.$/.exec(summary.headline);
    if (m && weak && Object.values(labelOf).includes(m[2])) summary = { ...summary, headline: `${m[1]}${weak.label}.` };
  }
  return { ...model, indicators, domains, findings, recommendations, summary, domainsOld: model.domains, grouped: true };
}

// the catalogue (GET /api/meta): the domains become the categories (the background one flagged), every indicator takes its category and keeps its old one;
// a domain that no figure belongs to (the server lists "capacity" with none) is left out; idempotent; anything that is not a catalogue is returned as it came
export function regroupMeta(meta) {
  if (!isObj(meta) || meta.grouped || !Array.isArray(meta.domains) || !Array.isArray(meta.indicators) || !meta.indicators.some(isObj)) return meta;          // no figure to group: not a catalogue
  const indicators = meta.indicators.map((i) => (isObj(i) ? { ...i, domainOld: i.domain, domain: groupIdOf(i.domain, i.id) } : i));
  const has = (id) => indicators.some((i) => isObj(i) && i.domain === id);
  const cats = GROUPS.filter((g) => has(g.id)).map((g) => ({ id: g.id, label: g.label, blurb: g.blurb, ...(g.background ? { background: true } : {}) }));
  const others = meta.domains.filter((d) => isObj(d) && !OLD_TO_GROUP[d.id] && !groupById(d.id) && has(d.id));          // a domain this module does not know stays as the server says it
  return { ...meta, domains: [...cats, ...others], indicators, domainsOld: meta.domains, grouped: true };
}

// the catalogue as the OLD page modules read it (the guard in net.js): the documents of role "guideline" (the official targets) are left out of `sources`, because the old method page counts and lists
// every entry there as a dataset that feeds figures ("18 מקורות", "אין מדד"). The product reads the whole catalogue (net.meta) and says the guidelines in their own place (method page, "יעדים רשמיים").
export function dataOnlyMeta(meta) {
  if (!isObj(meta) || !isObj(meta.sources) || !Object.values(meta.sources).some((s) => isObj(s) && s.role === "guideline")) return meta;
  return { ...meta, sources: Object.fromEntries(Object.entries(meta.sources).filter(([, s]) => !(isObj(s) && s.role === "guideline"))) };
}

// one figure of one town (GET /api/city/<key>/indicator/<id>): the categories on the figure, its findings and its recommendations. The generic review of a whole
// domain is left out here: it rests on the other figures of the domain, which this answer does not hold (the plan page shows it in its category)
export function regroupDetail(d) {
  if (!isObj(d) || d.grouped || !isObj(d.analysis)) return d;
  const a = d.analysis, cat = groupIdOf(a.domain, a.id);
  const leadOf = (r) => (r.indicators && r.indicators[0] === a.id && r.domain === a.domain ? cat : groupIdOf(r.domain));
  return { ...d, analysis: { ...a, domainOld: a.domain, domain: cat },
    indicator: isObj(d.indicator) ? { ...d.indicator, domainOld: d.indicator.domain, domain: cat } : d.indicator,
    findings: Array.isArray(d.findings) ? d.findings.filter((f) => !isDomainFinding(f)).map((f) => ({ ...f, domainOld: f.domain, domain: cat })) : d.findings,
    recommendations: Array.isArray(d.recommendations) ? d.recommendations.filter((r) => !(r && r.intervention === "domain_review")).map((r) => ({ ...r, domainOld: r.domain, domain: leadOf(r) })) : d.recommendations,
    grouped: true };
}

// ── words: the old labels inside a sentence of the server or of the model (the ask page) ──
// The long labels are replaced wherever they stand; "חיסונים" only after the word "תחום" (it is also an ordinary word)
const OLD_WORDS = [["הקשר ודמוגרפיה", "context"], ["מצב הבריאות ותוחלת החיים", "outcomes"], ["בריאות הילד וההתפתחות", "child"], ["תזונה והנקה", "child"],
  ["רווחה ואלימות", "mental"], ["נגישות לשירותים", "outcomes"], ["בטיחות ופציעות", "safety"]];
export function rewriteWords(text) {
  if (typeof text !== "string" || !text) return text;
  let s = text;
  for (const [old, id] of OLD_WORDS) if (s.includes(old)) s = s.split(old).join(groupById(id).label);
  return s.replace(/(תחום |בתחום )(ה)?חיסונים/g, (m, p, def) => p + (def ? "ה" : "") + "ילדים והורים");
}

// the answer of the ask page (POST /api/ask): the figures carry their category, the findings and recommendations that speak of a whole old domain are left out,
// and the old labels inside the sentences are written as the categories
export function regroupAnswer(ans) {
  if (!isObj(ans) || ans.grouped) return ans;
  const say = (v) => (Array.isArray(v) ? v.map(say) : rewriteWords(v));
  const ind = (i) => (isObj(i) && i.domain ? { ...i, domainOld: i.domain, domain: groupIdOf(i.domain, i.id) } : i);
  const blocks = Array.isArray(ans.blocks) ? ans.blocks.map((b) => {
    if (!isObj(b)) return b;
    if (b.type === "findings" && Array.isArray(b.items)) { const items = b.items.filter((f) => !isDomainFinding(f)); return items.length ? { ...b, items } : null; }
    if (b.type === "recs" && Array.isArray(b.items)) {
      const items = b.items.filter((r) => !(r && /^rec:domain_review/.test(String(r.id)))).map((r) => ({ ...r, title: say(r.title), summary: say(r.summary), why: Array.isArray(r.why) ? r.why.filter((w) => !isDomainFinding(w)) : r.why }));
      return items.length ? { ...b, items } : null;
    }
    if (b.type === "text") return { ...b, text: say(b.text), heading: say(b.heading) };
    if (Array.isArray(b.items)) return { ...b, items: b.items.map((it) => (isObj(it) && it.ind ? { ...it, ind: ind(it.ind) } : it)) };
    if (b.ind) return { ...b, ind: ind(b.ind) };
    if (Array.isArray(b.rows)) return { ...b, rows: b.rows.map(ind) };
    return b;
  }).filter((b) => b !== null) : ans.blocks;
  return { ...ans, title: say(ans.title), subtitle: say(ans.subtitle), answer: say(ans.answer), followups: say(ans.followups), blocks, grouped: true };
}
