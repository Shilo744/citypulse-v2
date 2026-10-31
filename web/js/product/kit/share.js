// Share: the link that reproduces the view, and the button that hands it to the system sheet or copies it.
import { h } from "../../ui.js";
import { announce, act, setActLabel, openDialog } from "./base.js";

let sharePages = false;                 // /api/health announces features.share when the server renders /s/<key> previews
export const setShareFeature = (on) => { sharePages = !!on; };
export const hasSharePages = () => sharePages;
// ask the server once; a failure leaves the hash link in place
let probed = null;
export function probeShareFeature(fetchFn = globalThis.fetch) {
  if (!probed) probed = Promise.resolve().then(() => fetchFn("/api/health")).then((r) => r.json()).then((j) => setShareFeature(!!(j && j.features && j.features.share))).catch(() => {});
  return probed;
}

// shareUrl("1031", "2") -> "https://host/n.html#/c/1031?q=2", or ".../s/1031?q=2" when the server has share pages.
// The short level of the town page has its own address (the alias route), not an answer: shareUrl("1031", "simple") -> "https://host/n.html#/c/1031/simple", or ".../s/1031?q=simple".
export function shareUrl(key, q, loc = globalThis.location) {
  const k = encodeURIComponent(String(key)), qs = q == null || q === "" ? "" : "?q=" + encodeURIComponent(String(q));
  if (sharePages) return `${loc.origin}/s/${k}${qs}`;
  return q === "simple" ? `${loc.origin}${loc.pathname}#/c/${k}/simple` : `${loc.origin}${loc.pathname}#/c/${k}${qs}`;
}

// copy text: the async clipboard first, then a hidden textarea; false when both are blocked
export async function copyText(text) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* blocked: try the old way */ }
  try {
    const ta = h("textarea.n-kit-live", { "aria-hidden": "true", tabindex: "-1", readonly: true });
    ta.value = text; document.body.append(ta); ta.select();
    const ok = document.execCommand && document.execCommand("copy");
    ta.remove();
    return !!ok;
  } catch (e) { return false; }
}

// when even that is blocked: the link in a field the reader can copy by hand
export function showLink(url, opener) {
  const field = h("input.n-kit-input", { type: "text", readonly: true, value: url, dir: "ltr", "aria-label": "הקישור" });
  openDialog({ title: "הקישור", body: [h("p", "ההעתקה האוטומטית לא הצליחה. אפשר לסמן ולהעתיק את הקישור:"), field], opener, focus: field });
  field.select();
}

const coarse = () => { try { return matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } };

// shareButton({ key, q, title, label, getUrl }): `title` is the answer sentence (the system sheet's title); getUrl() overrides the link (a compare set)
export function shareButton({ key, q, title, label = "שיתוף", getUrl } = {}) {
  if (typeof document !== "undefined") probeShareFeature();
  let timer;
  const btn = act("button", { type: "button" }, "share", label);
  btn.addEventListener("click", async () => {
    const url = getUrl ? getUrl() : shareUrl(key, q);
    if (coarse() && navigator.share) {
      try { await navigator.share({ title: title || document.title, url }); return; }
      catch (e) { if (e && e.name === "AbortError") return; /* the sheet failed: copy instead */ }
    }
    if (!(await copyText(url))) { showLink(url, btn); return; }
    announce("הקישור הועתק");
    setActLabel(btn, "check", "הקישור הועתק");
    clearTimeout(timer);
    timer = setTimeout(() => setActLabel(btn, "share", label), 2400);
  });
  return btn;
}
