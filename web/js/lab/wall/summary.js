// The narrow column beside the wall: the town, the verdict as one huge number, the numerals that filter the wall, where the town is, the three priorities.
// Everything comes from the model; with nothing judged the number gives way to a calm sentence.
import { h, icon, ltr, outOf, countLabel, statusChip } from "../../ui.js";
import { getGeo } from "../../api.js";
import { locator } from "../../viz/spatial.js";
import { miniDumbbell } from "../map/parts.js";
import { GROUP_IDS, groupCounts, groupWord, domainLine, valueText, unitWord, SMALL_NOTE } from "./data.js";
import { markEl } from "./cell.js";

const pad2 = (i) => String(i + 1).padStart(2, "0");

// "3 מתוך 4 דורשים טיפול, 1 למעקב" with the numbers isolated and the status word coloured (a word with its tone, not a capsule)
export function lineEl(c) {
  return domainLine(c).map((p, k) => [k ? ", " : null, p.text ? h("b.lw-w.lw-t-" + p.tone, p.text) : [p.of != null ? outOf(p.n, p.of) : ltr(String(p.n)), " ", h("b.lw-w.lw-t-" + p.tone, p.word)]]);
}

// the verdict: the number to act on, huge, then what it is out of (the number of figures that were judged, never the catalogue). With nothing judged, a calm sentence.
function verdict(model, counts) {
  const c = counts.concern, j = counts.judged;
  if (!j) {
    const st = model.summary && (model.summary.lines || []).find((l) => l.kind === "state");
    return h("div.lw-calm", h("h2.lw-calm-t", "אין כאן מדדים שאפשר לשפוט"), h("p", st ? st.text : "המדדים שיש עליהם נתון מתארים את היישוב בלבד."),
      counts.small ? h("p.lw-calm-s", SMALL_NOTE + ". הנתון עצמו מוצג, בלי דירוג, מגמה או המלצה.") : null);
  }
  const say = c ? `${c} מתוך ${j} מדדים ${countLabel("concern", c)}` : `${j} מדדים נבדקו, ואף אחד מהם אינו דורש טיפול`;
  return h("h2.lw-verdict" + (c ? "" : ".lw-is-calm"), { "aria-label": say },
    h("span.lw-vn", { "aria-hidden": "true", "data-count": "" }, String(c || j)),
    h("span.lw-vt", { "aria-hidden": "true" }, c ? ["מתוך ", ltr(String(j)), " מדדים ", h("b", countLabel("concern", c))] : ["מדדים נבדקו, ואף אחד מהם אינו דורש טיפול"]));
}

// what the page rests on (rule: "based on 35 of 41 figures", linked to the coverage page)
function basis(model) {
  const cov = model.coverage;
  return h("p.lw-basis", ["מבוסס על ", ltr(String(cov.have)), cov.total > cov.have ? [" מתוך ", ltr(String(cov.total))] : null, " מדדים"], h("a", { href: `#/c/${encodeURIComponent(model.city.key)}/coverage` }, "מה נמצא ומה חסר", icon("left", 13)));
}
// the domain under most pressure, from the same list the wall is drawn from (so the two can never disagree)
function weakest(domains, counts) {
  const top = domains[0];
  if (!top || !counts.judged || !(top.c.concern || top.c.watch)) return null;
  return h("div.lw-weak", h("p.lw-weak-l", "התחום שדורש הכי הרבה תשומת לב"), h("a.lw-weak-a", { href: top.href }, top.label, icon("left", 14)), h("p.lw-weak-c", lineEl(top.c)));
}

// the numerals: a count, its mark and its word, rows between hairlines; a click filters the wall (onPick), a second click lets go
function numerals(counts, onPick) {
  const g = groupCounts(counts), ids = counts.judged ? GROUP_IDS : GROUP_IDS.filter((id) => g[id] > 0);
  const rows = ids.map((id) => h("button.lw-nr.lw-g-" + id, { type: "button", "aria-pressed": "false", "data-g": id, disabled: g[id] ? null : true, onclick: () => onPick(id) },
    h("b.lw-n", { "data-count": "" }, String(g[id])), markEl(id), h("span.lw-nw", groupWord(id, g[id]))));
  return h("div.lw-nums", { role: "group", "aria-label": "כמה מדדים בכל מצב. לחיצה מסננת את הקיר" }, rows);
}

// the town on the map of the country: a field of dots, the town lit (the picture is made when the localities arrive; its place is kept so that nothing jumps)
function whereBox(model) {
  const box = h("div.lw-loc"), c = model.city;
  getGeo().then((geo) => { if (Array.isArray(geo) && geo.length) box.replaceChildren(locator({ geo, cityKey: c.key, width: 76, ariaLabel: `מיקום ${c.name} על המפה` })); }).catch(() => { /* no map: the numerals stand alone */ });
  return box;
}

// the first three priorities as numbered rows: the name, the value, and the town against the nation and similar localities on one axis (better = right)
function priorities(model) {
  const key = encodeURIComponent(model.city.key), top = (model.priorities || []).slice(0, 3).map((id) => model.indicators.find((x) => x.id === id)).filter(Boolean);
  if (!top.length) return null;
  const k = (cls, text) => h("span", h("i.lw-ki." + cls, { "aria-hidden": "true" }), text);
  return h("section.lw-prio.rv", { "aria-labelledby": "lw-prio-h" },
    h("h2.lw-prio-h", { id: "lw-prio-h" }, top.length === 3 ? "שלושת סדרי העדיפויות" : "סדרי עדיפויות"),
    h("p.lw-prio-k", k("lw-k-city", model.city.name), k("lw-k-nat", "ממוצע ארצי"), k("lw-k-peer", "יישובים דומים"), h("span.lw-prio-b", "בכל ציר הצד הימני הוא הטוב יותר")),
    h("ol.lw-pl", top.map((a, i) => {
      const v = valueText(a), u = unitWord(a), db = miniDumbbell(a, model.city.name, { w: 196, h: 46 });
      return h("li.lw-pr", h("span.lw-pr-n", { "aria-hidden": "true" }, pad2(i)),
        h("div.lw-pr-b", h("a.lw-pr-t", { href: `#/c/${key}/i/${a.id}` }, a.label),
          h("div.lw-pr-v", v != null ? h("b", ltr(v)) : null, u ? h("small", u) : null, statusChip(a.status)), db ? h("div.lw-db", db) : null));
    })));
}

// the whole column; press(group) marks which numeral filters the wall now
export function summaryColumn(model, { domains, counts, onPick }) {
  const nums = numerals(counts, onPick), prio = priorities(model);
  const id = h("div.lw-id.rv", h("p.lw-eyebrow", "תמונת מצב בריאותית"), h("h1.lw-town", model.city.name), verdict(model, counts), basis(model), weakest(domains, counts));
  const stat = h("div.lw-stat.rv", h("div.lw-stat-l", h("p.lw-stat-h", "כמה מדדים בכל מצב"), nums, h("p.lw-stat-f", "לחיצה על מצב מסננת את הקיר")), whereBox(model));
  const el = h("section.lw-sum", id, stat, prio);
  return { el, press: (g) => nums.querySelectorAll(".lw-nr").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.g === g))) };
}
