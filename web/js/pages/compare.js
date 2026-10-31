// Compare a locality with up to five others (DESIGN_V3.md): a hero that says where the locality stands among them, who is in the comparison, how many figures
// need attention in every domain for each of them, where they are on the map, and then every figure on one shared axis, domain by domain.
// A small group takes no place in the order (hollow dot, no rank). The view layer only: every number comes from /api/compare and the city models
// (css/pages/compare.css and trends.css, prefix .tr-).
import { h, svg, icon, num, fmtVal, unitSuffix, ltr, outOf, DOMAIN_ICON, directionNote, directionIcon, toast, tip, tipHead, tipRow } from "../ui.js";
import { seriesTable, viewToggle } from "../charts.js";
import { searchBox } from "../components.js";
import { getCompare, getCity, getIndicator, getGeo } from "../api.js";
import { viz, fit, clear, niceTicks, padExtent } from "../viz/core.js";
import { compareHeat } from "../viz/matrix.js";
import { dotMap } from "../viz/spatial.js";
import { ledger } from "./trends.js";

const MAX_OTHERS = 5;
const N = (n) => ltr(String(n));
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const hrefI = (key, id) => `#/c/${key}/i/${id}`;
const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const valText = (unit, v) => fmtVal(unit, v) + (unit !== "%" && unitSuffix(unit) ? " " + unitSuffix(unit) : "");

// ── who is ahead of whom: pure functions ─────────────────────────────────
export const isBetter = (direction, a, b) => (direction === "lower" ? a < b : a > b);
// the place of cells[i] among the localities of one figure. Only groups big enough to count take a place (a small group has none and gives none);
// without at least one other big group there is nothing to rank against
export function standing(cells, i, direction) {
  const me = cells[i];
  if (!me || me.reliable === false || !isNum(me.v)) return null;
  const rest = cells.filter((c, k) => k !== i && c && c.reliable !== false && isNum(c.v));
  if (!rest.length) return null;
  return { rank: 1 + rest.filter((o) => isBetter(direction, o.v, me.v)).length, of: rest.length + 1 };
}
// first / middle / last among the localities that count
export const bucketOf = (st) => (!st ? null : st.rank === 1 ? "first" : st.rank === st.of ? "last" : "mid");

// ── the strip: where every locality sits on one shared axis, better to the right ──
// dots that would touch are lifted onto lanes above and below the axis (the city keeps the axis itself)
const R_ME = 10, R_PK = 9, LANE = 21, PAD = 16, TOP = 6, TICKS = 20;
export function stripLayout({ pts, nat, unit, direction, width }) {
  const vals = pts.map((p) => p.v);
  if (isNum(nat)) vals.push(nat);
  if (!vals.length) return null;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length, lowest = Math.min(...vals);
  const [lo, hi] = padExtent(vals, 0.1, { min: unit === "%" || lowest >= 0 ? 0 : -Infinity, max: unit === "%" ? 100 : Infinity, minSpan: Math.max(Math.abs(mean) * 0.1, unit === "%" ? 4 : 0.5) });
  const W = Math.max(40, width - 2 * PAD), X = (v) => PAD + (direction === "lower" ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo)) * W;
  const items = pts.map((p) => ({ ...p, x: X(p.v), r: p.i === 0 ? R_ME : R_PK })).sort((a, b) => (a.i === 0 ? -1 : b.i === 0 ? 1 : a.x - b.x)), seq = [0, -1, 1, -2, 2], placed = [];
  for (const p of items) {
    const lane = seq.find((L) => !placed.some((q) => q.lane === L && Math.abs(q.x - p.x) < q.r + p.r + 1));
    p.lane = lane == null ? 0 : lane;
    placed.push(p);
  }
  const up = Math.max(0, ...items.map((p) => -p.lane)), down = Math.max(0, ...items.map((p) => p.lane));
  const cy = TOP + up * LANE + R_ME, bottom = cy + down * LANE + R_ME;
  items.forEach((p) => { p.y = cy + p.lane * LANE; });
  const t = niceTicks(lo, hi, 3).filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9), step = t.length > 1 ? Math.abs(t[1] - t[0]) : 1;
  const ticks = t.map((v) => ({ v, x: X(v), text: fmtVal(unit, v, step < 1 ? 1 : 0) }));
  return { H: bottom + TICKS, cy, items, ticks, natX: isNum(nat) ? X(nat) : null, natY1: cy - up * LANE - R_ME - 3, natY2: bottom + 3, x0: PAD, x1: PAD + W };
}

