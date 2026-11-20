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

- **N-400 conversation practice** — biographical questions as in the interview. Not scored; the real
  interview is held in English
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
- Civics questions, answers and practice sentences are English only and are never machine-translated. The interface can be switched to other languages; those translations are AI-generated unless marked as reviewed (see the disclosure section).
- Voice: the words you say are recognised by your browser (the browser maker may process the audio). Language Lab never sends or saves your voice. "Record and compare" keeps a recording in memory on your device for the current sentence only and deletes it when you move on.
- No government seals or implied official endorsement.

See [`.kiro/steering/content-safety.md`](.kiro/steering/content-safety.md) for the full rules.

---

## Pre-existing work and third-party material

- **Civics translations.** The files in `data/translations/civics/` were imported from the owner's earlier project, formN400.org (repository N400, commit `942c5d6`), which was created before this hackathon. Text that project marked as machine-suggested (`_suggested`) was not imported. Every translation file is marked `needsHumanReview`, and the translations are display-only: scoring never uses them. The English display files in the same folder come from the USCIS documents below.
- **USCIS source documents.** `data/sources/` holds public U.S. government material (the 2025 civics question PDF and the saved 2008 web page), kept as the source for the answer keys. See `data/sources/README.md` for URLs and checksums. This does not mean Language Lab is affiliated with USCIS.
- **Frontend design guidance.** `.kiro/steering/frontend-design.md` is the "frontend-design" skill from Anthropic's skills repository (https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md, MIT License). It is agent guidance only and is not part of the product build.
- **AI-generated audio and AI services.** All spoken prompts in the practice flow (civics questions, N-400 questions and sample answers, writing dictation sentences, reading sample sentences) are AI-generated with OpenAI text-to-speech (`gpt-4o-mini-tts`, voice coral). They are generated ahead of time by `tools/audio/generate-audio.mjs` and committed as static MP3 files in `public/audio/`; the app never calls a speech service while it runs. The screen says "AI-generated voice" when a clip plays. If a clip is missing or fails to load, the browser's own voice is used and the screen says "Device voice". The audio of the speech test tool is made the same way and is not committed. Interview follow-up questions will use the Claude API (not built yet).
- **AI-generated interface translations.** The interface is offered in 14 languages (English, Vietnamese, Spanish, Traditional Chinese, Filipino, Korean, Hindi, Haitian Creole, Thai, Lao, White Hmong, Burmese, Portuguese, Russian). Everything except English was translated by AI and has **not** been reviewed by a native speaker. Each screen in those languages says so, the disclaimers are always shown with their English text, and English is the authoritative version. A language loses the label only when a named human reviewer is recorded in its locale file (`src/i18n/locales/<code>.json`, `_meta`). Automated checks (same keys, placeholders, numbers and fixed terms) run in the tests and before a language is offered, but they cannot judge meaning. Review sheets for a native reader are in [`docs/locale-review.md`](docs/locale-review.md). Civics questions, answers, reading and writing sentences and N-400 questions are never translated this way.
- **Pictures for civics questions.** The pictures shown after a civics answer is graded, and in "Study first", are public-domain or openly licensed works from official U.S. federal sources (so far the Smithsonian Institution's Open Access collection, National Portrait Gallery items marked CC0; Library of Congress pictures are planned). A picture is used only when its own record states its rights ("No known restrictions on publication", public domain, U.S. government work or CC0). The rights text is copied from the source record as it was on the download date. Each picture, its creator, its source page and its rights statement word for word are listed in [`docs/image-credits.md`](docs/image-credits.md) and in the app (footer, "Picture credits"). Pictures that could not be fetched are in [`docs/image-todo.md`](docs/image-todo.md). Using these pictures does not mean the Smithsonian, the Library of Congress or any other agency endorses Language Lab. The pairing of pictures and questions is marked `needsHumanReview` (see [`docs/image-review.md`](docs/image-review.md)).
- **Everything else** was written during the hackathon with Kiro.

These notes do not change the statements above: Language Lab is not a government service, is not affiliated with USCIS, and does not give legal advice.

---

## License

[MIT](LICENSE)
