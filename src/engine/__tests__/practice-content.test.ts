import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import sourcesReadme from "../../../data/sources/README.md?raw";
import readingText from "../../../data/sources/uscis-reading-vocab.txt?raw";
import writingText from "../../../data/sources/uscis-writing-vocab.txt?raw";
import policyText from "../../../data/sources/uscis-policy-manual-vol12-parte-ch2-reading-writing.txt?raw";
import configRaw from "../../../data/practice/practice-config.json?raw";
import profilesRaw from "../../../data/practice/profiles.json?raw";
import n400Raw from "../../../data/practice/n400-questions.json?raw";
import readingSentencesRaw from "../../../data/practice/reading-sentences.json?raw";
import writingSentencesRaw from "../../../data/practice/writing-sentences.json?raw";
import vocabularyRaw from "../../../data/practice/vocabulary.json?raw";
import {
  loadPracticeContent,
  parseN400Questions,
  parseProfiles,
  parseSentences,
  vocabularyWords,
  wordsOutsideVocabulary,
} from "../practice-content";
import { loadPracticeConfig, parsePracticeConfig } from "../practice-config";
import { loadEnglishRules } from "../test-rules-loader";

const content = loadPracticeContent();

describe("practice config", () => {
  it("loads the scoring settings for each stage", () => {
    const config = loadPracticeConfig();
    for (const kind of ["reading", "writing"] as const) {
      expect(Number.isInteger(config.sentenceMatch[kind].extraContentWordsAllowed)).toBe(true);
      expect(typeof config.sentenceMatch[kind].spellingTolerance).toBe("boolean");
    }
    expect(config.sentenceMatch.functionWords.length).toBeGreaterThan(0);
  });

  it("says in the file that it is not a USCIS rule", () => {
    const raw = JSON.parse(configRaw) as { note: string };
    expect(raw.note).toMatch(/NOT USCIS rules/);
  });

  it("rejects values outside the range and wrong shapes", () => {
    const stage = { extraContentWordsAllowed: 1, spellingTolerance: false };
    const base = { needsHumanReview: true, sentenceMatch: { functionWords: ["the"], neverStem: ["news"], reading: stage, writing: stage } };
    expect(() => parsePracticeConfig(base)).not.toThrow();
    for (const bad of [-1, 1.5, 4, Number.NaN, "1"]) {
      expect(() =>
        parsePracticeConfig({ ...base, sentenceMatch: { ...base.sentenceMatch, reading: { ...stage, extraContentWordsAllowed: bad } } })
      ).toThrow();
    }
    expect(() => parsePracticeConfig({ ...base, sentenceMatch: { ...base.sentenceMatch, functionWords: ["The"] } })).toThrow();
    expect(() => parsePracticeConfig({ ...base, sentenceMatch: { ...base.sentenceMatch, writing: { ...stage, spellingTolerance: "yes" } } })).toThrow();
    expect(() => parsePracticeConfig(null)).toThrow();
    expect(() => parsePracticeConfig({ ...base, needsHumanReview: "yes" })).toThrow();
  });
});

describe("vocabulary files", () => {
  it("name an official uscis.gov URL and a checksum, both recorded in data/sources/README.md", () => {
    for (const kind of ["reading", "writing"] as const) {
      const list = content.vocabulary[kind];
      expect(list.sourceUrl).toMatch(/^https:\/\/www\.uscis\.gov\//);
      expect(sourcesReadme).toContain(list.sourceUrl);
      expect(sourcesReadme).toContain(`${list.sha256}  uscis-${kind}-vocab.pdf`);
    }
  });

  it("every vocabulary entry appears in the converted text of its official PDF", () => {
    for (const kind of ["reading", "writing"] as const) {
      const text = (kind === "reading" ? readingText : writingText).replace(/\s+/g, " ");
      for (const entries of Object.values(content.vocabulary[kind].categories)) {
        for (const entry of entries) {
          for (const alternative of entry.split("/")) {
            expect(text, `${kind}: ${alternative}`).toContain(alternative.trim());
          }
        }
      }
    }
  });
});

describe.each(["reading", "writing"] as const)("%s sentences", (kind) => {
  const sentences = kind === "reading" ? content.readingSentences : content.writingSentences;
  const allowed = vocabularyWords(content.vocabulary[kind]);

  it("use only words from the official list", () => {
    for (const sentence of sentences) {
      expect(wordsOutsideVocabulary(sentence.text, allowed), `${sentence.id}: ${sentence.text}`).toEqual([]);
    }
  });

  it("are enough for the number of sentences the rules present", () => {
    expect(sentences.length).toBeGreaterThanOrEqual(loadEnglishRules()[kind].sentencesPresented.value);
  });

  it("have unique ids and unique text", () => {
    expect(new Set(sentences.map((s) => s.id)).size).toBe(sentences.length);
    expect(new Set(sentences.map((s) => s.text)).size).toBe(sentences.length);
  });
});

describe("the checker itself", () => {
  const allowed = vocabularyWords(content.vocabulary.reading);
  it("finds a word that is not on the list", () => {
    expect(wordsOutsideVocabulary("Who was George Washington?", allowed)).toEqual([]);
    expect(wordsOutsideVocabulary("Who was the banana king?", allowed)).toEqual(["banana", "king"]);
  });
  it("splits slash alternatives", () => {
    expect(allowed.has("do")).toBe(true);
    expect(allowed.has("does")).toBe(true);
  });
  it("property: a sentence made of listed words is always inside the list", () => {
    const words = [...allowed];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...words), { minLength: 1, maxLength: 12 }), (picked) => {
        return wordsOutsideVocabulary(picked.join(" "), allowed).length === 0;
      }),
      { numRuns: 200 }
    );
  });
});

