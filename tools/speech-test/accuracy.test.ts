/**
 * Tests for tools/speech-test/accuracy.ts
 *
 * Covers: normalise, tokenise, wordAccuracy, overallAccuracy.
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
    const result = wordAccuracy(
      "the constitution",
      "the constitution."
    );
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
    // "the" appears once in recognised; should only match one "the" in expected
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
      { expected: "one two three four", recognised: "one two three four" }, // 4/4
      { expected: "one two three four", recognised: "one two" },             // 2/4
    ]);
    expect(result.totalExpected).toBe(8);
    expect(result.totalMatched).toBe(6);
    expect(result.overallScore).toBeCloseTo(0.75);
  });

  it("excludes skipped (empty recognised) sentences from totals", () => {
    const result = overallAccuracy([
      { expected: "one two", recognised: "one two" }, // 2/2
      { expected: "three four", recognised: "" },      // skipped
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
// Property-based tests
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
