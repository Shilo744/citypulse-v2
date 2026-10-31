// The last tidy (w6): the first screen of the town home on tablets and the focus of the mistake dialog (the overview band went with the overview page, m3).
// Measured in a browser by src/tools/first_screen_probe.js and dialog_focus_probe.js (numbers in design-ideas/product/DONE/w6.md); these tests pin the source rules behind them.
// The small-town definition and the case counts have their own tests (product-small-towns, product-simple); the sending state of the dialog is in product-share-simple.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "web");
const read = (...p) => fs.readFileSync(path.join(WEB, ...p), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const HOME = strip(read("css", "product", "home.css"));

// the body of the @media block whose condition is `cond` (blocks here do not nest)
const media = (source, cond) => { const i = source.indexOf("@media " + cond + " {"); assert.ok(i >= 0, "@media " + cond); return source.slice(i, source.indexOf("\n}", i)); };

test("home first screen: the picture window is 72 px on a tablet, 56 and no suggestions in a short tablet window, 64 on the small phones; 390 and 1280 keep their numbers", () => {
  assert.match(HOME, /\.n-home-hero \{ --n-art-h: 96px;/, "the default (1280 and 390) is the old 96 px");
  assert.match(media(HOME, "(min-width: 701px) and (max-width: 1180px)"), /--n-art-h: 72px/);
  const short = media(HOME, "(min-width: 701px) and (max-width: 1180px) and (max-height: 860px)");
  assert.match(short, /--n-art-h: 56px/); assert.match(short, /\.n-home-suggest \{ display: none; \}/);
  assert.match(media(HOME, "(max-width: 380px)"), /--n-art-h: 64px/);
  assert.doesNotMatch(HOME, /@media \(max-width: 39\d/, "nothing keyed to 390");
  // the phone icon row of the actions is also used in the short tablet window
  assert.match(HOME, /@media \(max-width: 700px\), \(min-width: 701px\) and \(max-width: 1180px\) and \(max-height: 860px\) \{/);
});

test("the mistake dialog: the sending button is aria-disabled, never disabled (a disabled button drops the focus to the page), and a second press ends in the handler", () => {
  const js = read("js", "product", "kit", "feedback.js"), kit = strip(read("css", "product", "kit.css"));
  assert.match(js, /send\.setAttribute\("aria-disabled", "true"\)/);
  assert.doesNotMatch(js, /send\.disabled\s*=/);
  assert.match(js, /if \(sending\) return;/);
  assert.match(kit, /\.btn\[aria-disabled="true"\] \{ opacity: \.55; cursor: not-allowed; \}/);
});

test("the two probes exist and are read-only (no write to the live server)", () => {
  for (const f of ["first_screen_probe.js", "dialog_focus_probe.js"]) {
    const src = fs.readFileSync(path.join(ROOT, "src", "tools", f), "utf8");
    assert.match(src, /require\("\.\/cdp"\)/, f);
  }
  const d = fs.readFileSync(path.join(ROOT, "src", "tools", "dialog_focus_probe.js"), "utf8");
  assert.match(d, /Fetch\.enable/); assert.doesNotMatch(d, /continueRequest[^}]*feedback/);
});
