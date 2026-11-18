# Grading — Requirements

Status: revision 3. All issues O1–O8 from the revision 2 analysis are resolved (see the
resolved-issues table at the end).

## Context confirmed from existing code and data

- `src/contracts/session.ts`: `InterviewSession` has `filingDate` (YYYY-MM-DD), `testVersion`
  (`"2008" | "2025"`), `turns`, `scoringResults`, `finalReport`. `FinalReport` has
  `practiceResult` (`"practice_passed" | "needs_more_practice"`), `disclaimer`,
  `stageSummaries`, `overallReviewItems`, `generatedAt`.
- `data/test-rules.json` via `src/engine/test-rules-loader.ts`: civics (2008: 10 asked, pass
  6, stop at 6 correct or 5 incorrect; 2025: 20 asked, pass 12, stop at 12 correct or 9
  incorrect) and English (reading and writing: 1 of 3 sentences).
- Filing before 2025-10-20 uses the 2008 test; on or after uses the 2025 test (uscis.gov,
  Study for the Test).
- 65/20 special consideration is out of scope.

## Requirements

### REQ-01 — Test version selection from filing date

The engine MUST select `"2008"` when `filingDate < "2025-10-20"` and `"2025"` when
`filingDate >= "2025-10-20"`, by comparing YYYY-MM-DD strings. No time zones, no time of day.
Malformed or impossible dates (for example `2025-02-30`) MUST throw. If the result differs
from `InterviewSession.testVersion`, the engine MUST throw.

### REQ-02 — Civics scoring comes from the answer key only

For each civics turn the engine MUST:

1. Throw a descriptive error if `turn.stage` is not `"civics"`.
2. Throw a descriptive error if `turn.questionId` is missing or blank (resolves O1; the type
   keeps `questionId?: string`, the grader enforces it at runtime).
3. Return `"unscored"` if the id is not in the answer key.
4. Return `"unscored"` if the entry's `answerType` is `"dynamic"`, without reading
   `acceptedAnswers`.
5. Otherwise count distinct accepted-answer phrases in the response (REQ-03, REQ-04). The
   result is `"correct"` when the count is at least `requiredAnswerCount`, else `"incorrect"`.

`scoringSource` is always `"answer_key"`. AI never decides or changes a civics score.

### REQ-03 — Normalisation and whole-word phrase matching

Normalisation (resolves O3) MUST: lowercase; map curly apostrophes to `'`; treat hyphens and
dashes as spaces; remove all other characters except letters, digits, spaces and apostrophes;
trim apostrophes from the ends of words; collapse whitespace.

A phrase matches only as a contiguous, ordered run of whole tokens. "constitution" does not
match inside "constitutional". "I think it is the Constitution" matches "the constitution".

Answer data rules (REQ-11): numeral variants ("27", "twenty seven") are listed explicitly in
`acceptedAnswers`; optional words in USCIS text ("(Thomas) Jefferson") are stored as both
variants ("thomas jefferson", "jefferson").

### REQ-04 — `requiredAnswerCount` counts non-overlapping spans

The engine MUST count each distinct accepted answer at most once, and MUST count only
non-overlapping token spans (resolves O2). Each token of the response can support at most
one accepted answer. With accepted answers `["speech", "freedom of speech"]` and the response
"freedom of speech", the count is 1.

### REQ-05 — Early stop exactly as in test-rules.json

Thresholds come from `loadCivicsRules(version)`. Turns are processed in order:

- At most `questionsAsked` turns are considered; later turns are ignored (resolves O5).
- An unscored turn uses one question slot and changes neither counter.
- The stage stops on the turn where correct answers reach `earlyStopOnCorrect` (passed) or
  incorrect answers reach `earlyStopOnIncorrect` (failed). It never stops earlier and never
  continues after.
- If the question limit or the turns run out with neither threshold reached, the stage is
  not passed (`needs_more_practice`).
- A stage is `passed` only when the correct threshold was reached and `correctCount` is at
  least `passingScore`.

### REQ-06 — Reading and writing

The caller supplies `isCorrect` for each reading and writing turn (resolves O6). How
correctness is decided belongs to a later spec. The engine:

- Considers at most `sentencesPresented` turns.
- Sets each turn's `attempts` to the number of sentences presented so far (1, 2, 3).
- Stops and passes as soon as correct answers reach `sentencesToPassCount`.
- Throws if a turn's stage does not match the stage being graded.

Thresholds come from `loadEnglishRules()`.

### REQ-07 — FinalReport

The engine MUST produce a `FinalReport` per `src/contracts/session.ts`.

