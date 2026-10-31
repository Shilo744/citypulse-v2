"use strict";
// One-off derivation: welfare-ministry authority code -> CBS locality code, from the welfare scout's crosswalk
// (research/welfare_authority_crosswalk.json). Only cities and local councils are kept: a regional council is not one locality.
//   node src/collect/build_welfare_crosswalk.js
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "research", "welfare_authority_crosswalk.json");
const OUT = path.join(__dirname, "..", "catalog", "welfare_crosswalk.json");

const j = JSON.parse(fs.readFileSync(SRC, "utf8"));
const map = {};
for (const r of j.rows) if (r.type === "locality" && r.cbs_code) map[String(Number(r.welfare_code))] = r.cbs_code;
fs.writeFileSync(OUT, JSON.stringify(map, null, 0));
console.log(`welfare crosswalk: ${Object.keys(map).length} authorities -> ${path.relative(process.cwd(), OUT)}`);
