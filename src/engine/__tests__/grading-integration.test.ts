/**
 * T-09: whole-session grading, end to end.
 *
 *   filing date -> version selector -> rules + real answer key -> civics grader
 *                                                              -> English graders
 *                                                              -> report builder
 *
 * Covers both fixtures in mock/, and synthetic sessions built from the real answer keys for
 * the 2008 and the 2025 rules. The answer key files still have needsHumanReview: true, so the
 * loader runs in development mode here. Only fictional profiles and synthetic responses are
 * used. Every count is read from data/test-rules.json through the rules loader.
 */
import { describe, it, expect, vi } from "vitest";
import type { InterviewSession, Turn } from "../../contracts/session.js";
import { loadAnswerKey, type CivicsAnswerEntry } from "../civics-answer-key.js";
import { runCivicsStage } from "../civics-grader.js";
import { runEnglishStage, type EnglishStageKind } from "../english-grader.js";
import { buildFinalReport, listUnscoredQuestions } from "../report-builder.js";
import { loadCivicsBoundaryDate, loadCivicsRules, loadEnglishRules } from "../test-rules-loader.js";
import { assertVersionConsistency, selectTestVersion } from "../version-selector.js";
import passingRaw from "../../../mock/session.json" with { type: "json" };
import failingRaw from "../../../mock/session-needs-practice.json" with { type: "json" };

type Version = "2008" | "2025";

// ---------------------------------------------------------------------------
// The pipeline under test
// ---------------------------------------------------------------------------

function loadKey(version: Version): Map<string, CivicsAnswerEntry> {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return loadAnswerKey(version, { production: false });
  } finally {
    warn.mockRestore();
  }
}

const KEYS: Record<Version, Map<string, CivicsAnswerEntry>> = {
  "2008": loadKey("2008"),
  "2025": loadKey("2025"),
};

/** Grade a whole session. `isCorrect` supplies the reading and writing judgement. */
function gradeSession(session: InterviewSession, isCorrect: (turn: Turn) => boolean) {
  // 1. Version: from the filing date, and it must match what the session declares.
  const version = selectTestVersion(session.filingDate);
  assertVersionConsistency(session.filingDate, session.testVersion);

  // 2. Rules and answer key for that version.
  const civicsRules = loadCivicsRules(version);
  const englishRules = loadEnglishRules();
  const answerKey = KEYS[version];

  // 3. The three graded stages.
  const civicsResult = runCivicsStage({
    turns: session.turns.filter((t) => t.stage === "civics"),
    answerKey,
    rules: civicsRules,
  });
  const items = (kind: EnglishStageKind) =>
    session.turns.filter((t) => t.stage === kind).map((turn) => ({ turn, isCorrect: isCorrect(turn) }));
  const readingResult = runEnglishStage({ kind: "reading", items: items("reading"), rules: englishRules.reading });
  const writingResult = runEnglishStage({ kind: "writing", items: items("writing"), rules: englishRules.writing });

  // 4. The report.
  const report = buildFinalReport({
    session,
    civicsResult,
    readingResult,
    writingResult,
    answerKey,
    rules: { civics: civicsRules, english: englishRules },
    now: new Date("2024-06-01T12:00:00Z"),
  });
  return { version, civicsResult, readingResult, writingResult, report, answerKey };
}

// ---------------------------------------------------------------------------
// Fictional-only checks
// ---------------------------------------------------------------------------

/** Government ID numbers must never appear: an "A" followed by 8 or 9 digits. */
const A_NUMBER = /\bA[- ]?\d{8,9}\b/;

