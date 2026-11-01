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

// feature flags: a module that is not built yet is simply probed and skipped (shell.js), these are for choices the owner may flip
export const FEATURES = { brief: true, footerOldLink: true, shortcuts: true };
