/**
 * Licence scope (docs/audit finding DEP-01): the repository holds no non-English civics translation.
 * data/translations/civics/ has the official English display text (en.json, built from the USCIS
 * source files) and nothing else. The translations that used to be imported came from a separate
 * project (formN400.org) that is not covered by this repository's licence.
 * Add a non-English file here only together with a written licence for it and a change to NOTICE.
 */
import { describe, it, expect } from "vitest";

const files = Object.keys(import.meta.glob("../../../data/translations/**/*", { query: "?url", import: "default" }));
const names = files.map((f) => f.split("data/translations/")[1] as string).sort();

describe("no non-English civics translation file exists", () => {
  it("data/translations holds exactly the two English display files", () => {
    expect(names).toEqual(["civics/2008/en.json", "civics/2025/en.json"]);
  });
  it("no file in data/ is named like a language file of the 13 other languages", () => {
    const others = ["vi", "es", "zh", "tl", "ko", "hi", "ht", "th", "lo", "hmn", "my", "pt", "ru"];
    const all = Object.keys(import.meta.glob("../../../data/**/*.json", { query: "?url", import: "default" }));
    const bad = all.filter((f) => others.some((code) => f.endsWith(`/${code}.json`)));
    expect(bad).toEqual([]);
  });
});

const sources = import.meta.glob(["../../**/*.ts", "../../**/*.tsx", "!../../**/__tests__/**"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
describe("no source file reads translated civics text", () => {
  it("only the English display text is imported from data/translations", () => {
    const users = Object.entries(sources).filter(([, text]) => /data\/translations/.test(text));
    expect(users.map(([f]) => f.replace(/^(\.\.\/)+/, ""))).toEqual(["engine/official-answer-text.ts"]);
    for (const [, text] of users) {
      const imports = [...text.matchAll(/(?:from |import\()"([^"]*data\/translations[^"]*)"/g)].map((m) => m[1] as string);
      expect(imports.length).toBeGreaterThan(0);
      expect(imports.every((i) => i.endsWith("/en.json"))).toBe(true);
    }
  });
  it("TranslatedQuestion and loadCivicsDisplay no longer exist", () => {
    expect(Object.values(sources).some((t) => /TranslatedQuestion|loadCivicsDisplay|civics-translations/.test(t))).toBe(false);
  });
});
