"use strict";
// Hebrew locality-name matching. One locality is spelled differently from table to table:
// "תל אביב - יפו" / "תל אביב -יפו" / "תל-אביב יפו", "באר שבע" / "באר-שבע", "קריית גת" / "קרית גת".
// The CBS locality code is the real key; names are only used to find it.

const NIKUD = /[֑-ׇ]/g;

function norm(s) {
  return String(s == null ? "" : s)
    .replace(NIKUD, "")
    .replace(/[׳’‘`´]/g, "'")          // every geresh variant -> '  (ג'ת must stay different from גת)
    .replace(/[״"]/g, "")
    .replace(/[\-–—_.,\/\s]+/g, "")   // hyphens, dots, slashes, spaces
    .replace(/יי/g, "י")              // קריית -> קרית
    .replace(/\(.*?\)/g, "");
}

// names that data owners spell in a way no rule can fix (old name -> current official name); filled as mismatches are found
const ALIASES = {
  "נצרת עילית": "נוף הגליל",
  "יהוד": "יהוד-מונוסון"
};

function editDistanceAtMostOne(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// index: [{ code, name_he, ...}] -> matcher
function makeMatcher(localities, extraAliases = {}) {
  const byNorm = new Map();
  for (const l of localities) {
    const k = norm(l.name_he);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k).push(l);
  }
  const aliasMap = new Map(Object.entries({ ...ALIASES, ...extraAliases }).map(([a, b]) => [norm(a), norm(b)]));
  const keys = [...byNorm.keys()];

  return function match(name) {
    let k = norm(name);
    if (!k) return null;
    if (aliasMap.has(k)) k = aliasMap.get(k);
    let hit = byNorm.get(k);
    if (hit) return hit.length === 1 ? hit[0] : hit.slice().sort((a, b) => (b.population || 0) - (a.population || 0))[0];
    // the same name plus a qualifier ("תל אביב - יפו" vs "תל אביב"): accept a unique prefix of at least 5 letters
    if (k.length >= 5) {
      const pre = keys.filter((x) => x.startsWith(k) || k.startsWith(x)).filter((x) => x.length >= 5);
      if (pre.length === 1) return byNorm.get(pre[0])[0];
    }
    // one letter wrong or missing, unique result only (short names are too easy to confuse, so six letters or more)
    if (k.length >= 6) {
      const near = keys.filter((x) => editDistanceAtMostOne(x, k));
      if (near.length === 1) return byNorm.get(near[0])[0];
    }
    return null;
  };
}

module.exports = { norm, makeMatcher, editDistanceAtMostOne };
