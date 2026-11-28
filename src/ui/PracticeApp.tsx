/**
 * The practice flow. Home: the full practice interview, or one part. Then, only when the part
 * needs it, a setup screen; then the part or parts; then a report (an overall report for the
 * full interview, a report for that part only for a single part). The whole session lives in
 * one in-memory reducer (src/engine/practice-flow.ts). Nothing is stored, and nothing is sent
 * anywhere. Reloading the page starts again.
 */
import { LegalText } from "./components/LegalText";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { InterviewSession } from "../contracts";
import { createScriptedN400Coach } from "../engine/n400-coach";
import { createOwnNameCoach, OWN_NAME_SCRIPT } from "../engine/own-name";
import {
  civicsVersionFor,
  createDefaultPracticeEnv,
  createPracticeEngine,
  modeHasCivics,
  modeNeeds,
  modeParts,
  sessionParts,
  sessionSteps,
  specialConsiderationOffered,
  exceptionOffered,
  englishExempt,
  type AgeException,
  type PracticeAction,
  type PracticeEngine,
  type PracticeState,
} from "../engine/practice-flow";
import { useT } from "../i18n/react";
import { HelpSessionProvider } from "./help-session";
import type { CoachTransport } from "./coach/ai-coach-client";
import type { CoachEntry } from "./screens/N400Screen";
import { Shell } from "./components/Shell";
import { SpecialLanguageLine } from "./components/SpecialConsiderationNote";
import { CivicsScreen } from "./screens/CivicsScreen";
import { EnglishScreen } from "./screens/EnglishScreen";
import { HomeScreen, type Who } from "./screens/HomeScreen";
import { IntroScreen } from "./screens/IntroScreen";
import { N400Screen } from "./screens/N400Screen";
import { PartReportScreen } from "./screens/PartReportScreen";
import { StudyScreen } from "./screens/StudyScreen";
import { ReportScreen } from "./screens/ReportScreen";

interface PracticeAppProps {
  /** Replace the engine (tests). Defaults to the real rules, content and answer keys. */
  engine?: PracticeEngine;
  /** Replace the clock and the random seed (tests). */
  now?: () => string;
  seed?: () => number;
}

/** The AI coach's only way out: same-origin fetch to /api/coach, used only after the learner turns the coach on. */
const coachTransport: CoachTransport = (url, init) => fetch(url, init);
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
    () =>
      engine.env.civicsLocked !== undefined
        ? engine.env.civicsLocked()
        : (["2008", "2025"] as const).some((v) => engine.env.answerKey(v).status === "locked"),
    [engine]
  );
  const [restarts, setRestarts] = useState(0);
  // How the N-400 stage starts with the AI coach: ask first, or open the consent notice at once
  // (the home coach card). For this practice only; a restart asks again.
  const [coachEntry, setCoachEntry] = useState<CoachEntry>("choice");
  // "Study first" is a view of its own: no session, no scoring, nothing recorded.
  const [studying, setStudying] = useState(false);
  // "Who is practicing?" on Home: in memory only, used by every card after it.
  const [who, setWho] = useState<Who>("none");
  // "Use my name" (decisions log S): the learner's own name, in this component's memory only. It is
  // never put in the engine state, storage, a cookie, the URL or a log, and is gone after a reload.
  const [ownName, setOwnName] = useState<string | undefined>(undefined);
  const restart = useCallback(() => {
    setRestarts((n) => n + 1);
    setCoachEntry("choice");
    setOwnName(undefined);
    dispatch({ type: "restart" });
  }, []);

  // Leaving Study first lands on the home heading (focus), as after a restart.
  const exitStudy = () => {
    setStudying(false);
    setRestarts((n) => n + 1);
  };
  const steps = state.mode === null ? undefined : sessionSteps(state.mode, state.setup?.exception ?? "none");

  if (studying && state.phase === "home") {
    return (
      <HelpSessionProvider>
        <Shell onHome={exitStudy}>
          <StudyScreen
            answerKey={(v) => engine.env.answerKey(v)}
            {...(specialConsiderationOffered(engine.env) ? { designated: (v) => engine.env.designated!(v) } : {})}
            initialSpecialOnly={who === "65/20"}
            interpreterNote={who !== "none"}
            {...(engine.env.prepareCivics === undefined ? {} : { prepare: (v) => engine.env.prepareCivics!(v) })}
            onHome={exitStudy}
          />
        </Shell>
      </HelpSessionProvider>
    );
  }
  return (
    <HelpSessionProvider>
    <Shell
      {...(steps === undefined ? {} : { steps })}
      {...(state.phase === "home" ? {} : { currentStage: state.phase })}
      {...(state.phase === "home" ? {} : { onHome: restart })}
      // A practice with answers asks before going home; setup and reports go straight home.
      confirmHome={state.phase !== "home" && state.phase !== "intro" && state.phase !== "report"}
      languageOnPage={state.phase === "home"}
    >
      <Screen
        engine={engine}
        state={state}
        dispatch={dispatch}
        coach={coach}
        civicsLockedInBuild={civicsLockedInBuild}
        afterRestart={restarts > 0}
        onStudy={() => setStudying(true)}
        who={who}
        onWho={setWho}
        coachEntry={coachEntry}
        onCoachEntry={setCoachEntry}
        ownName={ownName}
        onOwnName={setOwnName}
        now={now}
        seed={seed}
        restart={restart}
      />
    </Shell>
    </HelpSessionProvider>
  );
}

