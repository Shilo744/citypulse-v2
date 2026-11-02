# IBM Bob and watsonx Orchestrate in this project

For the reviewers. Each statement can be checked in this repository: in the code, in the pictures under `docs/orchestrate/` and in the Bob task session summaries under `bob_sessions/`.

## What it is
CityPulse turns official Israeli open data (Ministry of Health, Central Bureau of Statistics, National Insurance Institute, Ministry of Welfare and others) into a public-health picture of one locality at a time: where it stands against the country, against similar localities and against Ministry targets, what needs attention, what changed over the years, and an ask page that answers a question from the figures.
Live: https://citypulse.shilo744.workers.dev (one Cloudflare Worker with static assets, `docs/CLOUDFLARE.md`). The API is described for agent platforms at `/openapi.json`.

## IBM Bob
- Bob wrote the server layer of this repository, in 14 tasks (49.2 Bobcoins): ETag/304 and brotli/gzip caching, security headers, request validation (400/404/405, rejected prototype keys, the Host header never echoed), `robots.txt` and `sitemap.xml`, the feedback endpoint, the share pages `/s/<key>` and their preview, the CSV export of a town, the stylesheet bundle, the themed 404 page and the three information pages (privacy, accessibility, method). Each one was given to Bob as a task; the team read and tested the result afterwards.
- Evidence: one screenshot of the task session summary per task in `bob_sessions/` (the prompt given to Bob, the Task Id, the workspace and the Bobcoin cost of the task), and the table of the tasks in `bob_sessions/README.md`.
- The rest, that is the data collection and the model in `src/`, the product front end in `web/js/product/` and the Cloudflare hosting in `worker/` and `scripts/`, was built by the team under its own direction.

## watsonx Orchestrate
- An Orchestrate agent named `CityPulse` was built in the team's watsonx Orchestrate instance. Its two tools are imported from this project's OpenAPI file (`/openapi.json`): one finds a locality by name, one answers a question about a locality (`POST /api/ask`, keyword planner, no model of ours in the loop).
- It was tested in Orchestrate's Draft Preview: it called the two tools in order and answered in Hebrew with the figures returned by the API (every number and indicator name matched the API response). Pictures and the exact instructions: `docs/ORCHESTRATE.md`, `docs/orchestrate/`.
- The instructions require the indicator names to be copied word for word, and the test run showed they were.

## What is not claimed
- The agent is not deployed to a public channel and its chat is not embedded in the site (the reasons are in `docs/ORCHESTRATE.md`, section 4). The Orchestrate instance belongs to the hackathon account, which closes on 4 November 2026; the same figures stay available through the open API.
- The ask page of the site is our own agent (OpenRouter: Claude Haiku 5.5 plans the answer and words it; no larger model is called). A language model never writes a number: figures are filled in from the data, and a sentence written by the model that contains a digit is rejected (`src/agent/guard.js`).
