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

## Languages (BS-17)
`src/i18n/locales/en.json` is the source. `vi.json` is a draft with the same keys and placeholders.
`createTranslator` falls back to English for any missing key. `LOCALE_REVIEW` metadata marks which
locales still need human review; `availableLanguages(production)` hides them in production.
