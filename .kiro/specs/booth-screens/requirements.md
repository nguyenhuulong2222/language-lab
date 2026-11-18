# Booth screens — Requirements

A complete practice run, in one browser tab, with no AI call and no network call from the app.
Visual direction: `.kiro/steering/design-system.md` (Reel-to-Reel booth) and `frontend-design.md`.
Content rules: `.kiro/steering/content-safety.md`.

## Flow
Home → (setup, only when the chosen part needs it) → the chosen part or parts → Report.
Full practice interview: Setup → N-400 interview → Reading → Writing → Civics → Report.
Practise one part: N-400, Reading, Writing or Civics, then a report for that part. Session state lives in memory only
(no localStorage, no cookies, no network). Reloading the page starts again.

## Requirements

### BS-01 Intro (setup)
The setup screen asks only for what the chosen part needs: a fictional profile (N-400, full interview)
and the filing choice (civics, full interview). Reading and writing need neither and start at once.
The prominent disclaimers and the voice note move to the home screen so every session sees them.
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
One small interface (`PromptSpeaker`). Prompts are played from pre-generated OpenAI TTS clips in
`public/audio/` (made by `tools/audio/generate-audio.mjs`, listed in `public/audio/manifest.json`).
The app never calls a TTS service. A missing clip, a clip whose text changed, or a clip that fails
to load falls back to the browser's speech synthesis. The screen says "AI-generated voice" for a
clip and "Device voice" only for the fallback. Playback starts inside the tap (iPhone Safari), and
a second tap stops it. Reading sentences are not played before the attempt.

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
How close a spoken or typed sentence must be to count as correct here is not a USCIS rule. The
closeness needed (`minWordAccuracy` for reading and for writing) is a
Language Lab practice setting in `data/practice/practice-config.json`. It is never written in a
component. The UI says it is a practice setting, not a USCIS rule.

### BS-13 Reading and writing content
Sentences use only words from the official USCIS reading and writing vocabulary lists, fetched from
uscis.gov and saved in `data/sources/` with URL and SHA-256. The sentence file is marked
`needsHumanReview`. A test fails if a sentence uses a word outside its list.

### BS-14 Home and section choice
The first screen offers "Full practice interview" and "Practise one part" (N-400, Reading, Writing,
Civics), and a three-step "How it works" (listen, speak or type, see the result). The stepper shows
only the steps of the chosen session. A single-part session ends with a report for that part only,
with no overall practice result. The contract has no partial report (`FinalReport.practiceResult` is
required), so the part report is a local type in `src/engine/` and the change to the contract is
requested in `docs/contract-requests.md` (CR-006). `src/contracts/` is not edited.

### BS-15 Instructions
Every practice screen has a "How this works" button with short steps in plain words for people new
to smartphones: what the microphone button does, that typing always works, what "Skip" does. The
steps open by themselves the first time a screen is shown in a session and can be opened again at
any time.

### BS-16 Comfort settings
In the header on every screen: text size (normal, large, extra large), and slower playback for the
recorded clips (`playbackRate`, no new audio). A "Play again" button wherever audio plays. Settings
live in memory for the session only. At 390px with extra large text: no clipped text, no horizontal
scroll, touch targets at least 48px.

### BS-17 Interface languages (replaces the Vietnamese-only version)
The interface can be switched between the 14 languages of `src/i18n/languages.ts` (en, vi, es, zh,
tl, ko, hi, ht, th, lo, hmn, my, pt, ru). Only the interface text changes. Civics questions,
accepted answers, reading and writing sentences, N-400 questions and sample answers stay English
only, and translations of civics questions stay hidden from every screen. A line on screen says the
real interview is held in English.

The policy is in `.kiro/steering/content-safety.md` rule 3. A language other than English may ship
when all three hold:
- **(a) Label.** Every screen shows a clear label that the translation is AI-generated, may contain
  errors, and that English is the authoritative version. It is shown in the chosen language and in
  English. A language loses the label only when a named human reviewer and a review date are
  recorded in its `_meta` (`reviewedBy`, `reviewedOn`).
