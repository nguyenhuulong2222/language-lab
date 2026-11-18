/**
 * Tests for src/engine/report-builder.ts (T-08).
 *
 * Stage results come from the real graders. Thresholds are read from the loaded rules
 * (data/test-rules.json); injected rules show the builder reads them.
 * Only fictional, synthetic data is used.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { InterviewSession, Turn } from "../../contracts/session.js";
import type { CivicsAnswerEntry } from "../civics-answer-key.js";
import { runCivicsStage, type CivicsStageResult } from "../civics-grader.js";
import { runEnglishStage, type EnglishStageKind, type EnglishStageResult } from "../english-grader.js";
import {
  buildFinalReport,
  listUnscoredQuestions,
  PRACTICE_DISCLAIMER,
  type ReportRules,
} from "../report-builder.js";
import { loadCivicsRules, loadEnglishRules, type CivicsTestRules } from "../test-rules-loader.js";

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const STATIC_ID = "2008-001";
const DYNAMIC_ID = "2008-002";
const UNKNOWN_ID = "2008-999";
const STATIC_TEXT = "What is the supreme law of the land?";
const DYNAMIC_TEXT = "What is the name of the Speaker of the House of Representatives now?";

const KEY = new Map<string, CivicsAnswerEntry>([
  [
    STATIC_ID,
    {
      id: STATIC_ID,
      testVersion: "2008",
      questionText: STATIC_TEXT,
      acceptedAnswers: ["alpha"],
      requiredAnswerCount: 1,
      answerType: "static",
      sourceUrl: "https://www.uscis.gov/test",
      sourceDocument: "test fixture",
    },
  ],
  [
    DYNAMIC_ID,
    {
      id: DYNAMIC_ID,
      testVersion: "2008",
      questionText: DYNAMIC_TEXT,
      acceptedAnswers: [],
      requiredAnswerCount: 1,
      answerType: "dynamic",
      sourceUrl: "https://www.uscis.gov/test",
      sourceDocument: "test fixture",
    },
  ],
]);

type Outcome = "correct" | "incorrect" | "unscored" | "unknown";

function civicsTurns(outcomes: readonly Outcome[]): Turn[] {
  return outcomes.map((outcome, index) => {
    const id =
      outcome === "unscored" ? DYNAMIC_ID : outcome === "unknown" ? UNKNOWN_ID : STATIC_ID;
    return {
      turnId: `c${index + 1}`,
      stage: "civics",
      prompt: "A question?",
      responseText: outcome === "incorrect" ? "beta" : "alpha",
      questionId: id,
      completedAt: "2024-01-01T00:00:00Z",
    };
  });
}

function civics(outcomes: readonly Outcome[], version: "2008" | "2025"): CivicsStageResult {
  return runCivicsStage({
    turns: civicsTurns(outcomes),
    answerKey: KEY,
    rules: loadCivicsRules(version),
  });
}

function english(kind: EnglishStageKind, flags: readonly boolean[]): EnglishStageResult {
  return runEnglishStage({
    kind,
    rules: loadEnglishRules()[kind],
    items: flags.map((isCorrect, index) => ({
      isCorrect,
      turn: {
        turnId: `${kind}${index + 1}`,
        stage: kind,
        prompt: "A sentence.",
        responseText: "A sentence.",
        completedAt: "2024-01-01T00:00:00Z",
      },
    })),
  });
}

function session(version: "2008" | "2025"): InterviewSession {
  return {
    sessionId: "session-test",
    fictionalProfileId: "fictional-profile-test",
    isFictional: true,
    filingDate: version === "2008" ? "2024-03-15" : "2025-11-01",
    testVersion: version,
    startedAt: "2024-03-20T10:00:00Z",
    currentStage: "report",
    turns: [],
    scoringResults: {},
  };
}

const NOW = new Date("2024-03-20T10:42:00Z");

function repeat<const T>(value: T, times: number): T[] {
  return Array.from({ length: times }, () => value);
}

function build(
  version: "2008" | "2025",
  outcomes: readonly Outcome[],
  reading: readonly boolean[],
  writing: readonly boolean[],
  rules?: ReportRules
) {
  return buildFinalReport({
    session: session(version),
    civicsResult: civics(outcomes, version),
    readingResult: english("reading", reading),
    writingResult: english("writing", writing),
    answerKey: KEY,
    now: NOW,
    ...(rules ? { rules } : {}),
  });
}

/** Outcomes that pass civics under the given rules. */
const passingCivics = (version: "2008" | "2025"): Outcome[] =>
  repeat("correct" as const, loadCivicsRules(version).earlyStopOnCorrect.value);
