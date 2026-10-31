// The keyboard help (a native <dialog>) and the single-key shortcuts: "/" focuses the town search, "?" opens the sheet.
// WCAG 2.1.4: single-key shortcuts have an off switch, stored in cp2-keys. The footer link opens the sheet even when they are off.
import { h } from "../../ui.js";
import { shortcutsOn, setShortcuts } from "../storage.js";
import { holdPage } from "./base.js";
import { glossaryHref } from "./glossary.js";

let dlg = null, release = null, back = null;        // release: gives the page back; back: where the reader was when the sheet opened

const ROWS = [
  ["/", "מעבר לחיפוש יישוב"], ["?", "פתיחת העזרה הזאת"], ["Esc", "סגירת תפריט, חלון או רשימה"],
  ["Tab", "מעבר בין קישורים וכפתורים; הקישור הראשון הוא ״דלגו לתוכן״"],
  ["← →", "בין חמש השאלות בעמוד היישוב (Home ו-End לראשונה ולאחרונה)"],
  ["↑ ↓", "בתוצאות החיפוש; Enter בוחר"]
];

function build() {
  const sw = h("button.n-shell-toggle", { type: "button", role: "switch", "aria-checked": String(shortcutsOn()), onclick: () => { const on = !shortcutsOn(); setShortcuts(on); sw.setAttribute("aria-checked", String(on)); sw.textContent = on ? "קיצורי מקלדת: פעילים" : "קיצורי מקלדת: כבויים"; } }, shortcutsOn() ? "קיצורי מקלדת: פעילים" : "קיצורי מקלדת: כבויים");
  const d = h("dialog.n-shell-help", { "aria-labelledby": "n-help-t", "aria-modal": "true" },
    h("form", { method: "dialog" },
      h("h2.n-shell-help-t", { id: "n-help-t" }, "קיצורי מקלדת"),
      h("dl.n-shell-keys", ROWS.map(([k, t]) => [h("dt", h("kbd", k)), h("dd", t)])),
      h("p.n-shell-help-note", "קיצור של מקש בודד פועל רק כשאין שדה פעיל. אפשר לכבות אותו כאן."),
      sw,
      h("p", h("a", { href: glossaryHref(), "data-glossary": "", onclick: () => d.close() }, "מילון מונחים")),
      h("button.btn.sm", { value: "close" }, "סגירה")));
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  d.addEventListener("close", () => {            // Esc, the button, the glossary link or a click on the dimmed page
    if (release) release();
    release = null;
    try { if (back && back.isConnected) back.focus(); } catch (e) { /* the opener is gone */ }
  });
  document.body.append(d);
  return d;
}
// opens the sheet as a modal: the page behind is held (inert), focus goes in, and Esc or "סגירה" return it to where the reader was
export function openHelp() {
  if (!dlg || !dlg.isConnected) dlg = build();
  if (dlg.open || typeof dlg.showModal !== "function") return;
  const d = dlg;
  const g = d.querySelector("[data-glossary]"); if (g) g.setAttribute("href", glossaryHref());          // the sheet is built once: the glossary link follows the town the reader is in now
  back = document.activeElement; release = holdPage();
  d.showModal();
  const first = d.querySelector("button, a[href]");
  if (first && !d.contains(document.activeElement)) first.focus();
}

const typing = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);

export function focusSearch() {
  const inputs = [...document.querySelectorAll("[data-town-search] input, .land-search input")].filter(visible);
  const i = inputs[0];
  if (i) { i.focus({ preventScroll: true }); i.select && i.select(); return true; }          // the field sits in the sticky bar: without preventScroll the page jumps to the top
  return false;
}

// one listener for the page; the shell calls it once
export function installKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(document.activeElement) || (dlg && dlg.open)) return;
    if (!shortcutsOn()) return;
    if (e.key === "/") { if (focusSearch()) e.preventDefault(); }
    else if (e.key === "?") { e.preventDefault(); openHelp(); }
  });
}
