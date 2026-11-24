/**
 * The 65/20 practice in the engine (spec release-finish REQ-S01, S02, S04): rules, gate, question
 * pool, scoring with no early stop, part report and full report. Real answer keys (development
 * mode), fictional profiles only.
 */
import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { loadAnswerKey } from "../civics-answer-key";
import { runCivicsStage } from "../civics-grader";
import {
  createDefaultPracticeEnv,
  createPracticeEngine,
  specialConsiderationOffered,
  type AnswerKeyResult,
  type PracticeEnv,
  type PracticeMode,
  type PracticeState,
  sessionParts,
  sessionSteps,
} from "../practice-flow";
import { designatedQuestionIds, specialConsiderationRules } from "../special-consideration";
import { loadTestRules, type TestRules } from "../test-rules-loader";
import type { CivicsTestVersion } from "../version-selector";

function quietKey(version: CivicsTestVersion): AnswerKeyResult {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return { status: "ready", key: loadAnswerKey(version, { production: false }) };
  } finally {
    warn.mockRestore();
  }
}
const KEYS = { "2008": quietKey("2008"), "2025": quietKey("2025") };
const BASE = createDefaultPracticeEnv();
const env: PracticeEnv = { ...BASE, answerKey: (v) => KEYS[v] };
const engine = createPracticeEngine(env);
const AT = "2026-11-20T10:00:00.000Z";
const PROFILE = BASE.content.profiles[0]!.id;
const FILED: Record<CivicsTestVersion, "before" | "on_or_after"> = { "2008": "before", "2025": "on_or_after" };
/** A correct answer: the first accepted answer, or all of them when several are required (some are synonyms). */
const rightAnswer = (entry: { acceptedAnswers: readonly string[]; requiredAnswerCount: number }) =>
  entry.requiredAnswerCount === 1 ? entry.acceptedAnswers[0]! : entry.acceptedAnswers.join(" and ");
const key = (v: CivicsTestVersion) => {
  const k = KEYS[v];
  if (k.status !== "ready") throw new Error("key not ready");
  return k.key;
};

function startCivics(version: CivicsTestVersion, special: boolean, seed = 1, e = engine): PracticeState {
  const chosen = e.reduce(e.initial(), { type: "choose", mode: "civics", seed, at: AT, specialConsideration: special });
  return e.reduce(chosen, { type: "start", filedOn: FILED[version], specialConsideration: special, seed, at: AT });
}

/** Answer the civics part, one answer per plan entry: true answers correctly, false wrongly. */
function answerCivics(state: PracticeState, plan: readonly boolean[], e = engine): PracticeState {
  let s = state;
  for (const ok of plan) {
    const progress = e.civicsProgress(s);
    if (progress.done || progress.current === null) break;
    const entry = progress.current;
    const response = ok ? rightAnswer(entry) : "zzz qqq";
    s = e.reduce(s, { type: "submitCivics", response, input: "typed", at: AT });
  }
  return s;
}

describe("65/20 rules (REQ-S01, REQ-S02)", () => {
  it("10 questions from a bank of 20, 6 to pass, no early stop, each value quoted", () => {
    const rules = specialConsiderationRules(loadTestRules())!;
    expect(rules).not.toBeNull();
    expect(rules.questionPoolSize.value).toBe(20);
    expect(rules.questionsAsked.value).toBe(10);
    expect(rules.passingScore.value).toBe(6);
    expect(rules.earlyStopOnCorrect.value).toBeNull();
    expect(rules.earlyStopOnIncorrect.value).toBeNull();
    expect(rules.questionsAsked.sourceQuote).toContain("contains 10 questions");
    expect(rules.passingScore.sourceQuote).toContain("at least six of 10");
    expect(rules.questionPoolSize.sourceQuote).toContain("20 specially designated");
  });
  it("the mode is off when any of the three values is not verified", () => {
    for (const field of ["questionBank", "questionsAsked", "passingScore"] as const) {
      const raw = structuredClone(loadTestRules()) as unknown as Record<string, Record<string, Record<string, unknown>>>;
      raw["65_20_specialConsideration"]![field]!.needsVerification = true;
      expect(specialConsiderationRules(raw as unknown as TestRules), field).toBeNull();
      const raw2 = structuredClone(loadTestRules()) as unknown as Record<string, Record<string, Record<string, unknown>>>;
      raw2["65_20_specialConsideration"]![field]!.sourceQuote = null;
      expect(specialConsiderationRules(raw2 as unknown as TestRules), `${field} without a quote`).toBeNull();
    }
    const off = createPracticeEngine({ ...env, specialRules: () => null });
    expect(specialConsiderationOffered(off.env)).toBe(false);
    const s = startCivics("2025", true, 1, off);
    expect(s.setup?.specialConsideration).toBe(false);
    expect(s.civicsIds).toHaveLength(20); // the normal 2025 test
  });
  it("an environment without the 65/20 functions has no 65/20 practice", () => {
    const { specialRules: _r, designated: _d, ...rest } = env;
    const plain = createPracticeEngine(rest);
    expect(specialConsiderationOffered(plain.env)).toBe(false);
    expect(startCivics("2008", true, 1, plain).setup?.specialConsideration).toBe(false);
  });
});

