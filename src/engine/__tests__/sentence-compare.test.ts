import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { compareSentence } from "../sentence-compare";
import { matchTokens } from "../answer-normaliser";

const word = fc.constantFrom("lincoln", "flag", "vote", "the", "capital", "we", "pay", "taxes", "july", "people");
const words = fc.array(word, { maxLength: 10 });
const text = words.map((w) => w.join(" "));
const nonEmptyText = fc.array(word, { minLength: 1, maxLength: 10 }).map((w) => w.join(" "));
const threshold = fc.double({ min: 0.01, max: 1, noNaN: true });

describe("compareSentence", () => {
  it("an exact match is 100% and correct", () => {
    const c = compareSentence("Who was George Washington?", "who was george washington", 1);
    expect(c.accuracy).toBe(1);
    expect(c.isCorrect).toBe(true);
    expect(c.diff.every((d) => d.status === "match")).toBe(true);
  });

  it("ignores case, punctuation and hyphens", () => {
    expect(compareSentence("Washington, D.C. is the capital.", "WASHINGTON DC is the CAPITAL", 1).accuracy).toBe(1);
  });

  it("reads a number said in words as the numeral", () => {
    expect(compareSentence("The United States has fifty states.", "the united states has 50 states", 1).isCorrect).toBe(true);
  });

  it("a missing word lowers accuracy and is marked missing", () => {
    const c = compareSentence("We pay taxes", "we taxes", 0.9);
    expect(c.accuracy).toBeCloseTo(2 / 3);
    expect(c.isCorrect).toBe(false);
    expect(c.diff).toEqual([
      { word: "we", status: "match" },
      { word: "pay", status: "missing" },
      { word: "taxes", status: "match" },
    ]);
  });

  it("an extra word lowers accuracy and is marked extra", () => {
    const c = compareSentence("We pay taxes", "we really pay taxes", 0.9);
    expect(c.accuracy).toBe(0.75);
    expect(c.diff.filter((d) => d.status === "extra").map((d) => d.word)).toEqual(["really"]);
  });

  it("words in the wrong order do not all match", () => {
    expect(compareSentence("we pay taxes", "taxes pay we", 1).accuracy).toBeLessThan(1);
  });

  it("nothing said is 0", () => {
    const c = compareSentence("We pay taxes", "", 0.5);
    expect(c.accuracy).toBe(0);
    expect(c.isCorrect).toBe(false);
    expect(c.diff.every((d) => d.status === "missing")).toBe(true);
  });

  it("the threshold decides, not the module", () => {
    expect(compareSentence("we pay taxes", "we taxes", 0.6).isCorrect).toBe(true);
    expect(compareSentence("we pay taxes", "we taxes", 0.7).isCorrect).toBe(false);
  });
});

describe("compareSentence properties", () => {
  it("property: accuracy is between 0 and 1", () => {
    fc.assert(
      fc.property(text, text, threshold, (a, b, t) => {
        const { accuracy } = compareSentence(a, b, t);
        return accuracy >= 0 && accuracy <= 1;
      })
    );
  });

  it("property: a sentence compared with itself is 1 at any threshold", () => {
    fc.assert(fc.property(nonEmptyText, threshold, (a, t) => {
      const c = compareSentence(a, a, t);
      return c.accuracy === 1 && c.isCorrect;
    }));
  });

  it("property: case and punctuation do not change the result", () => {
    fc.assert(
      fc.property(nonEmptyText, text, (a, b) => {
        const plain = compareSentence(a, b, 0.5);
        const noisy = compareSentence(a.toUpperCase() + "!", b.split(" ").join(",  ").toUpperCase(), 0.5);
        return plain.accuracy === noisy.accuracy;
      })
    );
  });

  it("property: accuracy is symmetric", () => {
    fc.assert(fc.property(text, text, (a, b) => compareSentence(a, b, 0.5).accuracy === compareSentence(b, a, 0.5).accuracy));
  });

  it("property: the diff rebuilds both sentences", () => {
    fc.assert(
      fc.property(text, text, (a, b) => {
        const c = compareSentence(a, b, 0.5);
        const target = c.diff.filter((d) => d.status !== "extra").map((d) => d.word);
        const attempt = c.diff.filter((d) => d.status !== "missing").map((d) => d.word);
        return (
          target.join(" ") === matchTokens(a).join(" ") &&
          attempt.join(" ") === matchTokens(b).join(" ") &&
          c.diff.filter((d) => d.status === "match").length === c.matchedWords
        );
      })
    );
  });

  it("property: matched words never exceed either sentence", () => {
    fc.assert(
      fc.property(text, text, (a, b) => {
        const c = compareSentence(a, b, 0.5);
        return c.matchedWords <= c.targetWords && c.matchedWords <= c.attemptWords;
      })
    );
  });

  it("property: correct at a threshold means correct at every lower threshold", () => {
    fc.assert(
      fc.property(text, text, threshold, threshold, (a, b, t1, t2) => {
        const [low, high] = t1 <= t2 ? [t1, t2] : [t2, t1];
        return !compareSentence(a, b, high).isCorrect || compareSentence(a, b, low).isCorrect;
      })
    );
  });

  it("property: adding a word that is not in the sentence never raises accuracy", () => {
    fc.assert(
      fc.property(nonEmptyText, text, (a, b) => {
        const before = compareSentence(a, b, 0.5).accuracy;
        const after = compareSentence(a, `${b} zebra`, 0.5).accuracy;
        return after <= before;
      })
    );
  });

  it("property: saying nothing scores 0 for any sentence", () => {
    fc.assert(fc.property(nonEmptyText, (a) => compareSentence(a, "", 0.5).accuracy === 0));
  });
});
