import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import sourcesReadme from "../../../data/sources/README.md?raw";
import readingText from "../../../data/sources/uscis-reading-vocab.txt?raw";
import writingText from "../../../data/sources/uscis-writing-vocab.txt?raw";
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
  it("loads and holds a share between 0 and 1 for each stage", () => {
    const config = loadPracticeConfig();
    for (const kind of ["reading", "writing"] as const) {
      expect(config.sentenceMatch[kind].minWordAccuracy).toBeGreaterThan(0);
      expect(config.sentenceMatch[kind].minWordAccuracy).toBeLessThanOrEqual(1);
    }
  });

  it("says in the file that it is not a USCIS rule", () => {
    const raw = JSON.parse(configRaw) as { note: string };
    expect(raw.note).toMatch(/NOT USCIS rules/);
  });

  it("rejects values outside the range and wrong shapes", () => {
    const base = { needsHumanReview: true, sentenceMatch: { reading: { minWordAccuracy: 0.8 }, writing: { minWordAccuracy: 0.9 } } };
    expect(() => parsePracticeConfig(base)).not.toThrow();
    for (const bad of [0, -0.1, 1.1, Number.NaN, "0.8"]) {
      expect(() =>
        parsePracticeConfig({ ...base, sentenceMatch: { ...base.sentenceMatch, reading: { minWordAccuracy: bad } } })
      ).toThrow();
    }
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
