/**
 * Home and section choice (B-11): the full interview or one part, what each mode needs, the
 * steps of each session, and the report of a single part (no overall practice result).
 */
import { describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";
import { loadAnswerKey } from "../civics-answer-key";
import {
  createDefaultPracticeEnv,
  createPracticeEngine,
  modeNeeds,
  modeParts,
  sessionSteps,
  type AnswerKeyResult,
  type PracticeMode,
  type PracticeState,
} from "../practice-flow";
import { loadCivicsBoundaryDate, loadCivicsRules, loadEnglishRules } from "../test-rules-loader";
import { selectTestVersion, type CivicsTestVersion } from "../version-selector";

const AT = "2026-11-17T10:00:00.000Z";

function quiet(version: CivicsTestVersion): AnswerKeyResult {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return { status: "ready", key: loadAnswerKey(version, { production: false }) };
  } finally {
    warn.mockRestore();
  }
}
const keys = { "2008": quiet("2008"), "2025": quiet("2025") };
const base = createDefaultPracticeEnv();
const engine = createPracticeEngine({ ...base, answerKey: (v) => keys[v] });
const lockedEngine = createPracticeEngine({ ...base, answerKey: () => ({ status: "locked", reason: "needsHumanReview" }) });
const PROFILE = base.content.profiles[0]!.id;
const MODES: PracticeMode[] = ["full", "n400", "reading", "writing", "civics"];

const choose = (e: typeof engine, mode: PracticeMode, seed = 1) => e.reduce(e.initial(), { type: "choose", mode, seed, at: AT });

describe("modes", () => {
  it("know what they need", () => {
    expect(modeNeeds("full")).toEqual({ profile: true, filing: true });
    expect(modeNeeds("n400")).toEqual({ profile: true, filing: false });
    expect(modeNeeds("civics")).toEqual({ profile: false, filing: true });
    expect(modeNeeds("reading")).toEqual({ profile: false, filing: false });
    expect(modeNeeds("writing")).toEqual({ profile: false, filing: false });
  });

  it("have the steps of their session", () => {
    expect(sessionSteps("full")).toEqual(["intro", "n400_interview", "reading", "writing", "civics", "report"]);
    expect(sessionSteps("n400")).toEqual(["intro", "n400_interview", "report"]);
    expect(sessionSteps("reading")).toEqual(["reading", "report"]);
    expect(sessionSteps("writing")).toEqual(["writing", "report"]);
    expect(sessionSteps("civics")).toEqual(["intro", "civics", "report"]);
  });

  it("property: steps end with the report, never repeat, hold every part, and have a setup step only when something is asked", () => {
    fc.assert(
      fc.property(fc.constantFrom(...MODES), (mode) => {
        const steps = sessionSteps(mode);
        const needs = modeNeeds(mode);
        return (
          steps[steps.length - 1] === "report" &&
          new Set(steps).size === steps.length &&
          modeParts(mode).every((part) => steps.includes(part)) &&
          steps.includes("intro") === (needs.profile || needs.filing) &&
          steps.length === modeParts(mode).length + 1 + (needs.profile || needs.filing ? 1 : 0)
        );
      })
    );
  });
});

