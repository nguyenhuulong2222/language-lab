/**
 * N-400 interview. The screen asks an N400Coach for each question, shows it with the sample
 * answer of the fictional profile, and records the user's own words. No scoring, no AI: the
 * scripted coach reads data/practice/n400-questions.json. A coach that talks to a Worker can
 * be passed in its place without a change here.
 */
import { useEffect, useState } from "react";
import type { N400Answer, N400Coach, N400Prompt } from "../../engine/n400-coach";
import type { PracticeProfile } from "../../engine/practice-content";
import { useT } from "../../i18n/react";
import { AnswerInput } from "../components/AnswerInput";
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
}

type PromptState = { status: "loading" } | { status: "failed" } | { status: "done" } | { status: "ready"; prompt: N400Prompt };

export function N400Screen({ coach, profile, answers, total, onAnswer, onFinish }: N400ScreenProps) {
  const [state, setState] = useState<PromptState>({ status: "loading" });

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
  }, [coach, profile, answers]);

  return <N400View state={state} profile={profile} answers={answers} total={total} onAnswer={onAnswer} onFinish={onFinish} />;
}

interface N400ViewProps extends Omit<N400ScreenProps, "coach"> {
  state: PromptState;
}

/** The screen without its data loading, so every state can be rendered and tested. */
export function N400View({ state, profile, answers, total, onAnswer, onFinish }: N400ViewProps) {
  const t = useT();
  const name = profile.displayName;

  if (state.status === "done") {
    return (
      <div className="screen">
        <TakeHeader stage="n400_interview" title={t("n400.done.title")} lead={t("n400.done.lead")} focusKey="done" />
        <div className="screen__body">
          <ol className="answer-list">
            {answers.map((answer) => (
              <li key={answer.questionId}>
                <strong>{answer.questionText}</strong>
                <br />
                {answer.transcript}
              </li>
            ))}
          </ol>
          <div className="btn-row">
            <button type="button" className="btn" onClick={onFinish}>
              {t("n400.done.next")}
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
        lead={t("n400.lead", { name })}
        focusKey={`question-${answers.length}`}
      />
      <div className="screen__body">
        <p className="progress-line">
          {total === undefined ? t("n400.number", { current }) : t("n400.count", { current, total })}
        </p>
        {state.status === "loading" && <p role="status">{t("n400.loading")}</p>}
        {state.status === "failed" && <p className="status status--attention">{t("n400.failed")}</p>}
        {state.status === "ready" && (
          <div key={state.prompt.id} className="screen__body">
            <p className="prompt" lang="en">
              {state.prompt.text}
            </p>
            <SpeakButton text={state.prompt.text} />
            {state.prompt.sampleAnswer !== null && (
              <section className="panel panel--well">
                <h2 className="panel__title">{t("n400.sample.label", { name })}</h2>
                <p lang="en">{state.prompt.sampleAnswer}</p>
                <p className="note">{t("n400.sample.note")}</p>
              </section>
            )}
            <AnswerInput
              label={t("n400.yourAnswer", { name })}
              submitLabel={t("n400.save")}
              voice
              onSubmit={(text) => onAnswer(state.prompt, text)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
