/**
 * The project owner's answer key review decisions of 2026-11-20 (tools/answer-key/answer-markers.json),
 * pinned on the real keys and scored through the grader's own count (matchedAnswerCount).
 * Each decision has the cases it allows and the wrong cases it must still refuse.
 */
import { describe, expect, it, vi } from "vitest";
import { loadAnswerKey, type CivicsAnswerEntry } from "../civics-answer-key.js";
import { matchedAnswerCount } from "../civics-grader.js";
import markersFile from "../../../tools/answer-key/answer-markers.json";

function load(version: "2008" | "2025"): Map<string, CivicsAnswerEntry> {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return loadAnswerKey(version, { production: false });
  } finally {
    warn.mockRestore();
  }
}
const KEYS = { "2008": load("2008"), "2025": load("2025") } as const;
const entry = (id: string): CivicsAnswerEntry => {
  const e = KEYS[id.slice(0, 4) as "2008" | "2025"].get(id);
  if (!e) throw new Error(`no entry ${id}`);
  return e;
};
const count = (id: string, response: string): number => matchedAnswerCount(entry(id), response);
const correct = (id: string, response: string): boolean => count(id, response) >= entry(id).requiredAnswerCount;

describe("the decisions are recorded with today's review date", () => {
  it("every new marker names the project owner and 2026-11-20", () => {
    const all = [
      ...markersFile.markers.filter((m) => ["2025-107", "2025-126", "2025-028"].includes(m.question)),
      ...markersFile.optionalWords,
      ...markersFile.anyOrder,
    ];
    expect(all.length).toBe(3 + 4 + 5);
    for (const m of all) expect(m.decision, m.question).toMatch(/^Project owner, 2026-11-20/);
  });
});

describe("1. 2025-107: 'at the end of (during)' is an alternative", () => {
  it("stores both readings as one answer and no longer the run-together phrase", () => {
    const e = entry("2025-107");
    expect(e.acceptedAnswers).toContain("president at the end of the korean war");
    expect(e.acceptedAnswers).toContain("president during the korean war");
    expect(e.acceptedAnswers).not.toContain("president at the end of during the korean war");
    expect(e.answerGroups).toContainEqual(["president at the end of the korean war", "president during the korean war"]);
  });
  it("accepts either reading, and the two together count once", () => {
    expect(correct("2025-107", "He was president during the Korean War.")).toBe(true);
    expect(correct("2025-107", "president at the end of the Korean War")).toBe(true);
    expect(count("2025-107", "president during the Korean War, president at the end of the Korean War")).toBe(1);
  });
  it("refuses a different war", () => {
    expect(correct("2025-107", "president during the Vietnam War")).toBe(false);
  });
});

describe("2. 2025-126: 'Washington's Birthday' is another name for Presidents Day", () => {
  it("accepts it and counts it once with Presidents Day", () => {
    expect(entry("2025-126").answerGroups).toContainEqual(["presidents day", "washington's birthday"]);
    expect(correct("2025-126", "Washington's Birthday, Labor Day and Memorial Day")).toBe(true);
    expect(count("2025-126", "Presidents Day, Washington's Birthday and Labor Day")).toBe(2);
    expect(correct("2025-126", "Presidents Day, Washington's Birthday and Labor Day")).toBe(false);
  });
});

describe("3. 2025-028: 'Connecticut Compromise' is another name for the Great Compromise", () => {
  it("accepts it, counts once, and no longer stores the run-together phrase", () => {
    const e = entry("2025-028");
    expect(e.acceptedAnswers).toContain("connecticut compromise");
    expect(e.acceptedAnswers).not.toContain("the great compromise connecticut compromise");
    expect(correct("2025-028", "the Connecticut Compromise")).toBe(true);
    expect(count("2025-028", "the Great Compromise, also called the Connecticut Compromise")).toBe(1);
  });
  it("refuses an unrelated compromise", () => {
    expect(correct("2025-028", "the Missouri Compromise")).toBe(false);
  });
});

