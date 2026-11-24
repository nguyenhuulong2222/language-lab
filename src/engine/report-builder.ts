/**
 * src/engine/report-builder.ts
 *
 * Builds the FinalReport from the three graded stages (civics, reading, writing).
 *
 * - Thresholds come only from data/test-rules.json, through the rules loader (or the rules
 *   a caller passes in). No threshold or count is written in this file.
 * - practiceResult is "practice_passed" only when civics, reading and writing are all passed.
 *   The stage flags are checked again against the rules, so a stage that did not reach its
 *   passing score can never produce "practice_passed".
 * - Unscored civics questions (their answers change, or the id is not in the answer key) are
 *   never counted as wrong. They are left out of the review items and named separately in the
 *   civics summary; `listUnscoredQuestions` returns them for screens that want a list.
 * - Summaries are built from counts. No AI, no officeholder names: only question texts from
 *   the answer key are quoted.
 *
 * Pure module: no DOM, no network. The clock is injectable.
 */
import type { FinalReport, InterviewSession, StageSummary } from "../contracts/session.js";
import type { CivicsAnswerEntry } from "./civics-answer-key.js";
import type { CivicsStageResult } from "./civics-grader.js";
import type { EnglishStageKind, EnglishStageResult } from "./english-grader.js";
import {
  loadCivicsRules,
  loadEnglishRules,
  type CivicsPracticeRules,
  type EnglishTestRules,
} from "./test-rules-loader.js";

/** Required on every report. Practice only, not a government service, not legal advice. */
export const PRACTICE_DISCLAIMER =
  "This is a practice tool only. It is not affiliated with USCIS or any government agency. " +
  "Results do not predict or reflect any official immigration decision. This is not legal advice.";

export interface ReportRules {
  civics: CivicsPracticeRules;
  english: EnglishTestRules;
}

export interface ReportInput {
  session: InterviewSession;
  civicsResult: CivicsStageResult;
  readingResult: EnglishStageResult;
  writingResult: EnglishStageResult;
  /** How many writing attempts were made with the sentence shown on screen (assisted). Default 0. */
  writingAssisted?: number;
  /** Used to name the questions that could not be scored. */
  answerKey: ReadonlyMap<string, CivicsAnswerEntry>;
  /** Defaults to the rules for `session.testVersion`, read from data/test-rules.json. */
  rules?: ReportRules;
  /** The report timestamp. Defaults to the current time. Injectable for tests. */
  now?: Date;
}

export interface UnscoredQuestion {
  turnId: string;
  questionId: string;
  /** The question, or null when the id is not in the answer key. */
  questionText: string | null;
  reason: "answer_changes" | "not_in_answer_key";
}

