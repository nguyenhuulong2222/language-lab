/**
 * N-400 interview. The screen asks an N400Coach for each question, shows it with the sample
 * answer of the fictional profile, and records the user's own words. No scoring. The scripted
 * coach (data/practice/n400-questions.json) is the default. With a `coachTransport`, the screen
 * offers the optional AI coach (spec .kiro/specs/interview-coach): off by default, a notice before
 * it turns on, and a feedback step after each answer while it is on. Nothing is sent while it is off.
 *
 * "Use my name" (`ownName`, decisions log S): the officer greets the learner by name and the
 * full-name question's sample answer uses it; both are spoken only by a voice on this device. Every
 * other sample answer is the sample profile's, labelled so. Before an answer goes to the AI coach the
 * name is replaced by the sample profile's (`protectNameForCoach`); an answer that may still hold it,
 * and the spelling question, are not sent.
 */
import { Disclaimer } from "../components/Disclaimer";
import { LegalText } from "../components/LegalText";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { n400QuestionClipId, sampleAnswerClipId } from "../../engine/audio-clips";
import type { N400Answer, N400Coach, N400Prompt } from "../../engine/n400-coach";
import { loadCoachConfig } from "../../engine/coach/config";
import { createAiCoachSession, type CoachTransport } from "../coach/ai-coach-client";
import { createAiN400Coach } from "../coach/ai-n400-coach";
import { CoachFeedback, type CoachStep } from "../components/CoachFeedback";
import { CoachSwitch } from "../components/CoachSwitch";
import { CoachChoice } from "../components/CoachChoice";
import { initialCoachEntry, nextCoachEntry, type CoachEntry, type CoachEntryEvent, type CoachEntryState } from "../coach/coach-entry";
import type { CoachTurnResult } from "../../engine/coach/types";
import type { PracticeProfile } from "../../engine/practice-content";
import { fillName, isLocalOnlyQuestion, OWN_NAME_SCRIPT, protectNameForCoach } from "../../engine/own-name";
import { useT } from "../../i18n/react";
import { AnswerInput } from "../components/AnswerInput";
import { EnglishNotice } from "../components/EnglishNotice";
import { ReviewIcon } from "../components/icons";
import { ScreenHelp } from "../components/ScreenHelp";
import { SpeakButton } from "../components/SpeakButton";
import { TakeHeader } from "../components/TakeHeader";
import "../components/Screen.css";

interface N400ScreenProps {
  coach: N400Coach;
  profile: PracticeProfile;
  answers: readonly N400Answer[];
  /** Number of questions, when the coach knows it. */
  total?: number;
  onAnswer: (prompt: N400Prompt, transcript: string) => void;
  onFinish: () => void;
  /** After the interview comes the report (a single-part session), not reading. */
  nextIsReport?: boolean;
  /** After the interview comes civics (a full interview for 50/20, 55/15 or 65/20 has no reading and writing). */
  nextIsCivics?: boolean;
  /** Try loading the question again after a failure. */
  onRetry?: () => void;
  /** Offer the optional AI coach, sending through this transport (fetch in the app). */
  coachTransport?: CoachTransport;
  /** How the stage starts with the coach: ask first ("choice"), or open the notice at once ("notice"). */
  coachEntry?: CoachEntry;
  /** "Use my name": the learner's own name, from memory. `profile` is then the sample profile. */
  ownName?: string;
}
export type { CoachEntry };

type PromptState = { status: "loading" } | { status: "failed" } | { status: "done" } | { status: "ready"; prompt: N400Prompt };

