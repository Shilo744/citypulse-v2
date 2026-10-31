// "Which answer sent the reader here": a row on the city home marks the question, the indicator page reads it to offer the way back.
// sessionStorage key cp2-from; when storage is blocked the marker lives in memory until the page is closed.
import { safeSession } from "./base.js";

const KEY = "cp2-from", TTL = 60 * 60 * 1000;
const okId = (s) => typeof s === "string" && /^[\w-]{1,24}$/.test(s);

// markFrom("2") or markFrom("2", "1031"): the question id, and the town it was asked for (a marker for another town is ignored)
export function markFrom(qid, key) {
  if (qid == null) return clearFrom();
  const q = String(qid);
  if (!okId(q)) return;
  safeSession.set(KEY, JSON.stringify({ q, k: key == null ? null : String(key), t: Date.now() }));
}
// readFrom() -> "2" or null. readFrom("1031") also returns null when the marker was written for another town.
export function readFrom(key) {
  let m = null;
  try { m = JSON.parse(safeSession.get(KEY)); } catch (e) { return null; }
  if (!m || !okId(m.q) || typeof m.t !== "number" || Date.now() - m.t > TTL) return null;
  if (key != null && m.k != null && m.k !== String(key)) return null;
  return m.q;
}
export function clearFrom() { safeSession.del(KEY); }