/** The civics turns that were not scored, in the order they were asked. */
export function listUnscoredQuestions(
  civicsResult: CivicsStageResult,
  answerKey: ReadonlyMap<string, CivicsAnswerEntry>
): UnscoredQuestion[] {
  return civicsResult.scores
    .filter((score) => score.scoring.result === "unscored")
    .map((score) => {
      const entry = answerKey.get(score.questionId);
      return {
        turnId: score.turnId,
        questionId: score.questionId,
        questionText: entry?.questionText ?? null,
        reason: entry === undefined ? "not_in_answer_key" : "answer_changes",
      };
    });
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function civicsPassed(result: CivicsStageResult, rules: CivicsPracticeRules): boolean {
  return (
    result.passed &&
    (result.stopReason === "correct_threshold" || result.stopReason === "all_asked") &&
    result.correctCount >= rules.passingScore.value
  );
}

function englishPassed(
  result: EnglishStageResult,
  rules: EnglishTestRules
): boolean {
  return result.passed && result.correctCount >= rules[result.kind].sentencesToPassCount.value;
}

function civicsSummary(
  result: CivicsStageResult,
  unscored: readonly UnscoredQuestion[],
  rules: CivicsPracticeRules,
  passed: boolean
): StageSummary {
  const scored = result.correctCount + result.incorrectCount;
  const parts: string[] = [];

  if (scored === 0) {
    parts.push("No civics questions were scored.");
  } else {
    parts.push(
      `${result.correctCount} of ${scored} civics ${plural(scored, "question", "questions")} answered correctly.`
    );
    if (passed && result.stopReason === "all_asked") {
      parts.push(`All ${scored + result.unscoredCount} questions were asked, and the practice passing score of ${rules.passingScore.value} was reached.`);
    } else if (passed) {
      parts.push("The practice test stopped once the practice passing score was reached.");
    } else if (result.stopReason === "incorrect_threshold") {
      parts.push(
        `The practice test stopped after ${rules.earlyStopOnIncorrect.value} incorrect answers, ` +
          `before the practice passing score of ${rules.passingScore.value} was reached.`
      );
    } else {
      parts.push(
        `The practice passing score is ${rules.passingScore.value} correct answers, and it was not reached.`
      );
    }
  }

  if (unscored.length > 0) {
    const names = unscored.map((u) => u.questionText ?? u.questionId).join("; ");
    parts.push(
      `${unscored.length} ${plural(unscored.length, "question was", "questions were")} not scored ` +
        `because the answer changes or is not in the answer key (${names}). ` +
        `${plural(unscored.length, "It does", "They do")} not count as correct or incorrect.`
    );
  }

  return {
    stage: "civics",
    turnsTotal: result.scores.length,
    turnsScored: scored,
    summary: parts.join(" "),
    reviewItems: [...result.reviewItems],
  };
}

const ENGLISH_WORDS: Record<EnglishStageKind, { done: string; practice: string }> = {
  reading: { done: "read", practice: "Practice reading the sentences aloud." },
  writing: { done: "written", practice: "Practice writing the sentences you hear." },
};

function englishSummary(
  result: EnglishStageResult,
  rules: EnglishTestRules,
  passed: boolean,
  assisted = 0
): StageSummary {
  const words = ENGLISH_WORDS[result.kind];
  const presented = result.attempts;
  let summary: string;
  if (presented === 0) {
    summary = `No ${result.kind} sentences were completed.`;
  } else if (passed) {
    summary = `Sentence ${presented} was ${words.done} correctly.`;
  } else {
    summary =
      `${result.correctCount} of ${presented} ${result.kind} ${plural(presented, "sentence", "sentences")} ` +
      `${presented === 1 ? "was" : "were"} ${words.done} correctly. ` +
      `${rules[result.kind].sentencesToPassCount.value} correct ${plural(rules[result.kind].sentencesToPassCount.value, "sentence is", "sentences are")} needed.`;
  }
  if (assisted > 0) {
    summary += ` ${assisted} of the ${presented} writing ${plural(presented, "attempt was", "attempts were")} made with the sentence shown on screen (assisted).`;
  }
  return {
    stage: result.kind,
    turnsTotal: presented,
    turnsScored: presented,
    summary,
    reviewItems: passed ? [] : [words.practice],
  };
}

/**
 * Build the final practice report.
 * Throws if a result is given for the wrong stage (for example a writing result as reading).
 */
export function buildFinalReport(input: ReportInput): FinalReport {
  const { session, civicsResult, readingResult, writingResult, answerKey } = input;
  if (readingResult.kind !== "reading") {
    throw new Error(`readingResult is a "${readingResult.kind}" result.`);
  }
  if (writingResult.kind !== "writing") {
    throw new Error(`writingResult is a "${writingResult.kind}" result.`);
  }

  const rules: ReportRules = input.rules ?? {
    civics: loadCivicsRules(session.testVersion),
    english: loadEnglishRules(),
  };

  const civicsOk = civicsPassed(civicsResult, rules.civics);
  const readingOk = englishPassed(readingResult, rules.english);
  const writingOk = englishPassed(writingResult, rules.english);

  const unscored = listUnscoredQuestions(civicsResult, answerKey);
  const stageSummaries: StageSummary[] = [
    englishSummary(readingResult, rules.english, readingOk),
    englishSummary(writingResult, rules.english, writingOk, input.writingAssisted ?? 0),
    civicsSummary(civicsResult, unscored, rules.civics, civicsOk),
  ];

  const overallReviewItems = [...new Set(stageSummaries.flatMap((s) => s.reviewItems))];

  return {
    practiceResult: civicsOk && readingOk && writingOk ? "practice_passed" : "needs_more_practice",
    disclaimer: PRACTICE_DISCLAIMER,
    stageSummaries,
    overallReviewItems,
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}
