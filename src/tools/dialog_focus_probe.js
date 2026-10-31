"use strict";
// node src/tools/dialog_focus_probe.js [--width=1280]
// The mistake-report dialog (kit/feedback.js) with REAL key events while a POST /api/feedback is held: the focus must stay on the send button
// (aria-disabled, not disabled), a second Enter or Space must send nothing, and the dialog must end in the thank-you line (answer 200) or give the button back (failure).
// Every request to /api/feedback is held by Fetch.enable and then fulfilled or failed here: nothing ever reaches the server.
const { launch } = require("./cdp");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (n, d) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "").slice(n.length + 3) || d;

const STATE = `(() => { const a = document.activeElement, d = document.querySelector('dialog[open]'), b = d && d.querySelector('button[type=submit]');
  return { active: a ? (a.tagName + (a.type ? '[' + a.type + ']' : '') + ' ' + (a.textContent || '').trim().slice(0, 20)) : null, inDialog: !!(d && a && d.contains(a)), onSend: !!(b && a === b),
    ariaDisabled: b ? b.getAttribute('aria-disabled') : null, disabledAttr: b ? b.disabled : null, busy: b ? b.getAttribute('aria-busy') : null, label: b ? b.textContent : null,
    thanks: !!(d && /תודה, הדיווח התקבל/.test(d.textContent)), status: d ? (d.querySelector('#n-kit-fb-status') || {}).textContent : null }; })()`;

(async () => {
  const b = await launch(), out = [];
  const ok = (name, cond, extra) => { out.push({ name, pass: !!cond, extra }); console.log((cond ? "PASS " : "FAIL ") + name + (extra ? "  " + JSON.stringify(extra) : "")); };
  const held = [];
  b.on("Fetch.requestPaused", (p) => { if (/\/api\/feedback/.test(p.request.url) && p.request.method === "POST") held.push(p.requestId); else b.send("Fetch.continueRequest", { requestId: p.requestId }).catch(() => {}); });
  await b.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/feedback*", requestStage: "Request" }] });
  const key = (k, code, text) => b.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, text, windowsVirtualKeyCode: k === "Enter" ? 13 : k === " " ? 32 : 9 }).then(() => b.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: k === "Enter" ? 13 : k === " " ? 32 : 9 }));
  await b.viewport(Number(arg("width", "1280")), false, 900);
  for (const mode of ["answered", "failed"]) {
    held.length = 0;
    await b.open("about:blank"); await b.open("http://localhost:8800/n.html#/c/1031");
    await b.eval(`[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'דווחו על טעות').focus()`);
    await key("Enter", "Enter", "\r"); await sleep(500);
    ok(mode + ": the dialog opened with the focus on the text field", (await b.eval(STATE)).active.startsWith("TEXTAREA"));
    await b.send("Input.insertText", { text: "בדיקת מקלדת, לא נשלח לשרת" });
    await key("Tab", "Tab"); await key("Tab", "Tab"); await sleep(100);                      // mail field, then the send button
    let s = await b.eval(STATE); ok(mode + ": two Tabs reach the send button", s.onSend, s);
    await key("Enter", "Enter", "\r"); await sleep(600);
    s = await b.eval(STATE);
    ok(mode + ": one request is held", held.length === 1, { held: held.length });
    ok(mode + ": the focus stays on the send button while it is held", s.onSend && s.inDialog, s);
    ok(mode + ": aria-disabled=true, no disabled attribute, aria-busy, label שולח", s.ariaDisabled === "true" && s.disabledAttr === false && s.busy === "true" && /^שולח/.test(s.label), s);
    await key("Enter", "Enter", "\r"); await key(" ", "Space", " "); await sleep(500);
    s = await b.eval(STATE);
    ok(mode + ": a second Enter and a Space send nothing", held.length === 1, { held: held.length });
    ok(mode + ": the focus is still on the button", s.onSend, s);
    if (mode === "answered") {
      await b.send("Fetch.fulfillRequest", { requestId: held[0], responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from('{"ok":true}').toString("base64") });
      await sleep(600); s = await b.eval(STATE);
      ok("answered: the thank-you line shows and the focus is inside the dialog", s.thanks && s.inDialog, s);
    } else {
      await b.send("Fetch.failRequest", { requestId: held[0], errorReason: "Failed" });
      await sleep(900); s = await b.eval(STATE);
      ok("failed: the button is back (no aria-disabled), the error is said, the focus is still on the button", !s.ariaDisabled && s.onSend && /השליחה לא הצליחה|אין תשובה/.test(s.status || ""), s);
    }
  }
  b.problems().forEach((p) => console.log("  " + p));
  console.log(out.every((r) => r.pass) ? "ALL PASS" : "SOME FAILED");
  await b.close();
  setTimeout(() => process.exit(out.every((r) => r.pass) ? 0 : 1), 800);
})().catch((e) => { console.error(e.message); process.exit(1); });
