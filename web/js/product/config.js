// Settings of the product in one place. Nothing here reads the page, so tests and the server can import it.

export const SITE = "CityPulse";
export const ENTRY_TITLE = "CityPulse · בריאות הציבור ברמת היישוב";
export const OLD_HOME = "index.html";                       // the footer link "חזרה לעיצוב הקודם" (after the flip: old.html)
export const FEEDBACK_ENDPOINT = "/api/feedback";           // POST, written by the server (P6); the dialog degrades to a copyable report without it
export const ACCESSIBILITY_CONTACT = "";                    // an address for accessibility requests; empty = the feedback dialog

// one try may take 10 s, one retry after 0.8 s (worst case about 21 s); after slowAfterMs on the same skeleton the page says it takes longer than usual
export const NET = { timeoutMs: 10000, retryDelayMs: 800, slowAfterMs: 6000 };
export const STALE_AFTER_MIN = 30;                          // a tab hidden this long checks whether new data arrived
export const MAX_RECENT = 5;
export const MAX_FAV = 12;

// names of everything the product keeps on the device (the privacy page lists exactly these)
export const KEYS = {
  theme: "cp2-theme", recent: "cp2-recent", last: "cp2-last", fav: "cp2-fav",
  welcome: "cp2-welcome-n", shortcuts: "cp2-keys", from: "cp2-from"
};

// the watsonx Orchestrate agent "CityPulse" (the values of IBM's embed snippet: Deploy, Channels, Embedded agent). They name the instance and the agent, they are not secrets;
// IBM's chat is requested only after a visitor presses the button on the ask page (kit/orchestrate.js)
export const ORCHESTRATE = {
  hostURL: "https://eu-west-2.dl.watson-orchestrate.ibm.com",
  orchestrationID: "20261031-2355-3778-30a6-fe3740f64b54_20261101-0004-1839-1005-551cac667896",
  agentId: "b8d2948e-15a6-4783-82de-fb04792ca7cf"
};

// the preview video of the entry page (entry/video.js). The address of the site never changes: to change the video, set the YouTube id here
// (youtube: "abc123XYZ_-") or replace the files under web/media/. With an empty id the player is the site's own file, with English captions.
export const VIDEO = {
  youtube: "",
  file: "/media/citypulse-preview.mp4",
  captions: "/media/citypulse-preview.en.vtt",
  poster: "/media/citypulse-preview.jpg",
  seconds: 173
};

// feature flags: a module that is not built yet is simply probed and skipped (shell.js), these are for choices the owner may flip
// orchestrateChat: the button of the Orchestrate agent's chat on the ask page. Off until IBM's Embed Security is switched off for the instance (see docs/ORCHESTRATE.md, section 4).
export const FEATURES = { brief: true, footerOldLink: true, shortcuts: true, orchestrateChat: false };
