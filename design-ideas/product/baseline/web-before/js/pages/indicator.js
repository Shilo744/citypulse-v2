// One indicator of a city, told as a story (DESIGN_V3.md): what the figure is and whether it is good (the hero), how it moved, where the city stands among all
// localities and next to similar ones, who inside the city is worse off, and what to do. View layer only: every number comes from the API payload.
import { h, icon, num, ltr, iso, outOf, dateHe, fmtVal, unitSuffix, deltaUnit, compareLine, trendInfo, statusReason, directionNote, directionIcon, STATUS, DOMAIN_ICON } from "../ui.js";
import { seriesTable, viewToggle } from "../charts.js";
import { horizonLabel } from "../components.js";
import { getIndicator, getGeo, getMeta } from "../api.js";
import { shareBtn, printBtn, tocNav } from "./shared.js";
import { svg, viz, toneOfStatus } from "../viz/core.js";
import { gauge, waffle, standingMeter, progressRing, targetPhrase, figText } from "../viz/rings.js";
import { lineChart, indicatorLine, peerBand, legendOf, EVENTS_IL } from "../viz/time.js";
import { dumbbell, lollipopRank, distribution, fixRanges } from "../viz/compare.js";
import { dotMap, locator } from "../viz/spatial.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const NOT_A_SHARE = new Set(["pop_growth"]);                       // a change over five years: not "so many out of 100 people", so no waffle
const STRENGTH_LABEL = { strong: "ראיות חזקות", moderate: "ראיות בינוניות", limited: "ראיות מוגבלות" };
const VERDICT = { concern: "זה אחד המדדים שכדאי לטפל בהם קודם.", watch: "כדאי לעקוב אחרי המדד הזה.", good: "המצב תקין.", strength: "זה חוזק של העיר.", stale: "הנתון האחרון ישן, ולכן הוא אינו משפיע על המסקנות.", uncertain: "הבסיס קטן, ולכן אין מסקנה מהמדד הזה." };
const FIND_ICON = { concern: "alert", strength: "check", info: "info" };
const amount = (unit, v) => num(Math.abs(v), 1) + deltaUnit(unit);          // "13.9 נק׳", "9 ימים": plain text, for a sentence that is one string
const sgn = (v) => (v < 0 ? "−" : "+");
const amountEl = (unit, v, signed) => [ltr((signed ? sgn(v) : "") + num(Math.abs(v), 1)), deltaUnit(unit)];       // only the number is isolated; the unit word stays in the Hebrew flow
const dots = (bits) => bits.filter(Boolean).flatMap((b, i) => (i ? [" · ", b] : [b]));
const domainOf = (model, id) => model.domains.find((d) => d.id === id) || { id, label: id };
const acc = (title, body, open) => h("details.acc", { open }, h("summary", title), h("div.acc-body", body));

// ───────────────────────────── sentences ─────────────────────────────

// compareLine words the gap to the nation; for a rate per 1,000 / 10,000 / 100,000 it leaves the unit out, so it is added here to match the other chips
function natLine(a) {
  const cl = compareLine(a);
  return /^per/.test(a.unit) && /ב-[\d.,]+$/.test(cl.text) ? { ...cl, text: cl.text + deltaUnit(a.unit) } : cl;
}

// the city against similar localities, in the same words as compareLine uses for the nation
function peerLine(a) {
  const L = a.last, g = L.gapPeer;
  if (!isNum(g) || !isNum(L.peer)) return null;
  if (Math.abs(g) < Math.max(Math.abs(L.peer) * 0.02, 0.05)) return { text: "דומה ליישובים דומים בגודל", tone: "none", ic: "minus" };
  const up = g > 0, good = a.direction ? (a.direction === "lower" ? !up : up) : null;
  return { text: `${good == null ? (up ? "גבוה" : "נמוך") : good ? "טוב" : "חלש"} מיישובים דומים ב-${amount(a.unit, g)}`, tone: good == null ? "none" : good ? "good" : "attn", ic: up ? "up" : "downarrow" };
}

