// Trends (SPEC 5.4): the old page on the pale band. The eyebrow says the kind of page, the h1 says what is shown; the back link, the row of actions (the series of every figure with a history as a CSV file,
// share, print, report a mistake). The ledger of the three counts leaves the band and opens the page, under the lede that says which way is good (the old ledger's own words). The fan of lines was already drawn with tokens. Nothing is fetched here.
import { h, icon } from "../../ui.js";
import { actionsRow } from "../kit/actions.js";
import { neutral } from "../neutral.js";
import { causeText } from "../city/data.js";

// one row per figure and year: what the page draws, in the words of the page
export function seriesRows(model) {
  const rows = [];
  for (const a of model.indicators) {
    for (const s of a.series || []) if (Number.isFinite(s.v)) rows.push({ a, s });
  }
  const dom = (id) => (model.domains.find((d) => d.id === id) || {}).label || "";
  const columns = [{ title: "מדד", get: (r) => neutral(r.a.label) }, { title: "תחום", get: (r) => dom(r.a.domain) }, { title: "יחידה", get: (r) => r.a.unit }, { title: "שנה", get: (r) => r.s.year },
    { title: "ערך", get: (r) => r.s.v }, { title: "בסיס החישוב", get: (r) => (r.s.d == null ? "" : r.s.d) }, { title: "ארצי", get: (r) => (r.s.nat == null ? "" : r.s.nat) },
    { title: "האם אפשר לשפוט", get: (r) => (r.a.last && r.a.last.reliable === false ? "לא, קבוצה קטנה" : "כן") }];
  return { rows, columns };
}

// the status dot of a small chart says why in words (the hover text and the text for a screen reader). The old page takes ui.js statusReason ("חסרות 28.1 נק׳ ליעד משרד הבריאות", and a gap in days with no unit);
// here it is the sentence of the town page, from the same function (city/data.js causeText). A dot with no cause to name (a good figure, a background figure) keeps the old words, which neutral.js sets right.
const ID_IN_HREF = /\/i\/([^/?#]+)$/;
export function dotWords(root, model) {
  const byId = new Map(model.indicators.map((a) => [a.id, a]));
  root.querySelectorAll(".v-time-sm-dot").forEach((dot) => {
    const link = dot.closest("a"), m = link && ID_IN_HREF.exec(link.getAttribute("href") || ""), a = m && byId.get(decodeURIComponent(m[1])), say = a && causeText(a);
    if (!say) return;
    dot.setAttribute("title", say);
    const sr = dot.querySelector(".sr"); if (sr) sr.textContent = say;
  });
}

export function adapt(node, ctx) {
  const hero = node.querySelector(".tr-hero");
  if (!hero) return node;
  const { model } = ctx, key = model.city.key, name = model.city.name;
  dotWords(node, model);
  const eyebrow = hero.querySelector(".eyebrow"), h1 = hero.querySelector("h1");
  if (eyebrow) eyebrow.textContent = "מגמות והיסטוריה";
  if (h1) h1.textContent = `איך המדדים ב${name} השתנו לאורך השנים`;
  const top = hero.querySelector(".tr-hero-top");
  if (!top) return node;
  top.prepend(h("a.n-band-back.n-pg-trends-back.no-print", { href: `#/c/${encodeURIComponent(key)}` }, icon("right", 16), "דף היישוב"));
  // the band keeps the title, the verdict and the actions (a compact title zone); the ledger with its words, the facts and the notes become the first block under it
  const led = hero.querySelector(".tr-led");
  const ledWrap = led && led.parentNode !== hero ? led.parentNode : led;
  const read = h("div.n-pg-trends-read",
    led ? h("p.n-pg-trends-lede", "משתפר: המספר זז לכיוון הטוב. מידרדר: המספר זז לכיוון הלא טוב. כל מדד נשפט לפי הכיוון הטוב שלו.") : null,
    ledWrap, top.querySelector(".hero-meta"), hero.querySelector(".tr-hero-note"), top.querySelector(".hero-actions"));
  if (read.children.length) hero.after(read);
  top.append(h("div.n-pg-trends-actions.no-print", actionsRow({ variant: "hero", items: ["share", "download", "print", "report"], key, icons: true, label: "פעולות בדף המגמות", title: h1 ? h1.textContent : "",
    shareHref: () => location.href, download: { getRows: () => seriesRows(model), name: "trends" }, feedback: () => ({ key, name, dataDate: model.builtAt }) })));
  return node;
}
