/**
 * The gate and the AI label (content-safety rule 3): a locale is offered when it passes the
 * checks, and carries the AI label until a named human reviewer is recorded in its _meta.
 */
import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import enRaw from "../locales/en.json";
import {
  availableUiLanguages,
  AVAILABLE_UI_LANGUAGES,
  CATALOGS,
  isLocaleReviewed,
  LANGUAGE_CODES,
  localePassesChecks,
  LOCALE_STATUS,
  type Catalogs,
  type LocaleStatus,
} from "../index";
import { checkMeta, isReviewed } from "../locale-checks";

const en = enRaw as Record<string, string>;
const draft = { source: "ai-draft", reviewedBy: null, reviewedOn: null } as const;
const reviewed = { source: "human-reviewed", reviewedBy: "A. Reviewer", reviewedOn: "2026-12-01" } as const;
const full = { ...en };

describe("which languages are offered", () => {
  it("all 14, English first, with the real files", () => {
    expect(AVAILABLE_UI_LANGUAGES.map((l) => l.code)).toEqual([...LANGUAGE_CODES]);
    expect(AVAILABLE_UI_LANGUAGES[0]?.code).toBe("en");
  });

  it("a locale with a missing line is not offered", () => {
    const { "app.name": _gone, ...incomplete } = full;
    const catalogs: Catalogs = { en, vi: incomplete } as Catalogs;
    expect(availableUiLanguages(catalogs, { vi: draft }).map((l) => l.code)).toEqual(["en"]);
  });

  it("a locale that left a line in English is not offered", () => {
    const catalogs: Catalogs = { en, vi: { ...full, "home.what.title": en["home.what.title"]! } } as Catalogs;
    expect(localePassesChecks("vi", catalogs, { vi: draft })).toBe(false);
  });

  it("a locale with a changed placeholder or number is not offered", () => {
    const base = { ...full, "stepper.count": "Bước {current} trên {total}", "intro.filed.help": "2008 và 2025 uscis.gov" };
    const wrongPlaceholder: Catalogs = { en, vi: { ...base, "stepper.count": "Bước {current}" } } as Catalogs;
    expect(localePassesChecks("vi", wrongPlaceholder, { vi: draft })).toBe(false);
    const wrongNumber: Catalogs = { en, vi: { ...base, "intro.filed.help": "2008 và 2026 uscis.gov" } } as Catalogs;
    expect(localePassesChecks("vi", wrongNumber, { vi: draft })).toBe(false);
  });

  it("a locale with a bad _meta is not offered, a language with no file is never offered", () => {
    const catalogs: Catalogs = { en, vi: translateAll(full) } as Catalogs;
    expect(localePassesChecks("vi", catalogs, {})).toBe(false);
    expect(localePassesChecks("vi", catalogs, { vi: { source: "ai-draft", reviewedBy: "x", reviewedOn: null } })).toBe(false);
    expect(localePassesChecks("es", catalogs, { es: draft })).toBe(false);
  });

  it("English always passes", () => {
    expect(localePassesChecks("en", {}, {})).toBe(true);
  });

  it("there is no production switch: the result does not depend on the build", () => {
    expect(availableUiLanguages().map((l) => l.code)).toEqual(AVAILABLE_UI_LANGUAGES.map((l) => l.code));
  });
});

/** A fake translation that passes the checks: every line gets a marker prefix, keeping names, numbers and placeholders. */
function translateAll(messages: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(messages).map(([k, v]) => [k, `«${v}»`]));
}

describe("the AI label", () => {
  it("every shipped locale is an unreviewed AI draft and carries the label", () => {
    for (const code of LANGUAGE_CODES) {
      if (code === "en") continue;
      const status = LOCALE_STATUS[code];
      if (status?.reviewedBy === null && status?.reviewedOn === null) {
        expect(status.source, code).toBe("ai-draft");
        expect(isLocaleReviewed(code), code).toBe(false);
      } else {
        // Someone recorded a reviewer: the record must be complete.
        expect(isReviewed(status), code).toBe(true);
        expect(status?.source, code).toBe("human-reviewed");
      }
    }
  });

  it("English never carries the label", () => {
    expect(isLocaleReviewed("en")).toBe(true);
  });

  it("only a named reviewer AND a date remove the label", () => {
    expect(isReviewed(draft)).toBe(false);
    expect(isReviewed(reviewed)).toBe(true);
    expect(isReviewed({ reviewedBy: "A", reviewedOn: null })).toBe(false);
    expect(isReviewed({ reviewedBy: null, reviewedOn: "2026-12-01" })).toBe(false);
    expect(isReviewed({ reviewedBy: "  ", reviewedOn: "2026-12-01" })).toBe(false);
    expect(isReviewed({ reviewedBy: "A", reviewedOn: "yesterday" })).toBe(false);
    expect(isReviewed(undefined)).toBe(false);
    const status: LocaleStatus = { vi: reviewed, es: draft };
    expect(isLocaleReviewed("vi", status)).toBe(true);
    expect(isLocaleReviewed("es", status)).toBe(false);
    expect(isLocaleReviewed("ru", status)).toBe(false);
  });

  it("property: a locale loses the label only with a non-blank name and an ISO date", () => {
    fc.assert(
      fc.property(fc.option(fc.string(), { nil: null }), fc.option(fc.string(), { nil: null }), (name, date) => {
        const lost = isReviewed({ reviewedBy: name, reviewedOn: date });
        const expected = name !== null && name.trim() !== "" && date !== null && /^\d{4}-\d{2}-\d{2}$/.test(date);
        return lost === expected;
      }),
      { numRuns: 300 }
    );
  });

  it("_meta must be consistent: source matches the recorded reviewer", () => {
    expect(checkMeta(draft)).toEqual([]);
    expect(checkMeta(reviewed)).toEqual([]);
    expect(checkMeta({ ...reviewed, source: "ai-draft" })).not.toEqual([]);
    expect(checkMeta({ ...draft, source: "human-reviewed" })).not.toEqual([]);
    expect(checkMeta({ ...draft, reviewedBy: "A" })).not.toEqual([]);
    expect(checkMeta({ source: "machine" })).not.toEqual([]);
    expect(checkMeta(undefined)).not.toEqual([]);
  });

  it("every locale file has its own _meta, loaded apart from the messages", () => {
    for (const code of LANGUAGE_CODES) {
      if (code === "en") continue;
      expect(LOCALE_STATUS[code], code).toBeDefined();
      expect("_meta" in (CATALOGS[code] ?? {}), code).toBe(false);
    }
  });
});
