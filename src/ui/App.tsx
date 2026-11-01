/**
 * App shell: header, stage stepper, main workspace, footer.
 *
 * The workspace renders the active stage panel, driven by the InterviewSession
 * contract. The mock fixture is in the report stage, so the Report screen is the
 * first to render real data (added in the next step).
 */
import type { InterviewSession } from "../contracts";
import { STAGES } from "./stages";
import { Header } from "./components/Header";
import { StageStepper } from "./components/StageStepper";
import { Footer } from "./components/Footer";
import { ReportScreen } from "./screens/ReportScreen";
import "./App.css";

interface AppProps {
  session: InterviewSession;
}

export function App({ session }: AppProps) {
  const showReport =
    session.currentStage === "report" && Boolean(session.finalReport);

  return (
    <div className="app">
      <a className="ll-skip-link" href="#main">
        Skip to main content
      </a>
      <Header />
      <StageStepper stages={STAGES} currentStage={session.currentStage} />
      <main id="main" className="app__main" tabIndex={-1}>
        <div className="ll-container">
          {showReport ? (
            <ReportScreen session={session} />
          ) : (
            <div className="app__placeholder">
              <p>This stage of the practice isn't built yet.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
