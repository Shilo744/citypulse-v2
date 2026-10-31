// Shared pieces: page head, section head, empty state, search box, skeleton. The bigger ones live in pages/ (one owner each) and are re-exported here,
// so every page imports them from one place: kpiCard, trendText, bullet (pages/kpi.js), prioRow, findingList (pages/prio.js), recCard, horizonLabel (pages/rec.js).
import { h, icon, num } from "./ui.js";
import { search } from "./api.js";
export { kpiCard, trendText, bullet } from "./pages/kpi.js";
export { prioRow, findingList } from "./pages/prio.js";
export { recCard, horizonLabel } from "./pages/rec.js";

export const chip = (ic, text) => h("span.chip", ic ? icon(ic) : null, text);
export function pageHead(eyebrow, title, chips, extra) {
  return h("div.pagehead", h("div", eyebrow ? h("div.eyebrow", eyebrow) : null, h("h1.h1", title), chips && chips.length ? h("div.meta", chips) : null), extra || null);
}
export const secHead = (title, sub, link) => h("div.sechead", h("div", h("h2.h2", title), sub ? h("p", sub) : null), link || null);
export const empty = (ic, title, text) => h("div.card.empty", icon(ic), h("b", title), text ? h("p", text) : null);

// ── the type-ahead: entry page (big), top bar, compare ───────────────────
export function searchBox({ onPick, placeholder = "חפשו יישוב: שדרות, חיפה, אום אל-פחם…", autofocus = false, big = false, openOnFocus = true } = {}) {
  const input = h("input", { type: "search", placeholder, autocomplete: "off", "aria-label": "חיפוש יישוב", role: "combobox", "aria-expanded": "false", autofocus });
  const list = h("div.results", { hidden: true, role: "listbox" });
  const goBtn = big ? h("button.go", { type: "button", onclick: () => go() }, "חיפוש") : null;
  const box = h("div.searchbox" + (big ? ".big" : ""), icon("search"), input, goBtn, list);
  let idx = -1, seq = 0;
  const setOpen = (v) => { list.hidden = !v; input.setAttribute("aria-expanded", String(v)); };
  const show = (arr) => {
    idx = -1; list.replaceChildren();
    if (!arr.length) list.append(h("div.none", input.value ? "לא נמצא יישוב בשם הזה עם נתונים" : "הקלידו שם יישוב"));
    arr.forEach((r) => list.append(h("a", { href: onPick ? "#" : `#/c/${encodeURIComponent(r.key)}`, role: "option", onclick: (e) => { if (onPick) { e.preventDefault(); onPick(r); setOpen(false); input.value = ""; } else setOpen(false); } },
      h("span", r.name), r.pop ? h("small", num(r.pop, 0) + " תושבים") : null)));
    setOpen(true);
  };
  // the button: take the best match for what is typed (or open the list when nothing is typed yet)
  const go = async () => {
    const q = input.value.trim();
    if (!q) { input.focus(); run(); return; }
    try { const r = await search(q); if (r[0]) { if (onPick) { onPick(r[0]); setOpen(false); input.value = ""; } else location.hash = `#/c/${encodeURIComponent(r[0].key)}`; } else show([]); } catch (e) { /* offline */ }
  };
  const run = async () => { const my = ++seq; try { const r = await search(input.value.trim()); if (my === seq) show(r); } catch (e) { /* offline */ } };
  let t; input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 120); });
  input.addEventListener("focus", () => { if (openOnFocus) run(); });
  input.addEventListener("keydown", (e) => {
    const links = [...list.querySelectorAll("a")];
    if (e.key === "ArrowDown") { idx = Math.min(links.length - 1, idx + 1); } else if (e.key === "ArrowUp") { idx = Math.max(0, idx - 1); }
    else if (e.key === "Enter") { const l = links[Math.max(0, idx)]; if (l) { e.preventDefault(); l.click(); input.blur(); } return; } else if (e.key === "Escape") { setOpen(false); return; } else return;
    e.preventDefault(); links.forEach((l, i) => l.classList.toggle("on", i === idx));
    if (links[idx]) links[idx].scrollIntoView({ block: "nearest" });
  });
  document.addEventListener("click", (e) => { if (!box.contains(e.target)) setOpen(false); });
  return box;
}

export const skeleton = (n = 3) => h("div", { "aria-busy": "true", "aria-label": "טוען" }, h("div.sk", { style: { height: "34px", width: "30%", marginBottom: "10px" } }), h("div.sk", { style: { height: "16px", width: "55%", marginBottom: "26px" } }),
  h("div.grid.g3", Array.from({ length: n }, () => h("div.card", h("div.sk", { style: { height: "18px", width: "60%", marginBottom: "14px" } }), h("div.sk", { style: { height: "34px", width: "40%", marginBottom: "14px" } }), h("div.sk", { style: { height: "8px" } })))));
