// The action plan of a city (DESIGN_V3.md): a tinted header with the number of recommendations by horizon, then a roadmap in three lanes
// (quick, mid, strategic) whose rows open in place. A city without recommendations gets an honest explanation of why, not an empty frame.
// View layer only: every number and sentence comes from the model (css/pages/actions.css, prefix .ac-).
import { h, icon, num, ltr, clear } from "../ui.js";
import { recRow, HORIZONS } from "./rec.js";
import { shareBtn, printBtn } from "./shared.js";
import { viz } from "../viz/core.js";

const nRecs = (n) => (n === 1 ? "המלצה" : "המלצות");
const topScore = (rs) => rs.reduce((m, r) => Math.max(m, Number(r.score) || 0), 0);
const CAP = 9;          // the model keeps the nine highest priorities (REC_RULES.maxRecs): the page says so, and never presents the count as a finding

// the line under the figures: how the 0-100 score is made, and the caution that goes with every recommendation
const howLine = (key) => h("p.ac-how", h("b", "איך נקבע הציון: "), "העדיפות (0 עד 100) נגזרת מחומרת הממצאים שמאחורי ההמלצה, ומופחתת כשהראיות חלשות או כשהמאמץ גדול. ציון גבוה פירושו עדיפות גבוהה. נק׳ בטקסט פירושו נקודות אחוז. לפני יישום, כדאי לבדוק את ההמלצות מול הצוות המקצועי המקומי. ",
  h("a", { href: `#/c/${key}/method` }, "שיטה ומקורות"), ".");
const tools = () => h("div.ac-tools.no-print", printBtn(), shareBtn());

// ── no recommendations ───────────────────────────────────────────────────
// The headline says the one cause that applies: no data, groups too small to judge, or no finding above the bar.
function emptyPlan(model) {
  const key = model.city.key, name = model.city.name, cov = model.coverage || {}, have = cov.have || 0, total = Math.max(cov.total || 0, have);
  const small = Math.min(have, (model.indicators || []).filter((a) => a.status === "uncertain").length), usable = have - small, missing = total - have;
  const mostlySmall = have > 0 && small * 2 >= have;
  const cause = !have ? `אין ל${name} נתונים רשמיים במדדים שהמערכת עוקבת אחריהם, ולכן אין על מה לבסס המלצה.`
    : mostlySmall ? `אין המלצות כי ${num(small, 0)} מתוך ${num(have, 0)} המדדים של ${name} נמדדים על קבוצות קטנות מדי להשוואה. הם מוצגים, אבל אינם נכללים בדירוג ובמסקנות.`
    : `המדדים של ${name} לא העלו ממצא שעובר את סף ההמלצה: מדד חלש, מגמה בהידרדרות או פער בתוך העיר.`;
  const more = have && !mostlySmall && small ? `עוד ${num(small, 0)} מתוך ${num(have, 0)} המדדים נמדדים על קבוצות קטנות מדי להשוואה, ולכן אינם נכללים במסקנות.` : null;
  const primary = have ? { href: `#/c/${key}/compare`, text: "להשוות ליישובים דומים" } : { href: `#/c/${key}/coverage`, text: "אילו מדדים קיימים ואילו חסרים" };
  const seg = (cls, n, i) => (n > 0 ? h("i.ac-cov-seg.grow-x." + cls, { style: { flexGrow: String(n), "--i": i } }) : null);
  const bar = have ? viz(h("div.ac-cov", { "aria-hidden": "true" }, seg("is-use", usable, 0), seg("is-small", small, 1), seg("is-miss", missing, 2))) : null;
  const fig = (label, n, of) => h("div.keyfig.ac-kf-item", h("span.kf-label", label), h("b.kf-num", n ? { "data-count": "" } : null, String(n), of ? h("small", ["מתוך ", ltr(String(of))]) : null));
  const figs = have ? [fig("מדדים שאפשר להסיק מהם", usable, total), fig("מדדים על קבוצות קטנות מדי", small), fig("מדדים ללא נתונים", missing)] : [];
  const band = h("section.band.ac-head.ac-empty.rv", { "aria-labelledby": "ac-h1" },
    h("div.ac-head-top", h("div", h("div.ac-eyebrow", icon("list"), "תוכנית פעולה"), h("h1.ac-h1", { id: "ac-h1" }, `אין כרגע המלצות ל${name}`),
      h("p.ac-lede", cause), more ? h("p.ac-lede", more) : null,
      h("a.btn.primary.ac-primary", { href: primary.href }, primary.text, icon("left"))), tools()),
    figs.length ? [bar, h("div.keyfigs.ac-kf", figs)] : null);
  const go = (href, title, sub) => h("a.row-item.ac-go", { href }, h("div", h("div.ri-title", title), h("div.ri-sub", sub)), h("span.ac-go-ic", { "aria-hidden": "true" }, icon("left")));
  const rows = [
    have ? go(`#/c/${key}`, `תמונת המצב של ${name}`, "המדדים שיש ליישוב, כל אחד עם ההשוואה והמקור שלו.") : null,
    have ? go(`#/c/${key}/coverage`, "כיסוי הנתונים", "אילו מדדים קיימים ליישוב, ואילו חסרים בנתונים הרשמיים.") : null,
    go(`#/c/${key}/method`, "שיטה ומקורות", "איך נבנות ההמלצות, ומתי מדד נחשב אמין מספיק.")].filter(Boolean);
  return [band, h("section.sec.ac-next", { "aria-labelledby": "ac-next-t" },
    h("div.sec-head.rv", h("div", h("div.sec-eyebrow", "מה אפשר לעשות כאן"), h("h2.sec-title", { id: "ac-next-t" }, "עוד מקומות לבדוק"))),
    h("div.rowlist.rv", rows))];
}

