// The level of the town page: "simple" (במבט אחד) or "full" (הפרטים המלאים). No DOM, so node (the tests) can import it.
// The choice is kept on the device under KEYS.view; with storage blocked it lives in memory until the page closes (storage.js).
// There is one page and no redirect: the choice only decides which level the page opens at (chooseLevel), and the switch in the head changes it in place.
import * as storage from "../storage.js";
import { KEYS } from "../config.js";

export const VIEWS = ["simple", "full"];
export const isView = (v) => VIEWS.includes(v);

export const readView = () => { const v = storage.get(KEYS.view, null); return isView(v) ? v : null; };
export const writeView = (v) => (isView(v) ? storage.set(KEYS.view, v) : false);

const enc = encodeURIComponent;
export const simpleHref = (key) => `#/c/${enc(key)}/simple`;
export const fullHref = (key) => `#/c/${enc(key)}`;

// the ?q= values that name a section of the full level
export const SECTION_QS = ["weak", "changed", "peers", "first", "missing"];

// which level the page opens at: ?v= for that visit, the alias route (#/c/<key>/simple), ?q=simple (a share link), a ?q= that names a section (only the full level has it),
// then the stored choice, then the short level (a first visit opens "במבט אחד"; the full level is one tap away)
export function chooseLevel({ alias = false, v = null, q = null, stored = null } = {}) {
  if (isView(v)) return v;
  if (alias || q === "simple") return "simple";
  if (SECTION_QS.includes(q)) return "full";
  return isView(stored) ? stored : "simple";
}
