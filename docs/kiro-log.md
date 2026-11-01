# Language Lab — Architecture & Decision Log

This file records significant architecture decisions, product constraints, and design choices
made during the development of Language Lab. Most recent entries are at the top.

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
