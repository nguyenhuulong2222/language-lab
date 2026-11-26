/**
 * Dates read the same way in all 14 languages (Gregorian year, Latin digits), the language
 * menu lists every language under its own name, and the fonts for the non-Latin scripts are
 * system fonts only.
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { formatDate, formatDateTime, dateLocale } from "../format";
import { LANGUAGES, languageInfo } from "../../i18n/languages";
import { I18nProvider } from "../../i18n/react";
import { LanguageMenu } from "../components/LanguageMenu";
import scriptsCss from "../styles/scripts.css?raw";

describe("dates in every language", () => {
  for (const { code } of LANGUAGES) {
    it(`${code}: Gregorian year 2025 in Latin digits`, () => {
      const date = formatDate("2025-10-20", code);
      expect(date).toMatch(/2025/);
      expect(date).not.toMatch(/[\u0E50-\u0E59\u0ED0-\u0ED9\u1040-\u1049\u0966-\u096F]/);
      expect(formatDateTime("2025-10-20T15:42:00Z", code)).toMatch(/2025/);
    });
  }
  it("falls back to English month names where the browser has no data", () => {
    expect(dateLocale("hmn")).toMatch(/-u-ca-gregory-nu-latn$/);
  });
});

describe("language info", () => {
  it("has a tag and left-to-right direction for each language", () => {
    for (const l of LANGUAGES) {
      expect(l.htmlLang.length).toBeGreaterThan(1);
      expect(l.dir).toBe("ltr");
    }
    expect(languageInfo("zh").htmlLang).toBe("zh-Hant");
    expect(languageInfo("tl").htmlLang).toBe("fil");
  });
});

describe("the language menu", () => {
  const html = renderToString(
    <I18nProvider language="th">
      <LanguageMenu open={false} onChoose={() => {}} />
    </I18nProvider>,
  );
  it("lists all 14 languages under their own names, English first", () => {
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(14);
    expect(html.indexOf("English")).toBeLessThan(html.indexOf("Tiếng Việt"));
    for (const l of LANGUAGES) {
      expect(html).toContain(`lang="${l.htmlLang}"`);
      expect(html).toContain(l.endonym);
    }
  });
  it("marks the current language with aria-current", () => {
    expect((html.match(/aria-current="true"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/aria-current="true"[^>]*>.*ภาษาไทย/);
  });
});

describe("fonts for non-Latin scripts", () => {
  it("sets a stack for Thai, Lao, Burmese, Hindi, Chinese and Korean", () => {
    for (const lang of ["th", "lo", "my", "hi", "ko"]) {
      expect(scriptsCss).toContain(`html[lang="${lang}"]`);
      expect(scriptsCss).toContain(`[lang="${lang}"] { font-family`);
    }
    expect(scriptsCss).toContain('html[lang|="zh"]');
  });
  it("downloads nothing", () => {
    expect(scriptsCss).not.toMatch(/@font-face|url\(|@import/);
  });
  it("ends every stack in a generic family", () => {
    for (const line of scriptsCss.split("\n").filter((l) => l.trim().startsWith("--font-") && l.includes('"'))) {
      expect(line).toMatch(/(sans-serif|serif);$/);
    }
  });
});
