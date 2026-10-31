"use strict";
/**
 * A page spec is what the ask-agent (a model, or the keyword fallback) produces: a list of blocks that refer to parameters by id.
 * resolve() checks every reference against the city model and fills in the figures, so the screen is drawn from data only.
 * Unknown ids, unknown block types and text with typed digits are dropped, never repaired by guessing.
 */
const { expand, falseClaim } = require("./guard");
const towns = require("./towns");
const { byId } = require("../catalog/indicators");
const domainsList = require("../catalog/domains");

const MAX_BLOCKS = 8;
const DOMAIN_IDS = new Set(domainsList.map((d) => d.id));
const clampN = (n, lo, hi, dflt) => { n = Number(n); return isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : dflt; };

const meta = (a) => ({ id: a.id, label: a.label, short: a.short, unit: a.unit, direction: a.direction, domain: a.domain });

function kpiItem(a) {
  const L = a.last;
  return { ...meta(a), v: L.v, year: L.year, d: L.d, nat: L.nat, target: L.target, peer: L.peer, rank: L.rank, of: L.of, level: L.level, status: a.status, statusWhy: a.statusWhy, gapTarget: L.gapTarget, meetsTarget: L.meetsTarget, guide: a.guide || null,
    trend: a.history.trendClass, delta: a.history.delta, firstYear: a.history.first.year, gapNat: L.gapNat, reliable: L.reliable,
    spark: a.series.map((s) => ({ year: s.year, v: s.v, nat: s.nat })) };
}

function recBrief(r) { return { id: r.id, title: r.title, summary: r.summary, horizon: r.horizon, effort: r.effort, score: r.score, indicators: r.indicators, why: (r.why || []).slice(0, 2) }; }

const RESOLVERS = {
  kpis(b, ctx) {
    const items = (b.items || b.inds || []).map((x) => (typeof x === "string" ? x : x && x.ind)).map((id) => ctx.ind(id)).filter(Boolean).slice(0, 8);
    return items.length ? { type: "kpis", items: items.map(kpiItem) } : null;
  },

  trend(b, ctx) {
    const a = ctx.ind(b.ind); if (!a) return null;
    return { type: "trend", ind: meta(a), series: a.series, projection: a.history.projection, trend: a.history.trendClass, delta: a.history.delta,
      compare: { nat: b.compare ? b.compare.includes("national") : true, peers: b.compare ? b.compare.includes("peers") : true, target: b.compare ? b.compare.includes("target") : true } };
  },

  multi_trend(b, ctx) {
    const list = (b.inds || []).map((id) => ctx.ind(id)).filter(Boolean).slice(0, 6);
    if (!list.length) return null;
    const sameUnit = list.every((a) => a.unit === list[0].unit);
    return { type: "multi_trend", mode: sameUnit && b.mode !== "index" ? "values" : "index", unit: sameUnit ? list[0].unit : null,
      items: list.map((a) => ({ ...meta(a), series: a.series.map((s) => ({ year: s.year, v: s.v, nat: s.nat })) })) };
  },

  rank(b, ctx) {
    const a = ctx.ind(b.ind); if (!a) return null;
    const ind = byId[a.id], year = a.last.year;
    const lowerBetter = ind.direction === "lower";
    const all = ctx.store.distribution(a.id, year, ind.minBase || 0).slice().sort((x, y) => (lowerBetter ? x.v - y.v : y.v - x.v));
    const n = clampN(b.n, 3, 15, 9), pos = all.findIndex((x) => x.key === ctx.model.city.key);
    let from = 0;
    if (b.show === "top") from = 0;
    else if (b.show === "bottom") from = Math.max(0, all.length - n);
    else from = pos < 0 ? 0 : Math.max(0, Math.min(all.length - n, pos - Math.floor(n / 2)));
    const items = all.slice(from, from + n).map((x, i) => ({ key: x.key, name: ctx.store.name(x.key), v: x.v, d: x.d, rank: from + i + 1, self: x.key === ctx.model.city.key }));
    return { type: "rank", ind: meta(a), year, total: all.length, items, show: b.show || "around" };
  },

  compare(b, ctx) {
    const list = (b.inds || (b.ind ? [b.ind] : [])).map((id) => ctx.ind(id)).filter(Boolean).slice(0, 6);
    if (!list.length) return null;
    const peerKeys = ctx.model.peers.slice(0, 6).map((p) => p.key);
    const items = list.map((a) => {
      const ind = byId[a.id], year = a.last.year, rows = [];
      rows.push({ name: ctx.model.city.name, v: a.last.v, d: a.last.d, kind: "city" });
      for (const k of peerKeys) { const c = ctx.store.cell(a.id, k, year); if (c && c.d >= (ind.minBase || 0) / 2) rows.push({ name: ctx.store.name(k), v: c.v, d: c.d, kind: "peer" }); }
      if (a.last.nat != null) rows.push({ name: "ממוצע ארצי", v: a.last.nat, kind: "national" });
      if (a.last.target != null) rows.push({ name: "יעד משרד הבריאות", v: a.last.target, kind: "target" });
      return { ind: meta(a), year, rows: rows.sort((x, y) => (ind.direction === "lower" ? x.v - y.v : y.v - x.v)) };
    });
    return { type: "compare", items };
  },

  equity(b, ctx) {
    const a = ctx.ind(b.ind); if (!a) return null;
    const groups = [];
    if (a.equity.sector) groups.push({ kind: "sector", title: "לפי מגזר", ...a.equity.sector });
    if (a.equity.ses) groups.push({ kind: "ses", title: "לפי רמה חברתית-כלכלית של האזור", ...a.equity.ses });
    return groups.length ? { type: "equity", ind: meta(a), year: a.last.year, groups } : null;
  },

  findings(b, ctx) {
    const f = b.filter || {};
    let list = ctx.model.findings.filter((x) => x.indicator || f.domain);
    if (f.domain && DOMAIN_IDS.has(f.domain)) list = list.filter((x) => x.domain === f.domain);
    if (f.indicator) list = list.filter((x) => x.indicator === f.indicator);
    if (f.polarity && ["concern", "strength", "info"].includes(f.polarity)) list = list.filter((x) => x.polarity === f.polarity);
    if (f.type) list = list.filter((x) => x.type === f.type);
    const items = list.slice(0, clampN(b.limit, 1, 8, 5)).map((x) => ({ id: x.id, text: x.text, polarity: x.polarity, severity: x.severity, type: x.type, indicator: x.indicator }));
    return items.length ? { type: "findings", items } : null;
  },

  recs(b, ctx) {
    const f = b.filter || {};
    let list = ctx.model.recommendations || [];
    if (f.domain && DOMAIN_IDS.has(f.domain)) list = list.filter((r) => r.domain === f.domain);
    if (f.indicator) list = list.filter((r) => (r.indicators || []).includes(f.indicator));
    const items = list.slice(0, clampN(b.limit, 1, 6, 3)).map(recBrief);
    return items.length ? { type: "recs", items } : null;
  },

  table(b, ctx) {
    const list = (b.inds || []).map((id) => ctx.ind(id)).filter(Boolean).slice(0, 12);
    if (!list.length) return null;
    const years = [...new Set(list.flatMap((a) => a.series.map((s) => s.year)))].sort();
    return { type: "table", years, rows: list.map((a) => ({ ...meta(a), cells: years.map((y) => { const s = a.series.find((x) => x.year === y); return s ? s.v : null; }), nat: years.map((y) => { const s = a.series.find((x) => x.year === y); return s ? s.nat : null; }) })) };
  },

  text(b, ctx) {
    const t = expand(b.text, ctx.model);
    return t ? { type: "text", text: t, heading: typeof b.heading === "string" ? b.heading.slice(0, 80) : null } : null;
  },

  // other localities named in the question, set against this one: every figure, the order, the counts and the sentence come from the data (towns.js)
  towns(b, ctx) {
    return towns.buildBlock(b, ctx);
  }
};