// what the history line did, in words
function lineSentence({ a, L, H, small }) {
  const S = a.series, f = (v) => fmtVal(a.unit, v), out = [];
  if (small) return ["הקבוצה קטנה: כל מקרה בודד משנה את הערך בחדות, ולכן הקפיצות בגרף אינן מגמה."];
  if (S.length < 2) return ["יש נתון לשנה אחת בלבד (", iso(String(L.year)), "), ולכן אין היסטוריה להציג."];
  const first = H.first, delta = H.delta, ti = trendInfo(a);
  if (first && isNum(delta)) {
    const verb = H.trendClass === "stable" ? (delta > 0 ? "עלה מעט" : delta < 0 ? "ירד מעט" : "לא השתנה") : delta > 0 ? "עלה" : delta < 0 ? "ירד" : "לא השתנה";
    out.push("בין ", iso(String(first.year)), " ל-", iso(String(L.year)), " הערך ", verb, delta !== 0 ? [" ב-", ...amountEl(a.unit, delta)] : null, ", מ-", ltr(f(first.v)), " ל-", ltr(f(L.v)), ".");
  }
  if (isNum(H.natDelta) && H.natDelta !== 0 && H.trendClass && H.trendClass !== "unknown") out.push(" בממוצע הארצי, באותה תקופה: ", H.natDelta > 0 ? "עלייה" : "ירידה", " של ", ...amountEl(a.unit, H.natDelta), ".");
  if (ti && (ti.tone === "good" || ti.tone === "attn")) out.push(" המגמה: ", ti.word, ".");
  if (H.projection) out.push(" אם המגמה תימשך, הערך יגיע ל-", ltr(f(H.projection.v)), " ב-", iso(String(H.projection.year)), " (אינדיקציה בלבד).");
  if (isNum(H.yearsToTarget)) out.push(" בקצב הנוכחי יגיעו ליעד בעוד כ-", ltr(num(H.yearsToTarget, 1)), " שנים (אינדיקציה בלבד).");
  if (H.trendClass === "unknown") out.push(" פחות משלוש שנים: מוצג הנתון בלי הערכת מגמה.");
  return out;
}

// ───────────────────────────── the hero ─────────────────────────────

// the chips under the figure: against the nation, the target, similar localities, and the trend since the first year
function deltaChips({ a, L, H, small }) {
  if (small) return [];
  const out = [], nat = natLine(a), peer = peerLine(a), ti = trendInfo(a);
  if (isNum(L.nat)) out.push({ ...nat, ref: ["ארצי ", ltr(fmtVal(a.unit, L.nat))] });
  if (isNum(L.target)) out.push({ tone: L.meetsTarget === true ? "good" : L.meetsTarget === false ? "attn" : "none", ic: L.meetsTarget ? "check" : "target", text: targetPhrase({ unit: a.unit, direction: a.direction, value: L.v, target: L.target }) || "יעד משרד הבריאות", ref: ["יעד ", ltr(fmtVal(a.unit, L.target))] });
  if (peer) out.push({ ...peer, ref: ["ערך אמצעי ", ltr(fmtVal(a.unit, L.peer))] });
  if (ti) out.push({ tone: ti.tone, ic: ti.ic, text: `מגמה: ${ti.word}`, ref: ti.delta != null && H.first ? [...amountEl(a.unit, ti.delta, true), " מאז ", iso(String(H.first.year))] : null });
  return out;
}

// a handful of people drawn one by one: the honest picture of a figure that rests on very few cases
function peopleDots({ n, d, noun }) {
  const cols = Math.min(10, d), rows = Math.ceil(d / cols), step = 28, r = 9, W = (cols - 1) * step + 2 * r + 4, Ht = (rows - 1) * step + 2 * r + 4;
  const s = svg("svg", { viewBox: `0 0 ${W} ${Ht}`, width: W, height: Ht, "aria-hidden": "true" });
  for (let k = 0; k < d; k++) {
    const row = Math.floor(k / cols), col = k % cols;
    s.append(svg("circle", { cx: (cols - 1 - col) * step + r + 2, cy: row * step + r + 2, r, class: "in-dot " + (k < n ? "on" : "off") + " pop", style: { "--i": Math.min(row * 2 + (col > 4 ? 1 : 0), 12) } }));
  }
  return viz(h("div.in-people", s), { label: `${num(n, 0)} מתוך ${num(d, 0)} ${noun}` });
}

function smallNote({ ind, L }) {
  const dotsEl = ind.noun && isNum(L.n) && isNum(L.d) && L.d > 0 && L.d <= 60 && L.n <= L.d ? peopleDots({ n: L.n, d: L.d, noun: ind.noun }) : null;
  const base = isNum(L.d) ? [ind.noun ? `מספר ה${ind.noun} שנמדדו` : "בסיס החישוב", ": ", ltr(num(L.d, 0)), " בלבד", ind.minBase ? [" (המינימום להשוואה: ", ltr(num(ind.minBase, 0)), ")"] : null, ". "] : "הנתון מבוסס על קבוצה קטנה. ";
  return h("div.in-small", icon("info"), dotsEl, h("p.in-small-t", "הקבוצה קטנה מכדי להשוות או להסיק"),
    h("p.in-small-p", base, "כל מקרה בודד משנה את הערך בחדות, ולכן אין דירוג, השוואה או מגמה."));
}