describe("profiles and the N-400 script", () => {
  it("all profiles are fictional", () => {
    expect(content.profiles.length).toBeGreaterThan(1);
    for (const p of content.profiles) expect(p.id).toMatch(/^fictional-profile-/);
  });

  it("every profile has a sample answer for every question", () => {
    expect(content.n400Questions.length).toBeGreaterThan(0);
    for (const q of content.n400Questions) {
      for (const p of content.profiles) expect(q.sampleAnswers[p.id], `${q.id} ${p.id}`).toBeTruthy();
    }
  });

  it("holds no A-number and no real-looking ID", () => {
    expect(JSON.stringify(content)).not.toMatch(/\bA[- ]?\d{8,9}\b/);
  });

  it("rejects bad data", () => {
    const raw = JSON.parse(profilesRaw);
    expect(() => parseProfiles({ ...raw, isFictional: false })).toThrow();
    expect(() => parseProfiles({ ...raw, needsHumanReview: false })).toThrow();
    expect(() => parseProfiles({ ...raw, profiles: [{ id: "real-person", displayName: "X", isFictional: true }] })).toThrow();
    const profiles = parseProfiles(raw);
    expect(() =>
      parseN400Questions(
        { needsHumanReview: true, isFictional: true, questions: [{ id: "q", topic: "t", text: "Q?", sampleAnswers: {} }] },
        profiles
      )
    ).toThrow();
    expect(() => parseSentences({ needsHumanReview: true, kind: "writing", sentences: [{ id: "a", text: "x" }] }, "reading")).toThrow();
    expect(() => parseSentences({ needsHumanReview: true, kind: "reading", sentences: [{ id: "a", text: "My ID is A123456789" }] }, "reading")).toThrow();
  });

  it("every data file is marked needsHumanReview", () => {
    const files = { profilesRaw, n400Raw, readingSentencesRaw, writingSentencesRaw, vocabularyRaw, configRaw };
    for (const [name, text] of Object.entries(files)) {
      const raw = JSON.parse(text) as { needsHumanReview?: boolean };
      expect(raw.needsHumanReview, name).toBe(true);
    }
  });
});

describe("the scoring guidelines source", () => {
  const basis = (JSON.parse(configRaw) as { scoringBasis: { url: string; savedAs: string; sha256: string } }).scoringBasis;
  it("is saved in data/sources with its URL and SHA-256, and the config names both", async () => {
    expect(basis.url).toBe("https://www.uscis.gov/policy-manual/volume-12-part-e-chapter-2");
    expect(sourcesReadme).toContain(basis.url);
    expect(sourcesReadme).toContain(`${basis.sha256}  uscis-policy-manual-vol12-parte-ch2-reading-writing.txt`);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(policyText));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(hex).toBe(basis.sha256);
  });
  it("holds the sentences the spec and the rule rely on", () => {
    for (const quote of [
      "the alien must read all content words but may omit short words or make pronunciation or intonation errors that do not interfere with the meaning",
      "Omits a content word or substitutes another word for a content word",
      "Omitted short words that do not interfere with meaning",
      "does not fail the writing test because of spelling, capitalization, or punctuation errors",
    ]) {
      expect(policyText).toContain(quote);
    }
  });
  it("the function words in the config are the Other (Function) words of the two official lists", () => {
    const fn = new Set<string>();
    for (const kind of ["reading", "writing"] as const) for (const w of content.vocabulary[kind].categories["otherFunction"] ?? []) fn.add(w.toLowerCase());
    expect(new Set(loadPracticeConfig().sentenceMatch.functionWords)).toEqual(fn);
  });
});
