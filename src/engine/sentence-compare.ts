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
