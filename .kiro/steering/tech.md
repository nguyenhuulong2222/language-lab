---
inclusion: always
---

# Language Lab — Tech Steering

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend build | Vite + React + TypeScript | Fast HMR, first-class TS, wide ecosystem |
| Hosting | Cloudflare Pages | Free tier, global CDN, zero-config deploys |
| API / logic | Cloudflare Worker | Runs at the edge, same Cloudflare project |
| Unit / property tests | Vitest + fast-check | Native ESM, compatible with Vite; fast-check for property-based edge cases |

## Key Constraints

- **No API keys in source.** All secrets go in `.dev.vars` (local) or Cloudflare dashboard
  environment variables (production). Never commit secrets.
- **No server-side audio storage.** Audio recordings stay on the user's device.
  `localRecordingId` in session types is a device-local reference only.
- **No machine translation of civics or legal content.** Any Vietnamese (or other language)
  UI text must come from human-reviewed translation files.
- **Civics scoring is deterministic.** Scores come from `data/test-rules.json` and the
  answer key in `data/`. AI must never decide whether a civics answer is correct.

## TypeScript

- Strict mode on.
- Prefer discriminated unions over optional fields for variant types.
- Export all public types from `src/contracts/`.

## Testing

- Vitest for unit and integration tests.
- fast-check for property-based tests on scoring logic and data validation.
- Tests live alongside source in `__tests__/` subdirectories or as `*.test.ts` files.
- Run: `npm run test` (single pass: `npm run test -- --run`).

## Deployment

- `main` branch → Cloudflare Pages production.
- PR branches → Cloudflare Pages preview deployments.
- Worker deployed via Wrangler as part of the Pages project (Functions or standalone Worker).