describe("choosing", () => {
  it("starts at home and ignores a choice made anywhere else", () => {
    expect(engine.initial().phase).toBe("home");
    const running = choose(engine, "reading");
    expect(engine.reduce(running, { type: "choose", mode: "writing", seed: 1, at: AT })).toBe(running);
  });

  it("reading and writing start at once, without setup", () => {
    for (const mode of ["reading", "writing"] as const) {
      const s = choose(engine, mode);
      expect(s.phase).toBe(mode);
      expect(s.setup).toEqual({ profileId: null, filedOn: null, filingDate: null, version: null });
      expect(s.civicsIds).toEqual([]);
    }
    const reading = choose(engine, "reading");
    expect(reading.readingIds).toHaveLength(loadEnglishRules().reading.sentencesPresented.value);
    expect(reading.writingIds).toEqual([]);
  });

  it("n400, civics and the full interview wait for a setup choice", () => {
    for (const mode of ["n400", "civics", "full"] as const) {
      const s = choose(engine, mode);
      expect(s.phase).toBe("intro");
      expect(s.mode).toBe(mode);
    }
  });

  it("setup: only the needed choices count; others are dropped", () => {
    const n400 = engine.reduce(choose(engine, "n400"), { type: "start", profileId: PROFILE, filedOn: "before", seed: 1, at: AT });
    expect(n400.phase).toBe("n400_interview");
    expect(n400.setup).toEqual({ profileId: PROFILE, filedOn: null, filingDate: null, version: null });
    const civics = engine.reduce(choose(engine, "civics"), { type: "start", profileId: PROFILE, filedOn: "before", seed: 1, at: AT });
    expect(civics.phase).toBe("civics");
    expect(civics.setup?.profileId).toBeNull();
    expect(civics.setup?.version).toBe("2008");
  });

  it("setup stays put when something needed is missing", () => {
    const n400 = choose(engine, "n400");
    expect(engine.reduce(n400, { type: "start", seed: 1, at: AT })).toBe(n400);
    expect(engine.reduce(n400, { type: "start", profileId: "real-person", seed: 1, at: AT })).toBe(n400);
    const civics = choose(engine, "civics");
    expect(engine.reduce(civics, { type: "start", seed: 1, at: AT })).toBe(civics);
    const full = choose(engine, "full");
    expect(engine.reduce(full, { type: "start", profileId: PROFILE, seed: 1, at: AT })).toBe(full);
  });

  it("property: the filing choice picks the version through the engine for any seed", () => {
    fc.assert(
      fc.property(fc.constantFrom("before" as const, "on_or_after" as const), fc.integer({ min: 0, max: 100000 }), (filedOn, seed) => {
        const s = engine.reduce(choose(engine, "civics", seed), { type: "start", filedOn, seed, at: AT });
        const boundary = loadCivicsBoundaryDate();
        return s.setup?.version === selectTestVersion(s.setup!.filingDate!, boundary) && (filedOn === "before") === (s.setup?.version === "2008");
      }),
      { numRuns: 60 }
    );
  });
});

function finishEnglish(e: typeof engine, state: PracticeState, kind: "reading" | "writing", right: boolean): PracticeState {
  let s = state;
  for (;;) {
    const p = e.englishProgress(s, kind);
    if (p.done || p.current === null) return s;
    s = e.reduce(s, {
      type: kind === "reading" ? "submitReading" : "submitWriting",
      transcript: right ? p.current.text : "zzz qqq",
      input: "typed",
      at: AT,
    });
  }
}

