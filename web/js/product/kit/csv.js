// CSV for Excel: UTF-8 with a BOM, comma separated, CRLF, quoted where needed, and no cell that Excel could read as a formula.
import { announce, act } from "./base.js";

export const BOM = "﻿";

// one cell. Numbers go in as numbers; text that starts with = + - @ (or a tab or CR) gets an apostrophe in front so a spreadsheet shows it as text.
export function csvCell(v) {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "כן" : "לא";
  let s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("; ") : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// rowsToCsv(rows, columns): columns are { key, title } or { title, get(row) }; a bare string is both key and title
export function rowsToCsv(rows, columns) {
  const cols = columns.map((c) => (typeof c === "string" ? { key: c, title: c } : { title: c.key, ...c }));
  const line = (cells) => cells.map(csvCell).join(",") + "\r\n";
  let out = BOM + line(cols.map((c) => c.title));
  rows.forEach((r, i) => { out += line(cols.map((c) => (c.get ? c.get(r, i) : r == null ? null : r[c.key]))); });
  return out;
}

// citypulse-1031-all-2026-10-29.csv
export function csvName(key, name, date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  const clean = (s) => String(s).replace(/[^\w֐-׿-]+/g, "-").replace(/^-+|-+$/g, "");
  return ["citypulse", key == null ? "" : clean(key), name ? clean(name) : "", day].filter(Boolean).join("-") + ".csv";
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = filename; a.hidden = true;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// csvButton(getRows, name, { key, label }): getRows() returns { rows, columns } (it may be async: the rows are built when the button is pressed)
export function csvButton(getRows, name, { key, label = "הורדת נתונים (CSV)" } = {}) {
  const btn = act("button", { type: "button" }, "download", label);
  btn.addEventListener("click", async () => {
    if (btn.getAttribute("aria-busy") === "true") return;
    btn.setAttribute("aria-busy", "true");
    try {
      const { rows, columns } = await getRows();
      downloadBlob(new Blob([rowsToCsv(rows, columns)], { type: "text/csv;charset=utf-8" }), csvName(key, name));
    } catch (e) { announce("הקובץ לא הוכן. נסו שוב."); }
    btn.removeAttribute("aria-busy");
  });
  return btn;
}

// the file the server already builds for a town: /api/city/<key>/export.csv
export const exportHref = (key) => `/api/city/${encodeURIComponent(String(key))}/export.csv`;
export function csvLink(href, label = "הורדת נתונים (CSV)") {
  return act("a", { href, download: "" }, "download", label);
}