/** Outcomes that stop civics on the incorrect threshold. */
const failingCivics = (version: "2008" | "2025"): Outcome[] =>
  repeat("incorrect" as const, loadCivicsRules(version).earlyStopOnIncorrect.value);

function patched(rules: CivicsTestRules, patch: Partial<Record<keyof CivicsTestRules, number>>) {
  const copy = structuredClone(rules);
  for (const [key, value] of Object.entries(patch) as Array<[keyof CivicsTestRules, number]>) {
    copy[key] = { ...copy[key], value };
  }
  return copy;
}

// ---------------------------------------------------------------------------
// practiceResult
// ---------------------------------------------------------------------------

describe.each(["2008", "2025"] as const)("practiceResult with %s rules", (version) => {
  it("is practice_passed when civics, reading and writing all pass", () => {
    const report = build(version, passingCivics(version), [true], [false, true]);
    expect(report.practiceResult).toBe("practice_passed");
  });

  it("is needs_more_practice when only civics fails", () => {
    expect(build(version, failingCivics(version), [true], [true]).practiceResult).toBe("needs_more_practice");
  });

  it("is needs_more_practice when only reading fails", () => {
    expect(build(version, passingCivics(version), [false, false, false], [true]).practiceResult).toBe(
      "needs_more_practice"
    );
  });

  it("is needs_more_practice when only writing fails", () => {
    expect(build(version, passingCivics(version), [true], [false, false, false]).practiceResult).toBe(
      "needs_more_practice"
    );
  });

  it("is needs_more_practice when every stage fails, or when nothing was answered", () => {
    expect(build(version, failingCivics(version), [false], [false]).practiceResult).toBe("needs_more_practice");
    expect(build(version, [], [], []).practiceResult).toBe("needs_more_practice");
  });

  it("is needs_more_practice when the civics turns run out before the threshold", () => {
    const short = passingCivics(version).slice(1);
    expect(build(version, short, [true], [true]).practiceResult).toBe("needs_more_practice");
  });
});

describe("thresholds come from the rules", () => {
  it("a civics stage marked passed is not enough when the rules' passing score is higher", () => {
    const base = loadCivicsRules("2008");
    const result = civics(passingCivics("2008"), "2008");
    expect(result.passed).toBe(true);
    const strict = patched(base, { passingScore: result.correctCount + 1 });
    const report = buildFinalReport({
      session: session("2008"),
      civicsResult: result,
      readingResult: english("reading", [true]),
      writingResult: english("writing", [true]),
      answerKey: KEY,
      now: NOW,
      rules: { civics: strict, english: loadEnglishRules() },
    });
    expect(report.practiceResult).toBe("needs_more_practice");
  });

  it("a hand-made civics result with passed true but too few correct answers is not practice_passed", () => {
    const rules = loadCivicsRules("2008");
    const forged: CivicsStageResult = {
      ...civics(passingCivics("2008"), "2008"),
      correctCount: rules.passingScore.value - 1,
      passed: true,
    };
    const report = buildFinalReport({
      session: session("2008"),
      civicsResult: forged,
      readingResult: english("reading", [true]),
      writingResult: english("writing", [true]),
      answerKey: KEY,
      now: NOW,
    });
    expect(report.practiceResult).toBe("needs_more_practice");
  });

  it("the numbers in the summary come from the rules", () => {
    const base = loadCivicsRules("2008");
    const rules: ReportRules = {
      civics: patched(base, { passingScore: 77, earlyStopOnIncorrect: 5 }),
      english: loadEnglishRules(),
    };
    const report = build("2008", failingCivics("2008"), [true], [true], rules);
    const civicsSummary = report.stageSummaries.find((s) => s.stage === "civics")!;
    expect(civicsSummary.summary).toContain("passing score of 77");
    expect(civicsSummary.summary).toContain("after 5 incorrect answers");
  });

  it("the English pass count in the summary comes from the rules", () => {
    const english3 = loadEnglishRules();
    const rules: ReportRules = {
      civics: loadCivicsRules("2008"),
      english: {
        ...english3,
        reading: {
          ...english3.reading,
          sentencesToPassCount: { ...english3.reading.sentencesToPassCount, value: 2 },
        },
      },
    };
    const report = build("2008", passingCivics("2008"), [false, false, false], [true], rules);
    const reading = report.stageSummaries.find((s) => s.stage === "reading")!;
    expect(reading.summary).toContain("2 correct sentences are needed");
  });
});

// ---------------------------------------------------------------------------
// Contents
// ---------------------------------------------------------------------------

