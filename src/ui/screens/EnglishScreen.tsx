/**
 * Reading and writing share one screen. Reading: the sentence is shown and the user reads it
 * aloud (typed fallback); it is not played to them first. Writing: the sentence is played aloud and the user types it. After
 * each answer the comparison is shown; the stage ends where runEnglishStage ends it.
 */
import { LegalText } from "../components/LegalText";
import { useEffect, useRef, useState } from "react";
import { writingClipId } from "../../engine/audio-clips";
import type { EnglishProgress, InputMode } from "../../engine/practice-flow";
import type { MatchOptions } from "../../engine/sentence-compare";
import { useT } from "../../i18n/react";
import { AnswerInput } from "../components/AnswerInput";
import { ListenAndCompare } from "../components/ListenAndCompare";
import { SentenceFeedback } from "../components/SentenceFeedback";
import { EnglishNotice } from "../components/EnglishNotice";
import { ScreenHelp } from "../components/ScreenHelp";
import { SpeakButton } from "../components/SpeakButton";
import { TakeHeader } from "../components/TakeHeader";
import { useSelfReview } from "../voice/use-self-review";
import { useSpeaker } from "../voice/VoiceProvider";
import "../components/Screen.css";

interface EnglishScreenProps {
  progress: EnglishProgress;
  /** How an attempt is scored, from the practice config. Never decided here. */
  matchOptions: MatchOptions;
  /** `assisted` (writing): the sentence was on screen while the user typed. */
  onSubmit: (transcript: string, input: InputMode, alternatives?: readonly string[], assisted?: boolean) => void;
  onContinue: () => void;
  /** Try the last sentence again: its attempt is replaced by the next one. */
  onRetry?: () => void;
  /** After this stage comes the report (a single-part session), not another part. */
  nextIsReport?: boolean;
  /** Start in the feedback view (used to render that state). */
  showFeedbackInitially?: boolean;
}

export function EnglishScreen({
  progress,
  matchOptions,
  onSubmit,
  onContinue,
  onRetry,
  nextIsReport = false,
  showFeedbackInitially = false,
}: EnglishScreenProps) {
  const t = useT();
  const speaker = useSpeaker();
  const [feedback, setFeedback] = useState(showFeedbackInitially);
  // Counts the retries, so the heading takes focus again when the same sentence is asked again.
  const [retries, setRetries] = useState(0);
  // Writing: the id of the sentence the user chose to see (or that was shown because the audio failed).
  const [shownFor, setShownFor] = useState<string | null>(null);
  // Only when the user pressed "Show the sentence": its button disappears, so focus goes to the sentence.
  // After an audio failure the Play button stays and the status line speaks, so focus is not moved.
  const [focusShown, setFocusShown] = useState(false);
  const shownSentence = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!focusShown) return;
    shownSentence.current?.focus();
    setFocusShown(false);
  }, [focusShown]);
  const reading = progress.kind === "reading";
  const stage = progress.kind;

  const attempt = progress.lastAttempt;
  const target = progress.lastSentence;
  const showingFeedback = feedback && attempt !== null && target !== null;
  // Listen and compare belongs to reading. The recording is dropped when the sentence changes.
  const review = useSelfReview(reading ? (showingFeedback ? target.id : (progress.current?.id ?? null)) : null);

  if (showingFeedback) {
    return (
      <div className="screen">
        <TakeHeader stage={stage} title={reading ? t("reading.title") : t("writing.title")} focusKey={null} />
        <div className="screen__body">
          <SentenceFeedback target={target.text} attempt={attempt} matchOptions={matchOptions} kind={stage} />
          {reading && (
            <ListenAndCompare
              review={review}
              sentence={target}
              attempted
              onTryAgain={() => {
                onRetry?.();
                setRetries((n) => n + 1);
                setShownFor(null);
                setFeedback(false);
              }}
            />
          )}
          {!reading && onRetry !== undefined && (
            <div className="btn-row">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  onRetry();
                  setRetries((n) => n + 1);
                  setShownFor(null);
                  setFeedback(false);
                }}
              >
                {t("selfReview.tryAgain")}
              </button>
            </div>
          )}
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
                ? nextIsReport
                  ? t("report.see")
                  : reading
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
  // Writing with no way to play the sentence: it is shown, and the attempt is marked as assisted.
  const noVoice =
    !reading && sentence !== null && speaker.voiceFor({ text: sentence.text, clipId: writingClipId(sentence.id) }) === null;
  const sentenceShown = !reading && sentence !== null && (noVoice || shownFor === sentence.id);
  return (
    <div className="screen">
      <TakeHeader
        stage={stage}
        title={reading ? t("reading.title") : t("writing.title")}
        lead={reading ? t("reading.lead") : t("writing.lead")}
        focusKey={`sentence-${progress.position}-${retries}`}
      />
      <EnglishNotice />
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
              </>
            ) : (
              <>
                <p className="progress-line">{t("writing.sentence")}</p>
                <SpeakButton
                  text={sentence.text}
                  clipId={writingClipId(sentence.id)}
                  onFailed={() => setShownFor(sentence.id)}
                />
                {noVoice || shownFor === sentence.id ? (
                  <>
                    <p className="note">{noVoice ? t("writing.fallback") : t("writing.shown")}</p>
                    {noVoice && <p className="note">{t("writing.shown")}</p>}
                    <p className="prompt" lang="en" ref={shownSentence} tabIndex={-1}>
                      {sentence.text}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="note">{t("writing.hidden")}</p>
                    <div className="btn-row">
                      <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={() => {
                          setShownFor(sentence.id);
                          setFocusShown(true);
                        }}
                      >
                        {t("writing.show")}
                      </button>
                    </div>
                    <p className="note">{t("writing.show.help")}</p>
                  </>
                )}
              </>
            )}
            {reading && <ListenAndCompare review={review} sentence={sentence} attempted={false} />}
            <ScreenHelp screen={stage} />
            <AnswerInput
              label={reading ? t("reading.yourAnswer") : t("writing.yourAnswer")}
              submitLabel={reading ? t("reading.submit") : t("writing.submit")}
              voice={reading}
              onListenStart={() => {
                if (review.phase === "starting" || review.phase === "recording") review.stop();
              }}
              allowSkip
              onSubmit={(text, input, alternatives) => {
                setFeedback(true);
                onSubmit(text, input, alternatives, sentenceShown);
              }}
            />
            <p className="note"><LegalText messageKey="compare.setting" /></p>
            {!reading && (
              <p className="note">
                <LegalText messageKey="compare.setting.writing" />
              </p>
            )}
            <p className="note">
              <LegalText messageKey="compare.vocab" />
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
