// The live region (what a screen reader hears when a view changes), toasts, and the quiet "new data" line for a tab that was hidden for long.
import { STALE_AFTER_MIN } from "./config.js";
import { h } from "../ui.js";
import * as net from "./net.js";

let region = null, timer = 0;
const node = () => region || (region = document.getElementById("live"));

// announce(text) says it once; delay debounces a burst (the question switch uses 400 ms so that fast arrow keys read only the last answer)
export function announce(text, { delay = 0 } = {}) {
  clearTimeout(timer);
  const say = () => { const r = node(); if (!r) return; r.textContent = ""; setTimeout(() => { r.textContent = text; }, 20); };       // the empty step makes a repeated sentence be read again
  if (delay) timer = setTimeout(say, delay); else say();
}

// a short message at the bottom that is also announced
export function toast(text) {
  const t = h("div.toast", { role: "status" }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

// remember when the data was built; when the tab comes back after STALE_AFTER_MIN minutes and the server reports another build, show the line once
export function watchFresh(builtAt, onStale) {
  let hiddenAt = 0, shown = false;
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    if (shown || !hiddenAt || Date.now() - hiddenAt < STALE_AFTER_MIN * 60000) return;
    try { const hl = await net.health(); if (hl && hl.builtAt && builtAt && hl.builtAt !== builtAt) { shown = true; onStale(); } } catch (e) { /* offline: nothing to say */ }
  });
}
