/**
 * Tests for src/engine/civics-answer-key.ts and the data in data/civics-answers/.
 *
 * Includes the data tests required by the spec:
 * - no accepted answer is nested inside another for questions that need more than one answer;
 * - a file marked reviewed (needsHumanReview: false) names its reviewer and the review date;
 * - the loader throws in production while that flag is true, or when a reviewed file names nobody.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import {
  loadAnswerKey,
  parseAnswerKey,
  listStaticEntries,
  findNestingViolations,
  type CivicsAnswerEntry,
} from "../civics-answer-key.js";
import { countMatchingPhrases, isNumberToken, normalise } from "../answer-normaliser.js";
import RAW_2008 from "../../../data/civics-answers/2008.json" with { type: "json" };
import RAW_2025 from "../../../data/civics-answers/2025.json" with { type: "json" };

type RawFile = { needsHumanReview: boolean; reviewedBy?: string; reviewedOn?: string; entries: Array<Record<string, unknown>> };
const RAW: Record<"2008" | "2025", RawFile> = {
  "2008": RAW_2008 as unknown as RawFile,
  "2025": RAW_2025 as unknown as RawFile,
};
const VERSIONS = ["2008", "2025"] as const;

/** A deep copy of a real file, safe to mutate in a test. */
function copyOf(version: "2008" | "2025"): RawFile {
  return structuredClone(RAW[version]);
}

