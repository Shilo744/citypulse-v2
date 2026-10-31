// Everything the product keeps on the device goes through here. Every call is in try/catch: private windows, blocked site data and quota
// errors never reach a page (the lists then live in memory for the session). Tests swap the backend with use().
import { KEYS, MAX_RECENT, MAX_FAV } from "./config.js";
import { isKey } from "./net.js";

let backend = null, forced = false;
const mem = new Map();            // the fallback when the real storage throws
const pick = () => { if (forced) return backend; try { return globalThis.localStorage || null; } catch (e) { return null; } };

export const use = (b) => { backend = b; forced = b !== undefined; };      // use(undefined) goes back to the real storage

export function get(key, fallback = null) {
  try { const s = pick(); if (s) { const v = s.getItem(key); return v == null ? (mem.has(key) ? mem.get(key) : fallback) : v; } } catch (e) { /* blocked */ }
  return mem.has(key) ? mem.get(key) : fallback;
}
export function set(key, value) {
  mem.set(key, String(value));
  try { const s = pick(); if (s) { s.setItem(key, String(value)); return true; } } catch (e) { /* blocked or full */ }
  return false;
}
export function remove(key) {
  mem.delete(key);
  try { const s = pick(); if (s) s.removeItem(key); } catch (e) { /* blocked */ }
}
export function getJSON(key, fallback) {
  const raw = get(key, null);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}
export const setJSON = (key, value) => set(key, JSON.stringify(value));
// is the real storage usable (the footer says so in one sentence when it is not)
export function available() {
  try { const s = pick(); if (!s) return false; const k = "cp2-probe"; s.setItem(k, "1"); s.removeItem(k); return true; } catch (e) { return false; }
}

// a list of { key, name, t } kept newest first. What is read is checked like what is written: only well-formed towns, never more than max (a list from an older
// version or a tampered one could hold thousands)
const wellFormed = (x) => !!x && typeof x === "object" && isKey(x.key) && typeof x.name === "string" && x.name !== "" && x.name.length <= 100;
function townList(storageKey, max, { moveToFront }) {
  const read = () => { const v = getJSON(storageKey, []); return Array.isArray(v) ? v.filter(wellFormed).slice(0, max) : []; };
  return {
    list: read,
    has: (key) => read().some((x) => x.key === String(key)),
    add({ key, name }) {
      key = String(key);
      if (!wellFormed({ key, name })) return read();
      const cur = read(), old = cur.find((x) => x.key === key);
      const rest = cur.filter((x) => x.key !== key);
      const next = (moveToFront || !old ? [{ key, name, t: Date.now() }, ...rest] : cur.map((x) => (x.key === key ? { ...x, name } : x))).slice(0, max);
      setJSON(storageKey, next); return next;
    },
    remove(key) { const next = read().filter((x) => x.key !== String(key)); setJSON(storageKey, next); return next; },
    clear() { remove(storageKey); }
  };
}
export const recents = townList(KEYS.recent, MAX_RECENT, { moveToFront: true });
const favBase = townList(KEYS.fav, MAX_FAV, { moveToFront: false });
export const fav = {
  ...favBase,
  // true when the town is now a favourite; false when it was removed or the list is full
  toggle({ key, name }) {
    if (favBase.has(key)) { favBase.remove(key); return false; }
    if (favBase.list().length >= MAX_FAV) return false;
    favBase.add({ key, name }); return true;
  },
  full: () => favBase.list().length >= MAX_FAV
};

// the old app remembers the last town too; keep writing it so a switch back finds it
export const rememberLast = ({ key, name }) => setJSON(KEYS.last, { key, name });
export const shortcutsOn = () => get(KEYS.shortcuts, "on") !== "off";
export const setShortcuts = (on) => set(KEYS.shortcuts, on ? "on" : "off");
