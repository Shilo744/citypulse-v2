"use strict";
// node src/tools/shot.js <url> <out.png> [width=1280] [mobile=0] [--motion] [--dark] [--eval="js to run after the page opened"]
// A full-page screenshot at a real viewport width, plus the console errors and any horizontal overflow it saw.
// Animations are off (the final state is shot); --motion keeps them on: the page is scrolled through once so that everything animates in, then shot.
// Several shots may run at the same time when each has its own CDP_SLOT (e.g. CDP_SLOT=2 node src/tools/shot.js ...).
const { launch } = require("./cdp");

(async () => {
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--")), [url, out, width = "1280", mobile = "0"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!url || !out) { console.log("usage: node src/tools/shot.js <url> <out.png> [width=1280] [mobile=0] [--motion] [--dark] [--eval=js]"); process.exit(1); }
  const motion = flags.includes("--motion"), code = (flags.find((f) => f.startsWith("--eval=")) || "").slice(7);
  if (motion) process.env.CP_MOTION = "on";
  const b = await launch();
  await b.viewport(Number(width), mobile === "1");
  await b.open(url);
  if (flags.includes("--dark")) { await b.eval(`document.documentElement.dataset.theme = "dark"`); }
  if (motion) await b.scrollThrough();
  if (code) { await b.eval(code); await new Promise((r) => setTimeout(r, 400)); }
  let h = 0;
  if (flags.includes("--viewport")) await b.viewportShot(out); else h = await b.screenshot(out);       // --viewport: just the window (900px tall), scrolled where --eval left it
  const o = await b.overflow();
  console.log(`${out}  ${width}x${h}${mobile === "1" ? " (phone)" : ""}` + (o.scrollWidth > o.clientWidth + 1 ? `  HORIZONTAL OVERFLOW ${o.scrollWidth} > ${o.clientWidth}: ${o.leaves.join(", ")}` : ""));
  b.problems().forEach((p) => console.log("  " + p));
  await b.close();
  setTimeout(() => process.exit(0), 800);
})().catch((e) => { console.error(e.message); process.exit(1); });