function expectFictional(session: InterviewSession) {
  expect(session.isFictional).toBe(true);
  expect(session.fictionalProfileId).toMatch(/^fictional-profile-/);
  expect(A_NUMBER.test(JSON.stringify(session))).toBe(false);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

describe.each([
  { name: "mock/session.json", raw: passingRaw, expected: "practice_passed" },
  { name: "mock/session-needs-practice.json", raw: failingRaw, expected: "needs_more_practice" },
])("fixture $name", ({ raw, expected }) => {
  const session = raw as unknown as InterviewSession;
  /** The fixture records each reading and writing judgement in scoringResults. */
  const judged = (turn: Turn) => {
    const scoring = session.scoringResults[turn.turnId];
    return scoring !== undefined && "result" in scoring && scoring.result === "correct";
  };
  const graded = gradeSession(session, judged);

  it("is a fictional session", () => {
    expectFictional(session);
  });

  it("goes through the whole pipeline to the result the fixture records", () => {
    expect(graded.report.practiceResult).toBe(expected);
    expect(graded.report.practiceResult).toBe(session.finalReport?.practiceResult);
  });

  it("uses the version the filing date requires, and rules from the rules file", () => {
    expect(graded.version).toBe(session.testVersion);
    const rules = loadCivicsRules(graded.version);
    expect(graded.civicsResult.scores.length).toBeLessThanOrEqual(rules.questionsAsked.value);
    if (expected === "practice_passed") {
      expect(graded.civicsResult.stopReason).toBe("correct_threshold");
      expect(graded.civicsResult.correctCount).toBe(rules.earlyStopOnCorrect.value);
    } else {
      expect(graded.civicsResult.stopReason).toBe("incorrect_threshold");
      expect(graded.civicsResult.incorrectCount).toBe(rules.earlyStopOnIncorrect.value);
      expect(graded.civicsResult.passed).toBe(false);
    }
  });

  it("agrees with the civics scores recorded in the fixture", () => {
    for (const score of graded.civicsResult.scores) {
      const recorded = session.scoringResults[score.turnId];
      expect(recorded, score.turnId).toEqual(score.scoring);
    }
  });

  it("builds a report with the disclaimer and no pass or fail wording", () => {
    expect(graded.report.disclaimer).toMatch(/not legal advice/i);
    expect(JSON.stringify(graded.report).replace(/practice_passed/g, "")).not.toMatch(/\b(pass|fail)(ed)?\b/i);
  });
});

// ---------------------------------------------------------------------------
// Synthetic sessions on the real answer keys
// ---------------------------------------------------------------------------

const FILING_DATE: Record<Version, string> = { "2008": "2024-03-15", "2025": "2025-11-03" };
const TURN_TIME = "2024-06-01T10:00:00Z";

/** Static, one-answer entries; the first stored answer is the response that scores correct. */
function staticEntries(version: Version, count: number): CivicsAnswerEntry[] {
  const found = [...KEYS[version].values()]
    .filter((e) => e.answerType === "static" && e.requiredAnswerCount === 1)
    .slice(0, count);
  if (found.length < count) throw new Error("not enough static entries in the answer key");
  return found;
}

function firstDynamicEntry(version: Version): CivicsAnswerEntry {
  const found = [...KEYS[version].values()].find((e) => e.answerType === "dynamic");
  if (!found) throw new Error("no dynamic entry in the answer key");
  return found;
}

type CivicsKind = "correct" | "incorrect" | "dynamic";

function sessionFor(
  version: Version,
  civics: readonly CivicsKind[],
  reading: readonly boolean[],
  writing: readonly boolean[]
): { session: InterviewSession; judged: ReadonlySet<string> } {
  const entries = staticEntries(version, civics.length);
  const dynamic = firstDynamicEntry(version);
  const judged = new Set<string>();
  const turns: Turn[] = [];
  let n = 0;
  turns.push({ turnId: `t${++n}`, stage: "intro", prompt: "Welcome.", responseText: "Hello.", completedAt: TURN_TIME });
  for (const [kind, flags] of [["reading", reading], ["writing", writing]] as const) {
    flags.forEach((ok, i) => {
      const turnId = `t${++n}`;
      if (ok) judged.add(turnId);
      turns.push({
        turnId,
        stage: kind,
        prompt: `Sentence ${i + 1}.`,
        responseText: "A practice sentence.",
        completedAt: TURN_TIME,
      });
    });
  }
  civics.forEach((kind, i) => {
    const entry = kind === "dynamic" ? dynamic : entries[i]!;
    turns.push({
      turnId: `t${++n}`,
      stage: "civics",
      prompt: entry.questionText,
      responseText: kind === "incorrect" ? "zzz qqq" : (entry.acceptedAnswers[0] ?? "a response"),
      questionId: entry.id,
      completedAt: TURN_TIME,
    });
  });
  return {
    judged,
    session: {
      sessionId: `session-${version}`,
      fictionalProfileId: "fictional-profile-integration-test",
      isFictional: true,
      filingDate: FILING_DATE[version],
      testVersion: version,
      startedAt: TURN_TIME,
      currentStage: "report",
      turns,
      scoringResults: {},
    },
  };
}

function run(
  version: Version,
  civics: readonly CivicsKind[],
  reading: readonly boolean[],
  writing: readonly boolean[]
) {
  const { session, judged } = sessionFor(version, civics, reading, writing);
  expectFictional(session);
  return gradeSession(session, (turn) => judged.has(turn.turnId));
}

const repeat = <T>(value: T, times: number): T[] => Array.from({ length: times }, () => value);

describe.each(["2008", "2025"] as const)("synthetic session with %s rules", (version) => {
  const rules = loadCivicsRules(version);
  const english = loadEnglishRules();
  const stopCorrect = rules.earlyStopOnCorrect.value;
  const stopIncorrect = rules.earlyStopOnIncorrect.value;
  const readingPass = english.reading.sentencesToPassCount.value;
  const writingPass = english.writing.sentencesToPassCount.value;
  const readingShown = english.reading.sentencesPresented.value;
  const writingShown = english.writing.sentencesPresented.value;

  const allRight = (shown: number) => repeat(true, shown);
  const allWrong = (shown: number) => repeat(false, shown);

  it("the filing date selects the version, which matches the declared one", () => {
    expect(selectTestVersion(FILING_DATE[version])).toBe(version);
    expect(() => assertVersionConsistency(FILING_DATE[version], version)).not.toThrow();
  });

  it("passing session: stops on the correct threshold, practice_passed", () => {
    const r = run(version, repeat("correct", stopCorrect), allRight(readingShown), allRight(writingShown));
    expect(r.civicsResult.correctCount).toBe(stopCorrect);
    expect(r.civicsResult.stopReason).toBe("correct_threshold");
    expect(r.civicsResult.passed).toBe(true);
    expect(r.readingResult.passed).toBe(true);
    expect(r.writingResult.passed).toBe(true);
    expect(r.report.practiceResult).toBe("practice_passed");
    expect(r.report.stageSummaries.map((s) => s.stage)).toEqual(["reading", "writing", "civics"]);
  });

  it("civics not passed: stops on the incorrect threshold, needs_more_practice", () => {
    const r = run(version, repeat("incorrect", stopIncorrect), [true], [true]);
    expect(r.civicsResult.stopReason).toBe("incorrect_threshold");
    expect(r.civicsResult.incorrectCount).toBe(stopIncorrect);
    expect(r.civicsResult.passed).toBe(false);
    expect(r.readingResult.passed).toBe(true);
    expect(r.report.practiceResult).toBe("needs_more_practice");
    // The incorrect questions are the review items, in order.
    const civicsSummary = r.report.stageSummaries.find((s) => s.stage === "civics")!;
    expect(civicsSummary.reviewItems).toHaveLength(stopIncorrect);
  });

  it("civics one answer short of the threshold: not passed", () => {
    const r = run(version, repeat("correct", stopCorrect - 1), [true], [true]);
    expect(r.civicsResult.correctCount).toBe(stopCorrect - 1);
    expect(r.civicsResult.stopReason).toBe("none");
    expect(r.report.practiceResult).toBe("needs_more_practice");
  });

  it("reading not passed while civics and writing pass: needs_more_practice", () => {
    const r = run(version, repeat("correct", stopCorrect), allWrong(readingShown), [true]);
    expect(r.civicsResult.passed).toBe(true);
    expect(r.writingResult.passed).toBe(true);
    expect(r.readingResult.passed).toBe(false);
    expect(r.readingResult.attempts).toBe(readingShown);
    expect(r.report.practiceResult).toBe("needs_more_practice");
    expect(r.report.stageSummaries.find((s) => s.stage === "reading")!.reviewItems).toHaveLength(1);
  });

  it("writing not passed while civics and reading pass: needs_more_practice", () => {
    const r = run(version, repeat("correct", stopCorrect), [true], allWrong(writingShown));
    expect(r.civicsResult.passed).toBe(true);
    expect(r.readingResult.passed).toBe(true);
    expect(r.writingResult.passed).toBe(false);
    expect(r.report.practiceResult).toBe("needs_more_practice");
  });

  it("English stages stop as soon as the pass count is reached", () => {
    const r = run(version, repeat("correct", stopCorrect), repeat(true, readingShown), repeat(true, writingShown));
    expect(r.readingResult.correctCount).toBe(readingPass);
    expect(r.readingResult.attempts).toBe(readingPass);
    expect(r.writingResult.correctCount).toBe(writingPass);
    expect(r.writingResult.attempts).toBe(writingPass);
  });

  it("a dynamic question is unscored, listed separately and never counted wrong", () => {
    // The dynamic question comes first, then enough correct answers to pass.
    const dynamicTurns: CivicsKind[] = ["dynamic"];
    const r = run(version, [...dynamicTurns, ...repeat<CivicsKind>("correct", stopCorrect)], [true], [true]);
    expect(r.civicsResult.unscoredCount).toBe(dynamicTurns.length);
    expect(r.civicsResult.incorrectCount).toBe(r.civicsResult.scores.length - r.civicsResult.correctCount - r.civicsResult.unscoredCount);
    expect(r.civicsResult.incorrectCount).toBe(0);
    expect(r.civicsResult.passed).toBe(true);
    expect(r.report.practiceResult).toBe("practice_passed");

    const dynamic = firstDynamicEntry(version);
    const civicsSummary = r.report.stageSummaries.find((s) => s.stage === "civics")!;
    expect(civicsSummary.turnsTotal).toBe(r.civicsResult.scores.length);
    expect(civicsSummary.turnsScored).toBe(r.civicsResult.correctCount + r.civicsResult.incorrectCount);
    expect(civicsSummary.turnsTotal - civicsSummary.turnsScored).toBe(r.civicsResult.unscoredCount);
    expect(civicsSummary.summary).toContain(dynamic.questionText);
    expect(civicsSummary.reviewItems).not.toContain(dynamic.questionText);
    expect(r.report.overallReviewItems).not.toContain(dynamic.questionText);

    const listed = listUnscoredQuestions(r.civicsResult, r.answerKey);
    expect(listed).toHaveLength(r.civicsResult.unscoredCount);
    expect(listed[0]).toMatchObject({ questionId: dynamic.id, reason: "answer_changes" });
  });

  it("dynamic questions only never pass and never count as wrong", () => {
    const r = run(version, repeat<CivicsKind>("dynamic", stopIncorrect + stopCorrect), [true], [true]);
    expect(r.civicsResult.incorrectCount).toBe(0);
    expect(r.civicsResult.correctCount).toBe(0);
    expect(r.civicsResult.stopReason).toBe("none");
    expect(r.report.practiceResult).toBe("needs_more_practice");
    expect(r.report.stageSummaries.find((s) => s.stage === "civics")!.reviewItems).toEqual([]);
  });

  it("turns beyond the number of questions asked are not graded", () => {
    const extra = rules.questionsAsked.value + 1;
    const r = run(version, repeat("dynamic", extra), [true], [true]);
    expect(r.civicsResult.scores).toHaveLength(rules.questionsAsked.value);
  });

  it("the report is the same when the same session is graded twice", () => {
    const a = run(version, repeat("correct", stopCorrect), [true], [true]);
    const b = run(version, repeat("correct", stopCorrect), [true], [true]);
    expect(a.report).toEqual(b.report);
  });
});

// ---------------------------------------------------------------------------
// Version selection and rejected input
// ---------------------------------------------------------------------------

describe("filing date boundary", () => {
  it("the boundary in the rules is 2025-10-20", () => {
    expect(loadCivicsBoundaryDate()).toBe("2025-10-20");
  });

  it("2025-10-19 grades with the 2008 rules, 2025-10-20 with the 2025 rules", () => {
    expect(selectTestVersion("2025-10-19")).toBe("2008");
    expect(selectTestVersion("2025-10-20")).toBe("2025");
  });

  it.each([
    { filingDate: "2025-10-19", version: "2008" as const },
    { filingDate: "2025-10-20", version: "2025" as const },
  ])("a session filed $filingDate runs end to end with the $version rules", ({ filingDate, version }) => {
    const { session, judged } = sessionFor(version, repeat("correct", loadCivicsRules(version).earlyStopOnCorrect.value), [true], [true]);
    const filed: InterviewSession = { ...session, filingDate };
    const r = gradeSession(filed, (turn) => judged.has(turn.turnId));
    expect(r.version).toBe(version);
    expect(r.report.practiceResult).toBe("practice_passed");
  });
});

describe("rejected sessions", () => {
  it("a declared version that does not match the filing date throws", () => {
    const { session, judged } = sessionFor("2008", repeat("correct", loadCivicsRules("2008").earlyStopOnCorrect.value), [true], [true]);
    const wrong: InterviewSession = { ...session, filingDate: "2025-10-20", testVersion: "2008" };
    expect(() => gradeSession(wrong, (turn) => judged.has(turn.turnId))).toThrow(/mismatch/i);
    const wrongOther: InterviewSession = { ...session, filingDate: "2025-10-19", testVersion: "2025" };
    expect(() => gradeSession(wrongOther, (turn) => judged.has(turn.turnId))).toThrow(/mismatch/i);
  });

  it("a malformed filing date throws", () => {
    const { session } = sessionFor("2008", ["correct"], [true], [true]);
    expect(() => gradeSession({ ...session, filingDate: "2025-13-45" }, () => true)).toThrow();
  });

  it("a civics turn without questionId throws", () => {
    for (const version of ["2008", "2025"] as const) {
      const { session } = sessionFor(version, ["correct", "correct"], [true], [true]);
      const turns = session.turns.map((t) => {
        if (t.stage !== "civics") return t;
        const { questionId: _omitted, ...rest } = t;
        return rest;
      });
      expect(() => gradeSession({ ...session, turns }, () => true)).toThrow(/questionId/);
    }
  });

  it("a reading result for the wrong stage is refused by the report builder", () => {
    const { session } = sessionFor("2008", ["correct"], [true], [true]);
    const rules = { civics: loadCivicsRules("2008"), english: loadEnglishRules() };
    const civicsResult = runCivicsStage({ turns: [], answerKey: KEYS["2008"], rules: rules.civics });
    const writing = runEnglishStage({ kind: "writing", items: [], rules: rules.english.writing });
    expect(() =>
      buildFinalReport({ session, civicsResult, readingResult: writing, writingResult: writing, answerKey: KEYS["2008"], rules })
    ).toThrow(/reading/);
  });
});

// ---------------------------------------------------------------------------
// Safety checks on whole reports
// ---------------------------------------------------------------------------

describe("report safety", () => {
  it("every report is practice-only: disclaimer present, two possible results, no government ID", () => {
    for (const version of ["2008", "2025"] as const) {
      const rules = loadCivicsRules(version);
      for (const civics of [repeat<CivicsKind>("correct", rules.earlyStopOnCorrect.value), repeat<CivicsKind>("incorrect", rules.earlyStopOnIncorrect.value)]) {
        const r = run(version, civics, [true], [true]);
        expect(["practice_passed", "needs_more_practice"]).toContain(r.report.practiceResult);
        expect(r.report.disclaimer).toMatch(/practice tool only/i);
        expect(A_NUMBER.test(JSON.stringify(r.report))).toBe(false);
      }
    }
  });
});
