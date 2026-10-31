"use strict";
// node src/tools/contact_sheet.js --cols=3 --out=sheet.png --label="title" <png[::caption]...>
// One picture of 6 to 12 screenshots, each with a caption under it, so that a reviewer looks once instead of twelve times.
// Chrome renders an HTML page that embeds the images as data URLs; the sheet is at most 2400 px wide. A tall screenshot is cut
// at the cell's maximum height (the caption says "cut"), because a full-page capture can be 9000 px high.
const fs = require("fs");
const path = require("path");
const os = require("os");

const MAX_WIDTH = 2400, GAP = 20, PAD = 24;

function parseArgs(argv) {
  const o = { cols: 3, out: "sheet.png", label: "", files: [] };
  for (const a of argv) {
    const m = /^--([a-z]+)=(.*)$/.exec(a);
    if (m) { if (m[1] === "cols") o.cols = Math.max(1, parseInt(m[2], 10) || 3); else if (m[1] === "out") o.out = m[2]; else if (m[1] === "label") o.label = m[2]; }
    else if (!a.startsWith("--")) o.files.push(a);
  }
  return o;
}
// "dir/shot.png::Sderot 390" -> { file, caption }; without "::" the caption is the file name
function entry(arg) {
  const i = arg.indexOf("::");
  const file = i < 0 ? arg : arg.slice(0, i);
  return { file, caption: i < 0 ? path.basename(file) : arg.slice(i + 2) };
}
// the sheet's size: the cell width follows the column count, never more than 2400 px in all
function layout(cols, n, cellMin = 300, cellMax = 780) {
  const cell = Math.max(cellMin, Math.min(cellMax, Math.floor((MAX_WIDTH - 2 * PAD - (cols - 1) * GAP) / cols)));
  const width = Math.min(MAX_WIDTH, 2 * PAD + cols * cell + (cols - 1) * GAP);
  return { cell, width, rows: Math.ceil(n / cols), maxImg: Math.round(cell * 1.7) };
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function html(items, { cols, label }) {
  const L = layout(cols, items.length);
  const cells = items.map((it) => `<figure><div class="im"><img src="${it.src}" alt=""></div><figcaption>${esc(it.caption)}</figcaption></figure>`).join("\n");
  return `<!doctype html><meta charset="utf-8"><title>contact sheet</title><style>
body{margin:0;width:${L.width}px;background:#e9edf2;font:14px/1.3 system-ui,Segoe UI,sans-serif;color:#1c2733;direction:ltr}
main{padding:${PAD}px}h1{margin:0 0 14px;font-size:20px;font-weight:600}
.g{display:grid;grid-template-columns:repeat(${cols},${L.cell}px);gap:${GAP}px;align-items:start}
figure{margin:0;background:#fff;border:1px solid #c9d1da}.im{max-height:${L.maxImg}px;overflow:hidden;line-height:0}
img{width:100%;display:block}figcaption{padding:6px 8px;font-size:13px;border-top:1px solid #c9d1da;word-break:break-all}
</style><main>${label ? `<h1>${esc(label)}</h1>` : ""}<div class="g">${cells}</div></main>`;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.files.length) { console.log('usage: node src/tools/contact_sheet.js --cols=3 --out=sheet.png --label="..." <png[::caption]...>'); process.exit(1); }
  const L = layout(o.cols, o.files.length);
  const items = o.files.map(entry).map((e) => {
    const buf = fs.readFileSync(e.file);
    return { src: "data:image/png;base64," + buf.toString("base64"), caption: e.caption };
  });
  const tmp = path.join(os.tmpdir(), "contact-sheet-" + process.pid + ".html");
  fs.writeFileSync(tmp, html(items, o));
  const { launch } = require("./cdp");
  const b = await launch();
  await b.viewport(L.width, false, 900);
  await b.open("file:///" + tmp.replace(/\\/g, "/"));
  await new Promise((r) => setTimeout(r, 600));
  const out = path.resolve(o.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const h = await b.screenshot(out);
  await b.close();
  try { fs.unlinkSync(tmp); } catch (e) { /* temp file */ }
  console.log(`contact sheet: ${items.length} screens, ${L.width}x${h}, ${out}`);
  setTimeout(() => process.exit(0), 800);
}

module.exports = { parseArgs, entry, layout, html, MAX_WIDTH };
if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