describe("65/20 practice in the engine (REQ-S04)", () => {
  for (const version of ["2008", "2025"] as const) {
    it(`${version}: 10 designated static questions, never a dynamic one`, () => {
      const s = startCivics(version, true);
      const designated = new Set(designatedQuestionIds(version));
      expect(s.setup?.specialConsideration).toBe(true);
      expect(s.civicsIds).toHaveLength(10);
      expect(new Set(s.civicsIds).size).toBe(10);
      for (const id of s.civicsIds) {
        expect(designated.has(id), id).toBe(true);
        expect(key(version).get(id)?.answerType, id).toBe("static");
      }
      expect(engine.civicsProgress(s).total).toBe(10);
    });
    it(`${version}: no early stop; 6 correct of 10 reaches the practice score`, () => {
      // Six right first: the normal 2008 test would stop here; the 65/20 practice goes on.
      let s = answerCivics(startCivics(version, true), [true, true, true, true, true, true]);
      expect(engine.civicsProgress(s).done).toBe(false);
      s = answerCivics(s, [false, false, false, false]);
      const progress = engine.civicsProgress(s);
      expect(progress.done).toBe(true);
      expect(progress.result?.stopReason).toBe("all_asked");
      expect(progress.result?.passed).toBe(true);
      s = engine.reduce(s, { type: "continue", at: AT });
      expect(s.partReport?.part).toBe("civics");
      if (s.partReport?.part !== "civics") throw new Error("no civics report");
      expect(s.partReport.passed).toBe(true);
      expect(s.partReport.passingScore).toBe(6);
      expect(s.partReport.stopReason).toBe("all_asked");
    });
    it(`${version}: 5 correct of 10 does not`, () => {
      const s = answerCivics(startCivics(version, true), [true, false, true, false, true, false, true, false, true, false]);
      expect(engine.civicsProgress(s).result).toMatchObject({ stopReason: "all_asked", passed: false, correctCount: 5 });
    });
  }
  it("without the choice the normal test runs unchanged", () => {
    const s = startCivics("2008", false);
    expect(s.setup?.specialConsideration).toBe(false);
    expect(s.civicsIds).toHaveLength(10);
    const done = answerCivics(s, [true, true, true, true, true, true]);
    expect(engine.civicsProgress(done).result?.stopReason).toBe("correct_threshold");
  });
  it("the choice only applies to modes with civics", () => {
    for (const mode of ["n400", "reading", "writing"] as const satisfies readonly PracticeMode[]) {
      const s = engine.reduce(engine.initial(), { type: "choose", mode, seed: 1, at: AT, specialConsideration: true });
      expect(s.specialRequested, mode).toBe(false);
      expect(s.setup?.specialConsideration ?? false, mode).toBe(false);
    }
    const civics = engine.reduce(engine.initial(), { type: "choose", mode: "civics", seed: 1, at: AT, specialConsideration: true });
    expect(civics.specialRequested).toBe(true);
  });
  it("the full interview with 65/20: the civics part uses the 65/20 rules and the report counts it", () => {
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed: 2, at: AT });
    s = engine.reduce(s, { type: "start", profileId: PROFILE, filedOn: "on_or_after", specialConsideration: true, seed: 2, at: AT });
    expect(s.civicsIds).toHaveLength(10);
    expect(engine.civicsRulesFor(s)?.passingScore.value).toBe(6);
    s = engine.reduce(s, { type: "answerN400", questionId: "n400-001", questionText: "Q?", transcript: "my answer", at: AT });
    s = engine.reduce(s, { type: "finishN400", at: AT });
    for (const kind of ["reading", "writing"] as const) {
      for (;;) {
        const p = engine.englishProgress(s, kind);
        if (p.done || p.current === null) break;
        s = engine.reduce(s, { type: kind === "reading" ? "submitReading" : "submitWriting", transcript: p.current.text, input: "typed", at: AT });
      }
      s = engine.reduce(s, { type: "continue", at: AT });
    }
    s = answerCivics(s, [true, true, true, true, true, true, true, false, false, false]);
    s = engine.reduce(s, { type: "continue", at: AT });
    expect(s.phase).toBe("report");
    const civics = s.report?.stageSummaries.find((r) => r.stage === "civics");
    expect(s.report?.practiceResult).toBe("practice_passed");
    expect(civics?.summary).toContain("All 10 questions were asked, and the practice passing score of 6 was reached.");
  });
});

