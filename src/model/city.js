"use strict";
/**
 * buildCityModel(store, key): everything the screens and the agents need about one locality, computed from the data.
 *   city        identity + the facts used for peer matching
 *   peers       similar localities (size, status, socio-economic cluster)
 *   indicators  one analysis per parameter that has data for this city (see analyze.js)
 *   domains     per domain: counts by status, standing, the indicators in it
 *   findings    typed facts, most severe first (see findings.js)
 *   priorities  the parameters with the most room to improve, weighted by importance
 *   coverage    which parameters have data and which do not
 *   sources, guideSources   the data sources used, and the documents of the official targets / reference figures shown (see guide.js)
 */
const { indicators, byId } = require("../catalog/indicators");
const domains = require("../catalog/domains");
const sources = require("../catalog/sources");
const { analyzeIndicator } = require("./analyze");
const { buildFindings } = require("./findings");
const S = require("../lib/stats");

// size proxy that every locality has: the number of children in the tipat-halav cohort. Used when the master list has no population.
function sizeOf(store, key) {
  const l = store.localities[key] || {};
  if (l.population) return l.population;
  for (const id of ["th_penta", "th_mmrv", "th_pertussis"]) {
    const ys = store.cityYears(id, key);
    if (ys.length) return store.cell(id, key, ys[ys.length - 1]).d * 55;    // roughly one cohort of 18-month-olds per 55 residents
  }
  return null;
}

function findPeers(store, key, n = 12) {
  const me = store.localities[key] || {}, size0 = sizeOf(store, key);
  if (!size0) return [];
  const cands = [];
  const hasMaster = Object.values(store.localities).some((l) => !l.unmatched);
  for (const k of Object.keys(store.localities)) {
    if (k === key || (hasMaster && store.localities[k].unmatched)) continue;
    if (store.coverage(k) < 4) continue;
    const l = store.localities[k], size = sizeOf(store, k);
    if (!size) continue;
    // distance between two localities: size (log scale), kind of authority, socio-economic cluster, Arab share of the population, district
    let d = Math.abs(Math.log(size / size0));
    if (me.mtype && l.mtype && me.mtype !== l.mtype) d += 0.6;
    if (me.ses_cluster != null && l.ses_cluster != null) d += 0.22 * Math.abs(me.ses_cluster - l.ses_cluster);
    if (me.arab_share != null && l.arab_share != null) d += 1.2 * Math.abs(me.arab_share - l.arab_share);
    if (me.district && l.district && me.district === l.district) d -= 0.1;
    cands.push({ k, d });
  }
  return cands.sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.k);
}

function buildCityModel(store, key) {
  if (!store.hasLocality(key) && !store.coverage(key)) return null;
  const loc = store.hasLocality(key) ? store.localities[key] : null;
  const peers = findPeers(store, key);
  const analyses = indicators.map((ind) => analyzeIndicator(store, ind, key, peers)).filter(Boolean);
  const findings = buildFindings(analyses, domains);

  const domainRows = domains.map((d) => {
    const list = analyses.filter((a) => a.domain === d.id);
    const judged = list.filter((a) => a.direction && a.last.level != null && !a.stale);
    const count = (s) => list.filter((a) => a.status === s).length;
    return {
      id: d.id, label: d.label, blurb: d.blurb, indicators: list.map((a) => a.id),
      counts: { strength: count("strength"), good: count("good"), watch: count("watch"), concern: count("concern"), uncertain: count("uncertain"), stale: count("stale") },
      standing: judged.length ? S.round(S.mean(judged.map((a) => a.last.level)), 0) : null,   // average place among localities, 0-100 (100 = best)
      available: indicators.filter((i) => i.domain === d.id).length
    };
  }).filter((d) => d.available > 0);

  const years = analyses.flatMap((a) => a.series.map((s) => s.year));
  const usedSources = [...new Set(analyses.map((a) => byId[a.id].source))].map((id) => ({ id, ...sources[id], fetchedAt: (store.data.sourcesFetched || {})[id] || null }));
  // the documents behind the official targets and reference figures that appear on this locality's indicators (not data sources)
  const guideSources = [...new Set(analyses.flatMap((a) => [a.guide, a.benchmark]).filter(Boolean).map((g) => g.source.id))].map((id) => ({ id, ...sources[id] }));

  return {
    city: {
      key, name: store.name(key), code: loc && loc.code != null ? loc.code : null,
      status: loc ? loc.status || null : null, district: loc ? loc.district || null : null, population: store.residents(key),
      sesCluster: loc ? loc.ses_cluster || null : null, arabShare: loc ? loc.arab_share : null, authority: loc ? loc.authority || null : null,
      lat: loc ? loc.lat || null : null, lon: loc ? loc.lon || null : null, sizeProxy: sizeOf(store, key)
    },
    peers: peers.map((k) => ({ key: k, name: store.name(k) })),
    indicators: analyses,
    domains: domainRows,
    findings,
    priorities: analyses.filter((a) => a.priority > 0 && !a.stale).sort((a, b) => b.priority - a.priority).slice(0, 6).map((a) => a.id),
    coverage: { have: analyses.length, total: indicators.length, missing: indicators.filter((i) => !analyses.find((a) => a.id === i.id)).map((i) => i.id) },
    years: years.length ? { from: Math.min(...years), to: Math.max(...years) } : null,
    counts: {
      strength: analyses.filter((a) => a.status === "strength").length, good: analyses.filter((a) => a.status === "good").length,
      watch: analyses.filter((a) => a.status === "watch").length, concern: analyses.filter((a) => a.status === "concern").length,
      stale: analyses.filter((a) => a.status === "stale").length
    },
    sources: usedSources, guideSources,
    builtAt: store.builtAt, computedAt: new Date().toISOString()
  };
}

module.exports = { buildCityModel, findPeers };
