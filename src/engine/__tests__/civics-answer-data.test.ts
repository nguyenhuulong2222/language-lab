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
import { countMatchingPhrases, normalise, tokenise } from "../answer-normaliser.js";
import { loadAnswerKey, type CivicsAnswerEntry } from "../civics-answer-key.js";
import source2008 from "../../../data/sources/uscis-2008-civics-100-rev0119.txt?raw";
import markersFile from "../../../tools/answer-key/answer-markers.json";

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
/** Words of a text. A slash in the source ("Antietam/Sharpsburg") separates alternatives. */
const looseTokens = (text: string): string[] =>
  tokenise(text.replace(/\//g, " ")).map(loose).filter(Boolean);

const DYNAMIC_MARKER = /answers will vary|uscis\.gov\/citizenship\/testupdates/i;

function isCorrect(
  key: ReadonlyMap<string, CivicsAnswerEntry>,
  id: string,
  response: string
): boolean {
  const entry = key.get(id);
  if (!entry || entry.answerType === "dynamic") return false;
  return (
    countMatchingPhrases(response, entry.acceptedAnswers, {
      groups: entry.answerGroups ?? [],
      numberAlone: entry.numberAlone ?? [],
    }) >= entry.requiredAnswerCount
  );
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

// ---------------------------------------------------------------------------
// 2025
// ---------------------------------------------------------------------------

interface Source2025Question {
  number: number;
  /** Question wording, joined over wrapped lines, without the 65/20 marker. */
  questionLine: string;
  /** One string per bullet, joined over wrapped lines. */
  bullets: string[];
}

/**
 * A simple second reading of the converted official text. Lines are split into questions
 * (a number and a dot), bullets, and continuation lines. Page footers and headings are
 * skipped. pdftotext puts a form-feed at the top of each page, so "\s" (not a space) is used.
 */
function parse2025(text: string): Source2025Question[] {
  const questions: Source2025Question[] = [];
  let inBullets = false;
  for (const raw of text.split("\n")) {
    if (/^\s*\d+ of \d+\s+uscis\.gov\/citizenship\s*$/.test(raw)) continue;
    if (/^\s*(AMERICAN GOVERNMENT|AMERICAN HISTORY|SYMBOLS AND HOLIDAYS)\s*$/.test(raw)) continue;
    if (/^\s*[A-C]: \S/.test(raw)) continue;
    if (raw.trim() === "") continue;

    const bullet = /^\s*\u2022\s+(\S.*)$/.exec(raw);
    if (bullet) {
      if (questions.length === 0) continue;
      questions[questions.length - 1]!.bullets.push(bullet[1]!.trim());
      inBullets = true;
      continue;
    }
    const start = /^\s*(\d+)\.\s+(\S.*)$/.exec(raw);
    if (start) {
      questions.push({ number: Number(start[1]), questionLine: start[2]!.trim(), bullets: [] });
      inBullets = false;
      continue;
    }
    const current = questions[questions.length - 1];
    if (!current) continue; // the preamble before question 1
    if (inBullets) {
      // A wrapped bullet, or the note under question 117; both only add words to the bullet.
      current.bullets[current.bullets.length - 1] += ` ${raw.trim()}`;
    } else {
      current.questionLine += ` ${raw.trim()}`;
    }
  }
  for (const q of questions) q.questionLine = q.questionLine.replace(/\s*\*\s*$/, "");
  return questions;
}

describe("2025 answer key against the official source", async () => {
  const source2025 = (await import("../../../data/sources/uscis-2025-civics-128.txt?raw")).default;
  const key = loadQuietly("2025");
  const entries = [...key.values()];
  const source = parse2025(source2025);

  it("the source lists exactly 128 questions numbered 1 to 128, none missing or repeated, in order", () => {
    expect(source).toHaveLength(128);
    expect(source.map((q) => q.number)).toEqual(Array.from({ length: 128 }, (_, i) => i + 1));
  });

  it("the answer key has exactly 128 entries, 2025-001 to 2025-128, in order", () => {
    expect(entries).toHaveLength(128);
    expect(entries.map((e) => e.id)).toEqual(expectedIds(128, "2025"));
  });

  it("every entry cites the official 2025 PDF by URL and file name, and its own question number", () => {
    for (const entry of entries) {
      const number = Number(entry.id.slice("2025-".length));
      expect(entry.sourceUrl).toBe(
        "https://www.uscis.gov/sites/default/files/document/questions-and-answers/2025-Civics-Test-128-Questions-and-Answers.pdf"
      );
      expect(entry.sourceDocument).toContain("uscis-2025-civics-128.pdf");
      expect(entry.sourceDocument).toContain("2025 version");
      expect(entry.sourceDocument).toContain(`question ${number},`.replace(/,$/, ""));
    }
  });

  it("does not use the 2020-version text anywhere", () => {
    for (const entry of entries) {
      expect(entry.sourceUrl).not.toMatch(/M_1778TXT|2020/i);
      expect(entry.sourceDocument).not.toMatch(/M-1778TXT|2020/i);
    }
  });

  it("every question text matches the official source", () => {
    for (const entry of entries) {
      const number = Number(entry.id.slice("2025-".length));
      expect(loose(entry.questionText), entry.id).toBe(loose(source[number - 1]!.questionLine));
    }
  });

  it("a question is dynamic exactly when the source says answers will vary or points to the test updates page", () => {
    const fromSource = source
      .filter((q) => q.bullets.some((bullet) => DYNAMIC_MARKER.test(bullet)))
      .map((q) => q.number);
    const fromKey = entries
      .filter((e) => e.answerType === "dynamic")
      .map((e) => Number(e.id.slice("2025-".length)));
    expect(fromKey).toEqual(fromSource);
    expect(fromKey).toEqual([23, 29, 30, 38, 39, 57, 61, 62]);
  });

  it("dynamic questions store no answers, so no officeholder or state-specific name can be stored", () => {
    for (const entry of entries.filter((e) => e.answerType === "dynamic")) {
      expect(entry.acceptedAnswers).toEqual([]);
    }
  });

  it("every question has at least one source answer line", () => {
    for (const q of source) expect(q.bullets.length, `question ${q.number}`).toBeGreaterThan(0);
  });

  it("accepted answers only use words found in the source for that question", () => {
    for (const entry of listStatic(entries)) {
      const number = Number(entry.id.slice("2025-".length));
      const allowed = new Set(source[number - 1]!.bullets.flatMap(looseTokens));
      for (const answer of entry.acceptedAnswers) {
        for (const word of looseTokens(answer)) {
          expect(allowed.has(word), `${entry.id}: "${word}" in "${answer}" is not in the source`).toBe(true);
        }
      }
    }
  });

  it("every source answer line has at least one accepted answer built from its words", () => {
    for (const entry of listStatic(entries)) {
      const number = Number(entry.id.slice("2025-".length));
      for (const bullet of source[number - 1]!.bullets) {
        const bulletWords = new Set(looseTokens(bullet));
        const covered = entry.acceptedAnswers.some((answer) =>
          looseTokens(answer).every((word) => bulletWords.has(word))
        );
        expect(covered, `${entry.id}: no accepted answer for the source line "${bullet}"`).toBe(true);
      }
    }
  });

  it("only the seven 'name N' questions need more than one answer", () => {
    const multi = entries
      .filter((e) => e.requiredAnswerCount > 1)
      .map((e) => [Number(e.id.slice("2025-".length)), e.requiredAnswerCount]);
    expect(multi).toEqual([[10, 2], [48, 2], [65, 3], [67, 2], [69, 2], [81, 5], [126, 3]]);
  });

  it("question 63 asks for one of four amendments, so it needs one answer", () => {
    expect(key.get("2025-063")!.requiredAnswerCount).toBe(1);
  });

  describe("scoring real 2025 answers", () => {
    it("accepts the answer with extra words and with or without the optional words", () => {
      expect(isCorrect(key, "2025-002", "Constitution")).toBe(true);
      expect(isCorrect(key, "2025-002", "the U.S. Constitution")).toBe(true);
      expect(isCorrect(key, "2025-002", "I believe it is the Constitution")).toBe(true);
      expect(isCorrect(key, "2025-002", "The Declaration of Independence")).toBe(false);
      expect(isCorrect(key, "2025-016", "legislative, executive, and judicial")).toBe(true);
      expect(isCorrect(key, "2025-016", "legislative and judicial")).toBe(false);
    });

    it("does not accept a number that continues into a longer number", () => {
      expect(isCorrect(key, "2025-021", "one hundred")).toBe(true);
      expect(isCorrect(key, "2025-021", "100")).toBe(true);
      expect(isCorrect(key, "2025-021", "one hundred and one")).toBe(false);
      expect(isCorrect(key, "2025-021", "one hundred one")).toBe(false);
      expect(isCorrect(key, "2025-007", "twenty-seven")).toBe(true);
      expect(isCorrect(key, "2025-007", "127")).toBe(false);
      expect(isCorrect(key, "2025-022", "six years")).toBe(true);
      expect(isCorrect(key, "2025-022", "6 years")).toBe(true);
      expect(isCorrect(key, "2025-022", "twenty six years")).toBe(false);
      expect(isCorrect(key, "2025-024", "four hundred thirty-five")).toBe(true);
      expect(isCorrect(key, "2025-024", "435")).toBe(true);
      expect(isCorrect(key, "2025-025", "two years")).toBe(true);
      expect(isCorrect(key, "2025-025", "twenty two years")).toBe(false);
      expect(isCorrect(key, "2025-027", "two")).toBe(true);
      expect(isCorrect(key, "2025-027", "twenty two")).toBe(false);
    });

    it("needs the right number of different answers", () => {
      expect(isCorrect(key, "2025-010", "equality and liberty")).toBe(true);
      expect(isCorrect(key, "2025-010", "liberty")).toBe(false);
      expect(isCorrect(key, "2025-048", "Attorney General and Secretary of State")).toBe(true);
      expect(isCorrect(key, "2025-048", "Attorney General")).toBe(false);
      expect(isCorrect(key, "2025-065", "freedom of speech, freedom of religion, and the right to bear arms")).toBe(true);
      expect(isCorrect(key, "2025-065", "freedom of speech and freedom of religion")).toBe(false);
      expect(isCorrect(key, "2025-081", "New York, Georgia, Delaware, Maryland, and Virginia")).toBe(true);
      expect(isCorrect(key, "2025-081", "New York, Georgia, Delaware, and Maryland")).toBe(false);
      expect(isCorrect(key, "2025-126", "Labor Day, Memorial Day and Juneteenth")).toBe(true);
      expect(isCorrect(key, "2025-126", "Labor Day and Memorial Day")).toBe(false);
    });

    it("uses the slash alternatives, the parenthetical numbers and the source note", () => {
      expect(isCorrect(key, "2025-093", "Antietam")).toBe(true);
      expect(isCorrect(key, "2025-093", "the Battle of Sharpsburg")).toBe(true);
      expect(isCorrect(key, "2025-063", "citizens eighteen and older can vote")).toBe(true);
      expect(isCorrect(key, "2025-063", "citizens 18 and older")).toBe(true);
      expect(isCorrect(key, "2025-120", "Liberty Island")).toBe(true);
      expect(isCorrect(key, "2025-120", "New Jersey")).toBe(true);
      expect(isCorrect(key, "2025-120", "Texas")).toBe(false);
    });

    it("never scores a dynamic question", () => {
      expect(isCorrect(key, "2025-038", "anything at all")).toBe(false);
      expect(isCorrect(key, "2025-023", "anything at all")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Per-answer markers for parentheses
// ---------------------------------------------------------------------------

describe("per-answer markers for parentheses (tools/answer-key/answer-markers.json)", () => {
  interface Marker {
    question: string;
    line: string;
    group: string;
    parentheses: string;
    replaces: string;
    items?: string[];
    decision: string;
  }
  const markers = markersFile.markers as Marker[];
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entryFor = (marker: Marker) =>
    loadQuietly(marker.question.slice(0, 4) as "2008" | "2025").get(marker.question)!;

  it("has at least the 2025 question 48 marker, each with the owner's decision on record", () => {
    expect(markers.some((m) => m.question === "2025-048")).toBe(true);
    for (const marker of markers) {
      expect(marker.parentheses).toBe("alternative");
      expect(marker.decision.trim().length).toBeGreaterThan(0);
    }
  });

  it("stores every name of a marked alternative as its own accepted answer", () => {
    for (const marker of markers) {
      const entry = entryFor(marker);
      const names = [
        marker.replaces,
        ...(marker.items ?? marker.group.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean)),
      ];
      const pattern = new RegExp(`${escape(marker.replaces)}\\s*${escape(marker.group)}`);
      for (const name of names) {
        expect(entry.acceptedAnswers, `${marker.question}: ${name}`).toContain(
          // Other parentheses on the line stay optional; the redundancy rule keeps the shortest form.
          normalise(marker.line.replace(pattern, name).replace(/\([^)]*\)/g, ""))
        );
      }
    }
  });

  it("does not also store the marked group as optional extra words", () => {
    for (const marker of markers) {
      const asOptional = normalise(marker.line.replace(marker.group, marker.group.slice(1, -1)));
      expect(entryFor(marker).acceptedAnswers).not.toContain(asOptional);
    }
  });

  it("leaves the general rule alone: other parentheses stay optional and are stored both ways", () => {
    const key2025 = loadQuietly("2025");
    expect(key2025.get("2025-040")!.acceptedAnswers).toEqual(
      expect.arrayContaining(["the vice president", "the vice president of the united states"])
    );
    expect(key2025.get("2025-042")!.acceptedAnswers).toEqual(
      expect.arrayContaining(["the president", "the president of the united states"])
    );
    expect(loadQuietly("2008").get("2008-017")!.acceptedAnswers).toEqual(
      expect.arrayContaining(["the senate and house", "the senate and house of representatives"])
    );
  });

  it("question 48 accepts both 'Secretary of War' and 'Secretary of Defense'", () => {
    const key2025 = loadQuietly("2025");
    expect(isCorrect(key2025, "2025-048", "Secretary of War and Attorney General")).toBe(true);
    expect(isCorrect(key2025, "2025-048", "Secretary of Defense and Attorney General")).toBe(true);
    expect(isCorrect(key2025, "2025-048", "the Secretary of Defense and the Vice-President")).toBe(true);
    // It still needs two different answers, and the bare word is not an answer.
    expect(isCorrect(key2025, "2025-048", "Secretary of Defense")).toBe(false);
    expect(isCorrect(key2025, "2025-048", "Defense and Attorney General")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Number rules on the real answer keys
// ---------------------------------------------------------------------------

describe("number rules on real answers", () => {
  const key2008 = loadQuietly("2008");
  const key2025 = loadQuietly("2025");

  it("digits and words are the same number", () => {
    expect(isCorrect(key2025, "2025-121", "because there were thirteen original colonies")).toBe(true);
    expect(isCorrect(key2025, "2025-121", "13 original colonies")).toBe(true);
    expect(isCorrect(key2025, "2025-122", "fifty states")).toBe(true);
    expect(isCorrect(key2025, "2025-122", "because there are 50 states")).toBe(true);
    expect(isCorrect(key2025, "2025-024", "four hundred thirty-five")).toBe(true);
    expect(isCorrect(key2025, "2025-007", "twenty-seven")).toBe(true);
    expect(isCorrect(key2025, "2025-007", "27")).toBe(true);
  });

  it("ordinals: 14th = fourteenth, 22nd = twenty-second", () => {
    expect(isCorrect(key2025, "2025-097", "the fourteenth amendment")).toBe(true);
    expect(isCorrect(key2025, "2025-097", "14th amendment")).toBe(true);
    expect(isCorrect(key2025, "2025-097", "the thirteenth amendment")).toBe(false);
    expect(isCorrect(key2025, "2025-037", "because of the twenty-second amendment")).toBe(true);
    expect(isCorrect(key2025, "2025-037", "the 22nd amendment")).toBe(true);
    expect(isCorrect(key2025, "2025-107", "thirty-fourth president of the United States")).toBe(true);
    expect(isCorrect(key2025, "2025-060", "the tenth amendment")).toBe(false); // answer is a sentence, not the number
  });

  it("a number with a unit: the number alone is enough", () => {
    expect(isCorrect(key2025, "2025-022", "six")).toBe(true);
    expect(isCorrect(key2025, "2025-022", "6")).toBe(true);
    expect(isCorrect(key2025, "2025-022", "six years")).toBe(true);
    expect(isCorrect(key2025, "2025-022", "seven")).toBe(false);
    expect(isCorrect(key2025, "2025-025", "two")).toBe(true);
    expect(isCorrect(key2025, "2025-036", "four")).toBe(true);
    expect(isCorrect(key2025, "2025-036", "four years")).toBe(true);
    expect(isCorrect(key2025, "2025-036", "five")).toBe(false);
  });

  it("a number that continues does not match", () => {
    expect(isCorrect(key2025, "2025-021", "one hundred and one")).toBe(false);
    expect(isCorrect(key2025, "2025-021", "one hundred one")).toBe(false);
    expect(isCorrect(key2008, "2008-018", "one hundred and one")).toBe(false);
    expect(isCorrect(key2025, "2025-025", "twenty two")).toBe(false);
    expect(isCorrect(key2025, "2025-022", "twenty six")).toBe(false);
    expect(isCorrect(key2025, "2025-027", "twenty two")).toBe(false);
  });

  it("a number with a noun that is not a unit still needs the noun", () => {
    expect(isCorrect(key2025, "2025-121", "thirteen")).toBe(false);
    expect(isCorrect(key2025, "2025-122", "fifty")).toBe(false);
  });
});
