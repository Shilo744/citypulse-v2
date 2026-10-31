"use strict";
const fs = require("fs");
const path = require("path");

// Replace em-dash (–) or en-dash (—) between two digits with a regular hyphen.
// Pattern: digit, em/en-dash, digit — only these sequences, nothing else.
const PATTERN = /(\d)[–—](\d)/g;

const files = [
  "src/catalog/indicators.js",
  "src/catalog/interventions.js",
  "src/catalog/sources.js",
  "src/catalog/evidence.json",
];

const root = path.resolve(__dirname, "..");

for (const rel of files) {
  const file = path.join(root, rel);
  const original = fs.readFileSync(file, "utf8");
  let count = 0;
  const fixed = original.replace(PATTERN, (_, a, b) => {
    count++;
    return `${a}-${b}`;
  });
  if (count > 0) {
    fs.writeFileSync(file, fixed, "utf8");
    console.log(`${rel}: ${count} replacement(s)`);
  } else {
    console.log(`${rel}: 0 replacements (nothing to do)`);
  }
}
