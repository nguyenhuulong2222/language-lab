# Language Lab

**Free, voice-first practice for the U.S. naturalization interview.**

Styled as a 1970s language lab booth — individual study, focused repetition, no pressure.

> **This is an independent practice tool. It is not affiliated with, endorsed by, or
> connected to USCIS, DHS, or any U.S. government agency. Practice results do not predict
> or reflect any official immigration decision. Nothing here is legal advice. Consult a
> qualified immigration attorney for guidance on your actual case.**

---

## What It Does

Language Lab lets you rehearse the naturalization interview using entirely fictional practice
profiles. You work through:

- **N-400 conversation practice** — biographical questions, with English speaking assessed
  during the conversation
- **Reading** — English reading portion practice
- **Writing** — English writing portion practice
- **Civics** — 2008 or 2025 test questions, scored against the official answer key

At the end you receive a practice report. The report tells you what to review. It is
practice feedback, not an official assessment.

---

## What It Is Not

- Not a government service
- Not affiliated with USCIS or any agency
- Not legal advice
- Not a prediction of your interview outcome

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Vite + React + TypeScript |
| Hosting | Cloudflare Pages |
| API / logic | Cloudflare Worker |
| Tests | Vitest + fast-check |

---

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) for Worker development

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template (never commit .dev.vars)
cp .env.example .env.local

# 3. Start the Vite dev server
npm run dev
```

The app runs at `http://localhost:5173` by default.

### Run Tests

```bash
# Single pass (CI-friendly)
npm run test -- --run

# Watch mode
npm run test
```

### Worker Development

```bash
# Start the local Worker (via Wrangler)
npx wrangler dev worker/index.ts
```

---

## Deploy to Cloudflare Pages

1. Connect your GitHub repo to [Cloudflare Pages](https://pages.cloudflare.com/).
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add any environment variables in the Cloudflare dashboard (never in source).
5. Push to `main` to deploy.

PR branches automatically get preview deployments.

---

## Project Structure

```
language-lab/
├── src/
│   ├── contracts/   # Shared TypeScript types
│   ├── engine/      # Pure scoring and session logic
│   └── ui/          # React components
├── worker/          # Cloudflare Worker
├── data/            # Civics test rules and answer data
├── mock/            # Fictional session fixtures
└── docs/            # kiro-log.md and guides
```

See [`docs/kiro-log.md`](docs/kiro-log.md) for architecture decisions.

---

## Content Safety

- All practice uses **fictional profiles**. No real personal data is collected or required.
- Civics answers are scored from the answer key only. AI never decides civics scores.
- No machine translation of civics or legal content.
- No government seals or implied official endorsement.

See [`.kiro/steering/content-safety.md`](.kiro/steering/content-safety.md) for the full rules.

---

## License

[MIT](LICENSE)
