/**
 * Tests for src/engine/english-grader.ts
 *
 * Thresholds are read from the loaded rules; injected rules prove the grader reads them.
 * "attempts" means sentences presented so far (O6).
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { Turn } from "../../contracts/session.js";
import {
  runEnglishStage,
  type EnglishStageKind,
  type EnglishTurnInput,
} from "../english-grader.js";
import { loadEnglishRules, type EnglishComponentRules } from "../test-rules-loader.js";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function makeTurn(n: number, kind: Turn["stage"]): Turn {
  return {
    turnId: `t${n}`,
    stage: kind,
    prompt: "A sentence.",
    responseText: "A sentence.",
    completedAt: "2024-01-01T00:00:00Z",
  };
}

function itemsFor(kind: EnglishStageKind, flags: readonly boolean[]): EnglishTurnInput[] {
  return flags.map((isCorrect, index) => ({ turn: makeTurn(index + 1, kind), isCorrect }));
}

function repeat<const T>(value: T, times: number): T[] {
  return Array.from({ length: times }, () => value);
}

function withRules(
  rules: EnglishComponentRules,
  patch: Partial<Record<keyof EnglishComponentRules, number>>
): EnglishComponentRules {
  const copy = structuredClone(rules);
  for (const [key, value] of Object.entries(patch) as Array<[keyof EnglishComponentRules, number]>) {
    copy[key] = { ...copy[key], value };
  }
  return copy;
}

const ENGLISH = loadEnglishRules();
const KINDS = ["reading", "writing"] as const;

// ---------------------------------------------------------------------------
// Unit tests, once for reading and once for writing
// ---------------------------------------------------------------------------

describe.each(KINDS)("runEnglishStage (%s)", (kind) => {
  const rules = ENGLISH[kind];
  const limit = rules.sentencesPresented.value;
  const needed = rules.sentencesToPassCount.value;

  const run = (flags: readonly boolean[], custom: EnglishComponentRules = rules) =>
    runEnglishStage({ kind, items: itemsFor(kind, flags), rules: custom });

  it("passes on the first sentence when it is correct", () => {
    const result = run([true]);
    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.correctCount).toBe(needed);
    expect(result.stoppedAtTurnId).toBe("t1");
    expect(result.scores[0]!.scoring).toEqual({ stage: kind, attempts: 1, result: "correct" });
  });

  it("passes on the last allowed sentence", () => {
    const result = run([...repeat(false, limit - 1), true]);
    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(limit);
    expect(result.stoppedAtTurnId).toBe(`t${limit}`);
  });

  it("fails when no sentence is correct", () => {
    const result = run(repeat(false, limit));
    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(limit);
    expect(result.correctCount).toBe(0);
    expect(result.stoppedAtTurnId).toBeNull();
  });

  it("stops presenting sentences once it has passed", () => {
    const result = run([true, false, false]);
    expect(result.scores).toHaveLength(1);
    expect(result.attempts).toBe(1);
  });

  it("sets attempts on each turn to the number of sentences presented so far", () => {
    const result = run([false, false, true]);
    expect(result.scores.map((s) => (s.scoring as { attempts: number }).attempts)).toEqual([1, 2, 3]);
    expect(result.scores.map((s) => s.scoring.result)).toEqual(["incorrect", "incorrect", "correct"]);
  });

  it("never reports more attempts than sentences presented", () => {
    const result = run(repeat(false, limit + 5));
    expect(result.attempts).toBe(limit);
    expect(result.scores).toHaveLength(limit);
  });

  it("ignores turns beyond the sentence limit", () => {
    const result = run([...repeat(false, limit), true]);
    expect(result.passed).toBe(false);
    expect(result.scores).toHaveLength(limit);
  });

  it("does not look at turns beyond the limit, even from another stage", () => {
    const items = [
      ...itemsFor(kind, repeat(false, limit)),
      { turn: makeTurn(limit + 1, "civics"), isCorrect: true },
    ];
    expect(() => runEnglishStage({ kind, items, rules })).not.toThrow();
  });

  it("is not passed when there are no turns", () => {
    const result = run([]);
    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(0);
    expect(result.scores).toEqual([]);
  });

  it("throws for a turn from another stage inside the limit", () => {
    const other = kind === "reading" ? "writing" : "reading";
    const items = [{ turn: makeTurn(1, other), isCorrect: true }];
    expect(() => runEnglishStage({ kind, items, rules })).toThrow(
      new RegExp(`is a "${other}" turn but the ${kind} stage is being graded`)
    );
  });

  it("reads the number of correct sentences needed from the rules", () => {
    const stricter = withRules(rules, { sentencesToPassCount: needed + 1 });
    const oneCorrect = run([true, false, false], stricter);
    expect(oneCorrect.passed).toBe(false);
    expect(oneCorrect.correctCount).toBe(1);
    expect(oneCorrect.attempts).toBe(limit);

    const twoCorrect = run([true, false, true], stricter);
    expect(twoCorrect.passed).toBe(true);
    expect(twoCorrect.attempts).toBe(limit);
    expect(twoCorrect.stoppedAtTurnId).toBe("t3");
  });

  it("reads the number of sentences presented from the rules", () => {
    const shorter = withRules(rules, { sentencesPresented: limit - 1 });
    const result = run([false, false, true], shorter);
    expect(result.scores).toHaveLength(limit - 1);
    expect(result.passed).toBe(false);
  });
});

describe("reading and writing rules", () => {
  it("use the same pass rule today, and each stage reads its own rules", () => {
    expect(ENGLISH.reading.sentencesToPassCount.value).toBe(ENGLISH.writing.sentencesToPassCount.value);
    const strictReading = withRules(ENGLISH.reading, {
      sentencesToPassCount: ENGLISH.reading.sentencesToPassCount.value + 1,
    });
    const flags = [true, false, false];
    const reading = runEnglishStage({ kind: "reading", items: itemsFor("reading", flags), rules: strictReading });
    const writing = runEnglishStage({ kind: "writing", items: itemsFor("writing", flags), rules: ENGLISH.writing });
    expect(reading.passed).toBe(false);
    expect(writing.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe("runEnglishStage properties", () => {
  const flagsArb = fc.array(fc.boolean(), { maxLength: 8 });

  /** Rules with arbitrary thresholds, built from the real rules so the shape stays valid. */
  const rulesArb = fc
    .record({
      limit: fc.integer({ min: 1, max: 5 }),
      needed: fc.integer({ min: 1, max: 5 }),
      kind: fc.constantFrom(...KINDS),
    })
    .map(({ limit, needed, kind }) => ({
      kind,
      rules: withRules(ENGLISH[kind], { sentencesPresented: limit, sentencesToPassCount: needed }),
    }));

  it("property: passed exactly when enough sentences inside the limit are correct", () => {
    fc.assert(
      fc.property(rulesArb, flagsArb, ({ kind, rules }, flags) => {
        const result = runEnglishStage({ kind, items: itemsFor(kind, flags), rules });
        const inside = flags.slice(0, rules.sentencesPresented.value);
        const expected = inside.filter(Boolean).length >= rules.sentencesToPassCount.value;
        return result.passed === expected;
      }),
      { numRuns: 500 }
    );
  });

  it("property: attempts never exceed the sentences presented and match the graded turns", () => {
    fc.assert(
      fc.property(rulesArb, flagsArb, ({ kind, rules }, flags) => {
        const result = runEnglishStage({ kind, items: itemsFor(kind, flags), rules });
        const eachAttemptIsItsPosition = result.scores.every(
          (score, index) => (score.scoring as { attempts: number }).attempts === index + 1
        );
        return (
          result.attempts <= rules.sentencesPresented.value &&
          result.attempts === result.scores.length &&
          result.attempts <= flags.length &&
          eachAttemptIsItsPosition
        );
      }),
      { numRuns: 500 }
    );
  });

  it("property: the stage stops on the turn that reaches the pass count and scores nothing after it", () => {
    fc.assert(
      fc.property(rulesArb, flagsArb, ({ kind, rules }, flags) => {
        const needed = rules.sentencesToPassCount.value;
        const result = runEnglishStage({ kind, items: itemsFor(kind, flags), rules });
        let correct = 0;
        for (let index = 0; index < result.scores.length; index++) {
          if (result.scores[index]!.scoring.result === "correct") correct += 1;
          const isLast = index === result.scores.length - 1;
          if (!isLast && correct >= needed) return false;
        }
        if (result.passed) {
          const last = result.scores[result.scores.length - 1];
          return correct === needed && last !== undefined && result.stoppedAtTurnId === last.turnId;
        }
        return correct < needed && result.stoppedAtTurnId === null;
      }),
      { numRuns: 500 }
    );
  });

  it("property: with the real rules, a stage passes exactly when one of the first sentences is correct", () => {
    fc.assert(
      fc.property(fc.constantFrom(...KINDS), flagsArb, (kind, flags) => {
        const rules = ENGLISH[kind];
        const result = runEnglishStage({ kind, items: itemsFor(kind, flags), rules });
        const firstSentences = flags.slice(0, rules.sentencesPresented.value);
        return result.passed === (firstSentences.filter(Boolean).length >= rules.sentencesToPassCount.value);
      })
    );
  });

  it("property: grading the same stage twice gives the same result", () => {
    fc.assert(
      fc.property(rulesArb, flagsArb, ({ kind, rules }, flags) => {
        const input = { kind, items: itemsFor(kind, flags), rules };
        return JSON.stringify(runEnglishStage(input)) === JSON.stringify(runEnglishStage(input));
      }),
      { numRuns: 300 }
    );
  });
});
