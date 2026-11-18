/**
 * The page frame: skip link, header, stage stepper, main workspace and footer, in one centred
 * column. Used by the practice flow and by the report-only App.
 */
import type { ReactNode } from "react";
import type { SessionStage } from "../../contracts";
import { useT } from "../../i18n/react";
import { STAGES } from "../stages";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { StageStepper } from "./StageStepper";
import "../App.css";

export function Shell({ currentStage, children }: { currentStage: SessionStage; children: ReactNode }) {
  const t = useT();
  return (
    <div className="app">
      <a className="ll-skip-link" href="#main">
        {t("app.skipToMain")}
      </a>
      <Header />
      <StageStepper stages={STAGES} currentStage={currentStage} />
      <main id="main" className="app__main" tabIndex={-1}>
        <div className="ll-container">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