- `practiceResult` is `"practice_passed"` only when civics, reading and writing all pass;
  otherwise `"needs_more_practice"`. Never `"pass"` or `"fail"`.
- `disclaimer` is `PRACTICE_DISCLAIMER`: non-empty, practice only, not a government service,
  not legal advice.
- One `stageSummaries` entry per graded stage. Unscored turns count in `turnsTotal` but not
  in `turnsScored`. Summaries are built from counts, never by AI.
- `reviewItems` for civics lists the `questionText` of incorrect answers.
- `generatedAt` is a valid ISO 8601 timestamp.

### REQ-08 — No hard-coded thresholds

Passing scores, questions asked, early-stop values and sentence counts MUST come from the
rules loader. The only literal in engine code is the filing-date boundary constant.

### REQ-09 — 65/20 is out of scope

### REQ-10 — Pure engine modules

No DOM, no React, no network, no side effects.

### REQ-11 — Answer key data integrity

Files: `data/civics-answers/2008.json` and `2025.json`. Each entry has `id`
(`"{version}-{NNN}"`), `testVersion`, `questionText`, `acceptedAnswers`,
`requiredAnswerCount`, `answerType` (`"static" | "dynamic"`), `sourceUrl`, `sourceDocument`.

- `testVersion` matches the file; ids are unique; `sourceUrl` is an https uscis.gov URL;
  `sourceDocument` is non-empty.
- Static entries: non-empty `acceptedAnswers`, all already normalised, and
  `requiredAnswerCount` between 1 and the number of accepted answers.
- Dynamic entries: `acceptedAnswers` is empty. No officeholder names or state-specific
  answers are stored anywhere.
- A question is `dynamic` when the USCIS text says answers will vary or refers to the
  test-updates page (resolves O8).
- Data test (resolves O2): for any question with `requiredAnswerCount` above 1, no accepted
  answer may be contained in another accepted answer of the same question.
- Files carry `needsHumanReview: true` until the project owner approves them. The loader
  warns in development and throws in production while the flag is true (resolves O7).

### REQ-12 — Dynamic questions are excluded from practice selection

Enforced by a later session-construction feature. The loader exposes a helper that lists
static entries only.

### REQ-13 — Fixtures

`mock/session.json` is a valid passing fixture and `mock/session-needs-practice.json` a valid
failing fixture. Both use fictional profiles, only static civics questions, a `questionId` on
every civics turn, and civics turns that stop exactly where the 2008 rules say (resolves O4).

## Correctness properties

| ID | Property |
|---|---|
| P1 | A civics stage with `correctCount < passingScore` is never passed; a report built from it is never `practice_passed`. |
| P2 | Every valid YYYY-MM-DD date maps to exactly one of `"2008"` or `"2025"`. |
| P3 | `"2025-10-20"` maps to `"2025"`; `"2025-10-19"` maps to `"2008"`. |
| P4 | The stage never stops before a threshold is reached. |
| P5 | The stage never continues after a threshold is reached, and never scores more than `questionsAsked` turns. |
| P6 | Scoring the same input twice gives the same result. |
| P7 | `practiceResult` is always `"practice_passed"` or `"needs_more_practice"`. |
| P8 | A dynamic question is always `"unscored"`, whatever the response text. |
| P9 | A static question is `"correct"` exactly when the response holds at least `requiredAnswerCount` distinct accepted answers. |
| P10 | The matched-phrase count never exceeds the number of distinct accepted answers or the number of response tokens; overlapping answers never double-count. |

## Resolved issues

| Issue | Decision |
|---|---|
| O1 | `questionId` stays optional in the type; the grader throws a clear error for a civics turn without one; tested. |
| O2 | Count only non-overlapping token spans. Data test fails when one accepted answer is inside another for a question with `requiredAnswerCount` above 1. |
| O3 | Curly apostrophes become straight, hyphens become spaces, numeral variants are listed in `acceptedAnswers`, optional words are stored as both variants. |
| O4 | `mock/session.json` rebuilt as a passing fixture; `mock/session-needs-practice.json` added as a failing fixture; both recorded in `docs/contract-requests.md`. |
| O5 | An unscored turn uses one slot; turns beyond `questionsAsked` are ignored; reaching the limit without a threshold gives `needs_more_practice`. |
| O6 | Caller passes `isCorrect`; `attempts` means sentences presented, maximum 3; correctness rules belong to a later spec. |
| O7 | The answer key loader throws in production when `needsHumanReview` is true. |
| O8 | Dynamic when USCIS text says answers will vary or refers to the test-updates page. T-07 tries the 2025 PDF first and falls back to the uscis.gov HTML list, recorded in `sourceDocument`. |