// a figure with a target or a national mean: a dial; its centre says in words how far the figure is, because the numeral beside it already says how much
function dial({ a, L }) {
  const g = gauge({ value: L.v, unit: a.unit, nat: L.nat, target: L.target, direction: a.direction, tone: toneOfStatus(a.status), size: 252 });
  const centre = g.querySelector(".v-ring-gc"), cl = natLine(a);
  const main = (isNum(L.target) && targetPhrase({ unit: a.unit, direction: a.direction, value: L.v, target: L.target })) || cl.text;
  if (centre) centre.replaceChildren(h("div.in-dialnote", h("b", main), h("span", iso(String(L.year)))));
  return g;
}

// the standing meter, with a caption in words; a background figure gets a neutral bar and no verdict words
function meterBlock({ a, L }) {
  const ranked = isNum(L.rank) && isNum(L.of), bg = !a.direction;
  if (!ranked && !isNum(L.level)) return null;
  const m = standingMeter({ level: L.level, rank: L.rank, of: L.of, tone: bg ? "none" : toneOfStatus(a.status), label: bg ? "לפי גובה הערך" : "המקום בין כל היישובים" });
  if (bg) {
    m.style.setProperty("--tone", "var(--c-city)"); m.style.setProperty("--soft", "color-mix(in srgb, var(--c-city) 22%, var(--rs))"); m.style.setProperty("--ink-t", "var(--ri)");
    const ends = m.querySelectorAll(".v-ring-ends span");
    if (ends.length === 2) { ends[0].textContent = "הערכים הנמוכים"; ends[1].textContent = "הערכים הגבוהים"; }
  }
  const cap = bg ? "מקום 1 הוא הערך הגבוה ביותר מבין היישובים."
    : isNum(L.level) ? ["טוב יותר מ-", ltr(num(L.level, 0) + "%"), " מהיישובים", ranked && L.rank === L.of ? " (המקום האחרון)" : ranked && L.rank === 1 ? " (המקום הראשון)" : "", "."] : null;
  return h("div.in-meter" + (bg ? ".is-bg" : ""), m, cap ? h("p.in-meter-cap", cap) : null);
}

function heroVisual(ctx) {
  const { a, ind, L, small, geo, key, model } = ctx;
  if (small) return [smallNote(ctx)];
  const parts = [];
  const share = a.unit === "%" && !NOT_A_SHARE.has(a.id) && L.v >= 0 && L.v <= 100;
  if (a.direction && (isNum(L.nat) || isNum(L.target))) parts.push(h("div.in-dial", dial(ctx)));
  else if (share) parts.push(h("div.in-waffle", waffle({ value: L.v, nat: L.nat, direction: a.direction, tone: a.direction ? toneOfStatus(a.status) : undefined, noun: ind.noun || "", size: 232 })));
  else parts.push(h("div.in-loc", locator({ geo: Array.isArray(geo) ? geo : undefined, cityKey: key, width: 176, ariaLabel: `מיקום ${model.city.name} על המפה` })));
  const meter = meterBlock(ctx);
  if (meter) parts.push(meter);
  return parts;
}

