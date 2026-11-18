import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { outcomeFromError, outcomeFromTranscripts } from "../recognition-outcome";
import { createScriptedN400Coach, type N400Answer } from "../n400-coach";
import { loadPracticeContent } from "../practice-content";

describe("outcomeFromError", () => {
  it.each([
    ["not-allowed", "denied"],
    ["service-not-allowed", "denied"],
    ["no-speech", "nothing-heard"],
    ["audio-capture", "no-microphone"],
    ["language-not-supported", "unsupported"],
  ])("%s gives %s", (code, kind) => {
    expect(outcomeFromError(code).kind).toBe(kind);
  });

  it("keeps the code for anything else", () => {
    expect(outcomeFromError("network")).toEqual({ kind: "error", code: "network" });
  });

  it("property: every code gives exactly one known outcome and never a transcript", () => {
    fc.assert(
      fc.property(fc.string(), (code) => {
        const outcome = outcomeFromError(code);
        return ["denied", "nothing-heard", "no-microphone", "unsupported", "error"].includes(outcome.kind);
      })
    );
  });
});

describe("outcomeFromTranscripts", () => {
  it("joins pieces", () => {
    expect(outcomeFromTranscripts(["we pay", " taxes "])).toEqual({ kind: "transcript", text: "we pay taxes" });
  });
  it("nothing or blank text is nothing heard", () => {
    expect(outcomeFromTranscripts([])).toEqual({ kind: "nothing-heard" });
    expect(outcomeFromTranscripts(["", "   "])).toEqual({ kind: "nothing-heard" });
  });
  it("property: blank input is nothing heard, any word makes a transcript", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom("", " ", "  ")), (pieces) => outcomeFromTranscripts(pieces).kind === "nothing-heard")
    );
    fc.assert(
      fc.property(fc.array(fc.constantFrom("a", "b", ""), { minLength: 1 }), (pieces) => {
        const hasWord = pieces.some((p) => p !== "");
        return (outcomeFromTranscripts(pieces).kind === "transcript") === hasWord;
      })
    );
  });
});

describe("scripted N-400 coach", () => {
  const content = loadPracticeContent();
  const coach = createScriptedN400Coach(content.n400Questions);
  const profile = content.profiles[0]!;

  it("asks every question once, in order, then stops", async () => {
    const answered: N400Answer[] = [];
    const asked: string[] = [];
    for (;;) {
      const prompt = await coach.nextQuestion({ profile, answered });
      if (prompt === null) break;
      asked.push(prompt.id);
      answered.push({ questionId: prompt.id, questionText: prompt.text, transcript: "my answer" });
    }
    expect(asked).toEqual(content.n400Questions.map((q) => q.id));
  });

  it("offers the sample answer of the chosen profile", async () => {
    for (const p of content.profiles) {
      const prompt = await coach.nextQuestion({ profile: p, answered: [] });
      expect(prompt?.sampleAnswer).toBe(content.n400Questions[0]!.sampleAnswers[p.id]);
    }
  });

  it("gives no feedback", async () => {
    expect(
      await coach.feedback({ profile, answered: [] }, { questionId: "n400-001", questionText: "Q?", transcript: "x" })
    ).toBeNull();
  });
});
