/**
 * src/engine/practice-content.ts
 *
 * Loads and checks the practice content in data/practice/: fictional profiles, the scripted
 * N-400 questions, reading and writing sentences, and the official vocabulary lists the
 * sentences must stay inside. All files are marked needsHumanReview.
 *
 * Pure module: no DOM, no network.
 */
import { reviewFlagProblem } from "./review-flag.js";
import PROFILES from "../../data/practice/profiles.json" with { type: "json" };
import N400 from "../../data/practice/n400-questions.json" with { type: "json" };
import READING from "../../data/practice/reading-sentences.json" with { type: "json" };
import WRITING from "../../data/practice/writing-sentences.json" with { type: "json" };
import VOCABULARY from "../../data/practice/vocabulary.json" with { type: "json" };
import { tokenise } from "./answer-normaliser.js";

export interface PracticeProfile {
  id: string;
  displayName: string;
}

export interface N400Question {
  id: string;
  topic: string;
  text: string;
  /** The answer of each fictional profile, by profile id. Practice only, never advice. */
  sampleAnswers: Readonly<Record<string, string>>;
}

export interface PracticeSentence {
  id: string;
  text: string;
}

export interface VocabularyList {
  title: string;
  revision: string;
  sourceUrl: string;
  sha256: string;
  /** Every entry of the official list, by category. A slash separates alternatives. */
  categories: Readonly<Record<string, readonly string[]>>;
}

export interface PracticeContent {
  profiles: PracticeProfile[];
  n400Questions: N400Question[];
  readingSentences: PracticeSentence[];
  writingSentences: PracticeSentence[];
  vocabulary: { reading: VocabularyList; writing: VocabularyList };
}

/** An "A" number: the letter A and 8 or 9 digits. Never allowed in practice content. */
const A_NUMBER = /\bA[- ]?\d{8,9}\b/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${where} must be a non-empty string.`);
  if (A_NUMBER.test(value)) throw new Error(`${where} looks like a government ID number.`);
  return value;
}

function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${where} must be a non-empty array.`);
  return value;
}

function checkFlags(raw: unknown, where: string): Record<string, unknown> {
  if (!isRecord(raw)) throw new Error(`${where}: file must be a JSON object.`);
  // Reviewed content loads: false is allowed once a reviewer and a date are named (CON-06).
  const problem = reviewFlagProblem(raw);
  if (problem !== null) throw new Error(`${where}: ${problem}.`);
  return raw;
}

export function parseProfiles(raw: unknown): PracticeProfile[] {
  const file = checkFlags(raw, "profiles");
  if (file["isFictional"] !== true) throw new Error("profiles: isFictional must be true.");
  const seen = new Set<string>();
  return list(file["profiles"], "profiles.profiles").map((item, i) => {
    const where = `profiles[${i}]`;
    if (!isRecord(item)) throw new Error(`${where} must be an object.`);
    const id = str(item["id"], `${where}.id`);
    if (!id.startsWith("fictional-profile-")) throw new Error(`${where}.id must start with "fictional-profile-".`);
    if (item["isFictional"] !== true) throw new Error(`${where}.isFictional must be true.`);
    if (seen.has(id)) throw new Error(`${where}: duplicate id ${id}.`);
    seen.add(id);
    return { id, displayName: str(item["displayName"], `${where}.displayName`) };
  });
}

