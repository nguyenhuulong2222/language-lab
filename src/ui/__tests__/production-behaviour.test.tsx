/**
 * What a production build does while the answer key files still say needsHumanReview: true.
 * The production flag is simulated with vi.stubEnv; the check in the loader is not changed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { PracticeApp } from "../PracticeApp";
import { loadAnswerKey } from "../../engine/civics-answer-key";
import { createAnswerKeyLoader, createDefaultPracticeEnv, createPracticeEngine } from "../../engine/practice-flow";

/**
 * A production environment: the answer keys are loaded with `production: true`, which is what
 * the loader does in a production build. The loader's own check is the one being exercised.
 */
function productionEnv() {
  return {
    ...createDefaultPracticeEnv(),
    answerKey: createAnswerKeyLoader((version) => loadAnswerKey(version, { production: true })),
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

  it("the intro works and says civics scoring is switched off", () => {
    const html = renderToString(<PracticeApp engine={createPracticeEngine(productionEnv())} />);
    expect(html).toContain("Welcome to the booth");
    expect(html).toContain("Civics scoring is switched off in this build");
  });

  it("interview, reading and writing run; civics is locked; no report is built", () => {
    const engine = createPracticeEngine(productionEnv());
    const at = "2026-11-17T10:00:00.000Z";
    let s = engine.reduce(engine.initial(), {
      type: "start",
      profileId: engine.env.content.profiles[0]!.id,
      filedOn: "on_or_after",
      seed: 3,
      at,
    });
    s = engine.reduce(s, { type: "finishN400" });
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
