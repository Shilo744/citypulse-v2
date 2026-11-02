# Release: deploying the product, making it the default, and going back

Today `http://localhost:8800/` is the old app (`web/index.html`) and `http://localhost:8800/n.html` is the product. Making the product the default is not done and needs the owner's word (section 8). The build never changes the default and deletes nothing.

All commands run in Git Bash from the project folder. The three `sed` lines of the flip (with their check lines), the three of the rollback and the re-baseline command were re-run on copies of the files in the documentation pass of 2026-10-30 (`d1`): after the rollback the copies were byte-identical to the live files, and the re-baseline command reproduces `OLD-HASHES.json` byte for byte on the current tree. The renames, the stub page and the restart need the live tree and server and were not run.

## 1. Server settings

Read once at start by `src/lib/config.js`. The environment comes first, then `.dev.vars` (project root, git-ignored, one `KEY=value` per line), unless the table says otherwise. A changed value needs a restart. The same table is in `README.md`; this one adds what matters for a real host.

| Name | Source | Default | What it does |
|---|---|---|---|
| `PORT` | env, `.dev.vars` | `8800` | The port. The server listens on `127.0.0.1` only, so a real host needs a reverse proxy or CDN in front. |
| `PUBLIC_BASE_URL` | env, `.dev.vars` | empty | The public address, for example `https://citypulse.example.com` (a trailing slash is removed). Used for the absolute addresses in `/robots.txt`, `/sitemap.xml` and the share pages `/s/<key>`, including the preview picture. |
| `SHARE_TARGET` | env, `.dev.vars` | `/n.html` | Where `/s/<key>` sends a person after the preview, and where an unknown key is redirected. |
| `FEEDBACK_FILE` | env only | `data/feedback.jsonl` | Where the feedback endpoint appends. At most 5 reports per client address per hour; refuses at 5 MB. This file is the only place reports go: back it up and read it. |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL_SEARCH`, `LLM_MODEL_REASON`, `LLM_RESERVE_USD`, `LLM_MAX_PER_HOUR` | `.dev.vars` only | no key; OpenRouter; Haiku 5.5 for both roles; 0.3; 40 | The question agent and the manager briefing. Without a key the product works and the ask page answers by keywords. |

`.dev.vars.example` is stale: it lists an `LLM_MODEL` line that nothing reads. The names above are the real ones.

**Why `PUBLIC_BASE_URL` matters.** The server accepts a `Host` header only if it looks like a plain host name, and uses it for nothing except the absolute addresses of `robots.txt`, `sitemap.xml` and share pages. Behind a proxy that rewrites `Host`, or on a host with several names, those addresses would be wrong, and a crawler or a chat preview would receive the wrong one. The Host-derived address also starts with `http://`, which is wrong for an HTTPS site. Setting `PUBLIC_BASE_URL` fixes both. It has not been tested on a real host.

## 2. The stylesheet bundle

`n.html` links one stylesheet, `css/n.bundle.css`. The route is served by `server.js` (`serveCssBundle`). `src/lib/css-bundle.js` concatenates the six top-level sheets listed in `CSS_BUNDLE_FILES` in `src/lib/config.js` (`css/app.css`, `css/motion.css`, `css/layout.css`, `css/viz.css`, `css/pages-n.css`, `css/product.css`, in that order), inlines every `@import` recursively and rewrites relative `url()`s to absolute paths. The result is cached in memory and rebuilt when the modification time of any source changes. It has an ETag and `Cache-Control: no-cache`, so a warm reload answers 304. This replaced 41 stylesheet requests with one.

If the route is missing (static hosting without the Node server), the `onerror` handler of the `<link>` in `n.html` loads the same six sheets one by one and removes itself. The order of that fallback must equal `CSS_BUNDLE_FILES`; `tests/product-shell.test.mjs` fails when they differ. When you add a top-level sheet, add it in both places and run `npm test`. `tests/server-css-bundle.test.mjs` checks the route (200, content type, ETag, 304, gzip), that no `@import` is left, that every `url()` resolves, and that `tokens.css` comes before `shell.css`.