export function parseN400Questions(raw: unknown, profiles: readonly PracticeProfile[]): N400Question[] {
  const file = checkFlags(raw, "n400-questions");
  if (file["isFictional"] !== true) throw new Error("n400-questions: isFictional must be true.");
  const seen = new Set<string>();
  return list(file["questions"], "n400-questions.questions").map((item, i) => {
    const where = `n400 question ${i + 1}`;
    if (!isRecord(item)) throw new Error(`${where} must be an object.`);
    const id = str(item["id"], `${where}.id`);
    if (seen.has(id)) throw new Error(`${where}: duplicate id ${id}.`);
    seen.add(id);
    const samples = item["sampleAnswers"];
    if (!isRecord(samples)) throw new Error(`${where}.sampleAnswers must be an object.`);
    const sampleAnswers: Record<string, string> = {};
    for (const profile of profiles) {
      sampleAnswers[profile.id] = str(samples[profile.id], `${where}.sampleAnswers.${profile.id}`);
    }
    for (const key of Object.keys(samples)) {
      if (!profiles.some((p) => p.id === key)) throw new Error(`${where}: sample answer for unknown profile ${key}.`);
    }
    return { id, topic: str(item["topic"], `${where}.topic`), text: str(item["text"], `${where}.text`), sampleAnswers };
  });
}

export function parseSentences(raw: unknown, kind: "reading" | "writing"): PracticeSentence[] {
  const file = checkFlags(raw, `${kind}-sentences`);
  if (file["kind"] !== kind) throw new Error(`${kind}-sentences: kind must be "${kind}".`);
  const seen = new Set<string>();
  return list(file["sentences"], `${kind}-sentences.sentences`).map((item, i) => {
    const where = `${kind} sentence ${i + 1}`;
    if (!isRecord(item)) throw new Error(`${where} must be an object.`);
    const id = str(item["id"], `${where}.id`);
    if (seen.has(id)) throw new Error(`${where}: duplicate id ${id}.`);
    seen.add(id);
    const text = str(item["text"], `${where}.text`);
    if (tokenise(text).length === 0) throw new Error(`${where} has no words.`);
    return { id, text };
  });
}

function parseVocabularyList(raw: unknown, where: string): VocabularyList {
  if (!isRecord(raw)) throw new Error(`${where} must be an object.`);
  const categories = raw["categories"];
  if (!isRecord(categories)) throw new Error(`${where}.categories must be an object.`);
  const out: Record<string, string[]> = {};
  for (const [name, entries] of Object.entries(categories)) {
    out[name] = list(entries, `${where}.categories.${name}`).map((e, i) => str(e, `${where}.${name}[${i}]`));
  }
  const sourceUrl = str(raw["sourceUrl"], `${where}.sourceUrl`);
  if (!sourceUrl.startsWith("https://www.uscis.gov/")) throw new Error(`${where}.sourceUrl must be a uscis.gov URL.`);
  const sha256 = str(raw["sha256"], `${where}.sha256`);
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`${where}.sha256 must be a SHA-256 hex string.`);
  return {
    title: str(raw["title"], `${where}.title`),
    revision: str(raw["revision"], `${where}.revision`),
    sourceUrl,
    sha256,
    categories: out,
  };
}

export function parseVocabulary(raw: unknown): { reading: VocabularyList; writing: VocabularyList } {
  const file = checkFlags(raw, "vocabulary");
  return {
    reading: parseVocabularyList(file["reading"], "vocabulary.reading"),
    writing: parseVocabularyList(file["writing"], "vocabulary.writing"),
  };
}

/** Every word the official list allows, normalised ("do/does" gives "do" and "does"). */
export function vocabularyWords(list: VocabularyList): Set<string> {
  const words = new Set<string>();
  for (const entries of Object.values(list.categories)) {
    for (const entry of entries) {
      for (const alternative of entry.split("/")) {
        for (const word of tokenise(alternative)) words.add(word);
      }
    }
  }
  return words;
}

/** Words of a sentence that the list does not allow. Empty means the sentence is inside the list. */
export function wordsOutsideVocabulary(sentence: string, allowed: ReadonlySet<string>): string[] {
  return tokenise(sentence).filter((word) => !allowed.has(word));
}

export function loadPracticeContent(): PracticeContent {
  const profiles = parseProfiles(PROFILES);
  return {
    profiles,
    n400Questions: parseN400Questions(N400, profiles),
    readingSentences: parseSentences(READING, "reading"),
    writingSentences: parseSentences(WRITING, "writing"),
    vocabulary: parseVocabulary(VOCABULARY),
  };
}
