# Grading — Design

Status: revision 4. Reflects decisions O1–O8 and the pre-T-07 decisions (optional leading article,
numbers that continue, boundary date in the rules file, official 2025 PDF as the 2025 source).

## Module layout

All new logic is in `src/engine/`. Nothing in `src/ui/`, `worker/` or `tools/` changes,
except the single fixture-dependent assertion noted in `docs/contract-requests.md` (CR-004).

```
src/contracts/session.ts          CHANGE: "unscored" added; Turn.questionId documented
src/engine/answer-normaliser.ts   NEW  normalise, tokenise, containsPhrase, countMatchingPhrases
src/engine/version-selector.ts    NEW  selectTestVersion, assertVersionConsistency
src/engine/civics-answer-key.ts   NEW  parseAnswerKey, loadAnswerKey, listStaticEntries,
                                       findNestedAcceptedAnswers
src/engine/civics-grader.ts       NEW  scoreCivicsTurn, runCivicsStage
src/engine/english-grader.ts      NEW  runEnglishStage
src/engine/report-builder.ts      NEW  buildFinalReport, PRACTICE_DISCLAIMER
src/engine/test-rules-loader.ts   EXISTING, unchanged
data/civics-answers/2008.json     NEW  stub in T-04, full in T-07
data/civics-answers/2025.json     NEW  stub in T-04, full in T-07
mock/session.json                 REBUILT  passing fixture
mock/session-needs-practice.json  NEW  failing fixture
docs/contract-requests.md         NEW  CR-001 to CR-004
```

## Contract changes

```typescript
export interface CivicsScoringResult {
  scoringSource: "answer_key";
  result: "correct" | "incorrect" | "unscored";
}

export interface Turn {
  // ...existing fields...
  /** Required at runtime when stage === "civics" (the grader throws without it). */
  questionId?: string;
}
```

## Normalisation (`answer-normaliser.ts`)

`normalise(text)`:

1. Lowercase.
2. Map `’ ‘ ‛ ′` and backtick to `'`.
3. Map hyphens and dashes (`-`, U+2010 to U+2015) to a space.
4. Remove every character that is not `a-z`, `0-9`, space, or `'`.
5. Split on whitespace, trim apostrophes from both ends of each word, drop empty words.
6. Join with single spaces.

The output only contains `a-z 0-9 '` and single spaces, so `normalise` is idempotent.

`tokenise(text)` returns `[]` for empty input, else `normalise(text).split(" ")`.

`containsPhrase(haystack, phrase)`: tokens of the phrase must appear as a contiguous run in
the tokens of the haystack. An empty phrase returns `true`.

Both `containsPhrase` and `countMatchingPhrases` find spans through one function, `findSpans`:

- A phrase that starts with "the", "a" or "an" and has more than one word also matches without
  that first word. Both forms are tried; the exact search picks whichever fits.
- A span is dropped when it continues a number (`continuesNumber`). If the span ends in a number
  token ("one", "hundred", "27") and the next token, skipping one "and", is also a number token, the
  number continues. If the span starts with a number token and the token before it, skipping one
  "and", is a number token, the number began earlier. `isNumberToken` is exported.

`countMatchingPhrases(response, acceptedAnswers)`:

1. Normalise and de-duplicate the accepted answers; drop empty ones.
2. Find every span (start index) where each phrase occurs in the response tokens.
3. Choose at most one span per phrase so that chosen spans do not overlap, maximising the
   number of chosen phrases. This is an exact depth-first search with a used-token mask.
   Inputs are tiny (a short response, at most a few dozen accepted answers), and the result
   is deterministic.

## Version selection (`version-selector.ts`)

The boundary date is not written in this module. It is read from `data/test-rules.json`
(`civicsTestVersionSelection.boundaryDate`, with the exact uscis.gov sentence and URL) through
`loadCivicsBoundaryDate()` in the rules loader, and the loader refuses it in production while it is
unverified. `selectTestVersion(filingDate, boundaryDate = loadCivicsBoundaryDate())` validates
both dates, then compares strings. `assertVersionConsistency` throws when the declared version
differs. The optional `boundaryDate` argument exists so tests can show the selector reads it.

## Answer key (`civics-answer-key.ts`)

