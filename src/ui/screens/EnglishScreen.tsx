/**
 * Reading and writing share one screen. Reading: the sentence is shown and the user reads it
 * aloud (typed fallback). Writing: the sentence is played aloud and the user types it. After
 * each answer the comparison is shown; the stage ends where runEnglishStage ends it.
 */
import { useState } from "react";
import type { EnglishProgress, InputMode } from "../../engine/practice-flow";
import { useT } from "../../i18n/react";
import { AnswerInput } from "../components/AnswerInput";
import { SentenceFeedback } from "../components/SentenceFeedback";
import { SpeakButton } from "../components/SpeakButton";
import { TakeHeader } from "../components/TakeHeader";
import { useSpeaker } from "../voice/VoiceProvider";
import "../components/Screen.css";

interface EnglishScreenProps {
  progress: EnglishProgress;
  /** Words that must match, from the practice config. Shown, never decided here. */
  minWordAccuracy: number;
  onSubmit: (transcript: string, input: InputMode) => void;
  onContinue: () => void;
  /** Start in the feedback view (used to render that state). */
  showFeedbackInitially?: boolean;
}

export function EnglishScreen({
  progress,
  minWordAccuracy,
  onSubmit,
  onContinue,
  showFeedbackInitially = false,
}: EnglishScreenProps) {
  const t = useT();
  const speaker = useSpeaker();
  const [feedback, setFeedback] = useState(showFeedbackInitially);
  const reading = progress.kind === "reading";
  const stage = progress.kind;

  const attempt = progress.lastAttempt;
  const target = progress.lastSentence;

  if (feedback && attempt !== null && target !== null) {
    return (
      <div className="screen">
        <TakeHeader stage={stage} title={reading ? t("reading.title") : t("writing.title")} focusKey={null} />
        <div className="screen__body">
          <SentenceFeedback target={target.text} attempt={attempt} minWordAccuracy={minWordAccuracy} kind={stage} />
          {progress.done && (
            <p className="status">
              {progress.result.passed
                ? reading
                  ? t("reading.done.passed")
                  : t("writing.done.passed")
                : reading
                  ? t("reading.done.notPassed")
                  : t("writing.done.notPassed")}
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
              {progress.done
                ? reading
                  ? t("reading.toWriting")
                  : t("writing.toCivics")
                : reading
                  ? t("reading.next")
                  : t("writing.next")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sentence = progress.current;
  return (
    <div className="screen">
      <TakeHeader
        stage={stage}
        title={reading ? t("reading.title") : t("writing.title")}
        lead={reading ? t("reading.lead") : t("writing.lead")}
        focusKey={`sentence-${progress.position}`}
      />
      <div className="screen__body">
        <p className="progress-line">
          {reading
            ? t("reading.count", { current: progress.position, total: progress.total })
            : t("writing.count", { current: progress.position, total: progress.total })}
        </p>
        {sentence !== null && (
          <div key={sentence.id} className="screen__body">
            {reading ? (
              <>
                <p className="progress-line">{t("reading.sentence")}</p>
                <p className="prompt" lang="en">
                  {sentence.text}
                </p>
                <SpeakButton text={sentence.text} />
              </>
            ) : (
              <>
                <p className="progress-line">{t("writing.sentence")}</p>
                <SpeakButton text={sentence.text} />
                {speaker.available ? (
                  <p className="note">{t("writing.hidden")}</p>
                ) : (
                  <>
                    <p className="note">{t("writing.fallback")}</p>
                    <p className="prompt" lang="en">
                      {sentence.text}
                    </p>
                  </>
                )}
              </>
            )}
            <AnswerInput
              label={reading ? t("reading.yourAnswer") : t("writing.yourAnswer")}
              submitLabel={reading ? t("reading.submit") : t("writing.submit")}
              voice={reading}
              allowSkip
              onSubmit={(text, input) => {
                setFeedback(true);
                onSubmit(text, input);
              }}
            />
            <p className="note">{t("compare.setting", { percent: Math.round(minWordAccuracy * 100) })}</p>
            <p className="note">{t("compare.vocab")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
