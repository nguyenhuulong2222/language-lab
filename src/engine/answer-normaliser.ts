/**
 * src/engine/answer-normaliser.ts
 *
 * Normalisation and whole-word phrase matching for civics answer scoring.
 * Pure module: no DOM, no network, no side effects.
 *
 * This is the engine's own implementation. It does not import from tools/.
 *
 * Matching rules (all of them live here, in the matcher, not in the answer data):
 * - Whole words only: a phrase never matches inside a longer word.
 * - A leading "the", "a" or "an" in an accepted answer is optional.
 * - Digits and words are the same number: "13" = "thirteen", "27" = "twenty-seven",
 *   "14th" = "fourteenth", "22nd" = "twenty-second". Both sides are turned into numerals
 *   before they are compared.
 * - An accepted answer that is a number with a unit ("six years") is also matched by the
 *   number alone ("six", "6").
 * - A number must stand alone: it does not match when the response continues it
 *   ("one hundred and one", "one hundred one"), or when it began earlier ("twenty two" for
 *   "two").
 * - Overlapping matches never count twice.
 *
 * - Years: when an accepted answer contains a 4-digit year (1000-2099), the response's two-group
 *   readings are joined into a year: "nineteen twenty" = 1920, "seventeen seventy-six" = 1776,
 *   "twenty oh one" = 2001. ("two thousand one" is already read as 2001.) Other answers are
 *   unaffected.
 * - Dates: an ordinal right after a month is the same as the cardinal ("July fourth" = "July 4"),
 *   and "<ordinal> of <month>" is "<month> <cardinal>".
 * - A leading "because" or "because of" in an accepted answer is optional, as articles are.
 * - Alternative names that belong to one marker group count as ONE answer (see `groups`).
 * - A bare number is accepted for an answer only when the answer is listed in `numberAlone`.
 * - Sentence answers (`sentence`) are matched by their content words in order, as the reading
 *   rule matches a sentence; function words and -s, -es, 's endings do not matter.
 * - A source line that lists items ("Democratic and Republican") may, where the project owner
 *   decided so, be said with the items in any order; every item is still required (`anyOrder`).
 */

