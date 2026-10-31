// "איך זה נראה": one calm band with the real figures of one fixed locality, drawn with the same charts as the rest of the product.
// The model arrives after the first paint; with no model the band simply stays out of the page.
import { h, icon, directionNote, countLabel } from "../../ui.js";
import { getCity } from "../../api.js";
import { statusDonut, progressRing } from "../../viz/rings.js";
import { dumbbell } from "../../viz/compare.js";

const SAMPLE = "9000";
const isNum = (v) => typeof v === "number" && isFinite(v);
const b = (n) => h("b.ltr", String(n));

// the figure to compare: the vaccination share if the model has it, else any percentage with a national mean and a direction
function pickIndicator(m) {
  const ok = (i) => i.last && isNum(i.last.v) && isNum(i.last.nat) && i.last.reliable !== false && i.direction && i.unit === "%";
  return m.indicators.find((i) => i.id === "th_mmrv" && ok(i)) || m.indicators.find((i) => ok(i) && isNum(i.last.target)) || m.indicators.find(ok) || null;
}

function row(title, cls, ...kids) { return h("div.le-row.rv" + (cls ? "." + cls : ""), h("h3.le-row-h", title), ...kids); }          // a tile of the band: a small heading, a statement, a chart

// status counts: the ring, and one sentence that says what it is out of (the judged figures, never the catalogue)
function statusRow(m) {
  const c = m.counts || {}, judged = ["concern", "watch", "good", "strength"].reduce((n, k) => n + (c[k] || 0), 0);
  if (!judged) return null;
  const said = c.concern ? [b(c.concern), " ", c.concern === 1 ? "מדד" : "מדדים", " ", countLabel("concern", c.concern)] : ["אף מדד אינו דורש טיפול"];
  return row("מצב המדדים", "is-status", h("div.le-row-b",
    h("div.le-row-t", h("p.le-row-big", said), h("p.le-row-p", ["מתוך ", b(judged), " מדדים שנבדקו ב" + m.city.name + ". הטבעת מראה כמה מדדים בכל מצב."])),
    h("div.le-row-v", statusDonut({ counts: c, size: 168 }))));
}

// one figure against the nation, similar localities and the Ministry's target, on one axis (better = right)
function compareRow(m) {
  const a = pickIndicator(m);
  if (!a) return null;
  const L = a.last, points = [{ key: "city", label: m.city.name, v: L.v }, { key: "nat", label: "ארצי", v: L.nat }];
  if (isNum(L.peer)) points.push({ key: "peer", label: "יישובים דומים", v: L.peer });
  if (isNum(L.target)) points.push({ key: "target", label: "יעד", v: L.target });
  return row("מול הארץ ומול יישובים דומים", "is-compare", h("div.le-row-b",
    h("div.le-row-t", h("p.le-row-p.is-name", a.label), h("p.le-row-n", [directionNote(a.direction), L.year ? ` · נתוני ${L.year}` : ""])),
    h("div.le-row-v", dumbbell({ rows: [{ label: "", points }], unit: a.unit, shared: true, direction: a.direction }))));
}

// the first recommendation of the plan with its priority out of 100, and what its evidence is (never more than the model says)
function planRow(m) {
  const r = m.recommendations && m.recommendations[0];
  if (!r || !isNum(r.score)) return null;
  return row("מה כדאי לעשות קודם", "is-plan", h("div.le-row-b",
    h("div.le-row-v", progressRing({ value: r.score, size: 92, tone: "attn", label: "עדיפות" })),
    h("div.le-row-t", h("p.le-row-p.is-name", r.title), r.evidenceNote ? h("p.le-row-n", r.evidenceNote) : null)));
}

export function sample() {
  const el = h("section.le-sample", { "aria-labelledby": "le-s-t", hidden: true });
  const fill = async () => {
    let m;
    try { m = await getCity(SAMPLE); } catch (e) { return; }
    if (!m || !m.city) return;
    const key = encodeURIComponent(m.city.key), name = m.city.name, cov = m.coverage || {};
    const rows = [statusRow(m), compareRow(m), planRow(m)].filter(Boolean);
    if (!rows.length) return;
    el.replaceChildren(h("div.le-wrap.le-sample-in",
      h("div.le-sample-text",
        h("p.le-eyebrow.rv", "איך זה נראה"),
        h("h2.le-h2.rv", { id: "le-s-t" }, "ככה נראית התמונה של " + name),
        h("p.le-lead.rv", `זו דוגמה חיה: הנתונים שהאתר מציג היום על ${name}. מצב כל המדדים במבט אחד, ההשוואה לארץ, והצעד הראשון שכדאי לעשות.`),
        h("a.btn.primary.le-open.rv", { href: `#/c/${key}` }, `פתחו את התמונה המלאה של ${name}`, icon("left")),
        cov.have ? h("p.le-sample-note.rv", ["מבוסס על ", b(cov.have), cov.total > cov.have ? [" מתוך ", b(cov.total)] : null, " מדדים · ", h("a", { href: `#/c/${key}/coverage` }, "מה נמצא ומה חסר")]) : null),
      ...rows));
    el.hidden = false;
  };
  return { el, fill };
}
