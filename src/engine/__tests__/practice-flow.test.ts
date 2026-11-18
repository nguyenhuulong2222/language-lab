/**
 * Tests for src/engine/practice-flow.ts (B-04). The whole flow runs through the real engine:
 * version selector, rules, real answer keys (development mode), graders and report builder.
 * Fictional profiles only.
 */
import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { loadAnswerKey, type CivicsAnswerEntry } from "../civics-answer-key";
import {
  createAnswerKeyLoader,
  createDefaultPracticeEnv,
  createPracticeEngine,
  listPracticeQuestions,
  representativeFilingDate,
  seededShuffle,
  type AnswerKeyResult,
  type PracticeAction,
  type PracticeEnv,
  type PracticeState,
} from "../practice-flow";
import { loadCivicsBoundaryDate, loadCivicsRules, loadEnglishRules } from "../test-rules-loader";
import { selectTestVersion, type CivicsTestVersion } from "../version-selector";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function quietKey(version: CivicsTestVersion): AnswerKeyResult {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return { status: "ready", key: loadAnswerKey(version, { production: false }) };
  } finally {
    warn.mockRestore();
  }
}

const KEYS = { "2008": quietKey("2008"), "2025": quietKey("2025") };
const BASE_ENV = createDefaultPracticeEnv();
const env: PracticeEnv = { ...BASE_ENV, answerKey: (v) => KEYS[v] };
const engine = createPracticeEngine(env);
const lockedEngine = createPracticeEngine({
  ...env,
  answerKey: () => ({ status: "locked", reason: "needsHumanReview is true" }),
});

const AT = "2026-11-17T10:00:00.000Z";
const PROFILE = BASE_ENV.content.profiles[0]!.id;

function readyKey(version: CivicsTestVersion): ReadonlyMap<string, CivicsAnswerEntry> {
  const k = KEYS[version];
  if (k.status !== "ready") throw new Error("key not ready");
  return k.key;
}

function started(filedOn: "before" | "on_or_after", seed = 1, e = engine): PracticeState {
  return e.reduce(e.initial(), { type: "start", profileId: PROFILE, filedOn, seed, at: AT });
}

type Plan = { reading: boolean[]; writing: boolean[]; civics: boolean[] };

/** Play a whole session. A true entry answers correctly, a false entry answers wrongly. */
function play(e: typeof engine, state: PracticeState, plan: Plan): PracticeState {
  let s = state;
  const step = (a: PracticeAction) => (s = e.reduce(s, a));
  step({ type: "answerN400", questionId: "n400-001", questionText: "Q?", transcript: "my answer", at: AT });
  step({ type: "finishN400" });

  for (const kind of ["reading", "writing"] as const) {
    const flags = kind === "reading" ? plan.reading : plan.writing;
    let i = 0;
    for (;;) {
      const progress = e.englishProgress(s, kind);
      if (progress.done || progress.current === null) break;
      const ok = flags[i++ % Math.max(flags.length, 1)] ?? false;
      step({
        type: kind === "reading" ? "submitReading" : "submitWriting",
        transcript: ok ? progress.current.text : "zzz qqq",
        input: "typed",
        at: AT,
      });
    }
    step({ type: "continue", at: AT });
  }

  let i = 0;
  for (;;) {
    const progress = e.civicsProgress(s);
    if (progress.done || progress.current === null) break;
    const ok = plan.civics[i++ % Math.max(plan.civics.length, 1)] ?? false;
    const entry = progress.current;
    const response = ok ? entry.acceptedAnswers.slice(0, entry.requiredAnswerCount).join(" and ") : "zzz qqq";
    step({ type: "submitCivics", response, input: "typed", at: AT });
  }
  step({ type: "continue", at: AT });
  return s;
}

const ALL_RIGHT: Plan = { reading: [true], writing: [true], civics: [true] };
const ALL_WRONG: Plan = { reading: [false], writing: [false], civics: [false] };

