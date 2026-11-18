/**
 * "The real interview is in English." Shown on the home screen, and on every practice screen
 * when the interface is not in English: the questions and sentences stay in English.
 */
import { useLanguage, useT } from "../../i18n/react";
import "./Screen.css";

export function EnglishNotice({ always = false }: { always?: boolean }) {
  const t = useT();
  const language = useLanguage();
  if (!always && language === "en") return null;
  return <p className="note">{t("lang.interviewEnglish")}</p>;
}