```typescript
export interface CivicsAnswerEntry {
  id: string; testVersion: "2008" | "2025"; questionText: string;
  acceptedAnswers: string[]; requiredAnswerCount: number;
  answerType: "static" | "dynamic"; sourceUrl: string; sourceDocument: string;
}
export interface LoadOptions { production?: boolean }

parseAnswerKey(raw: unknown, version, options?): Map<string, CivicsAnswerEntry>
loadAnswerKey(version, options?): Map<string, CivicsAnswerEntry>
listStaticEntries(key): CivicsAnswerEntry[]
findNestedAcceptedAnswers(entry): Array<[inner: string, outer: string]>
```

`parseAnswerKey` validates structure and the REQ-11 rules. When `needsHumanReview` is true it
throws if `production` is true and otherwise logs a warning. `production` defaults to the
build mode (`import.meta.env.PROD`). `findNestedAcceptedAnswers` backs the data test.

## Civics grader (`civics-grader.ts`)

```typescript
scoreCivicsTurn(turn, answerKey): CivicsTurnScore
  // { turnId, questionId, scoring: { stage: "civics", scoringSource: "answer_key", result } }
runCivicsStage({ turns, answerKey, rules }): CivicsStageResult
  // { scores, correctCount, incorrectCount, unscoredCount, passed,
  //   stopReason: "correct_threshold" | "incorrect_threshold" | "none",
  //   stoppedAtTurnId: string | null, reviewItems }
```

Stage loop over `turns.slice(0, rules.questionsAsked.value)`: score the turn, update
counters, then stop if correct reached `earlyStopOnCorrect`, else if incorrect reached
`earlyStopOnIncorrect`. `passed = stopReason === "correct_threshold" && correctCount >=
passingScore`.

## English grader (`english-grader.ts`)

```typescript
interface EnglishTurnInput { turn: Turn; isCorrect: boolean }
runEnglishStage({ kind, items, rules }): EnglishStageResult
  // { kind, scores, correctCount, attempts, passed, stoppedAtTurnId }
```

Considers at most `sentencesPresented` items. Item `i` (0-based) gets `attempts = i + 1`.
Stops when correct reaches `sentencesToPassCount`. Stage `attempts` is the number of
sentences presented (the number of scores).

## Report builder (`report-builder.ts`)

`buildFinalReport({ session, civicsResult, readingResult, writingResult, now? })` returns a
`FinalReport`. `now` is an injectable clock so the function stays deterministic in tests.

## Data flow

```
filingDate -> selectTestVersion -> assertVersionConsistency(testVersion)
           -> loadCivicsRules(v), loadAnswerKey(v)
civics turns  -> runCivicsStage   -> CivicsStageResult
reading items -> runEnglishStage  -> EnglishStageResult
writing items -> runEnglishStage  -> EnglishStageResult
three results -> buildFinalReport -> FinalReport
```

## Answer key build (`tools/answer-key/build-answer-key.mjs`)

A script, not a runtime module. `node tools/answer-key/build-answer-key.mjs` is a dry run;
`--write=2008`, `--write=2025` and `--write=review` write the key files and the review sheet.

- Parsing is strict. It fails on a line it does not recognise, a missing or repeated question
  number, a wrong total, or answers that nest inside each other for a multi-answer question.
- 2025: parses the converted text (question lines, `•` answer lines, wrapped lines, page footers).
  2008: parses the numbered lists of the saved web page, with two explicit layout fixes (question
  87 and question 95). The older text with explicit numbers is the numbering cross-check.
- Each source answer line becomes accepted answers: parentheses give both variants; a spelled-out
  number followed by its numeral in parentheses gives both forms; slash alternatives are split;
  a bracketed "Also acceptable are..." note adds answers; other notes are dropped.
- Dynamic: a source answer line says answers will vary or points to the test updates page.
- `requiredAnswerCount` comes from the asking sentence only ("Name two", "What are three").
- Every interpretation is recorded as a flag on the question and listed in
  `docs/answer-key-review.md`. Files are written with `needsHumanReview: true`.
- It imports the engine's own `normalise`, so stored answers are in exactly the loader's form.

The data tests in `src/engine/__tests__/civics-answer-data.test.ts` read the official sources a
second time with their own simple parsing and do not use this script.

## Excluded

65/20, dynamic-question selection enforcement, deciding reading and writing correctness,
N-400 scoring, any AI involvement in scoring, UI and Worker changes.
