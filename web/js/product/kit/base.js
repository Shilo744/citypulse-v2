// The small parts every kit module shares: the live region, the action link, the native <dialog> helper and a session store that never throws.
import { h, icon } from "../../ui.js";

// say something to a screen reader (and let the shell's own region show it when there is one)
export function announce(text) {
  try { if (typeof window.__cpAnnounce === "function") { window.__cpAnnounce(text); return; } } catch (e) { /* the shell region failed: use ours */ }
  let live = document.getElementById("n-kit-live");
  if (!live) { live = h("div#n-kit-live.n-kit-live", { role: "status", "aria-live": "polite" }); document.body.append(live); }
  live.textContent = "";
  setTimeout(() => { live.textContent = text; }, 40);        // emptied first: the same sentence twice is read twice
}

// an action: text with an icon, never a capsule (tag is "button" or "a")
export function act(tag, attrs, iconName, label) {
  return h(tag + ".n-kit-act", attrs, iconName ? icon(iconName) : null, h("span.n-kit-act-label", label));
}
export function setActLabel(el, iconName, label) {
  el.replaceChildren(icon(iconName), h("span.n-kit-act-label", label));
}

// sessionStorage with a memory copy: a blocked or full store never throws, and the page still remembers until it is closed
const mem = new Map();
export const safeSession = {
  get(k) { try { const v = sessionStorage.getItem(k); if (v != null) return v; } catch (e) { /* blocked */ } return mem.has(k) ? mem.get(k) : null; },
  set(k, v) { mem.set(k, String(v)); try { sessionStorage.setItem(k, String(v)); } catch (e) { /* blocked or full */ } },
  del(k) { mem.delete(k); try { sessionStorage.removeItem(k); } catch (e) { /* blocked */ } }
};

// While a dialog is open the page behind it is not reachable. The platform makes it inert for a modal <dialog>; the attribute is also set by hand, so that a
// browser without showModal() and a screen reader's virtual cursor behave the same. Counted, because the next dialog opens before the last one's close event.
// Everything in <body> is held except dialogs, scripts and the live regions (an inert region is not announced).
let held = null;
export function holdPage() {
  if (!held) {
    const kids = Array.from(document.body.childNodes).filter((e) => e.nodeType === 1 && !/^(DIALOG|SCRIPT|NOSCRIPT)$/.test(e.tagName) && e.id !== "live" && !e.classList.contains("n-kit-live") && e.getAttribute("inert") == null);
    kids.forEach((e) => e.setAttribute("inert", ""));
    held = { kids, n: 0 };
  }
  const mine = held; mine.n++;
  let done = false;
  return () => {
    if (done) return; done = true;
    if (--mine.n === 0) { mine.kids.forEach((e) => e.removeAttribute("inert")); if (held === mine) held = null; }
  };
}

// one native <dialog> at a time: Esc and the focus trap come from the platform, the page behind is held (inert); focus goes in and returns to the opener
let current = null;
export function openDialog({ title, body, foot, opener, focus, wide, onClose } = {}) {
  if (current) current.close();
  const id = "n-kit-dlg-" + Math.random().toString(36).slice(2, 8);
  const back = opener || document.activeElement;          // where the reader was, when no opener is named
  const closeBtn = h("button.n-kit-textbtn", { type: "button" }, "סגירה");
  const dlg = h("dialog.n-kit-dlg" + (wide ? ".is-wide" : ""), { "aria-labelledby": id, "aria-modal": "true" },
    h("div.n-kit-dlg-in",
      h("h2.n-kit-dlg-title", { id }, title),
      h("div.n-kit-dlg-body", body),
      h("div.n-kit-dlg-foot", foot, closeBtn)));
  let done = false, release = () => {};
  const close = () => { if (dlg.close && dlg.open) dlg.close(); else finish(); };
  const finish = () => {
    if (done) return; done = true;
    window.removeEventListener("hashchange", close);
    dlg.remove(); release();
    const mine = current && current.dlg === dlg;
    if (mine) current = null;
    try { if (mine && back && back.isConnected) back.focus(); } catch (e) { /* the opener is gone */ }       // not when another dialog already took over
    if (onClose) onClose();
  };
  closeBtn.addEventListener("click", close);
  dlg.addEventListener("close", finish);
  dlg.addEventListener("click", (ev) => { if (ev.target === dlg) close(); });      // a click on the dimmed page
  dlg.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !dlg.showModal) close(); });
  window.addEventListener("hashchange", close);
  document.body.append(dlg);
  release = holdPage();
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  (focus || closeBtn).focus();
  current = { dlg, close };
  return { dlg, close, closeBtn };
}
