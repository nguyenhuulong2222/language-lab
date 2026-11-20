/**
 * The 14 languages of the display layer. The names are the languages' own names (endonyms),
 * copied from the N400 project's language list (Chinese is spelled out as Traditional, see below).
 * English is the source language; the other 13 interface texts are AI-translated drafts until a
 * reviewer is recorded in their locale file (see content-safety rule 3).
 *
 * Six frame languages (ar, ur, gu, fr, bn, uk) are intentionally not here.
 */
export const LANGUAGE_CODES = [
  "en", "vi", "es", "zh", "tl", "ko", "hi", "ht", "th", "lo", "hmn", "my", "pt", "ru",
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export interface LanguageInfo {
  code: LanguageCode;
  /** The language's name in that language. */
  endonym: string;
  /** Where the N400 project got its civics text: "official" (USCIS PDFs) or "community". */
  tier: "official" | "community";
  /** The BCP 47 tag for the `lang` attribute. Chinese is Traditional (USCIS's Chinese materials). */
  htmlLang: string;
  /** Writing direction for the `dir` attribute. All 14 are left to right; the field is here for the next one. */
  dir: "ltr" | "rtl";
  /** The `Intl` locale for dates. Where the browser has no data for it, English month names are used. */
  dateLocale: string;
}

export const LANGUAGES: readonly LanguageInfo[] = [
  { code: "en", endonym: "English", tier: "official", htmlLang: "en", dir: "ltr", dateLocale: "en-US" },
  { code: "vi", endonym: "Tiếng Việt", tier: "official", htmlLang: "vi", dir: "ltr", dateLocale: "vi" },
  { code: "es", endonym: "Español", tier: "official", htmlLang: "es", dir: "ltr", dateLocale: "es" },
  { code: "zh", endonym: "中文（繁體）", tier: "official", htmlLang: "zh-Hant", dir: "ltr", dateLocale: "zh-Hant" },
  { code: "tl", endonym: "Filipino", tier: "official", htmlLang: "fil", dir: "ltr", dateLocale: "fil" },
  { code: "ko", endonym: "한국어", tier: "official", htmlLang: "ko", dir: "ltr", dateLocale: "ko" },
  { code: "hi", endonym: "हिन्दी", tier: "community", htmlLang: "hi", dir: "ltr", dateLocale: "hi" },
  { code: "ht", endonym: "Kreyòl ayisyen", tier: "community", htmlLang: "ht", dir: "ltr", dateLocale: "ht" },
  { code: "th", endonym: "ภาษาไทย", tier: "community", htmlLang: "th", dir: "ltr", dateLocale: "th" },
  { code: "lo", endonym: "ລາວ", tier: "community", htmlLang: "lo", dir: "ltr", dateLocale: "lo" },
  { code: "hmn", endonym: "Hmoob", tier: "community", htmlLang: "hmn", dir: "ltr", dateLocale: "hmn" },
  { code: "my", endonym: "မြန်မာ", tier: "community", htmlLang: "my", dir: "ltr", dateLocale: "my" },
  { code: "pt", endonym: "Português", tier: "community", htmlLang: "pt", dir: "ltr", dateLocale: "pt" },
  { code: "ru", endonym: "Русский", tier: "community", htmlLang: "ru", dir: "ltr", dateLocale: "ru" },
];

export function isLanguageCode(value: string): value is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(value);
}

export function languageInfo(code: LanguageCode): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]!;
}

/**
 * Languages whose drafts the audit rated least reliable (hmn, lo, my, ht). They are left out of the
 * language menu of a production build until a named reviewer is recorded in their locale file, and
 * stay available in development. The menu says that more languages are in review.
 */
export const IN_REVIEW_LANGUAGES: readonly LanguageCode[] = ["hmn", "lo", "my", "ht"];
