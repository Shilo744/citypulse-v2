// The entry page of the product (#/, SPEC 5.1): a calm front door on the pale sky. The headline, the town search, the towns this browser follows, the picture; then
// three numbers (from /api/health), how it works in three lines (choose a town, read the one page, check what is behind a number), a live sample of one real town, what is checked
// (the four categories, the official targets) and the sources. The menu and the top bar do not exist here (landing); the footer is the shell's.
// The page is returned at once and works without any data: the search is there, and every part that needs the server fills itself when it answers and stays out
// when it does not (a failed /api/health hides the numbers, nothing else). Styles: css/product/entry.css (prefix n-entry-).
import { h, icon, logoMark, dateHe } from "../../ui.js";
import { homeBand } from "../band.js";
import { townSearch } from "../kit/townsearch.js";
import { cnt } from "../kit/plural.js";
import * as net from "../net.js";
import { trustNumbers, domainsOf, sourcesOf, sampleSentence, tracked } from "./text.js";

export const SAMPLE_KEY = "1031";          // the live sample is Sderot: a town with a clear answer
const narrow = () => typeof matchMedia === "function" && matchMedia("(max-width: 600px)").matches;          // the short placeholder where the long one would be cut
const fmt = (n) => Number(n).toLocaleString("en-US");
const soft = (p) => Promise.resolve(p).catch(() => null);          // one failed request must not take the rest of the page with it
const warn = (what) => (e) => console.warn("entry: " + what + " could not be filled", e && e.message);

// the top row: the mark, the way to the method page, the theme button (no link to another version of the product)
function topRow(ctx) {
  return h("header.n-entry-nav",
    h("a.n-entry-brand", { href: "#/", "aria-label": "CityPulse, בריאות הציבור ברמת היישוב" }, logoMark(), h("span.n-entry-brand-t", h("b", "CityPulse"), h("small", "בריאות הציבור ברמת היישוב"))),
    h("nav.n-entry-links", { "aria-label": "קישורים" }, h("a", { href: "#/method" }, icon("book"), "שיטה ומקורות")));
}

// "המעקב שלי": the favourites first, then the recent towns, as text links with a small mark to remove each; "ניקוי" empties both lists
function followedRow(ctx, searchInput) {
  const el = h("div.n-entry-mine", { hidden: true, role: "group", "aria-label": "המעקב שלי" });
  const draw = (focusKey) => {
    const list = tracked(ctx.fav.list(), ctx.recents.list());
    el.hidden = !list.length;
    if (!list.length) { el.replaceChildren(); return; }
    el.replaceChildren(h("span.n-entry-mine-t", "המעקב שלי"),
      h("ul.n-entry-mine-l", list.map((t) => h("li",
        h("a", { href: `#/c/${encodeURIComponent(t.key)}` }, t.fav ? icon("star") : null, t.name),
        h("button.n-entry-x", { type: "button", "data-key": t.key, "aria-label": `הסרת ${t.name} מהרשימה`, onclick: () => remove(t) }, icon("x"))))),
      h("button.n-entry-clear", { type: "button", onclick: clear }, "ניקוי"));
    if (focusKey) { const b = [...el.querySelectorAll(".n-entry-x")].find((x) => x.getAttribute("data-key") === focusKey); if (b) b.focus(); }
  };
  const remove = (t) => {
    const before = tracked(ctx.fav.list(), ctx.recents.list()).map((x) => x.key), next = before[before.indexOf(t.key) + 1] || before[before.indexOf(t.key) - 1];
    (t.fav ? ctx.fav : ctx.recents).remove(t.key);
    ctx.announce(`${t.name} הוסר מהרשימה`);
    draw(next);
    if (!next) searchInput.focus();
  };
  const clear = () => { ctx.fav.clear(); ctx.recents.clear(); ctx.announce("הרשימה נוקתה"); draw(); searchInput.focus(); };
  draw();
  return el;
}

// the quiet link to the comparison; it needs a town, so with none remembered it points at the search
function compareLink(ctx, searchInput) {
  const last = tracked(ctx.fav.list(), ctx.recents.list())[0];
  if (last) return h("a.n-entry-cmp", { href: `#/c/${encodeURIComponent(last.key)}/compare` }, "השוואה בין יישובים", icon("left"));
  const hint = h("span.n-entry-cmp-hint", { role: "status" });
  const btn = h("button.n-entry-cmp", { type: "button", onclick: () => { hint.textContent = "בחרו יישוב קודם, ואז אפשר להשוות אותו ליישובים אחרים."; searchInput.focus(); } }, "השוואה בין יישובים", icon("left"));
  return h("span.n-entry-cmp-w", btn, hint);
}

