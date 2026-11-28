/**
 * src/engine/study-check.ts
 *
 * "Test myself" in Study: one answer to one civics question, graded the same way the civics part
 * grades one answer. The spoken alternatives are compared with matchedAnswerCount (as the
 * practice reducer does), and the chosen text is scored by scoreCivicsTurn against the answer key.
 * No new matching rule, no AI. Nothing is counted, recorded or kept.
 *
 * Pure module: no React, no DOM, no fetch.
 */
import type { CivicsAnswerEntry } from "./civics-answer-key";
import { matchedAnswerCount, scoreCivicsTurn } from "./civics-grader";

export interface StudyCheck {
  /** "correct" or "incorrect" (a static question in the key); "unscored" otherwise. */
  result: "correct" | "incorrect" | "unscored";
  /** The text that was scored: the typed text, or the recogniser's alternative that matches best. */
  response: string;
}

/** The candidate the practice would score: among the response and its alternatives, the one with the most matched answers. */
export function bestCivicsCandidate(entry: CivicsAnswerEntry, response: string, alternatives: readonly string[] = []): string {
  const candidates = [response, ...alternatives].filter((c, i, all) => all.indexOf(c) === i);
  if (entry.answerType !== "static" || candidates.length < 2) return response;
  let best = response;
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = matchedAnswerCount(entry, candidate);
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

export function checkStudyAnswer(
  entry: CivicsAnswerEntry,
  answerKey: ReadonlyMap<string, CivicsAnswerEntry>,
  response: string,
  alternatives: readonly string[] = []
): StudyCheck {
  const chosen = bestCivicsCandidate(entry, response, alternatives);
  const score = scoreCivicsTurn(
    { turnId: "study-1", stage: "civics", prompt: entry.questionText, responseText: chosen, questionId: entry.id, completedAt: "1970-01-01T00:00:00.000Z" },
    answerKey
  );
  const result = score.scoring.stage === "civics" ? score.scoring.result : "unscored";
  return { result, response: chosen };
}
