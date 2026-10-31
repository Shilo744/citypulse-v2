// The entry page: a deep hero with the country drawn as a field of dots, one question, one search box, and what you get.
import { h, icon, ltr, logoMark } from "./ui.js";
import { searchBox } from "./components.js";
import { getMeta, search, health, getGeo, getCity } from "./api.js";
import { svg, viz, countTo, geoFrame, sqrtRadius, arcPath } from "./viz/core.js";
import { statusDonut, progressRing } from "./viz/rings.js";
import { dumbbell } from "./viz/compare.js";

// the three blocks under the hero show the figures of one real locality (with a full model) instead of a drawing; the drawings stay as the fallback
const SAMPLE = "9000";

// the country as a field of dots (every locality with data, sized by its residents); the five biggest cities pulse in turn
function countryDots(geo) {
  const W = 300, H = 650, f = geoFrame(W, H, 12), pmax = Math.max(1, ...geo.map((g) => g.p));
  const bigs = geo.slice().sort((a, b) => b.p - a.p).slice(0, 5), isBig = new Set(bigs.map((g) => g.k));
  const s = svg("svg", { viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true", focusable: "false" });
  geo.slice().sort((a, b) => b.p - a.p).forEach((g) => s.append(svg("circle", { cx: f.X(g.x).toFixed(1), cy: f.Y(g.y).toFixed(1), r: sqrtRadius(g.p, pmax, 1.2, 7.5).toFixed(2), class: "ld fade" + (isBig.has(g.k) ? " big" : ""), style: { "--i": Math.min(12, Math.floor((f.Y(g.y) / H) * 13)) } })));
  bigs.forEach((g, k) => s.append(svg("circle", { cx: f.X(g.x).toFixed(1), cy: f.Y(g.y).toFixed(1), r: 6, class: "lp ping", style: { animationDelay: `${(k * 0.9).toFixed(1)}s` } })));
  return viz(h("div.land-map", s));
}

// three small drawings for the three things the product gives; they draw themselves when they scroll into view
function illus(kind) {
  const s = svg("svg", { viewBox: "0 0 150 78", "aria-hidden": "true", focusable: "false" });
  if (kind === "ring") {
    s.append(svg("circle", { cx: 39, cy: 39, r: 28, class: "t", "stroke-width": 9 }),
      svg("path", { d: arcPath(39, 39, 28, 0, 2.3), class: "a sweep", "stroke-width": 9, "stroke-linecap": "round", style: { "--len": 68 } }),
      svg("path", { d: arcPath(39, 39, 28, 2.6, 5.5), class: "g sweep", "stroke-width": 9, "stroke-linecap": "round", style: { "--len": 84, "--i": 1 } }));
    [[22, 56], [40, 40], [58, 28]].forEach(([y, w], i) => s.append(svg("rect", { x: 88, y: y - 4, width: 60, height: 8, rx: 4, class: "m" }), svg("rect", { x: 88, y: y - 4, width: w, height: 8, rx: 4, class: "c grow-x", style: { "--origin": "0 50%", "--i": i + 2 } })));
  } else if (kind === "scale") {
    [[16, 30, 98], [39, 52, 112], [62, 22, 80]].forEach(([y, a, b], i) => s.append(svg("line", { x1: 8, x2: 142, y1: y, y2: y, class: "t", "stroke-width": 2 }), svg("line", { x1: a, x2: b, y1: y, y2: y, class: "g draw", "stroke-width": 4, "stroke-linecap": "round", style: { "--len": 100, "--i": i } }),
      svg("circle", { cx: a, cy: y, r: 6.5, class: "n pop", style: { "--i": i * 2 } }), svg("circle", { cx: b, cy: y, r: 6.5, class: "c pop", style: { "--i": i * 2 + 1 } })));
  } else {
    [18, 39, 60].forEach((y, i) => s.append(svg("circle", { cx: 18, cy: y, r: 11, class: "t", "stroke-width": 2 }), svg("path", { d: `M12.5 ${y} l4 4 l7 -8`, class: "g draw", "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round", style: { "--len": 24, "--i": i * 2 } }),
      svg("rect", { x: 40, y: y - 4, width: [96, 78, 88][i], height: 8, rx: 4, class: "m rise", style: { "--i": i * 2 + 1 } })));
  }
  return viz(h("div.illus", s));
}

// real mini charts for the three blocks, from the model of the sample locality; each returns null when the model lacks what the chart needs
const samples = {
  ring: (m) => {
    const n = m.counts ? Object.values(m.counts).reduce((a, b) => a + b, 0) : 0;
    return n ? statusDonut({ counts: m.counts, size: 150, legend: false }) : null;
  },
  scale: (m) => {
    const a = m.indicators.find((i) => i.id === "th_mmrv" && i.last && i.last.reliable !== false && i.last.nat != null) || m.indicators.find((i) => i.unit === "%" && i.direction && i.last && i.last.reliable !== false && i.last.nat != null && i.last.target != null);
    if (!a) return null;
    const L = a.last, points = [{ key: "city", label: m.city.name, v: L.v }, { key: "nat", label: "ארצי", v: L.nat }];
    if (L.peer != null) points.push({ key: "peer", label: "יישובים דומים", v: L.peer });
    if (L.target != null) points.push({ key: "target", label: "יעד", v: L.target });
    return dumbbell({ rows: [{ label: a.short || a.label, points }], unit: a.unit, shared: true, direction: a.direction });
  },
  list: (m) => {
    const r = m.recommendations && m.recommendations[0];
    if (!r || r.score == null) return null;
    return h("div.sample-rec", progressRing({ value: r.score, size: 88, tone: "attn", label: "עדיפות" }), h("div", h("small", "ההמלצה הראשונה"), h("b", r.title)));
  },
};
// swap each drawing for the real chart when the sample model arrives (the page does not wait for it)
async function fillSamples(page) {
  let m = null;
  try { m = await getCity(SAMPLE); } catch (e) { return; }
  for (const [kind, make] of Object.entries(samples)) {
    const slot = page.querySelector(`.land-block[data-kind="${kind}"] .vis`);
    let chart = null;
    try { chart = slot && make(m); } catch (e) { chart = null; }
    if (chart) slot.replaceChildren(h("div.sample", chart, h("div.sample-cap", `דוגמה: ${m.city.name}`)));
  }
}

export async function homeView({ themeBtn }) {
  const [meta, top, hl, geo] = await Promise.all([getMeta(), search(""), health().catch(() => null), getGeo().catch(() => [])]);
  let last = null;
  try { last = JSON.parse(localStorage.getItem("cp2-last") || "null"); } catch (e) { /* private mode */ }
  const stat = (n, label) => h("div.land-stat", h("b.ltr", countTo(n)), h("span", label));
  const block = (no, kind, title, text) => h("div.land-block", { "data-kind": kind }, h("div.vis", illus(kind)), h("div.no", no), h("h3", title), h("p", text));
  const publishers = [...new Set(Object.values(meta.sources).map((s) => s.publisher.split(/[,(]/)[0].trim()))].slice(0, 9);     // "משרד הבריאות, חטיבת ..." is one publisher
  const small = matchMedia("(max-width: 520px)").matches;
  const page = h("div.land",
    h("section.land-hero",
      h("header.land-top",
        h("a.brand", { href: "#/", "aria-label": "CityPulse, בריאות הציבור ברמת היישוב" }, logoMark("dark"), h("div", h("b", "CityPulse"), h("small", "בריאות הציבור ברמת היישוב"))),
        h("nav", h("a.btn.sm.ghost", { href: "#/method" }, icon("book"), "שיטה ומקורות"), themeBtn())),
      h("div.land-hero-grid",
        h("div.land-in",
          h("span.land-pill", icon("shield"), "נתונים רשמיים · לכל יישוב בישראל"),
          h("h1", "איך מצב הבריאות ", h("em", "בעיר שלכם"), "?"),
          h("p.land-lede", "בחרו יישוב וקבלו תמונת מצב ברורה: איפה הוא עומד מול שאר הארץ, מה השתנה בשנים האחרונות, ומה כדאי לטפל בו קודם."),
          h("div.land-search", searchBox({ big: true, openOnFocus: false, autofocus: !matchMedia("(pointer: coarse)").matches, placeholder: small ? "הקלידו שם יישוב" : "הקלידו שם יישוב, למשל: שדרות, חיפה, אום אל-פחם" })),
          h("div.land-quick", h("span", "או נסו:"), top.slice(0, 6).map((c) => h("a", { href: `#/c/${encodeURIComponent(c.key)}` }, c.name))),
          last ? h("a.land-resume", { href: `#/c/${encodeURIComponent(last.key)}` }, icon("clock"), `היישוב האחרון שצפיתם בו: ${last.name}`, icon("left")) : null,
          h("div.land-stats", stat(meta.indicators.length, "מדדים"), stat(Object.keys(meta.sources).length, "מקורות רשמיים"), stat(geo.length || (hl ? hl.localities : 0), "יישובים עם נתונים"))),
        geo.length ? countryDots(geo) : null)),
    h("section.land-after",
      h("h2", "מה מקבלים"),
      h("p.sub-lede", "לא עוד גיליונות: תמונה אחת שאפשר לקרוא בדקה, ומתחתיה כל מה שצריך כדי להחליט ולפעול."),
      h("div.land-blocks",
        block("01", "ring", "מה דורש טיפול קודם", "רשימה קצרה של המדדים שהכי כדאי לטפל בהם, עם הסבר במילים פשוטות."),
        block("02", "scale", "איפה אתם ביחס לאחרים", "השוואה לממוצע הארצי, ליישובים דומים וליעדים של משרד הבריאות."),
        block("03", "list", "מה עושים עם זה", "המלצות לפעולה עם אחראי, יעד ומדד הצלחה, ושאלות חופשיות לסוכן.")),
      h("div.land-sources", h("h3", "המספרים מגיעים ממקורות רשמיים"), h("div.pills", publishers.map((p) => h("span", p))))),
    h("div.land-trust",
      h("span", icon("check"), "לכל מדד מצורף המקור שלו"),
      h("span", icon("check"), "המספרים נלקחים מהנתונים הרשמיים, לא נכתבים על ידי בינה מלאכותית")),
    h("footer.land-foot", "CityPulse · כלי עזר לקבלת החלטות, לא תחליף לשיקול דעת מקצועי."));
  fillSamples(page);
  return page;
}
