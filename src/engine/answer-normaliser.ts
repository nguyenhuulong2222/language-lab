/**
 * src/engine/answer-normaliser.ts
 *
 * Normalisation and whole-word phrase matching for civics answer scoring.
 * Pure module: no DOM, no network, no side effects.
 *
 * This is the engine's own implementation. It does not import from tools/.
 */

/** Curly and look-alike apostrophes that must map to a straight apostrophe. */
const APOSTROPHE_VARIANTS = /[\u2018\u2019\u201B\u2032\u00B4`]/g;

/** Hyphen-minus and the Unicode hyphen and dash range (U+2010 to U+2015). */
const DASHES = /[-\u2010-\u2015]/g;

/** Everything except lowercase letters, digits, whitespace and straight apostrophes. */
const DISALLOWED = /[^a-z0-9\s']/g;

/**
 * Normalise text for answer comparison.
 *
 * 1. Lowercase.
 * 2. Curly apostrophes become straight ("New Year’s" -> "new year's").
 * 3. Hyphens and dashes become spaces ("twenty-seven" -> "twenty seven").
 * 4. Every other character except letters, digits, spaces and apostrophes is removed.
 * 5. Apostrophes are trimmed from the ends of each word; whitespace is collapsed.
 *
 * The output contains only a-z, 0-9, apostrophes and single spaces, so
 * normalise(normalise(x)) === normalise(x).
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(DASHES, " ")
    .replace(DISALLOWED, "")
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 0)
    .join(" ");
}

/** Split text into normalised words. Returns [] for empty input. */
export function tokenise(text: string): string[] {
  const normalised = normalise(text);
  return normalised.length === 0 ? [] : normalised.split(" ");
}

/** Start indexes where `phrase` occurs as a contiguous run of whole tokens in `haystack`. */
function findSpanStarts(haystack: string[], phrase: string[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i + phrase.length <= haystack.length; i++) {
    let matches = true;
    for (let j = 0; j < phrase.length; j++) {
      if (haystack[i + j] !== phrase[j]) {
        matches = false;
        break;
      }
    }
    if (matches) starts.push(i);
  }
  return starts;
}

/**
 * True when `phrase` appears in `haystack` as a contiguous, ordered run of whole words.
 * Both inputs are normalised first. Because matching is on whole tokens, a phrase never
 * matches inside a longer word ("constitution" is not found in "constitutional").
 * An empty phrase returns true.
 */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const phraseTokens = tokenise(phrase);
  if (phraseTokens.length === 0) return true;
  return findSpanStarts(tokenise(haystack), phraseTokens).length > 0;
}

/**
 * Count how many distinct accepted answers the response contains.
 *
 * - Each distinct accepted answer counts at most once.
 * - Only non-overlapping token spans count: a word of the response supports at most one
 *   accepted answer. With ["speech", "freedom of speech"] the response "freedom of speech"
 *   counts 1, not 2.
 * - Empty accepted answers are ignored.
 *
 * The result is the maximum number of distinct accepted answers that can be assigned to
 * non-overlapping spans, found by exact search with pruning. Inputs are small, and the
 * result is deterministic.
 */
export function countMatchingPhrases(
  response: string,
  acceptedAnswers: readonly string[]
): number {
  const responseTokens = tokenise(response);

  const distinct = new Map<string, string[]>();
  for (const answer of acceptedAnswers) {
    const tokens = tokenise(answer);
    if (tokens.length > 0) distinct.set(tokens.join(" "), tokens);
  }

  const candidates = [...distinct.values()]
    .map((tokens) => ({
      length: tokens.length,
      starts: findSpanStarts(responseTokens, tokens),
    }))
    .filter((candidate) => candidate.starts.length > 0);

  const used: boolean[] = new Array<boolean>(responseTokens.length).fill(false);
  let best = 0;

  const isFree = (start: number, length: number): boolean => {
    for (let k = start; k < start + length; k++) {
      if (used[k]) return false;
    }
    return true;
  };

  const mark = (start: number, length: number, value: boolean): void => {
    for (let k = start; k < start + length; k++) used[k] = value;
  };

  const search = (index: number, count: number): void => {
    if (count > best) best = count;
    if (index === candidates.length) return;
    // Even matching every remaining candidate cannot beat the best found so far.
    if (count + (candidates.length - index) <= best) return;

    const candidate = candidates[index]!;
    for (const start of candidate.starts) {
      if (isFree(start, candidate.length)) {
        mark(start, candidate.length, true);
        search(index + 1, count + 1);
        mark(start, candidate.length, false);
      }
    }
    search(index + 1, count);
  };

  search(0, 0);
  return best;
}
