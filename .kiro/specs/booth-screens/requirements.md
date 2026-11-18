# Booth screens — Requirements

A complete practice run, in one browser tab, with no AI call and no network call from the app.
Visual direction: `.kiro/steering/design-system.md` (Reel-to-Reel booth) and `frontend-design.md`.
Content rules: `.kiro/steering/content-safety.md`.

## Flow
Intro → N-400 interview → Reading → Writing → Civics → Report. Session state lives in memory only
(no localStorage, no cookies, no network). Reloading the page starts again.

## Requirements

### BS-01 Intro
- The user chooses one of the fictional practice profiles. The app never asks for real data.
- The user chooses whether the N-400 was filed before, or on or after, the boundary date. The date
  is read from `data/test-rules.json`. The engine picks the 2008 or 2025 civics test from it.
- The practice-only, not-legal-advice and not-a-government-service disclaimers are shown, with a
  note not to say real personal details (name, address, A-number, dates of birth).
- Start is disabled until both choices are made.

### BS-02 N-400 interview
- Scripted questions come from `data/practice/n400-questions.json`.
- For each question: the question text, a sample answer for the chosen fictional profile (labelled
  as fictional, never as advice), and the user's own transcript (voice or typed).
- No scoring and no AI. The screen talks to an `N400Coach` interface. The scripted coach is the
  only implementation now. A later Worker-backed coach can supply follow-up questions and feedback
  without a change to the screen.

### BS-03 Reading
- Show one sentence at a time. The user reads it aloud (typed fallback). The transcript is compared
  with the sentence.
- At most `sentencesPresented` sentences (rules). The stage passes when `runEnglishStage` says so.
- "Correct" for one sentence uses a practice threshold (BS-12).

### BS-04 Writing
- Play a sentence aloud. The user types it. The text is compared with the sentence.
- Same rule source and pass rule as reading.

### BS-05 Civics
- One question at a time: text, a play-aloud button, answer by voice with typed fallback.
- Graded with the real engine (`runCivicsStage` and the answer key). The screen shows "Correct" or
  "Not yet" and the official accepted answers for that question.
- Static questions only (CR-003). The stage stops exactly when the engine stops.

### BS-06 Report
- `buildFinalReport` with the real results of the graded stages. The existing report screen shows it.

### BS-07 Voice input
Every voice step handles: microphone denied, browser without speech recognition, nothing heard,
and other errors. Typed input always works and is always visible.

### BS-08 Spoken prompts
One small interface (`PromptSpeaker`). Today it uses the browser's speech synthesis and the screen
says it is a device voice. Pre-generated MP3 files can replace it later without a screen change.

### BS-09 Text and language
All user-facing text comes from `src/i18n/locales/en.json`. Translations stay hidden (decision D in
`docs/decisions-log.md`): no screen uses `TranslatedQuestion` or `loadCivicsDisplay`.

### BS-10 Accessibility and layout
Mobile first at 390px. Touch targets at least 44px. Body text at least 18px. Visible keyboard focus.
Status is never colour alone. Voice results are announced (`aria-live`). Reduced motion respected.

### BS-11 Production behaviour
The answer key files have `needsHumanReview: true`, and the loader refuses them in a production
build. The flag and the check are not changed. In a production build the intro, N-400, reading and
writing work; the civics step explains that civics scoring is switched off until a person reviews
the answer key, and no report is built. `npm run dev` works fully.

### BS-12 Practice threshold is not a USCIS rule
USCIS publishes vocabulary lists, not fixed sentences, and does not publish how close a spoken or
typed sentence must be. The closeness needed (`minWordAccuracy` for reading and for writing) is a
Language Lab practice setting in `data/practice/practice-config.json`. It is never written in a
component. The UI says it is a practice setting, not a USCIS rule.

### BS-13 Reading and writing content
Sentences use only words from the official USCIS reading and writing vocabulary lists, fetched from
uscis.gov and saved in `data/sources/` with URL and SHA-256. The sentence file is marked
`needsHumanReview`. A test fails if a sentence uses a word outside its list.

## Out of scope
AI follow-up questions and feedback, N-400 scoring, pre-generated audio, the 65/20 exemption,
translated screens, saving progress.
