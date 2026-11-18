# Grading — Tasks

Order follows dependencies. After each task: `npm run typecheck` and `npm test` must pass,
then commit. Property-based tests are named `property: ...` so they are easy to find.

**Status:** T-01 to T-07 implemented and committed. T-07's files still need human review
(`needsHumanReview: true`). T-08 and T-09 not started.

**Points settled before T-07** (details in `docs/kiro-log.md`): the 2025 source is the official
PDF and its converted text; a leading "the", "a" or "an" is optional when matching; numbers that
continue ("one hundred and one") do not match; the boundary date lives in `data/test-rules.json`.

## T-01 — Contract change, fixtures, contract requests

Files: `src/contracts/session.ts`, `mock/session.json` (rebuilt), `mock/session-needs-practice.json`
(new), `src/contracts/__tests__/session-mock.test.ts`, `src/ui/__tests__/report-render.test.tsx`
(one assertion), `docs/contract-requests.md`.

- Add `"unscored"` to `CivicsScoringResult.result`; document `Turn.questionId`.
- Rebuild `mock/session.json`: 2008, fictional profile, static civics only, 6 correct and 1
  incorrect civics turns that stop on the 6th correct, reading passes on sentence 1, writing
  passes on sentence 2, `practice_passed`.
- Add `mock/session-needs-practice.json`: civics stops on the 5th incorrect,
  `needs_more_practice`.
- Tests run over both fixtures: every civics turn has a `questionId`, scoring results match
  turns, practiceResult matches the fixture's role, no A-numbers, no `pass`/`fail`.
- Update the one UI test assertion that named the old dynamic review item.

## T-02 — Answer normaliser

File: `src/engine/answer-normaliser.ts`.

Unit tests: curly apostrophes, hyphens as spaces, internal apostrophes kept, edge apostrophes
trimmed, whitespace, empty input; `containsPhrase` (extra words, start, end, multi-word, out
of order, "constitutional" vs "constitution", "unrepresented" vs "represent");
`countMatchingPhrases` (zero, one, two, duplicates, overlapping answers, distinct spans).

Property tests: normalise is idempotent; output has no uppercase and no edge whitespace;
`w` is never found inside `w+s` or `s+w`; count is 0 for no answers; count never exceeds the
distinct answers or the response token count; adding words around a response never lowers the
count.

## T-03 — Version selector

File: `src/engine/version-selector.ts`.

Unit tests: 2025-10-19 gives 2008, 2025-10-20 gives 2025, 2025-10-21 gives 2025, malformed
and impossible dates throw, consistency check passes and fails.

Property tests: every valid date maps to exactly one version (P2); the boundary maps to 2025
(P3); dates before it map to 2008 and dates on or after map to 2025.

## T-04 — Answer key loader and stub data

Files: `src/engine/civics-answer-key.ts`, `data/civics-answers/2008.json`,
`data/civics-answers/2025.json` (stubs, `needsHumanReview: true`).

Stubs use real USCIS questions with official ids, and include a static question, a question
with `requiredAnswerCount` 2, and a dynamic question per file.

Tests: structure and REQ-11 rules on both real files; parse errors for each rule (mutated
copies); production throw and development warn for `needsHumanReview`; `listStaticEntries`;
nested-answer data test (REQ-11); property test that every id in the loaded key resolves.

## T-05 — Civics grader

File: `src/engine/civics-grader.ts`.

Unit tests: correct, incorrect, `requiredAnswerCount` 2 with one and two phrases, dynamic and
unknown id unscored, missing and blank `questionId` throws (O1), non-civics turn throws,
"I think it is the Constitution" is correct, "constitutional" is incorrect. Stage tests with
counts read from the loaded rules: stops on the exact turn for both thresholds, no scoring
after the stop, no stop one turn early, unscored turns use a slot and change no counter,
turns beyond `questionsAsked` ignored, limit reached gives not passed, thresholds really come
from the rules (injected rules shift the stop), reviewItems.

Property tests: P1, P4, P5, P6, P8, P9 against both 2008 and 2025 rules.

## T-06 — English grader

File: `src/engine/english-grader.ts`.

Unit tests: passes on the first correct, passes on the second and third, fails with no
correct, stops after the pass, `attempts` per turn and per stage, ignores turns beyond
`sentencesPresented`, wrong-stage turn throws, injected rules change the pass count.

Property tests: passed exactly when enough correct answers fall inside the first
`sentencesPresented` items; attempts never exceed `sentencesPresented`; no score after the
stop.

## T-07 — Populate answer key files (done; waits for human review)

Files: `data/civics-answers/2008.json` (100 questions), `data/civics-answers/2025.json` (128
questions), `data/sources/` (official sources), `tools/answer-key/build-answer-key.mjs`,
`docs/answer-key-review.md`, `src/engine/__tests__/civics-answer-data.test.ts`.

Sources: official USCIS lists only. 2025 from the official PDF and its converted text; 2008 from
the official web page, numbering cross-checked against the older official text. Every entry records
`sourceUrl` and `sourceDocument` (the 2025 entries name `uscis-2025-civics-128.pdf`). Dynamic means
the USCIS text says answers will vary or points to the test-updates page. Optional words stored as
both variants; numerals listed explicitly. Files stay `needsHumanReview: true`.

Still to do by a person: review `docs/answer-key-review.md` and approve each file. Running the
`content-reviewer` agent on the sheet is optional.

Changes made at the T-07 review (2026-11-17): a per-answer marker for parentheses (2025 question 48
now accepts "Secretary of War" and "Secretary of Defense"), and the number rules in the matcher
(digits = words, ordinals, bare number for number-plus-unit answers). Parentheses in 2025 questions
67, 77, 101, 106, 118 and 2008 question 61 are waiting for the owner's decision and are unchanged.

## T-08 — Report builder (not started)

File: `src/engine/report-builder.ts`. Tests cover practiceResult for each failing stage, the
disclaimer, summaries and counts, review items, timestamp, plus P1 and P7 properties.

## T-09 — Integration test (not started)

File: `src/engine/__tests__/grading-integration.test.ts`. Grades both fixtures end to end and
checks the boundary dates, mismatched version, dynamic turn and missing `questionId` cases.

## Summary

| Task | Depends on |
|---|---|
| T-01 | none |
| T-02 | none |
| T-03 | none |
| T-04 | T-02 |
| T-05 | T-02, T-04 |
| T-06 | none |
| T-07 | T-04 |
| T-08 | T-05, T-06 |
| T-09 | T-07, T-08 |
