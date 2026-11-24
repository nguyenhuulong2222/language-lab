/**
 * src/engine/special-consideration.ts
 *
 * The 65/20 special consideration (spec release-finish REQ-S01 to S04): the 20 designated
 * questions per test version (data/civics-65-20.json, the asterisks of the official lists) and the
 * rules of the 10-question test (data/test-rules.json, USCIS Policy Manual Vol. 12 Part E Ch. 2).
 *
 * The mode exists only when the bank size, the number of questions and the passing score are
 * verified from a source. No source states an early-stop rule for this test, so those values may
 * be null: the grader then asks every question.
 *
 * Pure module: no DOM, no network, no React.
 */
import DESIGNATED from "../../data/civics-65-20.json" with { type: "json" };
import type { CivicsPracticeRules, TestRules } from "./test-rules-loader.js";
import type { CivicsTestVersion } from "./version-selector.js";

/** The designated question ids of a version, in list order. */
export function designatedQuestionIds(version: CivicsTestVersion): readonly string[] {
  return (DESIGNATED as unknown as Record<CivicsTestVersion, string[]>)[version];
}

interface RuleField {
  value: unknown;
  needsVerification: boolean;
  sourceQuote: string | null;
}

function verifiedNumber(field: RuleField | undefined): number | null {
  if (!field || field.needsVerification || typeof field.value !== "number" || !field.sourceQuote) return null;
  return field.value;
}

/**
 * The rules of the 65/20 civics test as civics rules, or null when the three required values are
 * not all verified (the mode is then off). The version does not change the values: the Policy
 * Manual states one rule for both lists.
 */
export function specialConsiderationRules(rules: TestRules): CivicsPracticeRules | null {
  const section = rules["65_20_specialConsideration"];
  const bank = verifiedNumber(section.questionBank);
  const asked = verifiedNumber(section.questionsAsked);
  const pass = verifiedNumber(section.passingScore as RuleField);
  if (bank === null || asked === null || pass === null) return null;
  if (asked > bank || pass > asked || pass < 1) return null;
  const onCorrect = verifiedNumber(section.earlyStopOnCorrect as RuleField);
  const onIncorrect = verifiedNumber(section.earlyStopOnIncorrect as RuleField);
  const nullable = (value: number | null, from: RuleField) => ({
    value,
    needsVerification: value === null,
    sourceUrl: (from as unknown as { sourceUrl: string }).sourceUrl,
    sourceQuote: value === null ? null : from.sourceQuote,
  });
  return {
    questionPoolSize: { ...section.questionBank },
    questionsAsked: { ...section.questionsAsked },
    passingScore: { ...(section.passingScore as CivicsPracticeRules["passingScore"]) },
    earlyStopOnCorrect: nullable(onCorrect, section.earlyStopOnCorrect as RuleField),
    earlyStopOnIncorrect: nullable(onIncorrect, section.earlyStopOnIncorrect as RuleField),
  };
}
