/**
 * A civics question with its translation, for reference. The English text is always shown and
 * is the official one. A translation is labelled as a reference. A question without a
 * translation shows English and says so. Not used for scoring.
 */
import type { CivicsDisplay } from "../../i18n/civics-translations";
import { LANGUAGES } from "../../i18n";
import { useT } from "../../i18n/react";
import "./TranslatedQuestion.css";

interface TranslatedQuestionProps {
  display: CivicsDisplay;
  /** Show the answer lines too. Default: question only. */
  showAnswers?: boolean;
}

function AnswerList({ lines, lang }: { lines: readonly string[]; lang: string }) {
  return (
    <ul className="tq__answers" lang={lang}>
      {lines.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  );
}

export function TranslatedQuestion({ display, showAnswers = false }: TranslatedQuestionProps) {
  const t = useT();
  const english = (
    <div className="tq__block">
      <p className="tq__label">{t("translation.english")}</p>
      <p className="tq__question" lang="en">
        {display.english.question}
      </p>
      {showAnswers && display.english.answers !== null && (
        <AnswerList lines={display.english.answers} lang="en" />
      )}
    </div>
  );

  if (display.kind === "english") return <div className="tq">{english}</div>;

  if (display.kind === "untranslated") {
    return (
      <div className="tq">
        {english}
        <p className="tq__note">{t("translation.missing")}</p>
      </div>
    );
  }

  const endonym = LANGUAGES.find((l) => l.code === display.language)?.endonym ?? display.language;
  return (
    <div className="tq">
      {english}
      <div className="tq__block">
        <p className="tq__label">{endonym}</p>
        <p className="tq__question" lang={display.language}>
          {display.translated.question}
        </p>
        {showAnswers && display.translated.answers !== null && (
          <AnswerList lines={display.translated.answers} lang={display.language} />
        )}
      </div>
      <p className="tq__note">{t("translation.notice")}</p>
    </div>
  );
}
