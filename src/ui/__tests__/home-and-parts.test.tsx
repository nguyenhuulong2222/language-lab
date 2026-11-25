/**
 * Home, the stepper of each session, and the report of a single part, rendered on the server.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { loadAnswerKey } from "../../engine/civics-answer-key";
import {
  createDefaultPracticeEnv,
  createPracticeEngine,
  sessionSteps,
  type AnswerKeyResult,
  type PracticeAction,
  type PracticeMode,
  type PracticeState,
} from "../../engine/practice-flow";
import type { CivicsTestVersion } from "../../engine/version-selector";
import { createScriptedN400Coach } from "../../engine/n400-coach";
import { Shell } from "../components/Shell";
import { Screen } from "../PracticeApp";
import { EnglishScreen } from "../screens/EnglishScreen";

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
const profile = base.content.profiles[0]!.id;

function renderScreen(state: PracticeState) {
  const dispatch = (_: PracticeAction) => {};
  return renderToString(
    <Screen
      engine={engine}
      state={state}
      dispatch={dispatch}
      coach={createScriptedN400Coach(base.content.n400Questions)}
      civicsLockedInBuild={false}
      now={() => AT}
      seed={() => 1}
      restart={() => {}}
    />
  );
}

function renderShell(mode: PracticeMode, state: PracticeState) {
  return renderToString(
    <Shell steps={sessionSteps(mode)} currentStage={state.phase === "home" ? "intro" : state.phase}>
      <p>content</p>
    </Shell>
  );
}

describe("the stepper shows only the steps of the session", () => {
  it("one part: that part and the report", () => {
    const s = engine.reduce(engine.initial(), { type: "choose", mode: "reading", seed: 1, at: AT });
    const html = renderShell("reading", s);
    expect(html).toContain("Stage 1 of 2");
    expect(html).toContain("Reading");
    expect(html).toContain("Report");
    // Only the stepper is checked: the About panel's privacy line names the N-400 part (AI coach).
    const stepper = /<nav[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
    expect(stepper).toContain("Reading");
    for (const other of ["Civics", "Writing", "N-400"]) expect(stepper).not.toContain(other);
  });

  it("civics only: setup, civics and the report", () => {
    const s = engine.reduce(engine.initial(), { type: "choose", mode: "civics", seed: 1, at: AT });
    expect(renderShell("civics", s)).toContain("Stage 1 of 3");
  });

  it("the full interview: all six steps", () => {
    const s = engine.reduce(engine.initial(), { type: "choose", mode: "full", seed: 1, at: AT });
    expect(renderShell("full", s)).toContain("Stage 1 of 6");
  });

  it("no screen shows the decorative take counter (senior-friendly step 3); the stepper counts the steps", () => {
    const s = engine.reduce(engine.initial(), { type: "choose", mode: "reading", seed: 1, at: AT });
    const html = renderToString(
      <Shell steps={sessionSteps("reading")} currentStage="reading">
        {renderScreenElement(s)}
      </Shell>
    );
    expect(html).not.toContain("TAKE");
    expect(html).not.toContain("take__overline");
  });
});

function renderScreenElement(state: PracticeState) {
  return (
    <Screen
      engine={engine}
      state={state}
      dispatch={() => {}}
      coach={createScriptedN400Coach(base.content.n400Questions)}
      civicsLockedInBuild={false}
      now={() => AT}
      seed={() => 1}
      restart={() => {}}
    />
  );
}

describe("single-part sessions in the app", () => {
  it("reading starts straight at the sentence, with no setup and no profile", () => {
    const html = renderScreen(engine.reduce(engine.initial(), { type: "choose", mode: "reading", seed: 1, at: AT }));
    expect(html).toContain("Read the sentence out loud");
    expect(html).not.toContain("Choose a practice profile");
  });

  it("civics asks only for the filing choice", () => {
    const html = renderScreen(engine.reduce(engine.initial(), { type: "choose", mode: "civics", seed: 1, at: AT }));
    expect(html).toContain("Practice as if the N-400 was filed");
    expect(html).not.toContain("Choose a practice profile");
  });

  it("a finished reading part shows a part report with no overall result", () => {
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "reading", seed: 1, at: AT });
    for (;;) {
      const p = engine.englishProgress(s, "reading");
      if (p.done || p.current === null) break;
      s = engine.reduce(s, { type: "submitReading", transcript: p.current.text, input: "typed", at: AT });
    }
    const lastFeedback = renderToString(
      <EnglishScreen
        progress={engine.englishProgress(s, "reading")}
        matchOptions={engine.matchOptions("reading")}
        nextIsReport
        showFeedbackInitially
        onSubmit={() => {}}
        onContinue={() => {}}
      />
    );
    expect(lastFeedback).toContain("See my report");
    expect(lastFeedback).not.toContain("Go to writing");
    s = engine.reduce(s, { type: "continue", at: AT });
    const html = renderScreen(s);
    expect(html).toContain("Reading practice");
    expect(html).toContain("This report is for one part only.");
    expect(html).toContain("it gives no overall practice result");
    expect(html).toContain("This part reached the practice score");
    expect(html).not.toContain("Practice score reached");
    expect(html).toContain("It shows how this part went in practice, not how you would do on the real test");
    expect(html).toContain("Please read this");
    expect(html).toContain("This is a practice tool only.");
    expect(html).toContain("Back to home");
    expect(html).not.toContain("Practice complete: each part reached the practice score");
    expect(html).not.toContain("A few things to review");
    expect(html).not.toContain("practice_passed");
    expect(html).not.toContain("needs_more_practice");
  });

  it("a civics part report names what to review and has no overall result", () => {
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "civics", seed: 1, at: AT });
    s = engine.reduce(s, { type: "start", filedOn: "on_or_after", seed: 1, at: AT });
    for (;;) {
      const p = engine.civicsProgress(s);
      if (p.done || p.current === null) break;
      s = engine.reduce(s, { type: "submitCivics", response: "zzz qqq", input: "typed", at: AT });
    }
    s = engine.reduce(s, { type: "continue", at: AT });
    const html = renderScreen(s);
    expect(html).toContain("Civics practice");
    expect(html).toContain("Worth reviewing");
    expect(html).toContain("Questions to review");
    expect(html).toContain("answered correctly");
    expect(html).not.toContain("practice_passed");
  });

  it("an N-400 part report lists the user's own words and says it is not scored", () => {
    let s = engine.reduce(engine.initial(), { type: "choose", mode: "n400", seed: 1, at: AT });
    s = engine.reduce(s, { type: "start", profileId: profile, seed: 1, at: AT });
    s = engine.reduce(s, { type: "answerN400", questionId: "n400-001", questionText: "Can you tell me your full name?", transcript: "my own words", at: AT });
    s = engine.reduce(s, { type: "finishN400", at: AT });
    const html = renderScreen(s);
    expect(html).toContain("N-400 interview practice");
    expect(html).toContain("my own words");
    expect(html).toContain("This part is not scored.");
  });
});