function strip(r, cells, dir, names, marks, ranks, animate) {
  const unit = r.unit, nat = r.nat && isNum(r.nat.v) ? r.nat.v : null;
  const pts = cells.map((c, i) => (c && isNum(c.v) ? { i, v: c.v, d: c.d, year: c.year, hollow: c.reliable === false } : null)).filter(Boolean);
  const order = pts.slice().sort((a, b) => (isBetter(dir, a.v, b.v) ? -1 : isBetter(dir, b.v, a.v) ? 1 : 0));
  const say = (p) => `${names[p.i]} ${valText(unit, p.v)}` + (ranks[p.i] ? ` (מקום ${ranks[p.i].rank} מתוך ${ranks[p.i].of})` : p.hollow ? " (קבוצה קטנה, לא מדורג)" : "");
  const label = `${r.label}: ${order.map(say).join(", ")}${nat != null ? `. ממוצע ארצי ${valText(unit, nat)}` : ""}. ${directionNote(dir)}`;
  const host = h("div.tr-strip", { tabindex: "0" });
  viz(host, { label });
  const dotTip = (p) => [tipHead(names[p.i]), tipRow(p.i === 0 ? "var(--c-city)" : "var(--c-peer)", "ערך", valText(unit, p.v)),
    ranks[p.i] ? tipRow(null, "מקום", `${ranks[p.i].rank} מתוך ${ranks[p.i].of}`) : h("div.tr.note", h("span.k", p.hollow ? "קבוצה קטנה, לא מדורגת" : "אין עם מי להשוות")),
    p.d != null ? tipRow(null, "גודל הקבוצה", num(p.d, 0)) : null, p.year != null ? tipRow(null, "שנה", String(p.year)) : null].filter(Boolean);
  const allTip = () => [tipHead(r.label), ...order.map((p) => tipRow(p.i === 0 ? "var(--c-city)" : "var(--c-peer)", names[p.i] + (ranks[p.i] ? "" : " (לא מדורג)"), valText(unit, p.v))), nat != null ? tipRow("var(--c-nat)", "ממוצע ארצי", valText(unit, nat)) : null].filter(Boolean);
  host.addEventListener("focus", () => { const b = host.getBoundingClientRect(); tip.show(allTip(), { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }); });
  host.addEventListener("blur", () => tip.hide());
  fit(host, (w) => {
    const L = stripLayout({ pts, nat, unit, direction: dir, width: w });
    clear(host);
    if (!L) { host.append(h("span.tr-strip-none", "אין נתון")); return; }
    const root = svg("svg", { width: w, height: L.H, viewBox: `0 0 ${w} ${L.H}`, "aria-hidden": "true" });
    const fd = animate ? " fade" : "";
    root.append(svg("line", { class: "tr-ax" + fd, x1: L.x0, x2: L.x1, y1: L.cy, y2: L.cy }));
    L.ticks.forEach((t) => root.append(svg("line", { class: "tr-tk" + fd, x1: t.x, x2: t.x, y1: L.cy - 4, y2: L.cy + 4 })));
    root.append(svg("text", { class: "tr-tt" + fd, x: L.x0, y: L.H - 3, "text-anchor": "start" }, "חלש"), svg("text", { class: "tr-tt is-good" + fd, x: L.x1, y: L.H - 3, "text-anchor": "end" }, "טוב"));          // the ends of the axis, in words: the same on every row, whichever way the numbers run
    if (L.natX != null) {
      const g = svg("g", { class: animate ? "fade" : "" }, svg("line", { class: "tr-nat", x1: L.natX, x2: L.natX, y1: L.natY1, y2: L.natY2 }), svg("line", { class: "tr-nat-hit", x1: L.natX, x2: L.natX, y1: L.natY1, y2: L.natY2 }));
      const hit = g.lastChild;
      ["pointermove", "pointerdown"].forEach((e) => hit.addEventListener(e, (ev) => tip.show([tipHead("ממוצע ארצי"), tipRow("var(--c-nat)", "ערך", valText(unit, nat))], ev)));
      hit.addEventListener("pointerleave", () => tip.hide());
      root.append(g);
    }
    L.items.slice().reverse().forEach((p, k) => {                                // the others first, the city last: on top
      const g = svg("g", { class: "tr-pt" + (animate ? " pop" : "") + (p.i === 0 ? " is-me" : "") + (p.hollow ? " is-hollow" : ""), style: `--i:${Math.min(k, 6)}` },
        svg("circle", { class: "tr-hit", cx: p.x, cy: p.y, r: p.r + 6 }), svg("circle", { class: "tr-c", cx: p.x, cy: p.y, r: p.r }),
        p.i === 0 ? null : svg("text", { class: "tr-dg", x: p.x, y: p.y, dy: ".36em", "text-anchor": "middle" }, String(marks[p.i])));
      ["pointermove", "pointerdown"].forEach((e) => g.addEventListener(e, (ev) => { host.classList.add("is-hot"); root.querySelectorAll(".tr-pt.on").forEach((x) => x.classList.remove("on")); g.classList.add("on"); tip.show(dotTip(p), ev); }));
      g.addEventListener("pointerleave", () => { host.classList.remove("is-hot"); g.classList.remove("on"); tip.hide(); });
      root.append(g);
    });
    host.append(root);
  }, { min: 160 });
  return host;
}

