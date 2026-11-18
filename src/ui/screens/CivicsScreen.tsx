/**
 * Civics: one static question at a time. The answer is graded by the real engine (answer key
 * and runCivicsStage) and this screen only shows the outcome and the official answers. The
 * stage ends exactly where the engine ends it. When the answer key is refused (production
 * build, answer key still waiting for review), the screen explains that instead of scoring.
 */
import { useEffect, useRef, useState } from "react";
import type { CivicsProgress, InputMode } from "../../engine/practice-flow";
import { civicsClipId } from "../../engine/audio-clips";
import { officialAnswerLines } from "../../engine/official-answer-text";
import type { CivicsTestVersion } from "../../engine/version-selector";
import { useT } from "../../i18n/react";
import { AnswerInput } from "../components/AnswerInput";
import { Disclaimer } from "../components/Disclaimer";
import { CheckIcon, ReviewIcon } from "../components/icons";
import { ScreenHelp } from "../components/ScreenHelp";
import { SpeakButton } from "../components/SpeakButton";
import { TakeHeader } from "../components/TakeHeader";
import "../components/Screen.css";

interface CivicsScreenProps {
  progress: CivicsProgress;
  version: CivicsTestVersion;
  onSubmit: (response: string, input: InputMode) => void;
  onContinue: () => void;
  onRestart: () => void;
  /** Start in the feedback view (used to render that state). */
  showFeedbackInitially?: boolean;
}

export function CivicsScreen({
  progress,
  version,
  onSubmit,
  onContinue,
  onRestart,
  showFeedbackInitially = false,
}: CivicsScreenProps) {
  const t = useT();
  const [feedback, setFeedback] = useState(showFeedbackInitially);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const showingFeedback = feedback && progress.last !== null && progress.result !== null;

  // The result appears after a button press: move focus to it so it is read first.
  useEffect(() => {
    if (showingFeedback) resultHeading.current?.focus();
  }, [showingFeedback]);

  if (progress.locked) {
    return (
      <div className="screen">
        <TakeHeader stage="civics" title={t("civics.locked.title")} />
        <div className="screen__body">
          <p>{t("civics.locked.text")}</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={onRestart}>
              {t("common.startOver")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (feedback && progress.last !== null && progress.result !== null) {
    const { entry, result } = progress.last;
    const correct = result === "correct";
    const Icon = correct ? CheckIcon : ReviewIcon;
    const lines = officialAnswerLines(version, entry.id);
    const stopped = progress.result.stopReason;
    return (
      <div className="screen">
        <TakeHeader stage="civics" title={t("civics.title")} focusKey={null} />
        <div className="screen__body">
          <p className="prompt" lang="en">
            {entry.questionText}
          </p>
          <section className="panel">
            <h2 className="panel__title" ref={resultHeading} tabIndex={-1}>
              <Icon className={correct ? "icon-inline" : "icon-inline icon-inline--attention"} />{" "}
              {correct ? t("civics.correct") : t("civics.notYet")}
            </h2>
            <p>{t("civics.youSaid", { text: progress.lastResponse === "" ? "…" : (progress.lastResponse ?? "") })}</p>
            {lines !== null && (
              <>
                <h3 className="panel__title">{t("civics.official")}</h3>
                <ul className="answer-list" lang="en">
                  {lines.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
                <p className="note">{t("civics.officialNote")}</p>
              </>
            )}
            {entry.requiredAnswerCount > 1 && (
              <p className="note">{t("civics.needs", { count: entry.requiredAnswerCount })}</p>
            )}
            <Disclaimer text={t("disclaimer.short")} />
          </section>
          {progress.done && (
            <p className="status">
              {stopped === "correct_threshold"
                ? t("civics.stopped.correct")
                : stopped === "incorrect_threshold"
                  ? t("civics.stopped.incorrect")
                  : t("civics.stopped.none")}{" "}
              {t("civics.tally", {
                correct: progress.result.correctCount,
                incorrect: progress.result.incorrectCount,
              })}
            </p>
          )}
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setFeedback(false);
                if (progress.done) onContinue();
              }}
            >
              {progress.done ? t("civics.finish") : t("civics.next")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = progress.current;
  return (
    <div className="screen">
      <TakeHeader
        stage="civics"
        title={t("civics.title")}
        lead={t("civics.lead")}
        focusKey={`question-${progress.position}`}
      />
      <ScreenHelp screen="civics" />
      <div className="screen__body">
        <p className="progress-line">{t("civics.count", { current: progress.position, total: progress.total })}</p>
        {question !== null && (
          <div key={question.id} className="screen__body">
            <p className="prompt" lang="en">
              {question.questionText}
            </p>
            <SpeakButton text={question.questionText} clipId={civicsClipId(question.id)} />
            {question.requiredAnswerCount > 1 && (
              <p className="note">{t("civics.needs", { count: question.requiredAnswerCount })}</p>
            )}
            <AnswerInput
              label={t("civics.yourAnswer")}
              submitLabel={t("civics.submit")}
              voice
              allowSkip
              onSubmit={(text, input) => {
                setFeedback(true);
                onSubmit(text, input);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
