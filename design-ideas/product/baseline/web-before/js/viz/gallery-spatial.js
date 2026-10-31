// Gallery of the spatial family: the dot map for a figure where higher is better, one where lower is better and a background figure,
// the small locator for four very different places, and the edge cases (one point, missing figures, small groups, a city that is not in the data).
// All with the real data of the page's locality (ctx.key, change it with ?city=).
import { h } from "./core.js";
import { demo, wide } from "./gallery-kit.js";
import { dotMap, locator } from "./spatial.js";

const load = async (ctx, id) => { try { return await ctx.indicator(id); } catch (e) { return null; } };
const missing = (id) => h("p.muted", `אין ליישוב הזה נתונים על ${id}.`);

// a dot map from the indicator detail the server returns (indicator, analysis.last, peers, map)
function mapFor(ctx, ind, extra = {}) {
  const I = ind.indicator, last = ind.analysis && ind.analysis.last;
  return dotMap({ points: ind.map, cityKey: ctx.key, unit: I.unit, direction: I.direction, nat: last ? last.nat : null, peers: (ind.peers || []).map((p) => p.key),
    geo: ctx.geo, minBase: I.minBase, label: I.short, ...extra });
}

export default async function (sec, ctx) {
  const [mmr, wait, pop] = await Promise.all([load(ctx, "th_mmrv"), load(ctx, "wait_specialist_days"), load(ctx, "pop_size")]);

  // 1. higher is better (wide: shows the legend beside the map)
  wide(demo(sec, "מפת נקודות: חיסון MMR (גבוה = טוב)", mmr ? `${mmr.map.length} יישובים. הצבע לפי מקום היישוב בין כולם, הגודל לפי מספר התושבים, טבעת ורודה = יישובים דומים. העבירו עכבר על נקודה, או לחצו Tab ואז חצים.` : "",
    mmr ? mapFor(ctx, mmr) : missing("חיסון MMR")));

  // 2. lower is better, only a few localities have the figure: the faint dots keep the shape of the country
  demo(sec, "מפת נקודות: המתנה לרופא מומחה (נמוך = טוב)", wait ? `${wait.map.length} יישובים. הנקודות האפורות הקטנות הן יישובים בלי נתון.` : "",
    wait ? mapFor(ctx, wait) : missing("זמן המתנה לרופא מומחה"));

  // 3. a background figure: no good or bad, one hue from light to full by quantile
  demo(sec, "מפת נקודות: מדד רקע (תושבים)", pop ? `${pop.map.length} נקודות, בלי טוב ורע: גוון אחד מבהיר לכהה.` : "",
    pop ? mapFor(ctx, pop) : missing("מספר התושבים"));

  // 4. the locator on a hero-like panel (white text on the navy gradient: the dots take the text colour)
  const names = ["באר שבע", "אילת", "חיפה", "קריית שמונה"], places = names.map((n) => ctx.geo.find((g) => g.n === n) || ctx.geo.find((g) => g.n.includes(n.split(" ")[0]))).filter(Boolean);
  const heroBox = demo(sec, "מיקום קטן (locator)", "לאזור הפתיחה של עמוד: נקודה לכל יישוב, והיישוב הנבחר מפעים.",
    h("div", { style: { background: "var(--grad-hero)", color: "white", borderRadius: "20px", padding: "22px 12px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 26px" } },
      places.map((g) => h("figure", { style: { margin: 0, textAlign: "center", display: "grid", gap: "8px", justifyItems: "center" } },
        locator({ geo: ctx.geo, cityKey: g.k, ariaLabel: `מיקום ${g.n} על המפה` }), h("figcaption", { style: { fontSize: ".85rem", fontWeight: 600 } }, g.n)))));
  wide(heroBox);

  // 5. edge cases, all made from the same real data
  if (mmr) {
    const me = mmr.map.find((p) => String(p.k) === String(ctx.key)), c = ctx.model.city, last = mmr.analysis && mmr.analysis.last;
    const small = (extra) => mapFor(ctx, mmr, { height: 320, ...extra });
    const cityOnly = { k: ctx.key, name: c.name, v: last ? last.v : null, x: c.lon, y: c.lat };
    demo(sec, "קצה: נקודה אחת", "רק היישוב עצמו. אין עם מי להשוות, לכן בלי צבע ובלי סרגל צבעים.", small({ points: me ? [me] : [cityOnly] }));
    demo(sec, "קצה: היישוב לא ברשימה", "היישוב מוצג דרך city. הנקודות הן הנתונים האמיתיים בלעדיו.", small({ points: mmr.map.filter((p) => String(p.k) !== String(ctx.key)), city: cityOnly }));
    demo(sec, "קצה: יישוב בלי נתון", "היישוב ידוע על המפה אבל אין לו ערך: טבעת חלולה ותווית 'אין נתון'.", small({ points: mmr.map.filter((p) => String(p.k) !== String(ctx.key)), city: { ...cityOnly, v: null } }));
    demo(sec, "קצה: ערכים חסרים", "כל רביעי יישוב בלי ערך (מקבל טבעת חלולה, בלי דירוג).", small({ points: mmr.map.map((p, i) => (i % 4 === 0 && String(p.k) !== String(ctx.key) ? { ...p, v: null } : p)) }));
    demo(sec, "קצה: קבוצות קטנות", "כל שישי יישוב עם reliable: false, חלול ובלי דירוג.", small({ points: mmr.map.map((p, i) => (i % 6 === 0 && String(p.k) !== String(ctx.key) ? { ...p, reliable: false } : p)) }));
    demo(sec, "קצה: אין נקודות", "רשימה ריקה: צורת הארץ נשארת והודעה קצרה.", small({ points: [], cityKey: undefined }));
    demo(sec, "קצה: בלי geo", "לא הועבר geo: הגרף מביא אותו בעצמו ומשתמש בו לגודל הנקודות.", mapFor(ctx, mmr, { height: 320, geo: undefined }));
  }
}
