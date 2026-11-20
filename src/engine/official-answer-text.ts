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
import type { CivicsTestVersion } from "./version-selector.js";

interface EnglishFile {
  entries: Record<string, { question: string; answers: string[] | null }>;
}

// Fetched with the answer key, when a civics part or Study first starts (not in the first download).
const FILES: Record<CivicsTestVersion, () => Promise<unknown>> = {
  "2008": () => import("../../data/translations/civics/2008/en.json").then((m) => m.default),
  "2025": () => import("../../data/translations/civics/2025/en.json").then((m) => m.default),
};
const LOADED = new Map<CivicsTestVersion, EnglishFile>();
export async function preloadOfficialAnswerText(version: CivicsTestVersion): Promise<void> {
  if (LOADED.has(version)) return;
  LOADED.set(version, (await FILES[version]()) as EnglishFile);
}
/**
 * The USCIS answer lines of a question, or null when it has none (answers that change) or the file
 * has not been loaded yet.
 */
export function officialAnswerLines(version: CivicsTestVersion, questionId: string): string[] | null {
  return LOADED.get(version)?.entries[questionId]?.answers ?? null;
}
