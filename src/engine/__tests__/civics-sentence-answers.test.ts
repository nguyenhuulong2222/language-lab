/**
 * Sentence answers (the 23 SENTENCE questions, matchAs "sentence") are matched the way the reading
 * rule matches a sentence: every content word in order, function words from the fixed list and
 * -s/-es/'s endings do not matter, a missing or substituted content word fails. No answer is added.
 */
import { describe, expect, it, vi } from "vitest";
import * as fc from "fast-check";
import { countMatchingPhrases, matchTokens } from "../answer-normaliser.js";
import { loadAnswerKey, type CivicsAnswerEntry } from "../civics-answer-key.js";
import { civicsSentenceRule, matchedAnswerCount } from "../civics-grader.js";
import { officialAnswerLines } from "../official-answer-text.js";

function load(version: "2008" | "2025"): Map<string, CivicsAnswerEntry> {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return loadAnswerKey(version, { production: false });
  } finally {
    warn.mockRestore();
  }
}
const KEYS = { "2008": load("2008"), "2025": load("2025") } as const;
const ALL = [...KEYS["2008"].values(), ...KEYS["2025"].values()];
const SENTENCES = ALL.filter((e) => e.matchAs === "sentence");
const rule = civicsSentenceRule();
const correct = (e: CivicsAnswerEntry, response: string) => matchedAnswerCount(e, response) >= e.requiredAnswerCount;
/** The same entry with only one of its accepted answers, so a test sees that answer alone. */
const only = (e: CivicsAnswerEntry, answer: string): CivicsAnswerEntry => ({ ...e, acceptedAnswers: [answer], answerGroups: [], anyOrder: [] });
const contentIndexes = (tokens: readonly string[]) => tokens.map((t, i) => [t, i] as const).filter(([t]) => !rule.functionWords.has(t)).map(([, i]) => i);

describe("which questions are sentence answers", () => {
  it("exactly the 23 questions flagged SENTENCE by the build script", () => {
    expect(SENTENCES.map((e) => e.id)).toEqual([
      "2008-010", "2008-012", "2008-024", "2008-031", "2008-086", "2008-096", "2008-097",
      "2025-013", "2025-026", "2025-049", "2025-060", "2025-084", "2025-089", "2025-101", "2025-103",
      "2025-107", "2025-110", "2025-111", "2025-112", "2025-114", "2025-115", "2025-127", "2025-128",
    ]);
  });
  it("every one of them has accepted answers of five words or more, and no stored answer was added", () => {
    for (const e of SENTENCES) for (const a of e.acceptedAnswers) expect(a.split(" ").length, `${e.id} ${a}`).toBeGreaterThanOrEqual(5);
  });
  it("other questions keep phrase matching", () => {
    expect(ALL.filter((e) => e.matchAs !== "sentence").length).toBe(228 - 23);
  });
});

describe("examples", () => {
  const e = (id: string) => ALL.find((x) => x.id === id)!;
  it("short words and endings do not matter; other words may come between", () => {
    expect(correct(e("2008-096"), "There were thirteen original colonies.")).toBe(true);
    expect(correct(e("2008-010"), "You can practice any religion, or not practice religion")).toBe(true);
    expect(correct(e("2025-101"), "Germany attacked U.S. ship")).toBe(true);
    expect(correct(e("2025-110"), "I think it was to stop spread communism")).toBe(true);
    expect(correct(e("2025-128"), "a holiday that honors people in the military")).toBe(true);
  });
  it("a missing or substituted content word fails", () => {
    expect(correct(e("2008-096"), "because the stripes represent the colonies")).toBe(false);
    expect(correct(e("2008-086"), "terrorists attacked the united kingdom")).toBe(false);
    expect(correct(e("2025-110"), "to stop the spread of fascism")).toBe(false);
  });
  it("content words out of order fail", () => {
    expect(correct(e("2008-086"), "the united states attacked terrorists")).toBe(false);
  });
});