// ── small pieces ──────────────────────────────────────────────────────────
const mk = (i, hollow) => h("i.tr-mk" + (i === 0 ? ".is-me" : "") + (hollow ? ".is-hollow" : ""), i === 0 ? null : String(i));
function secHead(no, eyebrow, title, lead, extra) {
  return h("div.sec-head.rv", h("div", h("div.sec-eyebrow", no ? h("b", no) : null, eyebrow), h("h2.sec-title", title), lead ? h("p.sec-lead", lead) : null), extra || null);
}
const inN = (n) => (n === 1 ? "במדד אחד" : ["ב-", N(n), " מדדים"]);

// the decoration of the hero: three shared axes with a few dots, drawn quietly
function decor() {
  const row = (y, xs, me) => [svg("line", { class: "tr-d-ax", x1: 20, x2: 780, y1: y, y2: y }), ...xs.map((x, k) => svg("circle", { class: "pop tr-d-dot" + (k === me ? " is-me" : ""), style: `--i:${k}`, cx: x, cy: y, r: k === me ? 9 : 7 }))];
  return viz(h("div.tr-fan.is-dots", { "aria-hidden": "true" }, svg("svg", { viewBox: "0 0 800 160", preserveAspectRatio: "xMidYMid meet" }, ...row(34, [120, 250, 340, 560, 690], 0), ...row(80, [90, 300, 400, 520, 720], 1), ...row(126, [180, 240, 470, 600, 700], 2))));
}