export function N400Screen({ coach, profile, answers, total, onAnswer, onFinish, nextIsReport, nextIsCivics, coachTransport, coachEntry = "choice", ownName }: N400ScreenProps) {
  const [state, setState] = useState<PromptState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The AI coach lives as long as this screen: a new practice starts with it off.
  const session = useMemo(() => (coachTransport ? createAiCoachSession({ transport: coachTransport, config: loadCoachConfig() }) : null), [coachTransport]);
  const aiCoach = useMemo(() => (session ? createAiN400Coach(coach, session) : null), [coach, session]);
  const [coachOn, setCoachOn] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  // Before the first question: ask (or, from the home coach card, open the notice at once).
  const [entry, setEntry] = useState<CoachEntryState>(() => initialCoachEntry(session !== null, answers.length, coachEntry));
  const moveEntry = (event: CoachEntryEvent) => setEntry((current) => nextCoachEntry(current, event));
  const [offForSession, setOffForSession] = useState(false);
  const [step, setStep] = useState<{ prompt: N400Prompt; transcript: string; view: CoachStep } | null>(null);

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    coach.nextQuestion({ profile, answered: answers }).then(
      (prompt) => current && setState(prompt === null ? { status: "done" } : { status: "ready", prompt }),
      () => current && setState({ status: "failed" })
    );
    return () => {
      current = false;
    };
  }, [coach, profile, answers, attempt]);

  const submitAnswer = (prompt: N400Prompt, transcript: string) => {
    if (!aiCoach || !session || !coachOn || !session.consent) return onAnswer(prompt, transcript);
    // "Use my name": the spelling question is never sent, and the name never leaves the device.
    if (ownName !== undefined && isLocalOnlyQuestion(prompt.id)) return onAnswer(prompt, transcript);
    const sendable = ownName === undefined ? transcript : protectNameForCoach(transcript, ownName, profile.displayName);
    if (sendable === null) {
      setStep({ prompt, transcript, view: { status: "done", result: { kind: "screened", found: "own-name" } } });
      return;
    }
    setStep({ prompt, transcript, view: { status: "checking" } });
    const answer: N400Answer = { questionId: prompt.id, questionText: prompt.text, transcript: sendable };
    void aiCoach
      .turnFeedback({ profile, answered: [] }, answer)
      .catch((): CoachTurnResult => ({ kind: "fallback", reason: "error", disable: false }))
      .then((result) => {
        if (result.kind === "fallback" && result.disable) {
          setCoachOn(false);
          setOffForSession(true);
        }
        setStep({ prompt, transcript, view: { status: "done", result } });
      });
  };
  if (session && entry !== "done") {
    return (
      <CoachChoice
        noticeOpen={entry === "notice"}
        onUse={() => moveEntry("use")}
        onNo={() => moveEntry("no")}
        onCancel={() => moveEntry("cancel")}
        onConfirm={() => {
          // The only place, with the switch's notice, where consent is given.
          session.giveConsent();
          setCoachOn(session.consent);
          setOffForSession(!session.available);
          moveEntry("confirm");
        }}
      />
    );
  }
  const controls = session ? (
    <CoachSwitch
      on={coachOn}
      noticeOpen={noticeOpen}
      offForSession={offForSession}
      onRequestOn={() => setNoticeOpen(true)}
      onCancel={() => setNoticeOpen(false)}
      onConfirm={() => {
        session.giveConsent();
        setCoachOn(session.consent);
        setNoticeOpen(false);
      }}
      onTurnOff={() => {
        session.withdraw();
        setCoachOn(false);
      }}
    />
  ) : undefined;
  return (
    <N400View
      state={state}
      profile={profile}
      answers={answers}
      total={total}
      onAnswer={onAnswer}
      onSubmitAnswer={submitAnswer}
      onFinish={onFinish}
      onRetry={() => setAttempt((n) => n + 1)}
      {...(controls ? { coachControls: controls } : {})}
      {...(step
        ? {
            coachStep: (
              <CoachFeedback
                step={step.view}
                onNext={() => {
                  setStep(null);
                  onAnswer(step.prompt, step.transcript);
                }}
              />
            ),
          }
        : {})}
      {...(nextIsReport === undefined ? {} : { nextIsReport })}
      {...(nextIsCivics === undefined ? {} : { nextIsCivics })}
      {...(ownName === undefined ? {} : { ownName })}
    />
  );
}

interface N400ViewProps extends Omit<N400ScreenProps, "coach" | "coachTransport" | "coachEntry"> {
  state: PromptState;
  /** What "Save answer" does. Default: record the answer at once. */
  onSubmitAnswer?: (prompt: N400Prompt, transcript: string) => void;
  /** The AI coach switch, when the coach is offered. */
  coachControls?: ReactNode;
  /** The feedback step after an answer; it takes the place of the answer box. */
  coachStep?: ReactNode;
}