// ── the plan ─────────────────────────────────────────────────────────────
export function actionsView(model) {
  const key = model.city.key, name = model.city.name, recs = model.recommendations || [], root = h("div.ac");
  if (!recs.length) { root.append(...emptyPlan(model)); return root; }

  const domOrder = [...new Set(recs.map((r) => r.domain))], domLabel = (id) => (model.domains.find((d) => d.id === id) || {}).label || id;
  let fh = "all", fd = "all", first = true;
  const pass = (r, h2, d2) => (h2 === "all" || r.horizon === h2) && (d2 === "all" || r.domain === d2);

  // the three figures of the header: plain numbers (the one control for the horizon is the filter bar of the roadmap)
  const kfs = HORIZONS.map((x) => {
    const rs = recs.filter((r) => r.horizon === x.id), n = rs.length;
    return h("div.keyfig.ac-kf-item" + (n ? "" : ".is-zero"), { "data-hz": x.id },
      h("span.kf-label", h("b", x.name), " · ", x.range),
      h("b.kf-num", n ? { "data-count": "" } : null, String(n), h("small", nRecs(n))),
      n ? h("span.kf-delta", ["הציון הגבוה ביותר: ", ltr(String(topScore(rs)))]) : h("span.kf-delta", "אין המלצות בטווח הזה"));
  });
  const capped = recs.length >= CAP;
  const band = h("section.band.ac-head.rv", { "aria-labelledby": "ac-h1" },
    h("div.ac-head-top", h("div", h("div.ac-eyebrow", icon("list"), "תוכנית פעולה"), h("h1.ac-h1", { id: "ac-h1" }, `מה כדאי לעשות ב${name}`),
      h("p.ac-lede", capped ? `מוצגות תשע העדיפויות הגבוהות ביותר, מסודרות לפי הטווח שבו אפשר לבצע אותן. מספר ההמלצות אינו מדד לחומרת המצב ביישוב. הן נגזרות אוטומטית מהממצאים: מה חלש, מה מידרדר, ואיפה יש פער בתוך העיר.`
        : [ltr(String(recs.length)), ` ${nRecs(recs.length)} לפעולה, מסודרות לפי הטווח שבו אפשר לבצע אותן. הן נגזרות אוטומטית מהממצאים: מה חלש, מה מידרדר, ואיפה יש פער בתוך העיר.`])), tools()),
    h("div.keyfigs.ac-kf", { role: "group", "aria-label": "מספר ההמלצות לפי טווח זמן" }, kfs), howLine(key));

  // the filters: the horizon and the domain, each with how many recommendations it holds under the other filter
  const bar = h("div.ac-bar.no-print"), status = h("p.sr", { role: "status" }), board = h("div.ac-board"), wrap = h("div.ac-boardwrap", board);
  const chipGroup = (label, opts, cur, set) => h("div.ac-bar-g", { role: "group", "aria-label": label }, h("span.ac-bar-l", label),
    opts.map(([k, text, n]) => h("button.chip", { type: "button", "data-g": label, "data-k": k, "aria-pressed": String(cur === k), "aria-label": `${text}, ${n} ${nRecs(n)}`, disabled: n === 0 && cur !== k ? true : null,
      onclick: () => { set(k); draw(); const again = [...bar.querySelectorAll("button.chip")].find((b) => b.dataset.g === label && b.dataset.k === k); if (again) again.focus({ preventScroll: true }); } }, text, h("small", String(n)))));          // the chips are drawn again: the keyboard stays on the one it pressed

  function draw() {
    const shown = recs.filter((r) => pass(r, fh, fd)), count = (fn) => recs.filter(fn).length;
    clear(bar);
    const hOpts = [["all", "הכול", count((r) => pass(r, "all", fd))], ...HORIZONS.map((x) => [x.id, x.name, count((r) => pass(r, x.id, fd))])];
    const dOpts = [["all", "הכול", count((r) => pass(r, fh, "all"))], ...domOrder.map((d) => [d, domLabel(d), count((r) => pass(r, fh, d))])];
    if (HORIZONS.filter((x) => recs.some((r) => r.horizon === x.id)).length > 1) bar.append(chipGroup("טווח זמן", hOpts, fh, (k) => { fh = k; }));
    if (domOrder.length > 1) bar.append(chipGroup("תחום", dOpts, fd, (k) => { fd = k; }));
    board.classList.remove("has-open");
    clear(board);
    const lanes = HORIZONS.filter((x) => shown.some((r) => r.horizon === x.id));
    board.style.setProperty("--lanes", String(Math.max(1, lanes.length)));
    lanes.forEach((x) => {
      const rs = shown.filter((r) => r.horizon === x.id), lane = h("section.ac-lane.rv", { "data-hz": x.id, "aria-labelledby": "ac-l-" + x.id },
        h("header.ac-lane-head", h("h3.ac-lane-name", { id: "ac-l-" + x.id }, x.name), h("p.ac-lane-sub", [x.range, " · ", ltr(String(rs.length)), ` ${nRecs(rs.length)}`])),
        h("div.ac-lane-body", rs.map((r, i) => recRow(r, key, { model, index: i, start: r === recs[0], lead: i === 0 }))));
      if (!first) lane.querySelectorAll(".rv").forEach((el) => el.classList.add("in", "done"));          // a filter change redraws the lanes: no second entrance
      if (!first) lane.classList.add("in", "done");
      board.append(lane);
    });
    if (!shown.length) board.append(h("div.ac-none", h("p", "אין המלצות בסינון הזה."), h("button.btn.sm", { type: "button", onclick: () => { fh = "all"; fd = "all"; draw(); } }, "הצגת כל ההמלצות")));
    status.textContent = shown.length === recs.length ? `מוצגות כל ${recs.length} ההמלצות` : `מוצגות ${shown.length} מתוך ${recs.length} המלצות`;
    first = false;
  }
  draw();

  // A row that opens needs room: while one is open the lanes stack at full width, and the page keeps the row where the eye was.
  let topBefore = 0, rowBefore = null;
  board.addEventListener("click", (e) => { const t = e.target.closest && e.target.closest(".ac-toggle"); rowBefore = t ? t.closest(".ac-rec") : null; topBefore = rowBefore ? rowBefore.getBoundingClientRect().top : 0; }, true);
  board.addEventListener("click", () => {
    if (!rowBefore) return;
    const was = board.classList.contains("has-open"), now = !!board.querySelector(".ac-rec.is-open");
    board.classList.toggle("has-open", now);
    if (was !== now) { const dy = rowBefore.getBoundingClientRect().top - topBefore; if (Math.abs(dy) > 1) window.scrollBy({ top: dy, left: 0, behavior: "instant" }); }
    rowBefore = null;
  });

  root.append(band, h("section.sec.ac-roadmap", { id: "ac-roadmap", "aria-labelledby": "ac-road-t" },
    h("div.sec-head.rv", h("div", h("div.sec-eyebrow", h("b", "01"), "מפת דרכים"), h("h2.sec-title", { id: "ac-road-t" }, "מה עושים, ובאיזה סדר"),
      h("p.sec-lead", "בכל טווח ההמלצות מסודרות מהעדיפות הגבוהה אל הנמוכה. לחיצה על המלצה פותחת את הנימוק, הצעדים, אחראי, מדדי ההצלחה והראיות. כדי לראות רק טווח אחד או תחום אחד, בחרו אותו בסינון."))),
    bar, status, wrap));
  return root;
}
