/**
 * What a production build does while the answer key files still say needsHumanReview: true.
 * The production flag is simulated with vi.stubEnv; the check in the loader is not changed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { PracticeApp } from "../PracticeApp";
import { answerKeyLockedInBuild, ANSWER_KEY_NEEDS_REVIEW, loadAnswerKey } from "../../engine/civics-answer-key";
import raw2008 from "../../../data/civics-answers/2008.json";
import raw2025 from "../../../data/civics-answers/2025.json";
import { createAnswerKeyLoader, createDefaultPracticeEnv, createPracticeEngine } from "../../engine/practice-flow";

/**
 * A production environment: the answer keys are loaded with `production: true`, which is what
 * the loader does in a production build. The loader's own check is the one being exercised.
 */
function productionEnv() {
  return {
    ...createDefaultPracticeEnv(),
    answerKey: createAnswerKeyLoader((version) => loadAnswerKey(version, { production: true })),
    civicsLocked: () => (["2008", "2025"] as const).some((v) => answerKeyLockedInBuild(v, { production: true })),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("production build with unreviewed answer keys", () => {
  it("the answer key loader refuses, so civics is locked; the rules and content still load", () => {
    const env = productionEnv(); // rules, config and content load fine in production
    for (const version of ["2008", "2025"] as const) {
      const result = env.answerKey(version);
      expect(result.status).toBe("locked");
      if (result.status === "locked") expect(result.reason).toMatch(/needsHumanReview/);
    }
  });

  it("the home screen says what this build offers and does not headline the full interview", () => {
    const html = renderToString(<PracticeApp engine={createPracticeEngine(productionEnv())} />);
    expect(html).toContain("Welcome to the booth");
    expect(html).toContain("In this build you can practice");
    expect(html).toContain("Civics, Study first and the full practice interview are switched off in this build");
    expect(html).not.toContain("All four parts in order, then one report.");
  });

  it("interview, reading and writing run; civics is locked; no report is built", () => {
    const engine = createPracticeEngine(productionEnv());
    const at = "2026-11-17T10:00:00.000Z";
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed: 3, at });
    s = engine.reduce(s, {
      type: "start",
      profileId: engine.env.content.profiles[0]!.id,
      filedOn: "on_or_after",
      seed: 3,
      at,
    });
    s = engine.reduce(s, { type: "finishN400", at });
    for (const kind of ["reading", "writing"] as const) {
      for (;;) {
        const p = engine.englishProgress(s, kind);
        if (p.done || p.current === null) break;
        s = engine.reduce(s, {
          type: kind === "reading" ? "submitReading" : "submitWriting",
          transcript: p.current.text,
          input: "typed",
          at,
        });
      }
      s = engine.reduce(s, { type: "continue", at });
    }
    expect(s.phase).toBe("civics");
    expect(engine.civicsProgress(s).locked).toBe(true);
    expect(engine.reduce(s, { type: "continue", at }).report).toBeNull();
  });

  it("in development (the default test mode) the keys load and civics is scored", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = createDefaultPracticeEnv();
    expect(env.answerKey("2008").status).toBe("ready");
    expect(env.answerKey("2025").status).toBe("ready");
    warn.mockRestore();
  });
});

describe("the copy of the review flags used before the keys are fetched", () => {
  it("is equal to needsHumanReview in the answer key files", () => {
    expect(ANSWER_KEY_NEEDS_REVIEW["2008"]).toBe((raw2008 as { needsHumanReview: boolean }).needsHumanReview);
    expect(ANSWER_KEY_NEEDS_REVIEW["2025"]).toBe((raw2025 as { needsHumanReview: boolean }).needsHumanReview);
  });
  it("does not replace the loader's own production check", () => {
    expect(() => loadAnswerKey("2008", { production: true })).toThrow(/needsHumanReview/);
    expect(() => loadAnswerKey("2025", { production: true })).toThrow(/needsHumanReview/);
  });
});