// ── the page ──────────────────────────────────────────────────────────────
export async function compareView(model, params) {
  const key = model.city.key, c = model.city, root = h("div.tr-page");
  const ids = model.indicators.filter((a) => !a.stale && a.direction).map((a) => a.id);
  const heroTop = (verdict, extra) => h("div.tr-hero-top", h("div.eyebrow.rv", c.name), h("h1.rv", { id: "tr-h1" }, "השוואה ליישובים"), h("p.hero-verdict.rv", verdict), extra || null);
  if (!ids.length) {
    root.append(h("section.hero.tr-hero.tr-calm", { "aria-labelledby": "tr-h1" }, heroTop("אין מדדים להשוואה ליישוב הזה.", h("p.tr-hero-note.rv", "ההשוואה נעשית רק במדדים שיש להם כיוון של טוב ורע.")),
      h("div.hero-actions.rv", h("a.btn.primary", { href: `#/c/${key}` }, icon("grid"), "חזרה לתמונת המצב"))));
    return root;
  }
  const asked = params.has("with") ? params.get("with").split(",").filter(Boolean) : model.peers.slice(0, MAX_OTHERS).map((p) => p.key);
  const wanted = [...new Set(asked.filter((k) => k !== key))].slice(0, MAX_OTHERS);
  const go = (ks) => { location.hash = `#/c/${encodeURIComponent(key)}/compare?with=${ks.map(encodeURIComponent).join(",")}`; };

  // the map offers the figures of the first domain that has some; everything the page needs is fetched together, so that it appears whole
  const hasData = (a) => a.last && a.last.reliable !== false;
  const dom = model.domains.find((d) => model.indicators.some((a) => a.domain === d.id && ids.includes(a.id) && hasData(a))) || model.domains.find((d) => model.indicators.some((a) => a.domain === d.id && ids.includes(a.id)));
  const figsOf = (d) => model.indicators.filter((a) => a.domain === d.id && ids.includes(a.id));
  const mapDoms = model.domains.map((d) => ({ d, figs: figsOf(d).filter(hasData) })).filter((x) => x.figs.length);          // every domain that has a figure to draw
  const tabs = dom ? figsOf(dom).slice(0, 10) : [];
  const pData = getCompare([key, ...wanted], ids);
  const pModels = Promise.allSettled([key, ...wanted].map((k) => (k === key ? Promise.resolve(model) : getCity(k))));
  const pMap = wanted.length && tabs.length ? Promise.allSettled([getIndicator(key, tabs[0].id), getGeo()]) : null;
  const data = await pData, models = await pModels, first = pMap ? await pMap : null;

  // the localities of the comparison: a key the sources do not know has no figure at all, and is left out
  const all = data.cities.map((x, i) => ({ key: x.key, name: x.name, i, ok: i === 0 || data.rows.some((r) => r.cells[i]) }));
  const others = all.filter((x) => x.i > 0 && x.ok), dropped = all.filter((x) => x.i > 0 && !x.ok);
  const names = all.map((x) => x.name), marks = {};
  others.forEach((x, k) => { marks[x.i] = k + 1; });
  const withKeys = others.map((x) => x.key);
  const addCity = (k) => {
    if (k === key || withKeys.includes(k)) return;
    if (withKeys.length >= MAX_OTHERS) { toast("אפשר להשוות עד 5 יישובים. הסירו אחד כדי להוסיף אחר."); return; }
    go([...withKeys, k]);
  };

  // every row: its figure, its places, its direction
  const rows = data.rows.map((r) => {
    const a = model.indicators.find((x) => x.id === r.id), dir = r.direction || (a && a.direction) || "higher";
    const ranks = r.cells.map((cell, i) => standing(r.cells, i, dir));
    return { r, a, dir, ranks, mine: ranks[0], bucket: bucketOf(ranks[0]), years: new Set(r.cells.filter((x) => x && x.year != null).map((x) => x.year)) };
  }).filter((x) => x.a);
  const count = (b) => rows.filter((x) => x.bucket === b).length;
  const rankable = rows.filter((x) => x.bucket).length, nFirst = count("first"), nMid = count("mid"), nLast = count("last");
  const anySmall = rows.some((x) => x.r.cells[0] && x.r.cells[0].reliable === false);

  // ── hero ──
  const fact = (label, value) => h("div.hero-fact", h("small", label), h("b", value));
  const verdict = !others.length ? "בחרו יישובים להשוואה, ונראה איפה היישוב עומד מולם."
    : rankable ? ["בהשוואה ל", others.length === 1 ? "יישוב אחד" : [N(others.length), " יישובים"], ", ", c.name, " במקום הראשון ", inN(nFirst), " ובמקום האחרון ", inN(nLast), "."]
      : anySmall ? "הקבוצה קטנה מכדי להשוות או להסיק, ולכן אין כאן דירוג." : "אין מדד שאפשר לדרג מול היישובים שבחרתם.";
  const jump = (id) => () => { const el = root.querySelector("#" + id); if (el) el.scrollIntoView({ behavior: smooth(), block: "start" }); };
  const hero = h("section.hero.tr-hero", { "aria-labelledby": "tr-h1" }, decor(),
    heroTop(verdict, others.length ? h("div.hero-meta.rv", fact("יישובים בהשוואה", N(others.length + 1)), fact("מדדים שנבדקו", N(rows.length)), fact("מדדים שאפשר לדרג", outOf(rankable, rows.length))) : null),
    rankable ? h("div.rv", ledger({
      label: `המקום של ${c.name} בין היישובים שבחרתם: ראשון ב-${nFirst} מדדים, באמצע ב-${nMid}, אחרון ב-${nLast}`,
      cols: [{ n: nFirst, tone: "good", label: "במקום הראשון", hint: "אף יישוב בהשוואה לא טוב ממנו", onPick: jump("tr-rows") },
        { n: nMid, tone: "none", label: "באמצע", hint: "בין הראשון לאחרון", onPick: jump("tr-rows") },
        { n: nLast, tone: "attn", label: "במקום האחרון", hint: "כל יישוב בהשוואה טוב ממנו", onPick: jump("tr-rows") }] })) : null,
    rankable && rankable < rows.length ? h("p.tr-hero-note.rv", "הדירוג כולל רק מדדים שבהם הקבוצה גדולה מספיק כדי להשוות, אצלכם ובעוד יישוב אחד לפחות. בשאר המדדים הנתון מוצג בלי מקום.") : null);
  root.append(hero);

  // ── who is in the comparison ──
  const who = h("div.tr-who.rv", { role: "group", "aria-label": "היישובים בהשוואה" },
    h("ul.tr-who-list", h("li", mk(0), h("b", c.name), h("small", "היישוב שלכם")),
      others.map((x) => h("li", mk(marks[x.i]), h("span", x.name), h("button.tr-x", { type: "button", "aria-label": `הסרת ${x.name} מההשוואה`, onclick: () => go(withKeys.filter((k) => k !== x.key)) }, icon("x", 16))))),
    h("div.tr-who-add.no-print", withKeys.length < MAX_OTHERS ? searchBox({ placeholder: "הוסיפו יישוב להשוואה…", onPick: (r) => addCity(r.key) }) : h("span.hint", "אפשר להשוות עד 5 יישובים. הסירו אחד כדי להוסיף אחר."),
      h("a.tr-reset", { href: `#/c/${encodeURIComponent(key)}/compare` }, "ברירת מחדל")),
    dropped.length ? h("p.tr-warn", ["לא נמצאו נתונים על: ", dropped.map((x) => x.name).join(", "), "."]) : null);
  const sx = who.querySelector(".searchbox");
  if (sx) sx.classList.add("tr-sbox");
  root.append(who);

  if (!others.length) {
    const sug = model.peers.slice(0, MAX_OTHERS).filter((p) => p.key !== key);
    root.append(h("section.sec.tr-sec", secHead("", "אפשר להתחיל מכאן", "יישובים דומים", "יישובים בגודל דומה, שהשוואה אליהם הכי הוגנת."),
      sug.length ? h("div.tr-sugs", sug.map((p) => h("button.chip", { type: "button", onclick: () => addCity(p.key) }, icon("users"), p.name))) : h("p.hint", "אפשר לחפש כל יישוב בשמו בשדה שלמעלה.")));
    return root;
  }
  root.append(h("div.tr-keybox", h("p.tr-keynote", ["ברירת המחדל היא יישובים דומים בגודל. היישוב שלכם מסומן בעיגול כחול, ", others.length === 1 ? "היישוב שבחרתם" : "היישובים שבחרתם", " במספרים, ואותו מספר מסמן אותם בכל התרשימים בהמשך."])));

  // ── 01 the concerns of every domain, for every locality ──
  const heatCities = [{ key, name: c.name }], cells = { [key]: Object.fromEntries(model.domains.map((d) => [d.id, d.counts])) };
  models.forEach((m, i) => {
    if (i === 0 || m.status !== "fulfilled") return;
    heatCities.push({ key: wanted[i - 1], name: m.value.city.name });
    cells[wanted[i - 1]] = Object.fromEntries(m.value.domains.map((d) => [d.id, d.counts]));
  });
  const failed = models.map((m, i) => (i > 0 && all[i] && all[i].ok && m.status !== "fulfilled" ? all[i].name : null)).filter(Boolean);
  const heatDomains = model.domains.filter((d) => d.id !== "context" && d.indicators.length).map((d) => ({ id: d.id, label: d.label, short: d.label.split(/ ו|,/)[0].trim(), icon: DOMAIN_ICON[d.id] || "bars" }));
  root.append(h("section.sec.tr-sec", { id: "tr-heat" },
    secHead("01", "תמונת מצב", "כמה מדדים דורשים טיפול, בכל תחום", "בכל משבצת: המצב החמור ביותר שנמצא בתחום, ובתוכה מספר המדדים שדורשים טיפול. הסטטוס של כל יישוב נקבע מול כל היישובים בארץ, לא מול היישובים שבחרתם."),
    heatBlock({ cities: heatCities, domains: heatDomains, cells }),
    failed.length ? h("p.tr-warn", ["לא הצלחנו לטעון את תמונת המצב של: ", failed.join(", "), "."]) : null));

  // ── 02 the map ──
  if (tabs.length) root.append(mapSection({ model, tabs, first, data, withKeys, marks, names, addCity, rows, mapDoms, dom }));

  // ── 03 every figure on its own axis ──
  root.append(rowsSection({ model, rows, names, marks, key, others, data }));
  return root;
}

