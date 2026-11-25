/**
 * Home, top to bottom: the language grid (always open, the same list as the header panel); the
 * welcome in one sentence and the text-size hint; "1. Who is practicing?" (Most people, or 65/20:
 * two radio cards, Most people by default, in memory only); "2. What do you want to do?" (Study, and
 * the one filled button "Practice test"); "Or practice one part" (whole-row buttons); the AI coach
 * card; then how it works, the disclaimer and the privacy notes. Every tappable card is an
 * ActionCard (frame, verb and arrow). The 65/20 choice is used by every card after it: Study starts
 * with the starred questions, and the practice test and civics start with 65/20 ticked in setup.
 */
import { useId, useState, type ReactElement } from "react";
import type { AgeException } from "../../engine/exceptions";
import { LegalText } from "../components/LegalText";
import type { PracticeMode } from "../../engine/practice-flow";
import { languageInfo, type LanguageCode, type MessageKey } from "../../i18n";
import { useT } from "../../i18n/react";
import { ActionCard } from "../components/ActionCard";
import { Disclaimer } from "../components/Disclaimer";
import { Bilingual } from "../components/EnglishLine";
import { EnglishNotice } from "../components/EnglishNotice";
import { CalendarIcon, PersonIcon, ReviewIcon, StarIcon } from "../components/icons";
import { HowItWorks } from "../components/HowItWorks";
import { LanguageMenu } from "../components/LanguageMenu";
import { EXCEPTIONS_URL } from "../components/SpecialConsiderationNote";
import { TakeHeader } from "../components/TakeHeader";
import { HOME_LANGUAGE_ID } from "../home-language";
import { useSettings } from "../settings";
import "../components/Screen.css";
/** Who is practicing: most people, or one of the USCIS age and residency exceptions. */
export type Who = AgeException;
const WHO_CARDS: ReadonlyArray<{ value: Who; title: MessageKey; text: MessageKey; icon: (p: { className?: string }) => ReactElement }> = [
  { value: "none", title: "home.who.most.title", text: "home.who.most.text", icon: PersonIcon },
  { value: "50/20", title: "home.who.5020.title", text: "home.who.exempt.text", icon: CalendarIcon },
  { value: "55/15", title: "home.who.5515.title", text: "home.who.exempt.text", icon: CalendarIcon },
  { value: "65/20", title: "home.who.special.title", text: "home.who.special.text", icon: StarIcon },
];
interface HomeScreenProps {
  /** True when this build cannot score civics (answer key not yet reviewed). */
  civicsLocked: boolean;
  /** Start a practice. The app adds the 65/20 choice. */
  onChoose: (mode: PracticeMode) => void;
  /** Open Study (questions with pictures and official answers, not scored). */
  onStudy?: () => void;
  /** Start the N-400 part with the AI coach's consent notice open (spec REQ-C18). Absent: no coach card. */
  onChooseCoach?: () => void;
  /** The 65/20 practice is offered in this build (the designated list and its rules): its card is shown. */
  specialOffered?: boolean;
  who?: Who;
  onWho?: (who: Who) => void;
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
  specialOffered = false,
  who = "none",
  onWho = () => {},
  focusOnFirstRender = false,
  showTextSizeHint = false,
}: HomeScreenProps) {
  const t = useT();
  const whoTitleId = useId();
  const eligibilityId = useId();
  // Reading and Writing are not required for any exception; they stay usable.
  const exempt = who !== "none";
  return (
    <div className="screen screen--home">
      <HomeLanguage />
      <TakeHeader stage="home" title={t("home.title")} lead={t("home.lead")} focusOnFirstRender={focusOnFirstRender} />
      {showTextSizeHint && <p className="home__hint">{t("home.textSizeHint")}</p>}
      <div className="screen__body">
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
          <section className="home__step" aria-labelledby={whoTitleId}>
            <fieldset className="who-cards" aria-describedby={eligibilityId}>
              <legend id={whoTitleId} className="who-cards__legend">
                {t("home.who.title")}
              </legend>
              {WHO_CARDS.filter((card) => card.value !== "65/20" || specialOffered).map((card) => {
                const Icon = card.icon;
                return (
                  <label key={card.value} className="who-card">
                    <input
                      className="choice__input"
                      type="radio"
                      name="who"
                      value={card.value}
                      checked={who === card.value}
                      onChange={() => onWho(card.value)}
                    />
                    <Icon className="who-card__icon" />
                    <span className="who-card__body">
                      <span className="who-card__title">{t(card.title)}</span>
                      <span className="who-card__text">{t(card.text)}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <div className="home__who-notes">
              <p className="note" id={eligibilityId}>
                <LegalText messageKey="home.exceptions.timing" /> <LegalText messageKey="special.englishExempt" />
              </p>
              <p className="note">
                <a className="special-note__link" href={EXCEPTIONS_URL} target="_blank" rel="noopener noreferrer">
                  {t("special.language.link")}
                  <span className="ll-sr-only"> {t("common.newTab")}</span>
                </a>
              </p>
              <p className="home__not-sure">{t("home.who.notSure")}</p>
            </div>
          </section>
        )}
        {!civicsLocked && (
          <section className="home__step" aria-labelledby={`${whoTitleId}-what`}>
            <h2 id={`${whoTitleId}-what`} className="home__section">
              {t("home.what.title")}
            </h2>
            <ul className="action-list">
              {onStudy !== undefined && (
                <li>
                  <ActionCard title={t("home.study.title")} text={t("home.study.text")} verb={t("home.go.open")} onClick={onStudy} />
                </li>
              )}
              <li>
                <ActionCard primary title={t("home.full.title")} text={t("home.full.text")} verb={t("home.go.start")} onClick={() => onChoose("full")} />
              </li>
            </ul>
          </section>
        )}
        <section className="home__step" aria-labelledby={`${whoTitleId}-parts`}>
          <h2 id={`${whoTitleId}-parts`} className="home__section">
            {t("home.parts.title")}
          </h2>
          <ul className="action-list">
            {PARTS.filter((part) => !(civicsLocked && part.mode === "civics")).map((part) => (
              <li key={part.mode}>
                <ActionCard
                  row
                  title={t(part.title)}
                  text={t(part.text)}
                  verb={t("home.go.start")}
                  onClick={() => onChoose(part.mode)}
                  {...(exempt && (part.mode === "reading" || part.mode === "writing") ? { meta: t("home.part.notRequired") } : {})}
                  {...(part.mode === "n400" && onChooseCoach !== undefined
                    ? {
                        badge: (
                          <>
                            <span className="action-card__badge" aria-hidden="true">
                              {t("home.part.n400.badge")}
                            </span>
                            <span className="ll-sr-only">{t("coach.switch.label")}</span>
                          </>
                        ),
                      }
                    : {})}
                />
              </li>
            ))}
          </ul>
        </section>
        {onChooseCoach !== undefined && (
          <section className="home__step">
            <ActionCard
              title={t("home.coach.title")}
              text={t("home.coach.text")}
              meta={t("coach.poweredBy")}
              verb={t("home.go.start")}
              onClick={onChooseCoach}
            />
          </section>
        )}
      </div>
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
