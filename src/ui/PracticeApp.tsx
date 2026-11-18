/**
 * The practice flow: intro, N-400 interview, reading, writing, civics, report. The whole
 * session lives in one in-memory reducer (src/engine/practice-flow.ts). Nothing is stored, and
 * nothing is sent anywhere. Reloading the page starts again.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { InterviewSession } from "../contracts";
import { createScriptedN400Coach } from "../engine/n400-coach";
import {
  createDefaultPracticeEnv,
  createPracticeEngine,
  type PracticeAction,
  type PracticeEngine,
  type PracticeState,
} from "../engine/practice-flow";
import { useT } from "../i18n/react";
import { Shell } from "./components/Shell";
import { CivicsScreen } from "./screens/CivicsScreen";
import { EnglishScreen } from "./screens/EnglishScreen";
import { IntroScreen } from "./screens/IntroScreen";
import { N400Screen } from "./screens/N400Screen";
import { ReportScreen } from "./screens/ReportScreen";

interface PracticeAppProps {
  /** Replace the engine (tests). Defaults to the real rules, content and answer keys. */
  engine?: PracticeEngine;
  /** Replace the clock and the random seed (tests). */
  now?: () => string;
  seed?: () => number;
}

const defaultNow = () => new Date().toISOString();
const defaultSeed = () => Math.floor(Math.random() * 2_147_483_647);

export function PracticeApp({ engine: given, now = defaultNow, seed = defaultSeed }: PracticeAppProps) {
  const engine = useMemo(() => given ?? createPracticeEngine(createDefaultPracticeEnv()), [given]);
  const [state, dispatch] = useReducer(
    (current: PracticeState, action: PracticeAction) => engine.reduce(current, action),
    undefined,
    () => engine.initial()
  );
  const coach = useMemo(() => createScriptedN400Coach(engine.env.content.n400Questions), [engine]);
  const civicsLockedInBuild = useMemo(
    () => (["2008", "2025"] as const).some((v) => engine.env.answerKey(v).status === "locked"),
    [engine]
  );
  const [restarts, setRestarts] = useState(0);
  const restart = useCallback(() => {
    setRestarts((n) => n + 1);
    dispatch({ type: "restart" });
  }, []);

  return (
    <Shell currentStage={state.phase}>
      <Screen
        engine={engine}
        state={state}
        dispatch={dispatch}
        coach={coach}
        civicsLockedInBuild={civicsLockedInBuild}
        afterRestart={restarts > 0}
        now={now}
        seed={seed}
        restart={restart}
      />
    </Shell>
  );
}

interface ScreenProps {
  engine: PracticeEngine;
  state: PracticeState;
  dispatch: (action: PracticeAction) => void;
  coach: ReturnType<typeof createScriptedN400Coach>;
  civicsLockedInBuild: boolean;
  /** The intro is shown again after a restart (moves focus to its heading). */
  afterRestart?: boolean;
  now: () => string;
  seed: () => number;
  restart: () => void;
}

/** The active screen for the current phase. Exported so each phase can be rendered in tests. */
export function Screen({
  engine,
  state,
  dispatch,
  coach,
  civicsLockedInBuild,
  afterRestart = false,
  now,
  seed,
  restart,
}: ScreenProps) {
  const { env } = engine;

  switch (state.phase) {
    case "intro":
      return (
        <IntroScreen
          profiles={env.content.profiles}
          boundaryDate={env.boundaryDate}
          civicsLocked={civicsLockedInBuild}
          focusOnFirstRender={afterRestart}
          onStart={(profileId, filedOn) => dispatch({ type: "start", profileId, filedOn, seed: seed(), at: now() })}
        />
      );

    case "n400_interview": {
      const profile = env.content.profiles.find((p) => p.id === state.setup?.profileId);
      if (profile === undefined) return null;
      return (
        <N400Screen
          coach={coach}
          profile={profile}
          answers={state.n400Answers}
          total={env.content.n400Questions.length}
          onAnswer={(prompt, transcript) =>
            dispatch({ type: "answerN400", questionId: prompt.id, questionText: prompt.text, transcript, at: now() })
          }
          onFinish={() => dispatch({ type: "finishN400" })}
        />
      );
    }

    case "reading":
    case "writing": {
      const kind = state.phase;
      return (
        <EnglishScreen
          key={kind}
          progress={engine.englishProgress(state, kind)}
          minWordAccuracy={env.config.sentenceMatch[kind].minWordAccuracy}
          onSubmit={(transcript, input) =>
            dispatch({ type: kind === "reading" ? "submitReading" : "submitWriting", transcript, input, at: now() })
          }
          onContinue={() => dispatch({ type: "continue", at: now() })}
        />
      );
    }

    case "civics":
      return (
        <CivicsScreen
          progress={engine.civicsProgress(state)}
          version={state.setup?.version ?? "2008"}
          onSubmit={(response, input) => dispatch({ type: "submitCivics", response, input, at: now() })}
          onContinue={() => dispatch({ type: "continue", at: now() })}
          onRestart={restart}
        />
      );

    case "report": {
      const session = engine.buildSession(state);
      if (session === null) return null;
      return <ReportPage session={session} restart={restart} />;
    }
  }
}

/** The report with the N-400 note and a restart button. Focus starts on the report heading. */
function ReportPage({ session, restart }: { session: InterviewSession; restart: () => void }) {
  const t = useT();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    container.current?.querySelector<HTMLElement>("h1")?.focus();
  }, []);
  return (
    <div className="screen" ref={container}>
      <ReportScreen session={session} />
      <p className="note">{t("report.n400Note")}</p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={restart}>
          {t("report.again")}
        </button>
      </div>
    </div>
  );
}
