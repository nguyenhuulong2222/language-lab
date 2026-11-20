/**
 * Owner rule: legal text is never machine translated. Without a named reviewer, the legal keys show
 * English; the production menu hides the languages still in review.
 */
import { describe, expect, it } from "vitest";
import enRaw from "../locales/en.json";
import { CATALOGS, LANGUAGE_CODES, availableUiLanguages, createTranslator, isEnglishOnly, LOCALE_STATUS } from "../index";
import { IN_REVIEW_LANGUAGES } from "../languages";
import { LEGAL_KEYS, isLegalKey } from "../legal-keys";
import { isReviewed } from "../locale-checks";
const en = enRaw as Record<string, string>;
const reviewedMeta = { source: "human-reviewed", reviewedBy: "A. Reviewer", reviewedOn: "2026-12-01" } as const;
describe("legal keys", () => {
  it("every legal key exists in en.json", () => {
    for (const key of LEGAL_KEYS) expect(en[key], key).toBeTypeOf("string");
  });
  it("has no duplicates", () => {
    expect(new Set(LEGAL_KEYS).size).toBe(LEGAL_KEYS.length);
  });
  it("English is never English-only (it is the source)", () => {
    for (const key of LEGAL_KEYS) expect(isEnglishOnly("en", key, LOCALE_STATUS)).toBe(false);
  });
  it("every language without a named reviewer shows English for every legal key", () => {
    for (const code of LANGUAGE_CODES) {
      if (code === "en" || isReviewed(LOCALE_STATUS[code])) continue;
      const t = createTranslator(code, CATALOGS, LOCALE_STATUS);
      for (const key of LEGAL_KEYS) expect(t(key as never), `${code} ${key}`).toBe(en[key]);
    }
  });
  it("a reviewed language shows its own text", () => {
    const catalogs = { ...CATALOGS, vi: { ...CATALOGS.vi, "disclaimer.title": "Xin hãy đọc phần này" } } as typeof CATALOGS;
    const t = createTranslator("vi", catalogs, { ...LOCALE_STATUS, vi: reviewedMeta });
    expect(t("disclaimer.title")).toBe("Xin hãy đọc phần này");
    expect(isEnglishOnly("vi", "disclaimer.title", { ...LOCALE_STATUS, vi: reviewedMeta })).toBe(false);
  });
  it("other keys stay translated", () => {
    expect(isLegalKey("home.choose")).toBe(false);
    expect(createTranslator("vi", CATALOGS, LOCALE_STATUS)("home.choose")).not.toBe(en["home.choose"]);
  });
  it("the two new lines exist in every language, translated", () => {
    for (const code of LANGUAGE_CODES) {
      if (code === "en") continue;
      for (const key of ["aiNotice.legalEnglish", "lang.menu.inReview"]) {
        const text = (CATALOGS[code] as Record<string, string>)[key];
        expect(text, `${code} ${key}`).toBeTypeOf("string");
        expect(text, `${code} ${key}`).not.toBe(en[key]);
      }
    }
  });
});
describe("production language menu", () => {
  it("hides hmn, lo, my and ht until a reviewer is recorded", () => {
    const codes = availableUiLanguages(CATALOGS, LOCALE_STATUS, true).map((l) => l.code);
    for (const code of IN_REVIEW_LANGUAGES) expect(codes).not.toContain(code);
    expect(codes).toContain("vi");
    expect(IN_REVIEW_LANGUAGES).toEqual(["hmn", "lo", "my", "ht"]);
  });
  it("keeps them in development", () => {
    const codes = availableUiLanguages(CATALOGS, LOCALE_STATUS, false).map((l) => l.code);
    for (const code of IN_REVIEW_LANGUAGES) expect(codes).toContain(code);
  });
});