describe("65/20 properties (REQ-S04)", () => {
  it("for any seed and answers: 10 asked, the practice score exactly when 6 or more are correct", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.constantFrom("2008" as const, "2025" as const),
        fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
        (seed, version, plan) => {
          const s = answerCivics(startCivics(version, true, seed), plan);
          const result = engine.civicsProgress(s).result!;
          expect(s.civics).toHaveLength(10);
          expect(result.stopReason).toBe("all_asked");
          const correct = plan.filter(Boolean).length;
          expect(result.correctCount).toBe(correct);
          expect(result.passed).toBe(correct >= 6);
        }
      ),
      { numRuns: 60 }
    );
  });
  it("the grader: a null stop rule never stops early; a set one still does", () => {
    const rules = specialConsiderationRules(loadTestRules())!;
    const entries = [...key("2025").values()].filter((e) => e.answerType === "static").slice(0, 10);
    const map = new Map(entries.map((e) => [e.id, e]));
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 0, maxLength: 10 }), (plan) => {
        const turns = plan.map((ok, i) => ({
          turnId: `civics-${i + 1}`,
          stage: "civics" as const,
          prompt: entries[i]!.questionText,
          responseText: ok ? rightAnswer(entries[i]!) : "zzz",
          questionId: entries[i]!.id,
          completedAt: AT,
        }));
        const open = runCivicsStage({ turns, answerKey: map, rules });
        expect(open.scores).toHaveLength(plan.length);
        expect(open.stopReason).toBe(plan.length === 10 ? "all_asked" : "none");
        const withStop = runCivicsStage({
          turns,
          answerKey: map,
          rules: { ...rules, earlyStopOnCorrect: { ...rules.earlyStopOnCorrect, value: 6 }, earlyStopOnIncorrect: { ...rules.earlyStopOnIncorrect, value: 5 } },
        });
        expect(withStop.stopReason).not.toBe("all_asked");
      })
    );
  });
});

describe("65/20 full interview: no English test (decisions log P)", () => {
  const start = (special: boolean) => {
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed: 4, at: AT });
    s = engine.reduce(s, { type: "start", profileId: PROFILE, filedOn: "before", specialConsideration: special, seed: 4, at: AT });
    return s;
  };
  it("the steps are setup, N-400, civics, report; reading and writing are not selected", () => {
    expect(sessionSteps("full", true)).toEqual(["intro", "n400_interview", "civics", "report"]);
    expect(sessionSteps("full", false)).toEqual(["intro", "n400_interview", "reading", "writing", "civics", "report"]);
    const s = start(true);
    expect(sessionParts(s)).toEqual(["n400_interview", "civics"]);
    expect(s.readingIds).toEqual([]);
    expect(s.writingIds).toEqual([]);
  });
  it("after the N-400 part comes civics, and the report has no English summaries", () => {
    let s = start(true);
    s = engine.reduce(s, { type: "answerN400", questionId: "n400-001", questionText: "Q?", transcript: "my answer", at: AT });
    s = engine.reduce(s, { type: "finishN400", at: AT });
    expect(s.phase).toBe("civics");
    s = answerCivics(s, [true, true, true, true, true, true, false, false, false, false]);
    s = engine.reduce(s, { type: "continue", at: AT });
    expect(s.phase).toBe("report");
    expect(s.report?.stageSummaries.map((x) => x.stage)).toEqual(["civics"]);
    expect(s.report?.practiceResult).toBe("practice_passed");
  });
  it("without 65/20 the full interview still goes to reading", () => {
    let s = start(false);
    s = engine.reduce(s, { type: "finishN400", at: AT });
    expect(s.phase).toBe("reading");
  });
  it("property: with 65/20 the practice result follows civics alone", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }), fc.integer({ min: 0, max: 1000 }), (plan, seed) => {
        let s = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed, at: AT });
        s = engine.reduce(s, { type: "start", profileId: PROFILE, filedOn: "on_or_after", specialConsideration: true, seed, at: AT });
        s = engine.reduce(s, { type: "finishN400", at: AT });
        s = engine.reduce(answerCivics(s, plan), { type: "continue", at: AT });
        expect(s.report?.practiceResult).toBe(plan.filter(Boolean).length >= 6 ? "practice_passed" : "needs_more_practice");
      }),
      { numRuns: 40 }
    );
  });
});