// ── 01 the picture of every domain, for every locality ──
// Where hardly any domain has a figure that could be judged (small groups, missing data) a grid of grey frames says nothing: it is told in a sentence instead.
const HEAT_WORDS = [["concern", "דורשים טיפול"], ["watch", "למעקב"], ["good", "תקינים"], ["strength", "חוזקות"]];
function heatBlock({ cities, domains, cells }) {
  const at = (c, d) => (cells[c.key] || {})[d.id] || null, judged = (c) => HEAT_WORDS.some(([k]) => c && c[k] > 0);
  const total = cities.length * domains.length, fullCells = cities.reduce((n, c) => n + domains.filter((d) => judged(at(c, d))).length, 0);
  if (total >= 4 && fullCells / total < 0.3) {
    const per = cities.map((c) => ({ c, ds: domains.filter((d) => judged(at(c, d))) })).filter((x) => x.ds.length);
    return h("div.tr-heat-none",
      h("p", fullCells ? "ברוב התחומים אין מדד שאפשר לשפוט, ביישוב שלכם או ביישובים שבחרתם: הקבוצות קטנות מדי או שאין נתון. כך נראה מה שכן נשפט:" : "אין תחום שבו אפשר לשפוט מדד, ביישוב שלכם או ביישובים שבחרתם: הקבוצות קטנות מדי או שאין נתון."),
      per.length ? h("ul.tr-heat-list", per.map(({ c, ds }) => h("li", h("b", c.name), h("span", ds.map((d) => { const x = at(c, d); return [d.short || d.label, " (", HEAT_WORDS.filter(([k]) => x[k] > 0).map(([k, w]) => [N(x[k]), " ", w]).flatMap((p, i) => (i ? [", ", p] : [p])), ")"]; }).flatMap((p, i) => (i ? ["; ", p] : [p])))))) : null);
  }
  const heat = compareHeat({ cities, domains, cells }), sc = heat.querySelector(".v-mx-scroll");
  if (sc) {                                                                                     // the table scrolls sideways on a phone: it is a tab stop, it says so, and its far edge fades while there is more
    const hint = h("p.tr-scrollhint", { hidden: true }, icon("left", 14), "יש עוד תחומים: גללו הצידה");
    sc.tabIndex = 0; sc.setAttribute("role", "region"); sc.setAttribute("aria-label", "טבלת ההשוואה לפי תחום. אפשר לגלול הצידה לעוד תחומים");
    const upd = () => { const max = sc.scrollWidth - sc.clientWidth, pos = Math.abs(sc.scrollLeft), more = max > 2 && pos < max - 2; sc.classList.toggle("more", more); hint.hidden = !more; };
    sc.addEventListener("scroll", upd, { passive: true });
    if (typeof ResizeObserver === "function") new ResizeObserver(upd).observe(sc); else requestAnimationFrame(upd);
    heat.insertBefore(hint, heat.querySelector(".v-mx-leg") || sc);
  }
  return heat;
}

