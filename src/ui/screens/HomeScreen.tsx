/**
 * Home (senior-friendly order): the language grid at the very top (always open, the same list as
 * the header panel); a short welcome and the text-size hint; "Start here" with the full
 * practice interview and one primary "Start practice" button; the 65/20 card; the AI coach card;
 * "Practice one part" as a simple list; "Study first"; then how it works, the English notice, the
 * disclaimers and the privacy notes at the bottom. Nothing is asked here; setup comes next.
 */
import { useId, useState } from "react";
import { languageInfo, type LanguageCode } from "../../i18n";
import { LanguageMenu } from "../components/LanguageMenu";
import { HOME_LANGUAGE_ID } from "../home-language";
import { useSettings } from "../settings";
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
  /** Start the N-400 part with the AI coach's consent notice open (spec REQ-C18). Absent: no coach card. */
  onChooseCoach?: () => void;
  /** Start the civics part with the 65/20 choice ticked (spec release-finish REQ-S06). Absent: no card. */
  onChooseSpecial?: () => void;
  /** The home screen is shown again after "back to home": focus then moves to its heading. */
  focusOnFirstRender?: boolean;
  /** Show the one-line text-size hint (the first visit of this page; nothing is stored). */
  showTextSizeHint?: boolean;
}

/**
 * "Choose a language" with every offered language under its own name, at the top of Home. Choosing
 * one changes the whole interface at once; focus stays on the chosen button, and a polite live
 * region says the language's name.
 */
function HomeLanguage() {
  const { setLanguage } = useSettings();
  const [announced, setAnnounced] = useState<LanguageCode | null>(null);
  return (
    <section id={HOME_LANGUAGE_ID} className="home-language">
      <LanguageMenu
        variant="home"
        onChoose={(code) => {
          setLanguage(code);
          setAnnounced(code);
        }}
      />
      <p className="ll-sr-only" role="status" aria-live="polite" lang={announced === null ? undefined : languageInfo(announced).htmlLang}>
        {announced === null ? "" : languageInfo(announced).endonym}
      </p>
    </section>
  );
}
const PARTS: ReadonlyArray<{ mode: Exclude<PracticeMode, "full">; title: MessageKey; text: MessageKey }> = [
  { mode: "n400", title: "home.part.n400.title", text: "home.part.n400.text" },
  { mode: "reading", title: "home.part.reading.title", text: "home.part.reading.text" },
  { mode: "writing", title: "home.part.writing.title", text: "home.part.writing.text" },
  { mode: "civics", title: "home.part.civics.title", text: "home.part.civics.text" },
];

export function HomeScreen({
  civicsLocked,
  onChoose,
  onStudy,
  onChooseCoach,
  onChooseSpecial,
  focusOnFirstRender = false,
  showTextSizeHint = false,
}: HomeScreenProps) {
  const t = useT();
  const coachTitleId = useId();
  const coachTextId = useId();
  const coachMetaId = useId();
  const startTitleId = useId();
  return (
    <div className="screen">
      <HomeLanguage />
      <TakeHeader stage="home" title={t("home.title")} lead={t("home.lead")} focusOnFirstRender={focusOnFirstRender} />
      {showTextSizeHint && <p className="home__hint">{t("home.textSizeHint")}</p>}

      <section className="screen__body" aria-label={t("home.choose")}>
        {/* While civics is locked, say first what this build can do, and offer only that. */}
        {civicsLocked && (
          <div className="panel" role="note">
            <h2 className="panel__title">{t("home.locked.title")}</h2>
            <p>
              <ReviewIcon className="icon-inline icon-inline--attention" /> <LegalText messageKey="intro.locked" />
            </p>
          </div>
        )}
        {!civicsLocked && (
          <section className="panel start-here" aria-labelledby={startTitleId}>
            <h2 id={startTitleId} className="start-here__label">
              {t("home.start.label")}
            </h2>
            <p className="start-here__title">{t("home.full.title")}</p>
            <p>{t("home.full.text")}</p>
            <button type="button" className="btn btn--primary" onClick={() => onChoose("full")}>
              {t("home.full.start")}
            </button>
          </section>
        )}
        {!civicsLocked && onChooseSpecial !== undefined && (
          <button type="button" className="option-card option-card--special" onClick={onChooseSpecial}>
            <span className="option-card__title">
              <LegalText messageKey="home.special.cta" />
            </span>
            <span className="option-card__text">
              <LegalText messageKey="home.special.text" />
            </span>
          </button>
        )}
        {onChooseCoach !== undefined && (
          <button
            type="button"
            className="option-card option-card--coach"
            aria-labelledby={coachTitleId}
            aria-describedby={`${coachTextId} ${coachMetaId}`}
            onClick={onChooseCoach}
          >
            {/* A short name (the title); the text and the attribution are read as the description. */}
            <span id={coachTitleId} className="option-card__title">
              {t("home.coach.title")}
            </span>
            <span id={coachTextId} className="option-card__text">
              {t("home.coach.text")}
            </span>
            <span id={coachMetaId} className="option-card__meta">
              {t("coach.poweredBy")}
            </span>
          </button>
        )}

        <h2 className="home__section">{t("home.parts.title")}</h2>
        <ul className="row-list">
          {PARTS.filter((part) => !(civicsLocked && part.mode === "civics")).map((part) => (
            <li key={part.mode}>
              <button type="button" className="row-button" onClick={() => onChoose(part.mode)}>
                <span className="row-button__title">
                  {t(part.title)}
                  {part.mode === "n400" && onChooseCoach !== undefined && (
                    <>
                      {" "}
                      <span className="option-card__badge" aria-hidden="true">
                        {t("home.part.n400.badge")}
                      </span>
                      <span className="ll-sr-only">{t("coach.switch.label")}</span>
                    </>
                  )}
                </span>
                <span className="row-button__text">{t(part.text)}</span>
              </button>
            </li>
          ))}
        </ul>

        {!civicsLocked && onStudy !== undefined && (
          <>
            <ul className="row-list row-list--alone">
              <li>
                <button type="button" className="row-button" onClick={onStudy}>
                  <span className="row-button__title">{t("home.study.title")}</span>
                  <span className="row-button__text">{t("home.study.text")}</span>
                </button>
              </li>
            </ul>
          </>
        )}
      </section>

      <HowItWorks />
      <EnglishNotice always />
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
      <p className="note"><LegalText messageKey="coach.privacy" /></p>
    </div>
  );
}