describe("report contents", () => {
  const report = build("2008", [...passingCivics("2008").slice(1), "incorrect"], [false, true], [true]);

  it("carries the disclaimer", () => {
    expect(report.disclaimer).toBe(PRACTICE_DISCLAIMER);
    expect(PRACTICE_DISCLAIMER).toMatch(/practice tool only/i);
    expect(PRACTICE_DISCLAIMER).toMatch(/not affiliated with USCIS/i);
    expect(PRACTICE_DISCLAIMER).toMatch(/not legal advice/i);
  });

  it("has one summary per graded stage", () => {
    expect(report.stageSummaries.map((s) => s.stage)).toEqual(["reading", "writing", "civics"]);
  });

  it("counts turns from the graded results", () => {
    const reading = report.stageSummaries[0]!;
    expect(reading.turnsTotal).toBe(2);
    expect(reading.turnsScored).toBe(2);
    expect(reading.summary).toBe("Sentence 2 was read correctly.");
    expect(report.stageSummaries[1]!.summary).toBe("Sentence 1 was written correctly.");
  });

  it("lists the question of an incorrect civics answer as a review item", () => {
    const civicsSummary = report.stageSummaries[2]!;
    expect(civicsSummary.reviewItems).toEqual([STATIC_TEXT]);
    expect(report.overallReviewItems).toContain(STATIC_TEXT);
  });

  it("uses an ISO 8601 timestamp from the injected clock", () => {
    expect(report.generatedAt).toBe("2024-03-20T10:42:00.000Z");
    expect(Number.isNaN(Date.parse(report.generatedAt))).toBe(false);
  });

  it("uses the current time when no clock is given", () => {
    const before = Date.now();
    const r = buildFinalReport({
      session: session("2008"),
      civicsResult: civics([], "2008"),
      readingResult: english("reading", []),
      writingResult: english("writing", []),
      answerKey: KEY,
    });
    expect(Date.parse(r.generatedAt)).toBeGreaterThanOrEqual(before);
  });

  it("gives review items for English stages that did not pass, and none for stages that did", () => {
    const r = build("2008", passingCivics("2008"), [false, false, false], [true]);
    expect(r.stageSummaries[0]!.reviewItems).toHaveLength(1);
    expect(r.stageSummaries[1]!.reviewItems).toEqual([]);
    expect(r.stageSummaries[0]!.summary).toBe("0 of 3 reading sentences were read correctly. 1 correct sentence is needed.");
  });

  it("is deterministic", () => {
    const again = build("2008", [...passingCivics("2008").slice(1), "incorrect"], [false, true], [true]);
    expect(again).toEqual(report);
  });

  it("throws when a result is given for the wrong stage", () => {
    expect(() =>
      buildFinalReport({
        session: session("2008"),
        civicsResult: civics([], "2008"),
        readingResult: english("writing", []),
        writingResult: english("writing", []),
        answerKey: KEY,
      })
    ).toThrow(/reading/);
    expect(() =>
      buildFinalReport({
        session: session("2008"),
        civicsResult: civics([], "2008"),
        readingResult: english("reading", []),
        writingResult: english("reading", []),
        answerKey: KEY,
      })
    ).toThrow(/writing/);
  });
});

// ---------------------------------------------------------------------------
// Unscored questions
// ---------------------------------------------------------------------------

