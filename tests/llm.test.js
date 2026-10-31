"use strict";
// The language-model layer: roles, cost ledger, balance and rate guards, the city briefing and the dataset finder.
// The network is replaced by a stub, so nothing here costs money.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const cfg = require("../src/lib/config");
const llm = require("../src/lib/llm");
const tools = require("../src/agent/tools");
const { Store } = require("../src/model/store");
const { buildCityModel } = require("../src/model/city");

const savedKey = cfg.llm.key, savedMax = cfg.llm.maxPerHour, savedReserve = cfg.llm.reserveUsd;
const ledger = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cp2-llm-")), "usage.json");

// replies are consumed in order; every chat body is kept so the tests can look at what was sent
function stub(replies, { remaining = 0.9 } = {}) {
  const sent = [];
  llm._reset(); llm._setLedger(ledger); cfg.llm.key = "test-key"; cfg.llm.maxPerHour = 40; cfg.llm.reserveUsd = 0.3;
  llm._setRequest(async (url, opts) => {
    if (url.endsWith("/key")) return { status: 200, body: Buffer.from(JSON.stringify({ data: { limit: 1, usage: 1 - remaining, limit_remaining: remaining } })) };
    const body = JSON.parse(opts.body); sent.push(body);
    const content = replies.length ? replies.shift() : "{}";
    return { status: 200, body: Buffer.from(JSON.stringify({ model: body.model, choices: [{ message: { content } }], usage: { prompt_tokens: 1000, completion_tokens: 200, cost: body.model.includes("haiku") ? 0.0002 : 0.004 } })) };
  });
  return sent;
}
test.after(() => { cfg.llm.key = savedKey; cfg.llm.maxPerHour = savedMax; cfg.llm.reserveUsd = savedReserve; llm._setRequest(null); });

test("roles: search runs the cheap model without reasoning, reason runs the strong model with headroom, and each is billed in its own row", async () => {
  const sent = stub(['{"a":1}', '{"b":2}']);
  await llm.chatJson([{ role: "user", content: "x" }], { role: "search", maxTokens: 100 });
  await llm.chatJson([{ role: "user", content: "y" }], { maxTokens: 100 });
  assert.match(sent[0].model, /haiku/); assert.equal(sent[0].reasoning.effort, "none"); assert.equal(sent[0].max_tokens, 100);
  assert.match(sent[1].model, /sonnet/); assert.equal(sent[1].reasoning.effort, "low"); assert.ok(sent[1].max_tokens > 100, "thinking headroom");
  const l = JSON.parse(fs.readFileSync(ledger, "utf8"));
  assert.equal(l.byRole.search.calls, 1); assert.equal(l.byRole.reason.calls, 1);
  assert.ok(Math.abs(l.byRole.reason.costUsd - 0.004) < 1e-9 && Math.abs(l.byRole.search.costUsd - 0.0002) < 1e-9, "the cost reported by the API is what the ledger adds up");
  await assert.rejects(llm.chat([{ role: "user", content: "z" }], { role: "nonsense" }), /unknown LLM role/);
});

test("guards: a call is refused when the key is nearly empty or the hourly limit is reached, and available() says so", async () => {
  const sent = stub(["{}"], { remaining: 0.1 });
  await assert.rejects(llm.chat([{ role: "user", content: "x" }]), /under the reserve/);
  assert.equal(sent.length, 0, "no request was sent");
  assert.equal(llm.available(), false);
  stub(["{}", "{}", "{}"]); cfg.llm.maxPerHour = 2;
  await llm.chat([{ role: "user", content: "1" }]); await llm.chat([{ role: "user", content: "2" }]);
  await assert.rejects(llm.chat([{ role: "user", content: "3" }]), /hourly/);
  cfg.llm.key = "";
  assert.equal(llm.available(), false);
});

const storeFile = path.join(cfg.STORE, "store.json");
const haveStore = fs.existsSync(storeFile);

