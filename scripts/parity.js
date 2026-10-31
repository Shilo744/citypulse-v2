"use strict";
// Compares the answers of two hosts (the Node server and the Worker) for the same requests: node scripts/parity.js <baseA> <baseB> [towns=40]
// Same status and the same body (JSON compared as data) for the API, the share pages, robots and sitemap.
const [A, B, N = "40"] = process.argv.slice(2);
if (!A || !B) { console.log("usage: node scripts/parity.js http://localhost:8800 http://127.0.0.1:8788 [towns]"); process.exit(1); }
const get = async (base, p, init) => { const r = await fetch(base + p, { redirect: "manual", ...init }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { /* not json */ } return { status: r.status, type: (r.headers.get("content-type") || "").split(";")[0], text: t, json: j, loc: r.headers.get("location") }; };
const norm = (t) => t.replace(/"computedAt":"[^"]*"/g, "");
const same = (a, b) => a.status === b.status && a.type === b.type && (a.json && b.json ? norm(JSON.stringify(a.json)) === norm(JSON.stringify(b.json)) : a.text.replace(/https?:\/\/[^/"]+/g, "H") === b.text.replace(/https?:\/\/[^/"]+/g, "H")) && a.loc === b.loc;
(async () => {
  const geo = (await get(A, "/api/geo")).json, keys = geo.map((g) => g.k);
  const sample = [...new Set(["1031", "8300", "9000", "472", "16", "99", "3000", "6300", "7", "935", ...keys.filter((_, i) => i % Math.max(1, Math.floor(keys.length / Number(N))) === 0)])].slice(0, Number(N) + 10);
  const meta = (await get(A, "/api/meta")).json, ids = meta.indicators.map((i) => i.id);
  const paths = ["/api/health", "/api/meta", "/api/geo", "/api/search?q=" + encodeURIComponent("שדר"), "/api/search?q=" + encodeURIComponent("תל אביב"), "/api/search?q=", "/robots.txt", "/sitemap.xml", "/api/nope", "/api/city/zzz", "/api/city/999999", "/s/zzz", "/api/compare?keys=1031,8300,9000&ids=" + ids.slice(0, 6).join(","), "/api/compare?keys=1031,472"];
  for (const k of sample) { paths.push(`/api/city/${k}`, `/api/city/${k}/export.csv`, `/s/${k}`, `/s/${k}?q=peers`); }
  let n = 0;
  for (const k of sample.slice(0, Math.min(sample.length, 25))) {
    const a = (await get(A, `/api/city/${k}`)).json; if (!a) continue;
    for (const ind of a.indicators.slice(0, 6)) paths.push(`/api/city/${k}/indicator/${ind.id}`);
  }
  paths.push("/api/city/1031/indicator/nope", "/api/city/1031/briefing");
  const bad = [];
  for (const p of paths) {
    const [a, b] = await Promise.all([get(A, p), get(B, p)]);
    n++; if (!same(a, b)) bad.push({ p, a: [a.status, a.type, a.text.slice(0, 80)], b: [b.status, b.type, b.text.slice(0, 80)] });
  }
  console.log(`parity: ${n} requests, ${bad.length} differ`);
  bad.slice(0, 12).forEach((x) => console.log(JSON.stringify(x)));
  process.exit(bad.length ? 1 : 0);
})();
