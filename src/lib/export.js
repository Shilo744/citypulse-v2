"use strict";
/**
 * cityCsv(model, catalog) — CSV export of one locality's indicator data.
 * catalog = publicCatalog() from api.js (has .domains, .indicators, .sources)
 * Encoding: UTF-8 with BOM (so Excel opens it correctly in Hebrew).
 * Line endings: CRLF. Values with commas, quotes or newlines are quoted.
 */

const BOM = "\uFEFF";
const CRLF = "\r\n";

// Direction labels
const DIR_LABEL = {
  higher: "גבוה טוב",
  lower: "נמוך טוב",
};

// Status labels (product wording)
const STATUS_LABEL = {
  strength: "חזק",
  good: "תקין",
  watch: "למעקב",
  concern: "דורש טיפול",
  uncertain: "בלי שיפוט",
  stale: "בלי שיפוט",
  na: "",
};

// Unit labels – same words the product UI uses (web/js/product/city/data.js UNIT map)
const UNIT_LABEL = {
  "%":      "אחוז",
  per1000:  "לכל 1,000",
  per10k:   "לכל 10,000",
  per100k:  "לכל 100,000",
  days:     "ימים",
  years:    "שנים",
  ils:      "שקלים",
  index:    "ציון",
  count:    "מספר",
};

/**
 * Encode a filename value for RFC 5987 (used in filename* parameter).
 * Like encodeURIComponent but additionally encodes ' ! ( ) * which
 * encodeURIComponent leaves unencoded.
 */
function rfc5987(s) {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Escape a single CSV cell value.
 * If the value contains a comma, a double-quote or a newline it is wrapped in
 * double-quotes; any existing double-quotes inside are doubled.
 */
function cell(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// numbers in sentences carry invisible direction marks (U+2066, U+2069): a spreadsheet cell needs the plain text
const plain = (t) => String(t).replace(/[⁦⁩]/g, "");

// the official guideline and the international reference figure of an indicator, as cells: text with its year, the gap, whether it is met, source and link.
// The gap and "met" are filled only for a target that judges (same measure, same unit); a reference figure of other countries is a text and a source only.
const NO_GUIDE = "אין יעד רשמי";
function guideCells(a) {
  const g = a.guide, b = a.benchmark;
  const srcOf = (x) => (x && x.source ? [x.source.publisher + " — " + x.source.title, x.source.url] : ["", ""]);
  const textOf = (x) => (x.text ? plain(x.text) + " (" + x.year + ")" : "");
  const judged = g && g.judges;
  return [
    g ? textOf(g) : NO_GUIDE,
    judged && g.gap != null ? g.gap : "",
    judged && g.meets != null ? (g.meets ? "כן" : "לא") : "",
    ...srcOf(g),
    b ? textOf(b) : "",
    ...srcOf(b)
  ];
}

function row(...values) {
  return values.map(cell).join(",") + CRLF;
}

/**
 * cityCsv(model, catalog) — returns a CSV string (with BOM) describing all indicators
 * of the locality. One data row per indicator.
 * catalog = { domains: [...], indicators: [...], sources: {...} }
 */
function cityCsv(model, catalog) {
  // build lookup maps from catalog
  const domainLabel = {};
  if (catalog && catalog.domains) {
    for (const d of catalog.domains) domainLabel[d.id] = d.label;
  }
  const indMeta = {};
  if (catalog && catalog.indicators) {
    for (const i of catalog.indicators) indMeta[i.id] = i;
  }
  const sources = (catalog && catalog.sources) || {};

  const header = row(
    "תחום", "מדד", "מה נמדד", "כיוון",
    "שנה", "ערך", "יחידה",
    "ממוצע ארצי", "יישובים דומים", "יעד",
    "מצב", "מהימנות", "דירוג בארץ", "מתוך כמה יישובים",
    "מקור", "קישור",
    "יעד או הנחיה רשמית", "פער מהיעד (חיובי = טוב מהיעד)", "עומד ביעד", "מקור היעד", "קישור ליעד",
    "נקודת ייחוס", "מקור נקודת הייחוס", "קישור לנקודת הייחוס"
  );

  const lines = model.indicators.map((a) => {
    const last = a.last;
    const meta = indMeta[a.id] || {};
    const direction = a.direction ? (DIR_LABEL[a.direction] || a.direction) : "מתאר בלבד";

    // Status:
    //   descriptor (no direction)      → "מתאר בלבד"
    //   directional + unreliable       → "מעט מקרים"
    //   directional + stale/uncertain  → "בלי שיפוט" (no rank)
    //   directional + reliable         → product label
    let status;
    if (!a.direction) {
      status = "מתאר בלבד";
    } else if (!last.reliable) {
      status = "מעט מקרים";
    } else {
      status = STATUS_LABEL[a.status] != null ? STATUS_LABEL[a.status] : a.status;
    }

    const reliable = last.reliable ? "כן" : "לא";

    // Rank: only when reliable and not a stale/uncertain judgement.
    // Descriptors (direction=null) may still have a rank from the data source.
    const hasRank = last.reliable && a.status !== "stale" && a.status !== "uncertain";
    const rank = hasRank && last.rank != null ? last.rank : "";
    const of   = hasRank && last.of  != null ? last.of  : "";

    // Source → publisher + name, and URL
    const sourceKey = meta.source || "";
    const src = sources[sourceKey] || {};
    const sourceLabel = src.publisher && src.name ? src.publisher + " — " + src.name
                      : src.publisher || src.name || sourceKey;
    const sourceUrl = src.url || "";

    // Definition from catalog; fall back to short label
    const definition = meta.definition || a.short || a.label;

    // Domain label in Hebrew
    const domain = domainLabel[a.domain] || a.domain;

    return row(
      domain,
      a.label,
      definition,
      direction,
      last.year,
      last.v,
      UNIT_LABEL[a.unit] != null ? UNIT_LABEL[a.unit] : (a.unit || ""),
      last.nat != null ? last.nat : "",
      last.peer != null ? last.peer : "",
      last.target != null ? last.target : "",
      status,
      reliable,
      rank,
      of,
      sourceLabel,
      sourceUrl,
      ...guideCells(a)
    );
  });

  return BOM + header + lines.join("");
}

module.exports = { cityCsv, rfc5987 };