/** Curly and look-alike apostrophes that must map to a straight apostrophe. */
const APOSTROPHE_VARIANTS = /[\u2018\u2019\u201B\u2032\u00B4`]/g;

/** Hyphen-minus and the Unicode hyphen and dash range (U+2010 to U+2015). */
const DASHES = /[-\u2010-\u2015]/g;

/** Everything except lowercase letters, digits, whitespace and straight apostrophes. */
const DISALLOWED = /[^a-z0-9\s']/g;

/** Articles that may be left out when an accepted answer starts with one. */
const OPTIONAL_LEADING_ARTICLES: ReadonlySet<string> = new Set(["the", "a", "an"]);

/** Units after which a bare number is accepted: "six years" is also matched by "six". */
const UNIT_WORDS: ReadonlySet<string> = new Set([
  "year", "years", "month", "months", "week", "weeks", "day", "days",
]);

/** Large number words that are only recognised as numbers, never converted to numerals. */
const LARGE_NUMBER_WORDS: ReadonlySet<string> = new Set(["million", "billion"]);

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

// ---------------------------------------------------------------------------
// Numbers: words <-> numerals
// ---------------------------------------------------------------------------

/** Word kinds: Z zero, U units 1-9, T teens 10-19, D tens 20-90, H hundred, K thousand. */
type NumberKind = "Z" | "U" | "T" | "D" | "H" | "K";

interface NumberWord {
  kind: NumberKind;
  value: number;
  ordinal: boolean;
}

const NUMBER_WORDS: ReadonlyMap<string, NumberWord> = (() => {
  const map = new Map<string, NumberWord>();
  const add = (words: string, kind: NumberKind, first: number, step: number, ordinal: boolean) => {
    words.split(" ").forEach((word, index) => {
      map.set(word, { kind, value: first + index * step, ordinal });
    });
  };
  add("zero", "Z", 0, 1, false);
  add("one two three four five six seven eight nine", "U", 1, 1, false);
  add("ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen", "T", 10, 1, false);
  add("twenty thirty forty fifty sixty seventy eighty ninety", "D", 20, 10, false);
  add("hundred", "H", 100, 1, false);
  add("thousand", "K", 1000, 1, false);
  add("first second third fourth fifth sixth seventh eighth ninth", "U", 1, 1, true);
  add("tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth", "T", 10, 1, true);
  add("twentieth thirtieth fortieth fiftieth sixtieth seventieth eightieth ninetieth", "D", 20, 10, true);
  add("hundredth", "H", 100, 1, true);
  add("thousandth", "K", 1000, 1, true);
  return map;
})();

interface NumberState {
  /** Completed thousands. */
  total: number;
  /** The part below one thousand that is being built. */
  current: number;
  last: NumberKind | "S";
  hundredUsed: boolean;
  thousandUsed: boolean;
}

const START: NumberState = { total: 0, current: 0, last: "S", hundredUsed: false, thousandUsed: false };

/**
 * Add one number word to a number being read, or return null if the word cannot continue it
 * ("twenty two" continues, "twenty thirty", "one two" and "one hundred hundred" do not).
 */
function advance(state: NumberState, word: NumberWord): NumberState | null {
  const { last } = state;
  if (last === "Z") return null;
  switch (word.kind) {
    case "Z":
      return last === "S" ? { ...state, last: "Z" } : null;
    case "U":
      return last === "S" || last === "H" || last === "K" || last === "D"
        ? { ...state, current: state.current + word.value, last: "U" }
        : null;
    case "T":
    case "D":
      return last === "S" || last === "H" || last === "K"
        ? { ...state, current: state.current + word.value, last: word.kind }
        : null;
    case "H":
      return (last === "S" || last === "U" || last === "T") && !state.hundredUsed && state.current < 20
        ? { ...state, current: (state.current === 0 ? 1 : state.current) * 100, hundredUsed: true, last: "H" }
        : null;
    case "K":
      return (last === "S" || last === "U" || last === "T" || last === "D" || last === "H") &&
        !state.thousandUsed
        ? {
            total: state.total + (state.current === 0 ? 1 : state.current) * 1000,
            current: 0,
            last: "K",
            hundredUsed: false,
            thousandUsed: true,
          }
        : null;
  }
}

function ordinalSuffix(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * Replace number words with numerals: "twenty seven" -> "27", "fourteenth" -> "14th",
 * "four hundred thirty five" -> "435". Words that do not form one valid number stay
 * separate numbers ("one two" -> "1", "2"). "and" is never absorbed: "one hundred and one"
 * -> "100", "and", "1".
 */
function convertNumbers(tokens: readonly string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const first = NUMBER_WORDS.get(tokens[i]!);
    if (!first) {
      out.push(tokens[i]!);
      i += 1;
      continue;
    }
    let state = START;
    let consumed = 0;
    let ordinal = false;
    while (i + consumed < tokens.length) {
      const word = NUMBER_WORDS.get(tokens[i + consumed]!);
      if (!word) break;
      const next = advance(state, word);
      if (!next) break;
      state = next;
      consumed += 1;
      if (word.ordinal) {
        ordinal = true;
        break;
      }
    }
    const value = state.total + state.current;
    out.push(ordinal ? `${value}${ordinalSuffix(value)}` : String(value));
    i += consumed;
  }
  return out;
}

/**
 * Words of a text as the matcher sees them: normalised, with number words turned into
 * numerals. "Twenty-seven amendments" -> ["27", "amendments"].
 */
export function matchTokens(text: string): string[] {
  return convertNumbers(tokenise(text));
}

/** True for a spelled-out cardinal number word ("six", "hundred") or a numeral ("27"). */
export function isNumberToken(token: string): boolean {
  const word = NUMBER_WORDS.get(token);
  return (
    (word !== undefined && !word.ordinal) || LARGE_NUMBER_WORDS.has(token) || /^[0-9]+$/.test(token)
  );
}

/**
 * True for anything the matcher reads as a number: cardinal or ordinal words, numerals,
 * and ordinal numerals ("14th"). Tests use it to build filler words that cannot join a number.
 */
export function isNumberLikeToken(token: string): boolean {
  return (
    NUMBER_WORDS.has(token) || LARGE_NUMBER_WORDS.has(token) || /^[0-9]+(?:st|nd|rd|th)?$/.test(token)
  );
}

// ---------------------------------------------------------------------------
// Finding phrases
// ---------------------------------------------------------------------------

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
 *
 * Runs on the converted tokens, so "twenty two" has already become the single number 22.
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

/** Months, for the date rules. */
const MONTHS: ReadonlySet<string> = new Set([
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
]);

const ORDINAL_NUMERAL = /^([0-9]+)(?:st|nd|rd|th)$/;

/** Date rules: "july 4th" -> "july 4"; "4th of july" -> "july 4". */
function normaliseDates(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const ordinal = ORDINAL_NUMERAL.exec(token);
    if (ordinal && tokens[i + 1] === "of" && MONTHS.has(tokens[i + 2] ?? "")) {
      out.push(tokens[i + 2]!, ordinal[1]!);
      i += 2;
      continue;
    }
    if (ordinal && i > 0 && MONTHS.has(tokens[i - 1]!)) {
      out.push(ordinal[1]!);
      continue;
    }
    out.push(token);
  }
  return out;
}

const YEAR_TOKEN = /^(?:1[0-9]{3}|20[0-9]{2})$/;

/** Join two-group year readings: [19, 20] -> 1920, [20, "oh", 1] -> 2001. */
function mergeYears(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i]!;
    const b = tokens[i + 1];
    if (/^(?:1[0-9]|20)$/.test(a) && b !== undefined) {
      if (/^[1-9][0-9]$/.test(b)) {
        out.push(a + b);
        i += 1;
        continue;
      }
      const c = tokens[i + 2];
      if (b === "oh" && c !== undefined && /^[1-9]$/.test(c)) {
        out.push(a + "0" + c);
        i += 2;
        continue;
      }
    }
    out.push(a);
  }
  return out;
}

/** Tokens as the matcher compares them: numerals, date rules, and optionally year joining. */
function prepare(text: string, yearAware: boolean): string[] {
  const tokens = normaliseDates(matchTokens(text));
  return yearAware ? mergeYears(tokens) : tokens;
}

/**
 * The shorter forms of an accepted answer that also count.
 * - Without a leading "because of" or "because", and without a leading "the", "a" or "an".
 * - A number with a unit ("6 years") is also matched by the number alone ("6").
 * - With `numberAlone`: an answer that holds exactly one number is also matched by that
 *   number alone ("14th amendment" -> "14th" and "14").
 */
function alternativeForms(phrase: string[], numberAlone: boolean): string[][] {
  const bases: string[][] = [phrase];
  if (phrase[0] === "because" && phrase[1] === "of" && phrase.length > 2) {
    bases.push(phrase.slice(2));
  } else if (phrase[0] === "because" && phrase.length > 1) {
    bases.push(phrase.slice(1));
  }
  const forms: string[][] = [];
  for (const base of bases) {
    forms.push(base);
    if (base.length > 1 && OPTIONAL_LEADING_ARTICLES.has(base[0]!)) forms.push(base.slice(1));
  }
  for (const form of [...forms]) {
    if (form.length === 2 && /^[0-9]+$/.test(form[0]!) && UNIT_WORDS.has(form[1]!)) {
      forms.push([form[0]!]);
    }
  }
  if (numberAlone) {
    const numeric = phrase.filter((t) => /^[0-9]+(?:st|nd|rd|th)?$/.test(t));
    if (numeric.length === 1) {
      forms.push([numeric[0]!]);
      const ord = ORDINAL_NUMERAL.exec(numeric[0]!);
      if (ord) forms.push([ord[1]!]);
    }
  }
  return forms;
}

/**
 * Every place a phrase can match in the response, as token spans. Both inputs are already
 * converted. Spans that continue a number are dropped.
 */
function findSpans(haystack: string[], phrase: string[], numberAlone = false): Span[] {
  const spans = new Map<string, Span>();
  for (const form of alternativeForms(phrase, numberAlone)) {
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
 * Both inputs are normalised and their number words are turned into numerals first, so
 * "thirteen" matches "13". Because matching is on whole tokens, a phrase never matches
 * inside a longer word ("constitution" is not found in "constitutional"). A leading
 * "the", "a" or "an" in the phrase is optional, a number with a unit is also matched by the
 * number alone, and a number does not match when the response continues it. An empty
 * phrase returns true.
 */
export function containsPhrase(haystack: string, phrase: string): boolean {
  const yearAware = matchTokens(phrase).some((t) => YEAR_TOKEN.test(t));
  const phraseTokens = prepare(phrase, yearAware);
  if (phraseTokens.length === 0) return true;
  return findSpans(prepare(haystack, yearAware), phraseTokens).length > 0;
}

/**
 * Count how many distinct accepted answers the response contains.
 *
 * - Each distinct accepted answer counts at most once. Answers that are the same after
 *   number words become numerals ("twenty seven" and "27") are one answer.
 * - Only non-overlapping token spans count: a word of the response supports at most one
 *   accepted answer. With ["speech", "freedom of speech"] the response "freedom of speech"
 *   counts 1, not 2.
 * - Matching follows the rules in the file header.
 * - Empty accepted answers are ignored.
 *
 * The result is the maximum number of distinct accepted answers that can be assigned to
 * non-overlapping spans, found by exact search with pruning. Inputs are small, and the
 * result is deterministic.
 */
export interface MatchOptions {
  /**
   * Groups of accepted answers that are alternative names for ONE answer. Members are strings
   * from `acceptedAnswers`. A group counts at most once, however many members the response has.
   */
  groups?: readonly (readonly string[])[];
  /** Accepted answers for which the bare number alone is also accepted. */
  numberAlone?: readonly string[];
  /**
   * Source lines that list items which may be said in any order ("Senate and House (of
   * Representatives)"). `answers` are the accepted answers of that line (they count as ONE
   * answer); the line is also matched when every item is in the response, in any order, each
   * item by one of its forms. Items of different lines are never mixed.
   */
  anyOrder?: readonly AnyOrderLine[];
  /**
   * Sentence answers (the SENTENCE questions), matched the way the reading rule matches a
   * sentence: every content word of the accepted sentence must be in the response, in order;
   * other words may come between them. Function words (from the fixed list) may be missing or
   * added, and a plural or possessive ending does not make a different word (`sameWord`).
   * A missing or substituted content word fails. Absent: the accepted answers are phrases.
   */
  sentence?: SentenceRule;
}

export interface SentenceRule {
  /** Short words that may be missing or added. Lower case. */
  functionWords: ReadonlySet<string>;
  /** True when a word of the response is the same word as a word of the sentence ("state"/"states"). */
  sameWord: (expected: string, said: string) => boolean;
}

/**
 * Where a sentence answer is found in the response: for each start, the first in-order match of
 * its content words, skipping the response's function words. One span per matched word.
 */
function sentencePlacements(responseTokens: readonly string[], sentence: readonly string[], rule: SentenceRule): Placement[] {
  const placements = new Map<string, Placement>();
  for (const form of alternativeForms([...sentence], false)) {
    const content = form.filter((t) => !rule.functionWords.has(t));
    if (content.length === 0) continue;
    for (let start = 0; start < responseTokens.length; start++) {
      if (rule.functionWords.has(responseTokens[start]!) || !rule.sameWord(content[0]!, responseTokens[start]!)) continue;
      const spans: Span[] = [{ start, length: 1 }];
      let k = start + 1;
      for (let c = 1; c < content.length; c++) {
        while (k < responseTokens.length && (rule.functionWords.has(responseTokens[k]!) || !rule.sameWord(content[c]!, responseTokens[k]!))) k++;
        if (k === responseTokens.length) break;
        spans.push({ start: k, length: 1 });
        k++;
      }
      if (spans.length === content.length) placements.set(spans.map((s) => s.start).join(","), spans);
    }
  }
  return [...placements.values()];
}

export interface AnyOrderLine {
  answers: readonly string[];
  /** Each item: its accepted forms ("house", "house of representatives"). */
  items: readonly (readonly string[])[];
}

/** One way an answer is found in the response: the token spans it uses. */
type Placement = readonly Span[];

/** Most ways of placing one any-order line that are tried. The data has 2 or 3 short items. */
const MAX_PLACEMENTS = 256;

function overlaps(a: Span, b: Span): boolean {
  return a.start < b.start + b.length && b.start < a.start + a.length;
}

/** Every way to find all items at once, without two items sharing a word. */
function anyOrderPlacements(itemSpans: readonly (readonly Span[])[]): Placement[] {
  let partial: Span[][] = [[]];
  for (const spans of itemSpans) {
    const next: Span[][] = [];
    for (const chosen of partial) {
      for (const span of spans) {
        if (chosen.some((c) => overlaps(c, span))) continue;
        next.push([...chosen, span]);
        if (next.length >= MAX_PLACEMENTS) break;
      }
      if (next.length >= MAX_PLACEMENTS) break;
    }
    partial = next;
    if (partial.length === 0) return [];
  }
  return partial;
}

export function countMatchingPhrases(
  response: string,
  acceptedAnswers: readonly string[],
  options: MatchOptions = {}
): number {
  const yearAware = acceptedAnswers.some((a) => matchTokens(a).some((t) => YEAR_TOKEN.test(t)));
  const responseTokens = prepare(response, yearAware);

  const tokensOf = (answer: string): string[] => prepare(answer, yearAware);
  const bareNumber = new Set((options.numberAlone ?? []).map((a) => tokensOf(a).join(" ")));

  // Units: a group of alternative names, one any-order line, or one accepted answer. Keyed by
  // their phrases so that duplicates collapse.
  interface Unit {
    phrases: string[][];
    itemSets: (readonly (readonly string[])[])[];
  }
  const grouped = new Set<string>();
  const units = new Map<string, Unit>();
  const addUnit = (members: readonly string[], itemSets: Unit["itemSets"] = []): void => {
    const phrases = new Map<string, string[]>();
    for (const member of members) {
      const tokens = tokensOf(member);
      if (tokens.length > 0) phrases.set(tokens.join(" "), tokens);
    }
    if (phrases.size === 0 && itemSets.length === 0) return;
    const key = [...phrases.keys()].sort().join("|");
    const existing = units.get(key);
    if (existing) existing.itemSets.push(...itemSets);
    else units.set(key, { phrases: [...phrases.values()], itemSets: [...itemSets] });
  };
  for (const group of options.groups ?? []) {
    for (const member of group) grouped.add(member);
    addUnit(group);
  }
  for (const line of options.anyOrder ?? []) {
    const members = line.answers.filter((a) => !grouped.has(a));
    for (const member of members) grouped.add(member);
    addUnit(members, [line.items]);
  }
  for (const answer of acceptedAnswers) {
    if (!grouped.has(answer)) addUnit([answer]);
  }

  const candidates: Placement[][] = [...units.values()]
    .map((unit) => {
      const placements = new Map<string, Placement>();
      for (const tokens of unit.phrases) {
        for (const span of findSpans(responseTokens, tokens, bareNumber.has(tokens.join(" ")))) {
          placements.set(`${span.start}:${span.length}`, [span]);
        }
        if (options.sentence !== undefined) {
          for (const placement of sentencePlacements(responseTokens, tokens, options.sentence)) {
            placements.set(placement.map((s) => `${s.start}:${s.length}`).join(","), placement);
          }
        }
      }
      for (const items of unit.itemSets) {
        const itemSpans = items.map((forms) => {
          const spans = new Map<string, Span>();
          for (const form of forms) {
            const tokens = tokensOf(form);
            if (tokens.length === 0) continue;
            for (const span of findSpans(responseTokens, tokens)) spans.set(`${span.start}:${span.length}`, span);
          }
          return [...spans.values()];
        });
        for (const placement of anyOrderPlacements(itemSpans)) {
          placements.set(placement.map((s) => `${s.start}:${s.length}`).sort().join(","), placement);
        }
      }
      return [...placements.values()];
    })
    .filter((placements) => placements.length > 0);

  const used: boolean[] = new Array<boolean>(responseTokens.length).fill(false);
  let best = 0;

  const isFree = (placement: Placement): boolean =>
    placement.every((span) => {
      for (let k = span.start; k < span.start + span.length; k++) {
        if (used[k]) return false;
      }
      return true;
    });

  const mark = (placement: Placement, value: boolean): void => {
    for (const span of placement) for (let k = span.start; k < span.start + span.length; k++) used[k] = value;
  };

  const search = (index: number, count: number): void => {
    if (count > best) best = count;
    if (index === candidates.length) return;
    // Even matching every remaining candidate cannot beat the best found so far.
    if (count + (candidates.length - index) <= best) return;

    for (const placement of candidates[index]!) {
      if (isFree(placement)) {
        mark(placement, true);
        search(index + 1, count + 1);
        mark(placement, false);
      }
    }
    search(index + 1, count);
  };

  search(0, 0);
  return best;
}
