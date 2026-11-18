/**
 * Data tests for data/civics-answers/2008.json and 2025.json.
 *
 * These tests read the official source files again and check the answer keys against them
 * with their own, simple parsing. They do not use tools/answer-key/build-answer-key.mjs, so
 * a mistake in that script cannot hide here. They check:
 * - exact question counts and numbering (1 to 100, 1 to 128), none missing or repeated;
 * - which questions are dynamic;
 * - that every accepted answer only uses words found in the source for that question;
 * - that every source answer line is represented;
 * - that scoring behaves as decided on real data (optional article, numbers, several answers).
 */

import { describe, it, expect, vi } from "vitest";
import { countMatchingPhrases, tokenise } from "../answer-normaliser.js";
import { loadAnswerKey, type CivicsAnswerEntry } from "../civics-answer-key.js";
import source2008 from "../../../data/sources/uscis-2008-civics-100-rev0119.txt?raw";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadQuietly(version: "2008" | "2025") {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return loadAnswerKey(version, { production: false });
  } finally {
    warn.mockRestore();
  }
}

/** Lowercase letters and digits only, so curly and straight punctuation compare equal. */
const loose = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "");
const looseTokens = (text: string): string[] => tokenise(text).map(loose).filter(Boolean);

const DYNAMIC_MARKER = /answers will vary|uscis\.gov\/citizenship\/testupdates/i;

function isCorrect(
  key: ReadonlyMap<string, CivicsAnswerEntry>,
  id: string,
  response: string
): boolean {
  const entry = key.get(id);
  if (!entry || entry.answerType === "dynamic") return false;
  return countMatchingPhrases(response, entry.acceptedAnswers) >= entry.requiredAnswerCount;
}

function expectedIds(count: number, version: string): string[] {
  return Array.from({ length: count }, (_, i) => `${version}-${String(i + 1).padStart(3, "0")}`);
}

interface SourceQuestion {
  number: number;
  questionLine: string;
  answerLines: string[];
}

// ---------------------------------------------------------------------------
// 2008
// ---------------------------------------------------------------------------

/** The older official text has explicit question numbers, so it is the numbering check. */
function parseNumbered2008(text: string): SourceQuestion[] {
  const questions: SourceQuestion[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const question = /^(\d+)\.\s+(.*)$/.exec(line);
    if (question) {
      questions.push({ number: Number(question[1]), questionLine: question[2]!, answerLines: [] });
      continue;
    }
    const answer = /^\.\s+(.*)$/.exec(line);
    if (answer && questions.length > 0) {
      questions[questions.length - 1]!.answerLines.push(answer[1]!);
      continue;
    }
    // A line that is neither a question nor an answer is either a heading, the closing
    // footnote, or a note that belongs to the line before it (for example the bracketed
    // "Also acceptable..." note under question 95).
    const isHeading =
      line === "" ||
      /^[A-C]: /.test(line) ||
      /^(AMERICAN GOVERNMENT|AMERICAN HISTORY|INTEGRATED CIVICS)$/.test(line) ||
      line.startsWith("* If you are 65");
    const current = questions[questions.length - 1];
    if (!isHeading && current) {
      if (current.answerLines.length > 0) {
        current.answerLines[current.answerLines.length - 1] += ` ${line}`;
      } else {
        current.questionLine += ` ${line}`;
      }
    }
  }
  return questions;
}

/** Words the current web page has that the older text does not (Juneteenth was added later). */
const WEB_PAGE_ONLY_WORDS: Record<number, string[]> = { 100: ["juneteenth"] };

