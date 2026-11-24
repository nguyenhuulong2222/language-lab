/**
 * src/engine/test-rules-loader.ts
 *
 * Loads and validates data/test-rules.json at startup.
 *
 * Production guard: if any "required" rule field has needsVerification: true
 * the loader throws rather than returning potentially incorrect scoring parameters.
 * This prevents unverified values from being used in a live session.
 *
 * Pure module — no DOM, no fetch, no React.
 */

import RAW_RULES from "../../data/test-rules.json" with { type: "json" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuleValue<T> {
  value: T;
  needsVerification: boolean;
  sourceUrl: string;
  sourceQuote: string | null;
}

export interface NullableRuleValue {
  value: null;
  needsVerification: boolean;
  sourceUrl: string;
  sourceQuote: null;
}

export interface CivicsTestRules {
  questionPoolSize: RuleValue<number>;
  questionsAsked: RuleValue<number>;
  passingScore: RuleValue<number>;
  earlyStopOnCorrect: RuleValue<number>;
  earlyStopOnIncorrect: RuleValue<number>;
}
/**
 * The rules a civics practice stage runs on: the 2008 or 2025 rules, or the 65/20 rules, whose
 * early-stop values are null because no source states a stop rule (the stage then never stops
 * early). Every CivicsTestRules is a CivicsPracticeRules.
 */
export type CivicsPracticeRules = Omit<CivicsTestRules, "earlyStopOnCorrect" | "earlyStopOnIncorrect"> & {
  earlyStopOnCorrect: RuleValue<number | null>;
  earlyStopOnIncorrect: RuleValue<number | null>;
};

export interface CivicsVersionSelectionRules {
  /** YYYY-MM-DD. Filed before it: 2008 test. Filed on or after it: 2025 test. */
  boundaryDate: RuleValue<string>;
}

export interface EnglishComponentRules {
  sentencesPresented: RuleValue<number>;
  sentencesToPassCount: RuleValue<number>;
}

export interface EnglishTestRules {
  reading: EnglishComponentRules;
  writing: EnglishComponentRules;
}

export interface SpecialConsiderationRules {
  eligibilityAgeMinimum: RuleValue<number>;
  eligibilityResidencyYearsMinimum: RuleValue<number>;
  questionBank: RuleValue<number>;
  questionsAsked: RuleValue<number>;
  passingScore: RuleValue<number | null> | NullableRuleValue;
  earlyStopOnCorrect: RuleValue<number | null> | NullableRuleValue;
  earlyStopOnIncorrect: RuleValue<number | null> | NullableRuleValue;
  languageChoicePermitted: RuleValue<boolean>;
}

export interface TestRules {
  civicsTestVersionSelection: CivicsVersionSelectionRules;
  englishTest: EnglishTestRules;
  "2008": CivicsTestRules;
  "2025": CivicsTestRules;
  "65_20_specialConsideration": SpecialConsiderationRules;
}

// ---------------------------------------------------------------------------
// Required fields — loader will refuse to run in production if any of these
// have needsVerification: true.
// ---------------------------------------------------------------------------

/**
 * Paths to rule fields that must be verified before use in production scoring.
 * Uses dot-notation into the JSON structure.
 */
const REQUIRED_VERIFIED_PATHS = [
  "civicsTestVersionSelection.boundaryDate",
  "englishTest.reading.sentencesToPassCount",
  "englishTest.writing.sentencesToPassCount",
  "2008.questionsAsked",
  "2008.passingScore",
  "2008.earlyStopOnCorrect",
  "2008.earlyStopOnIncorrect",
  "2025.questionsAsked",
  "2025.passingScore",
  "2025.earlyStopOnCorrect",
  "2025.earlyStopOnIncorrect",
] as const;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Walk a dot-notation path into a nested object and return the value.
 */
function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur !== null && typeof cur === "object") {
      return (cur as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Returns the list of required-verified paths that still have needsVerification: true.
 */
export function findUnverifiedRequiredFields(
  rules: Record<string, unknown>
): string[] {
  return REQUIRED_VERIFIED_PATHS.filter((path) => {
    const field = getPath(rules, path);
    return (
      field !== null &&
      typeof field === "object" &&
      (field as Record<string, unknown>)["needsVerification"] === true
    );
  });
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Load and validate the test rules.
 *
 * In production (`import.meta.env.PROD === true`) any required field with
 * needsVerification: true throws an Error — scoring must not run on
 * unverified parameters.
 *
 * In development the same fields log a warning but do not throw.
 */
export function loadTestRules(): TestRules {
  const raw = RAW_RULES as unknown as Record<string, unknown>;
  const unverified = findUnverifiedRequiredFields(raw);

  if (unverified.length > 0) {
    const list = unverified.join(", ");
    const message =
      `Test rules contain required fields with needsVerification: true: [${list}]. ` +
      `These fields must be confirmed from an official uscis.gov source before use in production.`;

    if (
      typeof import.meta !== "undefined" &&
      (import.meta as { env?: { PROD?: boolean } }).env?.PROD === true
    ) {
      throw new Error(message);
    } else {
      console.warn(`[test-rules-loader] WARNING: ${message}`);
    }
  }

  return RAW_RULES as unknown as TestRules;
}

/** Convenience: load rules and return only the specified civics test version. */
export function loadCivicsRules(version: "2008" | "2025"): CivicsTestRules {
  return loadTestRules()[version];
}

/** Convenience: load rules and return the English test rules. */
export function loadEnglishRules(): EnglishTestRules {
  return loadTestRules().englishTest;
}

/**
 * Convenience: the first N-400 filing date (YYYY-MM-DD) that uses the 2025 civics test.
 * Dates before it use the 2008 test.
 */
export function loadCivicsBoundaryDate(): string {
  return loadTestRules().civicsTestVersionSelection.boundaryDate.value;
}
