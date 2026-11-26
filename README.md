# Language Lab

## For judges

Live: <https://lab.formn400.org> (backup: <https://language-lab-ade.pages.dev>, the same Cloudflare
Pages project; features of a branch appear there after it is merged and deployed). The full guide is [`docs/judge-guide.md`](docs/judge-guide.md).

A 3-minute path:

1. **Home**: the welcome, "How it works" and the disclaimer.
2. **AI coach**: "Practice the N-400 interview with an AI coach", pick a fictional profile, "Start
   practice". The consent notice opens first; nothing is sent until you press "Turn on the AI coach".
   Without AI: "Cancel", then "No, practice without AI".
3. **Full interview**: from Home, "Full practice interview": profile, filing date (2008 or 2025 test),
   then N-400, reading, writing ("Show the sentence" if you cannot listen) and civics.
4. **Report**: "Practice score reached" or "Worth reviewing" per part, never pass or fail, with the
   disclaimer.
5. **Study first**: page through the civics questions with official answers and pictures; not scored.
6. **65/20**: "65/20 civics practice": 10 of the 20 starred questions, 6 correct for the practice
   score (USCIS Policy Manual, Vol. 12, Part E, Ch. 2), with a link to the USCIS interpreter rule.
7. **Language menu**: the globe button in the header; for example Tiếng Việt. Disclaimers, legal lines
   and civics questions stay in English.

Microphone: only "Say it" (speech recognition, in browsers that support it, such as Chrome, Edge or
Safari) and "Record and compare" on the reading screen need one. Everything else, and every answer,
works by typing. The AI coach is off by default and sends nothing until you confirm its notice.

---

**Free, voice-first practice for the U.S. naturalization interview.**

The language-lab method (listen, speak, compare, repeat), in the clean navy-and-white style of
formN400.org, the owner's separate site. Served at lab.formn400.org.

Live: <https://lab.formn400.org> (backup: <https://language-lab-ade.pages.dev>; the production build, it
shows this branch's work only after a deploy).

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
- **Civics** — 2008 or 2025 test questions, scored against an answer key that Language Lab built
  from the USCIS question lists and that the project owner reviewed on 2026-11-20 (see
  `docs/answer-key-review.md` and `docs/answer-key-source-check.md`). It is not an official USCIS key

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
| API / logic | Cloudflare Pages Functions | `functions/` (the optional AI coach only) |
| Tests | Vitest + fast-check | Vitest 4.1.12, fast-check 3.23.2 |

---

## Local Development

### Prerequisites

- Node.js 22.20+ (the tools in `tools/` import TypeScript files directly, which needs 22.18; the AI
  coach counter test needs node:sqlite's numbered parameters, from 22.20). `.node-version` pins
  22.20.0 for CI and for the Cloudflare Pages build, which reads that file.
- npm 10+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) only to run the AI coach's Pages Function locally (see `docs/coach-deploy.md`)

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
without the microphone. A production build switches civics scoring off if an answer key
file says `needsHumanReview: true` (or is marked reviewed without naming a reviewer); the dev server runs everything.

