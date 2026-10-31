"use strict";
// Read access to data/store/store.json: one place that knows how figures are laid out.
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");
const { norm } = require("../lib/names");
const { byId } = require("../catalog/indicators");

// context parameters (population, socio-economic level, poverty) describe a place but are not a health profile
const isContext = (id) => !!(byId[id] && byId[id].domain === "context");

class Store {
  constructor(data) {
    this.data = data;
    this.builtAt = data.builtAt;
    this.localities = data.localities || {};
    this.latestYear = Math.max(0, ...Object.values(data.indicators || {}).flatMap((i) => i.years || []));
    this._dist = new Map();
    this._index = null;
  }

  static load(file = path.join(cfg.STORE, "store.json")) {
    return new Store(JSON.parse(fs.readFileSync(file, "utf8")));
  }

  // Safe key check: rejects prototype property names (__proto__, constructor, toString …)
  hasLocality(key) { return Object.hasOwn(this.localities, key); }
  hasIndicatorId(id) { return Object.hasOwn(this.data.indicators, id); }
  ind(id) { return this.hasIndicatorId(id) ? this.data.indicators[id] : null; }
  hasIndicator(id) { return this.hasIndicatorId(id); }
  years(id) { const i = this.ind(id); return i ? i.years : []; }
  latestYearOf(id) { const y = this.years(id); return y.length ? y[y.length - 1] : 0; }
  nat(id, year) { const i = this.ind(id); return (i && i.nat[year]) || null; }
  target(id, year) { const i = this.ind(id); return i && i.target[year] != null ? i.target[year] : null; }
  cell(id, key, year) { const i = this.ind(id); return (i && i.loc[key] && i.loc[key][year]) || null; }
  cityYears(id, key) { const i = this.ind(id); return i && i.loc[key] ? Object.keys(i.loc[key]).map(Number).sort((a, b) => a - b) : []; }

  // all localities with a figure for this indicator and year; withBase = only those whose group is large enough to rank
  distribution(id, year, minBase = 0) {
    const k = `${id}|${year}|${minBase}`;
    if (this._dist.has(k)) return this._dist.get(k);
    const i = this.ind(id), out = [];
    if (i) for (const [key, years] of Object.entries(i.loc)) { const c = years[year]; if (c && (c.d == null || c.d >= minBase)) out.push({ key, v: c.v, d: c.d }); }
    this._dist.set(k, out);
    return out;
  }

  // population from the master list; for places the master has no population for, the size of the tipat-halav cohort stands in
  size(key) {
    const l = this.localities[key] || {};
    if (l.population) return l.population;
    for (const id of ["th_penta", "th_mmrv", "th_pertussis"]) {
      const ys = this.cityYears(id, key);
      if (ys.length) return this.cell(id, key, ys[ys.length - 1]).d * 55;
    }
    return 0;
  }

  // residents as the page head shows them: the Israeli residents at the end of the latest year of the CBS series (the population the per-capita
  // rates are divided by); the master-file population when there is no series; null when the place is not in the master list
  residents(key) {
    const loc = this.hasLocality(key) ? this.localities[key] : null;
    if (!loc) return null;
    const h = loc.population_history;
    if (h) { const ys = Object.keys(h).map(Number).sort((a, b) => a - b); if (ys.length) return h[ys[ys.length - 1]]; }
    return loc.population || null;
  }

  name(key) { const l = this.hasLocality(key) ? this.localities[key] : null; return l ? (l.name_he || l.name || key) : key; }

  // locality search for the type-ahead: only localities that have at least one figure
  search(q, limit = 12) {
    if (!this._index) {
      const have = new Set();
      for (const [id, i] of Object.entries(this.data.indicators)) if (!isContext(id)) for (const key of Object.keys(i.loc)) have.add(key);
      this._index = [...have].map((key) => ({ key, name: this.name(key), n: norm(this.name(key)), pop: this.residents(key) || this.size(key) }));
    }
    const nq = norm(q);
    if (!nq) return this._index.slice().sort((a, b) => b.pop - a.pop).slice(0, limit);
    const starts = this._index.filter((x) => x.n.startsWith(nq)), inside = this._index.filter((x) => !x.n.startsWith(nq) && x.n.includes(nq));
    return [...starts.sort((a, b) => b.pop - a.pop), ...inside.sort((a, b) => b.pop - a.pop)].slice(0, limit);
  }

  // how much data a locality has: used to hide places that appear in one table only
  coverage(key) {
    let have = 0;
    for (const id of Object.keys(this.data.indicators)) {
      if (!isContext(id)) {
        const ind = this.data.indicators[id];
        if (ind && ind.loc && Object.hasOwn(ind.loc, key)) have++;
      }
    }
    return have;
  }
}

module.exports = { Store };