function heroEl(ctx) {
  const { model, a, ind, L, H, small, key, src, id } = ctx;
  const st = STATUS[small ? "uncertain" : a.status] || STATUS.na, cl = compareLine(a);
  const reason = small ? "הקבוצה קטנה מכדי להשוות או להסיק." : statusReason(a) || `${cl.text}. ${VERDICT[a.status] || ""}`.trim();
  const dom = domainOf(model, a.domain), unitWord = a.unit === "%" ? null : unitSuffix(a.unit);
  const chips = deltaChips(ctx);
  const csv = () => downloadCsv(model, a);
  const head = h("div.in-head",
    h("a.in-crumb.rv", { href: `#/c/${key}/d/${a.domain}` }, icon("right"), dom.label),
    h("h1.rv", a.label),
    h("div.in-verdict.rv", h("span.pill.in-pill.t-" + st.tone, icon(st.icon), st.label), h("p.in-reason", reason),
      a.baseShift != null ? h("span.in-chip.tone-none.is-flag", { title: "הבסיס שעליו מחושב המדד השתנה בחדות בין השנים" }, icon("alert"), "גודל הקבוצה השתנה בחדות") : null),
    h("div.in-fig.rv", h("div.in-figrow", h("b.in-num.ltr" + (small ? ".is-hollow" : ""), small ? null : { "data-count": "" }, figText(a.unit, L.v), a.unit === "%" ? h("small", "%") : null), unitWord ? h("span.in-unit", unitWord) : null),
      h("p.in-figmeta", figMeta(ctx)),
      small ? null : h("p.in-dir", icon(directionIcon(a.direction)), directionNote(a.direction))));
  const tail = h("div.in-tail",
    chips.length ? h("ul.in-chips.rv", chips.map((c) => h("li.in-chip.tone-" + c.tone, icon(c.ic), h("span.in-chip-t", c.text), c.ref ? h("span.in-chip-ref", c.ref) : null))) : null,
    chips.length && a.unit === "%" ? h("p.in-unitnote.rv", "נק׳ = נקודות אחוז: ההפרש בין שני אחוזים.") : null,
    src.name ? h("div.srcline.rv", icon("link"), "מקור: ", src.url ? h("a", { href: src.url, target: "_blank", rel: "noopener" }, [src.publisher, src.name].filter(Boolean).join(" · ")) : src.name) : null,
    h("div.hero-actions.no-print.rv", h("button.btn.sm", { type: "button", onclick: csv }, icon("download"), "הורדת CSV"), shareBtn(), printBtn()));
  return h("section.hero.in-hero", h("div.hero-grid", head, h("div.hero-visual.in-visual.rv", heroVisual(ctx)), tail));
}

// the line under the figure: the year and the people behind it
function figMeta({ ind, L }) {
  const bits = [iso(String(L.year))];
  if (isNum(L.n) && isNum(L.d) && ind.noun && ind.done) bits.push(L.d >= 5 ? [...outOf(num(L.n, 0), num(L.d, 0)), " ", ind.noun, " ", ind.done] : [ind.noun, " שנמדדו: ", ltr(num(L.d, 0)), " · ", ind.done, ": ", ltr(num(L.n, 0))]);
  else if (isNum(L.d)) bits.push(ind.noun ? [ltr(num(L.d, 0)), " ", ind.noun] : ["בסיס: ", ltr(num(L.d, 0))]);
  return dots(bits);
}

// ───────────────────────────── sections ─────────────────────────────

function historySpec(ctx) {
  const { model, a, ind, L, H, small, d } = ctx, S = a.series, minBase = ind.minBase || 0, f = (v) => fmtVal(a.unit, v);
  const peers = d.peers || [], band = !small && peers.length >= 3 ? peerBand(peers, peers.length >= 4 ? "iqr" : "range") : null;
  const cfg = indicatorLine(a, model.city.name, { nat: !small, peer: !small, target: !small, projection: !small, band: band && band.lo.length ? band : null, events: S.length >= 3 ? EVENTS_IL : null });
  cfg.series[0].points.forEach((p) => { const s = S.find((q) => q.year === p.x); if (s && minBase > 0 && isNum(s.d) && s.d < minBase) p.hollow = true; });         // a year on too few cases is drawn hollow
  const first = S[0], last = S[S.length - 1];
  cfg.ariaLabel = S.length > 1 ? `היסטוריית ${a.label}: ${f(first.v)} ב-${first.year}, ${f(last.v)} ב-${last.year}${!small && isNum(last.nat) ? `, ממוצע ארצי ${f(last.nat)}` : ""}` : `${a.label}: ${f(last.v)} ב-${last.year}`;
  cfg.extra = (x) => { const s = S.find((q) => q.year === x); return s && isNum(s.d) ? h("div.tr", h("span.k", "גודל הקבוצה"), h("b", num(s.d, 0))) : null; };
  if (S.length === 1) cfg.height = 170;
  const chartBox = h("div.in-chart"), tableBox = h("div", { hidden: true });
  lineChart(chartBox, cfg);
  const legend = legendOf(cfg);
  const cols = [["שנה", (s) => s.year], [model.city.name, (s) => f(s.v)], ["גודל הקבוצה", (s) => (isNum(s.d) ? s.d : null)]];
  if (!small) cols.push(["ארצי", (s) => (isNum(s.nat) ? f(s.nat) : null)], ["יישובים דומים", (s) => (isNum(s.peer) ? f(s.peer) : null)], ["יעד", (s) => (isNum(s.target) ? f(s.target) : null)]);
  const used = cols.filter(([, get], i) => i < 2 || S.some((s) => get(s) != null));
  tableBox.append(seriesTable(S.map((s) => used.map(([, get]) => get(s))), used.map(([t]) => t)));
  const toggle = S.length > 1 ? viewToggle((v) => { chartBox.hidden = v !== "chart"; legend.hidden = v !== "chart"; tableBox.hidden = v !== "table"; }) : null;
  const lead = small ? "הערכים בכל שנה, בלי השוואה: הקבוצה קטנה מכדי להסיק ממנה."
    : S.length > 1 ? ["כך השתנה המדד בעיר בין ", iso(`${first.year}–${last.year}`), band ? ", לעומת הממוצע הארצי ויישובים דומים." : ", לעומת הממוצע הארצי."] : null;
  return { id: "history", eyebrow: "היסטוריה", title: "איך זה השתנה", lead, right: toggle, body: [h("div.in-plot.rv", chartBox, legend, tableBox), h("p.in-read.rv", icon("pulse"), h("span", lineSentence(ctx)))] };
}

