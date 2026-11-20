/**
 * src/engine/civics-grader.ts
 *
 * Scores civics turns against the answer key and applies the early-stop rule.
 *
 * - Scores come from the answer key only (scoringSource is always "answer_key").
 *   AI never decides or changes a civics score.
 * - Every threshold comes from the CivicsTestRules passed in (read from
 *   data/test-rules.json by the rules loader). Nothing is hard-coded here.
 *
 * Pure module: no DOM, no network, no side effects.
 */

import type { ScoringResult, Turn } from "../contracts/session.js";
import { countMatchingPhrases } from "./answer-normaliser.js";
import type { CivicsAnswerEntry } from "./civics-answer-key.js";
import type { CivicsTestRules } from "./test-rules-loader.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CivicsScoring = Extract<ScoringResult, { stage: "civics" }>;
type CivicsResult = CivicsScoring["result"];

export interface CivicsTurnScore {
  turnId: string;
  questionId: string;
  scoring: CivicsScoring;
}

export interface CivicsStageInput {
  /** Civics turns in the order they were asked. */
  turns: readonly Turn[];
  answerKey: ReadonlyMap<string, CivicsAnswerEntry>;
  rules: CivicsTestRules;
}

export type CivicsStopReason = "correct_threshold" | "incorrect_threshold" | "none";

export interface CivicsStageResult {
  /** One score per turn that was graded, in order. */
  scores: CivicsTurnScore[];
  correctCount: number;
  incorrectCount: number;
  unscoredCount: number;
  /** True only when the correct-answer threshold was reached and the passing score met. */
  passed: boolean;
  stopReason: CivicsStopReason;
  /** The turn on which the stage stopped, or null if no threshold was reached. */
  stoppedAtTurnId: string | null;
  /** questionText of every incorrectly answered question, in order. */
  reviewItems: string[];
}

// ---------------------------------------------------------------------------
// Scoring one turn
// ---------------------------------------------------------------------------

/**
 * How many distinct accepted answers of a static question the text contains. The same count
 * that scores a turn, so choosing between the recogniser's alternatives uses the answer key
 * and nothing else (AI never decides a civics score).
 */
export function matchedAnswerCount(entry: CivicsAnswerEntry, responseText: string): number {
  return countMatchingPhrases(responseText, entry.acceptedAnswers, {
    groups: entry.answerGroups ?? [],
    numberAlone: entry.numberAlone ?? [],
  });
}

function resultFor(
  entry: CivicsAnswerEntry | undefined,
  responseText: string
): CivicsResult {
  // Not in the key: nothing to score against.
  if (entry === undefined) return "unscored";
  // Dynamic answers change over time; their accepted answers are never read.
  if (entry.answerType === "dynamic") return "unscored";

  const matched = matchedAnswerCount(entry, responseText);
  return matched >= entry.requiredAnswerCount ? "correct" : "incorrect";
}

/**
 * Score one civics turn.
 *
 * Throws if the turn is not a civics turn, or has no questionId.
 * Returns "unscored" for dynamic questions and for ids that are not in the answer key.
 */
export function scoreCivicsTurn(
  turn: Turn,
  answerKey: ReadonlyMap<string, CivicsAnswerEntry>
): CivicsTurnScore {
  if (turn.stage !== "civics") {
    throw new Error(
      `Turn "${turn.turnId}" is a "${turn.stage}" turn. The civics grader only scores civics turns.`
    );
  }

  const questionId = turn.questionId;
  if (questionId === undefined || questionId.trim() === "") {
    throw new Error(
      `Civics turn "${turn.turnId}" has no questionId. ` +
        `Every civics turn must carry the id of the answer key entry it asks (for example "2008-001").`
    );
  }

  const result = resultFor(answerKey.get(questionId), turn.responseText);
  return {
    turnId: turn.turnId,
    questionId,
    scoring: { stage: "civics", scoringSource: "answer_key", result },
  };
}

// ---------------------------------------------------------------------------
// Running the stage
// ---------------------------------------------------------------------------

/**
 * Grade the civics stage.
 *
 * Turns are scored in order, at most `questionsAsked` of them; later turns are ignored.
 * An unscored turn uses one question slot and changes neither counter.
 *
 * The stage stops on the turn where correct answers reach `earlyStopOnCorrect` or
 * incorrect answers reach `earlyStopOnIncorrect`. If the turns or the question limit run
 * out first, the stage is not passed.
 */
export function runCivicsStage(input: CivicsStageInput): CivicsStageResult {
  const { turns, answerKey, rules } = input;
  const questionLimit = rules.questionsAsked.value;
  const stopOnCorrect = rules.earlyStopOnCorrect.value;
  const stopOnIncorrect = rules.earlyStopOnIncorrect.value;
  const passingScore = rules.passingScore.value;

  const scores: CivicsTurnScore[] = [];
  let correctCount = 0;
  let incorrectCount = 0;
  let unscoredCount = 0;
  let stopReason: CivicsStopReason = "none";
  let stoppedAtTurnId: string | null = null;

  for (const turn of turns.slice(0, questionLimit)) {
    const score = scoreCivicsTurn(turn, answerKey);
    scores.push(score);

    switch (score.scoring.result) {
      case "correct":
        correctCount += 1;
        break;
      case "incorrect":
        incorrectCount += 1;
        break;
      case "unscored":
        unscoredCount += 1;
        break;
    }

    if (correctCount >= stopOnCorrect) {
      stopReason = "correct_threshold";
      stoppedAtTurnId = turn.turnId;
      break;
    }
    if (incorrectCount >= stopOnIncorrect) {
      stopReason = "incorrect_threshold";
      stoppedAtTurnId = turn.turnId;
      break;
    }
  }

  const reviewItems = scores
    .filter((score) => score.scoring.result === "incorrect")
    .map((score) => answerKey.get(score.questionId)?.questionText)
    .filter((text): text is string => text !== undefined);

  return {
    scores,
    correctCount,
    incorrectCount,
    unscoredCount,
    passed: stopReason === "correct_threshold" && correctCount >= passingScore,
    stopReason,
    stoppedAtTurnId,
    reviewItems,
  };
}
