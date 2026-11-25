/**
 * Civics: one static question at a time. The answer is graded by the real engine (answer key
 * and runCivicsStage) and this screen only shows the outcome and the official answers. The
 * stage ends exactly where the engine ends it. When the answer key is refused (production
 * build, answer key still waiting for review), the screen explains that instead of scoring.
 */
import type { CivicsPracticeRules } from "../../engine/test-rules-loader";
import { ExemptCivicsLine, SpecialConsiderationNote } from "../components/SpecialConsiderationNote";
import { LegalText } from "../components/LegalText";
import { useEffect, useRef, useState } from "react";
import type { CivicsProgress, InputMode } from "../../engine/practice-flow";
import { civicsClipId } from "../../engine/audio-clips";
import { pictureForQuestion, type PictureEntry } from "../../engine/question-images";
import { officialAnswerLines } from "../../engine/official-answer-text";
import type { CivicsTestVersion } from "../../engine/version-selector";
import { useT } from "../../i18n/react";
import { AnswerInput } from "../components/AnswerInput";
import { Disclaimer } from "../components/Disclaimer";
import { CheckIcon, ReviewIcon } from "../components/icons";
import { EnglishNotice } from "../components/EnglishNotice";
import { QuestionPicture } from "../components/QuestionPicture";
import { ScreenHelp } from "../components/ScreenHelp";
import { SpeakButton } from "../components/SpeakButton";
import { TakeHeader } from "../components/TakeHeader";
import { useTWithEnglish } from "../components/with-english";
import "../components/Screen.css";

interface CivicsScreenProps {
  progress: CivicsProgress;
  version: CivicsTestVersion;
  onSubmit: (response: string, input: InputMode, alternatives?: readonly string[]) => void;
  onContinue: () => void;
  onRestart: () => void;
  /** Start in the feedback view (used to render that state). */
  showFeedbackInitially?: boolean;
  /** The picture of a question (tests replace it). Used only in the feedback view, after grading. */
  pictureFor?: (questionId: string) => PictureEntry | null;
  /** The 65/20 rules when this is the 65/20 practice (spec release-finish REQ-S04). */
  special?: CivicsPracticeRules;
  /** 50/20, 55/15 or 65/20: the interpreter line under the stepper. */
  exempt?: boolean;
}
export function CivicsScreen({
  progress,
  version,
  onSubmit,
  onContinue,
  onRestart,
  showFeedbackInitially = false,
  pictureFor = pictureForQuestion,
  special,
  exempt = false,
}: CivicsScreenProps) {
  const t = useT();
  const tEnglish = useTWithEnglish();
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
          <p><LegalText messageKey="civics.locked.text" /></p>
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={onRestart}>
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
    // The picture comes only here, after the answer is graded: it could give the answer away.
    const picture = pictureFor(entry.id);
    return (
      <div className="screen">
        <TakeHeader stage="civics" title={t("civics.title")} focusKey={null} />
        <div className="screen__body">
          <p className="prompt" lang="en">
            {entry.questionText}
          </p>
          <section className="panel">
            {/* A big headline first, then one short reason, then the details. */}
            <h2 className="result-headline" ref={resultHeading} tabIndex={-1}>
              <Icon className={correct ? "icon-inline" : "icon-inline icon-inline--attention"} />{" "}
              {correct ? t("civics.correct") : t("civics.notYet")}
            </h2>
            <p className="result-reason">{correct ? t("civics.why.correct") : t("civics.why.notYet")}</p>
            <p>{tEnglish("civics.youSaid", { text: progress.lastResponse === "" ? "…" : (progress.lastResponse ?? "") })}</p>
            {progress.lastResponse !== "" && (
              <p className="note">
                {progress.lastInput === "voice" ? t("compare.honest.heard") : t("compare.honest.typed")}
                {progress.lastInput === "voice" && progress.lastAlternatives > 1 && <> {t("civics.heard.closest")}</>}
              </p>
            )}
            {lines !== null && (
              <>
                <h3 className="panel__title">{t("civics.official")}</h3>
                <ul className="answer-list" lang="en">
                  {lines.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
                <p className="note"><LegalText messageKey="civics.officialNote" /></p>
              </>
            )}
            {entry.requiredAnswerCount > 1 && (
              <p className="note">{t("civics.needs", { count: entry.requiredAnswerCount })}</p>
            )}
            {picture !== null && <QuestionPicture picture={picture} />}
          </section>
          {/* Content-safety rule 5 (audit F-07): the prominent disclaimer directly under the result. */}
          <Disclaimer variant="prominent" id="civics-result-disclaimer" messageKey="disclaimer.report" />
          {progress.done && (
            <p className="status">
              {stopped === "correct_threshold"
                ? <LegalText messageKey="civics.stopped.correct" />
                : stopped === "incorrect_threshold"
                  ? <LegalText messageKey="civics.stopped.incorrect" />
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
              className="btn btn--primary"
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
      <EnglishNotice />
      <div className="screen__body">
        {/* 50/20, 55/15, 65/20: the interpreter line, once, near the top. */}
        {exempt && <ExemptCivicsLine />}
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
            <ScreenHelp screen="civics" />
            <AnswerInput
              label={t("civics.yourAnswer")}
              submitLabel={t("civics.submit")}
              voice
              allowSkip
              onSubmit={(text, input, alternatives) => {
                setFeedback(true);
                onSubmit(text, input, alternatives);
              }}
            />
            {/* After the question and the answer box, so they stay at the top (ui-reviewer). */}
            {special !== undefined && progress.position === 1 && <SpecialConsiderationNote rules={special} languageLine={false} />}
          </div>
        )}
      </div>
    </div>
  );
}
