// DOM helpers, icons, number formatting, tooltip, toast. Every string from data goes in as text, never as HTML.

// style as an object: plain properties are assigned, custom properties ("--i": 3, the stagger and length variables of css/motion.css) need setProperty
export function setStyle(el, o) {
  for (const [k, v] of Object.entries(o)) { if (v == null || v === false) continue; if (k.startsWith("--")) el.style.setProperty(k, String(v)); else el.style[k] = v; }
  return el;
}
export function h(spec, attrs, ...kids) {
  if (attrs != null && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  const m = /^([a-zA-Z0-9]*)((?:[.#][\w-]+)*)$/.exec(spec);
  const el = document.createElement(m[1] || "div");
  for (const t of m[2].match(/[.#][\w-]+/g) || []) { if (t[0] === ".") el.classList.add(t.slice(1)); else el.id = t.slice(1); }
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.classList.add(...String(v).split(" ").filter(Boolean));
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;                       // static markup written in this code base only
    else if (k === "style" && typeof v === "object") setStyle(el, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  add(el, kids);
  return el;
}
// no line break between a one-letter prefix and its number (ל-100,000), nor between a number and the word that follows it (a lone "24" at the end of a line)
const tidy = (t) => t.replace(/-(?=[\u2066\d])/g, "-\u2060").replace(/([\d%\u2069]) +(?=[\u0590-\u05FF])/g, "$1\u00A0").replace(/: $/, ":\u00A0");
export function add(el, kids) {
  for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; el.append(k instanceof Node ? k : document.createTextNode(tidy(String(k)))); }
  return el;
}
const NS = "http://www.w3.org/2000/svg";
export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "style" && typeof v === "object") setStyle(el, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  add(el, kids);
  return el;
}
export const clear = (el) => { el.replaceChildren(); return el; };
export const debounce = (fn, ms = 80) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// the CityPulse mark (a leaf over a skyline). "dark" is the version for the navy menu, "light" for a pale page, "auto" follows the theme.
export function logoMark(kind = "auto") {
  const img = (v) => { const f = v === "dark" ? "mark-dark" : "mark"; return h("img.brand-logo" + (kind === "auto" ? (v === "dark" ? ".on-dark" : ".on-light") : ""), { src: `assets/logo/${f}.png`, srcset: `assets/logo/${f}@2x.png 2x`, alt: "", width: 38, height: 47, decoding: "async" }); };
  return kind === "auto" ? h("span.brand-mark", img("light"), img("dark")) : h("span.brand-mark", img(kind));
}

// ── icons (24px grid, stroke) ────────────────────────────────────────────
const P = {
  pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14.5c2.4 0 4 1.7 4 4.5"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8 7.5 9.5 4.4-1.5 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2"/><path d="M9 9.5v.1M15 9.5v.1"/>',
  apple: '<path d="M12 7c-1.5-2-4.5-2.5-6 0-1.8 2.9-.5 8 2 10.5 1 1 2.5 1 4 0 1.5 1 3 1 4 0 2.5-2.5 3.8-7.6 2-10.5-1.5-2.5-4.5-2-6 0z"/><path d="M12 7c0-2 .8-3.3 2.5-4"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  warn: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.2M12 17.2v.1"/>',
  leaf: '<path d="M5 19c0-8 5-13 15-14 0 9-4 14-12 14z"/><path d="M5 19c2-4 5-7 9-9"/>',
  building: '<path d="M3 21h18M5 21V10m4 11V10m6 11V10m4 11V10M2 10l10-6 10 6z"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  trenddown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  bars: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.3 1.3L7 5M3.5 12l1.3 1.3L7 11M3.5 18l1.3 1.3L7 17"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M8 7.5h8"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m4.5 12.5 5 5L20 6.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.8v.1"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z"/>',
  up: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  downarrow: '<path d="M12 5v14m-6-6 6 6 6-6"/>',
  minus: '<path d="M5 12h14"/>',
  print: '<path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.2M12 16.2v.1"/>',
  scale: '<path d="M12 4v16M6 20h12M4 8h16"/><path d="m4 8-2.5 6a3 3 0 0 0 5 0zM20 8l-2.5 6a3 3 0 0 0 5 0z"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
  share: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="m8.2 10.9 7.6-3.8M8.2 13.1l7.6 3.8"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>'
};
export function icon(name, size) {
  const el = svg("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.9", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", width: size || null, height: size || null });
  el.innerHTML = P[name] || P.info;
  return el;
}

// ── statuses (colour is never alone: icon + word) ────────────────────────
// tone: good (teal), watch (orange outline), attn (orange fill), none (grey: described, not judged)
export const STATUS = {
  strength: { label: "חוזק", icon: "star", tone: "good" }, good: { label: "תקין", icon: "check", tone: "good" }, watch: { label: "למעקב", icon: "eye", tone: "watch" },
  concern: { label: "דורש טיפול", icon: "alert", tone: "attn" }, stale: { label: "נתון ישן", icon: "clock", tone: "none" }, uncertain: { label: "בסיס קטן", icon: "info", tone: "none" }, na: { label: "מדד רקע", icon: "info", tone: "none" }
};
export const toneOf = (s) => "tone-" + (STATUS[s] || STATUS.na).tone;
export const statusChip = (s) => { const m = STATUS[s] || STATUS.na; return h("span.st.t-" + m.tone, icon(m.icon), m.label); };

export const DOMAIN_ICON = { context: "users", outcomes: "pulse", immunization: "shield", child: "smile", nutrition: "apple", mental: "heart", welfare: "lifebuoy", access: "pin", safety: "warn", env: "leaf", capacity: "building" };

// ── numbers ──────────────────────────────────────────────────────────────
export function num(v, d = 1) {
  if (v == null || !isFinite(v)) return "—";
  return (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: d });
}
export const pct = (v, d = 1) => (v == null ? "—" : num(v, d) + "%");
export function fmtVal(unit, v, d = 1) {
  if (v == null) return "—";
  if (unit === "%") return num(v, d) + "%";
  if (unit === "per1000" || unit === "per10k" || unit === "per100k") return num(v, d);
  if (unit === "ils") return "₪" + num(v, 0);
  return num(v, d);
}
export const unitSuffix = (unit) => ({ per1000: "לכל 1,000", per10k: "לכל 10,000", per100k: "לכל 100,000", ils: "", years: "שנים", days: "ימים", index: "ציון", count: "" }[unit] || "");
// the unit word after a difference between two values of one parameter, and the status words that agree with a count
export const deltaUnit = (unit) => ({ "%": "\u00A0נק׳", days: "\u00A0ימים", years: "\u00A0שנים", per1000: "\u00A0לכל 1,000", per10k: "\u00A0לכל 10,000", per100k: "\u00A0לכל 100,000" }[unit] || "");
const STATUS_N = { concern: ["דורש טיפול", "דורשים טיפול"], watch: ["למעקב", "למעקב"], good: ["תקין", "תקינים"], strength: ["חוזק", "חוזקות"] };
export const countLabel = (st, n) => STATUS_N[st][n === 1 ? 0 : 1];
// which way is good for a figure, in one plain sentence (a colour alone never says it)
export const directionNote = (d) => (d === "higher" ? "ככל שהמספר גבוה יותר, כך טוב יותר" : d === "lower" ? "ככל שהמספר נמוך יותר, כך טוב יותר" : "מספר שמתאר את היישוב: אין בו טוב או רע");
export const directionIcon = (d) => (d === "higher" ? "up" : d === "lower" ? "downarrow" : "minus");
export const pts = (v, d = 1) => num(Math.abs(v), d) + " נק׳";
export const ptsEl = (v, d = 1) => [ltr(num(Math.abs(v), d)), "\u00A0נק׳"];      // only the number is isolated; the unit word stays in the Hebrew flow

// one plain sentence that compares a parameter with the national mean, aware of which direction is good
export function compareLine(a) {
  const L = a.last || a, g = L.gapNat;
  if (g == null) return { text: "אין ממוצע ארצי להשוואה", tone: "none", ic: "minus" };
  const amt = a.unit === "%" ? pts(g) : num(Math.abs(g)) + deltaUnit(a.unit).replace(" ", " ");
  if (Math.abs(g) < (L.nat ? Math.abs(L.nat) * 0.02 : 0.05)) return { text: "דומה לממוצע הארצי", tone: "none", ic: "minus" };
  const up = g > 0;
  if (!a.direction) return { text: `${up ? "גבוה" : "נמוך"} מהממוצע הארצי ב-${amt}`, tone: "none", ic: up ? "up" : "downarrow" };
  const good = a.direction === "lower" ? !up : up;
  return { text: `${good ? "טוב" : "חלש"} מהממוצע הארצי ב-${amt}`, tone: good ? "good" : "attn", ic: up ? "up" : "downarrow" };
}
// the change over the years, in words (descriptive parameters only rise or fall, never "improve")
export const TREND_WORD = { improving: "בשיפור", worsening: "בהידרדרות", stable: "יציב", rising: "עולה", falling: "יורד" };
export function trendInfo(a) {
  const c = a.history ? a.history.trendClass : a.trend, d = a.history ? a.history.delta : a.delta;
  if (!c || c === "unknown" || !TREND_WORD[c]) return null;
  const up = d != null && d !== 0 ? d > 0 : c === "improving" || c === "rising";        // the arrow follows the figure, the colour follows the verdict
  return { word: TREND_WORD[c], tone: c === "improving" ? "good" : c === "worsening" ? "attn" : "none", ic: c === "stable" ? "minus" : up ? "trend" : "trenddown", delta: c === "stable" ? null : d };
}

// why a parameter has its status, in the words of the rule that decided it (null when there is nothing to add)
const joinHe = (parts) => (parts.length < 2 ? parts[0] || "" : parts.slice(0, -1).join(", ") + " ו" + parts[parts.length - 1]);
export function statusReason(a) {
  const L = a.last || a, st = a.status, why = a.statusWhy || [];
  const part = {
    rank: () => (L.level <= 2 ? (L.rank != null && L.of ? `המצב מהחלשים ביותר מבין היישובים (מקום ${L.rank} מתוך ${L.of})` : "המצב מהחלשים ביותר מבין היישובים") : `הערך טוב יותר מ-${num(L.level, 0)}% בלבד מהיישובים`),
    target: () => `חסרות ${a.unit === "%" ? pts(L.gapTarget) : num(Math.abs(L.gapTarget))} ליעד משרד הבריאות`,
    worsening: () => "המגמה בהידרדרות"
  };
  if (st === "concern" || st === "watch") {
    const parts = why.map((w) => (part[w] && (w !== "target" || L.gapTarget != null) ? part[w]() : null)).filter(Boolean);
    if (!parts.length) return null;
    const nat = compareLine(a), concede = [nat.tone === "good" ? nat.text : null, a.history && a.history.trendClass === "improving" ? "בשיפור" : null].filter(Boolean);
    return (st === "concern" ? "דורש טיפול כי " : "למעקב כי ") + joinHe(parts) + (concede.length ? `, אף שהוא ${concede.join(" ו")}` : "") + ".";
  }
  if (st === "strength" || st === "good") {
    return (st === "strength" ? "חוזק: " : "תקין: ") + `הערך טוב יותר מ-${num(L.level, 0)}% מהיישובים` + (L.meetsTarget === true ? ", עומד ביעד משרד הבריאות" : "") + ", ואין הידרדרות.";
  }
  if (st === "stale") return "הנתון האחרון ישן, ולכן הוא אינו משפיע על המסקנות.";
  if (st === "uncertain") return "הקבוצה קטנה מכדי להשוות ליישובים אחרים, ולכן אין מסקנה.";
  return a.direction ? null : "מדד רקע: מתאר את העיר ואינו נשפט כטוב או רע.";
}
export const dateHe = (iso) => { try { return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return ""; } };
export const ltr = (t) => h("span.ltr", t);          // for numbers only: a Hebrew word inside an isolate swaps places with the numbers next to it
export const outOf = (a, b) => [ltr(String(a)), "\u00A0מתוך\u00A0", ltr(String(b))];
export const iso = (t) => "\u2066" + t + "\u2069";            // keeps a number or a year range in order inside Hebrew text

// ── tooltip ──────────────────────────────────────────────────────────────
let tipEl;
function tipNode() { if (!tipEl) { tipEl = h("div.tt", { role: "tooltip" }); document.body.append(tipEl); } return tipEl; }
function place(ev) {
  const t = tipNode(), r = t.getBoundingClientRect(), pad = 14;
  let x = ev.clientX + pad, y = ev.clientY + pad;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - pad;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - pad;
  t.style.left = Math.max(8, x) + "px"; t.style.top = Math.max(8, y) + "px";
}
export const tip = {
  show(nodes, ev) { const t = tipNode(); t.replaceChildren(...nodes); t.classList.add("on"); place(ev); },
  move(ev) { place(ev); },
  hide() { tipNode().classList.remove("on"); }
};
export const tipHead = (text) => h("div.th", text);
export const tipRow = (color, label, value, dash) => h("div.tr", h("span.k", color ? h("i", { style: { background: dash ? "transparent" : color, borderTop: dash ? "2px dashed " + color : "none", height: dash ? "0" : "3px" } }) : null, label), h("b", value));

export function toast(text) {
  const t = h("div.toast", { role: "status" }, text);
  document.body.append(t); setTimeout(() => t.remove(), 3200);
}
