// Hebrew numbers: one and many forms, the gender of the noun and where the unit stands. Pure strings, no DOM.
import { num } from "../../ui.js";

// 12 -> "12", 1234 -> "1,234", 1.5 -> "1.5"
const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString("en-US") : num(n, 1));

// cnt(1, "מדד אחד", "מדדים") -> "מדד אחד"; cnt(12, ...) -> "12 מדדים"; zero is "0 מדדים" unless a fourth argument says otherwise
export function cnt(n, one, many, zero) {
  if (n === 1) return one;
  if (n === 0 && zero != null) return zero;
  return `${fmt(n)} ${many}`;
}
// only the word that agrees with the number: cntWord(1, "חלש", "חלשים") -> "חלש" (for a verb or adjective after the number)
export const cntWord = (n, one, many) => (n === 1 ? one : many);
// "אחד" / "אחת" for 1, the digits otherwise: countBare(1) -> "אחד", countBare(1, "f") -> "אחת", countBare(3) -> "3"
export const countBare = (n, gender = "m") => (n === 1 ? (gender === "f" ? "אחת" : "אחד") : fmt(n));

// the nouns the product counts: [one, many]. The one form carries the number and the gender: "מדד אחד", "שנה אחת"
export const NOUNS = {
  metric: ["מדד אחד", "מדדים"], step: ["צעד אחד", "צעדים"], day: ["יום אחד", "ימים"], year: ["שנה אחת", "שנים"],
  town: ["יישוב אחד", "יישובים"], domain: ["תחום אחד", "תחומים"], case: ["מקרה אחד", "מקרים"], question: ["שאלה אחת", "שאלות"],
  source: ["מקור אחד", "מקורות"], point: ["נקודת אחוז אחת", "נקודות אחוז"]
};
export function cntOf(n, noun, zero) {
  const f = NOUNS[noun];
  if (!f) throw new Error("plural: unknown noun " + noun);
  return cnt(n, f[0], f[1], zero);
}
// "עוד צעד אחד", "עוד 2 צעדים"
export const more = (n, noun) => "עוד " + cntOf(n, noun);

// the unit with its value (C-15): "17 ימים", "66.1%", "5.7 לכל 100,000", "₪1,200". null is a dash.
const PER = { per1000: "לכל 1,000", per10k: "לכל 10,000", per100k: "לכל 100,000" };
export function withUnit(v, unit, d = 1) {
  if (v == null || !isFinite(v)) return "—";
  const n = num(v, d);
  if (unit === "%") return n + "%";
  if (unit === "ils") return "₪" + num(v, 0);
  if (unit === "days") return Number(n) === 1 ? NOUNS.day[0] : `${n} ${NOUNS.day[1]}`;
  if (unit === "years") return Number(n) === 1 ? NOUNS.year[0] : `${n} ${NOUNS.year[1]}`;
  if (PER[unit]) return `${n} ${PER[unit]}`;
  return n;
}

// how far a figure is short of something, with the verb in the right gender: "חסרים 12 ימים", "חסרות 13.9 נקודות אחוז", "חסרה שנה אחת".
// short: "נק׳" instead of "נקודות אחוז" (spell it out once per page). The caller adds the target: `${lacking(...)} ליעד הרשמי`
export function lacking(gap, unit, { short = false, d = 1 } = {}) {
  const g = Math.abs(gap), n = num(g, d), one = Number(n) === 1;
  const fem = unit === "%" || unit === "years";
  const verb = one ? (fem ? "חסרה" : "חסר") : (fem ? "חסרות" : "חסרים");
  if (unit === "%") return `${verb} ` + (one ? NOUNS.point[0] : `${n} ${short ? "נק׳" : NOUNS.point[1]}`);
  if (unit === "days") return `${verb} ` + (one ? NOUNS.day[0] : `${n} ${NOUNS.day[1]}`);
  if (unit === "years") return `${verb} ` + (one ? NOUNS.year[0] : `${n} ${NOUNS.year[1]}`);
  if (PER[unit]) return `${verb} ${n} ${PER[unit]}`;
  if (unit === "ils") return `${verb} ₪${num(g, 0)}`;
  return `${verb} ${n}`;
}
