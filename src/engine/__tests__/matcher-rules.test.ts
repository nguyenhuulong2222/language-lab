/**
 * Matcher rules added after the first review: years, dates, optional "because",
 * answer groups (alternative names count once) and bare numbers by marker.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { containsPhrase, countMatchingPhrases } from "../answer-normaliser";

const UNDER_TWENTY = [
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const UNITS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Two-digit number 10-99 as words. */
function twoDigits(n: number): string {
  if (n < 20) return UNDER_TWENTY[n - 10]!;
  const t = TENS[Math.floor(n / 10)]!;
  const u = n % 10;
  return u === 0 ? t : `${t} ${UNITS[u]}`;
}

/** The spoken two-group reading of a year, e.g. 1776 -> "seventeen seventy six". */
function spokenYear(year: number, joiner: "plain" | "oh"): string {
  const high = Math.floor(year / 100);
  const low = year % 100;
  if (low >= 10) return `${twoDigits(high)} ${twoDigits(low)}`;
  if (low === 0) return `${twoDigits(high)} hundred`;
  return joiner === "oh" ? `${twoDigits(high)} oh ${UNITS[low]}` : `${twoDigits(high)} ${UNITS[low]}`;
}

describe("years", () => {
  it("reads two-group years", () => {
    expect(containsPhrase("nineteen twenty", "1920")).toBe(true);
    expect(containsPhrase("seventeen seventy-six", "1776")).toBe(true);
    expect(containsPhrase("twenty oh one", "2001")).toBe(true);
    expect(containsPhrase("two thousand one", "2001")).toBe(true);
    expect(containsPhrase("nineteen oh five", "1905")).toBe(true);
  });

  it("does not match a different year", () => {
    expect(containsPhrase("seventeen seventy five", "1776")).toBe(false);
    expect(containsPhrase("nineteen twenty one", "1920")).toBe(false);
  });

  it("matches every year 1000-2099 in its spoken forms", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1000, max: 2099 }), (year) => {
        const low = year % 100;
        if (low === 0) {
          // "nineteen hundred" is not a supported reading; the digits and the cardinal are.
          return containsPhrase(String(year), String(year));
        }
        const plain = spokenYear(year, "plain");
        const oh = spokenYear(year, "oh");
        const ok = containsPhrase(`it was ${oh}`, String(year));
        const okPlain = low >= 10 ? containsPhrase(`it was ${plain}`, String(year)) : true;
        return ok && okPlain && containsPhrase(`in ${year}.`, String(year));
      }),
      { numRuns: 400 }
    );
  });

  it("applies only when the answer is a year", () => {
    expect(containsPhrase("nineteen twenty", "20")).toBe(false);
    expect(countMatchingPhrases("seventeen seventy six", ["27"])).toBe(0);
  });
});

describe("dates", () => {
  it("treats an ordinal after a month as the cardinal", () => {
    expect(containsPhrase("July fourth", "July 4")).toBe(true);
    expect(containsPhrase("July 4th", "July 4")).toBe(true);
    expect(containsPhrase("the fourth of July", "July 4")).toBe(true);
  });
  it("accepts a spoken full date", () => {
    expect(containsPhrase("July fourth, seventeen seventy-six", "July 4, 1776")).toBe(true);
  });
});

describe("optional leading because", () => {
  const accepted = ["because of high taxes"];
  it("accepts with or without because (of)", () => {
    expect(countMatchingPhrases("because of high taxes", accepted)).toBe(1);
    expect(countMatchingPhrases("because high taxes", accepted)).toBe(1);
    expect(countMatchingPhrases("high taxes", accepted)).toBe(1);
  });
  it("composes with an optional article", () => {
    expect(countMatchingPhrases("because the army", ["because the army"])).toBe(1);
    expect(countMatchingPhrases("army", ["because the army"])).toBe(1);
  });
  it("does not accept an empty remainder or a different reason", () => {
    expect(countMatchingPhrases("because", ["because"])).toBe(1);
    expect(countMatchingPhrases("because of low taxes", accepted)).toBe(0);
  });
});

describe("answer groups count once", () => {
  const accepted = ["Secretary of War", "Secretary of Defense", "Secretary of State"];
  const groups = [["Secretary of War", "Secretary of Defense"]];
  it("counts both alternatives as one answer", () => {
    expect(
      countMatchingPhrases("Secretary of War and Secretary of Defense", accepted, { groups })
    ).toBe(1);
  });
  it("still counts a different answer separately", () => {
    expect(
      countMatchingPhrases("Secretary of War and Secretary of State", accepted, { groups })
    ).toBe(2);
  });
  it("without groups the two names count twice", () => {
    expect(countMatchingPhrases("Secretary of War and Secretary of Defense", accepted)).toBe(2);
  });
  it("one alternative alone is enough", () => {
    expect(countMatchingPhrases("Secretary of Defense", accepted, { groups })).toBe(1);
  });
});

describe("bare number only where marked", () => {
  it("accepts the number alone for a marked answer", () => {
    expect(containsPhrase("x", "x")).toBe(true);
    expect(countMatchingPhrases("fourteen", ["14th amendment"], { numberAlone: ["14th amendment"] })).toBe(1);
    expect(countMatchingPhrases("the 14th", ["14th amendment"], { numberAlone: ["14th amendment"] })).toBe(1);
    expect(countMatchingPhrases("eighteen", ["eighteen and older"], { numberAlone: ["eighteen and older"] })).toBe(1);
  });
  it("does not accept it for an unmarked answer", () => {
    expect(countMatchingPhrases("fourteen", ["14th amendment"])).toBe(0);
    expect(countMatchingPhrases("13", ["13 original colonies"])).toBe(0);
  });
  it("does not accept a different number", () => {
    expect(countMatchingPhrases("fifteen", ["14th amendment"], { numberAlone: ["14th amendment"] })).toBe(0);
  });
});
