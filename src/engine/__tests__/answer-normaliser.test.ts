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
  isNumberToken,
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
    // Plain words only: number words next to a number answer are covered separately.
    const plain = word.filter((w) => !isNumberToken(w));
    fc.assert(
      fc.property(plain, plain, plain, (before, core, after) => {
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
    /**
     * Oracle: try every combination of span choices, no pruning. The alphabet includes the
     * article "a", so a leading "a" is optional here too. It has no number words.
     */
    const exhaustive = (text: string, answers: string[]): number => {
      const hay = tokenise(text);
      const phrases = [...new Set(answers.map(normalise))]
        .filter((p) => p.length > 0)
        .map((p) => p.split(" "));
      const used = new Array<boolean>(hay.length).fill(false);

      const formsOf = (phrase: string[]): string[][] =>
        phrase.length > 1 && ["the", "a", "an"].includes(phrase[0]!)
          ? [phrase, phrase.slice(1)]
          : [phrase];

      const go = (i: number): number => {
        if (i === phrases.length) return 0;
        let best = go(i + 1);
        for (const form of formsOf(phrases[i]!)) {
          for (let s = 0; s + form.length <= hay.length; s++) {
            const fits = form.every((tok, k) => hay[s + k] === tok && !used[s + k]);
            if (!fits) continue;
            for (let k = 0; k < form.length; k++) used[s + k] = true;
            best = Math.max(best, 1 + go(i + 1));
            for (let k = 0; k < form.length; k++) used[s + k] = false;
          }
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

// ---------------------------------------------------------------------------
// Optional leading article ("the", "a", "an")
// ---------------------------------------------------------------------------

describe("optional leading article in an accepted answer", () => {
  it("matches with the article", () => {
    expect(containsPhrase("it is the constitution", "the constitution")).toBe(true);
  });

  it("matches without the article", () => {
    expect(containsPhrase("constitution", "the constitution")).toBe(true);
    expect(containsPhrase("I think the answer is constitution", "the constitution")).toBe(true);
  });

  it("works for 'a' and 'an' as well", () => {
    expect(containsPhrase("change", "a change")).toBe(true);
    expect(containsPhrase("a change", "a change")).toBe(true);
    expect(containsPhrase("addition", "an addition")).toBe(true);
    expect(containsPhrase("an addition to it", "an addition")).toBe(true);
  });

  it("still needs the rest of the answer", () => {
    expect(containsPhrase("the", "the constitution")).toBe(false);
    expect(containsPhrase("the flag", "the constitution")).toBe(false);
    expect(containsPhrase("a holiday", "a change")).toBe(false);
  });

  it("is not optional in the middle of an answer", () => {
    expect(containsPhrase("bill rights", "bill of the rights")).toBe(false);
    expect(containsPhrase("secretary state", "secretary of the state")).toBe(false);
  });

  it("is not optional when it is the whole answer", () => {
    expect(containsPhrase("cat", "the")).toBe(false);
    expect(containsPhrase("the cat", "the")).toBe(true);
  });

  it("still matches whole words only", () => {
    expect(containsPhrase("constitutional", "the constitution")).toBe(false);
    expect(containsPhrase("unconstitution", "the constitution")).toBe(false);
  });

  it("works for a multi-word answer", () => {
    expect(containsPhrase("bill of rights", "the bill of rights")).toBe(true);
    expect(containsPhrase("it is the bill of rights", "the bill of rights")).toBe(true);
  });

  it("an accepted answer written without an article also matches a response that adds one", () => {
    expect(containsPhrase("the constitution", "constitution")).toBe(true);
  });

  it("does not count one span twice when both forms are accepted", () => {
    expect(countMatchingPhrases("president", ["the president", "president"])).toBe(1);
    expect(countMatchingPhrases("the president", ["the president", "president"])).toBe(1);
  });

  it("counts different answers that each use an optional article", () => {
    expect(countMatchingPhrases("army and navy", ["the army", "the navy"])).toBe(2);
    expect(countMatchingPhrases("the army", ["the army", "the navy"])).toBe(1);
  });
});

describe("optional leading article properties", () => {
  const plainWord = word.filter((w) => !isNumberToken(w) && !["the", "a", "an"].includes(w));
  const article = fc.constantFrom("the", "a", "an");

  it("property: an answer with a leading article matches with or without the article in the response", () => {
    fc.assert(
      fc.property(article, plainWord, plainWord, (art, core, extra) => {
        const answer = `${art} ${core}`;
        return (
          containsPhrase(`${art} ${core}`, answer) &&
          containsPhrase(core, answer) &&
          containsPhrase(`${extra} ${core} ${extra}`, answer)
        );
      }),
      { numRuns: 300 }
    );
  });

  it("property: the article alone never satisfies an answer", () => {
    fc.assert(
      fc.property(article, plainWord, (art, core) => !containsPhrase(art, `${art} ${core}`)),
      { numRuns: 300 }
    );
  });

  it("property: an optional article never raises the count above the distinct answers", () => {
    fc.assert(
      fc.property(article, plainWord, plainWord, (art, a, b) => {
        const answers = [`${art} ${a}`, a, `${art} ${b}`, b];
        const count = countMatchingPhrases(`${a} ${art} ${b}`, answers);
        return count <= new Set(answers.map(normalise)).size && count <= 2;
      }),
      { numRuns: 300 }
    );
  });
});

// ---------------------------------------------------------------------------
// Numbers must stand alone
// ---------------------------------------------------------------------------

describe("isNumberToken", () => {
  it("recognises number words and numerals", () => {
    for (const token of ["one", "six", "twenty", "ninety", "hundred", "thousand", "27", "100", "1787"]) {
      expect(isNumberToken(token), token).toBe(true);
    }
  });

  it("rejects other words", () => {
    for (const token of ["senators", "and", "first", "27th", "sixty-six", "", "ones"]) {
      expect(isNumberToken(token), token).toBe(false);
    }
  });
});

describe("numbers that continue do not match", () => {
  it("rejects 'one hundred and one' and 'one hundred one' for 'one hundred'", () => {
    expect(containsPhrase("one hundred and one", "one hundred")).toBe(false);
    expect(containsPhrase("one hundred one", "one hundred")).toBe(false);
    expect(containsPhrase("There are one hundred and one senators", "one hundred")).toBe(false);
  });

  it("rejects a numeral or number word after the answer, with or without 'and'", () => {
    expect(containsPhrase("one hundred 1", "one hundred")).toBe(false);
    expect(containsPhrase("one hundred and 1", "one hundred")).toBe(false);
    expect(containsPhrase("one hundred twenty", "one hundred")).toBe(false);
    expect(containsPhrase("100 and 1", "100")).toBe(false);
    expect(containsPhrase("100 1", "100")).toBe(false);
  });

  it("rejects a number that began earlier in the response", () => {
    expect(containsPhrase("twenty two", "two")).toBe(false);
    expect(containsPhrase("twenty two years", "two years")).toBe(false);
    expect(containsPhrase("twenty six", "six")).toBe(false);
    expect(containsPhrase("one hundred and twenty seven", "twenty seven")).toBe(false);
  });

  it("still matches a number on its own or among ordinary words", () => {
    expect(containsPhrase("one hundred", "one hundred")).toBe(true);
    expect(containsPhrase("there are one hundred senators", "one hundred")).toBe(true);
    expect(containsPhrase("one hundred, I think", "one hundred")).toBe(true);
    expect(containsPhrase("twenty seven amendments", "twenty seven")).toBe(true);
    expect(containsPhrase("it is 27", "27")).toBe(true);
    expect(containsPhrase("six years", "six years")).toBe(true);
    expect(containsPhrase("I think two years", "two years")).toBe(true);
  });

  it("still matches when 'and' is followed by something that is not a number", () => {
    expect(containsPhrase("one hundred and the senate", "one hundred")).toBe(true);
    expect(containsPhrase("six and seven", "six")).toBe(false);
    expect(containsPhrase("six and liberty", "six")).toBe(true);
  });

  it("still matches when the next number is far away", () => {
    expect(containsPhrase("one hundred senators and two houses", "one hundred")).toBe(true);
  });

  it("stays a whole-word match for numerals", () => {
    expect(containsPhrase("127", "27")).toBe(false);
    expect(containsPhrase("270", "27")).toBe(false);
  });

  it("applies when counting answers", () => {
    expect(countMatchingPhrases("one hundred and one", ["one hundred", "100"])).toBe(0);
    expect(countMatchingPhrases("one hundred", ["one hundred", "100"])).toBe(1);
    expect(countMatchingPhrases("twenty seven", ["twenty seven", "27"])).toBe(1);
  });

  it("does not affect answers that do not start or end with a number", () => {
    expect(containsPhrase("the 22nd amendment and 12 more", "the 22nd amendment")).toBe(true);
    expect(containsPhrase("1 constitution 2", "constitution")).toBe(true);
  });
});

describe("number continuation properties", () => {
  const numberAnswers = [
    "one hundred", "twenty seven", "six", "two years", "six years", "four hundred thirty five",
    "nine", "100", "27", "435",
  ];
  const continuations = ["one", "two", "seven", "twenty", "hundred", "thousand", "1", "27", "100"];
  const nonNumberWords = ["senators", "years", "amendments", "please", "liberty", "the", "of", "okay"];
  const pick = <T>(items: readonly T[]) => fc.constantFrom(...items);

  it("property: a number answer never matches when the response continues the number", () => {
    fc.assert(
      fc.property(pick(numberAnswers), pick(continuations), fc.boolean(), (answer, next, withAnd) => {
        const tokens = [answer, ...(withAnd ? ["and"] : []), next];
        const response = tokens.join(" ");
        // The answer must only be rejected when it ends in a number; "two years" ends in a word.
        const endsInNumber = isNumberToken(answer.split(" ").at(-1)!);
        return endsInNumber ? !containsPhrase(response, answer) : containsPhrase(response, answer);
      }),
      { numRuns: 500 }
    );
  });

  it("property: a number answer never matches when the response has an earlier number part", () => {
    fc.assert(
      fc.property(pick(numberAnswers), pick(continuations), fc.boolean(), (answer, before, withAnd) => {
        const response = [before, ...(withAnd ? ["and"] : []), answer].join(" ");
        const startsWithNumber = isNumberToken(answer.split(" ")[0]!);
        return startsWithNumber ? !containsPhrase(response, answer) : containsPhrase(response, answer);
      }),
      { numRuns: 500 }
    );
  });

  it("property: a number answer still matches when ordinary words surround it", () => {
    fc.assert(
      fc.property(
        pick(numberAnswers),
        fc.array(pick(nonNumberWords), { maxLength: 3 }),
        fc.array(pick(nonNumberWords), { maxLength: 3 }),
        (answer, before, after) => containsPhrase([...before, answer, ...after].join(" "), answer)
      ),
      { numRuns: 500 }
    );
  });

  it("property: a continued number never adds to the count", () => {
    fc.assert(
      fc.property(pick(numberAnswers), pick(continuations), (answer, next) => {
        const endsInNumber = isNumberToken(answer.split(" ").at(-1)!);
        const count = countMatchingPhrases(`${answer} ${next}`, [answer]);
        return endsInNumber ? count === 0 : count === 1;
      }),
      { numRuns: 300 }
    );
  });
});
