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
- Keeps the profile (`Aurora Vance`), filing date (March 15, 2024) and `generatedAt` that the
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