## 3. Deploy order

The server first, then the pages.

1. Copy the server files (`server.js`, `src/**`, and `data/store/store.json` and `src/catalog/evidence.json` if they changed) and restart the server (`start.cmd`, or stop and start `node server.js`). Open tabs lose nothing: the data is on the server and the preferences are on the device. Files under `src/` are read at start: a change to the catalogue, the model or the evidence needs the restart.
2. Check the new server before the pages arrive:

   ```
   curl -s http://localhost:8800/api/health      # ok:true, features.share and features.feedback true
   curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8800/css/n.bundle.css      # 200 text/css
   curl -s "http://localhost:8800/s/1031?q=simple" | grep -o 'og:title" content="[^"]*"'                  # שדרות במבט אחד
   ```

3. Copy `web/`. Static files need no restart.

The order matters because the share button copies `/s/<key>?q=simple` on the short level as soon as the page sees `features.share`. A server that does not know the id `simple` (`VALID_QIDS` in `server.js`) answers with the first answer's preview and sends the visitor to the town page at its default level. A page that arrives before the bundle route still works through the `onerror` fallback, only more slowly.

## 4. Before the flip

1. `npm test` is green and `npm run smoke:n`, `npm run a11y:n`, `npm run motion:n` report 0 problems. Numbers and dates: `docs/QA.md`. The performance budgets of `docs/QA.md` section 2 were measured before the merge of the town page: run `node src/tools/perf_probe.js` and compare.
2. The lab list of the old app (`web/js/lab/index.js`) carries one link card for the product (`id: "product"`, `href: "n.html"`, `href2: "n.html#/c/1031/simple"`), with thumbnails `web/assets/lab/thumbs/product.png` and `web/assets/lab/thumbs/product-simple.png`. These small edits of one old file are the only deliberate change to the old app, and `OLD-HASHES.json` was re-baselined once for it. The text of that card still describes the earlier product (five questions per town); it is an old file, so correcting it means a re-baseline. The command, for the next time an old file is changed on purpose (it rewrites the hash of every file already listed and keeps the key list; on an untouched tree it produces a byte-identical file):

   ```
   node -e 'const fs=require("fs"),c=require("crypto"),p="design-ideas/product/baseline/OLD-HASHES.json",h=JSON.parse(fs.readFileSync(p,"utf8"));for(const f in h)h[f]=c.createHash("sha256").update(fs.readFileSync(f)).digest("hex");fs.writeFileSync(p,JSON.stringify(h,null,2)+"\n")'
   ```

   Look at the diff of the old files first and re-baseline only if the change is the one you meant. The copy of `web/` from before the product, for comparison and for the rollback of single files, is `design-ideas/product/baseline/web-before/`; the product before the merge of the town page is `design-ideas/product/baseline/product-before-merge/`.
3. Tell the owner that the server will be restarted once.
4. Before the server is reachable from the internet: `GET /api/llm` (`usageSummary`) is public and shows the spend and the balance of the AI key (never the key itself). Put it behind the same protection as the other admin reads, or remove it from the public routes. The ask page spends the owner's money (OpenRouter key capped at $1; the server stops the AI under the $0.30 reserve and allows 40 calls an hour): decide the limits again for a real host. Dark mode was removed on 2026-10-31 (`web/n.html` forces light), so the dark pictures need no check.

## 5. The flip

Everything that names the entry file (found with `grep -rln "n\.html" tests server.js src web/js web/manifest.webmanifest`):

