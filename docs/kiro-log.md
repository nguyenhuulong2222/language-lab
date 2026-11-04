# Language Lab — Architecture & Decision Log

This file records significant architecture decisions, product constraints, and design choices
made during the development of Language Lab. Most recent entries are at the top.

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
