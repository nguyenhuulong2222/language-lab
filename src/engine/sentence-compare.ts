/**
 * src/engine/sentence-compare.ts
 *
 * Compares what the user said or typed with a practice sentence, word by word.
 *
 * - Words come from the engine's matcher tokeniser: case, punctuation and hyphens are
 *   ignored, and a number written in words equals the numeral ("fifty" = "50").
 * - Accuracy = words in the longest common run of words (in order, gaps allowed) divided by the
 *   word count of the longer of the two sentences. Missing words and extra words both lower it.
 * - `isCorrect` is `accuracy >= minWordAccuracy`. The minimum is a Language Lab practice
 *   setting (data/practice/practice-config.json), not a USCIS rule. It is passed in; this
 *   module holds no threshold.
 *
 * Pure module: no DOM, no network.
 */
import { matchTokens } from "./answer-normaliser.js";

export type DiffStatus = "match" | "missing" | "extra";

export interface DiffWord {
  word: string;
  /** match: in both. missing: in the sentence, not said. extra: said, not in the sentence. */
  status: DiffStatus;
}

export interface SentenceComparison {
  /** 0 to 1. */
  accuracy: number;
  matchedWords: number;
  targetWords: number;
  attemptWords: number;
  isCorrect: boolean;
  /** The words in order: matches and missing words follow the sentence; extra words sit where they were said. */
  diff: DiffWord[];
}

/** Longest common subsequence table of two token lists. */
function lcsTable(a: readonly string[], b: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  return table;
}

export function compareSentence(
  target: string,
  attempt: string,
  minWordAccuracy: number
): SentenceComparison {
  const a = matchTokens(target);
  const b = matchTokens(attempt);
  const table = lcsTable(a, b);

  const diff: DiffWord[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      diff.push({ word: a[i]!, status: "match" });
      i++;
      j++;
    } else if (j < b.length && (i === a.length || table[i]![j + 1]! >= table[i + 1]![j]!)) {
      diff.push({ word: b[j]!, status: "extra" });
      j++;
    } else {
      diff.push({ word: a[i]!, status: "missing" });
      i++;
    }
  }

  const matched = table[0]![0]!;
  const longer = Math.max(a.length, b.length);
  const accuracy = longer === 0 ? 0 : matched / longer;
  return {
    accuracy,
    matchedWords: matched,
    targetWords: a.length,
    attemptWords: b.length,
    isCorrect: accuracy >= minWordAccuracy,
    diff,
  };
}

export interface BestAlternative {
  /** Index in the candidates (0 = the recogniser's main text). */
  index: number;
  text: string;
  comparison: SentenceComparison;
}

/**
 * Score every candidate (the recogniser's alternatives) and pick the best one. Order of preference:
 * it counts; then more of the sentence matched (higher accuracy); then fewer extra words; then the
 * recogniser's own order. Empty candidates are ignored. With one candidate this is just that one.
 */
export function pickBestAlternative(
  candidates: readonly string[],
  compare: (text: string) => SentenceComparison
): BestAlternative {
  const list = candidates.length === 0 ? [""] : candidates;
  let best: BestAlternative | null = null;
  list.forEach((text, index) => {
    const comparison = compare(text);
    const candidate: BestAlternative = { index, text, comparison };
    if (best === null || isBetter(candidate, best)) best = candidate;
  });
  return best as unknown as BestAlternative;
}

function isBetter(a: BestAlternative, b: BestAlternative): boolean {
  if (a.comparison.isCorrect !== b.comparison.isCorrect) return a.comparison.isCorrect;
  if (a.comparison.accuracy !== b.comparison.accuracy) return a.comparison.accuracy > b.comparison.accuracy;
  const extraA = a.comparison.attemptWords - a.comparison.matchedWords;
  const extraB = b.comparison.attemptWords - b.comparison.matchedWords;
  if (extraA !== extraB) return extraA < extraB;
  return false; // keep the earlier one
}