describe("a single part ends with a report for that part only", () => {
  it.each(["reading", "writing"] as const)("%s", (mode) => {
    for (const right of [true, false]) {
      let s = finishEnglish(engine, choose(engine, mode), mode, right);
      s = engine.reduce(s, { type: "continue", at: AT });
      expect(s.phase).toBe("report");
      expect(s.report).toBeNull();
      expect(engine.buildSession(s)).toBeNull();
      const report = s.partReport!;
      expect(report.part).toBe(mode);
      expect("practiceResult" in report).toBe(false);
      if (report.part === "reading" || report.part === "writing") {
        expect(report.passed).toBe(right);
        expect(report.neededCorrect).toBe(loadEnglishRules()[mode].sentencesToPassCount.value);
        expect(report.items).toHaveLength(report.attempts);
      }
      expect(report.disclaimer).toMatch(/practice tool only/i);
    }
  });

  it("n400: the user's own words, not scored", () => {
    let s = engine.reduce(choose(engine, "n400"), { type: "start", profileId: PROFILE, seed: 1, at: AT });
    s = engine.reduce(s, { type: "answerN400", questionId: "n400-001", questionText: "Q one?", transcript: "my own words", at: AT });
    s = engine.reduce(s, { type: "finishN400", at: AT });
    expect(s.phase).toBe("report");
    expect(s.partReport).toMatchObject({ part: "n400_interview", answers: [{ question: "Q one?", transcript: "my own words" }] });
    expect(s.report).toBeNull();
  });

  it("civics: counts come from the real engine and unscored are not wrong", () => {
    const rules = loadCivicsRules("2008");
    let s = engine.reduce(choose(engine, "civics"), { type: "start", filedOn: "before", seed: 2, at: AT });
    for (;;) {
      const p = engine.civicsProgress(s);
      if (p.done || p.current === null) break;
      const q = p.current;
      s = engine.reduce(s, { type: "submitCivics", response: q.acceptedAnswers.slice(0, q.requiredAnswerCount).join(" and "), input: "typed", at: AT });
    }
    s = engine.reduce(s, { type: "continue", at: AT });
    expect(s.phase).toBe("report");
    const report = s.partReport!;
    expect(report).toMatchObject({ part: "civics", version: "2008", passed: true, correct: rules.earlyStopOnCorrect.value, incorrect: 0, unscored: [] });
    expect("practiceResult" in report).toBe(false);
  });

  it("property: a civics-only report agrees with the engine for any answers", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }), fc.constantFrom("before" as const, "on_or_after" as const), fc.integer({ min: 0, max: 5000 }), (answers, filedOn, seed) => {
        let s = engine.reduce(choose(engine, "civics", seed), { type: "start", filedOn, seed, at: AT });
        let i = 0;
        for (;;) {
          const p = engine.civicsProgress(s);
          if (p.done || p.current === null) break;
          const ok = answers[i++ % answers.length]!;
          const q = p.current;
          s = engine.reduce(s, { type: "submitCivics", response: ok ? q.acceptedAnswers.slice(0, q.requiredAnswerCount).join(" and ") : "zzz qqq", input: "typed", at: AT });
        }
        const result = engine.civicsProgress(s).result!;
        s = engine.reduce(s, { type: "continue", at: AT });
        const report = s.partReport;
        if (report === null || report.part !== "civics") return false;
        const rules = loadCivicsRules(s.setup!.version!);
        return (
          report.correct === result.correctCount &&
          report.incorrect === result.incorrectCount &&
          report.stopReason === result.stopReason &&
          report.passed === (result.correctCount >= rules.passingScore.value && result.stopReason === "correct_threshold") &&
          report.reviewItems.length === result.incorrectCount &&
          report.unscored.length === result.unscoredCount &&
          s.report === null
        );
      }),
      { numRuns: 60 }
    );
  });

  it("civics with the key refused: no report is built", () => {
    let s = lockedEngine.reduce(choose(lockedEngine, "civics"), { type: "start", filedOn: "on_or_after", seed: 1, at: AT });
    expect(s.phase).toBe("civics");
    expect(lockedEngine.civicsProgress(s).locked).toBe(true);
    s = lockedEngine.reduce(s, { type: "continue", at: AT });
    expect(s.phase).toBe("civics");
    expect(s.partReport).toBeNull();
  });

  it("reading and writing still work when the civics key is refused", () => {
    const s = lockedEngine.reduce(finishEnglish(lockedEngine, choose(lockedEngine, "reading"), "reading", true), { type: "continue", at: AT });
    expect(s.partReport?.part).toBe("reading");
  });
});

describe("the full interview is unchanged by modes", () => {
  it("still ends with the overall report and no part report", () => {
    let s = engine.reduce(choose(engine, "full"), { type: "start", profileId: PROFILE, filedOn: "before", seed: 1, at: AT });
    s = engine.reduce(s, { type: "finishN400", at: AT });
    expect(s.phase).toBe("reading");
    s = engine.reduce(finishEnglish(engine, s, "reading", true), { type: "continue", at: AT });
    expect(s.phase).toBe("writing");
    s = engine.reduce(finishEnglish(engine, s, "writing", true), { type: "continue", at: AT });
    expect(s.phase).toBe("civics");
    expect(s.partReport).toBeNull();
  });

  it("restart returns to the home screen", () => {
    const s = choose(engine, "reading");
    expect(engine.reduce(s, { type: "restart" })).toEqual(engine.initial());
  });
});