interface ScreenProps {
  engine: PracticeEngine;
  state: PracticeState;
  dispatch: (action: PracticeAction) => void;
  coach: ReturnType<typeof createScriptedN400Coach>;
  civicsLockedInBuild: boolean;
  /** The screen is shown again after a restart (moves focus to its heading). */
  afterRestart?: boolean;
  /** Open "Study first" from the home screen. */
  onStudy?: () => void;
  who?: Who;
  onWho?: (who: Who) => void;
  /** Default "choice": ask before the first N-400 question. */
  coachEntry?: CoachEntry;
  onCoachEntry?: (entry: CoachEntry) => void;
  /** "Use my name": the learner's own name, held by PracticeApp in memory. */
  ownName?: string | undefined;
  onOwnName?: (name: string | undefined) => void;
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
  onStudy,
  who = "none",
  onWho = () => {},
  coachEntry = "choice",
  onCoachEntry = () => {},
  ownName,
  onOwnName = () => {},
  now,
  seed,
  restart,
}: ScreenProps) {
  const { env } = engine;
  // With "Use my name", the questions come from the same script with the name put in on this device.
  const n400Coach = useMemo(() => (ownName === undefined ? coach : createOwnNameCoach(coach, ownName)), [coach, ownName]);
  const ownNameOffered = env.content.profiles.some((p) => p.id === OWN_NAME_SCRIPT.baseProfileId);
  // The 65/20 practice, when this build offers it (verified rules and the designated list).
  const specialRules = specialConsiderationOffered(env) ? env.specialRules!() : null;

  switch (state.phase) {
    case "home":
      return (
        <HomeScreen
          civicsLocked={civicsLockedInBuild}
          focusOnFirstRender={afterRestart}
          // The first Home of this page load says where Text size is. Nothing is stored.
          showTextSizeHint={!afterRestart}
          specialOffered={specialRules !== null}
          who={who}
          onWho={onWho}
          {...(onStudy === undefined ? {} : { onStudy })}
          onChoose={(mode) => {
            onCoachEntry("choice");
            // The exception chosen on Home: setup starts with it chosen (it applies to parts with civics).
            const exception = exceptionOffered(env, who) ? who : "none";
            dispatch({ type: "choose", mode, seed: seed(), at: now(), ...(exception === "none" ? {} : { exception }) });
          }}
          onChooseCoach={() => {
            onCoachEntry("notice");
            dispatch({ type: "choose", mode: "n400", seed: seed(), at: now() });
          }}
        />
      );

    case "intro":
      return (
        <IntroScreen
          profiles={env.content.profiles}
          boundaryDate={env.boundaryDate}
          needs={modeNeeds(state.mode ?? "full")}
          {...(modeHasCivics(state.mode ?? "full") ? { exceptions: { initial: state.exceptionRequested, special: specialRules } } : {})}
          focusOnFirstRender
          {...(ownNameOffered ? { ownNameBaseProfileId: OWN_NAME_SCRIPT.baseProfileId } : {})}
          onStart={({ ownName: name, ...choice }) => {
            // The name stays here, in memory: the engine only gets the sample profile's id.
            onOwnName(name);
            const go = () => dispatch({ type: "start", ...choice, seed: seed(), at: now() });
            // The answer key and the official answers are fetched when a civics part starts.
            const needsCivics = modeParts(state.mode ?? "full").includes("civics") && choice.filedOn !== undefined;
            if (!needsCivics || env.prepareCivics === undefined) return go();
            void env
              .prepareCivics(civicsVersionFor(choice.filedOn!, env.boundaryDate))
              .catch(() => {})
              .then(go);
          }}
        />
      );

    case "n400_interview": {
      const profile = env.content.profiles.find((p) => p.id === state.setup?.profileId);
      if (profile === undefined) return null;
      return (
        <N400Screen
          coach={n400Coach}
          coachTransport={coachTransport}
          coachEntry={coachEntry}
          profile={profile}
          answers={state.n400Answers}
          total={env.content.n400Questions.length + (ownName === undefined ? 0 : 1)}
          {...(ownName === undefined ? {} : { ownName })}
          onAnswer={(prompt, transcript) =>
            dispatch({ type: "answerN400", questionId: prompt.id, questionText: prompt.text, transcript, at: now() })
          }
          nextIsReport={state.mode !== "full"}
          nextIsCivics={state.mode === "full" && !sessionParts(state).includes("reading")}
          onFinish={() => dispatch({ type: "finishN400", at: now() })}
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
          matchOptions={engine.matchOptions(kind)}
          nextIsReport={state.mode !== "full"}
          onSubmit={(transcript, input, alternatives, assisted) =>
            dispatch({
              type: kind === "reading" ? "submitReading" : "submitWriting",
              transcript,
              ...(alternatives === undefined ? {} : { alternatives }),
              ...(kind === "writing" && assisted === true ? { assisted: true } : {}),
              input,
              at: now(),
            })
          }
          onContinue={() => dispatch({ type: "continue", at: now() })}
          onRetry={() => dispatch({ type: "retryEnglish" })}
        />
      );
    }

    case "civics":
      return (
        <CivicsScreen
          progress={engine.civicsProgress(state)}
          version={state.setup?.version ?? "2008"}
          onSubmit={(response, input, alternatives) =>
            dispatch({ type: "submitCivics", response, ...(alternatives === undefined ? {} : { alternatives }), input, at: now() })
          }
          onContinue={() => dispatch({ type: "continue", at: now() })}
          onRestart={restart}
          {...(state.setup?.exception === "65/20" && engine.civicsRulesFor(state) !== null
            ? { special: engine.civicsRulesFor(state)! }
            : {})}
          exempt={state.setup !== null && englishExempt(state.setup.exception)}
        />
      );

    case "report": {
      if (state.partReport !== null) return <PartReportPage report={state.partReport} restart={restart} />;
      const session = engine.buildSession(state);
      if (session === null) return null;
      return <ReportPage session={session} restart={restart} exception={state.setup?.exception ?? "none"} />;
    }
  }
}

function PartReportPage({ report, restart }: { report: NonNullable<PracticeState["partReport"]>; restart: () => void }) {
  return <PartReportScreen report={report} onHome={restart} />;
}

/** The full report with the N-400 note and a way back. Focus starts on the report heading. */
function ReportPage({ session, restart, exception }: { session: InterviewSession; restart: () => void; exception: AgeException }) {
  const t = useT();
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    container.current?.querySelector<HTMLElement>("h1")?.focus();
  }, []);
  return (
    <div className="screen" ref={container}>
      <ReportScreen session={session} />
      {/* The choice made on Home or in setup, by name: "Practice as 55/15". */}
      {exception !== "none" && <p className="progress-line report__exception">{t("report.exception", { exception })}</p>}
      <p className="note"><LegalText messageKey="report.n400Note" /></p>
      {/* 50/20, 55/15 and 65/20 have no reading and writing: say why, with the USCIS source. */}
      {englishExempt(exception) && <SpecialLanguageLine />}
      <div className="btn-row">
        <button type="button" className="btn btn--primary" onClick={restart}>
          {t("report.again")}
        </button>
      </div>
    </div>
  );
}