describe("properties on the real keys", () => {
  it("the full source sentence always passes, with any words around it", () => {
    const pairs = SENTENCES.flatMap((e) => [
      ...e.acceptedAnswers.map((a) => [e, a] as const),
      ...(officialAnswerLines(e.testVersion, e.id) ?? []).map((line) => [e, line] as const),
    ]);
    expect(pairs.length).toBeGreaterThan(40);
    fc.assert(
      fc.property(
        fc.constantFrom(...pairs),
        fc.constantFrom("", "I think", "the answer is", "well,"),
        fc.constantFrom("", ".", "I believe", "that is it"),
        ([e, sentence], before, after) => correct(e, `${before} ${sentence} ${after}`)
      ),
      { numRuns: 400 }
    );
  });
  it("removing any one content word fails (each accepted answer on its own)", () => {
    for (const e of SENTENCES) {
      for (const answer of e.acceptedAnswers) {
        const tokens = matchTokens(answer);
        for (const i of contentIndexes(tokens)) {
          // A leading "because" is optional for every answer (the matcher's rule), so it is not a content word here.
          if (i === 0 && tokens[0] === "because") continue;
          const response = tokens.filter((_, k) => k !== i).join(" ");
          expect(correct(only(e, answer), response), `${e.id}: "${response}" (without "${tokens[i]}")`).toBe(false);
        }
      }
    }
  });
  it("substituting any one content word with another word fails", () => {
    fc.assert(
      fc.property(fc.constantFrom(...SENTENCES.flatMap((e) => e.acceptedAnswers.map((a) => [e, a] as const))), fc.nat(), ([e, answer], pick) => {
        const tokens = matchTokens(answer);
        const indexes = contentIndexes(tokens).filter((i) => !(i === 0 && tokens[0] === "because"));
        const i = indexes[pick % indexes.length]!;
        const response = tokens.map((t, k) => (k === i ? "zebra" : t)).join(" ");
        return !correct(only(e, answer), response);
      }),
      { numRuns: 400 }
    );
  });
  it("where more than one answer is needed, no sentence answer contains another (none today; a guard)", () => {
    for (const e of SENTENCES.filter((x) => x.requiredAnswerCount > 1)) {
      for (const a of e.acceptedAnswers) {
        for (const b of e.acceptedAnswers) {
          if (a !== b) expect(countMatchingPhrases(a, [b], { sentence: rule }), `${e.id}: "${b}" inside "${a}"`).toBe(0);
        }
      }
    }
  });
});

describe("property: sentence matching keeps different answers apart where several are needed", () => {
  // Content words that are not function words and are never the same word as each other.
  const WORDS = ["river", "mountain", "freedom", "people", "court", "vote", "army", "paper", "money", "law", "ship", "coast"];
  const sentenceOf = (words: readonly string[]) => words.flatMap((w, i) => (i % 2 === 0 ? ["the", w] : [w])).join(" ");
  const isSubsequence = (a: readonly string[], b: readonly string[]) => {
    let k = 0;
    for (const w of b) if (w === a[k]) k++;
    return k === a.length;
  };
  it("one answer counts once, two different answers count twice, and one never stands for the other", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...WORDS), { minLength: 2, maxLength: 4 }),
        fc.uniqueArray(fc.constantFrom(...WORDS), { minLength: 2, maxLength: 4 }),
        (a, b) => {
          fc.pre(!isSubsequence(a, b) && !isSubsequence(b, a));
          const answers = [sentenceOf(a), sentenceOf(b)];
          const options = { sentence: rule };
          return (
            countMatchingPhrases(answers[0]!, answers, options) === 1 &&
            countMatchingPhrases(answers[1]!, answers, options) === 1 &&
            countMatchingPhrases(`${answers[0]} and ${answers[1]}`, answers, options) === 2
          );
        }
      ),
      { numRuns: 300 }
    );
  });
});
