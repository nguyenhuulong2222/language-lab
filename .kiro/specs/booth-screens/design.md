# Booth screens — Design

## Layers
```
data/practice/*.json           profiles, N-400 script, sentences, vocabulary, practice config
src/engine/                    pure logic, unit and property tests
  practice-config.ts           loads the practice thresholds
  sentence-compare.ts          word-level comparison of a transcript with a sentence
  practice-content.ts          loads and validates the practice data
  n400-coach.ts                N400Coach interface + scripted implementation
  recognition-outcome.ts       maps speech recognition results and errors to outcomes
  practice-flow.ts             state reducer: setup, turns, stage results, session, report
src/ui/                        React only
  voice/                       SpeechListener (browser adapter), PromptSpeaker (device voice)
  components/                  Shell, TakeHeader, AnswerInput, SpeakButton, SentenceDiff
  screens/                     IntroScreen, N400Screen, ReadingScreen, WritingScreen, CivicsScreen,
                               ReportScreen (existing)
  PracticeApp.tsx              holds the reducer in memory and shows the active screen
```
`App.tsx` stays as the report-only shell used by the existing render test.

## State
`practice-flow.ts` exports `practiceReducer(state, action)`, where state holds the setup (profile,
filing choice, derived filing date and version), the selected question and sentence ids, and the
recorded attempts. Everything else is derived by calling the engine:
- Reading and writing results: `runEnglishStage` over the attempts.
- Civics result: `runCivicsStage` over the civics turns, with the real answer key.
- Session: `buildSession(state)` returns an `InterviewSession` with turns and scoring results.
- Report: `buildFinalReport` once the civics stage has ended.
A stage is finished when the engine says it passed or stopped, or the question limit is reached.
The reducer takes a `seed` so selection is deterministic in tests.

## Filing date
The user picks "before" or "on or after" the boundary date. `representativeFilingDate` returns the
day before the boundary, or the boundary itself. `selectTestVersion` then picks the test, so the
engine, not the screen, decides 2008 or 2025.

## Spoken prompts
`createMp3PromptSpeaker` looks the prompt up in the manifest (id and hash of the text), plays the
file through one reused audio element started synchronously in the click handler, and falls back
to `createDeviceVoiceSpeaker` when there is no clip or it fails. `src/engine/audio-clips.ts` holds
the clip list, ids, hash and manifest checks shared with the generator and the tests.

## Voice
`SpeechListener.listen()` resolves to one of: `transcript`, `denied`, `unsupported`, `nothing-heard`,
`no-microphone`, `error`. The pure mapping from browser error codes is in `recognition-outcome.ts`.
`AnswerInput` always shows a text field and a "Say it" button. The result is announced in an
`aria-live` region. Browsers such as Chrome may send audio to the browser maker's recognition
service; the intro says so. The app itself makes no network call and stores no audio.

## Sentence comparison
Tokens come from the engine's own matcher tokeniser (case, punctuation and number words ignored).
Accuracy is the longest common subsequence of words divided by the longer of the two sentences.
`isCorrect` is `accuracy >= minWordAccuracy` from the practice config. The diff shows matched,
missing and extra words with a text label as well as colour.

## Production lock
`tryLoadAnswerKey(version)` returns the key, or a `locked` result when the loader refuses it. The
civics screen shows the locked explanation and no report is built.

## Contract
No change to `src/contracts/`. The N-400 turns use the existing `Turn` type and are not scored.
The report builder has no field for N-400 or for unscored questions beyond the summary text; that
is unchanged (see CR-005 and the T-08 notes).

## Visual
Each screen opens with a tape-counter overline (`TAKE 03 · READING`) above the H1, as in the report.
Teal marks on-track, amber marks "review this". One reel motif only (the stepper). No new motion.

## Sections (BS-14)
`PracticeState` gets a `mode` (`full`, `n400`, `reading`, `writing`, `civics`) and the phase `home`.
`sessionSteps(mode)` lists the steps of a session (for the stepper and the take counter). The setup
fields (profile, filing choice, filing date, version) are null until the mode needs them. A single
part ends with a `PartReport` (`src/engine/part-report.ts`): the disclaimer, one stage summary,
review items and a timestamp, and no practice result. The full interview still uses `buildFinalReport`.

## Instructions (BS-15)
`HowItWorks` (home) and `ScreenHelp` (each practice screen). `ScreenHelp` keeps its open state
locally and records in a session-memory set which screens were already shown.

## Comfort settings (BS-16)
`SettingsProvider` (React state, no storage) holds text size, slow playback and language. Text size
sets a data attribute on the page root that changes the root font size, so every `rem` size follows.
The tap target token is `3rem` (48px). `PromptSpeaker.speak` takes `slow`, applied as `playbackRate`
on the clip (and as a lower rate for the device voice). `SpeakButton` adds "Play again".

## Languages (BS-17, BS-18)
`src/i18n/locales/<code>.json` for each of the 14 languages; `en.json` is the source. A locale's
`_meta` is split off into `LOCALE_STATUS`. `src/i18n/locale-checks.ts` holds the pure checks (keys,
placeholders, numbers, fixed names, empty, identical to English). The tests run them on every locale,
and `availableUiLanguages()` runs them again at runtime, so a locale that fails is never offered. There
is no production-only gate and no build plugin: a language is offered when it passes.

The AI label is a banner in `Shell` (every screen) shown when the language is not English and the
locale has no recorded reviewer (`isLocaleReviewed`). It says the same thing in the chosen language
and in English. `Disclaimer` takes a message key and, in a non-English language, shows the English
text under the translation.

