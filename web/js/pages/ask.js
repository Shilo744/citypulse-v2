// Ask the agent: a free question becomes a page of blocks (figures, charts, findings, sources) built from the data.
// A calm hero with the question field and example questions, then a thread of answers: each one a title, one large lead sentence and open blocks on the
// page, every block drawn with the chart that fits its data. The numbers come from the data only; the model chooses the blocks and words the lead.
// Style: css/pages/ask.css (prefix .as-). No block is a box inside a box; a small group is shown but never compared, ranked or judged.
import { h, svg, icon, ltr, outOf, iso, dateHe, deltaUnit, directionNote, unitSuffix, fmtVal, num } from "../ui.js";
import { seriesTable } from "../charts.js";
import { kpiCard, findingList, trendText, horizonLabel } from "../components.js";
import { ask, getGeo } from "../api.js";
import { viz } from "../viz/core.js";
import { lineChart, lineLegend, indicatorLine, legendOf, smallMultiples, smallItem, EVENTS_IL } from "../viz/time.js";
import { lollipopRank, dumbbell } from "../viz/compare.js";
import { locator } from "../viz/spatial.js";
import { progressRing } from "../viz/rings.js";

const SERIES = ["var(--c-city)", "var(--teal)", "var(--c-peer)"];          // up to three lines share one axis; more than that is drawn as small multiples
const EXAMPLES = ["איפה העיר הכי חלשה?", "במה אנחנו חזקים?", "מה השתנה בחמש השנים האחרונות?", "איך מצב החיסונים לעומת יישובים דומים?", "אילו פערים יש בתוך העיר?", "מה כדאי לעשות קודם?"];
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const smooth = () => (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const hrefI = (key, id) => `#/c/${encodeURIComponent(key)}/i/${id}`;
const median = (xs) => { const s = xs.filter(isNum).sort((a, b) => a - b); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const unitWord = (unit) => (unit !== "%" && unitSuffix(unit) ? ` (${unitSuffix(unit)})` : "");
const niceDate = (t) => { const d = new Date(t); return isNaN(d) ? String(t) : dateHe(t); };

// ── a block: a small kind label, a title that says what is measured, one sentence, then the chart straight on the page ──
let seq = 0;
function block(kind, eyebrow, title, sub, ...body) {
  const id = "as-b" + ++seq;
  return h("section.as-block.rv.k-" + kind, { id, "data-label": title || eyebrow, "aria-labelledby": title ? id + "-t" : null },
    h("header.as-bh", h("div.as-eyebrow", eyebrow), title ? h("h3.as-bt", { id: id + "-t" }, title) : null, sub ? h("p.as-bs", sub) : null), ...body);
}
const tag = (el, label) => { el.dataset.label = label; return el; };          // the short name this block has in the index of the answer
const shortOf = (ind) => (ind && (ind.short || ind.label)) || "";
const note = (text) => h("p.as-note", icon("info"), text);
const more = (text, href) => h("a.as-more.no-print", { href }, text, icon("left"));

// the number of columns that leaves no card alone on the last row (3 first, then 2, then 4)
function colsFor(n) {
  if (n <= 3) return Math.max(1, n);
  let best = 3, bestScore = -1;
  for (const c of [3, 2, 4]) { const r = n % c, score = r === 0 ? 3 : r >= 2 ? 2 : 0; if (score > bestScore) { best = c; bestScore = score; } }
  return best;
}

// the kpi block carries flat figures; the card wants an indicator
const asIndicator = (it) => ({ id: it.id, label: it.label, short: it.short, unit: it.unit, direction: it.direction, status: it.status, statusWhy: it.statusWhy,
  last: { v: it.v, nat: it.nat, target: it.target, gapNat: it.gapNat, gapTarget: it.gapTarget, meetsTarget: it.meetsTarget, level: it.level, rank: it.rank, of: it.of, year: it.year, d: it.d, reliable: it.reliable },
  series: (it.spark || []).map((s) => ({ v: s.v, nat: s.nat, year: s.year })),
  history: { trendClass: it.trend, delta: it.delta, first: it.firstYear != null ? { year: it.firstYear } : null } });

// a recommendation as an open row: the score ring, the title, one sentence, when / how hard / how strong the evidence, and the reasons folded away
const EFFORT_HE = { low: "נמוך", medium: "בינוני", high: "גבוה" }, EVIDENCE_HE = { strong: "ראיות חזקות", moderate: "ראיות בינוניות", limited: "ראיות מוגבלות" };
const recFull = (r, c) => ({ ...((c.model.recommendations || []).find((x) => x.id === r.id) || {}), ...r });
function recRow(r0, c, first) {
  const r = recFull(r0, c), why = (r.why || []).slice(0, 2), hz = horizonLabel[r.horizon];
  const meta = [hz, r.effort ? "מאמץ " + (EFFORT_HE[r.effort] || r.effort) : null, r.evidenceStrength ? EVIDENCE_HE[r.evidenceStrength] || null : "ללא מחקר ייעודי"].filter(Boolean);
  return h("article.as-rec.rv" + (first ? ".is-first" : ""), { "data-hz": r.horizon },
    h("div.as-rec-ring", { title: "ציון העדיפות הוא מספר בין 0 ל-100: חומרת הממצאים, חוזק הראיות והמאמץ הנדרש." }, progressRing({ value: r.score, tone: "city", size: first ? 72 : 56, thickness: first ? 6 : 5, label: "ציון עדיפות" })),
    h("div.as-rec-main", h("h3.as-rec-t", r.title), r.summary ? h("p.as-rec-s", r.summary) : null, h("p.as-rec-m", meta.map((m, i) => [i ? " · " : "", m])),
      why.length ? h("details.as-rec-why", h("summary", "למה זו המלצה", icon("down")), h("ul", why.map((w) => h("li", w.text || w, w.indicator ? [" ", h("a", { href: hrefI(c.key, w.indicator) }, "לפרטים")] : null)))) : null));
}

const BLOCKS = {
  kpis(b, c) {
    const items = (b.items || []).filter((it) => it && it.id);
    if (!items.length) return null;
    return tag(block("kpis", "המספרים", "המצב היום", "הערך האחרון של כל מדד, ההשוואה לממוצע הארצי והמגמה. לחיצה על מדד פותחת את העמוד שלו.",
      h("div.as-kpis", { style: `--cols:${colsFor(items.length)}` }, items.map((it) => kpiCard(asIndicator(it), c.key)))), "המצב היום");
  },

  trend(b, c) {
    const series = (b.series || []).filter((s) => s && isNum(s.v));
    if (!series.length) return null;
    const a0 = c.ind(b.ind.id), last = series[series.length - 1];
    const a = { ...(a0 || {}), id: b.ind.id, label: b.ind.label, short: b.ind.short, unit: b.ind.unit, direction: b.ind.direction, series: b.series,
      last: a0 ? a0.last : { year: last.year, v: last.v, nat: last.nat, target: last.target, peer: last.peer },
      history: a0 ? a0.history : { projection: b.projection, trendClass: b.trend, delta: b.delta } };
    const small = !!(a.last && a.last.reliable === false), cmp = b.compare || {};
    // a small group is drawn hollow and alone: no national line, no peers, no target, no projection
    const cfg = indicatorLine(a, c.name, small ? { nat: false, peer: false, target: false, projection: false } : { nat: !!cmp.nat, peer: !!cmp.peers, target: !!cmp.target, events: EVENTS_IL });
    const box = h("div.as-chart"), tt = small ? null : trendText(a);
    lineChart(box, cfg);
    const sub = small ? "הקבוצה קטנה מכדי להשוות או להסיק. המספרים מוצגים כמו שהם, בלי השוואה ובלי מגמה."
      : h("span.as-trend", tt, tt ? " · " : null, directionNote(a.direction));
    return tag(block("trend", "מגמה", "איך זה השתנה: " + b.ind.label, sub, box, legendOf(cfg), more(`לעמוד המדד, עם ההגדרה והמקור`, hrefI(c.key, b.ind.id))), "מגמה · " + shortOf(b.ind));
  },

  multi_trend(b, c) {
    const items = (b.items || []).filter((it) => it && (it.series || []).some((s) => isNum(s.v)));
    if (!items.length) return null;
    const smallOf = (it) => { const a = c.ind(it.id); return !!(a && a.last && a.last.reliable === false); };
    if (b.mode === "values" && items.length <= 3) {          // the same unit and few lines: one axis, one legend
      const series = items.map((it, i) => ({ key: "s" + i, label: it.short || it.label, color: SERIES[i], points: it.series.filter((s) => isNum(s.v)).map((s) => ({ x: s.year, y: s.v, hollow: smallOf(it) })) }));
      const box = h("div.as-chart");
      lineChart(box, { series, unit: b.unit, events: EVENTS_IL, ariaLabel: "מגמות: " + items.map((it) => it.short || it.label).join(", ") });
      return tag(block("multi", "היסטוריה", "מגמות לאורך השנים", "כל הקווים באותה יחידה ובאותו ציר.", box, lineLegend(series.map((s) => ({ label: s.label, color: s.color }))), h("p.as-srcs.no-print", "לעמוד של כל מדד, עם ההגדרה והמקור: ", items.map((it, i) => [i ? " · " : "", h("a", { href: hrefI(c.key, it.id) }, it.short || it.label)]))), "מגמות לאורך השנים");
    }
    // different units or many lines: each figure in its own small chart and its own scale
    const cells = items.map((it) => { const a = c.ind(it.id); return smallItem({ ...(a || { id: it.id, label: it.label, short: it.short, unit: it.unit, direction: it.direction, status: "na", last: null }), series: it.series }, hrefI(c.key, it.id)); });
    return tag(block("multi", "היסטוריה", "מגמות לאורך השנים", "כל מדד מצויר בקנה מידה משלו. הצבע מראה אם השינוי מאז השנה הראשונה טוב או חלש, ומדדי רקע נשארים אפורים.", smallMultiples({ items: cells, cols: 3, ariaLabel: "מגמות לפי מדד" })), "מגמות לאורך השנים");
  },

  rank(b, c) {
    const items = (b.items || []).filter(Boolean);
    if (!items.length) return null;
    const a = c.ind(b.ind.id), L = a && a.last, dir = b.ind.direction, small = !!(L && L.reliable === false);
    const place = { top: "המובילים", bottom: "בתחתית הדירוג", around: "איפה אנחנו בדירוג" }[b.show] || "דירוג";
    const list = lollipopRank({ items: items.map((n) => ({ name: n.name, v: n.v, rank: n.rank, self: n.self, d: n.d, href: hrefI(n.key, b.ind.id) })), unit: b.ind.unit, nat: L && isNum(L.nat) ? L.nat : undefined, direction: dir, selfLabel: "העיר" });
    const missing = !items.some((n) => n.self) && small;
    return tag(block("rank", "דירוג", place + ": " + b.ind.label, ["נתוני ", iso(String(b.year)), ", ", iso(String(b.total)), " יישובים. ", dir ? "מהטוב ביותר לחלש ביותר. " : "לפי גובה הערך. ", directionNote(dir), "."],
      h("div.as-rankbox", list), missing ? note(`${c.name} לא מדורגת במדד הזה: הקבוצה קטנה מכדי להשוות או להסיק.`) : null), place + " · " + shortOf(b.ind));
  },

  compare(b, c) {
    const rows = [], plain = [], dirs = new Set(), units = new Set();
    for (const it of b.items || []) {
      const a = c.ind(it.ind.id), small = !!(a && a.last && a.last.reliable === false), by = (k) => (it.rows || []).filter((r) => r.kind === k);
      const city = by("city")[0], nat = by("national")[0], tgt = by("target")[0], peerV = a && a.last && isNum(a.last.peer) ? a.last.peer : median(by("peer").map((p) => p.v));
      const points = [];
      if (city && isNum(city.v)) points.push({ key: "city", label: c.name, v: city.v, hollow: small });
      if (!small) {                                            // a small group is compared with nothing
        if (nat && isNum(nat.v)) points.push({ key: "nat", label: "ממוצע ארצי", v: nat.v });
        if (isNum(peerV)) points.push({ key: "peer", label: "יישובים דומים (הערך האמצעי)", v: peerV });
        if (tgt && isNum(tgt.v)) points.push({ key: "target", label: "יעד משרד הבריאות", v: tgt.v });
      }
      if (!points.length) continue;
      const short = it.ind.short || it.ind.label;
      if (points.length < 2) { plain.push({ label: short, href: hrefI(c.key, it.ind.id), unit: it.ind.unit, v: points[0].v, why: small ? "קבוצה קטנה, לא מושווית" : "אין נתון להשוואה" }); continue; }          // one point alone has nothing to be compared with: it is listed, never drawn on a scale
      rows.push({ label: short, note: it.ind.label !== short ? it.ind.label : "", href: hrefI(c.key, it.ind.id), unit: it.ind.unit, direction: it.ind.direction, points });
      dirs.add(it.ind.direction || "none"); units.add(it.ind.unit);
    }
    if (!rows.length && !plain.length) return null;
    const list = plain.length ? h("ul.as-vals", { "aria-label": "ערכים בלי השוואה" }, plain.map((r) => h("li", h("a.as-vals-n", { href: r.href }, r.label), h("b.as-vals-v", ltr(fmtVal(r.unit, r.v))), h("span.as-vals-w", r.why)))) : null;
    if (!rows.length) return tag(block("compare", "השוואה", "הערכים כפי שהם", "הקבוצה קטנה מכדי להשוות או להסיק, ולכן אין כאן השוואה ליישובים דומים, לממוצע הארצי או ליעד.", list), "הערכים כפי שהם");
    const shared = units.size === 1 && dirs.size === 1, dir = shared && !dirs.has("none") ? [...dirs][0] : null;
    const said = shared ? directionNote(dir) : "כל שורה בקנה מידה משלה. בשורות שיש להן כיוון, ימינה = טוב יותר. מדד שמתאר את היישוב בלבד אינו טוב או רע.";
    return tag(block("compare", "השוואה", "מול יישובים דומים, הממוצע הארצי והיעד", said, h("div.as-chart", dumbbell({ rows, unit: shared ? [...units][0] : "", shared, direction: dir })), list ? h("p.as-vals-t", "ללא השוואה") : null, list), "השוואה");
  },

  equity(b, c) {
    const cut = (l) => String(l).replace(/^אזורים ברמה (חברתית-כלכלית )?/, "");
    const panels = (b.groups || []).filter((g) => g && (g.rows || []).length >= 2).map((g) => h("div.as-eq",
      h("h4.as-gt", g.title),
      isNum(g.gap) ? h("p.as-gs", ["הפער בין הקבוצות: ", ltr(num(Math.abs(g.gap))), deltaUnit(b.ind.unit), ". כל שורה: הקבוצה בעיר מול אותה קבוצה בארץ."]) : null,
      dumbbell({ unit: b.ind.unit, shared: true, direction: b.ind.direction,
        rows: g.rows.map((r) => ({ label: g.kind === "ses" ? cut(r.label) : r.label, href: hrefI(c.key, b.ind.id), note: isNum(r.d) ? `${num(r.d, 0)} בקבוצה` : undefined,
          points: [{ key: "nat", label: "ארצי, באותה קבוצה", v: r.natV }, { key: "city", label: c.name, v: r.v }] })) })));
    if (!panels.length) return null;
    return tag(block("equity", "פערים בתוך העיר", "בין קבוצות: " + b.ind.label, [directionNote(b.ind.direction), ". הנתונים של ", iso(String(b.year)), "."], h("div.as-pair", panels)), "פערים · " + shortOf(b.ind));
  },

  findings(b, c) {
    const items = (b.items || []).filter((f) => f && f.text);
    if (!items.length) return null;
    return tag(block("findings", "ממצאים", "מה אנחנו רואים בנתונים", "כל ממצא נבנה מהנתונים, ובסופו קישור למדד.", findingList(items, c.key)), "ממצאים");
  },

  recs(b, c) {
    const items = (b.items || []).filter((r) => r && r.title);
    if (!items.length) return null;
    return tag(block("recs", "המלצות", "מה מומלץ לעשות", "ההמלצות נגזרות מהממצאים ומראיות שפורסמו. הן נקודת פתיחה לדיון עם הצוות המקצועי, לא תחליף להחלטה מקצועית.",
      h("div.as-recs", items.map((r, i) => recRow(r, c, i === 0))), h("a.as-more.no-print", { href: `#/c/${encodeURIComponent(c.key)}/actions` }, "לתוכנית הפעולה המלאה", icon("left"))), "המלצות");
  },

  table(b, c) {
    const rows = (b.rows || []).filter(Boolean);
    if (!rows.length) return null;
    const t = seriesTable(rows.map((r) => [r.label + unitWord(r.unit), ...r.cells.map((v) => (v == null ? null : fmtVal(r.unit, v)))]), ["מדד", ...(b.years || []).map(String)]);
    t.querySelectorAll("tbody tr").forEach((tr, i) => { const td = tr.firstElementChild, id = rows[i] && rows[i].id; if (td && id) td.replaceChildren(h("a", { href: hrefI(c.key, id) }, td.textContent)); });          // the name leads to the indicator page, with its source
    return tag(block("table", "הנתונים", "הערכים לפי שנה", "המספרים עצמם, מדד אחד בכל שורה. שם המדד מוביל לעמוד שלו, עם המקור.", h("div.as-table", t)), "הערכים לפי שנה");
  },

  text(b) {
    if (!b.text) return null;
    return block("text", "הסבר", b.heading || null, null, h("p.as-text", b.text));
  },

  // the question needs data the system does not hold: the links to open datasets come first
  sources(b) {
    const items = (b.items || []).filter((s) => s && s.url);
    if (!items.length) return null;
    return block("sources", "נתונים שחסרים", b.title, b.note,
      h("ul.as-links", items.map((s) => h("li", h("a.as-link", { href: s.url, target: "_blank", rel: "noopener" },
        h("span.as-link-t", s.title), h("span.as-link-m", [s.org, s.modified ? (s.org ? " · " : "") + "עודכן " + niceDate(s.modified) : null]), s.why ? h("span.as-link-w", s.why) : null, icon("link"))))));
  }
};

function renderBlock(b, c) {
  const fn = b && BLOCKS[b.type];
  if (!fn) return null;
  try { return fn(b, c); } catch (e) { console.warn("block", b.type, e); return null; }          // one bad block never costs the whole answer
}

// a page with a "sources" block is an answer about data the system does not hold: say so first, fold the related data away
// a question about what to do puts the recommendations first
const ACTION_Q = /לעשות|לפעול|להתחיל|מומלץ|המלצ|עדיפות|קודם|צעד|פעולה|תוכנית/;
function layout(blocks, c, q) {
  const first = ACTION_Q.test(q || "") ? blocks.find((b) => b.type === "recs") : null;
  if (first) blocks = [first, ...blocks.filter((b) => b !== first)];
  const gap = blocks.find((b) => b.type === "sources"), rest = blocks.filter((b) => b !== gap).map((b) => renderBlock(b, c)).filter(Boolean);
  if (!gap) return rest;
  const g = renderBlock(gap, c);
  return [g, rest.length ? h("details.as-fold.rv", h("summary", `נתונים קשורים שיש במערכת (${rest.length})`, icon("down")), h("div.as-fold-body", rest)) : null].filter(Boolean);
}

// ── the pieces around an answer ──
const FRIENDLY = { "empty question": ["לא כתבתם שאלה", "כתבו שאלה בשורה שלמעלה ונסו שוב."], "locality not found": ["לא מצאנו את היישוב", "אולי הקישור ישן. אפשר לבחור יישוב מחדש."], "body too large": ["השאלה ארוכה מדי", "נסו לקצר אותה למשפט או שניים."] };
function friendly(e) {
  const m = String((e && e.message) || "");
  if (FRIENDLY[m]) return FRIENDLY[m];
  if (/failed to fetch|networkerror|load failed/i.test(m)) return ["אין חיבור לשרת", "בדקו את החיבור לרשת ונסו שוב."];
  return ["משהו השתבש בדרך", (/[א-ת]/.test(m) ? m.replace(/[.:]\s*$/, "") + ". " : "") + "אפשר לנסות שוב, או לנסח את השאלה אחרת."];
}
const errorEl = (e, retry) => { const [t, text] = friendly(e); return h("div.as-error", { role: "alert" }, h("span.as-error-ic", icon("alert")), h("div", h("p.as-error-t", t), h("p.as-error-x", text), h("button.btn.sm", { type: "button", onclick: retry }, "ניסיון נוסף"))); };

// the waiting state: a pulse line that draws itself and a dot that keeps pulsing, with the shape of the page that is coming
function loadingEl() {
  const pts = [[0, 20], [52, 20], [60, 19], [67, 7], [75, 33], [82, 15], [86, 20], [128, 20], [135, 19], [141, 10], [148, 29], [153, 18], [156, 21], [178, 20]];
  const len = Math.ceil(pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)) + 6;
  const pulse = viz(h("span.as-pulse", { "aria-hidden": "true" }, svg("svg", { viewBox: "0 0 200 40", width: 200, height: 40 },
    svg("path", { class: "draw", style: `--len:${len}`, d: "M" + pts.map((p) => p.join(" ")).join("L") }), svg("circle", { class: "ping as-ping", cx: 184, cy: 20, r: 3.5 }), svg("circle", { class: "pop as-dot", cx: 184, cy: 20, r: 3.5 }))));
  return h("div.as-loading", h("div.as-wait", pulse, h("div", h("p.as-wait-t", "הסוכן בונה דף לפי השאלה…"), h("p.as-wait-s", { hidden: true }, "זה לוקח קצת יותר מהרגיל, עוד רגע."))),
    h("div.as-sk", { "aria-hidden": "true" }, h("div.sk.as-sk-title"), h("div.sk.as-sk-line"), h("div.sk.as-sk-line.is-short"), h("div.sk.as-sk-chart")));
}

function viaLine(r) {
  if (r.note) return h("p.as-via", icon("info"), r.note);
  if (r.via === "model") return h("p.as-via", h("span.ai-badge", icon("spark"), "נכתב בבינה מלאכותית"), "הניסוח נכתב על ידי הבינה המלאכותית. המספרים והגרפים נלקחו ישירות מהנתונים.");
  return h("p.as-via", "התשובה נבנתה לפי הנושאים בשאלה, והמספרים נשלפו ישירות מהנתונים.");
}

// questions as hairline rows with an arrow (the example questions and the follow-ups)
const questionRows = (list, run) => h("ul.as-qs", list.map((q) => h("li.rv", h("button.as-q-b", { type: "button", onclick: () => run(q) }, h("span", q), icon("left")))));

// a long answer gets a way around it
function indexNav(els) {
  const items = els.filter((e) => e && e.dataset && e.dataset.label && e.id);
  if (items.length < 5) return null;
  return h("nav.as-index.no-print", { "aria-label": "קפיצה לחלק בתשובה" }, h("span.as-index-t", "בדף הזה:"),
    items.map((e) => h("button.as-index-b", { type: "button", onclick: () => e.scrollIntoView({ behavior: smooth(), block: "start" }) }, e.dataset.label)));
}

// ── the page ──
export function askView(model, params) {
  const key = model.city.key, name = model.city.name, history = [];
  const ctx = { model, key, name, ind: (id) => model.indicators.find((a) => a.id === id) || null };
  const root = h("div.as"), thread = h("div.as-thread"), live = h("p.sr", { role: "status" });
  let busy = false;
  // while an answer is being built the example and follow-up questions wait, and say so
  const setBusy = (on) => { root.classList.toggle("is-busy", on); root.querySelectorAll(".as-q-b").forEach((b) => { if (on) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled"); }); };

  const mkField = (id, extra, placeholder) => {
    const input = h("input#" + id, { type: "text", name: "q", placeholder, autocomplete: "off", maxlength: "500", enterkeyhint: "send" });
    const send = h("button.as-send", { type: "submit" }, "שאלו", icon("left"));
    const form = h("form.as-field" + extra, { role: "search", onsubmit: (e) => { e.preventDefault(); const q = input.value; if (q.trim() && !busy) { input.value = ""; run(q); } } },
      h("label.sr", { for: id }, "שאלה על " + name), icon("chat"), input, send);
    return { form, input, send };
  };
  const narrow = typeof matchMedia === "function" && matchMedia("(max-width: 520px)").matches;
  const main = mkField("as-q", "", narrow ? `שאלו על ${name}` : "למשל: איפה אנחנו הכי חלשים?"), again = mkField("as-q2", ".is-compact", `עוד שאלה על ${name}?`);
  const sends = [main.send, again.send];

  const exRows = questionRows(EXAMPLES, (q) => run(q));
  const have = model.coverage ? model.coverage.have : 0, total = model.coverage ? model.coverage.total : 0;
  const fact = (label, value) => h("div.hero-fact", h("small", label), h("b", value));
  const facts = have ? [fact("מדדים שיש עליהם נתון", outOf(have, total)), model.years ? fact("שנות נתונים", ltr(`${model.years.from}–${model.years.to}`)) : null, model.peers && model.peers.length ? fact("יישובים דומים להשוואה", ltr(String(model.peers.length))) : null].filter(Boolean) : [];
  const slot = h("div.as-loc");
  getGeo().then((geo) => { if (Array.isArray(geo) && geo.length) slot.append(locator({ geo, cityKey: key, width: 140, ariaLabel: `מיקום ${name} על המפה` })); }).catch(() => { /* no locator */ });
  const pulse = viz(h("div.as-bgpulse", { "aria-hidden": "true" }, svg("svg", { viewBox: "0 0 800 120", preserveAspectRatio: "none" }, svg("path", { class: "draw", style: "--len:2400", d: "M0 74H190l22-1 16-44 22 88 18-62 12 19H520l22-1 16-30 20 62 14-36 12 8H800" }))));

  root.append(h("section.hero.as-hero", pulse,
    h("div.hero-grid", h("div.as-main",
      h("div.eyebrow.rv", "שאלו את הסוכן"),
      h("h1.rv", `מה תרצו לדעת על ${name}?`),
      h("div.as-intro", h("p.lede.rv", "כתבו שאלה בשפה חופשית. הסוכן בוחר אילו מדדים וגרפים עונים עליה, והמספרים נלקחים ישירות מהנתונים, לא נכתבים על ידי הבינה המלאכותית."),
        h("p.as-sub.rv", have ? "אם חסר נתון, הסוכן אומר זאת ומצביע על מערכי נתונים פתוחים שאפשר להוסיף." : `אין עדיין נתונים ברמת היישוב הזה. אפשר לשאול, והסוכן יצביע על מערכי נתונים פתוחים שאפשר להוסיף.`)),
      h("div.as-form.rv", main.form),
      h("div.as-ex.no-print", { role: "group", "aria-label": "שאלות לדוגמה" }, h("p.as-ex-t", "אפשר להתחיל מאחת מאלה"), exRows)),
    h("div.hero-visual.as-vis", slot, facts.length ? h("div.as-facts.rv", facts) : null))), live, thread);

  const q0 = params && params.get("q");
  if (q0) setTimeout(() => run(q0), 0);

  function answerEls(r, q) {
    const page = r.page || {}, blocks = Array.isArray(page.blocks) ? page.blocks.filter(Boolean) : [], els = layout(blocks, ctx, q), out = [h("h2.as-title", page.title || "תשובה")];
    if (page.answer) out.push(h("p.as-lead", page.answer));
    out.push(viaLine(r));
    const nextEl = els.length > 1 ? els.find((e) => e.classList && e.classList.contains("k-recs")) : null, rec0 = nextEl && ((blocks.find((b) => b.type === "recs") || {}).items || []).find((x) => x && x.title);
    if (rec0 && els.indexOf(nextEl) > 0) out.push(h("p.as-first", h("small", "המלצה ראשונה"), h("a", { href: "#" + nextEl.id, onclick: (e) => { e.preventDefault(); nextEl.scrollIntoView({ behavior: smooth(), block: "start" }); } }, rec0.title)));
    if (els.length) { const ix = indexNav(els); if (ix) out.push(ix); out.push(h("div.as-blocks", els)); }
    else if (!page.answer) out.push(h("div.as-empty", h("p.as-empty-t", "לא מצאנו מה להציג לשאלה הזו"), h("p", "אפשר לנסח אחרת: לשאול על מדד, על תחום או על השוואה ליישובים דומים."), questionRows(EXAMPLES.slice(0, 4), run)));
    const more = (page.followups || []).filter((f) => typeof f === "string" && f.trim());
    if (more.length) out.push(h("section.as-follow.no-print", h("div.as-eyebrow", "אפשר לשאול גם"), questionRows(more, run)));
    return out;
  }

  // one request at a time: the fields wait, the answer (or a friendly error with a retry) takes the place of the waiting state
  async function load(t, q) {
    busy = true; sends.forEach((s) => { s.disabled = true; }); setBusy(true);
    again.form.remove();
    t.el.setAttribute("aria-busy", "true");
    t.body.replaceChildren(loadingEl());
    live.textContent = "הסוכן בונה דף לפי השאלה";
    const slow = setTimeout(() => { const s = t.body.querySelector(".as-wait-s"); if (s) s.hidden = false; }, 9000);
    try {
      const r = await ask({ city: key, question: q, history: history.slice(-3) });
      if (!r || !r.page) throw new Error("bad answer");
      history.push({ q, title: r.page.title });
      t.body.replaceChildren(...answerEls(r, q));
      live.textContent = "התשובה מוכנה: " + (r.page.title || "");
    } catch (e) {
      t.body.replaceChildren(errorEl(e, () => { if (!busy) load(t, q); }));
      live.textContent = "התשובה לא הושלמה";
    } finally {
      clearTimeout(slow); t.el.removeAttribute("aria-busy");
      busy = false; sends.forEach((s) => { s.disabled = false; }); setBusy(false);
    }
    t.el.append(again.form);                                      // one "ask again" field, always under the newest answer
  }

  function run(q) {
    q = (q || "").trim();
    if (!q || busy) return;
    root.classList.add("is-asked");                              // the hero gives way: the answer is what the page is about now
    const t = { el: h("article.as-turn", { tabindex: "-1" }, h("div.as-q", h("small", "השאלה"), h("p", q)), h("div.as-body")) };
    t.body = t.el.querySelector(".as-body");
    thread.prepend(t.el);
    t.el.focus({ preventScroll: true });                         // a keyboard continues from the answer
    requestAnimationFrame(() => t.el.scrollIntoView({ behavior: smooth(), block: "start" }));
    load(t, q);
  }
  return root;
}
