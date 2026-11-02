// The chat of the watsonx Orchestrate agent "CityPulse" inside the ask page: IBM's own embed (Deploy, Channels, Embedded agent), opened as a panel in the page instead of a floating launcher.
// IBM's loader is not part of the page: nothing is requested from IBM until the visitor presses the button (the privacy page says so). Without the loader, or after IBM stops serving it
// (the trial of the instance ends), the page says so in one line and the question field above keeps working; the chat is another way in, not the only one.
import { h } from "../../ui.js";
import { ORCHESTRATE } from "../config.js";

export const PANEL_ID = "n-wxo-panel";
export const LOADER_URL = `${ORCHESTRATE.hostURL}/wxochat/wxoLoader.js?embed=true`;
export const WORDS = {
  title: "אפשר גם לשוחח עם הסוכן של IBM",
  about: "סוכן שנבנה ב-watsonx Orchestrate של IBM. הוא קורא לאותו API של המערכת ועונה לפי אותם נתונים רשמיים.",
  privacy: "הצ'אט נטען משירותי IBM רק אחרי הלחיצה, והשאלות שנכתבות בו נשלחות אליהם.",
  open: "פתיחת השיחה עם הסוכן", close: "סגירת השיחה", loading: "טוענים את הצ'אט של IBM…", retry: "ניסיון נוסף",
  down: "הצ'אט של IBM אינו זמין כרגע. אפשר לשאול כאן, בשדה השאלה.",
  region: "שיחה עם הסוכן של IBM"
};

// what IBM's loader reads from window.wxOConfiguration: the instance, the agent, and the panel it fills (no floating launcher, open at once)
export const configFor = (panel) => ({
  orchestrationID: ORCHESTRATE.orchestrationID, hostURL: ORCHESTRATE.hostURL, rootElementID: panel.id,
  chatOptions: { agentId: ORCHESTRATE.agentId },
  layout: { form: "custom", customElement: panel, showOrchestrateHeader: false },
  showLauncher: false, openChatByDefault: true, defaultLocale: "he"
});

let script = null;                                                 // the promise of IBM's script: one per page view, forgotten when it fails so the next press tries again
let started = null, running = null;                                // the panel IBM's chat was started in, and the one it is running in (a later visit to the ask page builds a new panel)
export const _reset = () => { script = null; started = null; running = null; };

const within = (p, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("timeout")), ms);
  p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

// puts IBM's loader script in the page; rejects when it cannot be fetched or does not arrive within timeoutMs
function addScript(timeoutMs) {
  if (script) return script;
  script = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = LOADER_URL; s.async = true;
    const timer = setTimeout(() => fail(new Error("timeout")), timeoutMs);
    const fail = (err) => { clearTimeout(timer); script = null; s.remove(); reject(err); };
    s.addEventListener("load", () => { clearTimeout(timer); resolve(); });
    s.addEventListener("error", () => fail(new Error("load")));
    (document.head || document.body).append(s);
  });
  return script;
}

// runs IBM's chat in the panel; resolves when it has started, rejects when the script or the start fails
export async function loadChat(panel, { timeoutMs = 15000 } = {}) {
  if (running === panel) return;
  await addScript(timeoutMs);
  await within((async () => {
    const loader = window.wxoLoader;
    if (started) { try { await loader.destroy(); } catch (e) { /* a chat that cannot be taken down is replaced anyway */ } }
    running = null; started = panel;
    window.wxOConfiguration = configFor(panel);
    await loader.init();
    running = panel;
  })(), timeoutMs);
}

// the section of the ask page: a heading, two plain lines, one button; the panel opens under them
export function agentSection() {
  const msg = h("p.n-pg-ask-agent-msg", { role: "status", "aria-live": "polite" });
  const panel = h("div.n-pg-ask-agent-panel", { id: PANEL_ID, role: "region", "aria-label": WORDS.region, hidden: true });
  const go = h("button.n-pg-ask-agent-go", { type: "button", "aria-expanded": "false", "aria-controls": PANEL_ID }, WORDS.open);
  let ready = false, busy = false;
  const show = (on) => { panel.hidden = !on; go.setAttribute("aria-expanded", on ? "true" : "false"); go.textContent = on ? WORDS.close : WORDS.open; };
  go.addEventListener("click", async () => {
    if (busy) return;
    if (ready) { show(panel.hidden); return; }
    busy = true; go.disabled = true; msg.textContent = WORDS.loading; panel.hidden = false;
    try { await loadChat(panel); ready = true; msg.textContent = ""; show(true); }
    catch (e) { panel.hidden = true; msg.textContent = WORDS.down; go.textContent = WORDS.retry; go.setAttribute("aria-expanded", "false"); }
    busy = false; go.disabled = false;
  });
  const node = h("section.n-pg-ask-agent.no-print", { "aria-labelledby": "n-pg-ask-agent-t" },
    h("h2.n-pg-ask-agent-t", { id: "n-pg-ask-agent-t" }, WORDS.title),
    h("p.n-pg-ask-agent-p", WORDS.about, " ", WORDS.privacy),
    go, msg, panel);
  return { node, panel, go, msg };
}