describe("2008 answer key against the official source", () => {
  const key = loadQuietly("2008");
  const entries = [...key.values()];
  const source = parseNumbered2008(source2008);

  it("the source lists exactly 100 questions numbered 1 to 100, none repeated", () => {
    expect(source.map((q) => q.number)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it("the answer key has exactly 100 entries, 2008-001 to 2008-100, in order", () => {
    expect(entries).toHaveLength(100);
    expect(entries.map((e) => e.id)).toEqual(expectedIds(100, "2008"));
  });

  it("every entry points at the official 2008 list and names its own question number", () => {
    for (const entry of entries) {
      const number = Number(entry.id.slice("2008-".length));
      expect(entry.sourceUrl).toBe("https://www.uscis.gov/civics-questions-and-answers-2008-version");
      expect(entry.sourceDocument).toContain("uscis-2008-civics-100.html");
      expect(entry.sourceDocument).toContain(`question ${number}`);
    }
  });

  it("every question text matches the official source", () => {
    for (const entry of entries) {
      const number = Number(entry.id.slice("2008-".length));
      const line = source[number - 1]!.questionLine.replace(/\*\s*$/, "");
      // The older text keeps a bracketed note on question 87; the answer key does not.
      expect(loose(line).startsWith(loose(entry.questionText)), entry.id).toBe(true);
    }
  });

  it("a question is dynamic exactly when the source says answers will vary or points to the test updates page", () => {
    const fromSource = source
      .filter((q) => q.answerLines.some((line) => DYNAMIC_MARKER.test(line)))
      .map((q) => q.number)
      .sort((a, b) => a - b);
    const fromKey = entries
      .filter((e) => e.answerType === "dynamic")
      .map((e) => Number(e.id.slice("2008-".length)));
    expect(fromKey).toEqual(fromSource);
    expect(fromKey).toEqual([20, 23, 28, 29, 39, 40, 43, 44, 46, 47]);
  });

  it("dynamic questions store no answers, so no officeholder or state-specific name can be stored", () => {
    for (const entry of entries.filter((e) => e.answerType === "dynamic")) {
      expect(entry.acceptedAnswers).toEqual([]);
    }
  });

  it("accepted answers only use words found in the source for that question", () => {
    for (const entry of listStatic(entries)) {
      const number = Number(entry.id.slice("2008-".length));
      const allowed = new Set([
        ...source[number - 1]!.answerLines.flatMap(looseTokens),
        ...(WEB_PAGE_ONLY_WORDS[number] ?? []),
      ]);
      for (const answer of entry.acceptedAnswers) {
        for (const word of looseTokens(answer)) {
          expect(allowed.has(word), `${entry.id}: "${word}" in "${answer}" is not in the source`).toBe(true);
        }
      }
    }
  });

  it("every source answer line has at least one accepted answer built from its words", () => {
    for (const entry of listStatic(entries)) {
      const number = Number(entry.id.slice("2008-".length));
      for (const line of source[number - 1]!.answerLines) {
        const lineWords = new Set(looseTokens(line));
        const covered = entry.acceptedAnswers.some((answer) =>
          looseTokens(answer).every((word) => lineWords.has(word))
        );
        expect(covered, `${entry.id}: no accepted answer for the source line "${line}"`).toBe(true);
      }
    }
  });

  it("only the six 'name N' questions need more than one answer", () => {
    const multi = entries
      .filter((e) => e.requiredAnswerCount > 1)
      .map((e) => [Number(e.id.slice("2008-".length)), e.requiredAnswerCount]);
    expect(multi).toEqual([[9, 2], [36, 2], [51, 2], [55, 2], [64, 3], [100, 2]]);
  });

  describe("scoring real 2008 answers", () => {
    it("accepts the answer with extra words and without the leading article", () => {
      expect(isCorrect(key, "2008-001", "The Constitution.")).toBe(true);
      expect(isCorrect(key, "2008-001", "I think it is the Constitution")).toBe(true);
      expect(isCorrect(key, "2008-001", "Constitution")).toBe(true);
      expect(isCorrect(key, "2008-001", "the constitutional amendment")).toBe(false);
    });

    it("does not accept a number that continues into a longer number", () => {
      expect(isCorrect(key, "2008-018", "one hundred")).toBe(true);
      expect(isCorrect(key, "2008-018", "100")).toBe(true);
      expect(isCorrect(key, "2008-018", "one hundred and one")).toBe(false);
      expect(isCorrect(key, "2008-018", "one hundred one")).toBe(false);
      expect(isCorrect(key, "2008-007", "Twenty-seven")).toBe(true);
      expect(isCorrect(key, "2008-007", "27")).toBe(true);
      expect(isCorrect(key, "2008-007", "127")).toBe(false);
      expect(isCorrect(key, "2008-019", "six")).toBe(true);
      expect(isCorrect(key, "2008-019", "twenty six")).toBe(false);
    });

    it("needs the right number of different answers", () => {
      expect(isCorrect(key, "2008-009", "life and liberty")).toBe(true);
      expect(isCorrect(key, "2008-009", "life")).toBe(false);
      expect(isCorrect(key, "2008-100", "Juneteenth and Labor Day")).toBe(true);
      expect(isCorrect(key, "2008-100", "Labor Day")).toBe(false);
      expect(isCorrect(key, "2008-064", "New York, Georgia, and Virginia")).toBe(true);
      expect(isCorrect(key, "2008-064", "New York and Georgia")).toBe(false);
    });

    it("takes the extra Statue of Liberty answers from the source note", () => {
      expect(isCorrect(key, "2008-095", "Liberty Island")).toBe(true);
      expect(isCorrect(key, "2008-095", "New Jersey")).toBe(true);
      expect(isCorrect(key, "2008-095", "New York Harbor")).toBe(true);
      expect(isCorrect(key, "2008-095", "Texas")).toBe(false);
    });

    it("never scores a dynamic question", () => {
      expect(isCorrect(key, "2008-028", "anything at all")).toBe(false);
    });
  });
});

function listStatic(entries: CivicsAnswerEntry[]): CivicsAnswerEntry[] {
  return entries.filter((e) => e.answerType === "static");
}
