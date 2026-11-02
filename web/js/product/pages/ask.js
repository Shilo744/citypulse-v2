// The ask page in the product: the old module's answers and charts stay as they are; the opening is a title zone that holds the same question field as the rest of the
// product (entry/askfield.js), six sample questions as hairline rows, and the words around them (AI line, privacy line, vocabulary note). The last section of the page opens the chat of
// the watsonx Orchestrate agent (kit/orchestrate.js); IBM's script is requested only when that button is pressed.
// The old module keeps its own form (hidden): the new field and the sample rows send through it, so one request runs at a time exactly as before.
// Every text that appears in the page passes the token filler (no braces ever show) and the answers pass the vocabulary guard. Styles: css/product/pages/ask.css (n-pg-ask-).
import { h } from "../../ui.js";
import { FEATURES } from "../config.js";
import { titleBand, demoteH1 } from "../band.js";
import { askField, emptyMessage } from "../entry/askfield.js";
import { glossaryHref } from "../kit/glossary.js";
import { agentSection } from "../kit/orchestrate.js";
import * as D from "../city/data.js";
import { fillTokens, hasToken, vocab } from "../entry/text.js";
import { watchAnswers } from "./asktowns.js";

// the question about similar towns is left out for a town that has no answer to it (very small, or the home dims that question)
export const samples = (name, model) => [`איפה המצב הכי חלש ב${name}?`, "מה השתפר ומה הידרדר בחמש השנים האחרונות?", `איך מצב החיסונים ב${name} לעומת יישובים דומים?`,
  "אילו פערים יש בתוך היישוב?", `מה כדאי לעשות קודם ב${name}?`, `במה המצב ב${name} טוב?`].filter((q, i) => !(i === 2 && model && D.hasNoPeers(model)));

// a figure card of an answer ("המצב היום") says why it needs treatment in the words of the town page (city/data.js causeOf), not the old "חסרות 28 נק׳ ליעד משרד הבריאות" (a gap in days had no unit);
// the card is found by its link and its figure by the model of the page
const ID_IN_HREF = /\/i\/([^/?#]+)$/;
export function cardWhy(card, model) {
  const why = card.querySelector(".dm-tile-why"), pill = why && why.querySelector(".pill");
  if (!why || !pill || why.dataset.nCause) return;
  const m = ID_IN_HREF.exec(card.getAttribute("href") || ""), a = m && model.indicators.find((x) => x.id === decodeURIComponent(m[1])), cause = a && D.causeOf(a, { official: true });
  if (!cause) return;
  why.dataset.nCause = "1";
  const kids = [...why.childNodes];
  kids.slice(kids.indexOf(pill) + 1).forEach((n) => n.remove());
  why.append(" ", ...cause.map((s) => (typeof s === "string" ? s : h("span.ltr", s.n))));
}

// the token filler and the vocabulary guard for every text node under root (also the ones the old module adds later, when an answer arrives)
function guard(root, name, model) {
  const fix = (t, thread) => { const v = t.nodeValue; let s = hasToken(v) ? fillTokens(v, { city: name }) : v; if (thread) s = vocab(s); if (s !== v) t.nodeValue = s; };
  const walk = (n) => {
    if (n.nodeType === 3) { fix(n, !!(n.parentElement && n.parentElement.closest(".as-thread"))); return; }
    if (n.nodeType !== 1) return;
    if (n.matches && n.matches("a.dm-tile")) cardWhy(n, model);
    for (const a of ["title", "aria-label", "data-label"]) { const v = n.getAttribute(a); if (v && hasToken(v)) n.setAttribute(a, fillTokens(v, { city: name })); }
    n.childNodes.forEach(walk);
  };
  walk(root);
  if (typeof MutationObserver === "function") new MutationObserver((list) => { for (const m of list) m.addedNodes.forEach(walk); }).observe(root, { childList: true, subtree: true });
}

export function adapt(node, ctx) {
  const model = ctx.model, name = model.city.name, key = encodeURIComponent(model.city.key);
  const oldHero = node.querySelector(".as-hero"), oldInput = node.querySelector("#as-q"), oldForm = oldInput && oldInput.closest("form");
  if (!oldForm) return node;
  demoteH1(node);                                              // one h1 per page: the band has it
  oldHero.hidden = true;                                       // the old form stays in the page (it runs the request); its opening is replaced by the band
  const send = (q) => { oldInput.value = q; if (oldForm.requestSubmit) oldForm.requestSubmit(); else oldForm.dispatchEvent(new Event("submit", { cancelable: true })); };

  const field = askField({ name, onSubmit: send, id: "n-pg-ask-q" });
  const band = titleBand({ back: { href: `#/c/${key}`, label: "חזרה לשאלות" }, title: `מה תרצו לדעת על ${name}?`, id: "n-h1",
    lede: "כתבו שאלה בשפה חופשית. המספרים נלקחים מהנתונים הרשמיים, והבינה המלאכותית רק מנסחת את התשובה." });
  band.classList.add("n-pg-ask-band");
  band.querySelector(".n-band-in").append(h("div.n-pg-ask-field", field.node));

  // a second question field (the one under the newest answer) is refused when empty, with the same message and aria-invalid
  node.addEventListener("submit", (e) => {
    const input = e.target && e.target.querySelector && e.target.querySelector("input");
    if (!input || input.id === "n-pg-ask-q" || input.value.trim()) return;
    e.preventDefault(); e.stopImmediatePropagation();
    let msg = e.target.nextElementSibling;
    if (!msg || !msg.classList.contains("n-pg-ask-msg")) { msg = h("p.n-pg-ask-msg", { role: "status" }); e.target.after(msg); }
    msg.textContent = emptyMessage(name); input.setAttribute("aria-invalid", "true"); input.focus();
    input.addEventListener("input", () => { msg.textContent = ""; input.removeAttribute("aria-invalid"); }, { once: true });
  }, true);

  // while an answer is being built the old module marks its root busy: the new field waits too
  if (typeof MutationObserver === "function") new MutationObserver(() => field.setBusy(node.classList.contains("is-busy"))).observe(node, { attributes: true, attributeFilter: ["class"] });

  const rows = h("section.n-pg-ask-ex.no-print", { "aria-labelledby": "n-pg-ask-ex-t" },
    h("h2.n-pg-ask-ex-t", { id: "n-pg-ask-ex-t" }, "אפשר להתחיל מאחת מאלה"),
    h("ul", samples(name, model).map((q) => h("li", h("button", { type: "button", onclick: () => send(q) }, q)))),
    h("p.n-pg-ask-vocab", "בתשובות, ", h("a", { href: glossaryHref("concern") }, "דורש טיפול"), " הוא סימן לבדוק ולא פסק דין. מדד שמבוסס על קבוצה קטנה מדי מוצג כמו שהוא, בלי דירוג ובלי שיפוט."));
  if (D.hasNoPeers(model)) node.querySelectorAll(".as-facts .hero-fact").forEach((f) => { if (/יישובים דומים/.test(f.textContent)) f.remove(); });          // the count of similar towns invites to a comparison this town cannot have
  oldHero.after(rows);
  if (FEATURES.orchestrateChat) node.append(agentSection().node);                              // last in the page, under the answers: the chat of IBM's Orchestrate agent, loaded only when pressed
  guard(node, name, model);
  watchAnswers(node);
  return { node, band };
}
