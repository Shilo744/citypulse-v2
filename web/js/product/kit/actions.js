// The row of actions under a hero or at the end of an answer: share, briefing, download, follow, print, report a mistake.
// Text links with an icon (never capsules); 44 px targets on touch come from kit.css.
import { h } from "../../ui.js";
import { act } from "./base.js";
import { shareButton } from "./share.js";
import { csvButton, csvLink, exportHref } from "./csv.js";
import { feedbackLink } from "./feedback.js";

// the words of the copy table (SPEC 7.3): the hero row and the closing row of an answer
export const LABELS = {
  hero: { share: "שיתוף", brief: "דוח ליישוב (הדפסה / PDF)", download: "הורדת כל נתוני היישוב", page: "הורדת נתוני הדף", print: "הדפסה", report: "יש טעות בנתון?" },
  closing: { share: "שיתוף", brief: "לדוח ליישוב", download: "הורדת הטבלה של התשובה", page: "הורדת הטבלה של התשובה", print: "הדפסה", report: "יש טעות בנתון?" }
};
// the file is a CSV once, in the name the screen reader hears; the visible words say what the file holds (the whole town, this page, this answer)
const fileName = (label) => label + " (קובץ CSV)";
const ORDER = { hero: ["share", "brief", "download", "star"], closing: ["brief", "download", "print", "share", "report"] };

// actionsRow({ variant, items, key, q, title, download, star, feedback, icons, label })
//   variant   "hero" | "closing": picks the words and the default items
//   items     which actions, in order: share, brief, download, star, print, report
//   key, q    the town and the question (the share link, the briefing link, the file name)
//   title     the answer sentence: the title of the system share sheet
//   download  { getRows, name, label } for a file built here, or { href, label } for the server's file (default: the whole town, /api/city/<key>/export.csv); label says what the file holds,
//             and a page with its own table that gives none reads "הורדת נתוני הדף"; only the default is "כל נתוני היישוב"
//   star      a node, or a function that returns one (kit/star.js)
//   feedback  the context of the mistake report (see feedback.js), or a function that returns it
//   shareHref a function that returns the link to share (a page that is not an answer: a domain, an indicator, a compare set); default is the town link
//   icons     true: under 560 px only the icons show (the labels stay for screen readers)
export function actionsRow({ variant = "hero", items, key, q, title, download, star, feedback, icons = false, label = "פעולות", shareHref } = {}) {
  const words = LABELS[variant] || LABELS.hero, list = items || ORDER[variant] || ORDER.hero, kids = [];
  for (const id of list) {
    let el = null;
    if (id === "share") el = shareButton({ key, q, title, label: words.share, getUrl: shareHref });
    else if (id === "brief" && key != null) el = act("a", { href: `#/c/${encodeURIComponent(String(key))}/brief` }, "book", words.brief);
    else if (id === "download") {
      const own = download && (download.getRows || download.href), label = (download && download.label) || (own ? words.page : words.download);
      if (download && download.getRows) el = csvButton(download.getRows, download.name || "data", { key, label });
      else if (download && download.href) el = csvLink(download.href, label);
      else if (key != null) el = csvLink(exportHref(key), label);
      if (el) el.setAttribute("aria-label", fileName(label));
    } else if (id === "star") el = typeof star === "function" ? star() : star || null;
    else if (id === "print") { el = act("button", { type: "button" }, "print", words.print); el.addEventListener("click", () => window.print()); }
    else if (id === "report") el = feedbackLink(feedback || (() => ({ key })), { label: words.report });
    if (el) kids.push(el);
  }
  return h("div.n-kit-actions" + (icons ? ".n-kit-actions--icons" : ""), { role: "group", "aria-label": label }, kids);
}
