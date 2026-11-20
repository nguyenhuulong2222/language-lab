/**
 * src/engine/practice-config.ts
 *
 * Practice settings that are NOT USCIS rules (data/practice/practice-config.json).
 * How a spoken or typed sentence is scored here follows the USCIS guidelines for the reading and
 * writing portions as closely as a text comparison can (see data/sources/ and spec BS-22), but the
 * settings are a Language Lab choice, and the screens say so. No component holds this number.
 *
 * Pure module: no DOM, no network.
 */
import RAW from "../../data/practice/practice-config.json" with { type: "json" };
import type { MatchOptions } from "./sentence-compare.js";

export interface SentenceMatchConfig {
  /** Extra content words that do not stop an attempt from counting (0 or more). */
  extraContentWordsAllowed: number;
  /** Accept spelling slips within `spellingSlips` (writing). */
  spellingTolerance: boolean;
}
/** From a word length on, how many letters may be wrong, missing, extra or swapped. */
export interface SpellingSlip {
  fromLetters: number;
  maxEdits: number;
}
export interface PracticeConfig {
  sentenceMatch: {
    /** Short words that may be missing or extra: the "Other (Function)" words of the USCIS lists. */
    functionWords: string[];
    /** Words that are never shortened by the plural and possessive rule. */
    neverStem: string[];
    /** Spelling slip limits by word length, shortest first (writing). */
    spellingSlips: SpellingSlip[];
    reading: SentenceMatchConfig;
    writing: SentenceMatchConfig;
  };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function words(value: unknown, where: string): string[] {
  if (!Array.isArray(value) || !value.every((w) => typeof w === "string" && w.trim() !== "" && w === w.toLowerCase())) {
    throw new Error(`practice-config: ${where} must be an array of lower case words.`);
  }
  return value as string[];
}
function parseMatch(value: unknown, where: string): SentenceMatchConfig {
  if (!isRecord(value)) throw new Error(`practice-config: ${where} must be an object.`);
  const extra = value["extraContentWordsAllowed"];
  if (typeof extra !== "number" || !Number.isInteger(extra) || extra < 0 || extra > 3) {
    throw new Error(`practice-config: ${where}.extraContentWordsAllowed must be a whole number from 0 to 3.`);
  }
  const spelling = value["spellingTolerance"];
  if (typeof spelling !== "boolean") throw new Error(`practice-config: ${where}.spellingTolerance must be true or false.`);
  return { extraContentWordsAllowed: extra, spellingTolerance: spelling };
}
function parseSlips(value: unknown): SpellingSlip[] {
  const where = "practice-config: sentenceMatch.spellingSlips";
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${where} must be a non-empty array.`);
  let previous = 0;
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${where}[${index}] must be an object.`);
    const from = entry["fromLetters"];
    const max = entry["maxEdits"];
    if (typeof from !== "number" || !Number.isInteger(from) || from < 3 || from <= previous) {
      throw new Error(`${where}[${index}].fromLetters must be a whole number of 3 or more, larger than the one before.`);
    }
    if (typeof max !== "number" || !Number.isInteger(max) || max < 1 || max > 3) {
      throw new Error(`${where}[${index}].maxEdits must be a whole number from 1 to 3.`);
    }
    previous = from;
    return { fromLetters: from, maxEdits: max };
  });
}
export function parsePracticeConfig(raw: unknown): PracticeConfig {
  if (!isRecord(raw)) throw new Error("practice-config: file must be a JSON object.");
  if (typeof raw["needsHumanReview"] !== "boolean") {
    throw new Error("practice-config: needsHumanReview must be true or false.");
  }
  const match = raw["sentenceMatch"];
  if (!isRecord(match)) throw new Error("practice-config: sentenceMatch must be an object.");
  return {
    sentenceMatch: {
      functionWords: words(match["functionWords"], "sentenceMatch.functionWords"),
      neverStem: words(match["neverStem"], "sentenceMatch.neverStem"),
      spellingSlips: parseSlips(match["spellingSlips"]),
      reading: parseMatch(match["reading"], "sentenceMatch.reading"),
      writing: parseMatch(match["writing"], "sentenceMatch.writing"),
    },
  };
}
/**
 * The options `compareSentence` needs for reading or writing, from the config.
 * `knownWords` are the words of the official vocabulary lists (for the spelling rule).
 */
export function matchOptionsFor(
  config: PracticeConfig,
  kind: "reading" | "writing",
  knownWords?: ReadonlySet<string>
): MatchOptions {
  const m = config.sentenceMatch;
  return {
    functionWords: new Set(m.functionWords),
    neverStem: new Set(m.neverStem),
    extraContentWordsAllowed: m[kind].extraContentWordsAllowed,
    spellingTolerance: m[kind].spellingTolerance,
    spellingSlips: m.spellingSlips,
    ...(knownWords === undefined ? {} : { knownWords }),
  };
}
export function loadPracticeConfig(): PracticeConfig {
  return parsePracticeConfig(RAW);
}
