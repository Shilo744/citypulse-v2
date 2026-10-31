// The question field, one component for every page that asks the agent (the ask page; the city home may use it too). It owns the words around the field:
// the placeholder, the message for an empty send (aria-invalid + a live region), the line that says an AI words the answer, and the privacy line.
// It does not know what a question does: onSubmit(question) is the caller's. Styles: css/product/entry.css (prefix n-entry-ask-).
import { h, icon } from "../../ui.js";
import { infoHref, hereTown } from "../nav.js";

export const AI_LINE = "התשובה מנוסחת בבינה מלאכותית ומבוססת על מספרי המערכת בלבד.";
export const PRIVACY_LINE = "השאלה נשלחת לשירות בינה מלאכותית כדי לנסח תשובה, ואינה נשמרת בשרת.";
export const emptyMessage = (name) => `כתבו שאלה, למשל: איך החיסונים ב${name}?`;
export const placeholderFor = (name, narrow) => (narrow ? `שאלו על ${name}…` : `מה תרצו לדעת על הבריאות ב${name}?`);

const isNarrow = () => typeof matchMedia === "function" && matchMedia("(max-width: 520px)").matches;
let uid = 0;

// opts: { name, onSubmit(q), value, notes: true, id }. Returns { node, form, input, setBusy(on), invalid(text) }
export function askField({ name, onSubmit, value = "", notes = true, id } = {}) {
  const fid = id || "n-entry-askq-" + ++uid;
  const input = h("input", { id: fid, type: "text", name: "q", value, placeholder: placeholderFor(name, isNarrow()), autocomplete: "off", maxlength: "500", enterkeyhint: "send" });
  const send = h("button.n-entry-ask-go", { type: "submit" }, "שאלו", icon("left"));
  const msg = h("p.n-entry-ask-msg", { id: fid + "-msg", role: "status", "aria-live": "polite" });
  const form = h("form.n-entry-ask", { role: "search", novalidate: "" },
    h("div.n-entry-ask-row", h("label.sr", { for: fid }, "שאלה על " + name), icon("chat"), input, send), msg);
  const invalid = (text) => {
    msg.textContent = text || "";
    if (text) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", msg.id); } else { input.removeAttribute("aria-invalid"); input.removeAttribute("aria-describedby"); }
  };
  input.addEventListener("input", () => { if (input.getAttribute("aria-invalid")) invalid(""); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) { invalid(emptyMessage(name)); input.focus(); return; }
    invalid("");
    if (onSubmit) onSubmit(q);
  });
  const setBusy = (on) => { send.disabled = !!on; };
  if (notes) form.append(h("p.n-entry-ask-note", AI_LINE, " ", PRIVACY_LINE, " ", h("a", { href: infoHref("privacy", hereTown()) }, "פרטיות")));
  return { node: form, form, input, setBusy, invalid };
}
