/**
 * The English text of a message, shown under its translation. Nothing when the interface is
 * already English. Used for the disclaimers (content-safety rule 3, point b): in every non-English
 * language the disclaimer is shown together with its English text.
 */
import { ENGLISH_MESSAGES, isEnglishOnly, type MessageKey } from "../../i18n";
import { LegalText } from "./LegalText";
import { useLanguage, useT } from "../../i18n/react";
import "./Disclaimer.css";

export function EnglishLine({ messageKey, className = "" }: { messageKey: MessageKey; className?: string }) {
  const t = useT();
  const language = useLanguage();
  // Already English (a legal line in a language without a reviewer): no second copy.
  if (language === "en" || isEnglishOnly(language, messageKey)) return null;
  return (
    <span className={`english-line ${className}`.trim()} lang="en">
      <span className="english-line__label">{t("translation.english")}: </span>
      {ENGLISH_MESSAGES[messageKey]}
    </span>
  );
}

/** A message in the chosen language, with its English text under it in every other language. */
export function Bilingual({ messageKey }: { messageKey: MessageKey }) {
  return (
    <>
      <LegalText messageKey={messageKey} />
      <EnglishLine messageKey={messageKey} />
    </>
  );
}
