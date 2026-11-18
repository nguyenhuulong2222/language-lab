# Language Lab — Architecture & Decision Log

This file records significant architecture decisions, product constraints, and design choices
made during the development of Language Lab. Most recent entries are at the top.

---

## 2026-11-01 — T-07 review changes: parenthesis markers and number matching (branch engine/grading)

Not pushed. Both key files still carry `needsHumanReview: true`. `data/test-rules.json` was not touched.

| Commit | What |
|---|---|
| `fbe7fe6` | Per-answer markers for parentheses. 2025 question 48 now accepts "Secretary of War" and "Secretary of Defense". |
| `67e8155` | Number rules in the matcher: digits = words, ordinals, bare number for "number + unit" answers. |

Result: typecheck clean, 436 tests passing (three repeat runs, no flakiness).

### 1. Per-answer marker for parentheses

- The general rule is unchanged: words in parentheses are optional and stored both ways.
- `tools/answer-key/answer-markers.json` lists owner decisions for single parenthetical groups. Each marker names the
  question, the exact source line, the group, `parentheses: "alternative"`, the words it `replaces`, and the decision.
  Items in the group are split on commas and each one replaces the `replaces` words.
- The build fails if a marker matches no source line or matches more than one place. The review sheet marks these
  questions with the new **ALTNAME** flag.
- Effect on the data: exactly one entry changed, `2025-048` (added `secretary of defense`). 127 other 2025 entries and the
  whole 2008 file are byte-for-byte unchanged.
- Consequence to decide on: the two names are two accepted answers, so "Secretary of War and Secretary of Defense"
  (the same office) counts as two answers for question 48.

### 2. Parentheses waiting for the owner's decision (nothing changed)

2025 questions 67, 77, 101, 106, 118 and 2008 question 61. The source text and a proposal for each were given in the
review conversation. A decision is one marker per parenthetical group, or none to keep the optional rule.

### 3. Number rules (matcher only, no data change)

- Digits and words are the same number, for cardinals and ordinals: `13` = thirteen, `27` = twenty-seven,
  `14th` = fourteenth, `22nd` = twenty-second. Both sides are converted to numerals before comparing.
- An accepted answer that is exactly "number + unit" (year, month, week, day) is also matched by the number alone: "six"
  and "6" match `six years`.
- Kept: "one hundred one" and "one hundred and one" do not match `one hundred`; "twenty two" does not match `two`. These
  now fall out of the conversion ("one hundred one" is the number 101) plus the earlier continuation rule for separate
  numbers.
- Tests: unit tests for each rule, 11 new property tests (P13 to P17), each with a number-to-words writer written
  separately inside the test file, and data tests on the real keys.

### Limits of the number rules

- A year read as two numbers does not match: "nineteen twenty" is 19 and 20, not 1920. Answers that contain a four-digit
  year: 2008 questions 63 (`July 4, 1776`), 66 (`1787`), 72 (`War of 1812`); 2025 questions 79 (`July 4, 1776`),
  88 and 91 (`War of 1812`), 98 (`1870`), 102 (`1920`), 104 (`1929`), 107 (`1956`).
- Only "number + unit" gets the bare-number rule. "thirteen" alone does not match `13 original colonies`, "fifty" alone
  does not match `50 states`, and "fourteenth" alone does not match `14th Amendment`.
- "second" is always read as the ordinal 2nd, so the time unit "second" is not distinguished.

---

## 2026-11-01 — Grading T-07: full civics answer keys (branch engine/grading)

Not pushed. Both key files keep `needsHumanReview: true`; `docs/answer-key-review.md` is the sheet for the
person who approves them.

| Step | Commit | What |
|---|---|---|
| Matching rules | `30d6385` | Leading "the", "a", "an" is optional in an accepted answer. A number does not match when the response continues it ("one hundred and one", "twenty two" for `two`). |
| Boundary date | `580b3f6` | `civicsTestVersionSelection.boundaryDate` added to `data/test-rules.json` with the exact uscis.gov sentences and URL. `version-selector.ts` reads it through the rules loader; no date literal is left in the engine. The loader refuses it in production while unverified. 65/20 untouched (diff is +10 lines). |
| Sources | `09eec53` | `data/sources/`: the 2025 PDF and its converted text, the 2008 web page, the older 2008 text (numbering cross-check), and a README with SHA-256 and provenance. |
| 2008 key | `7f2ea5e` | 100 entries. `tools/answer-key/build-answer-key.mjs` plus data tests. |
| 2025 key | `9d19e8a` | 128 entries from the official PDF text. `sourceDocument` names `uscis-2025-civics-128.pdf`. |
| Review sheet | `d79d249` | `docs/answer-key-review.md`, batches of 20, with flags for every interpretation. |

