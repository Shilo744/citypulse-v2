// #/glossary and #/c/<key>/glossary — the full glossary of all terms used on the site. Inside a town the town menu stays and the way back is the town (ctx.key).
// Displays every entry from kit/glossary.js with an id-anchored element for deep-linking (#/glossary#concern, #/c/<key>/glossary#concern).
import { h } from "../../ui.js";
import { titleBand } from "../band.js";
import { GLOSSARY } from "../kit/glossary.js";
import { build } from "../nav.js";

// A short note on how the rate is computed, shown below the term list.
const HOW = "השיעורים מחושבים כך: מספר המקרים מחולק במספר התושבים המתאים, ומוכפל ב-100 (או ב-100,000 בשיעור לכל 100,000). שיעור מתוקן לגיל מחושב לפי הרכב הגילים הארצי.";

export function view(ctx) {
  const band = titleBand({
    eyebrow: "מידע",
    title:   "מילון מונחים",
    lede:    "הסברים על הערכים, הדירוגים ושיטת החישוב.",
    back:    ctx.key ? { href: build({ key: ctx.key }), label: "דף היישוב" } : { href: "#/", label: "דף הבית" },
  });

  const items = GLOSSARY.map((entry) =>
    h("div.n-pg-static-term", { id: entry.id },
      h("h2.n-pg-static-term-title", entry.term),
      h("p.n-pg-static-term-short", entry.short),
      h("p.n-pg-static-term-long",  entry.long),
    )
  );

  const node = h("div.n-pg-static-wrap",
    h("div.n-pg-static-body",
      h("div.n-pg-static-terms", ...items),
      h("p.n-pg-static-note", HOW),
    ),
  );

  return { node, band, active: "glossary" };
}
