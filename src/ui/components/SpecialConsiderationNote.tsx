/**
 * The 65/20 notes (spec release-finish REQ-S05, REQ-S08): how the 65/20 practice runs (numbers
 * from data/test-rules.json) and the line that a 65/20 applicant may take the real civics test in
 * their own language with an interpreter, linked to the USCIS page. Both are legal lines: English
 * until a person reviews the translation. No civics question is ever translated.
 */
import type { CivicsPracticeRules } from "../../engine/test-rules-loader";
import { useT } from "../../i18n/react";
import { LegalText } from "./LegalText";

/** The USCIS page that states the interpreter rule (saved in data/sources/). */
export const EXCEPTIONS_URL = "https://www.uscis.gov/citizenship/exceptions-and-accommodations";

export function SpecialConsiderationNote({ rules, id }: { rules: CivicsPracticeRules; id?: string }) {
  return (
    <div className="special-note" {...(id === undefined ? {} : { id })}>
      <p className="note">
        <LegalText
          messageKey="intro.special.help"
          params={{ asked: rules.questionsAsked.value, bank: rules.questionPoolSize.value, pass: rules.passingScore.value }}
        />
      </p>
      <SpecialLanguageLine />
    </div>
  );
}

export function SpecialLanguageLine() {
  const t = useT();
  return (
    <p className="note">
      <LegalText messageKey="special.language" />{" "}
      <a href={EXCEPTIONS_URL} target="_blank" rel="noopener noreferrer">
        {t("special.language.link")}
      </a>
    </p>
  );
}
