/**
 * Tests for src/engine/civics-grader.ts
 *
 * Stage tests read every threshold from the loaded rules (2008 and 2025) instead of
 * hard-coding numbers, and use injected rules to show the grader really reads them.
 * Property tests are named "property: ..." and run against both rule sets.
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import type { Turn } from "../../contracts/session.js";
import {
  scoreCivicsTurn,
  runCivicsStage,
  type CivicsStageResult,
} from "../civics-grader.js";
import { isNumberToken } from "../answer-normaliser.js";
import { loadAnswerKey, type CivicsAnswerEntry } from "../civics-answer-key.js";
import { loadCivicsRules, type CivicsTestRules } from "../test-rules-loader.js";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const SOURCE = {
  sourceUrl: "https://www.uscis.gov/test",
  sourceDocument: "test fixture",
};

function makeEntry(id: string, overrides: Partial<CivicsAnswerEntry> = {}): CivicsAnswerEntry {
  return {
    id,
    testVersion: "2008",
    questionText: `Question ${id}?`,
    acceptedAnswers: ["alpha"],
    requiredAnswerCount: 1,
    answerType: "static",
    ...SOURCE,
    ...overrides,
  };
}

const STATIC_ID = "2008-001";
const DYNAMIC_ID = "2008-002";
const UNKNOWN_ID = "2008-999";

/** accepted answer "alpha"; the dynamic entry is never read for answers. */
const SYNTHETIC_KEY = new Map<string, CivicsAnswerEntry>([
  [STATIC_ID, makeEntry(STATIC_ID)],
  [DYNAMIC_ID, makeEntry(DYNAMIC_ID, { answerType: "dynamic", acceptedAnswers: [] })],
]);

function makeTurn(
  n: number,
  questionId: string | undefined,
  responseText: string,
  overrides: Partial<Turn> = {}
): Turn {
  const turn: Turn = {
    turnId: `t${n}`,
    stage: "civics",
    prompt: "A question?",
    responseText,
    completedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
  if (questionId !== undefined) turn.questionId = questionId;
  return turn;
}

const OUTCOMES = ["correct", "incorrect", "unscored", "unknown"] as const;
type Outcome = (typeof OUTCOMES)[number];

/** Turns that score as the given outcomes against SYNTHETIC_KEY. */
function turnsFor(outcomes: readonly Outcome[]): Turn[] {
  return outcomes.map((outcome, index) => {
    const n = index + 1;
    switch (outcome) {
      case "correct":
        return makeTurn(n, STATIC_ID, "alpha");
      case "incorrect":
        return makeTurn(n, STATIC_ID, "beta");
      case "unscored":
        return makeTurn(n, DYNAMIC_ID, "alpha");
      case "unknown":
        return makeTurn(n, UNKNOWN_ID, "alpha");
    }
  });
}

function repeat<const T>(value: T, times: number): T[] {
  return Array.from({ length: times }, () => value);
}

function stage(outcomes: readonly Outcome[], rules: CivicsTestRules): CivicsStageResult {
  return runCivicsStage({ turns: turnsFor(outcomes), answerKey: SYNTHETIC_KEY, rules });
}

/** A copy of the rules with some numbers replaced, to prove the grader reads them. */
function withRules(
  rules: CivicsTestRules,
  patch: Partial<Record<keyof CivicsTestRules, number>>
): CivicsTestRules {
  const copy = structuredClone(rules);
  for (const [key, value] of Object.entries(patch) as Array<[keyof CivicsTestRules, number]>) {
    copy[key] = { ...copy[key], value };
  }
  return copy;
}

const REAL_2008 = (() => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return loadAnswerKey("2008", { production: false });
  } finally {
    warn.mockRestore();
  }
})();

function scoreReal(questionId: string, responseText: string) {
  return scoreCivicsTurn(makeTurn(1, questionId, responseText), REAL_2008).scoring.result;
}

// ---------------------------------------------------------------------------
// scoreCivicsTurn
// ---------------------------------------------------------------------------