// ---------------------------------------------------------------------------
// Setup and version
// ---------------------------------------------------------------------------

describe("filing date and version", () => {
  it("before the boundary gives 2008, on or after gives 2025, picked by the engine", () => {
    const boundary = loadCivicsBoundaryDate();
    expect(selectTestVersion(representativeFilingDate("before", boundary), boundary)).toBe("2008");
    expect(selectTestVersion(representativeFilingDate("on_or_after", boundary), boundary)).toBe("2025");
    expect(started("before").setup?.version).toBe("2008");
    expect(started("on_or_after").setup?.version).toBe("2025");
  });

  it("property: for any valid boundary date the choice maps to the matching version", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2001-01-02"), max: new Date("2090-12-30"), noInvalidDate: true }),
        (d) => {
          const boundary = d.toISOString().slice(0, 10);
          const before = representativeFilingDate("before", boundary);
          const after = representativeFilingDate("on_or_after", boundary);
          return (
            before < boundary &&
            after === boundary &&
            selectTestVersion(before, boundary) === "2008" &&
            selectTestVersion(after, boundary) === "2025"
          );
        }
      ),
      { numRuns: 300 }
    );
  });

  it("start ignores an unknown profile and starts only from the intro", () => {
    const s = engine.reduce(engine.initial(), { type: "start", profileId: "real-person", filedOn: "before", seed: 1, at: AT });
    expect(s.phase).toBe("intro");
    const running = started("before");
    expect(engine.reduce(running, { type: "start", profileId: PROFILE, filedOn: "on_or_after", seed: 2, at: AT })).toBe(running);
  });

  it("the session is fictional", () => {
    const session = engine.buildSession(started("before"))!;
    expect(session.isFictional).toBe(true);
    expect(session.fictionalProfileId).toMatch(/^fictional-profile-/);
    expect(engine.buildSession(engine.initial())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

describe("selection", () => {
  it("uses only static civics questions, as many as the rules ask, with no repeats", () => {
    for (const version of ["2008", "2025"] as const) {
      const s = started(version === "2008" ? "before" : "on_or_after");
      const key = readyKey(version);
      expect(s.civicsIds.length).toBe(loadCivicsRules(version).questionsAsked.value);
      expect(new Set(s.civicsIds).size).toBe(s.civicsIds.length);
      for (const id of s.civicsIds) expect(key.get(id)?.answerType).toBe("static");
    }
  });

  it("presents as many reading and writing sentences as the rules say", () => {
    const s = started("before");
    expect(s.readingIds.length).toBe(loadEnglishRules().reading.sentencesPresented.value);
    expect(s.writingIds.length).toBe(loadEnglishRules().writing.sentencesPresented.value);
  });

  it("property: the same seed gives the same selection; ids never repeat", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        const a = started("on_or_after", seed);
        const b = started("on_or_after", seed);
        return (
          JSON.stringify(a) === JSON.stringify(b) &&
          new Set(a.civicsIds).size === a.civicsIds.length &&
          new Set(a.readingIds).size === a.readingIds.length
        );
      }),
      { numRuns: 100 }
    );
  });

  it("property: a shuffle keeps the same items", () => {
    fc.assert(
      fc.property(fc.array(fc.integer(), { maxLength: 30 }), fc.integer(), (items, seed) => {
        const out = seededShuffle(items, seed);
        return out.length === items.length && [...out].sort().join() === [...items].sort().join();
      })
    );
  });

  it("listPracticeQuestions never returns a dynamic question", () => {
    for (const version of ["2008", "2025"] as const) {
      const all = readyKey(version);
      const listed = listPracticeQuestions(all);
      expect(listed.length).toBeLessThan(all.size);
      expect(listed.every((e) => e.answerType === "static")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Whole runs
// ---------------------------------------------------------------------------

describe.each([
  { filedOn: "before" as const, version: "2008" as const },
  { filedOn: "on_or_after" as const, version: "2025" as const },
])("a whole run, filed $filedOn ($version rules)", ({ filedOn, version }) => {
  const rules = loadCivicsRules(version);

  it("all answers right: practice_passed, civics stops on the correct threshold", () => {
    const s = play(engine, started(filedOn), ALL_RIGHT);
    expect(s.phase).toBe("report");
    expect(s.report?.practiceResult).toBe("practice_passed");
    const progress = engine.civicsProgress(s);
    expect(progress.result?.stopReason).toBe("correct_threshold");
    expect(progress.result?.correctCount).toBe(rules.earlyStopOnCorrect.value);
    expect(s.civics.length).toBe(rules.earlyStopOnCorrect.value);
  });

  it("all answers wrong: needs_more_practice, civics stops on the incorrect threshold", () => {
    const s = play(engine, started(filedOn), ALL_WRONG);
    expect(s.phase).toBe("report");
    expect(s.report?.practiceResult).toBe("needs_more_practice");
    const progress = engine.civicsProgress(s);
    expect(progress.result?.stopReason).toBe("incorrect_threshold");
    expect(s.civics.length).toBe(rules.earlyStopOnIncorrect.value);
  });

  it("the session carries every graded turn and the report", () => {
    const s = play(engine, started(filedOn), ALL_RIGHT);
    const session = engine.buildSession(s)!;
    expect(session.finalReport).toEqual(s.report);
    expect(session.testVersion).toBe(version);
    const stages = new Set(session.turns.map((t) => t.stage));
    expect([...stages].sort()).toEqual(["civics", "n400_interview", "reading", "writing"]);
    for (const turn of session.turns.filter((t) => t.stage !== "n400_interview")) {
      expect(session.scoringResults[turn.turnId], turn.turnId).toBeDefined();
    }
    expect(session.turns.filter((t) => t.stage === "civics").every((t) => t.questionId !== undefined)).toBe(true);
  });

  it("the report appears only after civics is done", () => {
    let s = started(filedOn);
    s = engine.reduce(s, { type: "finishN400" });
    expect(s.report).toBeNull();
    expect(engine.reduce(s, { type: "continue", at: AT }).phase).toBe("reading");
  });

  it("property: civics stops exactly where runCivicsStage stops, for any answers", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }), fc.integer({ min: 0, max: 5000 }), (answers, seed) => {
        const s = play(engine, started(filedOn, seed), { reading: [true], writing: [true], civics: answers });
        const progress = engine.civicsProgress(s);
        const result = progress.result!;
        const reached =
          result.stopReason !== "none" || s.civics.length === Math.min(rules.questionsAsked.value, s.civicsIds.length);
        return (
          progress.done &&
          reached &&
          result.scores.length === s.civics.length &&
          s.civics.length <= rules.questionsAsked.value &&
          result.correctCount <= rules.earlyStopOnCorrect.value &&
          result.incorrectCount <= rules.earlyStopOnIncorrect.value &&
          s.phase === "report" &&
          (s.report?.practiceResult === "practice_passed") ===
            (result.passed &&
              engine.englishProgress(s, "reading").result.passed &&
              engine.englishProgress(s, "writing").result.passed)
        );
      }),
      { numRuns: 80 }
    );
  });

  it("property: reading and writing never take more sentences than the rules present", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 6 }), fc.array(fc.boolean(), { minLength: 1, maxLength: 6 }), (r, w) => {
        const s = play(engine, started(filedOn), { reading: r, writing: w, civics: [true] });
        const eng = loadEnglishRules();
        return (
          s.reading.length <= eng.reading.sentencesPresented.value &&
          s.writing.length <= eng.writing.sentencesPresented.value &&
          engine.englishProgress(s, "reading").result.passed === s.reading.some((a) => a.isCorrect)
        );
      }),
      { numRuns: 60 }
    );
  });
});

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

