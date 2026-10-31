"use strict";
// What the ask-agent may do beyond the city model: look for a dataset on the national open-data portal.
// It returns links only (title, publisher, page), never numbers: figures enter the product through collectors that were checked.
const { getJson, CKAN } = require("../lib/http");

async function searchDatasets(query, rows = 6) {
  const q = String(query || "").slice(0, 120).trim();
  if (!q) return [];
  const j = await getJson(`${CKAN}/package_search?q=${encodeURIComponent(q)}&rows=${rows}`, { timeout: 25000 });
  const res = (j.result && j.result.results) || [];
  return res.map((p) => ({
    title: p.title, org: p.organization ? p.organization.title : null,
    url: "https://data.gov.il/dataset/" + p.name, resources: p.num_resources, modified: (p.metadata_modified || "").slice(0, 10)
  }));
}

module.exports = { searchDatasets };
