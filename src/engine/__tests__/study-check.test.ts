/**
 * "Test myself" in Study grades one answer exactly as the civics part does: the best of the
 * recogniser's alternatives by matchedAnswerCount, then scoreCivicsTurn against the answer key.
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { loadAnswerKey } from "../civics-answer-key";
import { matchedAnswerCount, scoreCivicsTurn } from "../civics-grader";
import { bestCivicsCandidate, checkStudyAnswer } from "../study-check";

const key2008 = loadAnswerKey("2008", { production: false });
const key2025 = loadAnswerKey("2025", { production: false });
const supremeLaw = key2008.get("2008-001")!;

const scoreAsPractice = (key: typeof key2008, id: string, text: string) =>
  scoreCivicsTurn({ turnId: "t", stage: "civics", prompt: "", responseText: text, questionId: id, completedAt: "2026-11-28T00:00:00.000Z" }, key).scoring;

describe("checkStudyAnswer", () => {
  it("a correct and an incorrect answer, from the real answer key", () => {
    expect(supremeLaw.questionText).toBe("What is the supreme law of the land?");
    expect(checkStudyAnswer(supremeLaw, key2008, "the Constitution").result).toBe("correct");
    expect(checkStudyAnswer(supremeLaw, key2008, "the Bill of Rights").result).toBe("incorrect");
    expect(checkStudyAnswer(supremeLaw, key2008, "").result).toBe("incorrect");
  });

  it("accepted answers of one-answer questions get the practice grader's result, in both keys", () => {
    for (const key of [key2008, key2025]) {
      for (const entry of key.values()) {
        if (entry.answerType !== "static" || entry.requiredAnswerCount !== 1) continue;
        for (const answer of entry.acceptedAnswers.slice(0, 3)) {
          expect(checkStudyAnswer(entry, key, answer).result, `${entry.id}: ${answer}`).toBe((scoreAsPractice(key, entry.id, answer) as { result: string }).result);
        }
      }
    }
  });

  it("property: the same result as the civics part's grader for any text", () => {
    const entries = [...key2008.values(), ...key2025.values()].filter((e) => e.answerType === "static");
    fc.assert(
      fc.property(fc.integer({ min: 0, max: entries.length - 1 }), fc.string({ maxLength: 40 }), (i, text) => {
        const entry = entries[i]!;
        const key = entry.id.startsWith("2008") ? key2008 : key2025;
        const practice = scoreAsPractice(key, entry.id, text) as { result: string };
        return checkStudyAnswer(entry, key, text).result === practice.result;
      }),
      { numRuns: 300 }
    );
  });

  it("spoken alternatives: the one with the most matched answers is scored, as in the practice", () => {
    const check = checkStudyAnswer(supremeLaw, key2008, "the constitutional", ["the Constitution", "a constitution day"]);
    expect(check.response).toBe("the Constitution");
    expect(check.result).toBe("correct");
  });

  it("property: the chosen alternative has the highest matched count, the first such one", () => {
    const entries = [...key2008.values()].filter((e) => e.answerType === "static");
    fc.assert(
      fc.property(fc.integer({ min: 0, max: entries.length - 1 }), fc.array(fc.string({ maxLength: 20 }), { minLength: 1, maxLength: 4 }), (i, texts) => {
        const entry = entries[i]!;
        const [first, ...rest] = texts as [string, ...string[]];
        const chosen = bestCivicsCandidate(entry, first, rest);
        const all = [first, ...rest];
        const best = Math.max(...all.map((t) => matchedAnswerCount(entry, t)));
        return matchedAnswerCount(entry, chosen) === best && all.find((t) => matchedAnswerCount(entry, t) === best) === chosen;
      }),
      { numRuns: 200 }
    );
  });
});
