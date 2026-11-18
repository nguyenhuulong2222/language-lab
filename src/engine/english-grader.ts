/**
 * src/engine/english-grader.ts
 *
 * Applies the reading and writing pass rule (default: 1 of 3 sentences correct).
 *
 * This module only applies the threshold. The caller passes `isCorrect` for each turn;
 * how correctness is decided belongs to a later spec.
 *
 * `attempts` means the number of sentences presented so far: the first sentence has
 * attempts 1, the second 2, and so on, up to `sentencesPresented`.
 *
 * Every threshold comes from the EnglishComponentRules passed in (read from
 * data/test-rules.json by the rules loader). Nothing is hard-coded here.
 *
 * Pure module: no DOM, no network, no side effects.
 */

import type { ScoringResult, Turn } from "../contracts/session.js";
import type { EnglishComponentRules } from "./test-rules-loader.js";

export type EnglishStageKind = "reading" | "writing";
export type EnglishScoring = Extract<ScoringResult, { stage: EnglishStageKind }>;

export interface EnglishTurnInput {
  turn: Turn;
  /** Supplied by the caller. This module does not judge the response text. */
  isCorrect: boolean;
}

export interface EnglishTurnScore {
  turnId: string;
  scoring: EnglishScoring;
}

export interface EnglishStageInput {
  kind: EnglishStageKind;
  /** The turns for this stage, in the order the sentences were presented. */
  items: readonly EnglishTurnInput[];
  rules: EnglishComponentRules;
}

export interface EnglishStageResult {
  kind: EnglishStageKind;
  scores: EnglishTurnScore[];
  correctCount: number;
  /** Sentences presented (graded) in this stage. */
  attempts: number;
  passed: boolean;
  /** The turn on which the stage passed, or null if it did not pass. */
  stoppedAtTurnId: string | null;
}

/**
 * Grade a reading or writing stage.
 *
 * At most `sentencesPresented` items are graded; later items are ignored. The stage passes
 * and stops as soon as correct answers reach `sentencesToPassCount`.
 * Throws if a graded turn belongs to a different stage.
 */
export function runEnglishStage(input: EnglishStageInput): EnglishStageResult {
  const { kind, items, rules } = input;
  const sentenceLimit = rules.sentencesPresented.value;
  const sentencesToPass = rules.sentencesToPassCount.value;

  const scores: EnglishTurnScore[] = [];
  let correctCount = 0;
  let stoppedAtTurnId: string | null = null;

  for (const [index, { turn, isCorrect }] of items.slice(0, sentenceLimit).entries()) {
    if (turn.stage !== kind) {
      throw new Error(
        `Turn "${turn.turnId}" is a "${turn.stage}" turn but the ${kind} stage is being graded.`
      );
    }

    scores.push({
      turnId: turn.turnId,
      scoring: {
        stage: kind,
        attempts: index + 1,
        result: isCorrect ? "correct" : "incorrect",
      },
    });

    if (isCorrect) correctCount += 1;
    if (correctCount >= sentencesToPass) {
      stoppedAtTurnId = turn.turnId;
      break;
    }
  }

  return {
    kind,
    scores,
    correctCount,
    attempts: scores.length,
    passed: stoppedAtTurnId !== null,
    stoppedAtTurnId,
  };
}