- **(b) Disclaimer in English too.** Wherever a disclaimer is shown in a non-English language, its
  English text is shown with it.
- **(c) Checks.** The locale passes the automated checks: same keys and `{placeholders}` as
  `en.json`, every number kept, fixed names unchanged (Language Lab, USCIS, N-400, DHS, uscis.gov,
  A-number), no empty string, nothing left identical to English except an allow-list. The checks run
  as tests and again in the app: a locale that fails them is not offered.

Each locale file has `_meta`: `source` ("ai-draft" or "human-reviewed"), `reviewedBy`, `reviewedOn`,
`note`. All 13 non-English files start as `ai-draft` with no reviewer.

### BS-18 Language picker and scripts
A language menu in the header lists every language by its own name, English first, usable by
keyboard and screen reader, with large touch targets. `lang` and `dir` are set on the document
(`zh` is Traditional Chinese, `zh-Hant`). Thai, Lao, Burmese, Hindi, Chinese and Korean use system
font stacks per script, with no font files to download, and a taller line height where the script
needs it.

### BS-19 Review sheets
`docs/locale-review.md` explains the status of every language and lists the lines whose meaning
changed in a back-translation of the disclaimers and legal wording. One generated sheet per language
(`docs/locale-review/<code>.md`: key, English, translation, disclaimers first) lets a reviewer check
every line. A test keeps the sheets in sync with the locale files. The README says interface
translations are AI-generated unless marked reviewed.

### BS-20 Pictures for civics questions
Some civics questions have a picture (the Constitution, the Statue of Liberty, a portrait, a landmark).
- **Sources and rights.** Only pictures from official U.S. federal sources whose own record states the
  rights clearly (public domain, U.S. government work, CC0, or "no known restrictions on publication").
  A picture with a missing or unclear statement, or a named third-party owner, is not used. Never used:
  agency seals or logos, the USCIS logo, pictures of people now in office, stock photos, non-federal sites.
- **Record.** `data/images/manifest.json` has, for every picture: id, file, title, creator, date, source
  page URL, file URL, the rights statement word for word, download date, SHA-256, alt text and a caption
  taken from the source's own title or description. `docs/image-credits.md` is generated from it and a
  credits screen, linked from the footer, shows it.
- **Files.** WebP copies in `public/images/civics/`, longest side 1200px, under about 150 kB each, under
  15 MB in total. The full-size originals are not committed.
- **Mapping.** `data/images/question-images.json` maps question ids (both test versions) to a picture id.
  One picture can serve several questions; a question without a good picture has none. The file is
  marked `needsHumanReview`; `docs/image-review.md` (generated) lists every pairing for the owner.
  A test fails for a mapped id or picture that does not exist, a manifest entry without a file, or an
  empty rights statement.
- **When a picture is shown.** Never before or during an answer, because a picture can give the answer
  away. Only (a) in the feedback panel after the answer is graded, with the official answers and the
  caption, and (b) in "Study first".
- **If a download fails** or a site blocks it, no other source is substituted. The wanted picture, its
  page URL and the reason go in `docs/image-todo.md`.
- The README says the pictures are public-domain or openly licensed works from U.S. federal sources,
  listed in `docs/image-credits.md`, and that using them does not mean any agency endorses Language Lab.
### BS-21 Study first
A mode on the home screen: the user picks the test version (2008 or 2025) and browses its questions one
at a time with the picture (if any), the question, the audio and the official accepted answers. No
scoring, no answers recorded, no report. Dynamic questions (answers that change with office holders)
show the same notice as elsewhere, not an answer from this app.
## Out of scope
AI follow-up questions and feedback, N-400 scoring, pre-generated audio, the 65/20 exemption,
translated civics content (it stays hidden), saving progress.
