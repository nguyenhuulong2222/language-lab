/**
 * The matcher rules from the second review, pinned on the real answer keys:
 * A (parenthesis markers), B1 (alternative names count once), B2 (years and dates),
 * B3 (optional "because"), B4 (bare number only where marked).
 */
import { describe, it, expect, vi } from "vitest";
import { countMatchingPhrases } from "../answer-normaliser.js";
import { loadAnswerKey, parseAnswerKey, type CivicsAnswerEntry } from "../civics-answer-key.js";

function load(version: "2008" | "2025"): Map<string, CivicsAnswerEntry> {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return loadAnswerKey(version, { production: false });
  } finally {
    warn.mockRestore();
  }
}

const KEYS = { "2008": load("2008"), "2025": load("2025") } as const;

function entryOf(id: string): CivicsAnswerEntry {
  const entry = KEYS[id.slice(0, 4) as "2008" | "2025"].get(id);
  if (!entry) throw new Error(`no entry ${id}`);
  return entry;
}

function count(id: string, response: string): number {
  const entry = entryOf(id);
  return countMatchingPhrases(response, entry.acceptedAnswers, {
    groups: entry.answerGroups ?? [],
    numberAlone: entry.numberAlone ?? [],
  });
}

const correct = (id: string, response: string): boolean =>
  count(id, response) >= entryOf(id).requiredAnswerCount;

// ---------------------------------------------------------------------------
// A. Parenthesis markers
// ---------------------------------------------------------------------------

