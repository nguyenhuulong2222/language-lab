/**
 * src/engine/practice-config.ts
 *
 * Practice settings that are NOT USCIS rules (data/practice/practice-config.json).
 * How close a spoken or typed sentence must be to count as correct here is a Language Lab
 * choice, and the screens say so. No component holds this number.
 *
 * Pure module: no DOM, no network.
 */
import RAW from "../../data/practice/practice-config.json" with { type: "json" };

export interface SentenceMatchConfig {
  /** Share of words that must match, above 0 and at most 1. */
  minWordAccuracy: number;
}

export interface PracticeConfig {
  sentenceMatch: {
    reading: SentenceMatchConfig;
    writing: SentenceMatchConfig;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMatch(value: unknown, where: string): SentenceMatchConfig {
  if (!isRecord(value)) throw new Error(`practice-config: ${where} must be an object.`);
  const accuracy = value["minWordAccuracy"];
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy <= 0 || accuracy > 1) {
    throw new Error(`practice-config: ${where}.minWordAccuracy must be a number above 0 and at most 1.`);
  }
  return { minWordAccuracy: accuracy };
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
      reading: parseMatch(match["reading"], "sentenceMatch.reading"),
      writing: parseMatch(match["writing"], "sentenceMatch.writing"),
    },
  };
}

export function loadPracticeConfig(): PracticeConfig {
  return parsePracticeConfig(RAW);
}
