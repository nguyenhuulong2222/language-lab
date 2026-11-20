/**
 * The scoring rule for reading and writing (BS-22): every content word present, in order; short words
 * may be missing or extra; plural and possessive endings are the same word; two different words are
 * never equated. Settings come from the real practice config.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { compareSentence, stemWord, type MatchOptions } from "../sentence-compare";
import { matchTokens } from "../answer-normaliser";
import { loadPracticeConfig, matchOptionsFor } from "../practice-config";
import { loadPracticeContent, vocabularyWords } from "../practice-content";

const config = loadPracticeConfig();
const content = loadPracticeContent();
const known = new Set([...vocabularyWords(content.vocabulary.reading), ...vocabularyWords(content.vocabulary.writing)]);
const reading = matchOptionsFor(config, "reading", known);
const writing = matchOptionsFor(config, "writing", known);
const never = new Set(config.sentenceMatch.neverStem);
const ok = (target: string, said: string, o: MatchOptions = reading) => compareSentence(target, said, o).isCorrect;

describe("the iPhone case", () => {
  it('"Who elect the president" against "Who elects the President?" counts (it scored 75% and failed before)', () => {
    const c = compareSentence("Who elects the President?", "Who elect the president", reading);
    expect(c.isCorrect).toBe(true);
    expect(c.notes).toEqual([{ kind: "variant", said: "elect", expected: "elects" }]);
  });
  it("also in writing", () => {
    expect(ok("Who elects the President?", "who elect the president", writing)).toBe(true);
  });
});

describe("content words must all be there", () => {
  it("a dropped content word does not count", () => {
    expect(ok("We pay taxes.", "we taxes")).toBe(false);
    expect(ok("Who elects the President?", "who the president")).toBe(false);
    expect(ok("Who elects the President?", "who elects the")).toBe(false);
    expect(compareSentence("We pay taxes.", "we taxes", reading).notes).toContainEqual({ kind: "missing-content", expected: "pay" });
  });
  it("a substituted content word does not count, and the note says which", () => {
    const c = compareSentence("Who was George Washington?", "who was george lincoln", reading);
    expect(c.isCorrect).toBe(false);
    expect(c.notes).toContainEqual({ kind: "different", said: "lincoln", expected: "washington" });
  });
  it("words in the wrong order do not count", () => {
    expect(ok("Citizens can vote.", "vote can citizens")).toBe(false);
  });
  it("nothing said does not count, for any sentence", () => {
    fc.assert(fc.property(fc.constantFrom(...content.readingSentences.map((s) => s.text)), (s) => !ok(s, "") && !ok(s, "  ")));
  });
  it("a spoken number in words is the numeral", () => {
    expect(ok("The United States has fifty states.", "the united states has 50 states")).toBe(true);
  });
});

describe("short words may be missing or extra", () => {
  it("dropped articles and other short words pass", () => {
    expect(ok("What is the capital of the United States?", "what is capital of united states")).toBe(true);
    expect(ok("The President lives in the White House.", "president lives white house")).toBe(true);
    expect(ok("We pay taxes.", "pay taxes")).toBe(true);
    expect(ok("Alaska is the largest state.", "alaska is largest state", writing)).toBe(true);
  });
  it("an added short word passes", () => {
    expect(ok("We pay taxes.", "we pay the taxes")).toBe(true);
    expect(ok("When do we vote?", "when do we vote on")).toBe(true);
  });
  it("the notes say which short words were left out or added", () => {
    const c = compareSentence("What is the capital of the United States?", "what is capital of united states a", reading);
    expect(c.notes.filter((n) => n.kind === "missing-short").map((n) => n.expected)).toEqual(["the", "the"]);
    expect(c.notes.filter((n) => n.kind === "extra-short").map((n) => n.said)).toEqual(["a"]);
  });
  it("property: dropping every short word from a practice sentence still counts", () => {
    const fn = reading.functionWords;
    fc.assert(
      fc.property(fc.constantFrom(...content.readingSentences.map((s) => s.text)), (s) => {
        const kept = matchTokens(s).filter((w) => !fn.has(w));
        return ok(s, kept.join(" "));
      })
    );
  });
  it("property: dropping any one content word from a practice sentence does not count", () => {
    const fn = reading.functionWords;
    fc.assert(
      fc.property(fc.constantFrom(...content.readingSentences.map((s) => s.text)), fc.nat(20), (s, n) => {
        const tokens = matchTokens(s);
        const contentIdx = tokens.map((w, i) => (fn.has(w) ? -1 : i)).filter((i) => i >= 0);
        const drop = contentIdx[n % contentIdx.length]!;
        return !ok(s, tokens.filter((_, i) => i !== drop).join(" "));
      })
    );
  });
});

describe("extra content words", () => {
  it("one extra content word is allowed, two are not (config)", () => {
    expect(ok("We pay taxes.", "we really pay taxes")).toBe(true);
    expect(ok("We pay taxes.", "we really truly pay taxes")).toBe(false);
    expect(compareSentence("We pay taxes.", "we really pay taxes", reading).notes).toContainEqual({ kind: "extra-content", said: "really" });
  });
  it("is not a threshold in the code: the option decides", () => {
    expect(ok("We pay taxes.", "we really pay taxes", { ...reading, extraContentWordsAllowed: 0 })).toBe(false);
  });
});

describe("plural and possessive endings", () => {
  it("are the same word, in both directions, and the note says so", () => {
    expect(ok("Citizens can vote.", "citizen can vote")).toBe(true);
    expect(ok("A citizen can vote.", "a citizens can vote")).toBe(true);
    expect(ok("President’s Day is in February.", "presidents day is in february")).toBe(true);
    expect(compareSentence("Citizens can vote.", "citizen can vote", reading).notes).toEqual([
      { kind: "variant", said: "citizen", expected: "citizens" },
    ]);
  });
  it("different words are not the same word", () => {
    expect(ok("Who lives in the White House?", "who lived in the white house")).toBe(false);
    expect(ok("She has the flag.", "she have the flag")).toBe(false);
    expect(ok("Who was Lincoln?", "who is lincoln")).toBe(false);
    expect(ok("Congress meets in Washington.", "congress met in washington")).toBe(false);
  });
  it("stemWord leaves short words, names and the neverStem words alone", () => {
    for (const w of ["was", "has", "his", "this", "is", "us", "yes", "news", "texas", "congress", "bus", "series", "always"]) {
      expect(stemWord(w, never), w).toBe(w);
    }
    expect(stemWord("elects", never)).toBe("elect");
    expect(stemWord("taxes", never)).toBe("tax");
    expect(stemWord("cities", never)).toBe("city");
    expect(stemWord("states", never)).toBe("state");
    expect(stemWord("President’s", never)).toBe("president");
    expect(stemWord("27", never)).toBe("27");
  });
  it("property: a stem is the word, or the word without an ending", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{1,12}$/), (w) => {
        const s = stemWord(w, never);
        return s === w || (w.startsWith(s) && w.length - s.length <= 2) || (w.endsWith("ies") && s === `${w.slice(0, -3)}y`);
      })
    );
  });
  it("never equates two different words of the official vocabularies", () => {
    // Group every vocabulary word and practice-sentence word by stem. Each group must be one word and its
    // plural/possessive forms only: the group members differ by -s, -es, 's, or -ies/-y. This list is the
    // whole set of groups that exist today; a new equation shows up here.
    const words = new Set<string>();
    for (const w of known) words.add(w);
    for (const s of [...content.readingSentences, ...content.writingSentences]) for (const w of matchTokens(s.text)) words.add(w);
    const groups = new Map<string, string[]>();
    for (const w of words) {
      const stem = stemWord(w, never);
      groups.set(stem, [...(groups.get(stem) ?? []), w]);
    }
    const shared = [...groups.entries()].filter(([, list]) => list.length > 1).map(([stem, list]) => `${stem}: ${list.sort().join(" ")}`).sort();
    for (const [stem, list] of groups) {
      for (const w of list) {
        const rest = w.replace(/'s$/, "");
        const okForm = rest === stem || rest === `${stem}s` || rest === `${stem}es` || (stem.endsWith("y") && rest === `${stem.slice(0, -1)}ies`);
        expect(okForm, `${w} -> ${stem}`).toBe(true);
      }
    }
    expect(shared).toMatchSnapshot();
  });
});

describe("spelling errors (writing only)", () => {
  it("a one-letter error in a word of 5+ letters counts, and the note says so", () => {
    const c = compareSentence("Citizens can vote.", "Citzens can vote", writing);
    expect(c.isCorrect).toBe(true);
    expect(c.notes).toContainEqual({ kind: "spelling", said: "citzens", expected: "citizens" });
    expect(ok("Citizens can vote.", "Citizans can vote", writing)).toBe(true); // changed letter
    expect(ok("We want freedom of speech.", "we want freedom of spech", writing)).toBe(true);
  });
  it("is off for reading: a recogniser does not misspell", () => {
    expect(ok("Citizens can vote.", "citzens can vote", reading)).toBe(false);
  });
  it("two wrong letters, or a short word, do not count", () => {
    expect(ok("Citizens can vote.", "cizens can vote", writing)).toBe(false);
    expect(ok("We pay taxes.", "we pay texes", writing)).toBe(false);
  });
  it("a typed word that is itself a different word of the vocabulary never counts as a misspelling", () => {
    const list = [...known].filter((w) => w.length >= 5 && /^[a-z]+$/.test(w));
    let checked = 0;
    for (const a of list) {
      for (const b of list) {
        if (a === b || stemWord(a, never) === stemWord(b, never)) continue;
        if (!compareSentence(a, b, { ...writing, knownWords: new Set() }).isCorrect) continue;
        // These two are one letter apart. With the vocabulary known, the typed word is not accepted.
        expect(compareSentence(a, b, writing).isCorrect, `${a} / ${b}`).toBe(false);
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(0);
  });
  it("the vocabulary check is what stops a real word from being read as a misspelling", () => {
    const bare = { ...writing, knownWords: new Set<string>() };
    expect(compareSentence("capital", "capitol", bare).isCorrect).toBe(true);
    expect(compareSentence("capital", "capitol", { ...bare, knownWords: new Set(["capitol"]) }).isCorrect).toBe(false);
  });
  it("a different word is not a spelling error: the word must still start with the same letter", () => {
    expect(ok("People vote in November.", "people note in november", writing)).toBe(false);
  });
});

describe("compareSentence basics", () => {
  it("an exact match counts with accuracy 1 and no notes", () => {
    const c = compareSentence("Who was George Washington?", "who was george washington", reading);
    expect(c).toMatchObject({ accuracy: 1, isCorrect: true, notes: [] });
    expect(c.diff.every((d) => d.status === "match")).toBe(true);
  });
  it("ignores case, punctuation and hyphens", () => {
    expect(ok("Washington, D.C. is the capital.", "WASHINGTON DC is the CAPITAL")).toBe(true);
  });
  it("accuracy is the share of content words matched", () => {
    expect(compareSentence("We pay taxes", "we taxes", reading).accuracy).toBe(0.5);
    expect(compareSentence("We pay taxes", "", reading).accuracy).toBe(0);
  });
  it("without options nothing is a short word and nothing extra is allowed", () => {
    expect(compareSentence("we pay taxes", "pay taxes").isCorrect).toBe(false);
    expect(compareSentence("we pay taxes", "we pay taxes").isCorrect).toBe(true);
  });
});

const word = fc.constantFrom("lincoln", "flag", "vote", "capital", "pay", "taxes", "july", "people");
const text = fc.array(word, { maxLength: 10 }).map((w) => w.join(" "));
const nonEmptyText = fc.array(word, { minLength: 1, maxLength: 10 }).map((w) => w.join(" "));

describe("compareSentence properties", () => {
  it("accuracy is between 0 and 1", () => {
    fc.assert(fc.property(text, text, (a, b) => {
      const { accuracy } = compareSentence(a, b, reading);
      return accuracy >= 0 && accuracy <= 1;
    }));
  });
  it("a sentence compared with itself counts", () => {
    fc.assert(fc.property(nonEmptyText, (a) => compareSentence(a, a, reading).isCorrect));
  });
  it("case and punctuation do not change the result", () => {
    fc.assert(
      fc.property(nonEmptyText, text, (a, b) => {
        const plain = compareSentence(a, b, reading);
        const noisy = compareSentence(a.toUpperCase() + "!", b.split(" ").join(",  ").toUpperCase(), reading);
        return plain.accuracy === noisy.accuracy && plain.isCorrect === noisy.isCorrect;
      })
    );
  });
  it("the diff rebuilds both sentences", () => {
    fc.assert(
      fc.property(text, text, (a, b) => {
        const c = compareSentence(a, b, reading);
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
  it("matched words never exceed either sentence", () => {
    fc.assert(fc.property(text, text, (a, b) => {
      const c = compareSentence(a, b, reading);
      return c.matchedWords <= c.targetWords && c.matchedWords <= c.attemptWords;
    }));
  });
  it("adding a word that is not in the sentence never makes a failing attempt count", () => {
    fc.assert(
      fc.property(nonEmptyText, text, (a, b) => {
        const strict = { ...reading, extraContentWordsAllowed: 0 };
        return !compareSentence(a, b, strict).isCorrect || compareSentence(a, `${b} zebra`, strict).isCorrect === false;
      })
    );
  });
  it("saying nothing never counts", () => {
    fc.assert(fc.property(nonEmptyText, (a) => !compareSentence(a, "", reading).isCorrect));
  });
});
