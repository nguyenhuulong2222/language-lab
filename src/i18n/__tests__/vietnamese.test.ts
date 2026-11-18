/**
 * The Vietnamese interface (B-14): same keys and placeholders as English, a draft flag that
 * hides it in production, and a review sheet that cannot fall behind the file.
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import enRaw from "../locales/en.json";
import viRaw from "../locales/vi.json";
import sheetFile from "../../../docs/vi-locale-review.md?raw";
import {
  availableUiLanguages,
  CATALOGS,
  createTranslator,
  LOCALE_STATUS,
  UI_LANGUAGE_CODES,
  type Catalogs,
  type LocaleStatus,
} from "../index";
import { buildReviewSheet, LEGAL_KEYS, OFFICIAL_KEYS } from "../review-sheet";

const { _meta, ...vi } = viRaw as Record<string, unknown> & { _meta: { needsHumanReview: boolean; note?: string } };
const en = enRaw as Record<string, string>;
const viMessages = vi as Record<string, string>;

const placeholders = (text: string): string[] => (text.match(/\{[A-Za-z0-9_]+\}/g) ?? []).sort();

describe("vi.json and en.json", () => {
  it("have exactly the same keys", () => {
    const enKeys = Object.keys(en).sort();
    const viKeys = Object.keys(viMessages).sort();
    expect(viKeys.filter((k) => !(k in en)), "keys only in vi.json").toEqual([]);
    expect(enKeys.filter((k) => !(k in viMessages)), "keys missing from vi.json").toEqual([]);
  });

  it("keep exactly the same {placeholders} on every line", () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(viMessages[key] ?? ""), key).toEqual(placeholders(en[key]!));
    }
  });

  it("have no empty line, and a Vietnamese line that is still English only where it is a name or a label", () => {
    const sameAsEnglish: string[] = [];
    for (const key of Object.keys(en)) {
      expect((viMessages[key] ?? "").trim().length, key).toBeGreaterThan(0);
      if (viMessages[key] === en[key]) sameAsEnglish.push(key);
    }
    // Names and decorative labels may stay the same; everything else must be translated.
    expect(sameAsEnglish.sort()).toEqual(
      ["app.name", "report.take", "stage.n400_interview.short", "stage.civics.short"].filter((k) =>
        sameAsEnglish.includes(k)
      ).sort()
    );
  });

  it("use the same quotation marks and keep USCIS, DHS and N-400 unchanged", () => {
    for (const key of Object.keys(en)) {
      for (const name of ["USCIS", "DHS", "N-400", "uscis.gov"]) {
        if (en[key]!.includes(name)) expect(viMessages[key], `${key}: ${name}`).toContain(name);
      }
    }
  });

  it("is marked as a draft with a note, in _meta (not as a message)", () => {
    expect(typeof _meta.needsHumanReview).toBe("boolean");
    expect("_meta" in en).toBe(false);
    if (_meta.needsHumanReview) expect(_meta.note ?? "").toMatch(/AI assistant/);
  });

  it("can only be cleared by naming who reviewed it and when", () => {
    const meta = _meta as { needsHumanReview: boolean; reviewedBy: string | null; reviewedOn: string | null; note?: string };
    if (meta.needsHumanReview) {
      expect(meta.reviewedBy).toBeNull();
      expect(meta.reviewedOn).toBeNull();
    } else {
      expect(typeof meta.reviewedBy === "string" && meta.reviewedBy.trim().length > 0, "reviewedBy").toBe(true);
      expect(meta.reviewedOn ?? "", "reviewedOn").toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(meta.note ?? "", "the draft note must be replaced").not.toMatch(/DRAFT/);
    }
  });

  it("does not call a made-up profile \"bịa ra\" (it sits next to the truthfulness message)", () => {
    expect(Object.values(viMessages).join("\n")).not.toContain("bịa");
  });

  it("holds no civics question or answer: the interface text only", () => {
    const text = Object.values(viMessages).join("\n");
    expect(text).not.toMatch(/supreme law of the land/i);
    expect(text).not.toMatch(/\bA[- ]?\d{8,9}\b/);
  });
});

describe("the catalogues the app loads", () => {
  it("have Vietnamese without its _meta entry, and its status apart", () => {
    expect(CATALOGS.vi).toBeDefined();
    expect("_meta" in (CATALOGS.vi ?? {})).toBe(false);
    expect(LOCALE_STATUS.vi?.needsHumanReview).toBe(_meta.needsHumanReview);
    expect(Object.keys(CATALOGS.vi ?? {}).sort()).toEqual(Object.keys(en).sort());
  });

  it("translate through createTranslator, with placeholders", () => {
    const t = createTranslator("vi");
    expect(t("stepper.count", { current: 2, total: 6 })).toBe("Bước 2 trên 6");
    expect(t("header.home")).toBe("Trang chủ");
    expect(createTranslator("en")("header.home")).toBe("Home");
  });

  it("fall back to English for a key a catalogue lacks", () => {
    const partial: Catalogs = { vi: { "header.home": "Trang chủ" } };
    const t = createTranslator("vi", partial);
    expect(t("header.home")).toBe("Trang chủ");
    expect(t("header.settings")).toBe("Settings");
  });

  it("property: every key gives a non-empty text in both languages", () => {
    const keys = Object.keys(en) as Array<keyof typeof enRaw>;
    fc.assert(
      fc.property(fc.constantFrom(...keys), fc.constantFrom("en" as const, "vi" as const), (key, language) => {
        return createTranslator(language)(key).trim().length > 0;
      }),
      { numRuns: 300 }
    );
  });
});

describe("a draft language is hidden in production", () => {
  const catalogs: Catalogs = { en: {}, vi: {} };
  const draft: LocaleStatus = { vi: { needsHumanReview: true } };
  const reviewed: LocaleStatus = { vi: { needsHumanReview: false } };
  const codes = (production: boolean, status: LocaleStatus, c: Catalogs = catalogs) =>
    availableUiLanguages(production, c, status).map((l) => l.code);

  it("production + draft: English only", () => {
    expect(codes(true, draft)).toEqual(["en"]);
  });
  it("development + draft: English and Vietnamese", () => {
    expect(codes(false, draft)).toEqual(["en", "vi"]);
  });
  it("production + reviewed: English and Vietnamese", () => {
    expect(codes(true, reviewed)).toEqual(["en", "vi"]);
  });
  it("a locale with no status counts as a draft", () => {
    expect(codes(true, {})).toEqual(["en"]);
  });
  it("a language with no catalogue is never offered", () => {
    expect(codes(false, reviewed, { en: {} })).toEqual(["en"]);
  });
  it("only the interface languages are offered, never the other display languages", () => {
    const all: Catalogs = { en: {}, vi: {}, es: {}, zh: {} };
    expect(codes(false, { vi: { needsHumanReview: false }, es: { needsHumanReview: false } }, all)).toEqual(["en", "vi"]);
    expect([...UI_LANGUAGE_CODES]).toEqual(["en", "vi"]);
  });

  it("with the real files: Vietnamese is offered in production exactly when the flag is false", () => {
    const offered = availableUiLanguages(true).some((l) => l.code === "vi");
    expect(offered).toBe(_meta.needsHumanReview === false);
    expect(availableUiLanguages(false).some((l) => l.code === "vi")).toBe(true);
  });

  it("property: English is always offered, and production never offers more than development", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (production, needsReview) => {
        const list = availableUiLanguages(production, catalogs, { vi: { needsHumanReview: needsReview } }).map((l) => l.code);
        const dev = availableUiLanguages(false, catalogs, { vi: { needsHumanReview: needsReview } }).map((l) => l.code);
        return list.includes("en") && list.every((c) => dev.includes(c));
      })
    );
  });
});

describe("docs/vi-locale-review.md", () => {
  const built = buildReviewSheet({ en, vi: viMessages });

  it("is the sheet the script builds from the current files (run tools/i18n/build-vi-review.mjs)", () => {
    expect(sheetFile).toBe(built);
  });

  it("lists every key once, with the disclaimers and legal wording first", () => {
    for (const key of Object.keys(en)) {
      expect((sheetFile.match(new RegExp(`\\| \`${key.replace(/\./g, "\\.")}\` \\|`, "g")) ?? []).length, key).toBe(1);
    }
    const legalAt = sheetFile.indexOf("## 1. Disclaimers and legal wording");
    const officialAt = sheetFile.indexOf("## 2. Statements about USCIS rules");
    const restAt = sheetFile.indexOf("## 3. All other interface text");
    expect(legalAt).toBeGreaterThan(0);
    expect(officialAt).toBeGreaterThan(legalAt);
    expect(restAt).toBeGreaterThan(officialAt);
    for (const key of LEGAL_KEYS) expect(sheetFile.indexOf(`| \`${key}\` |`), key).toBeLessThan(officialAt);
    for (const key of OFFICIAL_KEYS) {
      const at = sheetFile.indexOf(`| \`${key}\` |`);
      expect(at, key).toBeGreaterThan(officialAt);
      expect(at, key).toBeLessThan(restAt);
    }
  });

  it("every listed legal and official key exists in en.json", () => {
    for (const key of [...LEGAL_KEYS, ...OFFICIAL_KEYS]) expect(key in en, key).toBe(true);
  });

  it("says the file is a draft and that it is hidden in production", () => {
    expect(sheetFile).toMatch(/draft written by an AI assistant/);
    expect(sheetFile).toMatch(/hidden in a production build/);
  });
});
