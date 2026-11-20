/**
 * src/engine/part-report.ts
 *
 * The report of ONE practised part (N-400, reading, writing or civics). It has no overall
 * practice result: a single part cannot say whether a whole practice interview was passed.
 *
 * The contract's FinalReport cannot express this (practiceResult is required), so this is a
 * local type. The change to the contract is requested in docs/contract-requests.md (CR-006).
 *
 * Counts and flags only; the screen turns them into words, so they follow the interface language.
 * Thresholds come from the rules passed in (data/test-rules.json). Civics comes from the real
 * grader result, never from AI. Unscored civics questions are listed apart and never counted
 * wrong.
 *
 * Pure module: no DOM, no network.
 */
import type { CivicsAnswerEntry } from "./civics-answer-key.js";
import type { CivicsStageResult, CivicsStopReason } from "./civics-grader.js";
import type { EnglishStageResult } from "./english-grader.js";
import type { N400Answer } from "./n400-coach.js";
import { listUnscoredQuestions, PRACTICE_DISCLAIMER, type UnscoredQuestion } from "./report-builder.js";
import type { CivicsTestRules, EnglishTestRules } from "./test-rules-loader.js";
import type { CivicsTestVersion } from "./version-selector.js";

export type PracticePart = "n400_interview" | "reading" | "writing" | "civics";

export interface PartSentenceItem {
  /** The practice sentence. */
  sentence: string;
  /** What the user said or typed. */
  transcript: string;
  /** 0 to 1. */
  accuracy: number;
  isCorrect: boolean;
  /** Writing only: the sentence was shown on screen during the attempt (an assisted attempt). */
  assisted: boolean;
}

interface PartReportBase {
  /** Required on every report: practice only, not affiliated with USCIS, not legal advice. */
  disclaimer: string;
  /** ISO 8601. */
  generatedAt: string;
}

export type PartReport =
  | (PartReportBase & {
      part: "n400_interview";
      /** Not scored: only the user's own words are listed. */
      answers: Array<{ question: string; transcript: string }>;
    })
  | (PartReportBase & {
      part: "reading" | "writing";
      passed: boolean;
      correct: number;
      attempts: number;
      /** Correct sentences needed, from the rules. */
      neededCorrect: number;
      items: PartSentenceItem[];
    })
  | (PartReportBase & {
      part: "civics";
      version: CivicsTestVersion;
      passed: boolean;
      correct: number;
      incorrect: number;
      stopReason: CivicsStopReason;
      /** Correct answers needed, from the rules. */
      passingScore: number;
      /** Question texts of the answers that need more practice. */
      reviewItems: string[];
      /** Questions that could not be scored: not counted as right or wrong. */
      unscored: UnscoredQuestion[];
    });

export function buildN400PartReport(answers: readonly N400Answer[], now: Date): PartReport {
  return {
    part: "n400_interview",
    disclaimer: PRACTICE_DISCLAIMER,
    generatedAt: now.toISOString(),
    answers: answers.map((a) => ({ question: a.questionText, transcript: a.transcript })),
  };
}

export function buildEnglishPartReport(input: {
  part: "reading" | "writing";
  result: EnglishStageResult;
  items: readonly PartSentenceItem[];
  rules: EnglishTestRules;
  now: Date;
}): PartReport {
  const { part, result, items, rules, now } = input;
  const needed = rules[part].sentencesToPassCount.value;
  return {
    part,
    disclaimer: PRACTICE_DISCLAIMER,
    generatedAt: now.toISOString(),
    // Checked again against the rules, as the full report does.
    passed: result.passed && result.correctCount >= needed,
    correct: result.correctCount,
    attempts: result.attempts,
    neededCorrect: needed,
    items: [...items],
  };
}

export function buildCivicsPartReport(input: {
  version: CivicsTestVersion;
  result: CivicsStageResult;
  answerKey: ReadonlyMap<string, CivicsAnswerEntry>;
  rules: CivicsTestRules;
  now: Date;
}): PartReport {
  const { version, result, answerKey, rules, now } = input;
  const passingScore = rules.passingScore.value;
  return {
    part: "civics",
    version,
    disclaimer: PRACTICE_DISCLAIMER,
    generatedAt: now.toISOString(),
    passed: result.passed && result.stopReason === "correct_threshold" && result.correctCount >= passingScore,
    correct: result.correctCount,
    incorrect: result.incorrectCount,
    stopReason: result.stopReason,
    passingScore,
    reviewItems: [...result.reviewItems],
    unscored: listUnscoredQuestions(result, answerKey),
  };
}
