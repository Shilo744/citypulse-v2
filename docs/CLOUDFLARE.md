# CityPulse on Cloudflare

The site runs as **one Cloudflare Worker with static assets** (account of the owner, name `citypulse`, address `https://citypulse.shilo744.workers.dev`).
Nothing runs on a server of its own: the free plan is enough for a demo (100,000 Worker requests a day; static files are free and unlimited).

## What is where
| Part | Where | Built by |
|---|---|---|
| The site (`web/`), the stylesheet bundle, 404 page, `_headers` | static assets (`dist/`) | `scripts/export-static.js` |
| The model of every town (1,490 files, `_d/city/<key>.json`) and its CSV | static assets | the same script, with the real functions of `src/` |
| Catalogue, map backdrop, sitemap, `openapi.json` | static assets (`_d/`) | the same script |
| `/api/*`, `/s/<key>` (share pages), `robots.txt`, `sitemap.xml`, `/openapi.json` | the Worker (`worker/index.js`) | `wrangler deploy` |
| The store of figures (`data/store/store.json`, 4.6 MB) | bundled into the Worker | `wrangler deploy` |
| The AI's ledger and the briefing cache | KV namespace `STATE` | the Worker |
| Feedback | D1 database `citypulse`, table `feedback` (`migrations/0001_feedback.sql`) | the Worker |

The Worker answers `/api/*` with **the same functions the Node server uses** (`src/api.js`, `src/agent/*`); `scripts/parity.js` and `scripts/parity-ask.js` compare the two hosts request by request (437 requests and 8 questions: no difference but the timestamp `computedAt`).
`/api/llm` (the spend and the balance of the key) is not served by the Worker.

## Commands (from this folder, Node 20+; `npm install` once)
| | |
|---|---|
| Build the static part | `npm run build` (wrangler also does it before every deploy) |
| Run it locally like the real thing | `npx wrangler dev --port 8788 --local` |
| Compare with the Node server | `node server.js` (port 8800) and `node scripts/parity.js http://localhost:8800 http://127.0.0.1:8788` |
| Deploy | `npx wrangler deploy` (the first time ~5 minutes: 3,000 files; later only the changed ones) |
| Go back to the last version | `npx wrangler rollback` |
| Watch the requests (and their CPU time) | `npx wrangler tail --format pretty` |

## Secrets and settings (never in the repository)
- **The key of the AI** (OpenRouter): `npx wrangler secret put LLM_API_KEY` and paste it at the prompt. Without it the ask page works on its keyword planner (the answer is built from the figures, no paid call).
  Other optional values, the same way or as `vars`: `LLM_MODEL_SEARCH`, `LLM_MODEL_REASON`, `LLM_RESERVE_USD` (default 0.3: the AI stops while the key has less left), `LLM_MAX_PER_HOUR` (default 40), `PUBLIC_BASE_URL` (the address of a custom domain), `SHARE_TARGET`.
- **Feedback**: `npx wrangler d1 execute citypulse --remote --command "SELECT * FROM feedback ORDER BY id DESC LIMIT 50"`. The IP is not stored; the rate limit is Cloudflare's own (3 reports a minute per client).

## Updating the data
1. `npm run refresh` (collects from the sources and builds `data/store/store.json`) on a computer with internet.
2. `npx wrangler deploy` (builds `dist/` again from the new store, uploads what changed).
The date under every page ("עודכן ...") is the date of the store.

## Updating from GitHub
Cloudflare dashboard, Workers & Pages, `citypulse`, Settings, Builds, Connect to Git: pick the repository; build command empty, deploy command `npx wrangler deploy`. Every push to the chosen branch deploys (the build runs `scripts/export-static.js` through `wrangler.jsonc`).

## Limits to know (free plan)
- Worker CPU time per request: 10 ms. A request that only hands out a file or a ready model costs almost nothing; `/api/ask` and the indicator pages do real work: check `wrangler tail` for `cpuTime` after changes.
- KV: 1,000 writes a day (the AI's ledger is written after every AI call). Static assets: 20,000 files per version (now ~3,200).
- `workers.dev` addresses are public; a custom domain is added in the dashboard (Settings, Domains & Routes).
