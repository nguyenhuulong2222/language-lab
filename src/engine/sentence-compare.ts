/**
 * src/engine/sentence-compare.ts
 *
 * Compares what the user said or typed with a practice sentence, following the USCIS scoring
 * guidelines for the reading and writing portions as closely as a text comparison can
 * (USCIS Policy Manual, Vol. 12, Part E, Ch. 2; saved in data/sources/; quoted in the spec, BS-22):
 *
 *   reading: "the alien must read all content words but may omit short words or make pronunciation
 *   or intonation errors that do not interfere with the meaning"; failing: "Omits a content word or
 *   substitutes another word for a content word".
 *   writing: spelling, capitalization and punctuation errors do not fail unless they interfere with
 *   the meaning; "Omitted short words that do not interfere with meaning" are allowed; "A different
 *   sentence or words" fails.
 *
 * The rule here:
 *  - Words come from the matcher tokeniser: case, punctuation and hyphens are ignored and a number
 *    in words equals the numeral ("fifty" = "50").
 *  - A plural or possessive ending (-s, -es, 's) does not make a different word. Two different words
 *    are never equated (see sameInflection and its tests).
 *  - Short words (the "Other (Function)" words of the official lists, from the config) may be missing
 *    or extra.
 *  - Every content word of the sentence must be present, in order. A missing or substituted content
 *    word does not count. A few extra content words (config) are allowed.
 *  - Writing only: a spelling slip counts as that word when the first letter is right, the typed word is
 *    not itself a different word of the official vocabulary, and the letters that differ (wrong, missing,
 *    extra or two swapped) are within the limit for the word's length (`spellingSlips`, from the config).
 *    Capital letters and punctuation are never compared.
 * Nothing here is a threshold: every setting comes in through `MatchOptions` (data/practice/practice-config.json).
 * Pauses, pronunciation and whether an officer would understand cannot be judged from text.
 *
 * Pure module: no DOM, no network.
 */
import { matchTokens } from "./answer-normaliser.js";

export interface MatchOptions {
  /** Short words: may be missing or extra. Lower case. */
  functionWords: ReadonlySet<string>;
  /** Words that are never shortened (names and words that end in s). Lower case. */
  neverStem: ReadonlySet<string>;
  /** Extra content words that do not stop an attempt from counting. */
  extraContentWordsAllowed: number;
  /** Accept spelling slips within `spellingSlips` (writing). */
  spellingTolerance: boolean;
  /** From a word length on, how many letters may differ. Shortest first. Default: one letter from 5 letters. */
  spellingSlips?: ReadonlyArray<{ fromLetters: number; maxEdits: number }>;
  /** Words of the official vocabulary: a typed word that is one of them is never read as a misspelling. */
  knownWords?: ReadonlySet<string>;
}

export type NoteKind =
  /** Said "elect", the sentence has "elects": the same word. Still counts. */
  | "variant"
  /** Wrote "citzen", the sentence has "citizen". Still counts (writing). */
  | "spelling"
  /** Said or wrote one content word where the sentence has another. Does not count. */
  | "different"
  /** A content word of the sentence is missing. Does not count. */
  | "missing-content"
  /** A content word that is not in the sentence. */
  | "extra-content"
  /** A short word of the sentence is missing. Still counts. */
  | "missing-short"
  /** A short word that is not in the sentence. Still counts. */
  | "extra-short";

export interface MatchNote {
  kind: NoteKind;
  /** What was said or typed (variant, spelling, different, extra-*). */
  said?: string;
  /** What the sentence has (variant, spelling, different, missing-*). */
  expected?: string;
}

export interface SentenceComparison {
  /** Share of the sentence's content words that were matched, 0 to 1 (1 when it has none). For records only. */
  accuracy: number;
  /** Words matched in order (content and short words). */
  matchedWords: number;
  targetWords: number;
  attemptWords: number;
  contentWords: number;
  matchedContentWords: number;
  /** True when the attempt counts. */
  isCorrect: boolean;
  /** Plain facts for the feedback lines, in the order of the sentence. */
  notes: MatchNote[];
}

const DEFAULT_OPTIONS: MatchOptions = {
  functionWords: new Set(),
  neverStem: new Set(),
  extraContentWordsAllowed: 0,
  spellingTolerance: false,
};

/** A word without a possessive ending: "President's" -> "president", "presidents'" -> "presidents". */
function withoutPossessive(word: string): string {
  const w = word.toLowerCase();
  if (w.endsWith("'s") || w.endsWith("’s")) return w.slice(0, -2);
  if (w.endsWith("s'") || w.endsWith("s’")) return w.slice(0, -1);
  return w;
}

/**
 * True when two words are the same word apart from a plural or possessive ending: "elect" and
 * "elects", "tax" and "taxes", "city" and "cities", "state" and "States", "President's" and
 * "presidents". It compares the two words directly (one is the other plus "s", "es" or "ies" for "y"),
 * so it never shortens a word on its own and cannot turn two different words into one. Words of 2
 * letters or fewer, numbers, a plural that would end in "ss", and the words in `neverStem` (names and
 * words that already end in s, such as "news") are only equal when they are identical.
 */
export function sameInflection(a: string, b: string, neverStem: ReadonlySet<string> = new Set()): boolean {
  const x = withoutPossessive(a);
  const y = withoutPossessive(b);
  if (x === y) return true;
  if (/\d/.test(x) || /\d/.test(y)) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length < 3 || neverStem.has(short) || neverStem.has(long)) return false;
  if (long === `${short}s`) return !long.endsWith("ss");
  if (long === `${short}es`) return /(s|x|z|ch|sh|o)$/.test(short);
  if (short.endsWith("y") && long === `${short.slice(0, -1)}ies`) return short.length > 3;
  return false;
}

