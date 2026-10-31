// "יש טעות בנתון?": a dialog that sends what is wrong together with where the reader was. The typed text is never lost:
// it stays in the field when sending fails, and a draft is kept for the session if the dialog is closed.
import { h } from "../../ui.js";
import { act, announce, openDialog, safeSession } from "./base.js";
import { copyText } from "./share.js";

const DRAFT = "cp2-feedback-draft", MAX_MSG = 2000, MAX_MAIL = 200, TIMEOUT = 15000;
const SEND = "שליחה", SENDING = "שולח", NO_ANSWER = "אין תשובה מהשרת. אפשר לנסות שוב.";
let endpointFromConfig = null;
try { import("../config.js").then((m) => { endpointFromConfig = m.FEEDBACK_ENDPOINT || null; }, () => {}); } catch (e) { /* no config module yet */ }

// the JSON the server receives. ctx: { key, name, indicator, route, url, dataDate } (route and url default to where the reader is)
export function buildFeedback(ctx = {}, message = "", email = "", loc = globalThis.location) {
  const here = loc || {};
  return {
    message: String(message).trim().slice(0, MAX_MSG), email: String(email).trim().slice(0, MAX_MAIL),
    key: ctx.key == null ? "" : String(ctx.key), name: ctx.name || "", indicator: ctx.indicator || "",
    route: ctx.route != null ? ctx.route : here.hash || "", url: ctx.url != null ? ctx.url : here.href || "", dataDate: ctx.dataDate || ""
  };
}

// the same details as plain text, for "copy the details" when sending failed
export function feedbackDetails(p) {
  return ["מה לא נכון: " + p.message, p.email && "אימייל: " + p.email, p.name && "יישוב: " + p.name + (p.key ? ` (${p.key})` : ""), p.indicator && "מדד: " + p.indicator,
    p.url && "קישור: " + p.url, p.dataDate && "תאריך הנתונים: " + p.dataDate].filter(Boolean).join("\n");
}

// { ok: true } or { ok: false, error }; the server answers {ok:true}. A request that never answers ends after `timeout` with { ok: false, timedOut: true },
// also when the fetch ignores the abort signal.
export async function sendFeedback(payload, { fetchFn = globalThis.fetch, endpoint, timeout = TIMEOUT } = {}) {
  const ctl = typeof AbortController === "function" ? new AbortController() : null;
  let timer;
  const late = new Promise((done) => { timer = setTimeout(() => { if (ctl) ctl.abort(); done({ ok: false, timedOut: true, error: "timeout" }); }, timeout); });
  const attempt = async () => {
    try {
      const r = await fetchFn(endpoint || endpointFromConfig || "/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined });
      let j = null;
      try { j = await r.json(); } catch (e) { /* no body */ }
      return r.ok && (!j || j.ok !== false) ? { ok: true } : { ok: false, error: (j && j.error) || "status " + r.status };
    } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
  };
  try { return await Promise.race([attempt(), late]); } finally { clearTimeout(timer); }
}

export function openFeedback(ctx = {}, opener, io = {}) {
  const msg = h("textarea.n-kit-input", { id: "n-kit-fb-msg", rows: 5, maxlength: MAX_MSG, required: true, "aria-describedby": "n-kit-fb-status" });
  const mail = h("input.n-kit-input", { id: "n-kit-fb-mail", type: "email", autocomplete: "email", maxlength: MAX_MAIL, dir: "ltr" });
  const status = h("p.n-kit-msg", { id: "n-kit-fb-status", role: "status" });
  const details = h("textarea.n-kit-input", { rows: 5, readonly: true, hidden: true, "aria-label": "הפרטים להעתקה", dir: "rtl" });
  const copyBtn = act("button", { type: "button", hidden: true }, "link", "העתקת הפרטים");
  const send = h("button.btn.primary", { type: "submit" }, SEND);
  const form = h("form.n-kit-form", { novalidate: true },
    h("p", "כתבו מה לא נראה נכון. היישוב, המדד, הקישור ותאריך הנתונים יצורפו אוטומטית."),
    h("label.n-kit-field", { for: "n-kit-fb-msg" }, h("span", "מה לא נכון?"), msg),
    h("label.n-kit-field", { for: "n-kit-fb-mail" }, h("span", "אימייל, אם תרצו תשובה"), mail),
    status, details, copyBtn,
    h("p.n-kit-note", "הפרטים נשמרים רק לטיפול בפנייה."),
    send);
  msg.value = safeSession.get(DRAFT) || "";
  msg.addEventListener("input", () => { safeSession.set(DRAFT, msg.value); msg.removeAttribute("aria-invalid"); });

  const say = (text, kind) => { status.textContent = text; status.className = "n-kit-msg" + (kind ? " is-" + kind : ""); };
  let payload = null, dlg, closed = false, sending = false;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (sending) return;                            // the button is only marked aria-disabled while a request is held (a disabled button drops the focus to the page): a second press ends here
    if (!msg.value.trim()) { msg.setAttribute("aria-invalid", "true"); say("כתבו כמה מילים על מה שלא נראה נכון.", "err"); msg.focus(); return; }
    payload = buildFeedback(ctx, msg.value, mail.value);
    sending = true; send.setAttribute("aria-disabled", "true"); send.setAttribute("aria-busy", "true"); send.textContent = SENDING; say(SENDING + "…");
    const res = await sendFeedback(payload, io);
    sending = false; send.removeAttribute("aria-disabled"); send.removeAttribute("aria-busy"); send.textContent = SEND;
    if (res.ok) {
      safeSession.del(DRAFT);
      form.replaceChildren(h("p.n-kit-msg.is-ok", { role: "status" }, "תודה, הדיווח התקבל"));
      announce("תודה, הדיווח התקבל");
      if (!closed) dlg.closeBtn.focus();
    } else {
      say(res.timedOut ? NO_ANSWER : "השליחה לא הצליחה. אפשר להעתיק את הפרטים.", "err");
      details.value = feedbackDetails(payload); details.hidden = false; copyBtn.hidden = false;
    }
  });
  copyBtn.addEventListener("click", async () => {
    if (await copyText(details.value)) { announce("הפרטים הועתקו"); say("הפרטים הועתקו", "ok"); } else { details.focus(); details.select(); }
  });
  dlg = openDialog({ title: "יש טעות בנתון?", body: form, opener, focus: msg, onClose: () => { closed = true; } });
  return dlg;
}

// the link in the closing row of an answer, the indicator hero, the briefing and the footer. ctx may be a function (read when pressed).
export function feedbackLink(ctx, { label = "יש טעות בנתון?" } = {}) {
  const btn = act("button", { type: "button", "aria-haspopup": "dialog" }, "alert", label);
  btn.addEventListener("click", () => openFeedback(typeof ctx === "function" ? ctx() : ctx || {}, btn));
  return btn;
}
