"use strict";
// css-bundle.js: Build /css/n.bundle.css at runtime by concatenating CSS files
// and inlining every @import (recursive), adjusting relative url() references
// to absolute paths from the web root.  External @imports are kept at the top.
const fs = require("fs");
const path = require("path");

const MAX_DEPTH = 20;

// ── url() rewriting ──────────────────────────────────────────────────────────
// Given the disk path of the CSS file that contains a url(ref), compute an
// absolute web-root path (starts with /).  Skips data:, http/https, and paths
// that already start with /.
function rewriteUrls(css, filePath, webRoot) {
  // Match url(...) where the inner value may be quoted or unquoted.
  // We rewrite only relative paths (no scheme, not already absolute).
  return css.replace(
    /url\(\s*(['"]?)([^)'"]+)\1\s*\)/g,
    (match, quote, ref) => {
      const trimmed = ref.trim();
      // Leave data URIs, http/https URLs, and already-absolute paths alone.
      if (
        trimmed.startsWith("data:") ||
        trimmed.startsWith("http:") ||
        trimmed.startsWith("https:") ||
        trimmed.startsWith("//") ||
        trimmed.startsWith("/")
      ) {
        return match;
      }
      // Resolve relative to the containing file's directory, then make it
      // relative to webRoot, then prefix with /.
      const abs = path.resolve(path.dirname(filePath), trimmed);
      const rel = path.relative(webRoot, abs).replace(/\\/g, "/");
      return `url("/${rel}")`;
    }
  );
}

// ── @import inlining ─────────────────────────────────────────────────────────
// Returns { css: string, mtimes: number[], files: string[] (one per mtime), externalImports: string[] }
// externalImports are @import lines for http/https that must go at the top.
function inlineImports(filePath, webRoot, seen = new Set(), depth = 0) {
  if (depth > MAX_DEPTH) {
    throw new Error(`css-bundle: import depth limit exceeded at ${filePath}`);
  }
  const canonical = path.resolve(filePath);
  if (seen.has(canonical)) return { css: "", mtimes: [], files: [], externalImports: [] };
  seen.add(canonical);

  const raw = fs.readFileSync(filePath, "utf8");
  const stat = fs.statSync(filePath);
  const mtimes = [stat.mtimeMs];
  const files = [filePath];
  const externalImports = [];

  // Process line by line to preserve order outside @import blocks.
  // We replace each @import with the inlined content of the target file.
  let output = "";

  // Regex: @import url("...") or @import "..." (with optional media / layer / supports)
  const importRe = /@import\s+(?:url\(\s*['"]?|['"])([^'")\s]+)['"]?\s*\)?([^;]*);/g;

  let lastIndex = 0;
  let match;
  importRe.lastIndex = 0;

  while ((match = importRe.exec(raw)) !== null) {
    // Append text before this @import
    output += raw.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;

    const ref = match[1].trim();
    const extra = match[2].trim(); // media query, layer, etc.

    // External (http/https/protocol-relative): keep as-is at top.
    if (ref.startsWith("http:") || ref.startsWith("https:") || ref.startsWith("//")) {
      externalImports.push(match[0]);
      continue;
    }

    // Relative import: resolve and inline.
    const target = path.resolve(path.dirname(filePath), ref);
    const sub = inlineImports(target, webRoot, seen, depth + 1);
    mtimes.push(...sub.mtimes);
    files.push(...sub.files);
    externalImports.push(...sub.externalImports);

    if (extra) {
      // Wrap in the appropriate at-rule (e.g. @media, @layer, @supports).
      // For most cases (media queries) the wrapping syntax is @media <extra> { ... }.
      // For @layer and @supports we keep the at-rule prefix as written.
      const firstWord = extra.split(/[\s(]/)[0].toLowerCase();
      if (firstWord === "layer") {
        output += `@layer ${extra.slice(firstWord.length).trim()} {\n${sub.css}\n}\n`;
      } else if (firstWord === "supports") {
        output += `@supports ${extra.slice(firstWord.length).trim()} {\n${sub.css}\n}\n`;
      } else {
        output += `@media ${extra} {\n${sub.css}\n}\n`;
      }
    } else {
      output += sub.css;
    }
  }

  // Append remainder after last @import
  output += raw.slice(lastIndex);

  // Rewrite url() references relative to webRoot
  const rewritten = rewriteUrls(output, filePath, webRoot);

  return { css: rewritten, mtimes, files, externalImports };
}

// ── Public API ───────────────────────────────────────────────────────────────
// Build the bundle from a list of top-level CSS file paths (relative to webRoot).
// Returns { css: string, mtimeKey: string, mtimes: number[], files: string[] }  where mtimeKey is a stable cache key
// and files[i] has the modification time mtimes[i] (so a caller can tell whether the bundle is still current by stat alone).
function buildBundle(bundleFiles, webRoot) {
  const chunks = [];
  const allMtimes = [];
  const allFiles = [];
  const topExternals = [];

  for (const rel of bundleFiles) {
    const abs = path.join(webRoot, rel);
    const { css, mtimes, files, externalImports } = inlineImports(abs, webRoot, new Set());
    chunks.push(css);
    allMtimes.push(...mtimes);
    allFiles.push(...files);
    topExternals.push(...externalImports);
  }

  // De-duplicate external @imports while preserving order.
  const seen = new Set();
  const externalBlock = topExternals
    .filter((s) => { if (seen.has(s)) return false; seen.add(s); return true; })
    .join("\n");

  const body = chunks.join("\n");
  const full = externalBlock ? externalBlock + "\n" + body : body;
  const mtimeKey = allMtimes.join(",");

  return { css: full, mtimeKey, mtimes: allMtimes, files: allFiles };
}

module.exports = { buildBundle };
