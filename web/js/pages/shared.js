// Small pieces several pages use: the share and print buttons and the jump bar.
import { h, icon, toast } from "../ui.js";

export const shareBtn = () => h("button.btn.sm.ghost", { type: "button", onclick: async () => { try { await navigator.clipboard.writeText(location.href); toast("הקישור הועתק"); } catch (e) { toast("ההעתקה לא הצליחה, אפשר להעתיק מסרגל הכתובת"); } } }, icon("share"), "העתקת קישור");
export const printBtn = () => h("button.btn.sm.ghost", { type: "button", onclick: () => { document.querySelectorAll(".page details").forEach((d) => { d.open = true; }); window.print(); } }, icon("print"), "הדפסה");     // a printed page cannot unfold what is folded

// a way around a long page: the chips scroll to a part and stay under the top bar (buttons, not links: a "#id" link would be read as a route)
export function tocNav(root, parts) {
  const have = parts.filter(([id]) => root.querySelector("#" + id));
  return have.length < 2 ? null : h("nav.toc.no-print", { "aria-label": "קפיצה לחלק בעמוד" }, h("span.hint", "קפצו אל:"),
    have.map(([id, label]) => h("button.chip", { type: "button", onclick: () => root.querySelector("#" + id).scrollIntoView({ behavior: "smooth", block: "start" }) }, label)));
}
