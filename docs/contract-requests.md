# Contract Requests

Changes to `src/contracts/` and to shared fixtures requested by feature work. Each entry
records what changes, why, and what the UI needs to do in response.

Status is `pending` until the change is merged.

---

## CR-001 — Add `"unscored"` to `CivicsScoringResult.result`

**Requested by:** grading spec
**Status:** implemented in `src/contracts/session.ts` (grading T-01)
**Type:** additive

```typescript
// Before
result: "correct" | "incorrect";
// After
result: "correct" | "incorrect" | "unscored";
```

### Why

Some civics questions have answers that change with elections, appointments, or where the
user lives. The engine cannot score them from a fixed answer key, so it returns
`"unscored"`. An unscored turn is not counted as correct or incorrect and never triggers
early stop. It does use one question slot.

### What the UI needs to do

- Add an `"unscored"` case to any `switch` or exhaustive check on this union.
- Show unscored turns neutrally ("Not scored: this answer depends on current events or where
  you live"). Do not use the amber "review this" status or the "on track" status.
- Do not count unscored turns in "N of M correct". `stageSummaries[].turnsScored` already
  excludes them; `turnsTotal` includes them.

---

## CR-002 — `Turn.questionId` is required at runtime for civics turns

**Requested by:** grading spec
**Status:** doc comment added in `src/contracts/session.ts` (grading T-01); the runtime check
and its test arrive with the civics grader (T-05)
**Type:** behavioural. The type stays `questionId?: string`.

### Why

The grader finds each civics turn's accepted answers by question id. Without it there is no
reliable link to the answer key. The grader throws a clear error for a civics turn without a
`questionId`; this is covered by a test.

### What the UI needs to do

- Set `questionId` on every civics turn to the `id` of the answer key entry that was asked
  (for example `"2008-001"`).
- Leave `questionId` undefined on non-civics turns.

---

## CR-003 — Question selection must exclude dynamic questions

**Requested by:** grading spec
**Status:** pending
**Type:** behavioural note, no type change

Answer key entries have `answerType` of `"static"` or `"dynamic"`. Dynamic questions always
score as `"unscored"`, so they must not be offered as practice questions. The answer key
loader exposes `listStaticEntries()` for this.

---

## CR-004 — Fixtures rebuilt

**Requested by:** grading spec (decision O4)
**Status:** implemented (grading T-01)
**Type:** fixture change, no type change

### `mock/session.json` (rebuilt, passing fixture)

The old fixture reported `practice_passed` with 5 of 6 civics answers correct, but the 2008
rules need 6, and one civics turn was a dynamic question. The rebuilt fixture:

- Uses only static civics questions, each with a `questionId` (`2008-001`, `2008-005`,
  `2008-007`, `2008-011`, `2008-015`, `2008-018`, `2008-019`).
- Has 7 civics turns: 6 correct, 1 incorrect. The stage stops on the 6th correct answer.
- Reading passes on sentence 1. Writing passes on sentence 2, so `attempts` is 2 on the
  second writing turn (attempts means sentences presented).
- Keeps the profile (`Aurora Thistlewood`), filing date (March 15, 2024) and `generatedAt` that the
  UI test reads.
- Review item for civics is now "How many amendments does the Constitution have?".

### `mock/session-needs-practice.json` (new, failing fixture)

Fictional profile `fictional-profile-juniper-hale`. Civics stops on the 5th incorrect answer
(2 correct, 5 incorrect). Reading and writing pass. `practiceResult` is
`needs_more_practice`.

### What the UI needs to do

- `src/ui/__tests__/report-render.test.tsx` asserted the old review text "Review the name of
  the current President of the United States." The grading work changed that one assertion to
  the new review text so the suite stays green. Please check it matches your intent.
- The second fixture can drive the "A few things to review" variant of the report screen.

## CR-005 — UI text now comes from `src/i18n/locales/en.json`
**Requested by:** second review round, part C (display layer)
**Status:** implemented in commit `c9c3445`
**Type:** UI change, no contract type change

Commit `c9c3445` changed `src/ui/App.tsx`, the components `Disclaimer`, `Footer`, `Header` and
`StageStepper`, `src/ui/screens/ReportScreen.tsx` and `src/ui/stages.ts`. They no longer hold
text. They read it from `src/i18n/locales/en.json` through `useT()`. `stages.ts` now stores
message keys (`labelKey`, `shortKey`) instead of labels. English output is unchanged. A test,
`src/ui/__tests__/no-hardcoded-text.test.ts`, now fails on literal user-facing text between
tags and in `aria-label`, `title`, `alt`, `placeholder` and `label` attributes in `src/ui`.

### How to add a string for a new screen
1. Add the key and English text to `src/i18n/locales/en.json` (for example `"civics.title": "Civics practice"`). Use `{name}` for values.
2. In the component, `import { useT } from "../../i18n/react";` and call `const t = useT();`.
3. Render `{t("civics.title")}`, or `{t("stepper.count", { current: 2, total: 6 })}` with values. Use `t(...)` for attributes too (`aria-label={t("...")}`).
4. Keep text that comes from session data (report summaries, the report disclaimer) in the data, not in en.json.
5. Run the tests: the literal-text test and the "every key in en.json is used" test must pass. Other languages need a human-reviewed `src/i18n/locales/<code>.json`; until then they fall back to English.

Translated civics questions are not shown on any screen. See decision D in `docs/decisions-log.md`.

## CR-006 — A report for one practised part
**Requested by:** booth screens, home and section choice
**Status:** pending (not made; `src/contracts/` was not edited)
**Type:** contract change, backward compatible

The home screen lets a user practise one part (N-400, reading, writing or civics) instead of the
full interview. The report of one part has no overall practice result, but `FinalReport.practiceResult`
is required and `buildFinalReport` needs all three graded stages, so a partial report cannot be a
`FinalReport`. `InterviewSession` also requires a fictional profile, a filing date and a test
version, which a reading-only session does not have.

**What was done instead:** a local type `PartReport` in `src/engine/part-report.ts` (a discriminated
union by part: disclaimer, generatedAt, and the counts of that part). The UI shows it with
`PartReportScreen`. Single-part sessions do not build an `InterviewSession`.

**Suggested contract change, if this should become shared:**
- Move `PartReport` into `src/contracts/` and export it from the barrel; or
- make `FinalReport.practiceResult` optional and document that it is absent for a single part.
The first option leaves every existing report consumer unchanged.

**What the UI needs to do:** nothing today. If the type moves, import it from the contracts.
## CR-007 — Report summary lines as message keys (CON-04)
**Requested by:** release/finish, Step 2
**Status:** made (2026-11-20)
**Type:** contract change, backward compatible (new optional field)
The stage summaries of `FinalReport` are English sentences, so a report read in another language
shows English summaries. `StageSummary` gets an optional `summaryLines: SummaryLine[]`, where
`SummaryLine = { key: string; params?: Record<string, string | number> }`: each line names a key of
`src/i18n/locales/en.json` and gives its numbers (and, for unscored civics questions, the English
question texts) as placeholders. `summary` stays and equals the lines rendered in English, so
existing consumers and fixtures are unchanged. The report screen renders the lines through the
locale files; a key it does not know falls back to `summary`.
