/**
 * src/i18n/civics-translations.ts
 *
 * Display-only translations of civics questions and answers. They are shown next to the
 * English text for reference. They are never used for scoring: scoring uses the English answer
 * key in data/civics-answers/ only.
 *
 * Files: data/translations/civics/{2008,2025}/<code>.json. "en.json" is the official English
 * display text from the USCIS source; the other files are text taken from the N400 project
 * (see docs/decisions-log.md). A question missing from a language file has no translation,
 * and is shown in English with a note. Nothing is translated here to fill a gap.
 */
import type { CivicsTestVersion } from "../engine/version-selector.js";
import type { LanguageCode } from "./languages.js";

export interface EnglishEntry {
  question: string;
  /** USCIS answer lines. null for questions whose answers change (they are never shown). */
  answers: string[] | null;
}

export interface TranslatedEntry {
  question: string;
  /** Answer lines, one per English line, or null when they could not be paired safely. */
  answers: string[] | null;
  /** "source": taken from the N400 project's data; not reviewed by Language Lab. */
  status: "source";
}

export type MissingReason =
  | "machine-suggested"
  | "inherited-wording-differs"
  | "unverifiable-origin"
  | "not-in-source";

export interface EnglishFile {
  language: "en";
  testVersion: CivicsTestVersion;
  entries: Record<string, EnglishEntry>;
}

export interface TranslationFile {
  language: LanguageCode;
  testVersion: CivicsTestVersion;
  needsHumanReview: boolean;
  entries: Record<string, TranslatedEntry>;
  missing: Record<string, MissingReason>;
}

/** What to show for one question. */
export type CivicsDisplay =
  | { kind: "english"; id: string; english: EnglishEntry }
  | {
      kind: "translated";
      id: string;
      language: LanguageCode;
      english: EnglishEntry;
      translated: TranslatedEntry;
    }
  | { kind: "untranslated"; id: string; language: LanguageCode; english: EnglishEntry };

/**
 * Decide what to show. Pure. English asked for: English only. A language with an entry for
 * the question: both. Otherwise: English, marked as untranslated.
 */
export function buildDisplay(args: {
  id: string;
  language: LanguageCode;
  english: EnglishEntry;
  translation: TranslationFile | null;
}): CivicsDisplay {
  const { id, language, english, translation } = args;
  if (language === "en") return { kind: "english", id, english };
  const translated = translation?.entries[id];
  if (translated === undefined) return { kind: "untranslated", id, language, english };
  return { kind: "translated", id, language, english, translated };
}

const FILES = import.meta.glob<EnglishFile | TranslationFile>(
  "../../data/translations/civics/*/*.json",
  { import: "default" }
);

async function loadFile<T extends EnglishFile | TranslationFile>(
  version: CivicsTestVersion,
  language: LanguageCode
): Promise<T | null> {
  const loader = FILES[`../../data/translations/civics/${version}/${language}.json`];
  return loader === undefined ? null : ((await loader()) as T);
}

/** Load the display for one question. Files are loaded on demand, one language at a time. */
export async function loadCivicsDisplay(
  version: CivicsTestVersion,
  language: LanguageCode,
  id: string
): Promise<CivicsDisplay> {
  const english = await loadFile<EnglishFile>(version, "en");
  const entry = english?.entries[id];
  if (entry === undefined) throw new Error(`No English display text for ${id}.`);
  const translation = language === "en" ? null : await loadFile<TranslationFile>(version, language);
  return buildDisplay({ id, language, english: entry, translation });
}