function whereSpec(ctx) {
  const { a, ind, L, small, d, model, key, id, geo } = ctx;
  if (small) return { id: "where", eyebrow: "מקום בארץ", title: "המקום בין כל היישובים", lead: null, body: h("p.in-quiet.rv", icon("info"), "הקבוצה קטנה מכדי לדרג מול יישובים אחרים, ולכן אין דירוג. הערך מוצג כפי שהוא, בלי מסקנה.") };
  const dist = d.distribution, hasDist = dist && Array.isArray(dist.values) && dist.values.length > 0, hasMap = Array.isArray(d.map) && d.map.length > 0, hasNb = Array.isArray(d.neighbours) && d.neighbours.length > 0;
  if (!hasDist && !hasMap && !hasNb) return null;
  const inMap = hasMap && d.map.some((p) => String(p.k) === String(key));
  const mapEl = hasMap ? dotMap({ points: d.map, cityKey: key, city: inMap ? undefined : { k: key, name: model.city.name, v: L.v, x: model.city.lon, y: model.city.lat }, unit: ind.unit, direction: a.direction, nat: isNum(L.nat) ? L.nat : null,
    peers: (d.peers || []).map((p) => p.key), geo: Array.isArray(geo) ? geo : undefined, minBase: ind.minBase, label: a.short || a.label, height: 640, onPick: (p) => { location.hash = `#/c/${p.k}/i/${id}`; } }) : null;
  const names = hasMap ? d.map.map((m) => ({ name: m.name, v: m.v })) : undefined;
  const distEl = hasDist ? distribution({ values: dist.values, city: L.v, nat: isNum(L.nat) ? L.nat : undefined, target: isNum(L.target) ? L.target : undefined, p25: dist.p25, p75: dist.p75, unit: ind.unit, direction: a.direction, items: names, height: 230,
    ariaLabel: `התפלגות ${num(dist.n, 0)} יישובים: ${model.city.name} ${fmtVal(a.unit, L.v)}${isNum(L.nat) ? `, ממוצע ארצי ${fmtVal(a.unit, L.nat)}` : ""}` }) : null;
  const nbEl = hasNb ? lollipopRank({ items: d.neighbours.map((n) => ({ name: n.name, v: n.v, rank: n.rank, self: n.self, d: n.d, href: `#/c/${n.k}/i/${id}` })), unit: a.unit, nat: isNum(L.nat) ? L.nat : undefined, direction: a.direction }) : null;
  const body = [
    h("div.split.in-where",
      mapEl ? h("div.plot.rv", h("h3.plot-title", "כל יישוב הוא נקודה"), h("p.plot-sub", "אפשר ללחוץ על כל יישוב ולראות את המדד שלו."), mapEl) : null,
      h("div.in-stack",
        distEl ? h("div.plot.rv", h("h3.plot-title", "איפה העיר מבין כולם"), h("p.plot-sub", "כמה יישובים יש בכל טווח של ערכים."), distEl) : null,
        nbEl ? h("div.plot.rv", h("h3.plot-title", "מי לידה בדירוג"), h("p.plot-sub", "היישובים שמעט מעליה ומתחתיה."), nbEl) : null)),
    h("p.in-legendline.rv", icon("info"), "העיר מסומנת בכחול בכל התצוגות, ויישובים דומים בגודל מסומנים על המפה במסגרת ורודה.")];
  return { id: "where", eyebrow: "מקום בארץ", title: "המקום בין כל היישובים", lead: dist && dist.n ? [num(dist.n, 0), " יישובים עם נתון ל-", iso(String(dist.year || L.year)), ", והעיר ביניהם."] : null, body };
}

