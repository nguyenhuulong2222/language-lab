/**
 * The three USCIS age and residency exceptions (decisions log Q): 50/20 and 55/15 skip reading and
 * writing and take the usual civics test; 65/20 skips reading and writing and takes the designated
 * questions with the 65/20 rules; "none" is unchanged.
 */
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  AGE_EXCEPTIONS,
  createDefaultPracticeEnv,
  createPracticeEngine,
  englishExempt,
  modeParts,
  sessionParts,
  usesDesignatedSet,
  type AgeException,
  type PracticeState,
} from "../practice-flow";
import { designatedQuestionIds } from "../special-consideration";

const AT = "2026-11-17T10:00:00.000Z";
const env = createDefaultPracticeEnv();
const engine = createPracticeEngine(env);
const PROFILE = env.content.profiles[0]!.id;
const FILED = { "2008": "before", "2025": "on_or_after" } as const;

function startFull(version: "2008" | "2025", exception: AgeException | undefined, seed = 3): PracticeState {
  const chosen = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed, at: AT, ...(exception === undefined ? {} : { exception }) });
  return engine.reduce(chosen, {
    type: "start",
    profileId: PROFILE,
    filedOn: FILED[version],
    ...(exception === undefined ? {} : { exception }),
    seed,
    at: AT,
  });
}

describe("exception helpers", () => {
  it("50/20, 55/15 and 65/20 are exempt from English; only 65/20 uses the designated set", () => {
    expect(AGE_EXCEPTIONS).toEqual(["none", "50/20", "55/15", "65/20"]);
    expect(AGE_EXCEPTIONS.map(englishExempt)).toEqual([false, true, true, true]);
    expect(AGE_EXCEPTIONS.map(usesDesignatedSet)).toEqual([false, false, false, true]);
  });
  it("the full interview: N-400 and civics for an exempt choice, all four parts for none", () => {
    expect(modeParts("full", "none")).toEqual(["n400_interview", "reading", "writing", "civics"]);
    for (const e of ["50/20", "55/15", "65/20"] as const) expect(modeParts("full", e), e).toEqual(["n400_interview", "civics"]);
    // A single part is the same for every choice.
    for (const e of AGE_EXCEPTIONS) expect(modeParts("civics", e), e).toEqual(["civics"]);
  });
});

describe("each exception: parts, civics pool and pass rule", () => {
  for (const version of ["2008", "2025"] as const) {
    const normal = env.civicsRules(version);
    const special = env.specialRules!()!;
    const expected: Record<AgeException, { parts: string[]; asked: number; pass: number }> = {
      none: { parts: ["n400_interview", "reading", "writing", "civics"], asked: normal.questionsAsked.value, pass: normal.passingScore.value },
      "50/20": { parts: ["n400_interview", "civics"], asked: normal.questionsAsked.value, pass: normal.passingScore.value },
      "55/15": { parts: ["n400_interview", "civics"], asked: normal.questionsAsked.value, pass: normal.passingScore.value },
      "65/20": { parts: ["n400_interview", "civics"], asked: special.questionsAsked.value, pass: special.passingScore.value },
    };
    for (const e of AGE_EXCEPTIONS) {
      it(`${version}, ${e}: ${expected[e].parts.length} parts, ${expected[e].asked} questions, ${expected[e].pass} to pass`, () => {
        const s = startFull(version, e);
        expect(s.setup?.exception).toBe(e);
        expect(sessionParts(s)).toEqual(expected[e].parts);
        expect(s.civicsIds).toHaveLength(expected[e].asked);
        expect(engine.civicsRulesFor(s)?.passingScore.value).toBe(expected[e].pass);
      });
    }
  }
  it("65/20 asks only designated questions (10 of 20, 6 to pass)", () => {
    for (const version of ["2008", "2025"] as const) {
      const designated = new Set(designatedQuestionIds(version));
      const s = startFull(version, "65/20");
      expect(s.civicsIds).toHaveLength(10);
      for (const id of s.civicsIds) expect(designated.has(id), id).toBe(true);
    }
  });
  it("a civics part keeps the choice and its report names it", () => {
    for (const e of AGE_EXCEPTIONS) {
      let s = engine.reduce(engine.initial(), { type: "choose", mode: "civics", seed: 2, at: AT, exception: e });
      expect(s.exceptionRequested).toBe(e);
      s = engine.reduce(s, { type: "start", filedOn: "on_or_after", exception: e, seed: 2, at: AT });
      expect(s.setup?.exception).toBe(e);
      for (let guard = 0; guard < 30 && !engine.civicsProgress(s).done; guard++) {
        s = engine.reduce(s, { type: "submitCivics", response: "zzz", input: "typed", at: AT });
      }
      s = engine.reduce(s, { type: "continue", at: AT });
      expect(s.partReport?.part).toBe("civics");
      if (s.partReport?.part === "civics") expect(s.partReport.exception).toBe(e);
    }
  });
});

describe("properties", () => {
  const exempt = fc.constantFrom<AgeException>("50/20", "55/15", "65/20");
  const version = fc.constantFrom<"2008" | "2025">("2008", "2025");
  const seed = fc.integer({ min: 0, max: 5000 });
  it("50/20 and 55/15 never use the starred set: the usual pool and rules", () => {
    const outside = { "2008": false, "2025": false };
    fc.assert(
      fc.property(fc.constantFrom<AgeException>("50/20", "55/15"), version, seed, (e, v, n) => {
        const s = startFull(v, e, n);
        const normal = env.civicsRules(v);
        expect(engine.civicsRulesFor(s)).toBe(normal);
        expect(s.civicsIds).toHaveLength(normal.questionsAsked.value);
        const designated = new Set(designatedQuestionIds(v));
        if (s.civicsIds.some((id) => !designated.has(id))) outside[v] = true;
      }),
      { numRuns: 60 }
    );
    // Over many seeds the usual pool shows questions outside the 20 starred ones.
    expect(outside).toEqual({ "2008": true, "2025": true });
  });
  it("every exempt choice skips reading and writing", () => {
    fc.assert(
      fc.property(exempt, version, seed, (e, v, n) => {
        const s = startFull(v, e, n);
        expect(s.readingIds).toEqual([]);
        expect(s.writingIds).toEqual([]);
        let t = engine.reduce(s, { type: "finishN400", at: AT });
        expect(t.phase).toBe("civics");
        for (let guard = 0; guard < 30 && !engine.civicsProgress(t).done; guard++) {
          t = engine.reduce(t, { type: "submitCivics", response: "zzz", input: "typed", at: AT });
        }
        t = engine.reduce(t, { type: "continue", at: AT });
        expect(t.report?.stageSummaries.map((x) => x.stage)).toEqual(["civics"]);
      }),
      { numRuns: 40 }
    );
  });
  it("none is unchanged: the same session as without any choice", () => {
    fc.assert(
      fc.property(version, seed, (v, n) => {
        expect(startFull(v, "none", n)).toEqual(startFull(v, undefined, n));
      }),
      { numRuns: 40 }
    );
  });
});
