// The preview video on the entry page (#/): a poster and a play button. Nothing is requested for the player until a visitor presses the button.
// With VIDEO.youtube set the player is YouTube's (youtube-nocookie.com); without it the player is the site's own file with English captions.
// The address of the site stays the same when the video changes: only config.js (the id, or the file under /media/) is edited. Styles: css/product/entry.css (n-entry-vid-).
import { h } from "../../ui.js";
import { VIDEO } from "../config.js";

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const YT_ID = /^[\w-]{6,20}$/;                                     // an id, never a free address: nothing else can end up in the frame

export const watchUrl = (video = VIDEO) => (YT_ID.test(video.youtube || "") ? `https://www.youtube.com/watch?v=${video.youtube}` : video.file);

// the player node of the current mode
export function playerFor(video = VIDEO) {
  if (YT_ID.test(video.youtube || "")) {
    return h("iframe.n-entry-vid-frame", {
      src: `https://www.youtube-nocookie.com/embed/${video.youtube}?autoplay=1&rel=0&cc_load_policy=1&hl=en&cc_lang_pref=en&playsinline=1`,
      title: "CityPulse: סרטון תדמית, קריינות באנגלית עם כתוביות", allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: true, referrerpolicy: "strict-origin-when-cross-origin"
    });
  }
  return h("video.n-entry-vid-frame", { controls: true, autoplay: true, playsinline: true, preload: "auto", poster: video.poster, "aria-label": "CityPulse: סרטון תדמית, קריינות באנגלית עם כתוביות" },
    h("source", { src: video.file, type: "video/mp4" }),
    h("track", { kind: "captions", srclang: "en", label: "English", src: video.captions, default: true }));
}

// a link under the search field: scrolls to the player and puts the focus on its play button (the player itself is still requested only after a press)
export function videoLink() {
  return h("button.n-entry-vidlink", {
    type: "button",
    onclick: () => {
      const t = document.getElementById("n-entry-vid-t"), box = t && t.closest("section");
      if (!box) return;
      const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (typeof box.scrollIntoView === "function") box.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
      const play = box.querySelector(".n-entry-vid-poster");
      if (play && typeof play.focus === "function") play.focus({ preventScroll: true });
    }
  }, h("span.n-entry-vidlink-i", { "aria-hidden": "true" }), `צפו בסרטון, ${mmss(VIDEO.seconds)}`);
}

// ctx: the router's ctx (announce). Returns { el, fill } like the other parts of the page; the section has no data to wait for
export function preview(ctx = {}) {
  const minutes = Math.max(1, Math.round(VIDEO.seconds / 60));
  const note = h("p.n-entry-vid-note", { role: "status" });
  const stage = h("div.n-entry-vid-stage");
  const start = () => {
    const player = playerFor(VIDEO);
    stage.replaceChildren(player);
    stage.classList.add("is-playing");
    if (typeof player.focus === "function") player.focus();
    if (ctx.announce) ctx.announce("הסרטון נטען");
    const src = player.querySelector ? player.querySelector("source") : null;
    if (src) src.addEventListener("error", () => { note.textContent = "הסרטון לא נטען כרגע. אפשר לנסות שוב בעוד רגע."; });
  };
  const poster = h("button.n-entry-vid-poster", {
    type: "button", "aria-label": `הפעלת סרטון התדמית, ${mmss(VIDEO.seconds)} דקות, קריינות באנגלית עם כתוביות`, onclick: start,
    style: { backgroundImage: `url(${VIDEO.poster})` }
  }, h("span.n-entry-vid-play", { "aria-hidden": "true" }), h("span.n-entry-vid-len", { "aria-hidden": "true" }, mmss(VIDEO.seconds)));
  stage.append(poster);
  const el = h("section.n-entry-sec.n-entry-video", { "aria-labelledby": "n-entry-vid-t" },
    h("div.n-entry-head", h("p.n-entry-eyebrow.rv", "סרטון תדמית"), h("h2.n-entry-h2.rv", { id: "n-entry-vid-t" }, `CityPulse ב-${minutes} דקות`),
      h("p.n-entry-lead.rv", "איך נתונים רשמיים הופכים לדף אחד לכל יישוב, ואיך סוכן watsonx Orchestrate ו‑IBM Bob משתלבים בעבודה. קריינות באנגלית, עם כתוביות.")),
    h("div.rv", stage),
    h("p.n-entry-vid-en", { lang: "en", dir: "ltr" }, `Watch the ${minutes}-minute preview: English narration, with captions.`),
    note);
  return { el, fill() {} };
}
