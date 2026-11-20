/** The review sheets in docs/ are generated; they must match the locale files. */
import { describe, expect, it } from "vitest";
import enRaw from "../locales/en.json";
import backTranslations from "../review/back-translations.json";
import viChanges from "../review/vi-wording-changes.json";
import { CATALOGS, LOCALE_STATUS } from "../index";
import { LANGUAGES } from "../languages";
import { buildIndex, buildSheet, otherCodes, type ReviewData } from "../review/build-sheets";
import indexDoc from "../../../docs/locale-review.md?raw";

const sheets = import.meta.glob("../../../docs/locale-review/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const oldSheet = import.meta.glob("../../../docs/vi-locale-review.md", { query: "?raw", import: "default", eager: true });
const en = enRaw as Record<string, string>;
const data = {
  languages: LANGUAGES,
  en,
  catalogs: CATALOGS,
  status: LOCALE_STATUS,
  backTranslations,
  viChanges,
} as unknown as ReviewData;
const codes = otherCodes(data);
const sheetOf = (code: string) => sheets[`../../../docs/locale-review/${code}.md`];

describe("review sheets", () => {
  it("docs/locale-review.md is up to date (run tools/i18n/build-locale-review.mjs)", () => {
    expect(indexDoc).toBe(buildIndex(data));
  });
  it("there is one sheet per language, 13 in all", () => {
    expect(Object.keys(sheets)).toHaveLength(13);
    expect(codes).toHaveLength(13);
  });
  it.each(codes)("sheet %s is up to date and lists every key", (code) => {
    const text = sheetOf(code) ?? "";
    expect(text).toBe(buildSheet(code, data));
    for (const key of Object.keys(en)) expect(text, key).toContain("`" + key + "`");
  });
  it("puts the disclaimers first", () => {
    const text = buildSheet("th", data);
    expect(text.indexOf("`disclaimer.full`")).toBeLessThan(text.indexOf("`app.name`"));
    expect(text.indexOf("Disclaimers, legal")).toBeLessThan(text.indexOf("All other lines"));
  });
  it("the old Vietnamese-only sheet is gone", () => {
    expect(Object.keys(oldSheet)).toHaveLength(0);
  });
});