describe("scoreCivicsTurn", () => {
  it("scores a correct answer as correct", () => {
    expect(scoreReal("2008-001", "The Constitution.")).toBe("correct");
  });

  it("scores a wrong answer as incorrect", () => {
    expect(scoreReal("2008-001", "The Declaration of Independence.")).toBe("incorrect");
  });

  it("accepts extra words around a correct answer", () => {
    expect(scoreReal("2008-001", "I think it is the Constitution")).toBe("correct");
    expect(scoreReal("2008-001", "Um, the Constitution, I believe.")).toBe("correct");
  });

  it("does not accept an answer that only appears inside a longer word", () => {
    expect(scoreReal("2008-001", "the constitutional amendment")).toBe("incorrect");
    expect(scoreReal("2008-019", "sixty")).toBe("incorrect");
    expect(scoreReal("2008-007", "127")).toBe("incorrect");
  });

  it("accepts numerals and number words, with or without a hyphen", () => {
    expect(scoreReal("2008-007", "27")).toBe("correct");
    expect(scoreReal("2008-007", "Twenty-seven")).toBe("correct");
    expect(scoreReal("2008-007", "twenty seven amendments")).toBe("correct");
    expect(scoreReal("2008-007", "Twenty-six")).toBe("incorrect");
    expect(scoreReal("2008-019", "six years")).toBe("correct");
    expect(scoreReal("2008-019", "6")).toBe("correct");
  });

  it("needs the required number of distinct accepted answers", () => {
    expect(scoreReal("2008-009", "life and liberty")).toBe("correct");
    expect(scoreReal("2008-009", "Life, liberty, and the pursuit of happiness.")).toBe("correct");
    expect(scoreReal("2008-009", "liberty")).toBe("incorrect");
    expect(scoreReal("2008-009", "life life life")).toBe("incorrect");
    expect(scoreReal("2008-009", "lifestyle and liberty")).toBe("incorrect");
  });

  it("does not double-count overlapping accepted answers", () => {
    const key = new Map([
      [
        "2008-003",
        makeEntry("2008-003", {
          acceptedAnswers: ["speech", "freedom of speech"],
          requiredAnswerCount: 2,
        }),
      ],
    ]);
    const score = (text: string) =>
      scoreCivicsTurn(makeTurn(1, "2008-003", text), key).scoring.result;
    expect(score("freedom of speech")).toBe("incorrect");
    expect(score("speech and freedom of speech")).toBe("correct");
  });

  it("returns unscored for a dynamic question, whatever the response", () => {
    expect(scoreReal("2008-020", "Senator Anyname")).toBe("unscored");
    expect(scoreReal("2008-028", "")).toBe("unscored");
  });

  it("returns unscored for an id that is not in the answer key", () => {
    expect(scoreReal("2008-999", "anything")).toBe("unscored");
  });

  it("always uses scoringSource answer_key and stage civics", () => {
    for (const [id, text] of [
      ["2008-001", "the constitution"],
      ["2008-001", "wrong"],
      ["2008-020", "x"],
      ["2008-999", "x"],
    ] as const) {
      const { scoring } = scoreCivicsTurn(makeTurn(1, id, text), REAL_2008);
      expect(scoring.scoringSource).toBe("answer_key");
      expect(scoring.stage).toBe("civics");
    }
  });

  it("reports the turn id and question id", () => {
    const score = scoreCivicsTurn(makeTurn(7, "2008-001", "the constitution"), REAL_2008);
    expect(score.turnId).toBe("t7");
    expect(score.questionId).toBe("2008-001");
  });

  describe("missing questionId (O1)", () => {
    it("throws a clear error when questionId is undefined", () => {
      expect(() => scoreCivicsTurn(makeTurn(3, undefined, "alpha"), SYNTHETIC_KEY)).toThrow(
        /Civics turn "t3" has no questionId/
      );
    });

    it("throws when questionId is empty or blank", () => {
      expect(() => scoreCivicsTurn(makeTurn(1, "", "alpha"), SYNTHETIC_KEY)).toThrow(/no questionId/);
      expect(() => scoreCivicsTurn(makeTurn(1, "   ", "alpha"), SYNTHETIC_KEY)).toThrow(/no questionId/);
    });

    it("explains what to do in the error", () => {
      expect(() => scoreCivicsTurn(makeTurn(1, undefined, "alpha"), SYNTHETIC_KEY)).toThrow(
        /answer key entry/
      );
    });

    it("does not guess a question from the prompt text", () => {
      const turn = makeTurn(1, undefined, "alpha", { prompt: "What is the supreme law of the land?" });
      expect(() => scoreCivicsTurn(turn, REAL_2008)).toThrow(/no questionId/);
    });
  });

  it("throws for a turn that is not a civics turn", () => {
    const turn = makeTurn(1, STATIC_ID, "alpha", { stage: "reading" });
    expect(() => scoreCivicsTurn(turn, SYNTHETIC_KEY)).toThrow(/only scores civics turns/);
  });
});

