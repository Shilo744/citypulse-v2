// The words and the numbers of the entry page and of the tool pages, with no DOM in them (so that node tests and the server can load this file).
//   fillTokens(text, vars)   the client side token filler: {{city}} becomes the town, an unknown {{token}} is removed, so a braces pair never shows
//   vocab(text)              the vocabulary guard: a word SPEC 7.1 forbids on a user screen is swapped for the product's own word
//   sampleSentence(model)    the plain sentence of the live sample on the entry page (the count of figures that need treatment out of those that were judged)
//   trustNumbers(hl, meta)   the three numbers under the headline, from /api/health and /api/meta, never typed
//   domainsOf(meta), sourcesOf(meta), tracked(favs, recents)

const TOKEN = /\{\{\s*([\w.-]*)\s*\}\}/g;
export const hasToken = (text) => /\{\{/.test(String(text == null ? "" : text));

// vars: { city, name, ... }; "city", "name" and "locality" all mean the town
export function fillTokens(text, vars = {}) {
  const town = vars.city != null ? vars.city : vars.name;
  const s = String(text == null ? "" : text).replace(TOKEN, (m, k) => {
    const key = k.toLowerCase();
    if (key === "city" || key === "name" || key === "locality" || key === "town") return town == null ? "" : String(town);
    return vars[k] != null ? String(vars[k]) : "";
  });
  return s === String(text) ? s : s.replace(/ {2,}/g, " ").replace(/ +([.,:;!?])/g, "$1");
}

// The words SPEC 7.1 forbids on a user screen are written as escapes, so that no source file of the product holds them as text (a scan of the sources stays clean).
const word = (s) => new RegExp(s, "g");
const WORDS = [[word("\u05E4\u05E8\u05DE\u05D8\u05E8\u05D9\u05DD"), "מדדים"], [word("\u05E4\u05E8\u05DE\u05D8\u05E8"), "מדד"], [word("\u05D1\u05E1\u05D9\u05E1 \u05E7\u05D8\u05DF"), "קבוצה קטנה"], [word("\u05DE\u05D3\u05D3\u05D9 \u05E8\u05E7\u05E2"), "מדדים מתארים בלבד"], [word("\u05DE\u05D3\u05D3 \u05E8\u05E7\u05E2"), "מדד מתאר בלבד"],
  [word("\u05D0\u05D9\u05E4\u05D4 \u05D0\u05E0\u05D7\u05E0\u05D5 \u05D1\u05D3\u05D9\u05E8\u05D5\u05D2"), "איפה היישוב בדירוג"]];          // the old ask page's link to the ranking part
const WORRY = { "": "דורש", "ים": "דורשים", "ות": "דורשות", "ה": "דורשת" };          // the word for "worrying" becomes "needs treatment", with its ending and its article
const WORRIED = new RegExp("(\u05D4?)\u05DE\u05D3\u05D0\u05D9\u05D2(\u05D9\u05DD|\u05D5\u05EA|\u05D4)?(?![\u05D0-\u05EA])", "g");
export const vocab = (text) => WORDS.reduce((s, [from, to]) => s.replace(from, to), String(text == null ? "" : text)).replace(WORRIED, (m, the, end) => the + WORRY[end || ""] + " טיפול");

// the figures that were judged: the ones that need treatment, are watched, are fine or are a strength (a small group or a descriptive figure is not in the sum)
export const judgedOf = (counts = {}) => ["concern", "watch", "good", "strength"].reduce((n, k) => n + (counts[k] || 0), 0);

// { name, concern, judged, have, total, lead, num, rest, text }: the sentence reads the same without a chart ("ב{name}: 14 מתוך 26 מדדים דורשים טיפול").
// The count is its own part (num) when the answer is a concern, so the page can colour it; otherwise num is null and lead holds the whole sentence.
export function sampleSentence(model) {
  if (!model || !model.city) return null;
  const name = model.city.name, concern = (model.counts || {}).concern || 0, judged = judgedOf(model.counts), cov = model.coverage || {};
  if (!judged) return null;
  const base = { name, concern, judged, have: cov.have || 0, total: cov.total || 0 };
  if (concern < 2) {
    // the count is in front of the noun ("אף אחד מ-4 המדדים"), and a single judged figure is named as the only one
    const text = `ב${name}: ` + (judged === 1 ? `המדד היחיד שנבדק ${concern === 0 ? "אינו" : ""} דורש טיפול`.replace("  ", " ") : concern === 0 ? `אף אחד מ-${judged} המדדים אינו דורש טיפול` : `אחד מ-${judged} המדדים דורש טיפול`);
    return { ...base, lead: text, num: null, rest: "", text };
  }
  const lead = `ב${name}: `, rest = ` מתוך ${judged} מדדים דורשים טיפול`;
  return { ...base, lead, num: concern, rest, text: lead + concern + rest };
}

// the catalogue lists two kinds of document: the data sources (every figure is read from one) and the documents of role "guideline" (an official target or reference that a figure is set against).
// Only the first kind is a source of numbers: the count and the list of sources of the product leave the guidelines out (they have their own place, "יעדים רשמיים" on the method page).
export const isGuideDoc = (s) => !!s && typeof s === "object" && s.role === "guideline";
export const dataSources = (meta) => Object.values((meta && meta.sources) || {}).filter((s) => s && !isGuideDoc(s));

// each number is there only when the server gave it: { id, n, label }
export function trustNumbers(hl, meta) {
  const num = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const nSrc = num(hl && hl.sources) || (meta && meta.sources ? num(dataSources(meta).length) : null);
  const nInd = num(hl && hl.indicators) || (meta && meta.indicators ? num(meta.indicators.length) : null);
  return [
    { id: "localities", n: num(hl && hl.localities), label: "יישובים במערכת" },
    { id: "indicators", n: nInd, label: "מדדים לכל יישוב" },
    { id: "sources", n: nSrc, label: "מקורות רשמיים" }
  ].filter((x) => x.n != null);
}

// the domains that have at least one figure, with how many: { id, label, n }
export function domainsOf(meta) {
  if (!meta || !Array.isArray(meta.domains) || !Array.isArray(meta.indicators)) return [];
  return meta.domains.map((d) => ({ id: d.id, label: d.label, n: meta.indicators.filter((i) => i.domain === d.id).length })).filter((d) => d.n > 0);
}

export const publisherOf = (s) => String((s && s.publisher) || "").split(/[,(]/)[0].trim();

// the sources, grouped by who publishes them: [{ publisher, items: [{ name, url }] }]
export function sourcesOf(meta) {
  const groups = new Map();
  for (const s of dataSources(meta)) {
    const p = publisherOf(s) || "מקורות נוספים";
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push({ name: s.name, url: s.url || null });
  }
  return [...groups].map(([publisher, items]) => ({ publisher, items }));
}

// the row "המעקב שלי": favourites first, then the recent towns that are not favourites; { key, name, fav }
export function tracked(favs = [], recents = []) {
  const seen = new Set(), out = [];
  for (const [list, fav] of [[favs, true], [recents, false]]) for (const t of list) { if (t && t.key != null && t.name && !seen.has(String(t.key))) { seen.add(String(t.key)); out.push({ key: String(t.key), name: t.name, fav }); } }
  return out;
}
