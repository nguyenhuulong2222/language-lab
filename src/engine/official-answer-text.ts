/**
 * src/engine/official-answer-text.ts
 *
 * The official English answer lines of a civics question, exactly as the USCIS source lists
 * them (for example "(U.S.) Constitution"). Shown after an answer, so the user sees the words
 * USCIS uses. Display only: scoring reads the answer key, never this file.
 *
 * The files sit in data/translations/civics/<version>/en.json because they belong with the
 * display files, but this is the official English text, not a translation.
 */
import EN_2008 from "../../data/translations/civics/2008/en.json" with { type: "json" };
import EN_2025 from "../../data/translations/civics/2025/en.json" with { type: "json" };
import type { CivicsTestVersion } from "./version-selector.js";

interface EnglishFile {
  entries: Record<string, { question: string; answers: string[] | null }>;
}

/** The USCIS answer lines of a question, or null when it has none (answers that change). */
export function officialAnswerLines(version: CivicsTestVersion, questionId: string): string[] | null {
  const file = (version === "2008" ? EN_2008 : EN_2025) as unknown as EnglishFile;
  return file.entries[questionId]?.answers ?? null;
}