Result: typecheck clean, 389 tests passing (repeated runs, no flakiness).

### Source checks

- The supplied PDF has the same SHA-256 as a fresh download from the official URL.
- `pdftotext -layout` run independently on the PDF matches the supplied `.txt` line for line (596 non-empty lines each).
- 2025: 128 questions, numbered 1 to 128, none missing or repeated. 2008: 100 questions, numbered 1 to 100, none missing or repeated.
- The "117" from the quick check: pdftotext starts each page with a form-feed character, so the 11 questions that
  open a page (9, 28, 39, 48, 53, 69, 80, 86, 93, 108, 117) do not match a plain `^ *N\.` search. 117 + 11 = 128.
- 2008 web page vs the older rev. 01/19 text: only question 87's note placement and Juneteenth on question 100 differ.

### Interpretation and fixes found while building

- **Bug caught by audit.** The first wording rule gave question 63 ("There are four amendments... Describe one of
  them.") `requiredAnswerCount` 4. The rule now reads only the asking sentence ("Name two", "What are three").
  A data test pins the multi-answer questions: 2008 = 9, 36, 51, 55, 64, 100; 2025 = 10, 48, 65, 67, 69, 81, 126.
- **2008 page layout.** Question 87's tribe list and note sit outside the numbered list; question 95's "Also
  acceptable..." note is a separate paragraph after its list. Both were attached to the question they follow, which
  the older text confirms. Flagged LAYOUT.
- **Optional parentheses**, **spelled-out number plus numeral in parentheses**, **slash alternatives** (2025 question 93),
  and the **bracketed "Also acceptable" note** (question 120 / 95) were expanded as described in the sheet.
- **Dropped:** the tribes note (2025 question 117), the 2008 tribe note (question 87), and redundant longer variants for
  multi-answer questions (2025 questions 48, 67, 69, 126).
- Parenthetical lists of alternatives (2025 questions 67, 77, 101, 106, 118; 2008 question 61) are stored only as one
  optional phrase, not as separate alternatives. Example: `serve the nation` and `serve help do important work for the
  nation`, but not `help the nation`.
- **Not added on purpose.** Spoken forms the source does not list: `six` for "Six (6) years", `thirteen` where the source
  says `13`, `fourteenth` for `14th`, `Secretary of Defense` where the 2025 list says "Secretary of War (Defense)"
  (stored: `secretary of war`). The DIGITS and SENTENCE flags mark the questions most affected.
- **Dynamic** (USCIS text says answers will vary or points to the test updates page): 2008 questions 20, 23, 28, 29, 39,
  40, 43, 44, 46, 47; 2025 questions 23, 29, 30, 38, 39, 57, 61, 62. They store no answers.
- **Number rule is symmetric.** The decision named numbers that continue after the answer. The same false match exists
  before it ("twenty two" for `two`), so the rule covers both sides. A response that says both forms in a row
  ("one hundred 100") is rejected by it.

### Decisions still open

- Whether to add spoken variants the source does not list (see "Not added on purpose"). Each would be data the source
  does not contain, so it needs a person's decision.
- Approval of both key files (`needsHumanReview`). Until then the loader throws in production.

### Not done

T-08 (report builder) and T-09 (integration test) are not started.

---

## 2026-11-01 — Grading engine, tasks T-01 to T-06 (branch engine/grading)

Spec: `.kiro/specs/grading/` (requirements, design, tasks), commit `9d47dd1`. All issues O1–O8
from the revision 2 analysis are resolved in the spec. Nothing is pushed.

| Task | Commit | What |
|---|---|---|
| T-01 | `e29f8e6` | `"unscored"` added to `CivicsScoringResult`; `Turn.questionId` documented; `mock/session.json` rebuilt as a passing fixture; `mock/session-needs-practice.json` added; fixture tests cover both |
| T-02 | `b5bcddb` | `answer-normaliser.ts`: normalise, tokenise, containsPhrase, countMatchingPhrases |
| T-03 | `1fe5f9d` | `version-selector.ts`: filing date to 2008 or 2025, boundary 2025-10-20 |
| T-04 | `250d2f5` | `civics-answer-key.ts` loader and stub answer files (11 questions for 2008, 7 for 2025) |
| T-05 | `b48d01d` | `civics-grader.ts`: scoring, `questionId` check, early stop |
| T-06 | `6dfb519` | `english-grader.ts`: reading and writing pass rule |

Result: typecheck clean, 322 tests passing, 8 test files in `src/engine` and `src/contracts`
plus the existing UI and speech-test tests.

### Decisions made while implementing

- **Matching.** Normalisation maps curly apostrophes to straight ones and hyphens to spaces,
  and removes other punctuation. Phrases match as whole-word, contiguous token runs.
  `countMatchingPhrases` finds the largest set of distinct accepted answers that fit
  non-overlapping spans, by exact search. A test compares it with a brute-force oracle.
- **Stage pass rule.** `passed` is true only when the correct-answer threshold was reached and
  `correctCount >= passingScore`. A stage that runs out of turns or hits the question limit
  without a threshold is not passed. Unscored turns use a question slot.
- **Answer key loader.** `parseAnswerKey` validates structure and the uscis.gov https
  `sourceUrl`. While a file has `needsHumanReview: true`, loading it throws in production and
  warns otherwise. The `production` option makes this testable. A test keeps both files marked
  `needsHumanReview: true` until the project owner approves them.
- **English grader.** `attempts` is the number of sentences presented so far. The caller passes
  `isCorrect`; deciding correctness is left to a later spec.
- **Boundary date.** `CIVICS_2025_BOUNDARY_DATE` is a constant in `version-selector.ts`, as the
  approved design said. It is not in `data/test-rules.json`, so it is the one date literal in
  the engine. Moving it into the rules file with a `sourceQuote` is a small follow-up if wanted.
- **UI test.** One assertion in `src/ui/__tests__/report-render.test.tsx` named the old dynamic
  review item and was updated to the new fixture text. Recorded as CR-004 in
  `docs/contract-requests.md`.

### Findings to resolve before T-07

1. **The 2025 PDF cannot be read.** The fetch tool rejects `application/pdf`. The only readable
   official 128-question list is `M_1778TXT.txt` on uscis.gov, titled "128 Civics Questions and
   Answers (2020 version)". USCIS says the 2025 test is based on the 2020 test, but I could not
   confirm the lists match. The 2025 stub entries use that file as a stand-in; each
   `sourceDocument` says so. Options: you paste or convert the 2025 PDF to text, or you accept
   the 2020 text as the base and a person diffs it against the PDF.
2. **Optional words.** The data rule stores parenthesised words as both variants, but USCIS
   lists "the Constitution" with no parentheses, so a response of just "Constitution" scores
   incorrect. A rule is needed for articles such as "the".
3. **Text encoding.** `M_1778TXT.txt` shows curly quotes and apostrophes as "�". Normalisation
   handles real curly apostrophes, but every transcribed answer needs a human check.
4. **Longer answers.** Because containment is allowed, "one hundred and one" contains "one
   hundred" and scores correct. This follows from the approved whole-phrase rule and is a known
   limit.
5. **65/20 passing score (not acted on).** A uscis.gov search snippet of the 2025 PDF reads "at
   least 6 out of 10 questions (or 60%)", and the 2020 text gives the same rule in its 65/20
   paragraph. That may settle the 65/20 `passingScore`, but I could not read the PDF context,
   so `data/test-rules.json` is unchanged.

### Not done

T-07 (full answer keys), T-08 (report builder) and T-09 (integration test) are not started.

## 2024-11-01 — Kiro hooks, custom agents, design file attribution, data verification

### Part A: Kiro setup

**Hooks created** (`.kiro/hooks/`):

| File | Trigger | Matcher | Action |
|---|---|---|---|
| `test-on-engine-contracts-save.json` | PostFileSave | `src/(engine\|contracts)/` | `npm test` |
| `typecheck-on-ts-save.json` | PostFileSave | `\.(ts\|tsx)$` | `npm run typecheck` |
| `block-sensitive-paths.json` | PreToolUse | file/edit tools | blocks access to `.env`, `.dev.vars`, `language-lab-private/` |

The sensitive-path PreToolUse hook inspects all string parameters in the tool call and exits
2 (block) if any parameter contains `.env`, `.dev.vars`, or `language-lab-private`. This
prevents accidental reads or edits of local secrets in any tool that touches files.

**Custom agents created** (`.kiro/agents/`):

`content-reviewer.md` — Read-only. Verifies civics and legal content against uscis.gov.
Reports UNVERIFIED for any claim not confirmable on uscis.gov. Checks all six rules from
content-safety.md. Cannot edit files. Cannot decide civics answers from its own knowledge.

`ui-reviewer.md` — Read-only. Checks mobile layout, text size, contrast, and accessibility
against `design-system.md`. Reports passes, issues (with file + line), and optional
suggestions. Cannot edit files or add design tokens.

Both agents reference the relevant steering files in their `resources:` front-matter.

**`frontend-design.md` attribution** — Replaced the `license: Complete terms in LICENSE.txt`
front-matter field (which pointed to a non-existent file) with a proper HTML comment block
at the top of the content section, citing the Anthropic Skills GitHub source URL and
confirming MIT license. The `license:` key was removed from front-matter to avoid a
dangling reference.

### Part B: test-rules.json verification — approved and applied

Verified live against uscis.gov on 2024-11-01. Changes applied after approval.

**2008 earlyStopOnCorrect / earlyStopOnIncorrect** — set `needsVerification: false`.
Source: "Officers will stop asking questions when an alien answers 6 questions correctly
or 5 questions incorrectly." — https://www.uscis.gov/citizenship/find-study-materials-and-resources/study-for-the-test

**English test rules added** (`englishTest.reading` / `englishTest.writing`):
- Reading: "For the reading test, you must read out loud 1 of 3 sentences correctly
  to demonstrate an ability to read in English."
- Writing: "For the writing test, you must write 1 out of 3 sentences correctly
  to demonstrate an ability to write in English."
- Source: same Study for the Test page.

**65/20 special consideration added** with mixed verification status:
- Confirmed from uscis.gov: eligibilityAgeMinimum (65), eligibilityResidencyYearsMinimum
  (20), questionBank (20), questionsAsked (10), languageChoicePermitted (true).
- Not confirmed (value: null, needsVerification: true): passingScore, earlyStopOnCorrect,
  earlyStopOnIncorrect — the Study page does not restate these for the 65/20 track.

**Rules loader created** (`src/engine/test-rules-loader.ts`):
- `loadTestRules()` validates required fields; throws in production if any required
  field has `needsVerification: true`; warns in development.
- `loadCivicsRules(version)` and `loadEnglishRules()` are convenience exports.
- `findUnverifiedRequiredFields()` is exported for testing.
- 65/20 unverified fields are intentionally excluded from the required list so their
  null values don't block loading.

**Tests added** (`src/engine/__tests__/test-rules-loader.test.ts`): 36 tests across
5 suites. All assertions read from the JSON file via the loader — no hard-coded expected
values except to confirm the loader's own logic.

**Result:** 107/107 tests passing. Typecheck clean.

---

---

## 2024-11-01 — Speech Test: pre-generated MP3 audio via gpt-4o-mini-tts

**Scope:** `tools/speech-test/` only. No changes to `src/`.

**What was added:**

`tools/speech-test/generate-audio.mjs` — local one-time Node script:
- Reads `OPENAI_API_KEY` from `tools/speech-test/.env` (gitignored, never in browser code).
- Calls the OpenAI TTS API (`gpt-4o-mini-tts`, voice `coral`).
- Instruction: `"Speak clear American English slowly and naturally, like a patient interviewer."`
- Generates `{id}-question.mp3` and `{id}-answer.mp3` for all 20 items (40 files total).
- Saves to `tools/speech-test/audio/` (gitignored).
- Skips files that already exist; 500 ms delay between requests to respect rate limits.
- Exits with code 1 if any file fails (safe to re-run).
- Practice items are inlined in the script (no TypeScript import) with a sync note pointing
  to `sentences.ts`.

`main.ts` changes:
- `speak()` replaced by `playAudio(itemId, slot, text, onEnd)`.
- `playMp3(url)` tries `new Audio(url).play()` — rejects on load error (404, etc.).
- On rejection, falls back to `speakSynthesis(text)` (same SpeechSynthesis logic as before).
- `state.lastAudioSource` tracks `"mp3" | "synthesis" | null`.
- `renderMain()` updates `#audio-source-notice`:
  - MP3 path: `"Giọng đọc do AI tạo / AI-generated voice"` (green).
  - Fallback path: `"⚠ MP3 file not found — using browser voice as fallback"` (amber).
  - Hidden when no audio has played yet on this item.
- `stopCurrentAudio()` cancels both the `<audio>` element and SpeechSynthesis.
- Recognition guard (`state.isSpeaking`) unchanged — blocks mic while audio plays.

`.gitignore` additions:
- `tools/**/.env` — catches any local tool `.env` file.
- `tools/speech-test/audio/` — generated MP3s are not committed.

**Decision: inline items in generate-audio.mjs**
The script is a plain `.mjs` file with no build step. Importing TypeScript at runtime would
require `ts-node` or `tsx`. Inlining the 20 items avoids that dependency. A comment in the
script notes it must stay in sync with `sentences.ts`.

**Decision: `new Audio()` for MP3 playback (not fetch + AudioContext)**
`HTMLAudioElement` is the simplest cross-browser path. It respects autoplay policies the
same way `SpeechSynthesis` does — both require a user gesture — so no new gesture
requirement is introduced. The element is created per-play and discarded after use.

**Decision: fallback notice uses amber, not an error color**
The fallback is functional, not broken. Amber communicates "degraded but working" without
alarming the tester. The MP3 path uses green to confirm the AI voice is active.

**To generate audio files:**
```
node tools/speech-test/generate-audio.mjs
```
(see detailed instructions below)

**Test results:** 71/71 passing (unchanged). `npm run typecheck` clean. `npm run build` clean.

---

## 2024-11-01 — Speech Test: Q&A format, TTS, bilingual UI, practice/check modes

**Scope:** `tools/speech-test/` only. No changes to `src/`.

**What changed:**

`sentences.ts` — `PracticeSentence` replaced by `PracticeItem` with `questionText` and
`expectedAnswer`. 20 items across civics, n400, and reading categories.

`main.ts` — Full rewrite:
- Mode selector (practice / check) before starting.
- Per-item flow: show question → hear question (TTS) → show/hear model answer (TTS, practice
  mode) or hidden answer (check mode) → speak → result.
- `SpeechSynthesis` with `lang: "en-US"`, `rate: 0.8`. TTS starts only after user tap
  (required on iOS). Recognition is blocked while TTS is playing.
- Vietnamese UI labels: "Nghe câu hỏi", "Nghe câu mẫu", "Bắt đầu nói", "Nói lại",
  "Bỏ qua", "Nghe lại". Labels are fixed strings, not machine-translated.
- `ItemResult` tracks `questionHeard`, `sampleHeard`, `retryCount`.
- `buildExportPayload` extracted as a pure exported function for testability.
- Export JSON includes top-level `mode` and per-item `mode`, `questionHeard`,
  `sampleHeard`, `retryCount`.
- Accuracy is scored only against `expectedAnswer`, never `questionText`.
- `document.addEventListener` guarded with `typeof document !== "undefined"` so
  `main.ts` can be imported in Vitest (Node environment) without errors.

`index.html` — Rebuilt with mode-select screen, question card, sample-answer section,
full-width speak button, bilingual labels throughout.

`accuracy.test.ts` — Extended from 32 to 51 tests:
- All original accuracy tests kept unchanged.
- New: `PRACTICE_ITEMS` data shape (20 items, unique IDs, non-empty fields, valid categories,
  accuracy sourced from `expectedAnswer`).
- New: `buildExportPayload` shape (mode, questionHeard, sampleHeard, retryCount, overall,
  skipped items, _note content).

**Decision: Vietnamese labels are fixed strings**
Per steering rules, no machine translation of any content in this project. The Vietnamese
labels ("Nghe câu hỏi" etc.) are written as fixed UI strings, not generated. They must not
be changed by automated translation.

**Decision: block recognition while TTS is playing**
iOS Safari aborts recognition if audio plays concurrently. The `isSpeaking` guard
prevents `startRecognition()` from firing until TTS ends, making the flow reliable on iPhone.

**Decision: `buildExportPayload` as a pure exported function**
The function takes `results` and `mode` as arguments and returns a plain object — no DOM,
no side effects. This makes it directly importable and testable in Vitest without mocking.

**Test results:** 71/71 passing. `npm run typecheck` clean. `npm run build` clean.

---

## 2024-11-01 — Speech Recognition Test Tool (engine/speech-test branch)

**What was added:** `tools/speech-test/` — a standalone, mobile-friendly Vite page
for testing the browser Web Speech API with 20 fictional English practice sentences.

**Files created:**

| File | Purpose |
|---|---|
| `tools/speech-test/accuracy.ts` | Pure word-accuracy functions: `normalise`, `tokenise`, `wordAccuracy`, `overallAccuracy` |
| `tools/speech-test/sentences.ts` | 20 fictional practice sentences (civics, N-400 biographical, reading) |
| `tools/speech-test/main.ts` | Vanilla TS app: Web Speech API, state machine, DOM rendering, JSON export |
| `tools/speech-test/index.html` | Self-contained HTML/CSS — mobile-first, no external assets |
| `tools/speech-test/accuracy.test.ts` | 32 tests (unit + 4 property-based via fast-check) |
| `vite.speech-test.config.ts` | Dedicated Vite config: serves on port 5174, binds `0.0.0.0` for phone testing |

**Content safety compliance:**
- All 20 sentences are fictional, generic, not personal-detail suggestions.
- Pre-flight screen warns about cloud audio transmission before any recording starts.
- Explicit instruction: do not say real names, addresses, or immigration details.
- Results export is device-local only (Blob → download, no server call).
- Disclaimer on every screen.

**Decision: vanilla TypeScript, no React**
The tool is a dev utility, not a product surface. React adds ~60 kB and a compile step
for what is essentially a five-screen state machine. Plain DOM manipulation is fine here
and keeps the tool truly standalone.

**Decision: `host: "0.0.0.0"` in speech-test Vite config**
Mobile testing requires serving on the LAN. The main `vite.config.ts` stays on localhost
(safer default). The speech-test config explicitly opts in to LAN binding.

**Decision: `@types/dom-speech-recognition`**
The Web Speech API (`SpeechRecognition`, `SpeechRecognitionEvent`, `SpeechRecognitionErrorEvent`)
is not in the standard TypeScript DOM lib. This community package provides the missing types.
Added to `tsconfig.app.json` types array; worker tsconfig is unaffected.

**Decision: tools/ in tsconfig.app.json (not tsconfig.node.json)**
`tools/speech-test/main.ts` uses `window`, `document`, and DOM event types.
It belongs in the DOM-aware tsconfig. Pure files (accuracy.ts, sentences.ts) happen to
be included there too, which is harmless — they don't reference any DOM globals.

**Test results:** 52/52 passing (12 contract tests + 32 accuracy tests).
`npm run typecheck` clean. `npm run build` clean.

**To run on a phone:** `npm run speech-test` → open `http://192.168.84.30:5174/tools/speech-test/index.html`

---

## 2024-11-01 — Tooling Initialization

**Packages added:**

| Package | Version | Role |
|---|---|---|
| vite | 6.4.5 | Frontend build and dev server |
| @vitejs/plugin-react | 4.5.2 | React JSX transform for Vite |
| react / react-dom | 19.1.0 | UI framework |
| @types/react / @types/react-dom | 19.1.6 | React TypeScript types |
| typescript | 5.8.3 | Type checker |
| vitest | 4.1.12 | Test runner (Vitest 4, not 3, to clear CVEs in tinypool) |
| @fast-check/vitest | 0.5.0 | fast-check integration for Vitest |
| fast-check | 3.23.2 | Property-based testing |
| @cloudflare/workers-types | 5.20261101.1 | TypeScript types for Worker globals |

**Decision: Vitest 4.1.12 instead of 3.x**
Vitest 3.2.7 had unpatched CVEs in `tinypool` (GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr,
critical) and `@vitest/mocker`. The fix required Vitest 4.x. Vitest 4 was released October
2025 and is stable. Breaking changes (pool config, Browser Mode API) don't affect this
project at this stage.

**Decision: `vitest/config` for `defineConfig` in `vite.config.ts`**
Importing `defineConfig` from `vitest/config` rather than `vite` is the idiomatic approach
for Vitest 4, giving TypeScript full knowledge of the `test` property without needing a
triple-slash reference directive.

**Decision: `@cloudflare/workers-types` in `tsconfig.node.json`**
The Worker source uses `Request`, `Response`, `URL`, and `ExportedHandler` which are
Cloudflare-specific globals. Adding workers-types to the node tsconfig scope keeps the app
tsconfig clean (browser globals only) and the worker tsconfig correct.

**tsconfig split: `tsconfig.app.json` + `tsconfig.node.json`**
Standard Vite pattern. App tsconfig covers `src/` with DOM libs and `react-jsx`.
Node tsconfig covers `vite.config.ts` and `worker/` with Workers types.

**Test coverage added:**
`src/contracts/__tests__/session-mock.test.ts` — 12 tests across 2 suites:
- 11 runtime checks of mock/session.json against contract rules
- 1 property-based test using fast-check via `@fast-check/vitest`

All checks pass: `npm test` → 12/12, `npm run typecheck` → clean, `npm run build` → clean.

---

## 2024-11-01 — Initial Project Setup

**Decision: Vite + React + TypeScript**
Standard choice for a modern, fast-iterating frontend. Vite's native ESM aligns well with
Vitest, avoiding config friction. TypeScript strict mode from the start to keep the contracts
layer honest.

**Decision: Cloudflare Pages + Worker**
Free tier covers the project's hosting needs. Edge Workers provide a natural place for any
server-side logic (answer checking, session persistence) without managing infrastructure.
Wrangler integrates cleanly with Pages.

**Decision: Vitest + fast-check**
Vitest is Vite-native and fast. fast-check enables property-based testing for scoring logic,
which is important for a correctness-sensitive feature (civics answer matching). Scoring must
be deterministic; property tests help verify that.

**Decision: No A-numbers or fake government IDs in mock data**
Even clearly fictional government ID numbers can cause confusion or be mistaken for real
identifiers. All mock data uses only a `fictionalProfileId` string with no numeric ID format
resembling official documents.

**Decision: `practiceResult` values are `"practice_passed"` / `"needs_more_practice"`**
Using `"pass"` / `"fail"` risks making users feel the tool is assessing them officially.
The chosen values make the practice-only nature of the result legible at a glance.

**Decision: `isFictional: true` as a literal type**
Making `isFictional` a literal `true` (not `boolean`) in TypeScript means it is structurally
impossible to instantiate an `InterviewSession` marked as non-fictional. This is a type-level
enforcement of a product safety rule.

**Decision: `disclaimer` is a required field on `FinalReport`**
The disclaimer is not optional copy — it must exist on every report object. Making it
a required field means any code path that generates a report is forced to provide it.
This cannot be forgotten at the type level.

**Decision: Civics scoring is deterministic — AI may not produce civics scores**
Recorded in `content-safety.md` and enforced in type design: civics `ScoringResult` has
`scoringSource: "answer_key"` as a required literal. AI-assisted feedback is constrained
to the N-400 interview stage only, using the `N400Feedback` type.

**Decision: `localRecordingId` is device-local only**
Audio recordings are never transmitted to or stored on any server. The `localRecordingId`
field references a device-local file only. No raw audio appears in session types.

**Decision: `earlyStopOnCorrect` / `earlyStopOnIncorrect` for 2008 test marked `needsVerification: true`**
The early-stop rule for the 2008 test appears on uscis.gov's study pages but not on the
primary civics Q&A page. It may reflect implementation guidance rather than policy. These
values should be verified against the USCIS Policy Manual (Volume 12) before being used in
scoring logic. The 2025 values are confirmed directly on the 2025 test page.

**Source for test rules:**
- 2008: https://www.uscis.gov/civics-questions-and-answers-2008-version
- 2025: https://www.uscis.gov/citizenship-resource-center/naturalization-test-and-study-resources/2025-civics-test
- Which test version applies by filing date: https://www.uscis.gov/citizenship/learn-about-citizenship/the-naturalization-interview-and-test
