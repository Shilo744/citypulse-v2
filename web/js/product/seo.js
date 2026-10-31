// Titles and the description meta, per route (SPEC 4.4 and 6.9). The static tags live in n.html; the pure functions here are tested in node.
import { SITE, ENTRY_TITLE } from "./config.js";

// "<page> · <town> · CityPulse"; the entry page has its own sentence; a page without a town drops that part; a page that already names the town (the question
// "where is it weakest in X?") does not get it a second time, and a title still above MAX_TITLE loses the name of the site
const MAX_TITLE = 70;
const has = (page, town) => !!(page && town && String(page).includes(town));
export function titleFor({ page, town } = {}) {
  if (!page && !town) return ENTRY_TITLE;
  const parts = [page, has(page, town) ? null : town].filter(Boolean), full = [...parts, SITE].join(" · ");
  return full.length > MAX_TITLE && parts.length && parts.join(" · ").length <= MAX_TITLE ? parts.join(" · ") : full;
}

const DESC = "תמונת מצב של בריאות הציבור לכל יישוב בישראל מנתונים רשמיים: חמש שאלות פשוטות, השוואה, מגמות והמלצות לפעולה.";
export function descriptionFor({ page, town } = {}) {
  if (town && page && !has(page, town)) return `${page} ב${town}: תמונת מצב של בריאות הציבור מנתונים רשמיים.`;
  if (town) return `בריאות הציבור ב${town}: תמונת מצב מנתונים רשמיים.`;
  return DESC;
}

export function apply(info) {
  if (typeof document === "undefined") return;
  document.title = titleFor(info);
  const m = document.querySelector('meta[name="description"]');
  if (m) m.setAttribute("content", descriptionFor(info));
  const og = document.querySelector('meta[property="og:title"]');
  if (og) og.setAttribute("content", titleFor(info));
}
