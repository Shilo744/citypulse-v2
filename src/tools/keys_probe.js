"use strict";
// node src/tools/keys_probe.js [--towns=1031,16] [--tabs=60] [--widths=1280,390]   (CDP_SLOT=<n> to run beside other tools)   (g1)
// The keyboard walk of the town page, with real key events (Input.dispatchKeyEvent): Tab is pressed N times from the top of the page and each stop is recorded (what is focused, whether a ring of at least
// 2 px shows: its own outline, the outline of its ::after, or a ring on a parent that holds the focus). Checked: the skip link is first, no stop is off the screen, no stop is a repeat (a trap), the level switch is
// reachable, and the dialog of the background line opens with Enter, keeps the focus inside, closes with Escape and gives the focus back to its button. It only reads; exit code 1 when a check fails.
const { launch } = require("./cdp");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith("--" + n + "=")); return a ? a.slice(n.length + 3) : d; };
const towns = arg("towns", "1031,16").split(","), tabs = Number(arg("tabs", "60")), widths = arg("widths", "1280,390").split(",").map(Number);
const base = process.env.BASE || "http://localhost:8800/n.html";          // BASE=http://host/n.html runs it against another server (the live site, another port)

const key = (b, k, code, vk) => b.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, ...(k === "Enter" ? { text: "\r" } : {}) })
  .then(() => b.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }));

const WHO = `(() => { const e = document.activeElement; if (!e || e === document.body) return { tag: "body", ring: false };
  const px = (v) => parseFloat(v) || 0, ring = (s) => ({ ow: px(s.outlineWidth), os: s.outlineStyle, sh: s.boxShadow === "none" ? "" : s.boxShadow });
  const has = (x) => (x.os !== "none" && x.ow >= 2) || (x.sh && /\\s([2-9]|\\d{2,})px/.test(x.sh));
  const own = ring(getComputedStyle(e)), af = ring(getComputedStyle(e, "::after")), bf = ring(getComputedStyle(e, "::before"));
  let parent = false; for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (p.matches(":focus-within") && has(ring(getComputedStyle(p)))) { parent = true; break; }
  const again = e.hasAttribute("data-kp-seen"); e.setAttribute("data-kp-seen", "1");
  const r = e.getBoundingClientRect(), label = (e.getAttribute("aria-label") || e.textContent || e.value || e.title || "").replace(/\\s+/g, " ").trim().slice(0, 40);
  return { tag: e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/ +/)[0] : ""), href: (e.getAttribute("href") || "").slice(0, 30), label, again,
    ring: has(own) || has(af) || has(bf) || parent, focusVisible: e.matches(":focus-visible"), inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth };
})()`;
const DLG = `(() => { const a = document.activeElement, d = document.querySelector("dialog[open]"); return { inDialog: !!(d && a && d.contains(a)), open: !!d, onBg: !!(a && a.matches(".n-home-bg .n-kit-term")) }; })()`;

let failed = 0;
const say = (ok, text, detail = "") => { console.log((ok ? "ok   " : "FAIL ") + text + (detail ? "  " + detail : "")); if (!ok) failed++; };

(async () => {
  const b = await launch();
  await b.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
  for (const t of towns) for (const w of widths) {
    const label = `${t} ${w}`;
    const fresh = async () => { await b.send("Page.navigate", { url: "about:blank" }); await sleep(300); await b.viewport(w, w < 600, 900); await b.open(`${base}#/c/${t}?v=full`); await sleep(900); };          // a new page for each walk: the focus of the last one would carry over
    await fresh();
    await b.eval(`document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo(0, 0)`);
    const rows = []; let ended = 0;
    for (let i = 1; i <= tabs; i++) {
      await key(b, "Tab", "Tab", 9); await sleep(50);
      const s = await b.eval(WHO);
      if (s.tag === "body") { ended = i - 1; break; }          // the focus left the page: the page has fewer stops than asked for, which is the end and not a failure
      s.repeat = !!s.again; rows.push({ i, ...s });
    }
    say(/דלגו/.test(rows[0].label), label + ": the skip link is the first stop", rows[0].label);
    const noRing = rows.filter((r) => !r.ring), off = rows.filter((r) => !r.inView), rep = rows.filter((r) => r.repeat);
    say(!noRing.length, label + ": every one of " + rows.length + " stops" + (ended ? " (the whole page)" : "") + " shows a ring of 2 px or more", noRing.slice(0, 3).map((r) => r.i + " " + r.tag + " " + r.label).join(" | "));
    say(!off.length, label + ": no stop is off the screen (a closed menu is not a place for the keyboard)", off.slice(0, 3).map((r) => r.i + " " + r.tag + " " + r.label).join(" | "));
    say(!rep.length, label + ": no stop comes twice (no trap)", rep.slice(0, 3).map((r) => r.i + " " + r.label).join(" | "));
    say(!rows.some((r) => /הפרטים המלאים|במבט אחד/.test(r.label)), label + ": there is no level switch among the stops (retired on 2026-11-01)");
    // the dialog of the background line (full level): Enter opens it, the focus goes inside and stays, Escape closes it and gives the focus back to the figure
    await fresh();
    await b.eval(`document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo(0, 0)`);
    let found = false;
    for (let i = 1; i <= 40 && !found; i++) { await key(b, "Tab", "Tab", 9); await sleep(40); found = (await b.eval(DLG)).onBg; }
    if (!found) { say(false, label + ": the figure of the background line is reachable"); continue; }
    await key(b, "Enter", "Enter", 13); await sleep(450);
    const opened = await b.eval(DLG); say(opened.open && opened.inDialog, label + ": Enter opens the dialog and the focus is inside it");
    for (let i = 0; i < 6; i++) { await key(b, "Tab", "Tab", 9); await sleep(40); }
    say((await b.eval(DLG)).inDialog, label + ": Tab stays inside the dialog");
    await key(b, "Escape", "Escape", 27); await sleep(400);
    const closed = await b.eval(DLG); say(!closed.open && closed.onBg, label + ": Escape closes it and gives the focus back to the figure");
  }
  b.problems().forEach((p) => console.log("  " + p));
  console.log(failed ? failed + " check(s) failed" : "all keyboard checks passed");
  await b.close();
  setTimeout(() => process.exit(failed ? 1 : 0), 600);
})().catch((e) => { console.error(e.message); process.exit(1); });