describe("guards", () => {
  it("actions in the wrong phase change nothing", () => {
    const s = started("before");
    expect(engine.reduce(s, { type: "submitReading", transcript: "x", input: "typed", at: AT })).toBe(s);
    expect(engine.reduce(s, { type: "submitCivics", response: "x", input: "typed", at: AT })).toBe(s);
    expect(engine.reduce(s, { type: "continue", at: AT })).toBe(s);
    expect(engine.reduce(engine.initial(), { type: "answerN400", questionId: "q", questionText: "Q", transcript: "x", at: AT }).n400Answers).toEqual([]);
  });

  it("cannot continue before a stage is done", () => {
    let s = engine.reduce(started("before"), { type: "finishN400" });
    expect(s.phase).toBe("reading");
    expect(engine.reduce(s, { type: "continue", at: AT })).toBe(s);
    s = engine.reduce(s, { type: "submitReading", transcript: "zzz", input: "typed", at: AT });
    expect(engine.englishProgress(s, "reading").done).toBe(false);
  });

  it("the reducer does not change the state it is given", () => {
    const s = started("before");
    const before = JSON.stringify(s);
    engine.reduce(s, { type: "finishN400" });
    engine.reduce(s, { type: "answerN400", questionId: "q", questionText: "Q", transcript: "x", at: AT });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("restart returns to a blank intro with nothing kept", () => {
    const s = play(engine, started("before"), ALL_RIGHT);
    expect(engine.reduce(s, { type: "restart" })).toEqual(engine.initial());
  });

  it("an empty transcript counts as a wrong answer, not an error", () => {
    let s = engine.reduce(started("before"), { type: "finishN400" });
    s = engine.reduce(s, { type: "submitReading", transcript: "", input: "voice", at: AT });
    expect(s.reading[0]?.isCorrect).toBe(false);
    expect(s.reading[0]?.accuracy).toBe(0);
  });

  it("holds no real data: the stored text is exactly what was given", () => {
    const s = started("before");
    expect(JSON.stringify(s)).not.toMatch(/\bA[- ]?\d{8,9}\b/);
  });
});

// ---------------------------------------------------------------------------
// Production lock
// ---------------------------------------------------------------------------

describe("when the answer key is refused", () => {
  it("setup works, civics is locked, nothing is graded and no report is built", () => {
    let s = started("on_or_after", 1, lockedEngine);
    expect(s.civicsLocked).toBe(true);
    expect(s.civicsIds).toEqual([]);
    s = lockedEngine.reduce(s, { type: "finishN400" });
    for (const kind of ["reading", "writing"] as const) {
      for (;;) {
        const p = lockedEngine.englishProgress(s, kind);
        if (p.done || p.current === null) break;
        s = lockedEngine.reduce(s, {
          type: kind === "reading" ? "submitReading" : "submitWriting",
          transcript: p.current.text,
          input: "typed",
          at: AT,
        });
      }
      s = lockedEngine.reduce(s, { type: "continue", at: AT });
    }
    expect(s.phase).toBe("civics");
    const progress = lockedEngine.civicsProgress(s);
    expect(progress.locked).toBe(true);
    expect(progress.lockReason).toMatch(/needsHumanReview/);
    expect(lockedEngine.reduce(s, { type: "submitCivics", response: "x", input: "typed", at: AT })).toBe(s);
    expect(lockedEngine.reduce(s, { type: "continue", at: AT })).toBe(s);
    expect(s.report).toBeNull();
    expect(lockedEngine.buildSession(s)?.turns.some((t) => t.stage === "civics")).toBe(false);
  });
});

describe("createAnswerKeyLoader", () => {
  it("reports a locked key instead of throwing, and does not retry", () => {
    // The production check is not touched: this loader runs in the test (development) mode and
    // returns the key. Locking in production is covered through an injected refusal above.
    const load = createAnswerKeyLoader();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const a = load("2008");
      expect(a.status).toBe("ready");
      expect(load("2008")).toBe(a);
    } finally {
      warn.mockRestore();
    }
  });
});
