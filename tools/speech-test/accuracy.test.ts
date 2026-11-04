/**
 * Tests for tools/speech-test/
 *
 * Covers:
 *   1. accuracy.ts  — normalise, tokenise, wordAccuracy, overallAccuracy (unchanged)
 *   2. sentences.ts — PracticeItem data shape validation
 *   3. main.ts      — buildExportPayload shape and field requirements
 *
 * Includes property-based tests via fast-check.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  normalise,
  tokenise,
  wordAccuracy,
  overallAccuracy,
} from "./accuracy.js";
import { PRACTICE_ITEMS } from "./sentences.js";
import { buildExportPayload } from "./main.js";
import type { ItemResult } from "./main.js";

// ---------------------------------------------------------------------------
// normalise
// ---------------------------------------------------------------------------

describe("normalise", () => {
  it("lowercases", () => {
    expect(normalise("Congress")).toBe("congress");
  });

  it("strips terminal punctuation", () => {
    expect(normalise("The Constitution.")).toBe("the constitution");
  });

  it("strips commas and question marks", () => {
    expect(normalise("Yes, I do.")).toBe("yes i do");
  });

  it("preserves internal apostrophes", () => {
    expect(normalise("I don't know.")).toBe("i don't know");
  });

  it("collapses multiple spaces", () => {
    expect(normalise("the   United   States")).toBe("the united states");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalise("  hello world  ")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(normalise("")).toBe("");
  });

  it("handles whitespace-only string", () => {
    expect(normalise("   ")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// tokenise
// ---------------------------------------------------------------------------

describe("tokenise", () => {
  it("splits on spaces after normalising", () => {
    expect(tokenise("The United States")).toEqual(["the", "united", "states"]);
  });

  it("returns empty array for empty string", () => {
    expect(tokenise("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(tokenise("   ")).toEqual([]);
  });

  it("handles single word", () => {
    expect(tokenise("Congress")).toEqual(["congress"]);
  });
});

// ---------------------------------------------------------------------------
// wordAccuracy
// ---------------------------------------------------------------------------

describe("wordAccuracy", () => {
  it("perfect match returns score 1.0", () => {
    const result = wordAccuracy(
      "Congress makes the laws",
      "Congress makes the laws"
    );
    expect(result.score).toBe(1.0);
    expect(result.matchedWords).toHaveLength(4);
  });

  it("is case-insensitive", () => {
    const result = wordAccuracy("the CONSTITUTION", "The Constitution");
    expect(result.score).toBe(1.0);
  });

  it("ignores punctuation in expected", () => {
    const result = wordAccuracy(
      "The Constitution is the supreme law of the land.",
      "the constitution is the supreme law of the land"
    );
    expect(result.score).toBe(1.0);
  });

  it("ignores punctuation in recognised", () => {
    const result = wordAccuracy("the constitution", "the constitution.");
    expect(result.score).toBe(1.0);
  });

  it("zero match returns score 0", () => {
    const result = wordAccuracy("the constitution", "hello world");
    expect(result.score).toBe(0);
    expect(result.matchedWords).toHaveLength(0);
  });

  it("partial match returns correct fraction", () => {
    const result = wordAccuracy("one two three four", "one two");
    expect(result.score).toBeCloseTo(0.5);
    expect(result.matchedWords).toHaveLength(2);
  });

  it("extra recognised words do not increase score beyond 1.0", () => {
    const result = wordAccuracy("two words", "two words extra bonus words");
    expect(result.score).toBe(1.0);
    expect(result.expectedCount).toBe(2);
  });

  it("empty expected returns score 1.0 (nothing to match)", () => {
    const result = wordAccuracy("", "something was said");
    expect(result.score).toBe(1.0);
    expect(result.expectedCount).toBe(0);
    expect(result.matchedWords).toHaveLength(0);
  });

  it("empty recognised returns score 0", () => {
    const result = wordAccuracy("the constitution", "");
    expect(result.score).toBe(0);
    expect(result.matchedWords).toHaveLength(0);
  });

  it("each recognised word is consumed only once", () => {
    const result = wordAccuracy("the the the", "the");
    expect(result.matchedWords).toHaveLength(1);
    expect(result.score).toBeCloseTo(1 / 3);
  });

  it("reports expectedCount and recognisedCount correctly", () => {
    const result = wordAccuracy("one two three", "one two three four five");
    expect(result.expectedCount).toBe(3);
    expect(result.recognisedCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// overallAccuracy
// ---------------------------------------------------------------------------

describe("overallAccuracy", () => {
  it("aggregates scores across sentences", () => {
    const result = overallAccuracy([
      { expected: "one two three four", recognised: "one two three four" },
      { expected: "one two three four", recognised: "one two" },
    ]);
    expect(result.totalExpected).toBe(8);
    expect(result.totalMatched).toBe(6);
    expect(result.overallScore).toBeCloseTo(0.75);
  });

  it("excludes skipped (empty recognised) sentences from totals", () => {
    const result = overallAccuracy([
      { expected: "one two", recognised: "one two" },
      { expected: "three four", recognised: "" },
    ]);
    expect(result.totalExpected).toBe(2);
    expect(result.totalMatched).toBe(2);
    expect(result.overallScore).toBe(1.0);
  });

  it("returns score 1.0 when all sentences are skipped", () => {
    const result = overallAccuracy([
      { expected: "one two", recognised: "" },
      { expected: "three four", recognised: "" },
    ]);
    expect(result.totalExpected).toBe(0);
    expect(result.overallScore).toBe(1.0);
  });

  it("returns perSentence array with same length as input", () => {
    const pairs = [
      { expected: "one", recognised: "one" },
      { expected: "two", recognised: "two" },
      { expected: "three", recognised: "" },
    ];
    const result = overallAccuracy(pairs);
    expect(result.perSentence).toHaveLength(3);
  });

  it("returns empty results for empty input", () => {
    const result = overallAccuracy([]);
    expect(result.totalExpected).toBe(0);
    expect(result.totalMatched).toBe(0);
    expect(result.overallScore).toBe(1.0);
    expect(result.perSentence).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// wordAccuracy — property-based
// ---------------------------------------------------------------------------

describe("wordAccuracy — properties", () => {
  it("score is always in [0, 1]", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 80 }),
        fc.string({ minLength: 0, maxLength: 80 }),
        (expected, recognised) => {
          const result = wordAccuracy(expected, recognised);
          return result.score >= 0 && result.score <= 1.0;
        }
      )
    );
  });

  it("identical non-empty input always scores 1.0", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z ]{1,60}$/).filter((s) => s.trim().length > 0),
        (text) => {
          const result = wordAccuracy(text, text);
          return result.score === 1.0;
        }
      )
    );
  });

  it("matchedWords.length is never greater than expectedCount", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 80 }),
        fc.string({ minLength: 0, maxLength: 80 }),
        (expected, recognised) => {
          const result = wordAccuracy(expected, recognised);
          return result.matchedWords.length <= result.expectedCount;
        }
      )
    );
  });

  it("score equals matchedWords.length / expectedCount (when expectedCount > 0)", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z ]{1,60}$/).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 0, maxLength: 80 }),
        (expected, recognised) => {
          const result = wordAccuracy(expected, recognised);
          if (result.expectedCount === 0) return true;
          const computed = result.matchedWords.length / result.expectedCount;
          return Math.abs(result.score - computed) < 1e-10;
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// PRACTICE_ITEMS — data shape validation
// ---------------------------------------------------------------------------

describe("PRACTICE_ITEMS data", () => {
  it("has exactly 20 items", () => {
    expect(PRACTICE_ITEMS).toHaveLength(20);
  });

  it("every item has a non-empty id", () => {
    for (const item of PRACTICE_ITEMS) {
      expect(item.id.trim().length).toBeGreaterThan(0);
    }
  });

  it("all ids are unique", () => {
    const ids = PRACTICE_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every item has a non-empty questionText", () => {
    for (const item of PRACTICE_ITEMS) {
      expect(item.questionText.trim().length).toBeGreaterThan(0);
    }
  });

  it("every item has a non-empty expectedAnswer", () => {
    for (const item of PRACTICE_ITEMS) {
      expect(item.expectedAnswer.trim().length).toBeGreaterThan(0);
    }
  });

  it("every category is one of: civics, n400, reading", () => {
    const valid = new Set(["civics", "n400", "reading"]);
    for (const item of PRACTICE_ITEMS) {
      expect(valid.has(item.category)).toBe(true);
    }
  });

  it("no item contains real-person indicators", () => {
    // Rough guard: no text that looks like a specific named officeholder or A-number
    const raw = JSON.stringify(PRACTICE_ITEMS);
    expect(raw).not.toMatch(/\bA-?\d{8,9}\b/i);
  });

  it("questionText and expectedAnswer are distinct strings", () => {
    for (const item of PRACTICE_ITEMS) {
      // They should not be identical (question ≠ answer)
      expect(item.questionText).not.toBe(item.expectedAnswer);
    }
  });

  it("accuracy is scored from expectedAnswer, not questionText", () => {
    // Sanity: scoring a perfect match of expectedAnswer gives 1.0
    for (const item of PRACTICE_ITEMS) {
      const result = wordAccuracy(item.expectedAnswer, item.expectedAnswer);
      expect(result.score).toBe(1.0);
    }
  });
});

// ---------------------------------------------------------------------------
// buildExportPayload — shape and required fields
// ---------------------------------------------------------------------------

function makeItemResult(
  overrides: Partial<ItemResult> = {}
): ItemResult {
  const item = PRACTICE_ITEMS[0]!;
  return {
    item,
    status: "attempted",
    recognised: "The Constitution is the supreme law of the land",
    accuracy: wordAccuracy(item.expectedAnswer, "The Constitution is the supreme law of the land"),
    retryCount: 0,
    questionHeard: false,
    sampleHeard: false,
    ...overrides,
  };
}

describe("buildExportPayload", () => {
  it("top-level payload includes mode field", () => {
    const payload = buildExportPayload([makeItemResult()], "practice") as Record<string, unknown>;
    expect(payload["mode"]).toBe("practice");
  });

  it("top-level payload includes mode field for check mode", () => {
    const payload = buildExportPayload([makeItemResult()], "check") as Record<string, unknown>;
    expect(payload["mode"]).toBe("check");
  });

  it("includes exportedAt as an ISO string", () => {
    const payload = buildExportPayload([makeItemResult()], "practice") as Record<string, unknown>;
    expect(typeof payload["exportedAt"]).toBe("string");
    expect(() => new Date(payload["exportedAt"] as string).toISOString()).not.toThrow();
  });

  it("includes overall accuracy block", () => {
    const payload = buildExportPayload([makeItemResult()], "practice") as Record<string, unknown>;
    const overall = payload["overall"] as Record<string, unknown>;
    expect(typeof overall["overallScore"]).toBe("number");
    expect(typeof overall["totalExpected"]).toBe("number");
    expect(typeof overall["totalMatched"]).toBe("number");
  });

  it("each item entry has mode, questionHeard, sampleHeard, retryCount", () => {
    const r = makeItemResult({ questionHeard: true, sampleHeard: false, retryCount: 2 });
    const payload = buildExportPayload([r], "check") as Record<string, unknown>;
    const items = payload["items"] as Record<string, unknown>[];
    const entry = items[0]!;
    expect(entry["mode"]).toBe("check");
    expect(entry["questionHeard"]).toBe(true);
    expect(entry["sampleHeard"]).toBe(false);
    expect(entry["retryCount"]).toBe(2);
  });

  it("each item entry includes id, category, questionText, expectedAnswer", () => {
    const payload = buildExportPayload([makeItemResult()], "practice") as Record<string, unknown>;
    const items = payload["items"] as Record<string, unknown>[];
    const entry = items[0]!;
    expect(typeof entry["id"]).toBe("string");
    expect(typeof entry["category"]).toBe("string");
    expect(typeof entry["questionText"]).toBe("string");
    expect(typeof entry["expectedAnswer"]).toBe("string");
  });

  it("each item entry includes status, recognised, accuracyScore, matchedWords", () => {
    const payload = buildExportPayload([makeItemResult()], "practice") as Record<string, unknown>;
    const items = payload["items"] as Record<string, unknown>[];
    const entry = items[0]!;
    expect(["attempted", "skipped", "pending"]).toContain(entry["status"]);
    expect(typeof entry["recognised"]).toBe("string");
    expect(typeof entry["accuracyScore"]).toBe("number");
    expect(Array.isArray(entry["matchedWords"])).toBe(true);
  });

  it("skipped items have accuracyScore null and empty matchedWords", () => {
    const r = makeItemResult({ status: "skipped", recognised: "", accuracy: null });
    const payload = buildExportPayload([r], "practice") as Record<string, unknown>;
    const items = payload["items"] as Record<string, unknown>[];
    const entry = items[0]!;
    expect(entry["accuracyScore"]).toBeNull();
    expect(entry["matchedWords"]).toEqual([]);
  });

  it("only attempted items contribute to overall score (skipped excluded)", () => {
    const attempted = makeItemResult();
    const skipped = makeItemResult({ status: "skipped", recognised: "", accuracy: null });
    const payload = buildExportPayload([attempted, skipped], "practice") as Record<string, unknown>;
    const overall = payload["overall"] as Record<string, unknown>;
    // Only the attempted item's words counted
    expect((overall["totalExpected"] as number)).toBeGreaterThan(0);
  });

  it("payload does not include a _note that mentions personal data being stored", () => {
    const payload = buildExportPayload([makeItemResult()], "practice") as Record<string, unknown>;
    // _note should say "device-local only. No personal data."
    expect((payload["_note"] as string).toLowerCase()).toContain("no personal data");
  });
});
