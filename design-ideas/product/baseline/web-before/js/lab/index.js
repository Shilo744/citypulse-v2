// The design lab: new directions for pages, built NEXT TO the real ones (own files, own routes, own class prefixes) so that they can be compared
// before anything is adopted. #/lab is the list, #/lab/entry a new entry page, #/c/<key>/lab/<id> a new overview inside the normal shell.
// Nothing here replaces a real page; when a direction wins, its file is moved into pages/ and the lab entry is deleted.
import { h, icon, logoMark } from "../ui.js";
import { searchBox } from "../components.js";

// each direction: id, kind (city = an overview inside the shell, entry = a full page), a plain name and sentence, the mock-up image it came from, how to load it.
// a direction whose file is not there yet shows "not built yet" instead of breaking the lab.
export const VARIANTS = [
  { id: "combo", state: "ready", kind: "city", name: "גרסה משולבת (מוצעת)", note: "מה שבחרנו מכל כיוון, בעמוד אחד: שער הדוח עם איור העיירה, ורד התחומים לצד שורות התחומים, ושלוש תצוגות בלשוניות: תמונת מצב, שאלות וכל המדדים. דף הכניסה בעיצוב המשולב נפתח בנפרד.",
    thumbs: ["combo.png"], load: () => import("./combo/combo.js").then((m) => m.view) },
  { id: "map", state: "ready", kind: "city", name: "מפה קודם", note: "מפת הארץ היא התמונה הראשית, ליד כותרת ענקית אחת. מתחת: מספרי המצב, רצועת התחומים והמדדים המרכזיים מול יישובים דומים.",
    thumbs: ["map-light.png", "map-dark.png"], load: () => import("./map/overview.js").then((m) => m.overview) },
  { id: "report", state: "ready", kind: "city", name: "דוח", note: "עמוד שנקרא כמו דוח מעוצב: איור של היישוב בראש העמוד, כותרת גדולה, ארבעה מספרים בשורה, גרף מגמה רחב והשוואות לאורך העמוד.",
    thumbs: ["report.png"], load: () => import("./report/report.js").then((m) => m.view) },
  { id: "bloom", state: "ready", kind: "city", name: "ורד התחומים", note: "עלי כותרת, אחד לכל תחום: אורך העלה הוא כמה מהמדדים בתחום דורשים טיפול. בלב הצורה המספר שצריך לפעול עליו.",
    thumbs: ["bloom.png"], load: () => import("./bloom/bloom.js").then((m) => m.view) },
  { id: "questions4", state: "ready", kind: "city", name: "פתיחה של דף הכניסה + שאלות", note: "הפתיחה של דף הכניסה (שמיים, תמונת היישוב, כותרת גדולה ושדה שאלה) מעל דף \"שאלות קודם\" כמו שהוא, בלי הגרף. שם היישוב הוא הכותרת.",
    thumbs: ["questions.png"], load: () => import("./questions4/questions4.js").then((m) => m.view) },
  { id: "questions3", state: "ready", kind: "city", name: "שאלות קודם, עם גרף אחד", note: "הדף הישן של שאלות קודם כמו שהוא, עם תוספת אחת בלבד: מתחת למשפט הענק של \"איפה אנחנו הכי חלשים\" הגרף הפורח, שמראה את התחומים.",
    thumbs: ["questions.png"], load: () => import("./questions3/questions3.js").then((m) => m.view) },
  { id: "questions2", state: "ready", kind: "city", name: "שאלות קודם, בעיצוב משופר", note: "אותה גישה יעילה, התשובה כתובה בשורה אחת ענקית, אבל עם כותרת קומפקטית, איור שקט, ויזואל מתחת למשפט ורקע חם. נבנה עכשיו.",
    thumbs: ["questions2.png"], load: () => import("./questions2/questions2.js").then((m) => m.view) },
  { id: "questions", state: "ready", kind: "city", name: "שאלות קודם", note: "העמוד בנוי סביב השאלות של ראש רשות: איפה אנחנו חלשים, מה השתפר, איך אנחנו מול יישובים דומים ומה כדאי לעשות קודם. כל שאלה מחליפה את התשובה, כתובה כמו מסמך קצר.",
    thumbs: ["questions.png"], load: () => import("./questions/questions.js").then((m) => m.view) },
  { id: "wall", state: "ready", kind: "city", name: "קיר המדדים", note: "כל המדדים של היישוב בעמוד אחד, כקווי מגמה קטנים לפי תחומים, אלה שמדרדרים קודם. בצד: הכותרת, המספרים והעדיפויות.",
    thumbs: ["wall.png"], load: () => import("./wall/wall.js").then((m) => m.view) },
  { id: "standing", state: "mockup", kind: "city", name: "איפה אנחנו עומדים", note: "לכל תחום פס אחד שמראה את היישוב מול כל היישובים הדומים, כמו טבלת ליגה בלי גביעים. דורש חישוב חדש של מקום בכל תחום (עוד לא קיים).",
    thumbs: ["standing.png"], load: () => import("./standing/standing.js").then((m) => m.view) },
  { id: "story", state: "mockup", kind: "city", name: "סיפור בחמישה פרקים", note: "העמוד כסיפור: איפה אנחנו, מה עובד היטב, מה דורש טיפול, מה השתנה ומה עושים קודם, כל פרק נפתח באיור.",
    thumbs: ["story.png"], load: () => import("./story/story.js").then((m) => m.view) },
  { id: "entry", state: "ready", kind: "entry", name: "דף כניסה", note: "דף הפתיחה עם איורי תדמית: מה זה, איך מחפשים יישוב, ומה מקבלים.",
    thumbs: ["entry.png"], load: () => import("./entry/entry.js").then((m) => m.entryView) },
];