describe("unscored questions", () => {
  const outcomes: Outcome[] = ["correct", "unscored", "incorrect", "unknown", "correct"];
  const result = civics(outcomes, "2008");
  const report = build("2008", outcomes, [true], [true]);
  const civicsSummary = report.stageSummaries[2]!;

  it("count in turnsTotal but not in turnsScored", () => {
    expect(civicsSummary.turnsTotal).toBe(5);
    expect(civicsSummary.turnsScored).toBe(3);
  });

  it("are not counted as wrong: the correct count line leaves them out", () => {
    expect(civicsSummary.summary).toContain("2 of 3 civics questions answered correctly.");
  });

  it("are named separately in the summary and never in the review items", () => {
    expect(civicsSummary.summary).toContain("2 questions were not scored");
    expect(civicsSummary.summary).toContain(DYNAMIC_TEXT);
    expect(civicsSummary.summary).toContain(UNKNOWN_ID);
    expect(civicsSummary.summary).toContain("do not count as correct or incorrect");
    expect(civicsSummary.reviewItems).toEqual([STATIC_TEXT]);
    expect(report.overallReviewItems).not.toContain(DYNAMIC_TEXT);
  });

  it("are listed by listUnscoredQuestions with the reason", () => {
    expect(listUnscoredQuestions(result, KEY)).toEqual([
      { turnId: "c2", questionId: DYNAMIC_ID, questionText: DYNAMIC_TEXT, reason: "answer_changes" },
      { turnId: "c4", questionId: UNKNOWN_ID, questionText: null, reason: "not_in_answer_key" },
    ]);
  });

  it("a stage with only unscored turns is not passed and says nothing was scored", () => {
    const r = build("2008", repeat("unscored" as const, 4), [true], [true]);
    expect(r.practiceResult).toBe("needs_more_practice");
    expect(r.stageSummaries[2]!.summary).toContain("No civics questions were scored.");
    expect(r.stageSummaries[2]!.reviewItems).toEqual([]);
  });

  it("do not stop the stage or add to the incorrect count", () => {
    const rules = loadCivicsRules("2008");
    const many = [
      ...repeat("unscored" as const, rules.earlyStopOnIncorrect.value + 2),
      ...passingCivics("2008"),
    ];
    const r = civics(many, "2008");
    expect(r.incorrectCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

const outcomeArb = fc.constantFrom<Outcome>("correct", "incorrect", "unscored", "unknown");
const outcomesArb = fc.array(outcomeArb, { maxLength: 40 });
const flagsArb = fc.array(fc.boolean(), { maxLength: 6 });
const versionArb = fc.constantFrom<"2008" | "2025">("2008", "2025");

describe("report properties", () => {
  it("property: P1 a civics stage below the passing score never gives practice_passed", () => {
    fc.assert(
      fc.property(versionArb, outcomesArb, flagsArb, flagsArb, (version, outcomes, reading, writing) => {
        const rules = loadCivicsRules(version);
        const result = civics(outcomes, version);
        const report = build(version, outcomes, reading, writing);
        if (result.correctCount < rules.passingScore.value) {
          return report.practiceResult === "needs_more_practice";
        }
        return true;
      }),
      { numRuns: 400 }
    );
  });

  it("property: P7 practiceResult is only practice_passed or needs_more_practice, never pass or fail", () => {
    fc.assert(
      fc.property(versionArb, outcomesArb, flagsArb, flagsArb, (version, outcomes, reading, writing) => {
        const report = build(version, outcomes, reading, writing);
        const text = JSON.stringify(report);
        return (
          (report.practiceResult === "practice_passed" || report.practiceResult === "needs_more_practice") &&
          !/\b(pass|fail|failed|passed)\b/i.test(text.replace(/practice_passed/g, ""))
        );
      }),
      { numRuns: 400 }
    );
  });

  it("property: practice_passed exactly when all three graded stages passed", () => {
    fc.assert(
      fc.property(versionArb, outcomesArb, flagsArb, flagsArb, (version, outcomes, reading, writing) => {
        const report = build(version, outcomes, reading, writing);
        const allPassed =
          civics(outcomes, version).passed &&
          english("reading", reading).passed &&
          english("writing", writing).passed;
        return (report.practiceResult === "practice_passed") === allPassed;
      }),
      { numRuns: 400 }
    );
  });

  it("property: unscored turns are never counted wrong or listed as review items", () => {
    fc.assert(
      fc.property(versionArb, outcomesArb, (version, outcomes) => {
        const result = civics(outcomes, version);
        const report = build(version, outcomes, [true], [true]);
        const summary = report.stageSummaries[2]!;
        const unscored = result.scores.filter((s) => s.scoring.result === "unscored");
        const incorrect = result.scores.filter((s) => s.scoring.result === "incorrect");
        return (
          summary.turnsTotal === result.scores.length &&
          summary.turnsScored === result.correctCount + result.incorrectCount &&
          summary.turnsTotal - summary.turnsScored === unscored.length &&
          summary.reviewItems.length === incorrect.length &&
          !summary.reviewItems.includes(DYNAMIC_TEXT) &&
          listUnscoredQuestions(result, KEY).length === unscored.length
        );
      }),
      { numRuns: 400 }
    );
  });

  it("property: the same input gives the same report", () => {
    fc.assert(
      fc.property(versionArb, outcomesArb, flagsArb, flagsArb, (version, outcomes, reading, writing) => {
        const a = build(version, outcomes, reading, writing);
        const b = build(version, outcomes, reading, writing);
        return JSON.stringify(a) === JSON.stringify(b);
      }),
      { numRuns: 200 }
    );
  });

  it("property: overall review items are the stage review items without repeats", () => {
    fc.assert(
      fc.property(versionArb, outcomesArb, flagsArb, flagsArb, (version, outcomes, reading, writing) => {
        const report = build(version, outcomes, reading, writing);
        const all = report.stageSummaries.flatMap((s) => s.reviewItems);
        return (
          report.overallReviewItems.length === new Set(all).size &&
          all.every((item) => report.overallReviewItems.includes(item))
        );
      }),
      { numRuns: 200 }
    );
  });
});
