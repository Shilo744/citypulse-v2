// The indicator tile (the ask page) and the small pieces the domain page builds its rows from (css/pages/domain.css, prefix .dm-).
// Re-exported by components.js: kpiCard, trendText, bullet. View layer only: every number comes from the figure it is given.
//   - a status is a coloured word with its icon, followed by the rest of its reason in words (never a capsule, never a colour alone);
//   - a figure on a small group (last.reliable === false) is shown but never ranked, trended, compared, coloured as a verdict or recommended on, and says so.
import { h, icon, toneOf, num, fmtVal, unitSuffix, ltr, outOf, compareLine, trendInfo, pts, statusReason, deltaUnit, STATUS } from "../ui.js";
import { sparkArea } from "../viz/time.js";
import { viz } from "../viz/core.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
export const SMALL_NOTE = "הקבוצה קטנה מכדי להשוות או להסיק";
export const isSmall = (a) => !!(a && a.last && a.last.reliable === false);
export const nameOf = (a) => a.short || a.label;
// the status that counts: a small group is never judged, whatever the model wrote
export const effStatus = (a) => (isSmall(a) ? "uncertain" : a.status);

const rankText = (a, L) => (L.rank ? [a.direction ? "מקום " : "לפי גובה הערך: מקום ", ...outOf(L.rank, L.of)] : L.reliable ? "" : "בסיס קטן, לא מדורג");

export function trendText(a) {
  const t = trendInfo(a);
  if (!t) return null;
  const first = a.history && a.history.first ? a.history.first.year : null;
  return h("span.cmp.tone-" + t.tone, icon(t.ic), h("span", t.word, t.delta != null && t.delta !== 0 ? [" ", h("span.nw", ["(", t.delta > 0 ? "עלייה" : "ירידה", " של ", ltr(num(Math.abs(t.delta), 1)), deltaUnit(a.unit), first ? " מאז " + first : "", ")"])] : null));
}

// ── the status, in words ─────────────────────────────────────────────────
// the status as a word with its icon and the rest of its reason: "דורש טיפול" + "כי חסרות 13.5 נק׳ ליעד…". The sentence is the model's own (statusReason), only cut after the status word.
export function reasonOf(a) {
  const st = STATUS[effStatus(a)] || STATUS.na;
  if (isSmall(a)) return { st, rest: SMALL_NOTE };
  const full = statusReason(a);
  if (!full) return { st, rest: null };
  if (full.startsWith(st.label + " כי ")) return { st, rest: full.slice(st.label.length + 1) };
  if (full.startsWith(st.label + ": ")) return { st, rest: full.slice(st.label.length + 2) };
  return { st, rest: full };
}
// brief: a background figure (never judged) is marked with its short label only; the sentence that explains it is said once on the page
export function whyLine(a, cls = "dm-why", { brief = false } = {}) {
  const { st, rest } = reasonOf(a);
  const bg = brief && effStatus(a) === "na";
  return h("p." + cls + ".tone-" + st.tone, h("span.pill", icon(st.icon), st.label), rest && !bg ? [" ", rest] : null);
}

// ── the figure: the big value with its unit, and its history against the national line ──
export function figure(a, { count = true } = {}) {
  const n = ltr(fmtVal(a.unit, a.last.v, a.unit === "index" ? 2 : 1)), sfx = a.unit !== "%" ? String(unitSuffix(a.unit) || "").trim() : "";
  if (count && !isSmall(a)) n.setAttribute("data-count", "");
  return [h("b.dm-num", n), sfx ? h("span.dm-unit", sfx) : null];
}
// null when there are fewer than two years: a single point is not a history
export function sparkFor(a, w = 150, ht = 40) {
  const S = (a.series || []).filter((s) => isNum(s.v));
  if (S.length < 2) return null;
  const all = a.series || [];
  return sparkArea(all.map((s) => ({ v: s.v, year: s.year })), all.map((s) => s.nat), { w, h: ht, unit: a.unit, label: nameOf(a) });
}

// ── the target ───────────────────────────────────────────────────────────
// the official target, in one short line (only when the figure has one)
function targetLine(a) {
  const L = a.last || a;
  if (L.target == null) return null;
  return L.meetsTarget ? { text: "עומד ביעד", tone: "good", ic: "check" } : { text: `חסרות ${a.unit === "%" ? pts(L.gapTarget) : num(Math.abs(L.gapTarget))} ליעד`, tone: "attn", ic: "target" };
}
export { targetLine };

// the value against the national mean and the official target on one thin bar. A bar is read like a number line: zero on the left, more to the right,
// and a target is something to reach (every target in the data is a "higher is better" share). Empty for a small group.
export function bullet(a) {
  const L = a.last || a;
  if (!isNum(L.v) || (L.nat == null && L.target == null) || L.reliable === false) return null;
  const max = a.unit === "%" ? 100 : Math.max(L.v, L.nat || 0, L.target || 0) * 1.15 || 1;
  const at = (v) => Math.max(0, Math.min(100, (v / max) * 100)) + "%";
  // the key reads in the order of the ticks on the bar (left to right, the smaller value first)
  const keys = [L.nat != null && [L.nat, h("span", h("i.k-nat", { "aria-hidden": "true" }), "ארצי ", ltr(fmtVal(a.unit, L.nat)))], L.target != null && [L.target, h("span", h("i.k-target", { "aria-hidden": "true" }), "יעד ", ltr(fmtVal(a.unit, L.target)))]]
    .filter(Boolean).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const say = `ערך ${fmtVal(a.unit, L.v)}` + (L.nat != null ? `, ארצי ${fmtVal(a.unit, L.nat)}` : "") + (L.target != null ? `, יעד ${fmtVal(a.unit, L.target)}` : "");
  return viz(h("div.dm-tb",
    h("div.dm-tb-track", h("i.dm-tb-fill.grow-x", { style: { width: at(L.v), "--origin": "0 50%" } }),
      L.nat != null ? h("i.dm-tb-tick.fade", { style: { left: at(L.nat) } }) : null,
      L.target != null ? h("i.dm-tb-tick.t.fade", { style: { left: at(L.target) } }) : null),
    h("div.dm-tb-key", keys)), { label: say });
}

// ── the tile ─────────────────────────────────────────────────────────────
// a light tile with no border: the name, a big number beside its history, the status with its reason, the comparison, the target bar (the ask page puts them in a grid)
export function kpiCard(a, key, { text } = {}) {
  const L = a.last, c = compareLine(a), tl = targetLine(a), sub = a.short && a.short !== a.label, small = isSmall(a);
  const spark = small ? null : sparkFor(a, 124, 46);
  const trend = small ? null : trendText(a);
  return h("a.dm-tile.rv.lift." + toneOf(effStatus(a)) + (a.stale ? ".is-stale" : "") + (small ? ".is-small" : ""), { href: `#/c/${key}/i/${a.id}` },
    h("div.dm-tile-name", sub ? a.short : a.label, sub ? h("small", a.label) : null),
    h("div.dm-tile-fig", h("div.dm-tile-num", figure(a)), spark ? h("div.dm-tile-spark", spark) : null),
    whyLine(a, "dm-tile-why"),
    small ? null : h("div.dm-tile-cmps", h("span.dm-cmp.tone-" + c.tone, icon(c.ic), c.text), tl ? h("span.dm-cmp.tone-" + tl.tone, icon(tl.ic), tl.text) : null, trend),
    text ? h("p.hint", text) : null,
    small || !tl ? null : bullet(a),
    h("div.dm-tile-foot", h("span", rankText(a, L)), h("span", ltr(String(L.year)))));
}