const SAMPLE = [["1031", "שדרות"], ["9000", "באר שבע"], ["3000", "ירושלים"], ["16", "מושב קטן"]];
const state = { key: "1031", name: "שדרות" };
const hrefOf = (v, key) => (v.kind === "entry" ? "#/lab/entry" : `#/c/${encodeURIComponent(key)}/lab/${v.id}`);

const missing = (what) => h("div.lab-missing", icon("info"), h("div", h("b", "העיצוב הזה עוד לא נבנה"), h("p", what)));

// the slim bar above every lab page: the other directions, the real page, the list
function bar(current, key) {
  return h("nav.lab-bar.no-print", { "aria-label": "עיצובים לבחינה" },
    h("span.lab-bar-l", icon("spark"), "עיצוב לבחינה"),
    h("div.lab-tabs", VARIANTS.filter((v) => v.kind === "city" && (v.state === "ready" || v.id === current)).map((v) => h("a.lab-tab", { href: hrefOf(v, key || state.key), "aria-current": v.id === current ? "page" : null }, v.name))),
    h("span.lab-bar-sp"),
    key ? h("a.lab-bar-a", { href: `#/c/${encodeURIComponent(key)}` }, "העמוד הרגיל") : h("a.lab-bar-a", { href: "#/" }, "האתר הרגיל"),
    h("a.lab-bar-a", { href: "#/lab" }, "כל העיצובים"));
}

// a direction for a locality, inside the normal shell
export async function labCityView(model, id) {
  const v = VARIANTS.find((x) => x.id === id && x.kind === "city") || VARIANTS[0];
  let body;
  try { body = await (await v.load())(model); } catch (e) { body = missing(String(e && e.message || e)); }
  return h("div.lab", bar(v.id, model.city.key), body);
}

// the list (#/lab) or the entry direction (#/lab/entry); both are full pages without the menu
export async function labView(parts, ctx) {
  if (parts[0] === "entry") {
    const v = VARIANTS.find((x) => x.id === "entry");
    let body;
    try { body = await (await v.load())(ctx); } catch (e) { body = missing(String(e && e.message || e)); }
    return h("div.lab.lab-full", bar("entry", null), body);
  }
  return list(ctx);
}

function list(ctx) {
  const rows = VARIANTS.map((v) => {
    const open = h("div.lab-open");
    const STATE = { building: "נבנה עכשיו. אפשר יהיה לפתוח אותו עם הנתונים האמיתיים בקרוב.", mockup: "הדמיה בלבד. עוד לא נבנה." };
    const links = () => open.replaceChildren(...(v.state !== "ready" ? [h("span.lab-state", STATE[v.state] || "")] : v.kind === "entry" ? [h("a.lab-go", { href: hrefOf(v) }, "פתחו את הדף", icon("left"))]
      : [h("a.lab-go", { href: hrefOf(v, state.key) }, `פתחו עם ${state.name}`, icon("left")), h("span.lab-also", "או: "), ...SAMPLE.filter(([k]) => k !== state.key).map(([k, n]) => h("a.lab-also-a", { href: hrefOf(v, k) }, n))]));
    v.refresh = links; links();
    return h("article.lab-row",
      h("div.lab-thumbs", v.thumbs.map((t) => h("img", { src: `assets/lab/thumbs/${t}`, alt: `הדמיה של העיצוב ${v.name}`, loading: "lazy", onerror: (e) => e.target.remove() }))),
      h("div.lab-info", h("h2.lab-name", v.name), h("p", v.note), open));
  });
  const pick = searchBox({ placeholder: "בחרו יישוב אחר לבחינה…", onPick: (r) => { state.key = String(r.key); state.name = r.name; chosen.textContent = r.name; VARIANTS.forEach((v) => v.refresh && v.refresh()); } });
  const chosen = h("b", state.name);
  return h("div.lab.lab-full",
    h("header.lab-top", h("a.brand.lab-brand", { href: "#/" }, logoMark(), h("div", h("b", "CityPulse"), h("small", "מעבדת עיצוב"))), h("span.lab-bar-sp"), ctx && ctx.themeBtn ? ctx.themeBtn() : null),
    h("div.lab-intro", h("h1", "עיצובים חדשים לבחינה"), h("p", "כל כיוון נבנה בדף נפרד, עם הנתונים האמיתיים, ליד העמוד הקיים. שום עמוד אמיתי לא השתנה. כשנבחר מה טוב, נטמיע אותו."),
      h("div.lab-pick", h("span", "היישוב לבחינה: "), chosen, h("div.lab-search", pick))),
    h("div.lab-rows", rows));
}
