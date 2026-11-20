/**
 * Civics screen and the practice app, rendered on the server for each phase. Grading is the
 * real engine on the real answer keys (development mode). Fictional profiles only.
 */
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { CivicsScreen } from "../screens/CivicsScreen";
import { PracticeApp, Screen } from "../PracticeApp";
import { createScriptedN400Coach } from "../../engine/n400-coach";
import { loadAnswerKey } from "../../engine/civics-answer-key";
import { officialAnswerLines } from "../../engine/official-answer-text";
import {
  createDefaultPracticeEnv,
  createPracticeEngine,
  type AnswerKeyResult,
  type PracticeAction,
  type PracticeState,
} from "../../engine/practice-flow";
import type { CivicsTestVersion } from "../../engine/version-selector";

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
const profile = base.content.profiles[0]!.id;

function toCivics(e: typeof engine, filedOn: "before" | "on_or_after" = "before"): PracticeState {
  let s = e.reduce(e.initial(), { type: "choose", mode: "full", seed: 5, at: AT });
  s = e.reduce(s, { type: "start", profileId: profile, filedOn, seed: 5, at: AT });
  s = e.reduce(s, { type: "finishN400", at: AT });
  for (const kind of ["reading", "writing"] as const) {
    for (;;) {
      const p = e.englishProgress(s, kind);
      if (p.done || p.current === null) break;
      s = e.reduce(s, { type: kind === "reading" ? "submitReading" : "submitWriting", transcript: p.current.text, input: "typed", at: AT });
    }
    s = e.reduce(s, { type: "continue", at: AT });
  }
  return s;
}

function renderScreen(e: typeof engine, state: PracticeState) {
  const dispatch = (_: PracticeAction) => {};
  return renderToString(
    <Screen
      engine={e}
      state={state}
      dispatch={dispatch}
      coach={createScriptedN400Coach(e.env.content.n400Questions)}
      civicsLockedInBuild={false}
      now={() => AT}
      seed={() => 1}
      restart={() => {}}
    />
  );
}