describe("4. listed items may be said in any order, all of them required", () => {
  it("2008-045: both parties, either order", () => {
    expect(correct("2008-045", "Democratic and Republican")).toBe(true);
    expect(correct("2008-045", "Republican and Democratic")).toBe(true);
    expect(correct("2008-045", "the Republican party and the Democratic party")).toBe(true);
  });
  it("2008-045: one party missing fails", () => {
    expect(correct("2008-045", "Republican")).toBe(false);
    expect(correct("2008-045", "Democratic")).toBe(false);
    expect(correct("2008-045", "Republican and Republican")).toBe(false);
  });
  it("2008-017 and 2025-019: Senate and House, either order, with or without 'of Representatives'", () => {
    for (const id of ["2008-017", "2025-019"]) {
      expect(correct(id, "the Senate and the House"), id).toBe(true);
      expect(correct(id, "House of Representatives and Senate"), id).toBe(true);
      expect(correct(id, "the House and the Senate"), id).toBe(true);
    }
  });
  it("2008-017 and 2025-019: one part missing fails", () => {
    for (const id of ["2008-017", "2025-019"]) {
      expect(correct(id, "the Senate"), id).toBe(false);
      expect(correct(id, "the House of Representatives"), id).toBe(false);
    }
  });
  it("2025-016: either line, items in any order", () => {
    expect(correct("2025-016", "judicial, legislative and executive")).toBe(true);
    expect(correct("2025-016", "executive, judicial, legislative")).toBe(true);
    expect(correct("2025-016", "the courts, Congress and the president")).toBe(true);
    expect(correct("2025-016", "president, courts, Congress")).toBe(true);
  });
  it("2025-016: one branch missing fails", () => {
    expect(correct("2025-016", "legislative and executive")).toBe(false);
    expect(correct("2025-016", "judicial and executive")).toBe(false);
    expect(correct("2025-016", "Congress and the president")).toBe(false);
  });
  it("2025-016: items of the two lines are not mixed", () => {
    expect(correct("2025-016", "legislative, president and the courts")).toBe(false);
    expect(correct("2025-016", "Congress, executive and judicial")).toBe(false);
  });
});

describe("5. 'Jr.' is optional in Martin Luther King, Jr. Day", () => {
  it("2008-100 and 2025-126 accept it with and without 'Jr.', counted once", () => {
    expect(correct("2008-100", "Martin Luther King Day and Labor Day")).toBe(true);
    expect(correct("2008-100", "Martin Luther King Jr. Day and Labor Day")).toBe(true);
    expect(count("2008-100", "Martin Luther King Day and Martin Luther King Jr. Day")).toBe(1);
    expect(correct("2025-126", "Martin Luther King Day, Labor Day and Memorial Day")).toBe(true);
    expect(count("2025-126", "Martin Luther King Day, Martin Luther King Jr Day, Labor Day")).toBe(2);
  });
  it("'Martin Luther King' without 'Day' is not the holiday", () => {
    expect(correct("2008-100", "Martin Luther King and Labor Day")).toBe(false);
  });
});

describe("6. 2025-126: 'Day' is optional in Thanksgiving Day and Christmas Day", () => {
  it("accepts both forms, each counted once", () => {
    expect(correct("2025-126", "Thanksgiving, Christmas and Labor Day")).toBe(true);
    expect(correct("2025-126", "Thanksgiving Day, Christmas Day and Labor Day")).toBe(true);
    expect(count("2025-126", "Thanksgiving and Thanksgiving Day and Christmas")).toBe(2);
  });
  it("an unrelated holiday does not count", () => {
    expect(correct("2025-126", "Thanksgiving, Christmas and Halloween")).toBe(false);
    expect(correct("2025-126", "Thanksgiving, Christmas and Valentine's Day")).toBe(false);
    expect(correct("2008-100", "Christmas and Easter")).toBe(false);
  });
  it("2008 keeps its own wording ('Thanksgiving', 'Christmas'); the decision does not add 'Day' there", () => {
    expect(entry("2008-100").acceptedAnswers).not.toContain("christmas day");
    expect(entry("2008-100").acceptedAnswers).toContain("christmas");
  });
});
