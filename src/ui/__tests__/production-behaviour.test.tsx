/**
 * What a production build does with the answer keys: reviewed keys (needsHumanReview: false with a
 * named reviewer, the state since the owner's review of 2026-11-20) unlock civics, Study first and
 * the full interview; a key still marked for review keeps them switched off. The production flag
 * is passed to the loader (`production: true`); the check in the loader is the one exercised.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { PracticeApp } from "../PracticeApp";
import { answerKeyLockedInBuild, ANSWER_KEY_NEEDS_REVIEW, loadAnswerKey, parseAnswerKey } from "../../engine/civics-answer-key";
import raw2008 from "../../../data/civics-answers/2008.json";
import raw2025 from "../../../data/civics-answers/2025.json";
import { createAnswerKeyLoader, createDefaultPracticeEnv, createPracticeEngine, type PracticeEngine, type PracticeState } from "../../engine/practice-flow";
const RAW = { "2008": raw2008, "2025": raw2025 } as const;
/** Production with the real, reviewed keys. */
function productionEnv() {
  return {
    ...createDefaultPracticeEnv(),
    answerKey: createAnswerKeyLoader((version) => loadAnswerKey(version, { production: true })),
    civicsLocked: () => (["2008", "2025"] as const).some((v) => answerKeyLockedInBuild(v, { production: true })),
  };
}
/** Production with keys that are still marked for review (a copy of the real files with the flag set back). */
function unreviewedProductionEnv() {
  return {
    ...createDefaultPracticeEnv(),
    answerKey: createAnswerKeyLoader((version) =>
      parseAnswerKey({ ...RAW[version], needsHumanReview: true }, version, { production: true })
    ),
    civicsLocked: () => true,
  };
}
const AT = "2026-11-20T10:00:00.000Z";
/** A full interview with every answer right, from the choice to the end of civics. */
function fullInterview(engine: PracticeEngine, filedOn: "before" | "on_or_after"): PracticeState {
  let s = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed: 3, at: AT });
  s = engine.reduce(s, { type: "start", profileId: engine.env.content.profiles[0]!.id, filedOn, seed: 3, at: AT });
  s = engine.reduce(s, { type: "finishN400", at: AT });
  for (const kind of ["reading", "writing"] as const) {
    for (;;) {
      const p = engine.englishProgress(s, kind);
      if (p.done || p.current === null) break;
      s = engine.reduce(s, { type: kind === "reading" ? "submitReading" : "submitWriting", transcript: p.current.text, input: "typed", at: AT });
    }
    s = engine.reduce(s, { type: "continue", at: AT });
  }
  return s;
}
afterEach(() => {
  vi.restoreAllMocks();
});
describe("production build with the reviewed answer keys", () => {
  it("both keys load in production, with no warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const version of ["2008", "2025"] as const) expect(productionEnv().answerKey(version).status).toBe("ready");
    expect(warn).not.toHaveBeenCalled();
  });
  it("the home screen offers the full interview, Study first and civics, and no locked notice", () => {
    const html = renderToString(<PracticeApp engine={createPracticeEngine(productionEnv())} />);
    expect(html).toContain("Full practice interview");
    expect(html).toContain("All four parts in order, then one report.");
    expect(html).toContain("Study first");
    expect(html).toContain("Answer questions about U.S. history and government");
    expect(html).not.toContain("Right now you can practice");
  });
  for (const filedOn of ["before", "on_or_after"] as const) {
    it(`a full interview reaches the report (${filedOn === "before" ? "2008" : "2025"} test)`, () => {
      const engine = createPracticeEngine(productionEnv());
      let s = fullInterview(engine, filedOn);
      expect(s.phase).toBe("civics");
      expect(engine.civicsProgress(s).locked).toBe(false);
      expect(s.setup?.version).toBe(filedOn === "before" ? "2008" : "2025");
      const key = engine.env.answerKey(s.setup!.version!);
      if (key.status !== "ready") throw new Error("key not ready");
      for (;;) {
        const p = engine.civicsProgress(s);
        if (p.done || p.current === null) break;
        // The first official answer line, as the source writes it.
        const entry = key.key.get(p.current.id)!;
        s = engine.reduce(s, { type: "submitCivics", response: entry.acceptedAnswers.slice(0, entry.requiredAnswerCount).join(", "), input: "typed", at: AT });
      }
      s = engine.reduce(s, { type: "continue", at: AT });
      expect(s.phase).toBe("report");
      expect(s.report?.practiceResult).toBe("practice_passed");
    });
  }
});
describe("production build with a key still marked for review", () => {
  it("the loader refuses, so civics is locked", () => {
    const env = unreviewedProductionEnv();
    for (const version of ["2008", "2025"] as const) {
      const result = env.answerKey(version);
      expect(result.status).toBe("locked");
      if (result.status === "locked") expect(result.reason).toMatch(/needsHumanReview/);
    }
  });
  it("the home screen says what this build offers and does not headline the full interview", () => {
    const html = renderToString(<PracticeApp engine={createPracticeEngine(unreviewedProductionEnv())} />);
    expect(html).toContain("Right now you can practice");
    expect(html).not.toContain("All four parts in order, then one report.");
  });
  it("interview, reading and writing run; civics is locked; no report is built", () => {
    const engine = createPracticeEngine(unreviewedProductionEnv());
    const s = fullInterview(engine, "on_or_after");
    expect(s.phase).toBe("civics");
    expect(engine.civicsProgress(s).locked).toBe(true);
    expect(engine.reduce(s, { type: "continue", at: AT }).report).toBeNull();
  });
});
describe("the copy of the review flags used before the keys are fetched", () => {
  it("is equal to needsHumanReview in the answer key files", () => {
    expect(ANSWER_KEY_NEEDS_REVIEW["2008"]).toBe((raw2008 as { needsHumanReview: boolean }).needsHumanReview);
    expect(ANSWER_KEY_NEEDS_REVIEW["2025"]).toBe((raw2025 as { needsHumanReview: boolean }).needsHumanReview);
  });
  it("does not replace the loader's own production check", () => {
    expect(() => parseAnswerKey({ ...raw2008, needsHumanReview: true }, "2008", { production: true })).toThrow(/needsHumanReview/);
    expect(() => parseAnswerKey({ ...raw2025, reviewedBy: "" }, "2025", { production: true })).toThrow(/does not name a reviewer/);
  });
});
