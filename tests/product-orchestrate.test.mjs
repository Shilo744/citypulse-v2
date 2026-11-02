// The chat of the watsonx Orchestrate agent in the ask page (web/js/product/kit/orchestrate.js): IBM's loader is requested only when the button is pressed, once, and a failure
// leaves the page working with one line of explanation. The module runs against tests/helpers/fake-dom.mjs; the loader script is stood in for by firing its load and error events.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installDom } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = path.join(ROOT, "web", "js", "product");
const load = (f) => import(pathToFileURL(path.join(PROD, f)).href);
const { h } = await import(pathToFileURL(path.join(ROOT, "web", "js", "ui.js")).href);
const { ORCHESTRATE, KEYS, FEATURES } = await load("config.js");
const wxo = await load("kit/orchestrate.js");
const ask = await load("pages/ask.js");
const privacy = await load("pages/privacy.js");
const dom = async (fn) => { const d = installDom(); wxo._reset(); FEATURES.orchestrateChat = true; try { await fn(d); } finally { FEATURES.orchestrateChat = false; wxo._reset(); d.restore(); } };
const scripts = (d) => d.body.findAll((e) => e.tagName === "SCRIPT");
const tick = () => new Promise((r) => setTimeout(r, 0));

test("orchestrate: the values are IBM's own for the CityPulse agent and the loader comes from the instance", async () => dom(async () => {
  assert.match(ORCHESTRATE.hostURL, /^https:\/\/[a-z0-9.-]+\.watson-orchestrate\.ibm\.com$/);
  assert.match(ORCHESTRATE.agentId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.ok(ORCHESTRATE.orchestrationID.length > 20);
  assert.equal(wxo.LOADER_URL, ORCHESTRATE.hostURL + "/wxochat/wxoLoader.js?embed=true");
  const panel = h("div", { id: "p1" });
  const c = wxo.configFor(panel);
  assert.equal(c.chatOptions.agentId, ORCHESTRATE.agentId);
  assert.equal(c.hostURL, ORCHESTRATE.hostURL);
  assert.equal(c.rootElementID, "p1");
  assert.equal(c.layout.form, "custom");
  assert.equal(c.layout.customElement, panel);
  assert.equal(c.showLauncher, false, "no floating launcher on a page of this product");
  assert.equal(c.openChatByDefault, true);
}));

test("orchestrate: building the section asks nothing from IBM (no script, no configuration) until the button is pressed", async () => dom(async (d) => {
  const s = wxo.agentSection();
  d.body.append(s.node);
  assert.equal(scripts(d).length, 0);
  assert.equal(globalThis.window.wxOConfiguration, undefined);
  assert.ok(s.panel.hidden, "the panel is closed");
  assert.equal(s.go.getAttribute("aria-expanded"), "false");
  assert.equal(s.go.getAttribute("aria-controls"), wxo.PANEL_ID);
  assert.equal(s.panel.getAttribute("role"), "region");
  assert.ok(s.panel.getAttribute("aria-label"));
  assert.match(s.node.textContent, /IBM/);
  assert.match(s.node.textContent, /רק אחרי הלחיצה/, "the section says when IBM is contacted");
}));

test("orchestrate: pressing the button loads IBM's script with the configuration of the panel, then opens it", async () => dom(async (d) => {
  const s = wxo.agentSection();
  d.body.append(s.node);
  let inits = 0, seen = null;
  globalThis.window.wxoLoader = { init: async () => { inits++; seen = globalThis.window.wxOConfiguration; } };
  const pressed = s.go.click();
  await tick();
  const list = scripts(d);
  assert.equal(list.length, 1);
  assert.equal(list[0].src || list[0].getAttribute("src"), wxo.LOADER_URL);
  assert.ok(s.go.disabled, "the button waits while the chat loads");
  assert.equal(s.msg.textContent, wxo.WORDS.loading);
  await list[0].fire("load");
  await pressed;
  assert.equal(inits, 1);
  assert.equal(seen.layout.customElement, s.panel, "IBM's loader finds the panel in the configuration when it starts");
  assert.equal(seen.rootElementID, wxo.PANEL_ID);
  assert.ok(!s.panel.hidden);
  assert.equal(s.go.getAttribute("aria-expanded"), "true");
  assert.equal(s.go.textContent, wxo.WORDS.close);
  assert.equal(s.msg.textContent, "");
  assert.ok(!s.go.disabled);
  await s.go.click();                                          // closes: no second script, no second init
  assert.ok(s.panel.hidden);
  assert.equal(s.go.textContent, wxo.WORDS.open);
  await s.go.click();
  assert.ok(!s.panel.hidden);
  assert.equal(scripts(d).length, 1);
  assert.equal(inits, 1);
}));

test("orchestrate: when IBM's script cannot be fetched the page says so in one line and the next press tries again", async () => dom(async (d) => {
  const s = wxo.agentSection();
  d.body.append(s.node);
  globalThis.window.wxoLoader = { init: async () => {} };
  const first = s.go.click();
  await tick();
  await scripts(d)[0].fire("error");
  await first;
  assert.equal(s.msg.textContent, wxo.WORDS.down);
  assert.ok(s.panel.hidden);
  assert.equal(s.go.textContent, wxo.WORDS.retry);
  assert.ok(!s.go.disabled);
  assert.equal(scripts(d).length, 0, "the failed script is taken out of the page");
  const second = s.go.click();
  await tick();
  assert.equal(scripts(d).length, 1, "a new try adds a new script");
  await scripts(d)[0].fire("load");
  await second;
  assert.equal(s.msg.textContent, "");
  assert.ok(!s.panel.hidden);
}));

test("orchestrate: a loader that never answers ends in the same line after the time allowed", async () => dom(async (d) => {
  const panel = h("div", { id: wxo.PANEL_ID });
  await assert.rejects(wxo.loadChat(panel, { timeoutMs: 20 }), /timeout/);
  assert.equal(scripts(d).length, 0);
  await assert.rejects(wxo.loadChat(panel, { timeoutMs: 20 }), /timeout/, "after a failure the next call tries again");
}));

test("orchestrate: a loader that starts but throws is reported as a failure, not as an open chat", async () => dom(async (d) => {
  const panel = h("div", { id: wxo.PANEL_ID });
  globalThis.window.wxoLoader = { init: async () => { throw new Error("boom"); } };
  const p = wxo.loadChat(panel, { timeoutMs: 1000 });
  await tick();
  await scripts(d)[0].fire("load");
  await assert.rejects(p, /boom/);
  assert.equal(scripts(d).length, 1, "the script stays: only the start is tried again");
}));

test("orchestrate: a later visit to the ask page has a new panel: IBM's chat is taken down and started again in it, the script is not added twice", async () => dom(async (d) => {
  const a = h("div", { id: "pa" }), b = h("div", { id: "pb" }), calls = [];
  globalThis.window.wxoLoader = { init: async () => calls.push("init:" + globalThis.window.wxOConfiguration.rootElementID), destroy: async () => calls.push("destroy") };
  const first = wxo.loadChat(a);
  await tick(); await scripts(d)[0].fire("load"); await first;
  await wxo.loadChat(a);                                       // the same panel again: nothing to do
  await wxo.loadChat(b);
  assert.deepEqual(calls, ["init:pa", "destroy", "init:pb"]);
  assert.equal(scripts(d).length, 1);
  assert.equal(globalThis.window.wxOConfiguration.layout.customElement, b);
}));

test("orchestrate: a chat that does not start within the time allowed is a failure too", async () => dom(async (d) => {
  const panel = h("div", { id: wxo.PANEL_ID });
  globalThis.window.wxoLoader = { init: () => new Promise(() => {}) };
  const p = wxo.loadChat(panel, { timeoutMs: 30 });
  await tick(); await scripts(d)[0].fire("load");
  await assert.rejects(p, /timeout/);
}));

test("orchestrate: the ask page ends with the section, closed, and the question field still sends through the old form", async () => dom(async () => {
  const input = h("input#as-q", { type: "text" }), form = h("form.as-field", { role: "search" }, input, h("button.as-send", { type: "submit" }, "שאלו"));
  const sent = []; form.requestSubmit = () => sent.push(input.value);
  const root = h("div.as", h("section.hero.as-hero", h("h1", "מה תרצו"), form), h("div.as-thread"));
  ask.adapt(root, { key: "1031", model: { city: { key: "1031", name: "שדרות" } } });
  const kids = root.children, last = kids[kids.length - 1];
  assert.ok(last.classes.has("n-pg-ask-agent"), "the section is the last one of the page");
  assert.ok(last.find((e) => e.classes.has("n-pg-ask-agent-panel")).hidden);
  assert.equal(globalThis.document.body.findAll((e) => e.tagName === "SCRIPT").length, 0);
  const row = root.findAll((e) => e.tagName === "BUTTON" && e.parentNode && e.parentNode.tagName === "LI")[0];
  await row.click();
  assert.equal(sent.length, 1);
}));

test("orchestrate: the privacy page tells that IBM is contacted only when the chat is opened, and no new key is kept on the device", async () => dom(async () => {
  const text = privacy.view({ key: "1031" }).node.textContent;
  assert.match(text, /IBM/);
  assert.match(text, /עד הלחיצה הדף לא פונה ל-IBM/);
  assert.equal(Object.keys(KEYS).length, 7, "the chat keeps nothing on the device");
}));

test("orchestrate: while the switch is off (the default) the ask page has no chat section and the privacy page does not mention IBM's chat", async () => dom(async () => {
  FEATURES.orchestrateChat = false;
  const input = h("input#as-q", { type: "text" }), form = h("form.as-field", { role: "search" }, input, h("button.as-send", { type: "submit" }, "שאלו"));
  const root = h("div.as", h("section.hero.as-hero", h("h1", "מה תרצו"), form), h("div.as-thread"));
  ask.adapt(root, { key: "1031", model: { city: { key: "1031", name: "שדרות" } } });
  assert.equal(root.find((e) => e.classes.has("n-pg-ask-agent")), null);
  assert.ok(!/watsonx/.test(privacy.view({ key: "1031" }).node.textContent));
  assert.equal(FEATURES.orchestrateChat, false, "the committed default is off");
}));
