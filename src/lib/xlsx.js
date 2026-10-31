"use strict";
// Minimal .xlsx reader (zip + sheet XML) with no dependencies: enough for the statistical tables that agencies publish.
// Input files are untrusted data, so this only parses text; it never evaluates anything. Not supported: .xls (legacy BIFF), formulas
// (the cached value is used), dates (they come back as the serial number).
const zlib = require("zlib");

function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip file");
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad zip directory");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    files[buf.toString("utf8", p + 46, p + 46 + nlen)] = { method, csize, off };
    p += 46 + nlen + elen + clen;
  }
  return {
    names: Object.keys(files),
    read(name) {
      const f = files[name]; if (!f) return null;
      const start = f.off + 30 + buf.readUInt16LE(f.off + 26) + buf.readUInt16LE(f.off + 28);
      const data = buf.subarray(start, start + f.csize);
      return f.method === 0 ? data : zlib.inflateRawSync(data, { maxOutputLength: 200 * 1024 * 1024 });
    }
  };
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()]));
const textOf = (xml) => decode((xml.match(/<t\b[^>]*>[\s\S]*?<\/t>/g) || []).map((x) => x.replace(/<[^>]+>/g, "")).join(""));
const colIndex = (ref) => { let n = 0; for (const ch of ref.match(/^[A-Z]+/)[0]) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

function sharedStrings(xml) {
  if (!xml) return [];
  return (xml.match(/<si\b[^>]*>[\s\S]*?<\/si>|<si\s*\/>/g) || []).map(textOf);
}

function parseSheet(xml, sst) {
  const rows = [];
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
  let m;
  while ((m = rowRe.exec(xml))) {
    const rn = parseInt((m[1].match(/\br="(\d+)"/) || [])[1], 10);
    const cells = [];
    if (m[2]) {
      const cRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let c;
      while ((c = cRe.exec(m[2]))) {
        const ref = (c[1].match(/\br="([A-Z]+\d+)"/) || [])[1];
        if (!ref) continue;
        const t = (c[1].match(/\bt="(\w+)"/) || [])[1], inner = c[2] || "";
        let v = null;
        if (t === "inlineStr") v = textOf(inner);
        else {
          const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
          if (vm) v = t === "s" ? sst[parseInt(vm[1], 10)] : t === "str" ? decode(vm[1]) : t === "b" ? vm[1] === "1" : t === "e" ? null : Number(vm[1]);
        }
        cells[colIndex(ref)] = v;
      }
    }
    rows[rn > 0 ? rn - 1 : rows.length] = cells;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

// parseXlsx(buffer) -> { names: [sheet names], sheet(name) -> rows (arrays of cell values, holes = null) }
function parseXlsx(buf) {
  const zip = readZip(buf);
  const wb = zip.read("xl/workbook.xml");
  if (!wb) throw new Error("not an xlsx workbook");
  const rels = (zip.read("xl/_rels/workbook.xml.rels") || Buffer.alloc(0)).toString("utf8");
  const target = {};
  for (const r of rels.match(/<Relationship\b[^>]*>/g) || []) {
    const id = (r.match(/\bId="([^"]+)"/) || [])[1], t = (r.match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && t) target[id] = t.startsWith("/") ? t.slice(1) : "xl/" + t;
  }
  const sheets = [];
  for (const s of wb.toString("utf8").match(/<sheet\b[^>]*>/g) || []) {
    const name = decode((s.match(/\bname="([^"]*)"/) || [])[1] || ""), rid = (s.match(/\br:id="([^"]+)"/) || [])[1];
    if (rid && target[rid]) sheets.push({ name, path: target[rid] });
  }
  const sstBuf = zip.read("xl/sharedStrings.xml");
  const sst = sharedStrings(sstBuf ? sstBuf.toString("utf8") : null);
  return {
    names: sheets.map((s) => s.name),
    sheet(name) {
      const s = sheets.find((x) => x.name === name);
      if (!s) return null;
      return parseSheet(zip.read(s.path).toString("utf8"), sst);
    }
  };
}

module.exports = { parseXlsx, readZip };
