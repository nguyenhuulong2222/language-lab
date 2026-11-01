# Language Lab — Architecture & Decision Log

This file records significant architecture decisions, product constraints, and design choices
made during the development of Language Lab. Most recent entries are at the top.

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
