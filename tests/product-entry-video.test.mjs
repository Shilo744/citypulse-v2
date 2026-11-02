// The preview video on the entry page (web/js/product/entry/video.js): a poster and a play button, nothing requested for the player until the button is pressed,
// the site's own file with English captions or YouTube's no-cookie player, and an id that is not an id never reaches a frame. Runs against tests/helpers/fake-dom.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installDom, fakeFetch } from "./helpers/fake-dom.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD = path.join(ROOT, "web", "js", "product");
const load = (f) => import(pathToFileURL(path.join(PROD, f)).href);
const { VIDEO } = await load("config.js");
const video = await load("entry/video.js");
const entry = await load("entry/entry.js");
const storage = await load("storage.js");
const { h } = await import(pathToFileURL(path.join(ROOT, "web", "js", "ui.js")).href);

const dom = async (fn) => { const d = installDom(); const saved = { ...VIDEO }; try { await fn(d); } finally { Object.assign(VIDEO, saved); d.restore(); } };
const playerOf = (stage) => stage.find((e) => e.tagName === "VIDEO" || e.tagName === "IFRAME");

test("video: the settings are a file of the site under /media/ with English captions, or a YouTube id, and the length is under the three minutes the competition allows", () => {
  assert.match(VIDEO.file, /^\/media\/[\w.-]+\.mp4$/);
  assert.match(VIDEO.captions, /^\/media\/[\w.-]+\.en\.vtt$/);
  assert.match(VIDEO.poster, /^\/media\/[\w.-]+\.jpg$/);
  assert.ok(VIDEO.seconds >= 60 && VIDEO.seconds <= 180, "the preview is at most three minutes");
  assert.ok(VIDEO.youtube === "" || /^[\w-]{6,20}$/.test(VIDEO.youtube), "the id is empty or an id");
});

test("video: building the section asks for nothing: a poster with a play button, no player, no frame", () => dom((d) => {
  const p = video.preview({});
  d.body.append(p.el);
  assert.equal(playerOf(p.el), null, "no player before the press");
  const poster = p.el.find((e) => e.classes.has("n-entry-vid-poster"));
  assert.equal(poster.tagName, "BUTTON");
  assert.equal(poster.getAttribute("type"), "button");
  assert.match(poster.getAttribute("aria-label"), /הפעלת סרטון התדמית/);
  assert.match(poster.getAttribute("aria-label"), /\d:\d\d/, "the label says how long it is");
  assert.equal(p.el.getAttribute("aria-labelledby"), "n-entry-vid-t");
  assert.equal(p.el.find((e) => e.id === "n-entry-vid-t").tagName, "H2");
  assert.match(p.el.textContent, /CityPulse ב-⁠?3[  ]דקות/, "the heading says the length in whole minutes (the page puts a word joiner after the hyphen and a no-break space before the unit)");
  assert.match(p.el.find((e) => e.getAttribute("lang") === "en").textContent, /3-minute preview/, "the English line says the same length as the heading");
}));

test("video: with no YouTube id the press puts the site's own file in place of the poster, with English captions on by default, moves focus to it and announces it", () => dom(async (d) => {
  VIDEO.youtube = "";
  const said = [];
  const p = video.preview({ announce: (t) => said.push(t) });
  d.body.append(p.el);
  await p.el.find((e) => e.classes.has("n-entry-vid-poster")).click();
  const v = playerOf(p.el);
  assert.equal(v.tagName, "VIDEO");
  assert.equal(v.getAttribute("controls") !== null, true);
  assert.equal(v.getAttribute("playsinline") !== null, true);
  const src = v.find((e) => e.tagName === "SOURCE"), tr = v.find((e) => e.tagName === "TRACK");
  assert.equal(src.getAttribute("src"), VIDEO.file);
  assert.equal(src.getAttribute("type"), "video/mp4");
  assert.equal(tr.getAttribute("kind"), "captions");
  assert.equal(tr.getAttribute("srclang"), "en");
  assert.equal(tr.getAttribute("src"), VIDEO.captions);
  assert.equal(tr.getAttribute("default") !== null, true, "the captions are on at the start");
  assert.equal(p.el.find((e) => e.classes.has("n-entry-vid-poster")), null, "the poster is gone");
  assert.equal(globalThis.document.activeElement, v);
  assert.deepEqual(said, ["הסרטון נטען"]);
  assert.equal(video.watchUrl(VIDEO), VIDEO.file, "without an id the address to share is the file");
}));

