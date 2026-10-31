// One figure on the wall: a whole-cell link (to the figure's own page) with the mark of its status, its plain name, the value with unit and year,
// the trend against the national line and a small arrow that says which way is good. Hover and focus open a tooltip with the reason, the comparison
// and the trend in words. A small group is a hollow mark with its note and no line, delta or verdict; one year of data says so and draws no line.
import { h, svg, icon, ltr, iso, fmtVal, statusChip, compareLine, statusReason, trendInfo, directionNote, directionIcon, tipHead } from "../../ui.js";
import { bindTip, STATUS_WORD } from "../../viz/core.js";
import { sparkArea } from "../../viz/time.js";
import { kindOf, GROUP, SMALL_NOTE, valueText, unitWord, decimals } from "./data.js";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const WORD_KEY = { concern: "concern", watch: "watch", good: "good", strength: "strength", stale: "stale", none: "na", small: "uncertain" };

// the mark: a filled orange dot (needs treatment), an orange ring (watch), a teal dot (fine; a ring around it for a strength), a hollow grey ring (not judged, small group)
export const markEl = (kind) => h("i.lw-mark.lw-m-" + kind, { "aria-hidden": "true" });

// the staggered entrance is by domain: every mark of a spark waits (--i) as long as its domain's place in the wall
export const staggerSpark = (el, i) => el.querySelectorAll(".draw, .fade, .pop").forEach((m) => m.style.setProperty("--i", String(Math.min(12, i))));

// the latest point pings softly: a ring in a group that fades in with the line (so that it never shows before the line), out of step with its neighbours
function addPing(sp, k) {
  const dot = sp.querySelector("circle.pop");
  if (!dot) return;
  dot.before(svg("g", { class: "fade" }, svg("circle", { class: "ping lw-ping", cx: dot.getAttribute("cx"), cy: dot.getAttribute("cy"), r: 4.5, style: { animationDelay: `-${((k * 0.53) % 2.4).toFixed(2)}s` } })));
}

function ariaOf(a, kind, val, unit, word) {
  const L = a.last || {}, small = kind === "small", t = small ? null : trendInfo(a);
  const bits = [`${a.label}: ${val == null ? "אין נתון" : val + (unit ? " " + unit : "")}`];
  if (isNum(L.year)) bits.push(`לשנת ${L.year}`);
  bits.push(small ? SMALL_NOTE : word);
  if (t) bits.push(`מגמה: ${t.word}`);
  if (!small) bits.push(directionNote(a.direction));
  return bits.join(". ") + ".";
}

// the tooltip: what the status is and why, how the figure stands against the nation, where it has been heading, which way is good
function tipNodes(a, kind, one) {
  const L = a.last || {}, small = kind === "small", dec = decimals(a), out = [tipHead(a.label)];
  out.push(h("div.lw-tt-s", small ? h("span.st.t-none", icon("info"), STATUS_WORD.uncertain) : statusChip(a.status)));
  if (small) out.push(h("p.lw-tt-p", SMALL_NOTE));
  else {
    const why = statusReason(a);
    if (why) out.push(h("p.lw-tt-p", why));
    const cmp = compareLine(a);
    out.push(h("p.lw-tt-p.tone-" + cmp.tone, icon(cmp.ic, 14), cmp.text));
    const t = trendInfo(a), f = a.history && a.history.first;
    if (t && f && isNum(f.v) && isNum(L.v)) out.push(h("p.lw-tt-p.tone-" + t.tone, icon(t.ic, 14), `מאז ${f.year}: ${t.word} (מ-${iso(fmtVal(a.unit, f.v, dec))} ל-${iso(fmtVal(a.unit, L.v, dec))})`));
    else if (one) out.push(h("p.lw-tt-p", "יש נתון לשנה אחת בלבד, ולכן אין מגמה."));
    out.push(h("p.lw-tt-d", directionNote(a.direction)));
  }
  if (isNum(L.year)) out.push(h("p.lw-tt-d", `נתון לשנת ${L.year}`));
  return out;
}

// di = the domain's place in the wall (staggers the entrance), k = the figure's place (puts its ping out of step)
export function wallCell(model, a, di = 0, k = 0) {
  const kind = kindOf(a), small = kind === "small", L = a.last || {}, val = valueText(a), unit = unitWord(a), word = STATUS_WORD[WORD_KEY[kind]];
  const series = a.series || [], pts = series.filter((s) => isNum(s.v)), line = !small && pts.length > 1, one = !small && val != null && pts.length < 2;
  const sp = line ? sparkArea(series.map((s) => ({ v: s.v, year: s.year })), series.map((s) => s.nat), { w: 76, h: 34, unit: a.unit, label: a.short || a.label }) : null;
  if (sp) { addPing(sp, k); staggerSpark(sp, di * 2); }
  const meta = small ? h("span.lw-note", SMALL_NOTE)
    : h("span.lw-meta", h("span.lw-meta-in", h("span.lw-dir", { "aria-hidden": "true" }, icon(directionIcon(a.direction), 12)), isNum(L.year) ? h("span.lw-year", ltr(String(L.year))) : null), h("span.lw-word", word));
  const cell = h("a.lw-cell.lw-k-" + kind, { href: `#/c/${encodeURIComponent(model.city.key)}/i/${a.id}`, "aria-label": ariaOf(a, kind, val, unit, word), "data-id": a.id },
    h("span.lw-name", a.label), markEl(kind),
    h("span.lw-val", h("b.lw-num" + (val && val.length > 6 ? ".lw-long" : ""), val == null ? "—" : ltr(val)), unit ? h("small.lw-unit", unit) : null),
    sp ? h("span.lw-spark", sp) : one ? h("span.lw-one", "נתון לשנה אחת בלבד") : null, meta);
  let tipCache = null;
  bindTip(cell, () => tipCache || (tipCache = tipNodes(a, kind, one)));
  return { el: cell, kind, group: GROUP[kind], spark: sp };
}
