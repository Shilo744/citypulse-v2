// What the briefing does at the moment of printing (SPEC 6.2). The sheet itself is css/product/brief.css (@media print); this file only fills the two lines that depend on the
// day and the address, and keeps a dark theme from printing as a black page.
import { dateHe } from "../../ui.js";

export const printedLine = (date = new Date()) => `הודפס ב-${dateHe(date.toISOString())}`;

// beforeprint: the date of printing and the address at the foot; the light theme for the sheet (the tokens do the rest); afterprint puts the theme back.
// root: the briefing node. Returns nothing; the listeners go away with the signal (the route changes).
export function watchPrint(root, { signal } = {}) {
  const html = document.documentElement;
  let was = null;
  const before = () => {
    const printed = root.querySelector("[data-printed]"), url = root.querySelector("[data-url]");
    if (printed) printed.textContent = printedLine();
    if (url) url.textContent = location.href;
    if (html.dataset.theme === "dark") { was = "dark"; html.dataset.theme = "light"; }
  };
  const after = () => { if (was) { html.dataset.theme = was; was = null; } };
  window.addEventListener("beforeprint", before, { signal });
  window.addEventListener("afterprint", after, { signal });
  signal && signal.addEventListener("abort", after, { once: true });
}
