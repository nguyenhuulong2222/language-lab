/**
 * Report-only shell: the shared page frame around the report of one InterviewSession.
 * The practice flow (PracticeApp) uses the same frame.
 */
import type { InterviewSession } from "../contracts";
import { useT } from "../i18n/react";
import { Shell } from "./components/Shell";
import { ReportScreen } from "./screens/ReportScreen";
import { STAGE_ORDER } from "./stages";

interface AppProps {
  session: InterviewSession;
}

export function App({ session }: AppProps) {
  const t = useT();
  const showReport = session.currentStage === "report" && Boolean(session.finalReport);
  return (
    <Shell steps={STAGE_ORDER} currentStage={session.currentStage}>
      {showReport ? (
        <ReportScreen session={session} />
      ) : (
        <div className="app__placeholder">
          <p>{t("app.stageNotBuilt")}</p>
        </div>
      )}
    </Shell>
  );
}