test("briefing: figures come only from tokens; a typed digit is repaired once, and what cannot be repaired is dropped", { skip: !haveStore }, async () => {
  const { compose, resolve } = require("../src/agent/briefing");
  const st = Store.load(storeFile), model = buildCityModel(st, "9000");
  model.summary = require("../src/model/summary").summarize(model);
  const good = { headline: "ב{{city}} מצב החיסונים מחייב תשומת לב.", points: [
    { title: "חיסונים", text: "החיסון נגד חצבת עומד על {{v:th_mmrv}}, מול {{nat:th_mmrv}} בממוצע הארצי.", ids: ["th_mmrv", "nope"] },
    { title: "נגישות", text: "זמן ההמתנה לרופא מומחה הוא {{v:wait_specialist_days}}.", ids: ["wait_specialist_days"] }], first: "להתחיל בחיסונים.", caution: "הנתונים רשמיים." };
  stub([JSON.stringify(good)]);
  const ok = await compose(model);
  const text = JSON.stringify(ok.briefing);
  assert.ok(!text.includes("{{"), "every token was resolved");
  assert.ok(ok.briefing.points[0].text.includes("66.1%"), "the figure was filled in from the data");
  assert.deepEqual(ok.briefing.points[0].ids, ["th_mmrv"], "unknown parameter ids are removed");

  // a model that types a digit: the first answer fails the guard, the repair call fixes only that piece
  const typed = JSON.parse(JSON.stringify(good)); typed.points[1].text = "זמן ההמתנה הוא 46 ימים.";
  const sent = stub([JSON.stringify(typed), JSON.stringify({ fixed: { p1: "זמן ההמתנה לרופא מומחה הוא {{v:wait_specialist_days}}." } })]);
  const fixed = await compose(model);
  assert.equal(sent.length, 2, "one answer and one repair");
  assert.ok(fixed.briefing.points[1].text.includes("לרופא מומחה"), "the repaired sentence replaced the one with the typed digit");
  assert.equal(fixed.briefing.points.length, 2);

  // unrepairable: the pieces are dropped, and with fewer than two points left there is no briefing at all
  const bad = JSON.parse(JSON.stringify(good)); bad.points[0].text = "זה 12 אחוז"; bad.points[1].text = "this is English only";
  stub([JSON.stringify(bad), JSON.stringify({ fixed: { p0: "עוד 7", p1: "still English words here" } })]);
  await assert.rejects(compose(model), /usable briefing/);

  // the headline falls back to the deterministic one when the model's fails
  const h = JSON.parse(JSON.stringify(good)); h.headline = "יש 5 בעיות";
  stub([JSON.stringify(h), JSON.stringify({ fixed: { headline: "גם 9 כאן" } })]);
  const hb = await compose(model);
  assert.equal(hb.briefing.headline, model.summary.headline);
  assert.ok(resolve({ headline: "{{city}}", points: [] }, model).bad.length === 0);
});

test("dataset finder: the cheap model proposes queries and keeps the relevant datasets; a note with digits is dropped; no key means plain search", async () => {
  tools.searchDatasets = async (q) => [{ title: "בתי מרקחת " + q, org: "משרד הבריאות", url: "https://data.gov.il/dataset/" + encodeURIComponent(q), resources: 2, modified: "2025-01-01" }, { title: "נתוני קורונה", org: "x", url: "https://data.gov.il/dataset/covid", resources: 1, modified: "2021-01-01" }];
  const { discover } = require("../src/agent/discover");
  const sent = stub([JSON.stringify({ queries: ["בתי מרקחת לפי יישוב", "רשימת בתי מרקחת"] }), JSON.stringify({ keep: [{ i: 0, why: "רשימת בתי מרקחת לפי יישוב" }, { i: 1, why: "יש 3 עמודות" }, { i: 99, why: "אין" }] })]);
  const out = await discover("כמה בתי מרקחת יש בעיר?", "בתי מרקחת");
  assert.ok(sent.every((b) => b.model.includes("haiku")), "only the search role was used");
  assert.ok(out.length >= 1 && out[0].why === "רשימת בתי מרקחת לפי יישוב");
  assert.ok(out.every((d) => !d.why || !/[0-9]/.test(d.why)), "a note with digits is not shown");
  cfg.llm.key = "";
  const plain = await discover("כמה בתי מרקחת יש בעיר?", "בתי מרקחת");
  assert.ok(plain.length >= 1 && plain.every((d) => d.why === undefined));
});