test("video: a file that cannot be loaded ends in one line of explanation next to the player", () => dom(async (d) => {
  VIDEO.youtube = "";
  const p = video.preview({});
  d.body.append(p.el);
  await p.el.find((e) => e.classes.has("n-entry-vid-poster")).click();
  const note = p.el.find((e) => e.classes.has("n-entry-vid-note"));
  assert.equal(note.textContent, "");
  await playerOf(p.el).find((e) => e.tagName === "SOURCE").fire("error");
  assert.match(note.textContent, /הסרטון לא נטען כרגע/);
}));

test("video: with a YouTube id the player is YouTube's no-cookie frame with the English captions on, and the address to share is the watch page", () => dom(async (d) => {
  VIDEO.youtube = "abcDEF_1234";
  const p = video.preview({});
  d.body.append(p.el);
  await p.el.find((e) => e.classes.has("n-entry-vid-poster")).click();
  const f = playerOf(p.el);
  assert.equal(f.tagName, "IFRAME");
  const src = f.getAttribute("src");
  assert.ok(src.startsWith("https://www.youtube-nocookie.com/embed/abcDEF_1234?"), src);
  assert.match(src, /cc_load_policy=1/);
  assert.match(src, /hl=en/);
  assert.match(f.getAttribute("title"), /סרטון תדמית/);
  assert.match(f.getAttribute("allow"), /fullscreen/);
  assert.equal(video.watchUrl(VIDEO), "https://www.youtube.com/watch?v=abcDEF_1234");
}));

test("video: a value that is not an id never reaches a frame, the site's own file is used instead", () => dom(() => {
  for (const bad of ['x" onload="alert(1)', "../evil", "https://evil.example/x", "a b", "abc", "a".repeat(40), "<script>"]) {
    const v = { ...VIDEO, youtube: bad };
    assert.equal(video.playerFor(v).tagName, "VIDEO", bad);
    assert.equal(video.watchUrl(v), v.file, bad);
  }
}));

test("video: the entry page shows the preview first, under the band and before the trust numbers, and builds with no answer from the server", () => dom(async () => {
  VIDEO.youtube = "";
  const backend = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })();
  storage.use(backend);
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch({});
  try {
    storage.recents.clear(); storage.fav.clear();
    const view = await entry.entryView({ key: null, model: null, fav: storage.fav, recents: storage.recents, announce() {}, themeBtn: () => h("button.theme-btn", "מצב כהה"), go() {} });
    await view.ready;
    const body = view.node.find((e) => e.classes.has("n-entry-body"));
    const first = body.children[0];
    assert.ok(first.classes.has("n-entry-video"), "the first section of the body is the video");
    assert.ok(body.children.length >= 5, "the other sections follow");
    assert.equal(playerOf(view.node), null, "nothing is loaded until the press");
  } finally { storage.use(undefined); globalThis.fetch = realFetch; }
}));

test("video: the link under the search says how long the video is and a press moves the focus to the play button", () => dom(async (d) => {
  const section = video.preview({});
  d.body.append(section.el);
  const link = video.videoLink();
  d.body.append(link);
  assert.equal(link.tagName, "BUTTON");
  assert.equal(link.getAttribute("type"), "button");
  assert.match(link.textContent, /צפו בסרטון, \d:\d\d/);
  await link.click();
  assert.ok(globalThis.document.activeElement.classes.has("n-entry-vid-poster"), "the play button has the focus");
  assert.equal(playerOf(section.el), null, "pressing the link does not start the player");
}));