const section = (cls, id, ...kids) => h("section.n-entry-sec." + cls, { "aria-labelledby": id, hidden: true }, ...kids);
const head = (id, eyebrow, title, lead) => h("div.n-entry-head", eyebrow ? h("p.n-entry-eyebrow.rv", eyebrow) : null, h("h2.n-entry-h2.rv", { id }, title), lead || null);

// ── three numbers: the size of what is behind the page ──
function trust() {
  const list = h("ul.n-entry-nums");
  const el = h("section.n-entry-trust", { "aria-label": "במספרים", hidden: true }, list);
  const fill = (hl, meta) => {
    const nums = hl ? trustNumbers(hl, meta) : [];          // without /api/health the numbers stay out (SPEC 5.1)
    if (!nums.length) return;
    list.replaceChildren(...nums.map((x, i) => h("li.rv", { style: { "--d": i } }, h("b.ltr", { "data-count": "" }, fmt(x.n)), h("span", x.label))));
    el.hidden = false;
  };
  return { el, fill };
}

// ── how it works, in three lines (static text) ──
function how() {
  const steps = [["בוחרים יישוב", "מקלידים את שמו, והדף שלו נפתח."],
    ["קוראים דף אחד", "הדף אומר מה הולך טוב, מה דורש תשומת לב, מה כדאי לעשות ועל מה אין מידע, ומוסיף את המספרים והמגמות."],
    ["בודקים", "ליד כל מספר כתוב ממה הוא בא ואם גבוה טוב או נמוך טוב. מדד שיש לו יעד רשמי נבדק גם מולו."]];
  const el = h("section.n-entry-sec.n-entry-how", { "aria-labelledby": "n-entry-how-t" },
    head("n-entry-how-t", null, "איך זה עובד"),
    h("ol.n-entry-steps", steps.map(([t, p], i) => h("li.rv", { style: { "--d": i } }, h("span.n-entry-step-n", { "aria-hidden": "true" }, String(i + 1)), h("b", t), h("span", p)))));
  return { el, fill() {} };
}

// ── a live sample: the real sentence of one town, not a screenshot ──
// city/sentence.js (the home's own headline) is used when it is there and gives a sentence; otherwise the plain sentence of text.js
async function liveSentence(model) {
  try {
    const m = await import("../city/sentence.js");
    const plain = m && typeof m.headline === "function" ? m.headline(model) : null;
    if (typeof plain === "string" && plain.trim()) {
      const [first, ...more] = plain.trim().split(/(?<=\.)\s+/), lead = /^(\d+)(.*)$/.exec(first.replace(/\.$/, ""));
      return { name: model.city.name, lead: lead ? "" : first, num: lead ? lead[1] : null, rest: lead ? lead[2] : "", more: more.join(" "), have: (model.coverage || {}).have, total: (model.coverage || {}).total };
    }
  } catch (e) { /* not built yet or not loadable: the plain sentence */ }
  return sampleSentence(model);
}
function sample() {
  const body = h("div.n-entry-sample-in");
  const el = h("section.n-entry-sec.n-entry-sample", { "aria-labelledby": "n-entry-sample-t", hidden: true }, body);
  const fill = async () => {
    const model = await soft(net.city(SAMPLE_KEY));
    const s = model && (await liveSentence(model));
    if (!s) return;
    const key = encodeURIComponent(model.city.key), cov = model.coverage || {};
    body.replaceChildren(
      head("n-entry-sample-t", "דוגמה חיה", `דף היישוב של ${s.name}`),
      h("p.n-entry-sentence.rv", s.lead, s.num != null ? h("b.n-entry-attn.ltr", { "data-count": "" }, String(s.num)) : null, s.rest),
      s.more ? h("p.n-entry-more.rv", s.more) : null,
      h("p.n-entry-basis.rv", [s.have ? `מבוסס על ${s.have} מתוך ${s.total} מדדים` : null, model.builtAt ? `עודכן ${dateHe(model.builtAt)}` : null].filter(Boolean).join(" · ")),
      h("p.n-entry-sample-go.rv", h("a", { href: `#/c/${key}` }, `לדף של ${s.name}`, icon("left")), h("a", { href: `#/c/${key}/coverage` }, "מה נמצא ומה חסר")));
    el.hidden = false;
  };
  return { el, fill: () => fill() };
}