### Check the layout at phone width
`npm run layout-check` opens the real app in headless Google Chrome at 390px, clicks through the
home screen, the full interview and one single part, and checks every screen for sideways scroll,
clipped text, elements off the screen and touch targets under 48px. It does this for normal and
extra large text and for each interface language. Options: `--size=extra-large`, `--lang=en`,
`--shots` (screenshots go to the system temp folder), `--width=320` (the WCAG reflow width) and
`--prod` (builds the production bundle into a temp folder, serves it with the headers of
`public/_headers`, and fails on any Content-Security-Policy violation; civics is locked and the
languages in review are hidden there, so those are skipped). Run one language per call. It needs Chrome (`CHROME_PATH` if it is
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

### Pages Functions
The only server code is the optional AI coach, a Cloudflare Pages Function in `functions/api/coach.ts`.
How to run and deploy it: [`docs/coach-deploy.md`](docs/coach-deploy.md).

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
├── functions/       # Cloudflare Pages Functions (AI coach)
├── data/            # Civics test rules and answer data
├── mock/            # Fictional session fixtures
└── docs/            # kiro-log.md and guides
```

See [`docs/kiro-log.md`](docs/kiro-log.md) for architecture decisions.

### How Kiro was used
- **Specs** (`.kiro/specs/grading`, `.kiro/specs/booth-screens`): requirements, design and a task list for the
  grading engine and for the screens. Each task was done and ticked off in order; `tasks.md` records what is left.
- **Steering** (`.kiro/steering/`): the content-safety rules (fictional profiles only, no machine-translated legal
  text, civics scored only from the answer key, the disclaimer), the product, structure and tech notes, and the
  design system. They apply to every agent session.
- **Hooks** (`.kiro/hooks/`): typecheck on every saved `.ts`/`.tsx` file, the tests on every saved engine or contract
  file, and a guard that refuses tool calls naming secret files (`npm run test:hooks` tests it; it is a guard
  against accidents, not a security boundary).
- **Agents** (`.kiro/agents/`): `content-reviewer` checks civics and legal text against the uscis.gov sources and
  the content-safety rules; `ui-reviewer` checks layout, text size, contrast and accessibility against the design
  system. Both are read-only and ran before each release step; their findings are in `docs/decisions-log.md`.
- **Audit**: `docs/audit/2026-11-audit.md` is a full audit made with Kiro; `docs/audit/open-findings.md` lists what is
  still open and why.

---

## Content Safety

- All practice uses **fictional profiles**. No real personal data is collected or required.
- Civics answers are scored from the answer key only. AI never decides civics scores.
- Civics questions, answers and practice sentences are English only and are never machine-translated. The interface can be switched to other languages; those translations are AI-generated unless marked as reviewed (see the disclosure section).
- Voice: the words you say are recognised by your browser (the browser maker may process the audio). Language Lab never sends or saves your voice. "Record and compare" keeps a recording in memory on your device for the current sentence only and deletes it when you move on.
- AI coach (optional, N-400 part only): off by default and off again in every new practice. Only when
  you turn it on and confirm the notice, the text of each N-400 answer (never audio, never earlier
  answers) is sent through Language Lab's server (a Cloudflare Pages Function on this site) to
  Anthropic's API to make one follow-up question, a feedback label and one English tip, all marked
  "AI-generated feedback". The model is `claude-haiku-5-5` (settings in `data/coach-config.json`).
  Before sending, the app and the server refuse answers that look like an A-number, a Social
  Security number, a phone number, an e-mail address or a full date; this cannot catch every
  personal detail, so answer as the fictional person. The reply is checked before it is shown
  (English only, length limits, no outcome predictions, no legal advice, no officeholder names, no
  requests for personal details); anything that fails is dropped. The coach never scores civics,
  reading or writing, and the report does not score the N-400 part. The server stores no answers or
  replies; it keeps counters in Cloudflare D1 (per UTC day: a salted, daily hash of the IP address and
  a random per-practice session id), removed during later requests, normally within two days. The
  reply checks are best effort, not a guarantee. Anthropic's handling of API data: <https://www.anthropic.com/legal/privacy>.
  Deploy notes, limits and costs: [`docs/coach-deploy.md`](docs/coach-deploy.md).
  The coach screens say "Powered by Claude (Anthropic)" as plain text; no Anthropic or Claude logo
  is used. Claude and Anthropic are trademarks of Anthropic, PBC; Language Lab is not affiliated with,
  sponsored by or endorsed by Anthropic.
- No government seals or implied official endorsement.

See [`.kiro/steering/content-safety.md`](.kiro/steering/content-safety.md) for the full rules.

---

## Pre-existing work and third-party material

- **USCIS source documents.** `data/sources/` holds public U.S. government material (the 2025 civics question PDF, the saved 2008 web page, the official reading and writing vocabulary lists and the Policy Manual chapter on the English test), kept as the source for the answer keys, the practice sentences and the scoring settings. PDF and HTML files are saved unchanged; the `.txt` files are text extracts of them. See `data/sources/README.md` for URLs and checksums. This does not mean Language Lab is affiliated with USCIS.
- **Frontend design guidance.** `.kiro/steering/frontend-design.md` is the "frontend-design" skill from Anthropic's skills repository (https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md, MIT License). It is agent guidance only and is not part of the product build.
- **AI-generated audio and AI services.** All spoken prompts in the practice flow (civics questions, N-400 questions and sample answers, writing dictation sentences, reading sample sentences) are AI-generated with OpenAI text-to-speech (`gpt-4o-mini-tts`, voice coral). They are generated ahead of time by `tools/audio/generate-audio.mjs` and committed as static MP3 files in `public/audio/`; the app never calls a speech service while it runs. The screen says "AI-generated voice" when a clip plays. If a clip is missing or fails to load, the browser's own voice is used and the screen says "Device voice". The audio of the speech test tool is made the same way and is not committed. The optional AI coach in the N-400 part uses Anthropic's Claude API (see "AI coach" above).
- **AI-generated interface translations.** The interface is offered in 14 languages (English, Vietnamese, Spanish, Traditional Chinese, Filipino, Korean, Hindi, Haitian Creole, Thai, Lao, White Hmong, Burmese, Portuguese, Russian). Everything except English was translated by AI and has **not** been reviewed by a native speaker. Each screen in those languages says so, disclaimers and legal text are shown **in English only** (legal text is never machine translated; a short translated line says so), and English is the authoritative version. A language loses the label only when a named human reviewer is recorded in its locale file (`src/i18n/locales/<code>.json`, `_meta`). Automated checks (same keys, placeholders, numbers and fixed terms) run in the tests and before a language is offered, but they cannot judge meaning. In the production build, White Hmong, Lao, Burmese and Haitian Creole are hidden from the language menu until a reviewer is recorded (more languages are in review); they stay available in development. Review sheets for a native reader are in [`docs/locale-review.md`](docs/locale-review.md). Civics questions, answers, reading and writing sentences and N-400 questions are never translated this way.
- **Pictures for civics questions.** The pictures shown after a civics answer is graded, and in "Study first", are public-domain or openly licensed works from official U.S. federal sources (the Smithsonian Institution's Open Access collection, National Portrait Gallery items marked CC0, the Library of Congress, items marked "No known restrictions on publication", and the National Archives Catalog, items whose use and access restriction is "Unrestricted"). A picture is used only when its own record states its rights ("No known restrictions on publication", public domain, U.S. government work or CC0). The rights text is copied from the source record as it was on the download date. Each picture, its creator, its source page and its rights statement word for word are listed in [`docs/image-credits.md`](docs/image-credits.md) and in the app (footer, "Picture credits"). Pictures that could not be fetched are in [`docs/image-todo.md`](docs/image-todo.md). Using these pictures does not mean the Smithsonian, the Library of Congress or any other agency endorses Language Lab. The pairing of pictures and questions is marked `needsHumanReview` (see [`docs/image-review.md`](docs/image-review.md)). Some illustrations of abstract ideas (CONCEPT questions only, such as the rule of law) are AI-generated with the OpenAI image model `gpt-image-2.6-flare` from prompts in this repository ([`data/images/illustration-prompts.json`](data/images/illustration-prompts.json), made by `tools/images/generate-illustrations.mjs`). Each one is labelled "AI-generated illustration" on screen, is shown only after the owner has reviewed it (`reviewed: true` in `data/images/illustrations-manifest.json`), and never shows a real person, event or document.
- **Everything else** was written during the hackathon with Kiro.

These notes do not change the statements above: Language Lab is not a government service, is not affiliated with USCIS, and does not give legal advice.

---

## License

[MIT](LICENSE), for the code and the text written for this repository. See [`NOTICE`](NOTICE) for the full scope.

### Licence scope

The MIT licence covers **this repository's code and its own text only**. Other material keeps its own terms:

| Material | Terms |
|---|---|
| Code, English interface text, practice sentences, fixtures, documentation | MIT (`LICENSE`) |
| USCIS documents in `data/sources/`, and the answer keys and English display files derived from them | U.S. government publications; the text remains USCIS's. No endorsement is implied |
| Pictures in `public/images/civics/` | Public domain / CC0 / "no known restrictions" per source record; listed in `docs/image-credits.md`. Not MIT |
| The Playfair Display and Source Serif 4 fonts | SIL Open Font License 1.1 (Playfair Display by Claus Eggers Sørensen; Source Serif 4 by Frank Grießhammer, Adobe). Served from this site (`public/fonts/`, licences in `public/fonts/OFL-PlayfairDisplay.txt` and `public/fonts/OFL-SourceSerif4.txt`); nothing is loaded from Google |
| Generated audio in `public/audio/` | Made with OpenAI text-to-speech and labelled "AI-generated voice" in the app. Not MIT-licensed recordings of a person |
| AI-translated interface text (`src/i18n/locales/` except English) | AI drafts, not reviewed by native speakers unless a locale file names a reviewer. Provided as is |
| Dependencies | Their own licences (runtime: React, React DOM, Scheduler, all MIT) |

**Nothing in this repository grants any right to formN400.org or its content.** Language Lab contains no
text, translation, data or design from formN400.org or the owner's separate N400 project. An earlier
version of this repository imported civics translations from that project; they were removed (history
still contains them, and they are not covered by this licence).