/**
 * Letters that differ between two words: changed, inserted, missing, or two neighbouring letters
 * swapped (optimal string alignment distance). Stops early once `limit` is passed.
 */
function lettersApart(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => {
    const row = new Array<number>(b.length + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      best = Math.min(best, v);
    }
    if (best > limit) return limit + 1;
  }
  return d[a.length]![b.length]!;
}
const DEFAULT_SLIPS = [{ fromLetters: 5, maxEdits: 1 }] as const;
/** How many letters may differ in a word of this length (0: it must be exact). */
function slipsAllowed(length: number, slips: ReadonlyArray<{ fromLetters: number; maxEdits: number }>): number {
  let allowed = 0;
  for (const slip of slips) if (length >= slip.fromLetters) allowed = slip.maxEdits;
  return allowed;
}
interface Token {
  /** As said or written (lower case). */
  raw: string;
}

function tokensOf(text: string): Token[] {
  return matchTokens(text).map((raw) => ({ raw }));
}

/** Same word (after plural and possessive endings), or, when allowed, a one-letter spelling error. */
function sameWord(target: Token, said: Token, options: MatchOptions): "same" | "variant" | "spelling" | null {
  if (target.raw === said.raw) return "same";
  if (sameInflection(target.raw, said.raw, options.neverStem)) return "variant";
  if (options.spellingTolerance && said.raw.length >= 3 && target.raw[0] === said.raw[0] && !/\d/.test(said.raw + target.raw)) {
    const allowed = slipsAllowed(target.raw.length, options.spellingSlips ?? DEFAULT_SLIPS);
    if (allowed > 0 && !options.knownWords?.has(said.raw) && lettersApart(target.raw, said.raw, allowed) <= allowed) return "spelling";
  }
  return null;
}

const isShort = (token: Token, options: MatchOptions): boolean => options.functionWords.has(token.raw);

export function compareSentence(
  target: string,
  attempt: string,
  options: MatchOptions = DEFAULT_OPTIONS
): SentenceComparison {
  const a = tokensOf(target);
  const b = tokensOf(attempt);
  const eq = (i: number, j: number) => sameWord(a[i]!, b[j]!, options) !== null;

  // Longest common run of words in order (gaps allowed).
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] = eq(i, j) ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const pairs: Array<[number, number]> = [];
  {
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (eq(i, j) && table[i]![j] === table[i + 1]![j + 1]! + 1) {
        pairs.push([i, j]);
        i++;
        j++;
      } else if (table[i + 1]![j]! >= table[i]![j + 1]!) i++;
      else j++;
    }
  }

  const notes: MatchNote[] = [];
  let missingContent = 0;
  let extraContent = 0;

  /** The words between two matches (or before the first / after the last). */
  const gap = (i0: number, i1: number, j0: number, j1: number) => {
    const t = [] as number[];
    const s = [] as number[];
    for (let i = i0; i < i1; i++) t.push(i);
    for (let j = j0; j < j1; j++) s.push(j);
    const tContent = t.filter((i) => !isShort(a[i]!, options));
    const sContent = s.filter((j) => !isShort(b[j]!, options));
    const paired = Math.min(tContent.length, sContent.length);
    const pairedT = new Set(tContent.slice(0, paired));
    const pairedS = new Set(sContent.slice(0, paired));
    for (const i of t) {
      if (isShort(a[i]!, options)) notes.push({ kind: "missing-short", expected: a[i]!.raw });
      else if (pairedT.has(i)) {
        const j = sContent[tContent.indexOf(i)]!;
        notes.push({ kind: "different", said: b[j]!.raw, expected: a[i]!.raw });
        missingContent++;
      } else {
        notes.push({ kind: "missing-content", expected: a[i]!.raw });
        missingContent++;
      }
    }
    for (const j of s) {
      if (isShort(b[j]!, options)) notes.push({ kind: "extra-short", said: b[j]!.raw });
      else if (!pairedS.has(j)) {
        notes.push({ kind: "extra-content", said: b[j]!.raw });
        extraContent++;
      }
    }
  };

  let ti = 0;
  let sj = 0;
  for (const [i, j] of pairs) {
    gap(ti, i, sj, j);
    const kind = sameWord(a[i]!, b[j]!, options);
    if (kind === "variant") notes.push({ kind: "variant", said: b[j]!.raw, expected: a[i]!.raw });
    else if (kind === "spelling") notes.push({ kind: "spelling", said: b[j]!.raw, expected: a[i]!.raw });
    ti = i + 1;
    sj = j + 1;
  }
  gap(ti, a.length, sj, b.length);

  const contentWords = a.filter((t) => !isShort(t, options)).length;
  const matchedContentWords = contentWords - missingContent;
  const accuracy = contentWords === 0 ? (pairs.length === a.length && a.length > 0 ? 1 : 0) : matchedContentWords / contentWords;
  const isCorrect =
    b.length > 0 &&
    a.length > 0 &&
    missingContent === 0 &&
    extraContent <= options.extraContentWordsAllowed &&
    (contentWords > 0 || pairs.length === a.length);
  return {
    accuracy,
    matchedWords: pairs.length,
    targetWords: a.length,
    attemptWords: b.length,
    contentWords,
    matchedContentWords,
    isCorrect,
    notes,
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