function peersSpec(ctx) {
  const { a, ind, L, small, d, model, id } = ctx, minBase = ind.minBase || 0;
  if (small) return null;
  const items = (d.peers || []).map((p) => { const s = (p.series || []).find((q) => q.year === L.year); return s && isNum(s.v) ? { name: p.name, v: s.v, d: s.d, href: `#/c/${p.key}/i/${id}`, hollow: minBase > 0 && isNum(s.d) && s.d < minBase } : null; }).filter(Boolean);
  if (items.length < 2) return null;
  items.push({ name: model.city.name, v: L.v, d: L.d, self: true });
  const lower = a.direction === "lower", ok = items.filter((x) => !x.hollow).sort((x, y) => (lower ? x.v - y.v : y.v - x.v)), rest = items.filter((x) => x.hollow);
  ok.forEach((x, i) => { x.rank = i + 1; });
  const me = ok.find((x) => x.self), pl = peerLine(a);
  const aside = h("div.in-aside.rv",
    me ? h("div.in-bigrow", h("b.in-big", String(me.rank), h("small", ["מתוך ", ltr(String(ok.length))])), h("span", a.direction ? "בין יישובים דומים בגודל" : "לפי גובה הערך, בין יישובים דומים בגודל")) : null,
    isNum(L.peer) ? h("p", ["הערך האמצעי של יישובים דומים: ", h("b", ltr(fmtVal(a.unit, L.peer)))]) : null,
    pl ? h("p", h("span.pill.tone-" + pl.tone, icon(pl.ic), pl.text)) : null,
    rest.length ? h("p.in-aside-note", icon("info"), "יישוב עם קבוצה קטנה מוצג חלול ואינו מדורג.") : null);
  const lol = lollipopRank({ items: [...ok, ...rest], unit: a.unit, nat: isNum(L.nat) ? L.nat : undefined, direction: a.direction });
  return { id: "peers", eyebrow: "יישובים דומים", title: "מול יישובים דומים", lead: "השוואה הוגנת יותר מהממוצע הארצי: יישובים בגודל דומה.", body: h("div.split.in-peers", h("div.plot.rv", lol), aside) };
}

function insideSpec(ctx) {
  const { a, ind, L, small, model } = ctx, minBase = ind.minBase || 0, f = (v) => fmtVal(a.unit, v);
  if (small) return null;
  const blocks = [];
  for (const [k, title] of [["sector", "לפי מגזר"], ["ses", "לפי רמה חברתית-כלכלית של האזור"]]) {
    const e = a.equity && a.equity[k];
    if (!e || !Array.isArray(e.rows)) continue;
    const rows = e.rows.filter((r) => isNum(r.v)).map((r) => ({ ...r, tiny: minBase > 0 && isNum(r.d) && r.d < minBase }));
    if (rows.length < 2) continue;
    const ok = rows.filter((r) => !r.tiny).sort((x, y) => x.v - y.v), lowFirst = a.direction !== "lower";
    const shown = [...rows.filter((r) => !r.tiny).sort((x, y) => (lowFirst ? x.v - y.v : y.v - x.v)), ...rows.filter((r) => r.tiny)];
    const lo = ok[0], hi = ok[ok.length - 1], worse = a.direction === "lower" ? hi : lo, better = a.direction === "lower" ? lo : hi, two = ok.length >= 2;
    const gap = two ? hi.v - lo.v : null, clear = two && e.hi === hi.id && e.lo === lo.id && isNum(e.z) && e.z >= 3;
    const chart = dumbbell({ unit: a.unit, shared: true, direction: a.direction, rows: shown.map((r) => ({ label: fixRanges(r.label), note: isNum(r.d) ? `${num(r.d, 0)} ${ind.noun || "בקבוצה"}` : undefined,
      points: [...(isNum(r.natV) ? [{ key: "nat", label: "ארצי באותה קבוצה", v: r.natV }] : []), { key: "city", label: model.city.name, v: r.v, hollow: r.tiny }] })) });
    const note = h("div.in-aside.rv",
      two ? h("div.in-bigrow", h("b.in-big", ltr(num(gap, 1)), a.unit === "%" ? h("small", " נק׳") : h("small", deltaUnit(a.unit))), h("span", "הפער בין הקבוצות")) : null,
      two && a.direction ? h("p", [h("b", "במצב חלש יותר: "), fixRanges(worse.label), " (", ltr(f(worse.v)), ")", ". ", h("b", "במצב טוב יותר: "), fixRanges(better.label), " (", ltr(f(better.v)), ")."]) : two ? h("p", [h("b", "הערך הגבוה: "), fixRanges(hi.label), " (", ltr(f(hi.v)), "). ", h("b", "הנמוך: "), fixRanges(lo.label), " (", ltr(f(lo.v)), ")."]) : null,
      two ? h("p", h("span.pill.tone-none", icon(clear ? "check" : "info"), clear ? "פער ברור, לא מקרי" : "לא ברור אם הפער אמיתי: המספרים קטנים")) : null,
      rows.some((r) => r.tiny) ? h("p.in-aside-note", icon("info"), "קבוצה קטנה מוצגת חלולה ואינה נכללת בהשוואה.") : null);
    blocks.push(h("div.in-eq", h("h3.plot-title.rv", title), h("div.split.in-eqsplit", h("div.plot.rv", chart), note)));
  }
  if (!blocks.length) return null;
  return { id: "inside", eyebrow: "בתוך העיר", title: "מי בעיר במצב חלש יותר", lead: "כל קבוצה מושווה לממוצע הארצי של אותה קבוצה (הנקודה האפורה), כי רק כך ההשוואה הוגנת.", body: blocks };
}

