/**
 * Checks the translation files in data/translations/civics/ and the display logic.
 * The files are display-only: scoring never reads them.
 */
import { describe, it, expect, vi } from "vitest";
import {
  buildDisplay,
  loadCivicsDisplay,
  type EnglishFile,
  type TranslationFile,
} from "../civics-translations";
import { LANGUAGE_CODES, type LanguageCode } from "../languages";
import { loadAnswerKey } from "../../engine/civics-answer-key";

const files = import.meta.glob("../../../data/translations/civics/*/*.json", {
  import: "default",
  eager: true,
}) as Record<string, EnglishFile | TranslationFile>;

const loose = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function fileFor(version: string, language: string) {
  return files[`../../../data/translations/civics/${version}/${language}.json`];
}

const quiet = (version: "2008" | "2025") => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    return loadAnswerKey(version, { production: false });
  } finally {
    warn.mockRestore();
  }
};

const VERSIONS = [
  { version: "2008" as const, count: 100 },
  { version: "2025" as const, count: 128 },
];

describe("file set", () => {
  it("has exactly the 14 languages for each set, and none of the six frame languages", () => {
    for (const { version } of VERSIONS) {
      const present = Object.keys(files)
        .filter((f) => f.includes(`/civics/${version}/`))
        .map((f) => /\/([a-z]+)\.json$/.exec(f)![1])
        .sort();
      expect(present).toEqual([...LANGUAGE_CODES].sort());
    }
  });
});

describe.each(VERSIONS)("$version English display file", ({ version, count }) => {
  const english = fileFor(version, "en") as EnglishFile;
  const key = quiet(version);

  it("covers every question and matches the answer key's question text", () => {
    expect(Object.keys(english.entries)).toHaveLength(count);
    for (const [id, entry] of Object.entries(english.entries)) {
      expect(loose(entry.question), id).toBe(loose(key.get(id)!.questionText));
    }
  });

  it("has answer lines for static questions and none for dynamic ones", () => {
    for (const [id, entry] of Object.entries(english.entries)) {
      const dynamic = key.get(id)!.answerType === "dynamic";
      expect(entry.answers === null, id).toBe(dynamic);
      if (entry.answers) expect(entry.answers.length, id).toBeGreaterThan(0);
    }
  });
});

describe.each(VERSIONS)("$version translation files", ({ version, count }) => {
  const english = fileFor(version, "en") as EnglishFile;
  const ids = Object.keys(english.entries);

  for (const code of LANGUAGE_CODES.filter((c) => c !== "en")) {
    it(`${code}: every question is either translated or listed as missing, never both`, () => {
      const file = fileFor(version, code) as TranslationFile;
      expect(file.language).toBe(code);
      expect(file.testVersion).toBe(version);
      const translated = Object.keys(file.entries);
      const missing = Object.keys(file.missing);
      expect(translated.filter((id) => id in file.missing)).toEqual([]);
      expect([...translated, ...missing].sort()).toEqual([...ids].sort());
      expect(translated.length + missing.length).toBe(count);
    });

    it(`${code}: needs human review, every entry has a status and text`, () => {
      const file = fileFor(version, code) as TranslationFile;
      expect(file.needsHumanReview).toBe(true);
      for (const [id, entry] of Object.entries(file.entries)) {
        expect(entry.status, id).toBe("source");
        expect(entry.question.trim().length, id).toBeGreaterThan(0);
      }
    });

    it(`${code}: answer lines pair one to one with the English lines`, () => {
      const file = fileFor(version, code) as TranslationFile;
      for (const [id, entry] of Object.entries(file.entries)) {
        if (entry.answers === null) continue;
        const englishLines = english.entries[id]!.answers;
        expect(englishLines, id).not.toBeNull();
        expect(entry.answers.length, id).toBe(englishLines!.length);
        for (const line of entry.answers) expect(line.trim().length, id).toBeGreaterThan(0);
      }
    });
  }

  it("no machine-suggested text: languages that only have suggested text have no entries", () => {
    for (const code of ["hi", "lo", "hmn", "my"] as const) {
      const file = fileFor(version, code) as TranslationFile;
      expect(Object.keys(file.entries), code).toEqual([]);
      expect(Object.values(file.missing).every((r) => r === "machine-suggested" || r === "not-in-source")).toBe(true);
    }
  });

  it("records where the text came from", () => {
    const vi_ = fileFor(version, "vi") as unknown as {
      provenance: { commit: string; contentVersion: string; tier: string };
    };
    expect(vi_.provenance.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(vi_.provenance.contentVersion.length).toBeGreaterThan(0);
  });
});

describe("buildDisplay", () => {
  const english = { question: "What is the supreme law of the land?", answers: ["the Constitution"] };
  const translation: TranslationFile = {
    language: "vi",
    testVersion: "2008",
    needsHumanReview: true,
    entries: { "2008-001": { question: "vi text", answers: null, status: "source" } },
    missing: { "2008-002": "machine-suggested" },
  };

  it("shows English only for English", () => {
    expect(buildDisplay({ id: "2008-001", language: "en", english, translation: null }).kind).toBe("english");
  });
  it("shows both for a translated question", () => {
    const d = buildDisplay({ id: "2008-001", language: "vi", english, translation });
    expect(d.kind).toBe("translated");
  });
  it("marks a question without a translation, and a language without a file", () => {
    expect(buildDisplay({ id: "2008-002", language: "vi", english, translation }).kind).toBe("untranslated");
    expect(buildDisplay({ id: "2008-001", language: "hi", english, translation: null }).kind).toBe("untranslated");
  });
});

describe("loadCivicsDisplay", () => {
  it("loads English, a translated question and an untranslated one", async () => {
    const en = await loadCivicsDisplay("2008", "en", "2008-007");
    expect(en.kind).toBe("english");
    const vi = await loadCivicsDisplay("2008", "vi", "2008-007");
    expect(vi.kind).toBe("translated");
    const hi = await loadCivicsDisplay("2008", "hi", "2008-007");
    expect(hi.kind).toBe("untranslated");
    await expect(loadCivicsDisplay("2008", "vi", "2008-999")).rejects.toThrow();
  });

  it("every language code loads without error for a question", async () => {
    for (const code of LANGUAGE_CODES as readonly LanguageCode[]) {
      const d = await loadCivicsDisplay("2025", code, "2025-002");
      expect(["english", "translated", "untranslated"]).toContain(d.kind);
    }
  });
});
