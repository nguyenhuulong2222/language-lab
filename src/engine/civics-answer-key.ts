/**
 * src/engine/civics-answer-key.ts
 *
 * Loads and validates the civics answer keys in data/civics-answers/.
 *
 * Production guard: while a file has needsHumanReview: true, loading it in production
 * throws, the same way the test rules loader refuses unverified rules. In development it
 * logs a warning.
 *
 * Pure module: no DOM, no fetch, no React.
 */

import { containsPhrase, normalise, type AnyOrderLine } from "./answer-normaliser.js";
import type { CivicsTestVersion } from "./version-selector.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * "static": the answer never changes and is scored from acceptedAnswers.
 * "dynamic": the answer changes with elections, appointments or where the user lives.
 * Dynamic questions are never scored and must not be offered as practice questions.
 */
export type AnswerType = "static" | "dynamic";

export interface CivicsAnswerEntry {
  /** "{testVersion}-{NNN}", for example "2008-001". */
  id: string;
  testVersion: CivicsTestVersion;
  questionText: string;
  /** Already normalised. Empty for dynamic questions. */
  acceptedAnswers: string[];
  /**
   * Alternative names that count as ONE answer ("Secretary of War" and "Secretary of
   * Defense"). Members are strings from acceptedAnswers; a member is in at most one group.
   * Optional in the type so test fixtures stay short; the loader always fills it.
   */
  answerGroups?: string[][];
  /** Accepted answers for which the bare number alone is also accepted. Filled by the loader. */
  numberAlone?: string[];
  /**
   * Source lines whose listed items may be said in any order (project owner decision, recorded
   * in tools/answer-key/answer-markers.json). Every item is still required. Filled by the loader.
   */
  anyOrder?: AnyOrderLine[];
  /**
   * "sentence": every accepted answer is a sentence (the SENTENCE flag of the build script) and is
   * matched by its content words in order (see SentenceRule in answer-normaliser.ts). Absent: phrases.
   */
  matchAs?: "sentence";
  /** How many distinct accepted answers a response needs. */
  requiredAnswerCount: number;
  answerType: AnswerType;
  /** An https uscis.gov URL. */
  sourceUrl: string;
  sourceDocument: string;
}

export interface LoadOptions {
  /** Override the build mode. Defaults to the Vite production flag. */
  production?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isProductionBuild(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    (import.meta as { env?: { PROD?: boolean } }).env?.PROD === true
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUscisHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "uscis.gov" || url.hostname.endsWith(".uscis.gov"))
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Parsing and validation
// ---------------------------------------------------------------------------

/** An optional array of string arrays. Absent means none. */
function parseStringLists(
  value: unknown,
  name: string,
  fail: (message: string) => never
): string[][] {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    !value.every((list) => Array.isArray(list) && list.every((x) => typeof x === "string"))
  ) {
    return fail(`${name} must be an array of arrays of strings.`);
  }
  return value as string[][];
}

