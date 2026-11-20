import { describe, it, expect } from "vitest";
import {
  createTranslator,
  interpolate,
  ENGLISH_MESSAGES,
  LANGUAGE_CODES,
  LANGUAGES,
  type MessageKey,
} from "../index";

describe("translator", () => {
  it("returns the English text and fills placeholders", () => {
    const t = createTranslator("en");
    expect(t("app.name")).toBe("Language Lab");
    expect(t("stepper.count", { current: 6, total: 6 })).toBe("Stage 6 of 6");
    expect(t("report.profile.meta", { version: "2025", date: "March 15, 2024" })).toBe(
      "2025 civics test · filed March 15, 2024"
    );
  });

  it("falls back to English for a language with no file, and for a missing key", () => {
    expect(createTranslator("vi")("app.name")).toBe("Language Lab");
    const partial = createTranslator("vi", { vi: { "app.name": "(vi test name)" } });
    expect(partial("app.name")).toBe("(vi test name)");
    expect(partial("app.skipToMain")).toBe("Skip to main content");
  });

  it("leaves an unknown placeholder as written", () => {
    expect(interpolate("a {x} b {y}", { x: 1 })).toBe("a 1 b {y}");
    expect(interpolate("plain", undefined)).toBe("plain");
  });

  it("uses American spelling for practice and never says USCIS does not publish something", () => {
    const all = Object.values(ENGLISH_MESSAGES).join("\n");
    expect(all).not.toMatch(/practise/i);
    expect(all).not.toMatch(/USCIS does not publish/i);
  });

  it("has no empty message and every placeholder is a simple name", () => {
    for (const [key, text] of Object.entries(ENGLISH_MESSAGES)) {
      expect(text.trim().length, key).toBeGreaterThan(0);
      for (const found of text.match(/\{[^}]*\}/g) ?? []) expect(found, key).toMatch(/^\{[A-Za-z0-9_]+\}$/);
    }
  });
});

describe("languages", () => {
  it("are the 14 display languages and not the six frame languages", () => {
    expect([...LANGUAGE_CODES]).toEqual(
      ["en", "vi", "es", "zh", "tl", "ko", "hi", "ht", "th", "lo", "hmn", "my", "pt", "ru"]
    );
    expect(LANGUAGES.map((l) => l.code)).toEqual([...LANGUAGE_CODES]);
    for (const frame of ["ar", "ur", "gu", "fr", "bn", "uk"]) {
      expect((LANGUAGE_CODES as readonly string[]).includes(frame)).toBe(false);
    }
  });
});

describe("message keys are all used", () => {
  const sources = import.meta.glob("../../ui/**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const code = Object.entries(sources)
    .filter(([file]) => !file.includes("__tests__"))
    .map(([, text]) => text)
    .join("\n");

  it("every key in en.json appears in the UI code", () => {
    const unused = (Object.keys(ENGLISH_MESSAGES) as MessageKey[]).filter(
      (key) => !code.includes(`"${key}"`)
    );
    expect(unused).toEqual([]);
  });
});
