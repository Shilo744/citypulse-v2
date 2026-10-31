// The town search: type-ahead on /api/search, with the favourites and the recent towns shown when the field is empty.
// It is a combobox (input + listbox). Choosing a town keeps the page you are on (nav.switchTown); the entry page and the not-found states use it too.
import { h, icon, num } from "../../ui.js";
import { go, switchTown, currentHash, build } from "../nav.js";
import * as net from "../net.js";
import { recents, fav } from "../storage.js";

// does the new town have this indicator? (the model lists the indicators it has a figure for)
const hasIndicator = async (key, id) => { const m = await net.city(key); return !!(m && m.indicators && m.indicators.some((a) => a.id === id)); };

// go to another town and stay on the same page when that makes sense (SPEC 4.5)
export async function pickTown(key) {
  const hash = await switchTown(currentHash(), key, hasIndicator);
  go(hash);
}

let uid = 0;
// opts: { onPick(town), placeholder, label, quiet, inline, big, autofocus, exclude: key }
export function townSearch(opts = {}) {
  const { onPick, placeholder = "חפשו יישוב…", label = "יישוב אחר", quiet = false, inline = false, big = false, autofocus = false, exclude = null } = opts;
  const n = ++uid, listId = "n-ts-" + n;
  const input = h("input", { type: "search", placeholder, autocomplete: "off", spellcheck: "false", enterkeyhint: "search", role: "combobox", "aria-label": label, "aria-expanded": "false", "aria-controls": listId, "aria-autocomplete": "list", autofocus });
  const list = h("div.results", { id: listId, role: "listbox", "aria-label": "יישובים", hidden: true, tabindex: "-1" });          // a scrolling list is a Tab stop in Chrome unless it says no
  const box = h("div.searchbox.n-shell-search" + (quiet ? ".n-shell-quiet" : "") + (inline ? ".n-shell-inline" : "") + (big ? ".big" : ""), { "data-town-search": "" }, icon("search"), input, list);
  let seq = 0, idx = -1;
  box.addEventListener("click", (e) => { if (e.target === box || e.target.closest("svg")) input.focus(); });          // the icon-only form in the top bar

  const setOpen = (v) => { list.hidden = !v; input.setAttribute("aria-expanded", String(v)); if (!v) { idx = -1; input.removeAttribute("aria-activedescendant"); } };
  const choose = (t) => { setOpen(false); input.value = ""; input.blur(); if (onPick) onPick(t); else pickTown(t.key).catch(() => go(build({ key: t.key }))); };
  const item = (t, i) => {
    const a = h("a", { href: build({ key: t.key }), role: "option", tabindex: "-1", id: `${listId}-${i}`, "aria-selected": "false", onclick: (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); choose(t); } },
      h("span", t.name), t.pop ? h("small", num(t.pop, 0) + " תושבים") : null);
    return a;
  };
  const group = (text) => h("div.n-shell-sgroup", { role: "presentation" }, text);
  const show = (rows, groups) => {
    idx = -1; list.replaceChildren();
    if (groups) groups.forEach(([title, arr]) => { list.append(group(title)); arr.forEach((t) => list.append(item(t, list.querySelectorAll("a").length))); });
    else if (!rows.length) list.append(h("div.none", input.value.trim() ? "לא נמצא יישוב בשם הזה עם נתונים" : "הקלידו שם יישוב"));
    else rows.forEach((t, i) => list.append(item(t, i)));
    setOpen(true);
  };
  // empty field: the favourites first, then the recent towns (without the one you are in)
  const remembered = () => {
    const f = fav.list().filter((t) => t.key !== exclude), fk = new Set(f.map((t) => t.key));
    const r = recents.list().filter((t) => t.key !== exclude && !fk.has(t.key));
    const gs = []; if (f.length) gs.push(["המעקב שלי", f]); if (r.length) gs.push(["נבחרו לאחרונה", r]);
    return gs;
  };
  const run = async () => {
    const q = input.value.trim(), my = ++seq;
    if (!q) { const gs = remembered(); if (gs.length) show([], gs); else setOpen(false); return; }
    try { const rows = await net.search(q); if (my === seq) show(rows.filter((t) => t.key !== exclude)); }
    catch (e) { if (my === seq) { list.replaceChildren(h("div.none", "החיפוש לא הצליח. נסו שוב.")); setOpen(true); } }
  };
  // scrolls the list only: scrollIntoView would move the whole page too (the field sits in the sticky bar)
  const reveal = (a) => { const r = a.getBoundingClientRect(), l = list.getBoundingClientRect(); if (r.top < l.top) list.scrollTop -= l.top - r.top; else if (r.bottom > l.bottom) list.scrollTop += r.bottom - l.bottom; };
  let t; input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 120); });
  input.addEventListener("focus", run);
  input.addEventListener("keydown", (e) => {
    const links = [...list.querySelectorAll("a")];
    if (e.key === "Enter") { e.preventDefault(); const l = links[Math.max(0, idx)]; if (l) l.click(); else if (input.value.trim()) net.search(input.value.trim()).then((r) => r[0] && choose(r[0])).catch(() => {}); return; }
    if (e.key === "Escape") { if (!list.hidden) { e.preventDefault(); setOpen(false); e.stopPropagation(); } return; }          // preventDefault: the search field would clear itself and open the list again
    if (e.key === "ArrowDown") idx = Math.min(links.length - 1, idx + 1); else if (e.key === "ArrowUp") idx = Math.max(0, idx - 1); else return;
    e.preventDefault();
    if (list.hidden) { run(); return; }
    links.forEach((l, i) => { l.classList.toggle("on", i === idx); l.setAttribute("aria-selected", String(i === idx)); });
    if (links[idx]) { input.setAttribute("aria-activedescendant", links[idx].id); reveal(links[idx]); }
  });
  document.addEventListener("click", (e) => { if (!box.contains(e.target)) setOpen(false); });
  box.addEventListener("focusout", (e) => { if (e.relatedTarget && !box.contains(e.relatedTarget)) setOpen(false); });          // Tab leaves the field: the list closes (the options are reached with the arrows, not with Tab)
  return box;
}
