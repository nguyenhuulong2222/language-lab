/**
 * Data tests for the 65/20 special consideration (spec release-finish REQ-S01, REQ-S03).
 *
 * - data/civics-65-20.json equals the questions marked with an asterisk in the official lists:
 *   the 2025 text, the 2008 web page and the 2008 text, each parsed here on its own.
 * - Every designated id is in the answer key of its version.
 * - Every 65/20 value in data/test-rules.json has a quote, and the quote is in a saved source.
 */
import { describe, it, expect, vi } from "vitest";
import designated from "../../../data/civics-65-20.json";
import rules from "../../../data/test-rules.json";
import source2025 from "../../../data/sources/uscis-2025-civics-128.txt?raw";
import source2008Html from "../../../data/sources/uscis-2008-civics-100.html?raw";
import source2008Txt from "../../../data/sources/uscis-2008-civics-100-rev0119.txt?raw";
import passages from "../../../data/sources/uscis-65-20-passages.txt?raw";
import policyManual from "../../../data/sources/uscis-policy-manual-vol12-parte-ch2.html?raw";
import studyPage from "../../../data/sources/uscis-study-for-the-test.html?raw";
import exceptionsPage from "../../../data/sources/uscis-exceptions-and-accommodations.html?raw";
import { loadAnswerKey } from "../civics-answer-key";

const id = (version: string, n: number) => `${version}-${String(n).padStart(3, "0")}`;
/** Numbered question lines that end with the asterisk. */
const starredNumbered = (text: string, version: string) =>
  text
    .split("\n")
    .map((line) => /^\s*(\d+)\.\s[^\n]*\*\s*$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => id(version, Number(m[1])));
/** Page text: tags removed, entities decoded, whitespace joined. */
const pageText = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ");
const loose = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

function key(version: "2008" | "2025") {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return loadAnswerKey(version, { production: false });
  } finally {
    warn.mockRestore();
  }
}

describe("the 65/20 designated questions (REQ-S03)", () => {
  it("2025: the file equals the asterisked questions of the official 2025 list", () => {
    const starred = starredNumbered(source2025, "2025");
    expect(starred).toHaveLength(20);
    expect(designated["2025"]).toEqual(starred);
  });
  it("2008: the file equals the asterisked questions of the 2008 text (rev. 01/19)", () => {
    const starred = starredNumbered(source2008Txt, "2008");
    expect(starred).toHaveLength(20);
    expect(designated["2008"]).toEqual(starred);
  });
  it("2008: the file equals the asterisked questions of the 2008 web page", () => {
    // Question items on the page end with "?" or "." and the asterisk; answers never carry one.
    const starredTexts = [...source2008Html.matchAll(/<li>([^<]*?)\s*\*\s*</g)].map((m) => loose(m[1]!));
    expect(starredTexts).toHaveLength(20);
    const byText = new Map([...key("2008").values()].map((e) => [loose(e.questionText), e.id]));
    const ids = starredTexts.map((t) => byText.get(t));
    expect(ids.every((x) => x !== undefined), JSON.stringify(starredTexts)).toBe(true);
    expect(designated["2008"]).toEqual(ids);
  });
  it("every designated id is in its answer key; at least 10 are static", () => {
    for (const version of ["2008", "2025"] as const) {
      const k = key(version);
      for (const qid of designated[version]) expect(k.has(qid), qid).toBe(true);
      expect(designated[version].filter((q) => k.get(q)?.answerType === "static").length).toBeGreaterThanOrEqual(
        rules["65_20_specialConsideration"].questionsAsked.value
      );
    }
  });
});

describe("the 65/20 rule values and their sources (REQ-S01)", () => {
  const section = rules["65_20_specialConsideration"] as unknown as Record<
    string,
    { value: unknown; needsVerification: boolean; sourceQuote: string | null; sourceUrl: string }
  >;
  const pages = [pageText(policyManual), pageText(studyPage), pageText(exceptionsPage)];
  it("every verified value has a quote that is in a saved source page", () => {
    for (const [name, field] of Object.entries(section)) {
      if (name.startsWith("_")) continue;
      if (field.needsVerification) {
        expect(field.value, name).toBeNull();
        continue;
      }
      expect(field.sourceQuote, name).toBeTruthy();
      expect(pages.some((p) => p.includes(field.sourceQuote!)), name).toBe(true);
    }
  });
  it("the numbers are those the quotes state", () => {
    expect(section.questionBank!.value).toBe(20);
    expect(section.questionBank!.sourceQuote).toContain("20 specially designated");
    expect(section.questionsAsked!.value).toBe(10);
    expect(section.questionsAsked!.sourceQuote).toContain("contains 10 questions");
    expect(section.passingScore!.value).toBe(6);
    expect(section.passingScore!.sourceQuote).toContain("at least six of 10");
  });
  it("no early-stop rule is invented", () => {
    expect(section.earlyStopOnCorrect).toMatchObject({ value: null, needsVerification: true, sourceQuote: null });
    expect(section.earlyStopOnIncorrect).toMatchObject({ value: null, needsVerification: true, sourceQuote: null });
  });
  it("every sentence of uscis-65-20-passages.txt is in the page it names", () => {
    const byFile: Record<string, string> = {
      "uscis-policy-manual-vol12-parte-ch2.html": pages[0]!,
      "uscis-study-for-the-test.html": pages[1]!,
      "uscis-exceptions-and-accommodations.html": pages[2]!,
    };
    let current: string | null = null;
    let checked = 0;
    for (const line of passages.split("\n")) {
      const heading = /^## (\S+)/.exec(line);
      if (heading) {
        current = heading[1]!;
        continue;
      }
      if (current === null || line.trim() === "") continue;
      expect(byFile[current]!.includes(line.trim()), line).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(12);
  });
});
