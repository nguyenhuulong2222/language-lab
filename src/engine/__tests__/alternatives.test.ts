/**
 * Every alternative the recogniser gives is scored and the best one is used (BS-23).
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { outcomeFromResults, MAX_KEPT_ALTERNATIVES } from "../recognition-outcome";
import { compareSentence, pickBestAlternative } from "../sentence-compare";
import { loadPracticeConfig, matchOptionsFor } from "../practice-config";
import { createBrowserSpeechListener, MAX_ALTERNATIVES } from "../../ui/voice/speech-listener";

describe("outcomeFromResults", () => {
  it("keeps the main text first and every other alternative", () => {
    const out = outcomeFromResults([["who elect the president", "who elects the president", "who elected the president"]]);
    expect(out).toEqual({
      kind: "transcript",
      text: "who elect the president",
      alternatives: ["who elect the president", "who elects the president", "who elected the president"],
    });
  });
  it("with several results, each other alternative replaces one result at a time", () => {
    const out = outcomeFromResults([["a b", "a c"], ["d e", "d f"]]);
    expect(out).toEqual({ kind: "transcript", text: "a b d e", alternatives: ["a b d e", "a c d e", "a b d f"] });
  });
  it("drops blanks and duplicates; nothing is nothing heard", () => {
    expect(outcomeFromResults([])).toEqual({ kind: "nothing-heard" });
    expect(outcomeFromResults([["  ", ""]])).toEqual({ kind: "nothing-heard" });
    const out = outcomeFromResults([["x", "x", " x "]]);
    expect(out.kind === "transcript" && out.alternatives).toEqual(["x"]);
  });
  it("property: the main text is the first alternative, and the list is bounded", () => {
    fc.assert(
      fc.property(fc.array(fc.array(fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim() !== ""), { minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 6 }), (results) => {
        const out = outcomeFromResults(results);
        expect(out.kind).toBe("transcript");
        if (out.kind === "transcript") {
          expect(out.alternatives[0]).toBe(out.text);
          expect(out.alternatives.length).toBeLessThanOrEqual(MAX_KEPT_ALTERNATIVES);
          expect(new Set(out.alternatives).size).toBe(out.alternatives.length);
        }
      })
    );
  });
});

describe("the browser listener", () => {
  const fake = (results: string[][]) =>
    class Fake {
      static last: Fake | null = null;
      lang = "";
      interimResults = true;
      continuous = true;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: unknown = null;
      onend: (() => void) | null = null;
      constructor() {
        Fake.last = this;
      }
      start() {
        queueMicrotask(() => {
          this.onresult?.({ resultIndex: 0, results: results.map((alts) => alts.map((t) => ({ transcript: t }))) });
          this.onend?.();
        });
      }
      stop() {}
    };
  it("asks for 5 alternatives and returns all of them", async () => {
    const F = fake([["who elect the president", "who elects the president", "who elected the president"]]);
    const out = await createBrowserSpeechListener({ SpeechRecognition: F as unknown as new () => SpeechRecognition }).listen();
    expect(MAX_ALTERNATIVES).toBe(5);
    expect(F.last?.maxAlternatives).toBe(5);
    expect(out).toEqual({
      kind: "transcript",
      text: "who elect the president",
      alternatives: ["who elect the president", "who elects the president", "who elected the president"],
    });
  });
});

describe("the best alternative", () => {
  const target = "Who elects the President?";
  const options = matchOptionsFor(loadPracticeConfig(), "reading");
  const compare = (text: string) => compareSentence(target, text, options);
  it("picks the alternative that matches, not the first", () => {
    const best = pickBestAlternative(["who elected a president", "who elects the president"], compare);
    expect(best.index).toBe(1);
    expect(best.text).toBe("who elects the president");
    expect(best.comparison.isCorrect).toBe(true);
  });
  it("keeps the first when all score the same", () => {
    const best = pickBestAlternative(["who elects the president", "Who elects the President"], compare);
    expect(best.index).toBe(0);
  });
  it("prefers the one with fewer extra words when two score the same", () => {
    const best = pickBestAlternative(["who elects the president please now", "who elects the president now"], compare);
    expect(best.index).toBe(1);
  });
  it("with no candidates it scores the empty text", () => {
    const best = pickBestAlternative([], compare);
    expect(best.text).toBe("");
    expect(best.comparison.isCorrect).toBe(false);
  });
  it("property: the best is never worse than the first candidate", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 30 }), { minLength: 1, maxLength: 6 }), (candidates) => {
        const best = pickBestAlternative(candidates, compare);
        const first = compare(candidates[0] as string);
        expect(best.comparison.accuracy).toBeGreaterThanOrEqual(first.accuracy);
        if (first.isCorrect) expect(best.comparison.isCorrect).toBe(true);
      })
    );
  });
});
