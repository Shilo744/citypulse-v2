// #/accessibility and #/c/<key>/accessibility — accessibility statement.
// OWNER-APPROVAL: wording needs the owner's approval.
import { h } from "../../ui.js";
import { titleBand } from "../band.js";
import { build } from "../nav.js";

// Compute today's date in Hebrew (e.g. "29 באוקטובר 2026").
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
function dateHeNow() {
  const d = new Date();
  return d.getDate() + " ב" + MONTHS_HE[d.getMonth()] + " " + d.getFullYear();
}

export function view(ctx) {
  const backHref  = ctx.key ? build({ key: ctx.key }) : "#/";
  const backLabel = ctx.key ? "דף היישוב" : "דף הבית";

  const band = titleBand({
    eyebrow: "מידע",
    title:   "הצהרת נגישות",
    lede:    "המחויבות, מה נבדק ומה עדיין לא.",
    back:    { href: backHref, label: backLabel },
  });

  // The feedback button is loaded lazily so this static page does not pull the whole feedback bundle.
  function makeFeedbackBtn(container) {
    import("../kit/feedback.js").then(({ openFeedback }) => {
      const btn = h("button.n-pg-static-contact", { type: "button" }, "דיווח על בעיית נגישות");
      btn.addEventListener("click", () => openFeedback({ url: location.href }, btn));
      container.replaceChildren(btn);
    }).catch(() => {/* feedback module not yet available */});
  }

  const contactSlot = h("span.n-pg-static-contact-slot");
  // Schedule the lazy load after this call returns (the node will be in the DOM by then).
  if (typeof requestAnimationFrame !== "undefined") {
    requestAnimationFrame(() => makeFeedbackBtn(contactSlot));
  } else {
    // test / non-browser environments: skip the lazy load
    setTimeout(() => makeFeedbackBtn(contactSlot), 0);
  }

  const node = h("div.n-pg-static-wrap",
    h("div.n-pg-static-body",

      // OWNER-APPROVAL: wording needs the owner's approval.
      h("h2", "מחויבות"),
      h("p",  "CityPulse שואפת לאפשר גישה לכלל הגולשים, כולל אנשים עם מוגבלויות."),

      h("h2", "תקן ורמה"),
      h("p",
        "האתר נבנה במטרה לעמוד בדרישות תקן ישראלי ",
        h("abbr", { title: "תקן ישראלי 5568 לנגישות אתרי אינטרנט" }, "ת״י 5568"),
        " ולהנחיות ",
        h("abbr", { title: "Web Content Accessibility Guidelines" }, "WCAG"),
        " 2.1 ברמה AA. העמידה בהן טרם אומתה בבדיקה חיצונית.",
      ),

      h("h2", "מה נבדק בפועל"),
      h("ul.n-pg-static-plain",
        h("li", "ניווט במקלדת: מעבר בין הקישורים, בחירת שאלה בחצים, ופתיחה וסגירה של חלונות הסבר."),
        h("li", "ניגודיות צבעים מחושבת מהאסימונים (tokens) של עיצוב האתר ונבדקת אוטומטית."),
        h("li", "התאמה לרוחב מסך בין 320 ל-2560 פיקסלים."),
        h("li", "עיצוב הדפסה בסיסי."),
      ),

      h("h2", "מגבלות ידועות"),
      h("ul.n-pg-static-plain",
        h("li", "האתר טרם נבדק עם קורא מסך אמיתי."),
        h("li", "לא נבדק בדפדפני Safari ו-Firefox."),
        h("li", "לא נבדק במצב ניגודיות גבוהה של Windows."),
      ),

      h("h2", "יצירת קשר בנושא נגישות"),
      h("p",  "נתקלתם בבעיה? "),
      contactSlot,

      h("p.n-pg-static-updated", "עודכן: " + dateHeNow()),
    ),
  );

  return { node, band, active: "accessibility" };
}
