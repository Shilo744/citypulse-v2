// The cover of the report: the town's name, the verdict as the biggest sentence on the page, the domain that needs the most attention, the town drawn
// under a calm sky, and below the picture the five status numerals and the actions. The pictures are decorative (day in the light theme, dusk in the dark one).
import { h, icon, ltr, outOf, countLabel } from "../../ui.js";
import { viz } from "../../viz/core.js";
import { sortDomains } from "../../viz/matrix.js";
import { shareBtn, printBtn } from "../../pages/shared.js";
import { statusCounts, judgedOf } from "./util.js";

const WORD = { concern: (n) => countLabel("concern", n), watch: () => "למעקב", good: (n) => countLabel("good", n), strength: (n) => countLabel("strength", n), none: () => "ללא שיפוט" };
const WORD_ICON = { concern: "alert", watch: "eye", good: "check", strength: "star", none: "info" };

// the town under its sky: both pictures are in the page and css picks one by theme; they fade in slowly (the vocabulary's "fade", slowed in css)
function art() {
  const dark = document.documentElement.dataset.theme === "dark";
  const img = (cls, file, low) => h("img.lr-art-img.fade." + cls, { src: `assets/lab/${file}`, width: 1536, height: 1024, alt: "", "aria-hidden": "true", loading: "eager", decoding: "async", fetchpriority: low ? "low" : null });
  return viz(h("div.lr-art", { "aria-hidden": "true" }, img("lr-art-day", "town-day.webp", dark), img("lr-art-dusk", "town-dusk.webp", !dark)));
}

// the domain that needs the most attention, with the reason in numbers: how many of its judged figures need work (or, with none, are on watch).
// The same sort as the domain strip further down, so the line and the first row of the strip can never disagree.
function weakest(model) {
  const domains = model.domains.filter((d) => d.indicators.length).map((d) => ({ id: d.id, label: d.label, indicators: model.indicators.filter((i) => i.domain === d.id).map((i) => ({ id: i.id, status: i.status })) }));
  const top = sortDomains(domains)[0];
  if (!top) return null;
  const c = top.counts, judged = (c.concern || 0) + (c.watch || 0) + (c.good || 0) + (c.strength || 0), st = c.concern ? "concern" : c.watch ? "watch" : null;
  if (!st || !judged) return null;
  const n = c[st];
  return { name: top.label, id: top.id, why: [...outOf(n, judged), " מדדים ", st === "concern" ? countLabel("concern", n) : "למעקב"] };
}

// the verdict: the number to act on, huge, then what it is out of. With nothing judged the page says so calmly instead.
function verdict(model, all, judged) {
  const c = all.concern || 0;
  if (!judged) {
    const st = model.summary && model.summary.lines.find((l) => l.kind === "state"), small = model.indicators.some((a) => a.last && a.last.reliable === false);
    return h("div.lr-calm.rv", h("h2.lr-calm-t", "אין כאן מדדים שאפשר לשפוט"), h("p", st ? st.text : "המדדים שיש עליהם נתון מתארים את היישוב בלבד."),
      small ? h("p.lr-calm-s", icon("info"), "הקבוצה קטנה מכדי להשוות או להסיק. הנתון עצמו מוצג, בלי דירוג, מגמה או המלצה.") : null);
  }
  const body = c ? ["מתוך ", ltr(String(judged)), " מדדים ", countLabel("concern", c)] : ["מדדים נבדקו, ואף אחד מהם אינו דורש טיפול"];
  return h("h2.lr-verdict.rv" + (c ? "" : ".is-calm"), h("b.lr-vnum", { "data-count": "" }, String(c || judged)), " ", h("span.lr-vtext", body));
}

// the five numerals: each one is a button that leads to its list
function counts(all, judged, total, go) {
  const none = total - judged;
  const items = [["concern", all.concern || 0], ["watch", all.watch || 0], ["good", all.good || 0], ["strength", all.strength || 0], ["none", none]].filter(([k, n]) => (judged ? true : k === "none" && n > 0));
  if (!items.length) return null;
  return h("div.lr-counts.rv", { role: "group", "aria-label": "כמה מדדים בכל מצב" },
    items.map(([k, n]) => h("button.lr-cnt.c-" + k + (n ? "" : ".is-zero"), { type: "button", "aria-label": `${n} ${WORD[k](n)}. מעבר לרשימה`, onclick: () => go(k) },
      h("b", { "data-count": "" }, String(n)), h("span.lr-cnt-w", icon(WORD_ICON[k]), WORD[k](n)))));
}

export function cover(model, go) {
  const c = model.city, key = c.key, cov = model.coverage, all = statusCounts(model), judged = judgedOf(all);
  const bare = !cov.have;                                   // a locality the official sources do not cover
  const wk = judged ? weakest(model) : null;
  const weak = wk ? h("p.lr-weak.rv", h("span.lr-weak-l", "התחום שדורש הכי הרבה תשומת לב"), h("span.lr-weak-v", h("a", { href: `#/c/${key}/d/${wk.id}` }, wk.name), h("span.lr-weak-w", wk.why))) : null;
  const cap = bare ? null : h("p.lr-cap.rv", ["מבוסס על ", ltr(String(cov.have)), cov.total > cov.have ? [" מתוך ", ltr(String(cov.total))] : null, " מדדים · ", h("a", { href: `#/c/${encodeURIComponent(key)}/coverage` }, "מה נמצא ומה חסר")]);
  const top = h("div.lr-cover-in",
    h("p.lr-eyebrow.rv", "תמונת מצב"),
    h("h1.lr-h1.rv", { id: "lr-h1" }, c.name),
    bare ? h("div.lr-calm.rv", h("h2.lr-calm-t", "אין עדיין נתונים ברמת היישוב הזה"),
      h("p", "המקורות הרשמיים שהמערכת קוראת מהם אינם מפרסמים נתונים על היישוב הזה. בדרך כלל מדובר ביישובים קטנים מאוד, באזורי תעשייה או במרכזים אזוריים.")) : verdict(model, all, judged),
    weak, cap);
  const actions = bare
    ? h("div.lr-actions.no-print.rv", h("a.btn.primary", { href: "#/" }, icon("search"), "בחירת יישוב אחר"), h("a.btn", { href: `#/c/${encodeURIComponent(key)}/coverage` }, icon("info"), "מה נמצא ומה חסר"))
    : h("div.lr-actions.no-print.rv", h("a.btn.primary", { href: `#/c/${key}/actions` }, icon("list"), "תוכנית פעולה"), h("a.btn", { href: `#/c/${key}/ask` }, icon("chat"), "שאלו את הסוכן"), shareBtn(), printBtn());
  const foot = h("div.lr-cover-foot", bare ? null : counts(all, judged, model.indicators.length, go), actions);
  return h("section.lr-cover", { "aria-labelledby": "lr-h1" }, h("div.lr-stage", top, art(), foot));
}