// ---------------------------------------------------------------------------
// runCivicsStage (against the 2008 and 2025 rules)
// ---------------------------------------------------------------------------

describe.each(["2008", "2025"] as const)("runCivicsStage with %s rules", (version) => {
  const rules = loadCivicsRules(version);
  const stopCorrect = rules.earlyStopOnCorrect.value;
  const stopIncorrect = rules.earlyStopOnIncorrect.value;
  const limit = rules.questionsAsked.value;
  const passingScore = rules.passingScore.value;

  it("has thresholds that fit inside the question limit (data sanity)", () => {
    expect(stopCorrect + stopIncorrect - 2).toBeLessThan(limit);
  });

  it("stops on the exact turn where correct answers reach the threshold", () => {
    const result = stage([...repeat("correct", stopCorrect), ...repeat("incorrect", 5)], rules);
    expect(result.stopReason).toBe("correct_threshold");
    expect(result.passed).toBe(true);
    expect(result.correctCount).toBe(stopCorrect);
    expect(result.incorrectCount).toBe(0);
    expect(result.scores).toHaveLength(stopCorrect);
    expect(result.stoppedAtTurnId).toBe(`t${stopCorrect}`);
  });

  it("does not stop one correct answer early", () => {
    const result = stage(repeat("correct", stopCorrect - 1), rules);
    expect(result.stopReason).toBe("none");
    expect(result.stoppedAtTurnId).toBeNull();
    expect(result.passed).toBe(false);
    expect(result.scores).toHaveLength(stopCorrect - 1);
  });

  it("stops on the exact turn where incorrect answers reach the threshold", () => {
    const result = stage([...repeat("incorrect", stopIncorrect), ...repeat("correct", 5)], rules);
    expect(result.stopReason).toBe("incorrect_threshold");
    expect(result.passed).toBe(false);
    expect(result.incorrectCount).toBe(stopIncorrect);
    expect(result.scores).toHaveLength(stopIncorrect);
    expect(result.stoppedAtTurnId).toBe(`t${stopIncorrect}`);
  });

  it("does not stop one incorrect answer early", () => {
    const result = stage(repeat("incorrect", stopIncorrect - 1), rules);
    expect(result.stopReason).toBe("none");
    expect(result.passed).toBe(false);
    expect(result.scores).toHaveLength(stopIncorrect - 1);
  });

  it("keeps going just below both thresholds, then stops on the next deciding answer", () => {
    const below: Outcome[] = [
      ...repeat<Outcome>("correct", stopCorrect - 1),
      ...repeat<Outcome>("incorrect", stopIncorrect - 1),
    ];
    const running = stage(below, rules);
    expect(running.stopReason).toBe("none");
    expect(running.scores).toHaveLength(below.length);

    const passes = stage([...below, "correct"], rules);
    expect(passes.stopReason).toBe("correct_threshold");
    expect(passes.passed).toBe(true);
    expect(passes.scores).toHaveLength(below.length + 1);

    const fails = stage([...below, "incorrect"], rules);
    expect(fails.stopReason).toBe("incorrect_threshold");
    expect(fails.passed).toBe(false);
    expect(fails.scores).toHaveLength(below.length + 1);
  });

  it("does not score turns after the stop", () => {
    const outcomes = [...repeat<Outcome>("correct", stopCorrect), "incorrect", "unscored"] as Outcome[];
    const result = stage(outcomes, rules);
    expect(result.scores.map((s) => s.turnId)).toEqual(
      Array.from({ length: stopCorrect }, (_, i) => `t${i + 1}`)
    );
  });

  it("unscored turns use a question slot and change neither counter", () => {
    const result = stage(["unscored", ...repeat<Outcome>("correct", stopCorrect - 1)], rules);
    expect(result.correctCount).toBe(stopCorrect - 1);
    expect(result.incorrectCount).toBe(0);
    expect(result.unscoredCount).toBe(1);
    expect(result.stopReason).toBe("none");
    expect(result.scores).toHaveLength(stopCorrect);
  });

  it("unknown question ids also count as unscored", () => {
    const result = stage(repeat("unknown", 3), rules);
    expect(result.unscoredCount).toBe(3);
    expect(result.correctCount + result.incorrectCount).toBe(0);
  });

  it("ignores turns beyond the question limit", () => {
    const result = stage([...repeat<Outcome>("unscored", limit), ...repeat<Outcome>("correct", stopCorrect)], rules);
    expect(result.scores).toHaveLength(limit);
    expect(result.correctCount).toBe(0);
    expect(result.stopReason).toBe("none");
    expect(result.passed).toBe(false);
  });

  it("does not look at turns beyond the question limit, even if they have no questionId", () => {
    const turns = [...turnsFor(repeat("unscored", limit)), makeTurn(limit + 1, undefined, "alpha")];
    expect(() => runCivicsStage({ turns, answerKey: SYNTHETIC_KEY, rules })).not.toThrow();
  });

  it("throws if a turn inside the limit has no questionId", () => {
    const turns = [makeTurn(1, STATIC_ID, "alpha"), makeTurn(2, undefined, "alpha")];
    expect(() => runCivicsStage({ turns, answerKey: SYNTHETIC_KEY, rules })).toThrow(
      /Civics turn "t2" has no questionId/
    );
  });

  it("is not passed when the limit is reached without a threshold", () => {
    const outcomes = [
      ...repeat<Outcome>("correct", stopCorrect - 1),
      ...repeat<Outcome>("unscored", limit - (stopCorrect - 1)),
    ];
    const result = stage(outcomes, rules);
    expect(result.scores).toHaveLength(limit);
    expect(result.stopReason).toBe("none");
    expect(result.passed).toBe(false);
  });

  it("is not passed when there are no turns", () => {
    const result = stage([], rules);
    expect(result.scores).toEqual([]);
    expect(result.passed).toBe(false);
    expect(result.stopReason).toBe("none");
  });

  it("lists the question text of incorrect answers only, in order", () => {
    const outcomes: Outcome[] = ["incorrect", "correct", "unscored", "unknown", "incorrect"];
    const result = stage(outcomes, rules);
    expect(result.reviewItems).toEqual([
      SYNTHETIC_KEY.get(STATIC_ID)!.questionText,
      SYNTHETIC_KEY.get(STATIC_ID)!.questionText,
    ]);
  });

  it("reads the correct-answer threshold from the rules", () => {
    const shifted = withRules(rules, {
      earlyStopOnCorrect: stopCorrect + 1,
      passingScore: passingScore + 1,
    });
    const result = stage(repeat("correct", stopCorrect + 3), shifted);
    expect(result.scores).toHaveLength(stopCorrect + 1);
    expect(result.passed).toBe(true);
  });

  it("reads the incorrect-answer threshold from the rules", () => {
    const shifted = withRules(rules, { earlyStopOnIncorrect: stopIncorrect + 1 });
    const result = stage(repeat("incorrect", stopIncorrect + 3), shifted);
    expect(result.scores).toHaveLength(stopIncorrect + 1);
    expect(result.stopReason).toBe("incorrect_threshold");
  });

  it("reads the question limit from the rules", () => {
    const small = withRules(rules, { questionsAsked: 3 });
    const result = stage(repeat("unscored", 10), small);
    expect(result.scores).toHaveLength(3);
  });

  it("never passes below the passing score, even if the stop threshold is lower", () => {
    const odd = withRules(rules, { passingScore: stopCorrect + 1 });
    const result = stage(repeat("correct", stopCorrect), odd);
    expect(result.stopReason).toBe("correct_threshold");
    expect(result.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests (both rule sets)
// ---------------------------------------------------------------------------

describe("runCivicsStage properties", () => {
  const versionArb = fc.constantFrom(...(["2008", "2025"] as const));
  const outcomesArb = fc.array(fc.constantFrom(...OUTCOMES), { maxLength: 45 });

  /** Checks stop rules from the result alone: never early, never late, never over the limit. */
  function stopsCorrectly(result: CivicsStageResult, turnCount: number, rules: CivicsTestRules): boolean {
    const stopC = rules.earlyStopOnCorrect.value;
    const stopI = rules.earlyStopOnIncorrect.value;
    const limit = rules.questionsAsked.value;
    let c = 0;
    let i = 0;

    for (let index = 0; index < result.scores.length; index++) {
      const outcome = result.scores[index]!.scoring.result;
      if (outcome === "correct") c += 1;
      if (outcome === "incorrect") i += 1;
      const isLast = index === result.scores.length - 1;

      // P5: no turn is scored after a threshold was reached.
      if (!isLast && (c >= stopC || i >= stopI)) return false;

      if (isLast) {
        // P4: a stop happens exactly when the threshold is reached.
        if (result.stopReason === "correct_threshold" && c !== stopC) return false;
        if (result.stopReason === "incorrect_threshold" && i !== stopI) return false;
        // No stop recorded although a threshold was reached.
        if (result.stopReason === "none" && (c >= stopC || i >= stopI)) return false;
      }
    }

    if (result.stopReason === "none") {
      // Without a stop, every turn up to the limit was graded.
      if (result.scores.length !== Math.min(turnCount, limit)) return false;
      if (result.stoppedAtTurnId !== null) return false;
    } else {
      const last = result.scores[result.scores.length - 1];
      if (!last || result.stoppedAtTurnId !== last.turnId) return false;
    }

    return result.scores.length <= limit && result.scores.length <= turnCount;
  }

  it("property: the stage stops exactly when a threshold is reached, never earlier or later, never past the limit", () => {
    fc.assert(
      fc.property(versionArb, outcomesArb, (version, outcomes) => {
        const rules = loadCivicsRules(version);
        return stopsCorrectly(stage(outcomes, rules), outcomes.length, rules);
      }),
      { numRuns: 500 }
    );
  });

  it("property: a score below the passing score is never passed", () => {
    fc.assert(
      fc.property(versionArb, outcomesArb, (version, outcomes) => {
        const rules = loadCivicsRules(version);
        const result = stage(outcomes, rules);
        const passingScore = rules.passingScore.value;
        if (result.correctCount < passingScore && result.passed) return false;
        return !result.passed || result.stopReason === "correct_threshold";
      }),
      { numRuns: 500 }
    );
  });

  it("property: correct, incorrect and unscored counts add up to the number of graded turns", () => {
    fc.assert(
      fc.property(versionArb, outcomesArb, (version, outcomes) => {
        const result = stage(outcomes, loadCivicsRules(version));
        const total = result.correctCount + result.incorrectCount + result.unscoredCount;
        return total === result.scores.length;
      }),
      { numRuns: 300 }
    );
  });

  it("property: grading the same stage twice gives the same result", () => {
    fc.assert(
      fc.property(versionArb, outcomesArb, (version, outcomes) => {
        const rules = loadCivicsRules(version);
        const first = stage(outcomes, rules);
        const second = stage(outcomes, rules);
        return JSON.stringify(first) === JSON.stringify(second);
      }),
      { numRuns: 300 }
    );
  });

  it("property: a dynamic question is always unscored, whatever the response", () => {
    // The entry holds an accepted answer on purpose: the grader must never read it.
    const dynamic = makeEntry(DYNAMIC_ID, { answerType: "dynamic", acceptedAnswers: ["alpha"] });
    const key = new Map([[DYNAMIC_ID, dynamic]]);
    const response = fc.oneof(
      fc.string(),
      fc.constant("alpha"),
      fc.string().map((text) => `alpha ${text}`)
    );
    fc.assert(
      fc.property(response, (text) => {
        const { scoring } = scoreCivicsTurn(makeTurn(1, DYNAMIC_ID, text), key);
        return scoring.result === "unscored" && scoring.scoringSource === "answer_key";
      }),
      { numRuns: 300 }
    );
  });

  it("property: a static question is correct exactly when the response holds enough distinct accepted answers", () => {
    // Plain words only: number words next to each other are covered by the normaliser tests.
    const words = fc.uniqueArray(
      fc.stringMatching(/^[a-z]{3,8}$/).filter((w) => !isNumberToken(w)),
      { minLength: 1, maxLength: 6 }
    );
    const scenario = words.chain((accepted) =>
      fc.record({
        accepted: fc.constant(accepted),
        required: fc.integer({ min: 1, max: accepted.length }),
        present: fc.shuffledSubarray(accepted),
        repeats: fc.integer({ min: 0, max: 3 }),
        filler: fc.array(fc.integer({ min: 0, max: 999 }).map(String), { maxLength: 4 }),
      })
    );

    fc.assert(
      fc.property(scenario, ({ accepted, required, present, repeats, filler }) => {
        const key = new Map([
          ["2008-050", makeEntry("2008-050", { acceptedAnswers: accepted, requiredAnswerCount: required })],
        ]);
        const repeated = Array.from({ length: repeats + 1 }, () => present).flat();
        const response = [...filler, ...repeated].join(" ");
        const { scoring } = scoreCivicsTurn(makeTurn(1, "2008-050", response), key);
        const expected = present.length >= required ? "correct" : "incorrect";
        return scoring.result === expected;
      }),
      { numRuns: 500 }
    );
  });

  it("property: extra words around a correct answer never make it incorrect", () => {
    const filler = fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 5 });
    fc.assert(
      fc.property(filler, filler, (before, after) => {
        const response = [...before, "the constitution", ...after].join(" ");
        return scoreReal("2008-001", response) === "correct";
      }),
      { numRuns: 300 }
    );
  });
});
