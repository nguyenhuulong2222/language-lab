/**
 * Word-level accuracy scoring for speech recognition output.
 *
 * Both expected and recognized text are normalised before comparison:
 * lowercase, punctuation stripped, whitespace collapsed.
 * This mirrors what a lenient human reviewer would do for practice purposes.
 */

/** Normalise a string for word-level comparison. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    // Remove punctuation (keep apostrophes inside words so "don't" stays intact)
    .replace(/[^\w\s']/g, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();
}

/** Split normalised text into words. Returns [] for empty/whitespace-only input. */
export function tokenise(text: string): string[] {
  const n = normalise(text);
  return n.length === 0 ? [] : n.split(" ");
}

export interface WordAccuracyResult {
  /** Number of words in the expected sentence. */
  expectedCount: number;
  /** Number of words in the recognised transcription. */
  recognisedCount: number;
  /**
   * Words that appear in the expected sentence, in order, that were
   * also found in the recognised transcription (greedy left-to-right match).
   */
  matchedWords: string[];
  /** 0–1 fraction: matchedWords.length / expectedCount. 1.0 if expectedCount is 0. */
  score: number;
}

/**
 * Calculate word accuracy for a single sentence attempt.
 *
 * Algorithm: greedy left-to-right scan of expected words against recognised words.
 * A recognised word is consumed once matched; order matters.
 * This is intentionally simple — it is a practice tool, not a WER evaluator.
 *
 * @param expected  The sentence the user was asked to say.
 * @param recognised  The browser's speech-to-text transcription.
 */
export function wordAccuracy(
  expected: string,
  recognised: string
): WordAccuracyResult {
  const expectedWords = tokenise(expected);
  const recognisedWords = tokenise(recognised);

  if (expectedWords.length === 0) {
    return {
      expectedCount: 0,
      recognisedCount: recognisedWords.length,
      matchedWords: [],
      score: 1.0,
    };
  }

  const recQueue = [...recognisedWords];
  const matched: string[] = [];

  for (const word of expectedWords) {
    const idx = recQueue.indexOf(word);
    if (idx !== -1) {
      matched.push(word);
      recQueue.splice(idx, 1);
    }
  }

  return {
    expectedCount: expectedWords.length,
    recognisedCount: recognisedWords.length,
    matchedWords: matched,
    score: matched.length / expectedWords.length,
  };
}

export interface OverallAccuracyResult {
  /** Total expected words across all scored sentences. */
  totalExpected: number;
  /** Total matched words across all scored sentences. */
  totalMatched: number;
  /** 0–1 fraction. 1.0 if totalExpected is 0. */
  overallScore: number;
  /** Per-sentence scores in input order. */
  perSentence: WordAccuracyResult[];
}

/**
 * Aggregate word accuracy across multiple sentences.
 * Skipped sentences (no recognised text) are excluded from totals.
 */
export function overallAccuracy(
  pairs: Array<{ expected: string; recognised: string }>
): OverallAccuracyResult {
  const perSentence = pairs.map((p) => wordAccuracy(p.expected, p.recognised));

  // Only count sentences where the user actually attempted (non-empty recognised)
  const attempted = pairs
    .map((p, i) => ({ pair: p, result: perSentence[i]! }))
    .filter(({ pair }) => normalise(pair.recognised).length > 0);

  const totalExpected = attempted.reduce(
    (sum, { result }) => sum + result.expectedCount,
    0
  );
  const totalMatched = attempted.reduce(
    (sum, { result }) => sum + result.matchedWords.length,
    0
  );

  return {
    totalExpected,
    totalMatched,
    overallScore: totalExpected === 0 ? 1.0 : totalMatched / totalExpected,
    perSentence,
  };
}
