// The new entry page, lab direction "entry" (#/lab/entry, a full page without the menu). A warm front door: an illustrated hero with the question and
// the search box, what is checked (six spot illustrations), why the numbers can be trusted, a live sample of one locality, the sources and a closing search.
// Everything it says is true of the real product and every number comes from the API (css/lab/entry.css, prefix .le-).
// The page is returned at once (the search box works without any data); the numbers, names and sources are filled in when /api/meta, /api/health, /api/geo and
// /api/search have answered, and a part whose data is missing simply stays out.
import { h } from "../../ui.js";
import { getMeta, getGeo, health, search } from "../../api.js";
import { hero } from "./hero.js";
import { domains, trust, closing, sources, footer } from "./sections.js";
import { sample } from "./sample.js";

export function entryView(ctx) {
  const parts = [hero(ctx), domains(), trust(), sample(), closing(), sources(), footer()];
  const page = h("div.le", parts.map((p) => p.el));
  const soft = (p) => Promise.resolve(p).catch(() => null);          // one failed request must not take the rest of the page with it
  Promise.all([soft(getMeta()), soft(search("")), soft(health()), soft(getGeo())]).then(([meta, top, hl, geo]) => {
    const d = { meta, top: Array.isArray(top) ? top : [], hl, geo: Array.isArray(geo) ? geo : [] };
    parts.forEach((p) => { try { if (p.fill) p.fill(d); } catch (e) { console.warn("entry: a part could not be filled", e && e.message); } });
  });
  return page;
}
