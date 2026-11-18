/**
 * src/i18n/locale-checks.ts
 *
 * The automated checks every interface translation must pass (content-safety rule 3, point c).
 * They find mechanical damage: a lost or renamed {placeholder}, a changed number, a dropped
 * product name, an empty line, a line left in English. They cannot tell whether a sentence means
 * the same thing: that is what the review sheets and a human reviewer are for.
 *
 * The same functions run in the tests (for every locale file) and in the app (a locale that fails
 * is not offered), so what the tests check is what ships.
 *
 * Pure module: no DOM, no network.
 */

export type ProblemKind =
  | "missing-key"
  | "extra-key"
  | "empty"
  | "placeholders"
  | "numbers"
  | "fixed-term"
  | "identical"
  | "bad-meta";

export interface LocaleProblem {
  key: string;
  kind: ProblemKind;
  detail: string;
}

/** Names and terms that are never translated. If the English line has one, the translation has it. */
export const FIXED_TERMS: readonly string[] = ["Language Lab", "USCIS", "N-400", "DHS", "uscis.gov", "A-number"];

/**
 * Keys that may be identical to English in any language: the product name, the decorative tape
 * counter label, a form name, and one-word labels that are the same loan word in several
 * languages ("Normal"). Everything else must be translated.
 */
export const IDENTICAL_ALLOWED: readonly string[] = [
  "app.name",
  "report.take",
  "stage.n400_interview.short",
  "stage.civics.short",
  "settings.textSize.normal",
];

/** Digits of other scripts that a translator might use, mapped to ASCII. */
const DIGIT_BLOCKS: ReadonlyArray<readonly [start: number]> = [
  [0x0660], // Arabic-Indic
  [0x06f0], // Extended Arabic-Indic
  [0x0966], // Devanagari
  [0x0e50], // Thai
  [0x0ed0], // Lao
  [0x1040], // Myanmar
  [0xff10], // Fullwidth
];

/** Replace digits of other scripts with ASCII digits. */
export function normaliseDigits(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const block = DIGIT_BLOCKS.find(([start]) => code >= start && code < start + 10);
    out += block === undefined ? char : String(code - block[0]);
  }
  return out;
}

/** The distinct numbers in a text, as ASCII digit strings, sorted. {placeholders} are ignored. */
export function numbersIn(text: string): string[] {
  const withoutPlaceholders = text.replace(/\{[A-Za-z0-9_]+\}/g, " ");
  const found = normaliseDigits(withoutPlaceholders).match(/\d+/g) ?? [];
  return [...new Set(found)].sort();
}

/** The {placeholders} of a text, sorted, with repeats. */
export function placeholdersIn(text: string): string[] {
  return (text.match(/\{[A-Za-z0-9_]+\}/g) ?? []).sort();
}

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

export interface CheckOptions {
  /** Keys allowed to equal the English text. Defaults to IDENTICAL_ALLOWED. */
  identicalAllowed?: readonly string[];
}

/**
 * Check one locale's messages against the English messages. An empty list means it passes.
 * Both arguments are plain key to text maps (without the "_meta" entry).
 */
export function checkLocale(
  en: Readonly<Record<string, string>>,
  messages: Readonly<Record<string, string>>,
  options: CheckOptions = {}
): LocaleProblem[] {
  const allowed = new Set(options.identicalAllowed ?? IDENTICAL_ALLOWED);
  const problems: LocaleProblem[] = [];
  const add = (key: string, kind: ProblemKind, detail: string) => problems.push({ key, kind, detail });

  for (const key of Object.keys(en)) {
    const source = en[key] as string;
    const text = messages[key];
    if (text === undefined) {
      add(key, "missing-key", "not in the locale file");
      continue;
    }
    if (typeof text !== "string" || text.trim() === "") {
      add(key, "empty", "empty text");
      continue;
    }
    const wantPlaceholders = placeholdersIn(source);
    const havePlaceholders = placeholdersIn(text);
    if (!sameList(wantPlaceholders, havePlaceholders)) {
      add(key, "placeholders", `English has [${wantPlaceholders.join(" ")}], translation has [${havePlaceholders.join(" ")}]`);
    }
    const wantNumbers = numbersIn(source);
    const haveNumbers = numbersIn(text);
    if (!sameList(wantNumbers, haveNumbers)) {
      add(key, "numbers", `English has [${wantNumbers.join(" ")}], translation has [${haveNumbers.join(" ")}]`);
    }
    for (const term of FIXED_TERMS) {
      if (source.includes(term) && !text.includes(term)) add(key, "fixed-term", `"${term}" is missing`);
    }
    if (text === source && !allowed.has(key)) add(key, "identical", "same as the English text");
  }
  for (const key of Object.keys(messages)) {
    if (!(key in en)) add(key, "extra-key", "not in en.json");
  }
  return problems;
}

// ---------------------------------------------------------------------------
// _meta
// ---------------------------------------------------------------------------

export interface LocaleMeta {
  /** "ai-draft" until a person has reviewed the whole file. */
  source: "ai-draft" | "human-reviewed";
  /** Name of the human reviewer. null while nobody has reviewed it. */
  reviewedBy: string | null;
  /** ISO date (YYYY-MM-DD) of the review. null while nobody has reviewed it. */
  reviewedOn: string | null;
  note?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True only when a named human reviewer AND a review date are recorded. This is what removes the
 * AI label from the screen. The code never sets it: the reviewer edits the locale file.
 */
export function isReviewed(meta: Pick<LocaleMeta, "reviewedBy" | "reviewedOn"> | undefined): boolean {
  if (meta === undefined) return false;
  return (
    typeof meta.reviewedBy === "string" &&
    meta.reviewedBy.trim() !== "" &&
    typeof meta.reviewedOn === "string" &&
    ISO_DATE.test(meta.reviewedOn)
  );
}

/** Problems with a locale's _meta. An empty list means it is valid and consistent. */
export function checkMeta(meta: unknown): LocaleProblem[] {
  const problems: LocaleProblem[] = [];
  const add = (detail: string) => problems.push({ key: "_meta", kind: "bad-meta", detail });
  if (typeof meta !== "object" || meta === null) {
    add("missing _meta");
    return problems;
  }
  const m = meta as Partial<LocaleMeta>;
  if (m.source !== "ai-draft" && m.source !== "human-reviewed") add('source must be "ai-draft" or "human-reviewed"');
  if (m.reviewedBy !== null && typeof m.reviewedBy !== "string") add("reviewedBy must be a name or null");
  if (m.reviewedOn !== null && typeof m.reviewedOn !== "string") add("reviewedOn must be a date or null");
  const reviewed = isReviewed(m as LocaleMeta);
  if (m.source === "human-reviewed" && !reviewed) add("human-reviewed needs reviewedBy and reviewedOn (YYYY-MM-DD)");
  if (m.source === "ai-draft" && reviewed) add("a recorded reviewer means source must be human-reviewed");
  if (m.source === "ai-draft" && ((m.reviewedBy ?? null) !== null || (m.reviewedOn ?? null) !== null)) {
    add("an ai-draft has no reviewer: reviewedBy and reviewedOn are null");
  }
  return problems;
}