function findingsSpec({ d, id, key }) {
  if (!d.findings || !d.findings.length) return null;
  return { id: "findings", eyebrow: "ממצאים", title: "מה עולה מהנתונים", lead: null,
    body: h("ul.in-finds", d.findings.map((f) => h("li.in-find.rv.p-" + (f.polarity || "info"), h("span.in-find-ic", icon(FIND_ICON[f.polarity] || "info")),
      h("p", f.text, f.indicator && f.indicator !== id ? [" ", h("a", { href: `#/c/${key}/i/${f.indicator}` }, "לפרטים")] : null)))) };
}

function todoSpec({ d, key, small }) {
  if (small || !d.recommendations || !d.recommendations.length) return null;          // never recommend on a figure that rests on a small group
  const rows = d.recommendations.map((r, i) => h("a.in-rec.rv", { href: `#/c/${key}/actions` },
    progressRing({ value: r.score, size: 60, tone: "attn", label: "עדיפות", display: String(Math.round(r.score)), i }),
    h("div.in-rec-body", h("div.in-rec-tags", r.horizon ? h("span.tag", horizonLabel[r.horizon] || r.horizon) : null, r.evidenceStrength ? h("span.tag", STRENGTH_LABEL[r.evidenceStrength] || r.evidenceStrength) : null),
      h("h3", r.title), r.actions && r.actions.length ? h("p", [h("b", "הצעד הראשון: "), r.actions[0]]) : null, r.caveat ? h("p.in-rec-caveat", icon("info"), r.caveat) : null),
    h("span.in-rec-go", "לתוכנית המלאה", icon("left"))));
  return { id: "todo", eyebrow: "מה עושים", title: "מה אפשר לעשות", lead: "פעולות שמתאימות למדד הזה, לפי מה שהראיות תומכות בו.", band: true,
    right: h("a.btn.sm.no-print", { href: `#/c/${key}/actions` }, "לתוכנית הפעולה המלאה", icon("left")), body: h("div.in-recs", rows) };
}

function aboutSpec({ ind, src, a }) {
  return { id: "about", eyebrow: "על המדד", title: "מה זה מודד ומאיפה זה בא", lead: null,
    body: h("div.in-about.rv",
      acc("מה זה מודד", [h("p", ind.definition || "—"), h("p", { style: { marginTop: "6px" } }, a.direction === "higher" ? "כיוון: גבוה יותר = טוב יותר." : a.direction === "lower" ? "כיוון: נמוך יותר = טוב יותר." : "מדד רקע: מתאר את העיר ואינו נשפט כטוב או רע.")], true),
      acc("למה זה חשוב", ind.why || "—"), acc("מה צריך לדעת", ind.caution || "—"),
      acc("מקור הנתון", src.url ? [src.publisher + ": ", h("a", { href: src.url, target: "_blank", rel: "noopener" }, src.name), src.fetchedAt ? " · נאסף " + dateHe(src.fetchedAt) : ""] : "—")) };
}

