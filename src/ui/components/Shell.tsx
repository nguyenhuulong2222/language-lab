/**
 * The page frame: skip link, header, stage stepper, main workspace and footer, in one centred
 * column. Used by the practice flow and by the report-only App.
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
import "../App.css";

interface ShellProps {
  /** The steps of the session, in order. Undefined (the home screen): no stepper. */
  steps?: readonly SessionStage[];
  currentStage?: SessionStage;
  /** Go back to the home screen (shown in the header once a session has started). */
  onHome?: () => void;
  children: ReactNode;
}

export function Shell({ steps, currentStage, onHome, children }: ShellProps) {
  const t = useT();
  const [creditsOpen, setCreditsOpen] = useState(false);
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
  const practiceHidden = creditsOpen || tabHidden;
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
      <Header
        {...(onHome === undefined
          ? {}
          : {
              onHome: () => {
                setCreditsOpen(false);
                onHome();
              },
            })}
      />
      <AiNotice />
      {stepper}
      <main id="main" className="app__main" tabIndex={-1}>
        {/* The practice stays mounted (hidden) while the credits are open, so no answers are lost. */}
        <div className="ll-container" hidden={creditsOpen}>
          <PracticeHiddenContext.Provider value={practiceHidden}>{children}</PracticeHiddenContext.Provider>
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
        onCredits={() => {
          creditsButton.current = document.activeElement as HTMLElement | null;
          setCreditsOpen((open) => !open);
        }}
      />
    </div>
  );
  return steps === undefined ? content : <SessionStepsContext.Provider value={steps}>{content}</SessionStepsContext.Provider>;
}
