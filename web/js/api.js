// Thin client for the V2 API. Results are cached for the session; the server recomputes when the store file changes.
const memo = new Map();
export async function api(path, opts) {
  const r = await fetch(path, opts);
  let body = null;
  try { body = await r.json(); } catch (e) { /* not json */ }
  if (!r.ok) throw new Error((body && body.error) || `שגיאה ${r.status}`);
  return body;
}
const cached = (k, fn) => { if (!memo.has(k)) memo.set(k, fn().catch((e) => { memo.delete(k); throw e; })); return memo.get(k); };

export const getMeta = () => cached("meta", () => api("/api/meta"));
export const getCity = (key) => cached("city:" + key, () => api(`/api/city/${encodeURIComponent(key)}`));
export const getIndicator = (key, id) => cached(`ind:${key}:${id}`, () => api(`/api/city/${encodeURIComponent(key)}/indicator/${id}`));
export const search = (q) => api("/api/search?q=" + encodeURIComponent(q));
export const getCompare = (keys, ids) => api(`/api/compare?keys=${keys.map(encodeURIComponent).join(",")}` + (ids ? `&ids=${ids.join(",")}` : ""));
export const ask = (body) => api("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const health = () => api("/api/health");
export const getGeo = () => cached("geo", () => api("/api/geo"));
export const getBriefing = (key) => api(`/api/city/${encodeURIComponent(key)}/briefing`);
export const makeBriefing = (key) => api(`/api/city/${encodeURIComponent(key)}/briefing`, { method: "POST" });
