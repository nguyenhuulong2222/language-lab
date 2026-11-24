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
import type { FinalReport, InterviewSession, StageSummary, SummaryLine } from "../contracts/session.js";
import { tEn, type MessageKey } from "../i18n/index.js";
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
  /**
   * Null when the session had no reading or writing part: a 65/20 full interview, because USCIS
   * exempts 65/20 applicants from the English requirement. The report then has no English summaries
   * and the practice result depends on the parts that ran.
   */
  readingResult: EnglishStageResult | null;
  writingResult: EnglishStageResult | null;
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

/** A summary line: a key of the locale files and its values (CR-007). */
function line(key: MessageKey, params?: SummaryLine["params"]): SummaryLine {
  return params === undefined ? { key } : { key, params };
}

/** The English text of the lines: the contract's `summary`. */
function render(lines: readonly SummaryLine[]): string {
  return lines.map((l) => tEn(l.key as MessageKey, l.params)).join(" ");
}

function civicsSummary(
  result: CivicsStageResult,
  unscored: readonly UnscoredQuestion[],
  rules: CivicsPracticeRules,
  passed: boolean
): StageSummary {
  const scored = result.correctCount + result.incorrectCount;
  const score = rules.passingScore.value;
  const lines: SummaryLine[] = [];

  if (scored === 0) {
    lines.push(line("report.line.civics.none"));
  } else {
    lines.push(line("report.line.civics.correct", { correct: result.correctCount, scored }));
    if (passed && result.stopReason === "all_asked") {
      lines.push(line("report.line.civics.allAsked", { asked: scored + result.unscoredCount, score }));
    } else if (passed) {
      lines.push(line("report.line.civics.stoppedAtScore"));
    } else if (result.stopReason === "incorrect_threshold") {
      lines.push(line("report.line.civics.stoppedIncorrect", { incorrect: result.incorrectCount, score }));
    } else {
      lines.push(line("report.line.civics.notReached", { score }));
    }
  }

  if (unscored.length > 0) {
    // The question texts stay English (they are the official wording).
    lines.push(line("report.line.civics.unscored", { names: unscored.map((u) => u.questionText ?? u.questionId).join("; ") }));
  }

  return {
    stage: "civics",
    turnsTotal: result.scores.length,
    turnsScored: scored,
    summary: render(lines),
    summaryLines: lines,
    reviewItems: [...result.reviewItems],
  };
}

/** Review items of the English parts. The report screen translates them by these exact texts. */
export const ENGLISH_REVIEW_ITEMS: Record<EnglishStageKind, { text: string; key: MessageKey }> = {
  reading: { text: tEn("report.review.reading"), key: "report.review.reading" },
  writing: { text: tEn("report.review.writing"), key: "report.review.writing" },
};

function englishSummary(
  result: EnglishStageResult,
  rules: EnglishTestRules,
  passed: boolean,
  assisted = 0
): StageSummary {
  const kind = result.kind;
  const presented = result.attempts;
  const lines: SummaryLine[] = [];
  if (presented === 0) {
    lines.push(line(kind === "reading" ? "report.line.reading.none" : "report.line.writing.none"));
  } else if (passed) {
    lines.push(line(kind === "reading" ? "report.line.reading.done" : "report.line.writing.done", { n: presented }));
  } else {
    lines.push(
      line(kind === "reading" ? "report.line.reading.count" : "report.line.writing.count", {
        correct: result.correctCount,
        presented,
        needed: rules[kind].sentencesToPassCount.value,
      })
    );
  }
  if (assisted > 0) lines.push(line("report.line.writing.assisted", { assisted, presented }));
  return {
    stage: kind,
    turnsTotal: presented,
    turnsScored: presented,
    summary: render(lines),
    summaryLines: lines,
    reviewItems: passed ? [] : [ENGLISH_REVIEW_ITEMS[kind].text],
  };
}

/**
 * Build the final practice report.
 * Throws if a result is given for the wrong stage (for example a writing result as reading).
 */
export function buildFinalReport(input: ReportInput): FinalReport {
  const { session, civicsResult, readingResult, writingResult, answerKey } = input;
  if (readingResult !== null && readingResult.kind !== "reading") {
    throw new Error(`readingResult is a "${readingResult.kind}" result.`);
  }
  if (writingResult !== null && writingResult.kind !== "writing") {
    throw new Error(`writingResult is a "${writingResult.kind}" result.`);
  }

  const rules: ReportRules = input.rules ?? {
    civics: loadCivicsRules(session.testVersion),
    english: loadEnglishRules(),
  };

  const civicsOk = civicsPassed(civicsResult, rules.civics);
  const readingOk = readingResult === null || englishPassed(readingResult, rules.english);
  const writingOk = writingResult === null || englishPassed(writingResult, rules.english);

  const unscored = listUnscoredQuestions(civicsResult, answerKey);
  const stageSummaries: StageSummary[] = [
    ...(readingResult === null ? [] : [englishSummary(readingResult, rules.english, readingOk)]),
    ...(writingResult === null ? [] : [englishSummary(writingResult, rules.english, writingOk, input.writingAssisted ?? 0)]),
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
