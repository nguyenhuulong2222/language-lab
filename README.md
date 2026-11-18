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

| Layer | Tool | Version |
|---|---|---|
| Frontend | Vite + React + TypeScript | Vite 6.4.5, React 19.1.0, TS 5.8.3 |
| Hosting | Cloudflare Pages | — |
| API / logic | Cloudflare Worker | wrangler.toml in `worker/` |
| Tests | Vitest + fast-check | Vitest 4.1.12, fast-check 3.23.2 |

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

# 2. Copy environment template (never commit .dev.vars or .env.local)
cp .env.example .env.local

# 3. Start the Vite dev server
npm run dev
```

The app runs at `http://localhost:5173` by default.

### Try the practice flow on a phone
The microphone only works on HTTPS or localhost, so a phone needs a tunnel. Start the dev
server with `--host`, then run `cloudflared tunnel --url http://localhost:5173`. It prints an
`https://....trycloudflare.com` address; open that on the phone. Typing always works, with or
without the microphone. A production build switches civics scoring off while the answer key
files say `needsHumanReview: true`; the dev server runs everything.

### Check the layout at phone width
`npm run layout-check` opens the real app in headless Google Chrome at 390px, clicks through the
home screen, the full interview and one single part, and checks every screen for sideways scroll,
clipped text, elements off the screen and touch targets under 48px. It does this for normal and
extra large text and for each interface language. Options: `--size=extra-large`, `--lang=en`,
`--shots` (screenshots go to the system temp folder). It needs Chrome (`CHROME_PATH` if it is
not in the default macOS place). It is not part of `npm test` because it needs a real browser.

### Run Tests

```bash
# Single pass (CI-friendly)
npm test

# Watch mode
npm run test:watch
```

### Typecheck

```bash
npm run typecheck
```

### Worker Development

```bash
# Start the local Worker (via Wrangler, installed separately)
# See: https://developers.cloudflare.com/workers/wrangler/install-and-update/
npx wrangler dev
```

Run this from the `worker/` directory, or point wrangler at `worker/wrangler.toml`.

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

## Pre-existing work and third-party material

- **Civics translations.** The files in `data/translations/civics/` were imported from the owner's earlier project, formN400.org (repository N400, commit `942c5d6`), which was created before this hackathon. Text that project marked as machine-suggested (`_suggested`) was not imported. Every translation file is marked `needsHumanReview`, and the translations are display-only: scoring never uses them. The English display files in the same folder come from the USCIS documents below.
- **USCIS source documents.** `data/sources/` holds public U.S. government material (the 2025 civics question PDF and the saved 2008 web page), kept as the source for the answer keys. See `data/sources/README.md` for URLs and checksums. This does not mean Language Lab is affiliated with USCIS.
- **Frontend design guidance.** `.kiro/steering/frontend-design.md` is the "frontend-design" skill from Anthropic's skills repository (https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md, MIT License). It is agent guidance only and is not part of the product build.
- **AI-generated audio and AI services.** All spoken prompts in the practice flow (civics questions, N-400 questions and sample answers, writing dictation sentences) are AI-generated with OpenAI text-to-speech (`gpt-4o-mini-tts`, voice coral). They are generated ahead of time by `tools/audio/generate-audio.mjs` and committed as static MP3 files in `public/audio/`; the app never calls a speech service while it runs. The screen says "AI-generated voice" when a clip plays. If a clip is missing or fails to load, the browser's own voice is used and the screen says "Device voice". The audio of the speech test tool is made the same way and is not committed. Interview follow-up questions will use the Claude API (not built yet).
- **Everything else** was written during the hackathon with Kiro.

These notes do not change the statements above: Language Lab is not a government service, is not affiliated with USCIS, and does not give legal advice.

---

## License

[MIT](LICENSE)