// ── 02 the map: the country, the chosen figure, and the values of the localities in the comparison ──
function mapSection({ model, tabs: tabs0, first, data, withKeys, marks, names, addCity, rows, mapDoms, dom }) {
  const key = model.city.key;
  let tabs = tabs0, cur = tabs[0].id, curDom = dom ? dom.id : null;
  const box = h("div.tr-mapbox"), side = h("div.tr-mapside"), tabRow = h("div.tr-tabs.no-print", { role: "group", "aria-label": "בחירת מדד למפה" }), domRow = h("div.tr-tabs.is-doms.no-print", { role: "group", "aria-label": "בחירת תחום למפה" });
  const sideFor = (a) => {
    const x = rows.find((q) => q.a.id === a.id), r = x && x.r;
    const list = r ? r.cells.map((cell, i) => (cell && isNum(cell.v) && (i === 0 || marks[i]) ? { i, cell, st: x.ranks[i] } : null)).filter(Boolean).sort((p, q) => (p.st && q.st ? p.st.rank - q.st.rank || p.cell.v - q.cell.v : p.st ? -1 : q.st ? 1 : 0)) : [];
    return [h("h3.tr-map-t", a.label), h("p.tr-map-dir", icon(directionIcon(a.direction), 14), directionNote(a.direction)),
      list.length ? h("ul.tr-vals", list.map(({ i, cell, st }) => h("li", { class: i === 0 ? "is-me" : "" }, mk(i === 0 ? 0 : marks[i], cell.reliable === false), h("span.tr-vn", names[i]),
        h("b.tr-vv" + (cell.reliable === false ? ".is-small" : ""), ltr(fmtVal(a.unit, cell.v))), h("small", st ? ["מקום ", outOf(st.rank, st.of)] : cell.reliable === false ? "קבוצה קטנה, לא מדורג" : "")))) : h("p.hint", "אין נתון על המדד הזה ביישובים שבהשוואה.")];
  };
  const draw = (det, geo, a) => {
    const I = det.indicator, last = det.analysis && det.analysis.last;
    box.setAttribute("aria-busy", "false");
    box.replaceChildren(dotMap({ points: det.map || [], cityKey: key, unit: I.unit, direction: I.direction, nat: last ? last.nat : null, peers: withKeys, geo: Array.isArray(geo) ? geo : undefined, minBase: I.minBase, label: I.short || I.label, height: 560,
      city: (det.map || []).some((p) => p.k === key) ? undefined : { k: key, name: model.city.name, v: null, x: model.city.lon, y: model.city.lat }, onPick: (p) => addCity(p.k) }));
    side.replaceChildren(...sideFor(a));
  };
  const load = async (a) => {
    cur = a.id;
    tabRow.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === a.id)));
    side.replaceChildren(...sideFor(a));
    box.setAttribute("aria-busy", "true");
    box.replaceChildren(h("div.tr-wait", { role: "status" }, "טוענים את המפה…"));
    try { const [det, geo] = await Promise.all([getIndicator(key, a.id), getGeo()]); if (cur === a.id) draw(det, geo, a); }
    catch (e) { if (cur === a.id) { box.setAttribute("aria-busy", "false"); box.replaceChildren(h("p.tr-wait", "לא הצלחנו לטעון את המפה. אפשר לנסות שוב בעוד רגע.")); } }
  };
  const figTabs = () => tabRow.replaceChildren(...tabs.map((a) => h("button.chip", { type: "button", "data-id": a.id, "aria-pressed": String(a.id === cur), onclick: () => { if (cur !== a.id) load(a); } }, a.short || a.label)));
  figTabs();
  const showDom = (x) => {                                                                       // another domain: its figures, and the first of them on the map
    curDom = x.d.id; tabs = x.figs.slice(0, 10); domRow.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === curDom)));
    cur = null; figTabs(); load(tabs[0]);
  };
  if (mapDoms.length > 1) mapDoms.forEach((x) => domRow.append(h("button.chip", { type: "button", "data-id": x.d.id, "aria-pressed": String(x.d.id === curDom), onclick: () => { if (curDom !== x.d.id) showDom(x); } }, x.d.label.split(/ ו|,/)[0].trim())));
  if (first && first[0].status === "fulfilled") draw(first[0].value, first[1] && first[1].status === "fulfilled" ? first[1].value : undefined, tabs[0]); else load(tabs[0]);
  return h("section.sec.tr-sec", { id: "tr-map" },
    secHead("02", "על המפה", "איפה הם בארץ", ["בחרו מדד כדי לראות איך הוא מתפזר ברחבי הארץ. ", model.city.name, " בכחול והיישובים שבחרתם במסגרת ורודה. לחיצה על יישוב אחר מוסיפה אותו להשוואה."]),
    mapDoms.length > 1 ? domRow : null, tabRow, h("div.tr-mapgrid", side, box));
}

