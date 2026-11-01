# IBM Bob and watsonx Orchestrate in this project

For the reviewers. Each statement can be checked in this repository or in the pictures under `docs/orchestrate/`.

## What it is
CityPulse turns official Israeli open data (Ministry of Health, Central Bureau of Statistics, National Insurance, Ministry of Welfare) into a public-health picture of one locality at a time: where it stands against the country, against similar localities and against Ministry targets, what needs attention, what changed over the years, and an ask page that answers a question from the figures.
Live: https://citypulse.shilo744.workers.dev (one Cloudflare Worker with static assets, `docs/CLOUDFLARE.md`). The API is described for agent platforms at `/openapi.json`.

## IBM Bob
- Bob wrote the first CityPulse application, a separate repository of the team (front end, Cloudflare Worker, data agent over data.gov.il, tests).
- In **this** repository Bob wrote the server layer: ETag/304 and brotli/gzip caching, security headers, request validation (400/404/405, rejected prototype keys, the Host header never echoed), `robots.txt` and `sitemap.xml`, the feedback endpoint, the share pages `/s/<key>`, the CSV export of a town, the stylesheet bundle, the themed 404 page and the share preview of the short page. Each one was given to Bob as a task; the team read and tested the result afterwards.
- Evidence kept by Bob itself: its local task database records 24 tasks between 27 and 30 October 2026, about 245 Bobcoins, 1,264 tool calls, of which 85 file creations and 165 applied diffs (13 of the tasks were for this V2 repository).
- The rest of V2, that is the data collection and the model in `src/`, the product front end in `web/js/product/` and the Cloudflare hosting in `worker/` and `scripts/`, was written with Claude Code (Anthropic) under the team's direction. In the first application, the places edited by Claude Code are marked `CLAUDE-EDIT` in that repository.

## watsonx Orchestrate
- An Orchestrate agent named `CityPulse` was built in a watsonx Orchestrate trial instance. Its two tools are imported from this project's OpenAPI file (`/openapi.json`): one finds a locality by name, one answers a question about a locality (`POST /api/ask`, keyword planner, no model of ours in the loop).
- It was tested in Orchestrate's Draft Preview: it called the two tools in order and answered in Hebrew with the figures returned by the API (every number and indicator name matched the API response). Pictures and the exact instructions: `docs/ORCHESTRATE.md`, `docs/orchestrate/`.
- A first version of the instructions let the model reword indicator names; the instructions now require the names word for word, and a second run did.

## What is not claimed
- The agent is not deployed to a public channel and its chat is not embedded in the site (the reasons are in `docs/ORCHESTRATE.md`, section 4).
- The ask page of the site is our own agent (OpenRouter: Claude Haiku 5.5 plans, Claude Sonnet 5.5 words the answer). A language model never writes a number: figures are filled in from the data, and a sentence written by the model that contains a digit is rejected (`src/agent/guard.js`).