// getModel(key) gives the model of another locality; without it a block about other localities is dropped
function resolve(spec, store, model, getModel) {
  const ctx = { store, model, getModel, ind: (id) => model.indicators.find((a) => a.id === id) };
  const blocks = [], dropped = [];
  for (const b of (spec && Array.isArray(spec.blocks) ? spec.blocks : []).slice(0, MAX_BLOCKS)) {
    const fn = b && RESOLVERS[b.type];
    if (!fn) { dropped.push({ type: b && b.type, why: "unknown block type" }); continue; }
    let r = null;
    try { r = fn(b, ctx); } catch (e) { dropped.push({ type: b.type, why: e.message }); continue; }
    if (r) blocks.push(r); else dropped.push({ type: b.type, why: "nothing to show" });
  }
  // a page about other localities speaks with the server's own words: its sentence and its title come from the counts of the block, never from a model
  const tb = blocks.find((x) => x.type === "towns");
  // answerResolved is built by server code (fallback planner) and is trusted; a model's `answer` must pass the token guard
  const answer = tb ? tb.lead : spec && spec.answerResolved ? String(spec.answerResolved) : spec && spec.answer ? expand(spec.answer, model) : null;
  // title and subtitle also pass through expand so {{city}} and other tokens are resolved, and any leftover {{ causes rejection
  const rawTitle = typeof (spec && spec.title) === "string" ? spec.title.slice(0, 120) : null;
  const title = tb ? tb.title : rawTitle && !falseClaim(rawTitle) ? (expand(rawTitle, model) || rawTitle) : "תשובה";
  const rawSubtitle = typeof (spec && spec.subtitle) === "string" ? spec.subtitle.slice(0, 200) : null;
  const subtitle = rawSubtitle ? expand(rawSubtitle, model) : null;
  // followups are short labels; run through expand so tokens resolve; drop any that still contain {{
  const followups = Array.isArray(spec && spec.followups)
    ? spec.followups
        .filter((x) => typeof x === "string" && !/[0-9]/.test(x))
        .map((x) => expand(x, model) || (!/\{\{/.test(x) ? x : null))
        .filter(Boolean)
        .slice(0, 4)
    : [];
  return { title, subtitle, answer, blocks, dropped, followups };
}

module.exports = { resolve, MAX_BLOCKS };