The header has one language button (globe icon and the current language's own name) that opens a
panel with a list of buttons (not radios: arrow keys would switch the language) for all languages by their own names, English first. Choosing one switches
the interface, closes the panel and returns focus to the button. `LanguageInfo` carries `htmlLang`
and `dir`; `AppProviders` sets them on `<html>`. Per-script font stacks and line heights are CSS
rules on `[lang]` in `src/ui/styles/scripts.css`. Dates use `Intl` with the Gregorian calendar and Latin digits, and
fall back to English month names only where the browser has no data for the language.

Review sheets: `src/i18n/review/build-sheets.ts` builds one sheet per language and the index (`tools/i18n/build-locale-review.mjs` writes them); back-translations
of the legal lines are data in `src/i18n/review/back-translations.json`.
## Pictures (BS-20, BS-21)
`tools/images/find-loc.mjs` searches loc.gov and keeps only items whose own record has an accepted
rights statement. `tools/images/build-images.mjs` reads `data/images/picks.json` (picture id, loc.gov
item id, chosen file, alt text), downloads the file, writes the WebP copy and the manifest entry (rights
text copied word for word from the item record, SHA-256 of the original download) and generates
`docs/image-credits.md` and `docs/image-review.md`. The originals go to a temp folder, not the repo.
`src/engine/question-images.ts` loads the manifest and the mapping and has the checks (pure, tested).
UI: `QuestionPicture` (figure with alt text and caption) is rendered only by the feedback panel
(`result` state) and by `StudyScreen`; the question view has no import of it, and a test renders the
question view and fails if an `<img>` or a picture id appears. `StudyScreen` is a new practice mode
that goes through `sessionSteps` with no scoring. `CreditsScreen` is reached from a footer button.
## Scoring, alternatives and listen-and-compare (BS-22 to BS-25)
**Comparison** (`src/engine/sentence-compare.ts`). Tokens come from the existing matcher tokeniser. Two tokens
match when they are equal, when `sameInflection` says they differ only by a plural or possessive ending (one
word is the other plus s, es, or ies for y; nothing is ever shortened, words of 2 letters or fewer and the
config's `neverStem` words only match themselves), or, writing only, when they differ by one letter (see BS-22). The words are aligned in order (longest common subsequence). The result lists missing
and extra words, split into content words and short words, plus the near misses (a different spelling of
the same word) for the feedback lines. `isCorrect` is: no content word of the sentence missing, and at most
`extraContentWordsAllowed` extra content words. `accuracy` stays as the share of content words matched, for
records only; no percentage is shown. The config (`practice-config.json`) holds `functionWords`,
`extraContentWordsAllowed` and `spellingTolerance` per portion; the code holds no threshold.
**Alternatives.** `VoiceOutcome` carries `alternatives` (every alternative of every result; with several
results, the top alternative of each is joined and each other alternative is substituted in turn).
`bestAlternative()` scores them all and picks, in order: counts, then more content words matched, then fewer
extra words, then the recogniser's own order. The reducer receives `transcript` and `alternatives`.
**What each browser returns.** Not measured on devices (none available here). What is known:
- *iPhone Safari (iOS 14.5+, WebKit)*: the WebKit source (`WebSpeechRecognizerTask.mm`) fills
  `alternatives` from the `transcriptions` of Apple's `SFSpeechRecognitionResult`, up to `maxAlternatives`,
  with the text as `formattedString` (may have capital letters and punctuation) and a confidence that is
  the best segment confidence. Apple often returns fewer than 5. How many it returns for a short sentence:
  **needs a device test**.
- *Android Chrome and desktop Chrome*: Chrome's `webkitSpeechRecognition` returns up to `maxAlternatives`
  alternatives with a confidence for the first; whether it returns more than one for a short phrase:
  **needs a device test**. Speech is recognised by a Google service (the intro screen says so).
- Headless Chrome (used by the layout check) has no speech service, so nothing could be measured here.
The scoring does not depend on the count: with one alternative it behaves as before.
**Listen and compare.** `src/ui/voice/self-review.ts` holds a recorder (`createSelfReviewRecorder`) around
`getUserMedia` and `MediaRecorder`: `start()`, `stop()` (returns an object URL of the in-memory Blob),
`discard()` (revokes the URL, stops the tracks, drops the chunks). The component `SelfReview` is rendered
with `key={sentence.id}`, so a new sentence mounts a new one and the old one is discarded on unmount. The
module imports no network API; a test fails if it ever mentions `fetch`, `XMLHttpRequest`, `sendBeacon`,
`WebSocket` or `FormData`. "Hear your recording" plays the URL through an `<audio>` element created on
the click. "Hear the sample" plays the pre-generated clip (group `reading`, same player as the writing
clips, falling back to the device voice) and is rendered only after a first attempt (a graded check or a
finished recording). Recognition (`SpeechRecognition`) and recording are separate controls, never run
together.
**Feedback.** `SentenceFeedback` shows: the result line (counts / not yet), what we heard (best
alternative), a plain line per near miss or missing word, the honest line, and the practice-setting note.
**Later changes while building.** `retryEnglish` (reducer action) removes the last attempt of the part, so "Try
again" asks the same sentence again. Civics: `submitCivics` takes the same `alternatives` and picks the one
with the most accepted answers by `matchedAnswerCount` (answer key only). The listen-and-compare state machine
is `self-review-controller.ts` (phases idle, starting, recording, recorded; Stop while starting cancels a
pending microphone request); `use-self-review.ts` is the React wrapper. "Say it" and "Record and compare"
stop each other. English words inside translated feedback lines are marked `lang="en"` (`with-english.tsx`).