// ── 03 every figure, domain by domain ─────────────────────────────────────
function rowsSection({ model, rows, names, marks, key, others, data }) {
  if (!rows.length) return h("section.sec.tr-sec", { id: "tr-rows-sec" }, secHead("03", "מדד אחרי מדד", "כל המדדים, יישוב ליד יישוב"), h("p.tr-warn", "אין נתוני השוואה במדדים של היישוב הזה."));
  const byDom = {};
  rows.forEach((x) => { (byDom[x.a.domain] = byDom[x.a.domain] || []).push(x); });
  let seen = 0;
  const listBox = h("div.tr-rows", { id: "tr-rows" }), tableBox = h("div", { hidden: true });
  const anyHollow = rows.some((x) => x.r.cells.some((cell) => cell && cell.reliable === false)), usable = rows.some((x) => x.mine || (x.r.cells[0] && x.r.cells[0].reliable !== false));
  model.domains.filter((d) => byDom[d.id]).forEach((d) => {
    const list = byDom[d.id], f = list.filter((x) => x.bucket === "first").length, l = list.filter((x) => x.bucket === "last").length;
    const head = h("h3.tr-dh", h("span.tr-dh-ic", icon(DOMAIN_ICON[d.id] || "bars", 18)), h("span", d.label), f || l ? h("span.tr-dh-n", [f ? ["במקום הראשון ", inN(f)] : null, f && l ? " · " : null, l ? ["באחרון ", inN(l)] : null]) : null);
    const body = h("div.tr-domrows", list.map((x) => rowEl(x, names, marks, key, seen++)));
    listBox.append(h("section.tr-dom", head, body));
  });
  const cols = ["מדד", ...names.filter((nm, i) => i === 0 || marks[i]), "ארצי"], keep = names.map((nm, i) => i === 0 || !!marks[i]);
  if (anyHollow) tableBox.append(h("p.tr-sortnote.tr-table-note", "* קבוצה קטנה מדי, שאינה נכללת בדירוג."));
  tableBox.append(seriesTable(data.rows.map((r) => [r.label + (r.unit !== "%" && unitSuffix(r.unit) ? ` (${unitSuffix(r.unit)})` : ""), ...r.cells.filter((cell, i) => keep[i] || i === 0).map((cell) => (cell ? fmtVal(r.unit, cell.v) + (cell.reliable === false ? "*" : "") : null)), r.nat ? fmtVal(r.unit, r.nat.v) : null]), cols));
  const toggle = usable ? h("div.tr-vt.no-print", viewToggle((v) => { listBox.hidden = v !== "chart"; tableBox.hidden = v !== "table"; keybar.hidden = v !== "chart"; })) : null;
  if (!usable) tableBox.hidden = false;                    // nothing to draw: the table is the page
  const keybar = h("div.tr-keybar", { role: "group", "aria-label": "מקרא" },
    h("ul.tr-who-list.is-key", h("li", mk(0), h("b", names[0])), names.map((nm, i) => (i && marks[i] ? h("li", mk(marks[i]), h("span", nm)) : null))),
    h("span.tr-keyi", h("i.tr-natsw"), "ממוצע ארצי"), h("span.tr-keyi", mk(1, true), "קבוצה קטנה: לא מדורג"), h("span.tr-keyi.is-dir", "ימינה = טוב יותר"));
  if (!anyHollow) keybar.querySelectorAll(".tr-keyi")[1].remove();
  return h("section.sec.tr-sec", { id: "tr-rows-sec" },
    secHead("03", "מדד אחרי מדד", "כל המדדים, יישוב ליד יישוב", "בכל שורה מדד אחד, ועליו כל היישובים על אותו סרגל. ימינה הוא תמיד הצד הטוב יותר, גם במדד שבו נמוך יותר טוב יותר: ״גבוה = טוב״ אומר שככל שהמספר גבוה יותר, כך טוב יותר, ו״נמוך = טוב״ הפוך. עיגול חלול הוא קבוצה קטנה מדי, שאינה נכללת בדירוג.", toggle),
    usable ? keybar : null, usable ? listBox : h("p.tr-warn", "בכל המדדים הקבוצה קטנה מכדי להשוות ליישובים אחרים, ולכן אין דירוג. הנתונים עצמם מופיעים בטבלה."), tableBox,
    h("p.tr-sortnote", "בכל שורה סרגל משלו, ולכן אין להשוות בין שורות. השוואה בין יישובים לא מתחשבת בכך שהקהלים שונים: יישוב חרדי, ערבי או קיבוצי אינו דומה ליישוב עירוני, ולכן כדאי להשוות גם בתוך היישוב. כשהשנה האחרונה שונה בין יישובים, השנה מופיעה בחלון שנפתח מעל כל נקודה."));
}