describe("A: markers", () => {
  it("2025-067: help / do important work for replace Serve; (U.S.) and (if needed) stay optional", () => {
    expect(correct("2025-067", "Help the nation and defend the U.S. Constitution")).toBe(true);
    expect(correct("2025-067", "Do important work for the nation and obey the laws of the United States")).toBe(true);
    expect(correct("2025-067", "Serve the nation if needed and be loyal to the United States")).toBe(true);
    expect(correct("2025-067", "Defend the Constitution and obey the laws of the United States")).toBe(true);
  });

  it("2025-077: Tea Act, Coercive Acts and quartering are accepted; boarding alone is not", () => {
    expect(correct("2025-077", "The Tea Act")).toBe(true);
    expect(correct("2025-077", "Coercive Acts")).toBe(true);
    expect(correct("2025-077", "Quartering")).toBe(true);
    expect(correct("2025-077", "British soldiers stayed in Americans’ houses")).toBe(true);
    expect(correct("2025-077", "Boarding")).toBe(false);
    expect(correct("2025-077", "boarding of soldiers")).toBe(false);
  });

  it("2025-118: cars, internal combustion engine, and IC as a whole word only", () => {
    expect(correct("2025-118", "Cars")).toBe(true);
    expect(correct("2025-118", "The internal combustion engine")).toBe(true);
    expect(correct("2025-118", "The IC")).toBe(true);
    expect(correct("2025-118", "Integrated circuit")).toBe(true);
    expect(correct("2025-118", "Classic")).toBe(false);
    expect(correct("2025-118", "The police")).toBe(false);
    expect(correct("2025-118", "ICs")).toBe(false);
  });

  it("2008-061: taxation without representation and quartering are accepted; boarding alone is not", () => {
    expect(correct("2008-061", "Taxation without representation")).toBe(true);
    expect(correct("2008-061", "Because of taxation without representation")).toBe(true);
    expect(correct("2008-061", "Quartering")).toBe(true);
    expect(correct("2008-061", "Boarding")).toBe(false);
  });

  it("2025-101 and 2025-106 are unchanged by this round", () => {
    for (const id of ["2025-101", "2025-106"]) {
      const entry = entryOf(id);
      expect(entry.answerGroups ?? []).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// B1. Alternative names of one marker are ONE answer
// ---------------------------------------------------------------------------

describe("B1: alternative names count once", () => {
  it("2025-048: Secretary of War and Secretary of Defense is one answer", () => {
    expect(count("2025-048", "Secretary of War and Secretary of Defense")).toBe(1);
    expect(correct("2025-048", "Secretary of War and Secretary of Defense")).toBe(false);
    expect(correct("2025-048", "Secretary of War and Attorney General")).toBe(true);
  });

  it("every group in both keys counts once when the response names all its members", () => {
    let groups = 0;
    for (const key of Object.values(KEYS)) {
      for (const entry of key.values()) {
        for (const group of entry.answerGroups ?? []) {
          groups += 1;
          const response = group.join(" and ");
          const found = countMatchingPhrases(response, entry.acceptedAnswers, {
            groups: entry.answerGroups ?? [],
          });
          expect(found, `${entry.id}: ${response}`).toBe(1);
        }
      }
    }
    expect(groups).toBe(9);
  });

  it("2025-067: two names of the Serve group do not satisfy 'Name two'", () => {
    expect(correct("2025-067", "Serve the nation and help the nation")).toBe(false);
    expect(correct("2025-067", "Serve the nation and be loyal to the United States")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B2. Years and dates
// ---------------------------------------------------------------------------

describe("B2: spoken years and dates on the real answers", () => {
  it("2008-063 and 2025-079: the Declaration date", () => {
    for (const id of ["2008-063", "2025-079"]) {
      expect(correct(id, "July 4, 1776")).toBe(true);
      expect(correct(id, "July fourth, seventeen seventy-six")).toBe(true);
      expect(correct(id, "The fourth of July seventeen seventy six")).toBe(true);
      expect(correct(id, "July 4th 1776")).toBe(true);
      expect(correct(id, "seventeen seventy six")).toBe(false);
      expect(correct(id, "July fourth, seventeen seventy-five")).toBe(false);
    }
  });

  it("2008-066: the Constitution was written in 1787", () => {
    expect(correct("2008-066", "Seventeen eighty-seven")).toBe(true);
    expect(correct("2008-066", "In 1787")).toBe(true);
    expect(correct("2008-066", "Seventeen eighty-six")).toBe(false);
  });

  it("War of 1812 in 2008-072, 2025-088 and 2025-091", () => {
    expect(correct("2008-072", "The War of eighteen twelve")).toBe(true);
    expect(correct("2025-091", "War of eighteen twelve")).toBe(true);
    expect(correct("2025-088", "He was president during the war of eighteen twelve")).toBe(true);
    expect(correct("2025-091", "War of eighteen thirteen")).toBe(false);
  });

  it("2025-098, 2025-102, 2025-104 and 2025-107", () => {
    expect(correct("2025-098", "Eighteen seventy")).toBe(true);
    expect(correct("2025-102", "Nineteen twenty")).toBe(true);
    expect(correct("2025-102", "Nineteen twenty one")).toBe(false);
    expect(correct("2025-104", "The great crash, nineteen twenty-nine")).toBe(true);
    expect(correct("2025-104", "Stock market crash of nineteen twenty nine")).toBe(true);
    expect(correct("2025-107", "He signed the Federal Aid Highway Act of nineteen fifty-six")).toBe(true);
    expect(correct("2025-107", "He signed the Federal Aid Highway Act of nineteen fifty-five")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B3. Optional "because"
// ---------------------------------------------------------------------------

describe("B3: leading because / because of is optional", () => {
  it("2008-096, 2008-097 and 2025-121", () => {
    expect(correct("2008-096", "There were thirteen original colonies")).toBe(true);
    expect(correct("2008-096", "Because there were 13 original colonies")).toBe(true);
    expect(correct("2008-097", "There is one star for each state")).toBe(true);
    expect(correct("2025-121", "Represent the original colonies")).toBe(true);
  });

  it("2008-061: high taxes without 'because of'", () => {
    expect(correct("2008-061", "High taxes")).toBe(true);
  });

  it("a different reason is still wrong", () => {
    expect(correct("2008-097", "Because there is one star for each flag")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// B4. Bare number only where marked
// ---------------------------------------------------------------------------

describe("B4: bare number", () => {
  it("is accepted where the number answers the question", () => {
    expect(correct("2025-097", "The 14th")).toBe(true);
    expect(correct("2025-097", "Fourteenth")).toBe(true);
    expect(correct("2025-097", "Fourteen")).toBe(true);
    expect(correct("2008-054", "Eighteen")).toBe(true);
    expect(correct("2008-054", "18")).toBe(true);
    expect(correct("2008-057", "Eighteen")).toBe(true);
    expect(correct("2025-104", "1929")).toBe(true);
    expect(correct("2025-104", "Nineteen twenty nine")).toBe(true);
  });

  it("is not accepted for a different number", () => {
    expect(correct("2025-097", "Fifteen")).toBe(false);
    expect(correct("2008-054", "Twenty one")).toBe(false);
    expect(correct("2025-104", "1930")).toBe(false);
  });

  it("is not accepted for 'Why' questions or where the number is part of an explanation", () => {
    for (const [id, response] of [
      ["2008-096", "13"],
      ["2008-096", "thirteen"],
      ["2008-097", "50"],
      ["2025-121", "13"],
      ["2025-122", "50"],
      ["2025-037", "22"],
      ["2025-037", "twenty second"],
      ["2025-071", "1"],
    ] as const) {
      expect(correct(id, response), `${id}: ${response}`).toBe(false);
    }
  });

  it("is not accepted where the number is not a full answer or the question asks for a date", () => {
    for (const [id, response] of [
      ["2025-102", "nineteenth"],
      ["2025-098", "fifteenth"],
      ["2008-063", "1776"],
      ["2025-079", "seventeen seventy six"],
      ["2008-056", "15"],
      ["2008-099", "4"],
      ["2008-072", "1812"],
      ["2025-091", "eighteen twelve"],
      ["2025-063", "18"],
      ["2008-048", "eighteen"],
      ["2025-068", "14th"],
    ] as const) {
      expect(correct(id, response), `${id}: ${response}`).toBe(false);
    }
  });

  it("marks exactly the lines in the owner's list", () => {
    const marked: string[] = [];
    for (const key of Object.values(KEYS)) {
      for (const entry of key.values()) if ((entry.numberAlone ?? []).length > 0) marked.push(entry.id);
    }
    expect(marked.sort()).toEqual(["2008-054", "2008-057", "2025-097", "2025-104"]);
  });
});

// ---------------------------------------------------------------------------
// Loader validation of answerGroups and numberAlone
// ---------------------------------------------------------------------------

describe("loader: answerGroups and numberAlone", () => {
  const base = {
    id: "2025-001",
    testVersion: "2025",
    questionText: "Q?",
    acceptedAnswers: ["a b", "c d", "e f"],
    requiredAnswerCount: 1,
    answerType: "static",
    sourceUrl: "https://www.uscis.gov/x",
    sourceDocument: "doc",
  };
  const parse = (extra: Record<string, unknown>) =>
    parseAnswerKey({ needsHumanReview: false, entries: [{ ...base, ...extra }] }, "2025");

  it("defaults both to empty", () => {
    const entry = parse({}).get("2025-001")!;
    expect(entry.answerGroups).toEqual([]);
    expect(entry.numberAlone).toEqual([]);
  });
  it("accepts valid values", () => {
    const entry = parse({ answerGroups: [["a b", "c d"]], numberAlone: ["e f"] }).get("2025-001")!;
    expect(entry.answerGroups).toEqual([["a b", "c d"]]);
    expect(entry.numberAlone).toEqual(["e f"]);
  });
  it("rejects a group member that is not an accepted answer", () => {
    expect(() => parse({ answerGroups: [["a b", "zzz"]] })).toThrow(/not one of acceptedAnswers/);
  });
  it("rejects a member in two groups and a group of one", () => {
    expect(() => parse({ answerGroups: [["a b", "c d"], ["c d", "e f"]] })).toThrow(/more than one group/);
    expect(() => parse({ answerGroups: [["a b"]] })).toThrow(/at least two/);
  });
  it("rejects a numberAlone member that is not an accepted answer, and wrong shapes", () => {
    expect(() => parse({ numberAlone: ["zzz"] })).toThrow(/not one of acceptedAnswers/);
    expect(() => parse({ answerGroups: "a b" })).toThrow(/array of arrays/);
  });
});
