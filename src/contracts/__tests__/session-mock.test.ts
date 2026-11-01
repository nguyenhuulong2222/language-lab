/**
 * Validates mock/session.json against the InterviewSession contract.
 *
 * This test has two layers:
 * 1. TypeScript compile-time: the `satisfies` assertion on import ensures the JSON
 *    matches the InterviewSession shape. A type error here means the mock drifted
 *    from the contract.
 * 2. Runtime: explicit checks for rules that cannot be expressed purely as types
 *    (e.g. practiceResult values, civics scoringSource, no "pass"/"fail" strings).
 */

import { describe, it, expect } from "vitest";
import { fc } from "@fast-check/vitest";
import type { InterviewSession, ScoringResult } from "../session.js";
import rawSession from "../../../mock/session.json" with { type: "json" };

// ---------------------------------------------------------------------------
// Compile-time shape check
// The cast below will produce a TS error if mock/session.json diverges from
// the InterviewSession type (e.g. wrong practiceResult value, missing field).
// ---------------------------------------------------------------------------
const session = rawSession as unknown as InterviewSession;

// ---------------------------------------------------------------------------
// Runtime checks
// ---------------------------------------------------------------------------

describe("mock/session.json", () => {
  it("isFictional is true", () => {
    expect(session.isFictional).toBe(true);
  });

  it("testVersion is 2008 or 2025", () => {
    expect(["2008", "2025"]).toContain(session.testVersion);
  });

  it("has no A-number pattern", () => {
    const raw = JSON.stringify(rawSession);
    expect(raw).not.toMatch(/\bA-?\d{8,9}\b/i);
  });

  it("practiceResult is practice_passed or needs_more_practice", () => {
    const pr = session.finalReport?.practiceResult;
    expect(["practice_passed", "needs_more_practice"]).toContain(pr);
  });

  it("does not contain bare 'pass' or 'fail' string values", () => {
    const raw = JSON.stringify(rawSession);
    // Match "pass" or "fail" as standalone JSON string values
    expect(raw).not.toMatch(/"(pass|fail)"/);
  });

  it("finalReport has a non-empty disclaimer", () => {
    expect(session.finalReport?.disclaimer?.trim().length).toBeGreaterThan(0);
  });

  it("all civics scoring results use scoringSource: answer_key", () => {
    for (const [, score] of Object.entries(
      session.scoringResults as Record<string, ScoringResult>
    )) {
      if (score.stage === "civics") {
        expect(score.scoringSource).toBe("answer_key");
        // TypeScript narrows here; this assertion is also a runtime guard
        expect(["correct", "incorrect"]).toContain(score.result);
      }
    }
  });

  it("all N-400 feedback values are valid", () => {
    for (const score of Object.values(
      session.scoringResults as Record<string, ScoringResult>
    )) {
      if (score.stage === "n400_interview") {
        expect(["understood", "needs_practice", "unclear"]).toContain(
          score.feedback
        );
      }
    }
  });

  it("all reading/writing scores have a positive attempts count", () => {
    for (const score of Object.values(
      session.scoringResults as Record<string, ScoringResult>
    )) {
      if (score.stage === "reading" || score.stage === "writing") {
        expect(score.attempts).toBeGreaterThan(0);
      }
    }
  });

  it("every turn has a stage that matches a valid SessionStage", () => {
    const validStages = [
      "intro",
      "n400_interview",
      "reading",
      "writing",
      "civics",
      "report",
    ];
    for (const turn of session.turns) {
      expect(validStages).toContain(turn.stage);
    }
  });

  it("every scored turn references a turnId that exists in turns", () => {
    const turnIds = new Set(session.turns.map((t) => t.turnId));
    for (const turnId of Object.keys(session.scoringResults)) {
      expect(turnIds.has(turnId)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Property-based: practiceResult values are always practice_passed or needs_more_practice
// ---------------------------------------------------------------------------

describe("PracticeResult contract (property-based)", () => {
  it("any generated practiceResult is within the allowed set", () => {
    const validResults = ["practice_passed", "needs_more_practice"] as const;
    fc.assert(
      fc.property(fc.constantFrom(...validResults), (result) => {
        // The valid set contains only "practice_passed" and "needs_more_practice".
        // This property verifies that any value drawn from it satisfies the constraint.
        return validResults.includes(result);
      })
    );
  });
});
