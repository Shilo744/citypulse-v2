// Compare (SPEC 5.4): the old page on the pale band. The eyebrow says the kind of page, the h1 what is compared; which way is good (the page's own sentence) and the ledger open the page under the band; the back link, the row of
// actions: the table of every figure by town as a CSV file, share (the link keeps the chosen towns), print, report a mistake. The page opens with the towns of ?with=a,b,c: the old page reads
// them from ctx.params. Nothing is fetched here.
import { h, icon } from "../../ui.js";
import { actionsRow } from "../kit/actions.js";
import * as D from "../city/data.js";

// the table the page already shows (one row per figure, one column per town): the file has the same cells
export function tableRows(node) {
  const table = node.querySelector("#tr-rows-sec table");
  if (!table) return { rows: [], columns: [] };
  const text = (c) => c.textContent.replace(/\s+/g, " ").trim();
  const head = [...table.querySelectorAll("thead th")].map(text);
  const rows = [...table.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map(text));
  return { rows, columns: head.map((title, i) => ({ title, get: (r) => r[i] })) };
}

// a very small town is not set against similar towns: the sentence that names them as the default leaves the note under the title (the rest of the note says how to read the marks)
function noPeers(node) {
  node.querySelectorAll(".tr-keynote").forEach((p) => {
    [...p.childNodes].forEach((n) => { if (n.nodeType === 3) n.nodeValue = n.nodeValue.replace(/ברירת המחדל היא יישובים דומים בגודל.s*/, ""); });
  });
}

// The old page names the columns of its matrix and the tabs of its map by the first words of the domain's name ("בריאות" would now stand for "בריאות ושירותי בריאות"): the short word becomes the
// name of the category in its own short form. The matrix and the tabs are drawn after the other towns arrive, so the text is also fixed when something is added to the page.
const SHORT = { "ילדים": "ילדים והורים", "בריאות": "בריאות ושירותים", "נפש": "נפש ורווחה" };
function categoryNames(root, signal) {
  const fix = (n) => {
    if (n.nodeType === 3) { const t = n.nodeValue.trim(); if (SHORT[t] && n.parentElement && !n.parentElement.closest(".tr-hero, a")) n.nodeValue = n.nodeValue.replace(t, SHORT[t]); return; }
    if (n.nodeType === 1) n.childNodes.forEach(fix);
  };
  fix(root);
  if (typeof MutationObserver === "function") {
    const mo = new MutationObserver((list) => list.forEach((m) => m.addedNodes.forEach(fix)));
    mo.observe(root, { childList: true, subtree: true });
    if (signal) signal.addEventListener("abort", () => mo.disconnect());
  }
}

// The three counts of the ledger (first place, middle, last place) used to scroll to the list and say nothing of which figures they count. Now a count filters the list to its own figures
// and says so above it, with a way back to all of them. The place of a figure is read from the row's own "N מתוך M" (first = 1, last = N of N, as the page counts them).
const BUCKETS = ["first", "mid", "last"];
function bucketOfRow(row) {
  const m = /(\d[\d,]*)\D+?(\d[\d,]*)/.exec((row.querySelector(".tr-rank") || {}).textContent || "");
  if (!m) return null;
  const rank = Number(m[1].replace(/,/g, "")), of = Number(m[2].replace(/,/g, ""));
  return rank === 1 ? "first" : rank === of ? "last" : "mid";
}
function pickGroups(node, name) {
  const led = node.querySelector(".tr-led"), list = node.querySelector("#tr-rows");
  if (!led || !list) return;
  const btns = [...led.querySelectorAll("button.tr-col")], cols = [...led.children];
  const rows = [...list.querySelectorAll(".tr-row")], total = rows.length;
  const say = h("p.n-pg-compare-pick", { role: "status", hidden: true });
  list.before(say);
  let cur = null;
  const apply = (b) => {
    cur = b;
    rows.forEach((r) => { r.hidden = !!b && bucketOfRow(r) !== b; });
    list.querySelectorAll(".tr-dom").forEach((d) => { d.hidden = ![...d.querySelectorAll(".tr-row")].some((r) => !r.hidden); });
    btns.forEach((x) => x.setAttribute("aria-pressed", String(cols.indexOf(x) === BUCKETS.indexOf(b))));
    if (!b) { say.hidden = true; say.replaceChildren(); return; }
    const n = rows.filter((r) => !r.hidden).length, where = { first: "במקום הראשון", mid: "באמצע", last: "במקום האחרון" }[b];
    say.hidden = false;
    say.replaceChildren(`מוצגים ${n} מדדים שבהם ${name} ${where} בין היישובים שבהשוואה, מתוך ${total}. `, h("button.n-pg-compare-all", { type: "button", onclick: () => apply(null) }, "הצגת כל המדדים"));
  };
  btns.forEach((btn) => {
    const b = BUCKETS[cols.indexOf(btn)];
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", (e) => {
      e.stopImmediatePropagation(); e.preventDefault();
      apply(cur === b ? null : b);
      say.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, true);
  });
}

export function adapt(node, ctx) {
  const hero = node.querySelector(".tr-hero");
  if (!hero) return node;
  const { model } = ctx, key = model.city.key, name = model.city.name;
  if (D.isVerySmallTown(model)) noPeers(node);
  categoryNames(node, ctx.signal);
  pickGroups(node, name);
  const eyebrow = hero.querySelector(".eyebrow"), h1 = hero.querySelector("h1");
  if (eyebrow) eyebrow.textContent = "השוואה ליישובים";
  if (h1) h1.textContent = `השוואה בין ${name} ליישובים אחרים`;
  const top = hero.querySelector(".tr-hero-top");
  if (!top) return node;
  top.prepend(h("a.n-band-back.n-pg-compare-back.no-print", { href: `#/c/${encodeURIComponent(key)}` }, icon("right", 16), "דף היישוב"));
  // the band keeps the title and the verdict; which way is good, the ledger and the facts open the page under it
  const led = hero.querySelector(".tr-led"), ledWrap = led && led.parentNode !== hero ? led.parentNode : led;
  const read = h("div.n-pg-compare-read",
    !hero.classList.contains("tr-calm") ? h("p.n-pg-compare-lede", "בכל מדד ימינה הוא הצד הטוב יותר, גם כשנמוך יותר טוב יותר.") : null,
    ledWrap, top.querySelector(".hero-meta"), hero.querySelector(".tr-hero-note"));
  if (read.children.length) hero.after(read);
  const items = node.querySelector("#tr-rows-sec table") ? ["share", "download", "print", "report"] : ["share", "print", "report"];
  top.append(h("div.n-pg-compare-actions.no-print", actionsRow({ variant: "hero", items, key, icons: true, label: "פעולות בדף ההשוואה", title: h1 ? h1.textContent : "",
    shareHref: () => location.href, download: { getRows: () => tableRows(node), name: "compare", label: "הורדת טבלת ההשוואה" }, feedback: () => ({ key, name, dataDate: model.builtAt }) })));
  return node;
}