/** The optional anyOrder field: [{ answers: string[], items: string[][] }]. */
function parseAnyOrder(value: unknown, fail: (message: string) => never): AnyOrderLine[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return fail("anyOrder must be an array.");
  return value.map((line) => {
    if (!isRecord(line)) return fail("an anyOrder line must be an object.");
    const answers = parseStringLists([line["answers"]], "anyOrder answers", fail)[0]!;
    const items = parseStringLists(line["items"], "anyOrder items", fail);
    if (answers.length === 0) return fail("an anyOrder line needs at least one answer.");
    if (items.length < 2 || items.some((forms) => forms.length === 0)) {
      return fail("an anyOrder line needs two or more items, each with at least one form.");
    }
    return { answers, items };
  });
}
function parseEntry(
  item: unknown,
  version: CivicsTestVersion,
  label: string
): CivicsAnswerEntry {
  const fail = (message: string): never => {
    throw new Error(`${label}: ${message}`);
  };

  if (!isRecord(item)) return fail("entry must be an object.");

  const { id, testVersion, questionText, acceptedAnswers, requiredAnswerCount } = item;
  const { answerType, sourceUrl, sourceDocument } = item;

  if (!isNonEmptyString(id) || !new RegExp(`^${version}-\\d{3}$`).test(id)) {
    return fail(`id must look like "${version}-NNN", got ${JSON.stringify(id)}.`);
  }
  if (testVersion !== version) {
    return fail(`testVersion must be "${version}", got ${JSON.stringify(testVersion)}.`);
  }
  if (!isNonEmptyString(questionText)) return fail("questionText must be a non-empty string.");
  if (!Array.isArray(acceptedAnswers) || !acceptedAnswers.every((a) => typeof a === "string")) {
    return fail("acceptedAnswers must be an array of strings.");
  }
  if (
    typeof requiredAnswerCount !== "number" ||
    !Number.isInteger(requiredAnswerCount) ||
    requiredAnswerCount < 1
  ) {
    return fail("requiredAnswerCount must be an integer of at least 1.");
  }
  if (answerType !== "static" && answerType !== "dynamic") {
    return fail(`answerType must be "static" or "dynamic", got ${JSON.stringify(answerType)}.`);
  }
  if (!isNonEmptyString(sourceUrl) || !isUscisHttpsUrl(sourceUrl)) {
    return fail(`sourceUrl must be an https uscis.gov URL, got ${JSON.stringify(sourceUrl)}.`);
  }
  if (!isNonEmptyString(sourceDocument)) return fail("sourceDocument must be a non-empty string.");

  const answers = acceptedAnswers as string[];

  const answerGroups = parseStringLists(item["answerGroups"], "answerGroups", fail);
  const numberAloneLists = parseStringLists(
    item["numberAlone"] === undefined ? undefined : [item["numberAlone"]],
    "numberAlone",
    fail
  );
  const numberAlone = numberAloneLists[0] ?? [];
  const anyOrder = parseAnyOrder(item["anyOrder"], fail);
  const matchAs = item["matchAs"];
  if (matchAs !== undefined && matchAs !== "sentence") return fail(`matchAs must be "sentence" when present, got ${JSON.stringify(matchAs)}.`);
  const inAnswers = new Set(answers);
  const seenMembers = new Set<string>();
  for (const group of answerGroups) {
    if (group.length < 2) return fail("an answerGroups group needs at least two answers.");
    for (const member of group) {
      if (!inAnswers.has(member)) {
        return fail(`answerGroups member ${JSON.stringify(member)} is not one of acceptedAnswers.`);
      }
      if (seenMembers.has(member)) {
        return fail(`answerGroups member ${JSON.stringify(member)} is in more than one group.`);
      }
      seenMembers.add(member);
    }
  }
  for (const line of anyOrder) {
    for (const member of line.answers) {
      if (!inAnswers.has(member)) {
        return fail(`anyOrder answer ${JSON.stringify(member)} is not one of acceptedAnswers.`);
      }
      if (seenMembers.has(member)) {
        return fail(`anyOrder answer ${JSON.stringify(member)} is also in an answer group or another anyOrder line.`);
      }
      seenMembers.add(member);
    }
    for (const forms of line.items) {
      for (const form of forms) {
        if (normalise(form) !== form || form === "") return fail(`anyOrder item ${JSON.stringify(form)} is not stored in normalised form.`);
      }
    }
  }
  for (const member of numberAlone) {
    if (!inAnswers.has(member)) {
      return fail(`numberAlone member ${JSON.stringify(member)} is not one of acceptedAnswers.`);
    }
  }

  if (answerType === "dynamic") {
    if (answers.length > 0) {
      return fail("a dynamic question must have no acceptedAnswers (never store answers that change).");
    }
  } else {
    if (answers.length === 0) return fail("a static question needs at least one accepted answer.");
    const seen = new Set<string>();
    for (const answer of answers) {
      if (normalise(answer).length === 0) return fail("an accepted answer is empty after normalising.");
      if (normalise(answer) !== answer) {
        return fail(`accepted answer ${JSON.stringify(answer)} is not stored in normalised form.`);
      }
      if (seen.has(answer)) return fail(`accepted answer ${JSON.stringify(answer)} is listed twice.`);
      seen.add(answer);
    }
    if (requiredAnswerCount > answers.length) {
      return fail("requiredAnswerCount is larger than the number of accepted answers.");
    }
  }

  return {
    id,
    testVersion: version,
    questionText,
    acceptedAnswers: answers,
    answerGroups,
    numberAlone,
    anyOrder,
    ...(matchAs === "sentence" ? { matchAs } : {}),
    requiredAnswerCount,
    answerType,
    sourceUrl,
    sourceDocument,
  };
}

/**
 * Validate a raw answer key file and return its entries by id.
 * Throws a descriptive error for any structural or data-integrity problem.
 * While needsHumanReview is true: throws in production, warns otherwise.
 */