/** The screen without its data loading, so every state can be rendered and tested. */
export function N400View({ state, profile, answers, total, onAnswer, onFinish, nextIsReport = false, nextIsCivics = false, onRetry, onSubmitAnswer, coachControls, coachStep, ownName }: N400ViewProps) {
  const t = useT();
  const name = profile.displayName;
  const own = ownName !== undefined;

  if (state.status === "done") {
    return (
      <div className="screen">
        <TakeHeader stage="n400_interview" title={t("n400.done.title")} lead={t("n400.done.lead")} focusKey="done" />
        <div className="screen__body">
          <ol className="answer-list" lang="en">
            {answers.map((answer) => (
              <li key={answer.questionId}>
                <strong>{answer.questionText}</strong>
                <br />
                {answer.transcript}
              </li>
            ))}
          </ol>
          {/* Content-safety rule 5 (audit F-07): the prominent disclaimer directly under the answers. */}
          <Disclaimer variant="prominent" id="n400-done-disclaimer" messageKey="disclaimer.report" />
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={onFinish}>
              {nextIsReport ? t("report.see") : nextIsCivics ? t("writing.toCivics") : t("n400.done.next")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = answers.length + 1;
  return (
    <div className="screen">
      <TakeHeader
        stage="n400_interview"
        title={t("n400.title")}
        lead={own ? t("n400.lead.own") : t("n400.lead", { name })}
        focusKey={`question-${answers.length}`}
      />
      <EnglishNotice />
      <div className="screen__body">
        <p className="progress-line">
          {total === undefined ? t("n400.number", { current }) : t("n400.count", { current, total })}
        </p>
        <p className="note">
          <LegalText messageKey="n400.idNumbers.reminder" />
        </p>
        {coachControls}
        {state.status === "loading" && <p role="status">{t("n400.loading")}</p>}
        {state.status === "failed" && (
          <div className="screen__body">
            <p className="status status--attention" role="alert">
              <ReviewIcon className="icon-inline icon-inline--attention" /> {t("n400.failed")}
            </p>
            {onRetry !== undefined && (
              <div className="btn-row">
                <button type="button" className="btn btn--primary" onClick={onRetry}>
                  {t("common.retry")}
                </button>
              </div>
            )}
          </div>
        )}
        {state.status === "ready" && (
          <div key={state.prompt.id} className="screen__body">
            {own && state.prompt.id === OWN_NAME_SCRIPT.nameQuestionId && (
              <>
                {/* The officer greets the learner by name: built and spoken on this device only. */}
                <p className="prompt" lang="en">
                  {fillName(OWN_NAME_SCRIPT.greeting, ownName)}
                </p>
                <SpeakButton text={fillName(OWN_NAME_SCRIPT.greeting, ownName)} localOnly />
              </>
            )}
            <p className="prompt" lang="en">
              {state.prompt.text}
            </p>
            <SpeakButton text={state.prompt.text} clipId={n400QuestionClipId(state.prompt.id)} />
            {state.prompt.sampleAnswer !== null && (
              <OwnOrSampleAnswer prompt={state.prompt} profile={profile} ownName={ownName} />
            )}
            <ScreenHelp screen="n400" />
            {coachStep ?? (
              <AnswerInput
                label={own ? t("n400.yourAnswer.own") : t("n400.yourAnswer", { name })}
                submitLabel={t("n400.save")}
                voice
                onSubmit={(text) => (onSubmitAnswer ?? onAnswer)(state.prompt, text)}
                hint={<LegalText messageKey={own ? "n400.box.reminder.own" : "n400.box.reminder"} />}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The sample answer panel. With "Use my name", the full-name and spelling questions show the
 * learner's own name (spoken only by a voice on this device); every other answer is the sample
 * profile's and says so ("Sample profile").
 */
function OwnOrSampleAnswer({ prompt, profile, ownName }: { prompt: N400Prompt; profile: PracticeProfile; ownName: string | undefined }) {
  const t = useT();
  const name = profile.displayName;
  const sample = prompt.sampleAnswer ?? "";
  if (ownName === undefined) {
    return (
      <section className="panel panel--well">
        <h2 className="panel__title">{t("n400.sample.label", { name })}</h2>
        <p lang="en">{sample}</p>
        <SpeakButton text={sample} clipId={sampleAnswerClipId(prompt.id, profile.id)} labelKey="audio.playSample" large={false} />
        <p className="note"><LegalText messageKey="n400.sample.note" /></p>
      </section>
    );
  }
  const withName = prompt.id === OWN_NAME_SCRIPT.nameQuestionId || isLocalOnlyQuestion(prompt.id);
  if (withName) {
    return (
      <section className="panel panel--well">
        <h2 className="panel__title">{isLocalOnlyQuestion(prompt.id) ? t("n400.spell.label") : t("n400.sample.labelOwn")}</h2>
        <p lang="en">{sample}</p>
        <SpeakButton text={sample} labelKey="audio.playSample" large={false} localOnly />
      </section>
    );
  }
  return (
    <section className="panel panel--well">
      <p className="note">
        <strong>{t("n400.sampleProfile.badge")}</strong>
      </p>
      <h2 className="panel__title">{t("n400.sample.labelSampleProfile", { name })}</h2>
      <p lang="en">{sample}</p>
      <SpeakButton text={sample} clipId={sampleAnswerClipId(prompt.id, profile.id)} labelKey="audio.playSample" large={false} />
      <p className="note"><LegalText messageKey="n400.sampleProfile.note" /></p>
    </section>
  );
}
