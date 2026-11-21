# Deploying the optional AI coach

The AI coach is a Cloudflare Pages Function (`functions/api/coach.ts`) in this repository, served
from the same origin as the app. It stays switched off until every step below is done. The app works
without it: the N-400 part then uses the scripted coach only.

Facts used here were read from the Cloudflare and Anthropic documentation on 2026-11-20. Replace
`<project>` with the name of your Pages project (the site is `language-lab-ade.pages.dev`; the
project name is shown in the dashboard under **Workers & Pages**).

## What you must create

| Name | Kind | Value | Where |
|---|---|---|---|
| `COACH_DB` | D1 database binding | the database `language-lab-coach` | Pages project, Production (and Preview if wanted) |
| `ANTHROPIC_API_KEY` | Secret | your Anthropic API key | Pages project |
| `COACH_IP_SALT` | Secret | 32 or more random characters | Pages project |
| `COACH_ENABLED` | Variable (or secret) | `true` | Pages project |

Why D1: Pages Functions cannot use the Workers rate-limiting binding, and KV is eventually
consistent. D1 is on the Workers Free plan (100,000 rows written and 5 million read per day) and
each counter update is one atomic statement. A counted call writes at most 7 rows, so the daily
budget of 600 calls uses at most about 4,200 writes.

## Steps

1. Create the database and its table (Wrangler 4 or later, logged in with `npx wrangler login`):
   ```sh
   npx wrangler d1 create language-lab-coach
   npx wrangler d1 execute language-lab-coach --remote --file=functions/coach-schema.sql
   ```
2. Bind it to the Pages project: dashboard → **Workers & Pages** → your project → **Settings** →
   **Bindings** → **Add** → **D1 database**. Variable name `COACH_DB`, database
   `language-lab-coach`. Do this for Production (and Preview if you want the coach on previews).
   No Pages Wrangler file is added to the repository on purpose: one with `pages_build_output_dir`
   would become the project's source of truth and replace the dashboard settings.
3. Set the secrets. Each command asks for the value; type or paste it there, never into a file in
   this repository:
   ```sh
   npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=<project>
   npx wrangler pages secret put COACH_IP_SALT --project-name=<project>
   ```
   For the salt, any 32 or more random characters will do (for example the output of
   `openssl rand -hex 32`, pasted at the prompt). Without the salt the endpoint stays unavailable.
4. Turn it on: dashboard → project → **Settings** → **Variables and Secrets** → **Add**, name
   `COACH_ENABLED`, value `true` (plain text). Or `npx wrangler pages secret put COACH_ENABLED
   --project-name=<project>` and type `true`.
5. Deploy. Secrets, variables and bindings take effect on the next deployment.
   - With the Git integration: merge this branch into `main`. Pages runs `npm run build` and
     compiles `functions/` by itself.
   - Or from your computer, in the repository root: `npm run build` then
     `npx wrangler pages deploy dist --project-name=<project>` (Wrangler picks up `functions/`
     from the current folder).
6. Outer guards (recommended):
   - In the Anthropic Console, give the key's workspace a monthly spend limit (for example $5).
   - If your Cloudflare plan offers a rate-limiting rule, add one for `/api/coach` (for example 60
     requests per minute per IP). The Function enforces its own limits either way.

## Switch the coach off quickly

- Fastest, no deploy: revoke or disable the API key in the Anthropic Console. Every call then fails
  upstream and learners see "AI feedback is not available right now".
- Clean: set `COACH_ENABLED` to `false` (or delete it) and redeploy (dashboard → **Deployments** →
  latest → **Retry deployment**). The endpoint then answers "coach unavailable" without calling
  Anthropic, and the switch turns itself off for the learner.
- Removing the secret or the D1 binding has the same effect after a redeploy.

## See usage

- Today's calls and spend (spend is stored in micro-dollars: 1,000,000 = $1):
  ```sh
  npx wrangler d1 execute language-lab-coach --remote --command "SELECT key, count, micro_usd FROM coach_counters WHERE key LIKE 'day:%' OR key LIKE 'spend:%' ORDER BY key DESC LIMIT 10"
  ```
- Live log lines (status and reason codes only, never answers or replies):
  `npx wrangler pages deployment tail --project-name=<project>`, or dashboard → project →
  **Deployments** → a deployment → **Functions** → real-time logs.
- Billed usage: Anthropic Console → Usage.

## Limits and what they cost

All limits live in `data/coach-config.json` (tests check every one).

| Limit | Value |
|---|---|
| Model | `claude-haiku-5-5`, effort `low`, thinking off, `max_tokens` 300, no temperature (removed in API version `2026-10-21`) |
| Answer length | 600 characters |
| Request body | 4,096 bytes |
| Turns per session | 12 |
| Per IP | 30 per hour, 80 per day |
| Daily request budget | 600 calls (UTC day) |
| Daily spend cap | $0.50 (UTC day) |
| Timeouts | 8 s to Anthropic, 12 s in the browser |

Prices used: $0.10 per million input tokens and $0.50 per million output tokens (Claude Haiku 5.5,
prompts under 100,000 tokens).

| | Input tokens | Output tokens | Cost |
|---|---|---|---|
| One call, worst case the server reserves (1,400 fixed + answer, full 300 output) | about 1,770 | 300 | about $0.00033 |
| One call, typical (prompt about 1,000, reply about 80) | about 1,000 | 80 | about $0.00014 |
| One session, 12 calls | | | $0.0017 typical, $0.0040 worst |
| One day at the request budget, 600 calls | | | $0.08 typical, $0.20 worst |
| One day at the spend cap | | | $0.50 at most (reached only if prices or limits change) |
| One month at the request budget every day | | | about $2.50 typical, $6 worst |

Cloudflare side: Pages Functions requests count toward the Workers Free plan's daily requests; D1
use stays far inside the free limits.

## Change the model

1. Read the model's page and the pricing page on platform.claude.com/docs.
2. Edit `data/coach-config.json`: `model.id`, the two prices, `checkedOn`; `apiVersion` only if
   the API version changed (check what it removed).
3. Run `npm test`. The config parser rejects unknown fields and out-of-range values.

## Local development

`npm run build` and then `npx wrangler pages dev dist --d1=COACH_DB` runs the app with the Function
on `http://localhost:8788` (an allowed origin). Local secrets go in Wrangler's local secrets file
for Pages (see the Cloudflare docs, "Local development with secrets"); that file is git-ignored and
must never be committed. Tests never need a key: the model is mocked.
