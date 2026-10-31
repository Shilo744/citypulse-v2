// #/privacy and #/c/<key>/privacy — plain-language privacy notice.
// The list of device storage keys is generated from KEYS in config.js so the page is always accurate.
import { h } from "../../ui.js";
import { titleBand } from "../band.js";
import { KEYS } from "../config.js";
import { build } from "../nav.js";

// What each key stores, in plain language (why the value is kept).
const KEY_LABELS = {
  theme:    { name: "עיצוב (בהיר / כהה)",             why: "שמירת הבחירה שלכם, כדי שהאתר ייפתח באותו מצב." },
  recent:   { name: "רשימת יישובים שנצפו לאחרונה",    why: "הצגת קישורים מהירים לעמודים שביקרת בהם." },
  last:     { name: "היישוב האחרון שנצפה",             why: "חזרה אוטומטית ליישוב בעת פתיחת האתר מחדש." },
  fav:      { name: "יישובים מועדפים",                 why: "שמירת הרשימה שבניתם, כדי שתישאר זמינה." },
  welcome:  { name: "סימון ביקור ראשון",               why: "הצגת מסך פתיחה רק בביקור הראשון." },
  shortcuts: { name: "קיצורי מקלדת (פועל / כבוי)",    why: "שמירת ההגדרה שלכם: אפשר לכבות קיצורי מקלדת של מקש אחד." },
  view:     { name: "תצוגה מועדפת (במבט אחד או הפרטים המלאים)", why: "פתיחת דף היישוב באותה תצוגה שבחרתם." },
  from:     { name: "מקור הניווט האחרון",             why: "שמירה זמנית (עד שעה) כדי לאפשר חזרה לשאלה שממנה הגעת." },
};

export function view(ctx) {
  const backHref  = ctx.key ? build({ key: ctx.key }) : "#/";
  const backLabel = ctx.key ? "דף היישוב" : "דף הבית";

  const band = titleBand({
    eyebrow: "מידע",
    title:   "מדיניות פרטיות",
    lede:    "מה נשמר, היכן, ולמה.",
    back:    { href: backHref, label: backLabel },
  });

  const keyRows = Object.entries(KEYS).map(([name, storageKey]) => {
    const label = KEY_LABELS[name] || { name: storageKey, why: "" };
    return h("li.n-pg-static-key",
      h("span.n-pg-static-key-name", label.name),
      " — ",
      h("span.n-pg-static-key-why", label.why),
    );
  });

  const node = h("div.n-pg-static-wrap",
    h("div.n-pg-static-body",

      h("h2", "מה נשמר על המכשיר"),
      h("p",  "הפריטים הבאים נשמרים באחסון המקומי של הדפדפן, על המכשיר שלכם בלבד. שום פרט מהם לא נשלח לשרת, אלא אם שלחתם פנייה."),
      h("ul.n-pg-static-keys", ...keyRows),
      h("p",  "בזמן כתיבת דיווח על טעות נשמרת גם טיוטה של הטקסט, באחסון הזמני של הלשונית. היא נמחקת כשהדיווח נשלח, וגם כשהלשונית נסגרת."),

      h("h2", "מה לא קורה"),
      h("ul.n-pg-static-plain",
        h("li", "אין עוגיות מעקב."),
        h("li", "אין כלי ניתוח צד שלישי."),
        h("li", "בעת צפייה בנתונים אין פנייה לשירות חיצוני."),
      ),

      h("h2", "שאלות ופניות"),
      h("p",  "שאלה בניסוח חופשי נשלחת לשירות בינה מלאכותית כדי לנסח תשובה. הטקסט המוקלד לא נשמר בשרת לאחר קבלת התשובה."),
      h("p",  "דיווח על טעות בנתון נשמר בשרת לצורך טיפול בפנייה בלבד."),
    ),
  );

  return { node, band, active: "privacy" };
}
