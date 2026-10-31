// The follow star: a text button with a star, on the city home and in the town lists. It keeps up to 12 towns on this device (storage.fav).
import { h, icon } from "../../ui.js";
import { fav } from "../storage.js";
import { MAX_FAV } from "../config.js";
import { toast } from "../live.js";

const label = (on) => (on ? "הסרה מהמעקב" : "הוספה למעקב");

// town: { key, name }. showText false gives the icon alone (the label stays for screen readers).
export function starButton(town, { showText = true } = {}) {
  const key = String(town.key);
  const b = h("button.n-shell-star", { type: "button", "aria-pressed": "false", onclick: () => {
    const was = fav.has(key), now = fav.toggle({ key, name: town.name });
    if (!was && !now) toast(`המעקב מלא: עד ${MAX_FAV} יישובים`);
    window.dispatchEvent(new CustomEvent("n-fav"));
  } });
  const paint = () => {
    const on = fav.has(key);
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", `${label(on)}: ${town.name}`);
    b.replaceChildren(icon("star", 18), showText ? h("span", label(on)) : null);
  };
  paint();
  window.addEventListener("n-fav", paint);                      // another star of the same town (menu, hero) follows
  return b;
}
