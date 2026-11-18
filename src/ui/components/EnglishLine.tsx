/**
 * The English text of a message, shown under its translation. Nothing when the interface is
 * already English. Used for the disclaimers (content-safety rule 3, point b): in every non-English
 * language the disclaimer is shown together with its English text.
 */
import { ENGLISH_MESSAGES, type MessageKey } from "../../i18n";
import { useLanguage, useT } from "../../i18n/react";
import "./Disclaimer.css";

export function EnglishLine({ messageKey, className = "" }: { messageKey: MessageKey; className?: string }) {
  const t = useT();
  const language = useLanguage();
  if (language === "en") return null;
  return (
    <span className={`english-line ${className}`.trim()} lang="en">
      <span className="english-line__label">{t("translation.english")}: </span>
      {ENGLISH_MESSAGES[messageKey]}
    </span>
  );
}

/** A message in the chosen language, with its English text under it in every other language. */
export function Bilingual({ messageKey }: { messageKey: MessageKey }) {
  const t = useT();
  return (
    <>
      {t(messageKey)}
      <EnglishLine messageKey={messageKey} />
    </>
  );
}