const dirShort = (d) => (d === "lower" ? "נמוך = טוב" : "גבוה = טוב");
function rowEl(x, names, marks, key, idx) {
  const { r, a, dir, ranks, mine } = x, mineCell = r.cells[0];
  const small = mineCell && mineCell.reliable === false;
  const cells = r.cells.map((cell, i) => (i === 0 || marks[i] ? cell : null));
  const unit = unitSuffix(r.unit) && r.unit !== "%" ? unitSuffix(r.unit) : "";
  const rankLine = mine ? ["מקום ", outOf(mine.rank, mine.of)] : small ? "קבוצה קטנה, לא מדורג" : mineCell ? "אין עם מי להשוות" : "";
  return h("div.tr-row.rv",
    h("div.tr-row-name", h("a", { href: hrefI(key, r.id) }, r.label), h("span.tr-row-dir", { title: directionNote(dir) }, icon(directionIcon(dir), 13), dirShort(dir)), x.years.size > 1 ? h("span.tr-row-yr", "שנת הנתון שונה בין היישובים") : null),
    strip(r, cells, dir, names, marks, ranks, idx < 2),                  // only the first rows play the entrance; the rest are simply there
    h("div.tr-row-val", mineCell && isNum(mineCell.v) ? [h("b" + (small ? ".is-small" : ""), ltr(fmtVal(r.unit, mineCell.v))), unit ? h("small", unit) : null, h("span.tr-rank", rankLine)] : h("span.tr-rank", "אין נתון")));
}