// ── what is checked: the four categories as a plain text list, and what the figures are set against ──
function domains() {
  const list = h("ul.n-entry-doms"), lead = h("p.n-entry-lead.rv");
  const el = section("n-entry-domains", "n-entry-dom-t", head("n-entry-dom-t", null, "מה בודקים ביישוב", lead), list);
  const fill = (hl, meta) => {
    const all = domainsOf(meta), ds = all.filter((d) => d.id !== "context");          // the categories are judged; the background of the town (who lives there) only describes it
    if (!ds.length) return;
    const total = ds.reduce((n, d) => n + d.n, 0), back = all.filter((d) => d.id === "context").reduce((n, d) => n + d.n, 0);
    const withTarget = (meta.indicators || []).filter((i) => i && i.guideline && i.guideline.judges).length;          // the figures with an official target that judges: counted, never typed
    lead.textContent = `${cnt(ds.length, "תחום אחד", "תחומים")} ו-${cnt(total, "מדד אחד", "מדדים")}` + (back === 1 ? ", ועוד מדד רקע אחד, שמתאר את היישוב ואינו נשפט" : back ? `, ועוד ${back} מדדי רקע, שמתארים את היישוב ואינם נשפטים` : "") + `. כל מדד מושווה לממוצע הארצי וליישובים דומים כשאפשר` + (withTarget ? `, ול-${withTarget} מהם יש גם יעד רשמי שפרסם משרד הבריאות` : "") + ".";
    list.replaceChildren(...ds.map((d, i) => h("li.rv", { style: { "--d": i % 3 } }, h("span.n-entry-dom-n", d.label), h("span.n-entry-dom-k", cnt(d.n, "מדד אחד", "מדדים")))));
    el.hidden = false;
  };
  return { el, fill };
}

// ── the sources: who publishes the numbers, each dataset a link to the original ──
function sources() {
  const grid = h("div.n-entry-srcs"), lead = h("p.n-entry-lead.rv");
  const el = section("n-entry-sources", "n-entry-src-t", head("n-entry-src-t", "המקורות", "מאיפה המספרים", lead), grid);
  const fill = (hl, meta) => {
    const groups = sourcesOf(meta);
    if (!groups.length) return;
    const n = groups.reduce((t, g) => t + g.items.length, 0);
    lead.replaceChildren(`${cnt(n, "מקור רשמי אחד", "מקורות רשמיים")}. כל קישור פותח את הנתונים המקוריים. היעדים הרשמיים והמסמכים שמאחוריהם מפורטים בעמוד `, h("a", { href: "#/method" }, "שיטה ומקורות"), ".");
    grid.replaceChildren(...groups.map((g) => h("div.n-entry-src-g.rv", h("h3.n-entry-src-p", g.publisher),
      h("ul", g.items.map((s) => h("li", s.url ? h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.name, h("span.sr", " (נפתח בלשונית חדשה)")) : s.name))))));
    el.hidden = false;
  };
  return { el, fill };
}

// ctx: the router's frozen ctx. Returns a View; view.ready resolves when every part has answered or given up (the tests wait for it)
export function entryView(ctx) {
  const search = townSearch({ big: true, label: "חיפוש יישוב", placeholder: narrow() ? "חפשו יישוב…" : "חפשו יישוב, למשל: שדרות, חיפה, אום אל-פחם" });
  const input = search.querySelector("input");
  const find = h("div.n-entry-find", h("div.n-entry-search", search), h("div.n-entry-under", followedRow(ctx, input), compareLink(ctx, input)));
  const band = homeBand({
    eyebrow: "נתונים רשמיים · לכל יישוב בישראל", id: "n-entry-h1",
    title: ["איך מצב הבריאות ", h("span.n-entry-accent", "ביישוב שלכם?")],
    basis: h("span.n-entry-lede", "בחרו יישוב וקבלו דף אחד: מה הולך טוב, מה דורש תשומת לב, מה כדאי לעשות ומה חסר."),
    ask: find, art: true
  });
  band.classList.add("n-entry-band");
  const parts = [trust(), how(), sample(), domains(), sources()];
  const node = h("div.n-entry", topRow(ctx), band, h("div.n-entry-body", parts.map((p) => p.el)));
  // the numbers, the domains and the sources come from the server; each part fills itself or stays out
  const ready = Promise.all([soft(net.health()), soft(net.meta())]).then(([hl, meta]) => Promise.all(parts.map((p) => Promise.resolve().then(() => p.fill(hl, meta)).catch(warn("a part")))));
  return { node, band: false, landing: true, active: "entry", ready };
}
