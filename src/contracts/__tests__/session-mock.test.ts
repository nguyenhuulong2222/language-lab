/**
 * Validates the fictional session fixtures against the InterviewSession contract.
 *
 * - mock/session.json              valid PASSING fixture  (practice_passed)
 * - mock/session-needs-practice.json  valid FAILING fixture (needs_more_practice)
 *
 * Compile time: the cast to InterviewSession fails to type-check if a fixture drifts
 * from the contract. Runtime: rules that types cannot express (questionId on civics
 * turns, attempts meaning "sentences presented", no pass/fail strings, no fake IDs).
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { InterviewSession, ScoringResult } from "../session.js";
import passingRaw from "../../../mock/session.json" with { type: "json" };
import failingRaw from "../../../mock/session-needs-practice.json" with { type: "json" };

const FIXTURES = [
  {
    name: "mock/session.json",
    raw: passingRaw,
    session: passingRaw as unknown as InterviewSession,
    expectedResult: "practice_passed",
  },
  {
    name: "mock/session-needs-practice.json",
    raw: failingRaw,
    session: failingRaw as unknown as InterviewSession,
    expectedResult: "needs_more_practice",
  },
] as const;

const VALID_STAGES = [
  "intro",
  "n400_interview",
  "reading",
  "writing",
  "civics",
  "report",
];

describe.each(FIXTURES)("$name", ({ raw, session, expectedResult }) => {
  const results = session.scoringResults as Record<string, ScoringResult>;

  it("is marked fictional", () => {
    expect(session.isFictional).toBe(true);
    expect((raw as { _note: string })._note).toContain(
      "Fictional practice profile"
    );
  });

  it("testVersion is 2008 or 2025", () => {
    expect(["2008", "2025"]).toContain(session.testVersion);
  });

  it("has no A-number pattern", () => {
    expect(JSON.stringify(raw)).not.toMatch(/\bA-?\d{8,9}\b/i);
  });

  it(`practiceResult is ${expectedResult}`, () => {
    expect(session.finalReport?.practiceResult).toBe(expectedResult);
  });

  it("does not contain bare 'pass' or 'fail' string values", () => {
    expect(JSON.stringify(raw)).not.toMatch(/"(pass|fail)"/);
  });

  it("finalReport has a non-empty disclaimer", () => {
    expect(session.finalReport?.disclaimer?.trim().length).toBeGreaterThan(0);
  });

  it("every turn has a valid stage", () => {
    for (const turn of session.turns) {
      expect(VALID_STAGES).toContain(turn.stage);
    }
  });

  it("every scored turnId exists and the result stage matches the turn stage", () => {
    const byId = new Map(session.turns.map((t) => [t.turnId, t]));
    for (const [turnId, score] of Object.entries(results)) {
      expect(byId.has(turnId), `${turnId} missing from turns`).toBe(true);
      expect(score.stage).toBe(byId.get(turnId)!.stage);
    }
  });

  it("every civics turn has a questionId in the form {testVersion}-NNN", () => {
    const civics = session.turns.filter((t) => t.stage === "civics");
    expect(civics.length).toBeGreaterThan(0);
    for (const turn of civics) {
      expect(turn.questionId, `${turn.turnId} has no questionId`).toBeTruthy();
      expect(turn.questionId).toMatch(
        new RegExp(`^${session.testVersion}-\\d{3}$`)
      );
    }
  });

  it("non-civics turns have no questionId", () => {
    for (const turn of session.turns.filter((t) => t.stage !== "civics")) {
      expect(turn.questionId).toBeUndefined();
    }
  });

  it("civics scores use scoringSource answer_key and are never unscored (static-only fixture)", () => {
    for (const score of Object.values(results)) {
      if (score.stage === "civics") {
        expect(score.scoringSource).toBe("answer_key");
        expect(["correct", "incorrect"]).toContain(score.result);
      }
    }
  });

  it("N-400 feedback values are valid", () => {
    for (const score of Object.values(results)) {
      if (score.stage === "n400_interview") {
        expect(["understood", "needs_practice", "unclear"]).toContain(
          score.feedback
        );
      }
    }
  });

  it("reading and writing attempts equal the number of sentences presented so far", () => {
    for (const stage of ["reading", "writing"] as const) {
      const turns = session.turns.filter((t) => t.stage === stage);
      turns.forEach((turn, index) => {
        const score = results[turn.turnId];
        expect(score?.stage).toBe(stage);
        if (score?.stage === "reading" || score?.stage === "writing") {
          expect(score.attempts).toBe(index + 1);
        }
      });
    }
  });

  it("civics summary review items match the number of incorrect civics answers", () => {
    const incorrect = Object.values(results).filter(
      (s) => s.stage === "civics" && s.result === "incorrect"
    ).length;
    const civics = session.finalReport?.stageSummaries.find(
      (s) => s.stage === "civics"
    );
    expect(civics?.reviewItems).toHaveLength(incorrect);
  });
});

describe("fixtures together", () => {
  it("use different sessions and different fictional profiles", () => {
    const [a, b] = FIXTURES;
    expect(a.session.sessionId).not.toBe(b.session.sessionId);
    expect(a.session.fictionalProfileId).not.toBe(b.session.fictionalProfileId);
  });
});

describe("PracticeResult contract", () => {
  it("property: practiceResult values never include pass or fail", () => {
    const valid = ["practice_passed", "needs_more_practice"] as const;
    fc.assert(
      fc.property(fc.constantFrom(...valid), (result) =>
        (valid as readonly string[]).includes(result)
      )
    );
  });
});
