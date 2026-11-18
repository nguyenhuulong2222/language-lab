/**
 * Tests for src/engine/answer-normaliser.ts
 *
 * Unit tests cover the documented rules (O3 normalisation, whole-word matching,
 * non-overlapping counting from O2). Property tests are named "property: ..." and include
 * an exhaustive-search oracle for countMatchingPhrases.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  normalise,
  tokenise,
  containsPhrase,
  countMatchingPhrases,
} from "../answer-normaliser.js";

// ---------------------------------------------------------------------------
// normalise
// ---------------------------------------------------------------------------

describe("normalise", () => {
  it("lowercases", () => {
    expect(normalise("The CONSTITUTION")).toBe("the constitution");
  });

  it("strips terminal and inner punctuation", () => {
    expect(normalise("The Constitution.")).toBe("the constitution");
    expect(normalise("Yes, I do!")).toBe("yes i do");
  });

  it("keeps internal apostrophes", () => {
    expect(normalise("I don't know")).toBe("i don't know");
  });

  it("maps curly apostrophes to straight ones", () => {
    expect(normalise("New Year’s Day")).toBe("new year's day");
    expect(normalise("New Year's Day")).toBe(normalise("New Year’s Day"));
    expect(normalise("Presidents’ Day")).toBe("presidents day");
  });

  it("treats hyphens and dashes as spaces", () => {
    expect(normalise("twenty-seven")).toBe("twenty seven");
    expect(normalise("Twenty–Seven")).toBe("twenty seven");
    expect(normalise("Twenty—Seven")).toBe("twenty seven");
  });

  it("trims apostrophes and quotes from the ends of words", () => {
    expect(normalise("'the constitution'")).toBe("the constitution");
    expect(normalise("“the constitution”")).toBe("the constitution");
  });

  it("keeps digits", () => {
    expect(normalise("27 amendments")).toBe("27 amendments");
  });

  it("removes dots inside abbreviations", () => {
    expect(normalise("Washington, D.C.")).toBe("washington dc");
  });

  it("collapses spaces, tabs and newlines", () => {
    expect(normalise("the   United\n\tStates")).toBe("the united states");
  });

  it("returns empty for empty, whitespace-only and punctuation-only input", () => {
    expect(normalise("")).toBe("");
    expect(normalise("   ")).toBe("");
    expect(normalise("?!.")).toBe("");
    expect(normalise("'' ''")).toBe("");
  });
});

describe("tokenise", () => {
  it("splits normalised text", () => {
    expect(tokenise("The United States")).toEqual(["the", "united", "states"]);
  });

  it("returns [] for empty input", () => {
    expect(tokenise("")).toEqual([]);
    expect(tokenise("   ")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// containsPhrase
// ---------------------------------------------------------------------------

describe("containsPhrase", () => {
  it("matches an exact answer", () => {
    expect(containsPhrase("the constitution", "the constitution")).toBe(true);
  });

  it("matches when the response has extra words", () => {
    expect(containsPhrase("I think it is the Constitution", "the constitution")).toBe(true);
    expect(containsPhrase("Um, the Constitution, I believe.", "the constitution")).toBe(true);
  });

  it("matches at the start and at the end", () => {
    expect(containsPhrase("the constitution of the land", "the constitution")).toBe(true);
    expect(containsPhrase("it is the constitution", "the constitution")).toBe(true);
  });

  it("matches a multi-word phrase inside a longer response", () => {
    expect(containsPhrase("it is called the bill of rights", "bill of rights")).toBe(true);
  });

  it("does not match a word that is only part of a longer word", () => {
    expect(containsPhrase("the constitutional amendment", "constitution")).toBe(false);
    expect(containsPhrase("unrepresented", "represent")).toBe(false);
    expect(containsPhrase("presidential", "president")).toBe(false);
    expect(containsPhrase("unconstitution", "constitution")).toBe(false);
  });

  it("does not match a multi-word phrase when its words are out of order", () => {
    expect(containsPhrase("rights of bill", "bill of rights")).toBe(false);
  });

  it("does not match a multi-word phrase when its words are separated", () => {
    expect(containsPhrase("bill and of rights", "bill of rights")).toBe(false);
  });

  it("is false when the phrase is longer than the response", () => {
    expect(containsPhrase("bill", "bill of rights")).toBe(false);
  });

  it("treats an empty phrase as present", () => {
    expect(containsPhrase("anything", "")).toBe(true);
  });

  it("ignores case, punctuation and curly apostrophes", () => {
    expect(containsPhrase("It’s New Year’s Day!", "new year's day")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// countMatchingPhrases
// ---------------------------------------------------------------------------

describe("countMatchingPhrases", () => {
  it("returns 0 when nothing matches", () => {
    expect(countMatchingPhrases("hello world", ["life", "liberty"])).toBe(0);
  });

  it("returns 1 when one of two answers is present", () => {
    expect(countMatchingPhrases("life", ["life", "liberty"])).toBe(1);
  });

  it("returns 2 when two answers are present, in any order", () => {
    expect(countMatchingPhrases("life and liberty", ["life", "liberty"])).toBe(2);
    expect(countMatchingPhrases("liberty then life", ["life", "liberty"])).toBe(2);
  });

  it("counts a repeated answer once", () => {
    expect(countMatchingPhrases("life life life", ["life", "liberty"])).toBe(1);
  });

  it("counts a duplicated accepted answer once", () => {
    expect(countMatchingPhrases("life", ["life", "Life", "life."])).toBe(1);
  });

  it("does not double-count overlapping answers (O2)", () => {
    expect(countMatchingPhrases("freedom of speech", ["speech", "freedom of speech"])).toBe(1);
    expect(countMatchingPhrases("the constitution", ["the constitution", "constitution"])).toBe(1);
  });

  it("counts overlapping answers separately when each has its own words", () => {
    expect(
      countMatchingPhrases("speech and freedom of speech", ["speech", "freedom of speech"])
    ).toBe(2);
  });

  it("finds the best assignment, not just the first occurrence", () => {
    // "b" first occurs inside "a b", but can also use the final "b".
    expect(countMatchingPhrases("a b b", ["a b", "b"])).toBe(2);
  });

  it("counts 1 when two answers need the same words", () => {
    expect(countMatchingPhrases("a b c", ["a b", "b c"])).toBe(1);
  });

  it("ignores empty accepted answers", () => {
    expect(countMatchingPhrases("x", ["", "x", "  "])).toBe(1);
  });

  it("ignores answers that only match inside a longer word", () => {
    expect(countMatchingPhrases("constitutional", ["constitution"])).toBe(0);
  });

  it("returns 0 for an empty response", () => {
    expect(countMatchingPhrases("", ["life"])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

const word = fc.stringMatching(/^[a-z]{1,8}$/);

describe("normalise properties", () => {
  it("property: normalise is idempotent", () => {
    fc.assert(
      fc.property(fc.fullUnicodeString(), (text) => {
        const once = normalise(text);
        return normalise(once) === once;
      }),
      { numRuns: 300 }
    );
  });

  it("property: output only has a-z, 0-9, apostrophes and single spaces, with no edge spaces or edge apostrophes", () => {
    fc.assert(
      fc.property(fc.fullUnicodeString(), (text) => {
        const out = normalise(text);
        if (!/^[a-z0-9' ]*$/.test(out)) return false;
        if (out !== out.trim()) return false;
        if (out.includes("  ")) return false;
        return out.split(" ").every((w) => w === "" || !/^'|'$/.test(w));
      }),
      { numRuns: 300 }
    );
  });

  it("property: curly and straight apostrophes normalise the same way", () => {
    fc.assert(
      fc.property(word, word, (a, b) => {
        return normalise(`${a}\u2019${b}`) === normalise(`${a}'${b}`);
      })
    );
  });

  it("property: hyphens and spaces normalise the same way", () => {
    fc.assert(
      fc.property(word, word, (a, b) => normalise(`${a}-${b}`) === normalise(`${a} ${b}`))
    );
  });
});

describe("containsPhrase properties", () => {
  it("property: a word is never found inside a longer word", () => {
    fc.assert(
      fc.property(word, word, (w, s) => {
        return !containsPhrase(w + s, w) && !containsPhrase(s + w, w);
      }),
      { numRuns: 300 }
    );
  });

  it("property: a response always contains itself and the words around it do not hide it", () => {
    fc.assert(
      fc.property(word, word, word, (before, core, after) => {
        return (
          containsPhrase(core, core) &&
          containsPhrase(`${before} ${core} ${after}`, core)
        );
      })
    );
  });
});

describe("countMatchingPhrases properties", () => {
  const smallWord = fc.constantFrom("a", "b", "c", "d");
  const phrase = fc
    .array(smallWord, { minLength: 1, maxLength: 3 })
    .map((words) => words.join(" "));
  const response = fc
    .array(smallWord, { maxLength: 10 })
    .map((words) => words.join(" "));

  it("property: no accepted answers always gives 0", () => {
    fc.assert(fc.property(fc.string(), (text) => countMatchingPhrases(text, []) === 0));
  });

  it("property: count never exceeds the distinct accepted answers or the response words", () => {
    fc.assert(
      fc.property(response, fc.array(phrase, { maxLength: 6 }), (text, answers) => {
        const count = countMatchingPhrases(text, answers);
        const distinct = new Set(answers.map(normalise)).size;
        return count <= distinct && count <= tokenise(text).length;
      }),
      { numRuns: 300 }
    );
  });

  it("property: extra words around a response never lower the count", () => {
    fc.assert(
      fc.property(
        response,
        fc.array(phrase, { maxLength: 5 }),
        word,
        word,
        (text, answers, before, after) => {
          const base = countMatchingPhrases(text, answers);
          const padded = countMatchingPhrases(`${before} ${text} ${after}`, answers);
          return padded >= base;
        }
      ),
      { numRuns: 300 }
    );
  });

  it("property: matches an exhaustive search over every way to place the answers", () => {
    /** Oracle: try every combination of span choices, no pruning. */
    const exhaustive = (text: string, answers: string[]): number => {
      const hay = tokenise(text);
      const phrases = [...new Set(answers.map(normalise))]
        .filter((p) => p.length > 0)
        .map((p) => p.split(" "));
      const used = new Array<boolean>(hay.length).fill(false);

      const go = (i: number): number => {
        if (i === phrases.length) return 0;
        let best = go(i + 1);
        const p = phrases[i]!;
        for (let s = 0; s + p.length <= hay.length; s++) {
          const fits = p.every((tok, k) => hay[s + k] === tok && !used[s + k]);
          if (!fits) continue;
          for (let k = 0; k < p.length; k++) used[s + k] = true;
          best = Math.max(best, 1 + go(i + 1));
          for (let k = 0; k < p.length; k++) used[s + k] = false;
        }
        return best;
      };
      return go(0);
    };

    fc.assert(
      fc.property(response, fc.array(phrase, { maxLength: 5 }), (text, answers) => {
        return countMatchingPhrases(text, answers) === exhaustive(text, answers);
      }),
      { numRuns: 300 }
    );
  });

  it("property: scoring the same input twice gives the same count", () => {
    fc.assert(
      fc.property(response, fc.array(phrase, { maxLength: 5 }), (text, answers) => {
        return countMatchingPhrases(text, answers) === countMatchingPhrases(text, answers);
      })
    );
  });
});
