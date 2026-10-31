// Entry of n.html: checks the browser, then starts the router. If the app cannot even load, the person gets a sentence, not a blank page.
const supports = (() => {
  try { return CSS.supports("color", "color-mix(in srgb, red, blue)") && CSS.supports("selector(:is(a))") && "IntersectionObserver" in window; } catch (e) { return false; }
})();
if (!supports) { const b = document.getElementById("oldbrowser"); if (b) b.hidden = false; }          // a warning; the app still starts

import("./app.js").then((m) => m.start()).catch((e) => {
  console.error("[product] could not start:", e);
  const v = document.getElementById("view");
  if (v) v.textContent = "הדף לא נטען. נסו לרענן.";
});
