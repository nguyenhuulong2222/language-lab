/**
 * The page frame: skip link, header, stage stepper, main workspace and footer, in one centred
 * column. Used by the practice flow and by the report-only App.
 */
import { useRef, useState, type ReactNode } from "react";
import type { SessionStage } from "../../contracts";
import { useT } from "../../i18n/react";
import { SessionStepsContext } from "../session-steps";
import { metaForSteps } from "../stages";
import { AiNotice } from "./AiNotice";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { StageStepper } from "./StageStepper";
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
  const stepper =
    steps !== undefined && currentStage !== undefined ? (
      <StageStepper stages={metaForSteps(steps)} currentStage={currentStage} />
    ) : null;
  const content = (
    <div className="app">
      <a className="ll-skip-link" href="#main">
        {t("app.skipToMain")}
      </a>
      <Header {...(onHome === undefined ? {} : { onHome })} />
      <AiNotice />
      {stepper}
      <main id="main" className="app__main" tabIndex={-1}>
        {/* The practice stays mounted (hidden) while the credits are open, so no answers are lost. */}
        <div className="ll-container" hidden={creditsOpen}>
          {children}
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
