/**
 * src/i18n/detect-language.ts
 *
 * The interface language to start in: the first of the device's preferred languages
 * (navigator.languages, then navigator.language) that this build offers, matched by the primary
 * subtag ("vi-VN" → vi, "pt-BR" → pt). English when none matches. Nothing is stored: this runs on
 * every page load.
 *
 * Pure module: no React, no DOM.
 */
import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from "./languages.js";

/** Primary subtags that name one of our languages under another code. */
const ALIASES: Readonly<Record<string, LanguageCode>> = {
  // Filipino is listed as "tl" (Tagalog) here; browsers usually send "fil".
  fil: "tl",
};

/** Our language code for one BCP 47 tag, or null. Chinese of any script or region is zh (Traditional). */
export function languageForTag(tag: string): LanguageCode | null {
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  if (primary === "") return null;
  const alias = ALIASES[primary];
  if (alias !== undefined) return alias;
  return isLanguageCode(primary) ? primary : null;
}

/**
 * The first preferred language that is offered, else English. `offered` is the list of this build
 * (in production it leaves out the languages still in review, so they are never chosen).
 */
export function detectLanguage(list: readonly string[], offered: readonly LanguageCode[]): LanguageCode {
  for (const tag of list) {
    const code = languageForTag(tag);
    if (code !== null && offered.includes(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}
