"use strict";
// Builds data/localities.json: the master list of Israeli localities used to match names, find peers and describe a place.
// Source: the Central Bureau of Statistics locality file (code, names, municipal status, district, population, socio-economic cluster, coordinates),
// collected in research/localities-master.json. Run: node src/collect/build_localities.js
const fs = require("fs");
const path = require("path");
const cfg = require("../lib/config");

const SRC = path.join(cfg.ROOT, "research", "localities-master.json");
const STATUS = { city: "עירייה", local_council: "מועצה מקומית", regional_council: "ישוב במועצה אזורית", none: null };

// "תל אביב -יפו" -> "תל אביב-יפו"
const display = (s) => String(s || "").replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim();

function main() {
  const raw = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const out = [];
  for (const x of raw) {
    // "non_locality" rows (Bedouin tribes, military camps ...) have no population in the CBS list but do appear in health tables, so they are kept
    const pop = x.pop24 || null, arab = x.arab24 || 0;
    out.push({
      code: x.code, kind: x.kind, name_he: display(x.he), name_en: x.en || null,
      mtype: x.mtype, status: x.mtype === "regional_council" && x.mstat ? "ישוב ב" + x.mstat : (STATUS[x.mtype] || x.mstat || null),
      authority: x.mstat || null, authority_code: x.la || null,
      district: x.dist_he || null, subdistrict: x.sub_he || null, form: x.form_he || null, size_group: x.size || null,
      population: pop, arab_share: pop && x.arab24 != null ? Math.round((1000 * arab) / pop) / 1000 : null,
      ses_cluster: x.ses21 || null, ses_index: x.ses21v != null ? x.ses21v : null, periphery_cluster: x.per20 || null,
      lat: x.lat || null, lon: x.lon || null, metro: x.metro || null, founded: x.founded || null,
      population_history: x.isr_hist || null
    });
  }
  fs.mkdirSync(cfg.DATA, { recursive: true });
  fs.writeFileSync(path.join(cfg.DATA, "localities.json"), JSON.stringify(out));
  const withPop = out.filter((o) => o.population).length;
  console.log(`localities: ${out.length} (with population ${withPop}, with SES cluster ${out.filter((o) => o.ses_cluster).length}, with coordinates ${out.filter((o) => o.lat).length})`);
}
main();
