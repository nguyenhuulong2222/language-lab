/**
 * Home: how it works, the standing disclaimers, and the choice between the full practice
 * interview and one part. Nothing is asked here; the setup screen (only for the parts that
 * need it) comes next.
 */
import { LegalText } from "../components/LegalText";
import type { PracticeMode } from "../../engine/practice-flow";
import type { MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { Disclaimer } from "../components/Disclaimer";
import { Bilingual } from "../components/EnglishLine";
import { EnglishNotice } from "../components/EnglishNotice";
import { ReviewIcon } from "../components/icons";
import { HowItWorks } from "../components/HowItWorks";
import { TakeHeader } from "../components/TakeHeader";
import "../components/Screen.css";

interface HomeScreenProps {
  /** True when this build cannot score civics (answer key not yet reviewed). */
  civicsLocked: boolean;
  onChoose: (mode: PracticeMode) => void;
  /** Open "Study first" (questions with pictures and official answers, not scored). */
  onStudy?: () => void;
  /** The home screen is shown again after "back to home": focus then moves to its heading. */
  focusOnFirstRender?: boolean;
}

const PARTS: ReadonlyArray<{ mode: Exclude<PracticeMode, "full">; title: MessageKey; text: MessageKey }> = [
  { mode: "n400", title: "home.part.n400.title", text: "home.part.n400.text" },
  { mode: "reading", title: "home.part.reading.title", text: "home.part.reading.text" },
  { mode: "writing", title: "home.part.writing.title", text: "home.part.writing.text" },
  { mode: "civics", title: "home.part.civics.title", text: "home.part.civics.text" },
];

export function HomeScreen({ civicsLocked, onChoose, onStudy, focusOnFirstRender = false }: HomeScreenProps) {
  const t = useT();
  return (
    <div className="screen">
      <TakeHeader stage="home" title={t("home.title")} lead={t("home.lead")} focusOnFirstRender={focusOnFirstRender} />

      <EnglishNotice always />

      <HowItWorks />

      <section className="screen__body" aria-labelledby="home-choose">
        <h2 id="home-choose" className="choices__legend">
          {t("home.choose")}
        </h2>
        <button type="button" className="option-card option-card--primary" onClick={() => onChoose("full")}>
          <span className="option-card__title">{t("home.full.title")}</span>
          <span className="option-card__text">{t("home.full.text")}</span>
        </button>
        {onStudy !== undefined && (
          <button type="button" className="option-card" onClick={onStudy}>
            <span className="option-card__title">{t("home.study.title")}</span>
            <span className="option-card__text">{t("home.study.text")}</span>
          </button>
        )}
        <h3 className="panel__title">{t("home.parts.title")}</h3>
        <div className="option-grid">
          {PARTS.map((part) => (
            <button key={part.mode} type="button" className="option-card" onClick={() => onChoose(part.mode)}>
              <span className="option-card__title">{t(part.title)}</span>
              <span className="option-card__text">{t(part.text)}</span>
            </button>
          ))}
        </div>
        {civicsLocked && (
          <p className="status status--attention">
            <ReviewIcon className="icon-inline icon-inline--attention" /> <LegalText messageKey="intro.locked" />
          </p>
        )}
      </section>

      <Disclaimer variant="prominent" id="home-disclaimer" messageKey="disclaimer.full" />
      <ul className="notice-list">
        <li>
          <Bilingual messageKey="intro.notice.practice" />
        </li>
        <li>
          <Bilingual messageKey="intro.notice.legal" />
        </li>
        <li>
          <Bilingual messageKey="intro.notice.government" />
        </li>
      </ul>
      <p className="note"><LegalText messageKey="voice.privacy" /></p>
    </div>
  );
}
