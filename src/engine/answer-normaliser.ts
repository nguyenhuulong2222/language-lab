/**
 * src/engine/answer-normaliser.ts
 *
 * Normalisation and whole-word phrase matching for civics answer scoring.
 * Pure module: no DOM, no network, no side effects.
 *
 * This is the engine's own implementation. It does not import from tools/.
 *
 * Matching rules:
 * - Whole words only: a phrase never matches inside a longer word.
 * - A leading "the", "a" or "an" in an accepted answer is optional.
 * - A number in an accepted answer must stand alone: it does not match when the response
 *   continues the number ("one hundred and one", "one hundred one", "twenty two" for "two").
 * - Overlapping matches never count twice.
 */

/** Curly and look-alike apostrophes that must map to a straight apostrophe. */
const APOSTROPHE_VARIANTS = /[\u2018\u2019\u201B\u2032\u00B4`]/g;

/** Hyphen-minus and the Unicode hyphen and dash range (U+2010 to U+2015). */
const DASHES = /[-\u2010-\u2015]/g;

/** Everything except lowercase letters, digits, whitespace and straight apostrophes. */
const DISALLOWED = /[^a-z0-9\s']/g;

/** Articles that may be left out when an accepted answer starts with one. */
const OPTIONAL_LEADING_ARTICLES: ReadonlySet<string> = new Set(["the", "a", "an"]);

/** Spelled-out cardinal numbers, as they appear in normalised text. */
const NUMBER_WORDS: ReadonlySet<string> = new Set([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty",
  "sixty", "seventy", "eighty", "ninety", "hundred", "thousand", "million", "billion",
]);

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

/** True for a spelled-out cardinal number word ("six", "hundred") or a numeral ("27"). */
export function isNumberToken(token: string): boolean {
  return NUMBER_WORDS.has(token) || /^[0-9]+$/.test(token);
}

interface Span {
  start: number;
  length: number;
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
 * True when the response carries a number on past the matched span, which means the
 * accepted number was only part of a longer number.
 *
 * - If the span ends in a number token and the next token (skipping one "and") is also a
 *   number token, the number continues: "one hundred [and] one".
 * - If the span starts with a number token and the token before it (skipping one "and")
 *   is also a number token, the number began earlier: "twenty two" for "two".
 */
function continuesNumber(haystack: string[], span: Span): boolean {
  const first = haystack[span.start]!;
  const last = haystack[span.start + span.length - 1]!;

  if (isNumberToken(last)) {
    let next = span.start + span.length;
    if (haystack[next] === "and") next += 1;
    const token = haystack[next];
    if (token !== undefined && isNumberToken(token)) return true;
  }

  if (isNumberToken(first)) {
    let previous = span.start - 1;
    if (haystack[previous] === "and") previous -= 1;
    const token = previous >= 0 ? haystack[previous] : undefined;
    if (token !== undefined && isNumberToken(token)) return true;
  }

  return false;
}

/**
 * Every place a phrase can match in the response, as token spans.
 * Includes the shorter form without a leading "the", "a" or "an", and drops spans that
 * continue a number.
 */
function findSpans(haystack: string[], phrase: string[]): Span[] {
  const forms: string[][] = [phrase];
  if (phrase.length > 1 && OPTIONAL_LEADING_ARTICLES.has(phrase[0]!)) {
    forms.push(phrase.slice(1));
  }

  const spans = new Map<string, Span>();
  for (const form of forms) {
    for (const start of findSpanStarts(haystack, form)) {
      const span = { start, length: form.length };
      if (!continuesNumber(haystack, span)) {
        spans.set(`${span.start}:${span.length}`, span);
      }
    }
  }
  return [...spans.values()];
}

/**
 * True when `phrase` appears in `haystack` as a contiguous, ordered run of whole words.
 * Both inputs are normalised first. Because matching is on whole tokens, a phrase never
 * matches inside a longer word ("constitution" is not found in "constitutional").
 * A leading "the", "a" or "an" in the phrase is optional, and a number does not match when
 * the response continues it. An empty phrase returns true.
 */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const phraseTokens = tokenise(phrase);
  if (phraseTokens.length === 0) return true;
  return findSpans(tokenise(haystack), phraseTokens).length > 0;
}

/**
 * Count how many distinct accepted answers the response contains.
 *
 * - Each distinct accepted answer counts at most once.
 * - Only non-overlapping token spans count: a word of the response supports at most one
 *   accepted answer. With ["speech", "freedom of speech"] the response "freedom of speech"
 *   counts 1, not 2.
 * - Matching follows the rules in the file header (whole words, optional leading article,
 *   numbers that continue do not match).
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
    .map((tokens) => findSpans(responseTokens, tokens))
    .filter((spans) => spans.length > 0);

  const used: boolean[] = new Array<boolean>(responseTokens.length).fill(false);
  let best = 0;

  const isFree = (span: Span): boolean => {
    for (let k = span.start; k < span.start + span.length; k++) {
      if (used[k]) return false;
    }
    return true;
  };

  const mark = (span: Span, value: boolean): void => {
    for (let k = span.start; k < span.start + span.length; k++) used[k] = value;
  };

  const search = (index: number, count: number): void => {
    if (count > best) best = count;
    if (index === candidates.length) return;
    // Even matching every remaining candidate cannot beat the best found so far.
    if (count + (candidates.length - index) <= best) return;

    for (const span of candidates[index]!) {
      if (isFree(span)) {
        mark(span, true);
        search(index + 1, count + 1);
        mark(span, false);
      }
    }
    search(index + 1, count);
  };

  search(0, 0);
  return best;
}