describe("civics screen", () => {
  it("shows the first static question, a play button, an answer box and the count", () => {
    const s = toCivics(engine);
    const progress = engine.civicsProgress(s);
    const html = renderToString(
      <CivicsScreen progress={progress} version="2008" onSubmit={() => {}} onContinue={() => {}} onRestart={() => {}} />
    );
    expect(html).toContain(progress.current!.questionText.replace(/’/g, "’").replace(/&/g, "&amp;"));
    expect(html).toContain("<textarea");
    expect(html).toContain(`Question 1 of ${progress.total}`);
    expect(progress.current!.answerType).toBe("static");
  });

  it("after a right answer: Correct, the official answers, and a next button", () => {
    let s = toCivics(engine);
    const q = engine.civicsProgress(s).current!;
    s = engine.reduce(s, { type: "submitCivics", response: q.acceptedAnswers.slice(0, q.requiredAnswerCount).join(" and "), input: "typed", at: AT });
    const progress = engine.civicsProgress(s);
    const html = renderToString(
      <CivicsScreen progress={progress} version="2008" onSubmit={() => {}} onContinue={() => {}} onRestart={() => {}} showFeedbackInitially />
    );
    expect(html).toContain("Correct");
    expect(html).toContain("Official answers");
    const first = officialAnswerLines("2008", q.id)![0]!;
    expect(html).toContain(first.replace(/&/g, "&amp;").replace(/’/g, "’").replace(/'/g, "&#x27;"));
    expect(html).toContain("Next question");
  });

  it("after a wrong answer: Not yet, with the official answers", () => {
    let s = toCivics(engine);
    s = engine.reduce(s, { type: "submitCivics", response: "zzz qqq", input: "typed", at: AT });
    const html = renderToString(
      <CivicsScreen progress={engine.civicsProgress(s)} version="2008" onSubmit={() => {}} onContinue={() => {}} onRestart={() => {}} showFeedbackInitially />
    );
    expect(html).toContain("Not yet");
    expect(html).toContain("zzz qqq");
    expect(html).toContain("Official answers");
  });

  it("when the engine stops the stage, says why and offers the report", () => {
    let s = toCivics(engine);
    for (;;) {
      const p = engine.civicsProgress(s);
      if (p.done || p.current === null) break;
      s = engine.reduce(s, { type: "submitCivics", response: "zzz qqq", input: "typed", at: AT });
    }
    const progress = engine.civicsProgress(s);
    expect(progress.result?.stopReason).toBe("incorrect_threshold");
    const html = renderToString(
      <CivicsScreen progress={progress} version="2008" onSubmit={() => {}} onContinue={() => {}} onRestart={() => {}} showFeedbackInitially />
    );
    expect(html).toContain("The test stopped because too many answers need more practice.");
    expect(html).toContain("See my report");
    expect(html).toContain(`${progress.result!.incorrectCount} not yet`);
  });

  it("when the key is refused, explains it and offers to start over, with no answer box", () => {
    const s = toCivics(lockedEngine);
    const html = renderToString(
      <CivicsScreen progress={lockedEngine.civicsProgress(s)} version="2008" onSubmit={() => {}} onContinue={() => {}} onRestart={() => {}} />
    );
    expect(html).toContain("Civics is switched off in this build");
    expect(html).toContain("Start over");
    expect(html).not.toContain("<textarea");
  });
});

describe("the app, phase by phase", () => {
  it("starts at the home screen, with no stepper yet", () => {
    const html = renderToString(<PracticeApp engine={engine} />);
    expect(html).toContain("Welcome to the booth");
    expect(html).toContain("Full practice interview");
    expect(html).not.toContain("Interview stages");
    expect(html).not.toContain("Choose a practice profile");
  });

  it("shows each phase for a started session", () => {
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed: 5, at: AT });
    s = engine.reduce(s, { type: "start", profileId: profile, filedOn: "on_or_after", seed: 5, at: AT });
    expect(renderScreen(engine, s)).toContain("N-400 interview");
    s = engine.reduce(s, { type: "finishN400", at: AT });
    expect(renderScreen(engine, s)).toContain("Read the sentence out loud");
    s = toCivics(engine, "on_or_after");
    expect(renderScreen(engine, s)).toContain("Answer out loud or type");
  });

  it("the report phase shows the real report, the N-400 note and a restart button", () => {
    let s = toCivics(engine);
    for (;;) {
      const p = engine.civicsProgress(s);
      if (p.done || p.current === null) break;
      const q = p.current;
      s = engine.reduce(s, { type: "submitCivics", response: q.acceptedAnswers.slice(0, q.requiredAnswerCount).join(" and "), input: "typed", at: AT });
    }
    s = engine.reduce(s, { type: "continue", at: AT });
    expect(s.phase).toBe("report");
    const html = renderScreen(engine, s);
    expect(html).toContain("Practice complete: each part reached the practice score");
    expect(html).toContain("This is a practice tool only.");
    expect(html).toContain("The N-400 interview is practice only and is not scored.");
    expect(html).toContain("Practice again");
    expect(html).toContain("Practice profile (fictional)");
  });

  it("a locked build never reaches a report", () => {
    const s = toCivics(lockedEngine);
    const html = renderScreen(lockedEngine, s);
    expect(html).toContain("Civics is switched off in this build");
    expect(html).not.toContain("Practice report");
  });
});
describe("civics answers by voice use the best alternative (answer key only)", () => {
  it("picks the alternative that matches the answer key and scores it", () => {
    let s = toCivics(engine);
    const q = engine.civicsProgress(s).current!;
    const right = q.acceptedAnswers.slice(0, q.requiredAnswerCount).join(" and ");
    s = engine.reduce(s, { type: "submitCivics", response: "zzz qqq", alternatives: ["yyy", right], input: "voice", at: AT });
    expect(s.civics[0]).toMatchObject({ response: right, alternativesScored: 3, input: "voice" });
    const progress = engine.civicsProgress(s);
    expect(progress.last?.result).toBe("correct");
    expect(progress.lastInput).toBe("voice");
  });
  it("keeps the main text when no alternative matches, and does not score typed text by alternatives", () => {
    let s = toCivics(engine);
    s = engine.reduce(s, { type: "submitCivics", response: "zzz qqq", alternatives: ["yyy"], input: "voice", at: AT });
    expect(s.civics[0]!.response).toBe("zzz qqq");
    expect(engine.civicsProgress(s).last?.result).toBe("incorrect");
    s = engine.reduce(s, { type: "submitCivics", response: "zzz", input: "typed", at: AT });
    expect(s.civics[1]).toMatchObject({ alternativesScored: 1 });
  });
  it("the feedback says the result rests on the words the device heard", () => {
    let s = toCivics(engine);
    s = engine.reduce(s, { type: "submitCivics", response: "zzz", input: "voice", at: AT });
    const html = renderToString(
      <CivicsScreen progress={engine.civicsProgress(s)} version="2008" onSubmit={() => {}} onContinue={() => {}} onRestart={() => {}} showFeedbackInitially />
    );
    expect(html).toContain("This result is based on the words your device heard.");
  });
});