/** Load a real file without production checks and without warning noise. */
function loadQuietly(version: "2008" | "2025") {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return loadAnswerKey(version, { production: false });
  } finally {
    warn.mockRestore();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Real data files
// ---------------------------------------------------------------------------

describe.each(VERSIONS)("data/civics-answers/%s.json", (version) => {
  it("loads and every id is unique", () => {
    const key = loadQuietly(version);
    expect(key.size).toBe(RAW[version].entries.length);
  });

  it("every entry carries the file's testVersion, a uscis.gov https sourceUrl and a sourceDocument", () => {
    for (const entry of loadQuietly(version).values()) {
      expect(entry.testVersion).toBe(version);
      expect(new URL(entry.sourceUrl).protocol).toBe("https:");
      expect(new URL(entry.sourceUrl).hostname).toMatch(/(^|\.)uscis\.gov$/);
      expect(entry.sourceDocument.trim().length).toBeGreaterThan(0);
    }
  });

  it("static entries have normalised accepted answers; dynamic entries have none", () => {
    for (const entry of loadQuietly(version).values()) {
      if (entry.answerType === "static") {
        expect(entry.acceptedAnswers.length).toBeGreaterThan(0);
        for (const answer of entry.acceptedAnswers) {
          expect(answer).toBe(normalise(answer));
        }
      } else {
        expect(entry.acceptedAnswers).toEqual([]);
      }
    }
  });

  it("covers a static question, a multi-answer question and a dynamic question", () => {
    const entries = [...loadQuietly(version).values()];
    expect(entries.some((e) => e.answerType === "static" && e.requiredAnswerCount === 1)).toBe(true);
    expect(entries.some((e) => e.answerType === "static" && e.requiredAnswerCount > 1)).toBe(true);
    expect(entries.some((e) => e.answerType === "dynamic")).toBe(true);
  });

  it("data test: no accepted answer is nested inside another when more than one answer is required", () => {
    for (const entry of loadQuietly(version).values()) {
      expect(
        findNestingViolations(entry),
        `${entry.id} nests accepted answers`
      ).toEqual([]);
    }
  });

  it("is either marked for review, or names its reviewer and the review date", () => {
    const raw = RAW[version];
    if (raw.needsHumanReview === false) {
      expect(raw.reviewedBy, "reviewedBy").toMatch(/\S/);
      expect(raw.reviewedOn, "reviewedOn").toMatch(/^\d{4}-\d{2}-\d{2}$/);
    } else {
      expect(raw.needsHumanReview).toBe(true);
    }
  });
  it("is reviewed by the project owner on 2026-11-20 (answer key review)", () => {
    expect(RAW[version]).toMatchObject({ needsHumanReview: false, reviewedBy: "Long Nguyen (project owner)", reviewedOn: "2026-11-20" });
  });

  it("loader behaviour follows the review flag: throws in production while unreviewed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    if (RAW[version].needsHumanReview) {
      expect(() => loadAnswerKey(version, { production: true })).toThrow(/needsHumanReview/);
      expect(() => loadAnswerKey(version, { production: false })).not.toThrow();
      expect(warn).toHaveBeenCalled();
    } else {
      expect(() => loadAnswerKey(version, { production: true })).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// needsHumanReview guard on synthetic data
// ---------------------------------------------------------------------------

describe("needsHumanReview guard", () => {
  it("throws in production when needsHumanReview is true", () => {
    const raw = copyOf("2008");
    raw.needsHumanReview = true;
    expect(() => parseAnswerKey(raw, "2008", { production: true })).toThrow(
      /needsHumanReview: true/
    );
  });

  it("warns but loads in development when needsHumanReview is true", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = copyOf("2008");
    raw.needsHumanReview = true;
    expect(() => parseAnswerKey(raw, "2008", { production: false })).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("loads in production without a warning once needsHumanReview is false with a named reviewer", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const raw = copyOf("2008");
    raw.needsHumanReview = false;
    raw.reviewedBy = "A. Reviewer";
    raw.reviewedOn = "2026-11-20";
    expect(() => parseAnswerKey(raw, "2008", { production: true })).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });
  it("refuses in production a file marked reviewed that names no reviewer or no date", () => {
    for (const change of [{ reviewedBy: undefined }, { reviewedBy: " " }, { reviewedOn: undefined }, { reviewedOn: "20 Nov 2026" }]) {
      const raw = { ...copyOf("2008"), needsHumanReview: false, reviewedBy: "A. Reviewer", reviewedOn: "2026-11-20", ...change };
      expect(() => parseAnswerKey(raw, "2008", { production: true }), JSON.stringify(change)).toThrow(/does not name a reviewer/);
    }
  });
});

// ---------------------------------------------------------------------------
// Validation errors (mutated copies of a real file)
// ---------------------------------------------------------------------------

describe("parseAnswerKey validation", () => {
  /** First static entry with one required answer, so mutations are predictable. */
  const staticIndex = RAW["2008"].entries.findIndex(
    (e) => e["answerType"] === "static" && e["requiredAnswerCount"] === 1
  );
  const dynamicIndex = RAW["2008"].entries.findIndex((e) => e["answerType"] === "dynamic");

  function parseMutated(
    mutate: (raw: RawFile, entry: Record<string, unknown>) => void,
    index = staticIndex
  ) {
    const raw = copyOf("2008");
    raw.needsHumanReview = false;
    mutate(raw, raw.entries[index]!);
    return () => parseAnswerKey(raw, "2008", { production: false });
  }

  it("accepts an unmodified copy", () => {
    expect(parseMutated(() => {})).not.toThrow();
  });

  it("rejects a file that is not an object, or has no entries, or no review flag", () => {
    expect(() => parseAnswerKey(null, "2008")).toThrow(/JSON object/);
    expect(() => parseAnswerKey([], "2008")).toThrow(/JSON object/);
    expect(() => parseAnswerKey({ needsHumanReview: false, entries: [] }, "2008")).toThrow(/entries/);
    expect(() => parseAnswerKey({ entries: [{}] }, "2008")).toThrow(/needsHumanReview/);
  });

  it("rejects a testVersion that does not match the file", () => {
    expect(parseMutated((_, e) => { e["testVersion"] = "2025"; })).toThrow(/testVersion/);
  });

  it("rejects an id with the wrong prefix or shape", () => {
    expect(parseMutated((_, e) => { e["id"] = "2025-001"; })).toThrow(/id must look like/);
    expect(parseMutated((_, e) => { e["id"] = "2008-1"; })).toThrow(/id must look like/);
    expect(parseMutated((_, e) => { e["id"] = ""; })).toThrow(/id must look like/);
  });

  it("rejects a duplicate id", () => {
    expect(
      parseMutated((raw, e) => {
        raw.entries.push({ ...e });
      })
    ).toThrow(/duplicate id/);
  });

  it("rejects an empty questionText", () => {
    expect(parseMutated((_, e) => { e["questionText"] = "  "; })).toThrow(/questionText/);
  });

  it("rejects acceptedAnswers that are not an array of strings", () => {
    expect(parseMutated((_, e) => { e["acceptedAnswers"] = "the constitution"; })).toThrow(/array of strings/);
    expect(parseMutated((_, e) => { e["acceptedAnswers"] = [1, 2]; })).toThrow(/array of strings/);
  });

  it("rejects an invalid requiredAnswerCount", () => {
    expect(parseMutated((_, e) => { e["requiredAnswerCount"] = 0; })).toThrow(/requiredAnswerCount/);
    expect(parseMutated((_, e) => { e["requiredAnswerCount"] = 1.5; })).toThrow(/requiredAnswerCount/);
    expect(parseMutated((_, e) => { e["requiredAnswerCount"] = "1"; })).toThrow(/requiredAnswerCount/);
  });

  it("rejects a requiredAnswerCount larger than the number of accepted answers", () => {
    expect(
      parseMutated((_, e) => {
        e["requiredAnswerCount"] = (e["acceptedAnswers"] as string[]).length + 1;
      })
    ).toThrow(/larger than the number of accepted answers/);
  });

  it("rejects an unknown answerType", () => {
    expect(parseMutated((_, e) => { e["answerType"] = "maybe"; })).toThrow(/answerType/);
  });

  it("rejects a static question with no accepted answers", () => {
    expect(parseMutated((_, e) => { e["acceptedAnswers"] = []; })).toThrow(/at least one accepted answer/);
  });

  it("rejects accepted answers that are not normalised", () => {
    expect(parseMutated((_, e) => { e["acceptedAnswers"] = ["The Constitution"]; })).toThrow(/normalised form/);
    expect(parseMutated((_, e) => { e["acceptedAnswers"] = ["the constitution."]; })).toThrow(/normalised form/);
    expect(parseMutated((_, e) => { e["acceptedAnswers"] = ["twenty-seven"]; })).toThrow(/normalised form/);
  });

  it("rejects an accepted answer that is empty after normalising", () => {
    expect(parseMutated((_, e) => { e["acceptedAnswers"] = ["?!"]; })).toThrow(/empty after normalising/);
  });

  it("rejects a duplicate accepted answer", () => {
    expect(parseMutated((_, e) => { e["acceptedAnswers"] = ["the constitution", "the constitution"]; })).toThrow(/listed twice/);
  });

  it("rejects accepted answers on a dynamic question", () => {
    expect(parseMutated((_, e) => { e["acceptedAnswers"] = ["some name"]; }, dynamicIndex)).toThrow(/dynamic question must have no acceptedAnswers/);
  });

  it("rejects a sourceUrl that is not an https uscis.gov URL", () => {
    for (const bad of [
      "",
      "https://example.com/x",
      "http://www.uscis.gov/x",
      "https://notuscis.gov/x",
      "https://uscis.gov.evil.com/x",
      "not a url",
    ]) {
      expect(parseMutated((_, e) => { e["sourceUrl"] = bad; }), bad).toThrow(/sourceUrl/);
    }
  });

  it("accepts uscis.gov with and without www", () => {
    expect(parseMutated((_, e) => { e["sourceUrl"] = "https://uscis.gov/x"; })).not.toThrow();
    expect(parseMutated((_, e) => { e["sourceUrl"] = "https://www.uscis.gov/x"; })).not.toThrow();
  });

  it("rejects an empty sourceDocument", () => {
    expect(parseMutated((_, e) => { e["sourceDocument"] = " "; })).toThrow(/sourceDocument/);
  });

  it("names the failing entry in the error", () => {
    expect(parseMutated((_, e) => { e["questionText"] = ""; })).toThrow(
      new RegExp(`entry ${staticIndex + 1}`)
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("listStaticEntries", () => {
  it("returns static entries only", () => {
    for (const version of VERSIONS) {
      const key = loadQuietly(version);
      const staticEntries = listStaticEntries(key);
      expect(staticEntries.length).toBeGreaterThan(0);
      expect(staticEntries.every((e) => e.answerType === "static")).toBe(true);
      expect(staticEntries.length).toBeLessThan(key.size);
    }
  });
});

describe("findNestingViolations", () => {
  it("flags an accepted answer inside another when two answers are required", () => {
    expect(
      findNestingViolations({
        acceptedAnswers: ["speech", "freedom of speech", "religion"],
        requiredAnswerCount: 2,
      })
    ).toEqual([{ inner: "speech", outer: "freedom of speech" }]);
  });

  it("allows nested answers when only one answer is required", () => {
    expect(
      findNestingViolations({
        acceptedAnswers: ["constitution", "us constitution"],
        requiredAnswerCount: 1,
      })
    ).toEqual([]);
  });

  it("does not treat a longer word as nesting", () => {
    expect(
      findNestingViolations({
        acceptedAnswers: ["constitution", "constitutional law"],
        requiredAnswerCount: 2,
      })
    ).toEqual([]);
  });

  it("reports nothing for distinct answers", () => {
    expect(
      findNestingViolations({
        acceptedAnswers: ["life", "liberty", "pursuit of happiness"],
        requiredAnswerCount: 2,
      })
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests over the real data
// ---------------------------------------------------------------------------

describe("answer key properties", () => {
  const all: Array<{ version: "2008" | "2025"; entry: CivicsAnswerEntry }> = VERSIONS.flatMap(
    (version) => [...loadQuietly(version).values()].map((entry) => ({ version, entry }))
  );
  const staticEntries = all.filter(({ entry }) => entry.answerType === "static");

  it("property: every id in a loaded key resolves to its own entry", () => {
    fc.assert(
      fc.property(fc.constantFrom(...all), ({ version, entry }) => {
        const key = loadQuietly(version);
        return key.get(entry.id)?.id === entry.id;
      })
    );
  });

  it("property: a response made of the required number of accepted answers always satisfies the entry", () => {
    // Plain filler words: a number word next to a number answer would (correctly) not match.
    const filler = fc.array(
      fc.stringMatching(/^[a-z]{1,6}$/).filter((w) => !isNumberToken(w)),
      { maxLength: 4 }
    );
    fc.assert(
      fc.property(fc.constantFrom(...staticEntries), filler, filler, ({ entry }, before, after) => {
        const chosen = entry.acceptedAnswers.slice(0, entry.requiredAnswerCount);
        const response = [...before, chosen.join(" and "), ...after].join(" ");
        return countMatchingPhrases(response, entry.acceptedAnswers) >= entry.requiredAnswerCount;
      }),
      { numRuns: 300 }
    );
  });

  it("property: one accepted answer alone never satisfies an entry that needs more than one", () => {
    const multi = staticEntries.filter(({ entry }) => entry.requiredAnswerCount > 1);
    expect(multi.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(fc.constantFrom(...multi), fc.nat(), ({ entry }, n) => {
        const single = entry.acceptedAnswers[n % entry.acceptedAnswers.length]!;
        return countMatchingPhrases(single, entry.acceptedAnswers) < entry.requiredAnswerCount;
      })
    );
  });
});
