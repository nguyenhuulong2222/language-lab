import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { availableUiLanguages, CATALOGS, LOCALE_STATUS, preloadAllLocales } from "../index";
import { detectLanguage, languageForTag } from "../detect-language";
import { IN_REVIEW_LANGUAGES, LANGUAGE_CODES, type LanguageCode } from "../languages";

const ALL: readonly LanguageCode[] = LANGUAGE_CODES;

describe("languageForTag", () => {
  it.each([
    ["vi-VN", "vi"],
    ["es-US", "es"],
    ["zh-TW", "zh"],
    ["zh-Hant", "zh"],
    ["zh-HK", "zh"],
    ["zh", "zh"],
    ["zh-CN", "zh"],
    ["fil", "tl"],
    ["fil-PH", "tl"],
    ["tl", "tl"],
    ["pt-BR", "pt"],
    ["ko-KR", "ko"],
    ["hi-IN", "hi"],
    ["th-TH", "th"],
    ["ru-RU", "ru"],
    ["en-US", "en"],
    ["EN_gb", "en"],
    ["hmn", "hmn"],
  ] as const)("%s → %s", (tag, code) => {
    expect(languageForTag(tag)).toBe(code);
  });
  it("knows nothing about other languages", () => {
    for (const tag of ["fr-FR", "de", "ar-EG", "uk", "", "  ", "-"]) expect(languageForTag(tag), tag).toBeNull();
  });
});

describe("detectLanguage", () => {
  it("takes the first preferred language that is offered", () => {
    expect(detectLanguage(["vi-VN", "en-US"], ALL)).toBe("vi");
    expect(detectLanguage(["fr-FR", "es-MX", "en"], ALL)).toBe("es");
    expect(detectLanguage(["zh-Hant-TW"], ALL)).toBe("zh");
  });
  it("is English when nothing matches, or the list is empty", () => {
    expect(detectLanguage(["fr-FR"], ALL)).toBe("en");
    expect(detectLanguage([], ALL)).toBe("en");
  });
  it("skips a language this build does not offer", () => {
    expect(detectLanguage(["my-MM", "vi"], ["en", "vi"])).toBe("vi");
    expect(detectLanguage(["my-MM"], ["en", "vi"])).toBe("en");
  });
  it("property: the result is always offered, and English when no tag matches", () => {
    const tag = fc.oneof(
      fc.constantFrom(...ALL, "fil", "zh-TW", "pt-BR", "vi-VN", "fr-FR", "de-DE", "ar"),
      fc.string({ maxLength: 12 })
    );
    const offered = fc.subarray([...ALL]).map((list) => (list.includes("en") ? list : ["en" as LanguageCode, ...list]));
    fc.assert(
      fc.property(fc.array(tag, { maxLength: 6 }), offered, (list, codes) => {
        const result = detectLanguage(list, codes);
        expect(codes).toContain(result);
        const matches = list.some((t) => {
          const code = languageForTag(t);
          return code !== null && codes.includes(code);
        });
        if (!matches) expect(result).toBe("en");
      })
    );
  });
  it("property: in production a language still in review is never chosen", async () => {
    await preloadAllLocales();
    const offered = availableUiLanguages(CATALOGS, LOCALE_STATUS, true).map((l) => l.code);
    const hidden = IN_REVIEW_LANGUAGES.filter((code) => !offered.includes(code));
    expect(hidden.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...ALL, "fr", "de"), { maxLength: 6 }), (list) => {
        expect(hidden).not.toContain(detectLanguage(list, offered));
      })
    );
    expect(detectLanguage(["hmn", "lo-LA", "my", "ht"], offered)).toBe("en");
  });
});
