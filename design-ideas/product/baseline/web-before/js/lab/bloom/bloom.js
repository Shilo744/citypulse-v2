// Lab direction "bloom" (route #/c/<key>/lab/bloom): the city overview whose hero is one chart that is also the brand, a bloom of leaves round the count of what needs
// treatment. One leaf per domain, in a fixed slot; the LENGTH of a leaf is the share of the domain's judged indicators that need treatment (a watch counts half).
// Under it: domain by domain, what to treat first, where to start, what changed, the sources. Class prefix .lb-, styles in css/lab/bloom.css.
import { h, icon, num, ltr, outOf, countLabel } from "../../ui.js";
import { shareBtn, printBtn } from "../../pages/shared.js";
import { bloomChart, leafMark } from "./chart.js";
import * as G from "./geo.js";
import { domainsSection, prioritiesSection, startSection, changesSection, closingSection, sourcesSection, smooth } from "./sections.js";

const COUNT_WORD = { concern: (n) => countLabel("concern", n), watch: () => "למעקב", good: (n) => countLabel("good", n), strength: (n) => countLabel("strength", n), none: () => "ללא שיפוט" };

// the town's identity in two quiet lines (from the model): kind of locality and district, then residents and the social-economic cluster
function facts(model) {
  const c = model.city, line = (parts) => { const p = parts.filter(Boolean); return p.length ? h("span.lb-fl", p.map((x, i) => h("span", x, i < p.length - 1 ? h("span.lb-sep", { "aria-hidden": "true" }, " ·") : null))) : null; };
  const a = line([c.status, c.district ? `מחוז ${c.district}` : null]), b = line([c.population ? [ltr(num(c.population, 0)), " תושבים"] : null, c.sesCluster != null ? ["אשכול חברתי-כלכלי ", ...outOf(c.sesCluster, 10)] : null]);
  return a || b ? h("p.lb-facts.rv", a, b) : null;
}

// the five numbers, side by side with hairlines between them; each one takes you to the list it counts
function counts(root, data) {
  const t = data.total, items = [["concern", t.concern], ["watch", t.watch], ["good", t.good], ["strength", t.strength], ["none", t.none]].filter(([k, n]) => (t.judged ? true : k === "none" && n > 0));
  if (!items.length) return null;
  const go = (k) => { const el = root.querySelector(k === "concern" && root.querySelector("#lb-prio") ? "#lb-prio" : "#lb-domains"); if (el) el.scrollIntoView({ behavior: smooth(), block: "start" }); };
  return h("div.lb-counts.rv", { role: "group", "aria-label": "כמה מדדים בכל מצב" },
    items.map(([k, n]) => h("button.lb-cnt.c-" + k + (n ? "" : ".is-zero"), { type: "button", "aria-label": `${n} ${COUNT_WORD[k](n)}. מעבר לרשימה`, onclick: () => go(k) },
      h("b", { "data-count": "" }, String(n)), h("small", COUNT_WORD[k](n)))));
}

function hero(model, root, data, chart) {
  const c = model.city, key = encodeURIComponent(c.key), t = data.total, cov = model.coverage;
  const share = shareBtn(), print = printBtn();                                  // icon buttons: the words stay for screen readers, the title for the pointer
  share.title = "העתקת קישור"; print.title = "הדפסה"; share.classList.add("lb-ibtn"); print.classList.add("lb-ibtn");
  let verdict;
  if (!cov.have) {
    verdict = [h("h2.lb-calm-t.rv", "אין עדיין נתונים ברמת היישוב הזה"), h("p.lb-calm.rv", "המקורות הרשמיים שהמערכת קוראת מהם אינם מפרסמים נתונים על היישוב הזה. בדרך כלל מדובר ביישובים קטנים מאוד, באזורי תעשייה או במרכזים אזוריים.")];
  } else if (!t.judged) {
    const small = model.indicators.some((a) => a.last && a.last.reliable === false);
    verdict = [h("h2.lb-calm-t.rv", G.leadSentence(data)), h("p.lb-calm.rv", small ? "הקבוצות קטנות מכדי להשוות או להסיק. הנתון עצמו מוצג כמו שהוא, בלי דירוג, מגמה או המלצה, ולכן העלים סגורים." : "המדדים שיש על היישוב מתארים אותו בלבד, ולכן אין מה לשפוט.")];
  } else {
    verdict = [h("p.lb-verdict.rv", G.leadSentence(data))];
  }
  const plan = (model.recommendations || []).length > 0;                       // no recommendations (nothing judged): the question to the agent is the main action
  const actions = cov.have ? h("div.lb-actions.no-print.rv", plan ? h("a.btn.primary", { href: `#/c/${key}/actions` }, icon("list"), "תוכנית פעולה") : h("a.btn.primary", { href: `#/c/${key}/ask` }, icon("chat"), "שאלו את הסוכן"), plan ? h("a.lb-link", { href: `#/c/${key}/ask` }, icon("chat"), "שאלו את הסוכן") : null)
    : h("div.lb-actions.no-print.rv", h("a.btn.primary", { href: "#/" }, icon("search"), "בחירת יישוב אחר"));
  const cap = cov.have ? h("div.lb-cap-row.rv", h("p.lb-cap", ["מבוסס על ", ltr(String(cov.have)), cov.total > cov.have ? [" מתוך ", ltr(String(cov.total))] : null, " מדדים · ", h("a", { href: `#/c/${key}/coverage` }, "מה נמצא ומה חסר")]), h("div.lb-tools.no-print", share, print)) : null;
  // the DOM order is the reading order (who, what it says, the chart); the grid puts the chart beside the text, and above the sentence on a phone
  const head = h("div.lb-hero-head", h("p.lb-eyebrow.rv", leafMark(), "תמונת מצב בריאותית"), h("h1.lb-h1.rv", { id: "lb-h1" }, c.name), facts(model));
  const rest = h("div.lb-hero-rest", ...verdict, cov.have ? counts(root, data) : null, actions, cap);
  return h("section.lb-hero", { "aria-labelledby": "lb-h1" }, head, rest, chart.el);
}

export function view(model) {
  const root = h("div.lb"), bus = new EventTarget(), data = G.bloomData(model), chart = bloomChart(model, data, { bus });
  root.append(hero(model, root, data, chart));
  if (!model.coverage.have) return root;                                            // a locality the sources do not cover: the buds and the way out, nothing else
  [domainsSection(model, data, bus), prioritiesSection(model), startSection(model), changesSection(model), closingSection(model), sourcesSection(model)].forEach((s) => { if (s) root.append(s); });
  return root;
}
