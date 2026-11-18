/**
 * The 14 display languages. The names are the languages' own names (endonyms), copied from
 * the N400 project's language list. English is the default and the only language with UI text.
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
}

export const LANGUAGES: readonly LanguageInfo[] = [
  { code: "en", endonym: "English", tier: "official" },
  { code: "vi", endonym: "Tiếng Việt", tier: "official" },
  { code: "es", endonym: "Español", tier: "official" },
  { code: "zh", endonym: "中文", tier: "official" },
  { code: "tl", endonym: "Filipino", tier: "official" },
  { code: "ko", endonym: "한국어", tier: "official" },
  { code: "hi", endonym: "हिन्दी", tier: "community" },
  { code: "ht", endonym: "Kreyòl", tier: "community" },
  { code: "th", endonym: "ภาษาไทย", tier: "community" },
  { code: "lo", endonym: "ລາວ", tier: "community" },
  { code: "hmn", endonym: "Hmoob", tier: "community" },
  { code: "my", endonym: "မြန်မာ", tier: "community" },
  { code: "pt", endonym: "Português", tier: "community" },
  { code: "ru", endonym: "Русский", tier: "community" },
];

export function isLanguageCode(value: string): value is LanguageCode {
  return (LANGUAGE_CODES as readonly string[]).includes(value);
}