function secEl(no, s) {
  const head = h("div.sec-head.rv", h("div", h("div.sec-eyebrow", h("b", String(no).padStart(2, "0")), s.eyebrow), h("h2.sec-title", s.title), s.lead ? h("p.sec-lead", s.lead) : null), s.right || null);
  return h("section.sec", { id: s.id }, head, s.band ? h("div.band.rv", s.body) : s.body);
}

// ───────────────────────────── the page ─────────────────────────────

// a locality that has no value for this figure: say so plainly and offer the way on, instead of an empty page
async function noData(model, id) {
  let meta = null;
  try { meta = await getMeta(); } catch (e) { /* offline: the router shows its own card */ }
  const mi = meta && meta.indicators.find((x) => x.id === id);
  if (!mi) return null;
  const key = model.city.key, dom = domainOf(model, mi.domain), src = meta.sources && meta.sources[mi.source];
  const others = model.indicators.filter((x) => x.domain === mi.domain && x.id !== id);
  return h("div.in-page.in-nodata",
    h("a.in-crumb.rv", { href: `#/c/${key}/d/${mi.domain}` }, icon("right"), dom.label),
    h("div.in-empty.rv", icon("info"), h("h1", "אין נתונים על המדד הזה ביישוב הזה"), h("p.in-empty-sub", [h("b", mi.label), ": לא נמצא ערך עבור ", model.city.name, " במקורות שאליהם CityPulse מתחבר."]),
      h("div.hero-actions", h("a.btn.sm", { href: `#/c/${key}/d/${mi.domain}` }, "לכל המדדים בתחום", icon("left")), h("a.btn.sm", { href: `#/c/${key}` }, "לתמונת המצב"))),
    h("section.sec", h("div.sec-head.rv", h("div", h("h2.sec-title", "מה המדד הזה מודד"))), h("p.in-quiet.rv", icon("book"), [mi.definition || "—"]),
      src ? h("p.srcline.rv", icon("link"), "מקור: ", src.url ? h("a", { href: src.url, target: "_blank", rel: "noopener" }, [src.publisher, src.name].filter(Boolean).join(" · ")) : src.name) : null),
    others.length ? h("section.sec", h("div.sec-head.rv", h("div", h("h2.sec-title", "מדדים אחרים בתחום"), h("p.sec-lead", "אלה המדדים של התחום שיש עליהם נתון ב" + model.city.name + "."))),
      h("ul.in-others.rv", others.map((x) => h("li", h("a", { href: `#/c/${key}/i/${x.id}` }, icon(DOMAIN_ICON[x.domain] || "bars"), x.short || x.label))))) : null);
}

export async function indicatorView(model, id) {
  const key = model.city.key;
  let d, geo = null;
  try { [d, geo] = await Promise.all([getIndicator(key, id), getGeo().catch(() => null)]); }
  catch (e) { if (e && e.message === "no data") { const v = await noData(model, id); if (v) return v; } throw e; }
  const a = d.analysis, ind = d.indicator, L = a.last, H = a.history || {};
  const src = model.sources.find((x) => x.id === ind.source) || {};
  const ctx = { model, key, id, d, a, ind, L, H, small: L.reliable === false, src, geo };
  const specs = [historySpec(ctx), whereSpec(ctx), peersSpec(ctx), insideSpec(ctx), findingsSpec(ctx), todoSpec(ctx), aboutSpec(ctx)].filter(Boolean);
  const root = h("div.in-page", heroEl(ctx), ...specs.map((s, i) => secEl(i + 1, s)));
  const toc = tocNav(root, [["history", "היסטוריה"], ["where", "המקום בין היישובים"], ["peers", "יישובים דומים"], ["inside", "בתוך העיר"], ["findings", "ממצאים"], ["todo", "מה אפשר לעשות"], ["about", "על המדד ומקורו"]]);
  if (toc) root.querySelector(".in-hero").after(toc);
  return root;
}

function downloadCsv(model, a) {
  const rows = [["year", "city", "base", "national", "peers_median", "target"], ...a.series.map((s) => [s.year, s.v, s.d ?? "", s.nat ?? "", s.peer ?? "", s.target ?? ""])];
  const blob = new Blob(["﻿" + rows.map((r) => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const u = URL.createObjectURL(blob), el = h("a", { href: u, download: `${model.city.key}-${a.id}.csv` });
  document.body.append(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
}
