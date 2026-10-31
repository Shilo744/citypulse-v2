// The chart gallery (web/gallery.html). Each chart family has a module viz/gallery-<family>.js whose default export draws demos into a section,
// using real data from ctx: { key, model (the city), meta, geo (all localities with positions), indicator(id), compare(keys, ids) }.
import { h } from "./ui.js";
import { getCity, getIndicator, getMeta, getCompare, getGeo } from "./api.js";

const FAMILIES = [["rings", "טבעות ומדדי מצב"], ["compare", "השוואות"], ["time", "גרפים לאורך זמן"], ["matrix", "מטריצות ועדיפויות"], ["spatial", "מפה"]];

(async () => {
  const q = new URLSearchParams(location.search), only = q.get("family"), key = q.get("city") || "9000", root = document.getElementById("gallery");
  const ctx = {};
  try {
    const [model, meta, geo] = await Promise.all([getCity(key), getMeta(), getGeo()]);
    Object.assign(ctx, { key, model, meta, geo, indicator: (id) => getIndicator(key, id), compare: (keys, ids) => getCompare(keys, ids) });
  } catch (e) { root.append(h("p.callout", "הנתונים לא נטענו: " + e.message)); document.documentElement.dataset.ready = "1"; return; }
  for (const [id, title] of FAMILIES) {
    if (only && only !== id) continue;
    const sec = h("section.gal-sec", { id }, h("h2.h2", title));
    root.append(sec);
    try { const m = await import(`./viz/gallery-${id}.js`); await m.default(sec, ctx); }
    catch (e) { sec.append(h("p.callout", `הגלריה של "${title}" נכשלה: ${e.message}`)); console.error("gallery " + id + ": " + (e.stack || e.message)); }
  }
  document.documentElement.dataset.ready = "1";            // the screenshot tools wait for this
})();
