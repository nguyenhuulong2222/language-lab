/**
 * The page frame: skip link, header, stage stepper, main workspace and footer, in one centred
 * column. Used by the practice flow and by the report-only App.
 *
 * Every screen except Home starts with "← Back to Home" (BackToHome). The browser Back button (and
 * the iPhone swipe back) does the same: entering a section from Home adds one history entry
 * (pushState), and Back (popstate) returns to Home, with the same "Keep practicing / Leave" question
 * while a practice is in progress. Back on Home leaves the app as usual. No URL routing.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SessionStage } from "../../contracts";
import { useT } from "../../i18n/react";
import { PracticeHiddenContext } from "../practice-hidden";
import { SessionStepsContext } from "../session-steps";
import { metaForSteps } from "../stages";
import { AiNotice } from "./AiNotice";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { StageStepper } from "./StageStepper";
import { useSpeaker } from "../voice/VoiceProvider";
import { CreditsScreen } from "../screens/CreditsScreen";
import { focusHomeLanguage } from "../home-language";
import { BackToHome } from "./BackToHome";
import { useSectionHistory } from "../section-history";
import "../App.css";

interface ShellProps {
  /** The steps of the session, in order. Undefined (the home screen): no stepper. */
  steps?: readonly SessionStage[];
  currentStage?: SessionStage;
  /** Go back to the home screen. Given on every screen except Home: "Back to Home" shows. */
  onHome?: () => void;
  /** Ask before going home (a practice with answers that would be lost). */
  confirmHome?: boolean;
  /** Home is on screen with its language grid: the header language button goes to it. */
  languageOnPage?: boolean;
  children: ReactNode;
}

export function Shell({ steps, currentStage, onHome, confirmHome = false, languageOnPage = false, children }: ShellProps) {
  const t = useT();
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const goHome = () => {
    setCreditsOpen(false);
    setConfirmOpen(false);
    onHome?.();
  };
  // The browser Back button inside a section: Home, or the leave question during a practice.
  useSectionHistory(onHome !== undefined, () => {
    setCreditsOpen(false);
    if (confirmHome) {
      setConfirmOpen(true);
      return "stay";
    }
    goHome();
    return "home";
  });
  const creditsButton = useRef<HTMLElement | null>(null);
  const speaker = useSpeaker();
  // The practice stays mounted but hidden while credits are open, and keeps running when the tab
  // goes to the background. In both cases it is "hidden": the audio stops here, and the speech
  // recogniser and the recorder stop themselves (AnswerInput, useSelfReview).
  const [tabHidden, setTabHidden] = useState(() => typeof document !== "undefined" && document.visibilityState === "hidden");
  useEffect(() => {
    const onChange = () => setTabHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  const practiceHidden = creditsOpen || tabHidden || (confirmHome && confirmOpen);
  // Escape closes the credits, like the header panels.
  useEffect(() => {
    if (!creditsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCreditsOpen(false);
      setTimeout(() => creditsButton.current?.focus(), 0);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [creditsOpen]);
  useEffect(() => {
    if (practiceHidden) speaker.cancel();
  }, [practiceHidden, speaker]);
  const stepper =
    steps !== undefined && currentStage !== undefined ? (
      <StageStepper stages={metaForSteps(steps)} currentStage={currentStage} />
    ) : null;
  const content = (
    <div className="app">
      <a className="ll-skip-link" href="#main">
        {t("app.skipToMain")}
      </a>
      <Header {...(languageOnPage && !creditsOpen ? { onLanguage: focusHomeLanguage } : {})} />
      <AiNotice />
      {stepper}
      <main id="main" className="app__main" tabIndex={-1}>
        {/* The practice stays mounted (hidden) while the credits are open, so no answers are lost. */}
        <div className="ll-container" hidden={creditsOpen}>
          {onHome !== undefined && (
            <BackToHome onHome={goHome} confirm={confirmHome} confirmOpen={confirmOpen} setConfirmOpen={setConfirmOpen} />
          )}
          {/* While the leave question is open it is the only thing on the page (one main button). */}
          <div hidden={confirmHome && confirmOpen}>
            <PracticeHiddenContext.Provider value={practiceHidden}>{children}</PracticeHiddenContext.Provider>
          </div>
        </div>
        {creditsOpen && (
          <div className="ll-container">
            <CreditsScreen
              onClose={() => {
                setCreditsOpen(false);
                setTimeout(() => creditsButton.current?.focus(), 0);
              }}
            />
          </div>
        )}
      </main>
      <Footer
        creditsOpen={creditsOpen}
        onCredits={(opener) => {
          // The button itself, not document.activeElement (Safari does not focus a clicked button).
          creditsButton.current = opener;
          setCreditsOpen((open) => !open);
        }}
      />
    </div>
  );
  return steps === undefined ? content : <SessionStepsContext.Provider value={steps}>{content}</SessionStepsContext.Provider>;
}