| Place | What it does with `n.html` or `index.html` | Change at the flip |
|---|---|---|
| `web/index.html`, `web/n.html` | the two entry files | renamed (step 1) |
| `web/js/product/config.js` `OLD_HOME` | target of the footer link "חזרה לעיצוב הקודם" | `"old.html"` (step 2) |
| `web/manifest.webmanifest` `start_url` | where an installed app opens | `"/"` (step 2) |
| `src/lib/config.js` `SHARE_TARGET` | default target of `/s/<key>` | `"/"` (step 2), or set the environment variable and keep the file |
| `server.js` (the styled 404 page) | the button "חזרה לדף הבית" links to `/n.html` | works through the stub of step 3; change to `/` when convenient |
| `web/js/lab/index.js` | the lab card links to `n.html` | works through the stub; change to `index.html` at the next re-baseline |
| `PAGE` in `src/tools/ui_smoke.js`, `a11y_check.js`, `motion_check.js` | base of the `--n` runs | `"/"` |
| `src/tools/product_matrix.js`, `perf_probe.js`, `consistency_probe.js`, `small_town_probe.js`, `chrome_probe.js`, `tips_probe.js`, `first_screen_probe.js`, `dialog_focus_probe.js` | open `/n.html` | `/` (`chrome_probe.js` and `tips_probe.js` also take `--base=`) |
| `tests/product-shell.test.mjs`, `tests/product-perf.test.mjs`, `tests/product-catart.test.mjs` | read `web/n.html` | read `web/index.html` |
| `tests/design.test.mjs` (the test that reads the old page's head) | checks the OLD page's logo and motion links in `web/index.html` | read `web/old.html`; the product page has other icons, so the test fails otherwise |
| `tests/server-share.test.mjs` | expects an unknown key to redirect to `/n.html` | expect the new `SHARE_TARGET` |
| `tests/product-old-untouched.test.mjs` | lists `web/index.html` among the keys | `web/old.html` |

Steps, in one commit:

1. Rename the two entry files:

   ```
   mv web/index.html web/old.html
   mv web/n.html web/index.html
   ```

2. Point the three places that name the entry:

   ```
   sed -i 's|export const OLD_HOME = "index.html";|export const OLD_HOME = "old.html";|' web/js/product/config.js
   sed -i 's|"start_url": "/n.html"|"start_url": "/"|' web/manifest.webmanifest
   sed -i '/SHARE_TARGET:/s|"/n.html"|"/"|' src/lib/config.js
   ```

   Check: `grep -n "OLD_HOME =" web/js/product/config.js`, `grep -n start_url web/manifest.webmanifest` and `grep -n "SHARE_TARGET:" src/lib/config.js` show `old.html`, `"/"` and `"/"`.
3. Leave a small `web/n.html` behind so that links shared during the trial keep working (the hash survives):

   ```
   printf '<!doctype html>\n<meta charset="utf-8"><title>CityPulse</title>\n<script>location.replace("index.html" + location.hash);</script>\n<meta http-equiv="refresh" content="0; url=index.html">\n' > web/n.html
   ```

4. Restart the server once (only `src/lib/config.js` is read at start).
5. Update the tools and tests of the table above (`/` for `/n.html`, `web/index.html` for `web/n.html` in the tests that read the product page, `web/old.html` in `design.test.mjs` and in the key list of `product-old-untouched`). In `OLD-HASHES.json` the old app moved with its file, so only the key changes and no hash does:

   ```
   node -e 'const fs=require("fs"),p="design-ideas/product/baseline/OLD-HASHES.json",h=JSON.parse(fs.readFileSync(p,"utf8"));h["web/old.html"]=h["web/index.html"];delete h["web/index.html"];fs.writeFileSync(p,JSON.stringify(h,null,2)+"\n")'
   ```

   Then run `npm test`, `npm run smoke:n`, `npm run a11y:n` and `npm run motion:n`.
6. Look at `http://localhost:8800/`, `/#/c/1031` (both levels), `/#/c/1031/simple`, `/old.html#/c/1031` (the old app, for one release), `/n.html#/c/1031` (must land on the product through the stub), `/s/1031` and `/s/1031?q=simple` (preview and redirect), and `/manifest.webmanifest`.

## 6. Rollback

Reversible in one minute. Only the `SHARE_TARGET` change needs a restart:

```
mv web/index.html web/n.html          # (overwrites the small redirect page)
mv web/old.html web/index.html
sed -i 's|export const OLD_HOME = "old.html";|export const OLD_HOME = "index.html";|' web/js/product/config.js
sed -i 's|"start_url": "/"|"start_url": "/n.html"|' web/manifest.webmanifest
sed -i '/SHARE_TARGET:/s#"/",#"/n.html",#' src/lib/config.js
```

If a `sed` does not match, edit the line by hand (the three lines are listed in step 2 of the flip). Rename the key in `OLD-HASHES.json` back, or restore it from the copy you made before the flip, and put back the tools and tests. If a single old file was damaged, copy it from `design-ideas/product/baseline/web-before/`.

## 7. After the release (not done by the build)

- Keep `old.html` for one release so that a person can go back. Then delete it, the footer link (`FEATURES.footerOldLink` in `web/js/product/config.js`, set to `false`) and `OLD_HOME`.
- The lab (`web/js/lab/**`, `web/css/lab/**`, `web/assets/lab/**`) was a design workshop. Once the owner is satisfied, move it out of `web/` (for example to `design-ideas/archive/lab/`) together with `web/assets/lab/raw` (raw pictures that the site never serves). Do this only after the old app no longer needs it (`web/js/main.js` registers the lab routes), and re-baseline `OLD-HASHES.json` with the lab entries removed.
- The old-mode files (`web/js/pages`, `web/js/viz`, `web/js/ui.js`, `api.js`, `components.js`, `css/app.css`, `layout.css`, `viz.css`, `motion.css`) stay: the product imports them.

## 8. The owner's decisions

These are the only place the open decisions are written; every other document points here.

**Open (nothing is decided without the owner):**

| # | Decision | What the build does now | What to say to change it |
|---|---|---|---|
| 1 | The levels of the town page | Retired on 2026-11-01 at the owner's request: one level, the full details, no switch, nothing stored for it; `?v=`, `/simple` and `?q=simple` still open the page | Nothing to flip: a short level would have to be built again (the code of its rows is still in `city/sections.js`) |
| 2 | Making `n.html` the only site, and the way back | not done; the product sits next to the old app and the footer links back to it | "flip": sections 4 to 6 are the procedure and the way back |
| 3 | The wording of the accessibility statement and the privacy page, and who receives feedback | the texts are drafts: `pages/accessibility.js` carries `OWNER-APPROVAL` comments (the statement says conformity was not verified by an external check, and one line uses an English word); feedback goes to a file on the server, `data/feedback.jsonl`; `ACCESSIBILITY_CONTACT` in `config.js` is empty, so the contact is the feedback dialog | give the texts; name an address and who reads the file |
| 4 | A figure that meets its official target and does not deteriorate is lifted to at least "תקין", even in the bottom quarter of towns | on: one condition in `src/model/analyze.js` (`(lowRank && !held)`). Counted over 494 towns with 4 or more figures (b1): of 5,965 target-judged figures 121 change, 107 from "למעקב" and 14 from "דורש טיפול", none goes down | "no lift from the bottom quarter": the condition becomes `lowRank`; the 14 return to "דורש טיפול" (a server restart and `npm run docs`; the glossary and method texts say the lift, so they change too) |
| 5 | `PUBLIC_BASE_URL` for a real host | empty; share pages and the sitemap use the Host header | give the public address (section 1) |

**Decided in the build, the owner may still change them:**

| Topic | Default taken |
|---|---|
| Voice of the sentences | neutral third person with the town name; one table in `web/js/product/city/copy.js`, scanned by `tests/product-voice.test.mjs` |
| The phrase "דורש טיפול" | kept, with the how-to-read line and the glossary entry (the alternative: "נמוך ביחס לארץ" plus "סימן לבדוק") |
| Git | no repository; the rollback copies are in `design-ideas/product/baseline/` |
| Hosting | the Node server on HTTP/1.1 (it also works behind a CDN); behind HTTP/2 the number of modules does not matter |
| Browser baseline | Chrome and Edge 111+, Safari 16.4+, Firefox 115+ (only Chrome was tested) |
| Server restart and server features | done; the running server serves the bundle, the share pages and the feedback endpoint (`/api/health` shows `features`) |