export function parseAnswerKey(
  raw: unknown,
  version: CivicsTestVersion,
  options: LoadOptions = {}
): Map<string, CivicsAnswerEntry> {
  const where = `Civics answer key ${version}`;

  if (!isRecord(raw)) throw new Error(`${where}: file must be a JSON object.`);
  if (typeof raw["needsHumanReview"] !== "boolean") {
    throw new Error(`${where}: needsHumanReview must be true or false.`);
  }
  const rawEntries = raw["entries"];
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    throw new Error(`${where}: entries must be a non-empty array.`);
  }

  const entries = new Map<string, CivicsAnswerEntry>();
  rawEntries.forEach((item, index) => {
    const entry = parseEntry(item, version, `${where}, entry ${index + 1}`);
    if (entries.has(entry.id)) {
      throw new Error(`${where}: duplicate id "${entry.id}".`);
    }
    entries.set(entry.id, entry);
  });

  if (raw["needsHumanReview"] === true) {
    const message =
      `${where} is marked needsHumanReview: true. ` +
      `A person must review and approve it before it is used in production.`;
    if (options.production ?? isProductionBuild()) {
      throw new Error(message);
    }
    console.warn(`[civics-answer-key] ${message}`);
  }

  return entries;
}

// The answer key files are large (about 135 kB together), so they are not in the first download:
// each is fetched when a civics part or Study first needs it (preloadAnswerKey).
const RAW_FILES: Record<CivicsTestVersion, () => Promise<unknown>> = {
  "2008": () => import("../../data/civics-answers/2008.json").then((m) => m.default),
  "2025": () => import("../../data/civics-answers/2025.json").then((m) => m.default),
};
const RAW_LOADED = new Map<CivicsTestVersion, unknown>();
/** Thrown by loadAnswerKey when the file has not been fetched yet. Not a review lock. */
export class AnswerKeyNotLoadedError extends Error {
  constructor(version: CivicsTestVersion) {
    super(`The ${version} answer key has not been loaded yet (call preloadAnswerKey first).`);
    this.name = "AnswerKeyNotLoadedError";
  }
}
/** Fetch the answer key file of a version (once). Resolves when loadAnswerKey can be called. */
export async function preloadAnswerKey(version: CivicsTestVersion): Promise<void> {
  if (RAW_LOADED.has(version)) return;
  RAW_LOADED.set(version, await RAW_FILES[version]());
}
export function isAnswerKeyLoaded(version: CivicsTestVersion): boolean {
  return RAW_LOADED.has(version);
}
/**
 * Whether each answer key file is still marked needsHumanReview. A copy of the flag in the data
 * files, so the app can tell that civics is locked in production without downloading the keys
 * (a test keeps it equal to the files). It does not replace the check in parseAnswerKey: a file
 * that is marked for review is refused in production whatever this says.
 */
export const ANSWER_KEY_NEEDS_REVIEW: Readonly<Record<CivicsTestVersion, boolean>> = { "2008": true, "2025": true };
/** True when this build will refuse the answer key of a version (production and not yet reviewed). */
export function answerKeyLockedInBuild(version: CivicsTestVersion, options: LoadOptions = {}): boolean {
  return ANSWER_KEY_NEEDS_REVIEW[version] && (options.production ?? isProductionBuild());
}
/** Load the answer key for a test version, keyed by question id. The file must have been preloaded. */
export function loadAnswerKey(
  version: CivicsTestVersion,
  options: LoadOptions = {}
): Map<string, CivicsAnswerEntry> {
  if (!RAW_LOADED.has(version)) throw new AnswerKeyNotLoadedError(version);
  return parseAnswerKey(RAW_LOADED.get(version), version, options);
}

// ---------------------------------------------------------------------------
// Helpers for callers and data tests
// ---------------------------------------------------------------------------

/**
 * Entries that can be offered as practice questions (static only).
 * Dynamic questions always score as "unscored".
 */
export function listStaticEntries(
  key: ReadonlyMap<string, CivicsAnswerEntry>
): CivicsAnswerEntry[] {
  return [...key.values()].filter((entry) => entry.answerType === "static");
}

/**
 * Pairs of accepted answers where one is contained in the other, for questions that need
 * more than one answer. Questions with requiredAnswerCount 1 may nest answers freely,
 * so they never report violations.
 */
export function findNestingViolations(
  entry: Pick<CivicsAnswerEntry, "acceptedAnswers" | "requiredAnswerCount">
): Array<{ inner: string; outer: string }> {
  if (entry.requiredAnswerCount <= 1) return [];
  const violations: Array<{ inner: string; outer: string }> = [];
  for (const inner of entry.acceptedAnswers) {
    for (const outer of entry.acceptedAnswers) {
      if (inner !== outer && containsPhrase(outer, inner)) {
        violations.push({ inner, outer });
      }
    }
  }
  return violations;
}
